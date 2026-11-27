/**
 * Configurable weights and thresholds for the FoodLoop Intelligent NGO Matching Engine.
 * Total weight across all 6 factors equals 100 points.
 */

const MATCHING_WEIGHTS = {
  categoryCompatibility: 25,
  distanceLocation: 20,
  capacity: 20,
  urgency: 15,
  dietaryCompatibility: 10,
  pickupReadiness: 10,
};

const MATCH_TIERS = [
  { minScore: 80, label: 'Excellent Match', tier: 'excellent' },
  { minScore: 60, label: 'Good Match', tier: 'good' },
  { minScore: 40, label: 'Possible Match', tier: 'possible' },
  { minScore: 0, label: 'Low Match', tier: 'low' },
];

/**
 * Estimated servings multipliers per unit for capacity comparison.
 * These are operational approximations, not exact nutritional measurements.
 */
const UNIT_TO_SERVINGS = {
  servings: 1,
  serving: 1,
  plates: 1,
  plate: 1,
  pieces: 1,
  piece: 1,
  packets: 1,
  packet: 1,
  apples: 1,
  trays: 8,
  tray: 8,
  boxes: 4,
  box: 4,
  kg: 3,
};

const DISTANCE_THRESHOLDS_KM = [
  { maxKm: 3, ratio: 1.0 },
  { maxKm: 7, ratio: 0.8 },
  { maxKm: 15, ratio: 0.55 },
  { maxKm: 25, ratio: 0.3 },
];

module.exports = {
  MATCHING_WEIGHTS,
  MATCH_TIERS,
  UNIT_TO_SERVINGS,
  DISTANCE_THRESHOLDS_KM,
};

