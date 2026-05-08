"""
AI Alert Engine - Intelligent alert prioritization and anomaly detection.
Uses threshold detection, statistical deviation, and scoring system.
"""

import numpy as np
from datetime import datetime, timedelta
from typing import Optional
from collections import defaultdict


class AlertEngine:
    """AI-powered alert engine with anomaly detection and prioritization."""

    def __init__(self):
        # Historical data buffer for statistical analysis
        self.history = defaultdict(list)
        self.history_max_size = 100

        # Alert grouping state
        self.active_alerts = {}
        self.alert_counts = defaultdict(int)
        self.suppressed_until = {}

        # Thresholds for alert categorization
        self.thresholds = {
            "temperature_1": {"warning_high": 80, "critical_high": 90, "warning_low": 55, "critical_low": 50},
            "temperature_2": {"warning_high": 60, "critical_high": 70, "warning_low": 35, "critical_low": 30},
            "pressure_1": {"warning_high": 5.5, "critical_high": 6.5, "warning_low": 2.5, "critical_low": 2.0},
            "pressure_2": {"warning_high": 3.5, "critical_high": 4.5, "warning_low": 1.2, "critical_low": 0.8},
            "vibration_1": {"warning_high": 5.0, "critical_high": 7.5, "warning_low": None, "critical_low": None},
            "flow_rate_1": {"warning_high": 180, "critical_high": 200, "warning_low": 70, "critical_low": 50},
        }

    def _update_history(self, sensor_id: str, value: float):
        """Maintain rolling history for each sensor."""
        self.history[sensor_id].append(value)
        if len(self.history[sensor_id]) > self.history_max_size:
            self.history[sensor_id].pop(0)

    def _detect_statistical_anomaly(self, sensor_id: str, value: float) -> Optional[dict]:
        """Detect anomalies using Z-score method."""
        history = self.history[sensor_id]
        if len(history) < 10:
            return None

        mean = np.mean(history)
        std = np.std(history)
        if std == 0:
            return None

        z_score = abs(value - mean) / std

        if z_score > 3:
            return {"type": "statistical", "z_score": round(z_score, 2), "mean": round(mean, 2), "std": round(std, 2)}
        return None

    def _detect_threshold_breach(self, sensor_id: str, value: float) -> Optional[dict]:
        """Detect threshold-based anomalies."""
        if sensor_id not in self.thresholds:
            return None

        t = self.thresholds[sensor_id]

        if t["critical_high"] and value >= t["critical_high"]:
            return {"type": "threshold", "level": "critical", "direction": "high", "threshold": t["critical_high"]}
        elif t["warning_high"] and value >= t["warning_high"]:
            return {"type": "threshold", "level": "warning", "direction": "high", "threshold": t["warning_high"]}
        elif t["critical_low"] and value <= t["critical_low"]:
            return {"type": "threshold", "level": "critical", "direction": "low", "threshold": t["critical_low"]}
        elif t["warning_low"] and value <= t["warning_low"]:
            return {"type": "threshold", "level": "warning", "direction": "low", "threshold": t["warning_low"]}

        return None

    def _detect_rate_of_change(self, sensor_id: str, value: float) -> Optional[dict]:
        """Detect rapid changes in sensor values."""
        history = self.history[sensor_id]
        if len(history) < 5:
            return None

        recent = history[-5:]
        rate = abs(value - recent[0]) / 5

        avg_rate = np.mean([abs(recent[i] - recent[i - 1]) for i in range(1, len(recent))])

        if avg_rate > 0 and rate > avg_rate * 3:
            return {"type": "rate_of_change", "rate": round(rate, 3), "avg_rate": round(avg_rate, 3)}
        return None

    def _calculate_severity_score(self, detections: list, sensor_id: str) -> float:
        """Calculate a composite severity score (0-100)."""
        score = 0

        for detection in detections:
            if detection["type"] == "threshold":
                if detection["level"] == "critical":
                    score += 40
                else:
                    score += 20
            elif detection["type"] == "statistical":
                score += min(30, detection["z_score"] * 8)
            elif detection["type"] == "rate_of_change":
                score += 15

        # Frequency penalty - repeated alerts score higher
        frequency = self.alert_counts.get(sensor_id, 0)
        if frequency > 5:
            score += 10
        elif frequency > 10:
            score += 20

        return min(100, score)

    def _should_suppress(self, sensor_id: str) -> bool:
        """Check if alert should be suppressed (noise reduction)."""
        now = datetime.utcnow()
        if sensor_id in self.suppressed_until:
            if now < self.suppressed_until[sensor_id]:
                return True
        return False

    def _categorize_alert(self, score: float) -> str:
        """Categorize alert based on severity score."""
        if score >= 60:
            return "critical"
        elif score >= 30:
            return "warning"
        else:
            return "normal"

    def process_reading(self, reading: dict) -> Optional[dict]:
        """Process a sensor reading and return alert if warranted."""
        sensor_id = reading["sensor_id"]
        value = reading["value"]

        self._update_history(sensor_id, value)

        # Check for suppression
        if self._should_suppress(sensor_id):
            return None

        # Run detection algorithms
        detections = []

        threshold_result = self._detect_threshold_breach(sensor_id, value)
        if threshold_result:
            detections.append(threshold_result)

        statistical_result = self._detect_statistical_anomaly(sensor_id, value)
        if statistical_result:
            detections.append(statistical_result)

        rate_result = self._detect_rate_of_change(sensor_id, value)
        if rate_result:
            detections.append(rate_result)

        if not detections:
            return None

        # Calculate severity score
        score = self._calculate_severity_score(detections, sensor_id)
        category = self._categorize_alert(score)

        # Update alert counts
        self.alert_counts[sensor_id] += 1

        # Suppress low-priority repeated alerts
        if category == "normal" and self.alert_counts[sensor_id] > 3:
            self.suppressed_until[sensor_id] = datetime.utcnow() + timedelta(seconds=30)
            return None

        alert = {
            "id": f"ALR-{datetime.utcnow().strftime('%H%M%S')}-{sensor_id}",
            "sensor_id": sensor_id,
            "value": value,
            "unit": reading["unit"],
            "category": category,
            "severity_score": round(score, 1),
            "detections": detections,
            "message": self._generate_message(sensor_id, value, category, detections),
            "timestamp": datetime.utcnow().isoformat(),
            "acknowledged": False,
        }

        self.active_alerts[alert["id"]] = alert
        return alert

    def _generate_message(self, sensor_id: str, value: float, category: str, detections: list) -> str:
        """Generate human-readable alert message."""
        sensor_name = sensor_id.replace("_", " ").title()
        det_types = [d["type"] for d in detections]

        if "threshold" in det_types:
            direction = next(d["direction"] for d in detections if d["type"] == "threshold")
            return f"{sensor_name} is {'above' if direction == 'high' else 'below'} {category} threshold: {value}"
        elif "statistical" in det_types:
            z = next(d["z_score"] for d in detections if d["type"] == "statistical")
            return f"{sensor_name} anomaly detected (Z-score: {z}): {value}"
        else:
            return f"{sensor_name} showing unusual rate of change: {value}"

    def process_machine_status(self, status: dict) -> Optional[dict]:
        """Generate alerts for machine status changes."""
        machine_id = status["machine_id"]

        if status["status"] in ["fault", "warning"]:
            score = 80 if status["status"] == "fault" else 45
            category = "critical" if status["status"] == "fault" else "warning"
            machine_name = machine_id.replace('_', ' ')

            alert = {
                "id": f"ALR-{datetime.utcnow().strftime('%H%M%S')}-{machine_id}",
                "sensor_id": machine_id,
                "value": status["status"],
                "unit": "status",
                "category": category,
                "severity_score": score,
                "detections": [{"type": "machine_status", "status": status["status"]}],
                "message": f"[{machine_name}] entered {status['status']} state — immediate attention required" if category == "critical" else f"[{machine_name}] entered {status['status']} state — monitoring recommended",
                "timestamp": datetime.utcnow().isoformat(),
                "acknowledged": False,
            }

            self.active_alerts[alert["id"]] = alert
            return alert
        else:
            # Machine recovered — remove any existing alerts for this machine
            to_remove = [aid for aid, a in self.active_alerts.items() if a["sensor_id"] == machine_id and any(d.get("type") == "machine_status" for d in a.get("detections", []))]
            for aid in to_remove:
                del self.active_alerts[aid]
            return None

    def get_active_alerts(self, category: Optional[str] = None) -> list:
        """Get all active alerts, optionally filtered by category."""
        alerts = list(self.active_alerts.values())
        if category:
            alerts = [a for a in alerts if a["category"] == category]
        return sorted(alerts, key=lambda x: x["severity_score"], reverse=True)

    def acknowledge_alert(self, alert_id: str) -> bool:
        """Mark an alert as acknowledged."""
        if alert_id in self.active_alerts:
            self.active_alerts[alert_id]["acknowledged"] = True
            return True
        return False

    def get_summary(self) -> dict:
        """Get alert summary statistics."""
        alerts = list(self.active_alerts.values())
        return {
            "total": len(alerts),
            "critical": len([a for a in alerts if a["category"] == "critical"]),
            "warning": len([a for a in alerts if a["category"] == "warning"]),
            "normal": len([a for a in alerts if a["category"] == "normal"]),
            "unacknowledged": len([a for a in alerts if not a["acknowledged"]]),
        }
