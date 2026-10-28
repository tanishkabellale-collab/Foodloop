"""
FoodLoop TASK-002B-1: ResNet-18 ONNX Export Script
Exports the frozen ResNet-18 checkpoint to a self-contained ONNX format.
Strict bounds:
- Inference only (eval mode)
- Fixed input shape [1, 3, 224, 224] FP32 RGB
- Preserves exact preprocessing contract without retraining
- Self-contained ONNX protobuf (weights embedded, <2GB standard)
- Zero changes to production code
"""
import os
import sys

if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

import json
import time
import torch
import torch.nn as nn
import torchvision.models as models
import onnx

BASE_DIR = r"C:\Users\LOQ\Documents\FOODLOOP\experiments\task-002a"
CLEAN_DIR = os.path.join(BASE_DIR, "clean_eval")
CHECKPOINT_PATH = os.path.join(CLEAN_DIR, "checkpoints", "resnet18_best.pt")
ONNX_OUTPUT_PATH = os.path.join(CLEAN_DIR, "checkpoints", "resnet18_foodloop.onnx")
EXTERNAL_DATA_PATH = os.path.join(CLEAN_DIR, "checkpoints", "resnet18_foodloop.onnx.data")
META_OUTPUT_PATH = os.path.join(CLEAN_DIR, "results", "onnx_export_meta.json")

def export_model():
    print("=" * 60)
    print(" FOODLOOP TASK-002B-1: RESNET-18 ONNX EXPORT")
    print("=" * 60)

    if not os.path.exists(CHECKPOINT_PATH):
        raise FileNotFoundError(f"Checkpoint not found at: {CHECKPOINT_PATH}")

    # Remove any existing external data file to keep deployment self-contained
    if os.path.exists(EXTERNAL_DATA_PATH):
        os.remove(EXTERNAL_DATA_PATH)
        print(f"Removed old external data file: {EXTERNAL_DATA_PATH}")

    print(f"Loading checkpoint from: {CHECKPOINT_PATH}")
    ckpt = torch.load(CHECKPOINT_PATH, map_location='cpu')

    epoch = ckpt.get("epoch", 4)
    val_loss = ckpt.get("val_loss", None)
    val_acc = ckpt.get("val_acc", None)
    seed = ckpt.get("seed", 42)
    print(f"Checkpoint metadata: Epoch={epoch}, ValLoss={val_loss:.4f}, ValAcc={val_acc*100:.2f}%, Seed={seed}")

    # Instantiate ResNet-18 architecture matching train.py
    model = models.resnet18(weights=None)
    in_features = model.fc.in_features
    model.fc = nn.Linear(in_features, 2)

    # Load frozen weights
    model.load_state_dict(ckpt["model_state_dict"])
    model.eval()
    for param in model.parameters():
        param.requires_grad = False

    print("Model initialized and set to eval() mode (inference-only).")

    # Define dummy input matching required input contract: [1, 3, 224, 224] FP32 RGB
    dummy_input = torch.randn(1, 3, 224, 224, dtype=torch.float32)

    opset_version = 17
    print(f"Exporting to self-contained ONNX with opset_version={opset_version}...")

    start_time = time.time()
    torch.onnx.export(
        model,
        dummy_input,
        ONNX_OUTPUT_PATH,
        export_params=True,
        opset_version=opset_version,
        do_constant_folding=True,
        input_names=['input'],
        output_names=['logits'],
        dynamo=False
    )
    export_duration = time.time() - start_time
    print(f"Export completed in {export_duration:.2f}s -> {ONNX_OUTPUT_PATH}")

    # Structural verification with onnx
    print("Validating exported ONNX graph structure...")
    onnx_model = onnx.load(ONNX_OUTPUT_PATH)
    onnx.checker.check_model(onnx_model)
    print("ONNX model structurally validated with onnx.checker.check_model (0 errors).")

    file_size_mb = os.path.getsize(ONNX_OUTPUT_PATH) / (1024 * 1024)
    print(f"ONNX Model File Size: {file_size_mb:.2f} MB (fully self-contained)")

    export_meta = {
        "task": "TASK-002B-1",
        "model_architecture": "resnet18",
        "source_checkpoint": CHECKPOINT_PATH,
        "source_epoch": epoch,
        "source_val_loss": round(val_loss, 4) if val_loss else None,
        "source_val_acc": round(val_acc, 4) if val_acc else None,
        "onnx_output_path": ONNX_OUTPUT_PATH,
        "onnx_file_size_mb": round(file_size_mb, 2),
        "onnx_version": onnx.__version__,
        "opset_version": opset_version,
        "is_self_contained": True,
        "input_name": "input",
        "input_shape": [1, 3, 224, 224],
        "input_dtype": "FP32",
        "output_name": "logits",
        "output_shape": [1, 2],
        "output_dtype": "FP32",
        "export_duration_s": round(export_duration, 4),
        "preprocessing_contract": {
            "channels": "RGB",
            "resize": 256,
            "center_crop": 224,
            "normalization_mean": [0.485, 0.456, 0.406],
            "normalization_std": [0.229, 0.224, 0.225]
        },
        "output_mapping": {
            "0": "visually_acceptable",
            "1": "visually_unsuitable"
        },
        "candidate_experimental_threshold": 0.20,
        "default_threshold": 0.50
    }

    with open(META_OUTPUT_PATH, 'w', encoding='utf-8') as f:
        json.dump(export_meta, f, indent=2)
    print(f"Export metadata written to: {META_OUTPUT_PATH}")

if __name__ == "__main__":
    export_model()
