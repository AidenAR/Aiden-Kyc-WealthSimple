from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import init_db
from app.routes import applications, audit, stats, feedback, simulator, demo, config, voice, webhooks


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
