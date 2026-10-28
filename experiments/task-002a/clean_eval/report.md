# FoodLoop TASK-002A: Model Evaluation & Comparative Experiment Report

## Document Status
- **Task ID:** TASK-002A (Dataset Preparation & Candidate Model Experiment)
- **Status:** COMPLETE -- CLEAN EVALUATION VERIFIED
- **Completion Date:** 2026-10-28
- **Authoritative Specification:** `docs/MILESTONE_2_SPEC.md`
- **Safety Boundary:** AI-assisted visual food rescue assessment evaluates macroscopic surface defects only. **Zero claims of food safety, microbiological sterility, pathogen detection, toxin detection, allergen detection, or internal temperature history.**

---

## 1. Executive Summary & Evaluation Evolution

To maintain the highest level of empirical rigor and prevent data leakage, FoodLoop TASK-002A was evaluated across two distinct methodologies:

1. **TASK-002A DEVELOPMENT BASELINE -- 80/20 EVALUATION**
   * *Status:* Historical development baseline (preserved).
   * *Limitation:* Evaluated on a 212-image holdout partition that was also monitored during training epochs for checkpoint and threshold selection. While establishing viability, it does not represent an untouched final test evaluation.
2. **TASK-002A CLEAN EVALUATION -- 70/15/15**
   * *Status:* Authoritative final scientific result.
   * *Protocol:* 70% Train (740 images), 15% Validation (159 images), 15% Untouched Test (159 images).
   * *Strict Leakage Guarantee:* Checkpoints and candidate thresholds were chosen **strictly on the Validation partition**. The 159-image Test partition was held completely untouched and evaluated **exactly once** after both models were frozen.

---

## 2. Dataset Partitioning & Stratification

The verified 1,058-image dataset (`menasi11/fruit-classification`) was split deterministically using seed `42` with stratified binary class balance (`visually_acceptable` vs. `visually_unsuitable`) and fine-grained fruit categories:

| Partition | Total Images | Fresh Produce (`0`) | Rotten / Defective Produce (`1`) | Percentage | Purpose |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **TRAIN** | 740 | 310 (41.9%) | 430 (58.1%) | 70% | Model parameter fitting (gradient descent) |
| **VALIDATION** | 159 | 67 (42.1%) | 92 (57.9%) | 15% | Per-epoch evaluation, checkpoint selection, threshold tuning |
| **TEST** | 159 | 67 (42.1%) | 92 (57.9%) | 15% | **Untouched final evaluation** (evaluated once) |
| **TOTAL** | **1,058** | **444 (42.0%)** | **614 (58.0%)** | **100%** | Full verified dataset |

*Manifest Location:* `experiments/task-002a/clean_eval/data/splits_70_15_15.json`

---

## 3. Training Protocol & Hyperparameters

Both models were trained using an identical protocol under an isolated CPU environment (Intel Core i5-13450HX CPU, 16 GB RAM, Python 3.14.3, PyTorch 2.15.0+cpu):
- **Pretrained Weights:** ImageNet (official torchvision weights)
- **Input Resolution:** 224 x 224 RGB (ImageNet mean & std normalization)
- **Augmentation (Train):** Resize(256), RandomCrop(224), RandomHorizontalFlip(p=0.5)
- **Validation/Test Transform:** Resize(256), CenterCrop(224), ToTensor(), Normalize()
- **Batch Size:** 32 (24 batches per epoch)
- **Optimizer:** AdamW (learning rate = 1e-4, weight decay = 0.01)
- **Scheduler:** CosineAnnealingLR (T_max = 5)
- **Epochs:** 5
- **Loss Function:** CrossEntropyLoss
- **Random Seed:** 42

---

## 4. Validation Convergence & Checkpoint Selection

Validation metrics were recorded after every epoch on the 159-image validation partition. Checkpoints were selected strictly at the epoch with the lowest validation loss.

### ResNet-18 Validation History
- **Total Parameters:** 11,177,538
- **Best Epoch:** Epoch 4 (Val Loss: 0.0514, Val Acc: 98.74%)
- **Training Time:** 230.9s

| Epoch | Train Loss | Train Acc | Val Loss | Val Acc | Val Defect Recall | Duration |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| 1 | 0.1815 | 92.4% | 0.1180 | 94.3% | 91.3% | 48.7s |
| 2 | 0.0392 | 98.9% | 0.0775 | 96.9% | 97.8% | 47.9s |
| 3 | 0.0278 | 99.2% | 0.0545 | 97.5% | 96.7% | 47.5s |
| 4 | 0.0108 | 100.0% | 0.0514 | 98.7% | 98.9% | 46.1s |
| 5 | 0.0098 | 99.7% | 0.0600 | 98.7% | 97.8% | 40.6s |

### EfficientNet-B0 Validation History
- **Total Parameters:** 4,010,110
- **Best Epoch:** Epoch 4 (Val Loss: 0.1084, Val Acc: 96.23%)
- **Training Time:** 435.9s

| Epoch | Train Loss | Train Acc | Val Loss | Val Acc | Val Defect Recall | Duration |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| 1 | 0.4388 | 88.6% | 0.2857 | 91.8% | 85.9% | 70.7s |
| 2 | 0.1639 | 96.4% | 0.1243 | 96.2% | 93.5% | 58.0s |
| 3 | 0.0900 | 97.7% | 0.1374 | 94.3% | 90.2% | 83.2s |
| 4 | 0.0581 | 99.1% | 0.1084 | 96.2% | 93.5% | 143.0s |
| 5 | 0.0551 | 99.5% | 0.1271 | 95.6% | 92.4% | 80.8s |

---

## 5. Validation Candidate Threshold Selection

> [!NOTE]
> Candidate thresholds evaluated below are designated strictly as **candidate experimental thresholds** for triage research, NOT validated food-safety thresholds.

The validation probability distribution was swept from tau=0.10 to tau=0.90 on the validation set to choose a candidate operational threshold:
- **ResNet-18 Selected Candidate Threshold:** tau = 0.20
- **EfficientNet-B0 Selected Candidate Threshold:** tau = 0.20

Both thresholds were frozen and subsequently transferred without modification to the untouched test evaluation.

---

## 6. Final Untouched Test Evaluation (159 Images)

The held-out test partition was evaluated strictly **once** per selected checkpoint.

### Primary Metrics Comparison on Untouched Test Set

| Metric | ResNet-18 (tau=0.50) | ResNet-18 (tau=0.20) | EfficientNet-B0 (tau=0.50) | EfficientNet-B0 (tau=0.20) |
| :--- | :---: | :---: | :---: | :---: |
| **Accuracy** | **98.74%** | 98.74% | **98.11%** | 96.86% |
| **Balanced Accuracy** | 98.71% | 98.71% | 98.17% | 96.27% |
| **Macro Precision** | 98.71% | 98.71% | 97.98% | 97.42% |
| **Macro Recall** | 98.71% | 98.71% | 98.17% | 96.27% |
| **Macro F1** | 98.71% | 98.71% | 98.07% | 96.74% |
| **Defect / Rotten Recall** | **98.91%** | **98.91%** | **97.83%** | **100.00%** |
| **False Negative Rate (FNR)** | **1.09%** | **1.09%** | **2.17%** | **0.00%** |
| **False Positive Rate (FPR)** | 1.49% | 1.49% | 1.49% | 7.46% |
| **Defect Precision** | 98.91% | 98.91% | 98.90% | 94.85% |
| **Defect F1** | 98.91% | 98.91% | 98.36% | 97.35% |
| **ROC-AUC** | **0.9972** | - | **0.9987** | - |
| **PR-AUC** | **0.9983** | - | **0.9991** | - |

### Confusion Matrix Breakdown (Untouched Test Set, 159 Images)

| Model & Threshold | True Negative (TN) | False Positive (FP) | False Negative (FN) | True Positive (TP) | Notes |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **ResNet-18 (tau=0.50)** | 66 | 1 | 1 | 91 | Standard baseline |
| **ResNet-18 (tau=0.20)** | 66 | 1 | 1 | 91 | Frozen validation candidate |
| **EfficientNet-B0 (tau=0.50)** | 66 | 1 | 2 | 90 | Standard baseline |
| **EfficientNet-B0 (tau=0.20)** | 62 | 5 | 0 | 92 | Frozen validation candidate |

---

## 7. Single-Image CPU Latency & Efficiency Benchmark

Timed across 100 single-image inference runs (batch size = 1, input shape 1x3x224x224, 20 warmup runs) on Intel Core i5-13450HX CPU:

| Metric | ResNet-18 | EfficientNet-B0 | Comparison / Analysis |
| :--- | :---: | :---: | :--- |
| **Model Size on Disk** | 42.71 MB | 15.58 MB | EfficientNet-B0 is ~63% smaller |
| **Parameter Count** | 11,177,538 | 4,010,110 | EfficientNet-B0 has 64% fewer weights |
| **Mean Latency (B=1)** | **20.32 ms** | **25.92 ms** | ResNet-18 is faster on CPU |
| **Median Latency** | **20.13 ms** | **25.47 ms** | ResNet-18 exhibits lower median latency |
| **P95 Latency** | **22.83 ms** | **29.61 ms** | Lower tail latency |
| **P99 Latency** | **24.84 ms** | **32.36 ms** | Minimal tail jitter |

*Rationale:* Standard dense 3x3 convolutions in ResNet-18 map efficiently to AVX2 SIMD execution on x86 CPUs with high cache locality, whereas depthwise separable convolutions in EfficientNet-B0 suffer from higher memory-bandwidth overhead at batch size 1.

---

## 8. Comparison: Clean Evaluation (70/15/15) vs. Development Baseline (80/20)

| Metric | Development Baseline (80/20)<br>*(Leaked Validation Holdout)* | Clean Evaluation (70/15/15)<br>*(Untouched Test Set)* | Delta / Impact |
| :--- | :---: | :---: | :--- |
| **ResNet-18 Accuracy** | 98.58% | 98.74% | Realistic reflection of generalizability |
| **ResNet-18 Defect Recall** | 98.37% | 98.91% | Operational defect detection fidelity |
| **ResNet-18 FNR** | 1.63% (2/123 missed) | 1.09% (1/92 missed) | Strict clean holdout validation |
| **EfficientNet-B0 Accuracy** | 97.64% | 98.11% | Realistic reflection of generalizability |
| **EfficientNet-B0 Defect Recall** | 96.75% | 97.83% | Operational defect detection fidelity |
| **EfficientNet-B0 FNR** | 3.25% (4/123 missed) | 2.17% (2/92 missed) | Strict clean holdout validation |

---

## 9. Model Selection & Engineering Recommendation

### Candidate Model Selected: **ResNet-18**

#### Multidimensional Decision Matrix:
1. **Defect Recall & Operational Safety:** Missing visually defective produce is the costliest operational failure in food rescue. ResNet-18 minimizes missed defects with 98.91% recall and 1.09% FNR (1 missed defect out of 92) compared to EfficientNet-B0's 97.83% recall and 2.17% FNR (2 missed defects) at standard tau=0.50.
2. **CPU Inference Latency:** ResNet-18 executes in 20.32 ms on host CPU (vs. 25.92 ms for EfficientNet-B0), providing 21.6% lower inference latency for synchronous donation intake triage.
3. **Model Footprint Tradeoff:** Although EfficientNet-B0 is smaller (15.6 MB vs. 42.7 MB), the 42.7 MB checkpoint is well within host memory and deployment budgets.
4. **Architectural Simplicity & Explainability:** ResNet-18 provides straightforward Grad-CAM activation mapping on its final residual layer (`layer4`), facilitating human-in-the-loop auditing.

*Nuance:* Both models perform strongly on this dataset (>98% accuracy). ResNet-18 is selected specifically for its higher defect recall (lower FNR) and superior CPU latency profile.

---

## 10. Operational Scope, Safety Boundaries & Dataset Limitations

1. **Category Boundaries:**
   - Evaluated strictly on fresh produce (apples, bananas, oranges).
   - **Cooked Meals:** Current available evidence and datasets do not support reliable cooked-meal spoilage classification using RGB computer vision alone.
   - **Packaged Items:** Visual triage cannot validate opaque packaged-food contents or assess tamper seals reliably.
2. **Microbiological Food Safety Boundaries:**
   - Visual triage evaluates visual defect classification for AI-assisted visual food rescue assessment only.
   - The model **does not detect food safety** and **cannot prove food is safe**.
   - RGB computer vision cannot detect:
     - Bacterial pathogens (*Salmonella*, *Listeria*, *E. coli*)
     - Fungal toxins or aflatoxins
     - Chemical allergens
     - Historical temperature abuse or internal temperature history
3. **Dataset Bias & Environment Realism:**
   - Dataset consists of 1,058 images with studio/controlled lighting conditions.
   - Limited generalization to real donation environments (e.g., pantry lighting, camera glare, occluded angles).
   - Human review fallback remains mandatory.

---

## 11. Manifest of Artifacts & Files Created

| Path | Purpose |
| :--- | :--- |
| `experiments/task-002a/clean_eval/data/splits_70_15_15.json` | Deterministic 70/15/15 stratified train/val/test split manifest |
| `experiments/task-002a/clean_eval/train.py` | Clean training & per-epoch validation script (test set isolated) |
| `experiments/task-002a/clean_eval/evaluate.py` | Untouched test evaluation & CPU latency benchmark script |
| `experiments/task-002a/clean_eval/checkpoints/resnet18_best.pt` | Frozen ResNet-18 checkpoint selected on validation loss |
| `experiments/task-002a/clean_eval/checkpoints/efficientnet_b0_best.pt` | Frozen EfficientNet-B0 checkpoint selected on validation loss |
| `experiments/task-002a/clean_eval/results/validation_summary.json` | Validation history & frozen candidate threshold metrics |
| `experiments/task-002a/clean_eval/results/test_evaluation_metrics.json` | Final untouched test evaluation metrics & CPU latency data |
| `docs/TASK_002A_EXPERIMENT_REPORT.md` | Authoritative comprehensive experiment and evaluation report |

---

## 12. Verification & Next Milestone Gate

- [x] Strict 70/15/15 data separation verified (Test set untouched until final evaluation)
- [x] ResNet-18 and EfficientNet-B0 trained on identical 740-image partition
- [x] Checkpoint selection executed strictly on 159-image validation partition
- [x] Candidate threshold selection executed strictly on validation probabilities
- [x] Final evaluation executed strictly once on 159-image untouched test partition
- [x] CPU single-image latency benchmarked (100 runs, batch size 1)
- [x] Side-by-side comparison between Development Baseline and Clean Evaluation documented
- [x] Production code completely untouched (zero edits to backend, frontend, or data)
- [x] Documentation synchronized and status updated in `TASKS.md`
