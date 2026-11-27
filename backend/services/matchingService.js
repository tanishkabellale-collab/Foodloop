/**
 * FoodLoop Intelligent NGO Matching Service
 *
 * Pure, deterministic, explainable scoring engine that ranks eligible NGOs
 * for a given donation using configurable weights.
 *
 * Important:
 * - Scores represent compatibility rankings (0-100), NOT probability of success
 *   and NOT food safety certification.
 * - Missing data never awards maximum points; scores are normalized over known
 *   factors and missing factors are explicitly disclosed.
 */

const {
  MATCHING_WEIGHTS,
  MATCH_TIERS,
  UNIT_TO_SERVINGS,
  DISTANCE_THRESHOLDS_KM,
} = require('../config/matchingWeights');

/**
 * Haversine distance in kilometers between two lat/lng pairs.
 */
function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

/**
 * Normalize donation fields so both V1 and legacy records work cleanly.
 */
function normalizeDonation(donation, now = new Date()) {
  if (!donation || typeof donation !== 'object') {
    throw new Error('Invalid donation object.');
  }

  let quantityVal = null;
  let quantityUnit = donation.quantity_unit || null;

  if (typeof donation.quantity === 'number' && !Number.isNaN(donation.quantity)) {
    quantityVal = donation.quantity;
  } else if (typeof donation.quantity === 'string') {
    const parsed = parseFloat(donation.quantity);
    if (!Number.isNaN(parsed)) {
      quantityVal = parsed;
    }
    const unitMatch = donation.quantity.replace(/^[0-9.\s]+/, '').trim().toLowerCase();
    if (unitMatch && !quantityUnit) {
      quantityUnit = unitMatch;
    }
  }

  const unitKey = (quantityUnit || 'servings').toLowerCase();
  const multiplier = UNIT_TO_SERVINGS[unitKey] || 1;
  const estimatedServings =
    quantityVal !== null ? Math.round(quantityVal * multiplier) : null;

  const deadlineStr = donation.pickup_available_until || donation.expiryTime || null;
  let remainingMinutes = null;
  let isExpired = false;
  if (deadlineStr) {
    const deadlineMs = new Date(deadlineStr).getTime();
    if (!Number.isNaN(deadlineMs)) {
      const diffMs = deadlineMs - now.getTime();
      remainingMinutes = Math.max(0, Math.round(diffMs / 60000));
      isExpired = diffMs <= 0;
    }
  }

  return {
    id: donation.id,
    title: donation.title || donation.foodName || 'Surplus Food',
    food_category: donation.food_category || null,
    dietary_type: donation.dietary_type || null,
    quantity: quantityVal,
    quantity_unit: quantityUnit || (quantityVal !== null ? 'servings' : null),
    estimated_servings: estimatedServings,
    address_text: (donation.address_text || donation.location || '').trim(),
    latitude:
      typeof donation.latitude === 'number' && !Number.isNaN(donation.latitude)
        ? donation.latitude
        : null,
    longitude:
      typeof donation.longitude === 'number' && !Number.isNaN(donation.longitude)
        ? donation.longitude
        : null,
    pickup_available_until: deadlineStr,
    remaining_minutes: remainingMinutes,
    is_expired: isExpired,
    allergens: donation.allergens || null,
    status: donation.status || 'available',
  };
}

function getTierForScore(score) {
  for (const tier of MATCH_TIERS) {
    if (score >= tier.minScore) {
      return tier;
    }
  }
  return MATCH_TIERS[MATCH_TIERS.length - 1];
}

function evaluateCategory(donation, ngo, maxPoints) {
  const ngoCats = Array.isArray(ngo.accepted_categories) ? ngo.accepted_categories : [];

  if (!donation.food_category || ngoCats.length === 0) {
    const missingWho = !donation.food_category ? 'donation food category' : 'NGO accepted categories';
    return {
      key: 'category',
      label: 'Food Category',
      points: 0,
      maxPoints,
      dataAvailable: false,
      status: 'unknown',
      reason: null,
      warning: `Missing ${missingWho}; category compatibility could not be verified.`,
      missingFactor: missingWho,
    };
  }

  if (ngoCats.includes(donation.food_category)) {
    return {
      key: 'category',
      label: 'Food Category',
      points: maxPoints,
      maxPoints,
      dataAvailable: true,
      status: 'matched',
      reason: `NGO accepts "${donation.food_category.replace(/_/g, ' ')}" donations.`,
      warning: null,
      missingFactor: null,
    };
  }

  return {
    key: 'category',
    label: 'Food Category',
    points: 0,
    maxPoints,
    dataAvailable: true,
    status: 'mismatch',
    reason: null,
    warning: `Category mismatch: NGO accepts [${ngoCats.map((c) => c.replace(/_/g, ' ')).join(', ')}], not "${donation.food_category.replace(/_/g, ' ')}".`,
    missingFactor: null,
  };
}

function evaluateLocation(donation, ngo, maxPoints) {
  const hasDonorCoords = donation.latitude !== null && donation.longitude !== null;
  const hasNgoCoords =
    typeof ngo.latitude === 'number' &&
    !Number.isNaN(ngo.latitude) &&
    typeof ngo.longitude === 'number' &&
    !Number.isNaN(ngo.longitude);

  if (hasDonorCoords && hasNgoCoords) {
    const distanceKm = calculateDistanceKm(
      donation.latitude,
      donation.longitude,
      ngo.latitude,
      ngo.longitude
    );

    let ratio = 0.1;
    for (const band of DISTANCE_THRESHOLDS_KM) {
      if (distanceKm <= band.maxKm) {
        ratio = band.ratio;
        break;
      }
    }

    const points = Math.round(maxPoints * ratio);
    return {
      key: 'location',
      label: 'Distance / Location',
      points,
      maxPoints,
      dataAvailable: true,
      mode: 'coordinates',
      distance_km: distanceKm,
      status: distanceKm <= 15 ? 'nearby' : 'distant',
      reason: `Calculated straight-line distance is ${distanceKm} km from donor coordinates.`,
      warning: distanceKm > 15 ? `Distance (${distanceKm} km) may increase transit time.` : null,
      missingFactor: null,
    };
  }

  // Fallback: text-based service area matching without fabricating coordinates or distances
  const donorAddr = (donation.address_text || '').toLowerCase();
  const serviceAreas = Array.isArray(ngo.service_areas) ? ngo.service_areas : [];
  const ngoLoc = (ngo.location_text || '').toLowerCase();

  if (!donorAddr || (serviceAreas.length === 0 && !ngoLoc)) {
    return {
      key: 'location',
      label: 'Distance / Location',
      points: 0,
      maxPoints,
      dataAvailable: false,
      mode: 'unavailable',
      distance_km: null,
      status: 'unknown',
      reason: null,
      warning: 'Donor or NGO location data is missing; distance cannot be evaluated.',
      missingFactor: 'location coordinates/address',
    };
  }

  const matchedAreas = serviceAreas.filter((area) =>
    donorAddr.includes(area.toLowerCase())
  );

  if (matchedAreas.length > 0) {
    // Location text fallback awards up to 65% of location weight (never 100% without GPS coordinates)
    const fallbackPoints = Math.round(maxPoints * 0.65);
    return {
      key: 'location',
      label: 'Distance / Location',
      points: fallbackPoints,
      maxPoints,
      dataAvailable: true,
      mode: 'text_fallback',
      distance_km: null,
      status: 'area_match',
      reason: `Location fallback: donor address matches NGO service area (${matchedAreas.join(', ')}).`,
      warning: 'GPS coordinates unavailable; scored via text-based service area fallback (exact km unknown).',
      missingFactor: 'exact GPS coordinates',
    };
  }

  // Weak fallback if NGO location city word appears
  const ngoTokens = ngoLoc.split(/[\s,]+/).filter((t) => t.length >= 3);
  const cityMatch = ngoTokens.some((tok) => donorAddr.includes(tok));
  if (cityMatch) {
    const fallbackPoints = Math.round(maxPoints * 0.35);
    return {
      key: 'location',
      label: 'Distance / Location',
      points: fallbackPoints,
      maxPoints,
      dataAvailable: true,
      mode: 'text_fallback',
      distance_km: null,
      status: 'city_match',
      reason: `Location fallback: donor and NGO share general city/locality (${ngo.location_text}).`,
      warning: 'GPS coordinates unavailable; only broad locality overlap detected.',
      missingFactor: 'exact GPS coordinates',
    };
  }

  return {
    key: 'location',
    label: 'Distance / Location',
    points: 0,
    maxPoints,
    dataAvailable: true,
    mode: 'text_fallback',
    distance_km: null,
    status: 'no_overlap',
    reason: null,
    warning: `Location fallback: donor address "${donation.address_text}" did not match NGO service areas (${serviceAreas.join(', ') || ngo.location_text}).`,
    missingFactor: 'exact GPS coordinates',
  };
}

function evaluateCapacity(donation, ngo, maxPoints) {
  const capacity = ngo.available_capacity_servings;
  const needed = donation.estimated_servings;

  if (
    typeof capacity !== 'number' ||
    Number.isNaN(capacity) ||
    needed === null ||
    Number.isNaN(needed)
  ) {
    const missingWhat =
      typeof capacity !== 'number' || Number.isNaN(capacity)
        ? 'NGO available capacity'
        : 'donation quantity';
    return {
      key: 'capacity',
      label: 'Capacity Fit',
      points: 0,
      maxPoints,
      dataAvailable: false,
      status: 'unknown',
      exceeds_capacity: false,
      estimated_servings: needed,
      available_capacity_servings: typeof capacity === 'number' ? capacity : null,
      reason: null,
      warning: `Missing ${missingWhat}; capacity suitability requires manual confirmation.`,
      missingFactor: missingWhat,
    };
  }

  if (needed > capacity) {
    return {
      key: 'capacity',
      label: 'Capacity Fit',
      points: 0,
      maxPoints,
      dataAvailable: true,
      status: 'insufficient',
      exceeds_capacity: true,
      estimated_servings: needed,
      available_capacity_servings: capacity,
      reason: null,
      warning: `Capacity exceeded: donation (~${needed} est. servings) exceeds NGO available capacity (${capacity} servings).`,
      missingFactor: null,
    };
  }

  const utilization = capacity > 0 ? needed / capacity : 1;
  // Optimal range (15% - 90% utilization) gets full points; tight fit (>90%) or very small batch (<15%) gets 80%
  const points =
    utilization >= 0.15 && utilization <= 0.9 ? maxPoints : Math.round(maxPoints * 0.8);

  return {
    key: 'capacity',
    label: 'Capacity Fit',
    points,
    maxPoints,
    dataAvailable: true,
    status: 'suitable',
    exceeds_capacity: false,
    estimated_servings: needed,
    available_capacity_servings: capacity,
    reason: `NGO capacity (${capacity} servings) can accommodate ~${needed} estimated servings (${Math.round(utilization * 100)}% utilization).`,
    warning: utilization > 0.9 ? 'Tight capacity fit (>90% of remaining NGO capacity).' : null,
    missingFactor: null,
  };
}

function evaluateUrgency(donation, ngo, maxPoints) {
  if (donation.remaining_minutes === null) {
    return {
      key: 'urgency',
      label: 'Urgency & Deadline',
      points: 0,
      maxPoints,
      dataAvailable: false,
      status: 'unknown',
      reason: null,
      warning: 'Pickup deadline not provided; urgency cannot be assessed.',
      missingFactor: 'pickup deadline',
    };
  }

  if (donation.is_expired) {
    return {
      key: 'urgency',
      label: 'Urgency & Deadline',
      points: 0,
      maxPoints,
      dataAvailable: true,
      status: 'expired',
      reason: null,
      warning: 'Pickup deadline has already passed.',
      missingFactor: null,
    };
  }

  const minsLeft = donation.remaining_minutes;
  const responseMins =
    typeof ngo.response_time_minutes === 'number' ? ngo.response_time_minutes : null;
  const canPickup = ngo.pickup_capable === true;

  if (minsLeft <= 120) {
    if (canPickup && responseMins !== null && responseMins <= minsLeft) {
      return {
        key: 'urgency',
        label: 'Urgency & Deadline',
        points: maxPoints,
        maxPoints,
        dataAvailable: true,
        status: 'urgent_ready',
        reason: `Urgent pickup (${minsLeft}m left) aligns with NGO's ~${responseMins}m pickup response.`,
        warning: null,
        missingFactor: null,
      };
    }
    return {
      key: 'urgency',
      label: 'Urgency & Deadline',
      points: Math.round(maxPoints * 0.2),
      maxPoints,
      dataAvailable: true,
      status: 'urgent_risk',
      reason: null,
      warning: `Urgent deadline (${minsLeft}m left) may be difficult given NGO pickup capability/response time${responseMins ? ` (~${responseMins}m)` : ''}.`,
      missingFactor: responseMins === null ? 'NGO response time' : null,
    };
  }

  if (minsLeft <= 360) {
    const pts = canPickup ? Math.round(maxPoints * 0.85) : Math.round(maxPoints * 0.45);
    return {
      key: 'urgency',
      label: 'Urgency & Deadline',
      points: pts,
      maxPoints,
      dataAvailable: true,
      status: 'moderate_window',
      reason: `Moderate pickup window (${Math.round(minsLeft / 60 * 10) / 10}h left) gives NGO adequate time to coordinate.`,
      warning: !canPickup ? 'NGO lacks active pickup transport for time-sensitive window.' : null,
      missingFactor: null,
    };
  }

  const pts = canPickup ? Math.round(maxPoints * 0.7) : Math.round(maxPoints * 0.4);
  return {
    key: 'urgency',
    label: 'Urgency & Deadline',
    points: pts,
    maxPoints,
    dataAvailable: true,
    status: 'flexible_window',
    reason: `Flexible pickup window (${Math.round(minsLeft / 60)}h+ left) allows scheduled collection.`,
    warning: null,
    missingFactor: null,
  };
}

function evaluateDietary(donation, ngo, maxPoints) {
  const ngoDietary = Array.isArray(ngo.accepted_dietary_types)
    ? ngo.accepted_dietary_types
    : [];
  const excludedAllergens = Array.isArray(ngo.excluded_allergens)
    ? ngo.excluded_allergens
    : [];

  if (!donation.dietary_type || ngoDietary.length === 0) {
    const missingWho = !donation.dietary_type
      ? 'donation dietary type'
      : 'NGO dietary preferences';
    return {
      key: 'dietary',
      label: 'Dietary & Allergens',
      points: 0,
      maxPoints,
      dataAvailable: false,
      status: 'unknown',
      reason: null,
      warning: `Missing ${missingWho}; dietary compatibility unverified.`,
      missingFactor: missingWho,
    };
  }

  if (!ngoDietary.includes(donation.dietary_type)) {
    return {
      key: 'dietary',
      label: 'Dietary & Allergens',
      points: 0,
      maxPoints,
      dataAvailable: true,
      status: 'mismatch',
      reason: null,
      warning: `Dietary mismatch: donation is "${donation.dietary_type.replace(/_/g, ' ')}", but NGO accepts [${ngoDietary.join(', ')}].`,
      missingFactor: null,
    };
  }

  // Check allergen conflicts if donation lists allergens
  if (donation.allergens && excludedAllergens.length > 0) {
    const allergenText = donation.allergens.toLowerCase();
    const conflicts = excludedAllergens.filter((a) =>
      allergenText.includes(a.toLowerCase())
    );
    if (conflicts.length > 0) {
      return {
        key: 'dietary',
        label: 'Dietary & Allergens',
        points: 0,
        maxPoints,
        dataAvailable: true,
        status: 'allergen_conflict',
        reason: null,
        warning: `Allergen conflict: donation notes "${donation.allergens}" which conflicts with NGO restriction (${conflicts.join(', ')}).`,
        missingFactor: null,
      };
    }
  }

  return {
    key: 'dietary',
    label: 'Dietary & Allergens',
    points: maxPoints,
    maxPoints,
    dataAvailable: true,
    status: 'compatible',
    reason: `Dietary type ("${donation.dietary_type.replace(/_/g, ' ')}") aligns with NGO requirements${donation.allergens ? ' with no allergen conflicts' : ''}.`,
    warning: null,
    missingFactor: null,
  };
}

function evaluatePickupReadiness(ngo, maxPoints) {
  if (!ngo.operational_status && typeof ngo.pickup_capable !== 'boolean') {
    return {
      key: 'readiness',
      label: 'Pickup Readiness',
      points: 0,
      maxPoints,
      dataAvailable: false,
      status: 'unknown',
      reason: null,
      warning: 'NGO operational status and pickup capability are unknown.',
      missingFactor: 'NGO pickup readiness',
    };
  }

  if (ngo.operational_status === 'paused') {
    return {
      key: 'readiness',
      label: 'Pickup Readiness',
      points: 0,
      maxPoints,
      dataAvailable: true,
      status: 'paused',
      reason: null,
      warning: 'NGO operations are currently paused.',
      missingFactor: null,
    };
  }

  if (ngo.operational_status === 'active' && ngo.pickup_capable === true) {
    return {
      key: 'readiness',
      label: 'Pickup Readiness',
      points: maxPoints,
      maxPoints,
      dataAvailable: true,
      status: 'ready',
      reason: `NGO is active with own pickup transport${ngo.operating_hours ? ` (${ngo.operating_hours})` : ''}.`,
      warning: null,
      missingFactor: null,
    };
  }

  if (ngo.operational_status === 'limited' && ngo.pickup_capable === true) {
    return {
      key: 'readiness',
      label: 'Pickup Readiness',
      points: Math.round(maxPoints * 0.6),
      maxPoints,
      dataAvailable: true,
      status: 'limited',
      reason: 'NGO is operating at limited capacity with pickup support.',
      warning: 'NGO pickup schedule is currently limited; confirm pickup slot.',
      missingFactor: null,
    };
  }

  return {
    key: 'readiness',
    label: 'Pickup Readiness',
    points: Math.round(maxPoints * 0.3),
    maxPoints,
    dataAvailable: true,
    status: 'dropoff_only',
    reason: null,
    warning: 'NGO does not have active pickup transport; donor drop-off or volunteer courier required.',
    missingFactor: null,
  };
}

/**
 * Score a single NGO against a normalized donation.
 */
function scoreNgoForDonation(donationInput, ngo, options = {}) {
  const now = options.now instanceof Date ? options.now : new Date();
  const weights = { ...MATCHING_WEIGHTS, ...(options.weights || {}) };
  const donation = normalizeDonation(donationInput, now);

  const factors = [
    evaluateCategory(donation, ngo, weights.categoryCompatibility),
    evaluateLocation(donation, ngo, weights.distanceLocation),
    evaluateCapacity(donation, ngo, weights.capacity),
    evaluateUrgency(donation, ngo, weights.urgency),
    evaluateDietary(donation, ngo, weights.dietaryCompatibility),
    evaluatePickupReadiness(ngo, weights.pickupReadiness),
  ];

  const rawPoints = factors.reduce((sum, f) => sum + f.points, 0);
  const totalPossiblePoints = factors.reduce((sum, f) => sum + f.maxPoints, 0);
  const knownMaxPoints = factors
    .filter((f) => f.dataAvailable)
    .reduce((sum, f) => sum + f.maxPoints, 0);

  // Normalized score across known factors (never awards points for unknown data)
  let score =
    knownMaxPoints > 0 ? Math.round((rawPoints / knownMaxPoints) * 100) : 0;

  // Hard penalty guardrails: if capacity is explicitly exceeded or food is expired,
  // cap score so unsuitable matches cannot appear as "Excellent Match"
  const capacityFactor = factors.find((f) => f.key === 'capacity');
  if (capacityFactor && capacityFactor.exceeds_capacity) {
    score = Math.min(score, 45);
  }
  if (donation.is_expired) {
    score = Math.min(score, 39);
  }

  const dataCompleteness =
    totalPossiblePoints > 0
      ? Math.round((knownMaxPoints / totalPossiblePoints) * 100)
      : 0;

  let confidenceLevel = 'High';
  if (dataCompleteness < 60) confidenceLevel = 'Low';
  else if (dataCompleteness < 85) confidenceLevel = 'Moderate';

  const tierInfo = getTierForScore(score);

  const positiveReasons = factors
    .map((f) => f.reason)
    .filter(Boolean);

  const warnings = factors
    .map((f) => f.warning)
    .filter(Boolean);

  const missingFactors = [
    ...new Set(factors.map((f) => f.missingFactor).filter(Boolean)),
  ];

  const locationFactor = factors.find((f) => f.key === 'location');
  const dietaryFactor = factors.find((f) => f.key === 'dietary');
  const categoryFactor = factors.find((f) => f.key === 'category');
  const urgencyFactor = factors.find((f) => f.key === 'urgency');
  const readinessFactor = factors.find((f) => f.key === 'readiness');

  return {
    ngo_id: ngo.id,
    ngo_name: ngo.name,
    organization_type: ngo.organization_type || 'NGO',
    is_demo: Boolean(ngo.is_demo),
    demo_label: ngo.demo_label || (ngo.is_demo ? 'Demo Profile' : null),
    score,
    raw_score: rawPoints,
    known_max_points: knownMaxPoints,
    total_weight: totalPossiblePoints,
    data_completeness: dataCompleteness,
    confidence_level: confidenceLevel,
    recommendation_label: tierInfo.label,
    recommendation_tier: tierInfo.tier,
    score_disclaimer:
      'Compatibility ranking based on available profile criteria; not a guarantee of pickup or food safety certification.',
    assessments: {
      category_compatibility: categoryFactor.status,
      capacity_suitability: capacityFactor.status,
      exceeds_capacity: Boolean(capacityFactor.exceeds_capacity),
      estimated_servings: capacityFactor.estimated_servings,
      available_capacity_servings: capacityFactor.available_capacity_servings,
      location_assessment: locationFactor.status,
      location_mode: locationFactor.mode,
      distance_km: locationFactor.distance_km,
      urgency_assessment: urgencyFactor.status,
      dietary_compatibility: dietaryFactor.status,
      pickup_readiness: readinessFactor.status,
    },
    factor_breakdown: factors.map((f) => ({
      key: f.key,
      label: f.label,
      points: f.points,
      max_points: f.maxPoints,
      data_available: f.dataAvailable,
      status: f.status,
    })),
    positive_reasons: positiveReasons,
    warnings,
    missing_factors: missingFactors,
    ngo_profile: {
      location_text: ngo.location_text || null,
      accepted_categories: ngo.accepted_categories || [],
      accepted_dietary_types: ngo.accepted_dietary_types || [],
      pickup_capable: Boolean(ngo.pickup_capable),
      operational_status: ngo.operational_status || 'unknown',
      operating_hours: ngo.operating_hours || null,
      contact_note: ngo.contact_note || null,
    },
  };
}

/**
 * Rank all NGOs for a single donation deterministically.
 */
function rankNgosForDonation(donation, ngos, options = {}) {
  if (!Array.isArray(ngos) || ngos.length === 0) {
    return [];
  }

  const results = ngos.map((ngo) => scoreNgoForDonation(donation, ngo, options));

  results.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.data_completeness !== a.data_completeness) {
      return b.data_completeness - a.data_completeness;
    }
    return String(a.ngo_id).localeCompare(String(b.ngo_id));
  });

  return results;
}

module.exports = {
  calculateDistanceKm,
  normalizeDonation,
  scoreNgoForDonation,
  rankNgosForDonation,
};

