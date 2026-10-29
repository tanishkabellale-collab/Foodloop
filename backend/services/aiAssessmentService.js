const path = require('path');
const fs = require('fs');

// Note: onnxruntime-node and sharp are loaded dynamically or required
let ort = null;
let sharp = null;

try {
  ort = require('onnxruntime-node');
} catch (e) {
  // Gracefully handle if not yet installed
  ort = null;
}

try {
  sharp = require('sharp');
} catch (e) {
  sharp = null;
}

const MODEL_PATH = path.resolve(
  __dirname,
  '../../experiments/task-002a/clean_eval/checkpoints/resnet18_foodloop.onnx'
);

const MODEL_VERSION = 'resnet18_v1.0.0_foodloop';
const DEFAULT_THRESHOLD = 0.50;
const DISCLAIMER = 'AI operational triage only. Does not certify food safety or detect pathogens, toxins, or internal spoilage.';

// Singleton ONNX Session
let session = null;
let sessionInitPromise = null;

/**
 * Initializes and returns the singleton ONNX InferenceSession
 */
async function getInferenceSession() {
  if (session) return session;

  if (!ort) {
    throw new Error('onnxruntime-node package is not available. Please run npm install in backend.');
  }

  if (!fs.existsSync(MODEL_PATH)) {
    throw new Error(`ONNX model file not found at: ${MODEL_PATH}`);
  }

  if (!sessionInitPromise) {
    sessionInitPromise = ort.InferenceSession.create(MODEL_PATH, {
      executionProviders: ['cpu']
    })
      .then((sess) => {
        session = sess;
        console.log(`[AI Assessment] ONNX ResNet-18 singleton session initialized successfully (${MODEL_VERSION}).`);
        return session;
      })
      .catch((err) => {
        sessionInitPromise = null;
        console.error('[AI Assessment] Failed to initialize ONNX session:', err);
        throw err;
      });
  }

  return sessionInitPromise;
}

/**
 * Preprocesses an image buffer according to validated PyTorch contract:
 * 1. Convert to RGB
 * 2. Resize shortest edge to 256
 * 3. Center crop to 224 x 224
 * 4. Scale [0, 1] and normalize with ImageNet mean & std
 * 5. Return planar CHW Float32Array [1, 3, 224, 224]
 */
async function preprocessImage(imageBuffer) {
  if (!sharp) {
    throw new Error('sharp package is not available. Please run npm install in backend.');
  }

  const image = sharp(imageBuffer);
  const metadata = await image.metadata();
  const { width, height } = metadata;

  if (!width || !height) {
    throw new Error('Failed to read image dimensions. Corrupted or invalid image.');
  }

  // PyTorch Resize(256): resize smaller edge to 256 while preserving aspect ratio
  let targetWidth, targetHeight;
  if (width < height) {
    targetWidth = 256;
    targetHeight = Math.round(height * (256 / width));
  } else {
    targetHeight = 256;
    targetWidth = Math.round(width * (256 / height));
  }

  // Center crop offsets to extract 224 x 224
  const cropLeft = Math.max(0, Math.floor((targetWidth - 224) / 2));
  const cropTop = Math.max(0, Math.floor((targetHeight - 224) / 2));

  // Extract raw RGB bytes (224 * 224 * 3 = 150,528 bytes)
  const rawRgbBuffer = await image
    .resize(targetWidth, targetHeight, { fit: 'fill' })
    .extract({ left: cropLeft, top: cropTop, width: 224, height: 224 })
    .toColorspace('srgb')
    .raw()
    .toBuffer();

  const numPixels = 224 * 224;
  const float32Data = new Float32Array(3 * numPixels);

  // ImageNet Normalization Parameters
  const mean = [0.485, 0.456, 0.406];
  const std = [0.229, 0.224, 0.225];

  // Convert interleaved HWC (RGBRGB...) to planar CHW (RRR...GGG...BBB...)
  for (let i = 0; i < numPixels; i++) {
    const r = rawRgbBuffer[i * 3 + 0] / 255.0;
    const g = rawRgbBuffer[i * 3 + 1] / 255.0;
    const b = rawRgbBuffer[i * 3 + 2] / 255.0;

    float32Data[i] = (r - mean[0]) / std[0];                   // Channel 0 (Red)
    float32Data[numPixels + i] = (g - mean[1]) / std[1];       // Channel 1 (Green)
    float32Data[numPixels * 2 + i] = (b - mean[2]) / std[2];   // Channel 2 (Blue)
  }

  return float32Data;
}

/**
 * Assesses an image for food donation triage.
 * @param {Buffer} imageBuffer - Raw binary photo buffer
 * @param {string} foodCategory - Category identifier ('fresh_produce', 'cooked_meals', etc.)
 * @returns {Promise<Object>} Standardized assessment result
 */
async function assessFoodImage(imageBuffer, foodCategory) {
  const normCategory = (foodCategory || '').trim().toLowerCase();

  // Category Gate: The ResNet-18 model is validated ONLY for raw fresh produce
  if (normCategory !== 'fresh_produce') {
    return {
      assessment_status: 'requires_human_review',
      reason: 'model_not_validated_for_category',
      food_category: foodCategory || 'unspecified',
      predicted_class: null,
      visual_assessment_label: null,
      confidence_score: null,
      probability_fresh: null,
      probability_rotten: null,
      threshold_applied: null,
      model_version: MODEL_VERSION,
      message: 'AI visual screening is validated exclusively for raw fresh produce (apples, bananas, oranges). This category proceeds to human review.',
      disclaimer: DISCLAIMER
    };
  }

  // Ensure image buffer exists
  if (!imageBuffer || imageBuffer.length === 0) {
    const err = new Error('No image buffer provided for assessment.');
    err.code = 'INVALID_IMAGE';
    throw err;
  }

  // Preprocess image
  const inputTensorData = await preprocessImage(imageBuffer);

  // Obtain singleton session
  const sess = await getInferenceSession();

  // Create ONNX Runtime Tensor [1, 3, 224, 224] FP32
  const tensor = new ort.Tensor('float32', inputTensorData, [1, 3, 224, 224]);
  const feeds = { input: tensor };

  // Execute inference
  const results = await sess.run(feeds);
  const logits = results.logits.data; // Float32Array of length 2 [logit_fresh, logit_rotten]

  // Numerically stable softmax
  const z0 = logits[0];
  const z1 = logits[1];
  const maxZ = Math.max(z0, z1);
  const exp0 = Math.exp(z0 - maxZ);
  const exp1 = Math.exp(z1 - maxZ);
  const sumExp = exp0 + exp1;

  const probFresh = exp0 / sumExp;
  const probRotten = exp1 / sumExp;

  // Classify based on verified threshold
  const isRotten = probRotten >= DEFAULT_THRESHOLD;
  const predictedClass = isRotten ? 1 : 0;
  const visualLabel = isRotten ? 'visually_unsuitable' : 'visually_acceptable';
  const confidence = isRotten ? probRotten : probFresh;

  return {
    assessment_status: 'completed',
    food_category: 'fresh_produce',
    predicted_class: predictedClass,
    visual_assessment_label: visualLabel,
    confidence_score: Math.round(confidence * 10000) / 10000,
    probability_fresh: Math.round(probFresh * 10000) / 10000,
    probability_rotten: Math.round(probRotten * 10000) / 10000,
    threshold_applied: DEFAULT_THRESHOLD,
    model_version: MODEL_VERSION,
    disclaimer: DISCLAIMER
  };
}

module.exports = {
  assessFoodImage,
  getInferenceSession,
  MODEL_VERSION,
  DEFAULT_THRESHOLD
};

