# FoodLoop — Product Requirements Document (PRD)

## 1. Product Overview & Problem Statement
Large amounts of edible surplus food from commercial food establishments (restaurants, hotels, college canteens, caterers, and events) are discarded daily, while community organizations and food banks face chronic shortages. 

Existing food donation tools primarily function as static bulletin boards; they lack an integrated, intelligent decision layer to screen whether surplus food is suitable for rescue, identify the best-suited recipient, and coordinate rapid collection before the food spoils.

**FoodLoop** is a focused, software-only intelligent platform that addresses three core operational questions:
1. **What surplus food can be rescued?** (Structured intake + future AI visual screening)
2. **Who is the most suitable recipient?** (Future multi-criteria matching engine)
3. **How can the food reach that recipient efficiently?** (Future lightweight route & pickup coordination)

---

## 2. Product Boundaries & Constraints
- **Strictly Software-Only:** No IoT hardware, ESP32, Arduino, Raspberry Pi, gas sensors, RFID tags, or physical sensor networks.
- **Lean Architecture:** Explicitly avoids social media features, complex payment gateways, generic marketplaces, and unnecessary gamification.
- **Food Safety Framing:** The system does **not** scientifically certify food safety or detect microscopic pathogens. When implemented, future AI modules provide **AI-assisted food rescue eligibility assessment / operational triage**, not biological guarantees.

---

## 3. User Personas
1. **Food Donor (Commercial & Institutional):** Kitchen supervisors, caterers, and banquet managers seeking a rapid ($<90$ seconds), low-friction way to list surplus food.
2. **NGO / Food Bank:** Verified non-profit organizations and community shelters reviewing available surplus, evaluating volume and dietary suitability, and claiming donations.
3. **Admin / Authorized Reviewer (Future):** Human reviewers providing oversight on ambiguous or questionable listings.

---

## 4. Feature Roadmap & Current Status

### Phase 1: Donation Intake V1.0 — **COMPLETED**
- **Structured Intake Form:** Single-page form capturing Category, Title, Dietary Type, Numeric Quantity, Quantity Unit, 1 Photograph, Pickup Deadline, and Pickup Address.
- **Category-Driven Conditional Context:**
  - Cooked Meals: Captures `preparation_time` and neutral `current_storage` (`Room Temperature`, `Refrigerated`, `Hot / Insulated`).
  - Packaged Goods: Captures `expiry_date`.
  - Produce & Bakery: Bypasses unnecessary time fields to minimize friction.
- **Photo Intake:** Mandatory single RGB smartphone photograph upload ($\le 5$ MB, JPG/PNG/WebP) stored locally in `backend/uploads/` and served statically.
- **Legacy Compatibility:** Full backward-compatibility preserving legacy records and aliases (`foodName`, `location`, `expiryTime`, `quantityText`).
- **Core Lifecycle:** Support for status states `submitted`, `available`, `accepted`, and `collected`.

---

### Phase 2: AI-Assisted Visual Eligibility Assessment — **FUTURE / NOT IMPLEMENTED**
> **STATUS: NOT IMPLEMENTED.** Milestone 2 has NOT been implemented.
- Future inference pipeline to analyze uploaded photos for visible conditions (triage into `visually_acceptable`, `questionable`, or `visually_unsuitable`).
- **Candidate Model Architectures Under Consideration:** Transfer learning CNNs such as **EfficientNet-B0** and **ResNet-50** are candidate options requiring future research and evaluation. **No model has been selected or integrated yet.**
- Structured data parameters (category, preparation time, storage) will be combined with visual triage in a separate `donation_assessments` structure.

---

### Phase 3: Human Oversight & Admin Reviewer Queue — **FUTURE / NOT IMPLEMENTED**
> **STATUS: NOT IMPLEMENTED.**
- Dedicated admin portal for human inspection of listings flagged as `questionable`.
- Manual approval (`eligible_for_rescue`) or rejection (`rejected_unsuitable`) overrides.

---

### Phase 4: Intelligent Recipient Matching Engine — **FUTURE / NOT IMPLEMENTED**
> **STATUS: NOT IMPLEMENTED.**
- Recipient profiling (capacity, dietary restrictions, operating hours, coordinates).
- Transparent matching score combining quality, proximity, and capacity with explainable match reasons.

---

### Phase 5: Delivery & Route Coordination — **FUTURE / NOT IMPLEMENTED**
> **STATUS: NOT IMPLEMENTED.**
- Pickup/drop coordination with route sequence optimization and transit time vs. urgency window verification.
