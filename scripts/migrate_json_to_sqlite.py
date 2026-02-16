import json
import os
import sqlite3
from datetime import datetime, timezone

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_FILE = os.path.join(BASE_DIR, 'data', 'fitness.sqlite')
SCHEMA_FILE = os.path.join(BASE_DIR, 'db', 'schema.sql')
DATA_FILE = os.path.join(BASE_DIR, 'fitness_data.json')


def connect_db():
    os.makedirs(os.path.dirname(DB_FILE), exist_ok=True)
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    conn.execute('PRAGMA foreign_keys = ON')
    return conn


def init_schema(conn):
    with open(SCHEMA_FILE, 'r', encoding='utf-8') as f:
        conn.executescript(f.read())


def safe_int(value, default=0):
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def migrate(conn):
    if not os.path.exists(DATA_FILE):
        print('No fitness_data.json found; schema initialized only.')
        return

    with open(DATA_FILE, 'r', encoding='utf-8') as f:
        payload = json.load(f)

    now = datetime.now(timezone.utc).isoformat()

    conn.execute('BEGIN')
    try:
        conn.execute(
            '''
            INSERT INTO users (id, email, display_name, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              email=excluded.email,
              display_name=excluded.display_name,
              updated_at=excluded.updated_at
            ''',
            (1, 'local@fittrack.app', 'Local User', now, now),
        )

        for t in payload.get('tasks', []):
            if not isinstance(t, dict) or not t.get('id') or not t.get('title'):
                continue
            priority = t.get('priority', 'medium')
            if priority not in ('low', 'medium', 'high'):
                priority = 'medium'

            conn.execute(
                '''
                INSERT INTO tasks
                (id, user_id, project_id, title, description, category, priority, completed, date, time_spent, created_at, updated_at)
                VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                  title=excluded.title,
                  description=excluded.description,
                  category=excluded.category,
                  priority=excluded.priority,
                  completed=excluded.completed,
                  date=excluded.date,
                  time_spent=excluded.time_spent,
                  updated_at=excluded.updated_at
                ''',
                (
                    t['id'],
                    t.get('project_id'),
                    t['title'],
                    t.get('description', ''),
                    t.get('category', 'general'),
                    priority,
                    1 if t.get('completed') else 0,
                    t.get('date') or datetime.now(timezone.utc).strftime('%Y-%m-%d'),
                    max(0, safe_int(t.get('time_spent'), 0)),
                    t.get('created_at') or now,
                    t.get('updated_at') or now,
                ),
            )

        for m in payload.get('meals', []):
            if not isinstance(m, dict) or not m.get('id') or not m.get('name'):
                continue
            conn.execute(
                '''
                INSERT INTO nutrition_entries
                (id, user_id, name, meal_type, calories, protein, carbs, fats, notes, date, time, created_at, updated_at)
                VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
                ''',
                (
                    m['id'],
                    m['name'],
                    m.get('meal_type', 'other'),
                    max(0, safe_int(m.get('calories'), 0)),
                    float(m.get('protein', 0) or 0),
                    float(m.get('carbs', 0) or 0),
                    float(m.get('fats', 0) or 0),
                    m.get('notes', ''),
                    m.get('date') or datetime.now(timezone.utc).strftime('%Y-%m-%d'),
                    m.get('time'),
                    m.get('created_at') or now,
                    m.get('updated_at') or m.get('created_at') or now,
                ),
            )

        for w in payload.get('workouts', []):
            if not isinstance(w, dict) or not w.get('id') or not w.get('name'):
                continue
            intensity = w.get('intensity', 'medium')
            if intensity not in ('low', 'medium', 'high'):
                intensity = 'medium'
            exercises = w.get('exercises', [])
            if not isinstance(exercises, list):
                exercises = []

            conn.execute(
                '''
                INSERT INTO workouts
                (id, user_id, name, type, duration, calories_burned, intensity, exercises_json, notes, date, time, created_at, updated_at)
                VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
                ''',
                (
                    w['id'],
                    w['name'],
                    w.get('type', 'other'),
                    max(0, safe_int(w.get('duration'), 0)),
                    max(0, safe_int(w.get('calories_burned'), 0)),
                    intensity,
                    json.dumps(exercises),
                    w.get('notes', ''),
                    w.get('date') or datetime.now(timezone.utc).strftime('%Y-%m-%d'),
                    w.get('time'),
                    w.get('created_at') or now,
                    w.get('updated_at') or w.get('created_at') or now,
                ),
            )

        conn.commit()
        print('Migration complete (idempotent upsert).')
    except Exception:
        conn.rollback()
        raise


if __name__ == '__main__':
    db = connect_db()
    try:
        init_schema(db)
        migrate(db)
    finally:
        db.close()
