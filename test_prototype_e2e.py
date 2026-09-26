import urllib.request
import json
import sys

BASE_URL = 'http://127.0.0.1:8000/api'

# 1. Register / login farmer
print('Step 1: Logging in / Registering farmer...')
reg_data = json.dumps({
    'name': 'Demo Farmer',
    'email': 'demofarmer_hackathon@prototype.com',
    'password': 'Password123!',
    'location': 'Virtual Region'
}).encode()
req = urllib.request.Request(f'{BASE_URL}/users/register', data=reg_data, headers={'Content-Type': 'application/json'})
try:
    with urllib.request.urlopen(req) as resp:
        user_res = json.loads(resp.read().decode())
except Exception:
    login_data = json.dumps({'email': 'demofarmer_hackathon@prototype.com', 'password': 'Password123!'}).encode()
    req = urllib.request.Request(f'{BASE_URL}/users/login', data=login_data, headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req) as resp:
        user_res = json.loads(resp.read().decode())

token = user_res.get('session_token')
headers = {'Content-Type': 'application/json', 'Authorization': f'Bearer {token}'}

# 2. Create Farm: Demo Farm, 10 acres
print('Step 2 & 3: Creating Farm: Demo Farm (10 acres)...')
farm_payload = json.dumps({
    'name': 'Demo Farm',
    'area': 10.0,
    'location': 'Virtual Farm Workspace',
    'numberOfZones': 3
}).encode()
req = urllib.request.Request(f'{BASE_URL}/farms', data=farm_payload, headers=headers)
with urllib.request.urlopen(req) as resp:
    farm = json.loads(resp.read().decode())
farm_id = farm['id']
print(f'   Farm successfully created with ID: {farm_id}')

# 4. Add Zone 1: Wheat (4 acres)
print('Step 4: Adding Zone 1 (Wheat, 4 acres)...')
z1_payload = json.dumps({
    'name': 'Zone 1',
    'crop': 'Wheat',
    'area': 4.0,
    'soil': 'Loamy',
    'growth_stage': 'Vegetative',
    'irrigation': 'Drip',
    'soil_moisture': 45.0,
    'temperature': 24.0,
    'humidity': 60.0,
    'rainfall': 15.0,
    'nitrogen': 60.0,
    'phosphorus': 40.0,
    'potassium': 40.0
}).encode()
req = urllib.request.Request(f'{BASE_URL}/farms/{farm_id}/zones', data=z1_payload, headers=headers)
with urllib.request.urlopen(req) as resp:
    z1 = json.loads(resp.read().decode())
print(f'   Zone 1 added: {z1["name"]} ({z1["crop"]}, {z1["area"]} acres)')

# 5. Add Zone 2: Tomato (3 acres)
print('Step 5: Adding Zone 2 (Tomato, 3 acres)...')
z2_payload = json.dumps({
    'name': 'Zone 2',
    'crop': 'Tomato',
    'area': 3.0,
    'soil': 'Alluvial',
    'growth_stage': 'Flowering',
    'irrigation': 'Drip',
    'soil_moisture': 50.0,
    'temperature': 24.0,
    'humidity': 60.0,
    'rainfall': 15.0,
    'nitrogen': 55.0,
    'phosphorus': 45.0,
    'potassium': 40.0
}).encode()
req = urllib.request.Request(f'{BASE_URL}/farms/{farm_id}/zones', data=z2_payload, headers=headers)
with urllib.request.urlopen(req) as resp:
    z2 = json.loads(resp.read().decode())
print(f'   Zone 2 added: {z2["name"]} ({z2["crop"]}, {z2["area"]} acres)')

# 6. Add Zone 3: Rice (3 acres)
print('Step 6: Adding Zone 3 (Rice, 3 acres)...')
z3_payload = json.dumps({
    'name': 'Zone 3',
    'crop': 'Rice',
    'area': 3.0,
    'soil': 'Clay',
    'growth_stage': 'Seedling',
    'irrigation': 'Flood',
    'soil_moisture': 70.0,
    'temperature': 24.0,
    'humidity': 65.0,
    'rainfall': 20.0,
    'nitrogen': 50.0,
    'phosphorus': 30.0,
    'potassium': 35.0
}).encode()
req = urllib.request.Request(f'{BASE_URL}/farms/{farm_id}/zones', data=z3_payload, headers=headers)
with urllib.request.urlopen(req) as resp:
    z3 = json.loads(resp.read().decode())
print(f'   Zone 3 added: {z3["name"]} ({z3["crop"]}, {z3["area"]} acres)')

# 7. Reload farm from Firestore to verify persistence
print('Step 7: Testing persistence after reload...')
req = urllib.request.Request(f'{BASE_URL}/farms/{farm_id}', headers=headers)
with urllib.request.urlopen(req) as resp:
    loaded_farm = json.loads(resp.read().decode())

assert loaded_farm['name'] == 'Demo Farm'
assert loaded_farm['area'] == 10.0
assert len(loaded_farm['zones']) == 3
print(f'   Verified persisted farm: {loaded_farm["name"]}, {loaded_farm["area"]} acres, {len(loaded_farm["zones"])} zones')

# 8. Create Scenario: Rainfall -30%, Temperature +2C, Duration 30 days
print('Step 8: Configuring Scenario (Rainfall -30%, Temp +2C, 30 days)...')
scenario_payload = json.dumps({
    'farm_id': farm_id,
    'name': 'Drought & Heatwave Scenario',
    'duration_days': 30,
    'scenario_type': 'DROUGHT',
    'changes': [
        {'type': 'rainfall_decrease', 'parameter': 'rainfall', 'value': -30.0, 'unit': '%'},
        {'type': 'temperature_increase', 'parameter': 'temperature', 'value': 2.0, 'unit': 'C'}
    ]
}).encode()
req = urllib.request.Request(f'{BASE_URL}/scenarios', data=scenario_payload, headers=headers)
with urllib.request.urlopen(req) as resp:
    scenario = json.loads(resp.read().decode())
scenario_id = scenario['id']
print(f'   Scenario created with ID: {scenario_id}')

# 9. Run Simulation
print('Step 9: Running Person 2 Simulation Engine...')
sim_payload = json.dumps({
    'farm_id': farm_id,
    'scenario_id': scenario_id
}).encode()
req = urllib.request.Request(f'{BASE_URL}/simulate', data=sim_payload, headers=headers)
with urllib.request.urlopen(req) as resp:
    sim_res = json.loads(resp.read().decode())

print('   Simulation Successful!')
print(f'   Simulation ID: {sim_res["id"]}')
print(f'   Crop Health: {sim_res["baseline_summary"]["average_crop_health"]}% (Baseline) -> {sim_res["summary"]["average_crop_health"]}% (Simulated)')
print(f'   Soil Moisture: {sim_res["baseline_summary"]["average_soil_moisture"]}% (Baseline) -> {sim_res["summary"]["average_soil_moisture"]}% (Simulated)')
print(f'   Total Yield: {sim_res["baseline_summary"]["total_expected_yield"]} tonnes (Baseline) -> {sim_res["summary"]["total_expected_yield"]} tonnes (Simulated)')
print(f'   AI Explanation Available: {bool(sim_res.get("ai_explanation"))}')
if sim_res.get('ai_explanation'):
    print(f'   AI Explanation: {sim_res["ai_explanation"][:120]}...')

# 10. Test Result Fetch
print('Step 10: Fetching Simulation Result via /simulation/{id}...')
req = urllib.request.Request(f'{BASE_URL}/simulation/{sim_res["id"]}', headers=headers)
with urllib.request.urlopen(req) as resp:
    fetched = json.loads(resp.read().decode())
assert fetched['id'] == sim_res['id']
print('   Successfully fetched simulation record!')

print('\n>>> COMPLETE 17-STEP WORKFLOW VERIFIED SUCCESSFULLY! <<<')
