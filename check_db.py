#!/usr/bin/env python3
import sqlite3

conn = sqlite3.connect('data/db.sqlite')
cursor = conn.cursor()

# Check users
cursor.execute('SELECT COUNT(*) FROM users')
print(f'Total users: {cursor.fetchone()[0]}')

cursor.execute("SELECT id, email FROM users WHERE email LIKE '%dummy%' OR email LIKE '%d@%' OR email LIKE '%demo%'")
print("\nDemo/Dummy users:")
for user_id, email in cursor.fetchall():
    print(f"  ID={user_id}, email={email}")

# Check if tasks exist for demo users
cursor.execute("SELECT u.email, COUNT(t.id) FROM users u LEFT JOIN tasks t ON u.id = t.user_id WHERE u.email IN ('d@gmail.com', 'd1@gmail.com', 'demo@gmail.com', 'dummy1@test.com', 'dummy2@test.com', 'dummy3@test.com') GROUP BY u.id")
print("\nTask counts by user:")
for email, count in cursor.fetchall():
    print(f"  {email}: {count} tasks")

# Check meals
cursor.execute("SELECT u.email, COUNT(m.id) FROM users u LEFT JOIN meals m ON u.id = m.user_id WHERE u.email IN ('d@gmail.com', 'd1@gmail.com', 'demo@gmail.com', 'dummy1@test.com', 'dummy2@test.com', 'dummy3@test.com') GROUP BY u.id")
print("\nMeal counts by user:")
for email, count in cursor.fetchall():
    print(f"  {email}: {count} meals")

# Check workouts
cursor.execute("SELECT u.email, COUNT(w.id) FROM users u LEFT JOIN workouts w ON u.id = w.user_id WHERE u.email IN ('d@gmail.com', 'd1@gmail.com', 'demo@gmail.com', 'dummy1@test.com', 'dummy2@test.com', 'dummy3@test.com') GROUP BY u.id")
print("\nWorkout counts by user:")
for email, count in cursor.fetchall():
    print(f"  {email}: {count} workouts")

# Check notes
cursor.execute("SELECT u.email, COUNT(n.id) FROM users u LEFT JOIN notes n ON u.id = n.user_id WHERE u.email IN ('d@gmail.com', 'd1@gmail.com', 'demo@gmail.com', 'dummy1@test.com', 'dummy2@test.com', 'dummy3@test.com') GROUP BY u.id")
print("\nNote counts by user:")
for email, count in cursor.fetchall():
    print(f"  {email}: {count} notes")

conn.close()
