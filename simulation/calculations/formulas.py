def clamp(value, minimum, maximum):
    """Keep a value within a defined range."""
    return max(minimum, min(value, maximum))


def temperature_stress(
    temperature,
    min_temperature,
    max_temperature,
):
    """
    Calculate temperature stress.

    Temperatures comfortably inside the crop's range
    produce little or no stress.

    Returns:
        0 = no temperature stress
        1 = severe temperature stress
    """

    optimal_margin = 5

    if temperature < min_temperature:

        distance = (
            min_temperature
            - temperature
        )

        return clamp(
            distance / 10,
            0,
            1,
        )

    heat_start = (
        max_temperature
        - optimal_margin
    )

    if temperature <= heat_start:
        return 0.0

    heat_range = (
        max_temperature
        - heat_start
    )

    heat_distance = (
        temperature
        - heat_start
    )

    return clamp(
        heat_distance / heat_range,
        0,
        1,
    )


def nutrient_score(
    nitrogen,
    phosphorus,
    potassium,
):
    """
    Calculate a simplified nutrient condition score.

    Returns a value between 0 and 1.
    """

    score = (
        nitrogen * 0.5
        + phosphorus * 0.2
        + potassium * 0.3
    ) / 100

    return clamp(
        score,
        0,
        1,
    )


def water_stress(
    soil_moisture,
    water_requirement,
):
    """
    Calculate simplified water stress.

    Returns:
        0 = no water stress
        1 = severe water stress
    """

    target_moisture = min(
        90,
        water_requirement * 10,
    )

    if soil_moisture >= target_moisture:
        return 0.0

    stress = (
        target_moisture - soil_moisture
    ) / target_moisture

    return clamp(
        stress,
        0,
        1,
    )


def calculate_disease_risk(
    temperature,
    humidity,
    crop_sensitivity,
    disease_pressure,
):
    """
    Calculate simplified disease risk.

    Risk is influenced by:
    - temperature
    - humidity
    - crop sensitivity
    - existing disease pressure
    """

    if 20 <= temperature <= 30:
        temperature_factor = 1.0
    else:
        temperature_factor = 0.5

    humidity_factor = humidity / 100

    risk = (
        temperature_factor
        * humidity_factor
        * crop_sensitivity
        * 100
    )

    risk += disease_pressure

    return clamp(
        risk,
        0,
        100,
    )


def calculate_crop_health(
    water_stress_value,
    nutrient_condition,
    temperature_stress_value,
    disease_risk,
    pest_pressure,
    waterlogging,
    heat_sensitivity=1.0,
):
    """
    Calculate simplified crop health.

    Health is always returned between 0 and 100.

    Heat sensitivity determines how strongly the crop
    responds to temperature stress.
    """

    health = 100.0

    # Water stress
    health -= (
        water_stress_value * 30
    )

    # Nutrient condition
    health += (
        nutrient_condition - 1
    ) * 20

    # Temperature stress
    health -= (
        temperature_stress_value
        * 25
        * heat_sensitivity
    )

    # Disease
    health -= (
        disease_risk * 0.25
    )

    # Pests
    health -= (
        pest_pressure * 0.25
    )

    # Waterlogging
    health -= (
        waterlogging * 0.25
    )

    return clamp(
        health,
        0,
        100,
    )


def calculate_yield(
    base_yield,
    area_acres,
    crop_health,
    water_stress_value,
    nutrient_condition,
    disease_risk,
    pest_pressure,
    waterlogging=0,
    growth_progress=1.0,
):
    """
    Calculate deterministic expected yield.

    Growth progress represents how far the crop has
    progressed through its configured growth cycle.

    The growth factor is intentionally moderate so that
    environmental stresses still have the major influence
    on the yield forecast.

    This is a simplified hackathon model and
    is not a scientifically validated yield model.
    """

    health_factor = (
        crop_health / 100
    )

    water_factor = 1 - (
        water_stress_value * 0.4
    )

    disease_factor = 1 - (
        disease_risk / 100 * 0.3
    )

    pest_factor = 1 - (
        pest_pressure / 100 * 0.2
    )

    waterlogging_factor = 1 - (
        waterlogging / 100 * 0.25
    )

    growth_progress = clamp(
        growth_progress,
        0,
        1,
    )

    growth_factor = (
        0.85
        + (0.15 * growth_progress)
    )

    yield_value = (
        base_yield
        * area_acres
        * health_factor
        * water_factor
        * nutrient_condition
        * disease_factor
        * pest_factor
        * waterlogging_factor
        * growth_factor
    )

    return max(
        0,
        yield_value,
    )


def calculate_growth_progress(
    current_day,
    growth_duration,
    growth_stage,
):
    """
    Calculate crop growth progress.

    The simulation starts from the zone's declared
    growth stage and then progresses with simulation days.

    Returns:
        0.0 = beginning of growth cycle
        1.0 = fully mature
    """

    stage_progress = {
        "Seedling": 0.15,
        "Vegetative": 0.40,
        "Flowering": 0.65,
        "Fruiting": 0.80,
        "Grain Filling": 0.90,
        "Maturity": 1.00,
        "Harvest": 1.00,
    }

    starting_progress = stage_progress.get(
        growth_stage,
        0.40,
    )

    if growth_duration <= 0:
        return 1.0

    daily_progress = (
        current_day / growth_duration
    )

    progress = (
        starting_progress
        + daily_progress
    )

    return clamp(
        progress,
        0,
        1,
    )