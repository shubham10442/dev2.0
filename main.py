from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os

from app.core.config import settings
from app.core.database import engine, Base
from app.api.v1 import auth, donations, users, certificates, stats, events

# Auto-create tables on launch
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="ANN (अन्न) — Surplus Food Redistribution Platform REST API & Real-Time SSE Hub",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API Routers
app.include_router(auth.router, prefix=settings.API_V1_STR)
app.include_router(donations.router, prefix=settings.API_V1_STR)
app.include_router(users.router, prefix=settings.API_V1_STR)
app.include_router(certificates.router, prefix=settings.API_V1_STR)
app.include_router(stats.router, prefix=settings.API_V1_STR)
app.include_router(events.router, prefix=settings.API_V1_STR)

# Ensure uploads folder exists and is mounted
os.makedirs("uploads", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# Mount root directory to serve index.html, style.css, app.js, logo.png directly
ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if os.path.exists(os.path.join(ROOT_DIR, "index.html")):
    app.mount("/", StaticFiles(directory=ROOT_DIR, html=True), name="frontend")

@app.get("/api/health", tags=["Health"])
def health_check():
    return {
        "status": "operational",
        "platform": "ANN Surplus Food Redistribution Network",
        "engine": "FastAPI + PostgreSQL"
    }