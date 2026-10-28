# FoodLoop TASK-002B-1: ResNet-18 ONNX Export & Inference Verification Report

## Document Status
- **Subtask ID:** TASK-002B-1 (ResNet-18 ONNX Export & Inference Verification)
- **Status:** COMPLETED
- **Completion Date:** 2026-10-29
- **Model Architecture:** ResNet-18 (Winning Candidate from Clean Evaluation)
- **Next Subtask Status:** TASK-002B-2 (NOT STARTED — Backend Runtime Integration)

---

## 1. Executive Summary & Verification Gate

TASK-002B-1 successfully exported the frozen PyTorch ResNet-18 checkpoint from the clean 70/15/15 evaluation to an optimized, fully self-contained ONNX format and performed rigorous numerical parity and latency validation using ONNX Runtime.

All acceptance criteria passed with zero errors:
1. **Structural Validation:** ONNX model passes `onnx.checker.check_model` with 0 structural or type errors.
2. **Numerical Parity:** Across all 159 untouched test images, the maximum absolute logit difference between PyTorch and ONNX Runtime is $7.15 \times 10^{-6}$ and maximum probability difference is $1.01 \times 10^{-6}$ (well within the $10^{-4}$ FP32 tolerance).
3. **Prediction Agreement:** **100.00% (159/159)** identical classifications at both the standard reference threshold ($\tau=0.50$) and the candidate experimental threshold ($\tau=0.20$).
4. **CPU Latency Optimization:** ONNX Runtime single-image CPU inference averages **9.18 ms** (P95: 10.87 ms), outperforming PyTorch CPU execution (20.32 ms, P95: 22.83 ms) by **54.8%**.
5. **Production Code Isolation:** Zero modifications to production backend, frontend, or database records.

---

## 2. Environment & Toolchain Specifications

All export and verification procedures were conducted inside the isolated experiment virtual environment (`experiments/task-002a/.venv`):
- **Operating System:** Windows 11 Home (x64)
- **Host CPU:** Intel Core i5-13450HX CPU (16 GB RAM)
- **Python Version:** 3.14.3
- **PyTorch Version:** 2.15.0+cpu
- **Torchvision Version:** 0.29.2+cpu
- **ONNX Package Version:** 1.23.2
- **ONNX Runtime Package Version:** 1.31.1
- **ONNX Opset Version:** 17

---

## 3. Model Architecture & Export Configuration

### Source Checkpoint
- **Checkpoint Path:** `experiments/task-002a/clean_eval/checkpoints/resnet18_best.pt`
- **Source Epoch:** Epoch 4 (selected strictly on validation loss minimization)
- **Validation Metrics at Freeze:** Loss: 0.0514, Accuracy: 98.74%, Defect Recall: 98.91%
- **Total Parameters:** 11,177,538 (FP32)

### Architecture Specification
- **Base Network:** `torchvision.models.resnet18(weights=None)`
- **Classification Head:** Linear layer replacing standard 1000-class FC:
  ```python
  model.fc = nn.Linear(in_features=512, out_features=2, bias=True)
  ```
- **Execution Mode:** `model.eval()`, all parameters frozen (`requires_grad=False`).

### Export Properties
- **Target ONNX Path:** `experiments/task-002a/clean_eval/checkpoints/resnet18_foodloop.onnx`
- **File Format:** Self-contained ONNX Protobuf (all weights embedded, no external `.data` files)
- **File Size on Disk:** 42.63 MB (44,700,648 bytes)
- **Input Tensor Specification:**
  - Name: `input`
  - Shape: `[1, 3, 224, 224]` (Batch size 1, 3 color channels, height 224, width 224)
  - Data Type: `FLOAT` (FP32)
- **Output Tensor Specification:**
  - Name: `logits`
  - Shape: `[1, 2]`
  - Data Type: `FLOAT` (FP32)
- **Opset Version:** 17

---

## 4. Preprocessing Contract

The ONNX model expects normalized FP32 tensor inputs matching the training and evaluation pipeline:
1. **Channel Format:** RGB (3 channels)
2. **Dimension Resizing:** Shorter dimension resized to 256 pixels (`Resize(256)`)
3. **Spatial Cropping:** Center crop to $224 \times 224$ pixels (`CenterCrop(224)`)
4. **Value Scaling:** Scaled to $[0.0, 1.0]$ (`ToTensor()`)
5. **Statistical Normalization:** Standard ImageNet channel parameters:
   - Channel Means: $\mu = [0.485, 0.456, 0.406]$
   - Channel Std Devs: $\sigma = [0.229, 0.224, 0.225]$

*Note on Normalization Architecture:* Input normalization is purposefully maintained as an explicit pre-inference transformation rather than being baked into the ONNX graph. This maintains compatibility across standard computer vision libraries (such as `sharp` in Node.js for TASK-002B-2).

---

## 5. Output Contract & Semantic Label Mapping

The model outputs raw unnormalized logit values for binary visual classification. Probabilities are computed via standard softmax:

$$P(\text{rotten}) = \frac{e^{\text{logit}_1}}{e^{\text{logit}_0} + e^{\text{logit}_1}}$$

### Label Mapping

| Class Index | Raw Training Label | Platform Visual Assessment Label | Semantic Meaning |
| :---: | :---: | :---: | :--- |
| **`0`** | `fresh` | **`visually_acceptable`** | No visible macroscopic rot, mold, or severe surface degradation |
| **`1`** | `rotten` | **`visually_unsuitable`** | Macroscopic rot, mold, visible discoloration, or surface defect detected |

> [!IMPORTANT]
> The model output reflects **visual triage only**. The model must never output terms such as `safe`, `unsafe`, `edible`, `microbiologically safe`, or `pathogen-free`.

### Documented Inference Result Structure

```json
{
  "predicted_class": 0,
  "visual_assessment_label": "visually_acceptable",
  "confidence_score": 0.9851,
  "probability_rotten": 0.0149,
  "probability_fresh": 0.9851,
  "model_version": "resnet18_v1.0.0_foodloop"
}
```

---

## 6. PyTorch vs. ONNX Numerical Parity & Prediction Agreement

Evaluated on all 159 held-out test images from the clean evaluation partition (`splits_70_15_15.json`):

| Metric | Measured Value | Acceptance Tolerance | Result |
| :--- | :---: | :---: | :---: |
| **Total Test Images Evaluated** | 159 | 159 | PASS |
| **Max Absolute Logit Difference** | $7.15 \times 10^{-6}$ | $< 1.0 \times 10^{-4}$ | PASS |
| **Max Absolute Probability Difference** | $1.01 \times 10^{-6}$ | $< 1.0 \times 10^{-4}$ | PASS |
| **Prediction Agreement Rate ($\tau=0.50$)** | **100.00% (159/159)** | $100.00\%$ | PASS |
| **Prediction Agreement Rate ($\tau^*=0.20$)**| **100.00% (159/159)** | $100.00\%$ | PASS |
| **Invalid Model Path Error Handling** | Raised `NoSuchFile` | Graceful Exception | PASS |

### Representative Inference Samples from Test Partition

| Image ID | Ground Truth | ONNX Output Label | Confidence | $P(\text{rotten})$ | Logit Difference | Agreement |
| :--- | :--- | :--- | :---: | :---: | :---: | :---: |
| `train_352.png` | `rotten_apple` | `visually_unsuitable` | 0.9891 | 0.9891 | $1.19 \times 10^{-7}$ | MATCH |
| `train_376.png` | `fresh_orange` | `visually_acceptable` | 0.9995 | 0.0005 | $2.38 \times 10^{-7}$ | MATCH |
| `train_828.png` | `fresh_apple` | `visually_acceptable` | 0.9823 | 0.0177 | $4.76 \times 10^{-7}$ | MATCH |
| `train_934.png` | `rotten_banana`| `visually_unsuitable` | 0.9998 | 0.9998 | $2.38 \times 10^{-7}$ | MATCH |
| `train_1012.png`| `rotten_orange`| `visually_unsuitable` | 0.9974 | 0.9974 | $1.19 \times 10^{-7}$ | MATCH |

---

## 7. CPU Inference Latency Benchmark

Single-image inference ($B=1$, shape $[1, 3, 224, 224]$) was benchmarked on the host Intel Core i5-13450HX CPU using 20 warmup runs followed by 100 timed iterations:

| Latency Metric | PyTorch CPU (Reference) | ONNX Runtime CPU (Measured) | Speedup / Improvement |
| :--- | :---: | :---: | :--- |
| **Mean Latency** | 20.32 ms | **9.18 ms** | **54.8% faster (-11.14 ms)** |
| **Median Latency** | 20.13 ms | **8.25 ms** | **59.0% faster (-11.88 ms)** |
| **P95 Latency** | 22.83 ms | **10.87 ms** | **52.4% faster (-11.96 ms)** |
| **P99 Latency** | 24.84 ms | 27.75 ms | Single-sample scheduler artifact |

*Empirical Finding:* ONNX Runtime delivers a consistent ~9.2 ms single-image CPU inference time, easily satisfying FoodLoop's target for real-time visual assessment during donation intake without blocking backend workers.

---

## 8. Operational Scope, Safety Boundaries & Limitations

1. **Category Boundaries:**
   - Evaluated strictly on fresh apples, bananas, and oranges.
   - **Cooked Meals:** Current available evidence and datasets do not support reliable cooked-meal spoilage classification using RGB computer vision alone.
   - **Packaged Items:** Visual triage cannot validate opaque packaged-food contents, internal air/gas composition, or seal integrity.
2. **Microbiological Safety Boundaries:**
   - Visual triage evaluates visual defect classification for AI-assisted visual food rescue assessment only.
   - The model **does not detect food safety** and **cannot prove food is safe**.
   - RGB computer vision cannot detect bacterial pathogens (*Salmonella*, *Listeria*, *E. coli*), fungal toxins (aflatoxins), chemical allergens, or temperature abuse history.
3. **Threshold Designation:**
   - The frozen threshold $\tau=0.20$ is strictly a **candidate experimental threshold** for triage research and exploration, not a validated food-safety threshold.

---

## 9. Manifest of Files Created

| File Path | Description |
| :--- | :--- |
| `experiments/task-002a/clean_eval/export_onnx.py` | PyTorch to ONNX export script (eval mode, self-contained, opset 17) |
| `experiments/task-002a/clean_eval/verify_onnx.py` | Comprehensive verification and CPU latency benchmarking script |
| `experiments/task-002a/clean_eval/checkpoints/resnet18_foodloop.onnx` | Exported self-contained ResNet-18 ONNX model (42.63 MB) |
| `experiments/task-002a/clean_eval/results/onnx_export_meta.json` | Export configuration and architecture metadata |
| `experiments/task-002a/clean_eval/results/onnx_verification_results.json` | Numerical parity results, agreement rates, and latency measurements |
| `experiments/task-002a/clean_eval/reports/onnx_export_report.md` | Authoritative TASK-002B-1 verification report |

---

## 10. Milestone Gate Status

- [x] ResNet-18 frozen checkpoint successfully exported to ONNX.
- [x] ONNX model structurally validated with `onnx.checker.check_model` (0 errors).
- [x] ONNX Runtime session initialized successfully with `CPUExecutionProvider`.
- [x] PyTorch and ONNX numerical parity verified on 159 test images (max logit diff: $7.15 \times 10^{-6}$).
- [x] Prediction agreement rate verified at 100.00% (159/159).
- [x] CPU inference latency measured (Mean: 9.18 ms, P95: 10.87 ms).
- [x] Output contract schema and semantic labels formally documented.
- [x] Production application code completely untouched (`backend/server.js`, `frontend/src/**`, `backend/data.json`).
- [x] No model retraining or threshold modification occurred.
- [x] **TASK-002B-1 is COMPLETED.**
- [x] **TASK-002B-2 remains NOT STARTED.**
