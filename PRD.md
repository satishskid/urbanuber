# MASTER ARCHITECTURE: SKIDS HEALTHCARE AGGREGATOR
**Version:** 4.0.0 (Full Context & Workflow Edition) / 3.0.0 (Lean MVP)
**Architecture Paradigm:** Event-Driven, Offline-First, AI-Native
**Target Platforms:** iOS, Android, Web (PWA)

---

## 1. PROJECT VISION & THE "WHY"
Skids is an event-driven healthcare marketplace designed to operate like the "Uber of Healthcare." 
Legacy Electronic Medical Records (EMRs) fail because they act as static billing ledgers that bottleneck clinical care by forcing doctors to type. Skids fixes this by replacing manual typing with an **AI Scribe ("Context Chips")** and replacing static appointments with a **Pub/Sub Matchmaking Engine**. 

Healthcare logistics are treated as a continuous supply chain: Unstructured patient anxiety is translated into structured AI chips, which are then routed to doctors, and subsequently dispatched to allied fulfillment partners (labs/pharmacies) via automated, pre-paid events.

---

## 2. USER PERSONAS & AGILE STORIES

### Persona 1: The Patient (The "Rider")
* **Profile:** Anxious, time-poor, frustrated by having to repeat their medical history to multiple providers.
* **Goal:** To get fast, transparent, and continuous care without friction.
* **Stories:**
  * *As a Patient, I want to* request an instant telehealth consult *so that* my child's late-night fever can be assessed immediately.
  * *As a Patient, I want to* view my medical record as a timeline of events *so that* any new doctor I see has my complete context.
  * *As a Patient, I want to* automatically pay for my prescribed lab tests from my saved wallet *so that* I don't have to deal with physical clinic billing desks.

### Persona 2: The Clinical Provider (The "Driver")
* **Profile:** Doctors and Triage Nurses. Overworked, hates EMR data entry, wants to focus on empathy and clinical decisions.
* **Goal:** To see patients efficiently, dictate notes seamlessly, and guarantee payment.
* **Stories:**
  * *As a Doctor, I want to* toggle my status to "Online" *so that* I can accept instant consult requests when I have free time.
  * *As a Doctor, I want to* review AI-generated "Context Chips" (Symptoms, DDx) instead of a blank text box *so that* I can complete a medical chart with just a few taps.
  * *As a Doctor, I want my* payment split to be routed automatically upon signing a prescription *so that* I never have to chase invoices.

### Persona 3: The Allied Provider (The "Fulfillment Courier")
* **Profile:** Phlebotomists, Partner Labs, Pharmacies, Home-care nurses. 
* **Goal:** To receive a steady stream of verified, pre-paid local requests without spending money on marketing.
* **Stories:**
  * *As a Phlebotomist, I want to* receive geospatial dispatch alerts for nearby home blood draws *so that* I can optimize my daily travel route.
  * *As a Lab Tech, I want to* upload a PDF lab result directly to a patient's active request *so that* the ordering doctor is notified instantly.

---

## 3. CORE BEHAVIORAL WORKFLOWS (THE CHOREOGRAPHY)

### Workflow A: The Instant Consult & Smart Prescription
1. **Discovery:** Patient opens the app and requests "Pediatric Telehealth."
2. **Matchmaking:** The system broadcasts a ping to online Pediatricians. Dr. Smith taps "Accept."
3. **Escrow:** Patient is charged ₹500. Funds are held in Escrow via Razorpay/Stripe.
4. **The Consult:** Dr. Smith and the Patient connect via WebRTC video.
5. **AI Scribe:** Behind the scenes, the audio is routed through Cloudflare AI Gateway to Groq (Llama 3). It generates strict JSON Context Chips (e.g., `[DDx: Otitis Media]`, `[Rx: Amoxicillin]`).
6. **Confirmation:** Dr. Smith taps the chips to confirm them and hits "Sign."
7. **The Commit:** The chips are appended to the Firestore `clinical_ledger`.
8. **Auto-Payment:** A Firebase Cloud Function detects the ledger entry, triggers the payment gateway, and routes ₹450 to Dr. Smith and ₹50 to the platform.

### Workflow B: The Event-Driven Lab Dispatch
1. **The Trigger:** Dr. Smith's signed chips included a `[Lab_Order: CBC]` chip.
2. **The Event Bus:** The same Firebase Cloud Function parses this chip and creates a new `service_requests` document for a "Home Lab."
3. **The Dispatch:** Phlebotomists in a 5km radius get a push notification.
4. **Fulfillment:** A phlebotomist accepts, visits the patient, draws blood, and uploads the PDF result to Cloudflare R2 via a pre-signed URL.
5. **The Handoff:** The PDF link is appended as a new commit to the `clinical_ledger`, notifying Dr. Smith.

---

## 4. THE STRICT TECH STACK
* **Monorepo:** Turborepo
* **Frontend:** Expo (React Native) for Mobile; Next.js (App Router) for Web Dashboard.
* **Styling:** NativeWind v4 (Tailwind CSS for React Native/Web).
* **Auth & Identity:** Firebase Authentication (Phone Number / OTP).
* **Database & Offline Sync:** Firebase Firestore (Offline Persistence MUST be explicitly enabled).
* **Event Bus:** Firebase Cloud Functions (using native Firestore triggers).
* **File/Blob Storage:** Cloudflare R2 (Zero-egress storage for medical PDFs and images via pre-signed URLs).
* **AI Edge Compute:** Cloudflare Workers + Cloudflare AI Gateway.
* **AI Inference:** Groq (Llama 3 8B/70B) via Strict JSON Mode.
* **Payments:** Razorpay Route / Stripe Connect (Escrow & Auto-Split).

---

## 5. FIRESTORE DATABASE SCHEMA (EVENT SOURCING MODEL)
We are using Firestore, adhering to an Event Sourcing model for clinical data. Do not use `updateDoc` or `deleteDoc` on clinical records; only append.

### Collections:
1. **`patients`**: `uid`, `phone`, `subscription_tier`
2. **`providers`**: `uid`, `role` ('doctor', 'nurse', 'lab'), `service_tags` (Array), `is_online` (Boolean), `geohash`
3. **`service_requests`** (The "Ride"): `id`, `patient_uid`, `status` ('PENDING', 'ACCEPTED', 'COMPLETED'), `service_type`
4. **`clinical_ledger`** (The Immutable Log - Append Only):
   - `id` (Auto-ID)
   - `request_id` (String)
   - `provider_uid` (String)
   - `event_type` (String: 'TRIAGE', 'RX_SIGNED', 'LAB_UPLOAD')
   - `chip_payload` (Map/JSON: Strict AI-generated medical data)
   - `attached_file_urls` (Array of Strings: Cloudflare R2 URLs)
   - `timestamp` (ServerTimestamp)

---

## 6. ANTIGRAVITY EXECUTION PHASES

### Phase 1: Workspace & Firebase Foundation
**Task:** Initialize a Turborepo monorepo with three apps: `apps/patient-app` (Expo), `apps/provider-app` (Expo), and `apps/clinic-web` (Next.js). Set up a shared `packages/ui` for NativeWind. Integrate the Firebase JS SDK. Create a shared utility in `packages/firebase` that initializes Firebase Auth and Firestore. Explicitly enable Firestore Offline Persistence for the Expo mobile apps. Output the `firebase.ts` config and folder structure.

### Phase 2: Design System & UI Generation (Stitch MCP)
**Task:** Using the connected `stitch-mcp` tool, extract the design context. Use `generate_screen_from_text` to build the 'Context Chip' React Native component in `packages/ui` with 3 states: 'Suggested' (neutral), 'Confirmed' (primary), and 'Rejected' (faded). Then, build the 'Doctor Triage Screen' displaying patient history and a grid of Context Chips. Use strict NativeWind utility classes.

### Phase 3: Auth (OTP) & Offline Data Hooks
**Task:** Implement the authentication flow in the Expo apps using Firebase Auth Phone OTP. Build the `PhoneAuthScreen.tsx` component. Next, create custom React Hooks in `packages/firebase` to interact with Firestore. Create a `useClinicalLedger` hook that listens to the `clinical_ledger` collection for a specific `patient_uid`. Ensure the hook serves from the local offline cache first for zero-latency UI updates.

### Phase 4: The AI Scribe & R2 Storage Backend (Cloudflare Edge)
**Task:** Write a Cloudflare Worker (TypeScript) utilizing the Cloudflare MCP for deployment. 
Route 1 (AI Scribe): Route an audio transcript payload through Cloudflare AI Gateway to the Groq API (`llama3-8b-8192`), using JSON Mode to output: `{ "chips": [{ "type": "symptom|ddx|rx", "label": "string" }] }`. Secure Groq API key in Cloudflare Secrets.
Route 2 (R2 Upload): Generate an S3 pre-signed upload URL for Cloudflare R2 so mobile apps can upload heavy PDFs. Output the `index.ts` and `wrangler.toml`.

### Phase 5: Native Event Routing & Auto-Payments
**Task:** Write a Firebase Cloud Function (TypeScript) that acts as an internal event bus.
Trigger: Listen for `onCreate` events on the `clinical_ledger` Firestore collection.
Logic: If the `event_type` is 'RX_SIGNED', parse the `chip_payload`.
Action 1 (Payment): Trigger Stripe Connect / Razorpay Route API to split the escrow payment (90% to `provider_uid`, 10% to platform).
Action 2 (Dispatch): If payload contains a 'lab_order' chip, create a new document in the `service_requests` collection to dispatch a local phlebotomist.
Output the Cloud Function code with strict error logging.
