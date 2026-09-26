import pytest
from app.schemas.result import SimulationMetrics, SimulationResult
from app.schemas.scenario import Scenario
from app.services.explanation import (
    build_simulation_result_from_raw,
    explain_result,
)


@pytest.fixture
def sample_scenario():
    return Scenario(
        scenario_id="scen-test-01",
        name="Severe Heat & Rain Reduction",
        scenario_type="HEATWAVE",
        duration_days=30,
        target_zones=["zone-1"],
        changes={"temperature_delta": 4.0, "rainfall_multiplier": 0.5},
    )


def test_build_simulation_result_from_raw_nested(sample_scenario):
    """Raw output with nested baseline and scenario dicts should map accurately."""
    raw_output = {
        "farm_id": "farm-alpha",
        "baseline": {
            "expected_yield": 4800.0,
            "final_soil_moisture": 32.0,
            "final_crop_health": 88.0,
        },
        "scenario": {
            "expected_yield": 3900.0,
            "final_soil_moisture": 21.0,
            "final_crop_health": 66.0,
        },
    }
    result = build_simulation_result_from_raw(
        simulation_id="sim-run-raw-1",
        simulation_output=raw_output,
        scenario=sample_scenario,
    )

    assert result.scenario_id == "sim-run-raw-1"
    assert result.farm_id == "farm-alpha"
    assert result.scenario_name == "Severe Heat & Rain Reduction"
    assert result.baseline.expected_yield == 4800.0
    assert result.scenario.expected_yield == 3900.0


def test_build_simulation_result_from_raw_flat(sample_scenario):
    """Raw output with flat legacy keys (e.g. final_yield_kg_ha) should adapt gracefully."""
    raw_flat = {
        "final_yield_kg_ha": 3500.0,
        "soil_moisture_pct": 24.0,
        "crop_health_score": 62.0,
        "water_usage_mm": 280.0,
    }
    result = build_simulation_result_from_raw(
        simulation_id="sim-run-flat-1",
        simulation_output=raw_flat,
        scenario=sample_scenario,
    )

    assert result.scenario.expected_yield == 3500.0
    assert result.scenario.final_soil_moisture == 24.0
    assert result.scenario.final_crop_health == 62.0
    assert result.baseline.expected_yield is not None


def test_explain_result_yield_loss_narrative():
    """Simulated yield decline should produce clear loss messaging and constructive recommendations."""
    sim_result = SimulationResult(
        scenario_id="sim-heatwave-01",
        scenario_name="Heatwave Simulation",
        baseline=SimulationMetrics(
            expected_yield=5000.0,
            final_soil_moisture=35.0,
            final_crop_health=85.0,
            final_disease_risk=10.0,
            water_usage=300.0,
        ),
        scenario=SimulationMetrics(
            expected_yield=4200.0,  # -16% drop
            final_soil_moisture=22.0,
            final_crop_health=65.0,
            final_disease_risk=12.0,
            water_usage=220.0,
        ),
    )

    explanation = explain_result(
        simulation_id="sim-heatwave-01",
        simulation_result=sim_result,
        audience="farmer",
    )

    assert explanation.simulation_id == "sim-heatwave-01"
    assert "summary" in explanation.model_dump()
    assert explanation.projected_yield_impact is not None
    assert "-16.0%" in explanation.projected_yield_impact
    assert len(explanation.key_observations) >= 2
    assert len(explanation.farmer_recommendations) >= 1
    # Check recommendation addresses moisture/heat
    rec_text = " ".join(explanation.farmer_recommendations).lower()
    assert "irrigation" in rec_text or "soil moisture" in rec_text or "watering" in rec_text


def test_explain_result_yield_gain_narrative():
    """Simulated yield increase should produce positive messaging without false guarantees."""
    sim_result = SimulationResult(
        scenario_id="sim-boost-01",
        scenario_name="Optimal Irrigation Boost",
        baseline=SimulationMetrics(
            expected_yield=4000.0,
            final_soil_moisture=28.0,
            final_crop_health=78.0,
            water_usage=300.0,
        ),
        scenario=SimulationMetrics(
            expected_yield=4600.0,  # +15%
            final_soil_moisture=36.0,
            final_crop_health=90.0,
            water_usage=400.0,
        ),
    )

    explanation = explain_result(
        simulation_id="sim-boost-01",
        simulation_result=sim_result,
        audience="farmer",
    )

    assert explanation.projected_yield_impact is not None
    assert "+15.0%" in explanation.projected_yield_impact
    assert any("improved" in obs.lower() or "vigor" in obs.lower() for obs in explanation.key_observations)


def test_explain_result_handles_raw_dict_directly():
    """explain_result should accept raw simulation_output directly without requiring prior conversion."""
    raw_output = {
        "final_yield_kg_ha": 3800.0,
        "soil_moisture": 25.0,
    }
    explanation = explain_result(
        simulation_id="sim-direct-raw",
        simulation_output=raw_output,
        audience="farmer",
    )

    assert explanation.simulation_id == "sim-direct-raw"
    assert len(explanation.farmer_recommendations) >= 1
