#!/usr/bin/env python3
import sqlite3

conn = sqlite3.connect('data/db.sqlite')
cursor = conn.cursor()

users = ['dummy1@test.com', 'dummy2@test.com', 'dummy3@test.com']

print("\n" + "="*70)
print("DATABASE VERIFICATION - DUMMY USERS DATA")
print("="*70)

for email in users:
    cursor.execute('SELECT id, display_name, calorie_goal FROM users WHERE email = ?', (email,))
    result = cursor.fetchone()
    if not result:
        print(f"\n{email}: NOT FOUND")
        continue
    
    user_id, display_name, calorie_goal = result
    print(f"\n[{display_name.upper()}] {email} (ID={user_id}, Calorie Goal={calorie_goal})")
    print("-" * 70)
    
    # Count tasks
    cursor.execute('SELECT COUNT(*) FROM tasks WHERE user_id = ?', (user_id,))
    task_count = cursor.fetchone()[0]
    print(f"  Tasks: {task_count}")
    
    # Show task titles
    cursor.execute('SELECT id, title FROM tasks WHERE user_id = ?', (user_id,))
    for task_id, title in cursor.fetchall():
        print(f"    - {title}")
    
    # Count and show notes
    cursor.execute('SELECT COUNT(*) FROM notes WHERE user_id = ?', (user_id,))
    note_count = cursor.fetchone()[0]
    print(f"\n  Notes: {note_count}")
    
    cursor.execute('SELECT id, title, source_type, source_id FROM notes WHERE user_id = ?', (user_id,))
    for note_id, title, source_type, source_id in cursor.fetchall():
        source_info = f" [linked to task {source_id}]" if source_type == 'task' else ""
        print(f"    - {title}{source_info}")
    
    # Count meals
    cursor.execute('SELECT COUNT(*) FROM nutrition_entries WHERE user_id = ?', (user_id,))
    meal_count = cursor.fetchone()[0]
    
    # Sum calories
    cursor.execute('SELECT SUM(calories) FROM nutrition_entries WHERE user_id = ?', (user_id,))
    total_calories = cursor.fetchone()[0] or 0
    
    print(f"\n  Meals: {meal_count} (Total Calories: {total_calories})")
    
    cursor.execute('SELECT name, calories FROM nutrition_entries WHERE user_id = ?', (user_id,))
    for name, calories in cursor.fetchall():
        print(f"    - {name} ({calories} cal)")
    
    # Count workouts
    cursor.execute('SELECT COUNT(*) FROM workouts WHERE user_id = ?', (user_id,))
    workout_count = cursor.fetchone()[0]
    
    # Sum calories burned
    cursor.execute('SELECT SUM(calories_burned) FROM workouts WHERE user_id = ?', (user_id,))
    total_burned = cursor.fetchone()[0] or 0
    
    print(f"\n  Workouts: {workout_count} (Total Calories Burned: {total_burned})")
    
    cursor.execute('SELECT name, duration, calories_burned FROM workouts WHERE user_id = ?', (user_id,))
    for name, duration, calories in cursor.fetchall():
        print(f"    - {name} ({duration} min, {calories} cal)")

print("\n" + "="*70)
conn.close()
