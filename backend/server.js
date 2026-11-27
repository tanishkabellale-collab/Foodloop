require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { assessFoodImage } = require('./services/aiAssessmentService');
const { rankNgosForDonation } = require('./services/matchingService');
const { MATCHING_WEIGHTS } = require('./config/matchingWeights');
const { DEMO_NGOS } = require('./data/demoNgos');
const { ROLES, revokeToken, createAuthStore } = require('./services/authService');
const { createAuthMiddleware } = require('./middleware/authMiddleware');

const app = express();
const PORT = process.env.PORT || 5001;
const authStore = createAuthStore(process.env.USERS_FILE || undefined);
const { authenticate, authorizeRoles } = createAuthMiddleware(authStore);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const DATA_FILE = path.join(__dirname, 'data.json');
const UPLOADS_DIR = path.join(__dirname, 'uploads');

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Serve uploaded photos as static files
app.use('/uploads', express.static(UPLOADS_DIR));

// Configure Multer for local photo disk storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, `donation-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (allowedMimes.includes(file.mimetype.toLowerCase())) {
      cb(null, true);
    } else {
      cb(new Error('Invalid image type. Only JPG, PNG, and WebP images are allowed.'));
    }
  }
});

// Configure Multer memory storage for immediate AI assessment buffer handling
const uploadAi = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (allowedMimes.includes(file.mimetype.toLowerCase())) {
      cb(null, true);
    } else {
      cb(new Error('Invalid image type. Only JPG, PNG, and WebP images are allowed.'));
    }
  }
});

// Persistent data store
let donations = [];

try {
  if (fs.existsSync(DATA_FILE)) {
    const data = fs.readFileSync(DATA_FILE, 'utf8');
    donations = JSON.parse(data);
  } else {
    donations = [];
    fs.writeFileSync(DATA_FILE, JSON.stringify(donations, null, 2));
  }
} catch (err) {
  console.error("Error reading data file:", err);
  donations = [];
}

const saveData = () => {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(donations, null, 2));
  } catch (err) {
    console.error("Error saving data file:", err);
  }
};

// Serialization helper ensuring unified V1 response with backward-compatible aliases
function serializeDonation(d) {
  const title = d.title || d.foodName || 'Surplus Food';
  const address_text = d.address_text || d.location || '';
  const pickup_available_until = d.pickup_available_until || d.expiryTime || '';
  
  let quantity_val = 1;
  let quantity_unit = d.quantity_unit || 'servings';
  if (typeof d.quantity === 'number') {
    quantity_val = d.quantity;
  } else if (typeof d.quantity === 'string') {
    const parsed = parseFloat(d.quantity);
    quantity_val = isNaN(parsed) ? 1 : parsed;
    // If unit was embedded in string, retain it as fallback
    const unitMatch = d.quantity.replace(/^[0-9.\s]+/, '').trim();
    if (unitMatch && !d.quantity_unit) {
      quantity_unit = unitMatch;
    }
  }
  const quantityLegacy = typeof d.quantity === 'string' ? d.quantity : `${quantity_val} ${quantity_unit}`;

  // Compute runtime derived fields
  let urgency_window_minutes = null;
  let is_expired = false;
  if (pickup_available_until) {
    const diffMs = new Date(pickup_available_until).getTime() - Date.now();
    urgency_window_minutes = Math.max(0, Math.round(diffMs / 60000));
    is_expired = diffMs <= 0;
  }

  return {
    // V1 Core Fields
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

    // V1 Conditional Fields
    preparation_time: d.preparation_time || null,
    current_storage: d.current_storage || null,
    expiry_date: d.expiry_date || null,

    // V1 Optional & Recommended Fields
    packaging_type: d.packaging_type || null,
    allergens: d.allergens || null,
    special_note: d.special_note || null,

    // AI Visual Assessment (Optional)
    ai_assessment: d.ai_assessment || null,

    // Status Lifecycle & Timestamps
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

    // Runtime Derived Fields
    urgency_window_minutes,
    is_expired,

    // Backward Compatibility Aliases for Legacy Clients
    foodName: title,
    location: address_text,
    expiryTime: pickup_available_until,
    quantityText: quantityLegacy,
    createdAt: d.created_at || d.createdAt || new Date().toISOString()
  };
}

// ============================================================================
// AUTHENTICATION & RBAC ENDPOINTS
// ============================================================================

app.post('/api/auth/register', (req, res) => {
  try {
    const result = authStore.registerUser(req.body || {});
    return res.status(201).json(result);
  } catch (err) {
    return res.status(err.status || 400).json({ error: err.message });
  }
});

app.post('/api/auth/login', (req, res) => {
  try {
    const result = authStore.loginUser(req.body || {});
    return res.json(result);
  } catch (err) {
    return res.status(err.status || 401).json({ error: err.message });
  }
});

app.post('/api/auth/logout', authenticate, (req, res) => {
  revokeToken(req.authToken);
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

// 1. Get all donations (Authenticated; DONOR sees own + legacy demo listings)
app.get('/api/donations', authenticate, authorizeRoles(ROLES.DONOR, ROLES.NGO, ROLES.ADMIN), (req, res) => {
  let visible = [...donations];
  if (req.user.role === ROLES.DONOR) {
    visible = visible.filter(
      (d) => d.donor_id === req.user.id || (!d.donor_id && req.user.is_demo)
    );
  }
  const sorted = visible
    .sort((a, b) => new Date(b.created_at || b.createdAt) - new Date(a.created_at || a.createdAt))
    .map(serializeDonation);
  res.json(sorted);
});

// 2. Get single donation by ID
app.get('/api/donations/:id', authenticate, authorizeRoles(ROLES.DONOR, ROLES.NGO, ROLES.ADMIN), (req, res) => {
  const donation = donations.find(d => d.id === req.params.id);
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
  res.json(serializeDonation(donation));
});

// 3. Create a donation (DONOR or ADMIN only)
app.post('/api/donations', authenticate, authorizeRoles(ROLES.DONOR, ROLES.ADMIN), (req, res) => {
  upload.single('photo')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'Image exceeds maximum allowed size of 5 MB.' });
      }
      return res.status(400).json({ error: `Upload error: ${err.message}` });
    } else if (err) {
      return res.status(400).json({ error: err.message });
    }

    const body = req.body;

    // Detect if this is a legacy submission format
    const isLegacy = !body.food_category && !body.title && body.foodName;

    if (isLegacy) {
      const { foodName, quantity, expiryTime, location } = body;
      if (!foodName || !quantity || !expiryTime || !location) {
        return res.status(400).json({ error: 'All fields (foodName, quantity, expiryTime, location) are required for legacy submissions.' });
      }

      const legacyDonation = {
        id: Date.now().toString(),
        foodName,
        quantity,
        expiryTime,
        location,
        status: 'available',
        createdAt: new Date().toISOString()
      };

      donations.push(legacyDonation);
      saveData();
      return res.status(201).json(serializeDonation(legacyDonation));
    }

    // --- V1.0 VALIDATION ---
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
      donor_id,
      ai_assessment
    } = body;

    const finalTitle = (title || '').trim();
    if (!finalTitle) {
      return res.status(400).json({ error: 'Food Title / Short Description is required.' });
    }

    const validCategories = ['cooked_meals', 'fresh_produce', 'bakery', 'packaged_sealed'];
    if (!food_category || !validCategories.includes(food_category)) {
      return res.status(400).json({ error: `Food Category is required and must be one of: ${validCategories.join(', ')}.` });
    }

    const validDietary = ['vegetarian', 'non_vegetarian'];
    if (!dietary_type || !validDietary.includes(dietary_type)) {
      return res.status(400).json({ error: `Dietary Type is required and must be either 'vegetarian' or 'non_vegetarian'.` });
    }

    const numericQuantity = parseFloat(quantity);
    if (isNaN(numericQuantity) || numericQuantity <= 0) {
      return res.status(400).json({ error: 'Quantity must be a positive number greater than zero.' });
    }

    const validUnits = ['servings', 'plates', 'trays', 'boxes'];
    if (!quantity_unit || !validUnits.includes(quantity_unit)) {
      return res.status(400).json({ error: `Quantity Unit is required and must be one of: ${validUnits.join(', ')}.` });
    }

    // Photo is strictly required for new V1 donations
    let image_url = null;
    if (req.file) {
      image_url = `/uploads/${req.file.filename}`;
    } else if (body.image_url) {
      image_url = body.image_url;
    }

    if (!image_url) {
      return res.status(400).json({ error: 'A clear food photograph is required for new donations.' });
    }

    // Pickup deadline validation (must be valid future date)
    if (!pickup_available_until) {
      return res.status(400).json({ error: 'Pickup Available Until datetime is required.' });
    }
    const pickupDate = new Date(pickup_available_until);
    if (isNaN(pickupDate.getTime())) {
      return res.status(400).json({ error: 'Pickup Available Until must be a valid datetime.' });
    }
    if (pickupDate.getTime() <= Date.now()) {
      return res.status(400).json({ error: 'Pickup Available Until must be a future date and time.' });
    }

    // Address / Location
    const finalAddress = (address_text || location || '').trim();
    if (!finalAddress) {
      return res.status(400).json({ error: 'Pickup Address / Location is required.' });
    }

    // --- CONDITIONAL VALIDATION ---
    if (food_category === 'cooked_meals') {
      const validPrepTimes = [
        'less_than_1_hour_ago',
        '1_to_2_hours_ago',
        '2_to_4_hours_ago',
        'more_than_4_hours_ago'
      ];
      if (!preparation_time || !validPrepTimes.includes(preparation_time)) {
        return res.status(400).json({ error: `Preparation Time is required for Cooked Meals and must be one of: ${validPrepTimes.join(', ')}.` });
      }

      const validStorage = ['room_temperature', 'refrigerated', 'hot_insulated'];
      if (!current_storage || !validStorage.includes(current_storage)) {
        return res.status(400).json({ error: `Current Storage is required for Cooked Meals and must be one of: ${validStorage.join(', ')}.` });
      }
    }

    if (food_category === 'packaged_sealed') {
      if (!expiry_date || !(expiry_date + '').trim()) {
        return res.status(400).json({ error: 'Expiry / Best Before Date is required for Packaged / Sealed food.' });
      }
    }

    // Optional / Recommended validation
    if (packaging_type && !['sealed_covered', 'open_loose'].includes(packaging_type)) {
      return res.status(400).json({ error: `Packaging Type, if provided, must be 'sealed_covered' or 'open_loose'.` });
    }

    // Optional AI Assessment payload parsing
    let parsedAiAssessment = null;
    if (ai_assessment) {
      try {
        parsedAiAssessment = typeof ai_assessment === 'string' ? JSON.parse(ai_assessment) : ai_assessment;
      } catch (e) {
        parsedAiAssessment = null;
      }
    }

    const nowISO = new Date().toISOString();
    const newDonation = {
      id: Date.now().toString(),
      donor_id: req.user.id,
      title: finalTitle,
      food_category,
      dietary_type,
      quantity: numericQuantity,
      quantity_unit,
      image_url,
      pickup_available_until: pickupDate.toISOString(),
      address_text: finalAddress,
      latitude: latitude ? parseFloat(latitude) : null,
      longitude: longitude ? parseFloat(longitude) : null,

      // Conditionals
      preparation_time: food_category === 'cooked_meals' ? preparation_time : null,
      current_storage: food_category === 'cooked_meals' ? current_storage : null,
      expiry_date: food_category === 'packaged_sealed' ? expiry_date : null,

      // Optional/Recommended
      packaging_type: packaging_type || null,
      allergens: allergens ? allergens.trim() : null,
      special_note: special_note ? special_note.trim() : null,

      // AI Assessment Metadata
      ai_assessment: parsedAiAssessment,

      status: 'submitted',
      created_at: nowISO,
      updated_at: nowISO,

      // Legacy fields for backward compatibility
      foodName: finalTitle,
      location: finalAddress,
      expiryTime: pickupDate.toISOString(),
      quantityText: `${numericQuantity} ${quantity_unit}`,
      createdAt: nowISO
    };

    donations.push(newDonation);
    saveData();
    res.status(201).json(serializeDonation(newDonation));
  });
});

// 4. Accept a donation (NGO or ADMIN only)
app.patch('/api/donations/:id/accept', authenticate, authorizeRoles(ROLES.NGO, ROLES.ADMIN), (req, res) => {
  const { id } = req.params;
  const index = donations.findIndex(d => d.id === id);

  if (index === -1) {
    return res.status(404).json({ error: 'Donation not found.' });
  }

  if (donations[index].status === 'accepted') {
    return res.status(400).json({ error: 'Donation already accepted.' });
  }

  donations[index].status = 'accepted';
  donations[index].accepted_by_user_id = req.user.id;
  if (req.body && req.body.matched_ngo_id) {
    donations[index].matched_ngo_id = String(req.body.matched_ngo_id);
  }
  if (req.body && req.body.matched_ngo_name) {
    donations[index].matched_ngo_name = String(req.body.matched_ngo_name);
  } else if (req.user.role === ROLES.NGO && !donations[index].matched_ngo_name) {
    donations[index].matched_ngo_name = req.user.organization || req.user.name;
  }
  donations[index].updated_at = new Date().toISOString();
  saveData();
  res.json(serializeDonation(donations[index]));
});

// 4b. Intelligent NGO Matching for a specific donation
app.get('/api/donations/:id/matches', authenticate, authorizeRoles(ROLES.DONOR, ROLES.NGO, ROLES.ADMIN), (req, res) => {
  const id = (req.params.id || '').trim();
  if (!id) {
    return res.status(400).json({ error: 'Valid donation ID is required.' });
  }

  const donation = donations.find(d => d.id === id);
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
    const ngos = Array.isArray(DEMO_NGOS) ? DEMO_NGOS : [];
    const matches = rankNgosForDonation(serialized, ngos);

    res.json({
      donation: serialized,
      ngos_source: 'demo_profiles',
      ngos_count: ngos.length,
      weights: MATCHING_WEIGHTS,
      generated_at: new Date().toISOString(),
      matches,
    });
  } catch (err) {
    console.error('Matching Engine Error:', err);
    res.status(500).json({ error: 'Failed to compute NGO matches for this donation.' });
  }
});

// 4c. Batch Intelligent NGO Matching for all available/submitted donations (NGO or ADMIN)
app.get('/api/matches', authenticate, authorizeRoles(ROLES.NGO, ROLES.ADMIN), (req, res) => {
  try {
    const activeStatuses = ['available', 'submitted'];
    const activeDonations = donations
      .filter(d => activeStatuses.includes((d.status || 'available').toLowerCase()))
      .map(serializeDonation);

    const ngos = Array.isArray(DEMO_NGOS) ? DEMO_NGOS : [];
    const limit = Math.max(1, Math.min(20, parseInt(req.query.limit, 10) || 3));

    const results = activeDonations.map((donation) => {
      const ranked = rankNgosForDonation(donation, ngos);
      return {
        donation,
        top_matches: ranked.slice(0, limit),
        total_ngos_evaluated: ranked.length,
      };
    });

    res.json({
      ngos_source: 'demo_profiles',
      weights: MATCHING_WEIGHTS,
      generated_at: new Date().toISOString(),
      donations_evaluated: results.length,
      results,
    });
  } catch (err) {
    console.error('Batch Matching Error:', err);
    res.status(500).json({ error: 'Failed to compute NGO matches.' });
  }
});

// 5. Collect a donation (NGO or ADMIN only)
app.patch('/api/donations/:id/collect', authenticate, authorizeRoles(ROLES.NGO, ROLES.ADMIN), (req, res) => {
  const { id } = req.params;
  const index = donations.findIndex(d => d.id === id);

  if (index === -1) {
    return res.status(404).json({ error: 'Donation not found.' });
  }

  if (
    req.user.role === ROLES.NGO &&
    donations[index].accepted_by_user_id &&
    donations[index].accepted_by_user_id !== req.user.id
  ) {
    return res.status(403).json({
      error: 'Only the accepting NGO or an Admin can mark this donation as collected.',
    });
  }

  if (donations[index].status === 'collected') {
    return res.status(400).json({ error: 'Donation already collected.' });
  }

  donations[index].status = 'collected';
  donations[index].updated_at = new Date().toISOString();
  saveData();
  res.json(serializeDonation(donations[index]));
});

// 6. AI Visual Condition Assessment (DONOR or ADMIN)
app.post('/api/ai/assess-image', authenticate, authorizeRoles(ROLES.DONOR, ROLES.ADMIN), (req, res) => {
  uploadAi.single('image')(req, res, async (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          assessment_status: 'rejected',
          error: 'Image exceeds maximum allowed size of 5 MB.',
          code: 'INVALID_IMAGE'
        });
      }
      return res.status(400).json({
        assessment_status: 'rejected',
        error: `Upload error: ${err.message}`,
        code: 'INVALID_IMAGE'
      });
    } else if (err) {
      return res.status(400).json({
        assessment_status: 'rejected',
        error: err.message,
        code: 'INVALID_IMAGE'
      });
    }

    const food_category = req.body.food_category || 'unspecified';

    // Extract uploaded image buffer
    let buffer = req.file ? req.file.buffer : null;
    let mimeType = req.file ? req.file.mimetype : 'image/jpeg';

    // Fallback: check if existing image_url was passed
    if (!buffer && req.body.image_url) {
      const safeRel = path.normalize(req.body.image_url).replace(/^(\.\.[/\\])+/, '').replace(/^\//, '');
      const localPath = path.join(__dirname, safeRel);
      if (localPath.startsWith(UPLOADS_DIR) && fs.existsSync(localPath)) {
        try {
          buffer = fs.readFileSync(localPath);
          const ext = path.extname(localPath).toLowerCase();
          mimeType = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
        } catch (readErr) {
          console.error("Failed to read image from image_url:", readErr);
        }
      }
    }

    if (!buffer) {
      return res.status(400).json({
        assessment_status: 'rejected',
        error: 'Invalid or missing image file. Only JPG, PNG, and WebP images up to 5 MB are supported.',
        code: 'INVALID_IMAGE'
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
          code: 'INVALID_IMAGE'
        });
      }
      if (aiErr.code === 'AI_TIMEOUT') {
        return res.status(504).json({
          assessment_status: 'failed',
          reason: 'ai_timeout',
          error: 'AI vision analysis timed out. You can retry or proceed with standard donation submission.',
          code: 'AI_TIMEOUT'
        });
      }
      return res.status(503).json({
        assessment_status: 'failed',
        reason: 'inference_engine_unavailable',
        error: 'AI visual assessment engine is currently unavailable. Please retry or proceed with standard donation intake.',
        code: 'SERVICE_UNAVAILABLE'
      });
    }
  });
});

// 7. Admin Oversight & Review Endpoints (ADMIN only)
app.get('/api/admin/overview', authenticate, authorizeRoles(ROLES.ADMIN), (req, res) => {
  const serialized = donations.map(serializeDonation);
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
  const index = donations.findIndex((d) => d.id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'Donation not found.' });
  }

  const { review_status, review_note } = req.body || {};
  const validDecisions = ['approved', 'flagged', 'rejected'];
  if (!review_status || !validDecisions.includes(review_status)) {
    return res.status(400).json({
      error: `review_status is required and must be one of: ${validDecisions.join(', ')}.`,
    });
  }

  donations[index].review_status = review_status;
  donations[index].review_note = review_note ? String(review_note).trim() : null;
  donations[index].reviewed_by = req.user.name;
  donations[index].reviewed_at = new Date().toISOString();
  donations[index].updated_at = new Date().toISOString();
  saveData();

  res.json(serializeDonation(donations[index]));
});

// Global error handler
app.use((err, req, res, next) => {
  console.error("Server Error:", err);
  res.status(500).json({ error: err.message || 'Internal Server Error' });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Backend server running on http://localhost:${PORT}`);
  });
}

module.exports = { app, authStore };
