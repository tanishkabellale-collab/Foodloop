const test = require('node:test');
const assert = require('node:assert/strict');
const sharp = require('sharp');
const {
  assessFoodImage,
  SAFETY_DISCLAIMER,
} = require('../services/aiAssessmentService');

async function createSampleJpegBuffer() {
  return sharp({
    create: {
      width: 120,
      height: 90,
      channels: 3,
      background: { r: 220, g: 120, b: 60 },
    },
  })
    .jpeg()
    .toBuffer();
}

test('1. Rejects empty buffer with INVALID_IMAGE', async () => {
  await assert.rejects(
    () => assessFoodImage(Buffer.alloc(0), 'cooked_meals', { apiKey: '' }),
    (err) => err.code === 'INVALID_IMAGE'
  );
});

test('2. Rejects unsupported MIME type with INVALID_IMAGE', async () => {
  const buf = await createSampleJpegBuffer();
  await assert.rejects(
    () => assessFoodImage(buf, 'cooked_meals', { mimeType: 'application/pdf', apiKey: '' }),
    (err) => err.code === 'INVALID_IMAGE'
  );
});

test('3. Rejects oversized image (> 5 MB) with INVALID_IMAGE', async () => {
  const oversized = Buffer.alloc(5 * 1024 * 1024 + 10, 1);
  await assert.rejects(
    () => assessFoodImage(oversized, 'cooked_meals', { mimeType: 'image/jpeg', apiKey: '' }),
    (err) => err.code === 'INVALID_IMAGE'
  );
});

test('4. Uses clearly labeled Demo/Fallback mode when GEMINI_API_KEY is missing', async () => {
  const buf = await createSampleJpegBuffer();
  const result = await assessFoodImage(buf, 'cooked_meals', {
    mimeType: 'image/jpeg',
    apiKey: '',
  });

  assert.equal(result.assessment_status, 'completed');
  assert.equal(result.assessment_mode, 'demo_fallback');
  assert.equal(result.is_demo_fallback, true);
  assert.equal(result.confidence_score, null);
  assert.equal(result.human_review_recommended, true);
  assert.ok(result.possible_food_description.includes('Demo/Fallback'));
  assert.ok(result.missing_information.length > 0);
  assert.equal(result.safety_disclaimer, SAFETY_DISCLAIMER);
});

test('5. Live Gemini Vision mode parses structured observations safely', async () => {
  const buf = await createSampleJpegBuffer();
  const mockFetch = async () => ({
    ok: true,
    json: async () => ({
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify({
                  suggested_food_category: 'cooked_meals',
                  possible_food_description: 'Appears to be covered trays of rice and curry.',
                  packaging_condition_observations: ['Covered foil trays visible'],
                  suggested_dietary_labels: ['Appears vegetarian (unverified)'],
                  missing_information: ['Preparation time and holding temperature'],
                  confidence_level: 'high',
                  confidence_score: 0.86,
                  human_review_recommended: true,
                  human_review_reason: 'Prepared meals require temperature & time verification.',
                }),
              },
            ],
          },
        },
      ],
    }),
  });

  const result = await assessFoodImage(buf, 'cooked_meals', {
    mimeType: 'image/jpeg',
    apiKey: 'test-key-not-real',
    model: 'gemini-2.5-flash',
    fetchImpl: mockFetch,
  });

  assert.equal(result.assessment_status, 'completed');
  assert.equal(result.assessment_mode, 'live_vision_ai');
  assert.equal(result.is_demo_fallback, false);
  assert.equal(result.model_version, 'gemini-2.5-flash');
  assert.equal(result.suggested_food_category, 'cooked_meals');
  assert.equal(result.confidence_level, 'high');
  assert.equal(result.confidence_score, 0.86);
  assert.equal(result.human_review_recommended, true);
  assert.equal(result.safety_disclaimer, SAFETY_DISCLAIMER);
});

test('6. Handles AI provider HTTP errors and timeouts gracefully', async () => {
  const buf = await createSampleJpegBuffer();

  await assert.rejects(
    () =>
      assessFoodImage(buf, 'bakery', {
        mimeType: 'image/jpeg',
        apiKey: 'test-key-not-real',
        fetchImpl: async () => ({
          ok: false,
          status: 500,
          text: async () => 'Upstream error',
        }),
      }),
    (err) => err.code === 'AI_PROVIDER_ERROR'
  );

  await assert.rejects(
    () =>
      assessFoodImage(buf, 'bakery', {
        mimeType: 'image/jpeg',
        apiKey: 'test-key-not-real',
        fetchImpl: async () => {
          const e = new Error('The operation was aborted due to timeout');
          e.name = 'TimeoutError';
          throw e;
        },
      }),
    (err) => err.code === 'AI_TIMEOUT'
  );
});
