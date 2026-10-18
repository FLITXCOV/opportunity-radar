from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes import router as api_router

app = FastAPI(title="Opportunity Radar API", version="1.0.0")

from app.db.database import engine, Base
Base.metadata.create_all(bind=engine)

import os

# Setup CORS to allow Next.js frontend (local, Vercel, or custom production domains)
allowed_origins_raw = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000")
allowed_origins = [o.strip() for o in allowed_origins_raw.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api/v1")

@app.get("/")
def health_check():
    return {"status": "ok", "message": "Opportunity Radar API is running"}
