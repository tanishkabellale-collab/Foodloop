# FoodLoop — Tasks Manifest

## Current Status
- **Active Task:** None (TASK-001 completed, verified, audited, and documented; awaiting human instruction before next milestone)
- **Completed Tasks:** TASK-001 — Donation Intake V1.0
- **Milestone 2 Status:** **TASK-002A Clean Evaluation Verified. TASK-002B-1 ONNX Export Verified (COMPLETED). TASK-002B-2 NOT STARTED.**

---

## TASK-001 — Donation Intake V1.0

### Objective
Build the first usable donation-intake vertical slice while preserving compatibility with the existing FoodLoop application.

### Implemented Scope
- **Food Category:** 4 standardized options (`cooked_meals`, `fresh_produce`, `bakery`, `packaged_sealed`).
- **Food Title / Short Description:** Mandatory string descriptor (`title`).
- **Dietary Type:** Binary selector (`vegetarian`, `non_vegetarian`).
- **Numeric Quantity:** Enforced as a valid `Number` ($>0$).
- **Quantity Unit:** Standardized options (`servings`, `plates`, `trays`, `boxes`).
- **Single Image Upload:** Multipart upload via `multer` (JPG, PNG, WebP $\le 5$ MB) stored in `backend/uploads/`.
- **Pickup Availability:** Enforced future datetime ISO string (`pickup_available_until`).
- **Pickup Location:** Mandatory human-readable address (`address_text`).
- **Conditional Cooked-Food Fields:** `preparation_time` (`less_than_1_hour_ago`, `1_to_2_hours_ago`, `2_to_4_hours_ago`, `more_than_4_hours_ago`) and neutral `current_storage` (`room_temperature`, `refrigerated`, `hot_insulated`).
- **Conditional Packaged-Food Expiry:** Mandatory `expiry_date` date string.
- **Packaging Condition:** Recommended field (`packaging_type`: `sealed_covered`, `open_loose`).
- **Optional Context:** `allergens` and `special_note`.
- **Legacy Compatibility Layer:** Preserves `foodName`, `location`, `expiryTime`, and `quantityText` across read/write operations without breaking existing 7 records or current NGO cards.
- **Static File Serving:** Express static route on `/uploads` for viewing uploaded photographs.
- **Donation Lifecycle Compatibility:** Supports initial status `submitted` while preserving existing `accepted` and `collected` transitions.

### Verification Summary
- **21 Verified Tests Passed (0 Failed):**
  - Build & Syntax (`BLD-01` – `BLD-02`): 2 passed.
  - Automated API Validation (`API-01` – `API-05`): 5 passed.
  - Image Upload & Serving (`IMG-01` – `IMG-03`): 3 passed.
  - Data Contract & Serialization (`DAT-01` – `DAT-03`): 3 passed.
  - Donation Status Lifecycle (`LIF-01` – `LIF-03`): 3 passed.
  - Compatibility & Browser UI UAT (`CMP-01` – `CMP-02`, `UAT-01` – `UAT-03`): 5 passed.
- **Full details recorded in:** `docs/TEST_PLAN.md`.

### Result
**PASS**

### Scope Boundary
Explicitly excludes:
- AI-assisted computer vision assessment / model inference.
- `donation_assessments` table / schema generation.
- Human reviewer dashboard.
- Intelligent NGO matching / capacity algorithms.
- Delivery coordination / route optimization.
- Authentication, authorization, and database migration.


---

## MILESTONE 2 — AI-Assisted Visual Food Rescue Eligibility Assessment

**Status: SPECIFICATION CORRECTED — IMPLEMENTATION NOT STARTED (Decision Gate Active)**

### Guiding Directives
- **Zero Scientific Safety Claims:** AI models perform visual defect triage; they never certify microbiological safety or edibility.
- **No Universal Safety Formulas:** No hardcoded time/temperature safety formulas (e.g., no universal 4-hour rule).
- **Three-Layer Architecture:**
  - Layer A: Visual Assessment (`visually_acceptable`, `questionable`, `visually_unsuitable`)
  - Layer B: Metadata Assessment (`metadata_passed`, `metadata_flagged`, `metadata_rejected`)
  - Layer C: Final Platform Decision (`eligible_for_rescue`, `requires_human_review`, `rejected_unsuitable`)
- **Open Model Selection:** ResNet-18 vs. EfficientNet-B0 to be experimentally evaluated; selection strictly deferred until empirical evidence is gathered in TASK-002A.
- **Empirical Thresholds:** Thresholds \tau_{\text{low}} and \tau_{\text{high}} determined on validation set; no arbitrary numbers (0.60/0.85).

---

### TASK-002A — Dataset Preparation & Candidate Model Experiment
- **Status:** COMPLETE — CLEAN EVALUATION VERIFIED (Strict 70/15/15 Train/Val/Test Separation)
- **Scope:** Offline scientific evaluation only. No backend/frontend code integration.
- **Action Items:**
  1. Finalize candidate datasets (Fresh Produce rot sets, Bread mold sets, Food5k non-food filter).
  2. Assemble a clean, held-out evaluation dataset with standardized splits.
  3. Establish standardized preprocessing pipeline ($224 \times 224$, ImageNet normalization).
  4. Train / fine-tune candidate ResNet-18 model; compute accuracy, precision, recall, confusion matrix.
  5. Train / fine-tune candidate EfficientNet-B0 model; compute identical evaluation metrics.
  6. Measure actual CPU inference latency (mean, P95, P99 ms) and peak RAM utilization on target hardware.
  7. Compute Grad-CAM localization heatmaps for visual interpretability and defect explainability.
  8. Empirically derive operational thresholds \tau_{\text{low}} and \tau_{\text{high}} on validation data.
  9. Document explicit category limitations and failure modes.
  10. Select production model architecture only based on measured empirical evidence.

---

### TASK-002B-1 — ResNet-18 ONNX Export & Inference Verification
- **Status:** COMPLETED
- **Scope:** Offline model export & verification.
- **Accomplishments:**
  1. Exported frozen ResNet-18 checkpoint to self-contained ONNX (`resnet18_foodloop.onnx`, 42.63 MB, opset 17).
  2. Structurally verified ONNX graph with `onnx.checker.check_model` (0 errors).
  3. Verified ONNX Runtime session loading with `CPUExecutionProvider`.
  4. Verified numerical parity against PyTorch across all 159 held-out test images (max logit diff: $7.15 \times 10^{-6}$, max prob diff: $1.01 \times 10^{-6}$).
  5. Confirmed 100% prediction agreement across all test images at both $\tau=0.50$ and $\tau=0.20$.
  6. Benchmarked CPU latency: 9.18 ms mean (vs. PyTorch 20.32 ms, 54.8% speedup).
  7. Formally defined output contract mapping: 0 -> `visually_acceptable`, 1 -> `visually_unsuitable`.
  8. Created authoritative report: `experiments/task-002a/clean_eval/reports/onnx_export_report.md`.

---

### TASK-002B-2 — Model Export & Inference Runtime Integration
- **Status:** NOT STARTED
- **Scope:** Backend runtime integration.
- **Action Items:**
  1. Integrate `onnxruntime-node` into the FoodLoop backend runtime.
  2. Implement pre-inference preprocessing in Node.js/Express using `sharp`.
  3. Implement asynchronous inference service with error isolation and timeout protection.
  4. Return structured Layer A visual output (`visual_assessment_label`, `confidence_score`, `model_version`).

---

### TASK-002C — Metadata Assessment & Decision Fusion Engine
- **Status:** BLOCKED (Requires TASK-002B)
- **Scope:** Layer B operational rules engine and Layer C decision fusion.
- **Action Items:**
  1. Evaluate structured metadata fields (`pickup_available_until`, `expiry_date`, `preparation_time`, `current_storage`).
  2. Implement operational rules flagging past dates and unaligned storage declarations per platform policy.
  3. Combine Layer A visual output and Layer B metadata evaluation into Layer C platform decision.
  4. Create `donation_assessments` persistence record linked to `donation_id`.
  5. Maintain safety-neutral terminology across all schemas and API responses.
  6. Route ambiguous cases ([\tau_{\text{low}}, \tau_{\text{high}}] or metadata flags) to human review (`requires_human_review`).

---

### TASK-002D — UI & Verification
- **Status:** BLOCKED (Requires TASK-002C)
- **Scope:** User interface, triage badges, review workflow, and regression testing.
- **Action Items:**
  1. Implement non-alarmist assessment badges on donation cards (`Rescue Ready`, `Needs Human Review`, `Not Suitable for Rescue`).
  2. Provide clear human-readable triage reasons and operational review queue.
  3. Support backward compatibility for legacy records without assessments.
  4. Execute full end-to-end regression test suite across frontend and backend.
