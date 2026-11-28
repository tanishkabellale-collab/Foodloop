require('dotenv').config({ quiet: true });
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const { createDatabase } = require('./db/database');
const {
  assessFoodImage,
  validateAndInspectImage,
  stripExifMetadata,
  getAiCapabilities,
  SAFETY_DISCLAIMER,
} = require('./services/aiAssessmentService');
const { rankNgosForDonation } = require('./services/matchingService');
const { MATCHING_WEIGHTS, UNIT_TO_SERVINGS } = require('./config/matchingWeights');
const { DEMO_NGOS } = require('./data/demoNgos');
const { ROLES, revokeToken, createAuthStore } = require('./services/authService');
const { createAuthMiddleware } = require('./middleware/authMiddleware');
const { createDeliveryService } = require('./services/deliveryService');
const { securityHeaders, createRateLimiter } = require('./middleware/securityMiddleware');

const PORT = process.env.PORT || 5001;

/**
 * Normalize & sanitize client-submitted AI payloads so clients cannot spoof safety claims.
 */
function sanitizeIncomingAiPayload(raw) {
  if (!raw) return null;
  let parsed = raw;
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!parsed || typeof parsed !== 'object') return null;

  return {
    assessment_status: parsed.assessment_status === 'completed' ? 'completed' : 'requires_human_review',
    assessment_mode: String(parsed.assessment_mode || 'demo_fallback'),
    is_demo_fallback: Boolean(parsed.is_demo_fallback),
    suggested_food_category: parsed.suggested_food_category || 'uncertain',
    possible_food_description: parsed.possible_food_description
      ? String(parsed.possible_food_description).slice(0, 500)
      : null,
    packaging_condition_observations: Array.isArray(parsed.packaging_condition_observations)
      ? parsed.packaging_condition_observations.slice(0, 6).map(String)
      : [],
    suggested_dietary_labels: Array.isArray(parsed.suggested_dietary_labels)
      ? parsed.suggested_dietary_labels.slice(0, 5).map(String)
      : [],
    missing_information: Array.isArray(parsed.missing_information)
      ? parsed.missing_information.slice(0, 6).map(String)
      : [],
    confidence_level: parsed.confidence_level || null,
    confidence_score:
      typeof parsed.confidence_score === 'number' ? parsed.confidence_score : null,
    human_review_recommended:
      typeof parsed.human_review_recommended === 'boolean' ? parsed.human_review_recommended : true,
    human_review_reason: parsed.human_review_reason
      ? String(parsed.human_review_reason).slice(0, 300)
      : null,
    onnx_produce_screening: parsed.onnx_produce_screening || null,
    visual_assessment_label: parsed.visual_assessment_label || null,
    predicted_class:
      typeof parsed.predicted_class === 'number' ? parsed.predicted_class : null,
    probability_fresh:
      typeof parsed.probability_fresh === 'number' ? parsed.probability_fresh : null,
    probability_rotten:
      typeof parsed.probability_rotten === 'number' ? parsed.probability_rotten : null,
    model_version: String(parsed.model_version || 'unknown'),
    assessed_at: parsed.assessed_at || new Date().toISOString(),
    safety_disclaimer: SAFETY_DISCLAIMER,
    disclaimer: SAFETY_DISCLAIMER,
  };
}

function serializeDonation(d, delivery = null) {
  const title = d.title || d.foodName || 'Surplus Food';
  const address_text = d.address_text || d.location || '';
  const pickup_available_until = d.pickup_available_until || d.expiryTime || '';

  let quantity_val = 1;
  let quantity_unit = d.quantity_unit || 'servings';
  if (typeof d.quantity === 'number') {
    quantity_val = d.quantity;
  } else if (typeof d.quantity === 'string') {
    const parsed = parseFloat(d.quantity);
    quantity_val = Number.isNaN(parsed) ? 1 : parsed;
    const unitMatch = d.quantity.replace(/^[0-9.\s]+/, '').trim();
    if (unitMatch && !d.quantity_unit) {
      quantity_unit = unitMatch;
    }
  }
  const quantityLegacy =
    d.quantityText ||
    (typeof d.quantity === 'string' ? d.quantity : `${quantity_val} ${quantity_unit}`);

  let urgency_window_minutes = null;
  let is_expired = false;
  if (pickup_available_until) {
    const diffMs = new Date(pickup_available_until).getTime() - Date.now();
    if (!Number.isNaN(diffMs)) {
      urgency_window_minutes = Math.max(0, Math.round(diffMs / 60000));
      is_expired = diffMs <= 0;
    }
  }

  return {
    id: d.id,
    donor_id: d.donor_id || null,
    title,
    food_category: d.food_category || 'cooked_meals',
    dietary_type: d.dietary_type || 'vegetarian',
    quantity: quantity_val,
    quantity_unit,
    image_url: d.image_url || null,
    pickup_available_until,
    address_text,
    latitude: d.latitude !== undefined ? d.latitude : null,
    longitude: d.longitude !== undefined ? d.longitude : null,
    preparation_time: d.preparation_time || null,
    current_storage: d.current_storage || null,
    expiry_date: d.expiry_date || null,
    packaging_type: d.packaging_type || null,
    allergens: d.allergens || null,
    special_note: d.special_note || null,
    ai_assessment: d.ai_assessment || null,
    status: d.status || 'submitted',
    matched_ngo_id: d.matched_ngo_id || null,
    matched_ngo_name: d.matched_ngo_name || null,
    accepted_by_user_id: d.accepted_by_user_id || null,
    review_status: d.review_status || null,
    review_note: d.review_note || null,
    reviewed_by: d.reviewed_by || null,
    reviewed_at: d.reviewed_at || null,
    created_at: d.created_at || d.createdAt || new Date().toISOString(),
    updated_at: d.updated_at || d.created_at || d.createdAt || new Date().toISOString(),
    urgency_window_minutes,
    is_expired,
    ...(delivery ? { delivery_status: delivery.status, delivery_id: delivery.id } : {}),
    // Legacy backward compatibility aliases
    foodName: title,
    location: address_text,
    expiryTime: pickup_available_until,
    quantityText: quantityLegacy,
    createdAt: d.created_at || d.createdAt || new Date().toISOString(),
  };
}

function createServerApp(options = {}) {
  const app = express();
  const uploadsDir = options.uploadsDir || path.join(__dirname, 'uploads');
  const legacyDataFile = options.legacyDataFile !== undefined
    ? options.legacyDataFile
    : path.join(__dirname, 'data.json');
  const legacyUsersFile = options.legacyUsersFile !== undefined
    ? options.legacyUsersFile
    : path.join(__dirname, 'data', 'users.json');

  const db = createDatabase({ dbPath: options.dbPath });
  db.bootstrapSeedData({
    legacyDataFile,
    legacyUsersFile,
    demoNgos: DEMO_NGOS,
  });

  const authStore = createAuthStore(db);
  const { authenticate, authorizeRoles } = createAuthMiddleware(authStore);
  const deliveryService = createDeliveryService(db);

  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  const allowedOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map((s) => s.trim()).filter(Boolean)
    : null;

  app.use(securityHeaders);
  app.use(
    cors(
      allowedOrigins
        ? {
            origin: allowedOrigins,
            exposedHeaders: ['X-Total-Count'],
          }
        : { exposedHeaders: ['X-Total-Count'] }
    )
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  app.use('/uploads', express.static(uploadsDir));

  const authLimiter = createRateLimiter({ windowMs: 60000, maxRequests: 60, name: 'auth' });
  const aiLimiter = createRateLimiter({ windowMs: 60000, maxRequests: 40, name: 'ai' });

  // SSE Realtime Client Registry
  const sseClients = new Set();

  function broadcastEvent(eventType, payload = {}) {
    const packet = `event: ${eventType}\ndata: ${JSON.stringify({
      type: eventType,
      timestamp: new Date().toISOString(),
      ...payload,
    })}\n\n`;
    for (const client of sseClients) {
      try {
        client.res.write(packet);
      } catch {
        sseClients.delete(client);
      }
    }
  }

  // Multer photo upload config
  const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
      cb(null, `donation-${uniqueSuffix}${ext}`);
    },
  });

  const fileFilter = (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (allowedMimes.includes((file.mimetype || '').toLowerCase())) {
      cb(null, true);
    } else {
      cb(new Error('Invalid image type. Only JPG, PNG, and WebP images are allowed.'));
    }
  };

  const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 }, fileFilter });
  const uploadAi = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter,
  });

  // --------------------------------------------------------------------------
  // HEALTH & REALTIME EVENTS
  // --------------------------------------------------------------------------

  app.get('/api/health', (req, res) => {
    const ngoCount = db.listNgos({ includeDemo: true }).length;
    const realNgoCount = db.listNgos({ includeDemo: false }).length;
    const { total: totalDonations } = db.queryDonations();
    res.json({
      status: 'ok',
      version: '2.0.0',
      storage: 'SQLite (ACID WAL)',
      donations_count: totalDonations,
      ngos_count: ngoCount,
      real_ngos_count: realNgoCount,
      ai: getAiCapabilities(),
      realtime_clients: sseClients.size,
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/api/events', authenticate, (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const client = { res, userId: req.user.id, role: req.user.role };
    sseClients.add(client);
    res.write(`event: connected\ndata: ${JSON.stringify({ status: 'connected', role: req.user.role })}\n\n`);

    const keepAlive = setInterval(() => {
      try {
        res.write(': ping\n\n');
      } catch {
        clearInterval(keepAlive);
        sseClients.delete(client);
      }
    }, 25000);

    req.on('close', () => {
      clearInterval(keepAlive);
      sseClients.delete(client);
    });
  });

  // --------------------------------------------------------------------------
  // AUTHENTICATION & RBAC ENDPOINTS
  // --------------------------------------------------------------------------

  app.post('/api/auth/register', authLimiter, (req, res) => {
    try {
      const result = authStore.registerUser(req.body || {});
      return res.status(201).json(result);
    } catch (err) {
      return res.status(err.status || 400).json({ error: err.message });
    }
  });

  app.post('/api/auth/login', authLimiter, (req, res) => {
    try {
      const result = authStore.loginUser(req.body || {});
      return res.json(result);
    } catch (err) {
      return res.status(err.status || 401).json({ error: err.message });
    }
  });

  app.post('/api/auth/logout', authenticate, (req, res) => {
    revokeToken(req.authToken, db);
    return res.json({ message: 'Signed out successfully.' });
  });

  app.get('/api/auth/me', authenticate, (req, res) => {
    return res.json({ user: req.user });
  });

  app.get('/api/auth/demo-accounts', (req, res) => {
    if (process.env.NODE_ENV === 'production') {
      return res.status(404).json({ error: 'Not available in production.' });
    }
    return res.json({ accounts: authStore.listDemoAccounts() });
  });

  // --------------------------------------------------------------------------
  // DONATIONS CRUD & LIFECYCLE ENDPOINTS (SQL Pushdown)
  // --------------------------------------------------------------------------

  app.get(
    '/api/donations',
    authenticate,
    authorizeRoles(ROLES.DONOR, ROLES.NGO, ROLES.VOLUNTEER, ROLES.ADMIN),
    (req, res) => {
      const statusFilter = req.query.status || null;
      const categoryFilter = req.query.category || null;
      const searchFilter = req.query.q || req.query.search || null;
      const limit = req.query.limit ? Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50)) : null;
      const offset = req.query.offset ? Math.max(0, parseInt(req.query.offset, 10) || 0) : 0;

      // Volunteers see active/accepted surplus listings only (not another donor's private draft)
      const effectiveUser =
        req.user.role === ROLES.VOLUNTEER ? { ...req.user, role: ROLES.NGO } : req.user;

      const { rows, total } = db.queryDonations({
        user: effectiveUser,
        status: statusFilter,
        category: categoryFilter,
        search: searchFilter,
        limit,
        offset,
      });

      const serialized = rows.map((d) => {
        const del = deliveryService.getByDonationId(d.id);
        return serializeDonation(d, del);
      });

      res.setHeader('X-Total-Count', String(total));
      if (req.query.paginated === 'true') {
        return res.json({ items: serialized, total, limit, offset });
      }
      return res.json(serialized);
    }
  );

  app.get(
    '/api/donations/:id',
    authenticate,
    authorizeRoles(ROLES.DONOR, ROLES.NGO, ROLES.VOLUNTEER, ROLES.ADMIN),
    (req, res) => {
      const donation = db.getDonationById(req.params.id);
      if (!donation) {
        return res.status(404).json({ error: 'Donation not found.' });
      }
      if (
        req.user.role === ROLES.DONOR &&
        donation.donor_id &&
        donation.donor_id !== req.user.id
      ) {
        return res.status(403).json({ error: 'Access denied. You can only view your own donations.' });
      }
      const del = deliveryService.getByDonationId(donation.id);
      return res.json(serializeDonation(donation, del));
    }
  );

  app.post('/api/donations', authenticate, authorizeRoles(ROLES.DONOR, ROLES.ADMIN), (req, res) => {
    upload.single('photo')(req, res, async (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ error: 'Image exceeds maximum allowed size of 5 MB.' });
        }
        return res.status(400).json({ error: `Upload error: ${err.message}` });
      } else if (err) {
        return res.status(400).json({ error: err.message });
      }

      const body = req.body || {};

      // Deep image validation & EXIF metadata stripping on uploaded photo
      if (req.file) {
        try {
          const buf = fs.readFileSync(req.file.path);
          await validateAndInspectImage(buf, req.file.mimetype);
          await stripExifMetadata(req.file.path);
        } catch (imgErr) {
          fs.unlink(req.file.path, () => {});
          return res.status(400).json({ error: imgErr.message || 'Uploaded photo failed validation.' });
        }
      }

      // Legacy format compatibility
      const isLegacy = !body.food_category && !body.title && body.foodName;
      if (isLegacy) {
        const { foodName, quantity, expiryTime, location } = body;
        if (!foodName || !quantity || !expiryTime || !location) {
          return res.status(400).json({
            error: 'All fields (foodName, quantity, expiryTime, location) are required for legacy submissions.',
          });
        }
        const savedLegacy = db.insertDonation({
          id: Date.now().toString(),
          donor_id: req.user.id,
          foodName,
          quantity,
          expiryTime,
          location,
          status: 'available',
          createdAt: new Date().toISOString(),
        });
        broadcastEvent('donation:created', { donation_id: savedLegacy.id });
        return res.status(201).json(serializeDonation(savedLegacy));
      }

      // V1 Validation
      const {
        title,
        food_category,
        dietary_type,
        quantity,
        quantity_unit,
        pickup_available_until,
        address_text,
        location,
        preparation_time,
        current_storage,
        expiry_date,
        packaging_type,
        allergens,
        special_note,
        latitude,
        longitude,
        ai_assessment,
      } = body;

      const finalTitle = (title || '').trim();
      if (!finalTitle) {
        return res.status(400).json({ error: 'Food Title / Short Description is required.' });
      }

      const validCategories = ['cooked_meals', 'fresh_produce', 'bakery', 'packaged_sealed'];
      if (!food_category || !validCategories.includes(food_category)) {
        return res.status(400).json({
          error: `Food Category is required and must be one of: ${validCategories.join(', ')}.`,
        });
      }

      const validDietary = ['vegetarian', 'non_vegetarian'];
      if (!dietary_type || !validDietary.includes(dietary_type)) {
        return res.status(400).json({
          error: `Dietary Type is required and must be either 'vegetarian' or 'non_vegetarian'.`,
        });
      }

      const numericQuantity = parseFloat(quantity);
      if (Number.isNaN(numericQuantity) || numericQuantity <= 0) {
        return res.status(400).json({ error: 'Quantity must be a positive number greater than zero.' });
      }

      const validUnits = ['servings', 'plates', 'trays', 'boxes'];
      if (!quantity_unit || !validUnits.includes(quantity_unit)) {
        return res.status(400).json({
          error: `Quantity Unit is required and must be one of: ${validUnits.join(', ')}.`,
        });
      }

      let image_url = null;
      if (req.file) {
        image_url = `/uploads/${req.file.filename}`;
      } else if (body.image_url) {
        image_url = body.image_url;
      }
      if (!image_url) {
        return res.status(400).json({ error: 'A clear food photograph is required for new donations.' });
      }

      if (!pickup_available_until) {
        return res.status(400).json({ error: 'Pickup Available Until datetime is required.' });
      }
      const pickupDate = new Date(pickup_available_until);
      if (Number.isNaN(pickupDate.getTime())) {
        return res.status(400).json({ error: 'Pickup Available Until must be a valid datetime.' });
      }
      if (pickupDate.getTime() <= Date.now()) {
        return res.status(400).json({ error: 'Pickup Available Until must be a future date and time.' });
      }

      const finalAddress = (address_text || location || '').trim();
      if (!finalAddress) {
        return res.status(400).json({ error: 'Pickup Address / Location is required.' });
      }

      if (food_category === 'cooked_meals') {
        const validPrepTimes = [
          'less_than_1_hour_ago',
          '1_to_2_hours_ago',
          '2_to_4_hours_ago',
          'more_than_4_hours_ago',
        ];
        if (!preparation_time || !validPrepTimes.includes(preparation_time)) {
          return res.status(400).json({
            error: `Preparation Time is required for Cooked Meals and must be one of: ${validPrepTimes.join(', ')}.`,
          });
        }
        const validStorage = ['room_temperature', 'refrigerated', 'hot_insulated'];
        if (!current_storage || !validStorage.includes(current_storage)) {
          return res.status(400).json({
            error: `Current Storage is required for Cooked Meals and must be one of: ${validStorage.join(', ')}.`,
          });
        }
      }

      if (food_category === 'packaged_sealed') {
        if (!expiry_date || !(expiry_date + '').trim()) {
          return res.status(400).json({
            error: 'Expiry / Best Before Date is required for Packaged / Sealed food.',
          });
        }
      }

      if (packaging_type && !['sealed_covered', 'open_loose'].includes(packaging_type)) {
        return res.status(400).json({
          error: `Packaging Type, if provided, must be 'sealed_covered' or 'open_loose'.`,
        });
      }

      const parsedLat =
        latitude !== undefined && latitude !== '' && !Number.isNaN(parseFloat(latitude))
          ? parseFloat(latitude)
          : null;
      const parsedLng =
        longitude !== undefined && longitude !== '' && !Number.isNaN(parseFloat(longitude))
          ? parseFloat(longitude)
          : null;

      let sanitizedAi = sanitizeIncomingAiPayload(ai_assessment);
      // If donor uploaded fresh produce photo directly without calling /assess-image first, compute server-side
      if (!sanitizedAi && req.file && food_category === 'fresh_produce') {
        try {
          const buf = fs.readFileSync(req.file.path);
          sanitizedAi = await assessFoodImage(buf, food_category, { mimeType: req.file.mimetype });
        } catch {
          sanitizedAi = null;
        }
      }

      const nowISO = new Date().toISOString();
      const saved = db.withTransaction(() => {
        const record = db.insertDonation({
          id: `${Date.now()}-${Math.round(Math.random() * 1000)}`,
          donor_id: req.user.id,
          title: finalTitle,
          food_category,
          dietary_type,
          quantity: numericQuantity,
          quantity_unit,
          quantityText: `${numericQuantity} ${quantity_unit}`,
          image_url,
          pickup_available_until: pickupDate.toISOString(),
          address_text: finalAddress,
          latitude: parsedLat,
          longitude: parsedLng,
          preparation_time: food_category === 'cooked_meals' ? preparation_time : null,
          current_storage: food_category === 'cooked_meals' ? current_storage : null,
          expiry_date: food_category === 'packaged_sealed' ? expiry_date : null,
          packaging_type: packaging_type || null,
          allergens: allergens ? allergens.trim() : null,
          special_note: special_note ? special_note.trim() : null,
          ai_assessment: sanitizedAi,
          status: 'submitted',
          created_at: nowISO,
          updated_at: nowISO,
        });

        db.createNotification({
          roleTarget: ROLES.NGO,
          donationId: record.id,
          type: 'donation_new',
          title: 'New Surplus Listing Available',
          message: `${record.title} (${record.quantityText}) ready at ${record.address_text}.`,
        });

        if (sanitizedAi?.human_review_recommended) {
          db.createNotification({
            roleTarget: ROLES.ADMIN,
            donationId: record.id,
            type: 'admin_review',
            title: 'AI Flagged Listing for Review',
            message: `${record.title} requires human inspection: ${sanitizedAi.human_review_reason || 'Check details.'}`,
          });
        }

        return record;
      });

      broadcastEvent('donation:created', { donation_id: saved.id });
      broadcastEvent('notification:new', { role: ROLES.NGO });
      return res.status(201).json(serializeDonation(saved));
    });
  });

  app.patch('/api/donations/:id/accept', authenticate, authorizeRoles(ROLES.NGO, ROLES.ADMIN), (req, res) => {
    const { id } = req.params;
    const existing = db.getDonationById(id);

    if (!existing) {
      return res.status(404).json({ error: 'Donation not found.' });
    }
    if (existing.status === 'accepted') {
      return res.status(400).json({ error: 'Donation already accepted.' });
    }
    if (existing.status === 'collected') {
      return res.status(400).json({ error: 'Collected donations cannot be accepted again.' });
    }
    if (existing.review_status === 'rejected') {
      return res.status(400).json({ error: 'Rejected donations cannot be accepted.' });
    }
    const deadlineMs = existing.pickup_available_until
      ? new Date(existing.pickup_available_until).getTime()
      : null;
    if (deadlineMs && !Number.isNaN(deadlineMs) && deadlineMs <= Date.now()) {
      return res.status(400).json({ error: 'Pickup window has expired; this donation cannot be accepted.' });
    }

    const assignedNgoId =
      req.body?.matched_ngo_id
        ? String(req.body.matched_ngo_id)
        : req.user.ngo_id || existing.matched_ngo_id || null;

    const ngoProfile = assignedNgoId ? db.getNgoById(assignedNgoId) : null;
    const assignedNgoName =
      req.body?.matched_ngo_name
        ? String(req.body.matched_ngo_name)
        : ngoProfile?.name ||
          (req.user.role === ROLES.NGO ? req.user.organization || req.user.name : existing.matched_ngo_name);

    const { updated, delivery } = db.withTransaction(() => {
      const updatedDon = db.updateDonationFields(id, {
        status: 'accepted',
        accepted_by_user_id: req.user.id,
        matched_ngo_id: assignedNgoId,
        matched_ngo_name: assignedNgoName || null,
        updated_at: new Date().toISOString(),
      });

      const unitMult = UNIT_TO_SERVINGS[(updatedDon.quantity_unit || 'servings').toLowerCase()] || 1;
      const estServings = (Number(updatedDon.quantity) || 0) * unitMult;
      if (assignedNgoId && estServings > 0) {
        db.decrementNgoCapacity(assignedNgoId, estServings);
      }

      const createdDelivery = deliveryService.ensureDeliveryForDonation(updatedDon, ngoProfile);

      if (updatedDon.donor_id) {
        db.createNotification({
          userId: updatedDon.donor_id,
          donationId: updatedDon.id,
          type: 'donation_accepted',
          title: 'Donation Claimed by NGO',
          message: `${assignedNgoName || 'A verified NGO'} claimed "${updatedDon.title}". Pickup OTP: ${createdDelivery.pickup_otp}`,
        });
      }

      db.createNotification({
        roleTarget: ROLES.VOLUNTEER,
        donationId: updatedDon.id,
        type: 'delivery_ready',
        title: 'New Pickup Dispatch Ready',
        message: `Pickup at ${updatedDon.address_text} -> ${createdDelivery.dropoff_address}.`,
      });

      return { updated: updatedDon, delivery: createdDelivery };
    });

    broadcastEvent('donation:updated', { donation_id: updated.id, status: 'accepted' });
    broadcastEvent('delivery:updated', { delivery_id: delivery.id, donation_id: updated.id });
    broadcastEvent('notification:new', {});
    return res.json(serializeDonation(updated, delivery));
  });

  app.patch('/api/donations/:id/collect', authenticate, authorizeRoles(ROLES.NGO, ROLES.ADMIN), (req, res) => {
    const { id } = req.params;
    const existing = db.getDonationById(id);

    if (!existing) {
      return res.status(404).json({ error: 'Donation not found.' });
    }
    if (existing.status === 'collected') {
      return res.status(400).json({ error: 'Donation already collected.' });
    }
    if (existing.status !== 'accepted') {
      return res.status(400).json({ error: 'Donation must be accepted before it can be marked as collected.' });
    }

    if (
      req.user.role === ROLES.NGO &&
      existing.accepted_by_user_id &&
      existing.accepted_by_user_id !== req.user.id &&
      (!req.user.ngo_id || req.user.ngo_id !== existing.matched_ngo_id)
    ) {
      return res.status(403).json({
        error: 'Only the accepting NGO or an Admin can mark this donation as collected.',
      });
    }

    const updated = db.withTransaction(() => {
      const now = new Date().toISOString();
      const updatedDon = db.updateDonationFields(id, {
        status: 'collected',
        updated_at: now,
      });

      const del = deliveryService.getByDonationId(id);
      if (del && del.status !== 'delivered' && del.status !== 'cancelled') {
        db.sqlite.prepare(`
          UPDATE deliveries SET status = 'delivered', delivered_at = ?, updated_at = ? WHERE id = ?
        `).run(now, now, del.id);
      }

      if (updatedDon.donor_id) {
        db.createNotification({
          userId: updatedDon.donor_id,
          donationId: updatedDon.id,
          type: 'donation_collected',
          title: 'Food Rescue Completed',
          message: `"${updatedDon.title}" was marked collected and delivered safely.`,
        });
      }
      return updatedDon;
    });

    const del = deliveryService.getByDonationId(id);
    broadcastEvent('donation:updated', { donation_id: updated.id, status: 'collected' });
    broadcastEvent('delivery:updated', { donation_id: updated.id });
    return res.json(serializeDonation(updated, del));
  });

  // --------------------------------------------------------------------------
  // NGO PROFILES & INTELLIGENT MATCHING ENDPOINTS
  // --------------------------------------------------------------------------

  app.get(
    '/api/ngos',
    authenticate,
    authorizeRoles(ROLES.DONOR, ROLES.NGO, ROLES.VOLUNTEER, ROLES.ADMIN),
    (req, res) => {
      const includeDemo = req.query.include_demo !== 'false';
      const ngos = db.listNgos({ includeDemo });
      res.json({ ngos });
    }
  );

  app.get('/api/ngos/me', authenticate, authorizeRoles(ROLES.NGO, ROLES.ADMIN), (req, res) => {
    if (!req.user.ngo_id) {
      return res.status(404).json({ error: 'No NGO profile linked to this account.' });
    }
    const ngo = db.getNgoById(req.user.ngo_id);
    if (!ngo) {
      return res.status(404).json({ error: 'NGO profile not found.' });
    }
    return res.json({ ngo });
  });

  app.put('/api/ngos/me', authenticate, authorizeRoles(ROLES.NGO), (req, res) => {
    if (!req.user.ngo_id) {
      return res.status(404).json({ error: 'No NGO profile linked to this account.' });
    }
    const current = db.getNgoById(req.user.ngo_id);
    if (!current) {
      return res.status(404).json({ error: 'NGO profile not found.' });
    }

    const body = req.body || {};
    const validStatuses = ['active', 'limited', 'paused'];
    const opStatus =
      body.operational_status && validStatuses.includes(body.operational_status)
        ? body.operational_status
        : current.operational_status;

    const updated = db.upsertNgo({
      ...current,
      name: body.name ? String(body.name).trim() : current.name,
      organization_type: body.organization_type
        ? String(body.organization_type).trim()
        : current.organization_type,
      accepted_categories: Array.isArray(body.accepted_categories)
        ? body.accepted_categories
        : current.accepted_categories,
      accepted_dietary_types: Array.isArray(body.accepted_dietary_types)
        ? body.accepted_dietary_types
        : current.accepted_dietary_types,
      excluded_allergens: Array.isArray(body.excluded_allergens)
        ? body.excluded_allergens
        : current.excluded_allergens,
      available_capacity_servings:
        body.available_capacity_servings === null || body.available_capacity_servings === ''
          ? null
          : !Number.isNaN(Number(body.available_capacity_servings))
          ? Math.max(0, Math.round(Number(body.available_capacity_servings)))
          : current.available_capacity_servings,
      location_text:
        body.location_text !== undefined ? String(body.location_text).trim() : current.location_text,
      service_areas: Array.isArray(body.service_areas)
        ? body.service_areas.map((s) => String(s).trim()).filter(Boolean)
        : current.service_areas,
      latitude:
        body.latitude !== undefined && body.latitude !== '' && !Number.isNaN(Number(body.latitude))
          ? Number(body.latitude)
          : body.latitude === null
          ? null
          : current.latitude,
      longitude:
        body.longitude !== undefined && body.longitude !== '' && !Number.isNaN(Number(body.longitude))
          ? Number(body.longitude)
          : body.longitude === null
          ? null
          : current.longitude,
      pickup_capable:
        typeof body.pickup_capable === 'boolean' ? body.pickup_capable : current.pickup_capable,
      operational_status: opStatus,
      response_time_minutes:
        body.response_time_minutes !== undefined && !Number.isNaN(Number(body.response_time_minutes))
          ? Math.max(5, Math.round(Number(body.response_time_minutes)))
          : current.response_time_minutes,
      operating_hours:
        body.operating_hours !== undefined ? String(body.operating_hours).trim() : current.operating_hours,
      contact_note:
        body.contact_note !== undefined ? String(body.contact_note).trim() : current.contact_note,
    });

    broadcastEvent('ngo:updated', { ngo_id: updated.id });
    return res.json({ ngo: updated });
  });

  app.get(
    '/api/donations/:id/matches',
    authenticate,
    authorizeRoles(ROLES.DONOR, ROLES.NGO, ROLES.ADMIN),
    (req, res) => {
      const id = (req.params.id || '').trim();
      if (!id) {
        return res.status(400).json({ error: 'Valid donation ID is required.' });
      }

      const donation = db.getDonationById(id);
      if (!donation) {
        return res.status(404).json({ error: 'Donation not found.' });
      }

      if (
        req.user.role === ROLES.DONOR &&
        donation.donor_id &&
        donation.donor_id !== req.user.id
      ) {
        return res.status(403).json({ error: 'Access denied. You can only view matches for your own donations.' });
      }

      try {
        const serialized = serializeDonation(donation);
        const includeDemo = req.query.include_demo !== 'false';
        const ngos = db.listNgos({ includeDemo });
        const realCount = ngos.filter((n) => !n.is_demo).length;
        const matches = rankNgosForDonation(serialized, ngos);

        return res.json({
          donation: serialized,
          ngos_source: realCount > 0 ? 'database_hybrid' : 'demo_profiles',
          ngos_count: ngos.length,
          real_ngos_count: realCount,
          weights: MATCHING_WEIGHTS,
          generated_at: new Date().toISOString(),
          matches,
        });
      } catch (err) {
        console.error('Matching Engine Error:', err);
        return res.status(500).json({ error: 'Failed to compute NGO matches for this donation.' });
      }
    }
  );

  app.get('/api/matches', authenticate, authorizeRoles(ROLES.NGO, ROLES.ADMIN), (req, res) => {
    try {
      const { rows } = db.queryDonations({ status: 'available' });
      const activeDonations = rows.map((d) => serializeDonation(d));
      const ngos = db.listNgos({ includeDemo: true });
      const realCount = ngos.filter((n) => !n.is_demo).length;
      const limit = Math.max(1, Math.min(20, parseInt(req.query.limit, 10) || 3));

      const results = activeDonations.map((donation) => {
        const ranked = rankNgosForDonation(donation, ngos);
        return {
          donation,
          top_matches: ranked.slice(0, limit),
          total_ngos_evaluated: ranked.length,
        };
      });

      return res.json({
        ngos_source: realCount > 0 ? 'database_hybrid' : 'demo_profiles',
        weights: MATCHING_WEIGHTS,
        generated_at: new Date().toISOString(),
        donations_evaluated: results.length,
        results,
      });
    } catch (err) {
      console.error('Batch Matching Error:', err);
      return res.status(500).json({ error: 'Failed to compute NGO matches.' });
    }
  });

  // --------------------------------------------------------------------------
  // LAST-MILE PICKUP & DELIVERY LOGISTICS ENDPOINTS
  // --------------------------------------------------------------------------

  app.get(
    '/api/deliveries',
    authenticate,
    authorizeRoles(ROLES.DONOR, ROLES.NGO, ROLES.VOLUNTEER, ROLES.ADMIN),
    (req, res) => {
      const deliveries = deliveryService.listDeliveriesForUser(req.user);
      return res.json({ deliveries });
    }
  );

  app.post(
    '/api/deliveries/:id/claim',
    authenticate,
    authorizeRoles(ROLES.VOLUNTEER, ROLES.NGO, ROLES.ADMIN),
    (req, res) => {
      try {
        const delivery = deliveryService.claimDelivery(req.params.id, req.user, req.body || {});
        const donation = db.getDonationById(delivery.donation_id);
        if (donation?.donor_id) {
          db.createNotification({
            userId: donation.donor_id,
            donationId: donation.id,
            type: 'delivery_assigned',
            title: 'Volunteer Assigned for Pickup',
            message: `${req.user.name} claimed pickup for "${donation.title}".`,
          });
        }
        broadcastEvent('delivery:updated', { delivery_id: delivery.id, status: delivery.status });
        broadcastEvent('notification:new', {});
        return res.json({ delivery });
      } catch (err) {
        return res.status(err.status || 400).json({ error: err.message });
      }
    }
  );

  app.patch(
    '/api/deliveries/:id/status',
    authenticate,
    authorizeRoles(ROLES.VOLUNTEER, ROLES.NGO, ROLES.ADMIN),
    (req, res) => {
      try {
        const delivery = deliveryService.updateDeliveryStatus(req.params.id, req.user, req.body || {});
        const donation = db.getDonationById(delivery.donation_id);
        broadcastEvent('delivery:updated', {
          delivery_id: delivery.id,
          donation_id: delivery.donation_id,
          status: delivery.status,
        });
        if (delivery.status === 'delivered') {
          broadcastEvent('donation:updated', { donation_id: delivery.donation_id, status: 'collected' });
          if (donation?.donor_id) {
            db.createNotification({
              userId: donation.donor_id,
              donationId: donation.id,
              type: 'donation_collected',
              title: 'Delivery Confirmed at NGO',
              message: `"${donation.title}" has been delivered safely to ${delivery.ngo_name || 'the NGO'}.`,
            });
          }
        }
        return res.json({ delivery });
      } catch (err) {
        return res.status(err.status || 400).json({ error: err.message });
      }
    }
  );

  // --------------------------------------------------------------------------
  // NOTIFICATIONS ENDPOINTS
  // --------------------------------------------------------------------------

  app.get('/api/notifications', authenticate, (req, res) => {
    const notifications = db.listNotificationsForUser(req.user, 25);
    const unread_count = notifications.filter((n) => !n.is_read).length;
    return res.json({ notifications, unread_count });
  });

  app.patch('/api/notifications/read-all', authenticate, (req, res) => {
    const updated = db.markNotificationsReadForUser(req.user);
    return res.json({ marked_read: updated });
  });

  // --------------------------------------------------------------------------
  // AI VISUAL CONDITION ASSESSMENT ENDPOINT
  // --------------------------------------------------------------------------

  app.post(
    '/api/ai/assess-image',
    authenticate,
    authorizeRoles(ROLES.DONOR, ROLES.ADMIN),
    aiLimiter,
    (req, res) => {
      uploadAi.single('image')(req, res, async (err) => {
        if (err instanceof multer.MulterError) {
          if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
              assessment_status: 'rejected',
              error: 'Image exceeds maximum allowed size of 5 MB.',
              code: 'INVALID_IMAGE',
            });
          }
          return res.status(400).json({
            assessment_status: 'rejected',
            error: `Upload error: ${err.message}`,
            code: 'INVALID_IMAGE',
          });
        } else if (err) {
          return res.status(400).json({
            assessment_status: 'rejected',
            error: err.message,
            code: 'INVALID_IMAGE',
          });
        }

        const food_category = req.body.food_category || 'unspecified';
        let buffer = req.file ? req.file.buffer : null;
        let mimeType = req.file ? req.file.mimetype : 'image/jpeg';

        if (!buffer && req.body.image_url) {
          const safeRel = path
            .normalize(req.body.image_url)
            .replace(/^(\.\.[/\\])+/, '')
            .replace(/^\//, '');
          const cleanRel = safeRel.replace(/^uploads[/\\]/, '');
          const localPath = path.join(uploadsDir, cleanRel);
          if (localPath.startsWith(uploadsDir) && fs.existsSync(localPath)) {
            try {
              buffer = fs.readFileSync(localPath);
              const ext = path.extname(localPath).toLowerCase();
              mimeType = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
            } catch (readErr) {
              console.error('Failed to read image from image_url:', readErr);
            }
          }
        }

        if (!buffer) {
          return res.status(400).json({
            assessment_status: 'rejected',
            error: 'Invalid or missing image file. Only JPG, PNG, and WebP images up to 5 MB are supported.',
            code: 'INVALID_IMAGE',
          });
        }

        try {
          const assessment = await assessFoodImage(buffer, food_category, { mimeType });
          return res.json(assessment);
        } catch (aiErr) {
          console.error('AI Assessment Error:', aiErr);
          if (aiErr.code === 'INVALID_IMAGE') {
            return res.status(400).json({
              assessment_status: 'rejected',
              error: aiErr.message,
              code: 'INVALID_IMAGE',
            });
          }
          if (aiErr.code === 'AI_TIMEOUT') {
            return res.status(504).json({
              assessment_status: 'failed',
              reason: 'ai_timeout',
              error: 'AI vision analysis timed out. You can retry or proceed with standard donation submission.',
              code: 'AI_TIMEOUT',
            });
          }
          return res.status(503).json({
            assessment_status: 'failed',
            reason: 'inference_engine_unavailable',
            error: 'AI visual assessment engine is currently unavailable. Please retry or proceed with standard donation intake.',
            code: 'SERVICE_UNAVAILABLE',
          });
        }
      });
    }
  );

  // --------------------------------------------------------------------------
  // ADMIN OVERSIGHT & REVIEW ENDPOINTS
  // --------------------------------------------------------------------------

  app.get('/api/admin/overview', authenticate, authorizeRoles(ROLES.ADMIN), (req, res) => {
    const { rows } = db.queryDonations();
    const serialized = rows.map((d) => serializeDonation(d, deliveryService.getByDonationId(d.id)));
    const flagged = serialized.filter(
      (d) =>
        d.review_status === 'flagged' ||
        d.ai_assessment?.human_review_recommended === true ||
        d.is_expired
    );
    const reviewed = serialized.filter((d) => Boolean(d.review_status));

    res.json({
      stats: {
        total_donations: serialized.length,
        flagged_count: flagged.length,
        reviewed_count: reviewed.length,
        pending_review_count: serialized.filter((d) => !d.review_status).length,
      },
      flagged_donations: flagged,
      all_donations: serialized,
    });
  });

  app.patch('/api/admin/donations/:id/review', authenticate, authorizeRoles(ROLES.ADMIN), (req, res) => {
    const { id } = req.params;
    const existing = db.getDonationById(id);
    if (!existing) {
      return res.status(404).json({ error: 'Donation not found.' });
    }

    const { review_status, review_note } = req.body || {};
    const validDecisions = ['approved', 'flagged', 'rejected'];
    if (!review_status || !validDecisions.includes(review_status)) {
      return res.status(400).json({
        error: `review_status is required and must be one of: ${validDecisions.join(', ')}.`,
      });
    }

    const updated = db.updateDonationFields(id, {
      review_status,
      review_note: review_note ? String(review_note).trim() : null,
      reviewed_by: req.user.name,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    if (updated.donor_id) {
      db.createNotification({
        userId: updated.donor_id,
        donationId: updated.id,
        type: 'admin_review_decision',
        title: `Listing Review: ${review_status.toUpperCase()}`,
        message: `"${updated.title}" was marked ${review_status} by reviewer ${req.user.name}.`,
      });
    }

    broadcastEvent('donation:updated', { donation_id: updated.id, review_status });
    broadcastEvent('notification:new', {});
    return res.json(serializeDonation(updated));
  });

  // Global error handler
  app.use((err, req, res, next) => {
    void next;
    console.error('Server Error:', err);
    res.status(500).json({ error: err.message || 'Internal Server Error' });
  });

  return { app, db, authStore, deliveryService, broadcastEvent, close: () => db.close() };
}

if (require.main === module) {
  const { app, db, broadcastEvent } = createServerApp();
  const server = app.listen(PORT, () => {
    console.log(`Backend server running on http://localhost:${PORT} (SQLite ACID WAL + Hybrid AI)`);
  });

  // Periodic check for expired active listings to notify Admin without breaking legacy queries
  const alertedExpiredIds = new Set();
  const sweepTimer = setInterval(() => {
    try {
      const { rows } = db.queryDonations({ status: 'available' });
      const now = Date.now();
      for (const d of rows) {
        if (alertedExpiredIds.has(d.id) || !d.pickup_available_until) continue;
        const deadline = new Date(d.pickup_available_until).getTime();
        if (!Number.isNaN(deadline) && deadline <= now) {
          alertedExpiredIds.add(d.id);
          db.createNotification({
            roleTarget: ROLES.ADMIN,
            donationId: d.id,
            type: 'listing_expired',
            title: 'Unclaimed Listing Window Expired',
            message: `"${d.title}" passed its pickup deadline without an NGO claim.`,
          });
          broadcastEvent('notification:new', { role: ROLES.ADMIN });
        }
      }
    } catch {
      // Non-fatal background sweep
    }
  }, 60000);
  sweepTimer.unref?.();

  process.on('SIGINT', () => {
    clearInterval(sweepTimer);
    server.close(() => {
      db.close();
      process.exit(0);
    });
  });
} else {
  // Export initialized default app + factory for tests
  module.exports = { createServerApp };
}
