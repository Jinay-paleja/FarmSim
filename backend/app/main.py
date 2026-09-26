"""FastAPI composition root for the FarmSim Agriculture Simulator."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
import hashlib
import hmac
import os
from secrets import token_urlsafe
from typing import Any
from uuid import uuid4

from fastapi import APIRouter, FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config import Settings, settings
from .repository import FirestoreRepository, Repository, RepositoryError, create_repository
from .schemas import (
    AnalyzeRiskRequest,
    CompareRequest,
    ComparisonResult,
    ComparisonSimulation,
    ComparisonTimelinePoint,
    ExplainResultRequest,
    ExplanationResponse,
    Farm,
    FarmRiskAssessment,
    FarmCreate,
    FarmUpdate,
    ParseScenarioRequest,
    ResultMetrics,
    Scenario,
    ScenarioChange,
    ScenarioCreate,
    SimulationRequest,
    SimulationResult,
    SuggestScenariosRequest,
    User,
    UserCreate,
    UserLogin,
    UserProfile,
    Zone,
    ZoneInput,
    ZoneUpdate,
)
from .services.ai_service import AIServiceError, AgriculturalAIService
from .services.risk_service import FarmRiskService
from .services.simulation_engine import SimulationEngineError, simulate_farm


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid4().hex[:12]}"


def hash_password(password: str) -> str:
    """Create a salted password hash without storing the submitted password."""
    salt = os.urandom(16)
    iterations = 310_000
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, iterations)
    return f"pbkdf2_sha256${iterations}${salt.hex()}${digest.hex()}"


def password_matches(password: str, stored_hash: str | None) -> bool:
    if not stored_hash:
        return False
    try:
        algorithm, raw_iterations, salt_hex, expected_hex = stored_hash.split("$", 3)
        if algorithm != "pbkdf2_sha256":
            return False
        digest = hashlib.pbkdf2_hmac(
            "sha256", password.encode("utf-8"), bytes.fromhex(salt_hex), int(raw_iterations)
        )
        return hmac.compare_digest(digest.hex(), expected_hex)
    except (TypeError, ValueError):
        # Compatibility for accounts created before password hashing was added.
        # New registrations always use PBKDF2 above.
        return hmac.compare_digest(stored_hash, password)


def not_found(resource: str, identifier: str) -> HTTPException:
    return HTTPException(status_code=404, detail=f"{resource} '{identifier}' was not found")


def normalize_changes(changes: dict[str, float] | list[ScenarioChange]) -> dict[str, float]:
    """Accept the older UI's change items and persist the canonical map."""
    if isinstance(changes, dict):
        return {key: float(value) for key, value in changes.items()}

    normalized: dict[str, float] = {}
    for change in changes:
        change_type = change.type.lower()
        value = change.value
        if change_type == "rainfall_decrease":
            normalized["rainfall_multiplier"] = max(0.0, 1 + value / 100)
        elif change_type == "rainfall_increase":
            normalized["rainfall_multiplier"] = 1 + value / 100
        elif change_type in {"temperature_increase", "heatwave"}:
            normalized["temperature_delta"] = value if change_type == "temperature_increase" else 5.0
            if change_type == "heatwave":
                normalized["heatwave_days"] = value
        elif change_type in {"temperature_decrease", "cold_snap"}:
            normalized["temperature_delta"] = -abs(value)
        elif change_type in {"irrigation_decrease", "irrigation_failure"}:
            normalized["irrigation_multiplier"] = max(0.0, 1 + value / 100)
        elif change_type == "irrigation_increase":
            normalized["irrigation_multiplier"] = 1 + value / 100
        elif change_type in {"fertilizer_increase", "fertilizer_decrease"}:
            normalized["nutrient_multiplier"] = max(0.0, 1 + value / 100)
        elif change_type == "nitrogen_deficiency":
            normalized["nitrogen_multiplier"] = max(0.0, 1 + value / 100)
        elif change_type == "phosphorus_deficiency":
            normalized["phosphorus_multiplier"] = max(0.0, 1 + value / 100)
        elif change_type == "potassium_deficiency":
            normalized["potassium_multiplier"] = max(0.0, 1 + value / 100)
        elif change_type in {"disease_introduced", "disease_spread"}:
            normalized["disease_pressure"] = normalized.get("disease_pressure", 0.0) + value * 18
        elif change_type == "pest_outbreak":
            normalized["pest_pressure"] = normalized.get("pest_pressure", 0.0) + value * 14
        else:
            # Preserve a custom well-named change for an upgraded engine.
            normalized[change.parameter] = value
    return normalized


def build_farm(repository: Repository, farm_id: str) -> dict[str, Any] | None:
    farm = repository.get_farm(farm_id)
    if not farm:
        return None
    farm["zones"] = repository.list_zones(farm_id)
    return farm


def as_farm(repository: Repository, farm_id: str) -> Farm:
    farm = build_farm(repository, farm_id)
    if not farm:
        raise not_found("Farm", farm_id)
    return Farm.model_validate(farm)


def _create_firebase_custom_token(uid: str) -> str | None:
    """Issue a Firebase custom token for browser-side Firebase Auth sign-in.

    Returns None when the Admin SDK is unavailable so the app can still fall
    back to backend-only persistence.
    """
    try:
        from firebase_admin import auth as firebase_auth
    except ImportError:
        return None
    try:
        return firebase_auth.create_custom_token(uid)
    except Exception as exc:
        print(f"[warn] Could not create Firebase custom token for {uid}: {exc}")
        return None


def create_api_router(
    repository: Repository,
    ai_service: AgriculturalAIService,
    risk_service: FarmRiskService,
    require_session_auth: bool,
) -> APIRouter:
    router = APIRouter(tags=["FarmSim"])
    sessions: dict[str, tuple[str, datetime]] = {}

    def session_user(request: Request) -> str | None:
        """Resolve the active farmer from a bearer token in Firebase mode."""
        if not require_session_auth:
            return None
        authorization = request.headers.get("authorization", "")
        token = authorization.removeprefix("Bearer ").strip() if authorization.startswith("Bearer ") else ""
        session = sessions.get(token)
        if not session or session[1] <= utc_now():
            sessions.pop(token, None)
            raise HTTPException(status_code=401, detail="Sign in is required to access farm data.")
        return session[0]

    def profile_with_session(user: User) -> UserProfile:
        token = token_urlsafe(32)
        sessions[token] = (user.user_id, utc_now() + timedelta(hours=12))
        # Also issue a Firebase custom token so the browser can sign in with
        # Firebase Auth and access Firestore directly under per-user rules.
        firebase_token = _create_firebase_custom_token(user.user_id)
        return UserProfile.model_validate(user).model_copy(update={
            "session_token": token,
            "firebase_token": firebase_token,
        })

    def owned_farm(farm_id: str, request: Request) -> dict[str, Any]:
        farm = build_farm(repository, farm_id)
        if not farm:
            raise not_found("Farm", farm_id)
        current_user = session_user(request)
        owner_id = farm.get("owner_id") or farm.get("ownerId")
        if current_user and owner_id != current_user:
            # Do not reveal whether another farmer's farm ID exists.
            raise not_found("Farm", farm_id)
        return farm

    @router.get("/health")
    def health() -> dict[str, Any]:
        from .storage.firebase import check_firestore_connection
        fs_check = check_firestore_connection()
        return {
            "status": "ok",
            "storage": settings.storage_mode,
            "firestore_connected": fs_check.get("connected", False),
            "project_id": settings.firebase_project_id,
        }

    # User Authentication & Management Routes
    @router.post("/users/register", response_model=UserProfile, status_code=201)
    def register_user(payload: UserCreate) -> UserProfile:
        clean_email = payload.email.strip().lower()
        existing = repository.get_user_by_email(clean_email)
        if existing:
            raise HTTPException(status_code=409, detail="An account with this email already exists. Please sign in.")

        now_str = utc_now().isoformat()
        user_id = new_id("farmer")
        user = User(
            user_id=user_id,
            name=payload.name.strip(),
            email=clean_email,
            password_hash=hash_password(payload.password),
            location=payload.location or "Local Farm Region",
            specialty=payload.specialty or "General Agriculture",
            joined_at=now_str.split("T")[0],
            acres_managed=0.0,
        )
        try:
            repository.create_user(user.model_dump(mode="json"))

            # Create default farm for newly registered farmer
            default_farm_id = new_id("farm")
            farm = Farm(
                farm_id=default_farm_id,
                owner_id=user_id,
                name=f"{payload.name}'s Farm",
                location=payload.location or "Local Farm Region",
                area_acres=10.0,
                latitude=30.901,
                longitude=75.857,
                number_of_zones=2,
                zones=[],
                created_at=utc_now(),
                updated_at=utc_now(),
            )
            repository.create_farm(farm.model_dump(mode="json"))

            # Add 2 initial zones for the farm
            z1 = Zone(
                zone_id=new_id("zone"),
                farm_id=default_farm_id,
                name="North Field",
                area_acres=5.0,
                crop="Wheat",
                soil="Loamy",
                growth_stage="Vegetative",
                irrigation="Drip",
                soil_moisture=55.0,
                temperature=24.0,
                humidity=60.0,
                rainfall=100.0,
                nitrogen=60.0,
                phosphorus=30.0,
                potassium=40.0,
                health_score=88.0,
                disease_risk=10.0,
            )
            z2 = Zone(
                zone_id=new_id("zone"),
                farm_id=default_farm_id,
                name="South Field",
                area_acres=5.0,
                crop="Basmati Rice",
                soil="Clay Loam",
                growth_stage="Tiller",
                irrigation="Flood",
                soil_moisture=65.0,
                temperature=26.0,
                humidity=65.0,
                rainfall=120.0,
                nitrogen=70.0,
                phosphorus=35.0,
                potassium=45.0,
                health_score=90.0,
                disease_risk=8.0,
            )
            repository.create_zone(z1.model_dump(mode="json"))
            repository.create_zone(z2.model_dump(mode="json"))

        except RepositoryError as exc:
            raise HTTPException(status_code=409, detail=str(exc)) from exc
        return profile_with_session(user)

    @router.post("/users/login", response_model=UserProfile)
    def login_user(payload: UserLogin) -> UserProfile:
        clean_email = payload.email.strip().lower()
        existing = repository.get_user_by_email(clean_email)
        if not existing:
            raise HTTPException(
                status_code=401,
                detail="Invalid email or password. Please check your credentials or create a new account.",
            )
        if not password_matches(payload.password, existing.get("password_hash")):
            raise HTTPException(
                status_code=401,
                detail="Invalid email or password. Please check your credentials.",
            )
        return profile_with_session(User.model_validate(existing))

    @router.get("/users", response_model=list[UserProfile])
    def list_users(request: Request) -> list[UserProfile]:
        session_user(request)
        return [UserProfile.model_validate(doc) for doc in repository.list_users()]

    @router.get("/users/{user_id}", response_model=UserProfile)
    def get_user(user_id: str, request: Request) -> UserProfile:
        current_user = session_user(request)
        if current_user and current_user != user_id:
            raise not_found("User", user_id)
        user_doc = repository.get_user(user_id)
        if not user_doc:
            raise not_found("User", user_id)
        return UserProfile.model_validate(user_doc)

    @router.post("/farms", response_model=Farm, status_code=201)
    def create_farm(payload: FarmCreate, request: Request) -> Farm:
        now = utc_now()
        current_user = session_user(request)
        farm_id = new_id("farm")
        farm = Farm(
            farm_id=farm_id,
            # In production the owner always comes from the authenticated
            # session, never from a mutable browser form field.
            owner_id=current_user or payload.owner_id,
            name=payload.name,
            location=payload.location,
            area_acres=payload.area_acres,
            latitude=payload.latitude or 30.901,
            longitude=payload.longitude or 75.857,
            number_of_zones=payload.number_of_zones,
            zones=[],
            created_at=now,
            updated_at=now,
        )
        try:
            repository.create_farm(farm.model_dump(mode="json"))
        except RepositoryError as exc:
            raise HTTPException(status_code=409, detail=str(exc)) from exc
        return farm

    @router.get("/farms", response_model=list[Farm])
    def list_farms(request: Request, owner_id: str | None = None) -> list[Farm]:
        current_user = session_user(request)
        requested_owner = current_user or owner_id
        farms = []
        for document in repository.list_farms():
            if requested_owner and document.get("owner_id") != requested_owner and document.get("ownerId") != requested_owner:
                continue
            document["zones"] = repository.list_zones(document["farm_id"])
            farms.append(Farm.model_validate(document))
        return farms

    @router.get("/farms/{farm_id}", response_model=Farm)
    def get_farm(farm_id: str, request: Request) -> Farm:
        return Farm.model_validate(owned_farm(farm_id, request))

    @router.put("/farms/{farm_id}", response_model=Farm)
    def update_farm(farm_id: str, payload: FarmUpdate, request: Request) -> Farm:
        owned_farm(farm_id, request)
        updates = payload.model_dump(exclude_unset=True)
        updates["updated_at"] = utc_now().isoformat()
        repository.update_farm(farm_id, updates)
        return Farm.model_validate(owned_farm(farm_id, request))

    @router.post("/farms/{farm_id}/zones", response_model=Zone, status_code=201)
    def create_zone(farm_id: str, payload: ZoneInput, request: Request) -> Zone:
        owned_farm(farm_id, request)
        zone = Zone(zone_id=new_id("zone"), farm_id=farm_id, **payload.model_dump())
        try:
            repository.create_zone(zone.model_dump(mode="json"))
        except RepositoryError as exc:
            raise HTTPException(status_code=409, detail=str(exc)) from exc
        return zone

    @router.put("/farms/{farm_id}/zones/{zone_id}", response_model=Zone)
    def update_zone(farm_id: str, zone_id: str, payload: ZoneUpdate, request: Request) -> Zone:
        owned_farm(farm_id, request)
        updated = repository.update_zone(farm_id, zone_id, payload.model_dump(exclude_unset=True))
        if not updated:
            raise not_found("Zone", zone_id)
        return Zone.model_validate(updated)

    @router.post("/scenarios", response_model=Scenario, status_code=201)
    async def create_scenario(payload: ScenarioCreate, request: Request) -> Scenario:
        farm = owned_farm(payload.farm_id, request)
        if not farm["zones"]:
            raise HTTPException(status_code=409, detail="Add at least one zone before creating a scenario")
        known_zone_ids = {zone["zone_id"] for zone in farm["zones"]}
        target_zones = payload.target_zones or list(known_zone_ids)
        invalid_zones = set(target_zones) - known_zone_ids
        if invalid_zones:
            raise HTTPException(status_code=422, detail=f"Scenario references unknown zone(s): {', '.join(sorted(invalid_zones))}")

        changes = normalize_changes(payload.changes)
        name = payload.name
        duration_days = payload.duration_days
        scenario_type = payload.scenario_type
        if payload.natural_language_query and not changes:
            try:
                parsed, _ = await ai_service.parse_scenario(payload.natural_language_query, farm)
            except AIServiceError as exc:
                raise HTTPException(status_code=502, detail=str(exc)) from exc
            changes = parsed["changes"]
            name = payload.name or parsed["name"]
            duration_days = payload.duration_days or parsed["duration_days"]
            target_zones = parsed["target_zones"] or target_zones
            scenario_type = parsed["scenario_type"]
        if not changes:
            raise HTTPException(status_code=422, detail="A scenario needs at least one change")

        scenario = Scenario(
            scenario_id=new_id("scenario"),
            farm_id=payload.farm_id,
            name=name,
            duration_days=duration_days,
            target_zones=target_zones,
            changes=changes,
            scenario_type=scenario_type,
            natural_language_query=payload.natural_language_query,
            description=payload.description,
            created_at=utc_now(),
        )
        repository.create_scenario(scenario.model_dump(mode="json"))
        return scenario

    @router.get("/scenarios/{scenario_id}", response_model=Scenario)
    def get_scenario(scenario_id: str, request: Request) -> Scenario:
        scenario = repository.get_scenario(scenario_id)
        if not scenario:
            raise not_found("Scenario", scenario_id)
        owned_farm(scenario["farm_id"], request)
        return Scenario.model_validate(scenario)

    @router.get("/farms/{farm_id}/scenarios", response_model=list[Scenario])
    def list_scenarios(farm_id: str, request: Request) -> list[Scenario]:
        owned_farm(farm_id, request)
        return [Scenario.model_validate(item) for item in repository.list_scenarios(farm_id)]

    @router.post("/simulate", response_model=SimulationResult, status_code=201)
    async def run_simulation(payload: SimulationRequest, request: Request) -> SimulationResult:
        farm = owned_farm(payload.farm_id, request)
        scenario: dict[str, Any] | None = None
        scenario_name = "Baseline"
        scenario_type = "BASELINE"
        if payload.scenario_id:
            scenario = repository.get_scenario(payload.scenario_id)
            if not scenario:
                raise not_found("Scenario", payload.scenario_id)
            if scenario["farm_id"] != payload.farm_id:
                raise HTTPException(status_code=422, detail="The scenario does not belong to this farm")
            scenario_name = scenario["name"]
            scenario_type = scenario.get("scenario_type", "CUSTOM")
        else:
            scenario = {"duration_days": 30, "target_zones": [], "changes": {}}

        try:
            baseline_scenario = {"duration_days": scenario["duration_days"], "target_zones": [], "changes": {}}
            baseline_timeline, baseline_summary = simulate_farm(farm, baseline_scenario)
            timeline, summary = simulate_farm(farm, scenario)
        except SimulationEngineError as exc:
            raise HTTPException(status_code=422, detail=f"Simulation could not run: {exc}") from exc
        except Exception as exc:  # pragma: no cover - defensive API boundary
            raise HTTPException(status_code=500, detail="Simulation failed unexpectedly") from exc

        provisional = SimulationResult(
            simulation_id=new_id("simulation"),
            farm_id=payload.farm_id,
            scenario_id=payload.scenario_id,
            scenario_name=scenario_name,
            scenario_type=scenario_type,
            duration_days=scenario["duration_days"],
            farm_area_acres=farm["area_acres"],
            timeline=timeline,
            summary=summary,
            baseline_timeline=baseline_timeline,
            baseline_summary=baseline_summary,
            ai_explanation="",
            created_at=utc_now(),
        )
        try:
            explanation = await ai_service.explain_result(provisional)
        except AIServiceError as exc:
            raise HTTPException(status_code=502, detail=str(exc)) from exc
        result = provisional.model_copy(update={"ai_explanation": explanation.summary})
        repository.create_simulation(result.model_dump(mode="json"))
        return result

    @router.get("/simulation/{simulation_id}", response_model=SimulationResult)
    def get_simulation(simulation_id: str, request: Request) -> SimulationResult:
        result = repository.get_simulation(simulation_id)
        if not result:
            raise not_found("Simulation", simulation_id)
        owned_farm(result["farm_id"], request)
        return SimulationResult.model_validate(result)

    @router.get("/farms/{farm_id}/simulations", response_model=list[SimulationResult])
    def list_simulations(farm_id: str, request: Request) -> list[SimulationResult]:
        owned_farm(farm_id, request)
        return [SimulationResult.model_validate(item) for item in repository.list_simulations(farm_id)]

    @router.post("/compare", response_model=ComparisonResult)
    async def compare_simulations(payload: CompareRequest, request: Request) -> ComparisonResult:
        results: list[SimulationResult] = []
        for simulation_id in payload.simulation_ids:
            document = repository.get_simulation(simulation_id)
            if not document:
                raise not_found("Simulation", simulation_id)
            owned_farm(document["farm_id"], request)
            results.append(SimulationResult.model_validate(document))
        farm_ids = {result.farm_id for result in results}
        if len(farm_ids) != 1:
            raise HTTPException(status_code=422, detail="Only simulations from the same farm can be compared")

        common_days = sorted({point.day for result in results for point in result.timeline})
        timeline: list[ComparisonTimelinePoint] = []
        for day in common_days:
            entries = []
            for result in results:
                point = next((item for item in result.timeline if item.day == day), result.timeline[-1])
                entries.append(
                    {
                        "simulation_id": result.simulation_id,
                        "name": result.scenario_name,
                        "soil_moisture": point.soil_moisture,
                        "crop_health": point.crop_health,
                        "disease_risk": point.disease_risk,
                        "water_consumption": point.water_consumption,
                        "expected_yield": point.expected_yield,
                    }
                )
            timeline.append(ComparisonTimelinePoint(day=day, label=f"Day {day}", simulations=entries))

        best = max(results, key=lambda result: result.summary.total_expected_yield)
        low_water = min(results, key=lambda result: result.summary.total_water_usage)
        explanation = (
            f"{best.scenario_name} has the highest projected yield at {best.summary.total_expected_yield:.1f} tonnes. "
            f"{low_water.scenario_name} uses the least irrigation water at {low_water.summary.total_water_usage:.0f} L. "
            "Compare crop-health and disease-risk trends before choosing a plan."
        )
        return ComparisonResult(
            simulations=[
                ComparisonSimulation(
                    simulation_id=result.simulation_id,
                    scenario_name=result.scenario_name,
                    summary=result.summary,
                )
                for result in results
            ],
            timeline=timeline,
            ai_explanation=explanation,
        )

    @router.post("/ai/parse-scenario", response_model=Scenario)
    async def parse_scenario(payload: ParseScenarioRequest, request: Request) -> Scenario:
        farm = owned_farm(payload.farm_id, request) if payload.farm_id else None
        try:
            parsed, _ = await ai_service.parse_scenario(payload.text, farm)
        except AIServiceError as exc:
            raise HTTPException(status_code=502, detail=str(exc)) from exc
        return Scenario(
            scenario_id="",
            farm_id=payload.farm_id or "",
            name=parsed["name"],
            duration_days=parsed["duration_days"],
            target_zones=parsed["target_zones"],
            changes=parsed["changes"],
            scenario_type=parsed["scenario_type"],
            natural_language_query=payload.text,
        )

    @router.post("/ai/analyze-risk", response_model=FarmRiskAssessment)
    def analyze_risk(payload: AnalyzeRiskRequest, request: Request) -> FarmRiskAssessment:
        farm = owned_farm(payload.farm_id, request)
        try:
            return risk_service.assess(farm).model_copy(update={"assessed_at": utc_now()})
        except ValueError as exc:
            raise HTTPException(status_code=409, detail=str(exc)) from exc

    @router.post("/ai/suggest-scenarios")
    async def suggest_scenarios(payload: SuggestScenariosRequest, request: Request) -> dict[str, Any]:
        farm = owned_farm(payload.farm_id, request)
        assessment = payload.risk_assessment
        if assessment and assessment.farm_id != payload.farm_id:
            raise HTTPException(status_code=422, detail="Risk assessment does not belong to this farm")
        assessment = assessment or risk_service.assess(farm).model_copy(update={"assessed_at": utc_now()})
        suggestions, source = await ai_service.suggest_scenarios(assessment)
        return {"suggestions": [suggestion.model_dump() for suggestion in suggestions], "source": source, "risk_assessment": assessment.model_dump(mode="json")}

    @router.post("/ai/explain-result", response_model=ExplanationResponse)
    async def explain_result(payload: ExplainResultRequest, request: Request) -> ExplanationResponse:
        if payload.simulation_id:
            document = repository.get_simulation(payload.simulation_id)
            if not document:
                raise not_found("Simulation", payload.simulation_id)
            owned_farm(document["farm_id"], request)
            return await ai_service.explain_result(SimulationResult.model_validate(document))
        assert payload.baseline_metrics is not None and payload.projected_metrics is not None
        return ai_service.explain_metrics(
            payload.baseline_metrics,
            payload.projected_metrics,
            payload.scenario_type or "CUSTOM",
            payload.duration_days or 30,
        )

    @router.post("/demo/farm", response_model=Farm, status_code=201)
    def seed_demo_farm() -> Farm:
        demo = FarmCreate(name="FarmSim Demo Farm", location="Nashik, Maharashtra", area_acres=10, number_of_zones=3)
        now = utc_now()
        farm = Farm(
            farm_id=new_id("farm"),
            name=demo.name,
            location=demo.location,
            area_acres=demo.area_acres,
            number_of_zones=3,
            created_at=now,
            updated_at=now,
        )
        repository.create_farm(farm.model_dump(mode="json"))
        zones = [
            ZoneInput(name="North Field", area_acres=4, crop="Tomato", soil="Black", growth_stage="Flowering", irrigation="Drip", soil_moisture=55, temperature=28, humidity=70, rainfall=90, nitrogen=70, phosphorus=60, potassium=65),
            ZoneInput(name="Central Field", area_acres=3, crop="Wheat", soil="Alluvial", growth_stage="Vegetative", irrigation="Sprinkler", soil_moisture=62, temperature=25, humidity=60, rainfall=70, nitrogen=65, phosphorus=55, potassium=60),
            ZoneInput(name="South Field", area_acres=3, crop="Soybean", soil="Red", growth_stage="Flowering", irrigation="Drip", soil_moisture=58, temperature=27, humidity=68, rainfall=80, nitrogen=60, phosphorus=50, potassium=55),
        ]
        for payload in zones:
            repository.create_zone(Zone(zone_id=new_id("zone"), farm_id=farm.farm_id, **payload.model_dump()).model_dump(mode="json"))
        return as_farm(repository, farm.farm_id)

    return router


def create_app(
    repository: Repository | None = None,
    configured_settings: Settings = settings,
) -> FastAPI:
    repository = repository or create_repository(
        configured_settings.database_url, configured_settings.firebase_service_account_path
    )
    ai_service = AgriculturalAIService(configured_settings)
    risk_service = FarmRiskService()
    app = FastAPI(title="FarmSim API", version="1.0.0", description="Virtual farm, scenario, simulation and agricultural AI API")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(configured_settings.cors_origins),
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.exception_handler(RequestValidationError)
    async def validation_error_handler(_: Request, exc: RequestValidationError) -> JSONResponse:
        return JSONResponse(status_code=422, content={"detail": "Invalid request", "errors": exc.errors()})

    # Root paths implement the published contract. `/api` aliases retain
    # compatibility with the existing Vite client during the transition.
    # The deployed Firestore repository is the production data boundary.
    # SQLite remains intentionally unauthenticated for the local integration
    # test and offline development workflow.
    router = create_api_router(
        repository,
        ai_service,
        risk_service,
        require_session_auth=isinstance(repository, FirestoreRepository),
    )
    app.include_router(router)
    app.include_router(router, prefix="/api", include_in_schema=False)
    return app


app = create_app()
