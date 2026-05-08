"""
FastAPI Main Application - NextGen HMI Backend
Full CRUD APIs, WebSocket real-time streaming, AI alert processing.
"""

import asyncio
import json
import sys
import os
from datetime import datetime
from typing import Optional, List

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from app.config import CORS_ORIGINS, SIMULATOR_INTERVAL
from app.database import connect_db, close_db, get_db

# Import from hyphenated directories using importlib
import importlib.util

def _import_module(module_name, file_path):
    spec = importlib.util.spec_from_file_location(module_name, file_path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod

_project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
_simulator_mod = _import_module("simulator", os.path.join(_project_root, "data-simulator", "simulator.py"))
_alert_mod = _import_module("alert_engine", os.path.join(_project_root, "ai-engine", "alert_engine.py"))

SensorSimulator = _simulator_mod.SensorSimulator
AlertEngine = _alert_mod.AlertEngine

# Import predictive engine
_pred_mod = _import_module("predictive_engine", os.path.join(_project_root, "ai-engine", "predictive_engine.py"))
PredictiveEngine = _pred_mod.PredictiveEngine
AlertGrouper = _pred_mod.AlertGrouper

app = FastAPI(title="NextGen-HMI API", version="1.0.0", description="AI-Powered Context-Aware Industrial Control Interface")

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Pydantic Models ──────────────────────────────────────────────────────────

class SensorReading(BaseModel):
    sensor_id: str
    value: float
    unit: str
    timestamp: Optional[str] = None
    is_anomaly: Optional[bool] = False
    min_threshold: Optional[float] = None
    max_threshold: Optional[float] = None

class SensorBatch(BaseModel):
    sensor_readings: List[SensorReading]
    machine_status: Optional[List[dict]] = []

class AlertCreate(BaseModel):
    sensor_id: str
    value: float
    unit: Optional[str] = ""
    category: str
    severity_score: float
    message: str
    timestamp: Optional[str] = None

class UIConfigUpdate(BaseModel):
    dashboard_type: str
    title: str
    layout: str
    components: List[dict]

class DashboardLayoutSave(BaseModel):
    user_role: str
    layout: List[dict]

# ─── Global Instances ─────────────────────────────────────────────────────────

simulator = SensorSimulator()
alert_engine = AlertEngine()

# Build predictive thresholds from machine configs so predictions work for per-machine sensors
_pred_thresholds = dict(alert_engine.thresholds)  # start with legacy thresholds
for _machine, _params in simulator.machine_configs.items():
    for _param, (_min, _max, _mean, _std) in _params.items():
        _sensor_id = f"{_machine}_{_param}"
        _pred_thresholds[_sensor_id] = {
            "warning_high": round(_mean + 2 * _std, 2),
            "critical_high": round(_mean + 3 * _std, 2),
            "warning_low": round(_mean - 2 * _std, 2),
            "critical_low": round(_mean - 3 * _std, 2),
        }

predictive_engine = PredictiveEngine(_pred_thresholds)
alert_grouper = AlertGrouper()
event_timeline = []  # In-memory event log (also persisted to DB)
connected_clients: list[WebSocket] = []

# In-memory history buffer (fallback when MongoDB is unavailable)
# Structure: { "MachineName": { "parameter": [{"value": ..., "timestamp": ..., "is_anomaly": ...}, ...] } }
from collections import defaultdict, deque
machine_history_buffer = defaultdict(lambda: defaultdict(lambda: deque(maxlen=120)))


@app.on_event("startup")
async def startup():
    await connect_db()
    # Start background data simulation
    asyncio.create_task(simulation_loop())


@app.on_event("shutdown")
async def shutdown():
    await close_db()


async def broadcast_to_clients(message: dict):
    """Broadcast a message to all connected WebSocket clients."""
    if not connected_clients:
        return
    text = json.dumps(message, default=str)
    disconnected = []
    for client in connected_clients:
        try:
            await client.send_text(text)
        except Exception:
            disconnected.append(client)
    for client in disconnected:
        connected_clients.remove(client)


_last_prediction_time = 0  # track when predictions were last run
PREDICTION_INTERVAL = 60  # run predictions every 60 seconds

async def simulation_loop():
    """Background task that generates data and broadcasts via WebSocket."""
    global _last_prediction_time
    import time as _time
    while True:
        try:
            batch = simulator.generate_batch()
            alerts = []
            predictions = []

            now = _time.time()
            run_predictions = (now - _last_prediction_time) >= PREDICTION_INTERVAL

            # Process each reading through alert engine + predictive engine
            for reading in batch["sensor_readings"]:
                alert = alert_engine.process_reading(reading)
                if alert:
                    alerts.append(alert)
                    alert_grouper.add_alert(alert)

                # Update predictive engine (always update data, predict only every minute)
                predictive_engine.update(reading["sensor_id"], reading["value"], reading["timestamp"])
                if run_predictions:
                    prediction = predictive_engine.predict(reading["sensor_id"])
                    if prediction:
                        predictions.append(prediction)

            # Process per-machine sensor data through predictive engine
            machine_sensor_data = batch.get("machine_sensor_data", [])
            for reading in machine_sensor_data:
                predictive_engine.update(reading["sensor_id"], reading["value"], reading["timestamp"])
                if run_predictions:
                    prediction = predictive_engine.predict(reading["sensor_id"])
                    if prediction:
                        predictions.append(prediction)

            if run_predictions:
                _last_prediction_time = now

            # Store in in-memory history buffer (always available, even without DB)
            for reading in machine_sensor_data:
                machine_history_buffer[reading["machine"]][reading["parameter"]].append({
                    "machine": reading["machine"],
                    "parameter": reading["parameter"],
                    "value": reading["value"],
                    "unit": reading["unit"],
                    "timestamp": reading["timestamp"],
                    "is_anomaly": reading.get("is_anomaly", False),
                })

            # Process machine status
            for status in batch["machine_status"]:
                alert = alert_engine.process_machine_status(status)
                if alert:
                    alerts.append(alert)
                    alert_grouper.add_alert(alert)

            # Build event timeline entries
            for alert in alerts:
                event = {
                    "type": "alert",
                    "id": alert["id"],
                    "category": alert["category"],
                    "message": alert["message"],
                    "sensor_id": alert["sensor_id"],
                    "timestamp": alert["timestamp"],
                }
                event_timeline.append(event)
                if len(event_timeline) > 200:
                    event_timeline.pop(0)

            for pred in predictions:
                event = {
                    "type": "prediction",
                    "id": pred["id"],
                    "category": pred["category"],
                    "message": pred["message"],
                    "sensor_id": pred["sensor_id"],
                    "timestamp": pred["timestamp"],
                }
                event_timeline.append(event)
                if len(event_timeline) > 200:
                    event_timeline.pop(0)

            # Store in database
            db = get_db()
            if db is not None:
                await db.sensors.insert_one({
                    "timestamp": batch["timestamp"],
                    "readings": batch["sensor_readings"],
                    "machine_sensor_data": machine_sensor_data,
                    "machine_status": batch["machine_status"],
                })
                # Store each machine's sensor data individually for history queries
                if machine_sensor_data:
                    await db.machine_readings.insert_many([
                        {
                            "machine": r["machine"],
                            "parameter": r["parameter"],
                            "value": r["value"],
                            "unit": r["unit"],
                            "timestamp": r["timestamp"],
                            "is_anomaly": r.get("is_anomaly", False),
                        }
                        for r in machine_sensor_data
                    ])
                if alerts:
                    await db.alerts.insert_many([dict(a) for a in alerts])
                if predictions:
                    await db.alerts.insert_many([dict(p) for p in predictions])

            # Broadcast to connected WebSocket clients
            await broadcast_to_clients({
                "type": "data_update",
                "sensor_readings": batch["sensor_readings"],
                "machine_sensor_data": machine_sensor_data,
                "machine_status": batch["machine_status"],
                "alerts": alerts,
                "predictions": predictions,
                "alert_groups": alert_grouper.get_groups(),
                "alert_summary": alert_engine.get_summary(),
                "timestamp": batch["timestamp"],
            })

        except Exception as e:
            print(f"[ERROR] Simulation loop: {e}")

        await asyncio.sleep(SIMULATOR_INTERVAL)


# ─── WebSocket Endpoints ──────────────────────────────────────────────────────

@app.websocket("/ws/live-data")
async def websocket_live_data(websocket: WebSocket):
    """Primary WebSocket endpoint for live data streaming."""
    await websocket.accept()
    connected_clients.append(websocket)
    print(f"🔗 Client connected to /ws/live-data. Total: {len(connected_clients)}")
    try:
        while True:
            data = await websocket.receive_text()
            msg = json.loads(data)
            if msg.get("action") == "acknowledge":
                alert_id = msg.get("alert_id")
                alert_engine.acknowledge_alert(alert_id)
                # Update alert in DB
                db = get_db()
                if db:
                    await db.alerts.update_one(
                        {"id": alert_id},
                        {"$set": {"acknowledged": True}}
                    )
    except WebSocketDisconnect:
        connected_clients.remove(websocket)
        print(f"🔌 Client disconnected. Total: {len(connected_clients)}")
    except Exception as e:
        if websocket in connected_clients:
            connected_clients.remove(websocket)
        print(f"[ERROR] WebSocket error: {e}")


# Keep legacy /ws endpoint for backward compat
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """Legacy WebSocket endpoint (redirects to same logic)."""
    await websocket_live_data(websocket)


# ─── SENSOR CRUD APIs ─────────────────────────────────────────────────────────

@app.get("/api/sensors")
async def get_sensors(limit: int = Query(20, ge=1, le=200)):
    """GET /sensors - Fetch recent sensor data batches from MongoDB."""
    db = get_db()
    if db is None:
        return {"sensors": [], "count": 0}

    cursor = db.sensors.find(sort=[("timestamp", -1)]).limit(limit)
    results = []
    async for doc in cursor:
        doc["_id"] = str(doc["_id"])
        results.append(doc)
    return {"sensors": list(reversed(results)), "count": len(results)}


@app.get("/api/sensors/latest")
async def get_latest_sensors():
    """Get the most recent sensor readings."""
    db = get_db()
    if db is None:
        return {"readings": [], "machine_status": [], "timestamp": None}

    latest = await db.sensors.find_one(sort=[("timestamp", -1)])
    if latest:
        latest["_id"] = str(latest["_id"])
        return latest
    return {"readings": [], "machine_status": [], "timestamp": None}


@app.post("/api/sensors")
async def post_sensors(batch: SensorBatch):
    """POST /sensors - Insert sensor data batch into MongoDB and process alerts."""
    db = get_db()
    if db is None:
        raise HTTPException(status_code=503, detail="Database not connected")

    timestamp = datetime.utcnow().isoformat()
    readings_dicts = [r.dict() for r in batch.sensor_readings]

    # Set timestamp on readings that don't have one
    for r in readings_dicts:
        if not r.get("timestamp"):
            r["timestamp"] = timestamp

    # Store in DB
    doc = {
        "timestamp": timestamp,
        "readings": readings_dicts,
        "machine_status": batch.machine_status or [],
    }
    await db.sensors.insert_one(doc)

    # Process through AI alert engine
    alerts = []
    for reading in readings_dicts:
        alert = alert_engine.process_reading(reading)
        if alert:
            alerts.append(alert)

    for status in (batch.machine_status or []):
        alert = alert_engine.process_machine_status(status)
        if alert:
            alerts.append(alert)

    # Store alerts
    if alerts:
        await db.alerts.insert_many([dict(a) for a in alerts])

    # Broadcast via WebSocket
    await broadcast_to_clients({
        "type": "data_update",
        "sensor_readings": readings_dicts,
        "machine_status": batch.machine_status or [],
        "alerts": alerts,
        "alert_summary": alert_engine.get_summary(),
        "timestamp": timestamp,
    })

    return {
        "status": "ok",
        "timestamp": timestamp,
        "readings_count": len(readings_dicts),
        "alerts_generated": len(alerts),
        "alerts": alerts,
    }


@app.get("/api/sensors/history")
async def get_sensor_history(sensor_id: str = Query(...), limit: int = Query(50, ge=1, le=500)):
    """Get historical data for a specific sensor."""
    db = get_db()
    if db is None:
        raise HTTPException(status_code=503, detail="Database not connected")

    cursor = db.sensors.find(
        {"readings.sensor_id": sensor_id},
        sort=[("timestamp", -1)],
    ).limit(limit)

    results = []
    async for doc in cursor:
        for reading in doc.get("readings", []):
            if reading["sensor_id"] == sensor_id:
                results.append({
                    "value": reading["value"],
                    "unit": reading.get("unit", ""),
                    "timestamp": doc["timestamp"],
                    "is_anomaly": reading.get("is_anomaly", False),
                })
                break

    return {"sensor_id": sensor_id, "data": list(reversed(results)), "count": len(results)}


# ─── ALERT CRUD APIs ──────────────────────────────────────────────────────────

@app.get("/api/alerts")
async def get_alerts(category: Optional[str] = None, limit: int = Query(50, ge=1, le=200)):
    """GET /alerts - Fetch alerts from MongoDB, sorted by severity."""
    db = get_db()
    if db is None:
        # Return in-memory alerts when DB is unavailable
        alerts = alert_engine.get_active_alerts(category)
        return {"alerts": alerts[:limit], "summary": alert_engine.get_summary(), "count": len(alerts)}

    query = {}
    if category:
        query["category"] = category

    cursor = db.alerts.find(query, sort=[("severity_score", -1), ("timestamp", -1)]).limit(limit)
    alerts = []
    async for doc in cursor:
        doc["_id"] = str(doc["_id"])
        alerts.append(doc)

    return {"alerts": alerts, "summary": alert_engine.get_summary(), "count": len(alerts)}


@app.post("/api/alerts")
async def post_alert(alert: AlertCreate):
    """POST /alerts - Manually create an alert and store in MongoDB."""
    db = get_db()
    if db is None:
        raise HTTPException(status_code=503, detail="Database not connected")

    alert_doc = alert.dict()
    alert_doc["id"] = f"ALR-{datetime.utcnow().strftime('%H%M%S%f')}-{alert.sensor_id}"
    alert_doc["timestamp"] = alert.timestamp or datetime.utcnow().isoformat()
    alert_doc["acknowledged"] = False
    alert_doc["detections"] = [{"type": "manual"}]

    await db.alerts.insert_one(alert_doc)

    # Broadcast new alert
    await broadcast_to_clients({
        "type": "new_alert",
        "alert": alert_doc,
        "alert_summary": alert_engine.get_summary(),
    })

    return {"status": "ok", "alert": {k: v for k, v in alert_doc.items() if k != "_id"}}


@app.post("/api/alerts/{alert_id}/acknowledge")
async def acknowledge_alert(alert_id: str):
    """Acknowledge an alert in both memory and database."""
    db = get_db()
    success = alert_engine.acknowledge_alert(alert_id)

    if db:
        result = await db.alerts.update_one(
            {"id": alert_id},
            {"$set": {"acknowledged": True}}
        )
        if result.modified_count > 0:
            success = True

    if not success:
        raise HTTPException(status_code=404, detail="Alert not found")

    return {"status": "ok", "alert_id": alert_id, "acknowledged": True}


# ─── UI CONFIG CRUD APIs ──────────────────────────────────────────────────────

@app.get("/api/ui-config")
async def get_all_ui_configs():
    """GET /ui-config - Get all UI configurations."""
    db = get_db()
    if db is None:
        raise HTTPException(status_code=503, detail="Database not connected")

    cursor = db.ui_configs.find()
    configs = []
    async for doc in cursor:
        doc["_id"] = str(doc["_id"])
        configs.append(doc)
    return {"configs": configs}


@app.get("/api/ui-config/{dashboard_type}")
async def get_ui_config(dashboard_type: str):
    """Get UI configuration for a specific dashboard type."""
    db = get_db()
    if db is None:
        # Return default config from database module when DB unavailable
        from app.database import get_default_ui_configs
        defaults = get_default_ui_configs()
        for cfg in defaults:
            if cfg["dashboard_type"] == dashboard_type:
                return cfg
        return {"dashboard_type": dashboard_type, "components": []}

    config = await db.ui_configs.find_one({"dashboard_type": dashboard_type})
    if config:
        config["_id"] = str(config["_id"])
        return config
    raise HTTPException(status_code=404, detail=f"UI config for '{dashboard_type}' not found")


@app.post("/api/ui-config")
async def save_ui_config(config: UIConfigUpdate):
    """POST /ui-config - Create or update a UI configuration."""
    db = get_db()
    if db is None:
        raise HTTPException(status_code=503, detail="Database not connected")

    result = await db.ui_configs.update_one(
        {"dashboard_type": config.dashboard_type},
        {"$set": config.dict()},
        upsert=True
    )

    return {
        "status": "ok",
        "dashboard_type": config.dashboard_type,
        "upserted": result.upserted_id is not None,
    }


# ─── USER/ROLE APIs ──────────────────────────────────────────────────────────

@app.get("/api/roles")
async def get_roles():
    """Get available user roles."""
    db = get_db()
    if db is None:
        from app.database import get_default_roles
        return {"roles": get_default_roles()}

    cursor = db.users.find()
    roles = []
    async for role in cursor:
        role["_id"] = str(role["_id"])
        roles.append(role)
    return {"roles": roles}


# ─── HEALTH CHECK ─────────────────────────────────────────────────────────────

@app.get("/api/health")
async def health_check():
    """Health check endpoint."""
    db = get_db()
    db_status = "connected" if db is not None else "disconnected"

    return {
        "status": "healthy",
        "database": db_status,
        "timestamp": datetime.utcnow().isoformat(),
        "connected_clients": len(connected_clients),
        "alert_summary": alert_engine.get_summary(),
    }


# ─── MACHINES LIST API ───────────────────────────────────────────────────────

@app.get("/api/machines")
async def get_machines():
    """Get all machine names and their current status."""
    statuses = simulator.generate_machine_status()
    return {"machines": statuses, "count": len(statuses)}


@app.get("/api/machines/{machine_name}/sensors")
async def get_machine_sensors(machine_name: str):
    """Get latest sensor data for a specific machine."""
    if machine_name not in simulator.machine_configs:
        raise HTTPException(status_code=404, detail=f"Machine '{machine_name}' not found")
    readings = simulator.generate_machine_sensor_data(machine_name)
    return {"machine": machine_name, "sensors": readings, "count": len(readings)}


@app.get("/api/machines/all/sensors")
async def get_all_machine_sensors():
    """Get latest sensor data for ALL machines."""
    all_data = []
    for machine_name in simulator.machine_configs:
        all_data.extend(simulator.generate_machine_sensor_data(machine_name))
    return {"sensors": all_data, "count": len(all_data), "machines": list(simulator.machine_configs.keys())}


@app.get("/api/machines/{machine_name}/history")
async def get_machine_history(machine_name: str, parameter: str = Query(None), limit: int = Query(100, ge=1, le=500)):
    """Get historical sensor readings for a machine from DB or in-memory buffer."""
    if machine_name not in simulator.machine_configs:
        raise HTTPException(status_code=404, detail=f"Machine '{machine_name}' not found")

    # Try MongoDB first
    db = get_db()
    if db is not None:
        query = {"machine": machine_name}
        if parameter:
            query["parameter"] = parameter

        cursor = db.machine_readings.find(query).sort("timestamp", -1).limit(limit)
        docs = await cursor.to_list(length=limit)

        if docs:
            docs.reverse()
            for d in docs:
                d["_id"] = str(d["_id"])
            return {"machine": machine_name, "parameter": parameter, "history": docs, "count": len(docs)}

    # Fallback: use in-memory buffer
    if parameter and machine_name in machine_history_buffer:
        history = list(machine_history_buffer[machine_name].get(parameter, []))
        history = history[-limit:]
        return {"machine": machine_name, "parameter": parameter, "history": history, "count": len(history)}
    elif machine_name in machine_history_buffer:
        # Return all parameters interleaved
        all_readings = []
        for param_data in machine_history_buffer[machine_name].values():
            all_readings.extend(list(param_data))
        all_readings.sort(key=lambda x: x["timestamp"])
        all_readings = all_readings[-limit:]
        return {"machine": machine_name, "parameter": parameter, "history": all_readings, "count": len(all_readings)}

    return {"machine": machine_name, "parameter": parameter, "history": [], "count": 0}


# ─── PREDICTIVE ALERTS API ───────────────────────────────────────────────────

@app.get("/api/predictions")
async def get_predictions():
    """Get active predictive alerts."""
    predictions = predictive_engine.get_active_predictions()
    return {"predictions": predictions, "count": len(predictions)}


# ─── ALERT GROUPS API ────────────────────────────────────────────────────────

@app.get("/api/alert-groups")
async def get_alert_groups():
    """Get grouped alerts."""
    groups = alert_grouper.get_all_groups()
    return {"groups": groups, "count": len(groups)}


# ─── EVENT TIMELINE API ──────────────────────────────────────────────────────

@app.get("/api/timeline")
async def get_timeline(limit: int = Query(50, ge=1, le=200)):
    """Get event timeline (alerts + predictions chronologically)."""
    recent = event_timeline[-limit:]
    return {"events": list(reversed(recent)), "count": len(recent)}


# ─── DASHBOARD LAYOUT SAVE/LOAD ──────────────────────────────────────────────

@app.post("/api/dashboard-layout")
async def save_dashboard_layout(layout_data: DashboardLayoutSave):
    """Save user's custom dashboard layout."""
    db = get_db()
    if db is None:
        return {"status": "ok", "note": "Layout accepted (DB unavailable, not persisted)"}

    await db.dashboard_layouts.update_one(
        {"user_role": layout_data.user_role},
        {"$set": {"user_role": layout_data.user_role, "layout": layout_data.layout, "updated_at": datetime.utcnow().isoformat()}},
        upsert=True
    )
    return {"status": "ok", "user_role": layout_data.user_role}


@app.get("/api/dashboard-layout/{user_role}")
async def get_dashboard_layout(user_role: str):
    """Load user's custom dashboard layout."""
    db = get_db()
    if db is None:
        return {"user_role": user_role, "layout": None}

    doc = await db.dashboard_layouts.find_one({"user_role": user_role})
    if doc:
        doc["_id"] = str(doc["_id"])
        return doc
    return {"user_role": user_role, "layout": None}


# ─── ALERT EXPLANATION API ────────────────────────────────────────────────────

@app.get("/api/alerts/{alert_id}/explanation")
async def get_alert_explanation(alert_id: str):
    """Get detailed explanation for a specific alert."""
    # Check in-memory first
    alert = alert_engine.active_alerts.get(alert_id)
    if not alert:
        db = get_db()
        if db:
            alert = await db.alerts.find_one({"id": alert_id})
            if alert:
                alert["_id"] = str(alert["_id"])

    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    sensor_id = alert.get("sensor_id", "")
    thresholds = alert_engine.thresholds.get(sensor_id, {})
    history = list(alert_engine.history.get(sensor_id, []))[-20:]

    explanation = {
        "alert_id": alert_id,
        "sensor_id": sensor_id,
        "current_value": alert.get("value"),
        "unit": alert.get("unit", ""),
        "category": alert.get("category"),
        "severity_score": alert.get("severity_score"),
        "thresholds": thresholds,
        "detections": alert.get("detections", []),
        "recent_history": [round(v, 2) if isinstance(v, float) else v for v in history],
        "suggested_actions": _get_suggested_actions(alert),
        "root_cause": _get_root_cause(alert),
    }
    return explanation


def _get_suggested_actions(alert: dict) -> list:
    """Generate suggested actions based on alert type."""
    category = alert.get("category", "normal")
    sensor_id = alert.get("sensor_id", "")
    sensor_type = sensor_id.rsplit("_", 1)[0] if "_" in sensor_id else sensor_id

    actions = []
    if category == "critical":
        actions.append("🚨 Immediately inspect the equipment")
        actions.append("📞 Notify maintenance team")
        if "temperature" in sensor_type:
            actions.append("🌡️ Check cooling system operation")
            actions.append("🔧 Verify thermal paste/contact")
        elif "pressure" in sensor_type:
            actions.append("🔒 Check for leaks in pressure lines")
            actions.append("⚙️ Verify relief valve operation")
        elif "vibration" in sensor_type:
            actions.append("🔩 Check mounting bolts and alignment")
            actions.append("⚡ Inspect bearings for wear")
    elif category == "warning":
        actions.append("👁️ Monitor closely for next 15 minutes")
        actions.append("📋 Log event for maintenance review")
        if "temperature" in sensor_type:
            actions.append("🌡️ Verify ambient temperature conditions")
        elif "pressure" in sensor_type:
            actions.append("📊 Check upstream flow conditions")
    else:
        actions.append("ℹ️ No immediate action required")
        actions.append("📋 Review during next scheduled maintenance")

    return actions


def _get_root_cause(alert: dict) -> str:
    """Determine probable root cause."""
    detections = alert.get("detections", [])
    det_types = [d.get("type") for d in detections]

    if "threshold" in det_types:
        return "Sensor value exceeded configured operational threshold"
    elif "statistical" in det_types:
        return "Unusual deviation from normal operating pattern detected"
    elif "rate_of_change" in det_types:
        return "Rapid change in sensor value indicating potential equipment issue"
    elif "machine_status" in det_types:
        return "Machine status change reported by control system"
    return "Multiple anomaly indicators triggered simultaneously"
