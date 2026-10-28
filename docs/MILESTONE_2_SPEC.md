# FoodLoop Milestone 2: AI-Assisted Visual Food Rescue Eligibility Assessment Specification (Corrected v2.0)

## Document Status
- **Authoritative Status:** DRAFT SPECIFICATION / DECISION GATE
- **Implementation Status:** NOT STARTED (Pending empirical validation of TASK-002A)
- **Supersedes:** Initial exploratory research proposal

---

## 1. Core Principles & Safety Neutrality

1. **Safety-Neutral Framing:**
   * The platform and its AI engine **never** declare food to be "safe" or "unsafe".
   * Computer vision performs **operational visual triage** for observable physical defects (surface mold, rot, packaging tears, severe container damage).
   * A clean photograph does **not** certify microbiological safety, absence of foodborne pathogens, or chemical wholesomeness.

2. **No Hardcoded Universal Safety Formulas:**
   * FoodLoop does **not** hardcode arbitrary elapsed time rules (such as "prepared > 4 hours ago at room temperature = unsafe") as universal platform laws.
   * Food safety time/temperature thresholds vary widely by jurisdiction (e.g., FDA Food Code 2-hour/4-hour rules vs. FSSAI regulations vs. European EFSA standards), food matrix (low-moisture bakery vs. high-protein dairy/meat), preparation methods, and storage containers.
   * Operational timestamps (`preparation_time`, `pickup_available_until`) and `current_storage` provide structured context for configurable operational policies, not universal scientific verdicts.

3. **Neutral Operational Date Handling:**
   * Do not make unqualified legal assertions such as "Expired packaged inventory cannot be legally redistributed."
   * Neutral operational standard: *"An expired or otherwise invalid declared date should be flagged according to the platform's configured operational policy and applicable local requirements."*

---

## 2. Category-Specific Visual Assessment Capabilities & Limitations

| Food Category | Realistically Observable Visual Capabilities | Fundamental Visual Limitations | Operational Risk Assessment |
| :--- | :--- | :--- | :--- |
| **`fresh_produce`** | - Surface fungal colonies / mold mycelium<br>- Soft wet rot, weeping lesions, dark necrotic tissue<br>- Severe desiccation, advanced shriveling, wilting<br>- Gross crushing, skin breakage, obvious pest damage | - Internal core rot hidden under unblemished skin<br>- Bacterial pathogens (*Salmonella*, *Listeria*, *E. coli*) invisible on fresh leaves<br>- Chemical / pesticide residue | **Moderate:** Best suited for CV screening due to visible surface decay indicators in public benchmark sets. |
| **`bakery`** | - Surface mold patches (*Aspergillus*, *Penicillium*)<br>- Moisture condensation / pooling inside clear packaging (spoilage precursor)<br>- Crushing, flattened loaves, torn protective wrappers | - Staling, starch retrogradation, or dry crumb texture without color change<br>- Oxidative rancidity of baking fats/oils or sour odor | **Moderate:** Useful for visible mold detection; limited on unpackaged items lacking mold markers. |
| **`cooked_meals`** | - Severe emulsion breakdown (heavy oil separation, curdling)<br>- Extreme surface desiccation, discoloration, crusting<br>- Gross physical foreign contaminants<br>- Outer container spillages or container deformities | **CRITICAL LIMITATION:** Cooked meal spoilage is microbiological and olfactory. Pathogens proliferate rapidly in the temperature danger zone without altering color, shape, or texture within typical rescue windows (2-6 hours). | **High / Weak Visual Utility:** Computer vision cannot verify microbiological safety. Triage relies primarily on structured operational metadata and human donor declaration. |
| **`packaged_sealed`** | - Packaging deformation (swollen/bloated cans indicating anaerobic gas production)<br>- Dents on can seams, punctures, torn carton seals<br>- Broken tamper-evident seals or outer liquid staining | - Opaque packaging completely conceals interior contents<br>- Sub-millimeter pinhole leaks or compromised micro-seals | **Low-to-Moderate:** Inspects visible packaging integrity only; cannot assess hidden contents. |

---

## 3. Evidence-Based Dataset Review & Research Gap Analysis

| Dataset Name | Domain / Content | Scale | Ground-Truth Labels | Task Alignment with FoodLoop | Evidentiary Status & Classification |
| :--- | :--- | :---: | :--- | :--- | :--- |
| **Kaggle Food Freshness Dataset** | 13 Fruits & Vegetables | ~70,000 | Binary: `Fresh` vs. `Rotten` | Fresh produce surface decay detection. | **Verified Fact:** Publicly available on Kaggle; high image volume across common produce classes. |
| **Healthy vs. Rotten Fruits (Mukhiddinov et al.)** | Apples, Bananas, Oranges, Tomatoes | ~14,000 | Binary: `Fresh` vs. `Rotten` | Produce blemish & decay detection. | **Verified Fact:** Academic benchmark; images feature uniform lighting and isolated backgrounds (domain shift risk for user uploads). |
| **Food-101** | 101 Prepared Dish Classes | 101,000 | Categorical dish names (e.g., `pad_thai`, `sushi`) | **Dish Identity Classification.** Contains zero freshness, spoilage, or condition labels. | **Verified Fact:** Irrelevant for condition screening; useful strictly as non-spoilage dish baseline or category sanity checking. |
| **Food5k** | Food vs. Non-Food Images | 5,000 | Binary: `Food` vs. `Non-Food` | **Input Abuse Filtering.** Detects non-food objects (documents, random photos). | **Verified Fact:** Useful for platform input sanitization; does not assess condition. |
| **Bread Mold & Bakery Sets (GitHub/Kaggle)** | Bread slices, rolls | ~1,500-3,000 | Binary: `Fresh Bread` vs. `Moldy Bread` | Bakery mold colony screening. | **Approximate Information:** Small sample sizes; limited geographic coverage (mostly Western sliced bread; lacks flatbreads/rotis). |
| **Commercial Cooked Meal Spoilage Dataset** | Prepared buffet trays, curries, cooked rice | **None** | N/A | **ACADEMIC & INDUSTRY GAP:** No publicly validated visual dataset exists for fresh vs. spoiled cooked dishes. | **Verified Fact (Research Gap):** Spoilage in cooked foods rarely presents reliable visual signatures during operational rescue windows. |

---

## 4. Literature & Specification-Based Candidate Model Comparison

> **IMPORTANT:** The figures below represent published academic baselines on ImageNet ($224 \times 224$ inputs). Actual CPU inference latency, memory footprint, model size on disk, and operational precision will be measured empirically during **TASK-002A** on the FoodLoop target environment. Model selection remains strictly open.

| Model Candidate | Parameters | Computational Load (FLOPs) | ImageNet Top-1 (Literature) | Architectural Features | Explainability & Grad-CAM Localization | Task 002A Candidate Role |
| :--- | :---: | :---: | :---: | :--- | :--- | :--- |
| **MobileNetV3-Large** | ~5.4 M | ~0.23 G | ~75.2% | Hardware-aware NAS, depthwise separable convolutions, squeeze-and-excitation. | Coarser activation maps due to heavy downsampling. | Lightweight edge reference candidate. |
| **EfficientNet-B0** | ~5.3 M | ~0.39 G | ~77.2% | Compound scaling (depth, width, resolution), inverted bottleneck MBConv. | Fine-grained feature maps; moderate Grad-CAM sharpness. | **Candidate A** (High parameter efficiency, state-of-the-art accuracy/size ratio). |
| **ResNet-18** | ~11.7 M | ~1.80 G | ~69.8% | Standard $3 \times 3$ residual convolutions, skip connections, uniform layout. | **Outstanding:** Highly localized, transparent, continuous Grad-CAM heatmaps. | **Candidate B** (Architectural simplicity, superior interpretability for triage). |
| **ResNet-50** | ~25.6 M | ~4.10 G | ~76.5% | 50-layer bottleneck residual architecture. | Excellent feature localization. | Compute-heavy baseline comparator. |

*Model selection is deferred until empirical measurements on the FoodLoop validation dataset are completed in TASK-002A.*

---

## 5. Three-Layer Assessment Architecture

The FoodLoop assessment pipeline strictly decouples visual machine learning predictions from metadata business rules and final operational routing:

```
+-------------------------------------------------------------------------------+
|                      THREE-LAYER ASSESSMENT ARCHITECTURE                      |
+-------------------------------------------------------------------------------+
| Layer A: Visual Assessment (Computer Vision Inference)                        |
|   - Input: Uploaded RGB food image                                            |
|   - Output Label: visual_assessment_label IN:                                 |
|       ['visually_acceptable', 'questionable', 'visually_unsuitable']          |
|   - Metric: confidence_score (Float 0.0 to 1.0)                               |
|   - Technical Role: Flags observable surface defects (mold, rot, damaged pack)|
+-------------------------------------------------------------------------------+
                                      |
                                      v
+-------------------------------------------------------------------------------+
| Layer B: Metadata Assessment (Operational Rules Engine)                       |
|   - Inputs: preparation_time, current_storage, expiry_date, pickup_until, etc.  |
|   - Output Label: metadata_assessment_label IN:                               |
|       ['metadata_passed', 'metadata_flagged', 'metadata_rejected']            |
|   - Technical Role: Validates operational consistency with platform policy    |
+-------------------------------------------------------------------------------+
                                      |
                                      v
+-------------------------------------------------------------------------------+
| Layer C: Final Platform Decision (Fusion & Governance Dispatch)               |
|   - Inputs: Layer A Output + Layer B Output                                   |
|   - Output: final_eligibility IN:                                             |
|       ['eligible_for_rescue', 'requires_human_review', 'rejected_unsuitable']  |
|   - Platform Status Mapping:                                                  |
|       * eligible_for_rescue   -> donation.status = 'available' (for matching) |
|       * requires_human_review -> donation.status = 'under_review' (queued)    |
|       * rejected_unsuitable   -> donation.status = 'rejected' (closed)        |
+-------------------------------------------------------------------------------+
```

---

## 6. Conservative Handling of Visual Unsuitability & Fusion Policy

### The False-Positive Risk Dilemma:
* An autonomous rejection based solely on a computer vision prediction risks discarding perfectly edible surplus due to unusual lighting, sauce patterns, charred grill marks, or camera angle distortions (false positive error).
* Conversely, auto-approving spoiled food due to false negative errors poses severe public health risks.

### Adopted Fusion Policy:
1. **Ambiguity Favors Human Review:**
   * Whenever visual confidence falls in the indeterminate range [\tau_{\text{low}}, \tau_{\text{high}}], or whenever the model outputs `questionable`, the platform routes the donation to `requires_human_review` (never automated rejection or automated approval).
2. **Definite Visual Unsuitability:**
   * If `visual_assessment == 'visually_unsuitable'` AND `confidence_score >= \tau_{\text{high}}` on categories with verified visual indicators (`fresh_produce`, `bakery`), the case is flagged with high unsuitability confidence.
   * In initial Milestone 2 operations, unsuitability classifications are queued for rapid human verification to validate real-world false-positive rates before enabling autonomous rejection.
3. **Cooked Meals Governance:**
   * Because visual assessment on cooked meals is fundamentally weak, cooked meals cannot be approved on image merits alone.
   * Cooked meals require `metadata_assessment == 'metadata_passed'` to achieve `eligible_for_rescue`.
4. **Packaged Goods Governance:**
   * For sealed items, metadata validity (`expiry_date`) takes precedence. If expired or unreadable, the record is flagged or rejected according to platform operational policy.

---

## 7. Empirical Threshold Governance (\tau_{\text{low}} & \tau_{\text{high}})

* Arbitrary confidence thresholds (such as fixed numbers 0.60 or 0.85) are **prohibited** from implementation code.
* Thresholds \tau_{\text{low}} and \tau_{\text{high}} must be derived empirically during **TASK-002A** using a held-out validation dataset and explicit optimization goals:
  * **\tau_{\text{high}} (High-Confidence Cutoff):** Optimized to minimize False Negatives (protect recipients from receiving visually defective produce/bakery).
  * **\tau_{\text{low}} (Low-Confidence Cutoff):** Optimized to minimize False Positives (prevent spurious rejection of rescue-ready surplus).
  * **Indeterminate Band [\tau_{\text{low}}, \tau_{\text{high}}]:** Triggers `questionable` visual triage, automatically routing the intake record to human triage.

---

## 8. Assessment Data Schema (`donation_assessments`)

```
TABLE donation_assessments:
  id:                         String (Primary Key, UUID or nanoid)
  donation_id:                String (Foreign Key -> donations.id)
  
  -- Layer A: Visual Assessment
  visual_assessment_label:    Enum ['visually_acceptable', 'questionable', 'visually_unsuitable', 'pending']
  confidence_score:           Float (0.0 to 1.0) [Model output probability]
  model_version:              String (e.g., 'resnet18-candidate-v1' or 'efficientnetb0-v1')
  
  -- Layer B: Metadata Assessment
  metadata_assessment_label:  Enum ['metadata_passed', 'metadata_flagged', 'metadata_rejected']
  metadata_flags:             JSON (Array of operational rule codes triggered, e.g., ['PAST_PICKUP_TIME'])
  
  -- Layer C: Final Platform Decision
  final_eligibility:          Enum ['eligible_for_rescue', 'requires_human_review', 'rejected_unsuitable', 'pending']
  triage_reason:              String (Human-readable rationale for review or dispatch)
  
  -- Human Governance & Audit Trail
  reviewed_by:                String (Nullable, admin/reviewer user ID)
  review_notes:               Text (Nullable, comments from human reviewer)
  reviewed_at:                DateTime (Nullable, ISO timestamp)
  assessed_at:                DateTime (ISO timestamp of automated pipeline execution)
```

---

## 9. Revised Milestone 2 Task Breakdown

### TASK-002A — Dataset Preparation & Candidate Model Experiment
*Scope: Offline scientific evaluation and measurement. Strictly NO production backend/frontend code integration.*
- Assemble and clean candidate evaluation dataset from public produce and bakery sources.
- Establish standardized preprocessing pipeline ($224 \times 224$, ImageNet normalization).
- Train/fine-tune candidate ResNet-18 model; compute accuracy, precision, recall, confusion matrix.
- Train/fine-tune candidate EfficientNet-B0 model; compute identical evaluation metrics.
- Measure actual CPU inference latency (mean, P95, P99 ms) and memory footprint on development hardware.
- Generate and evaluate Grad-CAM localization heatmaps for visual interpretability.
- Empirically calculate \tau_{\text{low}} and \tau_{\text{high}} operating points.
- Produce formal experimental report and select model architecture based on measured evidence.

### TASK-002B — Model Export & Inference Runtime Integration
*Scope: Backend model runtime integration. Executed ONLY after TASK-002A is completed and formally approved.*
- Export the selected winning model to standardized ONNX format.
- Integrate `onnxruntime` into the FoodLoop backend runtime.
- Implement robust preprocessing pipeline in Node.js/Express using `sharp`.
- Implement asynchronous inference handler with execution timeouts and error boundaries.
- Return structured Layer A visual output (`visual_assessment_label`, `confidence_score`, `model_version`).

### TASK-002C — Metadata Assessment & Decision Fusion Engine
*Scope: Layer B rules engine and Layer C fusion integration.*
- Implement Layer B metadata evaluator checking declared `pickup_available_until`, `expiry_date`, `preparation_time`, and `current_storage`.
- Implement Layer C fusion logic combining Layer A and Layer B assessments.
- Implement `donation_assessments` persistence in backend storage with audit tracking.
- Ensure ambiguous cases ([\tau_{\text{low}}, \tau_{\text{high}}] or metadata flags) route safely to `requires_human_review`.
- Maintain safety-neutral terminology throughout API contracts.

### TASK-002D — User Interface & End-to-End Verification
*Scope: Frontend visual presentation, operational dashboard badges, and regression testing.*
- Display clear, non-alarmist eligibility status badges on donation views (`Rescue Ready`, `Needs Human Review`, `Not Suitable for Rescue`).
- Provide human-readable triage reasons and operational review queues.
- Ensure 100% backward compatibility with legacy records and TASK-001 intake submissions.
- Execute full regression test suite (API, UI, lifecycle, performance).

---

## 10. Revised Test Plan

| Test ID | Test Category | Target Description | Verification Criteria (Model & Operational Behavior) |
| :--- | :--- | :--- | :--- |
| **CV-01** | Visual Evaluation | Clear, typical food image | Verify that a clear, visually typical food image produces a model assessment consistent with the validated evaluation dataset. |
| **CV-02** | Visual Evaluation | Grossly moldy/decayed produce | Verify that an image with prominent surface rot or mold produces a `visually_unsuitable` assessment with confidence $\ge \tau_{\text{high}}$. |
| **CV-03** | Visual Evaluation | Ambiguous / blurry image | Verify that an image with low lighting or partial occlusion produces confidence in the [\tau_{\text{low}}, \tau_{\text{high}}] band, resulting in `questionable`. |
| **CV-04** | Inference Boundary | Non-food / corrupt image | Verify that corrupt file bytes or non-food inputs trigger a graceful error without backend crash, routing to `requires_human_review`. |
| **FUS-01** | Decision Fusion | Clean visual + Valid metadata | Verify that `visually_acceptable` + `metadata_passed` results in `eligible_for_rescue`. |
| **FUS-02** | Decision Fusion | Clean visual + Questionable metadata | Verify that `visually_acceptable` + `metadata_flagged` results in `requires_human_review`. |
| **FUS-03** | Decision Fusion | Unsuitable visual | Verify that `visually_unsuitable` triggers conservative triage routing (`requires_human_review` or operational reject per policy). |
| **FUS-04** | Decision Fusion | Expired packaged food | Verify that an expired declared date flags the donation according to platform operational policy, independent of image appearance. |
| **REG-01** | Regression | Legacy records | Verify that all 7 legacy records and TASK-001 donations remain fully viewable without missing-attribute crashes. |

---

## 11. Claims Requiring External Evidence Before Implementation

The following claims require verifiable empirical proof or documented local operational guidelines before being introduced into production logic:

1. **Model Latency and Memory Claims:**
   * Literature claims (e.g., "ResNet-18 executes in 25ms on CPU") cannot be cited as FoodLoop platform facts until measured on the actual host hardware in TASK-002A.
2. **Universal Spoilage Times:**
   * Any operational rule flagging cooked meals must be documented as an administrative configuration setting reflecting specific local organizational guidelines, not a universal law of food microbiology.
3. **Multi-Class Cooked Food Spoilage Accuracy:**
   * Claims that computer vision can distinguish fresh vs. stale/spoiled cooked curries or rice cannot be made without an experimentally validated, peer-reviewed, or internally gathered benchmark dataset.
4. **Packaging Pinhole / Seal Detection:**
   * Computer vision cannot be assumed to detect micro-punctures or compromised hermetic seals from smartphone RGB photos.

---

## 12. Explicitly Rejected Assumptions

1. **Rejected:** *"An RGB smartphone photo can determine whether food is safe or unsafe to consume."*
   * **Correction:** Biological contamination, bacterial toxins (*Staphylococcus*, *Bacillus cereus*), and viral particles are microscopic. RGB cameras inspect macroscopic visual condition only.
2. **Rejected:** *"Cooked food older than 4 hours is universally unsafe."*
   * **Correction:** Spoilage curves depend on heating temperatures, cooling curves, salt/acid content, and ambient environment. The platform will not invent universal safety formulas.
3. **Rejected:** *"ResNet-18 is finalized as the FoodLoop production model."*
   * **Correction:** ResNet-18 and EfficientNet-B0 are candidate architectures to be benchmarked head-to-head in TASK-002A.
4. **Rejected:** *"Thresholds 0.60 and 0.85 should be hardcoded in backend evaluation logic."*
   * **Correction:** Thresholds \tau_{\text{low}} and \tau_{\text{high}} must be derived empirically from validation ROC/PR curves.
5. **Rejected:** *"Visual unsuitability should immediately and unconditionally auto-reject donations without human review."*
   * **Correction:** To prevent false positives and unnecessary food waste, the initial deployment policy must favor human review when visual classifications are ambiguous or subject to imaging artifacts.
