#!/usr/bin/env python3
"""
Migration script: Add onboarding fields to users table.

This adds:
- age, height, current_weight, activity_level (profile essentials)
- intro_seen_at, demo_completed_at, profile_essentials_completed_at (onboarding state)

For existing users, sets profile_essentials_completed_at = created_at to bypass onboarding.

Usage:
    python scripts/migrate_onboarding.py
"""

import sqlite3
import sys
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.config import Config


def get_column_names(conn, table):
    """Get existing column names for a table."""
    cursor = conn.execute(f"PRAGMA table_info({table})")
    return {row[1] for row in cursor.fetchall()}


def migrate():
    db_path = Config.DB_FILE
    print(f"Migrating database: {db_path}")
    conn = sqlite3.connect(db_path)
    
    existing_cols = get_column_names(conn, "users")
    print(f"Existing columns: {existing_cols}")
    
    # ── Profile essentials columns ─────────────────────────
    new_cols = [
        ("age", "INTEGER"),
        ("height", "INTEGER"),
        ("current_weight", "REAL"),
        ("activity_level", "TEXT NOT NULL DEFAULT 'moderate'"),
        ("intro_seen_at", "TEXT"),
        ("demo_completed_at", "TEXT"),
        ("profile_essentials_completed_at", "TEXT"),
    ]
    
    for col_name, col_def in new_cols:
        if col_name not in existing_cols:
            print(f"  Adding column: {col_name}")
            conn.execute(f"ALTER TABLE users ADD COLUMN {col_name} {col_def}")
        else:
            print(f"  Column already exists: {col_name}")
    
    # ── Mark existing users as having completed onboarding ──
    # This ensures backward compatibility - existing users bypass onboarding
    result = conn.execute(
        """
        UPDATE users 
        SET profile_essentials_completed_at = created_at
        WHERE profile_essentials_completed_at IS NULL
        """
    )
    if result.rowcount > 0:
        print(f"  Marked {result.rowcount} existing users as onboarding-complete")
    
    conn.commit()
    conn.close()
    print("Migration complete!")


if __name__ == "__main__":
    migrate()
