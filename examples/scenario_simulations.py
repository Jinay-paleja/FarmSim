import sys
from pathlib import Path

sys.path.insert(
    0,
    str(Path(__file__).resolve().parents[1])
)

from simulation.models import Farm, Zone, Scenario
from simulation import simulate_farm
from simulation.scenarios.handlers import (
    merge_scenario_changes,
)


def create_farm():
    """
    Create a sample multi-zone farm.
    """

    return Farm(
        farm_id="FARM001",
        area_acres=10,
        zones=[
            Zone(
        zone_id="ZONE001",
        crop="Rice",
        area_acres=5,
        soil="Loamy",
        growth_stage="Vegetative",
        irrigation=2,
        soil_moisture=55,
        temperature=28,
        humidity=75,
        rainfall=2,
        nitrogen=70,
        phosphorus=65,
        potassium=70,
        ),

        Zone(
            zone_id="ZONE002",
            crop="Wheat",
            area_acres=5,
            soil="Sandy",
            growth_stage="Vegetative",
            irrigation=2,
            soil_moisture=50,
            temperature=24,
            humidity=60,
            rainfall=2,
            nitrogen=75,
            phosphorus=70,
            potassium=65,
        ),
        ],
    )


def create_scenario(
    scenario_id,
    name,
    scenario_type,
    custom_changes=None,
):
    """
    Create a Scenario using one of the predefined
    scenario types plus optional custom changes.
    """

    changes = merge_scenario_changes(
        scenario_type=scenario_type,
        custom_changes=custom_changes,
    )

    return Scenario(
        scenario_id=scenario_id,
        name=name,
        duration_days=30,
        changes=changes,
    )


def print_result(
    scenario,
    result,
):
    """
    Print the final simulation state.
    """

    final_point = result.timeline[-1]

    summary = final_point.farm_summary

    print("\n" + "=" * 60)
    print(
        f"SCENARIO: {scenario.name}"
    )
    print(
        f"TYPE CHANGES: {scenario.changes}"
    )
    print(
        f"FINAL DAY: {final_point.day}"
    )
    print("=" * 60)

    print(
        f"Average Crop Health: "
        f"{summary.average_crop_health}"
    )

    print(
        f"Average Disease Risk: "
        f"{summary.average_disease_risk}"
    )

    print(
        f"Total Water Usage: "
        f"{summary.total_water_usage}"
    )

    print(
        f"Expected Farm Yield: "
        f"{summary.expected_yield}"
    )

    for zone in final_point.zones:

        print(
            f"\n{zone.zone_id}"
        )

        print(
            f"  Soil Moisture: "
            f"{zone.soil_moisture}"
        )

        print(
            f"  Crop Health: "
            f"{zone.crop_health}"
        )

        print(
            f"  Disease Risk: "
            f"{zone.disease_risk}"
        )

        print(
            f"  Water Usage: "
            f"{zone.water_usage}"
        )

        print(
            f"  Expected Yield: "
            f"{zone.expected_yield}"
        )


def main():

    scenarios = [
        create_scenario(
            "NORMAL",
            "Normal Conditions",
            "NORMAL",
        ),

        create_scenario(
            "LOW_RAIN",
            "Reduced Rainfall",
            "RAIN_REDUCTION",
        ),

        create_scenario(
            "HIGH_IRRIGATION",
            "Increased Irrigation",
            "IRRIGATION_INCREASE",
        ),

        create_scenario(
            "NO_IRRIGATION",
            "Irrigation Failure",
            "IRRIGATION_FAILURE",
        ),

        create_scenario(
            "HEATWAVE",
            "Heatwave",
            "HEATWAVE",
        ),

        create_scenario(
            "DISEASE",
            "Disease Outbreak",
            "DISEASE_OUTBREAK",
        ),

        create_scenario(
            "PEST",
            "Pest Outbreak",
            "PEST_OUTBREAK",
        ),

        create_scenario(
            "LOW_N",
            "Nitrogen Deficiency",
            "NITROGEN_DEFICIENCY",
        ),

        create_scenario(
            "COMBINED",
            "Combined Heat and Rain Stress",
            "COMBINED",
            custom_changes={
                "rainfall_multiplier": 0.6,
                "temperature_delta": 5,
                "irrigation_multiplier": 0.8,
                "nitrogen_delta": -15,
                "disease_pressure": 20,
                "pest_pressure": 20,
            },
        ),

        create_scenario(
            "SPREAD",
            "Disease and Pest Spread",
            "DISEASE_OUTBREAK",
            custom_changes={
                "pest_pressure": 20,
                "spread": True,
            },
        ),
    ]

    farm = create_farm()

    for scenario in scenarios:

        result = simulate_farm(
            farm=farm,
            scenario=scenario,
        )

        print_result(
            scenario=scenario,
            result=result,
        )


if __name__ == "__main__":
    main()