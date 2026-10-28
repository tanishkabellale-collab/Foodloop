# FoodLoop — Architecture & Product Decisions

> [!IMPORTANT]
> **Decision Scope Boundary:**
> All decisions recorded in this document are strictly scoped to **TASK-001 (Donation Intake V1.0)**. All decisions within TASK-001 are locked and verified. Future-module architectural and product decisions (including AI model selection, review triage thresholds, matching algorithms, delivery protocols, and production database schema) **remain open, unfinalized, and subject to future evaluation**.

---

### DECISION-001: Separate Numeric `quantity` from Formatted `quantityText`
- **Context:** The legacy implementation stored quantity as a free-form string (e.g., `"25 packets"` or `"5 kg"`). The V1 specification required numeric quantities for programmatic calculation.
- **Decision:** The API response provides `quantity` strictly as a `Number` (e.g., `45`) alongside `quantity_unit` (e.g., `'plates'`). A separate `quantityText` string (e.g., `"45 plates"`) is exposed on the record.
- **Why:** Future intelligent matching and vehicle capacity calculations require clean numeric inputs, while `quantityText` maintains clean human-readable UI rendering and legacy card compatibility.

---

### DECISION-002: Preserve Legacy Aliases Across Read/Write Endpoints
- **Context:** Existing frontend components and test suites expect fields named `foodName`, `location`, and `expiryTime`.
- **Decision:** The backend serialization layer (`serializeDonation`) dynamically maps new V1 schema keys (`title`, `address_text`, `pickup_available_until`) back to legacy aliases.
- **Why:** Prevents application crashes or regressions on the NGO dashboard and preserves the existing 7 historical donation records in `data.json`.

---

### DECISION-003: Neutral Storage Condition Labels Without Exact Temperature Cutoffs
- **Context:** An initial draft presented options like `Refrigerated (<5°C)`.
- **Decision:** Storage conditions are strictly presented with neutral labels: `Room Temperature`, `Refrigerated`, and `Hot / Insulated`.
- **Why:** FoodLoop is a software coordination platform, not an on-site digital thermometer. Hardcoding scientific temperature ranges implies certified monitoring that the software cannot guarantee.

---

### DECISION-004: Filesystem Image Storage Over Base64 In-Database Embedding
- **Context:** Choosing between Option A (local disk uploads in `backend/uploads/`) and Option B (inline Base64 strings in `data.json`).
- **Decision:** Implemented Option A via `multer` disk storage and static file serving (`app.use('/uploads', express.static(...))`).
- **Why:** Base64 strings increase JSON payload sizes by ~33%, drastically bloating `data.json`, degrading file read/write performance, and risking file corruption during concurrent operations.

---

### DECISION-005: Strict Prohibition of Microbiological Safety Terminology
- **Context:** Distinguishing platform operational triage from regulatory laboratory testing.
- **Decision:** Banned terms: `"fresh"`, `"spoiled"`, `"food is safe"`, `"safe shelf life"`, `"contamination detected"`. Adopted neutral terminology: `visually_acceptable`, `questionable`, `visually_unsuitable`, `pickup_available_until`. The platform's future assessment is strictly defined as **AI-assisted food rescue eligibility assessment / operational triage**.
- **Why:** RGB smartphone photos and donor metadata cannot verify microbiological edibility or pathogen absence. The platform is strictly an eligibility assessment and operational triage aid.

---

### DECISION-006: Runtime Computation of Urgency Window
- **Context:** Assessing whether to store `urgency_level` as a persistent database column.
- **Decision:** `urgency_window_minutes` and `is_expired` are calculated dynamically at query time from `(pickup_available_until - NOW())`.
- **Why:** Urgency continuously shifts as time progresses. Storing a static urgency string in the database results in stale data unless a polling cron constantly mutates every row.

---

### DECISION-007: Backward Compatibility with Existing 7 Legacy Records
- **Context:** The project began with existing records created without V1 fields or uploaded photos.
- **Decision:** Maintained existing records in `data.json`; fallback to `loremflickr` placeholder image when `image_url` is null; defaults supplied for missing V1 categories.
- **Why:** Avoids destructive data migrations, ensures legacy records continue rendering seamlessly, and satisfies zero-regression standards.

---

### DECISION-008: Single-Photo Intake Workflow
- **Context:** Evaluating single-photo vs. multi-angle photographic requirements.
- **Decision:** Require exactly one clear photograph per new donation.
- **Why:** Commercial kitchen staff, caterers, and canteen managers operate under severe time constraints. Multi-photo workflows exceed the 60–90 second intake target and cause form abandonment.

---

### DECISION-009: Scope Boundary Regarding Food Safety Certification
- **Context:** Defining the legal and operational boundaries of the software.
- **Decision:** FoodLoop does not certify food safety or accept regulatory liability for food condition. The intake process collects structured operational parameters to facilitate efficient rescue before donor closing time.
- **Why:** Conforms to realistic software capabilities and respects standard Good Samaritan food donation boundaries.
