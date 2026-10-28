# FoodLoop — Security Architecture & Gap Assessment

This document provides a realistic, honest assessment of the current security posture of the FoodLoop prototype as of **Donation Intake V1.0**.

---

## 1. Current Security State

* **Environment:** Local development environment running Node.js (Express) on port 5000 and Vite on port 5173.
* **Authentication:** **None.** All API routes (`GET`, `POST`, `PATCH`) are currently unauthenticated.
* **Authorization / Access Control:** **None.** There is no role-based access control (RBAC). Any client that can reach the backend can create donations or mark any donation as accepted or collected.
* **CORS Policy:** Wildcard CORS (`app.use(cors())`) is currently enabled to allow seamless local cross-origin communication between Vite (port 5173) and Express (port 5000).
* **Upload Mechanism:** Multer disk storage writes incoming photos to `backend/uploads/`.
  * *File size ceiling:* Enforced at 5 MB (`limits: { fileSize: 5 * 1024 * 1024 }`).
  * *MIME type filtering:* Basic check against `image/jpeg`, `image/png`, and `image/webp`.
  * *Filename sanitization:* Filenames are randomized with timestamps and random integers (`donation-[timestamp]-[random].[ext]`).
* **Persistence & Secrets:** Flat unencrypted JSON file (`backend/data.json`). No external API secrets or database credentials are currently in use. Configuration values (port 5000 and API URL) are hard-coded; `.env.example` is an unconsumed reference template.

---

## 2. Known Security Gaps (Future Engineering Required)

The following gaps are documented as acknowledged limitations of the current MVP slice. **None of these are currently implemented:**

| Security Dimension | Current Gap | Risk Profile | Planned Remediation (Future Phase) |
| :--- | :--- | :--- | :--- |
| **Authentication** | No donor or NGO login mechanism. | Unverified submissions; cannot trace donation ownership. | JWT / Session-based auth with secure HTTP-only cookies. |
| **Authorization (RBAC)** | Any user can trigger `PATCH /accept` or `PATCH /collect`. | An unauthorized actor could mark all active listings as collected. | Role middleware ensuring only verified NGOs can accept and only designated parties can collect. |
| **Deep File Inspection** | Multer checks `file.mimetype` and extension, which can be spoofed. | Malicious files disguised as JPEGs could be stored on the server. | Magic-byte file header verification using tools like `file-type` or `sharp`. |
| **Rate Limiting** | No request throttling on `POST /api/donations`. | Susceptible to disk exhaustion or DoS via automated mass uploads. | IP and token-based rate limiting via `express-rate-limit`. |
| **Data Integrity** | `data.json` is modified via synchronous write operations. | Susceptible to race conditions or file corruption under concurrent traffic. | Migration to an ACID-compliant transactional database (e.g., SQLite or PostgreSQL). |
| **Static File Exposure** | All uploaded images in `backend/uploads` are publicly reachable. | Uploaded food photos are publicly viewable if the filename is known. | Private access routing or signed URLs if donor privacy is mandated. |
| **Secrets & Environment** | Configuration values (e.g., port 5000) are hard-coded in code; `.env.example` is an unconsumed template. | Inflexible deployment across staging and production. | Centralized configuration via `dotenv` and `process.env` loading. |
