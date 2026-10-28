"""
FoodLoop TASK-002A: Clean Evaluation Training Script
Enforces strict separation:
- Trains on TRAIN split (740 samples)
- Evaluates on VALIDATION split (159 samples) for checkpoint selection & threshold tuning
- TEST split is completely untouched (NOT LOADED BY THIS SCRIPT)
"""
import os
import sys
import time
import json
import random
import numpy as np
import PIL.Image
import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader
import torchvision.transforms as transforms
import torchvision.models as models
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, confusion_matrix

# Deterministic Seed
SEED = 42
random.seed(SEED)
np.random.seed(SEED)
torch.manual_seed(SEED)

BASE_DIR = r"C:\Users\LOQ\Documents\FOODLOOP\experiments\task-002a"
IMG_DIR = os.path.join(BASE_DIR, "data", "images")
CLEAN_DIR = os.path.join(BASE_DIR, "clean_eval")
SPLITS_PATH = os.path.join(CLEAN_DIR, "data", "splits_70_15_15.json")
CHECKPOINTS_DIR = os.path.join(CLEAN_DIR, "checkpoints")
RESULTS_DIR = os.path.join(CLEAN_DIR, "results")

os.makedirs(CHECKPOINTS_DIR, exist_ok=True)
os.makedirs(RESULTS_DIR, exist_ok=True)

class CleanSplitDataset(Dataset):
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

        return img, target, rec['Id']

def get_train_val_loaders(batch_size=32):
    with open(SPLITS_PATH, 'r', encoding='utf-8') as f:
        splits = json.load(f)

    train_records = splits['train_data']
    val_records = splits['val_data']
    # NOTE: test_records are intentionally NOT loaded here to guarantee zero leakage!

    train_transform = transforms.Compose([
        transforms.Resize(256),
        transforms.RandomCrop(224),
        transforms.RandomHorizontalFlip(p=0.5),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
    ])

    val_transform = transforms.Compose([
        transforms.Resize(256),
        transforms.CenterCrop(224),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
    ])

    train_ds = CleanSplitDataset(train_records, transform=train_transform)
    val_ds = CleanSplitDataset(val_records, transform=val_transform)

    train_loader = DataLoader(train_ds, batch_size=batch_size, shuffle=True)
    val_loader = DataLoader(val_ds, batch_size=batch_size, shuffle=False)

    return train_loader, val_loader, len(train_records), len(val_records)

def build_model(model_name):
    if model_name == 'resnet18':
        model = models.resnet18(weights=models.ResNet18_Weights.DEFAULT)
        in_features = model.fc.in_features
        model.fc = nn.Linear(in_features, 2)
    elif model_name == 'efficientnet_b0':
        model = models.efficientnet_b0(weights=models.EfficientNet_B0_Weights.DEFAULT)
        in_features = model.classifier[1].in_features
        model.classifier[1] = nn.Linear(in_features, 2)
    else:
        raise ValueError(f"Unknown model name: {model_name}")
    return model

def analyze_validation_thresholds(y_true, y_prob):
    # Candidate threshold evaluation on VALIDATION ONLY
    thresholds = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]
    analysis = []
    best_candidate_tau = 0.50
    best_candidate_f1 = 0.0

    for tau in thresholds:
        preds = (y_prob >= tau).astype(int)
        cm = confusion_matrix(y_true, preds, labels=[0, 1])
        tn, fp, fn, tp = cm.ravel()
        prec = precision_score(y_true, preds, pos_label=1, zero_division=0)
        rec = recall_score(y_true, preds, pos_label=1, zero_division=0)
        f1 = f1_score(y_true, preds, pos_label=1, zero_division=0)
        fpr = fp / (fp + tn) if (fp + tn) > 0 else 0.0
        fnr = fn / (fn + tp) if (fn + tp) > 0 else 0.0

        item = {
            "tau": round(tau, 2),
            "val_precision": round(prec, 4),
            "val_recall": round(rec, 4),
            "val_f1": round(f1, 4),
            "val_fpr": round(fpr, 4),
            "val_fnr": round(fnr, 4),
            "TP": int(tp), "FP": int(fp), "TN": int(tn), "FN": int(fn)
        }
        analysis.append(item)

        # Optimization policy for food rescue: high recall (<= 2% FNR) with highest F1
        if rec >= 0.97 and f1 > best_candidate_f1:
            best_candidate_f1 = f1
            best_candidate_tau = tau

    return analysis, best_candidate_tau

def train_and_validate(model_name, epochs=5, batch_size=32, lr=1e-4):
    print(f"\n=======================================================", flush=True)
    print(f" CLEAN TRAINING & VALIDATION: {model_name.upper()}", flush=True)
    print(f"=======================================================", flush=True)

    train_loader, val_loader, n_train, n_val = get_train_val_loaders(batch_size=batch_size)
    print(f"Train samples: {n_train} | Validation samples: {n_val} (Test set is untouched)", flush=True)

    model = build_model(model_name)
    total_params = sum(p.numel() for p in model.parameters())

    criterion = nn.CrossEntropyLoss()
    optimizer = torch.optim.AdamW(model.parameters(), lr=lr, weight_decay=1e-2)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=epochs)

    history = []
    best_val_loss = float('inf')
    best_val_acc = 0.0
    best_epoch = 1
    checkpoint_path = os.path.join(CHECKPOINTS_DIR, f"{model_name}_best.pt")

    start_time = time.time()

    for epoch in range(1, epochs + 1):
        epoch_start = time.time()
        model.train()
        running_loss = 0.0
        correct_train = 0
        total_train = 0

        for images, labels, _ in train_loader:
            optimizer.zero_grad()
            outputs = model(images)
            loss = criterion(outputs, labels)
            loss.backward()
            optimizer.step()

            running_loss += loss.item() * images.size(0)
            _, preds = torch.max(outputs, 1)
            correct_train += (preds == labels).sum().item()
            total_train += labels.size(0)

        scheduler.step()
        train_loss = running_loss / total_train
        train_acc = correct_train / total_train

        # Validation pass (ONLY on validation split)
        model.eval()
        val_loss = 0.0
        val_y_true = []
        val_y_pred = []
        val_y_prob = []

        with torch.no_grad():
            for images, labels, _ in val_loader:
                outputs = model(images)
                loss = criterion(outputs, labels)
                val_loss += loss.item() * images.size(0)
                probs = torch.softmax(outputs, dim=1)
                preds = torch.argmax(probs, dim=1)

                val_y_true.extend(labels.tolist())
                val_y_pred.extend(preds.tolist())
                val_y_prob.extend(probs[:, 1].tolist())

        val_loss = val_loss / len(val_y_true)
        val_acc = accuracy_score(val_y_true, val_y_pred)
        val_rec = recall_score(val_y_true, val_y_pred, pos_label=1, zero_division=0)
        val_prec = precision_score(val_y_true, val_y_pred, pos_label=1, zero_division=0)
        val_f1 = f1_score(val_y_true, val_y_pred, pos_label=1, zero_division=0)
        epoch_duration = time.time() - epoch_start

        epoch_stats = {
            "epoch": epoch,
            "train_loss": round(train_loss, 4),
            "train_acc": round(train_acc, 4),
            "val_loss": round(val_loss, 4),
            "val_acc": round(val_acc, 4),
            "val_recall_defect": round(val_rec, 4),
            "val_f1": round(val_f1, 4),
            "duration_s": round(epoch_duration, 2)
        }
        history.append(epoch_stats)

        print(f"Epoch [{epoch}/{epochs}] ({epoch_duration:.1f}s) | "
              f"Train Loss: {train_loss:.4f}, Acc: {train_acc*100:.1f}% | "
              f"Val Loss: {val_loss:.4f}, Val Acc: {val_acc*100:.1f}%, Val Defect Recall: {val_rec*100:.1f}%", flush=True)

        # Checkpoint selection strictly based on VALIDATION loss
        if val_loss < best_val_loss:
            best_val_loss = val_loss
            best_val_acc = val_acc
            best_epoch = epoch
            torch.save({
                "epoch": epoch,
                "model_name": model_name,
                "model_state_dict": model.state_dict(),
                "val_loss": val_loss,
                "val_acc": val_acc,
                "seed": SEED,
                "total_params": total_params
            }, checkpoint_path)
            print(f"  -> Best Validation Checkpoint saved (Epoch {epoch}, Val Loss: {val_loss:.4f})", flush=True)

    total_training_time = time.time() - start_time

    # Load the best saved checkpoint to perform frozen validation threshold selection
    best_ckpt = torch.load(checkpoint_path, map_location='cpu')
    model.load_state_dict(best_ckpt['model_state_dict'])
    model.eval()

    val_y_true = []
    val_y_prob = []
    with torch.no_grad():
        for images, labels, _ in val_loader:
            outputs = model(images)
            probs = torch.softmax(outputs, dim=1)
            val_y_true.extend(labels.tolist())
            val_y_prob.extend(probs[:, 1].tolist())

    threshold_sweep, frozen_tau = analyze_validation_thresholds(np.array(val_y_true), np.array(val_y_prob))
    print(f"Validation threshold analysis complete. Frozen Candidate Tau: {frozen_tau}", flush=True)

    summary = {
        "model_name": model_name,
        "total_params": total_params,
        "batch_size": batch_size,
        "epochs": epochs,
        "optimizer": "AdamW",
        "initial_lr": lr,
        "weight_decay": 0.01,
        "scheduler": "CosineAnnealingLR",
        "random_seed": SEED,
        "total_training_time_s": round(total_training_time, 2),
        "best_epoch": best_epoch,
        "best_val_loss": round(best_val_loss, 4),
        "best_val_acc": round(best_val_acc, 4),
        "history": history,
        "checkpoint_path": checkpoint_path,
        "validation_threshold_sweep": threshold_sweep,
        "frozen_candidate_tau": frozen_tau
    }
    return summary

def main():
    print("Starting Clean Evaluation Training Pipeline (70 Train / 15 Val / 15 Test)...", flush=True)
    res_summary = train_and_validate('resnet18', epochs=5, batch_size=32, lr=1e-4)
    eff_summary = train_and_validate('efficientnet_b0', epochs=5, batch_size=32, lr=1e-4)

    training_results = {
        "split_strategy": "70% Train (740) / 15% Validation (159) / 15% Test (159)",
        "train_samples": 740,
        "val_samples": 159,
        "test_samples_untouched": 159,
        "device": "CPU (Intel i5-13450HX)",
        "models": {
            "resnet18": res_summary,
            "efficientnet_b0": eff_summary
        }
    }

    out_file = os.path.join(RESULTS_DIR, "validation_summary.json")
    with open(out_file, 'w', encoding='utf-8') as f:
        json.dump(training_results, f, indent=2)
    print(f"\nClean validation summaries saved to: {out_file}", flush=True)

if __name__ == '__main__':
    main()
