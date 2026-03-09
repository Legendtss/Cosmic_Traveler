"""
Streaks & Points Evaluation Engine — FitTrack Pro
===================================================
Production-grade, abuse-resistant points & streak system.

ALL points are derived from actual logged data (tasks, nutrition, workouts).
No manual claiming. No fake increments.

Point System:
  - Tasks:     Easy(low)=10, Medium=25, Hard(high)=50  (capped at 100/day)
  - Nutrition: +50 if daily protein goal met
  - Workouts:  +50 if all workouts for today are completed
  - Max per day: 200

Streak Logic:
  - Increments ONLY if: protein goal met AND all workouts done AND ≥1 task completed
  - Otherwise resets to 0

Level System:
  - XP for next level = 200 × current_level
  - Level 1→2 needs 200, 2→3 needs 400, etc.
"""

import json
from datetime import datetime, timedelta

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
TASK_POINTS = {"low": 10, "medium": 25, "high": 50}
DAILY_TASK_CAP = 100
NUTRITION_BONUS = 50
WORKOUT_BONUS = 50
MAX_DAILY_POINTS = 200
DEFAULT_PROTEIN_GOAL = 140  # grams — used if no user profile is set


# ---------------------------------------------------------------------------
# Level Helpers
# ---------------------------------------------------------------------------
def xp_for_level(level):
    """XP required to advance FROM `level` to `level + 1`."""
    return 200 * level


def total_xp_for_level(level):
    """Total cumulative XP needed to reach `level` (from level 1)."""
    # Sum of 200*1 + 200*2 + ... + 200*(level-1) = 200 * level*(level-1)/2
    return 200 * level * (level - 1) // 2


def level_from_xp(total_xp):
    """Determine current level from total XP."""
    level = 1
    cumulative = 0
    while True:
        needed = xp_for_level(level)
        if cumulative + needed > total_xp:
            break
        cumulative += needed
        level += 1
    return level


def level_progress(total_xp):
    """Return (level, xp_into_level, xp_needed_for_next, pct)."""
    level = level_from_xp(total_xp)
    cumulative = total_xp_for_level(level)
    xp_into = total_xp - cumulative
    xp_needed = xp_for_level(level)
    pct = round((xp_into / xp_needed) * 100) if xp_needed > 0 else 0
    return level, xp_into, xp_needed, pct


# ---------------------------------------------------------------------------
# Day Evaluation (Core Engine)
# ---------------------------------------------------------------------------
def evaluate_day(db, user_id, date_str, protein_goal=None):
    """
    Evaluate a single day for points & streak eligibility.

    Reads from tasks, nutrition_entries, workouts tables.
    Returns a dict with all computed values.
    """
    if protein_goal is None:
        protein_goal = DEFAULT_PROTEIN_GOAL

    # --- Task Points ---
    task_rows = db.execute(
        "SELECT priority, completed FROM tasks WHERE user_id = ? AND date = ?",
        (user_id, date_str),
    ).fetchall()

    task_points = 0
    tasks_completed = 0
    for row in task_rows:
        if row["completed"]:
            tasks_completed += 1
            pts = TASK_POINTS.get(row["priority"], 25)
            task_points += pts
    task_points = min(task_points, DAILY_TASK_CAP)

    # --- Nutrition (Protein Goal) ---
    nutrition_row = db.execute(
        "SELECT COALESCE(SUM(protein), 0) as total_protein FROM nutrition_entries WHERE user_id = ? AND date = ?",
        (user_id, date_str),
    ).fetchone()
    total_protein = float(nutrition_row["total_protein"]) if nutrition_row else 0.0
    protein_met = total_protein >= protein_goal

    # --- Workout Completion ---
    workout_rows = db.execute(
        "SELECT id, completed FROM workouts WHERE user_id = ? AND date = ?",
        (user_id, date_str),
    ).fetchall()

    total_workouts = len(workout_rows)
    completed_workouts = 0
    if total_workouts > 0:
        completed_workouts = sum(1 for w in workout_rows if w["completed"])
        workout_done = completed_workouts == total_workouts
    else:
        # No workouts scheduled = "not applicable" — treat as done (don't penalise rest days)
        workout_done = True

    # --- Total Points ---
    total_points = task_points
    if protein_met:
        total_points += NUTRITION_BONUS
    if workout_done and total_workouts > 0:
        total_points += WORKOUT_BONUS
    total_points = min(total_points, MAX_DAILY_POINTS)

    # --- Streak Validity ---
    # A valid day requires completing tasks AND meeting protein goal.
    # Workouts only required if any were scheduled for the day.
    valid_day = protein_met and workout_done and tasks_completed > 0

    return {
        "date": date_str,
        "task_points": task_points,
        "tasks_completed": tasks_completed,
        "total_tasks": len(task_rows),
        "protein_met": protein_met,
        "total_protein": round(total_protein, 1),
        "protein_goal": protein_goal,
        "workout_done": workout_done,
        "total_workouts": total_workouts,
        "completed_workout_count": completed_workouts,
        "total_points": total_points,
        "valid_day": valid_day,
    }


# ---------------------------------------------------------------------------
# Persistence: Save daily snapshot & update user progress
# ---------------------------------------------------------------------------
def save_daily_snapshot(db, user_id, day_eval):
    """
    Write/update the stats_snapshots row for this day.
    Also recompute current_streak, longest_streak, total_points, and level.
    Returns the updated user_progress dict.
    """
    date_str = day_eval["date"]

    # Upsert daily snapshot
    payload = json.dumps({
        "task_points": day_eval["task_points"],
        "tasks_completed": day_eval["tasks_completed"],
        "total_tasks": day_eval["total_tasks"],
        "protein_met": day_eval["protein_met"],
        "total_protein": day_eval["total_protein"],
        "protein_goal": day_eval["protein_goal"],
        "workout_done": day_eval["workout_done"],
        "total_workouts": day_eval["total_workouts"],
        "completed_workout_count": day_eval.get("completed_workout_count", 0),
        "total_points": day_eval["total_points"],
        "valid_day": day_eval["valid_day"],
    })

    existing = db.execute(
        "SELECT id, payload_json FROM stats_snapshots WHERE user_id = ? AND snapshot_date = ?",
        (user_id, date_str),
    ).fetchone()

    if existing:
        db.execute(
            "UPDATE stats_snapshots SET streak_days = ?, payload_json = ? WHERE id = ?",
            (1 if day_eval["valid_day"] else 0, payload, existing["id"]),
        )
    else:
        db.execute(
            "INSERT INTO stats_snapshots (user_id, snapshot_date, streak_days, payload_json) VALUES (?, ?, ?, ?)",
            (user_id, date_str, 1 if day_eval["valid_day"] else 0, payload),
        )

    # Recompute streak
    current_streak = _compute_current_streak(db, user_id, date_str)

    # Recompute total points from all snapshots
    total_row = db.execute(
        "SELECT COALESCE(SUM(json_extract(payload_json, '$.total_points')), 0) as total FROM stats_snapshots WHERE user_id = ?",
        (user_id,),
    ).fetchone()
    total_points = int(total_row["total"]) if total_row else 0

    # Compute level
    level = level_from_xp(total_points)

    # Get or compute longest streak
    progress = get_or_create_progress(db, user_id)
    longest_streak = max(progress["longest_streak"], current_streak)

    # Upsert user_progress
    db.execute(
        """INSERT INTO user_progress (user_id, total_points, current_streak, longest_streak, level, updated_at)
           VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
           ON CONFLICT(user_id) DO UPDATE SET
             total_points = excluded.total_points,
             current_streak = excluded.current_streak,
             longest_streak = excluded.longest_streak,
             level = excluded.level,
             updated_at = CURRENT_TIMESTAMP""",
        (user_id, total_points, current_streak, longest_streak, level),
    )
    db.commit()

    return {
        "total_points": total_points,
        "current_streak": current_streak,
        "longest_streak": longest_streak,
        "level": level,
    }


def _compute_current_streak(db, user_id, from_date_str):
    """
    Walk backwards from `from_date_str` counting consecutive valid days.
    Capped at 1000 to prevent runaway queries on anomalous data.
    """
    streak = 0
    d = datetime.strptime(from_date_str, "%Y-%m-%d").date()
    max_lookback = 1000

    while streak < max_lookback:
        ds = d.strftime("%Y-%m-%d")
        row = db.execute(
            "SELECT streak_days FROM stats_snapshots WHERE user_id = ? AND snapshot_date = ?",
            (user_id, ds),
        ).fetchone()
        if row and row["streak_days"] == 1:
            streak += 1
            d -= timedelta(days=1)
        else:
            break

    return streak


def get_or_create_progress(db, user_id):
    """Get user_progress row, creating it if it doesn't exist."""
    row = db.execute(
        "SELECT * FROM user_progress WHERE user_id = ?", (user_id,)
    ).fetchone()
    if row:
        return dict(row)
    db.execute(
        "INSERT INTO user_progress (user_id) VALUES (?)", (user_id,)
    )
    db.commit()
    return {"user_id": user_id, "total_points": 0, "current_streak": 0, "longest_streak": 0, "level": 1}


# ---------------------------------------------------------------------------
# Full evaluation + persist (the main public function)
# ---------------------------------------------------------------------------
def evaluate_and_save(db, user_id, date_str, protein_goal=None):
    """
    Evaluate today, save snapshot, update progress.
    Returns combined result with day evaluation + user progress.
    """
    day = evaluate_day(db, user_id, date_str, protein_goal)
    progress = save_daily_snapshot(db, user_id, day)

    lvl, xp_into, xp_needed, pct = level_progress(progress["total_points"])

    return {
        "day": day,
        "progress": {
            **progress,
            "xp_into_level": xp_into,
            "xp_needed": xp_needed,
            "level_pct": pct,
        },
    }


# ---------------------------------------------------------------------------
# Activity Feed (recent point-earning actions)
# ---------------------------------------------------------------------------
def get_recent_activities(db, user_id, limit=10, protein_goal=None):
    """
    Build an activity feed from recent completed tasks, meals, and workouts.
    Returns list of { action, points, time, category } dicts.
    """
    protein_goal = protein_goal if protein_goal is not None else DEFAULT_PROTEIN_GOAL
    activities = []

    # Recent completed tasks
    task_rows = db.execute(
        """SELECT title, priority, updated_at FROM tasks 
           WHERE user_id = ? AND completed = 1 
           ORDER BY updated_at DESC LIMIT ?""",
        (user_id, limit),
    ).fetchall()
    for r in task_rows:
        pts = TASK_POINTS.get(r["priority"], 25)
        activities.append({
            "action": f"Completed task: {r['title']}",
            "points": pts,
            "time": r["updated_at"],
            "category": "task",
            "priority": r["priority"],
        })

    # Recent nutrition entries (grouped by date)
    meal_dates = db.execute(
        """SELECT date, SUM(protein) as total_protein, COUNT(*) as count
           FROM nutrition_entries WHERE user_id = ?
           GROUP BY date ORDER BY date DESC LIMIT ?""",
        (user_id, limit),
    ).fetchall()
    for r in meal_dates:
        met = float(r["total_protein"]) >= protein_goal
        if met:
            activities.append({
                "action": f"Met daily protein goal ({round(float(r['total_protein']), 1)}g)",
                "points": NUTRITION_BONUS,
                "time": r["date"],
                "category": "nutrition",
                "priority": "medium",
            })

    # Recent completed workouts
    workout_rows = db.execute(
        """SELECT name, duration, calories_burned, date FROM workouts
           WHERE user_id = ? AND completed = 1
           ORDER BY date DESC LIMIT ?""",
        (user_id, limit),
    ).fetchall()
    for r in workout_rows:
        activities.append({
            "action": f"Completed {r['name']} ({r['duration']} min)",
            "points": WORKOUT_BONUS,
            "time": r["date"],
            "category": "workout",
            "priority": "high",
        })

    # Sort by time descending
    activities.sort(key=lambda a: a["time"], reverse=True)
    return activities[:limit]


# ---------------------------------------------------------------------------
# Achievements
# ---------------------------------------------------------------------------
ACHIEVEMENTS = [
    {"id": "first_task", "title": "First Task", "description": "Complete your first task", "icon": "fa-list-check",
     "check": lambda p, db, uid: _count_completed_tasks(db, uid) >= 1},
    {"id": "first_workout", "title": "First Workout", "description": "Complete your first workout", "icon": "fa-dumbbell",
     "check": lambda p, db, uid: _count_completed_workouts(db, uid) >= 1},
    {"id": "streak_7", "title": "7 Day Streak", "description": "Maintain a 7-day streak", "icon": "fa-fire",
     "check": lambda p, db, uid: p["longest_streak"] >= 7},
    {"id": "streak_30", "title": "30 Day Streak", "description": "Maintain a 30-day streak", "icon": "fa-trophy",
     "check": lambda p, db, uid: p["longest_streak"] >= 30},
    {"id": "points_500", "title": "500 Points", "description": "Earn 500 total points", "icon": "fa-star",
     "check": lambda p, db, uid: p["total_points"] >= 500},
    {"id": "points_1000", "title": "1000 Points", "description": "Earn 1000 total points", "icon": "fa-star",
     "check": lambda p, db, uid: p["total_points"] >= 1000},
    {"id": "points_5000", "title": "5000 Points", "description": "Earn 5000 total points", "icon": "fa-crown",
     "check": lambda p, db, uid: p["total_points"] >= 5000},
    {"id": "level_5", "title": "Level 5", "description": "Reach level 5", "icon": "fa-bolt",
     "check": lambda p, db, uid: p["level"] >= 5},
    {"id": "level_10", "title": "Level 10", "description": "Reach level 10", "icon": "fa-bolt",
     "check": lambda p, db, uid: p["level"] >= 10},
    {"id": "nutrition_master", "title": "Nutrition Master", "description": "Meet protein goal 30 days", "icon": "fa-apple-alt",
     "check": lambda p, db, uid: _count_protein_days(db, uid) >= 30},
    {"id": "century_tasks", "title": "Century Club", "description": "Complete 100 tasks", "icon": "fa-medal",
     "check": lambda p, db, uid: _count_completed_tasks(db, uid) >= 100},
]


def _count_completed_tasks(db, user_id):
    r = db.execute("SELECT COUNT(*) as c FROM tasks WHERE user_id = ? AND completed = 1", (user_id,)).fetchone()
    return r["c"] if r else 0


def _count_completed_workouts(db, user_id):
    r = db.execute("SELECT COUNT(*) as c FROM workouts WHERE user_id = ? AND completed = 1", (user_id,)).fetchone()
    return r["c"] if r else 0


def _count_protein_days(db, user_id):
    rows = db.execute(
        "SELECT date, SUM(protein) as p FROM nutrition_entries WHERE user_id = ? GROUP BY date",
        (user_id,),
    ).fetchall()
    return sum(1 for r in rows if float(r["p"]) >= DEFAULT_PROTEIN_GOAL)


def check_achievements(db, user_id, progress):
    """Return list of achievements with earned status."""
    result = []
    for ach in ACHIEVEMENTS:
        earned = ach["check"](progress, db, user_id)
        result.append({
            "id": ach["id"],
            "title": ach["title"],
            "description": ach["description"],
            "icon": ach["icon"],
            "earned": earned,
        })
    return result
