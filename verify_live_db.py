#!/usr/bin/env python3
"""
Verify that data is being stored in the live PostgreSQL database.
This script checks:
1. What database type is configured (PostgreSQL vs SQLite)
2. Database connection details
3. Recent data written to tables
4. Sample data from key tables
"""
import os
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.config import Config
from app.db import get_db

DB_CONFIG = Config.DB_CONFIG

def print_section(title):
    """Print formatted section header"""
    print(f"\n{'='*70}")
    print(f"  {title}")
    print(f"{'='*70}\n")

def check_database_config():
    """Check database configuration"""
    print_section("1. Database Configuration")
    
    env = os.environ.get("RENDER", "false").lower() == "true"
    env_name = "Production (Render)" if env else "Local Development"
    print(f"Environment: {env_name}")
    print(f"Database Type: {DB_CONFIG.get('type', 'unknown').upper()}")
    
    if DB_CONFIG['type'] == 'postgresql':
        print("\nPostgreSQL Configuration:")
        db_url = DB_CONFIG.get('url', 'N/A')
        # Hide password in URL
        if 'password' in db_url:
            db_url = db_url.split('@')[0] + '...@' + db_url.split('@')[1]
        print(f"  URL: {db_url}")
        print(f"  Pool Min Connections: {DB_CONFIG.get('pool_minconn', 'N/A')}")
        print(f"  Pool Max Connections: {DB_CONFIG.get('pool_maxconn', 'N/A')}")
        return True
    else:
        print(f"\nSQLite Configuration:")
        print(f"  Path: {DB_CONFIG.get('path', 'N/A')}")
        return False

def verify_connection():
    """Test database connection"""
    print_section("2. Database Connection Test")
    
    try:
        db = get_db()
        cursor = db.cursor()
        
        # Test query - get current time from database
        if DB_CONFIG['type'] == 'postgresql':
            cursor.execute("SELECT NOW() as server_time;")
        else:
            cursor.execute("SELECT CURRENT_TIMESTAMP as server_time;")
        
        result = cursor.fetchone()
        print(f"✓ Connection successful!")
        print(f"  Server time: {result[0]}")
        return True
    except Exception as e:
        print(f"✗ Connection failed: {e}")
        return False

def check_table_data(db):
    """Check data in all tables"""
    print_section("3. Data Counts in Each Table")
    
    tables = [
        'users', 'projects', 'tasks', 'workouts', 
        'nutrition_entries', 'notes', 'focus_sessions', 
        'stats_snapshots', 'user_progress'
    ]
    
    cursor = db.cursor()
    total_records = 0
    
    for table in tables:
        try:
            cursor.execute(f"SELECT COUNT(*) FROM {table};")
            count = cursor.fetchone()[0]
            total_records += count
            icon = "✓" if count > 0 else "○"
            print(f"{icon} {table:25} : {count:5} records")
        except Exception as e:
            print(f"✗ {table:25} : Error - {e}")
    
    print(f"\n{'─'*70}")
    print(f"{'TOTAL RECORDS':25} : {total_records:5}")
    return total_records > 0

def check_recent_users(db):
    """Show recently created users"""
    print_section("4. Recently Created Users")
    
    try:
        cursor = db.cursor()
        cursor.execute("""
            SELECT id, email, display_name, created_at 
            FROM users 
            ORDER BY created_at DESC 
            LIMIT 5;
        """)
        
        users = cursor.fetchall()
        if not users:
            print("No users found")
            return
        
        for row in users:
            if hasattr(row, '__getitem__'):
                # Dict-like (PostgreSQL RealDictCursor)
                print(f"  ID: {row['id']:3} | Email: {row['email']:30} | Name: {row['display_name']:20} | Created: {row['created_at']}")
            else:
                # Tuple-like (SQLite)
                print(f"  ID: {row[0]:3} | Email: {row[1]:30} | Name: {row[2]:20} | Created: {row[3]}")
    except Exception as e:
        print(f"Error fetching users: {e}")

def check_recent_tasks(db):
    """Show recently created tasks"""
    print_section("5. Recently Created Tasks (Sample)")
    
    try:
        cursor = db.cursor()
        cursor.execute("""
            SELECT t.id, u.email, t.title, t.completed, t.created_at
            FROM tasks t
            LEFT JOIN users u ON t.user_id = u.id
            ORDER BY t.created_at DESC
            LIMIT 10;
        """)
        
        tasks = cursor.fetchall()
        if not tasks:
            print("No tasks found")
            return
        
        print(f"{'ID':5} | {'Email':30} | {'Title':40} | {'Done':4} | {'Created':19}")
        print(f"{'─'*5}-+-{'─'*30}-+-{'─'*40}-+-{'─'*4}-+-{'─'*19}")
        
        for row in tasks:
            if hasattr(row, '__getitem__') and isinstance(row, dict):
                # Dict-like (PostgreSQL RealDictCursor)
                task_id = row['id']
                email = row['email'] or 'N/A'
                title = (row['title'][:37] + '...') if len(row['title']) > 40 else row['title']
                done = '✓' if row['completed'] else '○'
                created = str(row['created_at'])[:19]
            else:
                # Tuple-like (SQLite)
                task_id = row[0]
                email = row[1] or 'N/A'
                title = (row[2][:37] + '...') if len(row[2]) > 40 else row[2]
                done = '✓' if row[3] else '○'
                created = str(row[4])[:19]
            
            print(f"{task_id:5} | {email:30} | {title:40} | {done:4} | {created:19}")
    except Exception as e:
        print(f"Error fetching tasks: {e}")

def check_recent_meals(db):
    """Show recently created meals"""
    print_section("6. Recently Created Meals (Sample)")
    
    try:
        cursor = db.cursor()
        cursor.execute("""
            SELECT n.id, u.email, n.name, n.calories, n.date, n.created_at
            FROM nutrition_entries n
            LEFT JOIN users u ON n.user_id = u.id
            ORDER BY n.created_at DESC
            LIMIT 10;
        """)
        
        meals = cursor.fetchall()
        if not meals:
            print("No meals found")
            return
        
        print(f"{'ID':5} | {'Email':30} | {'Meal Name':35} | {'Cals':5} | {'Date':10}")
        print(f"{'─'*5}-+-{'─'*30}-+-{'─'*35}-+-{'─'*5}-+-{'─'*10}")
        
        for row in meals:
            if hasattr(row, '__getitem__') and isinstance(row, dict):
                # Dict-like (PostgreSQL RealDictCursor)
                meal_id = row['id']
                email = row['email'] or 'N/A'
                name = (row['name'][:32] + '...') if len(row['name']) > 35 else row['name']
                calories = row['calories']
                date = str(row['date'])[:10]
            else:
                # Tuple-like (SQLite)
                meal_id = row[0]
                email = row[1] or 'N/A'
                name = (row[2][:32] + '...') if len(row[2]) > 35 else row[2]
                calories = row[3]
                date = str(row[4])[:10]
            
            print(f"{meal_id:5} | {email:30} | {name:35} | {calories:5} | {date:10}")
    except Exception as e:
        print(f"Error fetching meals: {e}")

def check_recent_workouts(db):
    """Show recently created workouts"""
    print_section("7. Recently Created Workouts (Sample)")
    
    try:
        cursor = db.cursor()
        cursor.execute("""
            SELECT w.id, u.email, w.name, w.duration, w.calories_burned, w.date
            FROM workouts w
            LEFT JOIN users u ON w.user_id = u.id
            ORDER BY w.created_at DESC
            LIMIT 10;
        """)
        
        workouts = cursor.fetchall()
        if not workouts:
            print("No workouts found")
            return
        
        print(f"{'ID':5} | {'Email':30} | {'Workout Name':30} | {'Mins':5} | {'Cals':5} | {'Date':10}")
        print(f"{'─'*5}-+-{'─'*30}-+-{'─'*30}-+-{'─'*5}-+-{'─'*5}-+-{'─'*10}")
        
        for row in workouts:
            if hasattr(row, '__getitem__') and isinstance(row, dict):
                # Dict-like (PostgreSQL RealDictCursor)
                workout_id = row['id']
                email = row['email'] or 'N/A'
                name = (row['name'][:27] + '...') if len(row['name']) > 30 else row['name']
                duration = row['duration']
                calories = row['calories_burned']
                date = str(row['date'])[:10]
            else:
                # Tuple-like (SQLite)
                workout_id = row[0]
                email = row[1] or 'N/A'
                name = (row[2][:27] + '...') if len(row[2]) > 30 else row[2]
                duration = row[3]
                calories = row[4]
                date = str(row[5])[:10]
            
            print(f"{workout_id:5} | {email:30} | {name:30} | {duration:5} | {calories:5} | {date:10}")
    except Exception as e:
        print(f"Error fetching workouts: {e}")

def main():
    print("\n")
    print("╔" + "═"*68 + "╗")
    print("║" + " "*15 + "DATABASE DATA VERIFICATION" + " "*27 + "║")
    print("╚" + "═"*68 + "╝")
    
    # Import Flask app to create context
    from run import app
    
    with app.app_context():
        # Check configuration
        is_postgres = check_database_config()
        
        # Test connection
        if not verify_connection():
            print("\n✗ Failed to connect to database. Cannot verify data.")
            return
        
        # Get database connection
        try:
            db = get_db()
        except Exception as e:
            print(f"\n✗ Error getting database connection: {e}")
            return
        
        # Check table data
        if check_table_data(db):
            print("\n✓ Data found in database!")
        else:
            print("\n✗ No data found in database")
        
        # Show recent data
        check_recent_users(db)
        check_recent_tasks(db)
        check_recent_meals(db)
        check_recent_workouts(db)
        
        # Summary
        print_section("8. Verification Summary")
        db_type = "PostgreSQL (Production)" if is_postgres else "SQLite (Local)"
        print(f"Database Type: {db_type}")
        print(f"Connection: ✓ Active")
        print(f"\n📊 Recommendation:")
        if is_postgres:
            print("   Your app is using PostgreSQL on production.")
            print("   Data shown above confirms it's being stored in the live database!")
        else:
            print("   Your app is using SQLite locally.")
            print("   On Render production, make sure DATABASE_URL is set to PostgreSQL.")
        
        print(f"\n{'='*70}\n")

if __name__ == '__main__':
    main()
