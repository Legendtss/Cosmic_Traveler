#!/usr/bin/env python3
"""
Create 3 dummy users with COMPLETE, UNIQUE, INDEPENDENT data.
Each user has:
- Unique profile information (age, height, weight, goals)
- Unique projects with different themes
- Unique tasks with different content
- Unique meals with different preferences
- Unique workouts with different specialties
- Unique notes with different perspectives
- Complete user_progress tracking
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

DB_PATH = 'data/fitness.sqlite'
SCHEMA_PATH = 'db/schema.sql'

def init_db():
    """Initialize database with schema"""
    os.makedirs('data', exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    print(f"Initializing database schema...")
    with open(SCHEMA_PATH) as f:
        conn.executescript(f.read())
    conn.commit()
    conn.close()
    print("Database schema initialized\n")

def delete_existing_users(conn, emails):
    """Delete users and ALL their data"""
    cursor = conn.cursor()
    for email in emails:
        # Get user_id first
        cursor.execute('SELECT id FROM users WHERE email = ?', (email,))
        result = cursor.fetchone()
        if result:
            user_id = result[0]
            # Delete in cascade order
            cursor.execute('DELETE FROM focus_sessions WHERE user_id = ?', (user_id,))
            cursor.execute('DELETE FROM stats_snapshots WHERE user_id = ?', (user_id,))
            cursor.execute('DELETE FROM user_progress WHERE user_id = ?', (user_id,))
            cursor.execute('DELETE FROM goals WHERE user_id = ?', (user_id,))
            cursor.execute('DELETE FROM nutrition_entries WHERE user_id = ?', (user_id,))
            cursor.execute('DELETE FROM workouts WHERE user_id = ?', (user_id,))
            cursor.execute('DELETE FROM notes WHERE user_id = ?', (user_id,))
            cursor.execute('DELETE FROM tasks WHERE user_id = ?', (user_id,))
            cursor.execute('DELETE FROM projects WHERE user_id = ?', (user_id,))
            cursor.execute('DELETE FROM sessions WHERE user_id = ?', (user_id,))
            cursor.execute('DELETE FROM users WHERE id = ?', (user_id,))
    conn.commit()

def insert_user_complete(conn, email, display_name, age, height, weight, target_weight, 
                         calorie_goal, activity_level, goal_desc, weight_goal_weeks=12):
    """Create user with COMPLETE profile data"""
    cursor = conn.cursor()
    password_hash = hash_password('demo1demo')
    
    # Calculate daily calorie delta based on weight change goal
    # Assuming 0.5 kg per week (3500 cal/kg = 1750 cal/week)
    weight_diff = target_weight - weight
    daily_delta = (weight_diff / weight_goal_weeks) * 1750 / 7
    
    now = now_iso()
    cursor.execute('''
        INSERT INTO users 
        (email, password_hash, display_name, level, goal, weekly_workout_target, 
         calorie_goal, age, height, current_weight, target_weight, weight_goal_duration_weeks,
         daily_calorie_delta, activity_level,
         intro_seen_at, demo_completed_at, profile_essentials_completed_at,
         created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        email, password_hash, display_name, 'Intermediate', goal_desc, 4,
        calorie_goal, age, height, weight, target_weight, weight_goal_weeks,
        daily_delta, activity_level, now, now, now, now, now
    ))
    conn.commit()
    
    cursor.execute('SELECT id FROM users WHERE email = ?', (email,))
    user_id = cursor.fetchone()[0]
    print(f"  ✓ User: {display_name} ({email})")
    print(f"    Profile: {age}yo, {height}cm, {weight}kg → {target_weight}kg, {calorie_goal} cal/day")
    
    # Create user_progress entry
    cursor.execute('''
        INSERT INTO user_progress (user_id, total_points, current_streak, longest_streak, level, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
    ''', (user_id, 0, 0, 0, 1, now))
    conn.commit()
    
    return user_id

def insert_project(conn, user_id, name, description=""):
    """Create a project"""
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO projects (user_id, name, description, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
    ''', (user_id, name, description, now_iso(), now_iso()))
    conn.commit()
    
    cursor.execute('SELECT id FROM projects WHERE user_id = ? AND name = ? ORDER BY id DESC LIMIT 1', (user_id, name))
    return cursor.fetchone()[0]

def insert_task(conn, user_id, project_id, title, description, priority='high', completed=1):
    """Create a task"""
    cursor = conn.cursor()
    today = now_iso().split('T')[0]
    cursor.execute('''
        INSERT INTO tasks 
        (user_id, project_id, title, description, priority, completed, date, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (user_id, project_id, title, description, priority, completed, today, now_iso(), now_iso()))
    conn.commit()
    
    cursor.execute('SELECT id FROM tasks WHERE user_id = ? AND title = ? ORDER BY id DESC LIMIT 1', (user_id, title))
    return cursor.fetchone()[0]

def insert_note(conn, user_id, title, content, task_id=None):
    """Create a note (completely independent per user)"""
    cursor = conn.cursor()
    source_type = 'task' if task_id else 'manual'
    cursor.execute('''
        INSERT INTO notes (user_id, title, content, source_type, source_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ''', (user_id, title, content, source_type, task_id, now_iso(), now_iso()))
    conn.commit()

def insert_meal(conn, user_id, meal_name, calories, protein, carbs, fat):
    """Create a meal entry"""
    date_str = now_iso().split('T')[0]
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO nutrition_entries 
        (user_id, name, meal_type, calories, protein, carbs, fats, date, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (user_id, meal_name, 'other', calories, protein, carbs, fat, date_str, now_iso(), now_iso()))
    conn.commit()

def insert_workout(conn, user_id, workout_name, duration_minutes, calories_burned):
    """Create a workout entry"""
    date_str = now_iso().split('T')[0]
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO workouts 
        (user_id, name, type, duration, calories_burned, completed, date, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (user_id, workout_name, 'other', duration_minutes, calories_burned, 1, date_str, now_iso(), now_iso()))
    conn.commit()

def insert_goal(conn, user_id, title, description, category, current_progress=25, time_limit=None):
    """Create a personal goal entry"""
    cursor = conn.cursor()
    deadline_str = time_limit if time_limit else (datetime.now() + timedelta(days=90)).strftime('%Y-%m-%d')
    cursor.execute('''
        INSERT INTO goals 
        (user_id, title, description, category, target_progress, current_progress, time_limit, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (user_id, title, description, category, 100, current_progress, deadline_str, 'active', now_iso(), now_iso()))
    conn.commit()

def seed_user_1_athlete(conn, user_id):
    """User 1: Alex - Athletic Bodybuilder (Age 26, Male, Muscle Building)"""
    print("\n  Seeding User 1 (Athlete): Projects, Tasks, Notes, Meals, Workouts...")
    
    # PROJECT: Hypertrophy
    proj1 = insert_project(conn, user_id, "Muscle Building Phase", "Focus on hypertrophy with 4x/week split")
    
    # TASKS
    t1 = insert_task(conn, user_id, proj1, "Complete upper body volume day", "4x100 reps chest, back, shoulders", 'high', 1)
    t2 = insert_task(conn, user_id, proj1, "Meal prep high-protein meals", "Prepare 8 chicken + rice meals, 50g protein each", 'high', 1)
    t3 = insert_task(conn, user_id, proj1, "Track daily macros", "Ensure 200g protein, 350g carbs, 80g fat daily", 'high', 1)
    
    # NOTES (UNIQUE TO USER 1)
    insert_note(conn, user_id, "Upper Body Session Log", 
               "Chest: Bench 315x5, Incline 275x6, Cable flies 4x12\nBack: Rows 315x5, Chins 5x6, Lat pulldown 4x15\nFEELING STRONG TODAY!", t1)
    insert_note(conn, user_id, "Nutrition Strategy - MASS PHASE",
               "Eating in surplus: 3200 cal/day target. Focus on lean mass gains. Morning: oats+whey, Pre-workout: banana+rice, Post: dextrose+whey, Dinner: steak+pasta", t2)
    insert_note(conn, user_id, "Goals & PRs",
               "Current: Bench 315 lbs, Squat 405 lbs, Deadlift 525 lbs\nTarget: 365/475/585 by Dec 2026\nStrengthening triceps and quads for weak points")
    
    # MEALS (5-6 per day, high protein)
    insert_meal(conn, user_id, "Oatmeal with Whey & Banana", 420, 35, 55, 8)
    insert_meal(conn, user_id, "Rice & Grilled Chicken Breast", 650, 65, 75, 10)
    insert_meal(conn, user_id, "Protein Shake (Dextrose)", 380, 40, 50, 5)
    insert_meal(conn, user_id, "Salmon with Sweet Potato", 720, 58, 85, 20)
    insert_meal(conn, user_id, "Ground Beef Pasta", 890, 72, 95, 28)
    insert_meal(conn, user_id, "Casein Shake Before Bed", 300, 45, 25, 3)
    
    # WORKOUTS (strength focused, high volume)
    insert_workout(conn, user_id, "Upper Body Hypertrophy - Chest & Back", 75, 650)
    insert_workout(conn, user_id, "Lower Body Strength - Squats & Legs", 90, 750)
    insert_workout(conn, user_id, "Accessory Work - Arms & Shoulders", 60, 450)
    
    # GOALS (personal goals with blur reveal progression)
    insert_goal(conn, user_id, "Build 25 pounds of muscle", "Winter bulk phase with 4x/week training", "Fitness", 35, "2026-06-30")
    insert_goal(conn, user_id, "Bench Press 365 lbs", "Break through current 315 lbs plateau", "Strength", 60)
    insert_goal(conn, user_id, "Master perfect form squats", "Record all lifts for technique review", "Technique", 25)

def seed_user_2_marathon(conn, user_id):
    """User 2: Jordan - Marathon Runner (Age 35, Female, Endurance/Weight Loss)"""
    print("\n  Seeding User 2 (Marathon Runner): Projects, Tasks, Notes, Meals, Workouts...")
    
    # PROJECT: Marathon Training
    proj1 = insert_project(conn, user_id, "Marathon Training 2026", "Complete marathon by October 2026, lose 8 lbs")
    
    # TASKS
    t1 = insert_task(conn, user_id, proj1, "20-mile long run this weekend", "Start early 6am, maintain 9:30/mi pace, marathon goal: 4:10", 'high', 1)
    t2 = insert_task(conn, user_id, proj1, "Track running volume for week", "Target: 50 miles, 6 runs, 1 rest day", 'high', 1)
    t3 = insert_task(conn, user_id, proj1, "Prepare lightweight race kit", "New running shoes broken in, race bib ready, watch charged", 'medium', 1)
    
    # NOTES (COMPLETELY DIFFERENT FROM USER 1)
    insert_note(conn, user_id, "Long Run Report",
               "This morning: 18 miles in 2:41. Felt strong but hit wall at mile 16. Hydrated every 2 miles with electrolyte drink. Weather perfect (55F, no wind). Great data for marathon prediction!", t1)
    insert_note(conn, user_id, "Nutrition for Distance - LOW CALORIE DEFICIT",
               "1800 cal/day target (200-calorie deficit for gradual loss). Focus: whole grains, lean protein, lots of fruits for carb-loading on long run days. Running on fumes some days - need balance!", t2)
    insert_note(conn, user_id, "Race Strategy & Mental Notes",
               "Marathon pace: 9:30/mile for 4:10 finish. Split strategy: miles 1-10 conservative, 11-20 steady, 21-26.2 push hard. Weather forecast: 65F, humid. Trained in heat - ready!")
    
    # MEALS (moderate, focus on FUEL not gain)
    insert_meal(conn, user_id, "Egg Toast with Berries", 310, 15, 45, 8)
    insert_meal(conn, user_id, "Chicken Breast & Vegetables", 380, 50, 30, 5)
    insert_meal(conn, user_id, "Tuna Sandwich (whole wheat)", 420, 35, 50, 8)
    insert_meal(conn, user_id, "Pasta with Tomato Sauce", 480, 18, 75, 8)
    insert_meal(conn, user_id, "Greek Yogurt & Granola", 250, 20, 32, 5)
    
    # WORKOUTS (endurance, running focused)
    insert_workout(conn, user_id, "Easy 8-mile recovery run", 65, 610)
    insert_workout(conn, user_id, "Speed work - 6x1000m intervals", 55, 680)
    insert_workout(conn, user_id, "20-mile long run", 130, 1240)
    
    # GOALS (personal goals with blur reveal progression)
    insert_goal(conn, user_id, "Complete marathon in sub 4:10", "Training for October 2026 race day", "Running", 40, "2026-10-15")
    insert_goal(conn, user_id, "Lose 8 lbs for speed", "Cut from 65kg to 57kg for better pace", "Fitness", 25, "2026-08-31")
    insert_goal(conn, user_id, "Run without knee pain", "Increase mileage while maintaining joint health", "Health", 50)

def seed_user_3_wellness(conn, user_id):
    """User 3: Sam - Wellness Practitioner (Age 42, Non-binary, Balanced Fitness)"""
    print("\n  Seeding User 3 (Wellness): Projects, Tasks, Notes, Meals, Workouts...")
    
    # PROJECT: Holistic Wellness
    proj1 = insert_project(conn, user_id, "Holistic Wellness Journey", "Balance strength, flexibility, and mental health")
    
    # TASKS
    t1 = insert_task(conn, user_id, proj1, "Complete morning yoga & meditation", "20 min yoga + 10 min meditation for mental clarity", 'high', 1)
    t2 = insert_task(conn, user_id, proj1, "Prepare balanced whole-food meals", "Cook from scratch 3x this week, track ingredients", 'medium', 1)
    t3 = insert_task(conn, user_id, proj1, "Log stress levels and sleep quality", "Using app to correlate sleep, stress, workout recovery", 'medium', 1)
    
    # NOTES (UNIQUE WELLNESS PERSPECTIVE)
    insert_note(conn, user_id, "Morning Practice - Yoga & Mindfulness",
               "Started with breathing (ujjayi pranayama), 20 minutes gentle flow focusing on hip openers. Ended with 10-minute meditation on gratitude. Feeling centered and ready for the day. Sleep last night: 8 hours.", t1)
    insert_note(conn, user_id, "Nutrition Philosophy - WHOLE FOODS",
               "2100 cal/day, 50% whole grains, 30% lean proteins, 20% healthy fats. Today: homemade buddha bowl with quinoa, roasted veggies, tahini dressing, walnuts. Mindful eating practice - no screens while eating.", t2)
    insert_note(conn, user_id, "Wellness & Recovery Tracking",
               "HRV score 52 (excellent recovery), sleep 8.2 hours, felt energized today. Connection: better sleep + less stress = better workouts. Starting to see patterns. Next goal: consistent 8-hour sleep for 30 days straight.")
    
    # MEALS (balanced, whole foods focus)
    insert_meal(conn, user_id, "Smoothie Bowl (granola, berries)", 380, 12, 65, 8)
    insert_meal(conn, user_id, "Buddha Bowl (quinoa, tofu, veggies)", 520, 22, 65, 15)
    insert_meal(conn, user_id, "Salmon Salad with Olive Oil", 480, 35, 30, 22)
    insert_meal(conn, user_id, "Lentil Soup with Whole Grain Bread", 420, 18, 60, 8)
    insert_meal(conn, user_id, "Nuts & Fruit Snack Plate", 310, 10, 40, 14)
    
    # WORKOUTS (balanced, varied, low intensity focus)
    insert_workout(conn, user_id, "Yoga Session - Gentle Flow", 50, 180)
    insert_workout(conn, user_id, "Resistance Training - Full Body", 60, 320)
    insert_workout(conn, user_id, "Hiking in Nature", 90, 400)
    
    # GOALS (personal goals with blur reveal progression)
    insert_goal(conn, user_id, "50-day meditation streak", "Daily 10-minute morning practice for mental clarity", "Wellness", 45, "2026-05-30")
    insert_goal(conn, user_id, "Achieve perfect sleep schedule", "Consistent 8 hours nightly between 10pm-6am", "Health", 30)
    insert_goal(conn, user_id, "Master advanced yoga poses", "Work toward handstand and full splits", "Flexibility", 55)

def main():
    print("\n" + "="*70)
    print("  CREATING 3 UNIQUE DUMMY USERS WITH COMPLETE PROFILE DATA")
    print("="*70)
    
    # Initialize DB
    init_db()
    
    # Connect to database
    conn = sqlite3.connect(DB_PATH)
    conn.execute('PRAGMA foreign_keys = ON')
    
    # Delete existing dummy users
    dummy_emails = ['dummy1@test.com', 'dummy2@test.com', 'dummy3@test.com']
    print("Deleting existing dummy users...")
    delete_existing_users(conn, dummy_emails)
    
    # USER 1: ATHLETE - Alex, 26, bodybuilder
    print("\n[USER 1/3] Creating: ALEX (26yo Athlete, Muscle Gain)")
    user1_id = insert_user_complete(
        conn, 
        email='dummy1@test.com',
        display_name='Alex',
        age=26,
        height=180,  # cm
        weight=92,   # kg (currently)
        target_weight=100,  # building muscle
        calorie_goal=3200,
        activity_level='very_active',
        goal_desc='Muscle Gain'
    )
    seed_user_1_athlete(conn, user1_id)
    
    # USER 2: ENDURANCE - Jordan, 35, marathon runner
    print("\n[USER 2/3] Creating: JORDAN (35yo Marathon Runner, Weight Loss)")
    user2_id = insert_user_complete(
        conn,
        email='dummy2@test.com',
        display_name='Jordan',
        age=35,
        height=168,  # cm
        weight=65,   # kg (trying to lose)
        target_weight=57,  # marathon target (8 lbs loss)
        calorie_goal=1800,
        activity_level='very_active',
        goal_desc='Weight Loss'
    )
    seed_user_2_marathon(conn, user2_id)
    
    # USER 3: WELLNESS - Sam, 42, balanced
    print("\n[USER 3/3] Creating: SAM (42yo Wellness Seeker, Balance & Health)")
    user3_id = insert_user_complete(
        conn,
        email='dummy3@test.com',
        display_name='Sam',
        age=42,
        height=172,  # cm
        weight=75,   # kg (stable)
        target_weight=75,  # maintain
        calorie_goal=2100,
        activity_level='active',
        goal_desc='Maintain Fitness'
    )
    seed_user_3_wellness(conn, user3_id)
    
    conn.close()
    
    print("\n" + "="*70)
    print("✓ SUCCESSFULLY CREATED 3 COMPLETELY UNIQUE DUMMY USERS!")
    print("="*70)
    print("\nLogin Credentials:")
    print("  Email: dummy1@test.com | Password: demo1demo | Profile: ALEX (Athlete)")
    print("  Email: dummy2@test.com | Password: demo1demo | Profile: JORDAN (Marathon)")
    print("  Email: dummy3@test.com | Password: demo1demo | Profile: SAM (Wellness)")
    print("\nEach user has:")
    print("  ✓ Complete profile (age, height, weight, goals, activity level)")
    print("  ✓ Unique projects tailored to their fitness style")
    print("  ✓ Unique tasks and goals")
    print("  ✓ Unique notes from different perspectives")
    print("  ✓ Personalized meal plans (building/deficit/maintenance)")
    print("  ✓ Distinct workout styles (strength/endurance/balanced)")
    print("  ✓ Independent data (NO data sharing between users)")
    print("="*70 + "\n")

if __name__ == '__main__':
    main()
    print("=" * 60)

if __name__ == '__main__':
    main()
