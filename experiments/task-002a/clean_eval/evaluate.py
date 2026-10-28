"""
FoodLoop TASK-002A: Clean Evaluation Test Script
Evaluates the frozen checkpoints and frozen candidate thresholds strictly ONCE
on the held-out, previously untouched TEST split (159 samples).
"""
import os
import time
import json
import numpy as np
import PIL.Image
import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader
import torchvision.transforms as transforms
import torchvision.models as models
from sklearn.metrics import (
    accuracy_score, balanced_accuracy_score, precision_score,
    recall_score, f1_score, confusion_matrix, roc_auc_score,
    average_precision_score
)

BASE_DIR = r"C:\Users\LOQ\Documents\FOODLOOP\experiments\task-002a"
IMG_DIR = os.path.join(BASE_DIR, "data", "images")
CLEAN_DIR = os.path.join(BASE_DIR, "clean_eval")
SPLITS_PATH = os.path.join(CLEAN_DIR, "data", "splits_70_15_15.json")
CHECKPOINTS_DIR = os.path.join(CLEAN_DIR, "checkpoints")
RESULTS_DIR = os.path.join(CLEAN_DIR, "results")
REPORTS_DIR = os.path.join(CLEAN_DIR, "reports")

class TestDataset(Dataset):
    def __init__(self, records, transform=None):
        self.records = records
        self.transform = transform

    def __len__(self):
        return len(self.records)

    def __getitem__(self, idx):
        rec = self.records[idx]
        img_path = os.path.join(IMG_DIR, rec['Id'])
        img = PIL.Image.open(img_path).convert('RGB')
        target = rec['binary_label']

        if self.transform:
            img = self.transform(img)

        return img, target, rec['Id'], rec['Label']

def load_clean_model(model_name):
    ckpt_path = os.path.join(CHECKPOINTS_DIR, f"{model_name}_best.pt")
    ckpt = torch.load(ckpt_path, map_location='cpu')

    if model_name == 'resnet18':
        model = models.resnet18(weights=None)
        model.fc = nn.Linear(model.fc.in_features, 2)
    elif model_name == 'efficientnet_b0':
        model = models.efficientnet_b0(weights=None)
        model.classifier[1] = nn.Linear(model.classifier[1].in_features, 2)
    else:
        raise ValueError(f"Unknown model: {model_name}")

    model.load_state_dict(ckpt['model_state_dict'])
    model.eval()

    file_size_mb = os.path.getsize(ckpt_path) / (1024 * 1024)
    total_params = sum(p.numel() for p in model.parameters())

    return model, ckpt['epoch'], file_size_mb, total_params

def evaluate_on_untouched_test_set(model, test_loader, frozen_tau=0.50):
    y_true = []
    y_prob_rotten = []
    ids = []
    fine_labels = []

    with torch.no_grad():
        for images, targets, batch_ids, batch_fine in test_loader:
            outputs = model(images)
            probs = torch.softmax(outputs, dim=1)

            y_true.extend(targets.tolist())
            y_prob_rotten.extend(probs[:, 1].tolist())
            ids.extend(batch_ids)
            fine_labels.extend(batch_fine)

    y_true = np.array(y_true)
    y_prob = np.array(y_prob_rotten)

    def compute_metrics_at_tau(tau):
        preds = (y_prob >= tau).astype(int)
        acc = accuracy_score(y_true, preds)
        bacc = balanced_accuracy_score(y_true, preds)
        prec_macro = precision_score(y_true, preds, average='macro', zero_division=0)
        rec_macro = recall_score(y_true, preds, average='macro', zero_division=0)
        f1_macro = f1_score(y_true, preds, average='macro', zero_division=0)

        prec_rot = precision_score(y_true, preds, pos_label=1, zero_division=0)
        rec_rot = recall_score(y_true, preds, pos_label=1, zero_division=0)
        f1_rot = f1_score(y_true, preds, pos_label=1, zero_division=0)

        prec_fresh = precision_score(y_true, preds, pos_label=0, zero_division=0)
        rec_fresh = recall_score(y_true, preds, pos_label=0, zero_division=0)
        f1_fresh = f1_score(y_true, preds, pos_label=0, zero_division=0)

        cm = confusion_matrix(y_true, preds, labels=[0, 1])
        tn, fp, fn, tp = cm.ravel()
        fpr = fp / (fp + tn) if (fp + tn) > 0 else 0.0
        fnr = fn / (fn + tp) if (fn + tp) > 0 else 0.0

        return {
            "threshold_tau": round(tau, 2),
            "accuracy": round(acc, 4),
            "balanced_accuracy": round(bacc, 4),
            "macro_precision": round(prec_macro, 4),
            "macro_recall": round(rec_macro, 4),
            "macro_f1": round(f1_macro, 4),
            "rotten_precision": round(prec_rot, 4),
            "rotten_recall": round(rec_rot, 4),
            "rotten_f1": round(f1_rot, 4),
            "fresh_precision": round(prec_fresh, 4),
            "fresh_recall": round(rec_fresh, 4),
            "fresh_f1": round(f1_fresh, 4),
            "confusion_matrix": {"TN": int(tn), "FP": int(fp), "FN": int(fn), "TP": int(tp)},
            "false_positive_rate": round(fpr, 4),
            "false_negative_rate": round(fnr, 4)
        }

    # Standard 0.50 threshold evaluation
    metrics_default = compute_metrics_at_tau(0.50)

    # Frozen validation candidate threshold evaluation
    metrics_frozen_tau = compute_metrics_at_tau(frozen_tau)

    # Global probability curve metrics
    roc_auc = roc_auc_score(y_true, y_prob)
    pr_auc = average_precision_score(y_true, y_prob)

    return {
        "metrics_default_tau_0_50": metrics_default,
        "metrics_frozen_candidate_tau": metrics_frozen_tau,
        "roc_auc": round(roc_auc, 4),
        "pr_auc": round(pr_auc, 4)
    }

def benchmark_cpu_latency(model, input_shape=(1, 3, 224, 224), warmup=20, iterations=100):
    dummy_input = torch.randn(*input_shape)
    for _ in range(warmup):
        _ = model(dummy_input)

    latencies_ms = []
    for _ in range(iterations):
        t0 = time.perf_counter()
        _ = model(dummy_input)
        t1 = time.perf_counter()
        latencies_ms.append((t1 - t0) * 1000.0)

    latencies_ms = np.array(latencies_ms)
    return {
        "iterations": iterations,
        "mean_latency_ms": round(float(np.mean(latencies_ms)), 2),
        "median_latency_ms": round(float(np.median(latencies_ms)), 2),
        "p95_latency_ms": round(float(np.percentile(latencies_ms, 95)), 2),
        "p99_latency_ms": round(float(np.percentile(latencies_ms, 99)), 2)
    }

def main():
    print("=======================================================", flush=True)
    print(" EXECUTING FINAL UNTOUCHED TEST EVALUATION (159 Samples)", flush=True)
    print("=======================================================", flush=True)

    with open(SPLITS_PATH, 'r', encoding='utf-8') as f:
        splits = json.load(f)

    test_records = splits['test_data']
    print(f"Untouched Test Set Size: {len(test_records)} images (Fresh: {splits['test_class_distribution']['0']}, Rotten: {splits['test_class_distribution']['1']})", flush=True)

    # Load validation summary to get frozen thresholds and best epochs
    val_summary_path = os.path.join(RESULTS_DIR, "validation_summary.json")
    with open(val_summary_path, 'r', encoding='utf-8') as f:
        val_summary = json.load(f)

    test_transform = transforms.Compose([
        transforms.Resize(256),
        transforms.CenterCrop(224),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
    ])

    test_ds = TestDataset(test_records, transform=test_transform)
    test_loader = DataLoader(test_ds, batch_size=32, shuffle=False)

    results = {}

    for model_name in ['resnet18', 'efficientnet_b0']:
        frozen_tau = val_summary['models'][model_name]['frozen_candidate_tau']
        print(f"\nEvaluating {model_name} on untouched test set...", flush=True)
        print(f"  Frozen Candidate Tau from Validation: {frozen_tau}", flush=True)

        model, best_epoch, file_size_mb, total_params = load_clean_model(model_name)
        test_eval = evaluate_on_untouched_test_set(model, test_loader, frozen_tau=frozen_tau)

        m05 = test_eval['metrics_default_tau_0_50']
        print(f"  [Default tau=0.50] Acc: {m05['accuracy']*100:.2f}% | Defect Recall: {m05['rotten_recall']*100:.2f}% | FNR: {m05['false_negative_rate']*100:.2f}% | FPR: {m05['false_positive_rate']*100:.2f}%", flush=True)
        print(f"    Confusion Matrix: TN={m05['confusion_matrix']['TN']}, FP={m05['confusion_matrix']['FP']}, FN={m05['confusion_matrix']['FN']}, TP={m05['confusion_matrix']['TP']}", flush=True)

        mtau = test_eval['metrics_frozen_candidate_tau']
        print(f"  [Frozen tau={frozen_tau}] Acc: {mtau['accuracy']*100:.2f}% | Defect Recall: {mtau['rotten_recall']*100:.2f}% | FNR: {mtau['false_negative_rate']*100:.2f}% | FPR: {mtau['false_positive_rate']*100:.2f}%", flush=True)

        print(f"  Benchmarking CPU Single-Image Latency (100 runs)...", flush=True)
        latency = benchmark_cpu_latency(model)
        print(f"    Mean: {latency['mean_latency_ms']} ms | P95: {latency['p95_latency_ms']} ms", flush=True)

        results[model_name] = {
            "best_epoch_selected": best_epoch,
            "total_parameters": total_params,
            "checkpoint_size_mb": round(file_size_mb, 2),
            "frozen_candidate_tau": frozen_tau,
            "test_evaluation": test_eval,
            "latency_cpu": latency
        }

    # Save clean test evaluation results
    out_file = os.path.join(RESULTS_DIR, "test_evaluation_metrics.json")
    with open(out_file, 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=2)
    print(f"\nFinal untouched test evaluation saved to: {out_file}", flush=True)

if __name__ == '__main__':
    main()
