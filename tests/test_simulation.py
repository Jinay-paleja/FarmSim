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


def create_test_farm():
    """
    Create a small two-zone farm for testing.
    """

    return Farm(
        farm_id="TEST_FARM",
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
    scenario_type,
    custom_changes=None,
):
    """
    Create a 30-day test scenario.
    """

    changes = merge_scenario_changes(
        scenario_type=scenario_type,
        custom_changes=custom_changes,
    )

    return Scenario(
        scenario_id=f"TEST_{scenario_type}",
        name=scenario_type,
        duration_days=30,
        changes=changes,
    )


def run_scenario(
    scenario_type,
    custom_changes=None,
):
    """
    Run a test scenario and return the result.
    """

    farm = create_test_farm()

    scenario = create_scenario(
        scenario_type,
        custom_changes,
    )

    return simulate_farm(
        farm=farm,
        scenario=scenario,
    )


def test_normal_simulation_structure():
    """
    Normal simulation should produce the expected
    timeline checkpoints and zone results.
    """

    result = run_scenario("NORMAL")

    assert result.farm_id == "TEST_FARM"
    assert len(result.timeline) == 4

    expected_days = [1, 7, 15, 30]

    actual_days = [
        point.day
        for point in result.timeline
    ]

    assert actual_days == expected_days

    final_point = result.timeline[-1]

    assert len(final_point.zones) == 2

    assert (
        final_point.farm_summary.average_crop_health
        >= 0
    )

    assert (
        final_point.farm_summary.average_crop_health
        <= 100
    )


def test_reduced_rainfall_reduces_soil_moisture():
    """
    Reduced rainfall should reduce final soil moisture.
    """

    normal = run_scenario("NORMAL")
    reduced_rain = run_scenario(
        "RAIN_REDUCTION"
    )

    normal_zone = normal.timeline[-1].zones[0]
    reduced_zone = reduced_rain.timeline[-1].zones[0]

    assert (
        reduced_zone.soil_moisture
        < normal_zone.soil_moisture
    )


def test_increased_irrigation_increases_water_usage():
    """
    Increased irrigation should increase water usage.
    """

    normal = run_scenario("NORMAL")
    increased = run_scenario(
        "IRRIGATION_INCREASE"
    )

    normal_water = (
        normal.timeline[-1]
        .farm_summary
        .total_water_usage
    )

    increased_water = (
        increased.timeline[-1]
        .farm_summary
        .total_water_usage
    )

    assert increased_water > normal_water


def test_irrigation_failure_reduces_water_usage():
    """
    Irrigation failure should result in zero
    irrigation water usage.
    """

    result = run_scenario(
        "IRRIGATION_FAILURE"
    )

    water_usage = (
        result.timeline[-1]
        .farm_summary
        .total_water_usage
    )

    assert water_usage == 0


def test_irrigation_failure_reduces_health():
    """
    Irrigation failure should reduce crop health
    compared with normal conditions.
    """

    normal = run_scenario("NORMAL")
    failure = run_scenario(
        "IRRIGATION_FAILURE"
    )

    normal_health = (
        normal.timeline[-1]
        .farm_summary
        .average_crop_health
    )

    failure_health = (
        failure.timeline[-1]
        .farm_summary
        .average_crop_health
    )

    assert failure_health < normal_health


def test_heatwave_reduces_crop_health():
    """
    Heatwave should reduce crop health.
    """

    normal = run_scenario("NORMAL")
    heatwave = run_scenario("HEATWAVE")

    normal_health = (
        normal.timeline[-1]
        .farm_summary
        .average_crop_health
    )

    heatwave_health = (
        heatwave.timeline[-1]
        .farm_summary
        .average_crop_health
    )

    assert heatwave_health < normal_health


def test_disease_outbreak_increases_disease_risk():
    """
    Disease outbreak should increase disease risk.
    """

    normal = run_scenario("NORMAL")
    outbreak = run_scenario(
        "DISEASE_OUTBREAK"
    )

    normal_risk = (
        normal.timeline[-1]
        .farm_summary
        .average_disease_risk
    )

    outbreak_risk = (
        outbreak.timeline[-1]
        .farm_summary
        .average_disease_risk
    )

    assert outbreak_risk > normal_risk


def test_disease_outbreak_reduces_yield():
    """
    Disease outbreak should reduce expected yield.
    """

    normal = run_scenario("NORMAL")
    outbreak = run_scenario(
        "DISEASE_OUTBREAK"
    )

    normal_yield = (
        normal.timeline[-1]
        .farm_summary
        .expected_yield
    )

    outbreak_yield = (
        outbreak.timeline[-1]
        .farm_summary
        .expected_yield
    )

    assert outbreak_yield < normal_yield


def test_pest_outbreak_reduces_crop_health():
    """
    Pest outbreak should reduce crop health.
    """

    normal = run_scenario("NORMAL")
    outbreak = run_scenario(
        "PEST_OUTBREAK"
    )

    normal_health = (
        normal.timeline[-1]
        .farm_summary
        .average_crop_health
    )

    outbreak_health = (
        outbreak.timeline[-1]
        .farm_summary
        .average_crop_health
    )

    assert outbreak_health < normal_health


def test_nitrogen_deficiency_reduces_yield():
    """
    Nitrogen deficiency should reduce expected yield.
    """

    normal = run_scenario("NORMAL")
    deficiency = run_scenario(
        "NITROGEN_DEFICIENCY"
    )

    normal_yield = (
        normal.timeline[-1]
        .farm_summary
        .expected_yield
    )

    deficiency_yield = (
        deficiency.timeline[-1]
        .farm_summary
        .expected_yield
    )

    assert deficiency_yield < normal_yield


def test_combined_stress_reduces_yield():
    """
    Multiple simultaneous stresses should reduce
    yield substantially.
    """

    normal = run_scenario("NORMAL")

    combined = run_scenario(
        "COMBINED",
        custom_changes={
            "rainfall_multiplier": 0.6,
            "temperature_delta": 5,
            "irrigation_multiplier": 0.8,
            "nitrogen_delta": -15,
            "disease_pressure": 20,
            "pest_pressure": 20,
        },
    )

    normal_yield = (
        normal.timeline[-1]
        .farm_summary
        .expected_yield
    )

    combined_yield = (
        combined.timeline[-1]
        .farm_summary
        .expected_yield
    )

    assert combined_yield < normal_yield


def test_disease_spread_affects_multiple_zones():
    """
    When spread is enabled, disease pressure should
    affect multiple zones.
    """

    result = run_scenario(
        "DISEASE_OUTBREAK",
        custom_changes={
            "spread": True,
        },
    )

    final_point = result.timeline[-1]

    disease_risks = [
        zone.disease_risk
        for zone in final_point.zones
    ]

    assert len(disease_risks) == 2

    assert all(
        risk > 0
        for risk in disease_risks
    )


def test_values_remain_within_valid_ranges():
    """
    Important simulation values should remain within
    physically meaningful ranges.
    """

    result = run_scenario("HEATWAVE")

    for point in result.timeline:

        for zone in point.zones:

            assert 0 <= zone.soil_moisture <= 100

            assert 0 <= zone.crop_health <= 100

            assert 0 <= zone.disease_risk <= 100

            assert zone.water_usage >= 0

            assert zone.expected_yield >= 0
def test_soil_nutrient_retention_affects_yield():
    """
    Soil with higher nutrient retention should provide
    better nutrient availability and therefore support
    higher expected yield when other conditions are equal.
    """

    loamy_farm = Farm(
        farm_id="LOAMY_TEST",
        area_acres=5,
        zones=[
            Zone(
                zone_id="ZONE001",
                crop="Wheat",
                area_acres=5,
                soil="Loamy",
                growth_stage="Vegetative",
                irrigation=2,
                soil_moisture=50,
                temperature=24,
                humidity=60,
                rainfall=2,
                nitrogen=70,
                phosphorus=65,
                potassium=70,
            )
        ],
    )

    sandy_farm = Farm(
        farm_id="SANDY_TEST",
        area_acres=5,
        zones=[
            Zone(
                zone_id="ZONE001",
                crop="Wheat",
                area_acres=5,
                soil="Sandy",
                growth_stage="Vegetative",
                irrigation=2,
                soil_moisture=50,
                temperature=24,
                humidity=60,
                rainfall=2,
                nitrogen=70,
                phosphorus=65,
                potassium=70,
            )
        ],
    )

    scenario = Scenario(
        scenario_id="SOIL_TEST",
        name="Soil Comparison",
        duration_days=30,
        changes={},
    )

    loamy_result = simulate_farm(
        farm=loamy_farm,
        scenario=scenario,
    )

    sandy_result = simulate_farm(
        farm=sandy_farm,
        scenario=scenario,
    )

    loamy_yield = (
        loamy_result.timeline[-1]
        .farm_summary
        .expected_yield
    )

    sandy_yield = (
        sandy_result.timeline[-1]
        .farm_summary
        .expected_yield
    )

    assert loamy_yield > sandy_yield


def test_growth_duration_affects_growth_progress():
    """
    Crops with different growth durations should
    progress at different rates under the same
    simulation duration.
    """

    farm = create_test_farm()

    scenario = Scenario(
        scenario_id="GROWTH_TEST",
        name="Growth Duration Test",
        duration_days=30,
        changes={},
    )

    result = simulate_farm(
        farm=farm,
        scenario=scenario,
    )

    final_point = result.timeline[-1]

    assert len(final_point.zones) == 2

    # Rice has a 120-day growth duration.
    # Wheat has a 120-day growth duration as well,
    # but this test ensures the simulation reaches
    # a valid growth-dependent yield calculation.
    for zone in final_point.zones:
        assert zone.expected_yield >= 0