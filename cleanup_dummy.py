#!/usr/bin/env python3
"""Clean up all dummy accounts and their data"""
import sqlite3
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

DB_PATH = 'data/fitness.sqlite'
DUMMY_EMAILS = ['dummy1@test.com', 'dummy2@test.com', 'dummy3@test.com']

def cleanup_dummy_users():
    """Delete all dummy users and their associated data"""
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    
    # First, check what tables exist
    c.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
    tables = [t[0] for t in c.fetchall()]
    print(f"Tables in database: {', '.join(tables) }\n")
    
    # Get dummy user IDs
    c.execute("SELECT id FROM users WHERE email IN ('dummy1@test.com', 'dummy2@test.com', 'dummy3@test.com')")
    dummy_ids = [row[0] for row in c.fetchall()]
    print(f"Found {len(dummy_ids)} dummy users: {dummy_ids}\n")
    
    if not dummy_ids:
        print("No dummy users found!")
        conn.close()
        return
    
    # Delete in cascade order
    placeholders = ','.join('?' * len(dummy_ids))
    tables_to_clean = [
        'goals',
        'focus_sessions',
        'stats_snapshots',
        'workout_logs',
        'notes',
        'tasks',
        'projects',
        'streaks',
        'user_progress',
        'users'
    ]
    
    for table in tables_to_clean:
        try:
            if table == 'users':
                c.execute(f"DELETE FROM users WHERE id IN ({placeholders})", dummy_ids)
            else:
                c.execute(f"DELETE FROM {table} WHERE user_id IN ({placeholders})", dummy_ids)
            deleted = c.rowcount
            if deleted > 0:
                print(f"  ✓ Deleted {deleted} rows from {table}")
        except sqlite3.OperationalError as e:
            if 'no such table' not in str(e):
                print(f"  ⚠ Error with {table}: {e}")
    
    conn.commit()
    conn.close()
    print("\n✓ Cleanup complete! All dummy users and their data removed.")

if __name__ == '__main__':
    cleanup_dummy_users()
