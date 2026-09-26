SCENARIO_PRESETS = {
    "RAIN_REDUCTION": {
        "rainfall_multiplier": 0.7,
    },

    "RAIN_INCREASE": {
        "rainfall_multiplier": 1.3,
    },

    "TEMPERATURE_INCREASE": {
        "temperature_delta": 3,
    },

    "HEATWAVE": {
        "temperature_delta": 7,
        "humidity_delta": -10,
    },

    "IRRIGATION_INCREASE": {
        "irrigation_multiplier": 1.2,
    },

    "IRRIGATION_DECREASE": {
        "irrigation_multiplier": 0.7,
    },

    "IRRIGATION_FAILURE": {
        "irrigation_multiplier": 0.0,
    },

    "FERTILIZER_INCREASE": {
        "nitrogen_delta": 10,
        "phosphorus_delta": 10,
        "potassium_delta": 10,
    },

    "FERTILIZER_DECREASE": {
        "nitrogen_delta": -10,
        "phosphorus_delta": -10,
        "potassium_delta": -10,
    },

    "NITROGEN_DEFICIENCY": {
        "nitrogen_delta": -30,
    },

    "DISEASE_OUTBREAK": {
        "disease_pressure": 30,
    },

    "PEST_OUTBREAK": {
        "pest_pressure": 30,
    },

    "COMBINED": {
        "rainfall_multiplier": 0.7,
        "temperature_delta": 5,
        "irrigation_multiplier": 0.7,
        "nitrogen_delta": -20,
        "disease_pressure": 20,
        "pest_pressure": 20,
    },
}


def get_scenario_changes(scenario_type):
    """
    Return the predefined changes for a scenario type.

    Unknown scenario types return an empty dictionary,
    allowing generic custom scenarios.
    """

    return SCENARIO_PRESETS.get(
        scenario_type,
        {},
    ).copy()


def merge_scenario_changes(
    scenario_type,
    custom_changes=None,
):
    """
    Combine a predefined scenario with custom changes.

    Custom changes override preset values.
    """

    changes = get_scenario_changes(
        scenario_type
    )

    if custom_changes:
        changes.update(
            custom_changes
        )

    return changes