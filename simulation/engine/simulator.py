from simulation.models import (
    Farm,
    Scenario,
    SimulationResult,
    TimelinePoint,
    ZoneSimulationResult,
    FarmSummary,
)

from simulation.crops.config import CROP_CONFIG
from simulation.soils.config import SOIL_CONFIG

from simulation.calculations.formulas import (
    clamp,
    water_stress,
    nutrient_score,
    temperature_stress,
    calculate_disease_risk,
    calculate_yield,
    calculate_crop_health,
    calculate_growth_progress,
)


def get_simulation_days(duration_days):
    """
    Return the days at which simulation results
    should be included in the final output.
    """

    checkpoints = [1, 7, 15, 30, 60, 90]

    days = [
        day
        for day in checkpoints
        if day <= duration_days
    ]

    if duration_days not in days:
        days.append(duration_days)

    return days



def get_effective_scenario(
    zone,
    scenario,
):
    """
    Return the scenario that applies to a specific zone.

    If target_zones is empty, the scenario applies to
    every zone.

    If target_zones contains zone IDs, only those zones
    receive the scenario changes.
    """

    if (
        not scenario.target_zones
        or zone.zone_id in scenario.target_zones
    ):
        return scenario

    return scenario.model_copy(
        update={
            "changes": {},
        }
    )


def validate_target_zones(
    farm,
    scenario,
):
    """
    Validate that all requested target zones exist.
    """

    if not scenario.target_zones:
        return

    available_zone_ids = {
        zone.zone_id
        for zone in farm.zones
    }

    invalid_zones = [
        zone_id
        for zone_id in scenario.target_zones
        if zone_id not in available_zone_ids
    ]

    if invalid_zones:
        raise ValueError(
            "Unknown target zone(s): "
            + ", ".join(invalid_zones)
        )

def initialize_zone_state(farm: Farm):
    """
    Create the internal simulation state for every zone.

    The original Farm input is never modified.
    """

    state = {}

    for zone in farm.zones:

        state[zone.zone_id] = {
            "soil_moisture": zone.soil_moisture,

            "crop_health": 100.0,

            "disease_pressure": 0.0,
            "disease_risk": 0.0,

            "pest_pressure": 0.0,

            "waterlogging": 0.0,

            "water_usage": 0.0,

            "nutrient_condition": 1.0,
            "temperature_stress": 0.0,

            "growth_progress": 0.0,

            "expected_yield": 0.0,
        }

    return state


def update_growth_progress(
    zone,
    zone_state,
    day,
):
    """
    Update crop growth progress for the current
    simulation day.
    """

    crop = CROP_CONFIG.get(zone.crop)

    if crop is None:
        raise ValueError(
            f"Unsupported crop: {zone.crop}"
        )

    progress = calculate_growth_progress(
        current_day=day,
        growth_duration=crop["growth_duration"],
        growth_stage=zone.growth_stage,
    )

    zone_state["growth_progress"] = progress


def update_soil_moisture(
    zone,
    zone_state,
    scenario,
):
    """
    Update soil moisture for one simulation day.

    Soil moisture is affected by:

    - rainfall
    - irrigation
    - soil water retention
    - soil drainage
    - temperature-driven evaporation

    Different soil types behave differently:

    Sandy:
        Low retention and fast drainage.

    Loamy:
        Balanced retention and drainage.

    Silty:
        High retention with moderate drainage.

    Clay:
        Very high retention but slow drainage.

    Excess moisture creates waterlogging pressure.
    """

    soil = SOIL_CONFIG.get(zone.soil)

    if soil is None:
        raise ValueError(
            f"Unsupported soil type: {zone.soil}"
        )

    # Scenario changes
    rainfall_multiplier = scenario.changes.get(
        "rainfall_multiplier",
        1.0,
    )

    irrigation_multiplier = scenario.changes.get(
        "irrigation_multiplier",
        1.0,
    )

    temperature_delta = scenario.changes.get(
        "temperature_delta",
        0.0,
    )

    # Current environmental conditions
    rainfall = max(
        0,
        zone.rainfall
        * rainfall_multiplier,
    )

    irrigation = max(
        0,
        zone.irrigation
        * irrigation_multiplier,
    )

    temperature = (
        zone.temperature
        + temperature_delta
    )

    # Rainfall contribution
    rainfall_effect = (
        rainfall
        * soil["water_retention"]
        * 0.25
    )

    # Irrigation contribution
    irrigation_effect = (
        irrigation
        * soil["water_retention"]
        * 0.40
    )

    # Temperature-driven evaporation
    temperature_excess = max(
        temperature - 20,
        0,
    )

    evaporation = (
        0.20
        + temperature_excess * 0.08
    )

    # Soil drainage
    current_moisture = zone_state[
        "soil_moisture"
    ]

    drainage_loss = (
        current_moisture
        * soil["drainage"]
        * 0.035
    )

    # Calculate daily moisture change
    moisture_change = (
        rainfall_effect
        + irrigation_effect
        - evaporation
        - drainage_loss
    )

    new_moisture = (
        current_moisture
        + moisture_change
    )

    # Waterlogging
    waterlogging_threshold = 80

    excess_moisture = max(
        new_moisture
        - waterlogging_threshold,
        0,
    )

    waterlogging = (
        excess_moisture
        * (1 - soil["drainage"])
        * 1.5
    )

    zone_state["waterlogging"] = clamp(
        waterlogging,
        0,
        100,
    )

    # Keep soil moisture physically bounded
    zone_state["soil_moisture"] = clamp(
        new_moisture,
        0,
        100,
    )

    # Track cumulative irrigation usage
    zone_state["water_usage"] += irrigation


def calculate_zone_water_stress(
    zone,
    zone_state,
):
    """
    Calculate the current water stress
    experienced by the crop.
    """

    crop = CROP_CONFIG.get(zone.crop)

    if crop is None:
        raise ValueError(
            f"Unsupported crop: {zone.crop}"
        )

    return water_stress(
        zone_state["soil_moisture"],
        crop["water_requirement"],
    )


def calculate_zone_nutrients(
    zone,
    zone_state,
    scenario,
):
    """
    Calculate the current nutrient condition
    of the zone.

    Soil nutrient retention determines how much
    of the supplied nutrients remain available
    to the crop.
    """

    soil = SOIL_CONFIG.get(zone.soil)

    if soil is None:
        raise ValueError(
            f"Unsupported soil type: {zone.soil}"
        )

    nutrient_retention = soil[
        "nutrient_retention"
    ]

    nitrogen = (
        zone.nitrogen
        + scenario.changes.get(
            "nitrogen_delta",
            0,
        )
    )

    phosphorus = (
        zone.phosphorus
        + scenario.changes.get(
            "phosphorus_delta",
            0,
        )
    )

    potassium = (
        zone.potassium
        + scenario.changes.get(
            "potassium_delta",
            0,
        )
    )

    nitrogen = clamp(
        nitrogen,
        0,
        100,
    )

    phosphorus = clamp(
        phosphorus,
        0,
        100,
    )

    potassium = clamp(
        potassium,
        0,
        100,
    )

    available_nitrogen = (
        nitrogen
        * nutrient_retention
    )

    available_phosphorus = (
        phosphorus
        * nutrient_retention
    )

    available_potassium = (
        potassium
        * nutrient_retention
    )

    score = nutrient_score(
        available_nitrogen,
        available_phosphorus,
        available_potassium,
    )

    zone_state["nutrient_condition"] = clamp(
        score,
        0,
        1,
    )


def calculate_temperature_stress(
    zone,
    zone_state,
    scenario,
):
    """
    Calculate temperature stress based on
    the crop's configured temperature range.
    """

    crop = CROP_CONFIG.get(zone.crop)

    if crop is None:
        raise ValueError(
            f"Unsupported crop: {zone.crop}"
        )

    temperature_delta = scenario.changes.get(
        "temperature_delta",
        0,
    )

    temperature = (
        zone.temperature
        + temperature_delta
    )

    stress = temperature_stress(
        temperature,
        crop["min_temperature"],
        crop["max_temperature"],
    )

    zone_state["temperature_stress"] = stress


def calculate_zone_disease_risk(
    zone,
    zone_state,
    scenario,
):
    """
    Calculate disease risk for a zone.

    Disease risk depends on:

    - temperature
    - humidity
    - crop disease sensitivity
    - existing disease pressure
    - scenario disease pressure
    - waterlogging

    Scenario disease pressure is applied gradually so
    that an outbreak increases risk over time without
    immediately forcing the risk to 100.
    """

    crop = CROP_CONFIG.get(zone.crop)

    if crop is None:
        raise ValueError(
            f"Unsupported crop: {zone.crop}"
        )

    temperature_delta = scenario.changes.get(
        "temperature_delta",
        0,
    )

    humidity_delta = scenario.changes.get(
        "humidity_delta",
        0,
    )

    temperature = (
        zone.temperature
        + temperature_delta
    )

    humidity = clamp(
        zone.humidity
        + humidity_delta,
        0,
        100,
    )

    scenario_disease_pressure = max(
        0,
        scenario.changes.get(
            "disease_pressure",
            0,
        ),
    )

    # Gradual outbreak pressure.
    # The pressure approaches the scenario-defined
    # outbreak level instead of increasing without limit.
    target_pressure = clamp(
        scenario_disease_pressure,
        0,
        100,
    )

    pressure_adjustment_rate = 0.15

    zone_state["disease_pressure"] += (
        target_pressure
        - zone_state["disease_pressure"]
    ) * pressure_adjustment_rate

    zone_state["disease_pressure"] = clamp(
        zone_state["disease_pressure"],
        0,
        100,
    )

    disease_risk = calculate_disease_risk(
        temperature=temperature,
        humidity=humidity,
        crop_sensitivity=crop["disease_sensitivity"],
        disease_pressure=zone_state[
            "disease_pressure"
        ],
    )

    # Excess moisture increases disease conditions.
    disease_risk += (
        zone_state["waterlogging"]
        * 0.20
    )

    zone_state["disease_risk"] = clamp(
        disease_risk,
        0,
        100,
    )


def calculate_zone_pest_pressure(
    zone,
    zone_state,
    scenario,
):
    """
    Calculate pest pressure for a zone.
    """

    pest_pressure_change = scenario.changes.get(
        "pest_pressure",
        0,
    )

    zone_state["pest_pressure"] += (
        pest_pressure_change * 0.10
    )

    zone_state["pest_pressure"] = clamp(
        zone_state["pest_pressure"],
        0,
        100,
    )


def spread_between_zones(
    farm,
    state,
    scenario,
):
    """
    Spread disease and pest pressure between zones.

    Spread is enabled only when:

        changes["spread"] == True
    """

    spread_enabled = scenario.changes.get(
        "spread",
        False,
    )

    if spread_enabled is not True:
        return

    if len(farm.zones) <= 1:
        return

    strongest_disease_pressure = max(
        (
            zone_state["disease_pressure"]
            for zone_state in state.values()
        ),
        default=0,
    )

    strongest_pest_pressure = max(
        (
            zone_state["pest_pressure"]
            for zone_state in state.values()
        ),
        default=0,
    )

    disease_spread = (
        strongest_disease_pressure * 0.10
    )

    pest_spread = (
        strongest_pest_pressure * 0.08
    )

    updates = {}

    for zone in farm.zones:

        updates[zone.zone_id] = {
            "disease_pressure": disease_spread,
            "pest_pressure": pest_spread,
        }

    for zone_id, pressure in updates.items():

        state[zone_id]["disease_pressure"] = clamp(
            state[zone_id]["disease_pressure"]
            + pressure["disease_pressure"],
            0,
            100,
        )

        state[zone_id]["pest_pressure"] = clamp(
            state[zone_id]["pest_pressure"]
            + pressure["pest_pressure"],
            0,
            100,
        )


def update_crop_health(
    zone,
    zone_state,
):
    """
    Update crop health progressively.

    The environmental conditions determine a target
    health for the current day.

    The actual crop health then moves gradually toward
    that target instead of being reset every day.

    This creates accumulated environmental stress while
    still allowing gradual recovery when conditions improve.
    """

    crop = CROP_CONFIG.get(zone.crop)

    if crop is None:
        raise ValueError(
            f"Unsupported crop: {zone.crop}"
        )

    # Calculate current environmental stress
    water_stress_value = (
        calculate_zone_water_stress(
            zone,
            zone_state,
        )
    )

    # Calculate health target for today's conditions
    target_health = calculate_crop_health(
        water_stress_value=water_stress_value,
        nutrient_condition=zone_state[
            "nutrient_condition"
        ],
        temperature_stress_value=zone_state[
            "temperature_stress"
        ],
        disease_risk=zone_state[
            "disease_risk"
        ],
        pest_pressure=zone_state[
            "pest_pressure"
        ],
        waterlogging=zone_state[
            "waterlogging"
        ],
        heat_sensitivity=crop[
            "heat_sensitivity"
        ],
    )

    # Progressive health adjustment
    current_health = zone_state[
        "crop_health"
    ]

    health_adjustment_rate = 0.20

    new_health = (
        current_health
        + (
            target_health
            - current_health
        )
        * health_adjustment_rate
    )

    zone_state["crop_health"] = clamp(
        new_health,
        0,
        100,
    )


def calculate_zone_expected_yield(
    zone,
    zone_state,
):
    """
    Calculate expected yield for a zone.
    """

    crop = CROP_CONFIG.get(zone.crop)

    if crop is None:
        raise ValueError(
            f"Unsupported crop: {zone.crop}"
        )

    water_stress_value = (
        calculate_zone_water_stress(
            zone,
            zone_state,
        )
    )

    yield_value = calculate_yield(
        base_yield=crop["base_yield"],
        area_acres=zone.area_acres,
        crop_health=zone_state[
            "crop_health"
        ],
        water_stress_value=water_stress_value,
        nutrient_condition=zone_state[
            "nutrient_condition"
        ],
        disease_risk=zone_state[
            "disease_risk"
        ],
        pest_pressure=zone_state[
            "pest_pressure"
        ],
        waterlogging=zone_state[
            "waterlogging"
        ],
        growth_progress=zone_state[
            "growth_progress"
        ],
    )

    zone_state["expected_yield"] = max(
        0,
        yield_value,
    )


def build_timeline_point(
    day,
    farm,
    state,
):
    """
    Convert internal simulation state into
    a validated TimelinePoint.
    """

    zone_results = []

    for zone in farm.zones:

        zone_state = state[
            zone.zone_id
        ]

        zone_results.append(
            ZoneSimulationResult(
                zone_id=zone.zone_id,
                soil_moisture=round(
                    zone_state["soil_moisture"],
                    2,
                ),
                crop_health=round(
                    zone_state["crop_health"],
                    2,
                ),
                disease_risk=round(
                    zone_state["disease_risk"],
                    2,
                ),
                water_usage=round(
                    zone_state["water_usage"],
                    2,
                ),
                expected_yield=round(
                    zone_state["expected_yield"],
                    2,
                ),
            )
        )

    if zone_results:

        average_crop_health = (
            sum(
                zone.crop_health
                for zone in zone_results
            )
            / len(zone_results)
        )

        average_disease_risk = (
            sum(
                zone.disease_risk
                for zone in zone_results
            )
            / len(zone_results)
        )

        total_water_usage = sum(
            zone.water_usage
            for zone in zone_results
        )

        total_expected_yield = sum(
            zone.expected_yield
            for zone in zone_results
        )

    else:

        average_crop_health = 0.0
        average_disease_risk = 0.0
        total_water_usage = 0.0
        total_expected_yield = 0.0

    farm_summary = FarmSummary(
        average_crop_health=round(
            average_crop_health,
            2,
        ),
        average_disease_risk=round(
            average_disease_risk,
            2,
        ),
        total_water_usage=round(
            total_water_usage,
            2,
        ),
        expected_yield=round(
            total_expected_yield,
            2,
        ),
    )

    return TimelinePoint(
        day=day,
        zones=zone_results,
        farm_summary=farm_summary,
    )


def simulate_farm(
    farm: Farm,
    scenario: Scenario,
) -> SimulationResult:
    """
    Main farm simulation function.

    Runs the simulation one day at a time and
    returns a validated SimulationResult.
    """

    validate_target_zones(
        farm,
        scenario,
    )

    state = initialize_zone_state(farm)

    timeline = []

    output_days = get_simulation_days(
        scenario.duration_days
    )

    for day in range(
        1,
        scenario.duration_days + 1,
    ):

        # Update environmental conditions.
        for zone in farm.zones:

            zone_state = state[
                zone.zone_id
            ]

            # Apply the scenario only to targeted zones.
            # Empty target_zones means all zones.
            effective_scenario = get_effective_scenario(
                zone,
                scenario,
            )

            update_growth_progress(
                zone,
                zone_state,
                day,
            )

            update_soil_moisture(
                zone,
                zone_state,
                effective_scenario,
            )

            calculate_zone_nutrients(
                zone,
                zone_state,
                effective_scenario,
            )

            calculate_temperature_stress(
                zone,
                zone_state,
                effective_scenario,
            )

            calculate_zone_disease_risk(
                zone,
                zone_state,
                effective_scenario,
            )

            calculate_zone_pest_pressure(
                zone,
                zone_state,
                effective_scenario,
            )

        # Spread disease and pests between zones.
        # The original scenario is intentionally used here
        # so spread=True can propagate an outbreak.
        spread_between_zones(
            farm,
            state,
            scenario,
        )

        # Update crop condition and yield.
        for zone in farm.zones:

            zone_state = state[
                zone.zone_id
            ]

            update_crop_health(
                zone,
                zone_state,
            )

            calculate_zone_expected_yield(
                zone,
                zone_state,
            )

        # Store requested checkpoint.
        if day in output_days:

            timeline.append(
                build_timeline_point(
                    day=day,
                    farm=farm,
                    state=state,
                )
            )

    return SimulationResult(
        farm_id=farm.farm_id,
        scenario_id=scenario.scenario_id,
        timeline=timeline,
    )

