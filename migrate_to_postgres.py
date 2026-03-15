#!/usr/bin/env python3
"""
Migration Script: SQLite → PostgreSQL

This script transfers all data from an existing SQLite database to PostgreSQL.
It preserves all table structures, sequences, and data.

Usage:
    python migrate_to_postgres.py --source data/fitness.sqlite --target postgresql://user:pass@host/dbname

If --source or --target is omitted, will read from DATABASE_URL environment variable.
"""

import argparse
import os
import sqlite3
import sys
from pathlib import Path

try:
    import psycopg2
    from psycopg2.extras import execute_batch
except ImportError:
    print("ERROR: psycopg2 not installed. Run: pip install psycopg2-binary")
    sys.exit(1)


def get_sqlite_connection(db_file):
    """Connect to SQLite database."""
    if not os.path.exists(db_file):
        raise FileNotFoundError(f"SQLite database not found: {db_file}")
    conn = sqlite3.connect(db_file)
    conn.row_factory = sqlite3.Row
    return conn


def get_postgres_connection(db_url):
    """Connect to PostgreSQL database."""
    try:
        conn = psycopg2.connect(db_url)
        return conn
    except psycopg2.OperationalError as e:
        print(f"ERROR: Failed to connect to PostgreSQL: {e}")
        raise


def get_table_names(sqlite_conn):
    """Get list of all user tables from SQLite (excluding internal tables).
    
    Returns tables in dependency order: users first, then others.
    """
    cursor = sqlite_conn.execute("""
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name NOT LIKE 'sqlite_%'
        ORDER BY name
    """)
    tables = [row[0] for row in cursor.fetchall()]
    
    # Reorder for dependency: users must be first, then everything else
    # This ensures foreign key constraints are satisfied
    priority_order = ['users', 'projects', 'tasks', 'project_subtasks', 
                      'focus_sessions', 'workouts', 'nutrition_entries',
                      'stats_snapshots', 'user_progress', 'notes', 
                      'sessions', 'login_attempts']
    
    ordered_tables = []
    for prio_table in priority_order:
        if prio_table in tables:
            ordered_tables.append(prio_table)
    
    # Add any remaining tables not in priority order
    for table in tables:
        if table not in ordered_tables:
            ordered_tables.append(table)
    
    return ordered_tables


def get_column_info(sqlite_conn, table_name):
    """Get column information from SQLite table."""
    cursor = sqlite_conn.execute(f"PRAGMA table_info({table_name})")
    return cursor.fetchall()


def migrate_table(sqlite_conn, postgres_conn, table_name):
    """Migrate a single table from SQLite to PostgreSQL.""" 
    print(f"  Migrating table: {table_name}...", end=" ")
    
    # Get all data from SQLite
    sqlite_cursor = sqlite_conn.cursor()
    sqlite_cursor.execute(f"SELECT * FROM {table_name}")
    rows = sqlite_cursor.fetchall()
    
    if not rows:
        print("(empty)")
        return
    
    # Get column names
    sqlite_cursor.execute(f"PRAGMA table_info({table_name})")
    columns = [col[1] for col in sqlite_cursor.fetchall()]
    
    # Prepare PostgreSQL insert
    placeholders = ", ".join(["%s"] * len(columns))
    col_names = ", ".join(columns)
    insert_sql = f"INSERT INTO {table_name} ({col_names}) VALUES ({placeholders})"
    
    # Convert rows to tuples and insert
    postgres_cursor = postgres_conn.cursor()
    try:
        # Insert in batches for efficiency
        data = [tuple(row) for row in rows]
        execute_batch(postgres_cursor, insert_sql, data, page_size=1000)
        postgres_conn.commit()
        print(f"✓ ({len(rows)} rows)")
    except psycopg2.Error as e:
        postgres_conn.rollback()
        print(f"ERROR")
        raise e


def migrate_sequences(postgres_conn, table_names):
    """Update PostgreSQL sequences to match max IDs from data."""
    print("\n  Updating sequences...")
    cursor = postgres_conn.cursor()
    
    for table_name in table_names:
        try:
            cursor.execute(f"""
                SELECT MAX(id) as max_id FROM {table_name} 
                WHERE id IS NOT NULL
            """)
            result = cursor.fetchone()
            max_id = result[0] if result and result[0] else 0
            
            if max_id and int(max_id) > 0:
                seq_name = f"{table_name}_id_seq"
                cursor.execute(f"SELECT setval('{seq_name}', %s)", (int(max_id),))
                print(f"    {seq_name} → {max_id}")
        except psycopg2.Error:
            # Sequence might not exist for this table, skip
            pass
    
    postgres_conn.commit()


def main():
    parser = argparse.ArgumentParser(
        description="Migrate SQLite database to PostgreSQL"
    )
    parser.add_argument(
        "--source",
        help="Path to SQLite database (default: data/fitness.sqlite)",
        default="data/fitness.sqlite"
    )
    parser.add_argument(
        "--target",
        help="PostgreSQL connection URL (default: from DATABASE_URL env var)",
        default=None
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be migrated without actually doing it"
    )
    
    args = parser.parse_args()
    
    # Determine source
    sqlite_path = args.source
    if not os.path.exists(sqlite_path):
        print(f"ERROR: SQLite database not found at {sqlite_path}")
        sys.exit(1)
    
    # Determine target
    if args.target:
        postgres_url = args.target
    else:
        postgres_url = os.environ.get("DATABASE_URL")
        if not postgres_url:
            print("ERROR: No PostgreSQL URL specified. Use --target or set DATABASE_URL.")
            sys.exit(1)
    
    print(f"\n=== PostgreSQL Migration ===")
    print(f"  Source: {sqlite_path}")
    
    # Show masked URL
    if "@" in postgres_url:
        masked_url = postgres_url.split("@")[0] + "://...@" + postgres_url.split("@")[1]
    else:
        masked_url = postgres_url[:50] + "..."
    print(f"  Target: {masked_url}")
    
    if args.dry_run:
        print("\n[DRY RUN MODE - No changes will be made]\n")
    
    # Connect to databases
    print("\n  Connecting to SQLite...")
    sqlite_conn = get_sqlite_connection(sqlite_path)
    
    print("  Connecting to PostgreSQL...")
    postgres_conn = get_postgres_connection(postgres_url)
    
    # Get table names
    table_names = get_table_names(sqlite_conn)
    print(f"\n  Found {len(table_names)} tables:")
    for table_name in table_names:
        sqlite_conn.row_factory = sqlite3.Row
        row_count = sqlite_conn.execute(
            f"SELECT COUNT(*) as cnt FROM {table_name}"
        ).fetchone()["cnt"]
        print(f"    - {table_name}: {row_count} rows")
    
    if args.dry_run:
        print("\n  [Dry run complete - no data was transferred]")
        sqlite_conn.close()
        postgres_conn.close()
        return
    
    # Migrate data
    print("\n  Starting migration...")
    try:
        for table_name in table_names:
            migrate_table(sqlite_conn, postgres_conn, table_name)
        
        migrate_sequences(postgres_conn, table_names)
        
        print("\n  ✓ Migration completed successfully!")
        print("\n  Next: Deploy to Render with DATABASE_URL environment variable set")
        
    except psycopg2.Error as e:
        print(f"\n  ✗ Migration failed: {e}")
        sys.exit(1)
    finally:
        sqlite_conn.close()
        postgres_conn.close()


if __name__ == "__main__":
    main()
