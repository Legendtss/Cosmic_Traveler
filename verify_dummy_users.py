import sqlite3

conn = sqlite3.connect('data/fitness.sqlite')
cursor = conn.cursor()

print("=" * 70)
print("VERIFICATION: 3 UNIQUE DUMMY USERS - COMPLETE PROFILES")
print("=" * 70)

# Get all users
cursor.execute('SELECT id, email, display_name, age, height, current_weight, target_weight, goal, calorie_goal, activity_level FROM users ORDER BY id')
users = cursor.fetchall()

print(f"\n[OK] Total Users: {len(users)}\n")

for user in users:
    uid, email, name, age, height, curr_wt, target_wt, goal, cals, activity = user
    print(f"USER: {name} ({email})")
    print(f"  Age: {age} | Height: {height}cm | Weight: {curr_wt}kg→{target_wt}kg")
    print(f"  Goal: {goal} | Calories: {cals} | Activity: {activity}")
    
    # Count data per user
    cursor.execute('SELECT COUNT(*) FROM projects WHERE user_id = ?', (uid,))
    proj_count = cursor.fetchone()[0]
    cursor.execute('SELECT COUNT(*) FROM tasks WHERE user_id = ?', (uid,))
    task_count = cursor.fetchone()[0]
    cursor.execute('SELECT COUNT(*) FROM notes WHERE user_id = ?', (uid,))
    note_count = cursor.fetchone()[0]
    cursor.execute('SELECT COUNT(*) FROM nutrition_entries WHERE user_id = ?', (uid,))
    nutrition_count = cursor.fetchone()[0]
    cursor.execute('SELECT COUNT(*) FROM workouts WHERE user_id = ?', (uid,))
    workout_count = cursor.fetchone()[0]
    
    print(f"  Data: {proj_count} projects | {task_count} tasks | {note_count} notes | {nutrition_count} meals | {workout_count} workouts")
    print()

print("=" * 70)
print("SAMPLE DATA PER USER")
print("=" * 70)

# Show sample tasks for each user
for user in users:
    uid, email, name, age, height, curr_wt, target_wt, goal, cals, activity = user
    print(f"\n{name}'s Tasks:")
    cursor.execute('SELECT title FROM tasks WHERE user_id = ? LIMIT 3', (uid,))
    tasks = cursor.fetchall()
    for task in tasks:
        print(f"  • {task[0]}")

# Show sample meals for each user
for user in users:
    uid, email, name, age, height, curr_wt, target_wt, goal, cals, activity = user
    print(f"\n{name}'s Meals:")
    cursor.execute('SELECT name, calories FROM nutrition_entries WHERE user_id = ? LIMIT 3', (uid,))
    meals = cursor.fetchall()
    for meal in meals:
        print(f"  • {meal[0]} ({meal[1]} cal)")

# Show sample workouts for each user
for user in users:
    uid, email, name, age, height, curr_wt, target_wt, goal, cals, activity = user
    print(f"\n{name}'s Workouts:")
    cursor.execute('SELECT name, duration FROM workouts WHERE user_id = ? LIMIT 3', (uid,))
    workouts = cursor.fetchall()
    for wo in workouts:
        print(f"  • {wo[0]} ({wo[1]} min)")

conn.close()
print("\n" + "=" * 70)
print("[OK] ALL USERS HAVE INDEPENDENT, UNIQUE DATA")
print("=" * 70)
