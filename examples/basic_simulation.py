import sys
from pathlib import Path

sys.path.insert(
    0,
    str(Path(__file__).resolve().parents[1])
)

from simulation.models import Farm, Zone, Scenario
from simulation import simulate_farm

farm = Farm(
    farm_id="FARM001",
    area_acres=10,
    zones=[
        Zone(
            zone_id="ZONE001",
            crop="Rice",
            area_acres=5,
            soil="Loamy",
            growth_stage="Vegetative",
            irrigation=4,
            soil_moisture=65,
            temperature=28,
            humidity=75,
            rainfall=6,
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
            irrigation=3,
            soil_moisture=60,
            temperature=24,
            humidity=60,
            rainfall=4,
            nitrogen=75,
            phosphorus=70,
            potassium=65,
        ),
    ],
)


scenario = Scenario(
    scenario_id="SCENARIO001",
    name="Normal Conditions",
    duration_days=30,
    changes={},
)


result = simulate_farm(
    farm=farm,
    scenario=scenario,
)


print("\n===== FARM SIMULATION RESULT =====")

print(
    f"Farm ID: {result.farm_id}"
)

print(
    f"Scenario ID: {result.scenario_id}"
)

print(
    f"Timeline points: {len(result.timeline)}"
)


for point in result.timeline:

    print(
        f"\n--- Day {point.day} ---"
    )

    print(
        f"Average Crop Health: "
        f"{point.farm_summary.average_crop_health}"
    )

    print(
        f"Average Disease Risk: "
        f"{point.farm_summary.average_disease_risk}"
    )

    print(
        f"Total Water Usage: "
        f"{point.farm_summary.total_water_usage}"
    )

    print(
        f"Expected Farm Yield: "
        f"{point.farm_summary.expected_yield}"
    )

    for zone in point.zones:

        print(
            f"\nZone: {zone.zone_id}"
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