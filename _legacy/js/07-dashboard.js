  calorieGoal: 2200,
  weeklyWorkoutTarget: 5,
  selectedQuickActions: ['start_timer', 'log_workout', 'log_meal']
};

const DASH_QUICK_ACTIONS_KEY = 'fittrack_dash_quick_actions_v1';
const DASH_QUICK_ACTION_OPTIONS = [
  { id: 'start_timer', label: 'Start Timer', icon: 'fa-stopwatch', colorClass: 'blue' },
  { id: 'log_workout', label: 'Log Workout', icon: 'fa-dumbbell', colorClass: 'green' },
  { id: 'log_meal', label: 'Log Meal', icon: 'fa-apple-whole', colorClass: 'orange' },
  { id: 'add_task', label: 'Add Task', icon: 'fa-square-check', colorClass: 'pink' },
  { id: 'new_project', label: 'New Project', icon: 'fa-folder-plus', colorClass: 'indigo' },
  { id: 'view_streaks', label: 'View Streaks', icon: 'fa-fire', colorClass: 'amber' }
];
const QUICK_ACTION_FEATURE_MAP = {
  log_workout: 'showWorkout',
  log_meal: 'showNutrition',
  new_project: 'showProjects'
};

function isFeatureEnabled(featureKey) {
  if (!featureKey) return true;
  return !!activeDemoFeaturePrefs[featureKey];
}

function isQuickActionAllowed(actionId) {
  const requiredFeature = QUICK_ACTION_FEATURE_MAP[actionId];
  return isFeatureEnabled(requiredFeature);
}

function getAllowedQuickActionOptions() {
  return DASH_QUICK_ACTION_OPTIONS.filter(option => isQuickActionAllowed(option.id));
}

function defaultQuickActionsByPreferences() {
  const preferred = ['start_timer', 'log_workout', 'log_meal', 'add_task', 'new_project', 'view_streaks'];
  return preferred.filter(isQuickActionAllowed).slice(0, 3);
}

function sanitizeDashboardQuickActions() {
  const cleaned = dashboardState.selectedQuickActions
    .filter((id, idx, arr) => arr.indexOf(id) === idx)
    .filter(isQuickActionAllowed)
    .slice(0, 3);

  if (cleaned.length) {
    dashboardState.selectedQuickActions = cleaned;
    return;
  }

  const fallback = defaultQuickActionsByPreferences();
  dashboardState.selectedQuickActions = fallback.length ? fallback : ['start_timer'];
}

function loadDashboardQuickActions() {
  try {
    const raw = localStorage.getItem(DASH_QUICK_ACTIONS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const validIds = new Set(DASH_QUICK_ACTION_OPTIONS.map(opt => opt.id));
        dashboardState.selectedQuickActions = parsed.filter(id => validIds.has(id)).slice(0, 3);
      }
    }
  } catch (_err) {
    dashboardState.selectedQuickActions = defaultQuickActionsByPreferences();
  }
  sanitizeDashboardQuickActions();
}

function persistDashboardQuickActions() {
  localStorage.setItem(DASH_QUICK_ACTIONS_KEY, JSON.stringify(dashboardState.selectedQuickActions));
}

function actionOptionById(actionId) {
  return getAllowedQuickActionOptions().find(opt => opt.id === actionId) || null;
}

function renderDashboardQuickActionButtons() {
  const wrap = document.getElementById('dash-actions');
  if (!wrap) return;
  wrap.innerHTML = dashboardState.selectedQuickActions
    .map(actionId => {
      const option = actionOptionById(actionId);
      if (!option) return '';
      return `
        <button class="dash-action ${option.colorClass}" data-action="dash-quick-run" data-quick-action="${option.id}">
          <i class="fas ${option.icon}"></i> ${option.label}
        </button>
      `;
    })
    .join('');
}

function renderDashboardQuickActionPicker() {
  const list = document.getElementById('dash-action-option-list');
  if (!list) return;

  list.innerHTML = getAllowedQuickActionOptions().map(option => {
    const selected = dashboardState.selectedQuickActions.includes(option.id);
    const atLimit = dashboardState.selectedQuickActions.length >= 3;
    const disabledAdd = !selected && atLimit;
    return `
      <div class="dash-action-option ${selected ? 'is-selected' : ''} ${option.id}">
        <i class="fas ${option.icon}"></i>
        <span class="name">${option.label}</span>
        <button type="button" data-action="dash-quick-toggle" data-quick-action="${option.id}" ${disabledAdd ? 'disabled' : ''}>
          <i class="fas ${selected ? 'fa-minus' : 'fa-plus'}"></i>
        </button>
      </div>
    `;
  }).join('');
}

function openDashboardActionPicker(open) {
  const picker = document.getElementById('dash-action-picker');
  const btn = document.getElementById('dash-action-picker-btn');
  const panel = document.getElementById('dash-action-picker-panel');
  if (!picker || !btn || !panel) return;

  picker.classList.toggle('open', open);
  btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  panel.setAttribute('aria-hidden', open ? 'false' : 'true');
}

function runDashboardQuickAction(actionId) {
  if (!isQuickActionAllowed(actionId)) return;
  if (actionId === 'start_timer') {
    toggleDashboardTimer();
    return;
  }
  if (actionId === 'log_workout') {
    showPage('workout');
    return;
  }
  if (actionId === 'log_meal') {
    showPage('nutrition');
    const toggleBtn = document.getElementById('nutrition-toggle-form-btn');
    if (toggleBtn) toggleBtn.click();
    return;
  }
  if (actionId === 'add_task') {
    showPage('tasks');
    const addBtn = document.getElementById('add-task-btn');
    if (addBtn) addBtn.click();
    return;
  }
  if (actionId === 'new_project') {
    showPage('projects');
    const newBtn = document.getElementById('projects-new-btn');
    if (newBtn) newBtn.click();
    return;
  }
  if (actionId === 'view_streaks') {
    showPage('streaks');
  }
}

function formatTimer(seconds) {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${String(hrs).padStart(2, '0')}h ${String(mins).padStart(2, '0')}m ${String(secs).padStart(2, '0')}s`;
}

function updateDashboardTimerUI() {
  const timeEl = document.getElementById('dash-stat-time');
  const pillEl = document.getElementById('dash-timer-pill');
  const timerBtn = document.querySelector('[data-quick-action="start_timer"]');
  const floatingTimer = document.getElementById('dash-floating-timer');
  const floatingValue = document.getElementById('dash-floating-timer-value');
  const floatingToggle = document.getElementById('dash-floating-timer-toggle');
  if (timeEl) timeEl.textContent = formatTimer(dashboardState.timerSeconds);
  if (pillEl) {
    pillEl.textContent = dashboardState.timerRunning ? 'Timer running' : 'Timer off';
    pillEl.classList.toggle('running', dashboardState.timerRunning);
  }
  if (timerBtn) {
    timerBtn.innerHTML = dashboardState.timerRunning
      ? '<i class="fas fa-circle-stop"></i> Stop Timer'
      : '<i class="fas fa-stopwatch"></i> Start Timer';
  }
  if (floatingValue) {
    floatingValue.textContent = formatTimer(dashboardState.timerSeconds);
  }
  if (floatingToggle) {
    floatingToggle.innerHTML = dashboardState.timerRunning
      ? '<i class="fas fa-circle-stop"></i><span>Stop Timer</span>'
      : '<i class="fas fa-stopwatch"></i><span>Start Timer</span>';
  }
  if (floatingTimer) {
    floatingTimer.classList.toggle('running', dashboardState.timerRunning);
  }
}

function toggleDashboardTimer() {
  if (dashboardState.timerRunning) {
    dashboardState.timerRunning = false;
    if (dashboardState.timerInterval) clearInterval(dashboardState.timerInterval);
    dashboardState.timerInterval = null;
  } else {
    // TIMER ABUSE PREVENTION: Max 12 hours (43200 sec) per session to prevent time inflation
    if (dashboardState.timerSeconds >= 12 * 3600) {
      alert('⏱️ Timer limit reached (12 hours). Start a new session.');
      return;
    }
    dashboardState.timerRunning = true;
    dashboardState.timerInterval = setInterval(() => {
      dashboardState.timerSeconds += 1;
      updateDashboardTimerUI();
    }, 1000);
  }
  updateDashboardTimerUI();
}

async function refreshDashboardMetrics() {
  try {
    let summary;
    let workouts;
    if (activeDemoUserId) {
      const meals = getActiveUserMealsData();
      const today = todayDateKey();
      workouts = workoutState.workouts.length
        ? workoutState.workouts
        : getActiveUserWorkoutsData().map(w => ({ ...w, completed: !!workoutMeta(w.id).completed }));
      const todayCalories = meals
        .filter(m => String(m.date) === today)
        .reduce((sum, m) => sum + parseMacro(m.calories), 0);
      const todayWorkoutCount = workouts.filter(w => String(w.date) === today && w.completed).length;
      const burned = workouts.filter(w => w.completed).reduce((sum, w) => sum + (Number(w.calories_burned) || 0), 0);
      summary = {
        workouts: { total_workouts: todayWorkoutCount, total_calories_burned: burned },
        nutrition: { total_calories: todayCalories }
      };
    } else {
      const summaryRes = await fetch('/api/analytics/summary');
      const workoutsRes = await fetch('/api/workouts');
      if (!summaryRes.ok || !workoutsRes.ok) return;
      summary = await summaryRes.json();
      workouts = await workoutsRes.json();
    }
    const tasks = taskUiState.tasks || [];

    const completedTasks = tasks.filter(t => t.completed).length;
    const totalTasks = tasks.length;

    const todayWorkoutDone = isFeatureEnabled('showWorkout') && (summary.workouts?.total_workouts || 0) > 0 ? 1 : 0;
    const nutritionCal = isFeatureEnabled('showNutrition') ? Math.round(summary.nutrition?.total_calories || 0) : 0;
    const caloriesBurned = Math.round(summary.workouts?.total_calories_burned || 0);

    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weeklyCount = isFeatureEnabled('showWorkout') ? (Array.isArray(workouts) ? workouts : []).filter(w => {
      const d = new Date(w.date || '');
      return d >= weekAgo;
    }).length : 0;
    const weeklyPct = Math.max(0, Math.min(100, Math.round((weeklyCount / dashboardState.weeklyWorkoutTarget) * 100)));

    const workoutBar = document.getElementById('dash-workout-bar');
    const statWorkouts = document.getElementById('dash-stat-workouts');
    const statGoals = document.getElementById('dash-stat-goals');
    const statBurned = document.getElementById('dash-stat-burned');
    const taskLabel = document.getElementById('dash-progress-tasks-label');
    const workoutLabel = document.getElementById('dash-progress-workout-label');
    const nutritionLabel = document.getElementById('dash-progress-nutrition-label');
    const taskBar = document.getElementById('dash-progress-tasks-bar');
    const workoutProgressBar = document.getElementById('dash-progress-workout-bar');
    const nutritionBar = document.getElementById('dash-progress-nutrition-bar');

    if (workoutBar) workoutBar.style.width = `${weeklyPct}%`;
    if (statWorkouts) statWorkouts.textContent = `${weeklyCount}/${dashboardState.weeklyWorkoutTarget}`;
    if (statGoals) statGoals.textContent = `${completedTasks}/${Math.max(totalTasks, 1)}`;
    if (statBurned) statBurned.textContent = String(caloriesBurned);

    if (taskLabel) taskLabel.textContent = `${completedTasks}/${Math.max(totalTasks, 1)}`;
    if (workoutLabel) workoutLabel.textContent = `${todayWorkoutDone}/1`;
    if (nutritionLabel) nutritionLabel.textContent = `${nutritionCal}/${dashboardState.calorieGoal} cal`;
    if (taskBar) taskBar.style.width = `${Math.round((completedTasks / Math.max(totalTasks, 1)) * 100)}%`;
    if (workoutProgressBar) workoutProgressBar.style.width = `${todayWorkoutDone ? 100 : 0}%`;
    if (nutritionBar) nutritionBar.style.width = `${Math.max(0, Math.min(100, Math.round((nutritionCal / dashboardState.calorieGoal) * 100)))}%`;

    const activityList = document.getElementById('dash-activity-list');
    if (activityList) {
      const taskActivities = materializeTasksForRender(tasks)
        .filter(t => !t.completed)
        .sort((a, b) => taskDueAt(a).getTime() - taskDueAt(b).getTime())
        .slice(0, 3)
        .map(t => ({
          title: t.title,
          category: 'Task',
          priority: t.priority || 'medium',
          time: formatTaskDue(t),
          icon: 'fa-list-check',
          page: 'tasks',
          taskId: t.id
        }));

      const workoutActivities = isFeatureEnabled('showWorkout')
        ? (Array.isArray(workouts) ? workouts : [])
          .sort((a, b) => {
            const aTs = new Date(`${a.date || ''}T${a.time || '09:00'}`).getTime();
            const bTs = new Date(`${b.date || ''}T${b.time || '09:00'}`).getTime();
            return aTs - bTs;
          })
          .slice(0, 2)
          .map(w => {
            const dateObj = new Date(`${w.date || ''}T${w.time || '09:00'}`);
            const isToday = isTodayDate(dateObj);
            return {
              title: w.name || 'Workout',
              category: 'Workout',
              priority: isToday ? 'high' : 'medium',
              time: dateObj.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
              icon: 'fa-dumbbell',
              page: 'workout'
            };
          })
        : [];

      const activities = [...taskActivities, ...workoutActivities]
        .sort((a, b) => {
          const aIsTask = a.page === 'tasks' ? 0 : 1;
          const bIsTask = b.page === 'tasks' ? 0 : 1;
          return aIsTask - bIsTask;
        })
        .slice(0, 5);

      activityList.innerHTML = activities.length
        ? activities.map(a => `
          <div class="dash-activity-item" data-action="dash-open-page" data-page="${a.page}" ${a.taskId ? `data-task-id="${a.taskId}"` : ''}>
            <div class="dash-activity-icon"><i class="fas ${a.icon}"></i></div>
            <div class="dash-activity-main"><strong>${escapeHtml(a.title)}</strong><span>${a.category}</span></div>
            <span class="dash-priority ${a.priority}">${a.priority}</span>
            <time>${escapeHtml(a.time)}</time>
          </div>
        `).join('')
        : '<div class="tasks-empty-state">No upcoming activities yet.</div>';
    }
  } catch (err) {
    console.error('Dashboard metrics refresh failed:', err);
  }
}

function setupDashboard() {
  if (!document.getElementById('dashboard')) return;

  const actionsWrap = document.getElementById('dash-actions');
  const actionPicker = document.getElementById('dash-action-picker');
  const pickerBtn = document.getElementById('dash-action-picker-btn');
  const pickerList = document.getElementById('dash-action-option-list');
  const floatingToggle = document.getElementById('dash-floating-timer-toggle');
  const activityList = document.getElementById('dash-activity-list');
  const workoutsCard = document.getElementById('dash-stat-card-workouts');
  const goalsCard = document.getElementById('dash-stat-card-goals');
  const caloriesCard = document.getElementById('dash-stat-burned')?.closest('.dash-stat-card');
  const tasksProgressRow = document.getElementById('dash-progress-row-tasks');
  const workoutProgressRow = document.getElementById('dash-progress-row-workout');

  loadDashboardQuickActions();
  renderDashboardQuickActionButtons();
  renderDashboardQuickActionPicker();

  if (actionsWrap) {
    actionsWrap.addEventListener('click', (e) => {
      const actionEl = e.target.closest('[data-action="dash-quick-run"]');
      if (!actionEl) return;
      const actionId = actionEl.getAttribute('data-quick-action');
      if (!actionId) return;
      runDashboardQuickAction(actionId);
      updateDashboardTimerUI();
    });
  }

  if (pickerBtn) {
    pickerBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = actionPicker?.classList.contains('open');
      openDashboardActionPicker(!isOpen);
    });
  }

  if (pickerList) {
    pickerList.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action="dash-quick-toggle"]');
      if (!btn) return;
      const actionId = btn.getAttribute('data-quick-action');
      if (!actionId) return;
      if (!isQuickActionAllowed(actionId)) return;

      const exists = dashboardState.selectedQuickActions.includes(actionId);
      if (exists) {
        dashboardState.selectedQuickActions = dashboardState.selectedQuickActions.filter(id => id !== actionId);
      } else if (dashboardState.selectedQuickActions.length < 3) {
        dashboardState.selectedQuickActions.push(actionId);
      }

      sanitizeDashboardQuickActions();

      persistDashboardQuickActions();
      renderDashboardQuickActionButtons();
      renderDashboardQuickActionPicker();
      updateDashboardTimerUI();
    });
  }

  document.addEventListener('click', (e) => {
    if (!actionPicker) return;
    if (!actionPicker.contains(e.target)) {
      openDashboardActionPicker(false);
    }
  });

  if (floatingToggle) {
    floatingToggle.addEventListener('click', toggleDashboardTimer);
  }

  if (workoutsCard) {
    workoutsCard.classList.add('is-link');
    workoutsCard.addEventListener('click', () => showPage('workout'));
  }

  if (goalsCard) {
    goalsCard.classList.add('is-link');
    goalsCard.addEventListener('click', () => showPage('tasks'));
  }

  if (caloriesCard) {
    caloriesCard.classList.add('is-link');
    caloriesCard.addEventListener('click', () => showPage('nutrition'));
  }

  if (tasksProgressRow) {
    tasksProgressRow.classList.add('is-link');
    tasksProgressRow.addEventListener('click', () => showPage('tasks'));
  }

  if (workoutProgressRow) {
    workoutProgressRow.classList.add('is-link');
    workoutProgressRow.addEventListener('click', () => showPage('workout'));
  }

  if (activityList) {
    activityList.addEventListener('click', (e) => {
      const actionEl = e.target.closest('[data-action="dash-open-page"]');
      if (!actionEl) return;
      const page = actionEl.getAttribute('data-page');
      const taskId = Number(actionEl.getAttribute('data-task-id'));
      if (!page) return;
      showPage(page);
      if (page === 'tasks' && taskId) {
        taskUiState.expanded.add(taskId);
        renderTasks(taskUiState.tasks);
      }
    });
  }

  updateDashboardTimerUI();
  refreshDashboardMetrics();
}
