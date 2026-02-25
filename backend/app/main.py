import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.database import init_db
from app.routes import applications, audit, stats, feedback, simulator, demo, config, voice, webhooks, auth


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(
    title="AI KYC Risk Reviewer",
    description="AI-powered KYC document analysis and risk assessment",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(applications.router)
app.include_router(audit.router)
app.include_router(stats.router)
app.include_router(feedback.router)
app.include_router(simulator.router)
app.include_router(demo.router)
app.include_router(config.router)
app.include_router(voice.router)
app.include_router(webhooks.router)


@app.get("/api/health")
def health_check():
    return {"status": "healthy"}


# --- Serve built frontend (production only) ---
STATIC_DIR = Path(__file__).parent.parent / "static"

if STATIC_DIR.is_dir():
    app.mount("/assets", StaticFiles(directory=str(STATIC_DIR / "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(request: Request, full_path: str):
        """Serve the SPA — any non-API, non-asset path returns index.html."""
        file_path = STATIC_DIR / full_path
        if file_path.is_file():
            return FileResponse(str(file_path))
        return FileResponse(str(STATIC_DIR / "index.html"))
