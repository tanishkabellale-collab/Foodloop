const test = require('node:test');
const assert = require('node:assert/strict');
const {
  scoreNgoForDonation,
  rankNgosForDonation,
} = require('../services/matchingService');

const FIXED_NOW = new Date('2026-10-28T12:00:00.000Z');

const baseNgo = {
  id: 'ngo-perfect',
  name: 'Annapurna Community Kitchen',
  organization_type: 'Community Kitchen',
  is_demo: true,
  accepted_categories: ['cooked_meals', 'fresh_produce'],
  accepted_dietary_types: ['vegetarian'],
  excluded_allergens: ['peanuts'],
  available_capacity_servings: 100,
  location_text: 'Tathwade, Pune',
  service_areas: ['Tathwade', 'Wakad'],
  latitude: 18.6208,
  longitude: 73.747,
  pickup_capable: true,
  operational_status: 'active',
  response_time_minutes: 30,
};

const baseDonation = {
  id: 'don-1',
  title: 'Veg Thali Surplus',
  food_category: 'cooked_meals',
  dietary_type: 'vegetarian',
  quantity: 40,
  quantity_unit: 'plates',
  address_text: 'JSPM RSCOE, Tathwade, Pune',
  latitude: 18.621,
  longitude: 73.748,
  pickup_available_until: '2026-10-28T13:30:00.000Z', // 90 mins from FIXED_NOW (urgent)
  allergens: null,
  status: 'submitted',
};

test('1. Perfect match yields Excellent Match (score >= 90) and 100% completeness', () => {
  const result = scoreNgoForDonation(baseDonation, baseNgo, { now: FIXED_NOW });
  assert.ok(result.score >= 90, `Expected >= 90, got ${result.score}`);
  assert.equal(result.recommendation_label, 'Excellent Match');
  assert.equal(result.data_completeness, 100);
  assert.equal(result.missing_factors.length, 0);
  assert.equal(result.assessments.category_compatibility, 'matched');
  assert.equal(result.assessments.capacity_suitability, 'suitable');
  assert.equal(result.assessments.location_mode, 'coordinates');
  assert.ok(result.assessments.distance_km < 1);
});

test('2. Category mismatch awards 0 category points and includes clear warning', () => {
  const bakeryDonation = { ...baseDonation, food_category: 'bakery' };
  const result = scoreNgoForDonation(bakeryDonation, baseNgo, { now: FIXED_NOW });
  const catFactor = result.factor_breakdown.find((f) => f.key === 'category');
  assert.equal(catFactor.points, 0);
  assert.equal(result.assessments.category_compatibility, 'mismatch');
  assert.ok(result.warnings.some((w) => w.includes('Category mismatch')));
});

test('3. Capacity insufficiency penalizes and caps score, never recommending as Excellent', () => {
  const hugeDonation = { ...baseDonation, quantity: 20, quantity_unit: 'trays' }; // 20 * 8 = 160 servings > 100
  const result = scoreNgoForDonation(hugeDonation, baseNgo, { now: FIXED_NOW });
  assert.equal(result.assessments.exceeds_capacity, true);
  assert.equal(result.assessments.capacity_suitability, 'insufficient');
  assert.ok(result.score <= 45, `Expected capped score <= 45, got ${result.score}`);
  assert.notEqual(result.recommendation_label, 'Excellent Match');
  assert.ok(result.warnings.some((w) => w.includes('Capacity exceeded')));
});

test('4. Missing coordinates uses text_fallback without fabricating distance_km', () => {
  const noCoordsDonation = { ...baseDonation, latitude: null, longitude: null };
  const noCoordsNgo = { ...baseNgo, latitude: null, longitude: null };
  const result = scoreNgoForDonation(noCoordsDonation, noCoordsNgo, { now: FIXED_NOW });
  assert.equal(result.assessments.location_mode, 'text_fallback');
  assert.equal(result.assessments.distance_km, null);
  assert.equal(result.assessments.location_assessment, 'area_match');
  assert.ok(result.positive_reasons.some((r) => r.includes('Location fallback')));
});

test('5. Missing capacity normalizes score across known factors and discloses missing factor', () => {
  const unknownCapNgo = { ...baseNgo, available_capacity_servings: null };
  const result = scoreNgoForDonation(baseDonation, unknownCapNgo, { now: FIXED_NOW });
  const capFactor = result.factor_breakdown.find((f) => f.key === 'capacity');
  assert.equal(capFactor.data_available, false);
  assert.equal(capFactor.points, 0);
  assert.equal(result.known_max_points, 80);
  assert.equal(result.data_completeness, 80);
  assert.ok(result.missing_factors.includes('NGO available capacity'));
  assert.ok(result.warnings.some((w) => w.includes('Missing NGO available capacity')));
});

test('6. Urgency penalizes slow or expired pickups', () => {
  const slowNgo = { ...baseNgo, response_time_minutes: 150 };
  const urgentResult = scoreNgoForDonation(baseDonation, slowNgo, { now: FIXED_NOW });
  assert.equal(urgentResult.assessments.urgency_assessment, 'urgent_risk');
  assert.ok(urgentResult.warnings.some((w) => w.includes('Urgent deadline')));

  const expiredDonation = {
    ...baseDonation,
    pickup_available_until: '2026-10-28T11:00:00.000Z',
  };
  const expiredResult = scoreNgoForDonation(expiredDonation, baseNgo, { now: FIXED_NOW });
  assert.equal(expiredResult.assessments.urgency_assessment, 'expired');
  assert.ok(expiredResult.score <= 39);
});

test('7. Dietary mismatch and allergen conflict are penalized and explained', () => {
  const nonVegDonation = { ...baseDonation, dietary_type: 'non_vegetarian' };
  const nonVegResult = scoreNgoForDonation(nonVegDonation, baseNgo, { now: FIXED_NOW });
  assert.equal(nonVegResult.assessments.dietary_compatibility, 'mismatch');
  assert.ok(nonVegResult.warnings.some((w) => w.includes('Dietary mismatch')));

  const peanutDonation = { ...baseDonation, allergens: 'Contains peanuts and sesame' };
  const allergenResult = scoreNgoForDonation(peanutDonation, baseNgo, { now: FIXED_NOW });
  assert.equal(allergenResult.assessments.dietary_compatibility, 'allergen_conflict');
  assert.ok(allergenResult.warnings.some((w) => w.includes('Allergen conflict')));
});

test('8. Deterministic ranking produces identical scores and order on repeated runs', () => {
  const ngos = [
    { ...baseNgo, id: 'ngo-b', available_capacity_servings: 20 }, // capacity exceeded
    baseNgo,
    { ...baseNgo, id: 'ngo-c', accepted_categories: ['bakery'] }, // category mismatch
  ];
  const run1 = rankNgosForDonation(baseDonation, ngos, { now: FIXED_NOW });
  const run2 = rankNgosForDonation(baseDonation, ngos, { now: FIXED_NOW });
  assert.deepEqual(run1, run2);
  assert.equal(run1[0].ngo_id, 'ngo-perfect');
});

