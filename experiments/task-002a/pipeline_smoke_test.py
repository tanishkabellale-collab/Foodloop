"""
FoodLoop TASK-002A: Data Pipeline Smoke Test
Tests data loading, RGB decoding, 224x224 standardization, ImageNet normalization,
binary label mapping, and DataLoader batch generation on verified dataset samples.
DOES NOT perform full model training.
"""
import io
import urllib.request
import pandas as pd
import PIL.Image
import torch
from torch.utils.data import Dataset, DataLoader
import torchvision.transforms as transforms

# Class to Binary Triage mapping
LABEL_MAP = {
    'fresh_apple': 0,
    'fresh_banana': 0,
    'fresh_orange': 0,
    'rotten_apple': 1,
    'rotten_banana': 1,
    'rotten_orange': 1
}

LABEL_NAMES = {0: 'visually_acceptable', 1: 'visually_unsuitable'}

class FruitSampleDataset(Dataset):
    def __init__(self, sample_records, transform=None):
        self.records = sample_records
        self.transform = transform

    def __len__(self):
        return len(self.records)

    def __getitem__(self, idx):
        rec = self.records[idx]
        img_id = rec['Id']
        label_str = rec['Label']
        target = LABEL_MAP[label_str]

        # Fetch sample image
        url = f"https://huggingface.co/datasets/menasi11/fruit-classification/resolve/main/train/train/{img_id}"
        req = urllib.request.urlopen(url)
        img = PIL.Image.open(io.BytesIO(req.read())).convert('RGB')

        if self.transform:
            img = self.transform(img)

        return img, target, img_id

def run_smoke_test():
    print("[1/5] Fetching dataset label manifest for smoke test...")
    url_csv = "https://huggingface.co/datasets/menasi11/fruit-classification/raw/main/train.csv"
    req = urllib.request.urlopen(url_csv)
    df = pd.read_csv(io.StringIO(req.read().decode('utf-8')))

    # Take first 8 samples (covering both fresh and rotten across apple, banana, orange)
    sample_records = df.head(8).to_dict('records')
    print(f"Sample items selected: {len(sample_records)}")
    for r in sample_records:
        print(f"  - {r['Id']}: {r['Label']} -> Class {LABEL_MAP[r['Label']]} ({LABEL_NAMES[LABEL_MAP[r['Label']]]})")

    print("\n[2/5] Setting up standardized preprocessing transform...")
    transform = transforms.Compose([
        transforms.Resize(256),
        transforms.CenterCrop(224),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
    ])
    print("Transform: Resize(256) -> CenterCrop(224) -> ToTensor() -> ImageNet Normalization")

    print("\n[3/5] Instantiating Dataset and DataLoader...")
    dataset = FruitSampleDataset(sample_records, transform=transform)
    dataloader = DataLoader(dataset, batch_size=4, shuffle=False)
    print(f"Dataset length: {len(dataset)}, DataLoader batches: {len(dataloader)}")

    print("\n[4/5] Pulling first batch from DataLoader...")
    images, targets, ids = next(iter(dataloader))
    print(f"Batch Tensor Shape: {images.shape}")
    print(f"Batch Tensor Dtype: {images.dtype}")
    print(f"Batch Targets: {targets.tolist()}")
    print(f"Batch Image IDs: {ids}")
    print(f"Value range: min={images.min().item():.3f}, max={images.max().item():.3f}, mean={images.mean().item():.3f}")

    # Assert expected constraints
    assert images.shape == (4, 3, 224, 224), f"Expected shape (4, 3, 224, 224), got {images.shape}"
    assert targets.dtype == torch.int64, f"Expected int64 targets, got {targets.dtype}"
    assert len(targets) == 4, f"Expected 4 targets, got {len(targets)}"

    print("\n[5/5] Feeding batch into ResNet-18 and EfficientNet-B0 smoke forward pass...")
    import torchvision.models as models
    res18 = models.resnet18(weights=None)
    res18.fc = torch.nn.Linear(res18.fc.in_features, 2)
    res18.eval()
    with torch.no_grad():
        out_res = res18(images)
    print(f"ResNet-18 binary triage output shape: {out_res.shape} (Matches batch x 2 classes)")

    effnet = models.efficientnet_b0(weights=None)
    effnet.classifier[1] = torch.nn.Linear(effnet.classifier[1].in_features, 2)
    effnet.eval()
    with torch.no_grad():
        out_eff = effnet(images)
    print(f"EfficientNet-B0 binary triage output shape: {out_eff.shape} (Matches batch x 2 classes)")

    print("\nDATA PIPELINE SMOKE TEST: PASSED")

if __name__ == '__main__':
    run_smoke_test()
