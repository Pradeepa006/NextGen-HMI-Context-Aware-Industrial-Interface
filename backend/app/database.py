"""
Database connection and initialization using SQLite (via aiosqlite).
Provides a MongoDB-compatible async interface so main.py needs no changes.
Collections: sensors, alerts, users, ui_configs, machine_readings, dashboard_layouts
"""

import aiosqlite
import json
import os

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "nextgen_hmi.db")

db = None
_conn = None


class SQLiteCollection:
    """Mimics Motor's async MongoDB collection interface using SQLite."""

    def __init__(self, conn, table_name):
        self._db = conn
        self._table = table_name

    async def insert_one(self, doc):
        data = json.dumps(doc, default=str)
        await self._db.execute(f"INSERT INTO {self._table} (data) VALUES (?)", (data,))
        await self._db.commit()
        return type('Result', (), {'inserted_id': None})()

    async def insert_many(self, docs):
        rows = [(json.dumps(d, default=str),) for d in docs]
        await self._db.executemany(f"INSERT INTO {self._table} (data) VALUES (?)", rows)
        await self._db.commit()
        return type('Result', (), {'inserted_ids': [None]*len(docs)})()

    async def find_one(self, query=None, sort=None):
        rows = await self._find_raw(query, sort, limit=1)
        return rows[0] if rows else None

    def find(self, query=None, sort=None):
        return SQLiteCursor(self, query, sort)

    async def count_documents(self, query=None):
        if not query:
            cursor = await self._db.execute(f"SELECT COUNT(*) FROM {self._table}")
            row = await cursor.fetchone()
            return row[0]
        rows = await self._find_raw(query)
        return len(rows)

    async def update_one(self, query, update, upsert=False):
        rows = await self._find_raw(query, limit=1, return_rowids=True)
        modified = 0
        upserted_id = None

        if rows:
            rowid, doc = rows[0]
            if "$set" in update:
                doc.update(update["$set"])
            data = json.dumps(doc, default=str)
            await self._db.execute(f"UPDATE {self._table} SET data = ? WHERE rowid = ?", (data, rowid))
            await self._db.commit()
            modified = 1
        elif upsert:
            new_doc = dict(query)
            if "$set" in update:
                new_doc.update(update["$set"])
            await self.insert_one(new_doc)
            upserted_id = True

        return type('Result', (), {'modified_count': modified, 'upserted_id': upserted_id})()

    async def create_index(self, keys):
        pass  # Not needed for SQLite at this scale

    async def _find_raw(self, query=None, sort=None, limit=None, return_rowids=False):
        order = "DESC" if sort and len(sort) > 0 and sort[0][1] == -1 else "ASC"
        sql = f"SELECT rowid, data FROM {self._table} ORDER BY rowid {order}"
        if limit and not query:
            sql += f" LIMIT {limit}"

        cursor = await self._db.execute(sql)
        all_rows = await cursor.fetchall()

        results = []
        for rowid, data_str in all_rows:
            try:
                doc = json.loads(data_str)
            except Exception:
                continue
            if query and not self._match(doc, query):
                continue
            results.append((rowid, doc) if return_rowids else doc)
            if limit and len(results) >= limit:
                break

        if sort and results:
            for key, direction in reversed(sort):
                reverse = direction == -1
                if return_rowids:
                    results.sort(key=lambda x: x[1].get(key, 0) if isinstance(x[1].get(key, 0), (int, float)) else str(x[1].get(key, "")), reverse=reverse)
                else:
                    results.sort(key=lambda x: x.get(key, 0) if isinstance(x.get(key, 0), (int, float)) else str(x.get(key, "")), reverse=reverse)

        return results

    @staticmethod
    def _match(doc, query):
        for key, value in query.items():
            if key.startswith("$"):
                continue
            parts = key.split(".")
            current = doc
            for part in parts:
                if isinstance(current, list):
                    found = any(isinstance(item, dict) and item.get(part) == value for item in current)
                    return found
                elif isinstance(current, dict):
                    current = current.get(part)
                else:
                    return False
            if current != value:
                return False
        return True


class SQLiteCursor:
    """Mimics Motor's async cursor with sort/limit chaining."""

    def __init__(self, collection, query=None, sort=None):
        self._collection = collection
        self._query = query
        self._sort = sort
        self._limit = None
        self._results = None

    def sort(self, key, direction=None):
        if isinstance(key, str):
            self._sort = [(key, direction or 1)]
        else:
            self._sort = key
        return self

    def limit(self, n):
        self._limit = n
        return self

    async def to_list(self, length=None):
        if self._results is None:
            self._results = await self._collection._find_raw(
                self._query, self._sort, self._limit or length
            )
        return self._results

    def __aiter__(self):
        self._iter_started = False
        return self

    async def __anext__(self):
        if not self._iter_started:
            self._iter_started = True
            self._results = await self._collection._find_raw(
                self._query, self._sort, self._limit
            )
            self._idx = 0
        if self._idx >= len(self._results):
            raise StopAsyncIteration
        doc = self._results[self._idx]
        self._idx += 1
        return doc


class SQLiteDB:
    """Mimics Motor's database object with collection access via attributes."""

    def __init__(self, conn):
        self._conn = conn
        self._collections = {}

    def __getattr__(self, name):
        if name.startswith("_"):
            return super().__getattribute__(name)
        if name not in self._collections:
            self._collections[name] = SQLiteCollection(self._conn, name)
        return self._collections[name]


async def connect_db():
    """Connect to SQLite database."""
    global _conn, db
    try:
        _conn = await aiosqlite.connect(DB_PATH)
        await _conn.execute("PRAGMA journal_mode=WAL")

        tables = ["sensors", "alerts", "users", "ui_configs", "machine_readings", "dashboard_layouts"]
        for table in tables:
            await _conn.execute(f"CREATE TABLE IF NOT EXISTS {table} (data TEXT)")
        await _conn.commit()

        db = SQLiteDB(_conn)
        await init_collections()
        print(f"✅ Connected to SQLite database: {DB_PATH}")
    except Exception as e:
        print(f"⚠️  SQLite connection failed: {e}")
        db = None


async def close_db():
    """Close SQLite connection."""
    global _conn, db
    if _conn:
        await _conn.close()
        print("🔌 SQLite connection closed")
    db = None


async def init_collections():
    """Initialize collections with default data if empty."""
    global db
    if db is None:
        return

    ui_count = await db.ui_configs.count_documents({})
    if ui_count == 0:
        await db.ui_configs.insert_many(get_default_ui_configs())
        print("📋 Initialized default UI configurations")

    # Initialize UI configurations
    ui_configs_count = await db.ui_configs.count_documents({})
    if ui_configs_count == 0:
        await db.ui_configs.insert_many(get_default_ui_configs())
        print("📋 Initialized default UI configurations")

    users_count = await db.users.count_documents({})
    if users_count == 0:
        await db.users.insert_many(get_default_roles())
        print("👤 Initialized default user roles")


def get_default_roles():
    """Default user roles."""
    return [
        {
            "role": "operator",
            "name": "Plant Operator",
            "permissions": ["view_alerts", "acknowledge_alerts", "view_dashboard"],
            "dashboard_type": "operator",
        },
        {
            "role": "engineer",
            "name": "Process Engineer",
            "permissions": ["view_alerts", "acknowledge_alerts", "view_dashboard", "view_raw_data", "configure_thresholds"],
            "dashboard_type": "engineer",
        },
        {
            "role": "manager",
            "name": "Plant Manager",
            "permissions": ["view_alerts", "view_dashboard", "view_reports"],
            "dashboard_type": "manager",
        },
    ]


def get_default_ui_configs():
    """Default UI configurations for dynamic dashboard generation."""
    return [
        {
            "dashboard_type": "operator",
            "title": "Operator Dashboard",
            "layout": "focused",
            "components": [
                {
                    "id": "alert-panel",
                    "type": "alert_panel",
                    "position": {"x": 0, "y": 0, "w": 12, "h": 4},
                    "config": {"show_only": ["critical", "warning"], "max_items": 5},
                },
                {
                    "id": "machine-status",
                    "type": "status_cards",
                    "position": {"x": 0, "y": 4, "w": 12, "h": 2},
                    "config": {"show_machines": True},
                },
                {
                    "id": "temp-chart",
                    "type": "line_chart",
                    "position": {"x": 0, "y": 6, "w": 6, "h": 4},
                    "config": {"sensors": ["temperature_1", "temperature_2"], "title": "Temperature"},
                },
                {
                    "id": "pressure-chart",
                    "type": "line_chart",
                    "position": {"x": 6, "y": 6, "w": 6, "h": 4},
                    "config": {"sensors": ["pressure_1", "pressure_2"], "title": "Pressure"},
                },
            ],
        },
        {
            "dashboard_type": "engineer",
            "title": "Engineer Dashboard",
            "layout": "detailed",
            "components": [
                {
                    "id": "alert-panel",
                    "type": "alert_panel",
                    "position": {"x": 0, "y": 0, "w": 8, "h": 4},
                    "config": {"show_only": ["critical", "warning", "normal"], "max_items": 10},
                },
                {
                    "id": "alert-summary",
                    "type": "summary_card",
                    "position": {"x": 8, "y": 0, "w": 4, "h": 4},
                    "config": {"show_statistics": True},
                },
                {
                    "id": "machine-status",
                    "type": "status_cards",
                    "position": {"x": 0, "y": 4, "w": 12, "h": 2},
                    "config": {"show_machines": True, "show_uptime": True},
                },
                {
                    "id": "temp-chart",
                    "type": "line_chart",
                    "position": {"x": 0, "y": 6, "w": 6, "h": 4},
                    "config": {"sensors": ["temperature_1", "temperature_2"], "title": "Temperature Sensors"},
                },
                {
                    "id": "pressure-chart",
                    "type": "line_chart",
                    "position": {"x": 6, "y": 6, "w": 6, "h": 4},
                    "config": {"sensors": ["pressure_1", "pressure_2"], "title": "Pressure Sensors"},
                },
                {
                    "id": "vibration-chart",
                    "type": "line_chart",
                    "position": {"x": 0, "y": 10, "w": 6, "h": 4},
                    "config": {"sensors": ["vibration_1"], "title": "Vibration"},
                },
                {
                    "id": "flow-chart",
                    "type": "line_chart",
                    "position": {"x": 6, "y": 10, "w": 6, "h": 4},
                    "config": {"sensors": ["flow_rate_1"], "title": "Flow Rate"},
                },
            ],
        },
    ]


def get_db():
    """Get database instance."""
    return db
