# AI KYC Risk Reviewer

AI-powered KYC document analysis and risk assessment system built for Wealthsimple's compliance workflow. When Wealthsimple's auto-verification (Persona/Onfido) fails for ~10-30% of applicants, this tool lets AI handle document extraction, cross-referencing, biometric matching, and risk scoring — so compliance teams only manually review truly complex cases.

See [FEATURES.md](FEATURES.md) for a complete feature breakdown.

## Live Demo

> **[https://your-app.up.railway.app](https://your-app.up.railway.app)** *(update after deploying)*

## Quick Start

### Prerequisites

- An [OpenAI API key](https://platform.openai.com/api-keys) with GPT-4o access

### Option 1: Docker Compose (recommended for local)

```bash
# 1. Add your OpenAI API key
echo "OPENAI_API_KEY=sk-..." > backend/.env

# 2. Start everything
docker compose up --build

# 3. Open http://localhost:3000
```

Three containers (API, worker, frontend) start in the correct order with shared volumes.

### Option 2: Local Development

```bash
# 1. Add your OpenAI API key
echo "OPENAI_API_KEY=sk-..." > backend/.env

# 2. Run the start script
./start.sh

# 3. Open http://localhost:5173
```

Or start each process manually:

```bash
# Terminal 1 — API
cd backend && python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# Terminal 2 — Worker
cd backend && source venv/bin/activate
python worker.py

# Terminal 3 — Frontend
cd frontend && npm install && npm run dev
```

### Option 3: Deploy to Railway

```bash
# 1. Install Railway CLI: https://docs.railway.com/guides/cli
# 2. Login and create a project
railway login
railway init

# 3. Set your OpenAI key
railway variables set OPENAI_API_KEY=sk-...

# 4. Deploy (uses root Dockerfile — builds frontend + backend together)
railway up

# 5. For the worker: create a second service in the Railway dashboard
#    pointing to Dockerfile.worker in the same repo, with the same env vars
```

The root `Dockerfile` builds the frontend and serves it from FastAPI, so you get **one URL** for the entire app.

## Architecture

| Layer | Technology | Rationale |
|---|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS | Wealthsimple-themed, 3s poll interval |
| State | TanStack Query | Server state + polling for real-time updates |
| Backend | Python, FastAPI, SQLAlchemy | Async-native, first-class AI ecosystem, auto-generated API docs |
| Worker | Standalone polling process | Survives restarts, decoupled from API, scales horizontally |
| AI | OpenAI GPT-4o (vision + structured), Whisper | Document analysis, facial matching, voice biometrics |
| Database | SQLite (WAL mode) | Swappable to Postgres via one connection string change |

## Pages

| Route | View | Description |
|---|---|---|
| `/` | Both | Submit a KYC application with documents, selfie, voice sample |
| `/dashboard` | Admin | Review queue sorted by risk, filterable by status |
| `/application/:id` | Admin | Full detail — AI analysis, biometrics, evidence, regulatory flags |
| `/application/:id` | Applicant | Progress tracker with status timeline |
| `/my-applications` | Applicant | Personal application list filtered by profile email |
| `/voice-verify` | Applicant | Voice re-verification against enrolled sample |
| `/audit-log` | Admin | Chronological record of all system and human actions |
| `/settings` | Admin | Configurable screening rules, thresholds, country lists |
| `/webhooks` | Admin | Mock Wealthsimple webhook integration + activity log |

## API

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/api/applications` | Submit application (multipart: docs + selfie + voice) |
| `GET` | `/api/applications` | List applications (filterable, paginated) |
| `GET` | `/api/applications/:id` | Application detail |
| `PATCH` | `/api/applications/:id/review` | Submit review decision |
| `GET` | `/api/applications/:id/document/:idx` | Serve document image |
| `GET` | `/api/applications/:id/selfie` | Serve selfie photo |
| `GET` | `/api/applications/:id/voice` | Serve enrolled voice sample |
| `POST` | `/api/voice/reverify` | Compare new voice against enrolled sample |
| `POST` | `/api/webhooks/incoming` | Receive incoming Wealthsimple webhook |
| `POST` | `/api/webhooks/simulate-incoming` | Fire a demo incoming webhook |
| `GET` | `/api/webhooks/logs` | Webhook activity log |
| `GET/PUT` | `/api/webhooks/config` | Webhook connection settings |
| `GET/PUT` | `/api/config/screening` | Screening rules configuration |
| `POST` | `/api/feedback/:id` | Log AI feedback for retraining |
| `POST` | `/api/demo/adversarial/:scenario` | Run adversarial test scenario |
| `GET` | `/api/audit-log` | Audit log (filterable) |
| `GET` | `/api/stats` | Dashboard statistics |

Interactive API docs at `/docs` when the server is running.

## Project Structure

```
├── Dockerfile                  # Combined build (frontend + backend) for Railway
├── Dockerfile.worker           # Worker-only build for Railway second service
├── docker-compose.yml          # Local multi-container orchestration
├── railway.toml                # Railway deployment config
├── start.sh                    # Local dev startup script
├── FEATURES.md                 # Complete feature documentation
├── backend/
│   ├── Dockerfile              # Backend-only (for docker-compose)
│   ├── requirements.txt
│   ├── worker.py               # Job queue consumer with retry + backoff
│   ├── app/
│   │   ├── main.py             # FastAPI app + SPA static file serving
│   │   ├── database.py         # SQLAlchemy engine, auto-migration
│   │   ├── models/             # Application, Job, AuditLog, WebhookLog, Feedback
│   │   ├── schemas/            # Pydantic request/response validation
│   │   ├── routes/             # API endpoints (applications, webhooks, voice, config...)
│   │   └── services/           # AI analyzer, facial match, voice, regulatory, webhooks
├── frontend/
│   ├── Dockerfile              # Frontend-only (for docker-compose)
│   ├── nginx.conf              # SPA routing + API proxy
│   └── src/
│       ├── components/         # UI components (panels, recorders, layout)
│       ├── pages/              # All page views (dashboard, detail, settings, webhooks...)
│       ├── hooks/              # View mode, theme, TanStack Query
│       ├── lib/                # API client, utilities
│       └── types/              # Shared TypeScript interfaces
└── .env.example                # Required environment variables
```
