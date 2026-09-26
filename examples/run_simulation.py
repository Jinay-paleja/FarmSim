import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parent.parent))

from simulation.models import Farm, Zone, Scenario
from simulation.engine.simulator import simulate_farm


farm = Farm(
    farm_id="FARM001",
    area_acres=10,
    zones=[
        Zone(
            zone_id="ZONE001",
            crop="Wheat",
            area_acres=5,
            soil="Loamy",
            growth_stage="Vegetative",
            irrigation=2,
            soil_moisture=60,
            temperature=24,
            humidity=65,
            rainfall=5,
            nitrogen=70,
            phosphorus=65,
            potassium=70,
        ),
        Zone(
            zone_id="ZONE002",
            crop="Rice",
            area_acres=5,
            soil="Clay",
            growth_stage="Vegetative",
            irrigation=4,
            soil_moisture=70,
            temperature=27,
            humidity=75,
            rainfall=8,
            nitrogen=75,
            phosphorus=70,
            potassium=75,
        ),
    ],
)


scenario = Scenario(
    scenario_id="SCN011",
    name="Disease Outbreak With Spread",
    duration_days=30,
    changes={
        "disease_pressure": 30,
        "spread": True,
    },
)

result = simulate_farm(
    farm=farm,
    scenario=scenario,
)


print("\n===== FARM SIMULATION RESULT =====")

print(f"Farm ID: {result.farm_id}")
print(f"Scenario: {result.scenario_id}")

for checkpoint in result.timeline:

    print(f"\n--- Day {checkpoint.day} ---")

    summary = checkpoint.farm_summary

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
        f"Expected Yield: "
        f"{summary.expected_yield}"
    )

    for zone in checkpoint.zones:

        print(
            f"\nZone {zone.zone_id}"
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