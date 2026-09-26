"""Dedicated Firebase Admin SDK & Cloud Firestore persistence module for FarmSim AI."""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any

from ..config import settings


class FirebaseStorageError(RuntimeError):
    """Raised when Firebase initialization or Firestore operations fail."""
    pass


_firebase_app_initialized = False
_db_client: Any = None


def get_firestore_client() -> Any:
    """Initialize Firebase Admin SDK once and return the Firestore client instance."""
    global _firebase_app_initialized, _db_client

    if _db_client is not None:
        return _db_client

    try:
        import firebase_admin
        from firebase_admin import credentials, firestore
    except ImportError as exc:
        raise FirebaseStorageError("firebase-admin package is not installed.") from exc

    credentials_path = settings.firebase_credentials_file
    project_id = settings.firebase_project_id or "farm-1de17"

    if not firebase_admin._apps:
        cred = None
        if credentials_path:
            from ..config import BACKEND_DIR
            candidate = Path(credentials_path)
            abs_path = candidate if candidate.is_absolute() else (BACKEND_DIR / candidate).resolve()
            if not abs_path.exists():
                abs_path = Path(credentials_path).resolve()
            if abs_path.exists() and abs_path.is_file():
                try:
                    cred = credentials.Certificate(str(abs_path))
                except Exception as exc:
                    raise FirebaseStorageError(f"Failed to parse Firebase service-account JSON at {abs_path}: {exc}") from exc
            else:
                raise FirebaseStorageError(f"Firebase credentials file not found at {abs_path}")

        if cred is None:
            try:
                cred = credentials.ApplicationDefault()
            except Exception:
                cred = None

        options = {"projectId": project_id} if project_id else {}
        try:
            if cred:
                firebase_admin.initialize_app(cred, options)
            else:
                firebase_admin.initialize_app(options=options)
            _firebase_app_initialized = True
        except Exception as exc:
            raise FirebaseStorageError(f"Failed to initialize Firebase Admin SDK: {exc}") from exc

    try:
        _db_client = firestore.client()
        return _db_client
    except Exception as exc:
        raise FirebaseStorageError(f"Failed to connect to Cloud Firestore: {exc}") from exc


def check_firestore_connection() -> dict[str, Any]:
    """Verify whether Cloud Firestore is reachable."""
    try:
        db = get_firestore_client()
        # Perform a lightweight read/ping test
        collections = [col.id for col in db.collections()]
        return {
            "connected": True,
            "project_id": settings.firebase_project_id or "farmsim-e8973",
            "collections_found": len(collections),
        }
    except Exception as exc:
        return {
            "connected": False,
            "error": str(exc),
            "project_id": settings.firebase_project_id or "farmsim-e8973",
        }


def _sanitize_for_firestore(data: Any) -> Any:
    """Recursively converts nested lists-of-lists or non-standard structures to Firestore-supported formats."""
    if isinstance(data, dict):
        sanitized = {}
        for k, v in data.items():
            if k == "boundaryGeoJson" and isinstance(v, dict):
                # Coordinates in GeoJSON polygon are list of lists of coordinate pairs [[[lng, lat], ...]]
                # Firestore rejects lists directly containing other lists. Store as JSON string or flattened structure.
                import json
                sanitized[k] = json.dumps(v)
            elif k == "boundary" and isinstance(v, list) and v and isinstance(v[0], (list, tuple)):
                # Store boundary as list of dicts: [{"lat": p[0], "lng": p[1]}, ...]
                # to prevent Firestore nested list error
                sanitized[k] = [{"lat": float(p[0]), "lng": float(p[1])} for p in v]
            else:
                sanitized[k] = _sanitize_for_firestore(v)
        return sanitized
    elif isinstance(data, list):
        # If list contains another list, convert sub-lists to dicts or strings
        cleaned = []
        for item in data:
            if isinstance(item, (list, tuple)):
                cleaned.append([float(x) if isinstance(x, (int, float)) else str(x) for x in item])
            else:
                cleaned.append(_sanitize_for_firestore(item))
        return cleaned
    return data


def _desanitize_from_firestore(data: dict[str, Any] | None) -> dict[str, Any] | None:
    if not data or not isinstance(data, dict):
        return data
    doc = dict(data)
    if "boundaryGeoJson" in doc and isinstance(doc["boundaryGeoJson"], str):
        import json
        try:
            doc["boundaryGeoJson"] = json.loads(doc["boundaryGeoJson"])
        except Exception:
            pass
    if "boundary" in doc and isinstance(doc["boundary"], list):
        # Convert [{'lat': 19.12, 'lng': 72.90}, ...] back to [[19.12, 72.90], ...]
        if doc["boundary"] and isinstance(doc["boundary"][0], dict) and "lat" in doc["boundary"][0]:
            doc["boundary"] = [[float(p["lat"]), float(p["lng"])] for p in doc["boundary"]]
    return doc


class FirestoreRepository:
    """Production-grade Firestore Repository adapter."""

    def __init__(self) -> None:
        self.db = get_firestore_client()

    def _set(self, collection_name: str, document_id: str, document: dict[str, Any]) -> None:
        try:
            sanitized = _sanitize_for_firestore(document)
            self.db.collection(collection_name).document(document_id).set(sanitized)
        except Exception as exc:
            raise FirebaseStorageError(f"Firestore set error on {collection_name}/{document_id}: {exc}") from exc

    def _get(self, collection_name: str, document_id: str) -> dict[str, Any] | None:
        try:
            snapshot = self.db.collection(collection_name).document(document_id).get()
            return _desanitize_from_firestore(snapshot.to_dict()) if snapshot.exists else None
        except Exception as exc:
            raise FirebaseStorageError(f"Firestore get error on {collection_name}/{document_id}: {exc}") from exc

    def _list_by_field(self, collection_name: str, field_name: str, field_value: str) -> list[dict[str, Any]]:
        try:
            query = self.db.collection(collection_name).where(field_name, "==", field_value)
            return [_desanitize_from_firestore(doc.to_dict()) for doc in query.stream()]
        except Exception as exc:
            raise FirebaseStorageError(f"Firestore query error on {collection_name}: {exc}") from exc

    # User Operations
    def create_user(self, user: dict[str, Any]) -> None:
        user_id = user.get("user_id") or user.get("id")
        self._set("users", user_id, user)

    def get_user(self, user_id: str) -> dict[str, Any] | None:
        return self._get("users", user_id)

    def get_user_by_email(self, email: str) -> dict[str, Any] | None:
        matches = self._list_by_field("users", "email", email.strip().lower())
        return matches[0] if matches else None

    def list_users(self) -> list[dict[str, Any]]:
        try:
            return [doc.to_dict() for doc in self.db.collection("users").stream()]
        except Exception as exc:
            raise FirebaseStorageError(f"Firestore list_users error: {exc}") from exc

    # Farm Operations
    def create_farm(self, farm: dict[str, Any]) -> None:
        farm_id = farm.get("farm_id") or farm.get("id")
        owner_id = farm.get("owner_id") or farm.get("ownerId")
        self._set("farms", farm_id, farm)
        if owner_id:
            try:
                sanitized = _sanitize_for_firestore(farm)
                self.db.collection("users").document(owner_id).collection("farms").document(farm_id).set(sanitized)
            except Exception:
                pass

    def get_farm(self, farm_id: str) -> dict[str, Any] | None:
        if not farm_id or farm_id in ("undefined", "null", ""):
            return None
        doc = self._get("farms", farm_id)
        if doc:
            return doc
        try:
            for user_doc in self.db.collection("users").stream():
                sub = user_doc.reference.collection("farms").document(farm_id).get()
                if sub.exists:
                    return _desanitize_from_firestore(sub.to_dict())
        except Exception:
            pass
        return None

    def list_farms(self) -> list[dict[str, Any]]:
        try:
            return [_desanitize_from_firestore(doc.to_dict()) for doc in self.db.collection("farms").stream()]
        except Exception as exc:
            raise FirebaseStorageError(f"Firestore list_farms error: {exc}") from exc

    def update_farm(self, farm_id: str, updates: dict[str, Any]) -> dict[str, Any] | None:
        if not farm_id or farm_id in ("undefined", "null", ""):
            return None
        current = self.get_farm(farm_id)
        if not current:
            return None
        owner_id = current.get("owner_id") or current.get("ownerId")
        try:
            self.db.collection("farms").document(farm_id).update(updates)
            if owner_id:
                try:
                    self.db.collection("users").document(owner_id).collection("farms").document(farm_id).update(updates)
                except Exception:
                    pass
            return self.get_farm(farm_id)
        except Exception as exc:
            raise FirebaseStorageError(f"Firestore update_farm error: {exc}") from exc

    def delete_farm(self, farm_id: str) -> None:
        if not farm_id or farm_id in ("undefined", "null", ""):
            return
        current = self.get_farm(farm_id)
        owner_id = current.get("owner_id") or current.get("ownerId") if current else None
        try:
            self.db.collection("farms").document(farm_id).delete()
            if owner_id:
                try:
                    self.db.collection("users").document(owner_id).collection("farms").document(farm_id).delete()
                except Exception:
                    pass
        except Exception as exc:
            raise FirebaseStorageError(f"Firestore delete_farm error: {exc}") from exc

    # Zone Operations
    def create_zone(self, zone: dict[str, Any]) -> None:
        self._set("zones", zone["zone_id"], zone)

    def get_zone(self, farm_id: str, zone_id: str) -> dict[str, Any] | None:
        zone = self._get("zones", zone_id)
        return zone if zone and zone.get("farm_id") == farm_id else None

    def list_zones(self, farm_id: str) -> list[dict[str, Any]]:
        return self._list_by_field("zones", "farm_id", farm_id)

    def update_zone(self, farm_id: str, zone_id: str, updates: dict[str, Any]) -> dict[str, Any] | None:
        if not self.get_zone(farm_id, zone_id):
            return None
        try:
            self.db.collection("zones").document(zone_id).update(updates)
            return self.get_zone(farm_id, zone_id)
        except Exception as exc:
            raise FirebaseStorageError(f"Firestore update_zone error: {exc}") from exc

    def delete_zone(self, farm_id: str, zone_id: str) -> None:
        try:
            self.db.collection("zones").document(zone_id).delete()
        except Exception as exc:
            raise FirebaseStorageError(f"Firestore delete_zone error: {exc}") from exc

    # Scenario Operations
    def create_scenario(self, scenario: dict[str, Any]) -> None:
        self._set("scenarios", scenario["scenario_id"], scenario)

    def get_scenario(self, scenario_id: str) -> dict[str, Any] | None:
        return self._get("scenarios", scenario_id)

    def list_scenarios(self, farm_id: str) -> list[dict[str, Any]]:
        return self._list_by_field("scenarios", "farm_id", farm_id)

    # Simulation & Result Operations
    def create_simulation(self, simulation: dict[str, Any]) -> None:
        self._set("simulations", simulation["simulation_id"], simulation)
        # Also store under simulation_results collection
        self._set("simulation_results", simulation["simulation_id"], simulation)

    def get_simulation(self, simulation_id: str) -> dict[str, Any] | None:
        result = self._get("simulations", simulation_id)
        if not result:
            result = self._get("simulation_results", simulation_id)
        return result

    def list_simulations(self, farm_id: str) -> list[dict[str, Any]]:
        return self._list_by_field("simulations", "farm_id", farm_id)

    def save_simulation_result(self, result: dict[str, Any]) -> None:
        self._set("simulation_results", result["simulation_id"], result)

    def get_simulation_result(self, simulation_id: str) -> dict[str, Any] | None:
        return self._get("simulation_results", simulation_id)
