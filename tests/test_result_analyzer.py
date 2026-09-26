import pytest
from app.schemas.result import (
    MetricDirection,
    RiskLevel,
    SimulationMetrics,
    SimulationResult,
)
from app.services.result_analyzer import ResultAnalyzer, analyze_simulation, compare_simulations


@pytest.fixture
def analyzer():
    return ResultAnalyzer()


@pytest.fixture
def standard_baseline():
    return SimulationMetrics(
        expected_yield=4500.0,
        final_soil_moisture=32.0,
        final_crop_health=85.0,
        final_disease_risk=15.0,
        water_usage=320.0,
    )


def test_metric_comparison_directions(analyzer):
    """Test direction classification and delta computations."""
    # Yield decreased
    comp_yield = analyzer._compare_single_metric("expected_yield", 4000.0, 3600.0)
    assert comp_yield.direction == MetricDirection.DECREASED
    assert comp_yield.absolute_change == -400.0
    assert comp_yield.percentage_change == -10.0

    # Disease increased
    comp_dis = analyzer._compare_single_metric("final_disease_risk", 10.0, 30.0)
    assert comp_dis.direction == MetricDirection.INCREASED
    assert comp_dis.absolute_change == 20.0
    assert comp_dis.percentage_change == 200.0

    # Health increased
    comp_health = analyzer._compare_single_metric("final_crop_health", 70.0, 84.0)
    assert comp_health.direction == MetricDirection.INCREASED
    assert comp_health.absolute_change == 14.0
    assert comp_health.percentage_change == 20.0

    # Unchanged
    comp_same = analyzer._compare_single_metric("expected_yield", 5000.0, 5000.0)
    assert comp_same.direction == MetricDirection.UNCHANGED
    assert comp_same.absolute_change == 0.0
    assert comp_same.percentage_change == 0.0


def test_zero_baseline_safe_division(analyzer):
    """Zero baseline must not trigger ZeroDivisionError and should return None for percentage_change."""
    comp_zero = analyzer._compare_single_metric("water_usage", 0.0, 50.0)
    assert comp_zero.direction == MetricDirection.INCREASED
    assert comp_zero.absolute_change == 50.0
    assert comp_zero.percentage_change is None
    assert "50.0" in comp_zero.interpretation
    assert "%" not in comp_zero.interpretation


def test_high_impact_severe_yield_loss(analyzer, standard_baseline):
    """A severe yield drop (>=15%) must be classified as HIGH impact."""
    scenario_metrics = SimulationMetrics(
        expected_yield=3600.0,  # -20% drop from 4500
        final_soil_moisture=20.0,
        final_crop_health=60.0,
        final_disease_risk=15.0,
        water_usage=200.0,
    )
    result = SimulationResult(
        scenario_id="sim-drought-high",
        baseline=standard_baseline,
        scenario=scenario_metrics,
    )
    analysis = analyzer.analyze(result)

    assert analysis.impact_level == RiskLevel.HIGH
    assert len(analysis.negative_impacts) >= 1
    assert any("yield" in neg.lower() for neg in analysis.negative_impacts)
    assert analysis.suggested_next_action is not None


def test_tradeoff_detection_productivity_vs_water(analyzer, standard_baseline):
    """Detect trade-off when yield increases but water usage increases substantially."""
    scenario_metrics = SimulationMetrics(
        expected_yield=5200.0,  # +15.5%
        final_soil_moisture=38.0,
        final_crop_health=92.0,
        final_disease_risk=18.0,
        water_usage=480.0,  # +50%
    )
    result = SimulationResult(
        scenario_id="sim-irrigation-high",
        baseline=standard_baseline,
        scenario=scenario_metrics,
    )
    analysis = analyzer.analyze(result)

    assert len(analysis.tradeoffs) >= 1
    assert any("water" in t.lower() and ("crop" in t.lower() or "performance" in t.lower()) for t in analysis.tradeoffs)
    assert len(analysis.positive_impacts) >= 1


def test_tradeoff_detection_moisture_vs_disease(analyzer, standard_baseline):
    """Detect trade-off when soil moisture is elevated alongside higher disease risk."""
    scenario_metrics = SimulationMetrics(
        expected_yield=4500.0,
        final_soil_moisture=45.0,  # Elevated moisture
        final_crop_health=82.0,
        final_disease_risk=45.0,  # High disease risk
        water_usage=360.0,
    )
    result = SimulationResult(
        scenario_id="sim-wet-disease",
        baseline=standard_baseline,
        scenario=scenario_metrics,
    )
    analysis = analyzer.analyze(result)

    assert any("canopy wetness" in t.lower() or "disease" in t.lower() for t in analysis.tradeoffs)


def test_low_impact_minimal_fluctuations(analyzer, standard_baseline):
    """Changes below 5% without severe disruptions must be classified as LOW impact."""
    scenario_metrics = SimulationMetrics(
        expected_yield=4550.0,  # +1.1%
        final_soil_moisture=31.5,
        final_crop_health=84.0,
        final_disease_risk=15.2,
        water_usage=325.0,
    )
    result = SimulationResult(
        scenario_id="sim-steady",
        baseline=standard_baseline,
        scenario=scenario_metrics,
    )
    analysis = analyzer.analyze(result)

    assert analysis.impact_level == RiskLevel.LOW
    assert "minor" in analysis.summary.lower() or "minimal" in analysis.summary.lower()


def test_missing_optional_metrics_handled_cleanly(analyzer):
    """Simulation with sparse optional metrics should analyze successfully without error."""
    sparse_baseline = SimulationMetrics(expected_yield=3000.0)
    sparse_scenario = SimulationMetrics(expected_yield=2700.0)

    result = SimulationResult(
        scenario_id="sim-sparse",
        baseline=sparse_baseline,
        scenario=sparse_scenario,
    )
    analysis = analyzer.analyze(result)

    assert len(analysis.metrics) == 1
    assert analysis.metrics[0].metric == "expected_yield"
    assert analysis.metrics[0].percentage_change == -10.0


def test_compare_simulations_multi_scenario(analyzer, standard_baseline):
    """Multi-scenario comparison should produce comparative rankings and narrative."""
    sim_drought = SimulationResult(
        scenario_id="sim-drought",
        scenario_name="Rain Reduction 30%",
        baseline=standard_baseline,
        scenario=SimulationMetrics(
            expected_yield=3800.0,
            final_soil_moisture=20.0,
            final_crop_health=68.0,
        ),
    )
    sim_irrig = SimulationResult(
        scenario_id="sim-irrig",
        scenario_name="Irrigation Boost 25%",
        baseline=standard_baseline,
        scenario=SimulationMetrics(
            expected_yield=4800.0,
            final_soil_moisture=38.0,
            final_crop_health=90.0,
        ),
    )

    comp_res = compare_simulations([sim_drought, sim_irrig])
    assert len(comp_res.comparisons) == 2
    assert comp_res.comparisons[0].scenario_id == "sim-drought"
    assert comp_res.comparisons[1].scenario_id == "sim-irrig"
    assert "sim-irrig" in comp_res.explanation
    assert "sim-drought" in comp_res.explanation
