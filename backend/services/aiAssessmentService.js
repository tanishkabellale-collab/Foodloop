/**
 * FoodLoop AI-Assisted Food Image Assessment Service
 *
 * Uses Google Gemini Vision API (gemini-2.5-flash by default) via official REST API
 * when GEMINI_API_KEY is configured in environment variables.
 *
 * When GEMINI_API_KEY is unavailable, runs in an explicit DEMO/FALLBACK mode that
 * inspects only basic image metadata and clearly discloses that no real AI model
 * analyzed the image.
 *
 * IMPORTANT GUARDRAIL:
 * AI image assessment observes visible characteristics only. It MUST NOT certify
 * food safety, freshness, edibility, expiry, contamination, or suitability for
 * consumption. Human verification is always required.
 */

let sharp = null;
try {
  sharp = require('sharp');
} catch (e) {
  sharp = null;
}

const DEFAULT_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const DEFAULT_TIMEOUT_MS = parseInt(process.env.AI_ASSESSMENT_TIMEOUT_MS, 10) || 15000;

const SAFETY_DISCLAIMER =
  'AI image assessment observes visible characteristics only. It does NOT certify food safety, freshness, edibility, expiry, absence of contamination, or suitability for consumption. Human verification is required.';

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]);

const VALID_CATEGORIES = new Set([
  'cooked_meals',
  'fresh_produce',
  'bakery',
  'packaged_sealed',
  'uncertain',
]);

/**
 * Validate raw image buffer and extract basic metadata if sharp is available.
 */
async function validateAndInspectImage(imageBuffer, mimeType = 'image/jpeg') {
  if (!Buffer.isBuffer(imageBuffer) || imageBuffer.length === 0) {
    const err = new Error('No image buffer provided for assessment.');
    err.code = 'INVALID_IMAGE';
    throw err;
  }

  if (imageBuffer.length > 5 * 1024 * 1024) {
    const err = new Error('Image exceeds maximum allowed size of 5 MB.');
    err.code = 'INVALID_IMAGE';
    throw err;
  }

  const normalizedMime = (mimeType || 'image/jpeg').toLowerCase();
  if (!ALLOWED_MIME_TYPES.has(normalizedMime)) {
    const err = new Error('Unsupported image format. Only JPG, PNG, and WebP are allowed.');
    err.code = 'INVALID_IMAGE';
    throw err;
  }

  let metadata = { width: null, height: null, format: normalizedMime.replace('image/', '') };
  if (sharp) {
    try {
      const info = await sharp(imageBuffer).metadata();
      if (!info || !info.width || !info.height) {
        const err = new Error('Unable to read image dimensions. File may be corrupted.');
        err.code = 'INVALID_IMAGE';
        throw err;
      }
      metadata = {
        width: info.width,
        height: info.height,
        format: info.format || metadata.format,
      };
    } catch (err) {
      if (err.code === 'INVALID_IMAGE') throw err;
      const invalidErr = new Error('Invalid or corrupted image file.');
      invalidErr.code = 'INVALID_IMAGE';
      throw invalidErr;
    }
  }

  return {
    mimeType: normalizedMime === 'image/jpg' ? 'image/jpeg' : normalizedMime,
    sizeBytes: imageBuffer.length,
    ...metadata,
  };
}

/**
 * Build a clearly labeled DEMO/FALLBACK assessment when no API key is configured.
 * Never pretends a real AI model analyzed the image.
 */
function buildDemoFallbackAssessment(foodCategory, imageMeta) {
  const category = VALID_CATEGORIES.has(foodCategory) ? foodCategory : 'uncertain';
  const dimText =
    imageMeta.width && imageMeta.height
      ? `${imageMeta.width}x${imageMeta.height}px`
      : 'unknown dimensions';
  const sizeKb = Math.max(1, Math.round((imageMeta.sizeBytes || 0) / 1024));

  const categoryMissingMap = {
    cooked_meals: [
      'Preparation time and current holding temperature',
      'Ingredient and allergen disclosures',
      'Whether containers are sealed or covered',
    ],
    fresh_produce: [
      'Approximate weight or serving count',
      'Storage conditions since harvest/purchase',
      'Any bruising or spoilage not visible from this angle',
    ],
    bakery: [
      'Bake date / best-before timeframe',
      'Allergen details (gluten, dairy, nuts, eggs)',
      'Packaging seal status',
    ],
    packaged_sealed: [
      'Printed best-before / expiry date',
      'Verification that factory seals are intact',
      'Storage temperature requirements',
    ],
    uncertain: [
      'Food category selection',
      'Preparation/expiry date and storage condition',
      'Allergen and dietary information',
    ],
  };

  return {
    assessment_status: 'completed',
    assessment_mode: 'demo_fallback',
    is_demo_fallback: true,
    model_version: 'demo-fallback-v1',
    food_category: foodCategory || 'unspecified',
    suggested_food_category: category,
    possible_food_description: `Demo/Fallback mode: Uploaded ${String(imageMeta.format || 'image').toUpperCase()} (${dimText}, ${sizeKb} KB) received. No live vision AI model analyzed the photo contents.`,
    packaging_condition_observations: [
      'Image file validated locally; visual packaging and surface details were not inspected by AI because GEMINI_API_KEY is not configured.',
      'Manual inspection of container integrity and visible condition is required.',
    ],
    suggested_dietary_labels: [],
    missing_information: categoryMissingMap[category] || categoryMissingMap.uncertain,
    confidence_level: 'low',
    confidence_score: null,
    human_review_recommended: true,
    human_review_reason:
      'Running in Demo/Fallback mode without a live vision AI key. A human reviewer or NGO coordinator must inspect the photo and details.',
    safety_disclaimer: SAFETY_DISCLAIMER,
    disclaimer: SAFETY_DISCLAIMER,
  };
}

/**
 * Build the structured prompt for Gemini Vision.
 */
function buildVisionPrompt(foodCategory) {
  return `You are assisting FoodLoop, a surplus food rescue platform. Analyze ONLY the visible characteristics of this food donation photograph.
Donor-selected category (for context, verify visually): "${foodCategory || 'unspecified'}".

CRITICAL RULES:
1. Do NOT certify food safety, freshness, edibility, expiry, absence of pathogens/contamination, or suitability for consumption.
2. Use cautious, observational language ("appears to be", "visible container", "cannot be determined from photo").
3. Suggest dietary labels ONLY when reasonably inferable from visible items (otherwise return an empty array).
4. List important information that cannot be seen in the photo and must be provided by the donor.
5. Set human_review_recommended to true whenever food appears unpackaged, mixed/unclear, potentially perishable, or low-confidence.

Respond ONLY with valid JSON matching this exact schema:
{
  "suggested_food_category": "cooked_meals" | "fresh_produce" | "bakery" | "packaged_sealed" | "uncertain",
  "possible_food_description": "short cautious description of visible food items",
  "packaging_condition_observations": ["observation 1", "observation 2"],
  "suggested_dietary_labels": ["e.g. Appears vegetarian (unverified)"],
  "missing_information": ["missing detail 1", "missing detail 2"],
  "confidence_level": "high" | "medium" | "low",
  "confidence_score": 0.0 to 1.0,
  "human_review_recommended": true | false,
  "human_review_reason": "short explanation"
}`;
}

/**
 * Call Gemini Vision REST API and parse structured JSON response.
 */
async function callGeminiVision(imageBuffer, mimeType, foodCategory, options = {}) {
  const apiKey = options.apiKey !== undefined ? options.apiKey : process.env.GEMINI_API_KEY;
  const model = options.model || process.env.GEMINI_MODEL || DEFAULT_MODEL;
  const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;
  const fetchFn = options.fetchImpl || globalThis.fetch;

  if (typeof fetchFn !== 'function') {
    const err = new Error('Fetch API is unavailable in this Node runtime.');
    err.code = 'AI_PROVIDER_ERROR';
    throw err;
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model
  )}:generateContent`;

  const payload = {
    contents: [
      {
        parts: [
          {
            inlineData: {
              mimeType,
              data: imageBuffer.toString('base64'),
            },
          },
          {
            text: buildVisionPrompt(foodCategory),
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.2,
      responseMimeType: 'application/json',
    },
  };

  let response;
  try {
    response = await fetchFn(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    const isTimeout = err.name === 'TimeoutError' || err.name === 'AbortError';
    const wrapped = new Error(
      isTimeout
        ? `AI vision request timed out after ${timeoutMs}ms.`
        : `AI vision network error: ${err.message}`
    );
    wrapped.code = isTimeout ? 'AI_TIMEOUT' : 'AI_PROVIDER_ERROR';
    throw wrapped;
  }

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    const err = new Error(
      `AI vision provider returned HTTP ${response.status}${errText ? `: ${errText.slice(0, 180)}` : ''}`
    );
    err.code = 'AI_PROVIDER_ERROR';
    throw err;
  }

  const data = await response.json();
  const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) {
    const err = new Error('AI vision provider returned an empty response.');
    err.code = 'AI_PROVIDER_ERROR';
    throw err;
  }

  let parsed;
  try {
    const cleaned = rawText.replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
    parsed = JSON.parse(cleaned);
  } catch (parseErr) {
    const err = new Error('AI vision provider returned invalid JSON.');
    err.code = 'AI_PROVIDER_ERROR';
    throw err;
  }

  const suggestedCat = VALID_CATEGORIES.has(parsed.suggested_food_category)
    ? parsed.suggested_food_category
    : 'uncertain';
  const confLevel = ['high', 'medium', 'low'].includes(parsed.confidence_level)
    ? parsed.confidence_level
    : 'medium';
  const confScore =
    typeof parsed.confidence_score === 'number' &&
    parsed.confidence_score >= 0 &&
    parsed.confidence_score <= 1
      ? Math.round(parsed.confidence_score * 100) / 100
      : confLevel === 'high'
      ? 0.85
      : confLevel === 'medium'
      ? 0.65
      : 0.35;

  return {
    assessment_status: 'completed',
    assessment_mode: 'live_vision_ai',
    is_demo_fallback: false,
    model_version: model,
    food_category: foodCategory || 'unspecified',
    suggested_food_category: suggestedCat,
    possible_food_description:
      typeof parsed.possible_food_description === 'string' && parsed.possible_food_description.trim()
        ? parsed.possible_food_description.trim()
        : 'Visible food items observed; see packaging and missing details below.',
    packaging_condition_observations: Array.isArray(parsed.packaging_condition_observations)
      ? parsed.packaging_condition_observations.slice(0, 6).map(String)
      : [],
    suggested_dietary_labels: Array.isArray(parsed.suggested_dietary_labels)
      ? parsed.suggested_dietary_labels.slice(0, 5).map(String)
      : [],
    missing_information: Array.isArray(parsed.missing_information)
      ? parsed.missing_information.slice(0, 6).map(String)
      : [],
    confidence_level: confLevel,
    confidence_score: confScore,
    human_review_recommended:
      typeof parsed.human_review_recommended === 'boolean'
        ? parsed.human_review_recommended
        : true,
    human_review_reason:
      typeof parsed.human_review_reason === 'string' && parsed.human_review_reason.trim()
        ? parsed.human_review_reason.trim()
        : 'Human verification is recommended before final NGO dispatch.',
    safety_disclaimer: SAFETY_DISCLAIMER,
    disclaimer: SAFETY_DISCLAIMER,
  };
}

/**
 * Assess a food donation image using Gemini Vision API when configured,
 * or clearly labeled Demo/Fallback mode when no API key is available.
 *
 * @param {Buffer} imageBuffer
 * @param {string} foodCategory
 * @param {Object} options - Optional overrides ({ mimeType, apiKey, model, timeoutMs, fetchImpl })
 */
async function assessFoodImage(imageBuffer, foodCategory, options = {}) {
  const imageMeta = await validateAndInspectImage(imageBuffer, options.mimeType);
  const apiKey = options.apiKey !== undefined ? options.apiKey : process.env.GEMINI_API_KEY;

  if (!apiKey || !String(apiKey).trim()) {
    return buildDemoFallbackAssessment(foodCategory, imageMeta);
  }

  return callGeminiVision(imageBuffer, imageMeta.mimeType, foodCategory, options);
}

module.exports = {
  assessFoodImage,
  validateAndInspectImage,
  buildDemoFallbackAssessment,
  SAFETY_DISCLAIMER,
  DEFAULT_MODEL,
};
