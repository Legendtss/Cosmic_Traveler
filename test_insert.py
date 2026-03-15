import sqlite3
from datetime import datetime

# Initialize DB
conn = sqlite3.connect('data/fitness.sqlite')
cursor = conn.cursor()

# Read and execute schema
with open('db/schema.sql') as f:
    cursor.executescript(f.read())

print("Schema initialized")

# Test 1: Minimal insert - just required fields
print("\n=== TEST 1: Minimal insert ===")
try:
    cursor.execute('''
        INSERT INTO users (email, password_hash, display_name, activity_level)
        VALUES (?, ?, ?, ?)
    ''', ('test1@test.com', 'hash', 'Test User', 'moderate'))
    conn.commit()
    print("✓ Minimal insert successful")
except Exception as e:
    print(f"✗ Minimal insert failed: {e}")
    conn.rollback()

# Test 2: Insert with integer age
print("\n=== TEST 2: Insert with age (int) ===")
try:
    cursor.execute('''
        INSERT INTO users (email, password_hash, display_name, age, activity_level)
        VALUES (?, ?, ?, ?, ?)
    ''', ('test2@test.com', 'hash', 'Test User', 26, 'moderate'))
    conn.commit()
    print("✓ Insert with age successful")
except Exception as e:
    print(f"✗ Insert with age failed: {e}")
    conn.rollback()

# Test 3: Insert with height and weight
print("\n=== TEST 3: Insert with dimensions ===")
try:
    cursor.execute('''
        INSERT INTO users (email, password_hash, display_name, age, height, current_weight, target_weight, activity_level)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ''', ('test3@test.com', 'hash', 'Test User', 26, 180, 92.0, 100.0, 'moderate'))
    conn.commit()
    print("✓ Insert with dimensions successful")
except Exception as e:
    print(f"✗ Insert with dimensions failed: {e}")
    conn.rollback()

# Test 4: Insert with all fields from schema
print("\n=== TEST 4: Full insert with all fields ===")
now = datetime.now().isoformat()
try:
    cursor.execute('''
        INSERT INTO users 
        (email, password_hash, display_name, level, goal, weekly_workout_target, 
         calorie_goal, age, height, current_weight, target_weight, weight_goal_duration_weeks,
         daily_calorie_delta, activity_level,
         intro_seen_at, demo_completed_at, profile_essentials_completed_at,
         created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        'test4@test.com', 'hash', 'Test User', 'Intermediate', 'Muscle Building', 4,
        3200, 26, 180, 92.0, 100.0, 12, -250.0, 'very_active',
        now, now, now, now, now
    ))
    conn.commit()
    print("✓ Full insert successful")
except Exception as e:
    print(f"✗ Full insert failed: {e}")
    conn.rollback()

conn.close()
print("\nDone!")
