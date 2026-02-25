# AI KYC Risk Reviewer — Feature Overview

## The Problem

Wealthsimple already auto-verifies most applicants via soft credit check + Persona biometrics. But for the ~10–30% that fail — mismatches, poor images, international IDs, fraud flags — humans still do manual reviews. That process is slow, fatiguing, and a bottleneck at scale.

This system rebuilds that manual fallback workflow as an AI-native pipeline: AI triages, explains, and prioritizes so compliance focuses only on true judgment calls.

---

## Core Features

### 1. Application Submission (`/`)
- Multi-field form collecting personal information (name, date of birth, address, country)
- Document type selection (driver's license, passport, national ID)
- **Multi-document upload** — up to 5 files per application (front, back, supporting documents)
- Supports JPG, PNG, WebP, and PDF
- Optional selfie upload for additional verification
- Images automatically resized (max 2048px) with Pillow before AI analysis
- File size limit of 5 MB per document enforced on both frontend and backend
- Rate limiting (10 submissions per minute per IP) with `429 Too Many Requests`
- Returns `202 Accepted` immediately — processing happens asynchronously

### 2. Review Dashboard (`/dashboard`)
- **Real-time polling** — refreshes every 3 seconds via TanStack Query
- **Stats header** — pending review, processing, approved, rejected, high risk, retraining queue, and total counts
- **Search** — filter by applicant name or application ID
- **Status tabs** — All, Pending Review, Processing, Approved, Rejected, Failed
- **Risk level filter** — High, Medium, Low
- **Analytics panel** — toggle to see risk distribution bars, status breakdown, approval rate, average risk score, average confidence, and queue depth
- **Adversarial Testing Mode** — launch pre-built fraud scenarios directly from the dashboard
- Application cards show name, document type, status badge, risk badge, flag count, confidence indicator, and time-in-queue

### 3. Application Detail (`/application/:id`)
- **Two-column layout**: documents on the left, AI analysis on the right
- **Multi-document viewer** — displays all uploaded documents with labels; supports images and PDF fallback via embedded `<object>` viewer
- **Submitted vs. extracted data comparison table** — side-by-side view with mismatches highlighted in red
- **Risk/Confidence gauges** — animated circular SVG gauges. Risk gauge colors green → amber → red. Confidence gauge colors red → amber → green
- **AI explanation** — plain-English summary of the analysis findings
- **Evidence Annotations** — field-by-field forensic analysis showing exactly what was extracted, where on the document it was found, and what the issue is (match, mismatch, blur, tampering). Color-coded by severity with extracted/submitted value comparison
- **Flags list** — severity-coded (critical/warning/info) with field-level detail
- **Document quality assessment** — overall quality, blur, crop, resolution checks
- **Application timeline** — visual lifecycle showing every event (submitted → processing → AI complete → reviewed) with contextual details pulled from the audit log
- **Review panel** — approve, reject, or request more info with mandatory reason selection and optional notes
- **Override detection** — tracks when a reviewer approves a high-risk case or rejects a low-risk case
- **Regulatory What-If Simulator** — toggle PEP, high-risk jurisdiction, sanctions, adverse media to see real-time impact on risk score and FINTRAC obligations
- **Human Feedback Loop** — "Disagree with AI?" panel to log feedback (wrong risk, false positive flag, extraction error) to a retraining queue
- **Status change notifications** — toast alerts when the application transitions (submitted → processing → pending review)

### 4. Audit Log (`/audit-log`)
- Chronological record of every system and human action
- Filterable by action type (submitted, AI analysis, reviewed, failed, feedback, regulatory simulation) and actor (applicant, AI system, compliance officer, demo system)
- Links to associated applications
- Detail badges showing decision, reason, risk level, confidence, flag count
- **CSV export** — download filtered audit entries as a CSV file
- Paginated with 50 entries per page

---

## Differentiation Features

### Evidence Annotations (AI Forensic Highlighting)

Instead of passively reporting "name mismatch", the AI provides field-by-field forensic annotations:

- **What was extracted** — the exact value read from the document
- **What was submitted** — the applicant-provided value for comparison
- **Where on the document** — physical location (e.g. "top-left below photo", "bio-data page center")
- **Issue classification** — match, mismatch, blur, tampering, quality, expiry
- **Severity** — critical (fraud indicator), warning (needs attention), info (context)
- **Human-readable description** — e.g. "Expiry date shows inconsistent font weight and JPEG compression artifacts. Pixel analysis suggests the '7' in '2027' was digitally modified from a '3'."

This turns passive extraction into active forensic help for human reviewers.

### Adversarial Testing Mode

Pre-built fraud scenarios that instantly create applications with simulated AI analysis:

| Scenario | Attack Type | AI Response |
|---|---|---|
| Photoshopped Expiry Date | Document Tampering | HIGH risk — detects font inconsistency + JPEG artifacts |
| Subtle Name Mismatch | Identity Mismatch | MEDIUM risk — catches single-character i→y substitution |
| Low-Quality Blurry Document | Evasion | HIGH risk (auto-escalated) — confidence below threshold |
| Clean Legitimate Application | Baseline | LOW risk — demonstrates no false positives |

Each scenario creates a real application record with pre-analyzed results, letting reviewers walk through the full detail page and experience the system end-to-end.

### Human Feedback Loop for Model Improvement

Collapsible "Disagree with AI?" panel in the application detail view:

- **Feedback types**: Risk assessment incorrect, data extraction error, false positive flag, missing flag, other
- **Category dropdowns**: Specific sub-categories (e.g. "Legitimate name variation (cultural/transliteration)", "Blur detection false positive", "Missed tampering indicator")
- **Free-text notes** for the ML team
- **Retraining queue** — all feedback entries stored in a dedicated table, visible as a queue metric on the dashboard
- **Audit trail** — every feedback submission logged with the original AI scores for before/after comparison

This creates a closed loop: reviewer overrides feed back to improve the model over time, reducing escalation rate.

### Regulatory What-If Simulator

Toggle regulatory risk factors to see how they'd change the application's priority:

| Factor | Risk Boost | Regulation |
|---|---|---|
| Politically Exposed Person (PEP) | +0.35 | PCMLTFA s. 9.6 — Enhanced due diligence |
| High-Risk Jurisdiction | +0.25 | FATF Recommendation 19 |
| Sanctions Match | +0.50 | SEMA / United Nations Act |
| Adverse Media | +0.15 | PCMLTFA monitoring obligation |

The simulator:
- Shows original vs. adjusted risk score with visual comparison
- Calculates priority level (standard → elevated → immediate → blocked)
- Lists specific **FINTRAC obligations** triggered by each factor
- References the exact regulations (PCMLTFA, FATF, SEMA)
- Includes a hardcoded FATF grey-list of 28 high-risk jurisdictions
- Logs every simulation to the audit trail

---

## AI Document Analysis

A single structured call to GPT-4o (vision-capable model) performs all analysis in one pass:

1. **Field extraction** — reads identity documents and extracts name, date of birth, document number, expiry date, and issuing authority
2. **Quality assessment** — evaluates blur, cropping, resolution, and visual anomalies
3. **Cross-referencing** — compares extracted fields against submitted data, flags discrepancies
4. **Risk scoring** — produces a 0–1 risk score, risk level (low/medium/high), confidence score, flags with severity, and a plain-English explanation
5. **Evidence annotations** — for every examined field, returns extracted value, submitted value, document location, issue type, severity, and description

Multi-document support sends all images in a single API call so the AI can cross-reference across documents.

### Risk Thresholds

| Risk Score | Level | Behavior |
|---|---|---|
| < 0.3 | Low | Standard queue — AI suggests approval |
| 0.3 – 0.7 | Medium | Standard review queue |
| > 0.7 | High | Priority queue — immediate attention |

If AI confidence drops below 0.6, the application auto-escalates to high priority regardless of score.

---

## Biometric Verification

### Facial Comparison (Selfie vs ID)

The selfie photo is **mandatory** at submission. The worker sends both the selfie and the first document image to GPT-4o vision, which compares facial features and returns:

- **Match result** — match / mismatch / inconclusive
- **Similarity score** — 0–100%
- **Key observations** — glasses, lighting, angle differences, etc.
- **Anomalies** — photo manipulation, different person, quality issues

Admins see the selfie and full comparison report on the detail page.

### Voice Verification

Applicants record themselves reading a passphrase: *"My name is [Name] and I am verifying my identity."*

The recording is:
1. Transcribed by **OpenAI Whisper**
2. Analyzed by **GPT-4o** — passphrase accuracy, name match, audio quality, anomaly detection

Results include passphrase similarity, spoken name comparison, confidence level, and flagged anomalies. Admins can **play back** the enrolled recording directly in the review panel.

### Voice Re-verification (Returning Users)

The first voice recording for an email becomes the **enrolled baseline**. On subsequent visits, the applicant can navigate to **Voice ID** and:

1. Record a new sample
2. The system transcribes both recordings with Whisper
3. GPT-4o compares the two transcriptions for speaker consistency
4. Returns a match/mismatch/inconclusive result with confidence and anomalies

This enables lightweight ongoing identity verification without re-submitting full documents. Re-verification events are logged in the audit trail.

---

## Processing Architecture

- **Job queue** — SQLite job table with polling worker (2-second intervals)
- **Atomic job claiming** — single UPDATE with `locked_at` timestamp prevents double-processing
- **Retry with backoff** — 3 retries with exponential backoff (2s, 4s, 8s)
- **Crash recovery** — stale locks (>60 seconds) automatically released
- **Structured output validation** — JSON parse failures enter the standard retry path
- **Decoupled from API** — the API never blocks on AI processing; worker is independently restartable

---

## UI/UX Features

- **Dark mode** — toggle in the header, persists in localStorage. Deep charcoal backgrounds with gold accent, matching Wealthsimple's dark aesthetic
- **Toast notifications** — bottom-right alerts for application submission, AI analysis status changes, review submissions, feedback logging, and errors. Auto-dismiss after 4 seconds
- **Responsive design** — works across desktop and tablet viewports
- **Wealthsimple-themed** — dark charcoal primary, warm gold accents, clean typographic style

---

## Wealthsimple Webhook Integration (Mock)

Simulates the bi-directional webhook API that would connect this tool to Wealthsimple's platform if they offered one.

### Incoming Webhooks (Wealthsimple → KYC Reviewer)

- **`POST /api/webhooks/incoming`** — Accepts payloads representing clients whose auto-verification (Persona/Onfido) failed
- Automatically creates a new KYC review application from the webhook payload
- HMAC signature verification (`X-WS-Signature` header) using a shared secret
- Three built-in demo scenarios: selfie mismatch, high-risk jurisdiction, document quality failure
- "Simulate Incoming" button fires a demo payload and creates a real application in the queue

### Outgoing Webhooks (KYC Reviewer → Wealthsimple)

- When a reviewer makes a decision (approve/reject/needs info), a callback fires automatically
- Payload includes: decision, risk assessment, regulatory priority, biometric results
- Configurable callback URL, HMAC secret, retry count, and event subscriptions
- Full webhook activity log with expandable payload/response inspection
- Subscription filters: decision_made, processing_complete, high_risk_flagged

### Admin UI

- **Connection settings** — enable/disable webhooks, set callback URL, HMAC secret, event subscriptions
- **Simulate incoming** — fire built-in demo scenarios with one click
- **Activity log** — filterable (incoming/outgoing) with expandable payload/response detail, status codes, and error messages

---

## Infrastructure

- **Docker Compose** — `docker compose up --build` runs API, worker, and frontend as three containers with shared volumes
- **Start script** — `./start.sh` for local development, boots all three processes with one command
- **SQLite WAL mode** — concurrent reads from API and writes from worker without locking
- **Auto-migration** — new columns added to existing databases automatically on startup
- **Auto-generated API docs** — Swagger UI at `/docs` when the server is running

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS v4 |
| State Management | TanStack Query (3-second polling) |
| Backend | Python 3.11+, FastAPI, SQLAlchemy 2.0 |
| Job Queue | SQLite job table + standalone polling worker |
| AI | OpenAI GPT-4o (vision + structured output), Whisper (voice transcription) |
| Image Processing | Pillow (resize, format conversion) |
| Validation | Pydantic v2 |
| Database | SQLite (WAL mode), swappable to PostgreSQL |
| Containerization | Docker + Docker Compose |
