"""Create a demo farm from the command line: ``python -m app.seed``."""

from __future__ import annotations

from fastapi.testclient import TestClient

from .main import app


if __name__ == "__main__":
    response = TestClient(app).post("/demo/farm")
    response.raise_for_status()
    print(response.json()["farm_id"])
