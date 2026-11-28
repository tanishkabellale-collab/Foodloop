/**
 * FoodLoop Last-Mile Pickup & Delivery Service
 *
 * Manages volunteer courier claims, pickup/drop-off OTP handshakes,
 * temperature/condition logs, route metrics, and atomic status completion.
 */

const crypto = require('crypto');
const { calculateDistanceKm } = require('./matchingService');

const DELIVERY_STATUSES = {
  PENDING_DISPATCH: 'pending_dispatch',
  ASSIGNED: 'assigned',
  EN_ROUTE_PICKUP: 'en_route_pickup',
  PICKED_UP: 'picked_up',
  IN_TRANSIT: 'in_transit',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
};

const VALID_TRANSITIONS = {
  pending_dispatch: ['assigned', 'cancelled'],
  assigned: ['en_route_pickup', 'picked_up', 'cancelled'],
  en_route_pickup: ['picked_up', 'cancelled'],
  picked_up: ['in_transit', 'delivered'],
  in_transit: ['delivered'],
  delivered: [],
  cancelled: [],
};

function generateOtp() {
  return String(crypto.randomInt(1000, 9999));
}

function hydrateDelivery(row) {
  if (!row) return null;
  return {
    id: row.id,
    donation_id: row.donation_id,
    ngo_id: row.ngo_id,
    ngo_name: row.ngo_name,
    volunteer_user_id: row.volunteer_user_id,
    volunteer_name: row.volunteer_name,
    vehicle_type: row.vehicle_type,
    status: row.status,
    pickup_otp: row.pickup_otp,
    delivery_otp: row.delivery_otp,
    pickup_address: row.pickup_address,
    dropoff_address: row.dropoff_address,
    distance_km: row.distance_km !== null && row.distance_km !== undefined ? Number(row.distance_km) : null,
    estimated_duration_min:
      row.estimated_duration_min !== null && row.estimated_duration_min !== undefined
        ? Number(row.estimated_duration_min)
        : null,
    pickup_temp_celsius:
      row.pickup_temp_celsius !== null && row.pickup_temp_celsius !== undefined
        ? Number(row.pickup_temp_celsius)
        : null,
    pickup_note: row.pickup_note,
    delivery_note: row.delivery_note,
    scheduled_pickup_at: row.scheduled_pickup_at,
    picked_up_at: row.picked_up_at,
    delivered_at: row.delivered_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/**
 * Redact OTP secrets based on actor role so volunteers cannot bypass physical handoffs.
 */
function sanitizeDeliveryForRole(delivery, donation, user) {
  if (!delivery) return null;
  const copy = { ...delivery };
  const role = user?.role;
  const isOwnerDonor = Boolean(donation && donation.donor_id === user?.id) || Boolean(user?.is_demo && role === 'DONOR');
  const isAssignedNgo = Boolean(
    role === 'NGO' &&
    ((delivery.ngo_id && user?.ngo_id === delivery.ngo_id) ||
      (donation && donation.accepted_by_user_id === user?.id))
  );
  const isAdmin = role === 'ADMIN';

  if (!isOwnerDonor && !isAssignedNgo && !isAdmin) {
    copy.pickup_otp = null;
  }
  if (!isAssignedNgo && !isAdmin) {
    copy.delivery_otp = null;
  }
  if (donation) {
    copy.donation_title = donation.title || donation.foodName;
    copy.food_category = donation.food_category;
    copy.quantityText = donation.quantityText || `${donation.quantity} ${donation.quantity_unit}`;
    copy.pickup_available_until = donation.pickup_available_until || donation.expiryTime;
    copy.donor_latitude = donation.latitude ?? null;
    copy.donor_longitude = donation.longitude ?? null;
  }
  return copy;
}

function createDeliveryService(db) {
  function getByDonationId(donationId) {
    const row = db.sqlite.prepare('SELECT * FROM deliveries WHERE donation_id = ?').get(String(donationId));
    return hydrateDelivery(row);
  }

  function getById(id) {
    const row = db.sqlite.prepare('SELECT * FROM deliveries WHERE id = ?').get(String(id));
    return hydrateDelivery(row);
  }

  function ensureDeliveryForDonation(donation, ngo = null) {
    const existing = getByDonationId(donation.id);
    if (existing) return existing;

    const now = new Date().toISOString();
    const id = `del-${Date.now()}-${Math.round(Math.random() * 1e5)}`;
    const pickupOtp = generateOtp();
    const deliveryOtp = generateOtp();

    let distanceKm = null;
    let estDurationMin = null;
    if (
      typeof donation.latitude === 'number' &&
      typeof donation.longitude === 'number' &&
      ngo &&
      typeof ngo.latitude === 'number' &&
      typeof ngo.longitude === 'number'
    ) {
      distanceKm = calculateDistanceKm(donation.latitude, donation.longitude, ngo.latitude, ngo.longitude);
      estDurationMin = Math.max(10, Math.round(distanceKm * 3.5 + 10));
    }

    const dropoffAddress =
      ngo?.location_text ||
      donation.matched_ngo_name ||
      'Assigned NGO Receiving Center';

    db.sqlite.prepare(`
      INSERT INTO deliveries (
        id, donation_id, ngo_id, ngo_name, status, pickup_otp, delivery_otp,
        pickup_address, dropoff_address, distance_km, estimated_duration_min,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      donation.id,
      donation.matched_ngo_id || ngo?.id || null,
      donation.matched_ngo_name || ngo?.name || null,
      DELIVERY_STATUSES.PENDING_DISPATCH,
      pickupOtp,
      deliveryOtp,
      donation.address_text || donation.location || '',
      dropoffAddress,
      distanceKm,
      estDurationMin,
      now,
      now
    );

    return getById(id);
  }

  function listDeliveriesForUser(user) {
    const rows = db.sqlite.prepare('SELECT * FROM deliveries ORDER BY created_at DESC').all().map(hydrateDelivery);
    const results = [];

    for (const del of rows) {
      const donation = db.getDonationById(del.donation_id);
      if (user.role === 'DONOR') {
        const ownsDonation =
          donation &&
          (donation.donor_id === user.id || (!donation.donor_id && user.is_demo));
        if (!ownsDonation) continue;
      } else if (user.role === 'NGO') {
        const belongsToNgo =
          (user.ngo_id && del.ngo_id === user.ngo_id) ||
          (donation && donation.accepted_by_user_id === user.id);
        if (!belongsToNgo) continue;
      } else if (user.role === 'VOLUNTEER') {
        const canSee =
          del.status === DELIVERY_STATUSES.PENDING_DISPATCH ||
          del.volunteer_user_id === user.id;
        if (!canSee) continue;
      }
      const hydrated = sanitizeDeliveryForRole(del, donation, user);
      const ngo = del.ngo_id ? db.getNgoById(del.ngo_id) : null;
      if (ngo) {
        hydrated.ngo_latitude = ngo.latitude ?? null;
        hydrated.ngo_longitude = ngo.longitude ?? null;
      }
      results.push(hydrated);
    }

    return results;
  }

  function claimDelivery(deliveryId, user, { vehicle_type = 'Two-Wheeler / Compact Van', scheduled_pickup_at = null } = {}) {
    return db.withTransaction(() => {
      const del = getById(deliveryId);
      if (!del) {
        const err = new Error('Delivery record not found.');
        err.status = 404;
        throw err;
      }
      if (del.status !== DELIVERY_STATUSES.PENDING_DISPATCH && user.role !== 'ADMIN') {
        const err = new Error('This delivery has already been claimed by a courier.');
        err.status = 400;
        throw err;
      }
      const now = new Date().toISOString();
      db.sqlite.prepare(`
        UPDATE deliveries SET
          volunteer_user_id = ?, volunteer_name = ?, vehicle_type = ?,
          scheduled_pickup_at = ?, status = ?, updated_at = ?
        WHERE id = ?
      `).run(
        user.id,
        user.name,
        String(vehicle_type || 'Standard Vehicle').slice(0, 60),
        scheduled_pickup_at || now,
        DELIVERY_STATUSES.ASSIGNED,
        now,
        deliveryId
      );
      const updated = getById(deliveryId);
      const donation = db.getDonationById(updated.donation_id);
      return sanitizeDeliveryForRole(updated, donation, user);
    });
  }

  function updateDeliveryStatus(deliveryId, user, { status, otp, pickup_temp_celsius = null, note = null } = {}) {
    const nextStatus = String(status || '').trim().toLowerCase();
    if (!nextStatus) {
      const err = new Error('Target delivery status is required.');
      err.status = 400;
      throw err;
    }

    return db.withTransaction(() => {
      const del = getById(deliveryId);
      if (!del) {
        const err = new Error('Delivery record not found.');
        err.status = 404;
        throw err;
      }

      const allowed = VALID_TRANSITIONS[del.status] || [];
      if (!allowed.includes(nextStatus)) {
        const err = new Error(`Invalid delivery transition from "${del.status}" to "${nextStatus}".`);
        err.status = 400;
        throw err;
      }

      const donation = db.getDonationById(del.donation_id);
      const isAssignedVolunteer = del.volunteer_user_id === user.id;
      const isAssignedNgo =
        user.role === 'NGO' &&
        ((del.ngo_id && user.ngo_id === del.ngo_id) ||
          (donation && donation.accepted_by_user_id === user.id));
      const isAdmin = user.role === 'ADMIN';

      if (!isAssignedVolunteer && !isAssignedNgo && !isAdmin) {
        const err = new Error('You are not authorized to update this delivery.');
        err.status = 403;
        throw err;
      }

      // OTP enforcement on pickup by courier/admin
      if (nextStatus === DELIVERY_STATUSES.PICKED_UP && !isAdmin) {
        if (String(otp || '').trim() !== del.pickup_otp) {
          const err = new Error('Invalid 4-digit Pickup OTP. Confirm the code with the donor at handoff.');
          err.status = 400;
          throw err;
        }
      }

      // OTP enforcement on delivery unless confirmed directly by the receiving NGO or Admin
      if (nextStatus === DELIVERY_STATUSES.DELIVERED && !isAssignedNgo && !isAdmin) {
        if (String(otp || '').trim() !== del.delivery_otp) {
          const err = new Error('Invalid 4-digit Delivery OTP. Confirm the drop-off code with the NGO.');
          err.status = 400;
          throw err;
        }
      }

      const now = new Date().toISOString();
      const parsedTemp =
        pickup_temp_celsius !== null && pickup_temp_celsius !== undefined && pickup_temp_celsius !== ''
          ? Number(pickup_temp_celsius)
          : del.pickup_temp_celsius;

      if (parsedTemp !== null && (Number.isNaN(parsedTemp) || parsedTemp < -30 || parsedTemp > 120)) {
        const err = new Error('Pickup temperature must be between -30°C and 120°C.');
        err.status = 400;
        throw err;
      }

      const pickedUpAt = nextStatus === DELIVERY_STATUSES.PICKED_UP ? now : del.picked_up_at;
      const deliveredAt = nextStatus === DELIVERY_STATUSES.DELIVERED ? now : del.delivered_at;
      const pickupNote =
        nextStatus === DELIVERY_STATUSES.PICKED_UP && note ? String(note).trim() : del.pickup_note;
      const deliveryNote =
        nextStatus === DELIVERY_STATUSES.DELIVERED && note ? String(note).trim() : del.delivery_note;

      db.sqlite.prepare(`
        UPDATE deliveries SET
          status = ?, pickup_temp_celsius = ?, pickup_note = ?, delivery_note = ?,
          picked_up_at = ?, delivered_at = ?, updated_at = ?
        WHERE id = ?
      `).run(
        nextStatus,
        parsedTemp,
        pickupNote,
        deliveryNote,
        pickedUpAt,
        deliveredAt,
        now,
        deliveryId
      );

      if (nextStatus === DELIVERY_STATUSES.DELIVERED && donation && donation.status !== 'collected') {
        db.updateDonationFields(donation.id, {
          status: 'collected',
          updated_at: now,
        });
      }

      const updated = getById(deliveryId);
      const updatedDonation = db.getDonationById(updated.donation_id);
      return sanitizeDeliveryForRole(updated, updatedDonation, user);
    });
  }

  return {
    getByDonationId,
    getById,
    ensureDeliveryForDonation,
    listDeliveriesForUser,
    claimDelivery,
    updateDeliveryStatus,
  };
}

module.exports = {
  DELIVERY_STATUSES,
  VALID_TRANSITIONS,
  createDeliveryService,
  sanitizeDeliveryForRole,
};
