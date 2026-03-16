#!/usr/bin/env python3
import sqlite3

conn = sqlite3.connect('data/fitness.sqlite')
conn.row_factory = sqlite3.Row
cursor = conn.cursor()

cursor.execute('SELECT id, display_name FROM users WHERE email IN (?, ?, ?)',
               ('dummy1@test.com', 'dummy2@test.com', 'dummy3@test.com'))
users = cursor.fetchall()

print("\n" + "="*70)
print("GOALS VERIFICATION")
print("="*70)

for user in users:
    user_id = user['id']
    print(f"\n{user['display_name']} (User #{user_id}):")
    cursor.execute('SELECT id, title, category, current_progress, status FROM goals WHERE user_id = ? ORDER BY id', (user_id,))
    goals = cursor.fetchall()
    if not goals:
        print("  ⚠️  No goals found!")
    else:
        for goal in goals:
            unlocked = int((goal['current_progress'] / 100) * 10)
            print(f"  ✓ {goal['title']}")
            print(f"    Category: {goal['category']} | Progress: {goal['current_progress']}%")
            print(f"    Status: {goal['status']} | Segments unlocked: {unlocked}/10")

print("\n" + "="*70)
conn.close()
