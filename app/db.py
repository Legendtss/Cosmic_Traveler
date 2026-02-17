import json
import os
import sqlite3

from flask import current_app, g

from .utils import now_iso, safe_int, today_str


def _db_file():
    return str(current_app.config["DB_FILE"])


def _schema_file():
    return str(current_app.config["SCHEMA_FILE"])


def _data_file():
    return str(current_app.config["DATA_FILE"])


def _default_user_id():
    return current_app.config["DEFAULT_USER_ID"]


def get_db():
    if "db" not in g:
        os.makedirs(os.path.dirname(_db_file()), exist_ok=True)
        conn = sqlite3.connect(_db_file())
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON")
        g.db = conn
    return g.db


def close_db(_error):
    conn = g.pop("db", None)
    if conn is not None:
        conn.close()


def register_db(app):
    app.teardown_appcontext(close_db)


def init_schema(conn):
    schema_file = _schema_file()
    if not os.path.exists(schema_file):
        raise FileNotFoundError(f"Missing schema file: {schema_file}")
    with open(schema_file, "r", encoding="utf-8") as f:
        conn.executescript(f.read())


def ensure_tasks_tags_column(conn):
    cols = conn.execute("PRAGMA table_info(tasks)").fetchall()
    names = {row["name"] for row in cols}
    if "tags_json" in names:
        return
    conn.execute("ALTER TABLE tasks ADD COLUMN tags_json TEXT NOT NULL DEFAULT '[]'")


def ensure_default_user(conn):
    conn.execute(
        """
        INSERT INTO users (id, email, display_name, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          email=excluded.email,
          display_name=excluded.display_name,
          updated_at=excluded.updated_at
        """,
        (_default_user_id(), "local@fittrack.app", "Local User", now_iso(), now_iso()),
    )


def should_migrate_json(conn):
    data_file = _data_file()
    if not os.path.exists(data_file):
        return False
    force = os.environ.get("FORCE_JSON_MIGRATION", "").strip().lower() in ("1", "true", "yes", "on")
    if force:
        return True
    counts = conn.execute(
        """
        SELECT
          (SELECT COUNT(*) FROM tasks) AS task_count,
          (SELECT COUNT(*) FROM nutrition_entries) AS meal_count,
          (SELECT COUNT(*) FROM workouts) AS workout_count
        """
    ).fetchone()
    return (counts["task_count"] or 0) == 0 and (counts["meal_count"] or 0) == 0 and (counts["workout_count"] or 0) == 0


def migrate_json_to_sqlite(conn):
    data_file = _data_file()
    if not os.path.exists(data_file):
        return

    with open(data_file, "r", encoding="utf-8") as f:
        payload = json.load(f)

    conn.execute("BEGIN")
    try:
        ensure_default_user(conn)

        for t in payload.get("tasks", []):
            if not isinstance(t, dict) or not t.get("id") or not t.get("title"):
                continue
            priority = t.get("priority", "medium")
            if priority not in ("low", "medium", "high"):
                priority = "medium"

            conn.execute(
                """
                INSERT INTO tasks
                (id, user_id, project_id, title, description, tags_json, category, priority, completed, date, time_spent, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                  title=excluded.title,
                  description=excluded.description,
                  tags_json=excluded.tags_json,
                  category=excluded.category,
                  priority=excluded.priority,
                  completed=excluded.completed,
                  date=excluded.date,
                  time_spent=excluded.time_spent,
                  updated_at=excluded.updated_at
                """,
                (
                    t["id"],
                    _default_user_id(),
                    t.get("project_id"),
                    t["title"],
                    t.get("description", ""),
                    json.dumps(t.get("tags", []) if isinstance(t.get("tags"), list) else []),
                    t.get("category", "general"),
                    priority,
                    1 if t.get("completed") else 0,
                    t.get("date") or today_str(),
                    max(0, safe_int(t.get("time_spent"), 0)),
                    t.get("created_at") or now_iso(),
                    t.get("updated_at") or now_iso(),
                ),
            )

        for m in payload.get("meals", []):
            if not isinstance(m, dict) or not m.get("id") or not m.get("name"):
                continue
            conn.execute(
                """
                INSERT INTO nutrition_entries
                (id, user_id, name, meal_type, calories, protein, carbs, fats, notes, date, time, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                  name=excluded.name,
                  meal_type=excluded.meal_type,
                  calories=excluded.calories,
                  protein=excluded.protein,
                  carbs=excluded.carbs,
                  fats=excluded.fats,
                  notes=excluded.notes,
                  date=excluded.date,
                  time=excluded.time,
                  updated_at=excluded.updated_at
                """,
                (
                    m["id"],
                    _default_user_id(),
                    m["name"],
                    m.get("meal_type", "other"),
                    max(0, safe_int(m.get("calories"), 0)),
                    float(m.get("protein", 0) or 0),
                    float(m.get("carbs", 0) or 0),
                    float(m.get("fats", 0) or 0),
                    m.get("notes", ""),
                    m.get("date") or today_str(),
                    m.get("time"),
                    m.get("created_at") or now_iso(),
                    m.get("updated_at") or m.get("created_at") or now_iso(),
                ),
            )

        for w in payload.get("workouts", []):
            if not isinstance(w, dict) or not w.get("id") or not w.get("name"):
                continue
            intensity = w.get("intensity", "medium")
            if intensity not in ("low", "medium", "high"):
                intensity = "medium"

            exercises = w.get("exercises", [])
            if not isinstance(exercises, list):
                exercises = []

            conn.execute(
                """
                INSERT INTO workouts
                (id, user_id, name, type, duration, calories_burned, intensity, exercises_json, notes, date, time, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                  name=excluded.name,
                  type=excluded.type,
                  duration=excluded.duration,
                  calories_burned=excluded.calories_burned,
                  intensity=excluded.intensity,
                  exercises_json=excluded.exercises_json,
                  notes=excluded.notes,
                  date=excluded.date,
                  time=excluded.time,
                  updated_at=excluded.updated_at
                """,
                (
                    w["id"],
                    _default_user_id(),
                    w["name"],
                    w.get("type", "other"),
                    max(0, safe_int(w.get("duration"), 0)),
                    max(0, safe_int(w.get("calories_burned"), 0)),
                    intensity,
                    json.dumps(exercises),
                    w.get("notes", ""),
                    w.get("date") or today_str(),
                    w.get("time"),
                    w.get("created_at") or now_iso(),
                    w.get("updated_at") or w.get("created_at") or now_iso(),
                ),
            )

        conn.commit()
    except Exception:
        conn.rollback()
        raise


def init_app_data(app):
    db_file = str(app.config["DB_FILE"])
    os.makedirs(os.path.dirname(db_file), exist_ok=True)
    conn = sqlite3.connect(db_file)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        with app.app_context():
            init_schema(conn)
            ensure_tasks_tags_column(conn)
            if should_migrate_json(conn):
                migrate_json_to_sqlite(conn)
            ensure_default_user(conn)
        conn.commit()
    finally:
        conn.close()
