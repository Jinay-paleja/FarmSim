"""Small persistence adapters for hackathon-speed local and Firebase storage."""

from __future__ import annotations

import json
import sqlite3
import threading
from abc import ABC, abstractmethod
from pathlib import Path
from typing import Any


class RepositoryError(RuntimeError):
    pass


class Repository(ABC):
    @abstractmethod
    def create_user(self, user: dict[str, Any]) -> None: ...

    @abstractmethod
    def get_user(self, user_id: str) -> dict[str, Any] | None: ...

    @abstractmethod
    def get_user_by_email(self, email: str) -> dict[str, Any] | None: ...

    @abstractmethod
    def list_users(self) -> list[dict[str, Any]]: ...

    @abstractmethod
    def create_farm(self, farm: dict[str, Any]) -> None: ...

    @abstractmethod
    def get_farm(self, farm_id: str) -> dict[str, Any] | None: ...

    @abstractmethod
    def list_farms(self) -> list[dict[str, Any]]: ...

    @abstractmethod
    def update_farm(self, farm_id: str, updates: dict[str, Any]) -> dict[str, Any] | None: ...

    @abstractmethod
    def create_zone(self, zone: dict[str, Any]) -> None: ...

    @abstractmethod
    def get_zone(self, farm_id: str, zone_id: str) -> dict[str, Any] | None: ...

    @abstractmethod
    def list_zones(self, farm_id: str) -> list[dict[str, Any]]: ...

    @abstractmethod
    def update_zone(self, farm_id: str, zone_id: str, updates: dict[str, Any]) -> dict[str, Any] | None: ...

    @abstractmethod
    def create_scenario(self, scenario: dict[str, Any]) -> None: ...

    @abstractmethod
    def get_scenario(self, scenario_id: str) -> dict[str, Any] | None: ...

    @abstractmethod
    def list_scenarios(self, farm_id: str) -> list[dict[str, Any]]: ...

    @abstractmethod
    def create_simulation(self, simulation: dict[str, Any]) -> None: ...

    @abstractmethod
    def get_simulation(self, simulation_id: str) -> dict[str, Any] | None: ...

    @abstractmethod
    def list_simulations(self, farm_id: str) -> list[dict[str, Any]]: ...


class SQLiteRepository(Repository):
    """JSON documents in SQLite: simple to ship, structured enough to evolve."""

    def __init__(self, database_url: str):
        if not database_url.startswith("sqlite:///"):
            raise RepositoryError("SQLite DATABASE_URL must begin with sqlite:///")
        raw_path = database_url.removeprefix("sqlite:///")
        self.path = Path(raw_path).resolve()
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.RLock()
        self._initialize()

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.path, check_same_thread=False)
        connection.row_factory = sqlite3.Row
        return connection

    def _initialize(self) -> None:
        with self._lock, self._connect() as conn:
            conn.executescript(
                """
                CREATE TABLE IF NOT EXISTS users (
                    id TEXT PRIMARY KEY,
                    email TEXT UNIQUE,
                    data TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS farms (
                    id TEXT PRIMARY KEY,
                    data TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS zones (
                    id TEXT PRIMARY KEY,
                    farm_id TEXT NOT NULL,
                    data TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS scenarios (
                    id TEXT PRIMARY KEY,
                    farm_id TEXT NOT NULL,
                    data TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS simulations (
                    id TEXT PRIMARY KEY,
                    farm_id TEXT NOT NULL,
                    scenario_id TEXT,
                    data TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_zones_farm ON zones(farm_id);
                CREATE INDEX IF NOT EXISTS idx_scenarios_farm ON scenarios(farm_id);
                CREATE INDEX IF NOT EXISTS idx_simulations_farm ON simulations(farm_id);
                """
            )

    @staticmethod
    def _encode(document: dict[str, Any]) -> str:
        return json.dumps(document, separators=(",", ":"), default=str)

    @staticmethod
    def _decode(row: sqlite3.Row | None) -> dict[str, Any] | None:
        return json.loads(row["data"]) if row else None

    def _insert(self, table: str, document_id: str, document: dict[str, Any], **columns: str | None) -> None:
        names = ["id", *columns.keys(), "data"]
        values = [document_id, *columns.values(), self._encode(document)]
        placeholders = ", ".join("?" for _ in values)
        with self._lock, self._connect() as conn:
            try:
                conn.execute(
                    f"INSERT INTO {table} ({', '.join(names)}) VALUES ({placeholders})", values  # noqa: S608
                )
            except sqlite3.IntegrityError as exc:
                raise RepositoryError(f"{table[:-1].capitalize()} already exists") from exc

    def _get(self, table: str, document_id: str) -> dict[str, Any] | None:
        with self._lock, self._connect() as conn:
            return self._decode(conn.execute(f"SELECT data FROM {table} WHERE id = ?", (document_id,)).fetchone())

    def _list_for_farm(self, table: str, farm_id: str) -> list[dict[str, Any]]:
        with self._lock, self._connect() as conn:
            rows = conn.execute(f"SELECT data FROM {table} WHERE farm_id = ? ORDER BY rowid", (farm_id,)).fetchall()
        return [json.loads(row["data"]) for row in rows]

    def create_user(self, user: dict[str, Any]) -> None:
        user_id = user.get("user_id") or user.get("id")
        self._insert("users", user_id, user, email=user.get("email"))

    def get_user(self, user_id: str) -> dict[str, Any] | None:
        return self._get("users", user_id)

    def get_user_by_email(self, email: str) -> dict[str, Any] | None:
        with self._lock, self._connect() as conn:
            row = conn.execute("SELECT data FROM users WHERE LOWER(email) = ?", (email.strip().lower(),)).fetchone()
            return self._decode(row)

    def list_users(self) -> list[dict[str, Any]]:
        with self._lock, self._connect() as conn:
            rows = conn.execute("SELECT data FROM users ORDER BY rowid DESC").fetchall()
        return [json.loads(row["data"]) for row in rows]

    def create_farm(self, farm: dict[str, Any]) -> None:
        self._insert("farms", farm["farm_id"], farm)

    def get_farm(self, farm_id: str) -> dict[str, Any] | None:
        return self._get("farms", farm_id)

    def list_farms(self) -> list[dict[str, Any]]:
        with self._lock, self._connect() as conn:
            rows = conn.execute("SELECT data FROM farms ORDER BY rowid DESC").fetchall()
        return [json.loads(row["data"]) for row in rows]

    def update_farm(self, farm_id: str, updates: dict[str, Any]) -> dict[str, Any] | None:
        document = self.get_farm(farm_id)
        if not document:
            return None
        document.update(updates)
        with self._lock, self._connect() as conn:
            conn.execute("UPDATE farms SET data = ? WHERE id = ?", (self._encode(document), farm_id))
        return document

    def create_zone(self, zone: dict[str, Any]) -> None:
        self._insert("zones", zone["zone_id"], zone, farm_id=zone["farm_id"])

    def get_zone(self, farm_id: str, zone_id: str) -> dict[str, Any] | None:
        zone = self._get("zones", zone_id)
        return zone if zone and zone["farm_id"] == farm_id else None

    def list_zones(self, farm_id: str) -> list[dict[str, Any]]:
        return self._list_for_farm("zones", farm_id)

    def update_zone(self, farm_id: str, zone_id: str, updates: dict[str, Any]) -> dict[str, Any] | None:
        document = self.get_zone(farm_id, zone_id)
        if not document:
            return None
        document.update(updates)
        with self._lock, self._connect() as conn:
            conn.execute("UPDATE zones SET data = ? WHERE id = ?", (self._encode(document), zone_id))
        return document

    def create_scenario(self, scenario: dict[str, Any]) -> None:
        self._insert("scenarios", scenario["scenario_id"], scenario, farm_id=scenario["farm_id"])

    def get_scenario(self, scenario_id: str) -> dict[str, Any] | None:
        return self._get("scenarios", scenario_id)

    def list_scenarios(self, farm_id: str) -> list[dict[str, Any]]:
        return self._list_for_farm("scenarios", farm_id)

    def create_simulation(self, simulation: dict[str, Any]) -> None:
        self._insert(
            "simulations",
            simulation["simulation_id"],
            simulation,
            farm_id=simulation["farm_id"],
            scenario_id=simulation.get("scenario_id"),
        )

    def get_simulation(self, simulation_id: str) -> dict[str, Any] | None:
        return self._get("simulations", simulation_id)

    def list_simulations(self, farm_id: str) -> list[dict[str, Any]]:
        return self._list_for_farm("simulations", farm_id)


class FirestoreRepository(Repository):
    """Firebase/Firestore repository adapter backed by backend.app.storage.firebase."""

    def __init__(self, service_account_path: str | None = None) -> None:
        from .storage.firebase import FirestoreRepository as StorageFirestoreRepo, FirebaseStorageError
        try:
            self._impl = StorageFirestoreRepo()
        except FirebaseStorageError as exc:
            raise RepositoryError(f"Firebase Firestore initialization failed: {exc}") from exc

    def create_user(self, user: dict[str, Any]) -> None:
        self._impl.create_user(user)

    def get_user(self, user_id: str) -> dict[str, Any] | None:
        return self._impl.get_user(user_id)

    def get_user_by_email(self, email: str) -> dict[str, Any] | None:
        return self._impl.get_user_by_email(email)

    def list_users(self) -> list[dict[str, Any]]:
        return self._impl.list_users()

    def create_farm(self, farm: dict[str, Any]) -> None:
        self._impl.create_farm(farm)

    def get_farm(self, farm_id: str) -> dict[str, Any] | None:
        return self._impl.get_farm(farm_id)

    def list_farms(self) -> list[dict[str, Any]]:
        return self._impl.list_farms()

    def update_farm(self, farm_id: str, updates: dict[str, Any]) -> dict[str, Any] | None:
        return self._impl.update_farm(farm_id, updates)

    def create_zone(self, zone: dict[str, Any]) -> None:
        self._impl.create_zone(zone)

    def get_zone(self, farm_id: str, zone_id: str) -> dict[str, Any] | None:
        return self._impl.get_zone(farm_id, zone_id)

    def list_zones(self, farm_id: str) -> list[dict[str, Any]]:
        return self._impl.list_zones(farm_id)

    def update_zone(self, farm_id: str, zone_id: str, updates: dict[str, Any]) -> dict[str, Any] | None:
        return self._impl.update_zone(farm_id, zone_id, updates)

    def create_scenario(self, scenario: dict[str, Any]) -> None:
        self._impl.create_scenario(scenario)

    def get_scenario(self, scenario_id: str) -> dict[str, Any] | None:
        return self._impl.get_scenario(scenario_id)

    def list_scenarios(self, farm_id: str) -> list[dict[str, Any]]:
        return self._impl.list_scenarios(farm_id)

    def create_simulation(self, simulation: dict[str, Any]) -> None:
        self._impl.create_simulation(simulation)

    def get_simulation(self, simulation_id: str) -> dict[str, Any] | None:
        return self._impl.get_simulation(simulation_id)

    def list_simulations(self, farm_id: str) -> list[dict[str, Any]]:
        return self._impl.list_simulations(farm_id)


def create_repository(database_url: str, firebase_service_account_path: str | None = None) -> Repository:
    from .config import settings
    if settings.storage_mode == "firebase" or database_url.startswith("firestore://"):
        return FirestoreRepository(firebase_service_account_path)
    return SQLiteRepository(database_url)
