# FoodLoop — Agent Memory & Context Snapshot

### 1. Project Purpose & Boundary
FoodLoop is a software-only intelligent food surplus rescue and donation platform.
- **Goal:** Connect surplus food from commercial donors (restaurants, canteens, caterers, hotels) with suitable NGOs/food banks efficiently.
- **Strict Boundary:** Software-only. Absolutely NO IoT, ESP32, Arduino, Raspberry Pi, gas sensors, or specialized hardware.

### 2. User Roles
1. **Food Donor:** Creates surplus listings, provides operational context, uploads 1 photograph.
2. **NGO / Food Bank:** Reviews available surplus, accepts suitable donations, coordinates collection.
3. **Admin / Reviewer (Future):** Human oversight for ambiguous or questionable listings.

### 3. Current Architecture & Tech Stack (V1.0 Implemented)
- **Frontend:** React 19 + Vite 8.0 in `frontend/`, styled with vanilla CSS glassmorphism.
- **Backend:** Node.js (v24) + Express 5.2 in `backend/server.js`, with Multer for local uploads.
- **Storage:** Flat JSON file (`backend/data.json`) and local disk uploads (`backend/uploads/`).
- **Active Directory:** `C:\Users\LOQ\Documents\FOODLOOP`.

### 4. Implementation Status
- **COMPLETED:** `TASK-001 — Donation Intake V1.0` (Full structured intake form, single photo upload, conditional category logic, numeric quantity, legacy aliases, acceptance/collection lifecycle; 21 verified tests passed).
- **MILESTONE 2 STATUS:** **Milestone 2 has NOT been implemented.**
- **NOT YET IMPLEMENTED:**
  - AI-assisted visual eligibility assessment (Milestone 2 — candidate model architectures under consideration: EfficientNet-B0 vs. ResNet-50; candidate options requiring future research/decision; no model has been selected yet).
  - `donation_assessments` schema / table.
  - Human reviewer dashboard.
  - Intelligent NGO matching / capacity algorithms.
  - Delivery coordination / route optimization.
  - Authentication, authorization, production database.

### 5. Mandatory Safety-Neutral Terminology
- **Banned:** `"fresh"`, `"spoiled"`, `"food is safe"`, `"safe shelf life"`, `"remaining safe time"`.
- **Approved:** `visually_acceptable`, `questionable`, `visually_unsuitable`, `eligible_for_rescue`, `requires_human_review`, `rejected_unsuitable`, `pickup_available_until`.
- **Core Principle:** FoodLoop provides **AI-assisted food rescue eligibility assessment / operational triage**, NOT microbiological safety certification.

### 6. Critical Data Contract Rules
- `quantity`: Must be a `Number` ($>0$).
- `quantity_unit`: Enum (`servings`, `plates`, `trays`, `boxes`).
- `quantityText`: Formatted string (e.g., `"45 plates"`) for UI display and legacy compatibility.
- `pickup_available_until`: Valid ISO future datetime string.
- Legacy Aliases: Backend must preserve `foodName`, `location`, `expiryTime`, and `quantityText` on all returned records.
