/**
 * FoodLoop ACID SQLite Database Layer (Node.js built-in node:sqlite)
 *
 * Replaces flat-file JSON reads/writes with transactional SQLite storage,
 * indexed WHERE/LIMIT/OFFSET query pushdown, persistent JWT revocation,
 * dynamic NGO profiles, last-mile deliveries, and user notifications.
 */

const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const DEFAULT_DB_PATH = path.join(__dirname, '..', 'data', 'foodloop.db');

function parseJsonSafe(raw, fallback) {
  if (!raw) return fallback;
  if (typeof raw !== 'string') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function normalizeLegacyDonationRecord(d) {
  const now = new Date().toISOString();
  const title = d.title || d.foodName || 'Surplus Food';
  const addressText = d.address_text || d.location || '';
  const pickupUntil = d.pickup_available_until || d.expiryTime || null;

  let quantityVal = 1;
  let quantityUnit = d.quantity_unit || 'servings';
  if (typeof d.quantity === 'number' && !Number.isNaN(d.quantity)) {
    quantityVal = d.quantity;
  } else if (typeof d.quantity === 'string') {
    const parsed = parseFloat(d.quantity);
    quantityVal = Number.isNaN(parsed) ? 1 : parsed;
    const unitMatch = d.quantity.replace(/^[0-9.\s]+/, '').trim();
    if (unitMatch && !d.quantity_unit) {
      quantityUnit = unitMatch;
    }
  }
  const quantityText =
    d.quantityText ||
    (typeof d.quantity === 'string' ? d.quantity : `${quantityVal} ${quantityUnit}`);

  return {
    id: String(d.id || Date.now()),
    donor_id: d.donor_id || null,
    title,
    food_category: d.food_category || 'cooked_meals',
    dietary_type: d.dietary_type || 'vegetarian',
    quantity: quantityVal,
    quantity_unit: quantityUnit,
    quantity_text: quantityText,
    image_url: d.image_url || null,
    pickup_available_until: pickupUntil,
    address_text: addressText,
    latitude: typeof d.latitude === 'number' && !Number.isNaN(d.latitude) ? d.latitude : null,
    longitude: typeof d.longitude === 'number' && !Number.isNaN(d.longitude) ? d.longitude : null,
    preparation_time: d.preparation_time || null,
    current_storage: d.current_storage || null,
    expiry_date: d.expiry_date || null,
    packaging_type: d.packaging_type || null,
    allergens: d.allergens || null,
    special_note: d.special_note || null,
    ai_assessment: d.ai_assessment ? JSON.stringify(d.ai_assessment) : null,
    status: d.status || 'submitted',
    matched_ngo_id: d.matched_ngo_id || null,
    matched_ngo_name: d.matched_ngo_name || null,
    accepted_by_user_id: d.accepted_by_user_id || null,
    review_status: d.review_status || null,
    review_note: d.review_note || null,
    reviewed_by: d.reviewed_by || null,
    reviewed_at: d.reviewed_at || null,
    created_at: d.created_at || d.createdAt || now,
    updated_at: d.updated_at || d.created_at || d.createdAt || now,
  };
}

function hydrateDonationRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    donor_id: row.donor_id,
    title: row.title,
    food_category: row.food_category,
    dietary_type: row.dietary_type,
    quantity: row.quantity,
    quantity_unit: row.quantity_unit,
    quantityText: row.quantity_text || `${row.quantity} ${row.quantity_unit}`,
    image_url: row.image_url,
    pickup_available_until: row.pickup_available_until,
    address_text: row.address_text,
    latitude: row.latitude,
    longitude: row.longitude,
    preparation_time: row.preparation_time,
    current_storage: row.current_storage,
    expiry_date: row.expiry_date,
    packaging_type: row.packaging_type,
    allergens: row.allergens,
    special_note: row.special_note,
    ai_assessment: parseJsonSafe(row.ai_assessment, null),
    status: row.status,
    matched_ngo_id: row.matched_ngo_id,
    matched_ngo_name: row.matched_ngo_name,
    accepted_by_user_id: row.accepted_by_user_id,
    review_status: row.review_status,
    review_note: row.review_note,
    reviewed_by: row.reviewed_by,
    reviewed_at: row.reviewed_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
    // Legacy aliases preserved for backward compatibility
    foodName: row.title,
    location: row.address_text,
    expiryTime: row.pickup_available_until,
    createdAt: row.created_at,
  };
}

function hydrateNgoRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    owner_user_id: row.owner_user_id,
    name: row.name,
    organization_type: row.organization_type,
    is_demo: Boolean(row.is_demo),
    demo_label: row.demo_label || (row.is_demo ? 'Demo Profile' : null),
    accepted_categories: parseJsonSafe(row.accepted_categories, []),
    accepted_dietary_types: parseJsonSafe(row.accepted_dietary_types, ['vegetarian']),
    excluded_allergens: parseJsonSafe(row.excluded_allergens, []),
    available_capacity_servings:
      row.available_capacity_servings === null || row.available_capacity_servings === undefined
        ? null
        : Number(row.available_capacity_servings),
    max_capacity_servings:
      row.max_capacity_servings === null || row.max_capacity_servings === undefined
        ? null
        : Number(row.max_capacity_servings),
    location_text: row.location_text || '',
    service_areas: parseJsonSafe(row.service_areas, []),
    latitude: row.latitude !== null && row.latitude !== undefined ? Number(row.latitude) : null,
    longitude: row.longitude !== null && row.longitude !== undefined ? Number(row.longitude) : null,
    pickup_capable: Boolean(row.pickup_capable),
    operational_status: row.operational_status || 'active',
    response_time_minutes:
      row.response_time_minutes !== null && row.response_time_minutes !== undefined
        ? Number(row.response_time_minutes)
        : null,
    operating_hours: row.operating_hours || null,
    contact_note: row.contact_note || null,
    verified: Boolean(row.verified),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function createDatabase(options = {}) {
  const dbPath = options.dbPath || process.env.DB_FILE || DEFAULT_DB_PATH;
  const isMemory = dbPath === ':memory:';

  if (!isMemory) {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  const sqlite = new DatabaseSync(dbPath);

  if (!isMemory) {
    sqlite.exec('PRAGMA journal_mode = WAL;');
    sqlite.exec('PRAGMA synchronous = NORMAL;');
  }
  sqlite.exec('PRAGMA foreign_keys = ON;');

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL,
      organization TEXT,
      ngo_id TEXT,
      is_demo INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ngos (
      id TEXT PRIMARY KEY,
      owner_user_id TEXT,
      name TEXT NOT NULL,
      organization_type TEXT NOT NULL DEFAULT 'Receiving NGO',
      is_demo INTEGER NOT NULL DEFAULT 0,
      demo_label TEXT,
      accepted_categories TEXT NOT NULL,
      accepted_dietary_types TEXT NOT NULL,
      excluded_allergens TEXT NOT NULL,
      available_capacity_servings INTEGER,
      max_capacity_servings INTEGER,
      location_text TEXT,
      service_areas TEXT NOT NULL,
      latitude REAL,
      longitude REAL,
      pickup_capable INTEGER NOT NULL DEFAULT 1,
      operational_status TEXT NOT NULL DEFAULT 'active',
      response_time_minutes INTEGER,
      operating_hours TEXT,
      contact_note TEXT,
      verified INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS donations (
      id TEXT PRIMARY KEY,
      donor_id TEXT,
      title TEXT NOT NULL,
      food_category TEXT NOT NULL,
      dietary_type TEXT NOT NULL,
      quantity REAL NOT NULL,
      quantity_unit TEXT NOT NULL,
      quantity_text TEXT,
      image_url TEXT,
      pickup_available_until TEXT,
      address_text TEXT,
      latitude REAL,
      longitude REAL,
      preparation_time TEXT,
      current_storage TEXT,
      expiry_date TEXT,
      packaging_type TEXT,
      allergens TEXT,
      special_note TEXT,
      ai_assessment TEXT,
      status TEXT NOT NULL DEFAULT 'submitted',
      matched_ngo_id TEXT,
      matched_ngo_name TEXT,
      accepted_by_user_id TEXT,
      review_status TEXT,
      review_note TEXT,
      reviewed_by TEXT,
      reviewed_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS deliveries (
      id TEXT PRIMARY KEY,
      donation_id TEXT NOT NULL UNIQUE,
      ngo_id TEXT,
      ngo_name TEXT,
      volunteer_user_id TEXT,
      volunteer_name TEXT,
      vehicle_type TEXT,
      status TEXT NOT NULL DEFAULT 'pending_dispatch',
      pickup_otp TEXT NOT NULL,
      delivery_otp TEXT NOT NULL,
      pickup_address TEXT,
      dropoff_address TEXT,
      distance_km REAL,
      estimated_duration_min INTEGER,
      pickup_temp_celsius REAL,
      pickup_note TEXT,
      delivery_note TEXT,
      scheduled_pickup_at TEXT,
      picked_up_at TEXT,
      delivered_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS revoked_tokens (
      jti TEXT PRIMARY KEY,
      exp INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      role_target TEXT,
      donation_id TEXT,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_donations_status ON donations(status);
    CREATE INDEX IF NOT EXISTS idx_donations_donor ON donations(donor_id);
    CREATE INDEX IF NOT EXISTS idx_donations_created ON donations(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_donations_category ON donations(food_category);
    CREATE INDEX IF NOT EXISTS idx_deliveries_status ON deliveries(status);
    CREATE INDEX IF NOT EXISTS idx_deliveries_volunteer ON deliveries(volunteer_user_id);
    CREATE INDEX IF NOT EXISTS idx_notifications_target ON notifications(user_id, role_target, is_read);
  `);

  function withTransaction(fn) {
    sqlite.exec('BEGIN IMMEDIATE;');
    try {
      const result = fn();
      sqlite.exec('COMMIT;');
      return result;
    } catch (err) {
      try {
        sqlite.exec('ROLLBACK;');
      } catch {
        // Ignore rollback failure
      }
      throw err;
    }
  }

  const insertDonationStmt = sqlite.prepare(`
    INSERT INTO donations (
      id, donor_id, title, food_category, dietary_type, quantity, quantity_unit, quantity_text,
      image_url, pickup_available_until, address_text, latitude, longitude,
      preparation_time, current_storage, expiry_date, packaging_type, allergens, special_note,
      ai_assessment, status, matched_ngo_id, matched_ngo_name, accepted_by_user_id,
      review_status, review_note, reviewed_by, reviewed_at, created_at, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?
    )
  `);

  function insertDonation(d) {
    const rec = normalizeLegacyDonationRecord(d);
    insertDonationStmt.run(
      rec.id, rec.donor_id, rec.title, rec.food_category, rec.dietary_type, rec.quantity,
      rec.quantity_unit, rec.quantity_text, rec.image_url, rec.pickup_available_until,
      rec.address_text, rec.latitude, rec.longitude, rec.preparation_time, rec.current_storage,
      rec.expiry_date, rec.packaging_type, rec.allergens, rec.special_note, rec.ai_assessment,
      rec.status, rec.matched_ngo_id, rec.matched_ngo_name, rec.accepted_by_user_id,
      rec.review_status, rec.review_note, rec.reviewed_by, rec.reviewed_at,
      rec.created_at, rec.updated_at
    );
    return getDonationById(rec.id);
  }

  function getDonationById(id) {
    const row = sqlite.prepare('SELECT * FROM donations WHERE id = ?').get(String(id));
    return hydrateDonationRow(row);
  }

  function queryDonations({ user = null, status = null, category = null, search = null, limit = null, offset = 0 } = {}) {
    const where = [];
    const params = [];

    if (user && user.role === 'DONOR') {
      if (user.is_demo) {
        where.push('(donor_id = ? OR donor_id IS NULL)');
        params.push(user.id);
      } else {
        where.push('donor_id = ?');
        params.push(user.id);
      }
    }

    if (status && status !== 'all') {
      const st = String(status).toLowerCase();
      if (st === 'available') {
        where.push("LOWER(status) IN ('available', 'submitted')");
      } else {
        where.push('LOWER(status) = ?');
        params.push(st);
      }
    }

    if (category && category !== 'all') {
      where.push('food_category = ?');
      params.push(category);
    }

    if (search && String(search).trim()) {
      const term = `%${String(search).trim().toLowerCase()}%`;
      where.push('(LOWER(title) LIKE ? OR LOWER(address_text) LIKE ?)');
      params.push(term, term);
    }

    const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
    const countRow = sqlite.prepare(`SELECT COUNT(*) AS cnt FROM donations ${whereClause}`).get(...params);
    const total = countRow ? Number(countRow.cnt) : 0;

    let sql = `SELECT * FROM donations ${whereClause} ORDER BY created_at DESC`;
    const listParams = [...params];
    if (limit !== null && limit !== undefined && Number(limit) > 0) {
      sql += ' LIMIT ? OFFSET ?';
      listParams.push(Number(limit), Math.max(0, Number(offset) || 0));
    }

    const rows = sqlite.prepare(sql).all(...listParams).map(hydrateDonationRow);
    return { rows, total };
  }

  function updateDonationFields(id, updates) {
    const allowed = [
      'status', 'matched_ngo_id', 'matched_ngo_name', 'accepted_by_user_id',
      'review_status', 'review_note', 'reviewed_by', 'reviewed_at', 'updated_at',
      'ai_assessment', 'latitude', 'longitude'
    ];
    const sets = [];
    const params = [];
    for (const [k, v] of Object.entries(updates)) {
      if (!allowed.includes(k)) continue;
      sets.push(`${k} = ?`);
      params.push(k === 'ai_assessment' && v && typeof v !== 'string' ? JSON.stringify(v) : v);
    }
    if (sets.length === 0) return getDonationById(id);
    if (!updates.updated_at) {
      sets.push('updated_at = ?');
      params.push(new Date().toISOString());
    }
    params.push(String(id));
    sqlite.prepare(`UPDATE donations SET ${sets.join(', ')} WHERE id = ?`).run(...params);
    return getDonationById(id);
  }

  function upsertNgo(ngo) {
    const now = new Date().toISOString();
    const existing = sqlite.prepare('SELECT id FROM ngos WHERE id = ?').get(ngo.id);
    const categoriesJson = JSON.stringify(ngo.accepted_categories || ['cooked_meals', 'fresh_produce', 'bakery', 'packaged_sealed']);
    const dietaryJson = JSON.stringify(ngo.accepted_dietary_types || ['vegetarian', 'non_vegetarian']);
    const allergensJson = JSON.stringify(ngo.excluded_allergens || []);
    const areasJson = JSON.stringify(ngo.service_areas || []);

    if (existing) {
      sqlite.prepare(`
        UPDATE ngos SET
          name = ?, organization_type = ?, accepted_categories = ?, accepted_dietary_types = ?,
          excluded_allergens = ?, available_capacity_servings = ?, max_capacity_servings = ?,
          location_text = ?, service_areas = ?, latitude = ?, longitude = ?,
          pickup_capable = ?, operational_status = ?, response_time_minutes = ?,
          operating_hours = ?, contact_note = ?, verified = ?, updated_at = ?
        WHERE id = ?
      `).run(
        ngo.name,
        ngo.organization_type || 'Receiving NGO',
        categoriesJson,
        dietaryJson,
        allergensJson,
        ngo.available_capacity_servings ?? null,
        ngo.max_capacity_servings ?? ngo.available_capacity_servings ?? null,
        ngo.location_text || '',
        areasJson,
        ngo.latitude ?? null,
        ngo.longitude ?? null,
        ngo.pickup_capable !== undefined ? (ngo.pickup_capable ? 1 : 0) : 1,
        ngo.operational_status || 'active',
        ngo.response_time_minutes ?? null,
        ngo.operating_hours || null,
        ngo.contact_note || null,
        ngo.verified ? 1 : 0,
        now,
        ngo.id
      );
    } else {
      sqlite.prepare(`
        INSERT INTO ngos (
          id, owner_user_id, name, organization_type, is_demo, demo_label,
          accepted_categories, accepted_dietary_types, excluded_allergens,
          available_capacity_servings, max_capacity_servings, location_text, service_areas,
          latitude, longitude, pickup_capable, operational_status, response_time_minutes,
          operating_hours, contact_note, verified, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        ngo.id,
        ngo.owner_user_id || null,
        ngo.name,
        ngo.organization_type || 'Receiving NGO',
        ngo.is_demo ? 1 : 0,
        ngo.demo_label || (ngo.is_demo ? 'Demo Profile' : null),
        categoriesJson,
        dietaryJson,
        allergensJson,
        ngo.available_capacity_servings ?? null,
        ngo.max_capacity_servings ?? ngo.available_capacity_servings ?? null,
        ngo.location_text || '',
        areasJson,
        ngo.latitude ?? null,
        ngo.longitude ?? null,
        ngo.pickup_capable !== undefined ? (ngo.pickup_capable ? 1 : 0) : 1,
        ngo.operational_status || 'active',
        ngo.response_time_minutes ?? 45,
        ngo.operating_hours || '08:00 - 21:00',
        ngo.contact_note || null,
        ngo.verified ? 1 : 0,
        ngo.created_at || now,
        now
      );
    }
    return getNgoById(ngo.id);
  }

  function getNgoById(id) {
    if (!id) return null;
    const row = sqlite.prepare('SELECT * FROM ngos WHERE id = ?').get(String(id));
    return hydrateNgoRow(row);
  }

  function listNgos({ includeDemo = true } = {}) {
    const sql = includeDemo
      ? 'SELECT * FROM ngos ORDER BY is_demo ASC, name ASC'
      : 'SELECT * FROM ngos WHERE is_demo = 0 ORDER BY name ASC';
    return sqlite.prepare(sql).all().map(hydrateNgoRow);
  }

  function decrementNgoCapacity(ngoId, servingsDelta) {
    if (!ngoId || !servingsDelta || servingsDelta <= 0) return null;
    const ngo = getNgoById(ngoId);
    if (!ngo || ngo.available_capacity_servings === null) return ngo;
    const nextCap = Math.max(0, ngo.available_capacity_servings - Math.round(servingsDelta));
    sqlite.prepare('UPDATE ngos SET available_capacity_servings = ?, updated_at = ? WHERE id = ?').run(
      nextCap,
      new Date().toISOString(),
      ngoId
    );
    return getNgoById(ngoId);
  }

  function bootstrapSeedData({ legacyDataFile, legacyUsersFile, demoNgos = [] } = {}) {
    withTransaction(() => {
      const donCount = sqlite.prepare('SELECT COUNT(*) AS cnt FROM donations').get().cnt;
      if (donCount === 0 && legacyDataFile && fs.existsSync(legacyDataFile)) {
        try {
          const parsed = JSON.parse(fs.readFileSync(legacyDataFile, 'utf8'));
          if (Array.isArray(parsed)) {
            for (const item of parsed) {
              insertDonation(item);
            }
          }
        } catch (err) {
          console.error('[DB Seed] Failed importing legacy data.json:', err.message);
        }
      }

      const userCount = sqlite.prepare('SELECT COUNT(*) AS cnt FROM users').get().cnt;
      if (userCount === 0 && legacyUsersFile && fs.existsSync(legacyUsersFile)) {
        try {
          const parsedUsers = JSON.parse(fs.readFileSync(legacyUsersFile, 'utf8'));
          if (Array.isArray(parsedUsers)) {
            const insUser = sqlite.prepare(`
              INSERT OR IGNORE INTO users (id, name, email, password_hash, role, organization, ngo_id, is_demo, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);
            for (const u of parsedUsers) {
              insUser.run(
                u.id, u.name, u.email, u.password_hash, u.role,
                u.organization || null, u.ngo_id || null, u.is_demo ? 1 : 0,
                u.created_at || new Date().toISOString()
              );
            }
          }
        } catch (err) {
          console.error('[DB Seed] Failed importing legacy users.json:', err.message);
        }
      }

      const ngoCount = sqlite.prepare('SELECT COUNT(*) AS cnt FROM ngos').get().cnt;
      if (ngoCount === 0 && Array.isArray(demoNgos)) {
        for (const ngo of demoNgos) {
          upsertNgo(ngo);
        }
      }
    });
  }

  function createNotification({ userId = null, roleTarget = null, donationId = null, type, title, message }) {
    const id = `notif-${Date.now()}-${Math.round(Math.random() * 1e6)}`;
    const now = new Date().toISOString();
    sqlite.prepare(`
      INSERT INTO notifications (id, user_id, role_target, donation_id, type, title, message, is_read, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)
    `).run(id, userId, roleTarget, donationId, type, title, message, now);
    return { id, user_id: userId, role_target: roleTarget, donation_id: donationId, type, title, message, is_read: false, created_at: now };
  }

  function listNotificationsForUser(user, limit = 25) {
    if (!user) return [];
    const rows = sqlite.prepare(`
      SELECT * FROM notifications
      WHERE user_id = ? OR (user_id IS NULL AND (role_target = ? OR role_target IS NULL))
      ORDER BY created_at DESC
      LIMIT ?
    `).all(user.id, user.role, limit);
    return rows.map((r) => ({ ...r, is_read: Boolean(r.is_read) }));
  }

  function markNotificationsReadForUser(user) {
    if (!user) return 0;
    const res = sqlite.prepare(`
      UPDATE notifications SET is_read = 1
      WHERE is_read = 0 AND (user_id = ? OR (user_id IS NULL AND (role_target = ? OR role_target IS NULL)))
    `).run(user.id, user.role);
    return res.changes;
  }

  return {
    sqlite,
    dbPath,
    withTransaction,
    insertDonation,
    getDonationById,
    queryDonations,
    updateDonationFields,
    upsertNgo,
    getNgoById,
    listNgos,
    decrementNgoCapacity,
    bootstrapSeedData,
    createNotification,
    listNotificationsForUser,
    markNotificationsReadForUser,
    close: () => sqlite.close(),
  };
}

module.exports = {
  createDatabase,
  DEFAULT_DB_PATH,
  normalizeLegacyDonationRecord,
  hydrateDonationRow,
  hydrateNgoRow,
};
