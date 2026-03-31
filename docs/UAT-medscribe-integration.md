# MedScribe Integration — User Acceptance Testing (UAT)

**Project:** UrbanUber Healthcare Aggregator  
**Feature:** MedScribe Local AI Scribe Integration  
**Version:** 1.0.0  
**Date:** 2026-03-31  
**Environment:** Browser (Chrome 113+ / Edge 113+ with WebGPU)

---

## 1. Overview

This document defines acceptance test cases for the MedScribe integration — a local-first AI scribe that transcribes doctor-patient consultations and extracts structured clinical data entirely in the browser using WebGPU. Cloud Groq API is the automatic fallback when local AI is unavailable.

**Key acceptance criteria:**

- Audio/data never leaves the device when using local AI
- Automatic fallback to Groq when WebGPU unavailable
- Structured clinical output (prescriptions, labs, radiology, treatment plan)
- Human-in-the-loop review before signing to clinical ledger
- AI source tracked in audit trail

---

## 2. Test Environment

| Requirement | Value                                                                  |
| ----------- | ---------------------------------------------------------------------- |
| Browser     | Chrome 113+, Edge 113+, or Firefox 117+ (WebGPU required for local AI) |
| Device      | Desktop/laptop with GPU (NVIDIA, AMD, Apple Silicon, or Intel Arc)     |
| Network     | Required for first model download (~500MB), optional after cached      |
| Firebase    | Active project with Firestore + Auth enabled                           |
| Cloud API   | Groq API key configured (for fallback testing)                         |

---

## 3. Test Cases

### 3.1 — First-Time Setup (Model Download)

| ID                | UAT-001                                                                                                                                                                                                                   |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Title**         | First launch downloads and caches the AI model                                                                                                                                                                            |
| **Precondition**  | Clean browser (no cached model), WebGPU available                                                                                                                                                                         |
| **Steps**         | 1. Open provider-app in browser<br>2. Navigate to AI Settings<br>3. Observe "MedScribe Local AI" section                                                                                                                  |
| **Expected**      | - WebGPU status shows "⚡ WebGPU Available" (green)<br>- "Enable Local AI" toggle is ON by default<br>- On first consultation, model download progress is shown<br>- Model is cached in IndexedDB for subsequent sessions |
| **Pass Criteria** | Model downloads successfully and subsequent sessions start instantly                                                                                                                                                      |

---

### 3.2 — Local AI Speech-to-Text (Real-Time Transcription)

| ID                | UAT-002                                                                                                                                                                                                                                                                                                        |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Title**         | Web Speech API transcribes consultation in real-time                                                                                                                                                                                                                                                           |
| **Precondition**  | WebGPU available, Microphone permission granted, Local AI enabled                                                                                                                                                                                                                                              |
| **Steps**         | 1. Open Consultation screen<br>2. Tap microphone button (Start Session)<br>3. Speak clearly for 30 seconds<br>4. Observe live transcript preview<br>5. Tap stop button (Finish and Generate)                                                                                                                   |
| **Expected**      | - Microphone permission dialog appears (first time)<br>- Red recording indicator with "Recording Audio (Local)" label<br>- Live transcript text updates in real-time below the mic button<br>- Final transcript is accurate (>80% word accuracy for clear speech)<br>- Full transcript is passed to extraction |
| **Pass Criteria** | Transcript captures spoken content with reasonable accuracy                                                                                                                                                                                                                                                    |

---

### 3.3 — Local AI Medical Extraction (Happy Path)

| ID                | UAT-003                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Title**         | Local model extracts structured clinical data from transcript                                                                                                                                                                                                                                                                                                                                                                                     |
| **Precondition**  | WebGPU available, model cached, transcript available                                                                                                                                                                                                                                                                                                                                                                                              |
| **Steps**         | 1. Complete UAT-002 or paste a clinical transcript manually<br>2. Wait for extraction to complete<br>3. Observe reasoning panel for progress updates<br>4. Review generated clinical chips on triage screen                                                                                                                                                                                                                                       |
| **Expected**      | - Reasoning panel shows "⚡ Initializing local AI model..."<br>- Progress updates: "Loading model...", "Extracting with local AI..."<br>- Badge shows "⚡ Local AI (WebGPU)"<br>- Clinical chips appear: symptoms (type=symptom), prescriptions (type=rx), diagnoses (type=ddx)<br>- Each chip has probability (high/medium/low)<br>- Prescription table shows drug name, dose, frequency, duration<br>- Summary and treatment plan are populated |
| **Pass Criteria** | Structured output contains relevant clinical observations from the transcript                                                                                                                                                                                                                                                                                                                                                                     |

---

### 3.4 — Human-in-the-Loop Review

| ID                | UAT-004                                                                                                                                                                                                                                                                                     |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Title**         | Doctor reviews, confirms, rejects, and signs AI-generated chips                                                                                                                                                                                                                             |
| **Precondition**  | UAT-003 completed, triage screen with chips displayed                                                                                                                                                                                                                                       |
| **Steps**         | 1. Read the HITL disclaimer banner<br>2. Tap a symptom chip → cycles to "Confirmed" (green)<br>3. Tap a diagnosis chip → cycles to "Rejected" (red/strikethrough)<br>4. Tap "Add Custom" → add a manual observation via autocomplete<br>5. Tap "Sign and Save"                              |
| **Expected**      | - HITL banner shows correct AI source ("⚡ Local — MedScribe / LFM2.5-1.2B")<br>- Chips toggle through: Suggested → Confirmed → Rejected → Suggested<br>- Manual items appear in chip list<br>- Alert confirms "Consultation committed to Clinical Ledger"<br>- Navigates back to dashboard |
| **Pass Criteria** | Doctor can review all chips, modify states, add custom items, and sign                                                                                                                                                                                                                      |

---

### 3.5 — Clinical Ledger Audit Trail

| ID                | UAT-005                                                                                                                                                                                                                                                                                                                                   |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Title**         | Signed consultation records AI source in Firestore                                                                                                                                                                                                                                                                                        |
| **Precondition**  | UAT-004 completed                                                                                                                                                                                                                                                                                                                         |
| **Steps**         | 1. Open Firebase Console → Firestore<br>2. Navigate to `clinical_ledger` collection<br>3. Find the most recent document with this patient/provider<br>4. Inspect the `payload` field                                                                                                                                                      |
| **Expected**      | - `payload.aiSource` = `"local"` (when using MedScribe)<br>- `payload.aiSource` = `"cloud"` (when using Groq fallback)<br>- `payload.status` = `"signed"`<br>- `payload.transcript` contains the full transcript<br>- `payload.context` contains array of chips with their states<br>- `payload.icd10` contains ICD-10 codes if extracted |
| **Pass Criteria** | Audit trail correctly records which AI backend was used                                                                                                                                                                                                                                                                                   |

---

### 3.6 — Cloud Fallback (Groq)

| ID                | UAT-006                                                                                                                                                                                                                                                       |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Title**         | System falls back to Groq when WebGPU unavailable                                                                                                                                                                                                             |
| **Precondition**  | WebGPU unavailable (Firefox <117, or disabled), Groq API key configured                                                                                                                                                                                       |
| **Steps**         | 1. Open provider-app in a browser without WebGPU<br>2. Navigate to AI Settings → verify "WebGPU Not Available" warning<br>3. Start consultation and provide transcript<br>4. Observe extraction process                                                       |
| **Expected**      | - WebGPU status shows "⚠️ WebGPU Not Available" (amber)<br>- Reasoning panel shows "☁️ Connecting to cloud AI (Groq)..."<br>- Badge shows "☁️ Cloud AI (Groq)" in HITL banner<br>- Extraction completes via cloud API<br>- Clinical chips generated as normal |
| **Pass Criteria** | Seamless fallback — no user intervention needed, same output format                                                                                                                                                                                           |

---

### 3.7 — Cloud Fallback (Local Model Failure)

| ID                | UAT-007                                                                                                                                                                                                |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Title**         | System falls back to Groq when local model fails to load                                                                                                                                               |
| **Precondition**  | WebGPU available but model download interrupted/corrupt, Groq API key configured                                                                                                                       |
| **Steps**         | 1. Corrupt cached model (clear IndexedDB `skids-ai-scribe-cache` store)<br>2. Block network to prevent re-download (dev tools offline)<br>3. Start consultation with transcript<br>4. Observe behavior |
| **Expected**      | - Local extraction attempt fails gracefully<br>- Falls back to Groq automatically<br>- No error shown to user (unless Groq also fails)<br>- HITL banner shows "☁️ Cloud AI (Groq)"                     |
| **Pass Criteria** | Graceful degradation — user experiences no interruption                                                                                                                                                |

---

### 3.8 — Local-Only Mode (Strict Privacy)

| ID                | UAT-008                                                                                                                                                                                               |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Title**         | Local-only mode prevents any cloud API calls                                                                                                                                                          |
| **Precondition**  | WebGPU available, mode set to "Local Only" in AI Settings                                                                                                                                             |
| **Steps**         | 1. Open AI Settings → select "Local Only" → Save<br>2. Start consultation with transcript<br>3. Verify no network requests to Groq                                                                    |
| **Expected**      | - Extraction uses local model only<br>- No requests to api.groq.com (verify in Network tab)<br>- If local fails, shows error rather than cloud fallback<br>- HITL banner shows "⚡ Local AI (WebGPU)" |
| **Pass Criteria** | Zero data leaves the device when local-only mode is active                                                                                                                                            |

---

### 3.9 — AI Settings Screen

| ID                | UAT-009                                                                                                                                                                                                                                                                |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Title**         | AI Settings screen correctly displays and saves configuration                                                                                                                                                                                                          |
| **Precondition**  | Authenticated provider                                                                                                                                                                                                                                                 |
| **Steps**         | 1. Open AI Settings from Dashboard<br>2. Verify MedScribe section shows WebGPU status<br>3. Toggle "Enable Local AI" OFF<br>4. Select "Cloud Only" mode<br>5. Enter Groq API key<br>6. Tap Save<br>7. Reopen AI Settings                                               |
| **Expected**      | - All current settings are loaded from Firestore<br>- Toggle and mode selections persist after save<br>- API key is stored securely (masked in UI)<br>- WebGPU status correctly reflects browser capability<br>- "Legacy Local Node" section hidden in cloud-only mode |
| **Pass Criteria** | Settings persist correctly across sessions                                                                                                                                                                                                                             |

---

### 3.10 — Manual Text Entry (No Microphone)

| ID                | UAT-010                                                                                                                                                                                                           |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Title**         | Doctor can paste/type transcript without using microphone                                                                                                                                                         |
| **Precondition**  | Consultation screen open                                                                                                                                                                                          |
| **Steps**         | 1. Scroll to "Or type transcript manually:"<br>2. Paste a clinical transcript (>20 characters)<br>3. Tap "✦ Analyze with AI Scribe"<br>4. Observe extraction                                                      |
| **Expected**      | - Text input accepts multi-line paste<br>- "Analyze" button appears when >20 characters<br>- Extraction runs on pasted text<br>- Same chip generation flow as voice input<br>- Works with both local and cloud AI |
| **Pass Criteria** | Full functionality available without microphone                                                                                                                                                                   |

---

### 3.11 — Cross-Browser Compatibility

| ID        | UAT-011                                       |
| --------- | --------------------------------------------- |
| **Title** | Application works across supported browsers   |
| **Steps** | Test each browser below with UAT-003 workflow |

| Browser       | Version        | Expected Behavior                                         |
| ------------- | -------------- | --------------------------------------------------------- |
| Chrome        | 113+           | Full local AI (WebGPU + Web Speech API)                   |
| Edge          | 113+           | Full local AI (WebGPU + Web Speech API)                   |
| Firefox       | 117+           | WebGPU available, Web Speech API may have limited support |
| Safari        | 17+            | No WebGPU → falls back to Groq; Web Speech API works      |
| Mobile Chrome | 113+ (Android) | WebGPU on supported GPUs, full functionality              |

---

### 3.12 — Offline Mode

| ID                | UAT-012                                                                                                                                                                   |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Title**         | Local AI works fully offline after initial model download                                                                                                                 |
| **Precondition**  | Model already cached in IndexedDB                                                                                                                                         |
| **Steps**         | 1. Disconnect from network (airplane mode)<br>2. Open provider-app<br>3. Start consultation with transcript<br>4. Complete extraction                                     |
| **Expected**      | - App loads from service worker cache<br>- Local model loads from IndexedDB<br>- Extraction completes without network<br>- Clinical data available for review and signing |
| **Pass Criteria** | Full consultation workflow possible with zero network connectivity                                                                                                        |

---

## 4. Performance Acceptance Criteria

| Metric                      | Target                              | Measurement Method                      |
| --------------------------- | ----------------------------------- | --------------------------------------- |
| Model download (first time) | <2 minutes on 50Mbps                | Browser progress bar                    |
| Local extraction time       | <30 seconds for 500-word transcript | Time from "Finish" to chips appearing   |
| Cloud extraction time       | <15 seconds for 500-word transcript | Time from "Finish" to chips appearing   |
| Memory usage (local)        | <2GB                                | Chrome Task Manager                     |
| Fallback transition time    | <3 seconds                          | Time from local failure to cloud result |

---

## 5. Known Limitations

1. **Speaker diarization**: Local STT does not distinguish doctor vs. patient speech. Cloud Groq path has better context separation.
2. **Model size**: ~500MB initial download. Cached after first use.
3. **WebGPU requirement**: Local AI requires Chrome 113+, Edge 113+, or Firefox 117+. Older browsers fall back to cloud.
4. **Accuracy**: 1.2B parameter model has limited clinical nuance. Fine-tuning on domain data will improve this.
5. **Long consultations**: Transcripts >2000 words may be truncated by the 1.2B model's context window.

---

## 6. Sign-Off

| Role               | Name | Date | Signature |
| ------------------ | ---- | ---- | --------- |
| QA Lead            |      |      |           |
| Product Owner      |      |      |           |
| Clinician Reviewer |      |      |           |
| Dev Lead           |      |      |           |

---

**UAT Status:** ☐ Ready for Testing ☐ In Progress ☐ Passed ☐ Failed  
**Blocking Issues:**  
**Notes:**
