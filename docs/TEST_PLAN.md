# FoodLoop — Test Plan & Verification Log

This document records all verification tests performed on the FoodLoop codebase for **Donation Intake V1.0**, along with future tests planned for subsequent phases.

---

## 1. Verified Test Log (21 Executed & Confirmed Tests)

### Summary of Executed Verification Tests
| Test Category | Test Prefix | Count | Status |
| :--- | :--- | :---: | :---: |
| Build & Syntax Verification | `BLD-01` – `BLD-02` | 2 | **PASS** |
| Automated API & Validation | `API-01` – `API-05` | 5 | **PASS** |
| Image Upload & Serving | `IMG-01` – `IMG-03` | 3 | **PASS** |
| Data Contract & Serialization | `DAT-01` – `DAT-03` | 3 | **PASS** |
| Donation Status Lifecycle | `LIF-01` – `LIF-03` | 3 | **PASS** |
| Compatibility & Browser UI UAT | `CMP-01` – `CMP-02`, `UAT-01` – `UAT-03` | 5 | **PASS** |
| **Total Tests Executed & Passed** | | **21** | **PASS** |

---

### A. Build Verification
| Test ID | Test Purpose | Expected Result | Actual Result | Status |
| :--- | :--- | :--- | :--- | :--- |
| **BLD-01** | Verify frontend production compilation with Vite (`npm run build`). | Clean build of client bundle, assets output in `dist/`, exit code 0. | Compiled in 601 ms; 1,775 modules transformed; 0 errors. | **PASS** |
| **BLD-02** | Verify backend JavaScript syntax and runtime imports (`node -c server.js`). | Node syntax parser exits with code 0 and no syntax errors. | Exited with code 0; clean parsing of Express, Multer, and CORS. | **PASS** |

### B. Automated & API Validation
| Test ID | Test Purpose | Expected Result | Actual Result | Status |
| :--- | :--- | :--- | :--- | :--- |
| **API-01** | `POST /api/donations` without a photo file or `image_url`. | Return HTTP 400 with message requiring a photograph for new donations. | Returned HTTP 400: `"A clear food photograph is required for new donations."` | **PASS** |
| **API-02** | `POST /api/donations` with past `pickup_available_until` datetime. | Return HTTP 400 with message requiring a future collection deadline. | Returned HTTP 400: `"Pickup Available Until must be a future date and time."` | **PASS** |
| **API-03** | `POST /api/donations` with `cooked_meals` category missing `preparation_time`. | Return HTTP 400 with message requiring valid preparation time. | Returned HTTP 400: `"Preparation Time is required for Cooked Meals..."` | **PASS** |
| **API-04** | `POST /api/donations` with `packaged_sealed` category missing `expiry_date`. | Return HTTP 400 with message requiring expiry / best before date. | Returned HTTP 400: `"Expiry / Best Before Date is required for Packaged / Sealed food."` | **PASS** |
| **API-05** | `POST /api/donations` with non-numeric or non-positive quantity ($\le 0$). | Return HTTP 400 with quantity validation error. | Returned HTTP 400: `"Quantity must be a positive number greater than zero."` | **PASS** |

### C. Image Upload Verification
| Test ID | Test Purpose | Expected Result | Actual Result | Status |
| :--- | :--- | :--- | :--- | :--- |
| **IMG-01** | Upload valid JPEG photo via multipart/form-data. | Image saved to `backend/uploads/`; relative path returned in `image_url`. | Stored as `donation-[timestamp]-[random].jpg`; returned `/uploads/...`. | **PASS** |
| **IMG-02** | Fetch uploaded image via HTTP static route (`GET /uploads/:filename`). | Return HTTP 200 with appropriate `image/jpeg` content-type header. | Returned HTTP 200; `Content-Type: image/jpeg`. | **PASS** |
| **IMG-03** | Verify client photo preview and removal before form submission. | Instant thumbnail preview upon selection; cleared on remove button click. | Verified in React state and DOM; revokeObjectURL called cleanly. | **PASS** |

### D. Data Contract & Serialization Verification
| Test ID | Test Purpose | Expected Result | Actual Result | Status |
| :--- | :--- | :--- | :--- | :--- |
| **DAT-01** | Verify `quantity` is strictly numeric across all `GET /api/donations` records. | `typeof record.quantity === 'number'` for 100% of records. | Confirmed numeric for all active and legacy records. | **PASS** |
| **DAT-02** | Verify `quantityText` is exposed as a string on every record. | `typeof record.quantityText === 'string'` (e.g., `"35 servings"`). | Confirmed formatted string present on all returned records. | **PASS** |
| **DAT-03** | Verify runtime derived urgency fields are computed dynamically. | Response contains integer `urgency_window_minutes` and boolean `is_expired`. | Correctly calculated relative to current server time; not stored in DB. | **PASS** |

### E. Donation Lifecycle Verification
| Test ID | Test Purpose | Expected Result | Actual Result | Status |
| :--- | :--- | :--- | :--- | :--- |
| **LIF-01** | Create new donation with initial lifecycle status. | Initial status set to `submitted`. | Record created with `status: "submitted"`. | **PASS** |
| **LIF-02** | Transition donation via `PATCH /api/donations/:id/accept`. | Status transitions from `submitted` to `accepted`. | Record updated in `data.json`; returned `status: "accepted"`. | **PASS** |
| **LIF-03** | Transition donation via `PATCH /api/donations/:id/collect`. | Status transitions from `accepted` to `collected`. | Record updated in `data.json`; returned `status: "collected"`. | **PASS** |

### F. Compatibility & Browser UI Verification
| Test ID | Test Purpose | Expected Result | Actual Result | Status |
| :--- | :--- | :--- | :--- | :--- |
| **CMP-01** | Ingest legacy payload (`{ foodName, quantity, expiryTime, location }`). | Accepted gracefully; saved with V1 defaults; returned with HTTP 201. | Legacy donation successfully created and persisted. | **PASS** |
| **CMP-02** | Render legacy records without uploaded photos in NGO Dashboard. | Fallback smoothly to `loremflickr` placeholder; no broken image tags. | Legacy cards rendered with placeholder images without crashing. | **PASS** |
| **UAT-01** | Verify category chip interactions on `DonorForm`. | Toggling categories dynamically mounts/unmounts conditional contexts. | Cooked context appears for Cooked; Expiry appears for Packaged. | **PASS** |
| **UAT-02** | Verify storage label is neutral (`Refrigerated` without `(<5°C)`). | Label displays purely as `"Refrigerated"`. | Confirmed visually in browser DOM. | **PASS** |
| **UAT-03** | Check browser console during form navigation and dashboard polling. | Zero uncaught exceptions, zero console errors, zero warnings. | Verified via browser subagent: 0 errors. | **PASS** |

---

## 2. Future Tests (NOT IMPLEMENTED YET — Planned for Subsequent Modules)

The following tests are logically required in future milestones but have **NOT** yet been performed:

1. **AI Visual Assessment Pipeline Tests (Milestone 2 — NOT IMPLEMENTED):**
   - Inference latency, memory footprint, and classification evaluation for candidate model options (e.g., EfficientNet-B0 vs. ResNet-50 — candidate options requiring future research/decision; no model has been selected yet).
   - Triage distribution across `visually_acceptable`, `questionable`, and `visually_unsuitable`.
   - Robustness against non-food, blurry, or low-light image submissions.
2. **Human Reviewer Queue Tests (Milestone 3 — NOT IMPLEMENTED):**
   - Audit trail creation when an admin manually approves or rejects an `under_review` donation.
   - Concurrency locking when two reviewers inspect the same questionable listing.
3. **Intelligent Recipient Matching Tests (Milestone 4 — NOT IMPLEMENTED):**
   - Proximity and distance matrix calculation between donor coordinates and registered NGO facilities.
   - Capacity matching (e.g., verifying an NGO with 30-meal capacity is not assigned a 150-meal donation).
   - Dietary compatibility filtering (ensuring non-veg food is never matched to vegetarian shelters).
4. **Delivery & Route Coordination Tests (Milestone 5 — NOT IMPLEMENTED):**
   - Transit time vs. remaining urgency window validation.
   - Driver pickup confirmation with token or verification receipt.
5. **Database Concurrency & Migration Tests (Future Infrastructure — NOT IMPLEMENTED):**
   - ACID-compliant transactional database migration under concurrent load (replacing flat-file `data.json`).
