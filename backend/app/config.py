"""Environment-backed configuration for the FarmSim service."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parents[1]
load_dotenv(BACKEND_DIR / ".env")
load_dotenv(BACKEND_DIR.parent / ".env")


@dataclass(frozen=True)
class Settings:
    """Runtime settings. Secrets only ever come from environment variables."""

    storage_mode: str = os.getenv("STORAGE_MODE", "firebase")
    database_url: str = os.getenv("DATABASE_URL", "firestore://")
    firebase_project_id: str = os.getenv("FIREBASE_PROJECT_ID", "farmsim-e8973")
    firebase_credentials_file: str | None = (
        os.getenv("FIREBASE_CREDENTIALS_FILE") or os.getenv("FIREBASE_SERVICE_ACCOUNT_PATH") or "./firebase-service-account.json"
    )
    ai_api_key: str | None = os.getenv("AI_API_KEY") or None
    ai_model: str = os.getenv("AI_MODEL", "gpt-4.1-mini")
    ai_api_base_url: str = os.getenv("AI_API_BASE_URL", "https://api.openai.com/v1")
    cors_origins: tuple[str, ...] = tuple(
        origin.strip()
        for origin in os.getenv("CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(",")
        if origin.strip()
    )


    @property
    def firebase_service_account_path(self) -> str | None:
        return self.firebase_credentials_file


settings = Settings()
