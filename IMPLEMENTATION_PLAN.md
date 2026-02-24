# AI KYC Risk Reviewer — Implementation Plan

> I rebuilt KYC onboarding as an AI-native workflow that allows compliance teams to review only high-risk cases, increasing throughput while maintaining regulatory accountability.

---

## Business Impact

Today, a compliance officer manually reviews every onboarding application — extracting information from identity documents, cross-referencing it against submitted data, and making approval decisions one by one. With this system, AI handles the cognitive load of document analysis, data extraction, consistency checking, and risk assessment. The compliance officer now works from a priority queue, focusing their expertise on the 20-30% of applications that are genuinely ambiguous or high-risk.

A team that previously processed 200 applications per day can now handle 600–1,000 with the same headcount, while catching inconsistencies that human fatigue would miss. High-risk applications are automatically prioritized to reduce time-to-investigation for potential fraud.

---

## System Architecture

The system is composed of four layers:

**Frontend (React / TypeScript / Vite)** — A Wealthsimple-themed interface built with shadcn/ui, using Wealthsimple's brand palette (dark charcoal, white, warm gold accents) and their clean typographic style. Four views: document upload, priority review queue, application detail with review actions, and an audit log viewer. The dashboard polls the API every 3 seconds via TanStack Query's `refetchInterval` — fast enough to feel live, slow enough not to hammer SQLite.

**Backend (Python / FastAPI)** — A stateless REST API that enqueues work to a separate processing worker. Includes request rate limiting (`429 Too Many Requests` on excessive submissions) and a 5 MB upload size limit with Pillow-based image resizing before AI analysis. FastAPI was chosen because document processing and LLM calls are I/O-bound, making Python's async ecosystem ideal. The auto-generated OpenAPI documentation provides production-grade API discoverability out of the box.

**Processing Worker** — A separate process that polls a job queue (SQLite job table) with a 2-second sleep between polls to avoid CPU spin. When a job is found, the worker sets a `locked_at` timestamp on the row to claim it — any job locked for more than 60 seconds is considered abandoned (crash recovery) and becomes available again. Built-in failure handling: if the AI call fails or returns malformed JSON, the job is marked `processing_failed` and the retry count is incremented (max 3 retries with exponential backoff). If a job exceeds the 30-second timeout, it's marked failed and returned to the queue. This decouples the API from long-running AI calls — the API never blocks, the worker is independently restartable, and the pattern maps directly to Redis/Celery/SQS in production with no architectural change.

**AI Document Analysis** — A single structured vision+reasoning call. Rather than chaining a vision model into a separate LLM reasoning step (which doubles latency to 6–16 seconds), the system sends one prompt to a vision-capable model that performs extraction, quality assessment, cross-referencing, and risk scoring in a single pass, returning a structured JSON response. This keeps analysis under 3–8 seconds per application.

**Storage** — SQLite in WAL (Write-Ahead Logging) mode for persistence, which allows concurrent reads from the API and writes from the worker without `database is locked` errors. The SQLAlchemy engine is configured with `check_same_thread=False` and `pool_pre_ping=True`, and both the API and worker create fresh sessions per request/job — no shared global sessions. Swappable to Postgres via a single connection string change. Local file storage for uploaded documents, swappable to S3 via the storage service abstraction.

### Data Flow

1. Applicant submits identity document + personal information
2. API checks rate limit — if exceeded, returns `429 Too Many Requests`
3. API validates input and file size (max 5 MB), resizes oversized images with Pillow, stores the document, saves the application as `status=submitted`, enqueues a processing job, and returns `202 Accepted` with the application ID
4. The worker process polls the job queue (2-second intervals) and claims a job atomically — a single `UPDATE ... WHERE locked_at IS NULL LIMIT 1` rather than a SELECT-then-UPDATE, preventing two workers from grabbing the same job. Sets `status=processing`
5. The worker sends a single structured prompt to a vision-capable model with the document image and applicant-submitted data
6. The model returns a structured JSON response: extracted fields, document quality assessment, cross-reference results, risk score, confidence score, flags, and a plain-English explanation — all in one call
7. The worker writes the results to the database and sets `status=pending_review`
8. The application enters the reviewer queue, sorted by priority

### Failure Handling

If the AI call fails at step 5 (network error, API error, rate limit):

- The application is set to `status=processing_failed`
- `retry_count` is incremented
- If `retry_count < 3`, the job re-enters the queue with exponential backoff
- If `retry_count >= 3`, the application stays in `processing_failed` and surfaces in the dashboard as needing manual attention

If the model returns malformed JSON (a common real-world failure with structured output):

- The response is treated as a failed call and enters the same retry path
- This is explicitly guarded because LLMs occasionally return valid-looking but unparseable responses, and an unhandled exception here would silently kill the worker

If a job exceeds 30 seconds (timeout):

- The worker kills the in-flight request
- The application is marked `processing_failed` and re-queued for retry

If the worker process crashes mid-job:

- The `locked_at` timestamp on the job row becomes stale
- After 60 seconds, the job is automatically unlocked and available for pickup — no manual intervention required

This means no application silently disappears. Every failure is visible and recoverable.

---

## What AI Is Responsible For

A single structured call to a vision-capable model performs all analysis in one pass. The prompt includes the document image and the applicant's submitted data, and returns a structured JSON response covering:

1. **Document field extraction** — Reads identity documents (driver's licenses, passports, national IDs) and extracts structured fields: name, date of birth, document number, expiry date, and issuing authority.

2. **Document quality and authenticity assessment** — Evaluates image quality (blur, cropping, resolution) and detects visual anomalies that may indicate tampering: inconsistent fonts, editing artifacts, unusual patterns, or signs of digital manipulation.

3. **Cross-reference and consistency checking** — Compares extracted document fields against the applicant-submitted information. Flags discrepancies in name spelling, date of birth, address, and checks whether the document is expired.

4. **Risk scoring and confidence reporting** — Produces a risk score (0–1) quantifying the likelihood of a problematic application, a risk level (low / medium / high) for queue placement, a plain-English explanation of what was found, a list of specific flags with severity, and a confidence score (0–1) representing how much the AI trusts its own analysis for that particular case.

Combining these into a single call instead of chaining vision → parse → LLM reasoning eliminates a full round-trip, keeping total analysis time at 3–8 seconds rather than 6–16 seconds. This is the difference between a responsive demo and one that feels broken.

### Confidence and Risk Thresholds

| Risk Score | Level | Queue Behavior |
|---|---|---|
| < 0.3 | Low | Standard queue — AI suggests approval, human confirms |
| 0.3 – 0.7 | Medium | Standard review queue |
| > 0.7 | High | Priority queue — flagged for immediate attention |

If AI confidence in its own extraction drops below 0.6, the application is auto-escalated to high priority regardless of risk score. This prevents overconfident bad analysis from slipping through.

---

## Where AI Must Stop

Final identity verification approval or rejection must remain a human decision. This is non-negotiable for three reasons:

1. **Regulatory requirement** — FINTRAC and AML frameworks require accountable human judgment for identity verification. An algorithm cannot bear the legal liability for approving a fraudulent identity.

2. **Sophisticated fraud** — Deepfakes, synthetic identities, and high-quality forgeries specifically crafted to fool vision models require human intuition that current AI cannot reliably replicate.

3. **Accountability** — When something goes wrong, there must be an identifiable human decision-maker in the chain. The audit trail records who made the decision, when, and why.

The system enforces this boundary architecturally: the AI can only move an application to `pending_review` status. Only a human reviewer can move it to `approved`, `rejected`, or `needs_info`. Every human decision requires a mandatory reason — creating the feedback loop necessary for model improvement and compliance auditing.

---

## The Human's Role

The compliance officer's job transforms from processing every application to triaging a priority queue:

- **High-risk applications surface first** — reducing time-to-investigation for potential fraud from hours to minutes
- **AI pre-analysis provides context** — the reviewer sees extracted data, the AI's plain-English explanation, confidence level, and specific flags before making a judgment
- **Mandatory override reasons** — when a reviewer disagrees with the AI (approves something flagged as high-risk, or rejects something scored as low-risk), they must select a reason: AI Incorrect, Suspicious Behavior, Additional Context Needed, Confirmed Risk, or Other. This creates the data needed to monitor AI performance and retrain over time.
- **Full audit trail** — every action (AI analysis completion, human review, status changes) is logged with actor, timestamp, and context for compliance and operational review

---

## Scalability Architecture

Even in the demo, the API and processing worker run as separate concerns. The API writes a job to a SQLite job table and returns immediately. A separate worker process polls the table, processes applications, and updates their status. This isn't a toy pattern — it's the same architecture used in production, just with SQLite instead of Redis.

| Concern | Demo Implementation | Production Path |
|---|---|---|
| Job queue | SQLite job table + polling worker (2s interval) | Redis + Celery / SQS |
| Job locking | `locked_at` timestamp, 60s stale lock recovery | Distributed locks (Redis/Redlock) |
| Retry / timeout | 3 retries with backoff, 30s timeout per job | Dead-letter queue + alerting |
| Rate limiting | In-memory per-IP limiter (429 responses) | Redis-backed distributed rate limiter |
| Upload limits | 5 MB max, Pillow resize before AI analysis | CDN upload, server-side processing pipeline |
| Database | SQLite (WAL mode) | PostgreSQL (change one connection string) |
| File storage | Local filesystem via service layer | S3 (swap the storage service implementation) |
| API scaling | Single process | Stateless API behind load balancer |
| Worker scaling | Single worker process | Multiple worker processes consuming from shared queue |
| Audit trail | Same database | Dedicated audit datastore |

Why this works instead of `BackgroundTasks`:

- **Survives restarts** — Jobs persist in the database. If the worker crashes, unfinished jobs are still in the queue. `BackgroundTasks` loses everything on process restart.
- **Decoupled from the API** — The API never blocks on AI processing. Under load, the API stays responsive while the worker handles the slow LLM calls independently.
- **Multiple workers ready** — Spinning up additional worker processes requires zero code changes. With `BackgroundTasks`, you'd need to redesign the processing model entirely.
- **Observable** — Job status is queryable. You can see what's queued, what's processing, what failed. `BackgroundTasks` is a black box.

Additional design decisions that make the production transition trivial:

- **Stateless API** — No session state. Any request can be handled by any worker instance.
- **Idempotent processing** — Each application follows a status state machine (`submitted → processing → pending_review → reviewed`, with `processing_failed` as a recoverable branch). Re-processing is safe.
- **Storage abstraction** — File operations go through a service layer, not direct filesystem calls.
- **Decoupled audit logging** — Audit is a separate concern from business logic, ready for its own datastore.

---

## What Would Break First at Scale

**False negatives** — Fraud classified as low risk represents the highest operational risk. A fraudulent identity that passes through the "AI suggests approval" path may receive less human scrutiny. Mitigation: periodic random sampling of low-risk approvals by senior reviewers, plus threshold tuning based on override data.

**International document formats** — Edge-case documents from less-common jurisdictions that the vision model has insufficient training data for. These will produce low-confidence scores and auto-escalate, but the volume of escalations could overwhelm reviewers if international applicant volume spikes.

**Adversarial attacks** — High-quality forged documents crafted specifically to fool vision models (deepfake IDs, synthetic documents with correct visual patterns). Requires continuous red-teaming and model updates.

**LLM latency under throughput** — The single-call architecture keeps per-application analysis at 3–8 seconds, and the job queue ensures the API is never blocked. But at high volume, API rate limits from the AI provider become the bottleneck. Requires batching, dedicated capacity agreements, or self-hosted models.

**Model drift** — Fraud techniques evolve. The mandatory override reasons create a continuous feedback signal: if reviewers increasingly select "AI Incorrect," it's a leading indicator that model performance is degrading. A production system needs a pipeline comparing AI recommendations to human decisions over time.

---

## Demo Walkthrough

### 1. Submit an Application (`/`)

Navigate to the landing page. Fill out the applicant form with personal details (name, date of birth, address, country), select a document type (driver's license, passport, or national ID), upload the identity document image, and optionally upload a selfie. Submit the application. You'll receive confirmation with the application ID and can watch the status update in real time: `submitted` → `processing` (within 2–3 seconds as the worker picks it up) → `pending_review` (5–8 seconds later as AI analysis completes).

### 2. Review the Priority Queue (`/dashboard`)

Navigate to the reviewer dashboard. Applications are sorted by risk score (highest first) so the most suspicious cases appear at the top. The stats header shows total pending applications broken down by risk level and average review time. Use the filter tabs to view All, High Risk, Medium, Low, or already Reviewed applications. Each card shows the applicant name, a color-coded risk badge, flag count, confidence indicator, and time in queue.

### 3. Review an Application (`/application/:id`)

Click into any application to see the full detail view. On one side: the uploaded document image. On the other: a table of extracted data fields alongside the applicant's submitted information, with mismatches highlighted. The AI risk assessment panel shows the risk score, confidence score, risk level, and a plain-English explanation of what was found. Below that, a list of specific flags with severity indicators (critical / warning / info).

To complete the review, select a decision (Approve / Reject / Request More Info), choose a mandatory reason from the dropdown, and optionally add notes. Submit. The application status updates and an audit entry is created.

### 4. Queue Under Load

Submit 5–10 applications in quick succession. Switch to the dashboard and watch the queue behavior in real time: applications appear immediately as `submitted`, transition to `processing` as the worker picks them up one by one, and land in `pending_review` as each analysis completes.

Expected behavior at different volumes:

| Volume | Behavior |
|---|---|
| 10 applications | Smooth — all process within ~1 minute |
| 50 application burst | Queues build, API stays responsive, worker drains steadily |
| 100+ applications | Processing slows but system remains stable, no crashes |
| Multiple workers | Works with zero code changes — just start another `worker.py` process |

This demonstrates that the API stays responsive under burst load while the worker processes sequentially — the same pattern that would fan out across multiple workers in production.

### 5. Inspect the Audit Trail (`/audit-log`)

Navigate to the audit log to see a chronological record of every system and human action: application submissions, AI analysis completions, human reviews with their decisions and reasons, and status changes. Filter by application, action type, actor, or date range. When a human overrides the AI's recommendation, the override reason is prominently displayed.

---

## Implementation Guardrails

These aren't architectural decisions — they're implementation details that prevent subtle bugs during development.

**SQLite connection safety** — Because the API and worker are separate processes hitting the same SQLite file, the engine must be configured with `check_same_thread=False` and `pool_pre_ping=True`. Both processes create a new session per request or job — never share a global session. WAL mode handles concurrent access; these settings prevent Python-level threading issues.

**Atomic job claiming** — The worker claims jobs with a single atomic UPDATE (`UPDATE jobs SET locked_at = NOW() WHERE id = (SELECT id FROM jobs WHERE locked_at IS NULL OR locked_at < NOW() - 60s LIMIT 1) RETURNING *`), not a SELECT-then-UPDATE. Even with a single worker, this pattern is correct for the scaling story — two workers running the naive version would pick the same job.

**Structured output validation** — Every OpenAI response is wrapped in a `json.loads()` try/except before any field access. LLMs can return trailing text after valid JSON, partial responses on timeout, or responses with missing required fields. An unguarded parse failure here kills the worker silently. Failed parses enter the standard retry path.

**Paginated list endpoints** — `GET /api/applications` returns paginated results (default `limit=50`) rather than the full table. During a burst demo with 50+ applications, returning everything on every 3-second poll would create visible lag.

**File storage hygiene** — During development and demo testing, uploaded files accumulate on disk. The storage service supports a cleanup utility to purge test data between demo runs without touching the database.

---

## Tech Stack Summary

| Layer | Technology | Rationale |
|---|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui | Wealthsimple-themed, 3s poll interval, clean typographic style |
| State Management | TanStack Query | Server state + polling for real-time updates |
| Backend | Python 3.11+, FastAPI, Uvicorn | Async-native, first-class AI ecosystem, auto-generated API docs |
| ORM | SQLAlchemy 2.0 | Database abstraction enabling trivial Postgres migration |
| Job Queue | SQLite job table + polling worker | Survives restarts, decoupled from API, production-ready pattern |
| AI | OpenAI SDK (vision-capable model) | Single structured call for extraction + analysis + risk scoring |
| Validation | Pydantic v2 | Strict request/response validation |
| Image Processing | Pillow | Document image preprocessing |

---

## Project Structure

```
/
├── frontend/
│   ├── src/
│   │   ├── components/       # UI components (ApplicationCard, RiskBadge, ReviewPanel, etc.)
│   │   ├── pages/            # Route pages (SubmitApplication, Dashboard, ApplicationDetail, AuditLog)
│   │   ├── hooks/            # Data fetching hooks (useApplications, useAuditLog, useStats)
│   │   ├── lib/              # API client, utilities
│   │   └── types/            # Shared TypeScript types
│   └── ...config files
├── backend/
│   ├── app/
│   │   ├── main.py           # FastAPI app, CORS, lifespan
│   │   ├── database.py       # SQLAlchemy engine + session
│   │   ├── models/           # SQLAlchemy models (Application, AuditLog)
│   │   ├── schemas/          # Pydantic request/response schemas
│   │   ├── routes/           # API route handlers
│   │   └── services/         # Business logic (KYC processor, document analyzer, risk scorer, audit)
│   ├── worker.py             # Standalone worker process — polls job queue, runs AI analysis
│   ├── requirements.txt
│   └── uploads/
├── IMPLEMENTATION_PLAN.md
└── README.md
```

---

## API Surface

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/api/applications` | Submit new application (multipart: document + form data) |
| `GET` | `/api/applications` | List applications (filterable, sortable, paginated — default `limit=50`) |
| `GET` | `/api/applications/:id` | Full application detail |
| `PATCH` | `/api/applications/:id/review` | Submit review decision (decision + reason required) |
| `GET` | `/api/applications/:id/document` | Serve stored document image |
| `GET` | `/api/audit-log` | Audit entries (filterable by application, actor, action, date range) |
| `GET` | `/api/stats` | Aggregate statistics for dashboard |
