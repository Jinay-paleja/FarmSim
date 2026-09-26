from typing import Any, Dict

from simulation import simulate_farm
from simulation.models import Farm, Scenario


def run_simulation(
    farm_data: Dict[str, Any],
    scenario_data: Dict[str, Any],
):
    """
    Backend-friendly simulation entry point.

    Accepts normal Python dictionaries, validates them
    using Pydantic models, runs the simulation, and
    returns a JSON-serializable dictionary.
    """

    farm = Farm.model_validate(
        farm_data
    )

    scenario = Scenario.model_validate(
        scenario_data
    )

    result = simulate_farm(
        farm=farm,
        scenario=scenario,
    )

    return result.model_dump()