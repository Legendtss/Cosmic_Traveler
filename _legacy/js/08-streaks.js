// ========================================
// Streaks & Points Evaluation Engine (Client-Side)
// ========================================

const STREAK_TASK_POINTS = { low: 10, medium: 25, high: 50 };
const STREAK_DAILY_TASK_CAP = 100;
const STREAK_NUTRITION_BONUS = 50;
const STREAK_WORKOUT_BONUS = 50;
const STREAK_MAX_DAILY_POINTS = 200;

// ---------------------------------------------------------------------------
// Streak Persistence Cache (survives refresh)
// ---------------------------------------------------------------------------
const STREAK_CACHE_KEY_BASE = 'fittrack_streak_cache_v1';
let _streakEvalSeq = 0; // sequence counter to prevent stale renders

function streakCacheKey() {
  return activeDemoUserId ? `${STREAK_CACHE_KEY_BASE}_${activeDemoUserId}` : STREAK_CACHE_KEY_BASE;
}

function saveStreakCache(result) {
  try {
    const cache = {
      progress: result.progress,
      day: result.day,
      activities: result.activities,
      achievements: result.achievements,
      dailyResults: result.dailyResults,
      cachedAt: new Date().toISOString(),
    };
    localStorage.setItem(streakCacheKey(), JSON.stringify(cache));
  } catch (_e) { /* quota exceeded — non-critical */ }
}

function loadStreakCache() {
  try {
    const raw = localStorage.getItem(streakCacheKey());
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Validate it has required fields
    if (parsed && parsed.progress && typeof parsed.progress.total_points === 'number') {
      return parsed;
    }
    return null;
  } catch (_e) { return null; }
}

const STREAK_ACHIEVEMENTS_DEF = [
  { id: 'first_task', title: 'First Task', description: 'Complete your first task', icon: 'fa-list-check', check: (p) => p._completedTasksTotal >= 1 },
  { id: 'first_workout', title: 'First Workout', description: 'Complete your first workout', icon: 'fa-dumbbell', check: (p) => p._completedWorkoutsTotal >= 1 },
  { id: 'streak_7', title: '7 Day Streak', description: 'Maintain a 7-day streak', icon: 'fa-fire', check: (p) => p.longest_streak >= 7 },
  { id: 'streak_30', title: '30 Day Streak', description: 'Maintain a 30-day streak', icon: 'fa-trophy', check: (p) => p.longest_streak >= 30 },
  { id: 'points_500', title: '500 Points', description: 'Earn 500 total points', icon: 'fa-star', check: (p) => p.total_points >= 500 },
  { id: 'points_1000', title: '1000 Points', description: 'Earn 1000 total points', icon: 'fa-star', check: (p) => p.total_points >= 1000 },
  { id: 'points_5000', title: '5000 Points', description: 'Earn 5000 total points', icon: 'fa-crown', check: (p) => p.total_points >= 5000 },
  { id: 'level_5', title: 'Level 5', description: 'Reach level 5', icon: 'fa-bolt', check: (p) => p.level >= 5 },
  { id: 'level_10', title: 'Level 10', description: 'Reach level 10', icon: 'fa-bolt', check: (p) => p.level >= 10 },
  { id: 'nutrition_master', title: 'Nutrition Master', description: 'Meet protein goal 30 days', icon: 'fa-apple-alt', check: (p) => p._proteinDays >= 30 },
  { id: 'century_tasks', title: 'Century Club', description: 'Complete 100 tasks', icon: 'fa-medal', check: (p) => p._completedTasksTotal >= 100 },
];

function streakXpForLevel(level) { return 200 * level; }
function streakTotalXpForLevel(level) { return 200 * level * (level - 1) / 2; }
function streakLevelFromXp(totalXp) {
  let level = 1, cumulative = 0;
  while (true) {
    const needed = streakXpForLevel(level);
    if (cumulative + needed > totalXp) break;
    cumulative += needed;
    level++;
  }
  return level;
}
function streakLevelProgress(totalXp) {
  const level = streakLevelFromXp(totalXp);
  const cumulative = streakTotalXpForLevel(level);
  const xpInto = totalXp - cumulative;
  const xpNeeded = streakXpForLevel(level);
  const pct = xpNeeded > 0 ? Math.round((xpInto / xpNeeded) * 100) : 0;
  return { level, xpInto, xpNeeded, pct };
}

/**
 * Evaluate a single day for points & streak eligibility (demo mode).
 * @param {string} dateKey - YYYY-MM-DD
 * @param {Array} tasks - full tasks array
 * @param {Array} meals - full meals array
 * @param {Array} workouts - full workouts array (with .completed flag)
 * @param {number} proteinGoal
 * @returns {object} day evaluation
 */
function streakEvaluateDay(dateKey, tasks, meals, workouts, proteinGoal) {
  // Task points
  const dayTasks = tasks.filter(t => {
    const tDate = t.dueAt ? toLocalDateKey(new Date(t.dueAt)) : (t.date || '');
    return tDate === dateKey;
  });
  let taskPoints = 0, tasksCompleted = 0;
  const completedTasksDebug = [];
  for (const t of dayTasks) {
    const isCompleted = !!(t.completed || t.completedAt);
    if (isCompleted) {
      tasksCompleted++;
      const priority = t.priority || 'medium';
      const points = STREAK_TASK_POINTS[priority] || 25;
      taskPoints += points;
      completedTasksDebug.push({ title: t.title, priority, points, completed: isCompleted });
    }
  }
  const originalTaskPoints = taskPoints;
  taskPoints = Math.min(taskPoints, STREAK_DAILY_TASK_CAP);
  
  if (completedTasksDebug.length > 0) {
    console.log(`[Task Points] ${dateKey}: ${completedTasksDebug.length} completed tasks = ${originalTaskPoints} pts (capped to ${taskPoints})`, completedTasksDebug);
  }

  // Protein
  const dayMeals = meals.filter(m => String(m.date || '') === dateKey);
  const totalProtein = dayMeals.reduce((sum, m) => sum + parseMacro(m.protein), 0);
  const proteinMet = totalProtein >= proteinGoal;

  // Workouts
  const dayWorkouts = workouts.filter(w => String(w.date || '') === dateKey);
  const totalWorkouts = dayWorkouts.length;
  let workoutDone = false;
  let completedWorkoutCount = 0;
  if (totalWorkouts > 0) {
    completedWorkoutCount = dayWorkouts.filter(w => !!w.completed).length;
    workoutDone = completedWorkoutCount === totalWorkouts;
  }

  // Total
  let totalPoints = taskPoints;
  if (proteinMet) totalPoints += STREAK_NUTRITION_BONUS;
  if (workoutDone && totalWorkouts > 0) totalPoints += STREAK_WORKOUT_BONUS;
  const validDay = proteinMet && (workoutDone || totalWorkouts === 0) && tasksCompleted > 0;
  totalPoints = Math.min(totalPoints, STREAK_MAX_DAILY_POINTS);

  return {
    date: dateKey, taskPoints, tasksCompleted, totalTasks: dayTasks.length,
    proteinMet, totalProtein: Math.round(totalProtein * 10) / 10, proteinGoal,
    workoutDone, totalWorkouts, completedWorkoutCount, totalPoints, validDay,
  };
}

/**
 * Full demo-mode evaluation: evaluates all known dates, computes streaks, points, achievements.
 */
function streakFullEvalDemo() {
  const tasks = activeDemoUserId ? getActiveUserTasksData() : (taskUiState.tasks || []);
  const meals = activeDemoUserId ? getActiveUserMealsData() : (nutritionState.entries || []);
  const rawWorkouts = activeDemoUserId ? getActiveUserWorkoutsData() : (workoutState.workouts || []);
  const workouts = rawWorkouts.map(w => ({
    ...w,
    completed: w.completed !== undefined ? !!w.completed : !!workoutMeta(w.id).completed,
  }));
  const proteinGoal = nutritionState.baseGoals.protein || 140;

  // Collect all unique dates from tasks, meals, workouts
  const dateSet = new Set();
  for (const t of tasks) {
    const d = t.dueAt ? toLocalDateKey(new Date(t.dueAt)) : (t.date || '');
    if (d) dateSet.add(d);
  }
  for (const m of meals) { if (m.date) dateSet.add(String(m.date)); }
  for (const w of workouts) { if (w.date) dateSet.add(String(w.date)); }
  // Always include today
  const today = todayDateKey();
  dateSet.add(today);

  // Evaluate each date
  const dailyResults = {};
  let totalPoints = 0;
  for (const dateKey of dateSet) {
    const dayEval = streakEvaluateDay(dateKey, tasks, meals, workouts, proteinGoal);
    dailyResults[dateKey] = dayEval;
    totalPoints += dayEval.totalPoints;
    console.log(`[Streak Eval] ${dateKey}: tasks=${dayEval.tasksCompleted}/${dayEval.totalTasks}, taskPoints=${dayEval.taskPoints}, protein=${Math.round(dayEval.totalProtein)}/${dayEval.proteinGoal}, workouts=${dayEval.completedWorkoutCount}/${dayEval.totalWorkouts}, dayTotal=${dayEval.totalPoints}, cumulative=${totalPoints}`);
  }
  console.log(`[Streak Eval] ✓ Total points across all dates: ${totalPoints}`);

  // Compute current streak (walk back from today)
  let currentStreak = 0;
  const d = new Date();
  while (true) {
    const key = toLocalDateKey(d);
    const result = dailyResults[key];
    if (result && result.validDay) {
      currentStreak++;
      d.setDate(d.getDate() - 1);
    } else {
      break;
    }
  }

  // Longest streak (walk all sorted dates)
  const sortedDates = Array.from(dateSet).sort();
  let longestStreak = 0, tempStreak = 0, prevDate = null;
  for (const dateKey of sortedDates) {
    const result = dailyResults[dateKey];
    if (result && result.validDay) {
      if (prevDate) {
        const prev = new Date(prevDate + 'T00:00:00');
        const curr = new Date(dateKey + 'T00:00:00');
        const diffDays = Math.round((curr - prev) / 86400000);
        tempStreak = diffDays === 1 ? tempStreak + 1 : 1;
      } else {
        tempStreak = 1;
      }
      prevDate = dateKey;
    } else {
      tempStreak = 0;
      prevDate = null;
    }
    longestStreak = Math.max(longestStreak, tempStreak);
  }

  const { level, xpInto, xpNeeded, pct } = streakLevelProgress(totalPoints);
  console.log(`[Streak Eval] Streaks: current=${currentStreak}, longest=${longestStreak}, level=${level}, xpInto=${xpInto}/${xpNeeded}`);

  // Activity feed from real data
  const activities = [];
  for (const t of tasks) {
    if (t.completed || t.completedAt) {
      const pts = STREAK_TASK_POINTS[t.priority] || 25;
      const time = t.completedAt || t.updatedAt || t.date || today;
      activities.push({ action: `Completed task: ${t.title}`, points: pts, time, category: 'task', priority: t.priority || 'medium' });
    }
  }
  for (const dateKey of Object.keys(dailyResults)) {
    const dr = dailyResults[dateKey];
    if (dr.proteinMet) {
      activities.push({ action: `Met daily protein goal (${dr.totalProtein}g)`, points: STREAK_NUTRITION_BONUS, time: dateKey, category: 'nutrition', priority: 'medium' });
    }
  }
  for (const w of workouts) {
    if (w.completed) {
      activities.push({ action: `Completed ${w.name || 'Workout'} (${w.duration || 60} min)`, points: STREAK_WORKOUT_BONUS, time: w.date || today, category: 'workout', priority: 'high' });
    }
  }
  activities.sort((a, b) => String(b.time).localeCompare(String(a.time)));

  // Achievement counts
  const completedTasksTotal = tasks.filter(t => t.completed || t.completedAt).length;
  const completedWorkoutsTotal = workouts.filter(w => w.completed).length;
  // Count days where protein was met
  let proteinDays = 0;
  for (const dr of Object.values(dailyResults)) {
    if (dr.proteinMet) proteinDays++;
  }

  const progress = {
    total_points: totalPoints,
    current_streak: currentStreak,
    longest_streak: longestStreak,
    level,
    xp_into_level: xpInto,
    xp_needed: xpNeeded,
    level_pct: pct,
    _completedTasksTotal: completedTasksTotal,
    _completedWorkoutsTotal: completedWorkoutsTotal,
    _proteinDays: proteinDays,
  };

  const achievements = STREAK_ACHIEVEMENTS_DEF.map(ach => ({
    id: ach.id, title: ach.title, description: ach.description, icon: ach.icon,
    earned: ach.check(progress),
  }));

  return {
    day: dailyResults[today] || streakEvaluateDay(today, tasks, meals, workouts, proteinGoal),
    progress,
    activities: activities.slice(0, 10),
    achievements,
    dailyResults,
  };
}

/**
 * Normalize a server-returned day evaluation object from snake_case to
 * the camelCase keys the frontend UI (renderStreaksUI) expects.
 */
function _normalizeDayEval(day) {
  if (!day) return day;
  return {
    date: day.date,
    taskPoints:            day.task_points       ?? day.taskPoints       ?? 0,
    tasksCompleted:        day.tasks_completed    ?? day.tasksCompleted    ?? 0,
    totalTasks:            day.total_tasks        ?? day.totalTasks        ?? 0,
    proteinMet:            day.protein_met        ?? day.proteinMet        ?? false,
    totalProtein:          day.total_protein      ?? day.totalProtein      ?? 0,
    proteinGoal:           day.protein_goal       ?? day.proteinGoal       ?? 140,
    workoutDone:           day.workout_done       ?? day.workoutDone       ?? false,
    totalWorkouts:         day.total_workouts     ?? day.totalWorkouts     ?? 0,
    completedWorkoutCount: day.completed_workout_count ?? day.completedWorkoutCount ?? 0,
    totalPoints:           day.total_points       ?? day.totalPoints       ?? 0,
    validDay:              day.valid_day          ?? day.validDay          ?? false,
  };
}

/**
 * Fetch streaks/points data from the API (non-demo mode).
 */
async function streakFetchFromApi() {
  try {
    const proteinGoal = nutritionState.baseGoals.protein || 140;
    // Trigger server-side evaluation first
    await fetch('/api/streaks/evaluate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ protein_goal: proteinGoal }),
    });
    // Then fetch progress
    const res = await fetch(`/api/streaks/progress?protein_goal=${proteinGoal}`);
    if (!res.ok) throw new Error('Failed to fetch streaks progress');
    const data = await res.json();
    // Normalize server snake_case keys → camelCase for renderStreaksUI
    if (data && data.day) data.day = _normalizeDayEval(data.day);
    return data;
  } catch (err) {
    console.error('Streaks API fetch failed:', err);
    return null;
  }
}

/**
 * Main evaluation dispatcher — returns same shape for demo and API mode.
 */
async function evaluateStreaksAndPoints() {
  const seq = ++_streakEvalSeq;
  let result;
  if (activeDemoUserId) {
    result = streakFullEvalDemo();
  } else {
    const apiData = await streakFetchFromApi();
    result = apiData || streakFullEvalDemo();
  }
  // If a newer evaluation was requested while we were running, discard this one
  if (seq !== _streakEvalSeq) return null;
  return result;
}

/**
 * Render all Streaks & Points UI elements from evaluation result.
 */
function renderStreaksUI(result) {
  if (!result) return;
  const { day, progress, activities, achievements } = result;

  const currentStreak = progress.current_streak || 0;
  const longestStreak = progress.longest_streak || 0;
  const totalPoints = progress.total_points || 0;
  const level = progress.level || 1;
  const xpNeeded = progress.xp_needed || 200;
  const xpInto = progress.xp_into_level || 0;
  const progressPct = progress.level_pct || 0;
  const pointsRemaining = xpNeeded - xpInto;

  // --- Stat Cards ---
  const currentEl = document.getElementById('streaks-current');
  const currentLblEl = document.getElementById('streaks-current-label');
  const longestEl = document.getElementById('streaks-longest');
  const pointsEl = document.getElementById('streaks-points');
  const levelEl = document.getElementById('streaks-level');
  const nextEl = document.getElementById('streaks-level-next');

  if (currentEl) currentEl.textContent = `${currentStreak} Days`;
  if (currentLblEl) currentLblEl.textContent = currentStreak === 1 ? 'Current Streak' : 'Current Streak';
  if (longestEl) longestEl.textContent = `${longestStreak} Days`;
  if (pointsEl) pointsEl.textContent = totalPoints.toLocaleString();
  if (levelEl) levelEl.textContent = `Level ${level}`;
  if (nextEl) nextEl.textContent = `${pointsRemaining} to level ${level + 1}`;

  // --- Level Progress ---
  const levelNumEl = document.getElementById('streaks-level-num');
  const levelPctEl = document.getElementById('streaks-level-pct');
  const levelBarEl = document.getElementById('streaks-level-bar');
  const levelNoteEl = document.getElementById('streaks-level-note');
  const ringEl = document.getElementById('streaks-level-ring');

  if (levelNumEl) levelNumEl.textContent = String(level);
  if (levelPctEl) levelPctEl.textContent = `${progressPct}%`;
  if (levelBarEl) levelBarEl.style.width = `${progressPct}%`;
  if (levelNoteEl) levelNoteEl.textContent = `${pointsRemaining} more points needed`;
  if (ringEl) ringEl.style.setProperty('--pct', String(progressPct));

  // --- Level progress header: "Progress to Level X" ---
  const levelHeadEl = ringEl?.closest('.streaks-panel')?.querySelector('.streaks-level-progress-head span:first-child');
  if (levelHeadEl) levelHeadEl.textContent = `Progress to Level ${level + 1}`;

  // --- Streak Calendar (last 14 days) ---
  const calendarEl = document.getElementById('streaks-calendar');
  if (calendarEl) {
    const cells = [];
    const dailyResults = result.dailyResults || {};
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = toLocalDateKey(d);
      const dr = dailyResults[key];
      const active = dr && dr.validDay;
      const dayLabel = d.toLocaleDateString('en-US', { weekday: 'narrow' });
      cells.push(`<div class="streaks-day ${active ? 'active' : ''}" title="${key}">${active ? '<i class="fas fa-fire"></i>' : dayLabel}</div>`);
    }
    calendarEl.innerHTML = cells.join('');
  }

  // --- Today's Streak Progress Tracker ---
  if (day) {
    const tasksCompleted = day.tasksCompleted || 0;
    const totalTasks = day.totalTasks || 0;
    const tasksDone = tasksCompleted >= 1;
    const taskPoints = day.taskPoints || 0;
    const taskPct = Math.min(100, Math.round((taskPoints / STREAK_DAILY_TASK_CAP) * 100));

    const protein = Math.round(day.totalProtein || 0);
    const proteinGoal = day.proteinGoal || 140;
    const proteinMet = day.proteinMet;
    const proteinPct = Math.min(100, proteinGoal > 0 ? Math.round((protein / proteinGoal) * 100) : 0);
    const proteinRemaining = Math.max(0, proteinGoal - protein);

    const totalWorkouts = day.totalWorkouts || 0;
    const workoutDone = day.workoutDone;
    const workoutAutoPass = totalWorkouts === 0;
    const workoutCompletedCount = day.completedWorkoutCount || 0;
    const workoutPct = workoutAutoPass ? 100 : (totalWorkouts > 0 ? Math.round((workoutCompletedCount / totalWorkouts) * 100) : 0);
    const workoutsRemaining = workoutAutoPass ? 0 : Math.max(0, totalWorkouts - workoutCompletedCount);

    const streakSafe = proteinMet && (workoutDone || workoutAutoPass) && tasksDone;

    const barClass = (pct, done) => done ? 'complete' : (pct > 0 ? 'partial' : '');

    // Tasks pillar
    const tasksPillar = document.getElementById('streak-pillar-tasks');
    const tasksBar = document.getElementById('streak-tasks-bar');
    const tasksStat = document.getElementById('streak-tasks-stat');
    const tasksHint = document.getElementById('streak-tasks-hint');
    if (tasksPillar) tasksPillar.classList.toggle('done', tasksDone);
    if (tasksBar) { tasksBar.style.width = `${taskPct}%`; tasksBar.className = `streak-pillar-fill ${barClass(taskPct, tasksDone)}`; }
    if (tasksStat) tasksStat.textContent = `${taskPoints} / ${STREAK_DAILY_TASK_CAP} pts`;
    if (tasksHint) {
      if (!tasksDone) {
        tasksHint.textContent = 'Complete at least 1 task to lock today\'s streak';
      } else if (taskPoints >= STREAK_DAILY_TASK_CAP) {
        tasksHint.textContent = `\u2705 Task cap reached! ${STREAK_DAILY_TASK_CAP} pts earned`;
      } else {
        tasksHint.textContent = `\u2705 Streak safe! ${STREAK_DAILY_TASK_CAP - taskPoints} more pts possible today`;
      }
    }

    // Protein pillar
    const proteinPillar = document.getElementById('streak-pillar-protein');
    const proteinBar = document.getElementById('streak-protein-bar');
    const proteinStat = document.getElementById('streak-protein-stat');
    const proteinHint = document.getElementById('streak-protein-hint');
    if (proteinPillar) proteinPillar.classList.toggle('done', proteinMet);
    if (proteinBar) { proteinBar.style.width = `${proteinPct}%`; proteinBar.className = `streak-pillar-fill ${barClass(proteinPct, proteinMet)}`; }
    if (proteinStat) proteinStat.textContent = `${protein}g / ${proteinGoal}g`;
    if (proteinHint) proteinHint.textContent = proteinMet ? '\u2705 Protein goal met! +50 pts earned' : `${proteinRemaining}g protein away from streak safety`;

    // Workout pillar
    const workoutPillar = document.getElementById('streak-pillar-workout');
    const workoutBar = document.getElementById('streak-workout-bar');
    const workoutStat = document.getElementById('streak-workout-stat');
    const workoutHint = document.getElementById('streak-workout-hint');
    if (workoutPillar) workoutPillar.classList.toggle('done', workoutDone || workoutAutoPass);
    if (workoutBar) { workoutBar.style.width = `${workoutPct}%`; workoutBar.className = `streak-pillar-fill ${barClass(workoutPct, workoutDone || workoutAutoPass)}`; }
    if (workoutStat) workoutStat.textContent = workoutAutoPass ? 'No workouts scheduled' : `${workoutDone ? totalWorkouts : workoutCompletedCount} / ${totalWorkouts} completed`;
    if (workoutHint) workoutHint.textContent = workoutAutoPass
      ? '\u2705 Auto-pass — no workouts scheduled today'
      : (workoutDone ? '\u2705 All workouts complete! +50 pts earned' : `${workoutsRemaining} workout${workoutsRemaining !== 1 ? 's' : ''} left to lock today's streak`);

    // Safety badge
    const badge = document.getElementById('streak-safety-badge');
    if (badge) {
      badge.classList.toggle('safe', streakSafe);
      badge.innerHTML = streakSafe
        ? '<i class="fas fa-lock"></i><span>Streak Locked</span>'
        : '<i class="fas fa-lock-open"></i><span>Streak at Risk</span>';
    }

    // Footer
    const footer = document.getElementById('streaks-today-footer');
    if (footer) {
      footer.classList.toggle('safe', streakSafe);
      footer.innerHTML = streakSafe
        ? `<i class="fas fa-fire"></i><span>Today's streak is locked! +${day.totalPoints || 0} points earned</span>`
        : '<i class="fas fa-shield-halved"></i><span>Complete all items above to lock today\'s streak</span>';
    }
  }

  // --- Today Status (Points panel summary) ---
  const todayStatusEl = document.getElementById('streaks-today-status');
  if (todayStatusEl && day) {
    const checkIcon = (done) => done ? '<i class="fas fa-check-circle" style="color:var(--accent-primary);"></i>' : '<i class="fas fa-times-circle" style="color:var(--text-muted);"></i>';
    todayStatusEl.innerHTML = `
      <div class="streaks-today-checklist">
        <div class="streaks-today-item">${checkIcon(day.proteinMet)} Protein goal (${Math.round(day.totalProtein || 0)}g / ${day.proteinGoal || 140}g)</div>
        <div class="streaks-today-item">${checkIcon(day.workoutDone)} All workouts completed (${day.totalWorkouts || 0} scheduled)</div>
        <div class="streaks-today-item">${checkIcon(day.tasksCompleted > 0)} Tasks completed (${day.tasksCompleted || 0} done, +${day.taskPoints || 0} pts)</div>
        <div class="streaks-today-item" style="margin-top:6px;font-weight:600;">
          ${day.validDay ? '<i class="fas fa-fire" style="color:var(--accent-primary);"></i> Valid streak day!' : '<i class="fas fa-info-circle" style="color:var(--text-muted);"></i> Not yet a valid streak day'}
          &mdash; Today: <strong>+${day.totalPoints || 0}</strong> points
        </div>
      </div>
    `;
  }

  // --- Activity Feed ---
  const activityEl = document.getElementById('streaks-activity-list');
  if (activityEl) {
    if (activities && activities.length > 0) {
      const iconMap = { task: 'fa-list-check', nutrition: 'fa-utensils', workout: 'fa-dumbbell' };
      activityEl.innerHTML = activities.map(item => {
        const icon = iconMap[item.category] || 'fa-arrow-trend-up';
        const timeStr = formatStreakActivityTime(item.time);
        return `
          <article class="streaks-activity-item">
            <div class="streaks-activity-icon"><i class="fas ${icon}"></i></div>
            <div class="streaks-activity-main">
              <strong>${escapeHtml(item.action)}</strong>
              <div class="meta">
                <span>${timeStr}</span>
                <span class="streaks-priority ${item.priority || 'medium'}">${item.priority || 'medium'}</span>
              </div>
            </div>
            <div class="streaks-activity-points"><strong>+${item.points}</strong><span>points</span></div>
          </article>
        `;
      }).join('');
    } else {
      activityEl.innerHTML = '<div class="tasks-empty-state">No activity yet. Complete tasks, log meals, and finish workouts to earn points!</div>';
    }
  }

  // --- Achievements ---
  const achievementsEl = document.getElementById('streaks-achievements');
  if (achievementsEl && achievements) {
    achievementsEl.innerHTML = achievements.map(item => `
      <article class="streaks-achievement ${item.earned ? '' : 'locked'}">
        <div class="icon"><i class="fas ${item.icon}"></i></div>
        <h4>${item.title}</h4>
        <p>${item.description}</p>
        <span>${item.earned ? '<i class="fas fa-check"></i> Earned' : 'Locked'}</span>
      </article>
    `).join('');
  }

  // --- Sidebar Mini Card ---
  const sidebarStreak = document.getElementById('sidebar-streak-value');
  const sidebarLevel = document.getElementById('sidebar-level-value');
  const sidebarPoints = document.getElementById('sidebar-points-value');
  if (sidebarStreak) sidebarStreak.textContent = `${currentStreak} Days`;
  if (sidebarLevel) sidebarLevel.textContent = `Level ${level}`;
  if (sidebarPoints) sidebarPoints.textContent = totalPoints.toLocaleString();

  // --- Dashboard Banner ---
  const dashStreak = document.getElementById('dash-streak-label');
  const dashLevel = document.getElementById('dash-level-value');
  const dashPoints = document.getElementById('dash-points-value');
  if (dashStreak) dashStreak.textContent = `${currentStreak} Day Streak`;
  if (dashLevel) dashLevel.textContent = `Level ${level}`;
  if (dashPoints) dashPoints.textContent = `${totalPoints.toLocaleString()} Points`;

  // --- Persist to localStorage for instant display on refresh ---
  saveStreakCache(result);
}

function formatStreakActivityTime(timeStr) {
  if (!timeStr) return '';
  const today = todayDateKey();
  // If it's just a date string (YYYY-MM-DD)
  if (/^\d{4}-\d{2}-\d{2}$/.test(timeStr)) {
    if (timeStr === today) return 'Today';
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    if (timeStr === toLocalDateKey(yesterday)) return 'Yesterday';
    return new Date(timeStr + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
  // ISO datetime
  try {
    const d = new Date(timeStr);
    const now = new Date();
    const diffMs = now - d;
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin} min ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr} hour${diffHr > 1 ? 's' : ''} ago`;
    if (toLocalDateKey(d) === today) return 'Today';
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    if (toLocalDateKey(d) === toLocalDateKey(yesterday)) return 'Yesterday';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch (_e) {
    return timeStr;
  }
}

// ========================================
// Streaks Experience
// ========================================

async function setupStreaks() {
  if (!document.getElementById('streaks')) return;
  // Render from cache immediately for instant, non-zero display
  const cached = loadStreakCache();
  if (cached) renderStreaksUI(cached);
  // Only evaluate now if we have a data context; otherwise wait for loadActiveUserDataViews
  if (activeDemoUserId || !cached) {
    const result = await evaluateStreaksAndPoints();
    if (result) renderStreaksUI(result);
  }
  animateStreaksEntry();
}

/**
 * Re-evaluate streaks & points after any data change (task toggle, meal log, workout completion).
 * Updates the streaks page if visible, plus sidebar and dashboard.
 */
async function refreshStreaksAfterChange() {
  try {
    const result = await evaluateStreaksAndPoints();
    if (result) renderStreaksUI(result);
  } catch (err) {
    console.error('Streaks refresh failed:', err);
  }
}

function animateStreaksEntry() {
  const shell = document.querySelector('#streaks .streaks-shell');
  if (!shell) return;
  
  const cards = shell.querySelectorAll('.streaks-stat-card, .streaks-panel');
  cards.forEach((card, index) => {
    card.style.setProperty('--streak-delay', `${100 + (index * 60)}ms`);
  });
  
  shell.classList.remove('is-animated');
  void shell.offsetWidth;
  shell.classList.add('is-animated');
}

