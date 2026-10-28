# FoodLoop TASK-002A: Model Comparison & Benchmark Results

## Evaluation Summary
- **Held-Out Test Set Size:** 212 images (89 Fresh, 123 Rotten)
- **Evaluation Environment:** CPU Single-Threaded/Multi-Threaded (13th Gen Intel Core i5-13450HX)
- **Primary Optimization Focus:** Rotten/Defect Recall (minimizing False Negatives) and False Positive Rate (minimizing unnecessary food waste).

---

## 1. Head-to-Head Comparison Table

| Metric | ResNet-18 | EfficientNet-B0 | Comparison / Analysis |
| :--- | :---: | :---: | :--- |
| **Total Parameters** | 11,177,538 | **4,010,110** | EfficientNet-B0 has ~54.8% fewer parameters |
| **Model Size on Disk** | 42.71 MB | **15.58 MB** | EfficientNet-B0 is ~54% smaller binary footprint |
| **Accuracy** | 98.58% | 97.64% | Both models achieve high baseline classification |
| **Balanced Accuracy** | 98.63% | 97.81% | Normalized class performance |
| **Rotten / Defect Recall** | **98.37%** | 96.75% | **Primary Food Rescue Safety Metric** |
| **Rotten / Defect Precision** | 99.18% | 99.17% | Precision on unsuitable items |
| **Rotten F1-Score** | 0.9878 | 0.9794 | Harmonic balance of defect screening |
| **Macro F1-Score** | 0.9855 | 0.9759 | Balanced multi-class score |
| **False Negative Rate (FNR)** | **1.63%** | 3.25% | Rotten food missed (Safety concern) |
| **False Positive Rate (FPR)** | 1.12% | 1.12% | Fresh food misclassified as rotten (Waste concern) |
| **ROC-AUC** | 0.9973 | 0.9977 | Area under ROC curve |
| **PR-AUC** | 0.9982 | 0.9984 | Precision-Recall AUC on defect class |
| **Mean CPU Latency (B=1)** | 24.81 ms | 31.36 ms | Host CPU single-image inference |
| **P95 CPU Latency (B=1)** | 27.84 ms | 37.0 ms | 95th percentile host latency |
| **P99 CPU Latency (B=1)** | 28.3 ms | 48.1 ms | Tail latency on CPU |

---

## 2. Confusion Matrices

### ResNet-18 (Default Threshold $\tau = 0.50$):
- **True Negative (Fresh predicted Fresh):** 88
- **False Positive (Fresh predicted Rotten):** 1
- **False Negative (Rotten predicted Fresh):** 2
- **True Positive (Rotten predicted Rotten):** 121

### EfficientNet-B0 (Default Threshold $\tau = 0.50$):
- **True Negative (Fresh predicted Fresh):** 88
- **False Positive (Fresh predicted Rotten):** 1
- **False Negative (Rotten predicted Fresh):** 4
- **True Positive (Rotten predicted Rotten):** 119

---

## 3. Candidate Decision Threshold Operating Points ($\tau$)

### ResNet-18 Operating Points:
| Threshold $\tau$ | Defect Precision | Defect Recall | Defect F1 | False Positive Rate | False Negative Rate |
| :---: | :---: | :---: | :---: | :---: | :---: |
| 0.10 | 94.57% | 99.19% | 0.9683 | 7.87% | 0.81% |
| 0.20 | 96.03% | 98.37% | 0.9719 | 5.62% | 1.63% |
| 0.30 | 97.58% | 98.37% | 0.9798 | 3.37% | 1.63% |
| 0.40 | 99.18% | 98.37% | 0.9878 | 1.12% | 1.63% |
| 0.50 | 99.18% | 98.37% | 0.9878 | 1.12% | 1.63% |
| 0.60 | 99.17% | 97.56% | 0.9836 | 1.12% | 2.44% |
| 0.70 | 99.17% | 96.75% | 0.9794 | 1.12% | 3.25% |
| 0.80 | 99.17% | 96.75% | 0.9794 | 1.12% | 3.25% |
| 0.90 | 100.00% | 95.93% | 0.9793 | 0.00% | 4.07% |

### EfficientNet-B0 Operating Points:
| Threshold $\tau$ | Defect Precision | Defect Recall | Defect F1 | False Positive Rate | False Negative Rate |
| :---: | :---: | :---: | :---: | :---: | :---: |
| 0.10 | 92.48% | 100.00% | 0.9609 | 11.24% | 0.00% |
| 0.20 | 94.57% | 99.19% | 0.9683 | 7.87% | 0.81% |
| 0.30 | 95.28% | 98.37% | 0.9680 | 6.74% | 1.63% |
| 0.40 | 97.56% | 97.56% | 0.9756 | 3.37% | 2.44% |
| 0.50 | 99.17% | 96.75% | 0.9794 | 1.12% | 3.25% |
| 0.60 | 99.16% | 95.93% | 0.9752 | 1.12% | 4.07% |
| 0.70 | 100.00% | 94.31% | 0.9707 | 0.00% | 5.69% |
| 0.80 | 100.00% | 91.87% | 0.9576 | 0.00% | 8.13% |
| 0.90 | 100.00% | 85.37% | 0.9211 | 0.00% | 14.63% |
