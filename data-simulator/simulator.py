"""
Data Simulator - Generates realistic industrial sensor data
Simulates temperature, pressure, vibration, and machine status
with occasional anomalies for testing the alert engine.

Can run standalone and POST data to the backend API.
"""

import random
import time
import json
import asyncio
import os
from datetime import datetime
from typing import Optional

import numpy as np

try:
    import httpx
    HAS_HTTPX = True
except ImportError:
    HAS_HTTPX = False


# Backend API URL
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8000")
SIMULATOR_INTERVAL = float(os.getenv("SIMULATOR_INTERVAL", "2.0"))


class SensorSimulator:
    """Simulates industrial sensors with realistic patterns."""

    def __init__(self):
        # Standard 6 parameters for ALL machines: temperature, pressure, resistance, current, vibration, flow_rate
        # Each tuple: (min, max, normal_mean, normal_std)
        self.machine_configs = {
            # Electrical Systems
            "Cables": {"temperature": (40, 70, 55, 3), "pressure": (0.5, 3, 1.5, 0.2), "resistance": (500, 5000, 2500, 200), "current": (10, 100, 55, 8), "vibration": (0, 3, 1, 0.3), "flow_rate": (0, 50, 20, 5)},
            "Drives": {"temperature": (35, 75, 50, 4), "pressure": (1, 5, 3, 0.4), "resistance": (100, 2000, 800, 100), "current": (20, 200, 80, 15), "vibration": (0, 6, 2, 0.5), "flow_rate": (10, 100, 50, 10)},
            "Excitor": {"temperature": (40, 90, 60, 5), "pressure": (1, 4, 2.5, 0.3), "resistance": (200, 3000, 1200, 150), "current": (5, 60, 30, 5), "vibration": (0, 5, 1.5, 0.4), "flow_rate": (5, 80, 35, 8)},
            "Generator": {"temperature": (50, 120, 75, 8), "pressure": (2, 8, 5, 0.6), "resistance": (50, 500, 200, 30), "current": (100, 2000, 800, 100), "vibration": (0, 8, 2.5, 0.8), "flow_rate": (50, 500, 200, 30)},
            "Motor": {"temperature": (45, 110, 70, 6), "pressure": (1, 6, 3, 0.5), "resistance": (100, 1500, 500, 60), "current": (10, 150, 60, 12), "vibration": (0, 10, 3, 1), "flow_rate": (20, 200, 80, 15)},
            "Relay": {"temperature": (25, 65, 35, 3), "pressure": (0.5, 2, 1, 0.1), "resistance": (0.01, 1.0, 0.1, 0.02), "current": (0.5, 10, 3, 0.5), "vibration": (0, 2, 0.5, 0.1), "flow_rate": (0, 10, 3, 1)},
            "Solar": {"temperature": (25, 80, 45, 8), "pressure": (0.5, 3, 1.5, 0.2), "resistance": (100, 5000, 2000, 300), "current": (0, 20, 8, 2), "vibration": (0, 2, 0.5, 0.2), "flow_rate": (0, 30, 10, 3)},
            "Switchgear": {"temperature": (30, 80, 45, 5), "pressure": (1, 6, 3, 0.5), "resistance": (1000, 10000, 5000, 500), "current": (50, 2000, 500, 80), "vibration": (0, 4, 1.5, 0.4), "flow_rate": (0, 50, 20, 5)},
            "Transformer": {"temperature": (40, 95, 65, 6), "pressure": (0.5, 4, 2, 0.3), "resistance": (200, 5000, 1500, 200), "current": (50, 1000, 300, 50), "vibration": (0, 5, 1.5, 0.5), "flow_rate": (10, 100, 40, 8)},
            # Heavy Machinery
            "Cold_Rolling_Mill": {"temperature": (60, 150, 90, 10), "pressure": (50, 300, 150, 20), "resistance": (10, 200, 80, 15), "current": (200, 3000, 1200, 150), "vibration": (0, 12, 4, 1.5), "flow_rate": (100, 1000, 400, 50)},
            "Compactor": {"temperature": (40, 90, 60, 5), "pressure": (100, 500, 250, 30), "resistance": (20, 300, 100, 20), "current": (100, 800, 350, 50), "vibration": (0, 15, 5, 2), "flow_rate": (50, 400, 180, 25)},
            "Compressor": {"temperature": (50, 120, 80, 8), "pressure": (2, 12, 7, 1), "resistance": (30, 500, 150, 25), "current": (50, 600, 250, 40), "vibration": (0, 8, 3, 0.8), "flow_rate": (50, 500, 250, 30)},
            "Conveyor": {"temperature": (30, 70, 45, 4), "pressure": (1, 5, 2.5, 0.3), "resistance": (50, 800, 300, 40), "current": (20, 200, 80, 15), "vibration": (0, 6, 2, 0.5), "flow_rate": (100, 800, 350, 40)},
            "Crusher": {"temperature": (50, 130, 80, 10), "pressure": (10, 100, 50, 8), "resistance": (10, 200, 60, 12), "current": (200, 2000, 800, 100), "vibration": (2, 20, 8, 3), "flow_rate": (50, 500, 200, 30)},
            "Fan": {"temperature": (30, 70, 45, 4), "pressure": (0.5, 5, 2, 0.3), "resistance": (50, 600, 200, 30), "current": (20, 300, 100, 20), "vibration": (0, 8, 2.5, 0.7), "flow_rate": (1000, 10000, 5000, 500)},
            "GearBox": {"temperature": (40, 100, 65, 6), "pressure": (1, 6, 3.5, 0.4), "resistance": (30, 400, 150, 25), "current": (50, 500, 200, 30), "vibration": (0, 12, 4, 1.2), "flow_rate": (20, 300, 120, 20)},
            "Grinder_Mill": {"temperature": (50, 120, 75, 8), "pressure": (5, 50, 20, 5), "resistance": (10, 300, 100, 20), "current": (200, 1500, 600, 80), "vibration": (2, 18, 7, 2.5), "flow_rate": (30, 400, 150, 25)},
            "Nodulizer": {"temperature": (800, 1500, 1100, 50), "pressure": (1, 5, 3, 0.5), "resistance": (5, 100, 30, 8), "current": (100, 1000, 400, 60), "vibration": (1, 10, 4, 1), "flow_rate": (10, 100, 50, 8)},
            "Pulley": {"temperature": (30, 70, 45, 5), "pressure": (1, 8, 3, 0.5), "resistance": (50, 500, 200, 30), "current": (10, 150, 50, 10), "vibration": (0, 6, 2, 0.6), "flow_rate": (20, 200, 80, 15)},
            "Pump": {"temperature": (35, 85, 55, 5), "pressure": (1, 10, 5, 0.8), "resistance": (30, 400, 150, 20), "current": (30, 400, 150, 25), "vibration": (0, 8, 2.5, 0.7), "flow_rate": (20, 500, 200, 30)},
            "Roller": {"temperature": (40, 110, 70, 8), "pressure": (50, 400, 200, 25), "resistance": (20, 300, 100, 15), "current": (100, 1000, 400, 50), "vibration": (0, 10, 3.5, 1), "flow_rate": (50, 500, 200, 30)},
            "Rolls_of_Rolling_Mill": {"temperature": (100, 300, 180, 20), "pressure": (100, 600, 350, 40), "resistance": (5, 100, 40, 8), "current": (300, 3000, 1500, 200), "vibration": (1, 15, 5, 1.5), "flow_rate": (100, 800, 400, 50)},
            "Turbine": {"temperature": (200, 600, 400, 30), "pressure": (5, 40, 20, 3), "resistance": (10, 200, 80, 15), "current": (200, 5000, 2000, 300), "vibration": (0, 10, 3, 1), "flow_rate": (100, 2000, 800, 100)},
            "Weigh_Feeder": {"temperature": (25, 60, 40, 3), "pressure": (0.5, 3, 1.5, 0.2), "resistance": (50, 800, 300, 40), "current": (10, 100, 40, 8), "vibration": (0, 4, 1.5, 0.4), "flow_rate": (10, 200, 80, 10)},
            # Process Equipment
            "Boiler": {"temperature": (100, 350, 200, 20), "pressure": (5, 40, 20, 3), "resistance": (20, 300, 100, 20), "current": (100, 1000, 400, 60), "vibration": (0, 6, 2, 0.5), "flow_rate": (50, 500, 250, 30)},
            "Burner": {"temperature": (500, 1200, 800, 50), "pressure": (2, 15, 8, 1.5), "resistance": (10, 200, 60, 12), "current": (50, 500, 200, 30), "vibration": (0, 5, 2, 0.5), "flow_rate": (10, 100, 50, 8)},
            "Column": {"temperature": (80, 300, 150, 15), "pressure": (1, 10, 5, 0.8), "resistance": (30, 500, 150, 25), "current": (20, 300, 100, 20), "vibration": (0, 4, 1.5, 0.4), "flow_rate": (50, 400, 200, 25)},
            "Condensor": {"temperature": (30, 80, 50, 5), "pressure": (0.5, 5, 2, 0.3), "resistance": (50, 800, 300, 40), "current": (30, 300, 100, 20), "vibration": (0, 4, 1, 0.3), "flow_rate": (100, 1000, 500, 50)},
            "Cyclone_Separator": {"temperature": (60, 200, 120, 15), "pressure": (0.5, 5, 2, 0.3), "resistance": (30, 400, 150, 25), "current": (20, 200, 80, 15), "vibration": (0, 5, 2, 0.5), "flow_rate": (100, 800, 400, 50)},
            "ESP": {"temperature": (100, 300, 180, 15), "pressure": (1, 5, 2.5, 0.3), "resistance": (1000, 50000, 20000, 3000), "current": (100, 1000, 500, 80), "vibration": (0, 3, 1, 0.3), "flow_rate": (200, 2000, 800, 100)},
            "Fired_Heater": {"temperature": (300, 900, 600, 40), "pressure": (2, 15, 8, 1.5), "resistance": (10, 200, 60, 12), "current": (50, 500, 200, 30), "vibration": (0, 5, 2, 0.5), "flow_rate": (20, 200, 100, 15)},
            "Heat_Exchanger": {"temperature": (40, 150, 80, 10), "pressure": (1, 10, 4, 0.6), "resistance": (30, 500, 150, 25), "current": (20, 200, 80, 15), "vibration": (0, 4, 1.5, 0.4), "flow_rate": (50, 500, 250, 30)},
            "Pipeline": {"temperature": (20, 80, 45, 5), "pressure": (1, 50, 20, 3), "resistance": (50, 1000, 300, 50), "current": (5, 50, 20, 5), "vibration": (0, 5, 1.5, 0.4), "flow_rate": (50, 2000, 800, 100)},
        }

        # Standard 6 parameters with units
        self.standard_params = ["temperature", "pressure", "resistance", "current", "vibration", "flow_rate"]
        self.units = {
            "temperature": "°C",
            "pressure": "bar",
            "resistance": "Ω",
            "current": "A",
            "vibration": "mm/s",
            "flow_rate": "L/min",
        }

        # Initialize machine states
        self.machines = {}
        for machine_name in self.machine_configs:
            self.machines[machine_name] = {
                "status": random.choice(["running", "running", "running", "idle"]),
                "uptime_hours": round(random.uniform(0, 500), 1),
                "load": round(random.uniform(30, 90), 1),
            }

        self.anomaly_probability = 0.08
        self.trend_state = {}

        # Also keep legacy sensors for backward compatibility
        self.sensors = {
            "temperature_1": {"min": 60, "max": 85, "unit": "°C", "normal_mean": 72, "normal_std": 3},
            "temperature_2": {"min": 40, "max": 65, "unit": "°C", "normal_mean": 52, "normal_std": 2},
            "pressure_1": {"min": 2.0, "max": 6.0, "unit": "bar", "normal_mean": 4.0, "normal_std": 0.3},
            "pressure_2": {"min": 1.0, "max": 4.0, "unit": "bar", "normal_mean": 2.5, "normal_std": 0.2},
            "vibration_1": {"min": 0, "max": 10, "unit": "mm/s", "normal_mean": 2.5, "normal_std": 0.8},
            "flow_rate_1": {"min": 50, "max": 200, "unit": "L/min", "normal_mean": 120, "normal_std": 10},
        }

    def generate_reading(self, sensor_id: str) -> dict:
        """Generate a single sensor reading with possible anomaly."""
        config = self.sensors[sensor_id]

        # Decide if this is an anomaly
        is_anomaly = random.random() < self.anomaly_probability

        if is_anomaly:
            anomaly_type = random.choice(["spike", "drift", "flatline"])
            if anomaly_type == "spike":
                direction = random.choice([1, -1])
                value = config["normal_mean"] + direction * config["normal_std"] * random.uniform(3, 6)
            elif anomaly_type == "drift":
                if sensor_id not in self.trend_state:
                    self.trend_state[sensor_id] = 0
                self.trend_state[sensor_id] += random.uniform(0.5, 1.5)
                value = config["normal_mean"] + self.trend_state[sensor_id]
            else:
                value = config["normal_mean"]
        else:
            value = np.random.normal(config["normal_mean"], config["normal_std"])
            if sensor_id in self.trend_state:
                self.trend_state[sensor_id] *= 0.9

        # Clamp to physical limits
        value = max(config["min"] - 5, min(config["max"] + 10, value))

        return {
            "sensor_id": sensor_id,
            "value": round(float(value), 2),
            "unit": config["unit"],
            "timestamp": datetime.utcnow().isoformat(),
            "is_anomaly": is_anomaly,
            "min_threshold": config["min"],
            "max_threshold": config["max"],
        }

    def generate_machine_sensor_data(self, machine_name: str) -> list:
        """Generate all sensor readings for a specific machine."""
        config = self.machine_configs[machine_name]
        readings = []
        now = datetime.utcnow().isoformat()

        for param_name, (min_val, max_val, mean_val, std_val) in config.items():
            is_anomaly = random.random() < self.anomaly_probability
            sensor_key = f"{machine_name}_{param_name}"

            if is_anomaly:
                anomaly_type = random.choice(["spike", "drift"])
                if anomaly_type == "spike":
                    direction = random.choice([1, -1])
                    value = mean_val + direction * std_val * random.uniform(3, 5)
                else:
                    if sensor_key not in self.trend_state:
                        self.trend_state[sensor_key] = 0
                    self.trend_state[sensor_key] += random.uniform(0.3, 1.0) * (1 if random.random() > 0.5 else -1)
                    value = mean_val + self.trend_state[sensor_key]
            else:
                value = np.random.normal(mean_val, std_val)
                if sensor_key in self.trend_state:
                    self.trend_state[sensor_key] *= 0.9

            # Clamp within realistic bounds
            value = max(min_val * 0.8, min(max_val * 1.2, value))

            unit = self.units.get(param_name, "")

            readings.append({
                "sensor_id": sensor_key,
                "machine": machine_name,
                "parameter": param_name,
                "value": round(float(value), 2),
                "unit": unit,
                "timestamp": now,
                "is_anomaly": is_anomaly,
                "min_threshold": min_val,
                "max_threshold": max_val,
            })

        return readings

    def generate_machine_status(self) -> list:
        """Generate machine status updates for all machines."""
        statuses = []
        for machine_name, state in self.machines.items():
            # Small chance of status change
            if random.random() < 0.02:
                new_status = random.choice(["running", "running", "idle", "warning", "fault"])
                state["status"] = new_status
                if new_status in ("running", "idle"):
                    state["load"] = round(random.uniform(30, 90), 1) if new_status == "running" else 0

            if state["status"] == "running":
                state["uptime_hours"] = round(state["uptime_hours"] + 0.0006, 2)  # ~2sec increment
                state["load"] = round(max(10, min(100, state["load"] + random.uniform(-2, 2))), 1)

            statuses.append({
                "machine_id": machine_name,
                "status": state["status"],
                "uptime_hours": state["uptime_hours"],
                "load": state["load"] if state["status"] == "running" else 0,
                "timestamp": datetime.utcnow().isoformat(),
            })
        return statuses

    def generate_batch(self) -> dict:
        """Generate a full batch of all sensor readings + machine status."""
        # Legacy sensor readings
        readings = []
        for sensor_id in self.sensors:
            readings.append(self.generate_reading(sensor_id))

        # Per-machine sensor readings
        machine_sensor_data = []
        for machine_name in self.machine_configs:
            machine_sensor_data.extend(self.generate_machine_sensor_data(machine_name))

        machines = self.generate_machine_status()

        return {
            "timestamp": datetime.utcnow().isoformat(),
            "sensor_readings": readings,
            "machine_sensor_data": machine_sensor_data,
            "machine_status": machines,
        }


async def run_simulator_with_api(interval: float = None):
    """Run the simulator and POST data to the backend API."""
    if not HAS_HTTPX:
        print("❌ httpx not installed. Install with: pip install httpx")
        print("   Falling back to console output mode.")
        await run_simulator_console(interval)
        return

    interval = interval or SIMULATOR_INTERVAL
    simulator = SensorSimulator()
    api_url = f"{BACKEND_URL}/api/sensors"

    print(f"🏭 Data Simulator started")
    print(f"   → Posting to: {api_url}")
    print(f"   → Interval: {interval}s")
    print(f"   → Anomaly rate: {simulator.anomaly_probability * 100}%")
    print()

    async with httpx.AsyncClient(timeout=10.0) as client:
        cycle = 0
        while True:
            try:
                batch = simulator.generate_batch()
                payload = {
                    "sensor_readings": batch["sensor_readings"],
                    "machine_status": batch["machine_status"],
                }

                response = await client.post(api_url, json=payload)

                if response.status_code == 200:
                    result = response.json()
                    cycle += 1
                    alerts_count = result.get("alerts_generated", 0)
                    status_icon = "🚨" if alerts_count > 0 else "✅"
                    print(f"  [{cycle:04d}] {status_icon} Sent {result['readings_count']} readings | Alerts: {alerts_count}")
                else:
                    print(f"  [WARN] API returned {response.status_code}: {response.text[:100]}")

            except httpx.ConnectError:
                print(f"  [ERROR] Cannot connect to backend at {BACKEND_URL}")
                print(f"          Make sure the backend is running: uvicorn app.main:app --port 8000")
            except Exception as e:
                print(f"  [ERROR] {type(e).__name__}: {e}")

            await asyncio.sleep(interval)


async def run_simulator_console(interval: float = None):
    """Run the simulator with console output only (no API)."""
    interval = interval or SIMULATOR_INTERVAL
    simulator = SensorSimulator()
    print("🏭 Data Simulator started (console mode - no API connection)")

    while True:
        batch = simulator.generate_batch()
        anomalies = [r for r in batch["sensor_readings"] if r["is_anomaly"]]
        print(f"  Generated {len(batch['sensor_readings'])} readings | Anomalies: {len(anomalies)}")
        if anomalies:
            for a in anomalies:
                print(f"    ⚠️  {a['sensor_id']}: {a['value']} {a['unit']}")
        await asyncio.sleep(interval)


if __name__ == "__main__":
    print("=" * 60)
    print("  NextGen-HMI Data Simulator")
    print("=" * 60)
    asyncio.run(run_simulator_with_api())
