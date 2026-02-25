# AI KYC Risk Reviewer

AI-powered KYC document analysis and risk assessment system. Compliance teams review only high-risk cases while AI handles document extraction, consistency checking, and risk scoring.

## Quick Start

### Prerequisites

- An [OpenAI API key](https://platform.openai.com/api-keys) with GPT-4o access

### Option 1: Docker Compose (recommended)

```bash
# 1. Add your OpenAI API key
echo "OPENAI_API_KEY=sk-..." > backend/.env

# 2. Start everything
docker compose up --build

# 3. Open http://localhost:3000
```

That's it. Three containers (API, worker, frontend) start in the correct order with shared volumes for the database and uploads.

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

## Architecture

| Layer | Technology | Rationale |
|---|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS | Wealthsimple-themed, 3s poll interval |
| State | TanStack Query | Server state + polling for real-time updates |
| Backend | Python, FastAPI, SQLAlchemy | Async-native, first-class AI ecosystem, auto-generated API docs |
| Worker | Standalone polling process | Survives restarts, decoupled from API, scales horizontally |
| AI | OpenAI GPT-4o (vision + structured output) | Single-call extraction + analysis + risk scoring |
| Database | SQLite (WAL mode) | Swappable to Postgres via one connection string change |

## Pages

- **`/`** — Submit a KYC application with identity document
- **`/dashboard`** — Review queue sorted by risk, filterable by status and risk level
- **`/application/:id`** — Full detail view with AI analysis, extracted data comparison, and review actions
- **`/audit-log`** — Chronological record of all system and human actions

## API

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/api/applications` | Submit application (multipart) |
| `GET` | `/api/applications` | List applications (filterable, paginated) |
| `GET` | `/api/applications/:id` | Application detail |
| `PATCH` | `/api/applications/:id/review` | Submit review decision |
| `GET` | `/api/applications/:id/document` | Serve document image |
| `GET` | `/api/audit-log` | Audit log (filterable) |
| `GET` | `/api/stats` | Dashboard statistics |

Interactive API documentation available at [http://localhost:8000/docs](http://localhost:8000/docs) when the server is running.

## Project Structure

```
├── docker-compose.yml          # One-command orchestration
├── start.sh                    # Local dev startup script
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── app/
│   │   ├── main.py             # FastAPI app, CORS, lifespan
│   │   ├── database.py         # SQLAlchemy engine + session (WAL mode)
│   │   ├── models/             # Application, Job, AuditLog
│   │   ├── schemas/            # Pydantic request/response validation
│   │   ├── routes/             # API endpoints
│   │   └── services/           # Storage, AI analyzer, audit, rate limiter
│   └── worker.py               # Job queue consumer with retry + backoff
├── frontend/
│   ├── Dockerfile
│   ├── nginx.conf              # SPA routing + API proxy
│   └── src/
│       ├── components/         # ApplicationCard, RiskBadge, StatusBadge, Layout
│       ├── pages/              # SubmitApplication, Dashboard, ApplicationDetail, AuditLog
│       ├── hooks/              # TanStack Query data hooks
│       ├── lib/                # API client, utilities
│       └── types/              # Shared TypeScript types
└── IMPLEMENTATION_PLAN.md      # Detailed design document
```
