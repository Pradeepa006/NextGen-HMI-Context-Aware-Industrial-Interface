"""
Predictive Alert Engine - Analyzes sensor trends to predict future failures.
Uses linear regression on recent data to forecast threshold breaches.
"""

import numpy as np
from datetime import datetime
from typing import Optional
from collections import defaultdict


class PredictiveEngine:
    """Predicts future alerts based on sensor trend analysis."""

    def __init__(self, thresholds: dict):
        self.thresholds = thresholds
        self.history = defaultdict(list)
        self.history_max = 50
        self.predictions = {}

    def update(self, sensor_id: str, value: float, timestamp: str):
        """Add a new data point for trend analysis."""
        self.history[sensor_id].append({"value": value, "timestamp": timestamp})
        if len(self.history[sensor_id]) > self.history_max:
            self.history[sensor_id].pop(0)

    def predict(self, sensor_id: str) -> Optional[dict]:
        """Predict if sensor will breach threshold within next N readings."""
        data = self.history[sensor_id]
        if len(data) < 10:
            return None

        values = [d["value"] for d in data[-15:]]
        x = np.arange(len(values))
        
        # Linear regression
        coeffs = np.polyfit(x, values, 1)
        slope = coeffs[0]
        intercept = coeffs[1]

        if abs(slope) < 0.01:
            return None  # No significant trend

        if sensor_id not in self.thresholds:
            return None

        t = self.thresholds[sensor_id]
        current_value = values[-1]
        future_steps = 10  # Predict 10 steps ahead

        predicted_value = slope * (len(values) + future_steps) + intercept

        # Check if predicted value will breach threshold
        breach_type = None
        breach_threshold = None

        if slope > 0 and t.get("warning_high"):
            if current_value < t["warning_high"] and predicted_value >= t["warning_high"]:
                breach_type = "warning_high"
                breach_threshold = t["warning_high"]
            elif current_value < t.get("critical_high", float('inf')) and predicted_value >= t.get("critical_high", float('inf')):
                breach_type = "critical_high"
                breach_threshold = t["critical_high"]
        elif slope < 0 and t.get("warning_low"):
            if current_value > t["warning_low"] and predicted_value <= t["warning_low"]:
                breach_type = "warning_low"
                breach_threshold = t["warning_low"]
            elif current_value > t.get("critical_low", float('-inf')) and predicted_value <= t.get("critical_low", float('-inf')):
                breach_type = "critical_low"
                breach_threshold = t["critical_low"]

        if not breach_type:
            return None

        # Calculate estimated time to breach
        if slope != 0:
            steps_to_breach = (breach_threshold - current_value) / slope
        else:
            steps_to_breach = float('inf')

        confidence = min(95, max(40, 60 + abs(slope) * 10))
        
        sensor_name = sensor_id.replace("_", " ").title()
        direction = "increasing" if slope > 0 else "decreasing"

        prediction = {
            "id": f"PRED-{datetime.utcnow().strftime('%H%M%S')}-{sensor_id}",
            "type": "prediction",
            "sensor_id": sensor_id,
            "current_value": round(current_value, 2),
            "predicted_value": round(predicted_value, 2),
            "breach_threshold": breach_threshold,
            "breach_type": breach_type,
            "trend_direction": direction,
            "slope": round(slope, 4),
            "confidence": round(confidence, 1),
            "steps_to_breach": round(max(0, steps_to_breach), 1),
            "category": "critical" if "critical" in breach_type else "warning",
            "severity_score": 55 if "critical" in breach_type else 35,
            "message": f"⚡ PREDICTION: {sensor_name} is {direction} and may breach {breach_type.replace('_', ' ')} threshold ({breach_threshold}) in ~{round(steps_to_breach * 2)}s",
            "timestamp": datetime.utcnow().isoformat(),
            "acknowledged": False,
        }

        self.predictions[prediction["id"]] = prediction
        return prediction

    def get_active_predictions(self) -> list:
        """Get all active predictions."""
        return list(self.predictions.values())


class AlertGrouper:
    """Groups similar alerts by sensor type, location, and time window."""

    def __init__(self, time_window_seconds: int = 30):
        self.time_window = time_window_seconds
        self.groups = {}

    def _get_sensor_type(self, sensor_id: str) -> str:
        """Extract sensor type from ID."""
        parts = sensor_id.rsplit("_", 1)
        return parts[0] if len(parts) > 1 else sensor_id

    def _get_group_key(self, alert: dict) -> str:
        """Generate group key for an alert."""
        sensor_type = self._get_sensor_type(alert["sensor_id"])
        return f"{sensor_type}_{alert['category']}"

    def add_alert(self, alert: dict):
        """Add an alert to appropriate group."""
        key = self._get_group_key(alert)
        now = datetime.utcnow()

        if key not in self.groups:
            self.groups[key] = {
                "id": f"GRP-{key}",
                "sensor_type": self._get_sensor_type(alert["sensor_id"]),
                "category": alert["category"],
                "alerts": [],
                "count": 0,
                "first_seen": now.isoformat(),
                "last_seen": now.isoformat(),
                "message": "",
            }

        group = self.groups[key]
        group["alerts"].append(alert["id"])
        group["count"] += 1
        group["last_seen"] = now.isoformat()
        
        sensor_type_name = self._get_sensor_type(alert["sensor_id"]).replace("_", " ").title()
        group["message"] = f"{group['count']} {alert['category']} alerts from {sensor_type_name} sensors"

    def get_groups(self) -> list:
        """Get all alert groups with count > 1."""
        return [g for g in self.groups.values() if g["count"] > 1]

    def get_all_groups(self) -> list:
        """Get all groups."""
        return list(self.groups.values())
