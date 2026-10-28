# FoodLoop — UI/UX Design Specification

This document details the visual design system, component hierarchy, and interaction design implemented in FoodLoop for **Donation Intake V1.0**.

---

## 1. Visual Identity & Design Tokens

FoodLoop utilizes a modern dark-mode glassmorphic aesthetic defined in `frontend/src/index.css`:

```css
:root {
  --primary: #10b981;        /* Emerald Green (Primary Action & Branding) */
  --primary-hover: #059669;  /* Darker Emerald */
  --secondary: #3b82f6;      /* Royal Blue (Information & Accents) */
  --bg-color: #0f172a;       /* Slate 900 Base Surface */
  --bg-card: rgba(30, 41, 59, 0.7); /* Translucent Slate Card */
  --text-main: #f8fafc;      /* Crisp White Primary Text */
  --text-muted: #94a3b8;     /* Slate 400 Secondary Text */
  --border-color: rgba(255, 255, 255, 0.1); /* 1px Hairline Border */
  --danger: #ef4444;         /* Error & Rejection */
  --success: #22c55e;        /* Success & Verification */
  --warning: #eab308;        /* Warning & Submitted Status */
}
```

---

## 2. Component Hierarchy & Flow

```
App.jsx (Root View Container)
  |
  +-- Header (Logo, Gradient Branding, Subtitle)
  |
  +-- Navigation Tabs (Donor Portal vs. NGO Dashboard)
  |
  +-- [Active Tab == 'donor'] --> DonorForm.jsx
  |     +-- Category Chips (Cooked, Produce, Bakery, Packaged)
  |     +-- Title String Input
  |     +-- Dietary Selector (Vegetarian 🟢 / Non-Vegetarian 🔴)
  |     +-- Quantity Number Stepper + Unit Selector
  |     +-- Photo Upload Dropzone & Instant Preview
  |     +-- Conditional Drawer:
  |     |     +-- Cooked Context: Preparation Time + Storage
  |     |     \-- Packaged Context: Expiry Date Picker
  |     +-- Pickup Available Until (Datetime-local)
  |     +-- Address String Input
  |     +-- Packaging Type (Recommended)
  |     +-- Allergens & Special Note (Optional)
  |     \-- Submit Button & Real-time Validation Banners
  |
  \-- [Active Tab == 'ngo'] --> NGODashboard.jsx
        +-- Header & Refresh Controller
        \-- Grid View --> DonationCard.jsx (Iterated)
              +-- Media Header (Local Upload or Loremflickr Fallback)
              +-- Badges: Status (Submitted/Available/Accepted/Collected)
              +-- Sub-Badges: Dietary (🟢/🔴) & Category
              +-- Meta Fields: Quantity, Expiry, Address, Google Maps Link
              \-- Action Buttons (Accept Donation / Mark Collected)
```

---

## 3. Ergonomics & Intake Optimization

The intake form is designed to achieve a completion time of **60–90 seconds** for commercial donors:

1. **Tap-First Controls:** Primary choices (Category, Dietary Type, Units, Storage) use segmented buttons and chips rather than open dropdowns or free-form text.
2. **Dynamic Context Reveals:** Cooked-meal and packaged-food fields only mount when their respective category is selected, eliminating visual noise for bakery and produce donors.
3. **Smart Defaults:** `pickup_available_until` is pre-populated to current time + 3 hours, allowing instant submission unless adjusted.
4. **Immediate Visual Feedback:**
   - Client-side thumbnail preview renders instantly upon image selection.
   - Distinct red error banner highlights exact missing fields at the top of the viewport.
   - Auto-dismissing green success banner confirms receipt and resets the form.

---

## 4. Status Badges & Indicators

| Status Key | Background Color | Text Color | Meaning |
| :--- | :--- | :--- | :--- |
| `submitted` | `rgba(234, 179, 8, 0.85)` | `#1e293b` (Dark Slate) | Freshly submitted intake; awaiting screening |
| `available` | `rgba(34, 197, 94, 0.85)` | `#ffffff` (White) | Active listing eligible for NGO claiming |
| `accepted` | `rgba(59, 130, 246, 0.85)` | `#ffffff` (White) | Claimed by an NGO partner |
| `collected` | `rgba(168, 85, 247, 0.85)` | `#ffffff` (White) | Donation pickup completed |
