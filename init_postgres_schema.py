#!/usr/bin/env python3
"""
Initialize PostgreSQL Schema

Creates all required database tables in PostgreSQL.
Run this BEFORE migrate_to_postgres.py for data migration.

Usage:
    python init_postgres_schema.py --target postgresql://user:pass@host/dbname

If --target is omitted, will use DATABASE_URL environment variable.
"""

import argparse
import os
import sys

try:
    import psycopg2
except ImportError:
    print("ERROR: psycopg2 not installed. Run: pip install psycopg2-binary")
    sys.exit(1)


# PostgreSQL-compatible schema DDL
POSTGRES_SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL DEFAULT '',
  display_name TEXT NOT NULL,
  level TEXT NOT NULL DEFAULT 'Beginner',
  goal TEXT NOT NULL DEFAULT 'General Fitness',
  weekly_workout_target INTEGER NOT NULL DEFAULT 3,
  calorie_goal INTEGER NOT NULL DEFAULT 2200,
  age INTEGER,
  height INTEGER,
  current_weight REAL,
  activity_level TEXT NOT NULL DEFAULT 'moderate' CHECK (activity_level IN ('sedentary','light','moderate','active','very_active')),
  intro_seen_at TEXT,
  demo_completed_at TEXT,
  profile_essentials_completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS login_attempts (
  identifier TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 0 CHECK (count >= 0),
  first_attempt REAL NOT NULL DEFAULT 0,
  locked_until REAL NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS projects (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived','completed')),
  due_date TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tasks (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  tags_json TEXT NOT NULL DEFAULT '[]',
  category TEXT NOT NULL DEFAULT 'general',
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high')),
  completed INTEGER NOT NULL DEFAULT 0 CHECK (completed IN (0,1)),
  date TEXT NOT NULL,
  time_spent INTEGER NOT NULL DEFAULT 0 CHECK (time_spent >= 0),
  note_content TEXT NOT NULL DEFAULT '',
  note_saved_to_notes INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS project_subtasks (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  completed INTEGER NOT NULL DEFAULT 0 CHECK (completed IN (0,1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS workouts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'other',
  duration INTEGER NOT NULL DEFAULT 0 CHECK (duration >= 0),
  calories_burned INTEGER NOT NULL DEFAULT 0 CHECK (calories_burned >= 0),
  intensity TEXT NOT NULL DEFAULT 'medium' CHECK (intensity IN ('low','medium','high')),
  exercises_json TEXT NOT NULL DEFAULT '[]',
  notes TEXT NOT NULL DEFAULT '',
  completed INTEGER NOT NULL DEFAULT 0 CHECK (completed IN (0,1)),
  date TEXT NOT NULL,
  time TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS nutrition_entries (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  meal_type TEXT NOT NULL DEFAULT 'other',
  calories INTEGER NOT NULL DEFAULT 0 CHECK (calories >= 0),
  protein REAL NOT NULL DEFAULT 0 CHECK (protein >= 0),
  carbs REAL NOT NULL DEFAULT 0 CHECK (carbs >= 0),
  fats REAL NOT NULL DEFAULT 0 CHECK (fats >= 0),
  notes TEXT NOT NULL DEFAULT '',
  date TEXT NOT NULL,
  time TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS stats_snapshots (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  snapshot_date TEXT NOT NULL,
  streak_days INTEGER NOT NULL DEFAULT 0 CHECK (streak_days >= 0),
  payload_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, snapshot_date)
);

CREATE TABLE IF NOT EXISTS user_progress (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  total_points INTEGER NOT NULL DEFAULT 0 CHECK (total_points >= 0),
  current_streak INTEGER NOT NULL DEFAULT 0 CHECK (current_streak >= 0),
  longest_streak INTEGER NOT NULL DEFAULT 0 CHECK (longest_streak >= 0),
  level INTEGER NOT NULL DEFAULT 1 CHECK (level >= 1),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS focus_sessions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mode TEXT NOT NULL DEFAULT 'pomodoro' CHECK (mode IN ('pomodoro','custom','stopwatch')),
  duration_planned INTEGER NOT NULL DEFAULT 0 CHECK (duration_planned >= 0),
  duration_actual INTEGER NOT NULL DEFAULT 0 CHECK (duration_actual >= 0),
  completed INTEGER NOT NULL DEFAULT 0 CHECK (completed IN (0,1)),
  label TEXT NOT NULL DEFAULT '',
  date TEXT NOT NULL,
  started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ended_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notes (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  source_type TEXT NOT NULL DEFAULT 'manual' CHECK (source_type IN ('manual','task')),
  source_id INTEGER,
  tags_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_login_attempts_locked_until ON login_attempts(locked_until);
"""


def init_schema(postgres_url):
    """Initialize PostgreSQL schema."""
    print(f"\n=== PostgreSQL Schema Initialization ===")
    print(f"  Connecting to PostgreSQL...")
    
    conn = psycopg2.connect(postgres_url)
    
    try:
        print(f"  Creating tables...")
        
        # Split by semicolon and execute each statement
        statement_count = 0
        for statement in POSTGRES_SCHEMA.split(";"):
            statement = statement.strip()
            if statement and not statement.startswith("--"):
                cursor = conn.cursor()
                try:
                    cursor.execute(statement)
                    statement_count += 1
                finally:
                    cursor.close()
        
        conn.commit()
        print(f"\n  ✓ Schema initialized successfully!")
        print(f"    - Executed {statement_count} SQL statements")
        
        # Verify tables exist
        cursor = conn.cursor()
        cursor.execute("""
            SELECT COUNT(*) FROM information_schema.tables 
            WHERE table_schema = 'public'
        """)
        table_count = cursor.fetchone()[0]
        print(f"    - Created {table_count} tables and indexes")
        cursor.close()
        
    except psycopg2.Error as e:
        conn.rollback()
        print(f"\n  ✗ Schema initialization failed:")
        print(f"    {e}")
        sys.exit(1)
    finally:
        conn.close()


def main():
    parser = argparse.ArgumentParser(
        description="Initialize PostgreSQL schema"
    )
    parser.add_argument(
        "--target",
        help="PostgreSQL connection URL (default: from DATABASE_URL env var)",
        default=None
    )
    
    args = parser.parse_args()
    
    if args.target:
        postgres_url = args.target
    else:
        postgres_url = os.environ.get("DATABASE_URL")
        if not postgres_url:
            print("ERROR: No PostgreSQL URL specified. Use --target or set DATABASE_URL.")
            sys.exit(1)
    
    init_schema(postgres_url)


if __name__ == "__main__":
    main()
