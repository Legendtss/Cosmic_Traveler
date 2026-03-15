"""
Seed showcase users with rich, linked demo data.

Creates or updates the following accounts with password demo1demo:
- d@gmail.com
- d1@gmail.com
- demo@gmail.com

For each account, this script replaces only that user's data with a
comprehensive dataset spanning projects/subtasks, tasks, notes, nutrition,
workouts, focus sessions, stats snapshots, and user progress.

Usage:
  python scripts/seed_showcase_users.py
"""

import json
from datetime import date, datetime, timedelta

from app.auth import hash_password
from app.db import get_db
from app.utils import now_iso

SHOWCASE_PASSWORD = "demo1demo"

SHOWCASE_USERS = [
    {
        "email": "d@gmail.com",
        "display_name": "D User",
        "level": "Intermediate",
        "goal": "Weight Loss",
        "weekly_workout_target": 5,
        "calorie_goal": 2100,
        "age": 29,
        "height": 172,
        "current_weight": 78.4,
        "target_weight": 71.0,
        "weight_goal_duration_weeks": 14,
        "daily_calorie_delta": -420.0,
        "activity_level": "active",
        "progress": {"total_points": 1340, "current_streak": 9, "longest_streak": 17, "level": 5},
    },
    {
        "email": "d1@gmail.com",
        "display_name": "D1 User",
        "level": "Beginner",
        "goal": "Maintain Fitness",
        "weekly_workout_target": 4,
        "calorie_goal": 2350,
        "age": 24,
        "height": 168,
        "current_weight": 63.2,
        "target_weight": 63.0,
        "weight_goal_duration_weeks": 10,
        "daily_calorie_delta": 0.0,
        "activity_level": "moderate",
        "progress": {"total_points": 820, "current_streak": 6, "longest_streak": 11, "level": 3},
    },
    {
        "email": "demo@gmail.com",
        "display_name": "Demo User",
        "level": "Advanced",
        "goal": "Muscle Gain",
        "weekly_workout_target": 6,
        "calorie_goal": 2850,
        "age": 32,
        "height": 181,
        "current_weight": 76.0,
        "target_weight": 82.0,
        "weight_goal_duration_weeks": 18,
        "daily_calorie_delta": 340.0,
        "activity_level": "very_active",
        "progress": {"total_points": 1985, "current_streak": 13, "longest_streak": 24, "level": 7},
    },
]


def _day_str(days_ago):
    return (date.today() - timedelta(days=days_ago)).isoformat()


def _time_for(index, hour_start=6):
    hour = (hour_start + index) % 24
    minute = (index * 7) % 60
    return f"{hour:02d}:{minute:02d}"


def _dt_for(day_iso, hhmm):
    return f"{day_iso}T{hhmm}:00"


def _ensure_user(db, user_profile):
    now = now_iso()
    email = user_profile["email"].strip().lower()
    password_hash = hash_password(SHOWCASE_PASSWORD)

    existing = db.execute("SELECT id FROM users WHERE email = ?", (email,)).fetchone()
    if existing:
        user_id = existing["id"]
        db.execute(
            """
            UPDATE users
            SET password_hash = ?,
                display_name = ?,
                level = ?,
                goal = ?,
                weekly_workout_target = ?,
                calorie_goal = ?,
                age = ?,
                height = ?,
                current_weight = ?,
                target_weight = ?,
                weight_goal_duration_weeks = ?,
                daily_calorie_delta = ?,
                activity_level = ?,
                intro_seen_at = ?,
                demo_completed_at = ?,
                profile_essentials_completed_at = ?,
                updated_at = ?
            WHERE id = ?
            """,
            (
                password_hash,
                user_profile["display_name"],
                user_profile["level"],
                user_profile["goal"],
                user_profile["weekly_workout_target"],
                user_profile["calorie_goal"],
                user_profile["age"],
                user_profile["height"],
                user_profile["current_weight"],
                user_profile["target_weight"],
                user_profile["weight_goal_duration_weeks"],
                user_profile["daily_calorie_delta"],
                user_profile["activity_level"],
                now,
                now,
                now,
                now,
                user_id,
            ),
        )
        return user_id

    cursor = db.execute(
        """
        INSERT INTO users (
            email, password_hash, display_name, level, goal,
            weekly_workout_target, calorie_goal,
            age, height, current_weight, target_weight,
            weight_goal_duration_weeks, daily_calorie_delta,
            activity_level,
            intro_seen_at, demo_completed_at, profile_essentials_completed_at,
            created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            email,
            password_hash,
            user_profile["display_name"],
            user_profile["level"],
            user_profile["goal"],
            user_profile["weekly_workout_target"],
            user_profile["calorie_goal"],
            user_profile["age"],
            user_profile["height"],
            user_profile["current_weight"],
            user_profile["target_weight"],
            user_profile["weight_goal_duration_weeks"],
            user_profile["daily_calorie_delta"],
            user_profile["activity_level"],
            now,
            now,
            now,
            now,
            now,
        ),
    )
    return cursor.lastrowid


def _clear_user_data(db, user_id, email):
    db.execute("DELETE FROM notes WHERE user_id = ?", (user_id,))
    db.execute("DELETE FROM tasks WHERE user_id = ?", (user_id,))
    db.execute("DELETE FROM projects WHERE user_id = ?", (user_id,))
    db.execute("DELETE FROM workouts WHERE user_id = ?", (user_id,))
    db.execute("DELETE FROM workout_templates WHERE user_id = ?", (user_id,))
    db.execute("DELETE FROM nutrition_entries WHERE user_id = ?", (user_id,))
    db.execute("DELETE FROM focus_sessions WHERE user_id = ?", (user_id,))
    db.execute("DELETE FROM stats_snapshots WHERE user_id = ?", (user_id,))
    db.execute("DELETE FROM user_progress WHERE user_id = ?", (user_id,))
    db.execute("DELETE FROM sessions WHERE user_id = ?", (user_id,))
    db.execute("DELETE FROM login_attempts WHERE identifier = ?", (f"email:{email}",))


def _current_showcase_counts(db, user_id):
    return {
        "projects": int(db.execute("SELECT COUNT(*) AS c FROM projects WHERE user_id = ?", (user_id,)).fetchone()["c"] or 0),
        "tasks": int(db.execute("SELECT COUNT(*) AS c FROM tasks WHERE user_id = ?", (user_id,)).fetchone()["c"] or 0),
        "notes": int(db.execute("SELECT COUNT(*) AS c FROM notes WHERE user_id = ?", (user_id,)).fetchone()["c"] or 0),
        "meals": int(db.execute("SELECT COUNT(*) AS c FROM nutrition_entries WHERE user_id = ?", (user_id,)).fetchone()["c"] or 0),
        "workouts": int(db.execute("SELECT COUNT(*) AS c FROM workouts WHERE user_id = ?", (user_id,)).fetchone()["c"] or 0),
        "workout_templates": int(db.execute("SELECT COUNT(*) AS c FROM workout_templates WHERE user_id = ?", (user_id,)).fetchone()["c"] or 0),
        "focus_sessions": int(db.execute("SELECT COUNT(*) AS c FROM focus_sessions WHERE user_id = ?", (user_id,)).fetchone()["c"] or 0),
        "stats_snapshots": int(db.execute("SELECT COUNT(*) AS c FROM stats_snapshots WHERE user_id = ?", (user_id,)).fetchone()["c"] or 0),
    }


def _has_showcase_payload(db, user_id):
    counts = _current_showcase_counts(db, user_id)
    return (
        counts["projects"] >= 3
        and counts["tasks"] >= 15
        and counts["notes"] >= 8
        and counts["meals"] >= 24
        and counts["workouts"] >= 8
    )


def _insert_project(db, user_id, *, name, description, status, due_date, subtasks):
    now = now_iso()
    cursor = db.execute(
        """
        INSERT INTO projects (user_id, name, description, status, due_date, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (user_id, name, description, status, due_date, now, now),
    )
    project_id = cursor.lastrowid

    for idx, title in enumerate(subtasks):
        db.execute(
            """
            INSERT INTO project_subtasks (project_id, title, completed, sort_order, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (project_id, title, 0, idx, now, now),
        )
    return project_id


def _insert_task(
    db,
    user_id,
    *,
    project_id,
    title,
    description,
    tags,
    category,
    priority,
    completed,
    day_iso,
    time_spent,
    recurrence,
    note_content,
    note_saved,
):
    now = now_iso()
    cursor = db.execute(
        """
        INSERT INTO tasks (
            user_id, project_id, title, description, tags_json, category,
            priority, completed, date, time_spent,
            note_content, note_saved_to_notes, recurrence, recurrence_parent_id,
            created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            user_id,
            project_id,
            title,
            description,
            json.dumps(tags),
            category,
            priority,
            1 if completed else 0,
            day_iso,
            max(0, int(time_spent)),
            note_content,
            1 if note_saved else 0,
            recurrence,
            None,
            now,
            now,
        ),
    )
    return cursor.lastrowid


def _insert_manual_note(db, user_id, *, title, content, tags, day_iso, hhmm):
    created_at = _dt_for(day_iso, hhmm)
    db.execute(
        """
        INSERT INTO notes (user_id, title, content, source_type, source_id, tags_json, created_at, updated_at)
        VALUES (?, ?, ?, 'manual', NULL, ?, ?, ?)
        """,
        (user_id, title, content, json.dumps(tags), created_at, created_at),
    )


def _insert_task_note(db, user_id, *, task_id, title, content, tags, day_iso, hhmm):
    created_at = _dt_for(day_iso, hhmm)
    db.execute(
        """
        INSERT INTO notes (user_id, title, content, source_type, source_id, tags_json, created_at, updated_at)
        VALUES (?, ?, ?, 'task', ?, ?, ?, ?)
        """,
        (user_id, title, content, task_id, json.dumps(tags), created_at, created_at),
    )


def _seed_projects(db, user_id):
    projects = {}
    projects["launch"] = _insert_project(
        db,
        user_id,
        name="Website Relaunch",
        description="Coordinate content, assets, QA, and launch checklist for relaunch week.",
        status="active",
        due_date=_day_str(-5),
        subtasks=[
            "Finalize landing copy",
            "Approve hero visuals",
            "Cross-browser QA",
            "Update analytics events",
            "Launch readiness review",
        ],
    )
    projects["wellness"] = _insert_project(
        db,
        user_id,
        name="90-Day Wellness Sprint",
        description="Combine fitness, nutrition, and focus habits for measurable progress.",
        status="active",
        due_date=_day_str(-30),
        subtasks=[
            "Track weekly weight trend",
            "Hit protein target 5x/week",
            "Close rings 6 days/week",
            "Meditate 10 minutes daily",
            "Review progress every Sunday",
        ],
    )
    projects["study"] = _insert_project(
        db,
        user_id,
        name="Data Skills Upgrade",
        description="Practical analytics upskilling with portfolio-ready outputs.",
        status="active",
        due_date=_day_str(-21),
        subtasks=[
            "Finish SQL module",
            "Build dashboard mini-project",
            "Publish one case study",
            "Practice interview questions",
        ],
    )
    projects["personal"] = _insert_project(
        db,
        user_id,
        name="Home Reset",
        description="Declutter and reorganize key zones before next month.",
        status="completed",
        due_date=_day_str(1),
        subtasks=[
            "Wardrobe sort",
            "Desk cable management",
            "Kitchen pantry refresh",
            "Donation drop-off",
        ],
    )
    return projects


def _seed_tasks_and_notes(db, user_id, project_ids):
    task_specs = [
        {
            "title": "Plan week priorities",
            "description": "Define top 3 outcomes before deep work starts.",
            "tags": ["planning", "weekly"],
            "category": "work",
            "priority": "high",
            "completed": True,
            "day": 6,
            "time_spent": 35,
            "recurrence": "weekly",
            "project": "launch",
            "note": "Keep scope lean; defer non-critical improvements.",
            "save_note": True,
        },
        {
            "title": "Morning mobility routine",
            "description": "10-minute mobility sequence before breakfast.",
            "tags": ["health", "routine"],
            "category": "health",
            "priority": "medium",
            "completed": True,
            "day": 0,
            "time_spent": 12,
            "recurrence": "daily",
            "project": "wellness",
            "note": "Hip flexor stretch is helping lower-back tension.",
            "save_note": True,
        },
        {
            "title": "Prep high-protein lunch",
            "description": "Batch prep for next two workdays.",
            "tags": ["nutrition", "meal-prep"],
            "category": "health",
            "priority": "high",
            "completed": True,
            "day": 1,
            "time_spent": 28,
            "recurrence": "weekdays",
            "project": "wellness",
            "note": "Chicken, quinoa, greens bowls ready for 2 days.",
            "save_note": True,
        },
        {
            "title": "Finalize dashboard wireframe",
            "description": "Align component states and mobile breakpoints.",
            "tags": ["design", "ui"],
            "category": "work",
            "priority": "high",
            "completed": False,
            "day": 0,
            "time_spent": 55,
            "recurrence": "none",
            "project": "launch",
            "note": "Need one more pass on empty/loading states.",
            "save_note": True,
        },
        {
            "title": "Refactor analytics query",
            "description": "Remove duplicate joins and improve response time.",
            "tags": ["sql", "performance"],
            "category": "study",
            "priority": "medium",
            "completed": True,
            "day": 3,
            "time_spent": 74,
            "recurrence": "none",
            "project": "study",
            "note": "Reduced runtime by about 35 percent.",
            "save_note": True,
        },
        {
            "title": "Review sprint backlog",
            "description": "Flag blockers and assign owners.",
            "tags": ["planning", "team"],
            "category": "work",
            "priority": "high",
            "completed": True,
            "day": 2,
            "time_spent": 42,
            "recurrence": "weekly",
            "project": "launch",
            "note": "Two blockers moved to next sprint.",
            "save_note": False,
        },
        {
            "title": "Read chapter on model evaluation",
            "description": "Summarize practical metrics tradeoffs.",
            "tags": ["study", "ml"],
            "category": "study",
            "priority": "medium",
            "completed": False,
            "day": 0,
            "time_spent": 0,
            "recurrence": "none",
            "project": "study",
            "note": "",
            "save_note": False,
        },
        {
            "title": "Inbox zero pass",
            "description": "Archive stale threads and answer top 5 items.",
            "tags": ["admin"],
            "category": "work",
            "priority": "low",
            "completed": True,
            "day": 4,
            "time_spent": 23,
            "recurrence": "weekdays",
            "project": "launch",
            "note": "",
            "save_note": False,
        },
        {
            "title": "Evening walk",
            "description": "Light cardio and recovery walk.",
            "tags": ["cardio", "recovery"],
            "category": "health",
            "priority": "low",
            "completed": True,
            "day": 2,
            "time_spent": 36,
            "recurrence": "daily",
            "project": "wellness",
            "note": "",
            "save_note": False,
        },
        {
            "title": "Budget review",
            "description": "Check subscriptions and recurring costs.",
            "tags": ["finance"],
            "category": "finance",
            "priority": "medium",
            "completed": False,
            "day": 7,
            "time_spent": 0,
            "recurrence": "none",
            "project": None,
            "note": "",
            "save_note": False,
        },
    ]

    # Add a second set to make the task board dense and realistic.
    for offset in range(8):
        task_specs.append(
            {
                "title": f"Deep work block #{offset + 1}",
                "description": "Uninterrupted 50-minute focus sprint.",
                "tags": ["focus", "execution"],
                "category": "work",
                "priority": "medium" if offset % 3 else "high",
                "completed": offset % 2 == 0,
                "day": offset,
                "time_spent": 50 if offset % 2 == 0 else 0,
                "recurrence": "none",
                "project": "launch" if offset < 4 else "study",
                "note": "",
                "save_note": False,
            }
        )

    task_ids = []
    linked_note_candidates = []
    for spec in task_specs:
        task_id = _insert_task(
            db,
            user_id,
            project_id=project_ids.get(spec["project"]),
            title=spec["title"],
            description=spec["description"],
            tags=spec["tags"],
            category=spec["category"],
            priority=spec["priority"],
            completed=spec["completed"],
            day_iso=_day_str(spec["day"]),
            time_spent=spec["time_spent"],
            recurrence=spec["recurrence"],
            note_content=spec["note"],
            note_saved=spec["save_note"],
        )
        task_ids.append(task_id)
        if spec["save_note"] and spec["note"]:
            linked_note_candidates.append((task_id, spec["title"], spec["note"], spec["tags"], spec["day"]))

    for idx, (task_id, title, content, tags, day_offset) in enumerate(linked_note_candidates):
        _insert_task_note(
            db,
            user_id,
            task_id=task_id,
            title=f"Task Note: {title}",
            content=content,
            tags=tags,
            day_iso=_day_str(day_offset),
            hhmm=_time_for(idx, hour_start=18),
        )

    manual_notes = [
        {
            "title": "Weekly Reflection",
            "content": "Energy was strongest on days with early workouts and planned meals.",
            "tags": ["reflection", "weekly"],
            "day": 1,
        },
        {
            "title": "Project Risks",
            "content": "Risk: QA window is tight. Mitigation: lock scope by Thursday.",
            "tags": ["project", "risk"],
            "day": 2,
        },
        {
            "title": "Workout Technique Cues",
            "content": "Keep ribcage stacked during overhead press; slower eccentric.",
            "tags": ["workout", "form"],
            "day": 3,
        },
        {
            "title": "Nutrition Shopping List",
            "content": "Greek yogurt, eggs, oats, salmon, berries, spinach, nuts.",
            "tags": ["nutrition", "shopping"],
            "day": 0,
        },
        {
            "title": "Reading Highlights",
            "content": "Precision in definitions improves model diagnostics.",
            "tags": ["study"],
            "day": 5,
        },
        {
            "title": "Idea Parking Lot",
            "content": "Add adaptive rest timer and personal records panel in workout tab.",
            "tags": ["ideas", "product"],
            "day": 4,
        },
    ]

    for idx, note in enumerate(manual_notes):
        _insert_manual_note(
            db,
            user_id,
            title=note["title"],
            content=note["content"],
            tags=note["tags"],
            day_iso=_day_str(note["day"]),
            hhmm=_time_for(idx, hour_start=20),
        )

    return {"tasks": len(task_ids), "notes": len(manual_notes) + len(linked_note_candidates)}


def _seed_nutrition(db, user_id):
    meals_per_day = [
        ("Protein Oats Bowl", "breakfast", 460, 32.0, 58.0, 11.0),
        ("Chicken Quinoa Plate", "lunch", 620, 48.0, 62.0, 17.0),
        ("Greek Yogurt + Nuts", "snack", 290, 19.0, 16.0, 15.0),
        ("Salmon Rice Veg", "dinner", 680, 44.0, 67.0, 24.0),
    ]

    count = 0
    now = now_iso()
    for day_offset in range(10):
        day_iso = _day_str(day_offset)
        for idx, meal in enumerate(meals_per_day):
            name, meal_type, calories, protein, carbs, fats = meal
            db.execute(
                """
                INSERT INTO nutrition_entries (
                    user_id, name, meal_type, calories, protein, carbs, fats,
                    notes, date, time, created_at, updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    user_id,
                    name,
                    meal_type,
                    calories + (day_offset % 3) * 15,
                    protein + (0.5 * (day_offset % 2)),
                    carbs + float(day_offset % 4),
                    fats + float(day_offset % 3),
                    "Seeded showcase meal",
                    day_iso,
                    _time_for(idx, hour_start=7),
                    now,
                    now,
                ),
            )
            count += 1
    return count


def _seed_workouts(db, user_id):
    workout_specs = [
        ("Upper Body Strength", "strength", 52, 360, "high", True),
        ("Zone 2 Run", "cardio", 38, 330, "medium", True),
        ("Mobility Flow", "flexibility", 24, 110, "low", True),
        ("Leg Day Power", "strength", 61, 480, "high", True),
        ("Basketball Drills", "sports", 45, 390, "medium", False),
        ("Core + Conditioning", "other", 33, 250, "medium", True),
        ("Incline Walk", "cardio", 41, 290, "low", True),
        ("Push Session", "strength", 48, 345, "high", False),
        ("Pull Session", "strength", 46, 335, "high", True),
        ("Full Body Circuit", "other", 54, 420, "high", True),
    ]

    now = now_iso()
    count = 0
    for idx, spec in enumerate(workout_specs):
        name, workout_type, duration, calories_burned, intensity, completed = spec
        day_iso = _day_str(idx)
        exercises = [
            {"name": f"{name} - A", "reps": "3x10"},
            {"name": f"{name} - B", "reps": "3x12"},
        ]
        db.execute(
            """
            INSERT INTO workouts (
                user_id, name, type, duration, calories_burned, intensity,
                exercises_json, notes, completed, date, time, created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                user_id,
                name,
                workout_type,
                duration,
                calories_burned,
                intensity,
                json.dumps(exercises),
                "Seeded showcase workout",
                1 if completed else 0,
                day_iso,
                _time_for(idx, hour_start=6),
                now,
                now,
            ),
        )
        count += 1

    template_specs = [
        ("Quick 30 Cardio", "cardio", 30, 240, "medium"),
        ("Strength Push Day", "strength", 50, 370, "high"),
        ("Lower Body Builder", "strength", 55, 410, "high"),
        ("Recovery Mobility", "flexibility", 20, 90, "low"),
    ]

    template_count = 0
    for idx, spec in enumerate(template_specs):
        name, workout_type, duration, calories_burned, intensity = spec
        db.execute(
            """
            INSERT INTO workout_templates (
                user_id, name, type, duration, calories_burned, intensity,
                exercises_json, notes, created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                user_id,
                name,
                workout_type,
                duration,
                calories_burned,
                intensity,
                json.dumps([{"name": f"Template Move {idx + 1}", "reps": "3x10"}]),
                "Saved workout template",
                now,
                now,
            ),
        )
        template_count += 1

    return {"workouts": count, "templates": template_count}


def _seed_focus_sessions(db, user_id):
    session_specs = [
        ("pomodoro", 1500, 1460, True, "Design sprint"),
        ("pomodoro", 1500, 1500, True, "Code review"),
        ("custom", 2700, 2400, False, "Deep work"),
        ("stopwatch", 0, 1800, True, "Reading"),
        ("pomodoro", 1500, 1500, True, "Workout planning"),
        ("custom", 3600, 3400, True, "SQL practice"),
        ("pomodoro", 1500, 1300, False, "Admin cleanup"),
        ("stopwatch", 0, 2200, True, "Reflection"),
    ]

    now = now_iso()
    count = 0
    for idx, spec in enumerate(session_specs):
        mode, planned, actual, completed, label = spec
        day_iso = _day_str(idx)
        started = _dt_for(day_iso, _time_for(idx, hour_start=7))
        ended = _dt_for(day_iso, _time_for(idx + 1, hour_start=7)) if completed else None
        db.execute(
            """
            INSERT INTO focus_sessions (
                user_id, mode, duration_planned, duration_actual, completed,
                label, date, started_at, ended_at, created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                user_id,
                mode,
                planned,
                actual,
                1 if completed else 0,
                label,
                day_iso,
                started,
                ended,
                now,
                now,
            ),
        )
        count += 1
    return count


def _seed_stats_and_progress(db, user_id, progress):
    now = now_iso()

    db.execute(
        """
        INSERT INTO user_progress (user_id, total_points, current_streak, longest_streak, level, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET
            total_points = excluded.total_points,
            current_streak = excluded.current_streak,
            longest_streak = excluded.longest_streak,
            level = excluded.level,
            updated_at = excluded.updated_at
        """,
        (
            user_id,
            progress["total_points"],
            progress["current_streak"],
            progress["longest_streak"],
            progress["level"],
            now,
        ),
    )

    snapshot_count = 0
    for day_offset in range(7):
        snapshot_date = _day_str(day_offset)
        payload = {
            "tasks_completed": 4 + (day_offset % 3),
            "calories_consumed": 2100 + day_offset * 35,
            "protein_consumed": 132 + day_offset * 2,
            "workout_minutes": 35 + day_offset * 4,
            "calories_burned": 280 + day_offset * 28,
        }
        db.execute(
            """
            INSERT INTO stats_snapshots (user_id, snapshot_date, streak_days, payload_json, created_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(user_id, snapshot_date) DO UPDATE SET
                streak_days = excluded.streak_days,
                payload_json = excluded.payload_json
            """,
            (
                user_id,
                snapshot_date,
                max(0, progress["current_streak"] - day_offset),
                json.dumps(payload),
                now,
            ),
        )
        snapshot_count += 1
    return snapshot_count


def seed_single_user(db, user_profile, *, force_reset=False):
    email = user_profile["email"].strip().lower()
    user_id = _ensure_user(db, user_profile)

    if (not force_reset) and _has_showcase_payload(db, user_id):
        existing = _current_showcase_counts(db, user_id)
        existing["user_id"] = user_id
        existing["skipped"] = True
        return existing

    _clear_user_data(db, user_id, email)

    projects = _seed_projects(db, user_id)
    task_note_counts = _seed_tasks_and_notes(db, user_id, projects)
    meals_count = _seed_nutrition(db, user_id)
    workout_counts = _seed_workouts(db, user_id)
    focus_count = _seed_focus_sessions(db, user_id)
    snapshot_count = _seed_stats_and_progress(db, user_id, user_profile["progress"])

    return {
        "user_id": user_id,
        "projects": len(projects),
        "tasks": task_note_counts["tasks"],
        "notes": task_note_counts["notes"],
        "meals": meals_count,
        "workouts": workout_counts["workouts"],
        "workout_templates": workout_counts["templates"],
        "focus_sessions": focus_count,
        "stats_snapshots": snapshot_count,
        "skipped": False,
    }


def seed_showcase_users_in_context(force_reset=False):
    reports = []
    db = get_db()
    try:
        for user_profile in SHOWCASE_USERS:
            report = seed_single_user(db, user_profile, force_reset=force_reset)
            reports.append((user_profile["email"], report))
        db.commit()
    except Exception:
        db.rollback()
        raise

    return reports


def main():
    from app import app as flask_app

    with flask_app.app_context():
        reports = seed_showcase_users_in_context(force_reset=True)

    print("SHOWCASE_SEED_COMPLETE")
    print(f"password={SHOWCASE_PASSWORD}")
    for email, report in reports:
        print(
            f"{email} -> user_id={report['user_id']} "
            f"projects={report['projects']} tasks={report['tasks']} notes={report['notes']} "
            f"meals={report['meals']} workouts={report['workouts']} "
            f"templates={report['workout_templates']} focus={report['focus_sessions']} "
            f"snapshots={report['stats_snapshots']}"
        )


if __name__ == "__main__":
    main()
