# FoodLoop — System Architecture

This document describes the **current implemented architecture** of FoodLoop for **Donation Intake V1.0** and explicitly distinguishes it from **future, unimplemented systems**.

---

## 1. CURRENT — IMPLEMENTED ARCHITECTURE (V1.0)

```
┌────────────────────────────────────────────────────────────────────────┐
│                   CURRENT IMPLEMENTED ARCHITECTURE (V1.0)              │
├─────────────────────────────────────┬──────────────────────────────────┤
│        Frontend (Client Layer)      │      Backend (Service Layer)     │
│                                     │                                  │
│  • React 19.2 + Vite 8.0            │  • Node.js (v24) + Express 5.2   │
│  • Axios for HTTP communication     │  • Multer Multipart Handler      │
│  • Components:                      │  • Static File Server (/uploads) │
│    ├── App.jsx (Nav Tabs)           │  • Implemented Endpoints:        │
│    ├── DonorForm.jsx (V1 Intake)    │    ├── GET   /api/donations      │
│    ├── NGODashboard.jsx (Feed)      │    ├── GET   /api/donations/:id  │
│    └── DonationCard.jsx (Renderer)  │    ├── POST  /api/donations      │
│  • Design: Vanilla CSS Glassmorphic │    ├── PATCH /api/donations/:id/accept
│                                     │    └── PATCH /api/donations/:id/collect
├─────────────────────────────────────┴──────────────────────────────────┤
│                       Persistence & File Storage                       │
│                                                                        │
│  • backend/data.json (Primary flat-file JSON document store)           │
│  • backend/uploads/  (Local filesystem image storage for JPG/PNG/WebP) │
└────────────────────────────────────────────────────────────────────────┘
```

### Implemented Endpoints in `backend/server.js`:
1. `GET /api/donations`: Returns sorted list of donations serialized with V1 fields and legacy aliases.
2. `GET /api/donations/:id`: Returns a single serialized donation by ID (or 404).
3. `POST /api/donations`: Ingests multipart form data (with `photo`) or JSON; executes strict V1 validation; persists to `data.json`.
4. `PATCH /api/donations/:id/accept`: Updates status to `'accepted'`.
5. `PATCH /api/donations/:id/collect`: Updates status to `'collected'`.
6. `GET /uploads/*`: Express static route serving stored JPG, PNG, and WebP images.

### Implemented Storage:
* **`backend/data.json`:** Flat-file JSON array containing donation records.
* **`backend/uploads/`:** Local directory storing uploaded photo binaries.

---

## 2. FUTURE — NOT IMPLEMENTED (Planned Future Modules)

> **IMPORTANT:** None of the following systems exist in the codebase today. They are architectural placeholders for subsequent project milestones:

| Future Module | Current Status | Planned Scope |
| :--- | :--- | :--- |
| **AI Visual Screening Service** | **NOT IMPLEMENTED** | Python / ONNX inference service to assess uploaded photos. Candidate model architectures under consideration: **EfficientNet-B0** and **ResNet-50** (*candidate options requiring future research/decision — no model has been selected yet*). |
| **Assessment Storage (`donation_assessments`)** | **NOT IMPLEMENTED** | Relational or document schema isolating AI labels (`visually_acceptable`, `questionable`, `visually_unsuitable`), confidence scores, model versions, and reviewer audit trails from the core donation entity. |
| **Human Reviewer Queue & Dashboard** | **NOT IMPLEMENTED** | Admin portal for authorized reviewers to manually inspect questionable listings before NGO release. |
| **Intelligent Recipient Matching Engine** | **NOT IMPLEMENTED** | Multi-factor matching algorithm factoring in NGO capacity, proximity, dietary preferences, and urgency. |
| **Delivery & Route Coordination** | **NOT IMPLEMENTED** | Route planning, transit time constraints, and driver pickup verification. |
| **Authentication & RBAC** | **NOT IMPLEMENTED** | User registration, login, JWT/session management, and role-based permissions. |
| **Production Database Migration** | **NOT IMPLEMENTED** | Migration from flat `data.json` to an ACID-compliant transactional database (e.g., SQLite via Drizzle ORM or PostgreSQL). |
