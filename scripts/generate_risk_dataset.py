"""
Script: Generate Synthetic Farm Risk Dataset
Responsibility:
- Generate 25,000 realistic synthetic agricultural zone records.
- Feature set:
    - soil_moisture (% v/v)
    - temperature (°C)
    - humidity (%)
    - rainfall (mm)
    - nitrogen (ppm)
    - phosphorus (ppm)
    - potassium (ppm)
    - crop (Rice, Wheat, Maize, etc.)
    - soil (Clay, Loam, Sandy, etc.)
    - growth_stage (Seedling, Vegetative, Flowering, etc.)
    - irrigation (Rainfed, Drip, Sprinkler, etc.)
- Multi-output target labels:
    - water_stress: LOW, MEDIUM, HIGH
    - heat_stress: LOW, MEDIUM, HIGH
    - disease_risk: LOW, MEDIUM, HIGH
    - nutrient_risk: LOW, MEDIUM, HIGH

Agronomic Logic:
- Rules model biophysical thresholds per crop species, developmental stage sensitivities,
  soil water-retention dynamics, weather interactions (heat index, vapor pressure deficit, fungal incubation),
  and nutrient stoichiometry.
- Controlled Gaussian noise (sigma=0.04-0.05) is injected into continuous risk indices before
  tier calibration to simulate natural field variance and prevent trivial threshold leakage.

DISCLAIMER:
This dataset is synthetic and generated specifically for the AI Agriculture Simulator
hackathon decision-support prototype. It does not replace calibrated field sensor telemetry.
"""

import os
import numpy as np
import pandas as pd

# Set fixed seed for reproducibility
np.random.seed(42)

CROPS = [
    "Rice", "Wheat", "Maize", "Corn", "Sorghum", "Pearl Millet",
    "Chickpea", "Pigeon Pea", "Green Gram", "Soybean", "Groundnut",
    "Mustard", "Cotton", "Sugarcane", "Potato"
]

SOILS = [
    "Sandy Loam", "Clay Loam", "Silt Loam", "Loam",
    "Sandy", "Clay", "Black Soil", "Red Soil", "Alluvial"
]

GROWTH_STAGES = [
    "Seedling", "Vegetative", "Flowering", "Grain Filling", "Maturity"
]

IRRIGATION_METHODS = [
    "Rainfed", "Drip", "Sprinkler", "Center Pivot", "Furrow"
]

# Crop agronomic profile constants
CROP_PROFILES = {
    # crop: (opt_temp_max, crit_temp, moisture_target, is_legume, water_demand_level)
    "Rice": (32.0, 37.0, 36.0, False, "high"),
    "Wheat": (24.0, 31.0, 22.0, False, "medium"),
    "Maize": (30.0, 36.0, 25.0, False, "medium_high"),
    "Corn": (30.0, 36.0, 25.0, False, "medium_high"),
    "Sorghum": (35.0, 42.0, 15.0, False, "low"),
    "Pearl Millet": (36.0, 43.0, 14.0, False, "low"),
    "Chickpea": (28.0, 33.0, 18.0, True, "low_medium"),
    "Pigeon Pea": (32.0, 37.0, 17.0, True, "low_medium"),
    "Green Gram": (32.0, 37.0, 17.0, True, "low_medium"),
    "Soybean": (30.0, 35.0, 24.0, True, "medium"),
    "Groundnut": (32.0, 38.0, 20.0, True, "medium"),
    "Mustard": (25.0, 30.0, 19.0, False, "medium"),
    "Cotton": (35.0, 40.0, 23.0, False, "medium_high"),
    "Sugarcane": (35.0, 41.0, 32.0, False, "high"),
    "Potato": (22.0, 28.0, 27.0, False, "medium_high"),
}


def generate_synthetic_samples(n_samples: int = 25000) -> pd.DataFrame:
    """Generate synthetic farm states and compute realistic agronomic risk labels."""
    records = []

    for _ in range(n_samples):
        crop = np.random.choice(CROPS)
        soil = np.random.choice(SOILS)
        stage = np.random.choice(GROWTH_STAGES)
        irrigation = np.random.choice(IRRIGATION_METHODS)

        profile = CROP_PROFILES.get(crop, (30.0, 35.0, 22.0, False, "medium"))
        opt_temp_max, crit_temp, target_moisture, is_legume, water_demand = profile

        # Weather / soil climate regime selection:
        # 1. Dry / Drought regime (~30%): low moisture, high temp, little/no rain
        # 2. Moderate / Typical regime (~45%): balanced conditions
        # 3. Wet / Humid regime (~25%): high moisture, humid, rainy, disease-prone
        regime = np.random.choice(["drought", "normal", "wet"], p=[0.30, 0.45, 0.25])

        if regime == "drought":
            temperature = round(float(np.random.normal(34.0, 5.0)), 1)
            humidity = round(float(np.random.normal(35.0, 10.0)), 1)
            rainfall = round(float(np.random.exponential(1.5)), 1) if np.random.rand() < 0.25 else 0.0
            soil_moisture = round(float(np.random.normal(13.0, 4.0)), 1)
        elif regime == "wet":
            temperature = round(float(np.random.normal(26.0, 4.0)), 1)
            humidity = round(float(np.random.normal(82.0, 8.0)), 1)
            rainfall = round(float(np.random.exponential(22.0) + 5.0), 1)
            soil_moisture = round(float(np.random.normal(32.0, 5.0)), 1)
        else:  # normal
            temperature = round(float(np.random.normal(27.0, 5.5)), 1)
            humidity = round(float(np.random.normal(60.0, 12.0)), 1)
            rainfall = round(float(np.random.exponential(8.0)), 1) if np.random.rand() < 0.45 else 0.0
            soil_moisture = round(float(np.random.normal(23.0, 5.0)), 1)

        # Clamping
        temperature = max(10.0, min(48.0, temperature))
        humidity = max(15.0, min(98.0, humidity))
        rainfall = min(85.0, max(0.0, rainfall))
        soil_moisture = max(5.0, min(48.0, soil_moisture))

        # Soil N-P-K nutrient levels (ppm / mg/kg)
        # Nutrient depletion regime (~25% deficient, ~50% balanced, ~25% high)
        n_regime = np.random.choice(["low", "med", "high"], p=[0.25, 0.50, 0.25])
        if n_regime == "low":
            nitrogen = round(float(np.random.uniform(5.0, 22.0)), 1)
            phosphorus = round(float(np.random.uniform(2.0, 12.0)), 1)
            potassium = round(float(np.random.uniform(30.0, 100.0)), 1)
        elif n_regime == "med":
            nitrogen = round(float(np.random.uniform(22.0, 50.0)), 1)
            phosphorus = round(float(np.random.uniform(12.0, 28.0)), 1)
            potassium = round(float(np.random.uniform(100.0, 190.0)), 1)
        else:
            nitrogen = round(float(np.random.uniform(50.0, 110.0)), 1)
            phosphorus = round(float(np.random.uniform(28.0, 55.0)), 1)
            potassium = round(float(np.random.uniform(190.0, 350.0)), 1)

        # ----------------------------------------------------
        # RISK COMPUTATION WITH AGRONOMIC DOMAIN RULES
        # ----------------------------------------------------

        # --- A. WATER STRESS ---
        # Moisture deficit relative to crop requirement
        raw_deficit = max(0.0, (target_moisture - soil_moisture) / target_moisture)

        # Rainfall effect (rain replenishes moisture and relieves immediate stress)
        rain_relief = min(0.50, rainfall / 20.0)

        # Irrigation mitigation
        if irrigation == "Rainfed":
            irr_relief = 0.0
        elif irrigation == "Drip":
            irr_relief = 0.35 if soil_moisture >= 12.0 else 0.15
        elif irrigation == "Center Pivot":
            irr_relief = 0.30 if soil_moisture >= 12.0 else 0.12
        elif irrigation == "Sprinkler":
            irr_relief = 0.25 if soil_moisture >= 12.0 else 0.10
        else:  # Furrow
            irr_relief = 0.22 if soil_moisture >= 12.0 else 0.10

        # Stage sensitivity
        stage_mult = 1.0
        if stage == "Flowering":
            stage_mult = 1.25
        elif stage == "Grain Filling":
            stage_mult = 1.15
        elif stage == "Maturity":
            stage_mult = 0.70

        # Soil factor
        soil_mod = 0.08 if "Sandy" in soil else (-0.05 if ("Clay" in soil or "Black" in soil) else 0.0)

        # Evaporative stress: high temperature (> 33°C) and low humidity (< 40%)
        et_mod = 0.08 if (temperature > 33.0 and humidity < 45.0) else 0.0

        water_index = (raw_deficit * stage_mult) - (0.7 * rain_relief) - (0.6 * irr_relief) + soil_mod + et_mod
        water_index += np.random.normal(0, 0.04)  # Natural variance
        water_index = max(0.0, min(1.0, water_index))

        if water_index >= 0.45:
            water_stress = "HIGH"
        elif water_index >= 0.22:
            water_stress = "MEDIUM"
        else:
            water_stress = "LOW"

        # --- B. HEAT STRESS ---
        if temperature <= opt_temp_max:
            thermal_score = 0.10 * max(0.0, (temperature - (opt_temp_max - 8.0)) / 8.0)
        else:
            excess = temperature - opt_temp_max
            span = max(4.0, crit_temp - opt_temp_max)
            thermal_score = 0.28 + (excess / span) * 0.55

        # Transpiration cooling: moist soil buffers leaf temperature; bone dry soil escalates heat stress
        if soil_moisture > 28.0:
            thermal_score -= 0.10
        elif soil_moisture < 14.0:
            thermal_score += 0.12

        # Flowering and grain filling stages are hypersensitive to heat (pollen sterility)
        if stage in ["Flowering", "Grain Filling"]:
            thermal_score *= 1.20

        thermal_score += np.random.normal(0, 0.04)
        thermal_score = max(0.0, min(1.0, thermal_score))

        if thermal_score >= 0.48:
            heat_stress = "HIGH"
        elif thermal_score >= 0.24:
            heat_stress = "MEDIUM"
        else:
            heat_stress = "LOW"

        # --- C. DISEASE RISK ---
        # Fungal & bacterial foliar diseases thrive in warm, humid, wet canopies
        hum_score = max(0.0, (humidity - 60.0) / 32.0)
        moisture_presence = min(1.0, rainfall / 15.0)
        if irrigation == "Sprinkler":
            moisture_presence = max(moisture_presence, 0.35)

        # Thermal suitability: pathogens prefer 20°C - 30°C (bell curve centered at 25°C)
        temp_suitability = np.exp(-((temperature - 25.0) ** 2) / (2.0 * (6.5 ** 2)))

        # Canopy microclimate: dense flowering/vegetative stages trap humidity
        canopy_factor = 1.15 if stage in ["Vegetative", "Flowering"] else (1.20 if stage == "Maturity" and rainfall > 15.0 else 0.90)

        disease_index = (0.50 * hum_score + 0.35 * moisture_presence) * temp_suitability * canopy_factor
        disease_index += np.random.normal(0, 0.04)
        disease_index = max(0.0, min(1.0, disease_index))

        if disease_index >= 0.45:
            disease_risk = "HIGH"
        elif disease_index >= 0.22:
            disease_risk = "MEDIUM"
        else:
            disease_risk = "LOW"

        # --- D. NUTRIENT RISK ---
        # Nitrogen deficit
        target_n = 45.0
        if is_legume:
            target_n = 22.0  # Legumes fix atmospheric N; lower external N requirement
        n_deficit = max(0.0, (target_n - nitrogen) / target_n)

        # Phosphorus deficit (vital for legumes nodulation & roots)
        target_p = 22.0 if is_legume else 18.0
        p_deficit = max(0.0, (target_p - phosphorus) / target_p)

        # Potassium deficit
        target_k = 150.0
        k_deficit = max(0.0, (target_k - potassium) / target_k)

        # Growth stage nutrient demands
        stage_n_mult = 1.20 if stage == "Vegetative" else 1.0
        stage_k_mult = 1.25 if stage in ["Flowering", "Grain Filling"] else 1.0

        nutrient_index = (0.45 * n_deficit * stage_n_mult) + (0.30 * p_deficit) + (0.25 * k_deficit * stage_k_mult)

        # Synergistic deficit if all 3 are low
        if nitrogen < 20.0 and phosphorus < 10.0 and potassium < 90.0:
            nutrient_index += 0.15

        nutrient_index += np.random.normal(0, 0.04)
        nutrient_index = max(0.0, min(1.0, nutrient_index))

        if nutrient_index >= 0.48:
            nutrient_risk = "HIGH"
        elif nutrient_index >= 0.24:
            nutrient_risk = "MEDIUM"
        else:
            nutrient_risk = "LOW"

        records.append({
            "soil_moisture": soil_moisture,
            "temperature": temperature,
            "humidity": humidity,
            "rainfall": rainfall,
            "nitrogen": nitrogen,
            "phosphorus": phosphorus,
            "potassium": potassium,
            "crop": crop,
            "soil": soil,
            "growth_stage": stage,
            "irrigation": irrigation,
            "water_stress": water_stress,
            "heat_stress": heat_stress,
            "disease_risk": disease_risk,
            "nutrient_risk": nutrient_risk,
        })

    return pd.DataFrame(records)


def main():
    output_path = os.path.join("data", "risk_training.csv")
    os.makedirs("data", exist_ok=True)

    print("Generating 25,000 synthetic farm risk records with biophysical rules...")
    df = generate_synthetic_samples(25000)

    df.to_csv(output_path, index=False)
    print(f"Successfully saved {len(df)} records to {output_path}")

    print("\n--- DATASET STATISTICS ---")
    print(f"Total samples: {len(df)}")
    print(f"Numeric features: soil_moisture, temperature, humidity, rainfall, nitrogen, phosphorus, potassium")
    print(f"Categorical features: crop ({df['crop'].nunique()}), soil ({df['soil'].nunique()}), growth_stage ({df['growth_stage'].nunique()}), irrigation ({df['irrigation'].nunique()})")

    print("\nTarget Label Distributions:")
    for target in ["water_stress", "heat_stress", "disease_risk", "nutrient_risk"]:
        print(f"\n[{target.upper()}]")
        counts = df[target].value_counts()
        for label, count in counts.items():
            pct = (count / len(df)) * 100.0
            print(f"  {label:<8}: {count:>6} ({pct:>5.1f}%)")


if __name__ == "__main__":
    main()
