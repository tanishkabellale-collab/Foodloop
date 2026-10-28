# FoodLoop — Intelligent Food Rescue Platform

FoodLoop is a software-based intelligent platform designed to reduce edible surplus food waste and connect donors (restaurants, hotels, college canteens, caterers, and events) with receiving organizations (NGOs, shelters, and food banks).

---

## 1. Current Project Status

* **Completed Milestone:** **TASK-001 — Donation Intake V1.0** (Built, verified, audited, documented)
* **Milestone 2 Status:** **Milestone 2 has NOT been implemented.**
* **Active Working Codebase:** `C:\Users\LOQ\Documents\FOODLOOP`

---

## 2. Feature Implementation Status

### Completed Functionality (Donation Intake V1.0)
- **Structured Donation Intake:** Single-page form capturing Category, Title, Dietary Type, Numeric Quantity, Quantity Unit, 1 Photograph, Pickup Deadline, and Address.
- **Conditional Context Logic:**
  - *Cooked Meals:* Captures Preparation Time and neutral Current Storage (`Room Temperature`, `Refrigerated`, `Hot / Insulated`).
  - *Packaged Goods:* Captures Expiry / Best Before Date.
  - *Produce & Bakery:* Minimal inputs to eliminate friction.
- **Local Photo Upload Pipeline:** Single-photo multipart upload ($\le 5$ MB, JPG/PNG/WebP) stored on the filesystem (`backend/uploads/`) and served statically via `/uploads/*`.
- **Data Contract:** Strictly separates numeric `quantity` from formatted `quantityText`.
- **Legacy Compatibility:** Full backward compatibility preserving legacy records and aliases (`foodName`, `location`, `expiryTime`, `quantityText`) across the API and dashboard.
- **Donation Acceptance Flow:** NGOs can review listings, accept donations, and mark them as collected.

### Not Implemented Yet (Planned Future Modules)
- **AI-Assisted Visual Eligibility Assessment:** *NOT IMPLEMENTED.* (Candidate model architectures under consideration: EfficientNet-B0 vs. ResNet-50 — candidate options requiring research/decision; no model has been selected yet).
- **Human Reviewer Workflow / Dashboard:** *NOT IMPLEMENTED.* (Admin inspection queue for questionable listings).
- **Intelligent NGO Matching:** *NOT IMPLEMENTED.* (Capacity, proximity, and dietary matching algorithms).
- **Delivery & Route Coordination:** *NOT IMPLEMENTED.* (Route planning and pickup scheduling).
- **Authentication & RBAC:** *NOT IMPLEMENTED.* (Donor and NGO login and permissions).
- **Production Database Migration:** *NOT IMPLEMENTED.* (Current prototype uses flat `data.json`).

---

## 3. Architecture Overview (V1.0 Implemented)

```
FOODLOOP/
├── backend/                  # Node.js + Express 5 API Server
│   ├── server.js             # Primary server logic, validation & serialization
│   ├── data.json             # Flat-file JSON document store
│   ├── uploads/              # Local image upload storage
│   └── package.json          # Dependencies: express, cors, multer
│
├── frontend/                 # React 19 + Vite 8 Client
│   ├── src/
│   │   ├── components/
│   │   │   ├── DonorForm.jsx    # V1.0 Intake Form with dynamic context
│   │   │   ├── NGODashboard.jsx # Real-time polling donation feed
│   │   │   └── DonationCard.jsx # Render card supporting V1 & legacy records
│   │   ├── App.jsx           # Tab navigator
│   │   └── index.css         # Dark glassmorphic design system
│   └── package.json          # Dependencies: axios, lucide-react, react
│
└── docs/                     # Project Specifications & Verification Logs
    ├── PRD.md                # Product Requirements Document
    ├── ARCHITECTURE.md       # System Architecture & Implemented vs. Future Systems
    ├── DESIGN.md             # UI/UX Specifications & Design Tokens
    ├── TEST_PLAN.md          # 21-Test Verification Log & Future Test Specifications
    ├── SECURITY.md           # Security Posture & Gap Analysis
    ├── DECISIONS.md          # Architectural & Product Decision Log (Scoped to TASK-001)
    └── MEMORY.md             # Agent Context & State Snapshot
```

---

## 4. How to Run Locally

### Prerequisites
- Node.js (v20+ or v24)
- npm (v10+ or v11)

### Run Backend Server
```bash
cd backend
npm install
node server.js
# Runs by default on http://localhost:5000
# Static uploads served at http://localhost:5000/uploads/
```

### Run Frontend Client
```bash
cd frontend
npm install
npm run dev -- --host 127.0.0.1 --port 5173
# Opens on http://127.0.0.1:5173/
```

> **Note on Environment Variables:** The `.env.example` file is an unconsumed template. Current local execution relies on hardcoded defaults (`5000` and `http://localhost:5000/api`). Dynamic environment variable loading will be implemented in a future configuration task.

---

## 5. Current Prototype Limitations

- **Storage:** Uses local JSON file persistence (`backend/data.json`); not yet migrated to an ACID database.
- **Authentication:** Unauthenticated development environment; no user login or role-based access control.
- **AI Assessment:** Photographs are uploaded and served, but computer vision screening models are not integrated.
- **Matching:** Listings are displayed chronologically without algorithmic NGO capacity matching.
