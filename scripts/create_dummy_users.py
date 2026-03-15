#!/usr/bin/env python3
"""
Create 3 dummy users with complete, distinct dummy data
"""
import sys
import os
import sqlite3
from datetime import datetime, timedelta
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.auth import hash_password
from app.utils import now_iso

DB_PATH = 'data/db.sqlite'
SCHEMA_PATH = 'db/schema.sql'

def init_db():
    """Initialize database with schema if needed"""
    os.makedirs('data', exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    # Always apply schema (IF NOT EXISTS clauses prevent errors)
    print(f"Initializing database schema...")
    with open(SCHEMA_PATH) as f:
        conn.executescript(f.read())
    conn.commit()
    conn.close()
    print("Database schema initialized")

def delete_existing_users(conn, emails):
    """Delete users by email if they exist"""
    cursor = conn.cursor()
    for email in emails:
        cursor.execute('DELETE FROM users WHERE email = ?', (email,))
    conn.commit()

def insert_user(conn, email, display_name, calorie_goal=2200):
    """Create a new user"""
    cursor = conn.cursor()
    password_hash = hash_password('demo1demo')
    
    cursor.execute('''
        INSERT INTO users 
        (email, password_hash, display_name, level, goal, weekly_workout_target, 
         calorie_goal, intro_seen_at, demo_completed_at, profile_essentials_completed_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        email,
        password_hash,
        display_name,
        'Beginner',
        'General Fitness',
        3,
        calorie_goal,
        now_iso(),
        now_iso(),
        now_iso()
    ))
    conn.commit()
    
    cursor.execute('SELECT id FROM users WHERE email = ?', (email,))
    user_id = cursor.fetchone()[0]
    print(f"  Created user: {email} (ID={user_id})")
    return user_id

def insert_project(conn, user_id, name):
    """Create a project"""
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO projects (user_id, name, created_at)
        VALUES (?, ?, ?)
    ''', (user_id, name, now_iso()))
    conn.commit()
    
    cursor.execute('SELECT id FROM projects WHERE user_id = ? AND name = ?', (user_id, name))
    return cursor.fetchone()[0]

def insert_task(conn, user_id, project_id, title, description, priority='high', completed=1):
    """Create a task"""
    cursor = conn.cursor()
    today = now_iso().split('T')[0]  # Get date portion only
    cursor.execute('''
        INSERT INTO tasks 
        (user_id, project_id, title, description, priority, completed, date, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (user_id, project_id, title, description, priority, completed, today, now_iso(), now_iso()))
    conn.commit()
    
    cursor.execute('SELECT id FROM tasks WHERE user_id = ? AND title = ? ORDER BY id DESC LIMIT 1', (user_id, title))
    result = cursor.fetchone()
    return result[0] if result else None

def insert_note(conn, user_id, title, content, task_id=None):
    """Create a note"""
    cursor = conn.cursor()
    source_type = 'task' if task_id else 'manual'
    cursor.execute('''
        INSERT INTO notes (user_id, title, content, source_type, source_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ''', (user_id, title, content, source_type, task_id, now_iso(), now_iso()))
    conn.commit()
    
    cursor.execute('SELECT id FROM notes WHERE user_id = ? AND title = ? ORDER BY id DESC LIMIT 1', (user_id, title))
    result = cursor.fetchone()
    return result[0] if result else None

def insert_meal(conn, user_id, meal_name, calories, protein, carbs, fat, date_str=None):
    """Create a meal entry"""
    if date_str is None:
        date_str = now_iso().split('T')[0]  # Get date portion only
    else:
        date_str = date_str.split('T')[0]
    
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO nutrition_entries 
        (user_id, name, meal_type, calories, protein, carbs, fats, date, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (user_id, meal_name, 'other', calories, protein, carbs, fat, date_str, now_iso(), now_iso()))
    conn.commit()

def insert_workout(conn, user_id, workout_name, duration_minutes, calories_burned, date_str=None):
    """Create a workout entry"""
    if date_str is None:
        date_str = now_iso().split('T')[0]  # Get date portion only
    else:
        date_str = date_str.split('T')[0]
    
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO workouts 
        (user_id, name, type, duration, calories_burned, completed, date, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (user_id, workout_name, 'other', duration_minutes, calories_burned, 1, date_str, now_iso(), now_iso()))
    conn.commit()

def seed_user_1(conn, user_id):
    """Seed first dummy user - Fitness Enthusiast"""
    print("\n  Seeding projects...")
    project_id = insert_project(conn, user_id, "Strength Training")
    
    print("  Seeding tasks...")
    task1_id = insert_task(conn, user_id, project_id, 
                          "Complete leg day workout",
                          "Focus on squats, lunges, and leg press - 60 mins")
    task2_id = insert_task(conn, user_id, project_id,
                          "Meal prep for the week",
                          "Prepare chicken, rice, and vegetables for 6 meals")
    task3_id = insert_task(conn, user_id, project_id,
                          "Track macros consistently",
                          "Log all meals to ensure protein goal of 150g daily")
    
    print("  Seeding notes...")
    insert_note(conn, user_id, "Workout Notes: Leg Day",
               "Today's leg session: 5x5 squats at 225lbs, 4x8 leg press, 3x10 lunges. Felt strong. Recovery: 8/10",
               task1_id)
    insert_note(conn, user_id, "Nutrition Plan",
               "High protein diet: 2500 cal/day, 150g protein, 250g carbs, 70g fat. Chicken breast, brown rice, broccoli.", 
               task2_id)
    insert_note(conn, user_id, "PR Goals",
               "Current: Bench 245lbs, Squat 315lbs, Deadlift 405lbs. Target: 275/365/450 by Q3 2026")
    
    print("  Seeding meals...")
    today = now_iso()
    insert_meal(conn, user_id, "Chicken & Rice Breakfast", 650, 45, 70, 15, today)
    insert_meal(conn, user_id, "Apple with Peanut Butter", 200, 8, 25, 8, today)
    insert_meal(conn, user_id, "Salmon & Broccoli Lunch", 720, 52, 60, 20, today)
    insert_meal(conn, user_id, "Protein Shake", 300, 30, 40, 5, today)
    insert_meal(conn, user_id, "Steak & Sweet Potato", 850, 65, 85, 28, today)
    
    print("  Seeding workouts...")
    insert_workout(conn, user_id, "Leg Day - Strength Training", 75, 650, today)
    insert_workout(conn, user_id, "Cardio - Treadmill Run", 30, 320, today)
    insert_workout(conn, user_id, "Core Workout", 20, 150, today)

def seed_user_2(conn, user_id):
    """Seed second dummy user - Weight Loss Focused"""
    print("\n  Seeding projects...")
    project_id = insert_project(conn, user_id, "Cut Phase")
    
    print("  Seeding tasks...")
    task1_id = insert_task(conn, user_id, project_id,
                          "Daily morning run",
                          "30-min jog at 6am to kickstart metabolism")
    task2_id = insert_task(conn, user_id, project_id,
                          "Stay under 1800 calories",
                          "Focus on vegetables, lean proteins, and low-fat options")
    task3_id = insert_task(conn, user_id, project_id,
                          "Drink 3L water daily",
                          "Stay hydrated to boost metabolism and reduce cravings")
    
    print("  Seeding notes...")
    insert_note(conn, user_id, "Morning Cardio Log",
               "6:00am jog - 5k in 28 mins. HR avg 155bpm. Great start to the day!",
               task1_id)
    insert_note(conn, user_id, "Weight Loss Strategy",
               "Calorie deficit: 1800/day (500 cal below TDEE). High protein (120g) to preserve muscle. 4 meals/day.", 
               task2_id)
    insert_note(conn, user_id, "Progress Update",
               "Week 3 of cut: Lost 4.5 lbs total. Current: 195 lbs. Goal: 175 lbs by June 2026. On track!")
    
    print("  Seeding meals...")
    today = now_iso()
    insert_meal(conn, user_id, "Egg White Scramble", 180, 30, 5, 3, today)
    insert_meal(conn, user_id, "Greek Yogurt & Berries", 150, 20, 20, 2, today)
    insert_meal(conn, user_id, "Grilled Chicken Salad", 320, 45, 15, 6, today)
    insert_meal(conn, user_id, "Protein Bar", 200, 20, 25, 5, today)
    insert_meal(conn, user_id, "Baked Tilapia & Veggies", 380, 50, 35, 8, today)
    
    print("  Seeding workouts...")
    insert_workout(conn, user_id, "Morning Run - Cardio", 30, 320, today)
    insert_workout(conn, user_id, "Circuit Training - HIIT", 40, 380, today)
    insert_workout(conn, user_id, "Evening Yoga", 45, 120, today)

def seed_user_3(conn, user_id):
    """Seed third dummy user - Balanced Lifestyle"""
    print("\n  Seeding projects...")
    project_id = insert_project(conn, user_id, "Wellness Journey")
    
    print("  Seeding tasks...")
    task1_id = insert_task(conn, user_id, project_id,
                          "Gym session 3x/week",
                          "Mix of strength and cardio. Monday, Wednesday, Friday")
    task2_id = insert_task(conn, user_id, project_id,
                          "Eat 5 servings of vegetables daily",
                          "Support immunity and maintain healthy weight")
    task3_id = insert_task(conn, user_id, project_id,
                          "Get 7-8 hours of sleep",
                          "Critical for recovery and mental health")
    
    print("  Seeding notes...")
    insert_note(conn, user_id, "Gym Session - Full Body",
               "Monday: Bench press 185x5, Squats 275x5, Rows 225x5. 60 mins total. Felt balanced.", 
               task1_id)
    insert_note(conn, user_id, "Nutrition Balance",
               "2200 cal/day target: 40% protein, 40% carbs, 20% fat. Whole foods focus. Occasional treats OK.",
               task2_id)
    insert_note(conn, user_id, "Wellness Goals",
               "Maintain current weight (185 lbs) while building functional strength. Focus on consistency over intensity.")
    
    print("  Seeding meals...")
    today = now_iso()
    insert_meal(conn, user_id, "Oatmeal with Banana", 320, 12, 55, 8, today)
    insert_meal(conn, user_id, "Turkey Sandwich", 450, 35, 45, 12, today)
    insert_meal(conn, user_id, "Pasta Primavera", 520, 18, 75, 14, today)
    insert_meal(conn, user_id, "Mixed Nuts & Fruit", 280, 10, 30, 16, today)
    insert_meal(conn, user_id, "Grilled Pork & Potatoes", 680, 52, 60, 22, today)
    
    print("  Seeding workouts...")
    insert_workout(conn, user_id, "Full Body Strength", 60, 420, today)
    insert_workout(conn, user_id, "Swimming Laps", 45, 350, today)
    insert_workout(conn, user_id, "Flexibility & Stretching", 30, 80, today)

def main():
    print("=" * 60)
    print("Creating 3 Dummy Users with Complete Data")
    print("=" * 60)
    
    # Initialize DB
    init_db()
    
    # Connect to database
    conn = sqlite3.connect(DB_PATH)
    
    # Delete existing dummy users
    dummy_emails = ['dummy1@test.com', 'dummy2@test.com', 'dummy3@test.com']
    print("\nDeleting existing dummy users...")
    delete_existing_users(conn, dummy_emails)
    
    # User 1: Fitness Enthusiast
    print("\n[User 1] Creating 'Fitness Enthusiast' (dummy1@test.com)")
    user1_id = insert_user(conn, 'dummy1@test.com', 'Fitness Enthusiast', 2800)
    seed_user_1(conn, user1_id)
    
    # User 2: Weight Loss Focused
    print("\n[User 2] Creating 'Weight Loss Warrior' (dummy2@test.com)")
    user2_id = insert_user(conn, 'dummy2@test.com', 'Weight Loss Warrior', 1800)
    seed_user_2(conn, user2_id)
    
    # User 3: Balanced Lifestyle
    print("\n[User 3] Creating 'Wellness Seeker' (dummy3@test.com)")
    user3_id = insert_user(conn, 'dummy3@test.com', 'Wellness Seeker', 2200)
    seed_user_3(conn, user3_id)
    
    conn.close()
    
    print("\n" + "=" * 60)
    print("✓ Successfully created 3 dummy users with complete data!")
    print("=" * 60)
    print("\nLogin credentials:")
    print("  Email: dummy1@test.com | Password: demo1demo")
    print("  Email: dummy2@test.com | Password: demo1demo")
    print("  Email: dummy3@test.com | Password: demo1demo")
    print("\nEach user has:")
    print("  - 3+ tasks with descriptions")
    print("  - 3+ notes (some linked to tasks)")
    print("  - 5 meal entries (~2200 cal balance)")
    print("  - 3 workout entries with different types")
    print("=" * 60)

if __name__ == '__main__':
    main()
