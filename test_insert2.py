import sqlite3
from datetime import datetime

# Initialize DB
conn = sqlite3.connect('data/fitness.sqlite')
cursor = conn.cursor()

# Read and execute schema
with open('db/schema.sql') as f:
    cursor.executescript(f.read())

now = datetime.now().isoformat()

# Test incrementally adding fields
tests = [
    ("Base + level", {
        'email': 'test1@test.com',
        'password_hash': 'hash',
        'display_name': 'User',
        'level': 'Intermediate',
        'activity_level': 'moderate'
    }),
    ("Base + level + goal", {
        'email': 'test2@test.com',
        'password_hash': 'hash',
        'display_name': 'User',
        'level': 'Intermediate',
        'goal': 'Muscle Building',
        'activity_level': 'moderate'
    }),
    ("Base + level + goal + weekly_workout_target", {
        'email': 'test3@test.com',
        'password_hash': 'hash',
        'display_name': 'User',
        'level': 'Intermediate',
        'goal': 'Muscle Building',
        'weekly_workout_target': 4,
        'activity_level': 'moderate'
    }),
    ("Base + level + goal + weekly_workout_target + calorie_goal", {
        'email': 'test4@test.com',
        'password_hash': 'hash',
        'display_name': 'User',
        'level': 'Intermediate',
        'goal': 'Muscle Building',
        'weekly_workout_target': 4,
        'calorie_goal': 3200,
        'activity_level': 'moderate'
    }),
    ("+ age, height, weights", {
        'email': 'test5@test.com',
        'password_hash': 'hash',
        'display_name': 'User',
        'level': 'Intermediate',
        'goal': 'Muscle Building',
        'weekly_workout_target': 4,
        'calorie_goal': 3200,
        'age': 26,
        'height': 180,
        'current_weight': 92.0,
        'target_weight': 100.0,
        'activity_level': 'moderate'
    }),
    ("+ weight_goal_duration_weeks", {
        'email': 'test6@test.com',
        'password_hash': 'hash',
        'display_name': 'User',
        'level': 'Intermediate',
        'goal': 'Muscle Building',
        'weekly_workout_target': 4,
        'calorie_goal': 3200,
        'age': 26,
        'height': 180,
        'current_weight': 92.0,
        'target_weight': 100.0,
        'weight_goal_duration_weeks': 12,
        'activity_level': 'moderate'
    }),
    ("+ daily_calorie_delta", {
        'email': 'test7@test.com',
        'password_hash': 'hash',
        'display_name': 'User',
        'level': 'Intermediate',
        'goal': 'Muscle Building',
        'weekly_workout_target': 4,
        'calorie_goal': 3200,
        'age': 26,
        'height': 180,
        'current_weight': 92.0,
        'target_weight': 100.0,
        'weight_goal_duration_weeks': 12,
        'daily_calorie_delta': -250.0,
        'activity_level': 'moderate'
    }),
    ("+ timestamps", {
        'email': 'test8@test.com',
        'password_hash': 'hash',
        'display_name': 'User',
        'level': 'Intermediate',
        'goal': 'Muscle Building',
        'weekly_workout_target': 4,
        'calorie_goal': 3200,
        'age': 26,
        'height': 180,
        'current_weight': 92.0,
        'target_weight': 100.0,
        'weight_goal_duration_weeks': 12,
        'daily_calorie_delta': -250.0,
        'intro_seen_at': now,
        'demo_completed_at': now,
        'profile_essentials_completed_at': now,
        'activity_level': 'moderate',
        'created_at': now,
        'updated_at': now
    }),
]

for test_name, data in tests:
    try:
        cols = ', '.join(data.keys())
        vals = ', '.join(['?'] * len(data))
        sql = f"INSERT INTO users ({cols}) VALUES ({vals})"
        cursor.execute(sql, list(data.values()))
        conn.commit()
        print(f"✓ {test_name}")
    except Exception as e:
        print(f"✗ {test_name}: {e}")
        conn.rollback()

conn.close()
print("\nDone!")
