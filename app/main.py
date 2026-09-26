"""
Main FastAPI Application Entrypoint
AI Agriculture Simulator - AI & Scenario Intelligence Module
"""

import os
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes import router

# Load environment variables from .env if present
load_dotenv()

app = FastAPI(
    title="AI Agriculture Simulator - Scenario Intelligence API",
    description=(
        "Person 3 Module: Translates farmer natural-language inquiries into "
        "structured scenarios, analyzes farm risks, suggests proactive stress-testing "
        "scenarios, and translates simulation results into plain-language farmer advice."
    ),
    version="0.1.0",
)

# Enable CORS for future integration with frontend and backend services
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API routes
app.include_router(router)


if __name__ == "__main__":
    import uvicorn
    host = os.getenv("APP_HOST", "0.0.0.0")
    port = int(os.getenv("APP_PORT", 8000))
    uvicorn.run("app.main:app", host=host, port=port, reload=True)
