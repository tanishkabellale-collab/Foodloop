"""
FoodLoop TASK-002B-1: ResNet-18 ONNX Verification & Latency Benchmark Script
Validates:
1. Structural ONNX graph integrity
2. ONNX Runtime initialization
3. PyTorch vs. ONNX numerical parity (logits & softmax probabilities)
4. Prediction agreement across representative dataset images
5. CPU latency benchmark (100 runs, batch size 1)
6. Output contract schema definition
7. Invalid model path error handling
"""
import os
import sys

if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

import time
import json
import numpy as np
import PIL.Image
import torch
import torch.nn as nn
import torchvision.models as models
import torchvision.transforms as transforms
import onnx
import onnxruntime as ort

BASE_DIR = r"C:\Users\LOQ\Documents\FOODLOOP\experiments\task-002a"
CLEAN_DIR = os.path.join(BASE_DIR, "clean_eval")
IMG_DIR = os.path.join(BASE_DIR, "data", "images")
SPLITS_PATH = os.path.join(CLEAN_DIR, "data", "splits_70_15_15.json")
CHECKPOINT_PATH = os.path.join(CLEAN_DIR, "checkpoints", "resnet18_best.pt")
ONNX_PATH = os.path.join(CLEAN_DIR, "checkpoints", "resnet18_foodloop.onnx")
RESULTS_DIR = os.path.join(CLEAN_DIR, "results")
REPORTS_DIR = os.path.join(CLEAN_DIR, "reports")
VERIFICATION_OUTPUT_PATH = os.path.join(RESULTS_DIR, "onnx_verification_results.json")

os.makedirs(RESULTS_DIR, exist_ok=True)
os.makedirs(REPORTS_DIR, exist_ok=True)

MODEL_VERSION = "resnet18_v1.0.0_foodloop"
CANDIDATE_TAU = 0.20
DEFAULT_TAU = 0.50

LABEL_MAPPING = {
    0: "visually_acceptable",
    1: "visually_unsuitable"
}

def np_softmax(x):
    e_x = np.exp(x - np.max(x, axis=1, keepdims=True))
    return e_x / e_x.sum(axis=1, keepdims=True)

def verify_structural_integrity(onnx_path):
    print("\n--- TEST 1: ONNX Structural Validation ---")
    if not os.path.exists(onnx_path):
        raise FileNotFoundError(f"ONNX model file missing: {onnx_path}")

    model = onnx.load(onnx_path)
    onnx.checker.check_model(model)
    print("✓ onnx.checker.check_model passed with 0 errors.")

    # Inspect inputs & outputs
    graph = model.graph
    input_info = graph.input[0]
    output_info = graph.output[0]

    input_name = input_info.name
    output_name = output_info.name
    input_shape = [d.dim_value for d in input_info.type.tensor_type.shape.dim]
    output_shape = [d.dim_value for d in output_info.type.tensor_type.shape.dim]

    print(f"✓ Input tensor: name='{input_name}', shape={input_shape}")
    print(f"✓ Output tensor: name='{output_name}', shape={output_shape}")

    return {
        "passed": True,
        "input_name": input_name,
        "input_shape": input_shape,
        "output_name": output_name,
        "output_shape": output_shape
    }

def verify_runtime_loading(onnx_path):
    print("\n--- TEST 2: ONNX Runtime Session Loading ---")
    session = ort.InferenceSession(onnx_path, providers=['CPUExecutionProvider'])
    providers = session.get_providers()
    inputs = session.get_inputs()
    outputs = session.get_outputs()

    print(f"✓ Session created with providers: {providers}")
    print(f"✓ Input name: '{inputs[0].name}', shape: {inputs[0].shape}, type: {inputs[0].type}")
    print(f"✓ Output name: '{outputs[0].name}', shape: {outputs[0].shape}, type: {outputs[0].type}")

    return session

def test_invalid_path_handling():
    print("\n--- TEST 3: Invalid Model Path Error Handling ---")
    bogus_path = os.path.join(CLEAN_DIR, "checkpoints", "non_existent_model.onnx")
    caught = False
    try:
        _ = ort.InferenceSession(bogus_path, providers=['CPUExecutionProvider'])
    except Exception as e:
        caught = True
        print(f"✓ Successfully caught expected exception on non-existent path: {type(e).__name__}")
    assert caught, "Failed to raise exception on invalid model path!"
    return {"passed": True}

def load_pytorch_model():
    ckpt = torch.load(CHECKPOINT_PATH, map_location='cpu')
    model = models.resnet18(weights=None)
    model.fc = nn.Linear(model.fc.in_features, 2)
    model.load_state_dict(ckpt['model_state_dict'])
    model.eval()
    for p in model.parameters():
        p.requires_grad = False
    return model

def verify_numerical_parity_and_agreement(pt_model, ort_session):
    print("\n--- TEST 4: PyTorch vs. ONNX Numerical Parity & Agreement ---")

    # Load test split
    with open(SPLITS_PATH, 'r', encoding='utf-8') as f:
        splits = json.load(f)
    test_records = splits['test_data']

    transform = transforms.Compose([
        transforms.Resize(256),
        transforms.CenterCrop(224),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
    ])

    max_logit_diff = 0.0
    max_prob_diff = 0.0
    agreements_tau_50 = 0
    agreements_tau_20 = 0
    total_samples = len(test_records)

    sample_contracts = []

    for i, rec in enumerate(test_records):
        img_path = os.path.join(IMG_DIR, rec['Id'])
        img = PIL.Image.open(img_path).convert('RGB')
        tensor = transform(img).unsqueeze(0)  # [1, 3, 224, 224]
        np_input = tensor.numpy()

        # PyTorch Inference
        with torch.no_grad():
            pt_logits = pt_model(tensor).numpy()
            pt_probs = torch.softmax(torch.tensor(pt_logits), dim=1).numpy()
            pt_pred_50 = int(pt_probs[0, 1] >= DEFAULT_TAU)
            pt_pred_20 = int(pt_probs[0, 1] >= CANDIDATE_TAU)

        # ONNX Runtime Inference
        ort_logits = ort_session.run(['logits'], {'input': np_input})[0]
        ort_probs = np_softmax(ort_logits)
        ort_pred_50 = int(ort_probs[0, 1] >= DEFAULT_TAU)
        ort_pred_20 = int(ort_probs[0, 1] >= CANDIDATE_TAU)

        # Difference
        logit_diff = float(np.max(np.abs(pt_logits - ort_logits)))
        prob_diff = float(np.max(np.abs(pt_probs - ort_probs)))

        if logit_diff > max_logit_diff:
            max_logit_diff = logit_diff
        if prob_diff > max_prob_diff:
            max_prob_diff = prob_diff

        if pt_pred_50 == ort_pred_50:
            agreements_tau_50 += 1
        if pt_pred_20 == ort_pred_20:
            agreements_tau_20 += 1

        # Collect first 5 sample output contracts for documentation demonstration
        if i < 5:
            conf_score = float(ort_probs[0, ort_pred_50])
            contract = {
                "sample_index": i,
                "image_id": rec['Id'],
                "ground_truth_binary": rec['binary_label'],
                "fine_grained_label": rec['Label'],
                "predicted_class": ort_pred_50,
                "visual_assessment_label": LABEL_MAPPING[ort_pred_50],
                "confidence_score": round(conf_score, 4),
                "probability_rotten": round(float(ort_probs[0, 1]), 4),
                "probability_fresh": round(float(ort_probs[0, 0]), 4),
                "model_version": MODEL_VERSION,
                "numerical_logit_diff": round(logit_diff, 8),
                "numerical_prob_diff": round(prob_diff, 8)
            }
            sample_contracts.append(contract)

    agreement_rate_50 = agreements_tau_50 / total_samples
    agreement_rate_20 = agreements_tau_20 / total_samples

    print(f"Evaluated {total_samples} held-out test images:")
    print(f"✓ Maximum absolute logit difference:       {max_logit_diff:.8e}")
    print(f"✓ Maximum absolute probability difference: {max_prob_diff:.8e}")
    print(f"✓ Prediction agreement rate (tau=0.50):    {agreement_rate_50*100:.2f}% ({agreements_tau_50}/{total_samples})")
    print(f"✓ Prediction agreement rate (tau=0.20):    {agreement_rate_20*100:.2f}% ({agreements_tau_20}/{total_samples})")

    # Assert rigorous tolerances for FP32 ONNX conversion
    assert max_logit_diff < 1e-4, f"Logit diff exceeded FP32 tolerance: {max_logit_diff}"
    assert max_prob_diff < 1e-4, f"Probability diff exceeded FP32 tolerance: {max_prob_diff}"
    assert agreement_rate_50 == 1.0, f"Disagreement detected at tau=0.50: {agreement_rate_50}"
    assert agreement_rate_20 == 1.0, f"Disagreement detected at tau=0.20: {agreement_rate_20}"

    return {
        "total_test_samples": total_samples,
        "max_logit_difference": max_logit_diff,
        "max_probability_difference": max_prob_diff,
        "agreement_rate_tau_50": agreement_rate_50,
        "agreement_rate_tau_20": agreement_rate_20,
        "sample_output_contracts": sample_contracts
    }

def benchmark_cpu_latency(ort_session, warmup_runs=20, timed_runs=100):
    print("\n--- TEST 5: ONNX Runtime CPU Latency Benchmark ---")
    dummy = np.random.randn(1, 3, 224, 224).astype(np.float32)

    print(f"Executing {warmup_runs} warmup runs...")
    for _ in range(warmup_runs):
        _ = ort_session.run(['logits'], {'input': dummy})

    print(f"Executing {timed_runs} timed single-image inference runs...")
    latencies_ms = []
    for _ in range(timed_runs):
        t0 = time.perf_counter()
        _ = ort_session.run(['logits'], {'input': dummy})
        latencies_ms.append((time.perf_counter() - t0) * 1000.0)

    mean_lat = float(np.mean(latencies_ms))
    median_lat = float(np.median(latencies_ms))
    p95_lat = float(np.percentile(latencies_ms, 95))
    p99_lat = float(np.percentile(latencies_ms, 99))

    print(f"✓ ONNX CPU Mean Latency:   {mean_lat:.2f} ms")
    print(f"✓ ONNX CPU Median Latency: {median_lat:.2f} ms")
    print(f"✓ ONNX CPU P95 Latency:    {p95_lat:.2f} ms")
    print(f"✓ ONNX CPU P99 Latency:    {p99_lat:.2f} ms")

    # Historical PyTorch reference on identical host
    pytorch_ref = {
        "mean_latency_ms": 20.32,
        "median_latency_ms": 20.13,
        "p95_latency_ms": 22.83,
        "p99_latency_ms": 24.84
    }

    return {
        "iterations": timed_runs,
        "warmup_runs": warmup_runs,
        "batch_size": 1,
        "onnx_cpu": {
            "mean_latency_ms": round(mean_lat, 2),
            "median_latency_ms": round(median_lat, 2),
            "p95_latency_ms": round(p95_lat, 2),
            "p99_latency_ms": round(p99_lat, 2)
        },
        "pytorch_cpu_reference": pytorch_ref
    }

def main():
    print("=" * 65)
    print(" FOODLOOP TASK-002B-1: ONNX INFERENCE VERIFICATION & BENCHMARK")
    print("=" * 65)

    structural_res = verify_structural_integrity(ONNX_PATH)
    ort_session = verify_runtime_loading(ONNX_PATH)
    error_res = test_invalid_path_handling()

    pt_model = load_pytorch_model()
    parity_res = verify_numerical_parity_and_agreement(pt_model, ort_session)
    latency_res = benchmark_cpu_latency(ort_session)

    full_results = {
        "task": "TASK-002B-1",
        "onnx_file": ONNX_PATH,
        "onnx_file_size_mb": round(os.path.getsize(ONNX_PATH) / (1024 * 1024), 2),
        "onnx_version": onnx.__version__,
        "onnxruntime_version": ort.__version__,
        "opset_version": 17,
        "model_architecture": "resnet18",
        "model_version": MODEL_VERSION,
        "structural_validation": structural_res,
        "error_handling_test": error_res,
        "numerical_parity": {
            "total_samples_evaluated": parity_res["total_test_samples"],
            "max_logit_difference": parity_res["max_logit_difference"],
            "max_probability_difference": parity_res["max_probability_difference"],
            "prediction_agreement_rate_tau_50": parity_res["agreement_rate_tau_50"],
            "prediction_agreement_rate_tau_20": parity_res["agreement_rate_tau_20"],
            "tolerance_threshold": 1e-4
        },
        "latency_benchmark": latency_res,
        "sample_output_contracts": parity_res["sample_output_contracts"],
        "output_mapping": LABEL_MAPPING,
        "candidate_experimental_threshold": CANDIDATE_TAU,
        "default_threshold": DEFAULT_TAU
    }

    with open(VERIFICATION_OUTPUT_PATH, 'w', encoding='utf-8') as f:
        json.dump(full_results, f, indent=2)
    print(f"\n✓ Verification results persisted to: {VERIFICATION_OUTPUT_PATH}")

if __name__ == "__main__":
    main()
