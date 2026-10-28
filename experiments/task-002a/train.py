"""
FoodLoop TASK-002A: Training Script for Candidate Models
Trains ResNet-18 and EfficientNet-B0 under an identical protocol:
- Dataset: menasi11/fruit-classification (846 train / 212 test)
- Pretrained weights: ImageNet DEFAULT
- Loss: CrossEntropyLoss
- Optimizer: AdamW (lr=1e-4, weight_decay=1e-2)
- Scheduler: CosineAnnealingLR (T_max=5)
- Epochs: 5
- Batch size: 32
- Deterministic seed: 42
"""
import os
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

# 1. Deterministic Seeding
SEED = 42
random.seed(SEED)
np.random.seed(SEED)
torch.manual_seed(SEED)

BASE_DIR = r"C:\Users\LOQ\Documents\FOODLOOP\experiments\task-002a"
DATA_DIR = os.path.join(BASE_DIR, "data")
IMG_DIR = os.path.join(DATA_DIR, "images")
SPLITS_PATH = os.path.join(DATA_DIR, "splits.json")
CHECKPOINTS_DIR = os.path.join(BASE_DIR, "checkpoints")
RESULTS_DIR = os.path.join(BASE_DIR, "results")

os.makedirs(CHECKPOINTS_DIR, exist_ok=True)
os.makedirs(RESULTS_DIR, exist_ok=True)

class LocalFruitDataset(Dataset):
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

def get_dataloaders(batch_size=32):
    with open(SPLITS_PATH, 'r', encoding='utf-8') as f:
        splits = json.load(f)

    train_records = splits['train_data']
    test_records = splits['test_data']

    train_transform = transforms.Compose([
        transforms.Resize(256),
        transforms.RandomCrop(224),
        transforms.RandomHorizontalFlip(p=0.5),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
    ])

    test_transform = transforms.Compose([
        transforms.Resize(256),
        transforms.CenterCrop(224),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
    ])

    train_ds = LocalFruitDataset(train_records, transform=train_transform)
    test_ds = LocalFruitDataset(test_records, transform=test_transform)

    train_loader = DataLoader(train_ds, batch_size=batch_size, shuffle=True)
    test_loader = DataLoader(test_ds, batch_size=batch_size, shuffle=False)

    return train_loader, test_loader, len(train_records), len(test_records)

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

def train_and_validate(model_name, epochs=5, batch_size=32, lr=1e-4):
    print(f"\n=======================================================")
    print(f" TRAINING CANDIDATE: {model_name.upper()} (CPU Baseline)")
    print(f"=======================================================")
    
    train_loader, test_loader, n_train, n_test = get_dataloaders(batch_size=batch_size)
    model = build_model(model_name)
    
    total_params = sum(p.numel() for p in model.parameters())
    trainable_params = sum(p.numel() for p in model.parameters() if p.requires_grad)
    print(f"Total Parameters:     {total_params:,}")
    print(f"Trainable Parameters: {trainable_params:,}")

    criterion = nn.CrossEntropyLoss()
    optimizer = torch.optim.AdamW(model.parameters(), lr=lr, weight_decay=1e-2)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=epochs)

    history = []
    best_val_loss = float('inf')
    best_val_acc = 0.0
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

        # Validation phase on held-out test split
        model.eval()
        val_loss = 0.0
        correct_val = 0
        total_val = 0

        with torch.no_grad():
            for images, labels, _ in test_loader:
                outputs = model(images)
                loss = criterion(outputs, labels)
                val_loss += loss.item() * images.size(0)
                _, preds = torch.max(outputs, 1)
                correct_val += (preds == labels).sum().item()
                total_val += labels.size(0)

        val_loss = val_loss / total_val
        val_acc = correct_val / total_val
        epoch_duration = time.time() - epoch_start

        epoch_stats = {
            "epoch": epoch,
            "train_loss": round(train_loss, 4),
            "train_acc": round(train_acc, 4),
            "val_loss": round(val_loss, 4),
            "val_acc": round(val_acc, 4),
            "lr": round(scheduler.get_last_lr()[0], 6),
            "duration_s": round(epoch_duration, 2)
        }
        history.append(epoch_stats)

        print(f"Epoch [{epoch}/{epochs}] ({epoch_duration:.1f}s) | "
              f"Train Loss: {train_loss:.4f}, Acc: {train_acc*100:.1f}% | "
              f"Val Loss: {val_loss:.4f}, Acc: {val_acc*100:.1f}%")

        if val_loss < best_val_loss:
            best_val_loss = val_loss
            best_val_acc = val_acc
            torch.save({
                "epoch": epoch,
                "model_name": model_name,
                "model_state_dict": model.state_dict(),
                "val_loss": val_loss,
                "val_acc": val_acc,
                "seed": SEED,
                "total_params": total_params
            }, checkpoint_path)
            print(f"  -> Checkpoint saved to {checkpoint_path} (Best Val Loss: {val_loss:.4f})")

    total_training_time = time.time() - start_time
    print(f"\nTraining completed for {model_name} in {total_training_time:.1f}s ({total_training_time/60:.2f} min).")
    print(f"Best Validation Accuracy: {best_val_acc*100:.2f}%, Best Val Loss: {best_val_loss:.4f}")

    summary = {
        "model_name": model_name,
        "total_params": total_params,
        "trainable_params": trainable_params,
        "batch_size": batch_size,
        "epochs": epochs,
        "optimizer": "AdamW",
        "initial_lr": lr,
        "weight_decay": 0.01,
        "scheduler": "CosineAnnealingLR",
        "random_seed": SEED,
        "total_training_time_s": round(total_training_time, 2),
        "best_epoch": next(h['epoch'] for h in history if abs(h['val_loss'] - best_val_loss) < 1e-4),
        "best_val_loss": round(best_val_loss, 4),
        "best_val_acc": round(best_val_acc, 4),
        "history": history,
        "checkpoint_path": checkpoint_path
    }
    return summary

def main():
    print("Starting TASK-002A Candidate Training Pipeline...")
    res_summary = train_and_validate('resnet18', epochs=5, batch_size=32, lr=1e-4)
    eff_summary = train_and_validate('efficientnet_b0', epochs=5, batch_size=32, lr=1e-4)

    training_results = {
        "dataset": "menasi11/fruit-classification",
        "train_samples": 846,
        "test_samples": 212,
        "device": "CPU (Intel i5-13450HX 16 threads)",
        "models": {
            "resnet18": res_summary,
            "efficientnet_b0": eff_summary
        }
    }

    out_file = os.path.join(RESULTS_DIR, "training_summary.json")
    with open(out_file, 'w', encoding='utf-8') as f:
        json.dump(training_results, f, indent=2)
    print(f"\nTraining summaries saved to: {out_file}")

if __name__ == '__main__':
    main()
