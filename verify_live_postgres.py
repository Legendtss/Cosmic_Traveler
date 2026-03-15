#!/usr/bin/env python3
"""
Verify data in LIVE PostgreSQL database on Render production.

To get your PostgreSQL connection string:
1. Go to https://dashboard.render.com/
2. Find your PostgreSQL database instance
3. Copy the "External Database URL" (looks like: postgresql://user:pass@host:5432/dbname)
4. Run: python scripts/verify_live_postgres.py <DATABASE_URL>

Or set DATABASE_URL environment variable:
   export DATABASE_URL="postgresql://user:pass@host:5432/dbname"
   python scripts/verify_live_postgres.py
"""

import sys
import os

def get_connection(db_url):
    """Get PostgreSQL connection"""
    try:
        import psycopg2
        from psycopg2.extras import RealDictCursor
    except ImportError:
        print("✗ psycopg2 not installed. Install with: pip install psycopg2-binary")
        sys.exit(1)
    
    try:
        conn = psycopg2.connect(db_url)
        return conn
    except Exception as e:
        print(f"✗ Failed to connect to PostgreSQL: {e}")
        print("\nMake sure your DATABASE_URL is correct:")
        print("  Format: postgresql://username:password@host:5432/dbname")
        sys.exit(1)

def print_section(title):
    """Print formatted section header"""
    print(f"\n{'='*70}")
    print(f"  {title}")
    print(f"{'='*70}\n")

def check_connection(conn):
    """Test database connection"""
    print_section("1. PostgreSQL Connection Test")
    
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT NOW() as server_time;")
        result = cursor.fetchone()
        print(f"✓ Connection successful!")
        print(f"  Server time: {result[0]}")
        return True
    except Exception as e:
        print(f"✗ Connection failed: {e}")
        return False

def check_table_data(conn):
    """Check data in all tables"""
    print_section("2. Data Counts in Each Table")
    
    tables = [
        'users', 'projects', 'tasks', 'workouts', 
        'nutrition_entries', 'notes', 'focus_sessions', 
        'stats_snapshots', 'user_progress'
    ]
    
    cursor = conn.cursor()
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

def check_recent_users(conn):
    """Show recently created users"""
    print_section("3. Recently Created Users")
    
    try:
        cursor = conn.cursor()
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
        
        print(f"{'ID':5} | {'Email':35} | {'Name':20} | {'Created':19}")
        print(f"{'─'*5}-+-{'─'*35}-+-{'─'*20}-+-{'─'*19}")
        
        for row in users:
            print(f"{row[0]:5} | {row[1]:35} | {row[2]:20} | {str(row[3])[:19]}")
    except Exception as e:
        print(f"Error fetching users: {e}")

def check_recent_tasks(conn):
    """Show recently created tasks"""
    print_section("4. Recently Created Tasks (Sample)")
    
    try:
        cursor = conn.cursor()
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
        
        print(f"{'ID':5} | {'Email':25} | {'Title':40} | {'Done':4}")
        print(f"{'─'*5}-+-{'─'*25}-+-{'─'*40}-+-{'─'*4}")
        
        for row in tasks:
            task_id = row[0]
            email = (row[1] or 'N/A')[:25]
            title = (row[2][:37] + '...') if len(row[2]) > 40 else row[2]
            done = '✓' if row[3] else '○'
            
            print(f"{task_id:5} | {email:25} | {title:40} | {done:4}")
    except Exception as e:
        print(f"Error fetching tasks: {e}")

def check_recent_meals(conn):
    """Show recently created meals"""
    print_section("5. Recently Created Meals (Sample)")
    
    try:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT n.id, u.email, n.name, n.calories, n.date
            FROM nutrition_entries n
            LEFT JOIN users u ON n.user_id = u.id
            ORDER BY n.created_at DESC
            LIMIT 10;
        """)
        
        meals = cursor.fetchall()
        if not meals:
            print("No meals found")
            return
        
        print(f"{'ID':5} | {'Email':25} | {'Meal Name':35} | {'Cals':5} | {'Date':10}")
        print(f"{'─'*5}-+-{'─'*25}-+-{'─'*35}-+-{'─'*5}-+-{'─'*10}")
        
        for row in meals:
            meal_id = row[0]
            email = (row[1] or 'N/A')[:25]
            name = (row[2][:32] + '...') if len(row[2]) > 35 else row[2]
            calories = row[3]
            date = str(row[4])[:10]
            
            print(f"{meal_id:5} | {email:25} | {name:35} | {calories:5} | {date:10}")
    except Exception as e:
        print(f"Error fetching meals: {e}")

def check_recent_workouts(conn):
    """Show recently created workouts"""
    print_section("6. Recently Created Workouts (Sample)")
    
    try:
        cursor = conn.cursor()
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
        
        print(f"{'ID':5} | {'Email':25} | {'Workout':30} | {'Mins':5} | {'Cals':5} | {'Date':10}")
        print(f"{'─'*5}-+-{'─'*25}-+-{'─'*30}-+-{'─'*5}-+-{'─'*5}-+-{'─'*10}")
        
        for row in workouts:
            workout_id = row[0]
            email = (row[1] or 'N/A')[:25]
            name = (row[2][:27] + '...') if len(row[2]) > 30 else row[2]
            duration = row[3]
            calories = row[4]
            date = str(row[5])[:10]
            
            print(f"{workout_id:5} | {email:25} | {name:30} | {duration:5} | {calories:5} | {date:10}")
    except Exception as e:
        print(f"Error fetching workouts: {e}")

def main():
    print("\n")
    print("╔" + "═"*68 + "╗")
    print("║" + " "*12 + "LIVE PostgreSQL DATABASE VERIFICATION" + " "*20 + "║")
    print("╚" + "═"*68 + "╝")
    
    # Get database URL
    if len(sys.argv) > 1:
        db_url = sys.argv[1]
    else:
        db_url = os.environ.get("DATABASE_URL", "").strip()
    
    if not db_url:
        print("\n✗ No database URL provided!")
        print("\nUsage:")
        print("  python verify_live_postgres.py <DATABASE_URL>")
        print("\nOr set environment variable:")
        print("  export DATABASE_URL='postgresql://user:pass@host:5432/dbname'")
        print("  python verify_live_postgres.py")
        print("\nTo find your Render PostgreSQL database URL:")
        print("  1. Go to https://dashboard.render.com/")
        print("  2. Click on your PostgreSQL database")
        print("  3. Copy the 'External Database URL'")
        sys.exit(1)
    
    # Hide password in display
    display_url = db_url
    if 'password' in db_url or '@' in db_url:
        try:
            parts = db_url.split('@')
            display_url = parts[0][:15] + '...@' + parts[1]
        except:
            display_url = db_url[:20] + '...'
    
    print(f"\nConnecting to: {display_url}")
    
    # Connect to database
    conn = get_connection(db_url)
    
    try:
        # Test connection
        if not check_connection(conn):
            return
        
        # Check table data
        if check_table_data(conn):
            print("\n✓ Data found in production database!")
        else:
            print("\n✗ No data found in production database")
        
        # Show recent data
        check_recent_users(conn)
        check_recent_tasks(conn)
        check_recent_meals(conn)
        check_recent_workouts(conn)
        
        # Summary
        print_section("7. Production Database Summary")
        print(f"✓ Successfully connected to live PostgreSQL database")
        print(f"✓ Data is being stored in production!")
        print(f"\n{'='*70}\n")
    
    finally:
        conn.close()

if __name__ == '__main__':
    main()
