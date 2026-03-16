PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL DEFAULT '',
  display_name TEXT NOT NULL,
  level TEXT NOT NULL DEFAULT 'Beginner',
  goal TEXT NOT NULL DEFAULT 'General Fitness',
  weekly_workout_target INTEGER NOT NULL DEFAULT 3,
  calorie_goal INTEGER NOT NULL DEFAULT 2200,
  -- Profile essentials (onboarding required)
  age INTEGER,
  height INTEGER,
  current_weight REAL,
  target_weight REAL,
  weight_goal_duration_weeks INTEGER,
  daily_calorie_delta REAL,
  activity_level TEXT NOT NULL DEFAULT 'moderate' CHECK (activity_level IN ('sedentary','light','moderate','active','very_active')),
  -- Onboarding state tracking
  intro_seen_at TEXT,
  demo_completed_at TEXT,
  profile_essentials_completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  expires_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS login_attempts (
  identifier TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 0 CHECK (count >= 0),
  first_attempt REAL NOT NULL DEFAULT 0,
  locked_until REAL NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_login_attempts_locked_until ON login_attempts(locked_until);

CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived','completed')),
  due_date TEXT,
  created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL,
  project_id INTEGER,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  tags_json TEXT NOT NULL DEFAULT '[]',
  category TEXT NOT NULL DEFAULT 'general',
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high')),
  completed INTEGER NOT NULL DEFAULT 0 CHECK (completed IN (0,1)),
  date TEXT NOT NULL,
  time_spent INTEGER NOT NULL DEFAULT 0 CHECK (time_spent >= 0),
  note_content TEXT NOT NULL DEFAULT '',
  note_saved_to_notes INTEGER NOT NULL DEFAULT 0,
  recurrence TEXT NOT NULL DEFAULT 'none' CHECK (recurrence IN ('none','daily','weekly','weekdays')),
  recurrence_parent_id INTEGER,
  created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
  FOREIGN KEY (recurrence_parent_id) REFERENCES tasks(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS project_subtasks (
  id INTEGER PRIMARY KEY,
  project_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  completed INTEGER NOT NULL DEFAULT 0 CHECK (completed IN (0,1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS workouts (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'other',
  duration INTEGER NOT NULL DEFAULT 0 CHECK (duration >= 0),
  calories_burned INTEGER NOT NULL DEFAULT 0 CHECK (calories_burned >= 0),
  intensity TEXT NOT NULL DEFAULT 'medium' CHECK (intensity IN ('low','medium','high')),
  exercises_json TEXT NOT NULL DEFAULT '[]',
  notes TEXT NOT NULL DEFAULT '',
  completed INTEGER NOT NULL DEFAULT 0 CHECK (completed IN (0,1)),
  date TEXT NOT NULL,
  time TEXT,
  created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS workout_templates (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'other',
  duration INTEGER NOT NULL DEFAULT 0 CHECK (duration >= 0),
  calories_burned INTEGER NOT NULL DEFAULT 0 CHECK (calories_burned >= 0),
  intensity TEXT NOT NULL DEFAULT 'medium' CHECK (intensity IN ('low','medium','high')),
  exercises_json TEXT NOT NULL DEFAULT '[]',
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS nutrition_entries (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  meal_type TEXT NOT NULL DEFAULT 'other',
  calories INTEGER NOT NULL DEFAULT 0 CHECK (calories >= 0),
  protein REAL NOT NULL DEFAULT 0 CHECK (protein >= 0),
  carbs REAL NOT NULL DEFAULT 0 CHECK (carbs >= 0),
  fats REAL NOT NULL DEFAULT 0 CHECK (fats >= 0),
  notes TEXT NOT NULL DEFAULT '',
  date TEXT NOT NULL,
  time TEXT,
  created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS stats_snapshots (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL,
  snapshot_date TEXT NOT NULL,
  streak_days INTEGER NOT NULL DEFAULT 0 CHECK (streak_days >= 0),
  payload_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  UNIQUE (user_id, snapshot_date),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_progress (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL UNIQUE,
  total_points INTEGER NOT NULL DEFAULT 0 CHECK (total_points >= 0),
  current_streak INTEGER NOT NULL DEFAULT 0 CHECK (current_streak >= 0),
  longest_streak INTEGER NOT NULL DEFAULT 0 CHECK (longest_streak >= 0),
  level INTEGER NOT NULL DEFAULT 1 CHECK (level >= 1),
  updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS focus_sessions (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL,
  mode TEXT NOT NULL DEFAULT 'pomodoro' CHECK (mode IN ('pomodoro','custom','stopwatch')),
  duration_planned INTEGER NOT NULL DEFAULT 0 CHECK (duration_planned >= 0),
  duration_actual INTEGER NOT NULL DEFAULT 0 CHECK (duration_actual >= 0),
  completed INTEGER NOT NULL DEFAULT 0 CHECK (completed IN (0,1)),
  label TEXT NOT NULL DEFAULT '',
  date TEXT NOT NULL,
  started_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  ended_at TEXT,
  created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS notes (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  source_type TEXT NOT NULL DEFAULT 'manual' CHECK (source_type IN ('manual','task')),
  source_id INTEGER,
  tags_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CHECK (
    (source_type = 'manual' AND source_id IS NULL) OR
    (source_type = 'task' AND source_id IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS goals (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'personal',
  target_progress REAL NOT NULL DEFAULT 100 CHECK (target_progress > 0 AND target_progress <= 100),
  current_progress REAL NOT NULL DEFAULT 0 CHECK (current_progress >= 0 AND current_progress <= 100),
  time_limit TEXT,
  notes TEXT NOT NULL DEFAULT '',
  card_image_url TEXT,
  ai_prompt TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','archived')),
  is_shared INTEGER NOT NULL DEFAULT 0 CHECK (is_shared IN (0,1)),
  share_token TEXT UNIQUE,
  created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  completed_at TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_tasks_user_date ON tasks(user_id, date);
CREATE INDEX IF NOT EXISTS idx_tasks_user_completed_date ON tasks(user_id, completed, date);
CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_recurrence ON tasks(user_id, recurrence, date);
CREATE UNIQUE INDEX IF NOT EXISTS idx_tasks_recurrence_instance ON tasks(user_id, recurrence_parent_id, date);
CREATE INDEX IF NOT EXISTS idx_workouts_user_date ON workouts(user_id, date);
CREATE INDEX IF NOT EXISTS idx_workout_templates_user ON workout_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_nutrition_user_date ON nutrition_entries(user_id, date);
CREATE INDEX IF NOT EXISTS idx_subtasks_project ON project_subtasks(project_id, completed);
CREATE INDEX IF NOT EXISTS idx_stats_user_date ON stats_snapshots(user_id, snapshot_date);
CREATE INDEX IF NOT EXISTS idx_focus_user_date ON focus_sessions(user_id, date);
CREATE INDEX IF NOT EXISTS idx_notes_user ON notes(user_id);
CREATE INDEX IF NOT EXISTS idx_notes_source ON notes(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_goals_user ON goals(user_id);
CREATE INDEX IF NOT EXISTS idx_goals_share_token ON goals(share_token);

-- Enforce that task-linked notes reference a task owned by the same user.
CREATE TRIGGER IF NOT EXISTS trg_notes_task_link_insert
BEFORE INSERT ON notes
WHEN NEW.source_type = 'task'
  AND NOT EXISTS (
    SELECT 1 FROM tasks
    WHERE id = NEW.source_id
      AND user_id = NEW.user_id
  )
BEGIN
  SELECT RAISE(ABORT, 'Invalid task-linked note: task missing or not owned by user');
END;

CREATE TRIGGER IF NOT EXISTS trg_notes_task_link_update
BEFORE UPDATE OF source_type, source_id, user_id ON notes
WHEN NEW.source_type = 'task'
  AND NOT EXISTS (
    SELECT 1 FROM tasks
    WHERE id = NEW.source_id
      AND user_id = NEW.user_id
  )
BEGIN
  SELECT RAISE(ABORT, 'Invalid task-linked note: task missing or not owned by user');
END;

CREATE TRIGGER IF NOT EXISTS trg_users_constraints_insert
BEFORE INSERT ON users
WHEN
  NEW.level NOT IN ('Beginner','Intermediate','Advanced')
  OR NEW.goal NOT IN ('Weight Loss','Muscle Gain','Maintain Fitness','General Fitness')
  OR NEW.weekly_workout_target < 1 OR NEW.weekly_workout_target > 14
  OR NEW.calorie_goal < 500 OR NEW.calorie_goal > 10000
  OR NEW.activity_level NOT IN ('sedentary','light','moderate','active','very_active')
  OR (NEW.age IS NOT NULL AND (NEW.age < 10 OR NEW.age > 120))
  OR (NEW.height IS NOT NULL AND (NEW.height < 50 OR NEW.height > 300))
  OR (NEW.current_weight IS NOT NULL AND (NEW.current_weight < 20 OR NEW.current_weight > 500))
BEGIN
  SELECT RAISE(ABORT, 'Invalid users row: constraint violation');
END;

CREATE TRIGGER IF NOT EXISTS trg_users_constraints_update
BEFORE UPDATE ON users
WHEN
  NEW.level NOT IN ('Beginner','Intermediate','Advanced')
  OR NEW.goal NOT IN ('Weight Loss','Muscle Gain','Maintain Fitness','General Fitness')
  OR NEW.weekly_workout_target < 1 OR NEW.weekly_workout_target > 14
  OR NEW.calorie_goal < 500 OR NEW.calorie_goal > 10000
  OR NEW.activity_level NOT IN ('sedentary','light','moderate','active','very_active')
  OR (NEW.age IS NOT NULL AND (NEW.age < 10 OR NEW.age > 120))
  OR (NEW.height IS NOT NULL AND (NEW.height < 50 OR NEW.height > 300))
  OR (NEW.current_weight IS NOT NULL AND (NEW.current_weight < 20 OR NEW.current_weight > 500))
BEGIN
  SELECT RAISE(ABORT, 'Invalid users row: constraint violation');
END;
