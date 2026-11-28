/**
 * FoodLoop Hybrid AI Visual Assessment Service
 *
 * Combines two complementary engines cleanly:
 * 1. Local ResNet-18 ONNX Model (`experiments/task-002a/clean_eval/checkpoints/resnet18_foodloop.onnx`):
 *    Runs CPU inference natively in Node.js for validated `fresh_produce` images
 *    (apples, bananas, oranges), even offline with zero external API keys.
 * 2. Google Gemini Vision API (`gemini-2.5-flash`):
 *    When `GEMINI_API_KEY` is set, provides multi-category visual observations,
 *    packaging inspection, dietary hints, and missing-information checklists.
 * 3. Honest Demo/Fallback Mode:
 *    When neither Gemini API key nor a validated local model applies, explicitly
 *    discloses that no vision AI model analyzed the image.
 *
 * Also performs sharp-based magic/dimension verification & EXIF metadata stripping.
 *
 * IMPORTANT GUARDRAIL:
 * AI visual assessment observes visible characteristics only. It MUST NOT certify
 * food safety, freshness, edibility, expiry, contamination, or suitability for
 * consumption. Human verification is always required.
 */

const fs = require('fs');
const path = require('path');

let sharp = null;
try {
  sharp = require('sharp');
} catch {
  sharp = null;
}

let ort = null;
try {
  ort = require('onnxruntime-node');
} catch {
  ort = null;
}

const ONNX_MODEL_PATH = path.resolve(
  __dirname,
  '../../experiments/task-002a/clean_eval/checkpoints/resnet18_foodloop.onnx'
);
const ONNX_MODEL_VERSION = 'resnet18_v1.0.0_foodloop';
const ONNX_THRESHOLD = 0.5;

const DEFAULT_MODEL = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
const GEMINI_FALLBACK_MODELS = ['gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3.1-flash-lite'];
const DEFAULT_GROQ_MODEL = process.env.GROQ_VISION_MODEL || 'qwen/qwen3.8-27b';
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

let onnxSession = null;
let onnxSessionPromise = null;

async function getOnnxSession() {
  if (onnxSession) return onnxSession;
  if (!ort || !sharp || !fs.existsSync(ONNX_MODEL_PATH)) {
    return null;
  }
  if (!onnxSessionPromise) {
    onnxSessionPromise = ort.InferenceSession.create(ONNX_MODEL_PATH, {
      executionProviders: ['cpu'],
    })
      .then((sess) => {
        onnxSession = sess;
        return sess;
      })
      .catch((err) => {
        onnxSessionPromise = null;
        console.warn('[AI Assessment] ONNX ResNet-18 session load warning:', err.message);
        return null;
      });
  }
  return onnxSessionPromise;
}

/**
 * Strip EXIF metadata (GPS coordinates, device tags) from uploaded images before disk storage.
 */
async function stripExifMetadata(filePath) {
  if (!sharp || !filePath || !fs.existsSync(filePath)) return false;
  try {
    const input = fs.readFileSync(filePath);
    const meta = await sharp(input).metadata();
    let pipeline = sharp(input).rotate();
    if (meta.format === 'png') {
      pipeline = pipeline.png();
    } else if (meta.format === 'webp') {
      pipeline = pipeline.webp({ quality: 88 });
    } else {
      pipeline = pipeline.jpeg({ quality: 88 });
    }
    const cleanBuf = await pipeline.toBuffer();
    fs.writeFileSync(filePath, cleanBuf);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate raw image buffer and extract dimensions/magic format via sharp.
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
 * Preprocess buffer to exact ResNet-18 ONNX contract:
 * Resize shortest edge to 256 -> CenterCrop 224x224 -> RGB [0,1] -> ImageNet normalize -> CHW Float32.
 */
async function preprocessForOnnx(imageBuffer) {
  const image = sharp(imageBuffer);
  const { width, height } = await image.metadata();
  if (!width || !height) {
    throw new Error('Cannot read image dimensions for ONNX preprocessing.');
  }

  let targetWidth, targetHeight;
  if (width < height) {
    targetWidth = 256;
    targetHeight = Math.round(height * (256 / width));
  } else {
    targetHeight = 256;
    targetWidth = Math.round(width * (256 / height));
  }

  const cropLeft = Math.max(0, Math.floor((targetWidth - 224) / 2));
  const cropTop = Math.max(0, Math.floor((targetHeight - 224) / 2));

  const rawRgb = await image
    .rotate()
    .resize(targetWidth, targetHeight, { fit: 'fill' })
    .extract({ left: cropLeft, top: cropTop, width: 224, height: 224 })
    .toColorspace('srgb')
    .raw()
    .toBuffer();

  const numPixels = 224 * 224;
  const floatData = new Float32Array(3 * numPixels);
  const mean = [0.485, 0.456, 0.406];
  const std = [0.229, 0.224, 0.225];

  for (let i = 0; i < numPixels; i++) {
    const r = rawRgb[i * 3] / 255.0;
    const g = rawRgb[i * 3 + 1] / 255.0;
    const b = rawRgb[i * 3 + 2] / 255.0;
    floatData[i] = (r - mean[0]) / std[0];
    floatData[numPixels + i] = (g - mean[1]) / std[1];
    floatData[numPixels * 2 + i] = (b - mean[2]) / std[2];
  }
  return floatData;
}

/**
 * Run validated local ResNet-18 ONNX screening for `fresh_produce` images.
 */
async function runOnnxProduceScreening(imageBuffer) {
  const sess = await getOnnxSession();
  if (!sess) return null;

  try {
    const inputData = await preprocessForOnnx(imageBuffer);
    const tensor = new ort.Tensor('float32', inputData, [1, 3, 224, 224]);
    const results = await sess.run({ input: tensor });
    const logits = results.logits.data;

    const z0 = logits[0];
    const z1 = logits[1];
    const maxZ = Math.max(z0, z1);
    const exp0 = Math.exp(z0 - maxZ);
    const exp1 = Math.exp(z1 - maxZ);
    const sumExp = exp0 + exp1;

    const probFresh = exp0 / sumExp;
    const probRotten = exp1 / sumExp;
    const isUnsuitable = probRotten >= ONNX_THRESHOLD;
    const predictedClass = isUnsuitable ? 1 : 0;
    const visualLabel = isUnsuitable ? 'visually_unsuitable' : 'visually_acceptable';
    const confidence = isUnsuitable ? probRotten : probFresh;

    return {
      predicted_class: predictedClass,
      visual_assessment_label: visualLabel,
      confidence_score: Math.round(confidence * 10000) / 10000,
      probability_fresh: Math.round(probFresh * 10000) / 10000,
      probability_rotten: Math.round(probRotten * 10000) / 10000,
      threshold_applied: ONNX_THRESHOLD,
      model_version: ONNX_MODEL_VERSION,
      validated_scope: 'Raw fresh produce visual surface appearance (apples, bananas, oranges)',
    };
  } catch (err) {
    console.warn('[AI Assessment] ONNX inference skipped due to error:', err.message);
    return null;
  }
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
 * Format local ONNX ResNet-18 output into unified assessment schema for fresh produce.
 */
function buildLocalOnnxProduceAssessment(foodCategory, imageMeta, onnxResult) {
  const isUnsuitable = onnxResult.visual_assessment_label === 'visually_unsuitable';
  const confPct = Math.round(onnxResult.confidence_score * 100);
  const confLevel =
    onnxResult.confidence_score >= 0.8
      ? 'high'
      : onnxResult.confidence_score >= 0.6
      ? 'medium'
      : 'low';

  return {
    assessment_status: 'completed',
    assessment_mode: 'local_onnx_produce',
    is_demo_fallback: false,
    model_version: onnxResult.model_version,
    food_category: foodCategory || 'fresh_produce',
    suggested_food_category: 'fresh_produce',
    predicted_class: onnxResult.predicted_class,
    visual_assessment_label: onnxResult.visual_assessment_label,
    probability_fresh: onnxResult.probability_fresh,
    probability_rotten: onnxResult.probability_rotten,
    threshold_applied: onnxResult.threshold_applied,
    onnx_produce_screening: onnxResult,
    possible_food_description: isUnsuitable
      ? `Local ResNet-18 produce classifier detected signs of visible surface deterioration (${confPct}% confidence) on ${imageMeta.width || '?'}x${imageMeta.height || '?'}px image.`
      : `Local ResNet-18 produce classifier observed visually acceptable surface appearance (${confPct}% confidence).`,
    packaging_condition_observations: [
      `On-device ONNX triage (${onnxResult.model_version}): ${onnxResult.visual_assessment_label.replace(/_/g, ' ')}.`,
      `Surface scores — fresh appearance: ${Math.round(onnxResult.probability_fresh * 100)}%, deterioration signals: ${Math.round(onnxResult.probability_rotten * 100)}%.`,
    ],
    suggested_dietary_labels: ['Raw fresh produce (appears plant-based)'],
    missing_information: [
      'Confirm harvest/storage timeframe and any bruising hidden on opposite side',
      'Verify exact weight or box count before pickup',
    ],
    confidence_level: confLevel,
    confidence_score: onnxResult.confidence_score,
    human_review_recommended: isUnsuitable || confLevel === 'low',
    human_review_reason: isUnsuitable
      ? 'Local produce model flagged potential visible spoilage/bruising; Admin/NGO physical verification required.'
      : confLevel === 'low'
      ? 'Produce visual confidence is low; manual check recommended.'
      : 'Visually acceptable surface screening only; human verification required at pickup.',
    safety_disclaimer: SAFETY_DISCLAIMER,
    disclaimer: SAFETY_DISCLAIMER,
  };
}

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

function normalizeVisionResponse(rawText, { mode, modelVersion, foodCategory, onnxProduce }) {
  let parsed;
  try {
    const cleaned = String(rawText || '')
      .replace(/^```json\s*/i, '')
      .replace(/```$/i, '')
      .trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(jsonMatch ? jsonMatch[0] : cleaned);
  } catch {
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

  const onnxFlagged = onnxProduce && onnxProduce.visual_assessment_label === 'visually_unsuitable';
  const humanReview =
    Boolean(onnxFlagged) ||
    (typeof parsed.human_review_recommended === 'boolean' ? parsed.human_review_recommended : true);

  return {
    assessment_status: 'completed',
    assessment_mode: onnxProduce ? `hybrid_${mode}_and_onnx` : mode,
    is_demo_fallback: false,
    model_version: onnxProduce ? `${modelVersion} + ${onnxProduce.model_version}` : modelVersion,
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
    human_review_recommended: humanReview,
    human_review_reason: onnxFlagged
      ? `Local ResNet-18 flagged potential deterioration; ${parsed.human_review_reason || 'manual review required.'}`
      : typeof parsed.human_review_reason === 'string' && parsed.human_review_reason.trim()
      ? parsed.human_review_reason.trim()
      : 'Human verification is recommended before final NGO dispatch.',
    ...(onnxProduce
      ? {
          onnx_produce_screening: onnxProduce,
          predicted_class: onnxProduce.predicted_class,
          visual_assessment_label: onnxProduce.visual_assessment_label,
          probability_fresh: onnxProduce.probability_fresh,
          probability_rotten: onnxProduce.probability_rotten,
        }
      : {}),
    safety_disclaimer: SAFETY_DISCLAIMER,
    disclaimer: SAFETY_DISCLAIMER,
  };
}

async function callSingleGeminiModel(imageBuffer, mimeType, foodCategory, { apiKey, model, timeoutMs, fetchFn }, onnxProduce) {
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
    err.httpStatus = response.status;
    throw err;
  }

  const data = await response.json();
  const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) {
    const err = new Error('AI vision provider returned an empty response.');
    err.code = 'AI_PROVIDER_ERROR';
    throw err;
  }

  return normalizeVisionResponse(rawText, {
    mode: 'live_vision_ai',
    modelVersion: model,
    foodCategory,
    onnxProduce,
  });
}

async function callGeminiVision(imageBuffer, mimeType, foodCategory, options = {}, onnxProduce = null) {
  const apiKey = options.apiKey !== undefined ? options.apiKey : process.env.GEMINI_API_KEY;
  const preferredModel = options.model || process.env.GEMINI_MODEL || DEFAULT_MODEL;
  const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;
  const fetchFn = options.fetchImpl || globalThis.fetch;

  if (typeof fetchFn !== 'function') {
    const err = new Error('Fetch API is unavailable in this Node runtime.');
    err.code = 'AI_PROVIDER_ERROR';
    throw err;
  }

  // Try configured model first; if transient 404/429/503 occurs (and not explicitly mocked), fall back across verified Gemini models
  const candidateModels = options.fetchImpl || options.model
    ? [preferredModel]
    : Array.from(new Set([preferredModel, ...GEMINI_FALLBACK_MODELS]));

  let lastErr = null;
  for (const model of candidateModels) {
    try {
      return await callSingleGeminiModel(
        imageBuffer,
        mimeType,
        foodCategory,
        { apiKey, model, timeoutMs, fetchFn },
        onnxProduce
      );
    } catch (err) {
      lastErr = err;
      const retryable = err.httpStatus === 404 || err.httpStatus === 429 || err.httpStatus === 503 || err.code === 'AI_TIMEOUT';
      if (!retryable) throw err;
    }
  }
  throw lastErr;
}

async function callGroqVision(imageBuffer, mimeType, foodCategory, options = {}, onnxProduce = null) {
  const groqKey = options.groqApiKey !== undefined ? options.groqApiKey : process.env.GROQ_API_KEY;
  const model = options.groqModel || process.env.GROQ_VISION_MODEL || DEFAULT_GROQ_MODEL;
  const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;
  const fetchFn = options.fetchImpl || globalThis.fetch;

  if (!groqKey || !String(groqKey).trim()) {
    const err = new Error('GROQ_API_KEY is not configured.');
    err.code = 'AI_PROVIDER_ERROR';
    throw err;
  }

  let response;
  try {
    response = await fetchFn('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${groqKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        max_tokens: 700,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: buildVisionPrompt(foodCategory) },
              {
                type: 'image_url',
                image_url: { url: `data:${mimeType};base64,${imageBuffer.toString('base64')}` },
              },
            ],
          },
        ],
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    const isTimeout = err.name === 'TimeoutError' || err.name === 'AbortError';
    const wrapped = new Error(
      isTimeout
        ? `Groq vision request timed out after ${timeoutMs}ms.`
        : `Groq vision network error: ${err.message}`
    );
    wrapped.code = isTimeout ? 'AI_TIMEOUT' : 'AI_PROVIDER_ERROR';
    throw wrapped;
  }

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    const err = new Error(
      `Groq vision returned HTTP ${response.status}${errText ? `: ${errText.slice(0, 180)}` : ''}`
    );
    err.code = 'AI_PROVIDER_ERROR';
    throw err;
  }

  const data = await response.json();
  const rawText = data?.choices?.[0]?.message?.content;
  if (!rawText) {
    const err = new Error('Groq vision returned an empty response.');
    err.code = 'AI_PROVIDER_ERROR';
    throw err;
  }

  return normalizeVisionResponse(rawText, {
    mode: 'groq_vision_ai',
    modelVersion: model,
    foodCategory,
    onnxProduce,
  });
}

/**
 * Assess a food donation image using Hybrid AI (Gemini Vision + Groq Vision fallback + local ResNet-18 ONNX),
 * falling back cleanly to local ONNX for fresh produce or labeled Demo/Fallback mode.
 */
async function assessFoodImage(imageBuffer, foodCategory, options = {}) {
  const imageMeta = await validateAndInspectImage(imageBuffer, options.mimeType);
  const apiKey = options.apiKey !== undefined ? options.apiKey : process.env.GEMINI_API_KEY;
  const groqKey = options.groqApiKey !== undefined
    ? options.groqApiKey
    : (options.fetchImpl && options.apiKey !== undefined ? '' : process.env.GROQ_API_KEY);
  const normCategory = (foodCategory || '').trim().toLowerCase();

  const shouldRunLocalOnnx =
    normCategory === 'fresh_produce' && options.enableLocalOnnx !== false;

  const onnxProduce = shouldRunLocalOnnx ? await runOnnxProduceScreening(imageBuffer) : null;

  if (apiKey && String(apiKey).trim()) {
    try {
      return await callGeminiVision(imageBuffer, imageMeta.mimeType, foodCategory, options, onnxProduce);
    } catch (geminiErr) {
      if (groqKey && String(groqKey).trim() && !options.fetchImpl) {
        console.warn('[AI Assessment] Gemini failed, falling back to Groq Vision:', geminiErr.message);
        return await callGroqVision(imageBuffer, imageMeta.mimeType, foodCategory, options, onnxProduce);
      }
      throw geminiErr;
    }
  }

  if (groqKey && String(groqKey).trim()) {
    return callGroqVision(imageBuffer, imageMeta.mimeType, foodCategory, options, onnxProduce);
  }

  if (onnxProduce) {
    return buildLocalOnnxProduceAssessment(foodCategory, imageMeta, onnxProduce);
  }

  return buildDemoFallbackAssessment(foodCategory, imageMeta);
}

function getAiCapabilities() {
  const hasGeminiKey = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim());
  const hasGroqKey = Boolean(process.env.GROQ_API_KEY && process.env.GROQ_API_KEY.trim());
  const hasOnnxModel = Boolean(ort && sharp && fs.existsSync(ONNX_MODEL_PATH));
  const gemModel = process.env.GEMINI_MODEL || DEFAULT_MODEL;
  const groqModel = process.env.GROQ_VISION_MODEL || DEFAULT_GROQ_MODEL;

  const activeParts = [];
  if (hasGeminiKey) activeParts.push(`Gemini (${gemModel})`);
  if (hasGroqKey) activeParts.push(`Groq (${groqModel})`);
  if (hasOnnxModel) activeParts.push('ResNet-18 ONNX (produce)');

  return {
    gemini_vision_configured: hasGeminiKey,
    gemini_model: gemModel,
    groq_vision_configured: hasGroqKey,
    groq_model: groqModel,
    local_onnx_available: hasOnnxModel,
    local_onnx_model: hasOnnxModel ? ONNX_MODEL_VERSION : null,
    local_onnx_scope: ['fresh_produce'],
    active_mode_summary: activeParts.length > 0
      ? `Hybrid AI: ${activeParts.join(' + ')}`
      : 'Demo/Fallback Mode (no API keys / ONNX)',
  };
}

module.exports = {
  assessFoodImage,
  validateAndInspectImage,
  stripExifMetadata,
  buildDemoFallbackAssessment,
  runOnnxProduceScreening,
  getAiCapabilities,
  SAFETY_DISCLAIMER,
  DEFAULT_MODEL,
  ONNX_MODEL_VERSION,
};
