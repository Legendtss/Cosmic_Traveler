/**
 * FILE: script.js
 * ──────────────────────────────────────────────────────────────
 * Responsibility:
 *   Monolithic frontend controller for FitTrack Pro.
 *   Handles ALL UI rendering, state management, API calls,
 *   and user interactions for every feature module.
 *
 * Sections (in order):
 *   1.  Page Navigation & Layout           (L~1–150)
 *   2.  Demo User System                   (L~153–1025)
 *   3.  Priority Colors                    (L~1026–1056)
 *   4.  Task Rendering & Views             (L~1057–1673)
 *   5.  Tasks API & Interactions           (L~1674–2443)
 *   6.  Calendar Experience                (L~2444–3082)
 *   7.  Nutrition Experience               (L~3083–4666)
 *   8.  Dashboard Experience               (L~4667–5134)
 *   9.  Streaks & Points Engine            (L~5135–5777)
 *   10. Projects Experience                (L~5778–6412)
 *   11. Workout Experience                 (L~6413–7072)
 *   12. Statistics Experience              (L~7073–7782)
 *   13. Profile Experience                 (L~7783–8387)
 *   14. Modal Setup                        (L~8388–8483)
 *   15. Initialization (DOMContentLoaded)  (L~8484–8552)
 *   16. AI Avatar Chat Widget              (L~8553–9544)
 *   17. Mentor AI                          (L~9545–9850)
 *   18. Focus / Study Module               (L~9852–10594)
 *   19. Notes Module                       (L~10595–10829)
 *
 * Global State Objects:
 *   taskUiState, taskEnhancements, calendarState, nutritionState,
 *   nutritionBuilderState, dashboardState, projectsState, workoutState,
 *   statisticsState, profileState, _focus, _notes
 *
 * MUST NOT:
 *   - Be split without updating index.html <script> tag
 *   - Assume any module loads before DOMContentLoaded
 *
 * Depends on:
 *   - index.html (DOM element IDs)
 *   - styles.css (CSS classes)
 *   - Flask backend API at /api/*
 *   - External: Sortable.js (window.Sortable) for calendar DnD
 *   - External: Font Awesome (icons)
 * ──────────────────────────────────────────────────────────────
 */

// ========================================================================
// Â§1  PAGE NAVIGATION & LAYOUT
// ========================================================================
// Controls which page-section is visible. Nav icon animations.
// Also: task detail accordion toggle, mobile sidebar hamburger menu.
// âš ï¸ Global: showPage() is monkey-patched by Notes module at EOF.

const NAV_ICON_ANIMATION_CLASSES = [
  'icon-anim-task',
  'icon-anim-project',
  'icon-anim-workout'
];

function navIconAnimationClass(pageName) {
  if (pageName === 'tasks') return 'icon-anim-task';
  if (pageName === 'projects') return 'icon-anim-project';
  if (pageName === 'workout') return 'icon-anim-workout';
  return '';
}

function triggerNavIconAnimation(icon, pageName) {
  if (!icon) return;

  NAV_ICON_ANIMATION_CLASSES.forEach(cls => icon.classList.remove(cls));
  const animClass = navIconAnimationClass(pageName);
  if (!animClass) return;

  // Force reflow so animation can replay on each click.
  void icon.offsetWidth;
  icon.classList.add(animClass);

  const timeoutMs = Number(icon.getAttribute('data-nav-anim-timeout') || 0);
  if (timeoutMs > 0) {
    setTimeout(() => {
      icon.classList.remove(animClass);
    }, timeoutMs);
    return;
  }

  icon.addEventListener('animationend', () => {
    icon.classList.remove(animClass);
  }, { once: true });
}

function showPage(pageName) {
  // UI STATE CONSISTENCY: Prevent navigation to disabled features
  const navItem = document.querySelector(`.sidebar .nav-item[onclick*="'${pageName}'"]`);
  if (navItem && navItem.hasAttribute('data-feature')) {
    const feature = navItem.getAttribute('data-feature');
    const record = getUserPrefsRecord();
    const currentPrefs = (record && record.preferences)
      ? record.preferences
      : activeFeaturePrefs;
    const featureKey = `show${feature.charAt(0).toUpperCase() + feature.slice(1)}`;
    if (currentPrefs && Object.prototype.hasOwnProperty.call(currentPrefs, featureKey) && !currentPrefs[featureKey]) {
      console.warn(`Feature '${feature}' is disabled`)
      return; // Don't navigate to disabled features
    }
  }

  const pages = document.querySelectorAll('.page-section');
  pages.forEach(page => page.classList.remove('active'));
  
  const page = document.getElementById(pageName);
  if (page) page.classList.add('active');
  
  const navItems = document.querySelectorAll('.sidebar .nav-item');
  navItems.forEach(item => item.classList.remove('active'));
  
  if (navItem) {
    navItem.classList.add('active');

    const animTargets = navItem.querySelectorAll('[data-nav-anim-target]');
    if (animTargets.length) {
      animTargets.forEach((target) => triggerNavIconAnimation(target, pageName));
    } else {
      const icon = navItem.querySelector('i');
      triggerNavIconAnimation(icon, pageName);
    }
  }

  openDashboardActionPicker(false);
  closeProfileMenu();
  closeMobileSidebar();
  
  // Trigger page-specific animations
  if (pageName === 'streaks') {
    requestAnimationFrame(() => animateStreaksEntry());
  } else if (pageName === 'statistics') {
    requestAnimationFrame(() => animateStatisticsEntry());
  } else if (pageName === 'focus') {
    requestAnimationFrame(() => {
      _focusUpdateDisplay();
      _focusRenderSessions();
      _focusUpdateSummary();
    });
  }

  // Focus mode navigation guard
  if (_focus.focusModeActive && !_focus.whitelist.includes(pageName)) {
    _focusShowExitModal();
    // Re-navigate to focus
    const focusPage = document.getElementById('focus');
    if (focusPage) {
      document.querySelectorAll('.page-section').forEach(p => p.classList.remove('active'));
      focusPage.classList.add('active');
    }
    return;
  }
}

// Task Expansion
function toggleTaskDetails(element, event) {
  if (event) event.stopPropagation();
  const details = element.nextElementSibling;
  if (details && details.classList.contains('task-details')) {
    const isVisible = details.style.display !== 'none';
    details.style.display = isVisible ? 'none' : 'block';
    
    const chevron = element.querySelector('.fa-chevron-down');
    if (chevron) {
      chevron.style.transform = isVisible ? 'rotate(0deg)' : 'rotate(180deg)';
    }
  }
}

/* ── Mobile sidebar hamburger toggle ── */
function openMobileSidebar() {
  const sidebar = document.querySelector('.sidebar');
  const hamburger = document.getElementById('mobile-hamburger');
  const overlay = document.getElementById('sidebar-overlay');
  if (sidebar) sidebar.classList.add('is-open');
  if (hamburger) { hamburger.classList.add('is-open'); hamburger.setAttribute('aria-expanded', 'true'); }
  if (overlay) overlay.classList.add('is-visible');
}
function closeMobileSidebar() {
  const sidebar = document.querySelector('.sidebar');
  const hamburger = document.getElementById('mobile-hamburger');
  const overlay = document.getElementById('sidebar-overlay');
  if (sidebar) sidebar.classList.remove('is-open');
  if (hamburger) { hamburger.classList.remove('is-open'); hamburger.setAttribute('aria-expanded', 'false'); }
  if (overlay) overlay.classList.remove('is-visible');
}
(function initMobileMenu() {
  const hamburger = document.getElementById('mobile-hamburger');
  const overlay = document.getElementById('sidebar-overlay');
  if (hamburger) hamburger.addEventListener('click', function () {
    const sidebar = document.querySelector('.sidebar');
    if (sidebar && sidebar.classList.contains('is-open')) closeMobileSidebar();
    else openMobileSidebar();
  });
  if (overlay) overlay.addEventListener('click', closeMobileSidebar);
})();

// ========================================================================
// Â§2  AUTH SESSION BOOTSTRAP
// ========================================================================
// Replaces the legacy demo-user system. All data now flows through
// the server API with session-cookie authentication.
// AuthModule (js/00-auth.js) handles signup/login/logout/session check.
// âš ï¸ Global mutable: activeFeaturePrefs (kept for feature-pref compat)


// Utility: deep clone via structured clone (with JSON fallback)
function deepClone(obj) {
  try { return structuredClone(obj); }
  catch (_e) { return JSON.parse(JSON.stringify(obj)); }
}

const DEFAULT_FEATURE_PREFS = {
  showProjects: true,
  showWorkout: true,
  showNutrition: true
};
let activeFeaturePrefs = { ...DEFAULT_FEATURE_PREFS };

// User-scoped localStorage key prefix (uses server user ID)
function _userKeyPrefix(base) {
  const u = AuthModule.currentUser;
  return u ? `${base}_${u.id}` : base;
}

// Feature-preference persistence (now per-user in localStorage keyed by
// server user ID, no longer demo-user keyed).
const USER_PREFS_KEY = 'fittrack_user_prefs_v2';

function _prefsStoreKey() {
  const u = AuthModule.currentUser;
  return u ? `${USER_PREFS_KEY}_${u.id}` : USER_PREFS_KEY;
}

function getUserPrefsRecord() {
  try {
    const raw = localStorage.getItem(_prefsStoreKey());
    return raw ? JSON.parse(raw) : null;
  } catch (_e) { return null; }
}

function saveUserPrefsRecord(record) {
  try {
    localStorage.setItem(_prefsStoreKey(), JSON.stringify(record));
  } catch (_e) { /* quota exceeded */ }
}

function setSessionView(view) {
  const app = document.getElementById('app-wrapper');
  const introScreen = document.getElementById('intro-screen');
  const authScreen = document.getElementById('auth-screen');
  const onboarding = document.getElementById('demo-onboarding');
  const demoTour = document.getElementById('demo-tour');
  const profileEssentials = document.getElementById('profile-essentials');

  if (app) app.style.display = view === 'app' ? 'grid' : 'none';
  if (introScreen) introScreen.classList.toggle('hidden', view !== 'intro');
  if (authScreen) authScreen.classList.toggle('hidden', view !== 'auth');
  if (onboarding) onboarding.classList.toggle('hidden', view !== 'onboarding');
  if (demoTour) demoTour.classList.toggle('hidden', view !== 'demo-tour');
  if (profileEssentials) profileEssentials.classList.toggle('hidden', view !== 'profile-essentials');
}

function applyUserFeaturePreferences(preferences) {
  activeFeaturePrefs = {
    ...DEFAULT_FEATURE_PREFS,
    ...(preferences || {})
  };
  const featureMap = [
    { key: 'showProjects', attr: 'projects' },
    { key: 'showWorkout', attr: 'workout' },
    { key: 'showNutrition', attr: 'nutrition' }
  ];
  featureMap.forEach(item => {
    const show = !!activeFeaturePrefs[item.key];
    document.querySelectorAll(`[data-feature="${item.attr}"]`).forEach(el => {
      el.classList.toggle('feature-hidden', !show);
    });
  });

  const activePage = document.querySelector('.page-section.active');
  if (activePage && activePage.classList.contains('feature-hidden')) {
    showPage('dashboard');
  }

  sanitizeDashboardQuickActions();
  persistDashboardQuickActions();
  renderDashboardQuickActionButtons();
  renderDashboardQuickActionPicker();
  updateDashboardTimerUI();
}


function getCurrentLayoutPreferencesForActiveUser() {
  const record = getUserPrefsRecord();
  return {
    ...DEFAULT_FEATURE_PREFS,
    ...(record?.preferences || activeFeaturePrefs || {})
  };
}

function openLayoutCustomizeModal() {
  const modal = document.getElementById('layout-customize-modal');
  const prefProjects = document.getElementById('layout-pref-projects');
  const prefWorkout = document.getElementById('layout-pref-workout');
  const prefNutrition = document.getElementById('layout-pref-nutrition');
  if (!modal) return;

  const current = getCurrentLayoutPreferencesForActiveUser();
  if (prefProjects) prefProjects.checked = !!current.showProjects;
  if (prefWorkout) prefWorkout.checked = !!current.showWorkout;
  if (prefNutrition) prefNutrition.checked = !!current.showNutrition;

  modal.style.display = 'flex';
}

function closeLayoutCustomizeModal() {
  const modal = document.getElementById('layout-customize-modal');
  if (modal) modal.style.display = 'none';
}

function setupLayoutCustomizer() {
  const modal = document.getElementById('layout-customize-modal');
  const form = document.getElementById('layout-customize-form');
  const closeBtn = document.getElementById('layout-customize-close');
  const cancelBtn = document.getElementById('layout-customize-cancel');
  if (!modal || !form) return;

  if (closeBtn) closeBtn.addEventListener('click', closeLayoutCustomizeModal);
  if (cancelBtn) cancelBtn.addEventListener('click', closeLayoutCustomizeModal);

  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeLayoutCustomizeModal();
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const preferences = {
      showProjects: !!document.getElementById('layout-pref-projects')?.checked,
      showWorkout: !!document.getElementById('layout-pref-workout')?.checked,
      showNutrition: !!document.getElementById('layout-pref-nutrition')?.checked
    };

    const existing = getUserPrefsRecord() || {};
    saveUserPrefsRecord({
      ...existing,
      isFirstLogin: false,
      preferences
    });

    applyUserFeaturePreferences(preferences);
    await refreshDashboardMetrics();
    updateStatisticsForActiveUser();
    renderStatistics();
    closeLayoutCustomizeModal();
  });
}

function setupOnboarding() {
  const form = document.getElementById('demo-onboarding-form');
  if (!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const preferences = {
      showProjects: !!document.getElementById('pref-projects')?.checked,
      showWorkout: !!document.getElementById('pref-workout')?.checked,
      showNutrition: !!document.getElementById('pref-nutrition')?.checked
    };
    saveUserPrefsRecord({
      isFirstLogin: false,
      preferences
    });

    // Apply user context from AuthModule
    const user = AuthModule.currentUser;
    if (user && typeof window._authShowApp === 'function') {
      window._authShowApp(user);
    }
    applyUserFeaturePreferences(preferences);
    setSessionView('app');
    showPage('dashboard');
    await loadActiveUserDataViews();
  });
}

function applyAuthUserContext(user) {
  if (!user) return;
  const inferredWeightGoal = user.goal === 'Weight Loss'
    ? 'loss'
    : user.goal === 'Muscle Gain'
      ? 'gain'
      : 'maintain';
  profileState = {
    ...profileState,
    fullName: user.displayName || profileState.fullName,
    email: user.email || profileState.email,
    level: user.level || profileState.level,
    goal: user.goal || profileState.goal,
    weightGoal: inferredWeightGoal,
    // Apply profile essentials from onboarding
    age: user.age || profileState.age,
    height: user.height || profileState.height,
    currentWeight: user.currentWeight || profileState.currentWeight,
  };
  dashboardState.weeklyWorkoutTarget = user.weeklyWorkoutTarget || dashboardState.weeklyWorkoutTarget;
  dashboardState.calorieGoal = user.calorieGoal || dashboardState.calorieGoal;
  const goalLine = document.getElementById('dash-goal-line');
  if (goalLine && user.goal) goalLine.textContent = user.goal;
  syncNutritionGoalWithProfile();
  renderProfileUI();
}


async function loadActiveUserDataViews() {
  loadTaskEnhancements();
  loadSavedMeals();
  loadWorkoutStorage();
  loadProjectsState();
  renderProjectsPage();
  await loadTasks();
  await loadMeals();
  await loadWorkoutsForPage();
  updateStatisticsForActiveUser();
  renderStatistics();
  refreshStreaksAfterChange();
  if (typeof syncAllToAppState === 'function') syncAllToAppState();
}

async function bootstrapSession() {
  setupOnboarding();

  const user = await AuthModule.checkSession();
  
  // Use the new routing state machine from 00-auth.js
  if (typeof window._authRouteToCorrectScreen === 'function') {
    window._authRouteToCorrectScreen(user, false);
    
    // If user is fully onboarded, continue with app setup
    if (user && user.onboarding?.profileEssentialsCompletedAt) {
      const record = getUserPrefsRecord();
      applyAuthUserContext(user);
      applyUserFeaturePreferences(record?.preferences || DEFAULT_FEATURE_PREFS);
      return true;
    }
    return false;
  }

  // Fallback to old behavior if routing function not available
  if (!user) {
    setSessionView('intro');
    return false;
  }

  // Valid session — check if onboarding needed
  const record = getUserPrefsRecord();
  if (!record || record.isFirstLogin !== false) {
    const onboarding = document.getElementById('demo-onboarding');
    const subtitle = document.getElementById('demo-onboarding-subtitle');
    if (subtitle) subtitle.textContent = `Welcome ${user.displayName}! Choose what you want to enable.`;
    if (onboarding) onboarding.classList.remove('hidden');
    const authScreen = document.getElementById('auth-screen');
    if (authScreen) authScreen.classList.add('hidden');
    const app = document.getElementById('app-wrapper');
    if (app) app.style.display = 'none';
    return false;
  }

  applyAuthUserContext(user);
  applyUserFeaturePreferences(record.preferences || DEFAULT_FEATURE_PREFS);
  setSessionView('app');
  return true;
}



// ========================================================================
// Â§3  PRIORITY COLORS
// ========================================================================
// Pure helpers that map task priority ('low'|'medium'|'high') to hex colors.
// Used by task cards, calendar cards, and project task items.

function getPriorityColor(priority, isCompleted) {
  if (isCompleted) return '#3b82f6'; // Blue for completed
  const colors = {
    low: '#22c55e',      // Green
    medium: '#eab308',   // Yellow
    high: '#ef4444'      // Red
  };
  return colors[priority] || colors.medium;
}

function getPriorityTextColor(priority, isCompleted) {
  if (isCompleted) return '#ffffff'; // White text for blue background
  const colors = {
    low: '#ffffff',
    medium: '#000000',
    high: '#ffffff'
  };
  return colors[priority] || colors.medium;
}

function getPriorityBorderColor(priority, isCompleted) {
  if (isCompleted) return '#1e40af'; // Darker blue for border
  const colors = {
    low: '#16a34a',      // Dark green
    medium: '#ca8a04',   // Dark yellow
    high: '#dc2626'      // Dark red
  };
  return colors[priority] || colors.medium;
}

// ========================================================================
// Â§4  TASK RENDERING & VIEWS
// ========================================================================
// Renders task cards in three layouts: list, Eisenhower matrix, tag groups.
// Manages client-side enhancements (subtasks, quadrant) via localStorage.
// Handles repeating-task occurrence tracking and task filtering.
// âš ï¸ Global mutable: taskUiState (main task state), taskEnhancements
// âš ï¸ escapeHtml() is defined here AND again in Notes module (L~10669).
//    Both implementations produce the same result.

const TASK_ENHANCEMENTS_KEY_BASE = 'fittrack_task_enhancements_v1';
function taskEnhancementsStorageKey() {
  return _userKeyPrefix(TASK_ENHANCEMENTS_KEY_BASE);
}
const TASK_LAYOUT_KEY_BASE = 'fittrack_tasks_layout_v1';
const EISENHOWER_QUADRANTS = [
  { key: 'urgent_important', title: 'Urgent & Important' },
  { key: 'important_not_urgent', title: 'Important but Not Urgent' },
  { key: 'urgent_not_important', title: 'Urgent but Not Important' },
  { key: 'not_urgent_not_important', title: 'Not Urgent & Not Important' }
];

function taskLayoutStorageKey() {
  return _userKeyPrefix(TASK_LAYOUT_KEY_BASE);
}

function loadTaskLayoutPreference() {
  try {
    const stored = String(localStorage.getItem(taskLayoutStorageKey()) || '').toLowerCase();
    return stored === 'matrix' || stored === 'tag' ? stored : 'list';
  } catch (_err) {
    return 'list';
  }
}

function saveTaskLayoutPreference(layout) {
  try {
    localStorage.setItem(taskLayoutStorageKey(), layout === 'matrix' || layout === 'tag' ? layout : 'list');
  } catch (_err) {
    // no-op
  }
}

const taskUiState = {
  showTodayOnly: false,
  showCompleted: true,
  layout: 'list',
  expanded: new Set(),
  editingTaskId: null,
  isEditModalOpen: false,
  tasks: [],
  draggingTaskId: null
};
let taskEnhancements = {};

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function loadTaskEnhancements() {
  try {
    const raw = localStorage.getItem(taskEnhancementsStorageKey());
    taskEnhancements = raw ? JSON.parse(raw) : {};
  } catch (_err) {
    taskEnhancements = {};
  }
}

function saveTaskEnhancements() {
  localStorage.setItem(taskEnhancementsStorageKey(), JSON.stringify(taskEnhancements));
}

function getTaskEnhancement(taskId) {
  const key = String(taskId);
  if (!taskEnhancements[key]) {
    taskEnhancements[key] = { subtasks: [], repeat: 'none', completedDates: {}, completedAtDates: {}, eisenhowerQuadrant: '', tags: [] };
  } else {
    taskEnhancements[key].subtasks = Array.isArray(taskEnhancements[key].subtasks) ? taskEnhancements[key].subtasks : [];
    taskEnhancements[key].completedDates = taskEnhancements[key].completedDates || {};
    taskEnhancements[key].completedAtDates = taskEnhancements[key].completedAtDates || {};
    taskEnhancements[key].repeat = taskEnhancements[key].repeat || 'none';
    taskEnhancements[key].eisenhowerQuadrant = String(taskEnhancements[key].eisenhowerQuadrant || '').toLowerCase();
    taskEnhancements[key].tags = normalizeTaskTags(taskEnhancements[key].tags);
  }
  return taskEnhancements[key];
}

function isValidEisenhowerQuadrant(value) {
  return EISENHOWER_QUADRANTS.some((q) => q.key === value);
}

function getTaskQuadrant(task) {
  const fromTask = String(task?.eisenhowerQuadrant || '').toLowerCase();
  if (isValidEisenhowerQuadrant(fromTask)) return fromTask;
  const ext = getTaskEnhancement(task?.id);
  const fromExt = String(ext.eisenhowerQuadrant || '').toLowerCase();
  return isValidEisenhowerQuadrant(fromExt) ? fromExt : '';
}

function normalizeTaskTags(tags) {
  if (!Array.isArray(tags)) return [];
  const seen = new Set();
  const cleaned = [];
  tags.forEach((tag) => {
    const next = String(tag || '').trim().toLowerCase();
    if (!next || seen.has(next)) return;
    seen.add(next);
    cleaned.push(next);
  });
  return cleaned;
}

function parseTaskTagsInput(raw) {
  return normalizeTaskTags(
    String(raw || '')
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean)
  );
}

function formatTagLabel(tag) {
  const val = String(tag || '').trim();
  if (!val) return '';
  return val.charAt(0).toUpperCase() + val.slice(1);
}

function getTaskTags(task) {
  const taskTags = normalizeTaskTags(task?.tags);
  if (taskTags.length) return taskTags;
  const ext = getTaskEnhancement(task?.id);
  return normalizeTaskTags(ext.tags);
}

function taskDueAt(task) {
  return new Date(`${task.date}T23:59:59`);
}

function isTodayDate(dateObj) {
  const today = new Date();
  return dateObj.getDate() === today.getDate()
    && dateObj.getMonth() === today.getMonth()
    && dateObj.getFullYear() === today.getFullYear();
}

function formatTaskDue(task) {
  const dueKey = task.date || toLocalDateKey(new Date());
  const todayKey = toLocalDateKey(new Date());
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowKey = toLocalDateKey(tomorrow);

  if (dueKey === todayKey) return 'Today';
  if (dueKey === tomorrowKey) return 'Tomorrow';
  const d = dateFromKey(dueKey);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function taskTimeRemaining(task) {
  if (task.completed) return '';
  const dueKey = task.date || toLocalDateKey(new Date());
  const todayKey = toLocalDateKey(new Date());
  if (dueKey < todayKey) return 'Overdue';
  if (dueKey === todayKey) return 'Due today';
  const diffMs = dateFromKey(dueKey).getTime() - dateFromKey(todayKey).getTime();
  const days = Math.round(diffMs / (1000 * 60 * 60 * 24));
  if (days === 1) return 'Due tomorrow';
  return `${days} days left`;
}

function priorityClass(priority) {
  if (priority === 'high') return 'is-high';
  if (priority === 'low') return 'is-low';
  return 'is-medium';
}

function getTaskRepeat(task) {
  const ext = getTaskEnhancement(task.id);
  const stored = String(ext.repeat || '').toLowerCase();
  if (/^interval:\d+$/.test(stored)) return stored;
  if (stored === 'daily' || stored === 'weekly' || stored === 'monthly') return stored;
  const cat = String(task.category || '').toLowerCase();
  if (cat === 'daily' || cat === 'weekly' || cat === 'monthly') return cat;
  return 'none';
}

function getTaskRepeatConfig(task) {
  const repeat = getTaskRepeat(task);
  if (repeat.startsWith('interval:')) {
    const days = Math.max(1, Number(repeat.split(':')[1] || 1));
    return { mode: 'interval', intervalDays: days };
  }
  return { mode: repeat, intervalDays: 2 };
}

function combineDateAndTime(dateKey, sourceDate) {
  const source = sourceDate || new Date();
  const hh = String(source.getHours()).padStart(2, '0');
  const mm = String(source.getMinutes()).padStart(2, '0');
  return new Date(`${dateKey}T${hh}:${mm}:00`);
}

function taskBaseDateKey(task) {
  if (task.date) return String(task.date);
  return toLocalDateKey(new Date());
}

function taskOccursOnDate(task, dateKey) {
  const repeat = getTaskRepeat(task);
  const base = taskBaseDateKey(task);
  if (repeat === 'none') return base === dateKey;
  if (dateKey < base) return false;
  if (repeat === 'daily') return true;
  const target = dateFromKey(dateKey);
  const anchor = dateFromKey(base);
  if (repeat === 'weekly') return target.getDay() === anchor.getDay();
  if (repeat === 'monthly') return target.getDate() === anchor.getDate();
  if (repeat.startsWith('interval:')) {
    const intervalDays = Math.max(1, Number(repeat.split(':')[1] || 1));
    const diffMs = target.getTime() - anchor.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays % intervalDays === 0;
  }
  return false;
}

function isTaskOccurrenceDone(task, dateKey) {
  const repeat = getTaskRepeat(task);
  if (repeat === 'none') return !!task.completed || !!task.completedAt;
  const ext = getTaskEnhancement(task.id);
  return !!(ext.completedDates && ext.completedDates[dateKey]);
}

function taskOccurrenceCompletedAt(task, dateKey) {
  const repeat = getTaskRepeat(task);
  if (repeat === 'none') return task.completedAt || null;
  const ext = getTaskEnhancement(task.id);
  return (ext.completedAtDates && ext.completedAtDates[dateKey]) || null;
}

function deriveTaskState(task) {
  if (task.completed || task.completedAt) return 'completed';
  const dueKey = task.date || toLocalDateKey(new Date());
  const todayKey = toLocalDateKey(new Date());
  if (dueKey < todayKey) return 'overdue';
  return 'active';
}

function nextOccurrenceDate(task, fromDateKey) {
  const repeat = getTaskRepeat(task);
  const base = taskBaseDateKey(task);
  if (repeat === 'none') return base;
  if (repeat === 'daily') return fromDateKey < base ? base : fromDateKey;

  let cursor = dateFromKey(fromDateKey < base ? base : fromDateKey);
  for (let i = 0; i < 40; i += 1) {
    const key = toLocalDateKey(cursor);
    if (taskOccursOnDate(task, key)) return key;
    cursor.setDate(cursor.getDate() + 1);
  }
  return fromDateKey;
}

function materializeTasksForRender(tasks) {
  const todayKey = toLocalDateKey(new Date());
  return tasks.map(task => {
    const occDate = nextOccurrenceDate(task, todayKey);
    const done = isTaskOccurrenceDone(task, occDate);
    const completedAt = taskOccurrenceCompletedAt(task, occDate);
    const state = deriveTaskState({
      ...task,
      completed: done,
      completedAt,
      date: occDate
    });
    return {
      ...task,
      completed: done,
      completedAt,
      date: occDate,
      __occurrenceDate: occDate,
      __state: state
    };
  });
}

function dateTimeLocalValue(dateInput) {
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${day}T${hh}:${mm}`;
}

function taskCardHtml(task, options = {}) {
  const usePriorityClass = options.usePriorityClass !== false;
  const isDraggable = !!options.draggable && !task.completed;
  const extraClass = String(options.extraClass || '');
  const expanded = taskUiState.expanded.has(task.id);
  const occDate = task.__occurrenceDate || '';
  const subtasks = Array.isArray(task.subtasks) ? task.subtasks : [];
  const tags = getTaskTags(task);
  const completedSubtasks = subtasks.filter(s => s.completed).length;
  const hasExtra = subtasks.length > 0 || (task.description || '').trim().length > 0;
  const remaining = taskTimeRemaining(task);

  const subtasksHtml = subtasks.map(st => `
    <div class="task-subtask-row">
      ${task.completed
        ? `<span class="task-subtask-check ${st.completed ? 'is-done' : ''}">${st.completed ? '<i class="fas fa-check"></i>' : ''}</span>`
        : `<button class="task-subtask-check ${st.completed ? 'is-done' : ''}" data-action="toggle-subtask" data-task-id="${task.id}" data-occ-date="${occDate}" data-subtask-id="${st.id}">
            ${st.completed ? '<i class="fas fa-check"></i>' : ''}
          </button>`}
      <span class="${st.completed ? 'is-done' : ''}">${escapeHtml(st.title)}</span>
      ${task.completed ? '' : `
        <button class="task-mini-delete" data-action="delete-subtask" data-task-id="${task.id}" data-occ-date="${occDate}" data-subtask-id="${st.id}">
          <i class="fas fa-trash-alt"></i>
        </button>
      `}
    </div>
  `).join('');

  return `
    <article
      class="task-card-v2 ${usePriorityClass ? priorityClass(task.priority) : ''} ${task.completed ? 'is-completed' : ''} ${task.__state === 'overdue' ? 'is-overdue' : ''} ${extraClass}"
      data-occ-date="${occDate}"
      data-task-card-id="${task.id}"
      ${isDraggable ? `draggable="true" data-task-drag-id="${task.id}"` : ''}
    >
      <div class="task-row-main">
        <div class="task-main-left">
          <button class="task-main-check ${task.completed ? 'is-done' : ''}" data-action="toggle-task" data-task-id="${task.id}" data-occ-date="${task.__occurrenceDate || ''}">
            ${task.completed ? '<i class="fas fa-check"></i>' : ''}
          </button>
          <div>
            <h4 class="${task.completed ? 'is-done' : ''}">${escapeHtml(task.title)}</h4>
            ${tags.length ? `<div class="task-tag-pills">${tags.map(tag => `<span class="task-tag-pill">#${escapeHtml(formatTagLabel(tag))}</span>`).join('')}</div>` : ''}
            <div class="task-main-meta">
              <span><i class="fas fa-calendar-alt"></i> ${formatTaskDue(task)}</span>
              ${remaining ? `<span class="${remaining === 'Overdue' ? 'is-overdue' : 'is-remaining'}"><i class="fas fa-clock"></i> ${remaining}</span>` : ''}
              ${subtasks.length ? `<span>${completedSubtasks}/${subtasks.length} subtasks</span>` : ''}
            </div>
          </div>
        </div>
        <div class="task-main-actions">
          <button class="task-note-btn ${(task.description || '').trim() ? 'has-note' : ''}" data-action="toggle-expand" data-task-id="${task.id}" title="Task details">
            <i class="fas fa-sticky-note"></i>
          </button>
          <button
            class="task-settings-btn"
            data-action="open-task-edit-modal"
            data-task-id="${task.id}"
            title="Edit task"
            ${task.completed ? 'disabled' : ''}
          >
            <i class="fas fa-gear"></i>
          </button>
          <button class="task-expand-btn" data-action="toggle-expand" data-task-id="${task.id}">
            <i class="fas ${expanded ? 'fa-chevron-up' : 'fa-chevron-down'}"></i>
          </button>
          <button class="task-delete-btn-v2" data-action="delete-task" data-task-id="${task.id}" ${task.completed ? 'disabled' : ''}>
            <i class="fas fa-trash-alt"></i>
          </button>
        </div>
      </div>
      ${expanded || hasExtra ? `
        <div class="task-extra-panel ${expanded ? '' : 'is-collapsed'}">
          <div class="task-subtasks-wrap">
            <p>Subtasks</p>
            <div class="task-subtasks-list">${subtasksHtml || '<div class="task-subtasks-empty">No subtasks yet</div>'}</div>
            ${task.completed ? '' : `
              <div class="task-subtask-add">
                <input id="subtask-input-${task.id}" type="text" placeholder="Add a subtask...">
                <button data-action="add-subtask" data-task-id="${task.id}" data-occ-date="${occDate}"><i class="fas fa-plus"></i></button>
              </div>
            `}
          </div>
          <div class="task-note-wrap">
            <p>Notes</p>
            ${task.completed
              ? `<div class="task-note-readonly">${escapeHtml(task.description || 'No notes added.')}</div>`
              : `<textarea id="task-note-${task.id}" placeholder="Write a note...">${escapeHtml(task.description || '')}</textarea>
                 <div class="task-note-actions">
                   <button class="task-note-save" data-action="save-note" data-task-id="${task.id}" data-occ-date="${occDate}">Save Note</button>
                 </div>`}
          </div>
        </div>
      ` : ''}
    </article>
  `;
}

function isTaskCompletedForOccurrence(taskId, occDate) {
  const task = taskUiState.tasks.find(t => t.id === taskId);
  if (!task) return false;
  const repeat = getTaskRepeat(task);
  if (repeat === 'none') return !!task.completed || !!task.completedAt;
  const key = occDate || toLocalDateKey(new Date());
  return isTaskOccurrenceDone(task, key);
}

function renderTaskViewToggleState() {
  const listBtn = document.getElementById('tasks-view-list-btn');
  const matrixBtn = document.getElementById('tasks-view-matrix-btn');
  const tagBtn = document.getElementById('tasks-view-tag-btn');
  if (!listBtn || !matrixBtn || !tagBtn) return;
  const isList = taskUiState.layout === 'list';
  const isMatrix = taskUiState.layout === 'matrix';
  const isTag = taskUiState.layout === 'tag';
  listBtn.classList.toggle('is-active', isList);
  matrixBtn.classList.toggle('is-active', isMatrix);
  tagBtn.classList.toggle('is-active', isTag);
  listBtn.setAttribute('aria-selected', isList ? 'true' : 'false');
  matrixBtn.setAttribute('aria-selected', isMatrix ? 'true' : 'false');
  tagBtn.setAttribute('aria-selected', isTag ? 'true' : 'false');
}

function renderTasksLayoutVisibility() {
  const listLayout = document.getElementById('tasks-list-layout');
  const matrixSection = document.getElementById('tasks-matrix-section');
  const tagSection = document.getElementById('tasks-tag-section');
  const isList = taskUiState.layout === 'list';
  const isMatrix = taskUiState.layout === 'matrix';
  const isTag = taskUiState.layout === 'tag';
  if (listLayout) listLayout.style.display = isList ? '' : 'none';
  if (matrixSection) matrixSection.style.display = isMatrix ? 'block' : 'none';
  if (tagSection) tagSection.style.display = isTag ? 'block' : 'none';
  renderTaskViewToggleState();
}

function renderTasksListView({ sortedActive, sortedOverdue, sortedCompleted }) {
  const activeContainer = document.getElementById('active-tasks-container');
  const overdueContainer = document.getElementById('overdue-tasks-container');
  const completedContainer = document.getElementById('completed-tasks-container');
  const completedSection = document.getElementById('completed-tasks-section');
  const completedChevron = document.getElementById('completed-chevron');
  if (!activeContainer || !overdueContainer || !completedContainer) return;

  activeContainer.innerHTML = sortedActive.length
    ? sortedActive.map(taskCardHtml).join('')
    : `<div class="tasks-empty-state">${taskUiState.showTodayOnly ? 'No tasks for today. All caught up.' : 'No active tasks yet. Add a task to get started.'}</div>`;

  overdueContainer.innerHTML = sortedOverdue.length
    ? sortedOverdue.map(taskCardHtml).join('')
    : `<div class="tasks-empty-state">${taskUiState.showTodayOnly ? 'No overdue tasks for today.' : 'No overdue tasks. Great job staying on track.'}</div>`;

  completedContainer.innerHTML = sortedCompleted.length
    ? sortedCompleted.map(taskCardHtml).join('')
    : `<div class="tasks-empty-state">No completed tasks yet.</div>`;

  if (completedSection) {
    completedSection.classList.toggle('is-collapsed', !taskUiState.showCompleted);
  }
  if (completedChevron) {
    completedChevron.className = `fas ${taskUiState.showCompleted ? 'fa-chevron-up' : 'fa-chevron-down'}`;
  }
}

function renderTasksMatrixView({ sortedActive, sortedOverdue }) {
  const matrixSection = document.getElementById('tasks-matrix-section');
  if (!matrixSection) return;

  const openTasks = [...sortedOverdue, ...sortedActive].sort((a, b) => taskDueAt(a).getTime() - taskDueAt(b).getTime());
  const groups = {};
  EISENHOWER_QUADRANTS.forEach((q) => {
    groups[q.key] = [];
  });
  let unassigned = [];
  let hasAnyAssignedQuadrant = false;

  openTasks.forEach((task) => {
    const quadrant = getTaskQuadrant(task);
    if (quadrant && groups[quadrant]) {
      groups[quadrant].push(task);
      hasAnyAssignedQuadrant = true;
    } else {
      unassigned.push(task);
    }
  });

  // Failsafe: if nothing is assigned yet, show open tasks in a default quadrant.
  if (!hasAnyAssignedQuadrant && openTasks.length) {
    groups.urgent_important = [...openTasks];
    unassigned = [];
  }

  const unassignedHtml = unassigned.length
    ? `
      <section class="tasks-matrix-unassigned">
        <header>
          <h4>Unassigned Tasks</h4>
          <span>${unassigned.length}</span>
        </header>
        <div class="tasks-matrix-unassigned-list">
          ${unassigned.map((task) => taskCardHtml(task, { usePriorityClass: false, draggable: true, extraClass: 'task-matrix-card' })).join('')}
        </div>
      </section>
    `
    : '';

  const quadrantsHtml = EISENHOWER_QUADRANTS.map((q) => {
    const cards = groups[q.key];
    return `
      <section class="tasks-matrix-quadrant tasks-matrix-quadrant--${q.key}" data-eisenhower-dropzone="${q.key}">
        <header class="tasks-matrix-quadrant-head">
          <h4>${q.title}</h4>
          <span>${cards.length}</span>
        </header>
        <div class="tasks-matrix-dropzone">
          ${cards.length
            ? cards.map((task) => taskCardHtml(task, { usePriorityClass: false, draggable: true, extraClass: 'task-matrix-card' })).join('')
            : '<div class="tasks-empty-state">Drop tasks here</div>'}
        </div>
      </section>
    `;
  }).join('');

  matrixSection.innerHTML = `
    <div class="tasks-matrix-board">
      <div class="tasks-matrix-axis tasks-matrix-axis-urgent">Urgent &uarr;</div>
      <div class="tasks-matrix-axis tasks-matrix-axis-important">Important &rarr;</div>
      ${unassignedHtml}
      <div class="tasks-matrix-grid">
        ${quadrantsHtml}
      </div>
    </div>
  `;
}

function renderTasksTagView({ sortedActive, sortedOverdue }) {
  const tagSection = document.getElementById('tasks-tag-section');
  if (!tagSection) return;

  const tagViewTasks = [...sortedOverdue, ...sortedActive]
    .filter(task => task.__state !== 'completed')
    .filter(task => {
      const tags = getTaskTags(task);
      return Array.isArray(tags) && tags.length > 0;
    });

  const tagSet = new Set();
  tagViewTasks.forEach((task) => {
    getTaskTags(task).forEach((tag) => tagSet.add(tag));
  });
  const tags = [...tagSet].sort((a, b) => a.localeCompare(b));

  if (!tags.length) {
    tagSection.innerHTML = '<div class="tasks-empty-state">No tagged active tasks available.</div>';
    return;
  }

  tagSection.innerHTML = `
    <div class="tasks-tag-columns" aria-label="Task tags">
      ${tags.map((tag) => {
        const taggedTasks = tagViewTasks.filter(task => getTaskTags(task).includes(tag));
        return `
          <section class="tasks-tag-column">
            <header class="tasks-tag-column-head">#${escapeHtml(formatTagLabel(tag))} <span>${taggedTasks.length}</span></header>
            <div class="tasks-list">
              ${taggedTasks.length
                ? taggedTasks.map((task) => taskCardHtml(task)).join('')
                : '<div class="tasks-empty-state">No tasks for this tag.</div>'}
            </div>
          </section>
        `;
      }).join('')}
    </div>
  `;
}

function renderTasks(tasks) {
  const activeContainer = document.getElementById('active-tasks-container');
  const overdueContainer = document.getElementById('overdue-tasks-container');
  const completedContainer = document.getElementById('completed-tasks-container');
  const activeCount = document.getElementById('active-count');
  const overdueCount = document.getElementById('overdue-count');
  const completedCount = document.getElementById('completed-count');
  const progressRemaining = document.getElementById('tasks-progress-remaining');
  const progressCompleted = document.getElementById('tasks-progress-completed');
  const progressLabel = document.getElementById('tasks-progress-label');
  if (!activeContainer || !overdueContainer || !completedContainer) return;

  const renderable = materializeTasksForRender(tasks);
  const active = renderable.filter(t => t.__state === 'active');
  const overdue = renderable.filter(t => t.__state === 'overdue');
  const completed = renderable.filter(t => t.__state === 'completed');
  const filteredActive = taskUiState.showTodayOnly ? active.filter(t => isTodayDate(taskDueAt(t))) : active;
  const filteredOverdue = taskUiState.showTodayOnly ? overdue.filter(t => isTodayDate(taskDueAt(t))) : overdue;
  const sortedActive = [...filteredActive].sort((a, b) => taskDueAt(a).getTime() - taskDueAt(b).getTime());
  const sortedOverdue = [...filteredOverdue].sort((a, b) => taskDueAt(a).getTime() - taskDueAt(b).getTime());
  const sortedCompleted = [...completed].sort((a, b) => taskDueAt(b).getTime() - taskDueAt(a).getTime());

  if (activeCount) activeCount.textContent = String(sortedActive.length);
  if (overdueCount) overdueCount.textContent = String(sortedOverdue.length);
  if (completedCount) completedCount.textContent = String(completed.length);
  if (progressRemaining) progressRemaining.textContent = String(sortedActive.length + sortedOverdue.length);
  if (progressCompleted) progressCompleted.textContent = String(completed.length);
  if (progressLabel) progressLabel.textContent = taskUiState.showTodayOnly ? "Today's Open Tasks" : 'Open Tasks';
  renderTasksLayoutVisibility();
  if (taskUiState.layout === 'matrix') {
    renderTasksMatrixView({ sortedActive, sortedOverdue });
    return;
  }
  if (taskUiState.layout === 'tag') {
    renderTasksTagView({ sortedActive, sortedOverdue });
    return;
  }
  renderTasksListView({ sortedActive, sortedOverdue, sortedCompleted });
}

// ========================================================================
// Â§5  TASKS API & INTERACTIONS
// ========================================================================
// CRUD fetch() calls to /api/tasks. Edit modal, toggle, delete.
// Drag-and-drop reordering. Subtask management (localStorage).
// Task creation form with date/time, priority, repeat options.
// âš ï¸ After task mutations, calls renderCalendar() and evaluateStreaks().

async function loadTasks() {
  try {
    taskUiState.layout = loadTaskLayoutPreference();
    renderTaskViewToggleState();
    const response = await fetch('/api/tasks', { credentials: 'same-origin' });
    if (!response.ok) throw new Error('Failed to load tasks');
    const tasks = await response.json();
    taskUiState.tasks = (Array.isArray(tasks) ? tasks : []).map(t => {
      const ext = getTaskEnhancement(t.id);
      return {
        ...t,
        description: t.description || '',
        subtasks: Array.isArray(ext.subtasks) ? ext.subtasks : [],
        tags: normalizeTaskTags(Array.isArray(t.tags) ? t.tags : ext.tags),
        completedAt: t.completedAt || null,
        eisenhowerQuadrant: isValidEisenhowerQuadrant(String(t.eisenhowerQuadrant || '').toLowerCase())
          ? String(t.eisenhowerQuadrant || '').toLowerCase()
          : (isValidEisenhowerQuadrant(String(ext.eisenhowerQuadrant || '').toLowerCase()) ? String(ext.eisenhowerQuadrant || '').toLowerCase() : '')
      };
    });
    renderTasks(taskUiState.tasks);
    if (typeof renderCalendar === 'function') renderCalendar();
    if (typeof renderProfileDynamicStats === 'function') renderProfileDynamicStats();
    refreshDashboardMetrics();
    updateStatisticsForActiveUser();
    renderStatistics();
    if (typeof syncToAppState === 'function') syncToAppState('tasks');
  } catch (err) {
    console.error('Error loading tasks:', err);
    taskUiState.tasks = [];
    renderTasks(taskUiState.tasks);
  }
}
async function addTask(title, priority, dueDate, repeat, tags = [], noteContent = '', saveToNotes = false) {
  try {
    // dueDate is a YYYY-MM-DD string (day-level only)
    const taskDate = dueDate || toLocalDateKey(new Date());

    const response = await fetch('/api/tasks', { credentials: 'same-origin', method: 'POST',
      headers: { 'Content-Type': 'application/json'},
      body: JSON.stringify({
        title: title,
        priority: priority || 'medium',
        tags: normalizeTaskTags(tags),
        date: taskDate,
        category: repeat || 'general',
        completed: false,
        note_content: noteContent || '',
        save_to_notes: saveToNotes || false
      })
    });

    if (response.ok) {
      const createdTask = await response.json();
      const ext = getTaskEnhancement(createdTask.id);
      ext.subtasks = ext.subtasks || [];
      ext.repeat = repeat || 'none';
      ext.completedDates = ext.completedDates || {};
      ext.completedAtDates = ext.completedAtDates || {};
      ext.tags = normalizeTaskTags(tags);
      saveTaskEnhancements();
      await loadTasks();
      const modal = document.getElementById('add-task-modal');
      if (modal) modal.style.display = 'none';
    } else {
      alert('Failed to create task');
    }
  } catch (err) {
    console.error('Error adding task:', err);
    alert('Error adding task: ' + err.message);
  }
}
/**
 * ========================================
 * CENTRALIZED PROGRESS UPDATE SYSTEM
 * ========================================
 * Handles task completion with proper:
 * - Point recalculation
 * - Streak eligibility check
 * - User stats persistence
 * - Dashboard refresh
 */

async function updateUserProgressAfterTaskCompletion(taskId, occDate) {
  console.log(`[Progress Engine] Starting update for taskId=${taskId}, occDate=${occDate}`);
  
  try {
    // STEP 1: Update task status
    const { todayKey, wasCompleted, isNowCompleted } = await _updateTaskStatus(taskId, occDate);
    console.log(`[Progress Engine] Task status updated: wasCompleted=${wasCompleted}, isNowCompleted=${isNowCompleted}`);
    
    // STEP 2: Reload tasks from store to get latest data
    await loadTasks();
    const tasks = (taskUiState.tasks || []);
    const meals = (nutritionState.entries || []);
    const workouts = (workoutState.workouts || []);
    
    // STEP 3-5: Branch between demo (local eval) and API (server-side eval)
    let streakResult;

    // API MODE: delegate to server-side authoritative evaluation
    try {
        const resp = await fetch('/api/streaks/evaluate', { credentials: 'same-origin', method: 'POST',
          headers: { 'Content-Type': 'application/json'},
          body: JSON.stringify({ date: todayKey })
        });
        streakResult = await resp.json();
        // Normalize server snake_case keys â†’ camelCase for renderStreaksUI
        if (streakResult && streakResult.day) streakResult.day = _normalizeDayEval(streakResult.day);
        console.log(`[Progress Engine] Server eval result:`, streakResult);
    } catch (apiErr) {
        console.warn('[Progress Engine] Server eval failed, falling back to local:', apiErr);
        const proteinGoal = nutritionState.baseGoals.protein || 140;
        streakEvaluateDay(todayKey, tasks, meals, workouts, proteinGoal);
        streakResult = streakFullEvalDemo();
    }
    
    // STEP 6: Refresh dashboard/UI
    console.log('[Progress Engine] Refreshing UI...');
    renderStreaksUI(streakResult);
    renderTasks(taskUiState.tasks);
    
    console.log('[Progress Engine] âœ“ Complete - all systems updated');
    
  } catch (err) {
    console.error('[Progress Engine] ERROR:', err);
    throw err;
  }
}

/**
 * Update task completion status (handles both single and recurring tasks)
 * Returns: { todayKey, wasCompleted, isNowCompleted }
 */
async function _updateTaskStatus(taskId, occDate) {
  const task = taskUiState.tasks.find(t => t.id === taskId);
  if (!task) throw new Error(`Task ${taskId} not found`);
  
  const repeat = getTaskRepeat(task);
  const todayKey = occDate || toLocalDateKey(new Date());
  let wasCompleted, isNowCompleted;
  
  if (repeat !== 'none') {
    // Recurring task " update specific date
    const currentExt = taskEnhancements[String(taskId)] || {};
    const completedDates = currentExt.completedDates || {};
    wasCompleted = !!completedDates[todayKey];
    isNowCompleted = !wasCompleted;
    
    updateTaskEnhancement(taskId, ext => {
      ext.completedDates = ext.completedDates || {};
      ext.completedAtDates = ext.completedAtDates || {};
      ext.completedDates[todayKey] = isNowCompleted;
      ext.completedAtDates[todayKey] = isNowCompleted ? new Date().toISOString() : null;
    });
  } else {
    // Single task: toggle via API
    const response = await fetch(`/api/tasks/${taskId}/toggle`, { credentials: 'same-origin', method: 'PATCH'});
    if (!response.ok) throw new Error('Failed to toggle task on server');

    const currTask = taskUiState.tasks.find(t => t.id === taskId);
    wasCompleted = !!(currTask.completed || currTask.completedAt);
    isNowCompleted = !wasCompleted;
  }
  
  return { todayKey, wasCompleted, isNowCompleted };
}

function _persistUserStats(userId, stats) {
  // Auth mode: stats are managed server-side via /api/streaks/evaluate
  console.log('[Progress Engine] Stats update (server-managed):', stats);
}

function _getUserStats() {
  // Auth mode: stats come from server evaluation
  return null;
}

// Legacy wrapper for backward compatibility
async function toggleTask(taskId, occDate) {
  try {
    await updateUserProgressAfterTaskCompletion(taskId, occDate);
  } catch (err) {
    console.error('Error toggling task:', err);
  }
}
async function deleteTask(taskId) {
  try {
    const response = await fetch(`/api/tasks/${taskId}`, { credentials: 'same-origin', method: 'DELETE'});

    if (response.ok) {
      delete taskEnhancements[String(taskId)];
      taskUiState.expanded.delete(taskId);
      saveTaskEnhancements();
      await loadTasks();
    }
  } catch (err) {
    console.error('Error deleting task:', err);
    alert('Error deleting task: ' + err.message);
  }
}
async function updateTask(taskId, payload) {

  const response = await fetch(`/api/tasks/${taskId}`, { credentials: 'same-origin', method: 'PUT',
    headers: { 'Content-Type': 'application/json'},
    body: JSON.stringify(payload)
  });
  return response.ok;
}
function updateTaskEnhancement(taskId, updater) {
  const ext = getTaskEnhancement(taskId);
  updater(ext);
  saveTaskEnhancements();
}

function persistTaskQuadrant(taskId, quadrant) {
  if (!isValidEisenhowerQuadrant(quadrant)) return;
  updateTaskEnhancement(taskId, (ext) => {
    ext.eisenhowerQuadrant = quadrant;
  });

  taskUiState.tasks = taskUiState.tasks.map((task) => (
    Number(task.id) === Number(taskId)
      ? { ...task, eisenhowerQuadrant: quadrant }
      : task
  ));

}

function taskEditModalElements() {
  return {
    modal: document.getElementById('task-edit-modal'),
    form: document.getElementById('task-edit-form'),
    titleInput: document.getElementById('task-edit-title-input'),
    tagsInput: document.getElementById('task-edit-tags-input'),
    prioritySelect: document.getElementById('task-edit-priority-select'),
    dueSelect: document.getElementById('task-edit-due-select'),
    dueCustomInput: document.getElementById('task-edit-custom-datetime-input'),
    repeatSelect: document.getElementById('task-edit-repeat-select'),
    repeatIntervalInput: document.getElementById('task-edit-repeat-interval-input'),
    closeBtn: document.getElementById('task-edit-close-btn'),
    cancelBtn: document.getElementById('task-edit-cancel-btn'),
    saveBtn: document.getElementById('task-edit-save-btn')
  };
}

function syncTaskEditModalDueInput() {
  const { dueSelect, dueCustomInput } = taskEditModalElements();
  if (!dueSelect || !dueCustomInput) return;
  dueCustomInput.style.display = dueSelect.value === 'custom' ? 'block' : 'none';
}

function syncTaskEditModalRepeatInput() {
  const { repeatSelect, repeatIntervalInput } = taskEditModalElements();
  if (!repeatSelect || !repeatIntervalInput) return;
  repeatIntervalInput.style.display = repeatSelect.value === 'interval' ? 'block' : 'none';
}

function closeTaskEditModal() {
  const { modal, form, dueSelect, dueCustomInput, repeatSelect, repeatIntervalInput } = taskEditModalElements();
  if (!modal) return;
  modal.classList.remove('is-open');
  modal.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('task-edit-modal-open');
  taskUiState.isEditModalOpen = false;
  taskUiState.editingTaskId = null;
  if (form) form.reset();
  if (dueSelect) dueSelect.value = 'custom';
  if (dueCustomInput) dueCustomInput.style.display = 'block';
  if (repeatSelect) repeatSelect.value = 'none';
  if (repeatIntervalInput) {
    repeatIntervalInput.value = '2';
    repeatIntervalInput.style.display = 'none';
  }
}

function openTaskEditModal(taskId) {
  const task = taskUiState.tasks.find(t => t.id === taskId);
  const {
    modal,
    titleInput,
    tagsInput,
    prioritySelect,
    dueSelect,
    dueCustomInput,
    repeatSelect,
    repeatIntervalInput
  } = taskEditModalElements();

  if (!task || !modal || !titleInput || !prioritySelect || !dueSelect || !dueCustomInput || !repeatSelect || !repeatIntervalInput) {
    return;
  }

  const repeatCfg = getTaskRepeatConfig(task);
  titleInput.value = task.title || '';
  if (tagsInput) tagsInput.value = getTaskTags(task).join(', ');
  prioritySelect.value = ['low', 'medium', 'high'].includes(task.priority) ? task.priority : 'medium';
  dueSelect.value = 'custom';
  dueCustomInput.value = task.date || toLocalDateKey(new Date());
  repeatSelect.value = repeatCfg.mode === 'interval' ? 'interval' : repeatCfg.mode;
  repeatIntervalInput.value = String(Math.max(2, repeatCfg.intervalDays || 2));
  syncTaskEditModalDueInput();
  syncTaskEditModalRepeatInput();

  // Populate description & note fields
  const descInput = document.getElementById('task-edit-description-input');
  const saveNotesChk = document.getElementById('task-edit-save-to-notes');
  const viewNoteLink = document.getElementById('task-edit-view-note-link');
  if (descInput) descInput.value = task.note_content || task.description || '';
  if (saveNotesChk) saveNotesChk.checked = !!task.note_saved_to_notes;
  if (viewNoteLink) viewNoteLink.style.display = task.note_saved_to_notes ? '' : 'none';

  taskUiState.editingTaskId = taskId;
  taskUiState.isEditModalOpen = true;
  modal.classList.add('is-open');
  modal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('task-edit-modal-open');
  titleInput.focus();
}

function handleTaskEditModalKeydown(e) {
  if (!taskUiState.isEditModalOpen) return;
  const { modal } = taskEditModalElements();
  if (!modal) return;

  if (e.key === 'Escape') {
    e.preventDefault();
    closeTaskEditModal();
    return;
  }

  if (e.key !== 'Tab') return;
  const focusable = modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
  const focusableEls = Array.from(focusable).filter(el => !el.hasAttribute('disabled'));
  if (!focusableEls.length) return;

  const first = focusableEls[0];
  const last = focusableEls[focusableEls.length - 1];
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}

async function saveTaskEditModalChanges() {
  const taskId = Number(taskUiState.editingTaskId);
  if (!taskId) return;
  const task = taskUiState.tasks.find(t => t.id === taskId);
  if (!task) return;

  const {
    titleInput,
    tagsInput,
    prioritySelect,
    dueSelect,
    dueCustomInput,
    repeatSelect,
    repeatIntervalInput,
    saveBtn
  } = taskEditModalElements();

  if (!titleInput || !prioritySelect || !dueSelect || !dueCustomInput || !repeatSelect || !repeatIntervalInput) return;

  const title = titleInput.value.trim();
  const tags = parseTaskTagsInput(tagsInput?.value || '');
  const priority = String(prioritySelect.value || 'medium');
  const dueMode = String(dueSelect.value || 'custom');
  const repeatMode = String(repeatSelect.value || 'none');

  if (!title) return;
  if (!['low', 'medium', 'high'].includes(priority)) return;

  let dueKey;
  if (dueMode === 'custom') {
    if (!dueCustomInput.value) return;
    dueKey = dueCustomInput.value;  // YYYY-MM-DD string
  } else if (dueMode === 'today') {
    dueKey = toLocalDateKey(new Date());
  } else if (dueMode === 'tomorrow') {
    const t = new Date(); t.setDate(t.getDate() + 1);
    dueKey = toLocalDateKey(t);
  } else {
    dueKey = toLocalDateKey(new Date());
  }

  let repeatValue = repeatMode;
  if (repeatMode === 'interval') {
    const everyDays = Math.max(2, Number(repeatIntervalInput.value || 2));
    repeatValue = `interval:${everyDays}`;
  }
  const categoryValue = ['daily', 'weekly', 'monthly'].includes(repeatMode) ? repeatMode : 'general';

  const editDescInput = document.getElementById('task-edit-description-input');
  const editSaveNotesChk = document.getElementById('task-edit-save-to-notes');
  const noteContentVal = (editDescInput?.value || '').trim();
  const saveToNotesVal = editSaveNotesChk?.checked || false;

  if (saveBtn) saveBtn.disabled = true;
  const ok = await updateTask(taskId, {
    title,
    tags,
    priority,
    date: dueKey,
    category: categoryValue,
    note_content: noteContentVal,
    save_to_notes: saveToNotesVal
  });
  if (saveBtn) saveBtn.disabled = false;

  if (!ok) {
    alert('Could not save task changes.');
    return;
  }

  updateTaskEnhancement(taskId, ext => {
    ext.repeat = repeatValue;
    ext.tags = tags;
  });

  closeTaskEditModal();
  await loadTasks();
  taskUiState.expanded.add(taskId);
  renderTasks(taskUiState.tasks);
}

function setupTaskEditModal() {
  const {
    modal,
    form,
    dueSelect,
    repeatSelect,
    closeBtn,
    cancelBtn
  } = taskEditModalElements();
  if (!modal || !form) return;

  dueSelect?.addEventListener('change', syncTaskEditModalDueInput);
  repeatSelect?.addEventListener('change', syncTaskEditModalRepeatInput);
  closeBtn?.addEventListener('click', closeTaskEditModal);
  cancelBtn?.addEventListener('click', closeTaskEditModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeTaskEditModal();
  });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    await saveTaskEditModalChanges();
  });
  document.addEventListener('keydown', handleTaskEditModalKeydown);
}

function setupTaskInteractions() {
  loadTaskEnhancements();
  taskUiState.layout = loadTaskLayoutPreference();
  setupTaskEditModal();

  const todayBtn = document.getElementById('task-filter-today-btn');
  const completedBtn = document.getElementById('toggle-completed-btn');
  const viewButtons = Array.from(document.querySelectorAll('[data-task-view]'));
  const tasksPage = document.getElementById('tasks');
  if (!tasksPage) return;
  renderTaskViewToggleState();

  if (todayBtn) {
    todayBtn.addEventListener('click', () => {
      taskUiState.showTodayOnly = !taskUiState.showTodayOnly;
      todayBtn.classList.toggle('is-active', taskUiState.showTodayOnly);
      todayBtn.innerHTML = taskUiState.showTodayOnly
        ? '<i class="fas fa-list"></i> Show All'
        : '<i class="fas fa-filter"></i> Today\'s Tasks';
      renderTasks(taskUiState.tasks);
    });
  }

  if (viewButtons.length) {
    viewButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const nextView = String(btn.getAttribute('data-task-view') || '').toLowerCase();
        taskUiState.layout = nextView === 'matrix' || nextView === 'tag' ? nextView : 'list';
        saveTaskLayoutPreference(taskUiState.layout);
        renderTasks(taskUiState.tasks);
      });
    });
  }

  if (completedBtn) {
    completedBtn.addEventListener('click', () => {
      taskUiState.showCompleted = !taskUiState.showCompleted;
      renderTasks(taskUiState.tasks);
    });
  }

  tasksPage.addEventListener('dragstart', (e) => {
    if (taskUiState.layout !== 'matrix') return;
    const card = e.target?.closest?.('[data-task-drag-id]');
    if (!card) return;
    const taskId = String(card.getAttribute('data-task-drag-id') || '');
    if (!taskId) return;
    taskUiState.draggingTaskId = taskId;
    card.classList.add('is-dragging');
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', taskId);
    }
  });

  tasksPage.addEventListener('dragend', (e) => {
    const card = e.target?.closest?.('[data-task-drag-id]');
    if (card) card.classList.remove('is-dragging');
    taskUiState.draggingTaskId = null;
    tasksPage.querySelectorAll('[data-eisenhower-dropzone].is-drag-over').forEach((zone) => {
      zone.classList.remove('is-drag-over');
    });
  });

  tasksPage.addEventListener('dragover', (e) => {
    if (taskUiState.layout !== 'matrix') return;
    const zone = e.target?.closest?.('[data-eisenhower-dropzone]');
    if (!zone) return;
    e.preventDefault();
    zone.classList.add('is-drag-over');
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
  });

  tasksPage.addEventListener('dragleave', (e) => {
    const zone = e.target?.closest?.('[data-eisenhower-dropzone]');
    if (!zone) return;
    const related = e.relatedTarget;
    if (related && zone.contains(related)) return;
    zone.classList.remove('is-drag-over');
  });

  tasksPage.addEventListener('drop', (e) => {
    if (taskUiState.layout !== 'matrix') return;
    const zone = e.target?.closest?.('[data-eisenhower-dropzone]');
    if (!zone) return;
    e.preventDefault();
    zone.classList.remove('is-drag-over');
    const quadrant = String(zone.getAttribute('data-eisenhower-dropzone') || '').toLowerCase();
    if (!isValidEisenhowerQuadrant(quadrant)) return;
    const draggedTaskId = String((e.dataTransfer && e.dataTransfer.getData('text/plain')) || taskUiState.draggingTaskId || '');
    if (!draggedTaskId) return;
    persistTaskQuadrant(draggedTaskId, quadrant);
    renderTasks(taskUiState.tasks);
  });

  tasksPage.addEventListener('click', async (e) => {
    if (taskUiState.isEditModalOpen) return;
    const target = e.target;
    const button = target.closest('[data-action]');
    if (!button) return;

    const card = button.closest('.task-card-v2');
    const action = button.getAttribute('data-action');

    const taskId = Number(button.getAttribute('data-task-id'));
    const occDate = button.getAttribute('data-occ-date') || card?.getAttribute('data-occ-date') || null;
    if (!taskId) return;

    if (action === 'toggle-task') {
      const isCompleted = isTaskCompletedForOccurrence(taskId, occDate);
      if (!isCompleted && card) {
        card.classList.add('is-completing');
        button.classList.add('is-completing');
        await new Promise(resolve => setTimeout(resolve, 380));
      }
      await toggleTask(taskId, occDate);
      return;
    }

    if (action === 'delete-task') {
      if (isTaskCompletedForOccurrence(taskId, occDate)) {
        alert('Cannot delete completed task. Toggle completion first to edit.');
        return;
      }
      if (confirm('Delete this task?')) await deleteTask(taskId);
      return;
    }

    if (action === 'toggle-expand') {
      if (taskUiState.expanded.has(taskId)) taskUiState.expanded.delete(taskId);
      else taskUiState.expanded.add(taskId);
      renderTasks(taskUiState.tasks);
      return;
    }

    if (action === 'open-task-edit-modal') {
      openTaskEditModal(taskId);
      return;
    }

    if (action === 'add-subtask') {
      if (isTaskCompletedForOccurrence(taskId, occDate)) return;
      const input = document.getElementById(`subtask-input-${taskId}`);
      const title = (input?.value || '').trim();
      if (!title) return;
      updateTaskEnhancement(taskId, ext => {
        ext.subtasks = ext.subtasks || [];
        ext.subtasks.push({ id: Date.now(), title, completed: false });
      });
      if (input) input.value = '';
      await loadTasks();
      taskUiState.expanded.add(taskId);
      renderTasks(taskUiState.tasks);
      return;
    }

    if (action === 'toggle-subtask') {
      if (isTaskCompletedForOccurrence(taskId, occDate)) return;
      const subtaskId = Number(button.getAttribute('data-subtask-id'));
      updateTaskEnhancement(taskId, ext => {
        ext.subtasks = (ext.subtasks || []).map(st => st.id === subtaskId ? { ...st, completed: !st.completed } : st);
      });
      await loadTasks();
      taskUiState.expanded.add(taskId);
      renderTasks(taskUiState.tasks);
      return;
    }

    if (action === 'delete-subtask') {
      if (isTaskCompletedForOccurrence(taskId, occDate)) return;
      const subtaskId = Number(button.getAttribute('data-subtask-id'));
      updateTaskEnhancement(taskId, ext => {
        ext.subtasks = (ext.subtasks || []).filter(st => st.id !== subtaskId);
      });
      await loadTasks();
      taskUiState.expanded.add(taskId);
      renderTasks(taskUiState.tasks);
      return;
    }

    if (action === 'save-note') {
      if (isTaskCompletedForOccurrence(taskId, occDate)) return;
      const textarea = document.getElementById(`task-note-${taskId}`);
      const description = textarea ? textarea.value : '';
      const ok = await updateTask(taskId, { description });
      if (!ok) {
        alert('Could not save note.');
        return;
      }
      await loadTasks();
    }
  });
}
// ========================================================================
// Â§6  CALENDAR EXPERIENCE
// ========================================================================
// Month view (grid) and week view (Kanban board with drag-and-drop).
// Important dates, quick-add tasks, task occurrence rendering.
// âš ï¸ Global mutable: calendarState (viewMode, selectedDate, weekSortables)
// âš ï¸ Depends on: window.Sortable (external library) for week view DnD.
// âš ï¸ Week view creates Sortable instances stored in calendarState.weekSortables;
//    they are destroyed on view switch via destroyCalendarWeekSortables().

const calendarState = {
  visibleMonth: null,
  selectedDate: null,
  importantDates: new Set(),
  viewMode: 'month',
  weekSortables: []
};

const CALENDAR_IMPORTANT_KEY_BASE = 'fittrack_calendar_important_v1';
const CALENDAR_VIEW_KEY_BASE = 'fittrack_calendar_view_v1';
function calendarImportantStorageKey() {
  return _userKeyPrefix(CALENDAR_IMPORTANT_KEY_BASE);
}
function calendarViewStorageKey() {
  return _userKeyPrefix(CALENDAR_VIEW_KEY_BASE);
}

function loadCalendarImportantDates() {
  try {
    const raw = localStorage.getItem(calendarImportantStorageKey());
    const parsed = raw ? JSON.parse(raw) : [];
    calendarState.importantDates = new Set(Array.isArray(parsed) ? parsed : []);
  } catch (_err) {
    calendarState.importantDates = new Set();
  }
}

function persistCalendarImportantDates() {
  localStorage.setItem(calendarImportantStorageKey(), JSON.stringify(Array.from(calendarState.importantDates)));
}

function loadCalendarViewMode() {
  try {
    const saved = String(localStorage.getItem(calendarViewStorageKey()) || '').toLowerCase();
    calendarState.viewMode = saved === 'week' ? 'week' : 'month';
  } catch (_err) {
    calendarState.viewMode = 'month';
  }
}

function persistCalendarViewMode() {
  localStorage.setItem(calendarViewStorageKey(), calendarState.viewMode === 'week' ? 'week' : 'month');
}

function toLocalDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function dateFromKey(dateKey) {
  const [y, m, d] = String(dateKey).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

function taskCalendarDateKey(task) {
  if (task?.date) return String(task.date);
  return toLocalDateKey(new Date());
}

function calendarMonthLabel(date) {
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function calendarWeekStartMonday(dateInput) {
  const date = new Date(dateInput);
  const day = (date.getDay() + 6) % 7; // Monday = 0
  date.setDate(date.getDate() - day);
  date.setHours(0, 0, 0, 0);
  return date;
}

function calendarWeekDayKeys(anchorDate) {
  const start = calendarWeekStartMonday(anchorDate);
  const keys = [];
  for (let i = 0; i < 7; i += 1) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    keys.push(toLocalDateKey(d));
  }
  return keys;
}

function calendarWeekRangeLabel(anchorDate) {
  const start = calendarWeekStartMonday(anchorDate);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const startLabel = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const endLabel = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return `${startLabel} - ${endLabel}`;
}

function renderCalendarGrid() {
  const grid = document.getElementById('calendar-grid');
  const monthLabelEl = document.getElementById('calendar-month-label');
  if (!grid || !monthLabelEl) return;

  const visible = calendarState.visibleMonth || new Date();
  const firstDay = new Date(visible.getFullYear(), visible.getMonth(), 1);
  const startWeekday = firstDay.getDay();
  const daysInMonth = new Date(visible.getFullYear(), visible.getMonth() + 1, 0).getDate();
  const daysInPrevMonth = new Date(visible.getFullYear(), visible.getMonth(), 0).getDate();
  const todayKey = toLocalDateKey(new Date());

  monthLabelEl.innerHTML = `<i class="fas fa-calendar-alt"></i> ${calendarMonthLabel(visible)}`;

  const weekdayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    .map(day => `<div class="calendar-weekday">${day}</div>`)
    .join('');

  const dayCells = [];
  for (let i = 0; i < 42; i += 1) {
    const dayOffset = i - startWeekday;
    let dayNumber = dayOffset + 1;
    let cellDate;
    let muted = false;

    if (dayNumber <= 0) {
      dayNumber = daysInPrevMonth + dayNumber;
      cellDate = new Date(visible.getFullYear(), visible.getMonth() - 1, dayNumber);
      muted = true;
    } else if (dayNumber > daysInMonth) {
      cellDate = new Date(visible.getFullYear(), visible.getMonth() + 1, dayNumber - daysInMonth);
      dayNumber -= daysInMonth;
      muted = true;
    } else {
      cellDate = new Date(visible.getFullYear(), visible.getMonth(), dayNumber);
    }

    const key = toLocalDateKey(cellDate);
    const count = taskUiState.tasks.filter(task => taskOccursOnDate(task, key)).length;
    const selected = key === calendarState.selectedDate;
    const today = key === todayKey;
    const important = calendarState.importantDates.has(key);

    dayCells.push(`
      <button
        type="button"
        class="calendar-day ${muted ? 'muted' : ''} ${count ? 'has-tasks' : ''} ${selected ? 'is-selected' : ''} ${today ? 'today' : ''} ${important ? 'important' : ''}"
        data-action="calendar-select-day"
        data-date="${key}"
      >
        <span class="calendar-day-number">${dayNumber}</span>
        ${important ? '<span class="calendar-important-mark" title="Important day"><i class="fas fa-star"></i></span>' : ''}
        ${count ? `<span class="day-count">${count}</span>` : ''}
      </button>
    `);
  }

  grid.innerHTML = weekdayLabels + dayCells.join('');
}

function renderCalendarTaskList() {
  const labelEl = document.getElementById('calendar-selected-label');
  const listEl = document.getElementById('calendar-task-list');
  const dateInput = document.getElementById('calendar-add-date');
  const importantBtn = document.getElementById('calendar-mark-important-btn');
  if (!listEl || !labelEl) return;

  const selectedDate = calendarState.selectedDate || toLocalDateKey(new Date());
  if (dateInput) dateInput.value = selectedDate;
  const selected = dateFromKey(selectedDate);
  labelEl.textContent = `Tasks for ${selected.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}`;
  if (importantBtn) {
    const isImportant = calendarState.importantDates.has(selectedDate);
    importantBtn.setAttribute('data-date', selectedDate);
    importantBtn.innerHTML = isImportant
      ? '<i class="fas fa-star"></i> Unmark Important'
      : '<i class="far fa-star"></i> Mark Important';
    importantBtn.classList.toggle('is-important', isImportant);
  }

  const tasksForDay = taskUiState.tasks
    .filter(task => taskOccursOnDate(task, selectedDate))
    .map(task => ({
      ...task,
      completed: isTaskOccurrenceDone(task, selectedDate),
      date: selectedDate,
      __occurrenceDate: selectedDate
    }))
    .sort((a, b) => (a.date || '').localeCompare(b.date || ''));

  if (tasksForDay.length === 0) {
    listEl.innerHTML = '<div class="calendar-empty">No tasks scheduled for this day.</div>';
    return;
  }

  listEl.innerHTML = tasksForDay.map(task => `
    <article class="calendar-task-item">
      <div>
        <div class="calendar-task-title ${task.completed ? 'is-done' : ''}">${escapeHtml(task.title)}</div>
        <div class="calendar-task-time">${formatTaskDue(task)}</div>
      </div>
      <div class="calendar-task-actions">
        <button class="calendar-open-task" data-action="calendar-open-task" data-task-id="${task.id}" type="button">Open</button>
        ${task.completed ? '' : `<button class="calendar-complete-task" data-action="calendar-complete-task" data-task-id="${task.id}" data-date="${selectedDate}" type="button">Complete</button>`}
      </div>
    </article>
  `).join('');
}

function calendarMaterializeTaskForDate(task, dateKey) {
  return {
    ...task,
    completed: isTaskOccurrenceDone(task, dateKey),
    date: dateKey,
    __occurrenceDate: dateKey
  };
}

function calendarTasksForDate(dateKey) {
  return taskUiState.tasks
    .filter(task => taskOccursOnDate(task, dateKey))
    .map(task => calendarMaterializeTaskForDate(task, dateKey))
    .sort((a, b) => taskDueAt(a).getTime() - taskDueAt(b).getTime());
}

function calendarOverdueTasks() {
  const todayKey = toLocalDateKey(new Date());
  return taskUiState.tasks
    .filter((task) => {
      const key = taskCalendarDateKey(task);
      if (key >= todayKey) return false;
      return !isTaskOccurrenceDone(task, key);
    })
    .map(task => calendarMaterializeTaskForDate(task, taskCalendarDateKey(task)))
    .sort((a, b) => taskDueAt(a).getTime() - taskDueAt(b).getTime());
}

function calendarWeekTaskCardHtml(task) {
  const isCompleted = !!task.completed;
  const isDraggable = !isCompleted;
  return `
    <article
      class="calendar-week-task-card ${isCompleted ? 'is-completed' : 'is-draggable'}"
      data-task-id="${task.id}"
      data-occ-date="${task.__occurrenceDate || taskCalendarDateKey(task)}"
    >
      <div class="calendar-week-task-main">
        <div class="calendar-week-task-title ${isCompleted ? 'is-done' : ''}">${escapeHtml(task.title)}</div>
        <div class="calendar-week-task-time">${formatTaskDue(task)}</div>
      </div>
      <div class="calendar-week-task-actions">
        <button class="calendar-open-task" data-action="calendar-open-task" data-task-id="${task.id}" type="button">Open</button>
        ${isCompleted ? '' : `<button class="calendar-complete-task" data-action="calendar-week-complete-task" data-task-id="${task.id}" data-date="${task.__occurrenceDate || taskCalendarDateKey(task)}" type="button">Complete</button>`}
      </div>
    </article>
  `;
}

function destroyCalendarWeekSortables() {
  if (!Array.isArray(calendarState.weekSortables)) {
    calendarState.weekSortables = [];
    return;
  }
  calendarState.weekSortables.forEach((sortable) => {
    if (sortable && typeof sortable.destroy === 'function') sortable.destroy();
  });
  calendarState.weekSortables = [];
}

async function calendarRescheduleTask(taskId, targetDateKey) {
  const idNum = Number(taskId);
  if (!idNum || !targetDateKey) return false;

  const idx = taskUiState.tasks.findIndex(t => Number(t.id) === idNum);
  if (idx < 0) return false;
  const originalTask = taskUiState.tasks[idx];
  const originalDate = originalTask.date || null;

  taskUiState.tasks[idx] = {
    ...originalTask,
    date: targetDateKey
  };
  renderCalendar();
  renderTasks(taskUiState.tasks);

  let saveOk = true;
  try {
    saveOk = await updateTask(idNum, { date: targetDateKey });
  } catch (_err) {
    saveOk = false;
  }

  if (!saveOk) {
    taskUiState.tasks[idx] = {
      ...taskUiState.tasks[idx],
      date: originalDate
    };
    renderCalendar();
    renderTasks(taskUiState.tasks);
    alert('Could not reschedule task right now. Reverted to the previous date.');
    return false;
  }

  return true;
}

function setupCalendarWeekDnD() {
  destroyCalendarWeekSortables();
  if (calendarState.viewMode !== 'week') return;
  if (typeof window.Sortable === 'undefined') return;

  const lists = Array.from(document.querySelectorAll('.calendar-week-task-list[data-date-key]'));
  calendarState.weekSortables = lists.map((listEl) => new window.Sortable(listEl, {
    group: {
      name: 'calendar-week',
      pull: true,
      put: listEl.getAttribute('data-drop-allowed') !== 'false'
    },
    animation: 200,
    easing: 'cubic-bezier(0.25, 1, 0.5, 1)',
    ghostClass: 'calendar-drag-ghost',
    chosenClass: 'calendar-drag-chosen',
    dragClass: 'calendar-drag-active',
    draggable: '.calendar-week-task-card.is-draggable',
    forceFallback: true,
    fallbackTolerance: 3,
    fallbackClass: 'calendar-drag-active',
    delayOnTouchOnly: true,
    delay: 80,
    touchStartThreshold: 5,
    scroll: true,
    scrollSensitivity: 80,
    scrollSpeed: 12,
    bubbleScroll: true,
    onStart: (evt) => {
      document.body.style.cursor = 'grabbing';
      if (evt.from) evt.from.classList.add('sortable-drag-over');
    },
    onMove: (evt) => {
      const lists = document.querySelectorAll('.calendar-week-task-list');
      lists.forEach(l => l.classList.remove('sortable-drag-over'));
      if (evt.to) evt.to.classList.add('sortable-drag-over');
    },
    onEnd: async (evt) => {
      document.body.style.cursor = '';
      const allLists = document.querySelectorAll('.calendar-week-task-list');
      allLists.forEach(l => l.classList.remove('sortable-drag-over'));
      const item = evt.item;
      if (!item) return;
      const taskId = Number(item.getAttribute('data-task-id'));
      const fromDateKey = evt.from?.getAttribute('data-date-key') || '';
      const toDateKey = evt.to?.getAttribute('data-date-key') || '';
      if (!taskId || !toDateKey || toDateKey === 'overdue' || fromDateKey === toDateKey) {
        renderCalendar();
        return;
      }
      await calendarRescheduleTask(taskId, toDateKey);
    }
  }));
}

function renderCalendarWeekBoard() {
  const board = document.getElementById('calendar-week-board');
  const monthLabelEl = document.getElementById('calendar-month-label');
  if (!board || !monthLabelEl) return;

  const anchor = calendarState.selectedDate ? dateFromKey(calendarState.selectedDate) : new Date();
  const weekKeys = calendarWeekDayKeys(anchor);
  const todayKey = toLocalDateKey(new Date());
  const dayLabels = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  monthLabelEl.innerHTML = `<i class="fas fa-calendar-alt"></i> ${calendarWeekRangeLabel(anchor)}`;

  const overdue = calendarOverdueTasks();
  const overdueHtml = overdue.length
    ? overdue.map(calendarWeekTaskCardHtml).join('')
    : '<div class="calendar-week-empty">No overdue tasks.</div>';

  const dayColumnsHtml = weekKeys.map((dateKey, idx) => {
    const dayTasks = calendarTasksForDate(dateKey);
    const isToday = dateKey === todayKey;
    const tasksHtml = dayTasks.length
      ? dayTasks.map(calendarWeekTaskCardHtml).join('')
      : '<div class="calendar-week-empty">No tasks</div>';
    const niceDate = dateFromKey(dateKey).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `
      <section class="calendar-week-column ${isToday ? 'is-today' : ''}">
        <header class="calendar-week-column-head">
          <div>
            <h4>${dayLabels[idx]}</h4>
            <span>${niceDate}</span>
          </div>
          <button class="calendar-week-add-btn" type="button" data-action="calendar-week-add-task" data-date="${dateKey}">+ Add task</button>
        </header>
        <div class="calendar-week-task-list" data-date-key="${dateKey}" data-drop-allowed="true">
          ${tasksHtml}
        </div>
      </section>
    `;
  }).join('');

  board.innerHTML = `
    <div class="calendar-week-grid">
      <section class="calendar-week-column is-overdue">
        <header class="calendar-week-column-head">
          <div>
            <h4>Overdue</h4>
            <span>Before today</span>
          </div>
        </header>
        <div class="calendar-week-task-list" data-date-key="overdue" data-drop-allowed="false">
          ${overdueHtml}
        </div>
      </section>
      ${dayColumnsHtml}
    </div>
  `;

  setupCalendarWeekDnD();
}

function renderCalendarViewMode() {
  const isWeek = calendarState.viewMode === 'week';
  const monthCard = document.getElementById('calendar-month-card');
  const detailCard = document.getElementById('calendar-detail-card');
  const weekBoard = document.getElementById('calendar-week-board');
  const monthBtn = document.getElementById('calendar-view-month-btn');
  const weekBtn = document.getElementById('calendar-view-week-btn');
  if (monthCard) monthCard.style.display = isWeek ? 'none' : 'block';
  if (detailCard) detailCard.style.display = isWeek ? 'none' : 'block';
  if (weekBoard) weekBoard.style.display = isWeek ? 'block' : 'none';
  if (monthBtn) {
    monthBtn.classList.toggle('is-active', !isWeek);
    monthBtn.setAttribute('aria-selected', !isWeek ? 'true' : 'false');
  }
  if (weekBtn) {
    weekBtn.classList.toggle('is-active', isWeek);
    weekBtn.setAttribute('aria-selected', isWeek ? 'true' : 'false');
  }
}

function renderCalendar() {
  if (!document.getElementById('calendar')) return;
  loadCalendarImportantDates();
  loadCalendarViewMode();
  if (!calendarState.visibleMonth) {
    const now = new Date();
    calendarState.visibleMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  }
  if (!calendarState.selectedDate) {
    calendarState.selectedDate = toLocalDateKey(new Date());
  }
  renderCalendarViewMode();
  if (calendarState.viewMode === 'week') {
    renderCalendarWeekBoard();
  } else {
    destroyCalendarWeekSortables();
    renderCalendarGrid();
    renderCalendarTaskList();
  }
}

function setupCalendar() {
  const section = document.getElementById('calendar');
  if (!section) return;

  if (!calendarState.visibleMonth) {
    const now = new Date();
    calendarState.visibleMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    calendarState.selectedDate = toLocalDateKey(now);
  }

  const prevBtn = document.getElementById('calendar-prev-month');
  const nextBtn = document.getElementById('calendar-next-month');
  const quickAddForm = document.getElementById('calendar-quick-add-form');
  const addTitle = document.getElementById('calendar-add-title');
  const addPriority = document.getElementById('calendar-add-priority');
  const addDate = document.getElementById('calendar-add-date');
  const addTime = document.getElementById('calendar-add-time');
  const monthBtn = document.getElementById('calendar-view-month-btn');
  const weekBtn = document.getElementById('calendar-view-week-btn');

  if (monthBtn) {
    monthBtn.addEventListener('click', () => {
      calendarState.viewMode = 'month';
      persistCalendarViewMode();
      renderCalendar();
    });
  }

  if (weekBtn) {
    weekBtn.addEventListener('click', () => {
      calendarState.viewMode = 'week';
      persistCalendarViewMode();
      renderCalendar();
    });
  }

  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      if (calendarState.viewMode === 'week') {
        const anchor = calendarState.selectedDate ? dateFromKey(calendarState.selectedDate) : new Date();
        anchor.setDate(anchor.getDate() - 7);
        calendarState.selectedDate = toLocalDateKey(anchor);
        calendarState.visibleMonth = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
      } else {
        const v = calendarState.visibleMonth;
        calendarState.visibleMonth = new Date(v.getFullYear(), v.getMonth() - 1, 1);
      }
      renderCalendar();
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      if (calendarState.viewMode === 'week') {
        const anchor = calendarState.selectedDate ? dateFromKey(calendarState.selectedDate) : new Date();
        anchor.setDate(anchor.getDate() + 7);
        calendarState.selectedDate = toLocalDateKey(anchor);
        calendarState.visibleMonth = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
      } else {
        const v = calendarState.visibleMonth;
        calendarState.visibleMonth = new Date(v.getFullYear(), v.getMonth() + 1, 1);
      }
      renderCalendar();
    });
  }

  if (quickAddForm) {
    quickAddForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const title = (addTitle?.value || '').trim();
      const priority = addPriority?.value || 'medium';
      const date = addDate?.value;
      const time = addTime?.value || '09:00';
      if (!title || !date) return;

      await addTask(title, priority, 24, 'none', `${date}T${time}`);
      calendarState.selectedDate = date;
      const picked = dateFromKey(date);
      calendarState.visibleMonth = new Date(picked.getFullYear(), picked.getMonth(), 1);
      if (addTitle) addTitle.value = '';
      renderCalendar();
    });
  }

  section.addEventListener('click', async (e) => {
    const target = e.target;
    const actionEl = target.closest('[data-action]');
    if (!actionEl) return;
    const action = actionEl.getAttribute('data-action');

    if (action === 'calendar-select-day') {
      const dateKey = actionEl.getAttribute('data-date');
      if (!dateKey) return;
      calendarState.selectedDate = dateKey;
      const d = dateFromKey(dateKey);
      calendarState.visibleMonth = new Date(d.getFullYear(), d.getMonth(), 1);
      renderCalendar();
      return;
    }

    if (action === 'calendar-open-task') {
      const taskId = Number(actionEl.getAttribute('data-task-id'));
      if (!taskId) return;
      taskUiState.expanded.add(taskId);
      showPage('tasks');
      renderTasks(taskUiState.tasks);
      return;
    }

    if (action === 'calendar-complete-task') {
      const taskId = Number(actionEl.getAttribute('data-task-id'));
      const dateKey = actionEl.getAttribute('data-date') || null;
      if (!taskId) return;
      await toggleTask(taskId, dateKey);
      return;
    }

    if (action === 'calendar-week-complete-task') {
      const taskId = Number(actionEl.getAttribute('data-task-id'));
      const dateKey = actionEl.getAttribute('data-date') || null;
      if (!taskId) return;
      await toggleTask(taskId, dateKey);
      return;
    }

    if (action === 'calendar-week-add-task') {
      const dateKey = actionEl.getAttribute('data-date') || '';
      if (!dateKey || !addDate) return;
      addDate.value = dateKey;
      calendarState.selectedDate = dateKey;
      calendarState.visibleMonth = new Date(dateFromKey(dateKey).getFullYear(), dateFromKey(dateKey).getMonth(), 1);
      const titleInput = document.getElementById('calendar-add-title');
      if (titleInput) titleInput.focus();
      return;
    }

    if (action === 'calendar-toggle-important') {
      const dateKey = actionEl.getAttribute('data-date') || calendarState.selectedDate;
      if (!dateKey) return;
      if (calendarState.importantDates.has(dateKey)) {
        calendarState.importantDates.delete(dateKey);
      } else {
        calendarState.importantDates.add(dateKey);
      }
      persistCalendarImportantDates();
      renderCalendar();
    }
  });

  const importantBtn = document.getElementById('calendar-mark-important-btn');
  if (importantBtn && !importantBtn.dataset.bound) {
    importantBtn.dataset.bound = 'true';
    importantBtn.setAttribute('data-action', 'calendar-toggle-important');
  }

  loadCalendarViewMode();
  renderCalendar();
}

// ========================================================================
// Â§7  NUTRITION EXPERIENCE
// ========================================================================
// Manual meal logging, food database browser, builder mode, saved presets.
// AI-powered meal detection via USDA FoodData Central (2-step confirm flow).
// âš ï¸ Global mutable: nutritionState, nutritionBuilderState,
//    aiMealPanelOpen, aiDetectedData, mealsLoadRequestId
// âš ï¸ nutritionFoodDatabase is a large inline object (~600 lines).

const NUTRITION_SAVED_KEY_BASE = 'fittrack_saved_meals_v1';
function nutritionSavedMealsStorageKey() {
  return _userKeyPrefix(NUTRITION_SAVED_KEY_BASE);
}

const nutritionState = {
  weightGoal: 'maintain',
  baseGoals: {
    calories: 2200,
    protein: 140,
    carbs: 250,
    fats: 60
  },
  entries: [],
  savedMeals: [],
  showForm: false,
  showSavedMeals: true,
  activeMealType: 'breakfast'
};
let mealsLoadRequestId = 0;

const nutritionFoodDatabase = {
  carbohydrates: [
    // Grains & Cereals
    { id: 'white_rice_cooked', name: 'White rice (cooked)', calories: 130, protein: 2.4, carbs: 28, fats: 0.3, unit: 'grams' },
    { id: 'brown_rice_cooked', name: 'Brown rice (cooked)', calories: 111, protein: 2.6, carbs: 23, fats: 0.9, unit: 'grams' },
    { id: 'oats_dry', name: 'Oats (dry)', calories: 389, protein: 17, carbs: 66, fats: 7, unit: 'grams' },
    { id: 'whole_wheat_bread', name: 'Whole wheat bread', calories: 247, protein: 13, carbs: 41, fats: 4.2, unit: 'grams' },
    { id: 'white_bread', name: 'White bread', calories: 265, protein: 9, carbs: 49, fats: 3.2, unit: 'grams' },
    { id: 'pasta_cooked', name: 'Pasta (cooked)', calories: 131, protein: 5, carbs: 25, fats: 1.1, unit: 'grams' },
    { id: 'quinoa_cooked', name: 'Quinoa (cooked)', calories: 120, protein: 4.4, carbs: 21, fats: 1.9, unit: 'grams' },
    { id: 'sweet_potato', name: 'Sweet potato', calories: 86, protein: 1.6, carbs: 20, fats: 0.1, unit: 'grams' },
    { id: 'potato', name: 'Potato', calories: 77, protein: 2, carbs: 17, fats: 0.1, unit: 'grams' },
    { id: 'jasmine_rice_cooked', name: 'Jasmine rice (cooked)', calories: 130, protein: 2.5, carbs: 28, fats: 0.3, unit: 'grams' },
    { id: 'basmati_rice_cooked', name: 'Basmati rice (cooked)', calories: 130, protein: 2.7, carbs: 28, fats: 0.3, unit: 'grams' },
    { id: 'wild_rice_cooked', name: 'Wild rice (cooked)', calories: 101, protein: 3.9, carbs: 19, fats: 0.3, unit: 'grams' },
    { id: 'rye_bread', name: 'Rye bread', calories: 259, protein: 8, carbs: 48, fats: 3.3, unit: 'grams' },
    { id: 'sourdough_bread', name: 'Sourdough bread', calories: 290, protein: 9, carbs: 54, fats: 1.5, unit: 'grams' },
    { id: 'bagel', name: 'Bagel', calories: 245, protein: 9, carbs: 48, fats: 1.5, unit: 'grams' },
    { id: 'cereal_granola', name: 'Granola cereal', calories: 471, protein: 12, carbs: 63, fats: 20, unit: 'grams' },
    { id: 'bran_cereal', name: 'Bran cereal', calories: 354, protein: 7, carbs: 81, fats: 1.4, unit: 'grams' },
    { id: 'muesli', name: 'Muesli', calories: 363, protein: 10, carbs: 64, fats: 8, unit: 'grams' },
    { id: 'corn_flakes', name: 'Corn flakes', calories: 381, protein: 7, carbs: 85, fats: 0.9, unit: 'grams' },
    { id: 'couscous_cooked', name: 'Couscous (cooked)', calories: 112, protein: 3.8, carbs: 23, fats: 0.1, unit: 'grams' },
    { id: 'whole_wheat_pasta', name: 'Whole wheat pasta (cooked)', calories: 124, protein: 5.3, carbs: 26, fats: 0.5, unit: 'grams' },
    { id: 'noodles_ramen', name: 'Ramen noodles (cooked)', calories: 138, protein: 4.5, carbs: 25, fats: 4.3, unit: 'grams' },
    { id: 'barley_cooked', name: 'Barley (cooked)', calories: 95, protein: 2.3, carbs: 22, fats: 0.4, unit: 'grams' },
    { id: 'millet_cooked', name: 'Millet (cooked)', calories: 119, protein: 3.5, carbs: 23, fats: 1, unit: 'grams' },
    { id: 'buckwheat_cooked', name: 'Buckwheat (cooked)', calories: 92, protein: 3.4, carbs: 20, fats: 0.6, unit: 'grams' },
    // Vegetables
    { id: 'broccoli_raw', name: 'Broccoli (raw)', calories: 34, protein: 2.8, carbs: 7, fats: 0.4, unit: 'grams' },
    { id: 'carrot_raw', name: 'Carrot (raw)', calories: 41, protein: 0.9, carbs: 10, fats: 0.2, unit: 'grams' },
    { id: 'spinach_raw', name: 'Spinach (raw)', calories: 23, protein: 2.7, carbs: 3.6, fats: 0.4, unit: 'grams' },
    { id: 'kale_raw', name: 'Kale (raw)', calories: 49, protein: 4.3, carbs: 9, fats: 0.9, unit: 'grams' },
    { id: 'lettuce_raw', name: 'Lettuce (raw)', calories: 15, protein: 1.2, carbs: 2.9, fats: 0.2, unit: 'grams' },
    { id: 'bell_pepper', name: 'Bell pepper (red)', calories: 31, protein: 1, carbs: 6, fats: 0.3, unit: 'grams' },
    { id: 'cucumber', name: 'Cucumber (raw)', calories: 16, protein: 0.7, carbs: 3.6, fats: 0.1, unit: 'grams' },
    { id: 'tomato_raw', name: 'Tomato (raw)', calories: 18, protein: 0.9, carbs: 3.9, fats: 0.2, unit: 'grams' },
    { id: 'onion_raw', name: 'Onion (raw)', calories: 40, protein: 1.1, carbs: 9, fats: 0.1, unit: 'grams' },
    { id: 'garlic_raw', name: 'Garlic (raw)', calories: 149, protein: 6.4, carbs: 33, fats: 0.5, unit: 'grams' },
    { id: 'zucchini', name: 'Zucchini (raw)', calories: 21, protein: 1.5, carbs: 3.5, fats: 0.4, unit: 'grams' },
    { id: 'eggplant_raw', name: 'Eggplant (raw)', calories: 25, protein: 0.98, carbs: 5.9, fats: 0.2, unit: 'grams' },
    { id: 'asparagus_raw', name: 'Asparagus (raw)', calories: 27, protein: 3, carbs: 5, fats: 0.1, unit: 'grams' },
    { id: 'peas_cooked', name: 'Peas (cooked)', calories: 81, protein: 5.4, carbs: 14, fats: 0.4, unit: 'grams' },
    { id: 'corn_cooked', name: 'Corn (cooked)', calories: 96, protein: 3.4, carbs: 21, fats: 1.5, unit: 'grams' },
    { id: 'green_beans', name: 'Green beans (raw)', calories: 31, protein: 1.8, carbs: 7, fats: 0.2, unit: 'grams' },
    { id: 'cauliflower_raw', name: 'Cauliflower (raw)', calories: 25, protein: 1.9, carbs: 5, fats: 0.3, unit: 'grams' },
    { id: 'mushroom_raw', name: 'Mushroom (raw)', calories: 22, protein: 3.1, carbs: 3.3, fats: 0.3, unit: 'grams' },
    { id: 'cabbage_raw', name: 'Cabbage (raw)', calories: 25, protein: 1.3, carbs: 5.8, fats: 0.1, unit: 'grams' },
    { id: 'brussels_sprouts', name: 'Brussels sprouts (raw)', calories: 43, protein: 3.4, carbs: 8, fats: 0.3, unit: 'grams' },
    { id: 'artichoke', name: 'Artichoke (raw)', calories: 47, protein: 3.3, carbs: 10, fats: 0.1, unit: 'grams' },
    { id: 'beet_raw', name: 'Beet (raw)', calories: 43, protein: 1.6, carbs: 10, fats: 0.2, unit: 'grams' },
    { id: 'radish_raw', name: 'Radish (raw)', calories: 16, protein: 0.7, carbs: 3.4, fats: 0.1, unit: 'grams' },
    // Fruits
    { id: 'apple', name: 'Apple (medium)', calories: 52, protein: 0.3, carbs: 14, fats: 0.2, unit: 'grams' },
    { id: 'banana', name: 'Banana (medium)', calories: 89, protein: 1.1, carbs: 23, fats: 0.3, unit: 'grams' },
    { id: 'orange', name: 'Orange (medium)', calories: 47, protein: 0.9, carbs: 12, fats: 0.3, unit: 'grams' },
    { id: 'blueberries', name: 'Blueberries', calories: 57, protein: 0.7, carbs: 14, fats: 0.3, unit: 'grams' },
    { id: 'strawberries', name: 'Strawberries', calories: 32, protein: 0.8, carbs: 8, fats: 0.3, unit: 'grams' },
    { id: 'grapes', name: 'Grapes (red)', calories: 67, protein: 0.6, carbs: 17, fats: 0.2, unit: 'grams' },
    { id: 'watermelon', name: 'Watermelon', calories: 30, protein: 0.6, carbs: 8, fats: 0.2, unit: 'grams' },
    { id: 'mango', name: 'Mango (raw)', calories: 60, protein: 0.8, carbs: 15, fats: 0.4, unit: 'grams' },
    { id: 'pineapple', name: 'Pineapple (raw)', calories: 50, protein: 0.5, carbs: 13, fats: 0.1, unit: 'grams' },
    { id: 'kiwi', name: 'Kiwi (fruits)', calories: 61, protein: 1.1, carbs: 15, fats: 0.5, unit: 'grams' },
    { id: 'pear', name: 'Pear (medium)', calories: 57, protein: 0.4, carbs: 15, fats: 0.1, unit: 'grams' },
    { id: 'peach', name: 'Peach (medium)', calories: 39, protein: 0.9, carbs: 10, fats: 0.3, unit: 'grams' },
    { id: 'plum', name: 'Plum (medium)', calories: 30, protein: 0.5, carbs: 7, fats: 0.2, unit: 'grams' },
    { id: 'papaya', name: 'Papaya (raw)', calories: 43, protein: 0.5, carbs: 11, fats: 0.3, unit: 'grams' },
    { id: 'coconut_meat', name: 'Coconut meat (dried)', calories: 660, protein: 7.3, carbs: 24, fats: 64, unit: 'grams' },
    { id: 'date', name: 'Date (dried)', calories: 282, protein: 2.5, carbs: 75, fats: 0.15, unit: 'grams' },
    { id: 'raisin', name: 'Raisins', calories: 299, protein: 3.1, carbs: 79, fats: 0.5, unit: 'grams' },
    { id: 'fig_dried', name: 'Figs (dried)', calories: 249, protein: 3.3, carbs: 64, fats: 0.9, unit: 'grams' },
    { id: 'avocado', name: 'Avocado (raw)', calories: 160, protein: 2, carbs: 9, fats: 15, unit: 'grams' },
    { id: 'lemon', name: 'Lemon (raw)', calories: 29, protein: 1.1, carbs: 9, fats: 0.3, unit: 'grams' },
    { id: 'lime', name: 'Lime (raw)', calories: 30, protein: 0.7, carbs: 11, fats: 0.2, unit: 'grams' },
    // Legumes & Pulses
    { id: 'lentils_cooked', name: 'Lentils (cooked)', calories: 116, protein: 9, carbs: 20, fats: 0.4, unit: 'grams' },
    { id: 'beans_black_cooked', name: 'Black beans (cooked)', calories: 132, protein: 8.9, carbs: 24, fats: 0.5, unit: 'grams' },
    { id: 'beans_kidney_cooked', name: 'Kidney beans (cooked)', calories: 127, protein: 8.7, carbs: 23, fats: 0.4, unit: 'grams' },
    { id: 'peas_dry_cooked', name: 'Split peas (cooked)', calories: 118, protein: 8.2, carbs: 21, fats: 0.4, unit: 'grams' },
    { id: 'chickpeas_cooked', name: 'Chickpeas (cooked)', calories: 134, protein: 7.2, carbs: 23, fats: 2.1, unit: 'grams' },
    { id: 'peanuts', name: 'Peanuts (dry roasted)', calories: 567, protein: 26, carbs: 20, fats: 49, unit: 'grams' },
    { id: 'peanut_butter', name: 'Peanut butter', calories: 94, protein: 4, carbs: 3.5, fats: 8, unit: 'tablespoon' }
  ],
  proteins: [
    // Poultry
    { id: 'chicken_breast_cooked_skinless', name: 'Chicken breast (cooked, skinless)', calories: 165, protein: 31, carbs: 0, fats: 3.6, unit: 'grams' },
    { id: 'chicken_thigh_cooked', name: 'Chicken thigh (cooked, skinless)', calories: 209, protein: 26, carbs: 0, fats: 11, unit: 'grams' },
    { id: 'turkey_breast_cooked', name: 'Turkey breast (cooked)', calories: 189, protein: 29, carbs: 0, fats: 7.4, unit: 'grams' },
    { id: 'duck_cooked', name: 'Duck (cooked)', calories: 337, protein: 19, carbs: 0, fats: 29, unit: 'grams' },
    { id: 'chicken_ground_cooked', name: 'Ground chicken (cooked)', calories: 165, protein: 23, carbs: 0, fats: 7.4, unit: 'grams' },
    { id: 'turkey_ground_cooked', name: 'Ground turkey (cooked)', calories: 200, protein: 29, carbs: 0, fats: 8.7, unit: 'grams' },
    // Beef
    { id: 'ground_beef_85_lean', name: 'Ground beef (85% lean)', calories: 217, protein: 23, carbs: 0, fats: 13, unit: 'grams' },
    { id: 'ground_beef_93_lean', name: 'Ground beef (93% lean)', calories: 174, protein: 24, carbs: 0, fats: 8, unit: 'grams' },
    { id: 'beef_sirloin_lean', name: 'Beef sirloin (lean)', calories: 180, protein: 27, carbs: 0, fats: 8, unit: 'grams' },
    { id: 'beef_rib_eye', name: 'Beef rib eye', calories: 291, protein: 24, carbs: 0, fats: 23, unit: 'grams' },
    { id: 'beef_chuck_roast', name: 'Beef chuck roast', calories: 288, protein: 24, carbs: 0, fats: 21, unit: 'grams' },
    { id: 'beef_stew_meat', name: 'Beef stew meat (cooked)', calories: 198, protein: 32, carbs: 0, fats: 8, unit: 'grams' },
    { id: 'lean_ground_beef', name: 'Lean ground beef (90%)', calories: 176, protein: 24, carbs: 0, fats: 8, unit: 'grams' },
    // Fish & Seafood
    { id: 'salmon_atlantic', name: 'Salmon (Atlantic)', calories: 208, protein: 20, carbs: 0, fats: 13, unit: 'grams' },
    { id: 'salmon_wild', name: 'Salmon (wild)', calories: 182, protein: 25, carbs: 0, fats: 8.1, unit: 'grams' },
    { id: 'tuna_canned_water', name: 'Tuna (canned, water)', calories: 116, protein: 26, carbs: 0, fats: 1, unit: 'grams' },
    { id: 'tuna_fresh_cooked', name: 'Tuna (fresh, cooked)', calories: 144, protein: 29, carbs: 0, fats: 1.3, unit: 'grams' },
    { id: 'cod_cooked', name: 'Cod (cooked)', calories: 82, protein: 18, carbs: 0, fats: 0.7, unit: 'grams' },
    { id: 'tilapia_cooked', name: 'Tilapia (cooked)', calories: 128, protein: 26, carbs: 0, fats: 2.7, unit: 'grams' },
    { id: 'halibut_cooked', name: 'Halibut (cooked)', calories: 111, protein: 21, carbs: 0, fats: 2.3, unit: 'grams' },
    { id: 'mackerel_cooked', name: 'Mackerel (cooked)', calories: 305, protein: 21, carbs: 0, fats: 25, unit: 'grams' },
    { id: 'sardines_canned', name: 'Sardines (canned, oil)', calories: 208, protein: 20, carbs: 0, fats: 13, unit: 'grams' },
    { id: 'trout_cooked', name: 'Trout (cooked)', calories: 148, protein: 21, carbs: 0, fats: 7, unit: 'grams' },
    { id: 'shrimp_cooked', name: 'Shrimp (cooked)', calories: 99, protein: 24, carbs: 0, fats: 0.3, unit: 'grams' },
    { id: 'crab_cooked', name: 'Crab (cooked)', calories: 102, protein: 20, carbs: 0, fats: 2, unit: 'grams' },
    { id: 'lobster_cooked', name: 'Lobster (cooked)', calories: 90, protein: 19, carbs: 1.3, fats: 0.9, unit: 'grams' },
    { id: 'oysters_cooked', name: 'Oysters (cooked)', calories: 81, protein: 9.4, carbs: 7, fats: 2.2, unit: 'grams' },
    // Eggs (per 1 whole/unit)
    { id: 'whole_egg', name: 'Whole egg', calories: 78, protein: 6.5, carbs: 0.6, fats: 5.5, unit: 'whole' },
    { id: 'egg_white', name: 'Egg white', calories: 17, protein: 3.6, carbs: 0.2, fats: 0.2, unit: 'whole' },
    { id: 'egg_yolk', name: 'Egg yolk', calories: 55, protein: 2.7, carbs: 0.3, fats: 5.1, unit: 'whole' },
    // Dairy
    { id: 'greek_yogurt_nonfat', name: 'Greek yogurt (nonfat)', calories: 59, protein: 10, carbs: 4, fats: 0.4, unit: 'grams' },
    { id: 'greek_yogurt_full_fat', name: 'Greek yogurt (full-fat)', calories: 100, protein: 10, carbs: 4, fats: 5, unit: 'grams' },
    { id: 'cottage_cheese_low_fat', name: 'Cottage cheese (low-fat)', calories: 98, protein: 11, carbs: 3.4, fats: 4.3, unit: 'grams' },
    { id: 'milk_2percent', name: 'Milk (2%)', calories: 49, protein: 3.3, carbs: 4.8, fats: 1.9, unit: 'grams' },
    { id: 'milk_skim', name: 'Milk (skim)', calories: 34, protein: 3.4, carbs: 4.8, fats: 0.1, unit: 'grams' },
    { id: 'milk_whole', name: 'Milk (whole)', calories: 60, protein: 3.2, carbs: 4.8, fats: 3.2, unit: 'grams' },
    { id: 'kefir', name: 'Kefir (plain)', calories: 60, protein: 3.4, carbs: 4, fats: 3.5, unit: 'grams' },
    { id: 'cheese_cheddar', name: 'Cheese (cheddar)', calories: 403, protein: 23, carbs: 1.3, fats: 33, unit: 'grams' },
    { id: 'cheese_mozzarella', name: 'Cheese (mozzarella)', calories: 280, protein: 28, carbs: 3.1, fats: 17, unit: 'grams' },
    { id: 'cheese_feta', name: 'Cheese (feta)', calories: 264, protein: 14, carbs: 4.1, fats: 21, unit: 'grams' },
    { id: 'cheese_parmesan', name: 'Cheese (parmesan)', calories: 392, protein: 38, carbs: 4.1, fats: 29, unit: 'grams' },
    // Plant-Based Proteins
    { id: 'tofu_firm', name: 'Tofu (firm)', calories: 144, protein: 17, carbs: 3, fats: 9, unit: 'grams' },
    { id: 'tofu_silken', name: 'Tofu (silken)', calories: 61, protein: 6.6, carbs: 1.6, fats: 3.5, unit: 'grams' },
    { id: 'tempeh', name: 'Tempeh (fermented)', calories: 192, protein: 19, carbs: 9, fats: 11, unit: 'grams' },
    { id: 'edamame', name: 'Edamame (cooked)', calories: 111, protein: 11.1, carbs: 10, fats: 5, unit: 'grams' },
    { id: 'hemp_seeds', name: 'Hemp seeds', calories: 560, protein: 31, carbs: 12, fats: 48, unit: 'grams' },
    { id: 'chia_seeds', name: 'Chia seeds', calories: 60, protein: 2.1, carbs: 5, fats: 3.8, unit: 'tablespoon' },
    { id: 'seitan', name: 'Seitan (wheat gluten)', calories: 370, protein: 25, carbs: 14, fats: 5, unit: 'grams' },
    { id: 'textured_vegetable_protein', name: 'Textured vegetable protein (TVP)', calories: 275, protein: 50, carbs: 18, fats: 1.3, unit: 'grams' },
    // Processed Meats
    { id: 'turkey_deli_meat', name: 'Turkey deli meat', calories: 207, protein: 25, carbs: 1.4, fats: 11, unit: 'grams' },
    { id: 'chicken_deli_meat', name: 'Chicken deli meat', calories: 180, protein: 23, carbs: 0, fats: 9.3, unit: 'grams' },
    { id: 'bacon_cooked', name: 'Bacon (cooked)', calories: 541, protein: 37, carbs: 0.1, fats: 43, unit: 'grams' },
    { id: 'sausage_pork', name: 'Pork sausage (cooked)', calories: 301, protein: 27, carbs: 1.5, fats: 23, unit: 'grams' },
    // Nuts & Seeds (High in both protein and healthy fats)
    { id: 'almonds', name: 'Almonds', calories: 579, protein: 21, carbs: 22, fats: 50, unit: 'grams' },
    { id: 'walnuts', name: 'Walnuts', calories: 654, protein: 15, carbs: 14, fats: 65, unit: 'grams' },
    { id: 'cashews', name: 'Cashews', calories: 553, protein: 18, carbs: 30, fats: 44, unit: 'grams' },
    { id: 'pistachios', name: 'Pistachios', calories: 560, protein: 20, carbs: 28, fats: 45, unit: 'grams' },
    { id: 'sunflower_seeds', name: 'Sunflower seeds', calories: 70, protein: 2.9, carbs: 2.6, fats: 6.1, unit: 'tablespoon' },
    { id: 'pumpkin_seeds', name: 'Pumpkin seeds', calories: 67, protein: 3, carbs: 1.3, fats: 5.9, unit: 'tablespoon' },
    { id: 'flax_seeds', name: 'Flax seeds', calories: 64, protein: 2.1, carbs: 3.4, fats: 5, unit: 'tablespoon' },
    { id: 'peanut_butter', name: 'Peanut butter', calories: 94, protein: 4, carbs: 3.5, fats: 8, unit: 'tablespoon' }
  ]
};

const nutritionBuilderState = {
  mode: 'manual',
  items: [],
  totals: { calories: 0, protein: 0, carbs: 0, fats: 0 }
};

function todayDateKey() {
  if (typeof toLocalDateKey === 'function') {
    return toLocalDateKey(new Date());
  }
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatDisplayDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}

function normalizeMealType(mealType) {
  const key = String(mealType || 'other').toLowerCase();
  const map = {
    breakfast: 'Breakfast',
    lunch: 'Lunch',
    dinner: 'Dinner',
    snack: 'Snack',
    other: 'Other'
  };
  return map[key] || 'Other';
}

function parseMacro(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function nutritionRound(value) {
  return Math.round((Number(value) || 0) * 10) / 10;
}

function nutritionBuilderFindFood(category, foodId) {
  const foods = nutritionFoodDatabase[category] || [];
  return foods.find(food => food.id === foodId) || null;
}

function nutritionBuildItemFromFood(food, category, quantity) {
  let ratio = 1;
  let displayQuantity = quantity;
  
  // Convert based on unit type
  if (food.unit === 'whole') {
    // For whole units (like eggs), quantity is already in units
    ratio = quantity;
    displayQuantity = quantity;
  } else if (food.unit === 'tablespoon') {
    // For tablespoons, convert to relative units (1 tbsp â‰ˆ 15g)
    ratio = (quantity * 15) / 100;
    displayQuantity = quantity;
  } else {
    // For grams (default)
    ratio = Math.max(0, Number(quantity) || 0) / 100;
    displayQuantity = quantity;
  }
  
  return {
    id: `${food.id}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    foodId: food.id,
    category,
    name: food.name,
    unit: food.unit || 'grams',
    displayQuantity: Math.max(0, Number(displayQuantity) || 0),
    grams: food.unit === 'whole' ? (quantity * 50) : (food.unit === 'tablespoon' ? (quantity * 15) : displayQuantity),
    calories: nutritionRound(food.calories * ratio),
    protein: nutritionRound(food.protein * ratio),
    carbs: nutritionRound(food.carbs * ratio),
    fats: nutritionRound(food.fats * ratio)
  };
}

function nutritionCalculateBuilderTotals() {
  const totals = nutritionBuilderState.items.reduce((acc, item) => ({
    calories: acc.calories + parseMacro(item.calories),
    protein: acc.protein + parseMacro(item.protein),
    carbs: acc.carbs + parseMacro(item.carbs),
    fats: acc.fats + parseMacro(item.fats)
  }), { calories: 0, protein: 0, carbs: 0, fats: 0 });

  nutritionBuilderState.totals = {
    calories: nutritionRound(totals.calories),
    protein: nutritionRound(totals.protein),
    carbs: nutritionRound(totals.carbs),
    fats: nutritionRound(totals.fats)
  };
}

function nutritionPopulateFoodOptions() {
  const categoryEl = document.getElementById('nutrition-builder-category');
  const foodEl = document.getElementById('nutrition-builder-food');
  if (!categoryEl || !foodEl) return;

  const category = categoryEl.value || 'carbohydrates';
  const foods = nutritionFoodDatabase[category] || [];
  foodEl.innerHTML = foods.map((food) => `<option value="${food.id}">${escapeHtml(food.name)}</option>`).join('');
  
  // Update quantity label and input for first food
  nutritionUpdateQuantityLabel();
}

function nutritionUpdateQuantityLabel() {
  const categoryEl = document.getElementById('nutrition-builder-category');
  const foodEl = document.getElementById('nutrition-builder-food');
  const gramsEl = document.getElementById('nutrition-builder-grams');
  const labelEl = document.getElementById('nutrition-builder-qty-label');
  
  if (!categoryEl || !foodEl || !gramsEl || !labelEl) return;

  const category = categoryEl.value || 'carbohydrates';
  const food = nutritionBuilderFindFood(category, foodEl.value);
  
  if (!food) return;

  const unit = food.unit || 'grams';
  let label = 'Quantity (g)';
  let step = '50';
  let placeholder = '100';
  let defaultValue = '100';

  if (unit === 'whole') {
    label = 'Quantity (whole)';
    step = '1';
    placeholder = '1';
    defaultValue = '1';
  } else if (unit === 'tablespoon') {
    label = 'Quantity (tbsp)';
    step = '0.5';
    placeholder = '1';
    defaultValue = '1';
  }

  labelEl.textContent = label;
  gramsEl.step = step;
  gramsEl.placeholder = placeholder;
  gramsEl.value = defaultValue;
  gramsEl.min = unit === 'grams' ? '50' : '1';
}

function nutritionUpdateBuilderMacroInputs() {
  const calEl = document.getElementById('nutrition-form-calories');
  const proEl = document.getElementById('nutrition-form-protein');
  const carbEl = document.getElementById('nutrition-form-carbs');
  const fatEl = document.getElementById('nutrition-form-fats');

  if (calEl) calEl.value = String(nutritionBuilderState.totals.calories);
  if (proEl) proEl.value = String(nutritionBuilderState.totals.protein);
  if (carbEl) carbEl.value = String(nutritionBuilderState.totals.carbs);
  if (fatEl) fatEl.value = String(nutritionBuilderState.totals.fats);
}

function nutritionBuilderSummaryName() {
  if (!nutritionBuilderState.items.length) return '';
  return nutritionBuilderState.items
    .map(item => {
      let quantityStr = `${Math.round(item.grams)}g`;
      if (item.unit === 'whole') {
        quantityStr = `${item.displayQuantity} whole`;
      } else if (item.unit === 'tablespoon') {
        quantityStr = `${item.displayQuantity} tbsp`;
      }
      return `${item.name} (${quantityStr})`;
    })
    .join(', ');
}

function renderNutritionBuilderList() {
  const listEl = document.getElementById('nutrition-builder-list');
  const totalsEl = document.getElementById('nutrition-builder-totals');
  if (!listEl || !totalsEl) return;

  if (nutritionBuilderState.items.length === 0) {
    listEl.innerHTML = '<div class="nutrition-empty" style="margin-top: 10px;">No foods added yet.</div>';
    totalsEl.innerHTML = '';
    nutritionCalculateBuilderTotals();
    nutritionUpdateBuilderMacroInputs();
    return;
  }

  listEl.innerHTML = nutritionBuilderState.items.map((item) => {
    let quantityDisplay = `${Math.round(item.grams)}g`;
    if (item.unit === 'whole') {
      quantityDisplay = `${item.displayQuantity} ${item.displayQuantity === 1 ? 'whole' : 'wholes'}`;
    } else if (item.unit === 'tablespoon') {
      quantityDisplay = `${item.displayQuantity} tbsp`;
    }
    
    return `
    <div class="nutrition-builder-item">
      <div>
        <strong>${escapeHtml(item.name)}</strong>
        <small>${item.category === 'carbohydrates' ? 'Carbohydrates' : 'Proteins'}</small>
      </div>
      <div><small>${quantityDisplay}</small></div>
      <div class="nutrition-builder-item-macros">
        <span>${nutritionRound(item.calories)} cal</span>
        <span>P ${nutritionRound(item.protein)}g</span>
        <span>C ${nutritionRound(item.carbs)}g</span>
        <span>F ${nutritionRound(item.fats)}g</span>
      </div>
      <button type="button" class="nutrition-builder-remove" data-builder-remove-id="${item.id}">Remove</button>
    </div>
  `}).join('');

  nutritionCalculateBuilderTotals();
  nutritionUpdateBuilderMacroInputs();
  totalsEl.innerHTML = `
    <div><span>Calories</span><strong>${nutritionBuilderState.totals.calories}</strong></div>
    <div><span>Protein</span><strong>${nutritionBuilderState.totals.protein}g</strong></div>
    <div><span>Carbs</span><strong>${nutritionBuilderState.totals.carbs}g</strong></div>
    <div><span>Fats</span><strong>${nutritionBuilderState.totals.fats}g</strong></div>
  `;
}

function clearNutritionBuilderState() {
  nutritionBuilderState.items = [];
  nutritionCalculateBuilderTotals();
  nutritionUpdateBuilderMacroInputs();
  renderNutritionBuilderList();
}

function nutritionSetMode(modeValue) {
  const mode = modeValue === 'builder' ? 'builder' : 'manual';
  nutritionBuilderState.mode = mode;

  const manualSection = document.getElementById('nutrition-manual-fields');
  const builderSection = document.getElementById('nutrition-builder-fields');
  const caloriesEl = document.getElementById('nutrition-form-calories');
  const proteinEl = document.getElementById('nutrition-form-protein');
  const carbsEl = document.getElementById('nutrition-form-carbs');
  const fatsEl = document.getElementById('nutrition-form-fats');

  if (manualSection) manualSection.classList.toggle('nutrition-collapsed', mode !== 'manual');
  if (builderSection) builderSection.classList.toggle('nutrition-collapsed', mode !== 'builder');

  const manualRequired = mode === 'manual';
  [caloriesEl, proteinEl, carbsEl, fatsEl].forEach((el) => {
    if (!el) return;
    if (manualRequired) {
      el.setAttribute('required', 'required');
      el.readOnly = false;
    } else {
      el.removeAttribute('required');
      el.readOnly = true;
    }
  });

  if (mode === 'builder') {
    nutritionPopulateFoodOptions();
    renderNutritionBuilderList();
  }
}

function addNutritionBuilderItem() {
  const categoryEl = document.getElementById('nutrition-builder-category');
  const foodEl = document.getElementById('nutrition-builder-food');
  const gramsEl = document.getElementById('nutrition-builder-grams');
  if (!categoryEl || !foodEl || !gramsEl) return;

  const category = categoryEl.value || 'carbohydrates';
  const food = nutritionBuilderFindFood(category, foodEl.value);
  if (!food) return;

  let quantity = Math.max(1, parseMacro(gramsEl.value));
  
  // Apply rounding based on unit type
  if (food.unit === 'grams' || !food.unit) {
    // Round to nearest 50g for grams
    quantity = Math.round(quantity / 50) * 50;
    if (quantity === 0) quantity = 50;
  } else if (food.unit === 'whole') {
    // Round to whole number
    quantity = Math.max(1, Math.round(quantity));
  } else if (food.unit === 'tablespoon') {
    // Round to nearest 0.5
    quantity = Math.round(quantity * 2) / 2;
  }

  nutritionBuilderState.items.push(nutritionBuildItemFromFood(food, category, quantity));
  renderNutritionBuilderList();
}

function getGoalAdjustedCalories() {
  const dynamic = Number(profileState?.targetCalories);
  if (Number.isFinite(dynamic) && dynamic > 0) return dynamic;
  return nutritionState.baseGoals.calories;
}

function getWeekStartDate(currentDate) {
  const d = new Date(currentDate);
  const day = d.getDay();
  const diff = d.getDate() - day;
  return new Date(d.setDate(diff));
}

function persistSavedMeals() {
  localStorage.setItem(nutritionSavedMealsStorageKey(), JSON.stringify(nutritionState.savedMeals));
}

function loadSavedMeals() {
  nutritionState.savedMeals = [];
  try {
    const raw = localStorage.getItem(nutritionSavedMealsStorageKey());
    if (!raw) {
      return;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      nutritionState.savedMeals = parsed
        .filter(m => m && typeof m === 'object')
        .map((m) => ({
          ...m,
          meal_type: m.meal_type || m.meal || 'other',
          calories: Math.max(0, Number(m.calories) || 0),
          protein: Math.max(0, Number(m.protein) || 0),
          carbs: Math.max(0, Number(m.carbs) || 0),
          fats: Math.max(0, Number(m.fats) || 0)
        }));
      persistSavedMeals();
    }
  } catch (_err) {
    nutritionState.savedMeals = [];
  }
}

function mealDateKey(entry) {
  const raw = String(entry?.date || '').trim();
  if (!raw) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  if (raw.includes('T')) return raw.split('T')[0];
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return '';
  if (typeof toLocalDateKey === 'function') return toLocalDateKey(parsed);
  const y = parsed.getFullYear();
  const m = String(parsed.getMonth() + 1).padStart(2, '0');
  const d = String(parsed.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function renderNutritionGoals() {
  const goalCalories = getGoalAdjustedCalories();
  const titleEl = document.getElementById('nutrition-goal-title');
  const modeEl = document.getElementById('nutrition-goal-mode-label');
  if (titleEl) {
    if (nutritionState.weightGoal === 'loss') {
      titleEl.textContent = 'Calorie Deficit for Weight Loss';
    } else if (nutritionState.weightGoal === 'gain') {
      titleEl.textContent = 'Calorie Surplus for Weight Gain';
    } else {
      titleEl.textContent = 'Balanced Nutrition for Maintenance';
    }
  }
  if (modeEl) {
    modeEl.textContent = nutritionState.weightGoal === 'loss'
      ? 'Weight Loss'
      : nutritionState.weightGoal === 'gain'
        ? 'Weight Gain'
        : 'Weight Stability';
  }

  const caloriesEl = document.getElementById('nutrition-goal-calories');
  const proteinEl = document.getElementById('nutrition-goal-protein');
  const carbsEl = document.getElementById('nutrition-goal-carbs');
  const fatsEl = document.getElementById('nutrition-goal-fats');
  if (caloriesEl) caloriesEl.textContent = String(goalCalories);
  if (proteinEl) proteinEl.textContent = `${nutritionState.baseGoals.protein}g`;
  if (carbsEl) carbsEl.textContent = `${nutritionState.baseGoals.carbs}g`;
  if (fatsEl) fatsEl.textContent = `${nutritionState.baseGoals.fats}g`;

}

function renderNutritionToday() {
  const today = todayDateKey();
  const todayEntries = nutritionState.entries.filter(e => mealDateKey(e) === today);
  const totals = todayEntries.reduce((acc, e) => ({
    calories: acc.calories + parseMacro(e.calories),
    protein: acc.protein + parseMacro(e.protein),
    carbs: acc.carbs + parseMacro(e.carbs),
    fats: acc.fats + parseMacro(e.fats)
  }), { calories: 0, protein: 0, carbs: 0, fats: 0 });

  const dateEl = document.getElementById('nutrition-today-date');
  if (dateEl) dateEl.textContent = formatDisplayDate(today);
  const calEl = document.getElementById('nutrition-today-calories');
  const proEl = document.getElementById('nutrition-today-protein');
  const carbEl = document.getElementById('nutrition-today-carbs');
  const fatEl = document.getElementById('nutrition-today-fats');
  if (calEl) calEl.textContent = String(Math.round(totals.calories));
  if (proEl) proEl.textContent = `${Math.round(totals.protein)}g`;
  if (carbEl) carbEl.textContent = `${Math.round(totals.carbs)}g`;
  if (fatEl) fatEl.textContent = `${Math.round(totals.fats)}g`;

  const targetCalories = Math.max(0, Number(getGoalAdjustedCalories()) || 0);
  const consumedCalories = Math.max(0, Math.round(totals.calories));
  const calorieProgress = targetCalories > 0 ? Math.max(0, Math.min(100, Math.round((consumedCalories / targetCalories) * 100))) : 0;
  const proteinProgress = nutritionState.baseGoals.protein > 0
    ? Math.max(0, Math.min(100, Math.round((Math.max(0, totals.protein) / nutritionState.baseGoals.protein) * 100)))
    : 0;
  const carbsProgress = nutritionState.baseGoals.carbs > 0
    ? Math.max(0, Math.min(100, Math.round((Math.max(0, totals.carbs) / nutritionState.baseGoals.carbs) * 100)))
    : 0;
  const fatsProgress = nutritionState.baseGoals.fats > 0
    ? Math.max(0, Math.min(100, Math.round((Math.max(0, totals.fats) / nutritionState.baseGoals.fats) * 100)))
    : 0;

  const calorieFillEl = document.getElementById('nutrition-calorie-progress-fill');
  const proteinFillEl = document.getElementById('nutrition-protein-progress-fill');
  const carbsFillEl = document.getElementById('nutrition-carbs-progress-fill');
  const fatsFillEl = document.getElementById('nutrition-fats-progress-fill');

  if (calorieFillEl) calorieFillEl.style.width = `${calorieProgress}%`;
  if (proteinFillEl) proteinFillEl.style.width = `${proteinProgress}%`;
  if (carbsFillEl) carbsFillEl.style.width = `${carbsProgress}%`;
  if (fatsFillEl) fatsFillEl.style.width = `${fatsProgress}%`;
}

function renderNutritionWeek() {
  const today = new Date(todayDateKey());
  const weekStart = getWeekStartDate(today);
  const thisWeekEntries = nutritionState.entries.filter((e) => {
    const key = mealDateKey(e);
    if (!key) return false;
    const parsed = new Date(`${key}T00:00:00`);
    return !Number.isNaN(parsed.getTime()) && parsed >= weekStart;
  });
  const thisWeekTotals = thisWeekEntries.reduce((acc, e) => ({
    calories: acc.calories + parseMacro(e.calories),
    protein: acc.protein + parseMacro(e.protein),
    carbs: acc.carbs + parseMacro(e.carbs),
    fats: acc.fats + parseMacro(e.fats)
  }), { calories: 0, protein: 0, carbs: 0, fats: 0 });

  const days = new Set(thisWeekEntries.map(mealDateKey).filter(Boolean)).size;
  const avgCalories = days > 0 ? Math.round(thisWeekTotals.calories / days) : 0;
  const goalCalories = getGoalAdjustedCalories();
  const weeklyGoalCalories = goalCalories * 7;
  const weeklyDiff = Math.round(thisWeekTotals.calories - weeklyGoalCalories);

  const onTrack = nutritionState.weightGoal === 'loss'
    ? weeklyDiff <= 0
    : nutritionState.weightGoal === 'gain'
      ? weeklyDiff >= 0
      : Math.abs(weeklyDiff) <= 500;

  const goalTypeEl = document.getElementById('nutrition-week-goal-type');
  const avgEl = document.getElementById('nutrition-week-avg-cal');
  const targetEl = document.getElementById('nutrition-week-target');
  const diffEl = document.getElementById('nutrition-week-diff');
  const noteEl = document.getElementById('nutrition-week-note');
  const badgeEl = document.getElementById('nutrition-week-track-badge');

  if (goalTypeEl) {
    goalTypeEl.textContent = nutritionState.weightGoal === 'loss'
      ? 'Weight Loss'
      : nutritionState.weightGoal === 'gain'
        ? 'Weight Gain'
        : 'Maintain Weight';
  }

  if (avgEl) avgEl.textContent = `${avgCalories} cal`;
  if (targetEl) targetEl.textContent = `Target: ${goalCalories} cal/day`;
  if (diffEl) diffEl.textContent = `${weeklyDiff > 0 ? '+' : ''}${weeklyDiff} cal`;
  if (noteEl) {
    noteEl.textContent = nutritionState.weightGoal === 'loss'
      ? (weeklyDiff <= 0 ? 'Deficit maintained!' : 'Reduce intake')
      : nutritionState.weightGoal === 'gain'
        ? (weeklyDiff >= 0 ? 'Surplus achieved!' : 'Increase intake')
        : (Math.abs(weeklyDiff) <= 500 ? 'Balanced intake' : 'Adjust intake');
  }

  if (badgeEl) {
    badgeEl.textContent = onTrack ? 'On Track' : 'Adjust Intake';
    badgeEl.classList.toggle('off', !onTrack);
  }
}

function renderSavedMeals() {
  const section = document.getElementById('nutrition-saved-meals-section');
  const grid = document.getElementById('nutrition-saved-meals-grid');
  if (!section || !grid) return;

  section.classList.toggle('nutrition-collapsed', !nutritionState.showSavedMeals);
  if (!nutritionState.showSavedMeals) return;

  if (nutritionState.savedMeals.length === 0) {
    grid.innerHTML = '<div class="nutrition-empty">No saved meals yet. Save a meal from the form.</div>';
    return;
  }

  const orderedTypes = ['breakfast', 'lunch', 'dinner', 'snack'];
  if (!orderedTypes.includes(nutritionState.activeMealType)) {
    nutritionState.activeMealType = 'breakfast';
  }

  const byType = orderedTypes.reduce((acc, type) => {
    acc[type] = nutritionState.savedMeals.filter((m) => {
      const mealType = String(m.meal_type || m.meal || '').toLowerCase();
      return mealType === type;
    });
    return acc;
  }, {});

  const activeType = nutritionState.activeMealType;
  const activeItems = byType[activeType] || [];
  const tabsHtml = orderedTypes.map((type) => {
    const isActive = activeType === type;
    return `
      <button
        class="nutrition-saved-tab ${isActive ? 'is-active' : ''}"
        type="button"
        data-meal-tab="${type}"
        aria-selected="${isActive ? 'true' : 'false'}"
        role="tab"
      >
        ${normalizeMealType(type)}
      </button>
    `;
  }).join('');

  const itemsHtml = activeItems.map((m) => {
    return `
      <div class="nutrition-saved-item">
        <div class="nutrition-saved-head">
          <h4>${escapeHtml(m.name)}</h4>
          <button class="nutrition-delete-saved" data-id="${m.id}" title="Delete saved meal">
            <i class="fas fa-trash-alt"></i>
          </button>
        </div>
        <span class="nutrition-pill">${normalizeMealType(m.meal_type)}</span>
        <div class="nutrition-saved-macros">
          <span class="cal"><i class="fas fa-fire"></i> ${Math.round(m.calories)} cal</span>
          <span class="protein">${Math.round(m.protein)}g protein</span>
          <span class="carbs">${Math.round(m.carbs)}g carbs</span>
          <span class="fats">${Math.round(m.fats)}g fats</span>
        </div>
        <button class="nutrition-use-saved" data-use-id="${m.id}">Use this meal</button>
      </div>
    `;
  }).join('');

  const emptyTypeHtml = `<div class="nutrition-empty">No saved ${normalizeMealType(activeType).toLowerCase()} meals yet.</div>`;
  grid.innerHTML = `
    <div class="nutrition-saved-tabs" role="tablist" aria-label="Saved meal types">
      ${tabsHtml}
    </div>
    <div class="nutrition-saved-content" data-active-meal-content="${activeType}">
      ${itemsHtml || emptyTypeHtml}
    </div>
  `;
}

function renderNutritionHistory() {
  const list = document.getElementById('nutrition-history-list');
  if (!list) return;

  const today = todayDateKey();
  const sorted = nutritionState.entries
    .filter(entry => mealDateKey(entry) === today)
    .sort((a, b) => {
    const ad = `${a.date || ''} ${a.time || ''}`;
    const bd = `${b.date || ''} ${b.time || ''}`;
    return bd.localeCompare(ad);
    });

  if (sorted.length === 0) {
    list.innerHTML = '<div class="nutrition-empty" style="margin-top: 10px;">No meals logged today yet.</div>';
    return;
  }

  list.innerHTML = sorted.map(entry => `
    <div class="nutrition-history-item">
      <div class="nutrition-history-head">
        <span class="nutrition-pill">${normalizeMealType(entry.meal_type)}</span>
        <button class="nutrition-history-delete" data-history-delete-id="${entry.id}" title="Delete meal" aria-label="Delete meal">
          <i class="fas fa-trash-alt"></i>
        </button>
      </div>
      <div class="nutrition-history-food">${escapeHtml(entry.name)}</div>
      <div class="nutrition-history-time">${escapeHtml(entry.time || '--:--')} - ${escapeHtml(entry.date || '')}</div>
      <div class="nutrition-history-macros">
        <span class="cal"><i class="fas fa-fire"></i> ${Math.round(parseMacro(entry.calories))} cal</span>
        <span class="protein">${Math.round(parseMacro(entry.protein))}g protein</span>
        <span class="carbs">${Math.round(parseMacro(entry.carbs))}g carbs</span>
        <span class="fats">${Math.round(parseMacro(entry.fats))}g fats</span>
      </div>
    </div>
  `).join('');
}

async function deleteMealEntry(mealId) {
  const idNum = Number(mealId);
  if (!Number.isFinite(idNum) || idNum <= 0) return;

  try {
    const response = await fetch(`/api/meals/${idNum}`, { credentials: 'same-origin', method: 'DELETE'});
    if (!response.ok) throw new Error(`API error: ${response.status}`);
    await loadMeals();
  } catch (err) {
    console.error('Error deleting meal:', err);
    alert('Could not delete meal right now.');
  }
}

// ---------------------------------------------------------------------------
// AI Meal Logger " 2-Step Confirmation Flow (USDA-powered)
// ---------------------------------------------------------------------------

let aiMealPanelOpen = false;
let aiDetectedData = null; // Holds Step 1 detection result for Step 2

function toggleAIMealLog() {
  aiMealPanelOpen = !aiMealPanelOpen;
  const panel = document.getElementById('nutrition-ai-panel');
  if (!panel) return;
  panel.classList.toggle('nutrition-collapsed', !aiMealPanelOpen);

  // Reset all sub-sections
  _aiResetPanel();

  if (aiMealPanelOpen) {
    const input = document.getElementById('ai-food-input');
    if (input) setTimeout(() => input.focus(), 100);
  }
}

function _aiResetPanel() {
  const status = document.getElementById('ai-meal-status');
  const confirm = document.getElementById('ai-step-confirm');
  const result = document.getElementById('ai-meal-result');
  const inputStep = document.getElementById('ai-step-input');

  if (status) { status.classList.add('nutrition-collapsed'); status.innerHTML = ''; }
  if (confirm) { confirm.classList.add('nutrition-collapsed'); }
  if (result) { result.classList.add('nutrition-collapsed'); result.innerHTML = ''; }
  if (inputStep) { inputStep.classList.remove('nutrition-collapsed'); }
  aiDetectedData = null;
}

// ---- STEP 1: Detect Foods ----

async function submitAIDetect() {
  const input = document.getElementById('ai-food-input');
  const mealTypeSelect = document.getElementById('ai-meal-type');
  const statusEl = document.getElementById('ai-meal-status');
  const detectBtn = document.getElementById('ai-detect-btn');

  const userInput = (input?.value || '').trim();
  const mealType = mealTypeSelect?.value || 'other';

  if (!userInput) {
    if (input) input.focus();
    return;
  }

  // Show loading
  statusEl.className = 'nutrition-ai-status loading';
  statusEl.classList.remove('nutrition-collapsed');
  statusEl.innerHTML = '<span class="ai-spinner"></span> Detecting foods via USDA database...';
  if (detectBtn) detectBtn.disabled = true;

  try {
    let data;
    const response = await fetch('/api/nutrition/ai-detect', { credentials: 'same-origin', method: 'POST',
      headers: { 'Content-Type': 'application/json'},
      body: JSON.stringify({ user_input: userInput, meal_type: mealType })
    });
    data = await response.json();
    if (!response.ok) throw new Error(data.error || `API error: ${response.status}`);

    const itemCount = (data.items || []).length;
    if (itemCount === 0 && data.status !== 'confirm') {
      statusEl.className = 'nutrition-ai-status error';
      const reason = data.clarifications?.[0]?.reason || data.error || 'No foods found. Try being more specific.';
      statusEl.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${escapeHtml(reason)}`;
      return;
    }

    // Save detection data and show confirmation table
    aiDetectedData = data;
    statusEl.classList.add('nutrition-collapsed');
    statusEl.innerHTML = '';
    renderAIConfirmation(data);

  } catch (err) {
    console.error('AI detect error:', err);
    statusEl.className = 'nutrition-ai-status error';
    statusEl.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${err.message || 'Could not detect foods. Please try again.'}`;
  } finally {
    if (detectBtn) detectBtn.disabled = false;
  }
}

// ---- Render Confirmation Table ----

function renderAIConfirmation(data) {
  const inputStep = document.getElementById('ai-step-input');
  const confirmStep = document.getElementById('ai-step-confirm');
  const tableWrap = document.getElementById('ai-confirm-table-wrap');
  const clarifyEl = document.getElementById('ai-confirm-clarifications');

  // Hide input, show confirmation
  if (inputStep) inputStep.classList.add('nutrition-collapsed');
  if (confirmStep) confirmStep.classList.remove('nutrition-collapsed');

  const items = data.items || [];

  let html = `<table class="nutrition-ai-result-table ai-confirm-table">
    <thead>
      <tr>
        <th>Your Input</th>
        <th>USDA Match</th>
        <th>Confidence</th>
        <th>Qty (g)</th>
        <th>Calories</th>
        <th>Protein</th>
        <th>Carbs</th>
        <th>Fats</th>
        <th></th>
      </tr>
    </thead>
    <tbody>`;

  items.forEach((item, idx) => {
    const confClass = item.confidence === 'high' ? 'ai-conf-high' : item.confidence === 'medium' ? 'ai-conf-med' : 'ai-conf-low';
    const confIcon = item.confidence === 'high' ? 'check-circle' : item.confidence === 'medium' ? 'info-circle' : 'exclamation-triangle';
    html += `
      <tr id="ai-item-row-${idx}" data-idx="${idx}">
        <td class="ai-cell-input">${escapeHtml(item.original_input)}</td>
        <td class="ai-cell-match">${escapeHtml(item.matched_name)}${item.note ? `<br><small class="ai-food-note">${escapeHtml(item.note)}</small>` : ''}</td>
        <td><span class="ai-conf-badge ${confClass}"><i class="fas fa-${confIcon}"></i> ${item.confidence}</span></td>
        <td><input type="number" class="ai-qty-input" value="${item.quantity_g}" min="1" step="1" onchange="updateAIItemMacros(${idx}, this.value)" data-per100='${JSON.stringify(item.per_100g || {})}'/></td>
        <td class="ai-cal">${item.calories}</td>
        <td class="ai-prot">${item.protein}g</td>
        <td class="ai-carb">${item.carbs}g</td>
        <td class="ai-fat">${item.fats}g</td>
        <td><button class="ai-remove-btn" onclick="removeAIItem(${idx})" title="Remove"><i class="fas fa-times"></i></button></td>
      </tr>`;
  });

  html += '</tbody></table>';
  if (tableWrap) tableWrap.innerHTML = html;

  // Show clarifications if any
  if (data.clarifications && data.clarifications.length > 0 && clarifyEl) {
    let clarifyHTML = '<div class="ai-clarify-list">';
    for (const c of data.clarifications) {
      clarifyHTML += `<p class="ai-clarify-item"><i class="fas fa-question-circle"></i> <strong>${escapeHtml(c.original_input)}</strong>: ${escapeHtml(c.reason)}</p>`;
    }
    clarifyHTML += '</div>';
    clarifyEl.innerHTML = clarifyHTML;
    clarifyEl.classList.remove('nutrition-collapsed');
  } else if (clarifyEl) {
    clarifyEl.classList.add('nutrition-collapsed');
    clarifyEl.innerHTML = '';
  }

  updateAITotals();
}

function updateAIItemMacros(idx, newQtyG) {
  if (!aiDetectedData || !aiDetectedData.items[idx]) return;
  const item = aiDetectedData.items[idx];
  const qty = parseFloat(newQtyG) || 0;
  const per100 = item.per_100g || {};
  const factor = qty / 100;

  item.quantity_g = Math.round(qty * 10) / 10;
  item.calories = Math.round((per100.calories || 0) * factor * 10) / 10;
  item.protein = Math.round((per100.protein || 0) * factor * 10) / 10;
  item.carbs = Math.round((per100.carbs || 0) * factor * 10) / 10;
  item.fats = Math.round((per100.fats || 0) * factor * 10) / 10;

  // Update row cells
  const row = document.getElementById(`ai-item-row-${idx}`);
  if (row) {
    row.querySelector('.ai-cal').textContent = item.calories;
    row.querySelector('.ai-prot').textContent = item.protein + 'g';
    row.querySelector('.ai-carb').textContent = item.carbs + 'g';
    row.querySelector('.ai-fat').textContent = item.fats + 'g';
  }
  updateAITotals();
}

function removeAIItem(idx) {
  if (!aiDetectedData) return;
  aiDetectedData.items.splice(idx, 1);
  // Re-render entire confirmation (indexes shifted)
  renderAIConfirmation(aiDetectedData);
}

function updateAITotals() {
  if (!aiDetectedData) return;
  const items = aiDetectedData.items || [];
  const totals = {
    calories: items.reduce((s, f) => s + (f.calories || 0), 0),
    protein: items.reduce((s, f) => s + (f.protein || 0), 0),
    carbs: items.reduce((s, f) => s + (f.carbs || 0), 0),
    fats: items.reduce((s, f) => s + (f.fats || 0), 0),
  };
  const el = document.getElementById('ai-confirm-totals');
  if (el) {
    el.innerHTML = `
      <div class="ai-totals-grid">
        <div class="ai-total-item"><span>Total Calories</span><strong>${Math.round(totals.calories)}</strong></div>
        <div class="ai-total-item"><span>Protein</span><strong>${Math.round(totals.protein * 10) / 10}g</strong></div>
        <div class="ai-total-item"><span>Carbs</span><strong>${Math.round(totals.carbs * 10) / 10}g</strong></div>
        <div class="ai-total-item"><span>Fats</span><strong>${Math.round(totals.fats * 10) / 10}g</strong></div>
      </div>
      <p class="ai-result-note"><i class="fas fa-database"></i> Data sourced from USDA FoodData Central</p>`;
  }
}

// ---- STEP 2: Confirm & Log ----

async function confirmAIMealLog() {
  if (!aiDetectedData || !aiDetectedData.items || aiDetectedData.items.length === 0) return;

  const statusEl = document.getElementById('ai-meal-status');
  const confirmBtn = document.getElementById('ai-confirm-btn');
  const mealType = aiDetectedData.meal_type || 'other';

  statusEl.className = 'nutrition-ai-status loading';
  statusEl.classList.remove('nutrition-collapsed');
  statusEl.innerHTML = '<span class="ai-spinner"></span> Logging confirmed foods...';
  if (confirmBtn) confirmBtn.disabled = true;

  try {
    const confirmedFoods = aiDetectedData.items.map(item => ({
      name: item.matched_name,
      fdc_id: item.fdc_id,
      quantity_g: item.quantity_g,
      calories: item.calories,
      protein: item.protein,
      carbs: item.carbs,
      fats: item.fats,
      original_input: item.original_input,
      data_type: item.data_type || ''
    }));

    let savedCount = 0;

    const response = await fetch('/api/nutrition/ai-log', { credentials: 'same-origin', method: 'POST',
      headers: { 'Content-Type': 'application/json'},
      body: JSON.stringify({
        meal_type: mealType,
        foods: confirmedFoods,
        date: todayDateKey(),
        time: new Date().toTimeString().slice(0, 5)
      })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || `API error: ${response.status}`);
    savedCount = (data.foods || []).length;

    // Show success
    const totalCals = Math.round(confirmedFoods.reduce((s, f) => s + (f.calories || 0), 0));
    const confirmStep = document.getElementById('ai-step-confirm');
    const resultEl = document.getElementById('ai-meal-result');

    if (confirmStep) confirmStep.classList.add('nutrition-collapsed');

    statusEl.className = 'nutrition-ai-status success';
    statusEl.innerHTML = `<i class="fas fa-check-circle"></i> Successfully logged ${savedCount} food item${savedCount > 1 ? 's' : ''} " ${totalCals} kcal total`;

    // Show summary table in result
    let tableHTML = `<table class="nutrition-ai-result-table"><thead><tr>
      <th>Food</th><th>Qty (g)</th><th>Calories</th><th>Protein</th><th>Carbs</th><th>Fats</th>
    </tr></thead><tbody>`;
    for (const f of confirmedFoods) {
      tableHTML += `<tr><td>${escapeHtml(f.name)}</td><td>${f.quantity_g}</td><td>${Math.round(f.calories)}</td><td>${Math.round(f.protein * 10) / 10}g</td><td>${Math.round(f.carbs * 10) / 10}g</td><td>${Math.round(f.fats * 10) / 10}g</td></tr>`;
    }
    tableHTML += `</tbody><tfoot><tr><td colspan="2"><strong>Total</strong></td>
      <td><strong>${totalCals}</strong></td>
      <td><strong>${Math.round(confirmedFoods.reduce((s,f)=>s+f.protein,0)*10)/10}g</strong></td>
      <td><strong>${Math.round(confirmedFoods.reduce((s,f)=>s+f.carbs,0)*10)/10}g</strong></td>
      <td><strong>${Math.round(confirmedFoods.reduce((s,f)=>s+f.fats,0)*10)/10}g</strong></td>
    </tr></tfoot></table>`;

    if (resultEl) { resultEl.innerHTML = tableHTML; resultEl.classList.remove('nutrition-collapsed'); }

    // Clear input and refresh
    const input = document.getElementById('ai-food-input');
    if (input) input.value = '';
    aiDetectedData = null;
    await loadMeals();

  } catch (err) {
    console.error('AI confirm log error:', err);
    statusEl.className = 'nutrition-ai-status error';
    statusEl.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${err.message || 'Could not log foods. Please try again.'}`;
  } finally {
    if (confirmBtn) confirmBtn.disabled = false;
  }
}

function cancelAIConfirm() {
  const inputStep = document.getElementById('ai-step-input');
  const confirmStep = document.getElementById('ai-step-confirm');
  const statusEl = document.getElementById('ai-meal-status');

  if (confirmStep) confirmStep.classList.add('nutrition-collapsed');
  if (inputStep) inputStep.classList.remove('nutrition-collapsed');
  if (statusEl) { statusEl.classList.add('nutrition-collapsed'); statusEl.innerHTML = ''; }
  aiDetectedData = null;

  const input = document.getElementById('ai-food-input');
  if (input) setTimeout(() => input.focus(), 100);
}

document.addEventListener('DOMContentLoaded', function() {
  const aiInput = document.getElementById('ai-food-input');
  if (aiInput) {
    aiInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        submitAIDetect();
      }
    });
  }
});

function renderNutritionFormVisibility() {
  const formSection = document.getElementById('nutrition-form-section');
  if (!formSection) return;
  formSection.classList.toggle('nutrition-collapsed', !nutritionState.showForm);
}

function renderNutritionUI() {
  renderNutritionGoals();
  renderNutritionToday();
  renderNutritionWeek();
  renderSavedMeals();
  renderNutritionFormVisibility();
  renderNutritionHistory();
}

async function loadMeals() {
  const requestId = ++mealsLoadRequestId;
  try {
    let meals;
    const response = await fetch('/api/meals', { credentials: 'same-origin' });
    if (!response.ok) throw new Error('Failed to load meals');
    meals = await response.json();
    if (requestId !== mealsLoadRequestId) return;
    nutritionState.entries = Array.isArray(meals) ? meals : [];
  } catch (err) {
    console.error('Error loading meals:', err);
    if (requestId !== mealsLoadRequestId) return;
    nutritionState.entries = [];
  }
  renderNutritionUI();
  refreshDashboardMetrics();
  updateStatisticsForActiveUser();
  renderStatistics();
  refreshStreaksAfterChange();
  if (typeof syncToAppState === 'function') syncToAppState('meals');
}
function resetNutritionForm() {
  const form = document.getElementById('nutrition-form');
  if (form) form.reset();
  clearNutritionBuilderState();
  nutritionSetMode('manual');
}

async function submitNutritionForm(e) {
  e.preventDefault();
  if (!updateNutritionAccessState()) return;

  const mealType = document.getElementById('nutrition-form-meal')?.value || 'other';
  const mode = document.getElementById('nutrition-form-mode')?.value || 'manual';
  let food = (document.getElementById('nutrition-form-food')?.value || '').trim();
  let calories = parseMacro(document.getElementById('nutrition-form-calories')?.value);
  let protein = parseMacro(document.getElementById('nutrition-form-protein')?.value);
  let carbs = parseMacro(document.getElementById('nutrition-form-carbs')?.value);
  let fats = parseMacro(document.getElementById('nutrition-form-fats')?.value);

  if (mode === 'builder') {
    if (nutritionBuilderState.items.length === 0) {
      alert('Add at least one food item before saving the meal.');
      return;
    }
    nutritionCalculateBuilderTotals();
    calories = nutritionBuilderState.totals.calories;
    protein = nutritionBuilderState.totals.protein;
    carbs = nutritionBuilderState.totals.carbs;
    fats = nutritionBuilderState.totals.fats;
  }

  if (!food) {
    alert('Add a food name for this meal.');
    return;
  }

  try {
    const mealData = {
      name: food,
      meal_type: mealType,
      calories: Math.max(0, Number(calories) || 0),
      protein: Math.max(0, Number(protein) || 0),
      carbs: Math.max(0, Number(carbs) || 0),
      fats: Math.max(0, Number(fats) || 0),
      date: todayDateKey(),
      time: new Date().toTimeString().slice(0, 5)
    };

1

    const response = await fetch('/api/meals', { credentials: 'same-origin', method: 'POST',
      headers: { 'Content-Type': 'application/json'},
      body: JSON.stringify(mealData)
    });

    if (!response.ok) throw new Error(`API error: ${response.status}`);
    await loadMeals();
    resetNutritionForm();
    nutritionState.showForm = false;
    renderNutritionFormVisibility();
  } catch (err) {
    console.error('Error creating meal:', err);
    alert('Could not add meal right now.');
  }
}
function saveCurrentMealPreset() {
  if (!updateNutritionAccessState()) return;
  const mealType = document.getElementById('nutrition-form-meal')?.value || 'other';
  const mode = document.getElementById('nutrition-form-mode')?.value || 'manual';
  let food = (document.getElementById('nutrition-form-food')?.value || '').trim();
  let calories = parseMacro(document.getElementById('nutrition-form-calories')?.value);
  let protein = parseMacro(document.getElementById('nutrition-form-protein')?.value);
  let carbs = parseMacro(document.getElementById('nutrition-form-carbs')?.value);
  let fats = parseMacro(document.getElementById('nutrition-form-fats')?.value);

  if (mode === 'builder') {
    if (nutritionBuilderState.items.length === 0) {
      alert('Add foods first to save this built meal.');
      return;
    }
    nutritionCalculateBuilderTotals();
    calories = nutritionBuilderState.totals.calories;
    protein = nutritionBuilderState.totals.protein;
    carbs = nutritionBuilderState.totals.carbs;
    fats = nutritionBuilderState.totals.fats;
  }

  if (!food || calories <= 0) {
    alert('Add meal name and macros before saving.');
    return;
  }

  const meal = {
    id: Date.now(),
    name: food,
    meal_type: mealType,
    calories: Math.max(0, Number(calories) || 0),
    protein: Math.max(0, Number(protein) || 0),
    carbs: Math.max(0, Number(carbs) || 0),
    fats: Math.max(0, Number(fats) || 0)
  };
  nutritionState.savedMeals = [meal, ...nutritionState.savedMeals];
  persistSavedMeals();
  renderSavedMeals();
}

async function useSavedMeal(savedId) {
  if (!updateNutritionAccessState()) return;
  const meal = nutritionState.savedMeals.find(m => String(m.id) === String(savedId));
  if (!meal) return;

  const mealData = {
    name: meal.name || 'Saved meal',
    meal_type: meal.meal_type || meal.meal || 'other',
    calories: Math.max(0, Number(meal.calories) || 0),
    protein: Math.max(0, Number(meal.protein) || 0),
    carbs: Math.max(0, Number(meal.carbs) || 0),
    fats: Math.max(0, Number(meal.fats) || 0),
    date: todayDateKey(),
    time: new Date().toTimeString().slice(0, 5)
  };

  try {
    const response = await fetch('/api/meals', { credentials: 'same-origin', method: 'POST',
      headers: { 'Content-Type': 'application/json'},
      body: JSON.stringify(mealData)
    });
    if (!response.ok) throw new Error(`API error: ${response.status}`);

    await loadMeals();
  } catch (err) {
    console.error('Error using saved meal:', err);
    alert('Could not add saved meal right now.');
  }
}

function deleteSavedMeal(savedId) {
  nutritionState.savedMeals = nutritionState.savedMeals.filter(m => String(m.id) !== String(savedId));
  persistSavedMeals();
  renderSavedMeals();
}

function setupNutrition() {
  if (!document.getElementById('nutrition')) return;

  loadSavedMeals();
  syncNutritionGoalWithProfile();
  updateNutritionAccessState();

  const toggleSavedBtn = document.getElementById('nutrition-toggle-saved-btn');
  const toggleFormBtn = document.getElementById('nutrition-toggle-form-btn');
  const cancelFormBtn = document.getElementById('nutrition-cancel-form-btn');
  const saveMealBtn = document.getElementById('nutrition-save-meal-btn');
  const nutritionForm = document.getElementById('nutrition-form');
  const savedGrid = document.getElementById('nutrition-saved-meals-grid');
  const historyList = document.getElementById('nutrition-history-list');
  const modeEl = document.getElementById('nutrition-form-mode');
  const builderCategoryEl = document.getElementById('nutrition-builder-category');
  const builderAddBtn = document.getElementById('nutrition-builder-add-btn');
  const builderList = document.getElementById('nutrition-builder-list');

  if (toggleSavedBtn) {
    toggleSavedBtn.addEventListener('click', () => {
      nutritionState.showSavedMeals = !nutritionState.showSavedMeals;
      renderSavedMeals();
    });
  }

  if (toggleFormBtn) {
    toggleFormBtn.addEventListener('click', () => {
      if (!updateNutritionAccessState()) return;
      nutritionState.showForm = !nutritionState.showForm;
      renderNutritionFormVisibility();
    });
  }

  if (cancelFormBtn) {
    cancelFormBtn.addEventListener('click', () => {
      nutritionState.showForm = false;
      renderNutritionFormVisibility();
    });
  }

  if (saveMealBtn) {
    saveMealBtn.addEventListener('click', saveCurrentMealPreset);
  }

  if (modeEl) {
    modeEl.addEventListener('change', (e) => {
      nutritionSetMode(e.target.value);
    });
  }

  if (builderCategoryEl) {
    builderCategoryEl.addEventListener('change', nutritionPopulateFoodOptions);
  }

  const builderFoodEl = document.getElementById('nutrition-builder-food');
  if (builderFoodEl) {
    builderFoodEl.addEventListener('change', nutritionUpdateQuantityLabel);
  }

  if (builderAddBtn) {
    builderAddBtn.addEventListener('click', addNutritionBuilderItem);
  }

  if (builderList) {
    builderList.addEventListener('click', (e) => {
      const removeBtn = e.target.closest?.('[data-builder-remove-id]');
      if (!removeBtn) return;
      const removeId = removeBtn.getAttribute('data-builder-remove-id');
      nutritionBuilderState.items = nutritionBuilderState.items.filter(item => item.id !== removeId);
      renderNutritionBuilderList();
    });
  }

  if (nutritionForm) {
    nutritionForm.addEventListener('submit', submitNutritionForm);
  }

  if (savedGrid) {
    savedGrid.addEventListener('click', (e) => {
      const target = e.target;
      const tabBtn = target.closest?.('[data-meal-tab]');
      const deleteBtn = target.closest?.('[data-id]');
      const useBtn = target.closest?.('[data-use-id]');
      if (tabBtn) {
        const mealType = String(tabBtn.getAttribute('data-meal-tab') || '').toLowerCase();
        if (mealType) {
          nutritionState.activeMealType = mealType;
        }
        renderSavedMeals();
      } else if (deleteBtn) {
        deleteSavedMeal(deleteBtn.getAttribute('data-id'));
      } else if (useBtn) {
        useSavedMeal(useBtn.getAttribute('data-use-id'));
      }
    });
  }

  if (historyList) {
    historyList.addEventListener('click', (e) => {
      const target = e.target;
      const deleteBtn = target.closest?.('[data-history-delete-id]');
      if (!deleteBtn) return;
      deleteMealEntry(deleteBtn.getAttribute('data-history-delete-id'));
    });
  }

  nutritionPopulateFoodOptions();
  nutritionSetMode(modeEl?.value || 'manual');
  renderNutritionBuilderList();
  renderNutritionUI();
  updateNutritionAccessState();
  loadMeals();
}

// ========================================================================
// Â§8  DASHBOARD EXPERIENCE
// ========================================================================
// Summary cards (tasks today, workouts, nutrition), floating timer,
// configurable quick-action buttons, workout/nutrition metric rendering.
// âš ï¸ Global mutable: dashboardState (timer state, goals, quick actions)
// âš ï¸ Timer interval is cleaned up on beforeunload.
// âš ï¸ Depends on: /api/analytics/summary, /api/workouts

const dashboardState = {
  timerRunning: false,
  timerSeconds: 0,
  timerInterval: null,
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
  return !!activeFeaturePrefs[featureKey];
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
    const summaryRes = await fetch('/api/analytics/summary', { credentials: 'same-origin' });
    const workoutsRes = await fetch('/api/workouts', { credentials: 'same-origin' });
    if (!summaryRes.ok || !workoutsRes.ok) return;
    summary = await summaryRes.json();
    workouts = await workoutsRes.json();
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

// ========================================================================
// Â§9  STREAKS & POINTS ENGINE (Client-Side)
// ========================================================================
// Points calculation, streak evaluation, achievements, XP/level system.
// âš ï¸ DUPLICATED CONSTANTS: STREAK_TASK_POINTS, caps, and bonuses are
//    also defined in app/points_engine.py. Changes must be synced.
// âš ï¸ Global mutable: _streakEvalSeq (stale-render guard)
// âš ï¸ Achievement definitions (STREAK_ACHIEVEMENTS_DEF) are client-only;
//    the backend has its own check_achievements() in points_engine.py.
// Also includes streak animation/entry-effect code.

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
  return _userKeyPrefix(STREAK_CACHE_KEY_BASE);
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
  } catch (_e) { /* quota exceeded " non-critical */ }
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
    const tDate = t.date || '';
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
  const tasks = (taskUiState.tasks || []);
  const meals = (nutritionState.entries || []);
  const rawWorkouts = (workoutState.workouts || []);
  const workouts = rawWorkouts.map(w => ({
    ...w,
    completed: w.completed !== undefined ? !!w.completed : !!workoutMeta(w.id).completed,
  }));
  const proteinGoal = nutritionState.baseGoals.protein || 140;

  // Collect all unique dates from tasks, meals, workouts
  const dateSet = new Set();
  for (const t of tasks) {
    const d = t.date || '';
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
  console.log(`[Streak Eval] âœ“ Total points across all dates: ${totalPoints}`);

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
    await fetch('/api/streaks/evaluate', { credentials: 'same-origin', method: 'POST',
      headers: { 'Content-Type': 'application/json'},
      body: JSON.stringify({ protein_goal: proteinGoal }),
    });
    // Then fetch progress
    const res = await fetch(`/api/streaks/progress?protein_goal=${proteinGoal}`, { credentials: 'same-origin' });
    if (!res.ok) throw new Error('Failed to fetch streaks progress');
    const data = await res.json();
    // Normalize server snake_case keys â†’ camelCase for renderStreaksUI
    if (data && data.day) data.day = _normalizeDayEval(data.day);
    return data;
  } catch (err) {
    console.error('Streaks API fetch failed:', err);
    return null;
  }
}

/**
 * Main evaluation dispatcher " returns same shape for demo and API mode.
 */
async function evaluateStreaksAndPoints() {
  const seq = ++_streakEvalSeq;
  let result;
  const apiData = await streakFetchFromApi();
  result = apiData || streakFullEvalDemo();
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
      ? '\u2705 Auto-pass " no workouts scheduled today'
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
  if (!cached) {
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
    if (result) {
      renderStreaksUI(result);
      if (typeof syncStreakResult === 'function') syncStreakResult(result);
    }
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

// ========================================================================
// Â§10  PROJECTS EXPERIENCE
// ========================================================================
// Client-side project management with columns and tasks.
// âš ï¸ 100% localStorage " NO backend API. Projects are invisible to server.
// âš ï¸ Global mutable: projectsState (projects array, active timer)
// âš ï¸ Project timer (activeTimer/timerId) is independent of dashboard timer.

const PROJECTS_STORAGE_KEY_BASE = 'fittrack_projects_v2';
const PROJECT_THEMES = ['blue', 'green', 'purple', 'orange', 'rose', 'indigo'];
function projectsStorageKey() {
  return _userKeyPrefix(PROJECTS_STORAGE_KEY_BASE);
}
const projectsState = {
  projects: [],
  showCreate: false,
  taskFormProjectId: null,
  subtaskFormKey: null,
  activeTimer: null,
  timerId: null
};

function defaultProjects() {
  return [
    {
      id: 1,
      name: 'Fitness App Development',
      description: 'Build a comprehensive fitness tracking application',
      theme: 'blue',
      totalTime: 18000,
      expanded: true,
      tasks: [
        {
          id: 11,
          title: 'Design UI mockups',
          completed: true,
          timeSpent: 7200,
          isTracking: false,
          expanded: false,
          subtasks: [
            { id: 111, title: 'Home screen design', completed: true },
            { id: 112, title: 'Profile page design', completed: true }
          ]
        },
        {
          id: 12,
          title: 'Implement authentication',
          completed: false,
          timeSpent: 5400,
          isTracking: false,
          expanded: true,
          subtasks: [
            { id: 121, title: 'Login page', completed: true },
            { id: 122, title: 'Sign up page', completed: false },
            { id: 123, title: 'Password reset', completed: false }
          ]
        }
      ]
    },
    {
      id: 2,
      name: 'Personal Training Course',
      description: 'Complete online certification program',
      theme: 'green',
      totalTime: 10800,
      expanded: false,
      tasks: [
        {
          id: 21,
          title: 'Module 1: Anatomy basics',
          completed: true,
          timeSpent: 3600,
          isTracking: false,
          expanded: false,
          subtasks: []
        },
        {
          id: 22,
          title: 'Module 2: Exercise science',
          completed: false,
          timeSpent: 2700,
          isTracking: false,
          expanded: false,
          subtasks: []
        }
      ]
    }
  ];
}

function normalizeProjects(rawProjects) {
  if (!Array.isArray(rawProjects)) return [];
  return rawProjects.map((project, idx) => ({
    id: Number(project.id) || Date.now() + idx,
    name: String(project.name || 'Untitled Project'),
    description: String(project.description || ''),
    theme: PROJECT_THEMES.includes(project.theme) ? project.theme : PROJECT_THEMES[idx % PROJECT_THEMES.length],
    totalTime: Number(project.totalTime) || 0,
    expanded: project.expanded !== false,
    tasks: Array.isArray(project.tasks) ? project.tasks.map((task, tIdx) => ({
      id: Number(task.id) || Date.now() + tIdx + idx,
      title: String(task.title || 'Untitled Task'),
      completed: !!task.completed,
      timeSpent: Number(task.timeSpent) || 0,
      isTracking: false,
      expanded: !!task.expanded,
      subtasks: Array.isArray(task.subtasks) ? task.subtasks.map((sub, sIdx) => ({
        id: Number(sub.id) || Date.now() + sIdx + tIdx,
        title: String(sub.title || 'Untitled Subtask'),
        completed: !!sub.completed
      })) : []
    })) : []
  }));
}

function loadProjectsState() {
  try {
    const raw = localStorage.getItem(projectsStorageKey());
    if (!raw) {
      projectsState.projects = defaultProjects();
      return;
    }
    projectsState.projects = normalizeProjects(JSON.parse(raw));
  } catch (_err) {
    projectsState.projects = defaultProjects();
  }
}

function persistProjectsState() {
  localStorage.setItem(projectsStorageKey(), JSON.stringify(projectsState.projects));
  if (typeof syncToAppState === 'function') syncToAppState('projects');
}

function formatProjectTime(totalSeconds) {
  const seconds = Math.max(0, Number(totalSeconds) || 0);
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return `${hrs}h ${mins}m`;
}

function projectProgress(project) {
  const tasks = Array.isArray(project.tasks) ? project.tasks : [];
  if (tasks.length === 0) return 0;
  const done = tasks.filter(t => t.completed).length;
  return Math.round((done / tasks.length) * 100);
}

function projectTaskSubtaskChip(task) {
  const total = task.subtasks.length;
  if (!total) return '';
  const done = task.subtasks.filter(st => st.completed).length;
  return `${done}/${total} subtasks`;
}

function projectCardHtml(project) {
  const progress = projectProgress(project);
  const showTaskForm = projectsState.taskFormProjectId === project.id;
  const hasActive = projectsState.activeTimer && projectsState.activeTimer.projectId === project.id;

  return `
    <article class="project-card-v2" data-project-id="${project.id}">
      <header class="project-card-head theme-${project.theme}">
        <div class="project-head-top">
          <div class="project-head-left">
            <button class="project-toggle-btn" data-action="project-toggle" data-project-id="${project.id}">
              <i class="fas ${project.expanded ? 'fa-chevron-down' : 'fa-chevron-right'}"></i>
            </button>
            <div class="project-title-wrap">
              <h3>${escapeHtml(project.name)}</h3>
              <p>${escapeHtml(project.description)}</p>
            </div>
          </div>
          <div class="project-head-right">
            <div class="project-total-time">
              <span>Total Time</span>
              <strong data-project-time="${project.id}">${formatProjectTime(project.totalTime)}</strong>
            </div>
            <button class="project-delete-btn-v2" data-action="project-delete" data-project-id="${project.id}" title="Delete project">
              <i class="fas fa-trash-alt"></i>
            </button>
          </div>
        </div>
        <div class="project-progress-top">
          <span>Progress</span>
          <span>${progress}%</span>
        </div>
        <div class="project-progress-track">
          <div class="project-progress-fill" style="width:${progress}%;"></div>
        </div>
      </header>
      ${project.expanded ? `
        <div class="project-card-body">
          <div class="project-task-head">
            <h4>Tasks (${project.tasks.length})</h4>
            <div style="display:flex;align-items:center;gap:10px;">
              ${hasActive ? '<div class="project-active-indicator"><span class="pulse"></span> Tracking in progress</div>' : ''}
              <button class="projects-btn projects-btn-soft projects-btn-mini" data-action="project-show-task-form" data-project-id="${project.id}">
                <i class="fas fa-plus"></i> Add Task
              </button>
            </div>
          </div>

          ${showTaskForm ? `
            <form class="project-task-form projects-add-task-form" data-project-id="${project.id}">
              <input class="projects-inline-input" name="title" type="text" placeholder="Task title..." required>
              <div class="projects-form-actions">
                <button type="submit" class="projects-btn projects-btn-primary projects-btn-mini">Add Task</button>
                <button type="button" class="projects-btn projects-btn-soft projects-btn-mini" data-action="project-hide-task-form">Cancel</button>
              </div>
            </form>
          ` : ''}

          ${project.tasks.length === 0 ? '<div class="project-subtask-empty">No tasks yet. Add your first task.</div>' : project.tasks.map(task => {
            const subtaskKey = `${project.id}:${task.id}`;
            const showSubtaskForm = projectsState.subtaskFormKey === subtaskKey;
            const taskActive = projectsState.activeTimer
              && projectsState.activeTimer.projectId === project.id
              && projectsState.activeTimer.taskId === task.id;
            const activeLocked = projectsState.activeTimer && !taskActive;
            return `
              <div class="project-task-row">
                <div class="project-task-main">
                  <div class="project-task-left">
                    <button class="project-task-check ${task.completed ? 'is-done' : ''}" data-action="project-task-toggle-complete" data-project-id="${project.id}" data-task-id="${task.id}">
                      ${task.completed ? '<i class="fas fa-check"></i>' : ''}
                    </button>
                    <button class="project-task-chevron" data-action="project-task-toggle-expand" data-project-id="${project.id}" data-task-id="${task.id}">
                      <i class="fas ${task.expanded ? 'fa-chevron-down' : 'fa-chevron-right'}"></i>
                    </button>
                    <span class="project-task-title ${task.completed ? 'is-done' : ''}">${escapeHtml(task.title)}</span>
                    ${task.subtasks.length ? `<span class="project-subtask-chip">${projectTaskSubtaskChip(task)}</span>` : ''}
                  </div>
                  <div class="project-task-right">
                    <span class="project-time-pill"><i class="far fa-clock"></i> <span data-task-time="${project.id}:${task.id}">${formatProjectTime(task.timeSpent)}</span></span>
                    ${taskActive ? `
                      <button class="project-timer-btn pause" data-action="project-task-pause" data-project-id="${project.id}" data-task-id="${task.id}" title="Pause">
                        <i class="fas fa-pause"></i>
                      </button>
                    ` : `
                      <button class="project-timer-btn start" data-action="project-task-start" data-project-id="${project.id}" data-task-id="${task.id}" title="Start timer" ${activeLocked ? 'disabled' : ''}>
                        <i class="fas fa-play"></i>
                      </button>
                    `}
                    <button class="project-timer-btn stop" data-action="project-task-stop" data-project-id="${project.id}" data-task-id="${task.id}" title="Stop timer">
                      <i class="far fa-stop-circle"></i>
                    </button>
                    <button class="project-timer-btn delete" data-action="project-task-delete" data-project-id="${project.id}" data-task-id="${task.id}" title="Delete task">
                      <i class="fas fa-trash-alt"></i>
                    </button>
                  </div>
                </div>
                ${task.expanded ? `
                  <div class="project-task-subpanel">
                    <div class="project-subtask-head">
                      <p>Subtasks</p>
                      <button class="projects-btn projects-btn-soft projects-btn-mini" data-action="project-show-subtask-form" data-project-id="${project.id}" data-task-id="${task.id}">
                        <i class="fas fa-plus"></i> Add Subtask
                      </button>
                    </div>

                    ${showSubtaskForm ? `
                      <form class="project-subtask-form project-subtask-form-el" data-project-id="${project.id}" data-task-id="${task.id}">
                        <input class="projects-inline-input" name="title" type="text" placeholder="Subtask title..." required>
                        <button type="submit" class="projects-btn projects-btn-primary projects-btn-mini">Add</button>
                      </form>
                    ` : ''}

                    ${task.subtasks.length === 0 ? '<div class="project-subtask-empty">No subtasks yet</div>' : task.subtasks.map(subtask => `
                      <div class="project-subtask-row">
                        <div class="project-subtask-left">
                          <button class="${subtask.completed ? 'is-done' : ''}" data-action="project-subtask-toggle" data-project-id="${project.id}" data-task-id="${task.id}" data-subtask-id="${subtask.id}">
                            ${subtask.completed ? '<i class="fas fa-check"></i>' : ''}
                          </button>
                          <span class="${subtask.completed ? 'is-done' : ''}">${escapeHtml(subtask.title)}</span>
                        </div>
                        <button class="project-subtask-delete-btn" data-action="project-subtask-delete" data-project-id="${project.id}" data-task-id="${task.id}" data-subtask-id="${subtask.id}">
                          <i class="fas fa-trash-alt"></i>
                        </button>
                      </div>
                    `).join('')}
                  </div>
                ` : ''}
              </div>
            `;
          }).join('')}
        </div>
      ` : ''}
    </article>
  `;
}

function renderProjectsStats() {
  const totalCountEl = document.getElementById('projects-total-count');
  const totalTaskEl = document.getElementById('projects-task-count');
  const totalTimeEl = document.getElementById('projects-time-count');
  const totalProjects = projectsState.projects.length;
  const totalTasks = projectsState.projects.reduce((sum, p) => sum + p.tasks.length, 0);
  const totalTime = projectsState.projects.reduce((sum, p) => sum + p.totalTime, 0);
  if (totalCountEl) totalCountEl.textContent = String(totalProjects);
  if (totalTaskEl) totalTaskEl.textContent = String(totalTasks);
  if (totalTimeEl) totalTimeEl.textContent = formatProjectTime(totalTime);
}

function renderProjectsPage() {
  const createPanel = document.getElementById('projects-create-panel');
  const list = document.getElementById('projects-list');
  if (createPanel) createPanel.classList.toggle('projects-collapsed', !projectsState.showCreate);
  renderProjectsStats();
  if (!list) return;
  if (projectsState.projects.length === 0) {
    list.innerHTML = '<div class="projects-empty">No projects yet. Create your first project to start tracking progress.</div>';
    return;
  }
  list.innerHTML = projectsState.projects.map(projectCardHtml).join('');
}

function findProject(projectId) {
  return projectsState.projects.find(project => project.id === projectId) || null;
}

function findTask(project, taskId) {
  if (!project) return null;
  return project.tasks.find(task => task.id === taskId) || null;
}

function clearTrackingFlags() {
  projectsState.projects.forEach(project => {
    project.tasks.forEach(task => {
      task.isTracking = false;
    });
  });
}

function stopActiveTimer() {
  projectsState.activeTimer = null;
  clearTrackingFlags();
}

function startProjectTimer(projectId, taskId) {
  stopActiveTimer();
  const project = findProject(projectId);
  const task = findTask(project, taskId);
  if (!project || !task) return;
  projectsState.activeTimer = { projectId, taskId };
  task.isTracking = true;
}

function tickProjectTimer() {
  const active = projectsState.activeTimer;
  if (!active) return;
  const project = findProject(active.projectId);
  const task = findTask(project, active.taskId);
  if (!project || !task) {
    stopActiveTimer();
    persistProjectsState();
    renderProjectsPage();
    return;
  }

  project.totalTime += 1;
  task.timeSpent += 1;

  const projectTimeEl = document.querySelector(`[data-project-time="${project.id}"]`);
  const taskTimeEl = document.querySelector(`[data-task-time="${project.id}:${task.id}"]`);
  if (projectTimeEl) projectTimeEl.textContent = formatProjectTime(project.totalTime);
  if (taskTimeEl) taskTimeEl.textContent = formatProjectTime(task.timeSpent);
  renderProjectsStats();
  persistProjectsState();
}

function addProject(name, description) {
  const used = new Set(projectsState.projects.map(p => p.theme));
  const nextTheme = PROJECT_THEMES.find(theme => !used.has(theme))
    || PROJECT_THEMES[Math.floor(Math.random() * PROJECT_THEMES.length)];
  projectsState.projects.unshift({
    id: Date.now(),
    name,
    description,
    theme: nextTheme,
    totalTime: 0,
    expanded: true,
    tasks: []
  });
}

function toggleProjectExpanded(projectId) {
  const project = findProject(projectId);
  if (!project) return;
  project.expanded = !project.expanded;
}

function toggleProjectTaskExpanded(projectId, taskId) {
  const task = findTask(findProject(projectId), taskId);
  if (!task) return;
  task.expanded = !task.expanded;
}

function addProjectTask(projectId, title) {
  const project = findProject(projectId);
  if (!project) return;
  project.tasks.push({
    id: Date.now(),
    title,
    completed: false,
    timeSpent: 0,
    isTracking: false,
    expanded: false,
    subtasks: []
  });
}

function deleteProject(projectId) {
  if (projectsState.activeTimer && projectsState.activeTimer.projectId === projectId) {
    stopActiveTimer();
  }
  projectsState.projects = projectsState.projects.filter(project => project.id !== projectId);
}

function deleteProjectTask(projectId, taskId) {
  const project = findProject(projectId);
  if (!project) return;
  if (projectsState.activeTimer
    && projectsState.activeTimer.projectId === projectId
    && projectsState.activeTimer.taskId === taskId) {
    stopActiveTimer();
  }
  project.tasks = project.tasks.filter(task => task.id !== taskId);
}

function toggleProjectTaskComplete(projectId, taskId) {
  const task = findTask(findProject(projectId), taskId);
  if (!task) return;
  task.completed = !task.completed;
  if (task.completed && projectsState.activeTimer
    && projectsState.activeTimer.projectId === projectId
    && projectsState.activeTimer.taskId === taskId) {
    stopActiveTimer();
  }
}

function addProjectSubtask(projectId, taskId, title) {
  const task = findTask(findProject(projectId), taskId);
  if (!task) return;
  task.subtasks.push({
    id: Date.now(),
    title,
    completed: false
  });
}

function toggleProjectSubtask(projectId, taskId, subtaskId) {
  const task = findTask(findProject(projectId), taskId);
  if (!task) return;
  const subtask = task.subtasks.find(st => st.id === subtaskId);
  if (!subtask) return;
  subtask.completed = !subtask.completed;
}

function deleteProjectSubtask(projectId, taskId, subtaskId) {
  const task = findTask(findProject(projectId), taskId);
  if (!task) return;
  task.subtasks = task.subtasks.filter(subtask => subtask.id !== subtaskId);
}

function setupProjects() {
  const section = document.getElementById('projects');
  if (!section) return;

  loadProjectsState();
  stopActiveTimer();

  const newBtn = document.getElementById('projects-new-btn');
  const cancelBtn = document.getElementById('projects-cancel-btn');
  const createForm = document.getElementById('projects-create-form');
  const nameInput = document.getElementById('projects-name-input');
  const descInput = document.getElementById('projects-desc-input');

  if (newBtn) {
    newBtn.addEventListener('click', () => {
      projectsState.showCreate = !projectsState.showCreate;
      renderProjectsPage();
    });
  }

  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      projectsState.showCreate = false;
      renderProjectsPage();
    });
  }

  if (createForm) {
    createForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = (nameInput?.value || '').trim();
      const description = (descInput?.value || '').trim();
      if (!name) return;
      addProject(name, description);
      persistProjectsState();
      projectsState.showCreate = false;
      if (nameInput) nameInput.value = '';
      if (descInput) descInput.value = '';
      renderProjectsPage();
    });
  }

  section.addEventListener('submit', (e) => {
    const form = e.target;
    if (form.matches('.projects-add-task-form')) {
      e.preventDefault();
      const projectId = Number(form.dataset.projectId);
      const input = form.querySelector('input[name="title"]');
      const title = (input?.value || '').trim();
      if (!projectId || !title) return;
      addProjectTask(projectId, title);
      projectsState.taskFormProjectId = null;
      persistProjectsState();
      renderProjectsPage();
      return;
    }

    if (form.matches('.project-subtask-form-el')) {
      e.preventDefault();
      const projectId = Number(form.dataset.projectId);
      const taskId = Number(form.dataset.taskId);
      const input = form.querySelector('input[name="title"]');
      const title = (input?.value || '').trim();
      if (!projectId || !taskId || !title) return;
      addProjectSubtask(projectId, taskId, title);
      projectsState.subtaskFormKey = null;
      persistProjectsState();
      renderProjectsPage();
    }
  });

  section.addEventListener('click', (e) => {
    const target = e.target;
    const actionEl = target.closest('[data-action]');
    if (!actionEl) return;
    const action = actionEl.getAttribute('data-action');
    const projectId = Number(actionEl.getAttribute('data-project-id'));
    const taskId = Number(actionEl.getAttribute('data-task-id'));
    const subtaskId = Number(actionEl.getAttribute('data-subtask-id'));

    if (action === 'project-toggle') {
      toggleProjectExpanded(projectId);
      persistProjectsState();
      renderProjectsPage();
      return;
    }

    if (action === 'project-delete') {
      deleteProject(projectId);
      persistProjectsState();
      renderProjectsPage();
      return;
    }

    if (action === 'project-show-task-form') {
      projectsState.taskFormProjectId = projectsState.taskFormProjectId === projectId ? null : projectId;
      projectsState.subtaskFormKey = null;
      renderProjectsPage();
      return;
    }

    if (action === 'project-hide-task-form') {
      projectsState.taskFormProjectId = null;
      renderProjectsPage();
      return;
    }

    if (action === 'project-task-toggle-expand') {
      toggleProjectTaskExpanded(projectId, taskId);
      persistProjectsState();
      renderProjectsPage();
      return;
    }

    if (action === 'project-task-toggle-complete') {
      toggleProjectTaskComplete(projectId, taskId);
      persistProjectsState();
      renderProjectsPage();
      return;
    }

    if (action === 'project-task-delete') {
      deleteProjectTask(projectId, taskId);
      persistProjectsState();
      renderProjectsPage();
      return;
    }

    if (action === 'project-task-start') {
      startProjectTimer(projectId, taskId);
      persistProjectsState();
      renderProjectsPage();
      return;
    }

    if (action === 'project-task-pause' || action === 'project-task-stop') {
      stopActiveTimer();
      persistProjectsState();
      renderProjectsPage();
      return;
    }

    if (action === 'project-show-subtask-form') {
      const key = `${projectId}:${taskId}`;
      projectsState.subtaskFormKey = projectsState.subtaskFormKey === key ? null : key;
      renderProjectsPage();
      return;
    }

    if (action === 'project-subtask-toggle') {
      toggleProjectSubtask(projectId, taskId, subtaskId);
      persistProjectsState();
      renderProjectsPage();
      return;
    }

    if (action === 'project-subtask-delete') {
      deleteProjectSubtask(projectId, taskId, subtaskId);
      persistProjectsState();
      renderProjectsPage();
    }
  });

  if (!projectsState.timerId) {
    projectsState.timerId = setInterval(tickProjectTimer, 1000);
  }

  renderProjectsPage();
}

// ========================================================================
// Â§11  WORKOUT EXPERIENCE
// ========================================================================
// Workout CRUD via /api/workouts. Templates (localStorage), exercise builder.
// âš ï¸ Global mutable: workoutState (workouts, templates, meta, expanded)
// âš ï¸ Templates and metadata are localStorage-only; workout entries use API.

const WORKOUT_TEMPLATE_KEY_BASE = 'fittrack_workout_templates_v1';
const WORKOUT_META_KEY_BASE = 'fittrack_workout_meta_v1';
function workoutTemplateStorageKey() {
  return _userKeyPrefix(WORKOUT_TEMPLATE_KEY_BASE);
}
function workoutMetaStorageKey() {
  return _userKeyPrefix(WORKOUT_META_KEY_BASE);
}
const workoutState = {
  workouts: [],
  templates: [],
  meta: {},
  expanded: new Set(),
  showTemplates: false,
  showNewPanel: false,
  showSaveTemplateForm: false,
  weeklyTarget: 5
};

function defaultWorkoutTemplates() {
  return [
    {
      id: 1,
      name: 'Push Day',
      exercises: [
        { name: 'Bench Press', sets: 4, reps: 8, weight: 80 },
        { name: 'Incline Dumbbell Press', sets: 3, reps: 10, weight: 30 },
        { name: 'Overhead Press', sets: 3, reps: 8, weight: 40 }
      ]
    },
    {
      id: 2,
      name: 'Pull Day',
      exercises: [
        { name: 'Deadlift', sets: 4, reps: 6, weight: 120 },
        { name: 'Pull-ups', sets: 3, reps: 8, weight: 0 },
        { name: 'Barbell Rows', sets: 4, reps: 10, weight: 60 }
      ]
    }
  ];
}

function normalizeWorkoutTemplates(rawTemplates) {
  if (!Array.isArray(rawTemplates)) return [];
  return rawTemplates
    .map((template, index) => ({
      id: Number(template?.id) || (Date.now() + index),
      name: String(template?.name || `Template ${index + 1}`),
      exercises: Array.isArray(template?.exercises)
        ? template.exercises.map(ex => ({
          name: String(ex?.name || 'Exercise'),
          sets: Number(ex?.sets) || 3,
          reps: Number(ex?.reps) || 10,
          weight: Number(ex?.weight) || 0
        }))
        : []
    }))
    .filter(template => template.name.trim().length > 0);
}

function normalizeWorkoutMeta(rawMeta) {
  if (!rawMeta || typeof rawMeta !== 'object' || Array.isArray(rawMeta)) return {};
  const result = {};
  Object.keys(rawMeta).forEach((key) => {
    const item = rawMeta[key] || {};
    result[String(key)] = {
      completed: !!item.completed,
      muscleGroup: String(item.muscleGroup || ''),
      estimatedDuration: Number(item.estimatedDuration) || 60
    };
  });
  return result;
}

function loadWorkoutStorage() {
  try {
    const templatesRaw = localStorage.getItem(workoutTemplateStorageKey());
    const metaRaw = localStorage.getItem(workoutMetaStorageKey());
    const parsedTemplates = templatesRaw ? JSON.parse(templatesRaw) : null;
    const normalizedTemplates = normalizeWorkoutTemplates(parsedTemplates);
    workoutState.templates = normalizedTemplates.length ? normalizedTemplates : defaultWorkoutTemplates();

    const parsedMeta = metaRaw ? JSON.parse(metaRaw) : null;
    workoutState.meta = normalizeWorkoutMeta(parsedMeta);
  } catch (_err) {
    workoutState.templates = defaultWorkoutTemplates();
    workoutState.meta = {};
  }
}

function persistWorkoutStorage() {
  localStorage.setItem(workoutTemplateStorageKey(), JSON.stringify(workoutState.templates));
  localStorage.setItem(workoutMetaStorageKey(), JSON.stringify(workoutState.meta));
}

function workoutMeta(workoutId) {
  const key = String(workoutId);
  if (!workoutState.meta[key]) {
    workoutState.meta[key] = { completed: false, muscleGroup: '', estimatedDuration: 60 };
  }
  return workoutState.meta[key];
}

function dateStr(d = new Date()) {
  return toLocalDateKey(d);
}

function isSameDayString(a, b) {
  return String(a || '') === String(b || '');
}

function formatWorkoutDate(value) {
  const raw = String(value || '').trim();
  if (!raw) return 'No date';
  const d = new Date(`${raw}T00:00:00`);
  if (Number.isNaN(d.getTime())) return 'No date';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

async function loadWorkoutsForPage() {
  try {
    let rows;
    const res = await fetch('/api/workouts', { credentials: 'same-origin' });
    if (!res.ok) throw new Error('Failed to load workouts');
    rows = await res.json();
    workoutState.workouts = (Array.isArray(rows) ? rows : []).map((w, index) => {
      const meta = workoutMeta(w.id);
      return {
        ...w,
        id: Number(w?.id) || (Date.now() + index),
        name: String(w?.name || 'Workout'),
        date: String(w?.date || dateStr()),
        completed: !!meta.completed,
        muscleGroup: meta.muscleGroup || '',
        estimatedDuration: meta.estimatedDuration || (Number(w?.duration) || 60),
        exercises: Array.isArray(w.exercises) ? w.exercises : []
      };
    });
  } catch (err) {
    console.error('Error loading workouts:', err);
    workoutState.workouts = [];
  }
  renderWorkoutPage();
  refreshDashboardMetrics();
  updateStatisticsForActiveUser();
  renderStatistics();
  if (typeof syncToAppState === 'function') syncToAppState('workouts');
}
function weekBounds(offsetWeeks = 0) {
  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - now.getDay() - (offsetWeeks * 7));
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  return { start, end };
}

function completedCountInRange(start, end) {
  return workoutState.workouts.filter(w => {
    const d = new Date((w.date || dateStr()) + 'T00:00:00');
    return d >= start && d < end && w.completed;
  }).length;
}

function workoutStreak() {
  let streak = 0;
  for (let i = 0; i < 7; i += 1) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = dateStr(d);
    const done = workoutState.workouts.some(w => isSameDayString(w.date, key) && w.completed);
    if (!done) break;
    streak += 1;
  }
  return streak;
}

function nextImprovementFocus() {
  const sorted = [...workoutState.workouts].sort((a, b) => String(b.date).localeCompare(String(a.date)));
  for (const w of sorted) {
    const heavy = (w.exercises || []).find(e => Number(e.weight) > 0);
    if (heavy) {
      return {
        text: `+2.5kg on ${heavy.name}`,
        sub: 'Push yourself to hit this goal in your next workout'
      };
    }
  }
  return null;
}

function todaysWorkout() {
  const today = dateStr();
  return workoutState.workouts.find(w => isSameDayString(w.date, today) && !w.completed) || null;
}

function thisWeekRoutine() {
  const { start, end } = weekBounds(0);
  return workoutState.workouts
    .filter(w => {
      const d = new Date((w.date || dateStr()) + 'T00:00:00');
      return d >= start && d < end;
    })
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

async function updateWorkoutApi(id, payload) {
1

  const res = await fetch(`/api/workouts/${id}`, { credentials: 'same-origin', method: 'PUT',
    headers: { 'Content-Type': 'application/json'},
    body: JSON.stringify(payload)
  });
  return res.ok;
}
async function completeWorkout(workoutId) {
  const w = workoutState.workouts.find(x => x.id === workoutId);
  if (!w) return;
  const ok = await updateWorkoutApi(workoutId, { duration: w.estimatedDuration || 60 });
  if (!ok) {
    alert('Could not complete workout.');
    return;
  }
  workoutMeta(workoutId).completed = true;
  persistWorkoutStorage();
  await loadWorkoutsForPage();
  refreshStreaksAfterChange();
}

async function skipWorkout(workoutId) {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const ok = await updateWorkoutApi(workoutId, { date: dateStr(tomorrow) });
  if (!ok) {
    alert('Could not reschedule workout.');
    return;
  }
  await loadWorkoutsForPage();
}

async function createWorkout(payload) {
1

  const res = await fetch('/api/workouts', { credentials: 'same-origin', method: 'POST',
    headers: { 'Content-Type': 'application/json'},
    body: JSON.stringify(payload)
  });
  return res.ok ? res.json() : null;
}
function renderWorkoutTodayCard() {
  const card = document.getElementById('workout-today-card');
  if (!card) return;
  const today = todaysWorkout();

  if (!today) {
    const doneToday = workoutState.workouts.find(w => isSameDayString(w.date, dateStr()) && w.completed);
    if (doneToday) {
      card.innerHTML = `
        <p>Today's Workout</p>
        <h3>Workout Complete</h3>
        <span>Great job completing ${doneToday.name} today.</span>
      `;
      return;
    }
    card.innerHTML = `
      <p>Today's Workout</p>
      <h3>No Workout Scheduled</h3>
      <span>Create a workout or use a template to get started.</span>
      <div class="workout-today-actions">
        <button id="workout-schedule-btn" class="workout-today-btn primary"><i class="fas fa-plus"></i> Schedule Workout</button>
      </div>
    `;
    const scheduleBtn = document.getElementById('workout-schedule-btn');
    if (scheduleBtn) {
      scheduleBtn.addEventListener('click', () => {
        workoutState.showNewPanel = true;
        renderWorkoutPanels();
      });
    }
    return;
  }

  const isExpanded = workoutState.expanded.has(today.id);
  card.innerHTML = `
    <p>Today's Workout</p>
    <h3>${escapeHtml(today.name)}</h3>
    <div class="meta">
      ${today.muscleGroup ? `<span><i class="fas fa-bullseye"></i> ${escapeHtml(today.muscleGroup)}</span>` : ''}
      <span><i class="fas fa-clock"></i> ${today.estimatedDuration || 60} min</span>
      <span><i class="fas fa-dumbbell"></i> ${(today.exercises || []).length} exercises</span>
    </div>
    <div class="workout-link-chip"><i class="fas fa-link"></i> Linked Task: ${escapeHtml(today.name)}</div>
    <div class="workout-today-actions">
      <button data-action="workout-start" data-workout-id="${today.id}" class="workout-today-btn primary">
        <i class="fas ${isExpanded ? 'fa-chevron-up' : 'fa-play'}"></i> ${isExpanded ? 'Hide Workout' : 'Start Workout'}
      </button>
      <button data-action="workout-skip" data-workout-id="${today.id}" class="workout-today-btn secondary">
        <i class="fas fa-calendar-alt"></i> Skip / Reschedule
      </button>
      <button data-action="workout-complete" data-workout-id="${today.id}" class="workout-today-btn success">
        <i class="fas fa-check"></i> Complete
      </button>
    </div>
    ${isExpanded ? `
      <div class="workout-routine-extra" style="margin-top:10px;">
        ${(today.exercises || []).map(e => `
          <div class="exercise-row"><span>${escapeHtml(e.name)}</span><span>${e.sets || 3} x ${e.reps || 10} @ ${e.weight || 0}kg</span></div>
        `).join('') || '<div class="exercise-row"><span>No exercises yet</span><span></span></div>'}
        <div class="workout-routine-actions">
          <button class="skip" data-action="workout-add-exercise" data-workout-id="${today.id}">Add Exercise</button>
        </div>
      </div>
    ` : ''}
  `;
}

function renderWorkoutStats() {
  const weekCountEl = document.getElementById('workout-week-count');
  const weekTargetEl = document.getElementById('workout-week-target');
  const weekBarEl = document.getElementById('workout-week-bar');
  const consistencyBatteryEl = document.getElementById('workout-consistency-battery');
  const consistencyNoteEl = document.getElementById('workout-consistency-note');
  const consistencyAchievementEl = document.getElementById('workout-consistency-achievement');
  const focusCard = document.getElementById('workout-focus-card');

  const thisWeek = weekBounds(0);
  const lastWeek = weekBounds(1);
  const thisWeekDone = completedCountInRange(thisWeek.start, thisWeek.end);
  const lastWeekDone = completedCountInRange(lastWeek.start, lastWeek.end);
  const last7Days = Array.from({ length: 7 }, (_, idx) => {
    const d = new Date();
    d.setDate(d.getDate() - idx);
    return dateStr(d);
  });
  const completedDaysSet = new Set(
    workoutState.workouts
      .filter(w => w.completed && last7Days.includes(String(w.date)))
      .map(w => String(w.date))
  );
  const todayKey = dateStr(new Date());
  const oneDayAgo = new Date();
  oneDayAgo.setDate(oneDayAgo.getDate() - 1);
  const twoDaysAgo = new Date();
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
  // Demo pattern requested: today complete, previous two days missed.
  completedDaysSet.add(todayKey);
  completedDaysSet.delete(dateStr(oneDayAgo));
  completedDaysSet.delete(dateStr(twoDaysAgo));

  if (weekCountEl) weekCountEl.textContent = String(thisWeekDone);
  if (weekTargetEl) weekTargetEl.textContent = String(workoutState.weeklyTarget);
  if (weekBarEl) weekBarEl.style.width = `${Math.min(100, Math.round((thisWeekDone / workoutState.weeklyTarget) * 100))}%`;
  const chronological = [...last7Days].reverse(); // oldest -> newest
  const dayDoneFlags = chronological.map(key => completedDaysSet.has(key));
  const segmentStates = [];
  for (let i = 0; i < dayDoneFlags.length; i += 1) {
    if (dayDoneFlags[i]) {
      segmentStates.push('done');
      continue;
    }
    const prevMiss = i > 0 && !dayDoneFlags[i - 1];
    const nextMiss = i < dayDoneFlags.length - 1 && !dayDoneFlags[i + 1];
    segmentStates.push(prevMiss || nextMiss ? 'miss' : 'warn');
  }
  const completedDays = dayDoneFlags.filter(Boolean).length;
  if (consistencyBatteryEl) {
    consistencyBatteryEl.innerHTML = segmentStates.map(state => `<span class="seg ${state}"></span>`).join('');
  }
  if (consistencyNoteEl) {
    consistencyNoteEl.textContent = 'Green: done, Yellow: missed, Red: 2+ misses';
  }
  if (consistencyAchievementEl) {
    consistencyAchievementEl.textContent = completedDays >= 7
      ? 'Achievement unlocked: Weekly Consistency Champion'
      : '';
  }

  const focus = nextImprovementFocus();
  if (focusCard) {
    if (!focus) {
      focusCard.innerHTML = '<h3>Next Improvement Focus</h3><p class=\"focus\">Add a weighted movement to get suggestions.</p>';
    } else {
      focusCard.innerHTML = `<h3>Next Improvement Focus</h3><p class=\"focus\">${focus.text}</p><span>${focus.sub}</span>`;
    }
  }
}

function routineCardHtml(w) {
  const expanded = workoutState.expanded.has(w.id);
  return `
    <article class="workout-routine-item">
      <div class="workout-routine-head" data-action="workout-toggle" data-workout-id="${w.id}">
        <div class="workout-routine-icon"><i class="fas fa-dumbbell"></i></div>
        <div>
          <div class="workout-routine-title">${escapeHtml(w.name)}</div>
          <div class="workout-routine-meta">${formatWorkoutDate(w.date)} - ${escapeHtml(w.muscleGroup || 'General')}</div>
        </div>
        <span class="workout-routine-chip ${w.completed ? 'done' : 'pending'}">${w.completed ? 'Done' : 'Pending'}</span>
        <i class="fas ${expanded ? 'fa-chevron-up' : 'fa-chevron-down'}"></i>
      </div>
      ${expanded ? `
        <div class="workout-routine-extra">
          ${(w.exercises || []).map(e => `<div class="exercise-row"><span>${escapeHtml(e.name)}</span><span>${e.sets || 3} x ${e.reps || 10} @ ${e.weight || 0}kg</span></div>`).join('') || '<div class="exercise-row"><span>No exercises yet</span><span></span></div>'}
          <div class="workout-routine-actions">
            ${!w.completed ? `<button class="complete" data-action="workout-complete" data-workout-id="${w.id}">Complete</button>` : ''}
            <button class="skip" data-action="workout-skip" data-workout-id="${w.id}">Reschedule +1 day</button>
          </div>
        </div>
      ` : ''}
    </article>
  `;
}

function renderWorkoutRoutine() {
  const list = document.getElementById('workout-routine-list');
  if (!list) return;
  const routine = thisWeekRoutine();
  if (routine.length === 0) {
    list.innerHTML = '<div class="tasks-empty-state">No routine workouts scheduled this week.</div>';
    return;
  }
  list.innerHTML = routine.map(routineCardHtml).join('');
}

function renderWorkoutPanels() {
  const templatesPanel = document.getElementById('workout-templates-panel');
  const newPanel = document.getElementById('workout-new-panel');
  const saveTemplateForm = document.getElementById('workout-save-template-form');
  if (templatesPanel) templatesPanel.classList.toggle('workout-collapsed', !workoutState.showTemplates);
  if (newPanel) newPanel.classList.toggle('workout-collapsed', !workoutState.showNewPanel);
  if (saveTemplateForm) saveTemplateForm.classList.toggle('workout-collapsed', !workoutState.showSaveTemplateForm);
}

function renderWorkoutTemplates() {
  const grid = document.getElementById('workout-templates-grid');
  const sourceSelect = document.getElementById('workout-template-source-select');
  if (!grid) return;

  if (workoutState.templates.length === 0) {
    grid.innerHTML = '<div class="tasks-empty-state">No templates yet.</div>';
  } else {
    grid.innerHTML = workoutState.templates.map(t => `
      <article class="workout-template-card">
        <h4>${escapeHtml(t.name)}</h4>
        <p>${(t.exercises || []).length} exercises</p>
        <button class="workout-btn blue" data-action="workout-use-template" data-template-id="${t.id}">Use Template</button>
      </article>
    `).join('');
  }

  if (sourceSelect) {
    sourceSelect.innerHTML = '<option value=\"\">Select workout to save</option>' + workoutState.workouts.map(w => `<option value=\"${w.id}\">${escapeHtml(w.name)} - ${escapeHtml(formatWorkoutDate(w.date))}</option>`).join('');
  }
}

function renderWorkoutPage() {
  renderWorkoutTodayCard();
  renderWorkoutStats();
  renderWorkoutRoutine();
  renderWorkoutPanels();
  renderWorkoutTemplates();
}

function setupWorkout() {
  if (!document.getElementById('workout')) return;
  loadWorkoutStorage();

  const toggleTemplatesBtn = document.getElementById('workout-toggle-templates-btn');
  const toggleNewBtn = document.getElementById('workout-toggle-new-btn');
  const showSaveTemplateBtn = document.getElementById('workout-show-template-save');
  const createBtn = document.getElementById('workout-create-btn');
  const saveTemplateBtn = document.getElementById('workout-save-template-btn');
  const workoutSection = document.getElementById('workout');

  if (toggleTemplatesBtn) {
    toggleTemplatesBtn.addEventListener('click', () => {
      workoutState.showTemplates = !workoutState.showTemplates;
      renderWorkoutPanels();
      renderWorkoutTemplates();
    });
  }

  if (toggleNewBtn) {
    toggleNewBtn.addEventListener('click', () => {
      workoutState.showNewPanel = !workoutState.showNewPanel;
      renderWorkoutPanels();
    });
  }

  if (showSaveTemplateBtn) {
    showSaveTemplateBtn.addEventListener('click', () => {
      workoutState.showSaveTemplateForm = !workoutState.showSaveTemplateForm;
      renderWorkoutPanels();
    });
  }

  if (createBtn) {
    createBtn.addEventListener('click', async () => {
      const nameEl = document.getElementById('workout-new-name');
      const musclesEl = document.getElementById('workout-new-muscles');
      const durationEl = document.getElementById('workout-new-duration');
      const name = (nameEl?.value || '').trim();
      if (!name) return;
      const created = await createWorkout({
        name,
        type: 'strength',
        intensity: 'medium',
        duration: 0,
        calories_burned: 0,
        notes: ''
      });
      if (!created) {
        alert('Could not create workout.');
        return;
      }
      const meta = workoutMeta(created.id);
      meta.muscleGroup = (musclesEl?.value || '').trim();
      meta.estimatedDuration = Number(durationEl?.value) || 60;
      meta.completed = false;
      persistWorkoutStorage();
      workoutState.showNewPanel = false;
      renderWorkoutPanels();
      await loadWorkoutsForPage();
      if (nameEl) nameEl.value = '';
      if (musclesEl) musclesEl.value = '';
      if (durationEl) durationEl.value = '';
    });
  }

  if (saveTemplateBtn) {
    saveTemplateBtn.addEventListener('click', () => {
      const nameEl = document.getElementById('workout-template-name-input');
      const sourceEl = document.getElementById('workout-template-source-select');
      const name = (nameEl?.value || '').trim();
      const sourceId = Number(sourceEl?.value);
      if (!name || !sourceId) return;
      const workout = workoutState.workouts.find(w => w.id === sourceId);
      if (!workout) return;
      workoutState.templates.push({
        id: Date.now(),
        name,
        exercises: (workout.exercises || []).map(e => ({
          name: e.name,
          sets: e.sets || 3,
          reps: e.reps || 10,
          weight: e.weight || 0
        }))
      });
      persistWorkoutStorage();
      if (nameEl) nameEl.value = '';
      workoutState.showSaveTemplateForm = false;
      renderWorkoutTemplates();
      renderWorkoutPanels();
    });
  }

  if (workoutSection) {
    workoutSection.addEventListener('click', async (e) => {
      const target = e.target;
      const actionEl = target.closest('[data-action]');
      if (!actionEl) return;
      const action = actionEl.getAttribute('data-action');

      if (action === 'workout-use-template') {
        const templateId = Number(actionEl.getAttribute('data-template-id'));
        const template = workoutState.templates.find(t => t.id === templateId);
        if (!template) return;
        const created = await createWorkout({
          name: template.name,
          type: 'strength',
          intensity: 'medium',
          duration: 0,
          calories_burned: 0,
          notes: '',
          exercises: template.exercises
        });
        if (!created) {
          alert('Could not create workout from template.');
          return;
        }
        const meta = workoutMeta(created.id);
        meta.completed = false;
        persistWorkoutStorage();
        await loadWorkoutsForPage();
        return;
      }

      const workoutId = Number(actionEl.getAttribute('data-workout-id'));
      if (!workoutId) return;

      if (action === 'workout-toggle' || action === 'workout-start') {
        if (workoutState.expanded.has(workoutId)) workoutState.expanded.delete(workoutId);
        else workoutState.expanded.add(workoutId);
        renderWorkoutPage();
        return;
      }

      if (action === 'workout-complete') {
        await completeWorkout(workoutId);
        return;
      }

      if (action === 'workout-skip') {
        await skipWorkout(workoutId);
        return;
      }

      if (action === 'workout-add-exercise') {
        const exerciseName = prompt('Exercise name:');
        if (!exerciseName || !exerciseName.trim()) return;
        const workout = workoutState.workouts.find(w => w.id === workoutId);
        if (!workout) return;
        const next = [...(workout.exercises || []), { id: Date.now(), name: exerciseName.trim(), sets: 3, reps: 10, weight: 0, notes: '' }];
        const ok = await updateWorkoutApi(workoutId, { exercises: next });
        if (!ok) {
          alert('Could not add exercise.');
          return;
        }
        await loadWorkoutsForPage();
      }
    });
  }

  loadWorkoutsForPage();
}

// ========================================================================
// Â§12  STATISTICS EXPERIENCE
// ========================================================================
// SVG-based charts (bar, pie, line). Period navigation (weekly/monthly).
// Data aggregation from workouts, nutrition, tasks.
// âš ï¸ Global mutable: statisticsState (deep-cloned from DEFAULT_STATISTICS_STATE)
// âš ï¸ Chart rendering uses inline SVG, not a charting library.

const DEFAULT_STATISTICS_STATE = {
  weeklyData: [
    { day: 'Mon', workouts: 2, nutrition: 3, tasks: 5, time: 90, calories: 650 },
    { day: 'Tue', workouts: 1, nutrition: 2, tasks: 3, time: 45, calories: 380 },
    { day: 'Wed', workouts: 2, nutrition: 3, tasks: 6, time: 105, calories: 720 },
    { day: 'Thu', workouts: 1, nutrition: 2, tasks: 4, time: 60, calories: 420 },
    { day: 'Fri', workouts: 2, nutrition: 3, tasks: 5, time: 85, calories: 580 },
    { day: 'Sat', workouts: 1, nutrition: 3, tasks: 4, time: 90, calories: 650 },
    { day: 'Sun', workouts: 1, nutrition: 2, tasks: 2, time: 30, calories: 150 }
  ],
  workoutTypeData: [
    { name: 'Cardio', value: 35, color: '#3B82F6' },
    { name: 'Strength', value: 40, color: '#10B981' },
    { name: 'Flexibility', value: 15, color: '#8B5CF6' },
    { name: 'Sports', value: 10, color: '#F59E0B' }
  ],
  monthlyProgress: [
    { month: 'Jul', workouts: 18, calories: 8500 },
    { month: 'Aug', workouts: 22, calories: 9800 },
    { month: 'Sep', workouts: 20, calories: 9200 },
    { month: 'Oct', workouts: 25, calories: 10500 },
    { month: 'Nov', workouts: 23, calories: 9900 },
    { month: 'Dec', workouts: 15, calories: 6500 }
  ],
  nutritionData: [
    { day: 'Mon', calories: 2100, protein: 145, carbs: 240 },
    { day: 'Tue', calories: 2300, protein: 152, carbs: 260 },
    { day: 'Wed', calories: 1950, protein: 138, carbs: 220 },
    { day: 'Thu', calories: 2200, protein: 148, carbs: 245 },
    { day: 'Fri', calories: 2400, protein: 160, carbs: 270 },
    { day: 'Sat', calories: 2150, protein: 142, carbs: 235 },
    { day: 'Sun', calories: 2050, protein: 140, carbs: 230 }
  ],
  macroDistribution: [
    { name: 'Protein', value: 30, color: '#EF4444' },
    { name: 'Carbs', value: 45, color: '#3B82F6' },
    { name: 'Fats', value: 25, color: '#F59E0B' }
  ],
  taskTotals: {
    total: 0,
    completed: 0,
    open: 0,
    overdue: 0
  }
};

let statisticsState = deepClone(DEFAULT_STATISTICS_STATE);

function getEnabledStatisticsModules() {
  const profileModules = profileState && typeof profileState.enabledModules === 'object'
    ? profileState.enabledModules
    : null;
  if (profileModules) {
    return {
      workout: !!profileModules.workout,
      nutrition: !!profileModules.nutrition,
      tasks: !!profileModules.tasks
    };
  }

  const prefs = typeof getCurrentLayoutPreferencesForActiveUser === 'function'
    ? getCurrentLayoutPreferencesForActiveUser()
    : (activeFeaturePrefs || {});
  return {
    workout: !!prefs.showWorkout,
    nutrition: !!prefs.showNutrition,
    tasks: !!prefs.showProjects
  };
}

function updateStatisticsForActiveUser() {
  const tasks = Array.isArray(taskUiState.tasks) ? taskUiState.tasks : [];
  const meals = Array.isArray(nutritionState.entries) ? nutritionState.entries : [];
  const workoutRows = Array.isArray(workoutState.workouts) ? workoutState.workouts : [];
  const workouts = workoutRows.map(w => ({ ...w, completed: !!workoutMeta(w.id).completed }));

  const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const now = new Date();
  const monday = new Date(now);
  const mondayOffset = (now.getDay() + 6) % 7;
  monday.setDate(now.getDate() - mondayOffset);
  monday.setHours(0, 0, 0, 0);

  const weeklyData = weekDays.map((day, idx) => {
    const dayDate = new Date(monday);
    dayDate.setDate(monday.getDate() + idx);
    const dayKey = toLocalDateKey(dayDate);

    const dayWorkouts = workouts.filter(w => String(w.date) === dayKey);
    const dayMeals = meals.filter(m => mealDateKey(m) === dayKey);
    const dayTasks = tasks.filter(t => String(t.date) === dayKey);

    return {
      day,
      workouts: dayWorkouts.length,
      nutrition: dayMeals.length,
      tasks: dayTasks.length,
      time: dayWorkouts.reduce((sum, w) => sum + (Number(w.duration) || 0), 0),
      calories: dayWorkouts.reduce((sum, w) => sum + (Number(w.calories_burned) || 0), 0)
    };
  });

  const typeColors = { cardio: '#3B82F6', strength: '#10B981', flexibility: '#8B5CF6', sports: '#F59E0B' };
  const typeNames = { cardio: 'Cardio', strength: 'Strength', flexibility: 'Flexibility', sports: 'Sports' };
  const typeCounts = { cardio: 0, strength: 0, flexibility: 0, sports: 0 };
  workouts.forEach(w => {
    const key = String(w.type || 'strength').toLowerCase();
    if (typeCounts[key] !== undefined) typeCounts[key] += 1;
    else typeCounts.strength += 1;
  });
  const totalTypes = Object.values(typeCounts).reduce((sum, v) => sum + v, 0) || 1;
  const workoutTypeData = Object.keys(typeCounts).map(key => ({
    name: typeNames[key],
    value: Math.round((typeCounts[key] / totalTypes) * 100),
    color: typeColors[key]
  }));

  const monthlyProgress = Array.from({ length: 6 }, (_, idx) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - idx), 1);
    const month = d.toLocaleDateString('en-US', { month: 'short' });
    const monthNum = d.getMonth();
    const yearNum = d.getFullYear();
    const monthWorkouts = workouts.filter(w => {
      const wd = new Date(`${w.date || ''}T00:00:00`);
      return wd.getMonth() === monthNum && wd.getFullYear() === yearNum;
    });
    return {
      month,
      workouts: monthWorkouts.length,
      calories: monthWorkouts.reduce((sum, w) => sum + (Number(w.calories_burned) || 0), 0)
    };
  });

  const nutritionData = weekDays.map((day, idx) => {
    const dayDate = new Date(monday);
    dayDate.setDate(monday.getDate() + idx);
    const dayKey = toLocalDateKey(dayDate);
    const dayMeals = meals.filter(m => mealDateKey(m) === dayKey);
    return {
      day,
      calories: Math.round(dayMeals.reduce((sum, m) => sum + parseMacro(m.calories), 0)),
      protein: Math.round(dayMeals.reduce((sum, m) => sum + parseMacro(m.protein), 0)),
      carbs: Math.round(dayMeals.reduce((sum, m) => sum + parseMacro(m.carbs), 0))
    };
  });

  const macroTotals = {
    protein: meals.reduce((sum, m) => sum + parseMacro(m.protein), 0),
    carbs: meals.reduce((sum, m) => sum + parseMacro(m.carbs), 0),
    fats: meals.reduce((sum, m) => sum + parseMacro(m.fats), 0)
  };
  const macroTotal = macroTotals.protein + macroTotals.carbs + macroTotals.fats;
  const macroDistribution = macroTotal > 0
    ? [
      { name: 'Protein', value: Math.round((macroTotals.protein / macroTotal) * 100), color: '#EF4444' },
      { name: 'Carbs', value: Math.round((macroTotals.carbs / macroTotal) * 100), color: '#3B82F6' },
      { name: 'Fats', value: Math.round((macroTotals.fats / macroTotal) * 100), color: '#F59E0B' }
    ]
    : deepClone(DEFAULT_STATISTICS_STATE.macroDistribution);

  const taskRenderable = materializeTasksForRender(tasks);
  const overdueTaskCount = taskRenderable.filter(t => t.__state === 'overdue').length;
  const completedTaskCount = tasks.filter(t => !!t.completed || !!t.completedAt).length;
  const totalTaskCount = tasks.length;
  const openTaskCount = Math.max(0, totalTaskCount - completedTaskCount);

  statisticsState = {
    weeklyData,
    workoutTypeData,
    monthlyProgress,
    nutritionData,
    macroDistribution,
    taskTotals: {
      total: totalTaskCount,
      completed: completedTaskCount,
      open: openTaskCount,
      overdue: overdueTaskCount
    }
  };
}
function statisticsSummaryCards(enabledModules) {
  const weeklyWorkouts = statisticsState.weeklyData.reduce((sum, row) => sum + row.workouts, 0);
  const totalMinutes = statisticsState.weeklyData.reduce((sum, row) => sum + row.time, 0);
  const totalCalories = statisticsState.weeklyData.reduce((sum, row) => sum + row.calories, 0);
  const weeklyCaloriesIntake = statisticsState.nutritionData.reduce((sum, row) => sum + (Number(row.calories) || 0), 0);
  const avgProtein = Math.round(
    statisticsState.nutritionData.reduce((sum, row) => sum + (Number(row.protein) || 0), 0)
    / Math.max(statisticsState.nutritionData.length, 1)
  );
  const avgDuration = Math.round(totalMinutes / Math.max(weeklyWorkouts, 1));
  const hours = (totalMinutes / 60).toFixed(1);
  const cards = [];

  if (enabledModules.workout) {
    cards.push({
      icon: 'fa-wave-square',
      color: 'blue',
      title: 'This Week',
      value: `${weeklyWorkouts} Workouts`,
      note: '+25% from last week',
      noteClass: ''
    });
    cards.push({
      icon: 'fa-clock',
      color: 'green',
      title: 'Total Time',
      value: `${hours} Hours`,
      note: '+15% from last week',
      noteClass: ''
    });
    cards.push({
      icon: 'fa-fire',
      color: 'orange',
      title: 'Calories',
      value: `${totalCalories.toLocaleString()} kcal`,
      note: '+18% from last week',
      noteClass: ''
    });
    cards.push({
      icon: 'fa-heart-pulse',
      color: 'purple',
      title: 'Avg. Duration',
      value: `${avgDuration} minutes`,
      note: 'per workout',
      noteClass: 'neutral'
    });
  }

  if (enabledModules.nutrition) {
    cards.push({
      icon: 'fa-utensils',
      color: 'orange',
      title: 'Weekly Intake',
      value: `${weeklyCaloriesIntake.toLocaleString()} kcal`,
      note: 'nutrition total',
      noteClass: 'neutral'
    });
    cards.push({
      icon: 'fa-drumstick-bite',
      color: 'green',
      title: 'Avg Protein',
      value: `${avgProtein} g/day`,
      note: 'weekly average',
      noteClass: 'neutral'
    });
  }

  if (enabledModules.tasks) {
    cards.push({
      icon: 'fa-list-check',
      color: 'blue',
      title: 'Open Tasks',
      value: `${statisticsState.taskTotals.open}`,
      note: `${statisticsState.taskTotals.overdue} overdue`,
      noteClass: statisticsState.taskTotals.overdue > 0 ? '' : 'neutral'
    });
    cards.push({
      icon: 'fa-check-double',
      color: 'purple',
      title: 'Completed',
      value: `${statisticsState.taskTotals.completed}`,
      note: `${statisticsState.taskTotals.total} total tasks`,
      noteClass: 'neutral'
    });
  }

  return cards;
}

function renderStatisticsSummary(enabledModules) {
  const grid = document.getElementById('statistics-summary-grid');
  if (!grid) return;
  const cards = statisticsSummaryCards(enabledModules);
  if (!cards.length) {
    grid.innerHTML = '';
    return;
  }
  grid.innerHTML = cards.map((card, index) => `
    <article class="statistics-summary-card" style="--stat-delay:${80 + (index * 70)}ms;">
      <div class="statistics-summary-top">
        <span class="statistics-icon-badge ${card.color}"><i class="fas ${card.icon}"></i></span>
        <p class="statistics-summary-title">${card.title}</p>
      </div>
      <h4 class="statistics-summary-value">${card.value}</h4>
      <span class="statistics-summary-note ${card.noteClass}">
        ${card.noteClass === 'neutral' ? '' : '<i class="fas fa-arrow-trend-up"></i>'}${card.note}
      </span>
    </article>
  `).join('');
}

function renderStatisticsBars(enabledModules) {
  const bars = document.getElementById('statistics-weekly-bars');
  const legend = document.getElementById('statistics-weekly-legend');
  if (!bars) return;
  const stackHeight = 220;
  const includeWorkout = !!enabledModules.workout;
  const includeNutrition = !!enabledModules.nutrition;
  const includeTasks = !!enabledModules.tasks;

  const maxTotalRaw = Math.max(...statisticsState.weeklyData.map((row) => {
    let total = 0;
    if (includeWorkout) total += row.workouts;
    if (includeNutrition) total += row.nutrition;
    if (includeTasks) total += row.tasks;
    return total;
  }), 1);
  const maxTotal = Math.max(1, Math.ceil(maxTotalRaw * 1.05));
  const yAxisMax = Math.max(1, Math.ceil(maxTotalRaw));
  const yTicks = Array.from({ length: 5 }, (_, i) => Math.round((yAxisMax * (4 - i)) / 4));
  if (legend) {
    const legendItems = [];
    if (includeWorkout) legendItems.push('<span style="--stat-delay:260ms;"><i class="dot blue"></i> Workouts</span>');
    if (includeNutrition) legendItems.push('<span style="--stat-delay:320ms;"><i class="dot green"></i> Nutrition</span>');
    if (includeTasks) legendItems.push('<span style="--stat-delay:380ms;"><i class="dot purple"></i> Tasks</span>');
    legend.innerHTML = legendItems.join('');
  }
  const barCols = statisticsState.weeklyData.map((row, index) => {
    const workouts = Number(row.workouts) || 0;
    const nutrition = Number(row.nutrition) || 0;
    const tasks = Number(row.tasks) || 0;
    const workoutPx = includeWorkout ? Math.max(0, Math.round((workouts / maxTotal) * stackHeight)) : 0;
    const nutritionPx = includeNutrition ? Math.max(0, Math.round((nutrition / maxTotal) * stackHeight)) : 0;
    const tasksPx = includeTasks ? Math.max(0, Math.round((tasks / maxTotal) * stackHeight)) : 0;
    return `
      <div class="statistics-bar-col">
        <div class="statistics-stack" title="Workouts: ${workouts}, Nutrition: ${nutrition}, Tasks: ${tasks}">
          ${includeTasks ? `<div class="statistics-seg purple" style="height:${tasksPx}px; animation-delay:${index * 0.06}s"></div>` : ''}
          ${includeNutrition ? `<div class="statistics-seg green" style="height:${nutritionPx}px; animation-delay:${index * 0.06 + 0.02}s"></div>` : ''}
          ${includeWorkout ? `<div class="statistics-seg blue" style="height:${workoutPx}px; animation-delay:${index * 0.06 + 0.04}s"></div>` : ''}
        </div>
        <span class="statistics-bar-label">${row.day}</span>
      </div>
    `;
  }).join('');

  bars.innerHTML = `
    <div class="statistics-y-axis">
      ${yTicks.map(v => `<span>${v}</span>`).join('')}
    </div>
    <div class="statistics-bars-grid">
      ${barCols}
    </div>
  `;
}

function renderStatisticsTaskOverview() {
  const wrap = document.getElementById('statistics-task-overview');
  if (!wrap) return;
  wrap.innerHTML = `
    <div class="statistics-task-metric">
      <span>Open Tasks</span>
      <strong>${statisticsState.taskTotals.open}</strong>
    </div>
    <div class="statistics-task-metric">
      <span>Completed</span>
      <strong>${statisticsState.taskTotals.completed}</strong>
    </div>
    <div class="statistics-task-metric">
      <span>Overdue</span>
      <strong>${statisticsState.taskTotals.overdue}</strong>
    </div>
    <div class="statistics-task-metric">
      <span>Total Tasks</span>
      <strong>${statisticsState.taskTotals.total}</strong>
    </div>
  `;
}

function renderStatisticsDynamicLayout(enabledModules) {
  const container = document.getElementById('statistics-dynamic-content');
  if (!container) return;

  const noneEnabled = !enabledModules.workout && !enabledModules.nutrition && !enabledModules.tasks;
  if (noneEnabled) {
    container.innerHTML = `
      <section class="statistics-panel statistics-empty-state">
        Enable modules in Profile to see statistics.
      </section>
    `;
    return;
  }

  const rows = [];
  if (enabledModules.workout) {
    rows.push(`
      <div class="statistics-two-grid">
        <section class="statistics-panel">
          <h3>Weekly Activity</h3>
          <div id="statistics-weekly-legend" class="statistics-legend-inline"></div>
          <div id="statistics-weekly-bars" class="statistics-bars"></div>
        </section>
        <section class="statistics-panel">
          <h3>Workout Distribution</h3>
          <div class="statistics-pie-wrap">
            <div id="statistics-workout-pie" class="statistics-pie"></div>
            <div id="statistics-workout-legend" class="statistics-legend"></div>
          </div>
        </section>
      </div>
      <section class="statistics-panel">
        <h3>6-Month Progress</h3>
        <div class="statistics-chart-wrap">
          <svg id="statistics-monthly-svg" class="statistics-line-svg tall" viewBox="0 0 680 320" preserveAspectRatio="none"></svg>
          <div id="statistics-monthly-labels" class="statistics-x-labels"></div>
        </div>
      </section>
    `);
  }

  if (enabledModules.nutrition) {
    rows.push(`
      <div class="statistics-two-grid">
        <section class="statistics-panel">
          <h3>Weekly Nutrition Intake</h3>
          <div class="statistics-chart-wrap">
            <svg id="statistics-nutrition-svg" class="statistics-line-svg" viewBox="0 0 680 280" preserveAspectRatio="none"></svg>
            <div id="statistics-nutrition-labels" class="statistics-x-labels"></div>
          </div>
        </section>
        <section class="statistics-panel">
          <h3>Macro Distribution</h3>
          <div class="statistics-pie-wrap">
            <div id="statistics-macro-pie" class="statistics-pie"></div>
            <div id="statistics-macro-legend" class="statistics-legend"></div>
          </div>
        </section>
      </div>
    `);
  }

  if (enabledModules.tasks) {
    rows.push(`
      <section class="statistics-panel">
        <h3>Task Overview</h3>
        <div id="statistics-task-overview" class="statistics-task-overview-grid"></div>
      </section>
    `);
  }

  container.innerHTML = rows.join('');
}

function renderStatisticsPie(pieEl, legendEl, data) {
  if (!pieEl || !legendEl) return;
  const total = Math.max(1, data.reduce((sum, item) => sum + (Number(item.value) || 0), 0));
  const size = 210;
  const radius = 78;
  const stroke = 24;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * radius;

  let offset = 0;
  const segmentsMarkup = data.map((item, index) => {
    const value = Number(item.value) || 0;
    const arcLength = (value / total) * circumference;
    const segment = `
      <circle
        class="statistics-pie-segment"
        data-name="${item.name}"
        data-value="${item.value}"
        data-color="${item.color}"
        data-index="${index}"
        cx="${cx}"
        cy="${cy}"
        r="${radius}"
        stroke="${item.color}"
        stroke-dasharray="0 ${circumference}"
        stroke-dashoffset="${-offset.toFixed(2)}"
      ></circle>
    `;
    offset += arcLength;
    return { segment, arcLength };
  });

  pieEl.innerHTML = `
    <svg class="statistics-pie-svg" viewBox="0 0 ${size} ${size}" aria-hidden="true">
      <circle class="statistics-pie-track" cx="${cx}" cy="${cy}" r="${radius}" stroke-width="${stroke}"></circle>
      ${segmentsMarkup.map(item => item.segment).join('')}
    </svg>
    <div class="statistics-pie-center">
      <strong class="statistics-pie-percentage"></strong>
      <span class="statistics-pie-label"></span>
    </div>
  `;

  legendEl.innerHTML = data.map((item, index) => `
    <div class="statistics-legend-item" style="--stat-delay:${280 + (index * 70)}ms;">
      <div class="statistics-legend-left">
        <span class="statistics-dot" style="background:${item.color};"></span>
        <span>${item.name}</span>
      </div>
      <strong class="statistics-legend-value">${item.value}%</strong>
    </div>
  `).join('');

  const prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const arcs = Array.from(pieEl.querySelectorAll('.statistics-pie-segment'));
  const center = pieEl.querySelector('.statistics-pie-center');
  const centerStrong = center?.querySelector('.statistics-pie-percentage');
  const centerSpan = center?.querySelector('.statistics-pie-label');

  const clearCenter = () => {
    if (!center) return;
    center.classList.remove('has-hover-content');
    if (centerStrong) {
      centerStrong.textContent = '';
      centerStrong.style.color = '';
    }
    if (centerSpan) {
      centerSpan.textContent = '';
      centerSpan.style.color = '';
    }
  };

  const showCenter = (arc) => {
    if (!centerStrong || !centerSpan || !center) return;
    const name = arc.getAttribute('data-name') || '';
    const value = arc.getAttribute('data-value') || '0';
    const color = arc.getAttribute('data-color') || '';
    centerStrong.textContent = `${value}%`;
    centerStrong.style.color = color;
    centerSpan.textContent = name;
    centerSpan.style.color = color;
    center.classList.add('has-hover-content');
  };

  clearCenter();

  // Show contextual center content for the active slice only.
  arcs.forEach((arc) => {
    arc.addEventListener('mouseenter', () => {
      showCenter(arc);
    });
  });

  pieEl.addEventListener('mouseleave', clearCenter);

  if (prefersReducedMotion) {
    arcs.forEach((arc, index) => {
      const arcLength = segmentsMarkup[index]?.arcLength || 0;
      arc.style.strokeDasharray = `${arcLength} ${circumference}`;
    });
    return;
  }

  requestAnimationFrame(() => {
    arcs.forEach((arc, index) => {
      const arcLength = segmentsMarkup[index]?.arcLength || 0;
      arc.style.strokeDasharray = `${arcLength} ${circumference}`;
    });
  });
}

function createPolylinePoints(values, width, height, padding, min, max) {
  const usableW = width - (padding * 2);
  const usableH = height - (padding * 2);
  const step = usableW / Math.max(values.length - 1, 1);
  return values.map((value, idx) => {
    const x = padding + (idx * step);
    const y = padding + ((max - value) / Math.max(max - min, 1)) * usableH;
    return { x, y };
  });
}

function pathFromPoints(points) {
  if (!points.length) return '';
  return points.map((point, idx) => `${idx === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(' ');
}

function areaPathFromPoints(points, width, height, padding) {
  if (!points.length) return '';
  const line = pathFromPoints(points);
  const last = points[points.length - 1];
  const first = points[0];
  const baseY = height - padding;
  return `${line} L ${last.x.toFixed(2)} ${baseY.toFixed(2)} L ${first.x.toFixed(2)} ${baseY.toFixed(2)} Z`;
}

function renderNutritionAreaChart() {
  const svg = document.getElementById('statistics-nutrition-svg');
  const labels = document.getElementById('statistics-nutrition-labels');
  if (!svg || !labels) return;
  const width = 680;
  const height = 280;
  const padding = 28;
  const values = statisticsState.nutritionData.map(row => row.calories);
  const min = Math.min(...values) - 120;
  const max = Math.max(...values) + 120;
  const points = createPolylinePoints(values, width, height, padding, min, max);

  const linePath = pathFromPoints(points);
  svg.innerHTML = `
    <g class="statistics-svg-grid">
      <line x1="${padding}" y1="${padding}" x2="${width - padding}" y2="${padding}"></line>
      <line x1="${padding}" y1="${padding + ((height - padding * 2) * 0.33)}" x2="${width - padding}" y2="${padding + ((height - padding * 2) * 0.33)}"></line>
      <line x1="${padding}" y1="${padding + ((height - padding * 2) * 0.66)}" x2="${width - padding}" y2="${padding + ((height - padding * 2) * 0.66)}"></line>
      <line x1="${padding}" y1="${height - padding}" x2="${width - padding}" y2="${height - padding}"></line>
    </g>
    <path class="statistics-svg-area is-revealing" d="${areaPathFromPoints(points, width, height, padding)}" fill="#FDE68A"></path>
    <path class="statistics-svg-path is-drawing" d="${linePath}" stroke="#F59E0B"></path>
  `;

  labels.innerHTML = statisticsState.nutritionData.map((row, index) => `<span style="--stat-delay:${360 + (index * 40)}ms;">${row.day}</span>`).join('');

  const prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const line = svg.querySelector('.statistics-svg-path.is-drawing');
  const area = svg.querySelector('.statistics-svg-area.is-revealing');
  if (!line || !area || prefersReducedMotion) {
    if (area) area.classList.add('is-revealed');
    return;
  }

  const length = line.getTotalLength();
  line.style.strokeDasharray = `${length}`;
  line.style.strokeDashoffset = `${length}`;
  requestAnimationFrame(() => {
    line.style.strokeDashoffset = '0';
    window.setTimeout(() => area.classList.add('is-revealed'), 320);
  });
}

function renderMonthlyLineChart() {
  const svg = document.getElementById('statistics-monthly-svg');
  const labels = document.getElementById('statistics-monthly-labels');
  if (!svg || !labels) return;
  const width = 680;
  const height = 320;
  const padding = 28;
  const workouts = statisticsState.monthlyProgress.map(row => row.workouts);
  const calories = statisticsState.monthlyProgress.map(row => row.calories);
  const wPoints = createPolylinePoints(workouts, width, height, padding, Math.min(...workouts) - 2, Math.max(...workouts) + 2);
  const cPoints = createPolylinePoints(calories, width, height, padding, Math.min(...calories) - 600, Math.max(...calories) + 600);

  const wDots = wPoints.map(point => `<circle class="statistics-svg-dot" cx="${point.x.toFixed(2)}" cy="${point.y.toFixed(2)}" fill="#3B82F6"></circle>`).join('');
  const cDots = cPoints.map(point => `<circle class="statistics-svg-dot" cx="${point.x.toFixed(2)}" cy="${point.y.toFixed(2)}" fill="#F59E0B"></circle>`).join('');

  svg.innerHTML = `
    <g class="statistics-svg-grid">
      <line x1="${padding}" y1="${padding}" x2="${width - padding}" y2="${padding}"></line>
      <line x1="${padding}" y1="${padding + ((height - padding * 2) * 0.33)}" x2="${width - padding}" y2="${padding + ((height - padding * 2) * 0.33)}"></line>
      <line x1="${padding}" y1="${padding + ((height - padding * 2) * 0.66)}" x2="${width - padding}" y2="${padding + ((height - padding * 2) * 0.66)}"></line>
      <line x1="${padding}" y1="${height - padding}" x2="${width - padding}" y2="${height - padding}"></line>
    </g>
    <path class="statistics-svg-path" d="${pathFromPoints(wPoints)}" stroke="#3B82F6"></path>
    <path class="statistics-svg-path" d="${pathFromPoints(cPoints)}" stroke="#F59E0B"></path>
    ${wDots}
    ${cDots}
  `;

  labels.classList.add('months');
  labels.innerHTML = statisticsState.monthlyProgress.map(row => `<span>${row.month}</span>`).join('');
}

function renderStatistics() {
  const enabledModules = getEnabledStatisticsModules();
  renderStatisticsSummary(enabledModules);
  renderStatisticsDynamicLayout(enabledModules);

  if (enabledModules.workout) {
    renderStatisticsBars(enabledModules);
    renderStatisticsPie(
      document.getElementById('statistics-workout-pie'),
      document.getElementById('statistics-workout-legend'),
      statisticsState.workoutTypeData
    );
    renderMonthlyLineChart();
  }

  if (enabledModules.nutrition) {
    renderStatisticsPie(
      document.getElementById('statistics-macro-pie'),
      document.getElementById('statistics-macro-legend'),
      statisticsState.macroDistribution
    );
    renderNutritionAreaChart();
  }

  if (enabledModules.tasks) {
    renderStatisticsTaskOverview();
  }

  animateStatisticsEntry();
}

function animateStatisticsEntry() {
  const shell = document.querySelector('#statistics .statistics-shell');
  if (!shell) return;
  const panels = shell.querySelectorAll('.statistics-panel');
  panels.forEach((panel, index) => {
    panel.style.setProperty('--stat-delay', `${200 + (index * 70)}ms`);
  });
  shell.classList.remove('is-animated');
  void shell.offsetWidth;
  shell.classList.add('is-animated');
}

function setupStatistics() {
  if (!document.getElementById('statistics')) return;
  updateStatisticsForActiveUser();
  renderStatistics();
}

// ========================================================================
// Â§13  PROFILE EXPERIENCE
// ========================================================================
// Profile form (name, email, goals), theme toggle (dark/light),
// BMI/BMR/TDEE calculators, macro target computation.
// âš ï¸ Global mutable: profileState (localStorage-backed)
// âš ï¸ Theme is applied via body.classList.toggle('theme-dark').
// âš ï¸ Nutrition targets from profile feed into nutritionState goals.

const PROFILE_STORAGE_KEY = 'fittrack_profile_v1';
const THEME_STORAGE_KEY = 'fittrack_theme_v1';
const defaultProfile = {
  fullName: 'Alex Johnson',
  email: 'alex.johnson@email.com',
  dob: '1990-05-15',
  age: 30,
  gender: 'Prefer not to say',
  height: 175,
  currentWeight: 75,
  targetWeight: 70,
  level: 'Intermediate',
  goal: 'Weight Loss',
  weightGoal: 'loss',
  bmi: 0,
  bmr: 0,
  tdee: 0,
  targetCalories: 2200,
  targetProtein: 140,
  targetCarbs: 250,
  targetFats: 60,
  memberSince: 'Jan 2024',
  theme: 'light'
};

let profileState = { ...defaultProfile };

function renderTopProfileMenu() {
  const name = profileState.fullName || defaultProfile.fullName;
  const email = profileState.email || defaultProfile.email;

  const topName = document.getElementById('top-profile-name');
  const topEmail = document.getElementById('top-profile-email');
  const headName = document.getElementById('top-profile-head-name');
  const headEmail = document.getElementById('top-profile-head-email');

  if (topName) topName.textContent = name;
  if (topEmail) topEmail.textContent = email;
  if (headName) headName.textContent = name;
  if (headEmail) headEmail.textContent = email;
}

function closeProfileMenu() {
  const wrap = document.getElementById('profile-menu-wrap');
  const btn = document.getElementById('profile-menu-btn');
  const panel = document.getElementById('profile-menu-panel');

  if (wrap) wrap.classList.remove('open');
  if (btn) btn.setAttribute('aria-expanded', 'false');
  if (panel) panel.setAttribute('aria-hidden', 'true');
}

function setupProfileMenu() {
  const wrap = document.getElementById('profile-menu-wrap');
  const btn = document.getElementById('profile-menu-btn');
  const panel = document.getElementById('profile-menu-panel');
  const themeToggle = document.getElementById('theme-toggle-input');

  if (!wrap || !btn || !panel) return;

  renderTopProfileMenu();
  if (themeToggle) {
    themeToggle.checked = profileState.theme === 'dark';
    themeToggle.addEventListener('change', () => {
      profileState.theme = themeToggle.checked ? 'dark' : 'light';
      persistProfileState();
      applyTheme(profileState.theme);
      const profileThemeEl = document.getElementById('profile-theme');
      if (profileThemeEl) profileThemeEl.value = profileState.theme;
    });
  }

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = wrap.classList.toggle('open');
    btn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    panel.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
  });

  panel.addEventListener('click', (e) => {
    const actionBtn = e.target.closest('button[data-action]');
    if (!actionBtn) return;

    const action = actionBtn.getAttribute('data-action');
    if (action === 'open-profile-page' || action === 'open-settings-page') {
      showPage('profile');
      closeProfileMenu();
      return;
    }

    if (action === 'customize-layout') {
      openLayoutCustomizeModal();
      closeProfileMenu();
      return;
    }

    if (action === 'sign-out') {
      closeProfileMenu();
      AuthModule.logout().then(() => {
        activeFeaturePrefs = { ...DEFAULT_FEATURE_PREFS };
        setSessionView('auth');
      });
      return;
    }
  });

  document.addEventListener('click', (e) => {
    if (!wrap.contains(e.target)) {
      closeProfileMenu();
    }
  });
}

function loadProfileState() {
  try {
    const raw = localStorage.getItem(PROFILE_STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    profileState = { ...defaultProfile, ...parsed };
    if (!profileState.weightGoal) {
      profileState.weightGoal = profileState.goal === 'Weight Loss'
        ? 'loss'
        : profileState.goal === 'Muscle Gain'
          ? 'gain'
          : 'maintain';
    }
    // Sanitize core numeric fields to avoid invalid profile state locking nutrition.
    if (!Number.isFinite(Number(profileState.age)) || Number(profileState.age) <= 0) {
      profileState.age = defaultProfile.age;
    }
    if (!Number.isFinite(Number(profileState.height)) || Number(profileState.height) <= 0) {
      profileState.height = defaultProfile.height;
    }
    if (!Number.isFinite(Number(profileState.currentWeight)) || Number(profileState.currentWeight) <= 0) {
      profileState.currentWeight = defaultProfile.currentWeight;
    }
    const ruleGoal = effectiveWeightRuleGoal(profileState.goal, profileState.weightGoal);
    if (ruleGoal === 'maintain') {
      profileState.targetWeight = profileState.currentWeight;
    } else if (!Number.isFinite(Number(profileState.targetWeight)) || Number(profileState.targetWeight) <= 0) {
      profileState.targetWeight = ruleGoal === 'loss'
        ? Math.max(1, profileState.currentWeight - 5)
        : profileState.currentWeight + 5;
    }
    const validation = validateProfileWeights({
      goal: profileState.goal,
      weightGoal: profileState.weightGoal,
      currentWeight: profileState.currentWeight,
      targetWeight: profileState.targetWeight
    });
    if (!validation.valid) {
      profileState.targetWeight = ruleGoal === 'loss'
        ? Math.max(1, profileState.currentWeight - 5)
        : ruleGoal === 'gain'
          ? profileState.currentWeight + 5
          : profileState.currentWeight;
    }
    profileState = { ...profileState, ...calculateProfileHealthMetrics(profileState) };
    persistProfileState();
  } catch (_err) {
    profileState = { ...defaultProfile };
  }
}

function persistProfileState() {
  localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profileState));
  if (typeof syncToAppState === 'function') syncToAppState('profile');
}

function applyTheme(themeValue) {
  const isDark = themeValue === 'dark';
  document.body.classList.toggle('theme-dark', isDark);
  localStorage.setItem(THEME_STORAGE_KEY, isDark ? 'dark' : 'light');
  const themeToggle = document.getElementById('theme-toggle-input');
  if (themeToggle) themeToggle.checked = isDark;
}

function loadThemePreference() {
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === 'dark' || stored === 'light') {
    profileState.theme = stored;
  }
  applyTheme(profileState.theme);
}

function profileInputValue(id, fallback = '') {
  const el = document.getElementById(id);
  return el ? el.value : fallback;
}

function activityMultiplierFromLevel(level) {
  const key = String(level || '').toLowerCase();
  if (key === 'advanced') return 1.55;
  if (key === 'intermediate') return 1.375;
  return 1.2;
}

function calculateProfileHealthMetrics(input) {
  const age = Number(input?.age);
  const heightCm = Number(input?.height);
  const weightKg = Number(input?.currentWeight);
  const gender = String(input?.gender || '').toLowerCase();
  const weightGoal = String(input?.weightGoal || '').toLowerCase();
  const level = String(input?.level || '');

  if (!Number.isFinite(age) || !Number.isFinite(heightCm) || !Number.isFinite(weightKg) || age <= 0 || heightCm <= 0 || weightKg <= 0) {
    return {
      bmi: 0,
      bmr: 0,
      tdee: 0,
      activityMultiplier: activityMultiplierFromLevel(level),
      targetCalories: 0,
      targetProtein: 0,
      targetCarbs: 0,
      targetFats: 0
    };
  }

  const heightM = heightCm / 100;
  const bmi = weightKg / (heightM * heightM);

  let bmr = (10 * weightKg) + (6.25 * heightCm) - (5 * age);
  if (gender === 'male') bmr += 5;
  else if (gender === 'female') bmr -= 161;

  const activityMultiplier = activityMultiplierFromLevel(level);
  const tdee = bmr * activityMultiplier;

  let adjustment = 0;
  if (weightGoal === 'loss') adjustment = -400;
  else if (weightGoal === 'gain') adjustment = 400;
  let target = tdee + adjustment;

  const lowerBound = Math.max(bmr, tdee - 500);
  const upperBound = tdee + 500;
  target = Math.max(lowerBound, Math.min(upperBound, target));
  target = Math.round(target / 10) * 10;
  if (target < bmr) target = Math.ceil(bmr / 10) * 10;

  const macroGoal = weightGoal === 'loss' || weightGoal === 'gain' || weightGoal === 'maintain'
    ? weightGoal
    : 'maintain';
  const proteinPerKg = macroGoal === 'loss' ? 2.0 : macroGoal === 'gain' ? 1.8 : 1.6;
  const fatPct = macroGoal === 'maintain' ? 0.30 : 0.25;

  let proteinG = Math.round(weightKg * proteinPerKg);
  let fatG = Math.round((target * fatPct) / 9);
  let carbCalories = target - ((proteinG * 4) + (fatG * 9));
  if (carbCalories < 0) carbCalories = 0;
  let carbsG = Math.round(carbCalories / 4);

  // Keep rounded macro calories near target with deterministic correction.
  let macroCalories = (proteinG * 4) + (fatG * 9) + (carbsG * 4);
  if (Math.abs(target - macroCalories) > 50) {
    const carbAdjust = Math.round((target - macroCalories) / 4);
    carbsG = Math.max(0, carbsG + carbAdjust);
    macroCalories = (proteinG * 4) + (fatG * 9) + (carbsG * 4);
  }
  if (Math.abs(target - macroCalories) > 50) {
    const fatAdjust = Math.round((target - macroCalories) / 9);
    fatG = Math.max(0, fatG + fatAdjust);
  }

  return {
    bmi: Math.round(bmi * 10) / 10,
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    activityMultiplier,
    targetCalories: Math.max(0, Number(target) || 0),
    targetProtein: Math.max(0, Number(proteinG) || 0),
    targetCarbs: Math.max(0, Number(carbsG) || 0),
    targetFats: Math.max(0, Number(fatG) || 0)
  };
}

function isProfileCoreDataComplete(values = profileState) {
  const age = Number(values?.age);
  const height = Number(values?.height);
  const currentWeight = Number(values?.currentWeight);
  return Number.isFinite(age) && age > 0 && Number.isFinite(height) && height > 0 && Number.isFinite(currentWeight) && currentWeight > 0;
}

function isHalfKgStep(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return false;
  return Math.abs((n * 2) - Math.round(n * 2)) < 1e-9;
}

function effectiveWeightRuleGoal(goalValue, weightGoalValue) {
  const wg = String(weightGoalValue || '').toLowerCase();
  if (wg === 'loss' || wg === 'gain' || wg === 'maintain') return wg;
  const g = String(goalValue || '').toLowerCase();
  if (g.includes('loss')) return 'loss';
  if (g.includes('gain') || g.includes('bulk')) return 'gain';
  return 'maintain';
}

function validateProfileWeights(values) {
  const currentWeight = Number(values?.currentWeight);
  const targetWeight = Number(values?.targetWeight);
  const goal = values?.goal || profileState.goal;
  const weightGoal = values?.weightGoal || profileState.weightGoal;
  const ruleGoal = effectiveWeightRuleGoal(goal, weightGoal);

  if (!Number.isFinite(currentWeight) || currentWeight <= 0) {
    return { valid: false, message: 'Enter a valid current weight.', ruleGoal };
  }
  if (!isHalfKgStep(currentWeight)) {
    return { valid: false, message: 'Weight must be in 0.5 kg steps.', ruleGoal };
  }
  if (ruleGoal === 'maintain') {
    return { valid: true, message: '', ruleGoal };
  }

  if (!Number.isFinite(targetWeight) || targetWeight <= 0) {
    return { valid: false, message: 'Enter a valid target weight.', ruleGoal };
  }
  if (!isHalfKgStep(targetWeight)) {
    return { valid: false, message: 'Weight must be in 0.5 kg steps.', ruleGoal };
  }
  if (ruleGoal === 'gain' && !(targetWeight > currentWeight)) {
    return { valid: false, message: 'For Weight Gain (Bulk), target weight must be greater than current weight.', ruleGoal };
  }
  if (ruleGoal === 'loss' && !(targetWeight < currentWeight)) {
    return { valid: false, message: 'For Weight Loss, target weight must be less than current weight.', ruleGoal };
  }
  return { valid: true, message: '', ruleGoal };
}

function currentProfileFormValues() {
  const weightGoal = profileInputValue('profile-weight-goal', profileState.weightGoal) || 'maintain';
  const currentWeight = Number(profileInputValue('profile-current-weight', String(profileState.currentWeight)));
  const rawTarget = Number(profileInputValue('profile-target-weight', String(profileState.targetWeight)));
  const targetWeight = weightGoal === 'maintain' ? currentWeight : rawTarget;
  return {
    goal: profileInputValue('profile-goal', profileState.goal),
    weightGoal,
    level: profileInputValue('profile-level', profileState.level),
    age: Number(profileInputValue('profile-age', String(profileState.age))),
    gender: profileInputValue('profile-gender', profileState.gender),
    height: Number(profileInputValue('profile-height', String(profileState.height))),
    currentWeight,
    targetWeight
  };
}

function updateProfileValidationUI(showWhenValid = false) {
  const msgEl = document.getElementById('profile-validation-msg');
  if (!msgEl) return { valid: true, message: '' };
  const draft = currentProfileFormValues();
  const age = Number(draft.age);
  if (!Number.isFinite(age) || age < 10 || age > 120) {
    msgEl.textContent = 'Age is required.';
    msgEl.style.display = 'inline-block';
    return { valid: false, message: 'Age is required.' };
  }
  const result = validateProfileWeights(draft);
  if (result.valid) {
    msgEl.textContent = '';
    msgEl.style.display = showWhenValid ? 'inline-block' : 'none';
  } else {
    msgEl.textContent = result.message;
    msgEl.style.display = 'inline-block';
  }
  return result;
}

function isProfileCompleteAndValid() {
  if (!isProfileCoreDataComplete(profileState)) return false;
  const result = validateProfileWeights({
    goal: profileState.goal,
    weightGoal: profileState.weightGoal,
    currentWeight: profileState.currentWeight,
    targetWeight: profileState.targetWeight
  });
  return result.valid;
}

function applyWeightPlanFieldVisibility() {
  const planEl = document.getElementById('profile-weight-goal');
  const targetWrap = document.getElementById('profile-target-weight-wrap');
  const targetEl = document.getElementById('profile-target-weight');

  const plan = String(planEl?.value || profileState.weightGoal || 'maintain').toLowerCase();
  const isMaintain = plan === 'maintain';

  if (targetWrap) targetWrap.style.display = isMaintain ? 'none' : '';
  if (targetEl) {
    if (isMaintain) {
      targetEl.removeAttribute('required');
    } else {
      targetEl.setAttribute('required', 'required');
    }
  }
}

function refreshCalculatedProfileMetricsFromForm(persist = false) {
  const draft = {
    ...profileState,
    ...currentProfileFormValues()
  };
  const metrics = calculateProfileHealthMetrics(draft);
  const nextState = {
    ...profileState,
    ...draft,
    ...metrics
  };
  const validation = validateProfileWeights({
    goal: nextState.goal,
    weightGoal: nextState.weightGoal,
    currentWeight: nextState.currentWeight,
    targetWeight: nextState.targetWeight
  });
  const canApplyDraft = isProfileCoreDataComplete(nextState) && validation.valid;
  if (persist || canApplyDraft) {
    profileState = nextState;
    if (persist) persistProfileState();
  }
  syncNutritionGoalWithProfile();
  renderNutritionUI();
  updateNutritionAccessState();
}

function updateNutritionAccessState() {
  const hasCoreData = isProfileCoreDataComplete(profileState);
  const isValid = hasCoreData && isProfileCompleteAndValid();
  const gateEl = document.getElementById('nutrition-profile-gate-msg');
  const formSection = document.getElementById('nutrition-form-section');
  const toggleFormBtn = document.getElementById('nutrition-toggle-form-btn');
  const saveMealBtn = document.getElementById('nutrition-save-meal-btn');
  const nutritionForm = document.getElementById('nutrition-form');

  if (gateEl) {
    gateEl.classList.toggle('nutrition-collapsed', isValid);
    if (!isValid) {
      gateEl.innerHTML = `<div class="nutrition-empty">Complete your profile to calculate nutrition targets</div>`;
    }
  }
  if (!isValid) nutritionState.showForm = false;
  if (formSection && !isValid) formSection.classList.add('nutrition-collapsed');
  if (toggleFormBtn) toggleFormBtn.disabled = !isValid;
  if (saveMealBtn) saveMealBtn.disabled = !isValid;
  if (nutritionForm) {
    Array.from(nutritionForm.elements || []).forEach((el) => {
      if (!el || typeof el.disabled === 'undefined') return;
      if (el.id === 'nutrition-cancel-form-btn') return;
      el.disabled = !isValid;
    });
  }

  return isValid;
}

function syncNutritionGoalWithProfile() {
  const goal = profileState.weightGoal || 'maintain';
  nutritionState.weightGoal = goal === 'loss' || goal === 'gain' ? goal : 'maintain';
  const targetCalories = Number(profileState?.targetCalories);
  const targetProtein = Number(profileState?.targetProtein);
  const targetCarbs = Number(profileState?.targetCarbs);
  const targetFats = Number(profileState?.targetFats);
  if (Number.isFinite(targetCalories) && targetCalories > 0) nutritionState.baseGoals.calories = targetCalories;
  if (Number.isFinite(targetProtein) && targetProtein >= 0) nutritionState.baseGoals.protein = Math.round(targetProtein);
  if (Number.isFinite(targetCarbs) && targetCarbs >= 0) nutritionState.baseGoals.carbs = Math.round(targetCarbs);
  if (Number.isFinite(targetFats) && targetFats >= 0) nutritionState.baseGoals.fats = Math.round(targetFats);
}

function renderProfileUI() {
  const mapValues = [
    ['profile-full-name', profileState.fullName],
    ['profile-email', profileState.email],
    ['profile-dob', profileState.dob],
    ['profile-age', String(profileState.age)],
    ['profile-gender', profileState.gender],
    ['profile-height', String(profileState.height)],
    ['profile-current-weight', String(profileState.currentWeight)],
    ['profile-target-weight', String(profileState.targetWeight)],
    ['profile-level', profileState.level],
    ['profile-goal', profileState.goal],
    ['profile-weight-goal', profileState.weightGoal],
    ['profile-theme', profileState.theme]
  ];
  mapValues.forEach(([id, value]) => {
    const el = document.getElementById(id);
    if (el) el.value = value;
  });
  applyWeightPlanFieldVisibility();

  const heroName = document.getElementById('profile-hero-name');
  const heroMember = document.getElementById('profile-hero-member');
  const quickHeight = document.getElementById('profile-quick-height');
  const quickCurrent = document.getElementById('profile-quick-current');
  const quickTarget = document.getElementById('profile-quick-target');

  if (heroName) heroName.textContent = profileState.fullName;
  if (heroMember) heroMember.textContent = `Member since ${profileState.memberSince}`;
  if (quickHeight) quickHeight.textContent = `${profileState.height} cm`;
  if (quickCurrent) quickCurrent.textContent = `${profileState.currentWeight} kg`;
  if (quickTarget) quickTarget.textContent = `${profileState.targetWeight} kg`;

  renderTopProfileMenu();
  applyTheme(profileState.theme);
}

async function renderProfileDynamicStats() {
  const workoutsEl = document.getElementById('profile-hero-workouts');
  const goalsEl = document.getElementById('profile-hero-goals');
  if (!workoutsEl || !goalsEl) return;

  try {
    let workouts;
      const workoutsRes = await fetch('/api/workouts', { credentials: 'same-origin' });
      workouts = workoutsRes.ok ? await workoutsRes.json() : [];
    const totalWorkouts = Array.isArray(workouts) ? workouts.length : 0;
    const goalsDone = (taskUiState.tasks || []).filter(t => t.completed).length;
    workoutsEl.textContent = String(totalWorkouts);
    goalsEl.textContent = String(goalsDone);
  } catch (_err) {
    workoutsEl.textContent = '0';
    goalsEl.textContent = String((taskUiState.tasks || []).filter(t => t.completed).length);
  }
}
function setupProfile() {
  const page = document.getElementById('profile');
  if (!page) return;
  loadProfileState();
  renderProfileUI();
  renderProfileDynamicStats();

  const saveBtn = document.getElementById('profile-save-btn');
  const profileGoalEl = document.getElementById('profile-goal');
  const profileWeightGoalEl = document.getElementById('profile-weight-goal');
  const profileLevelEl = document.getElementById('profile-level');
  const profileAgeEl = document.getElementById('profile-age');
  const profileGenderEl = document.getElementById('profile-gender');
  const profileHeightEl = document.getElementById('profile-height');
  const profileCurrentWeightEl = document.getElementById('profile-current-weight');
  const profileTargetWeightEl = document.getElementById('profile-target-weight');

  [profileCurrentWeightEl, profileTargetWeightEl].forEach((el) => {
    if (el) el.step = '0.5';
  });

  const validateProfileFormLive = (showAlertForGoalChange = false) => {
    applyWeightPlanFieldVisibility();
    const result = updateProfileValidationUI();
    if (showAlertForGoalChange && !result.valid) {
      alert('Please correct current/target weight to match your selected goal.');
    }
    return result.valid;
  };

  if (profileGoalEl) {
    profileGoalEl.addEventListener('change', () => {
      refreshCalculatedProfileMetricsFromForm(false);
      validateProfileFormLive(true);
    });
  }
  if (profileWeightGoalEl) {
    profileWeightGoalEl.addEventListener('change', () => {
      refreshCalculatedProfileMetricsFromForm(false);
      validateProfileFormLive(true);
    });
  }
  if (profileLevelEl) profileLevelEl.addEventListener('change', () => refreshCalculatedProfileMetricsFromForm(false));
  if (profileGenderEl) profileGenderEl.addEventListener('change', () => refreshCalculatedProfileMetricsFromForm(false));
  if (profileHeightEl) profileHeightEl.addEventListener('input', () => refreshCalculatedProfileMetricsFromForm(false));
  if (profileAgeEl) profileAgeEl.addEventListener('input', () => refreshCalculatedProfileMetricsFromForm(false));
  if (profileCurrentWeightEl) {
    profileCurrentWeightEl.addEventListener('input', () => {
      applyWeightPlanFieldVisibility();
      refreshCalculatedProfileMetricsFromForm(false);
    });
  }
  if (profileTargetWeightEl) profileTargetWeightEl.addEventListener('input', () => refreshCalculatedProfileMetricsFromForm(false));

  applyWeightPlanFieldVisibility();
  refreshCalculatedProfileMetricsFromForm(false);
  updateProfileValidationUI();

  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      applyWeightPlanFieldVisibility();
      const validation = updateProfileValidationUI();
      if (!validation.valid) return;
      profileState = {
        ...profileState,
        fullName: profileInputValue('profile-full-name', profileState.fullName).trim() || profileState.fullName,
        email: profileInputValue('profile-email', profileState.email).trim() || profileState.email,
        dob: profileInputValue('profile-dob', profileState.dob) || profileState.dob,
        theme: profileInputValue('profile-theme', profileState.theme) || 'light'
      };
      refreshCalculatedProfileMetricsFromForm(true);
      renderProfileUI();
      alert('Profile updated.');
    });
  }
}

// ========================================================================
// Â§14  MODAL SETUP
// ========================================================================
// Shared modal infrastructure for the "Add Task" dialog.
// Handles open/close events, form submission, due-date custom input toggle.

function setupTaskModal() {
  const modal = document.getElementById('add-task-modal');
  const openBtn = document.getElementById('add-task-btn');
  const closeBtn = document.getElementById('close-task-modal');
  const cancelBtn = document.getElementById('cancel-task-btn');
  const form = document.getElementById('add-task-form');
  const dueSelect = document.getElementById('task-due-select');
  const customDateInput = document.getElementById('custom-datetime-input');
  
  if (!modal || !form) return;
  
  // Open modal
  if (openBtn) {
    openBtn.addEventListener('click', () => {
      modal.style.display = 'flex';
    });
  }
  
  // Close buttons
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      modal.style.display = 'none';
    });
  }
  
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      modal.style.display = 'none';
    });
  }
  
  // Close on background click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.style.display = 'none';
    }
  });
  
  // Handle due date dropdown change
  if (dueSelect) {
    dueSelect.addEventListener('change', () => {
      if (dueSelect.value === 'custom') {
        if (customDateInput) customDateInput.style.display = 'block';
      } else {
        if (customDateInput) customDateInput.style.display = 'none';
      }
    });
  }
  
  // Form submission
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const titleInput = document.getElementById('task-title-input');
    const tagsInput = document.getElementById('task-tags-input');
    const priorityInput = document.getElementById('task-priority-select');
    const dueInput = document.getElementById('task-due-select');
    const repeatInput = document.getElementById('task-repeat-select');
    
    if (titleInput && titleInput.value.trim()) {
      let dueDate;
      if (dueInput && dueInput.value === 'today') {
        dueDate = toLocalDateKey(new Date());
      } else if (dueInput && dueInput.value === 'tomorrow') {
        const t = new Date(); t.setDate(t.getDate() + 1);
        dueDate = toLocalDateKey(t);
      } else if (dueInput && dueInput.value === 'custom' && customDateInput && customDateInput.value) {
        dueDate = customDateInput.value;  // YYYY-MM-DD from date input
      } else {
        dueDate = toLocalDateKey(new Date());
      }
      
      addTask(
        titleInput.value.trim(),
        priorityInput ? priorityInput.value : 'medium',
        dueDate,
        repeatInput ? repeatInput.value : 'none',
        parseTaskTagsInput(tagsInput?.value || ''),
        (document.getElementById('task-description-input')?.value || '').trim(),
        document.getElementById('task-save-to-notes')?.checked || false
      );
      
      form.reset();
      if (dueSelect) dueSelect.value = 'today';
      if (customDateInput) customDateInput.style.display = 'none';
      if (tagsInput) tagsInput.value = '';
      const descInput = document.getElementById('task-description-input');
      if (descInput) descInput.value = '';
      const saveNotesChk = document.getElementById('task-save-to-notes');
      if (saveNotesChk) saveNotesChk.checked = false;
    }
  });
}

// ========================================================================
// Â§15  INITIALIZATION (DOMContentLoaded)
// ========================================================================
// Bootstrap sequence: loads profile/theme, then runs all setup*() functions
// defensively (each wrapped in try/catch so one failure won't block others).
// Conditionally bootstraps demo session and loads demo data views.
// Registers global cleanup on beforeunload (timer, expanded set).

function runInitStep(name, fn) {
  try {
    return fn();
  } catch (err) {
    console.error(`Init step failed: ${name}`, err);
    return null;
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  console.log('FitTrack Pro initializing...');

  runInitStep('loadProfileState', () => loadProfileState());
  runInitStep('loadThemePreference', () => loadThemePreference());

  // Initialize independent modules defensively so one failure does not break the whole app.
  const setupSteps = [
    ['setupDashboard', setupDashboard],
    ['setupStreaks', setupStreaks],
    ['setupTaskModal', setupTaskModal],
    ['setupTaskInteractions', setupTaskInteractions],
    ['setupCalendar', setupCalendar],
    ['setupProjects', setupProjects],
    ['setupNutrition', setupNutrition],
    ['setupWorkout', setupWorkout],
    ['setupStatistics', setupStatistics],
    ['setupProfileMenu', setupProfileMenu],
    ['setupProfile', setupProfile],
    ['setupLayoutCustomizer', setupLayoutCustomizer],
    ['initFocusModule', initFocusModule]
  ];

  setupSteps.forEach(([name, step]) => {
    runInitStep(name, () => step());
  });

  const hasSession = !!runInitStep('bootstrapSession', () => bootstrapSession());

  if (hasSession) {
    runInitStep('showDashboardPage', () => showPage('dashboard'));
    await runInitStep('loadActiveUserDataViews', () => loadActiveUserDataViews());
  }


  window.addEventListener('beforeunload', () => {
    dashboardState.timerRunning = false;
    if (dashboardState.timerInterval) {
      clearInterval(dashboardState.timerInterval);
      dashboardState.timerInterval = null;
    }
    taskUiState.expanded.clear();
  });

  // Hydrate the central AppState from all module-level state objects
  if (typeof hydrateAppState === 'function') hydrateAppState();

  console.log('Initialization complete');
});


// ========================================================================
// Â§16  AI AVATAR CHAT WIDGET
// ========================================================================
// Floating multi-mode chatbot: general, nutrition, workout, task modes.
// Communicates via /api/ai/chat and /api/ai/execute.
// Supports action confirmation flow (AI proposes â†’ user confirms â†’ execute).
// âš ï¸ Global mutable: aiChatOpen, aiPendingAction, _aiSending,
//    _aiLastSendTs, chatbotMode
// âš ï¸ Rate-limited by _AI_COOLDOWN_MS (2500ms between sends).
// âš ï¸ Uses session ID from localStorage to maintain Gemini conversation.
// âš ï¸ Falls back to local response generation if API fails.

let aiChatOpen = false;
let aiPendingAction = null; // Stores the last confirmation payload
let _aiSending = false;      // Lock: true while a request is in-flight
let _aiLastSendTs = 0;       // Epoch ms of last send (cooldown guard)
const _AI_COOLDOWN_MS = 2500; // Minimum ms between sends

// --- Mode-based state ---
let chatbotMode = 'general'; // "nutrition" | "workout" | "task" | "general"
const AI_SESSION_STORAGE_KEY = 'fittrack_ai_session_id_v1';

const _AI_MODE_META = {
  general:   { label: 'General Query',  emoji: '💬', placeholder: 'Ask me anything...' },
  nutrition: { label: 'Nutrition Logging', emoji: '🍽️', placeholder: 'Describe what you ate…' },
  workout:   { label: 'Workout Logging',  emoji: '🏋️', placeholder: 'Describe your workout…' },
  task:      { label: 'Add Task',        emoji: '📋', placeholder: 'Describe the task…' },
};

function _aiSessionId() {
  let sessionId = null;
  try {
    sessionId = sessionStorage.getItem(AI_SESSION_STORAGE_KEY);
    if (!sessionId) {
      sessionId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      sessionStorage.setItem(AI_SESSION_STORAGE_KEY, sessionId);
    }
  } catch (_err) {
    sessionId = 'no-session-storage';
  }
  return sessionId;
}

function _aiSetMode(mode) {
  if (!_AI_MODE_META[mode]) mode = 'general';
  chatbotMode = mode;

  // Update indicator ribbon
  const indicator = document.getElementById('ai-chat-mode-indicator');
  const badge = document.getElementById('ai-mode-badge');
  if (indicator) indicator.setAttribute('data-mode', mode);
  if (badge) badge.textContent = `${_AI_MODE_META[mode].emoji} Mode: ${_AI_MODE_META[mode].label}`;

  // Update placeholder
  const inp = document.getElementById('ai-chat-input');
  if (inp) inp.placeholder = _AI_MODE_META[mode].placeholder;

  // Clear any pending confirmation when mode changes
  if (aiPendingAction) {
    aiPendingAction = null;
    _aiShowConfirmBar(false);
  }
}

function toggleAIChat(forceClose) {
  if (forceClose === true) {
    aiChatOpen = false;
  } else {
    aiChatOpen = !aiChatOpen;
  }
  const panel = document.getElementById('ai-chat-panel');
  if (!panel) return;
  panel.classList.toggle('ai-chat-hidden', !aiChatOpen);

  if (aiChatOpen) {
    const inp = document.getElementById('ai-chat-input');
    if (inp) {
      setTimeout(() => inp.focus(), 150);
      // Attach Enter key listener once
      if (!inp._aiKeyBound) {
        inp._aiKeyBound = true;
        inp.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendAIMessage();
          }
        });
      }
    }
    // Auto-trigger mentor check-in on first open
    if (!_mentorMessageShown) {
      setTimeout(() => generateMentorMessage(), 300);
    }
  }
}

// Click-away: close chat when clicking outside panel and FAB
document.addEventListener('click', (e) => {
  if (!aiChatOpen) return;
  const panel = document.getElementById('ai-chat-panel');
  const fab = document.getElementById('ai-avatar-fab');
  if (!panel || !fab) return;
  if (!panel.contains(e.target) && !fab.contains(e.target)) {
    toggleAIChat(true);
  }
});

function _aiAddMessage(html, sender) {
  const container = document.getElementById('ai-chat-messages');
  if (!container) return;
  const div = document.createElement('div');
  div.className = `ai-msg ai-msg-${sender}`;
  div.innerHTML = `<div class="ai-msg-bubble">${html}</div>`;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

function _aiShowConfirmBar(show) {
  const bar = document.getElementById('ai-chat-confirm-bar');
  if (bar) bar.classList.toggle('ai-chat-hidden', !show);
}

function _escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/** Lightweight markdown-to-HTML for bot messages (bold, italic, bullets, newlines, code) */
function _aiMarkdown(text) {
  if (!text) return '';
  let html = _escapeHtml(text);
  // Code blocks (triple backtick)
  html = html.replace(/```([\s\S]*?)```/g, '<pre class="ai-code-block">$1</pre>');
  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  // Bold (**text** or __text__)
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');
  // Italic (*text* or _text_) " careful not to match inside words
  html = html.replace(/(?<!\w)\*([^*]+?)\*(?!\w)/g, '<em>$1</em>');
  html = html.replace(/(?<!\w)_([^_]+?)_(?!\w)/g, '<em>$1</em>');
  // Bullet points (lines starting with - or â€¢)
  html = html.replace(/^[\-â€¢]\s+(.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>');
  // Numbered lists (1. 2. etc)
  html = html.replace(/^\d+\.\s+(.+)$/gm, '<li>$1</li>');
  // Newlines to <br>
  html = html.replace(/\n/g, '<br>');
  return html;
}

function _detectCurrentPage() {
  // Try to detect which page is active
  const pages = ['dashboard', 'nutrition', 'tasks', 'projects', 'workout', 'statistics', 'profile'];
  for (const p of pages) {
    const el = document.getElementById(p);
    if (el && !el.classList.contains('hidden') && el.offsetParent !== null) return p;
  }
  return 'dashboard';
}

async function sendAIMessage() {
  // --- Guard 1: prevent concurrent sends ---
  if (_aiSending) return;

  // --- Guard 2: cooldown ---
  const now = Date.now();
  if (now - _aiLastSendTs < _AI_COOLDOWN_MS) {
    console.log('[AI] Cooldown active, skipping duplicate send');
    return;
  }

  const inp = document.getElementById('ai-chat-input');
  const msg = (inp?.value || '').trim();
  if (!msg) return;
  inp.value = '';

  _aiSending = true;
  _aiLastSendTs = now;

  // Show user message
  _aiAddMessage(_escapeHtml(msg), 'user');

  // Show typing indicator
  _aiAddMessage('<span class="ai-typing"><span>.</span><span>.</span><span>.</span></span>', 'bot');
  const container = document.getElementById('ai-chat-messages');

  try {
    const payload = {
      message: msg,
      mode: chatbotMode,
      context: {
        session_id: _aiSessionId(),
        current_page: _detectCurrentPage(),
        user_preferences: {
          goal: typeof profileState !== 'undefined' ? (profileState.weightGoal || 'maintenance') : 'maintenance',
          diet_type: 'mixed'
        }
      }
    };

    console.log('[AI] Sending to Gemini proxy:', payload);

    const response = await fetch('/api/ai/chat', { credentials: 'same-origin', method: 'POST',
      headers: { 'Content-Type': 'application/json'},
      body: JSON.stringify(payload)
    });

    let data = {};
    try {
      data = await response.json();
    } catch (_jsonErr) {
      data = {};
    }

    console.log('[AI] Gemini response:', data);

    if (!response.ok) {
      throw new Error(data.error || `AI request failed (${response.status})`);
    }

    // Remove typing indicator
    if (container && container.lastChild) container.removeChild(container.lastChild);

    _renderAIResponse(data);

  } catch (err) {
    if (container && container.lastChild) container.removeChild(container.lastChild);
    console.error('[AI] Error:', err);
  } finally {
    _aiSending = false;
  }
}

function _renderAIResponse(data) {
  if (!data || !data.status) {
    _aiAddMessage('I received an unexpected response. Please try again.', 'bot');
    return;
  }

  if (data.status === 'chat_response') {
    _aiAddMessage(_aiMarkdown(data.message || 'No response.'), 'bot');
    return;
  }

  if (data.status === 'clarification_needed') {
    _aiAddMessage(`<i class="fas fa-question-circle" style="color:#f59e0b;margin-right:4px"></i> ${_aiMarkdown(data.message)}`, 'bot');
    return;
  }

  if (data.status === 'manual_fallback') {
    _aiAddMessage(`<i class="fas fa-tools" style="color:#f59e0b;margin-right:4px"></i> ${_aiMarkdown(data.message || 'Please use manual forms for this entry.')}`, 'bot');
    return;
  }

  if (data.status === 'confirmation_required') {
    // Clean up old nutrition item markers from previous confirmations to prevent stale data
    document.querySelectorAll('[data-ai-item]').forEach(el => el.removeAttribute('data-ai-item'));
    aiPendingAction = data;
    let html = '';

    // Summary
    html += `<strong>${_escapeHtml(data.summary || 'Action detected')}</strong><br>`;

    if (data.confidence) {
      const confClass = data.confidence === 'high' ? 'ai-conf-high' : data.confidence === 'medium' ? 'ai-conf-med' : 'ai-conf-low';
      html += `<span class="ai-conf-badge ${confClass}" style="margin:6px 0;display:inline-flex"><i class="fas fa-${data.confidence === 'high' ? 'check-circle' : data.confidence === 'medium' ? 'info-circle' : 'exclamation-triangle'}"></i> ${data.confidence} confidence</span><br>`;
    }

    // Render EDITABLE details by action type
    if (data.action_type === 'log_nutrition' && data.details) {
      const d = data.details;
      html += `<div class="nutrition-card" style="border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; background: #fff; margin-top: 8px; animation: softPop 0.25s ease-out;">`;
      html += `<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">`;
      html += `<strong style="font-size: 1.05rem; color: #0f2538;">🥗 Log Nutrition</strong>`;
      if (data.confidence) {
        const confColor = data.confidence === 'high' ? '#10b981' : data.confidence === 'medium' ? '#f59e0b' : '#ef4444';
        const confIcon = data.confidence === 'high' ? 'check-circle' : data.confidence === 'medium' ? 'info-circle' : 'exclamation-triangle';
        html += `<span style="color: ${confColor}; font-size: 0.85rem; font-weight: 600; display: flex; align-items: center; gap: 4px;"><i class="fas fa-${confIcon}"></i> ${data.confidence.charAt(0).toUpperCase() + data.confidence.slice(1)} Confidence</span>`;
      }
      html += `</div>`;
      
      html += `<div style="margin-bottom: 16px; font-size: 0.9rem; color: #475569;">`;
      html += `Meal: <select id="ai-edit-meal-type" class="ai-edit-select" style="padding: 4px 8px; border-radius: 6px; border: 1px solid #cbd5e1; background: #f8fafc; font-weight: 500; color: #0f2538;">`;
      for (const mt of ['breakfast', 'lunch', 'dinner', 'snack']) {
        html += `<option value="${mt}"${(d.meal_type || 'snack') === mt ? ' selected' : ''}>${mt.charAt(0).toUpperCase() + mt.slice(1)}</option>`;
      }
      html += `</select></div>`;
      
      html += `<div style="display: flex; flex-direction: column; gap: 12px;">`;
      (d.items || []).forEach((item, idx) => {
        const componentsText = Array.isArray(item.components)
          ? item.components.map(c => `${c.item || ''} (${c.qty || ''})`).filter(Boolean).join(', ')
          : '';
        // Compute per-unit base macros for qty scaling
        const bq = parseFloat(item.quantity) || 1;
        const bCal = bq > 0 ? item.calories / bq : item.calories;
        const bP = bq > 0 ? item.protein / bq : item.protein;
        const bC = bq > 0 ? item.carbs / bq : item.carbs;
        const bF = bq > 0 ? item.fats / bq : item.fats;
        
        html += `<div data-ai-item="${idx}" data-base-cal="${bCal}" data-base-p="${bP}" data-base-c="${bC}" data-base-f="${bF}" style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px; position: relative;">`;
        html += `<button class="ai-edit-del" onclick="_aiRemoveItem(${idx})" title="Remove" style="position: absolute; top: 12px; right: 12px; background: none; border: none; color: #ef4444; cursor: pointer; padding: 4px; border-radius: 4px;"><i class="fas fa-trash-alt"></i></button>`;
        
        html += `<div style="display: flex; gap: 8px; margin-bottom: 12px; padding-right: 24px;">`;
        html += `<input class="ai-edit-input ai-edit-name food-input" data-idx="${idx}" value="${_escapeHtml(item.name)}" style="flex: 1; font-weight: 600; color: #0f2538; border: 1px solid #cbd5e1; border-radius: 8px; padding: 6px 10px;" placeholder="Food name">`;
        html += `<div style="display: flex; align-items: center; gap: 4px; background: #fff; border: 1px solid #cbd5e1; border-radius: 8px; padding: 2px 8px;"><span style="font-size: 0.8rem; color: #64748b;">Qty</span><input class="ai-edit-input ai-edit-qty food-input" data-idx="${idx}" type="number" min="0" step="0.5" value="${item.quantity}" oninput="_aiOnQtyChange(${idx})" style="width: 40px; border: none; background: transparent; font-weight: 600; color: #0f2538; text-align: center; padding: 4px 0;"></div>`;
        html += `</div>`;
        
        if (componentsText) {
          html += `<input class="ai-edit-input ai-edit-components food-input" data-idx="${idx}" value="${_escapeHtml(componentsText)}" style="width: 100%; margin-bottom: 12px; font-size: 0.85rem; color: #64748b; border: 1px solid #e2e8f0; border-radius: 6px; padding: 4px 8px; background: #fff;" placeholder="Components">`;
        }
        
        html += `<div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px;">`;
        
        // Calories (Prominent)
        html += `<div style="display: flex; align-items: center; justify-content: space-between; background: #fff5eb; border: 1px solid #fed7aa; border-radius: 8px; padding: 8px 12px;">`;
        html += `<span style="font-size: 0.85rem; font-weight: 600; color: #ea580c; display: flex; align-items: center; gap: 6px;">🔥 Calories</span>`;
        html += `<div style="display: flex; align-items: center; gap: 4px;"><input class="ai-edit-input ai-edit-cal calorie-input" data-idx="${idx}" type="number" min="0" value="${item.calories}" oninput="_aiOnMacroEdit(${idx})" style="width: 50px; border: none; background: transparent; font-weight: 700; color: #ea580c; text-align: right; font-size: 15px;"> <span style="font-size: 0.8rem; color: #ea580c; font-weight: 600;">kcal</span></div>`;
        html += `</div>`;
        
        // Protein
        html += `<div class="macro-pill" style="display: flex; align-items: center; justify-content: space-between; background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 8px 12px;">`;
        html += `<span style="font-size: 0.85rem; font-weight: 600; color: #dc2626; display: flex; align-items: center; gap: 6px;">🥩 Protein</span>`;
        html += `<div style="display: flex; align-items: center; gap: 4px;"><input class="ai-edit-input ai-edit-p" data-idx="${idx}" type="number" min="0" step="0.1" value="${item.protein}" oninput="_aiOnMacroEdit(${idx})" style="width: 40px; border: none; background: transparent; font-weight: 600; color: #dc2626; text-align: right;"> <span style="font-size: 0.8rem; color: #dc2626; font-weight: 600;">g</span></div>`;
        html += `</div>`;
        
        // Carbs
        html += `<div class="macro-pill" style="display: flex; align-items: center; justify-content: space-between; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 8px 12px;">`;
        html += `<span style="font-size: 0.85rem; font-weight: 600; color: #2563eb; display: flex; align-items: center; gap: 6px;">🍞 Carbs</span>`;
        html += `<div style="display: flex; align-items: center; gap: 4px;"><input class="ai-edit-input ai-edit-c" data-idx="${idx}" type="number" min="0" step="0.1" value="${item.carbs}" oninput="_aiOnMacroEdit(${idx})" style="width: 40px; border: none; background: transparent; font-weight: 600; color: #2563eb; text-align: right;"> <span style="font-size: 0.8rem; color: #2563eb; font-weight: 600;">g</span></div>`;
        html += `</div>`;
        
        // Fats
        html += `<div class="macro-pill" style="display: flex; align-items: center; justify-content: space-between; background: #fefce8; border: 1px solid #fef08a; border-radius: 8px; padding: 8px 12px;">`;
        html += `<span style="font-size: 0.85rem; font-weight: 600; color: #ca8a04; display: flex; align-items: center; gap: 6px;">🧈 Fats</span>`;
        html += `<div style="display: flex; align-items: center; gap: 4px;"><input class="ai-edit-input ai-edit-f" data-idx="${idx}" type="number" min="0" step="0.1" value="${item.fats}" oninput="_aiOnMacroEdit(${idx})" style="width: 40px; border: none; background: transparent; font-weight: 600; color: #ca8a04; text-align: right;"> <span style="font-size: 0.8rem; color: #ca8a04; font-weight: 600;">g</span></div>`;
        html += `</div>`;
        
        html += `</div></div>`;
      });
      html += `</div>`;
      
      html += `<div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center;">`;
      html += `<button class="ai-edit-add-btn" onclick="_aiAddItem()" style="background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; padding: 6px 12px; border-radius: 6px; font-size: 0.85rem; font-weight: 600; cursor: pointer; transition: all 0.2s;"><i class="fas fa-plus"></i> Add Item</button>`;
      html += `<span style="font-size: 0.8rem; color: #64748b;"><i class="fas fa-pencil-alt"></i> Edit before confirm</span>`;
      html += `</div>`;
      html += `</div>`;
    } else if (data.action_type === 'add_task' && data.details) {
      const d = data.details;
      html += `<div class="ai-chat-detail ai-edit-task-form">`;
      html += `📋 <label>Title:</label> <input class="ai-edit-input ai-edit-task-title" value="${_escapeHtml(d.title)}" style="width:100%"><br>`;
      html += `📅 <label>Date:</label> <input class="ai-edit-input ai-edit-task-date" type="date" value="${d.date || ''}"><br>`;
      html += `âš¡ <label>Priority:</label> <select class="ai-edit-select ai-edit-task-priority">`;
      for (const p of ['low', 'medium', 'high']) {
        html += `<option value="${p}"${(d.priority || 'medium') === p ? ' selected' : ''}>${p.charAt(0).toUpperCase() + p.slice(1)}</option>`;
      }
      html += `</select><br>`;
      html += `🏷️ <label>Tags:</label> <input class="ai-edit-input ai-edit-task-tags" value="${(d.tags || []).map(t => '#' + t).join(' ')}" placeholder="#tag1 #tag2">`;
      html += `</div>`;
    } else if (data.action_type === 'log_workout' && data.details) {
      const d = data.details;
      html += `<div class="ai-chat-detail ai-edit-workout-form">`;
      html += `🏋️ <label>Name:</label> <input class="ai-edit-input ai-edit-workout-name" value="${_escapeHtml(d.name || '')}" style="width:100%"><br>`;
      html += `🏃 <label>Type:</label> <select class="ai-edit-select ai-edit-workout-type">`;
      for (const t of ['cardio', 'strength', 'flexibility', 'hiit', 'sports', 'other']) {
        html += `<option value="${t}"${(d.type || 'other') === t ? ' selected' : ''}>${t.charAt(0).toUpperCase() + t.slice(1)}</option>`;
      }
      html += `</select><br>`;
      html += `⏱️ <label>Duration (min):</label> <input class="ai-edit-input ai-edit-workout-duration" type="number" min="0" value="${d.duration || 0}" style="width:60px"><br>`;
      html += `🔥 <label>Calories burned:</label> <input class="ai-edit-input ai-edit-workout-cals" type="number" min="0" value="${d.calories_burned || 0}" style="width:60px"><br>`;
      html += `💪 <label>Intensity:</label> <select class="ai-edit-select ai-edit-workout-intensity">`;
      for (const i of ['low', 'medium', 'high']) {
        html += `<option value="${i}"${(d.intensity || 'medium') === i ? ' selected' : ''}>${i.charAt(0).toUpperCase() + i.slice(1)}</option>`;
      }
      html += `</select><br>`;
      if (d.exercises && d.exercises.length) {
        html += `<label>Exercises:</label><br>`;
        d.exercises.forEach((ex, idx) => {
          html += `<div class="ai-edit-subtask-row"><input class="ai-edit-input ai-edit-exercise" data-idx="${idx}" value="${_escapeHtml(typeof ex === 'string' ? ex : (ex.name || ''))}" style="flex:1"></div>`;
        });
      }
      html += `📄 <label>Notes:</label> <input class="ai-edit-input ai-edit-workout-notes" value="${_escapeHtml(d.notes || '')}" style="width:100%">`;
      html += `</div>`;
    } else if (data.action_type === 'add_project' && data.details) {
      const d = data.details;
      html += `<div class="ai-chat-detail ai-edit-project-form">`;
      html += `📄 <label>Name:</label> <input class="ai-edit-input ai-edit-proj-name" value="${_escapeHtml(d.name)}" style="width:100%"><br>`;
      html += `📄 <label>Description:</label> <input class="ai-edit-input ai-edit-proj-desc" value="${_escapeHtml(d.description || '')}" style="width:100%"><br>`;
      if (d.subtasks && d.subtasks.length) {
        html += `<br><small>Subtasks:</small><br>`;
        d.subtasks.forEach((st, i) => {
          html += `<div class="ai-edit-subtask-row"><input class="ai-edit-input ai-edit-subtask" data-idx="${i}" value="${_escapeHtml(st)}"> <button class="ai-edit-del" onclick="_aiRemoveSubtask(${i})" title="Remove"><i class="fas fa-trash-alt"></i></button></div>`;
        });
      }
      html += `<button class="ai-edit-add-btn" onclick="_aiAddSubtask()"><i class="fas fa-plus"></i> Add subtask</button>`;
      html += `</div>`;
    }

    html += `<br><small>âœï¸ Edit any field above, then Confirm or Cancel.</small>`;
    _aiAddMessage(html, 'bot');
    _aiShowConfirmBar(true);
    return;
  }

  // Unknown status
  _aiAddMessage(data.message || JSON.stringify(data), 'bot');
}

async function aiConfirmAction() {
  if (!aiPendingAction) return;
  _aiSyncEditsToPayload(); // read any edited values from inline form
  _aiShowConfirmBar(false);

  const data = aiPendingAction;
  aiPendingAction = null;
  // Strip old nutrition item markers so they can't leak into future confirmations
  document.querySelectorAll('[data-ai-item]').forEach(el => el.removeAttribute('data-ai-item'));

  _aiAddMessage('<span class="ai-typing"><span>.</span><span>.</span><span>.</span></span>', 'bot');
  const container = document.getElementById('ai-chat-messages');

  try {
    let result;

    const response = await fetch('/api/ai/execute', { credentials: 'same-origin', method: 'POST',
      headers: { 'Content-Type': 'application/json'},
      body: JSON.stringify({
        confirmed: true,
        action_type: data.action_type,
        payload: data.details
      })
    });
    result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Execution failed');

    if (container && container.lastChild) container.removeChild(container.lastChild);

    if (result.status === 'executed') {
      let msg = '<i class="fas fa-check-circle" style="color:#10b981"></i> ';
      if (result.action_type === 'log_nutrition') {
        const firstItemName = data.details.items && data.details.items.length > 0 ? data.details.items[0].name : 'food';
        const mealType = data.details.meal_type ? data.details.meal_type.charAt(0).toUpperCase() + data.details.meal_type.slice(1) : 'Snack';
        msg += `Logged ${firstItemName}${data.details.items.length > 1 ? ` and ${data.details.items.length - 1} other item(s)` : ''} as ${mealType} 🍽️<br><br>Want to add another item or finish?`;
        if (typeof loadMeals === 'function') loadMeals();
        if (typeof refreshStreaksAfterChange === 'function') refreshStreaksAfterChange();
      } else if (result.action_type === 'add_task') {
        msg += `Task "${_escapeHtml(result.task?.title || '')}" is on your list! 📋 Check your Tasks page or Calendar.`;
        if (typeof loadTasks === 'function') loadTasks();
        if (typeof renderCalendar === 'function') renderCalendar();
        if (typeof refreshStreaksAfterChange === 'function') refreshStreaksAfterChange();
      } else if (result.action_type === 'log_workout') {
        msg += `Workout "${_escapeHtml(result.workout?.name || '')}" logged! 🏋️ Check your Workout page.`;
        if (typeof loadWorkoutsForPage === 'function') loadWorkoutsForPage();
        if (typeof refreshStreaksAfterChange === 'function') refreshStreaksAfterChange();
      } else if (result.action_type === 'add_project') {
        msg += `Project "${_escapeHtml(result.project?.name || '')}" created! 📄`;
      }
      _aiAddMessage(msg, 'bot');
    } else {
      _aiAddMessage('Action completed.', 'bot');
    }

  } catch (err) {
    if (container && container.lastChild) container.removeChild(container.lastChild);
    _aiAddMessage(`<i class="fas fa-exclamation-triangle"></i> ${_escapeHtml(err.message)}`, 'bot');
  }
}

/** Read edited values from the inline form back into aiPendingAction before confirming */
function _aiSyncEditsToPayload() {
  if (!aiPendingAction) return;
  const d = aiPendingAction.details;

  if (aiPendingAction.action_type === 'log_nutrition' && d) {
    // Meal type
    const mtSel = document.querySelector('#ai-edit-meal-type');
    if (mtSel) d.meal_type = mtSel.value;

    // Items " scope to the LAST nutrition card to avoid picking up old confirmed meals
    const activeCard = Array.from(document.querySelectorAll('.nutrition-card')).pop();
    const rows = activeCard ? activeCard.querySelectorAll('[data-ai-item]') : document.querySelectorAll('[data-ai-item]');
    const newItems = [];
    rows.forEach((row) => {
      const idx = parseInt(row.dataset.aiItem, 10);
      const nameEl = row.querySelector('.ai-edit-name');
      const qtyEl = row.querySelector('.ai-edit-qty');
      const calEl = row.querySelector('.ai-edit-cal');
      const pEl = row.querySelector('.ai-edit-p');
      const cEl = row.querySelector('.ai-edit-c');
      const fEl = row.querySelector('.ai-edit-f');
      const compsEl = row.querySelector('.ai-edit-components');
      const components = (compsEl?.value || '')
        .split(',')
        .map(s => s.trim())
        .filter(Boolean)
        .map(raw => {
          const m = raw.match(/^(.*)\((.*)\)$/);
          if (m) return { item: m[1].trim(), qty: m[2].trim() || '1 serving' };
          return { item: raw, qty: '1 serving' };
        });
      newItems.push({
        name: nameEl ? nameEl.value.trim() || 'Item' : (d.items[idx]?.name || 'Item'),
        quantity: qtyEl ? parseFloat(qtyEl.value) || 1 : 1,
        unit: d.items[idx]?.unit || 'serving',
        components,
        calories: calEl ? parseInt(calEl.value) || 0 : 0,
        protein: pEl ? parseFloat(pEl.value) || 0 : 0,
        carbs: cEl ? parseFloat(cEl.value) || 0 : 0,
        fats: fEl ? parseFloat(fEl.value) || 0 : 0,
        is_estimate: d.items[idx]?.is_estimate ?? true,
        note: d.items[idx]?.note || ''
      });
    });
    d.items = newItems;
    d.total = {
      calories: newItems.reduce((s, i) => s + i.calories, 0),
      protein: Math.round(newItems.reduce((s, i) => s + i.protein, 0) * 10) / 10,
      carbs: Math.round(newItems.reduce((s, i) => s + i.carbs, 0) * 10) / 10,
      fats: Math.round(newItems.reduce((s, i) => s + i.fats, 0) * 10) / 10,
    };
  }

  if (aiPendingAction.action_type === 'add_task' && d) {
    const titleEl = document.querySelector('.ai-edit-task-title');
    const dateEl = document.querySelector('.ai-edit-task-date');
    const prioEl = document.querySelector('.ai-edit-task-priority');
    const tagsEl = document.querySelector('.ai-edit-task-tags');
    if (titleEl) d.title = titleEl.value.trim() || d.title;
    if (dateEl) d.date = dateEl.value || d.date;
    if (prioEl) d.priority = prioEl.value || d.priority;
    if (tagsEl) d.tags = (tagsEl.value.match(/#(\w+)/g) || []).map(t => t.slice(1));
  }

  if (aiPendingAction.action_type === 'log_workout' && d) {
    const nameEl = document.querySelector('.ai-edit-workout-name');
    const typeEl = document.querySelector('.ai-edit-workout-type');
    const durEl = document.querySelector('.ai-edit-workout-duration');
    const calsEl = document.querySelector('.ai-edit-workout-cals');
    const intEl = document.querySelector('.ai-edit-workout-intensity');
    const notesEl = document.querySelector('.ai-edit-workout-notes');
    if (nameEl) d.name = nameEl.value.trim() || d.name;
    if (typeEl) d.type = typeEl.value || d.type;
    if (durEl) d.duration = parseInt(durEl.value) || 0;
    if (calsEl) d.calories_burned = parseInt(calsEl.value) || 0;
    if (intEl) d.intensity = intEl.value || d.intensity;
    if (notesEl) d.notes = notesEl.value.trim();
    const exerciseEls = document.querySelectorAll('.ai-edit-exercise');
    if (exerciseEls.length) {
      d.exercises = Array.from(exerciseEls).map(el => el.value.trim()).filter(Boolean);
    }
  }

  if (aiPendingAction.action_type === 'add_project' && d) {
    const nameEl = document.querySelector('.ai-edit-proj-name');
    const descEl = document.querySelector('.ai-edit-proj-desc');
    if (nameEl) d.name = nameEl.value.trim() || d.name;
    if (descEl) d.description = descEl.value.trim();
    const subtaskEls = document.querySelectorAll('.ai-edit-subtask');
    if (subtaskEls.length) {
      d.subtasks = Array.from(subtaskEls).map(el => el.value.trim()).filter(Boolean);
    }
  }
}

/** Recalculate macros when user changes quantity */
function _aiOnQtyChange(idx) {
  const activeCard = Array.from(document.querySelectorAll('.nutrition-card')).pop();
  if (!activeCard) return;
  const card = activeCard.querySelector(`[data-ai-item="${idx}"]`);
  if (!card) return;
  const qty = parseFloat(card.querySelector('.ai-edit-qty')?.value) || 1;
  const baseCal = parseFloat(card.dataset.baseCal) || 0;
  const baseP = parseFloat(card.dataset.baseP) || 0;
  const baseC = parseFloat(card.dataset.baseC) || 0;
  const baseF = parseFloat(card.dataset.baseF) || 0;
  const calInput = card.querySelector('.ai-edit-cal');
  const pInput = card.querySelector('.ai-edit-p');
  const cInput = card.querySelector('.ai-edit-c');
  const fInput = card.querySelector('.ai-edit-f');
  if (calInput) calInput.value = Math.round(baseCal * qty);
  if (pInput) pInput.value = Math.round(baseP * qty * 10) / 10;
  if (cInput) cInput.value = Math.round(baseC * qty * 10) / 10;
  if (fInput) fInput.value = Math.round(baseF * qty * 10) / 10;
}

/** When user manually edits a macro, update its per-unit base so future qty changes stay proportional */
function _aiOnMacroEdit(idx) {
  const activeCard = Array.from(document.querySelectorAll('.nutrition-card')).pop();
  if (!activeCard) return;
  const card = activeCard.querySelector(`[data-ai-item="${idx}"]`);
  if (!card) return;
  const qty = parseFloat(card.querySelector('.ai-edit-qty')?.value) || 1;
  const calInput = card.querySelector('.ai-edit-cal');
  const pInput = card.querySelector('.ai-edit-p');
  const cInput = card.querySelector('.ai-edit-c');
  const fInput = card.querySelector('.ai-edit-f');
  if (calInput) card.dataset.baseCal = (parseFloat(calInput.value) || 0) / qty;
  if (pInput) card.dataset.baseP = (parseFloat(pInput.value) || 0) / qty;
  if (cInput) card.dataset.baseC = (parseFloat(cInput.value) || 0) / qty;
  if (fInput) card.dataset.baseF = (parseFloat(fInput.value) || 0) / qty;
}

/** Remove a nutrition item card */
function _aiRemoveItem(idx) {
  const activeCard = Array.from(document.querySelectorAll('.nutrition-card')).pop();
  const row = activeCard ? activeCard.querySelector(`[data-ai-item="${idx}"]`) : document.querySelector(`[data-ai-item="${idx}"]`);
  if (row) row.remove();
  // Re-index remaining cards and update inline handlers
  const remaining = activeCard ? activeCard.querySelectorAll('[data-ai-item]') : document.querySelectorAll('[data-ai-item]');
  remaining.forEach((r, i) => {
    r.dataset.aiItem = i;
    r.querySelectorAll('[data-idx]').forEach(el => { el.dataset.idx = i; });
    const delBtn = r.querySelector('.ai-edit-del');
    if (delBtn) delBtn.setAttribute('onclick', `_aiRemoveItem(${i})`);
    const qtyEl = r.querySelector('.ai-edit-qty');
    if (qtyEl) qtyEl.setAttribute('oninput', `_aiOnQtyChange(${i})`);
    r.querySelectorAll('.ai-edit-cal, .ai-edit-p, .ai-edit-c, .ai-edit-f').forEach(el => {
      el.setAttribute('oninput', `_aiOnMacroEdit(${i})`);
    });
  });
  if (aiPendingAction?.details?.items) {
    aiPendingAction.details.items.splice(idx, 1);
  }
}

/** Add new blank nutrition item card */
function _aiAddItem() {
  if (!aiPendingAction?.details?.items) return;
  const newIdx = aiPendingAction.details.items.length;
  aiPendingAction.details.items.push({ name: '', quantity: 1, unit: 'serving', components: [], calories: 0, protein: 0, carbs: 0, fats: 0, is_estimate: true, note: '' });
  // Scope to the LAST nutrition card
  const activeNutritionCard = Array.from(document.querySelectorAll('.nutrition-card')).pop();
  if (!activeNutritionCard) return;
  const existingItems = activeNutritionCard.querySelectorAll('[data-ai-item]');
  const container = existingItems.length > 0 ? existingItems[0].parentElement : activeNutritionCard.querySelector('div[style*="flex-direction"]');
  if (!container) return;
  const card = document.createElement('div');
  card.dataset.aiItem = newIdx;
  card.dataset.baseCal = '0';
  card.dataset.baseP = '0';
  card.dataset.baseC = '0';
  card.dataset.baseF = '0';
  card.style.cssText = 'background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px; position: relative;';
  card.innerHTML = `<button class="ai-edit-del" onclick="_aiRemoveItem(${newIdx})" title="Remove" style="position: absolute; top: 12px; right: 12px; background: none; border: none; color: #ef4444; cursor: pointer; padding: 4px; border-radius: 4px;"><i class="fas fa-trash-alt"></i></button><div style="display: flex; gap: 8px; margin-bottom: 12px; padding-right: 24px;"><input class="ai-edit-input ai-edit-name food-input" data-idx="${newIdx}" value="" style="flex: 1; font-weight: 600; color: #0f2538; border: 1px solid #cbd5e1; border-radius: 8px; padding: 6px 10px;" placeholder="Food name"><div style="display: flex; align-items: center; gap: 4px; background: #fff; border: 1px solid #cbd5e1; border-radius: 8px; padding: 2px 8px;"><span style="font-size: 0.8rem; color: #64748b;">Qty</span><input class="ai-edit-input ai-edit-qty food-input" data-idx="${newIdx}" type="number" min="0" step="0.5" value="1" oninput="_aiOnQtyChange(${newIdx})" style="width: 40px; border: none; background: transparent; font-weight: 600; color: #0f2538; text-align: center; padding: 4px 0;"></div></div><div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px;"><div style="display: flex; align-items: center; justify-content: space-between; background: #fff5eb; border: 1px solid #fed7aa; border-radius: 8px; padding: 8px 12px;"><span style="font-size: 0.85rem; font-weight: 600; color: #ea580c; display: flex; align-items: center; gap: 6px;">🔥 Calories</span><div style="display: flex; align-items: center; gap: 4px;"><input class="ai-edit-input ai-edit-cal calorie-input" data-idx="${newIdx}" type="number" min="0" value="0" oninput="_aiOnMacroEdit(${newIdx})" style="width: 50px; border: none; background: transparent; font-weight: 700; color: #ea580c; text-align: right; font-size: 15px;"> <span style="font-size: 0.8rem; color: #ea580c; font-weight: 600;">kcal</span></div></div><div style="display: flex; align-items: center; justify-content: space-between; background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 8px 12px;"><span style="font-size: 0.85rem; font-weight: 600; color: #dc2626; display: flex; align-items: center; gap: 6px;">🥩 Protein</span><div style="display: flex; align-items: center; gap: 4px;"><input class="ai-edit-input ai-edit-p" data-idx="${newIdx}" type="number" min="0" step="0.1" value="0" oninput="_aiOnMacroEdit(${newIdx})" style="width: 40px; border: none; background: transparent; font-weight: 600; color: #dc2626; text-align: right;"> <span style="font-size: 0.8rem; color: #dc2626; font-weight: 600;">g</span></div></div><div style="display: flex; align-items: center; justify-content: space-between; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 8px 12px;"><span style="font-size: 0.85rem; font-weight: 600; color: #2563eb; display: flex; align-items: center; gap: 6px;">🍞 Carbs</span><div style="display: flex; align-items: center; gap: 4px;"><input class="ai-edit-input ai-edit-c" data-idx="${newIdx}" type="number" min="0" step="0.1" value="0" oninput="_aiOnMacroEdit(${newIdx})" style="width: 40px; border: none; background: transparent; font-weight: 600; color: #2563eb; text-align: right;"> <span style="font-size: 0.8rem; color: #2563eb; font-weight: 600;">g</span></div></div><div style="display: flex; align-items: center; justify-content: space-between; background: #fefce8; border: 1px solid #fef08a; border-radius: 8px; padding: 8px 12px;"><span style="font-size: 0.85rem; font-weight: 600; color: #ca8a04; display: flex; align-items: center; gap: 6px;">🧈 Fats</span><div style="display: flex; align-items: center; gap: 4px;"><input class="ai-edit-input ai-edit-f" data-idx="${newIdx}" type="number" min="0" step="0.1" value="0" oninput="_aiOnMacroEdit(${newIdx})" style="width: 40px; border: none; background: transparent; font-weight: 600; color: #ca8a04; text-align: right;"> <span style="font-size: 0.8rem; color: #ca8a04; font-weight: 600;">g</span></div></div></div>`;
  container.appendChild(card);
  card.querySelector('.ai-edit-name')?.focus();
}

/** Remove a project subtask */
function _aiRemoveSubtask(idx) {
  const rows = document.querySelectorAll('.ai-edit-subtask-row');
  if (rows[idx]) rows[idx].remove();
  if (aiPendingAction?.details?.subtasks) {
    aiPendingAction.details.subtasks.splice(idx, 1);
  }
}

/** Add a project subtask */
function _aiAddSubtask() {
  if (!aiPendingAction?.details) return;
  if (!aiPendingAction.details.subtasks) aiPendingAction.details.subtasks = [];
  const idx = aiPendingAction.details.subtasks.length;
  aiPendingAction.details.subtasks.push('');
  const container = document.querySelector('.ai-edit-project-form');
  if (!container) return;
  const addBtn = container.querySelector('.ai-edit-add-btn');
  const div = document.createElement('div');
  div.className = 'ai-edit-subtask-row';
  div.innerHTML = `<input class="ai-edit-input ai-edit-subtask" data-idx="${idx}" value="" placeholder="Subtask name"> <button class="ai-edit-del" onclick="_aiRemoveSubtask(${idx})" title="Remove"><i class="fas fa-trash-alt"></i></button>`;
  if (addBtn) container.insertBefore(div, addBtn);
  else container.appendChild(div);
  div.querySelector('.ai-edit-subtask')?.focus();
}

function aiEditAction() {
  // Edit now just focuses the first editable field " the form is already inline
  _aiShowConfirmBar(true); // keep confirm bar visible
  const firstInput = document.querySelector('.ai-edit-input');
  if (firstInput) {
    firstInput.focus();
    firstInput.select();
    _aiAddMessage('âœï¸ Edit the fields above and click <strong>Confirm</strong> when ready, or <strong>Cancel</strong> to discard.', 'bot');
  } else {
    _aiAddMessage('No editable fields found. Try rephrasing your request.', 'bot');
    aiPendingAction = null;
    _aiShowConfirmBar(false);
  }
}

function aiCancelAction() {
  _aiShowConfirmBar(false);
  aiPendingAction = null;
  // Strip old nutrition item markers
  document.querySelectorAll('[data-ai-item]').forEach(el => el.removeAttribute('data-ai-item'));
  _aiAddMessage('Action cancelled. Let me know if you need anything else!', 'bot');
}

function _aiLocalParseWorkout(msg) {
  const lower = msg.toLowerCase();
  let name = 'Workout', type = 'general', duration = 0, calories_burned = 0;
  let intensity = 'medium', exercises = [], notes = '';

  const typeMap = {
    'cardio': 'cardio', 'running': 'cardio', 'run': 'cardio', 'jogging': 'cardio', 'jog': 'cardio',
    'cycling': 'cardio', 'bike': 'cardio', 'swimming': 'cardio', 'swim': 'cardio',
    'walking': 'cardio', 'walk': 'cardio', 'hiit': 'cardio', 'jumping': 'cardio',
    'strength': 'strength', 'weight': 'strength', 'lifting': 'strength', 'gym': 'strength',
    'push': 'strength', 'pull': 'strength', 'squat': 'strength', 'deadlift': 'strength',
    'bench': 'strength', 'curl': 'strength', 'press': 'strength',
    'yoga': 'flexibility', 'stretch': 'flexibility', 'pilates': 'flexibility',
    'sports': 'sports', 'basketball': 'sports', 'football': 'sports', 'soccer': 'sports',
    'cricket': 'sports', 'badminton': 'sports', 'tennis': 'sports', 'volleyball': 'sports'
  };
  for (const [kw, t] of Object.entries(typeMap)) {
    if (lower.includes(kw)) { type = t; name = kw.charAt(0).toUpperCase() + kw.slice(1); break; }
  }

  const durMatch = lower.match(/(\d+)\s*(?:min(?:ute)?s?|hrs?|hours?)/);
  if (durMatch) { duration = parseInt(durMatch[1]); if (lower.includes('hour') || lower.includes('hr')) duration *= 60; }

  const calMatch = lower.match(/(?:burn(?:ed|t)?|cal(?:orie)?s?)\s*[:=]?\s*(\d+)/i) || lower.match(/(\d+)\s*(?:cal(?:orie)?s?\s*(?:burn(?:ed)?)?|kcal)/i);
  if (calMatch) calories_burned = parseInt(calMatch[1]);

  if (lower.includes('light') || lower.includes('easy')) intensity = 'light';
  else if (lower.includes('intense') || lower.includes('hard') || lower.includes('heavy') || lower.includes('high')) intensity = 'high';

  const exSegs = msg.split(/,|\band\b|\+|;/i).map(s => s.trim()).filter(Boolean);
  if (exSegs.length > 1) {
    exercises = exSegs.map(s => s.replace(/\d+\s*(?:min(?:ute)?s?|hrs?|hours?|cal(?:orie)?s?|kcal)\s*/gi, '').trim()).filter(s => s.length > 1 && s.length < 60);
  }

  if (!calories_burned && duration > 0) {
    const rateMap = { cardio: 10, strength: 7, flexibility: 4, sports: 8, general: 6 };
    calories_burned = Math.round(duration * (rateMap[type] || 6));
  }

  if (name === 'Workout' && exercises.length) name = exercises[0];
  const today = typeof todayDateKey === 'function' ? todayDateKey() : new Date().toISOString().slice(0, 10);

  return {
    status: 'confirmation_required', action_type: 'log_workout',
    summary: `Log workout: ${name} (${duration} min, ~${calories_burned} cal)`,
    details: { name, type, duration, calories_burned, intensity, exercises, notes, date: today },
    confidence: duration > 0 ? 'medium' : 'low',
    message: 'These are estimated values. Please review and confirm, edit, or cancel.'
  };
}

// --- Local parser: Task ---
function _aiLocalParseTask(msg) {
  const lower = msg.toLowerCase();
  let title = msg.replace(/(?:add|create|new|make)\s*(?:a\s*)?(?:task|todo|to-do|reminder)\s*:?\s*/i, '').trim();
  title = title.replace(/(?:i need to|i have to|i must|remind me to|i should|i gotta)\s*/i, '').trim() || 'Untitled Task';
  const today = typeof todayDateKey === 'function' ? todayDateKey() : new Date().toISOString().slice(0, 10);
  let priority = 'medium';
  if (lower.includes('urgent') || lower.includes('high priority') || lower.includes('important')) priority = 'high';
  else if (lower.includes('low priority') || lower.includes('minor')) priority = 'low';
  let date = today;
  if (lower.includes('tomorrow')) {
    const d = new Date(); d.setDate(d.getDate() + 1);
    date = d.toISOString().slice(0, 10);
    title = title.replace(/\s*(?:by\s+)?tomorrow\s*/i, '').trim();
  }
  return {
    status: 'confirmation_required', action_type: 'add_task',
    summary: 'Create task: ' + title,
    details: { title, description: '', category: 'general', priority, date, tags: [] },
    confidence: 'high', message: 'Please confirm, edit, or cancel.'
  };
}

// --- Local parser: Nutrition ---
function _aiLocalParseNutrition(msg) {
  const lower = msg.toLowerCase();
  const indianFoods = {
    // Indian staples
    roti: {cal:120, p:3, c:20, f:3.5}, chapati: {cal:120, p:3, c:20, f:3.5},
    naan: {cal:260, p:9, c:45, f:5}, paratha: {cal:230, p:5, c:30, f:10},
    'aloo paratha': {cal:280, p:6, c:38, f:12}, 'gobi paratha': {cal:260, p:6, c:35, f:11},
    'paneer paratha': {cal:300, p:10, c:32, f:15},
    dal: {cal:180, p:12, c:24, f:4}, 'dal chawal': {cal:350, p:14, c:58, f:6},
    rice: {cal:200, p:4, c:45, f:0.5},
    biryani: {cal:450, p:18, c:52, f:18}, 'chicken biryani': {cal:500, p:25, c:52, f:20},
    'paneer butter masala': {cal:400, p:18, c:15, f:30}, 'butter chicken': {cal:440, p:28, c:12, f:32},
    chole: {cal:240, p:12, c:36, f:6}, 'chana masala': {cal:240, p:12, c:36, f:6},
    rajma: {cal:220, p:14, c:35, f:3}, 'palak paneer': {cal:300, p:16, c:10, f:22},
    'aloo gobi': {cal:180, p:5, c:25, f:7},
    samosa: {cal:260, p:5, c:30, f:14}, 'pav bhaji': {cal:400, p:10, c:50, f:18},
    'vada pav': {cal:300, p:6, c:40, f:13},
    dosa: {cal:170, p:4, c:28, f:5}, 'masala dosa': {cal:280, p:6, c:38, f:12},
    idli: {cal:60, p:2, c:12, f:0.5},
    poha: {cal:180, p:4, c:32, f:5}, upma: {cal:200, p:5, c:28, f:8},
    khichdi: {cal:220, p:8, c:35, f:5},
    chai: {cal:80, p:2, c:12, f:2.5}, lassi: {cal:180, p:5, c:28, f:5},
    // Proteins
    egg: {cal:78, p:6, c:0.6, f:5}, 'boiled egg': {cal:78, p:6, c:0.6, f:5},
    omelette: {cal:154, p:11, c:1, f:12}, 'egg bhurji': {cal:180, p:12, c:2, f:14},
    paneer: {cal:260, p:18, c:4, f:20}, chicken: {cal:165, p:31, c:0, f:3.6},
    'chicken breast': {cal:165, p:31, c:0, f:3.6}, 'chicken curry': {cal:250, p:20, c:8, f:15},
    fish: {cal:206, p:22, c:0, f:12}, 'fish curry': {cal:250, p:20, c:8, f:15},
    // Global / compound foods
    'peanut butter sandwich': {cal:350, p:14, c:31, f:18},
    'peanut butter': {cal:190, p:8, c:6, f:16}, sandwich: {cal:250, p:12, c:30, f:10},
    toast: {cal:80, p:3, c:14, f:1}, bread: {cal:80, p:3, c:14, f:1},
    'protein shake': {cal:250, p:30, c:12, f:5}, 'whey protein': {cal:120, p:24, c:3, f:1.5},
    'peanut butter toast': {cal:270, p:11, c:20, f:17},
    pasta: {cal:350, p:12, c:60, f:5}, pizza: {cal:270, p:12, c:33, f:10},
    burger: {cal:350, p:20, c:30, f:16}, fries: {cal:310, p:4, c:42, f:15},
    salad: {cal:120, p:4, c:12, f:6}, 'chicken salad': {cal:250, p:28, c:10, f:12},
    wrap: {cal:300, p:15, c:32, f:12}, 'chicken wrap': {cal:350, p:25, c:30, f:14},
    smoothie: {cal:200, p:8, c:35, f:4}, 'protein smoothie': {cal:280, p:25, c:28, f:8},
    coffee: {cal:5, p:0.3, c:0, f:0}, 'black coffee': {cal:5, p:0.3, c:0, f:0},
    latte: {cal:150, p:8, c:15, f:6}, cappuccino: {cal:120, p:6, c:12, f:5},
    juice: {cal:110, p:1, c:26, f:0.3}, 'orange juice': {cal:110, p:1, c:26, f:0.3},
    // Dairy & snacks
    milk: {cal:120, p:6, c:10, f:6}, curd: {cal:60, p:3, c:5, f:3}, yogurt: {cal:60, p:3, c:5, f:3},
    'greek yogurt': {cal:100, p:17, c:6, f:0.7},
    cheese: {cal:110, p:7, c:0.4, f:9},
    // Fruits
    banana: {cal:105, p:1.3, c:27, f:0.4}, apple: {cal:95, p:0.5, c:25, f:0.3},
    mango: {cal:100, p:1, c:25, f:0.5}, orange: {cal:62, p:1.2, c:15, f:0.2},
    // Other
    maggi: {cal:310, p:7, c:44, f:12}, oats: {cal:150, p:5, c:27, f:3},
    butter: {cal:36, p:0, c:0, f:4}, ghee: {cal:45, p:0, c:0, f:5},
    'peanut butter and jelly': {cal:380, p:12, c:45, f:18},
    'avocado toast': {cal:280, p:6, c:26, f:18}, avocado: {cal:160, p:2, c:9, f:15},
    'scrambled eggs': {cal:180, p:12, c:2, f:14}
  };
  const text = msg.replace(/(?:i |i've |i have |had |ate |eaten |log |add |please )+(?:for )?(?:breakfast |lunch |dinner |snack )?/gi, '').replace(/\s+for\s+(breakfast|lunch|dinner|snack)\s*$/i, '').trim();
  const segments = text.split(/,|\band\b|\+|;|\bwith\b/i).map(s => s.trim()).filter(Boolean);
  const items = [];
  for (const seg of segments) {
    let qty = 1, food = seg;
    const qm = seg.match(/^(\d+(?:\.\d+)?)\s*(.*)/);
    if (qm) { qty = parseFloat(qm[1]) || 1; food = qm[2]; }
    const fl = food.toLowerCase().trim();
    let matched = null;
    // Try longest-key-first match (compound foods like 'peanut butter sandwich' before 'butter')
    const sortedKeys = Object.keys(indianFoods).sort((a, b) => b.length - a.length);
    for (const key of sortedKeys) {
      if (fl.includes(key)) { matched = { key, ...indianFoods[key] }; break; }
    }
    // Fallback: if multi-word input, try matching input as substring of a key
    if (!matched && fl.split(/\s+/).length >= 2) {
      for (const key of sortedKeys) {
        if (key.includes(fl)) { matched = { key, ...indianFoods[key] }; break; }
      }
    }
    if (matched) {
      items.push({ name: matched.key.charAt(0).toUpperCase() + matched.key.slice(1), quantity: qty, unit: 'serving', calories: Math.round(matched.cal * qty), protein: Math.round(matched.p * qty * 10) / 10, carbs: Math.round(matched.c * qty * 10) / 10, fats: Math.round(matched.f * qty * 10) / 10, is_estimate: true, note: 'Estimated from common values' });
    } else {
      items.push({ name: food.trim() || seg, quantity: qty, unit: 'serving', calories: 0, protein: 0, carbs: 0, fats: 0, is_estimate: true, note: 'Could not estimate " please enter values manually' });
    }
  }
  const mealType = lower.includes('breakfast') ? 'breakfast' : lower.includes('lunch') ? 'lunch' : lower.includes('dinner') ? 'dinner' : 'snack';
  const total = { calories: items.reduce((s, i) => s + i.calories, 0), protein: Math.round(items.reduce((s, i) => s + i.protein, 0) * 10) / 10, carbs: Math.round(items.reduce((s, i) => s + i.carbs, 0) * 10) / 10, fats: Math.round(items.reduce((s, i) => s + i.fats, 0) * 10) / 10 };
  return {
    status: 'confirmation_required', action_type: 'log_nutrition',
    summary: `Log ${items.length} food item${items.length > 1 ? 's' : ''} as ${mealType}`,
    details: { meal_type: mealType, items, total },
    confidence: items.some(i => i.calories === 0) ? 'low' : 'medium',
    message: 'These are estimated values. Please review and confirm, edit, or cancel.'
  };
}

// ========================================================================
// Â§17  MENTOR AI " Context-Aware Motivational System
// ========================================================================
// Generates daily motivational check-ins based on user activity context.
// Fetches context from /api/mentor/context (or builds from localStorage in
// demo mode), then sends to Gemini via /api/ai/chat with mode='mentor'.
// âš ï¸ Global mutable: _mentorMessageShown, _mentorFetching
// âš ï¸ One mentor message per chat open session (guarded by _mentorMessageShown).
// âš ï¸ Contains full _MENTOR_SYSTEM_PROMPT (~100 lines) for Gemini.

let _mentorMessageShown = false;   // one mentor message per chat session
let _mentorFetching = false;       // lock to prevent concurrent requests

/**
 * Build a mentor context object from DEMO-mode localStorage data.
 * Returns the same shape as /api/mentor/context.
 */
function _buildMentorContextDemo() {
  const today = toLocalDateKey(new Date());
  const tasks = (taskUiState.tasks || []);
  const meals = (nutritionState.entries || []);
  const workouts = workoutState?.workouts || [];

  // Tasks
  const todayTasks = tasks.filter(t => {
    const d = t.date || '';
    return d === today;
  });
  const tasksCompleted = todayTasks.filter(t => !!(t.completed || t.completedAt)).length;
  const overdueTasks = tasks.filter(t => {
    const d = t.date || '';
    return d && d < today && !(t.completed || t.completedAt);
  }).slice(0, 10).map(t => ({ title: t.title, date: t.date, priority: t.priority || 'medium' }));
  const upcoming = todayTasks.filter(t => !(t.completed || t.completedAt))
    .map(t => ({ title: t.title, priority: t.priority || 'medium' }));

  // Nutrition
  const todayMeals = meals.filter(m => String(m.date || '') === today);
  const totalCal = todayMeals.reduce((s, m) => s + parseMacro(m.calories), 0);
  const totalP = todayMeals.reduce((s, m) => s + parseMacro(m.protein), 0);
  const totalC = todayMeals.reduce((s, m) => s + parseMacro(m.carbs), 0);
  const totalF = todayMeals.reduce((s, m) => s + parseMacro(m.fats), 0);

  // Workouts
  const todayWorkouts = workouts.filter(w => String(w.date || '') === today);
  const wCompleted = todayWorkouts.filter(w => !!w.completed).length;
  const pendingWNames = todayWorkouts.filter(w => !w.completed).map(w => w.name || 'Workout');

  // Streak / progress
  const stats = _getUserStats() || {};

  return {
    date: today,
    tasks: {
      total: todayTasks.length,
      completed: tasksCompleted,
      pending: todayTasks.length - tasksCompleted,
      overdue: overdueTasks,
      upcoming: upcoming,
    },
    nutrition: {
      meals_logged: todayMeals.length,
      calories_consumed: Math.round(totalCal),
      protein_consumed: Math.round(totalP * 10) / 10,
      carbs_consumed: Math.round(totalC * 10) / 10,
      fats_consumed: Math.round(totalF * 10) / 10,
    },
    workouts: {
      total: todayWorkouts.length,
      completed: wCompleted,
      pending_names: pendingWNames,
    },
    progress: {
      current_streak: stats.currentStreak || 0,
      longest_streak: stats.longestStreak || 0,
      total_points: stats.totalPoints || 0,
      level: stats.level || 1,
      level_pct: 0,
    },
  };
}

/**
 * Fetch mentor context from the server (API mode).
 */
async function _fetchMentorContextAPI() {
  const res = await fetch('/api/mentor/context', { credentials: 'same-origin' });
  if (!res.ok) throw new Error(`Mentor context failed (${res.status})`);
  return await res.json();
}

/**
 * Convert context object â†’ human-readable summary string for Gemini.
 */
function _buildMentorPromptString(ctx) {
  const goals = nutritionState.baseGoals || { calories: 2200, protein: 140, carbs: 250, fats: 60 };
  const calLeft = Math.max(0, goals.calories - (ctx.nutrition.calories_consumed || 0));
  const proLeft = Math.max(0, goals.protein - (ctx.nutrition.protein_consumed || 0));
  const carbLeft = Math.max(0, goals.carbs - (ctx.nutrition.carbs_consumed || 0));
  const fatLeft = Math.max(0, goals.fats - (ctx.nutrition.fats_consumed || 0));

  const name = (typeof profileState !== 'undefined' && profileState.fullName)
    ? profileState.fullName.split(' ')[0] : 'there';

  let lines = [];
  lines.push(`User's name: ${name}`);
  lines.push(`Date: ${ctx.date}`);
  lines.push('');
  lines.push('--- STREAK & PROGRESS ---');
  lines.push(`Current streak: ${ctx.progress.current_streak} days`);
  lines.push(`Longest streak: ${ctx.progress.longest_streak} days`);
  lines.push(`Total XP: ${ctx.progress.total_points} | Level: ${ctx.progress.level}`);
  lines.push('');
  lines.push('--- TASKS ---');
  lines.push(`Tasks completed today: ${ctx.tasks.completed}/${ctx.tasks.total}`);
  if (ctx.tasks.overdue.length > 0) {
    lines.push(`Overdue tasks (${ctx.tasks.overdue.length}): ${ctx.tasks.overdue.map(t => t.title).join(', ')}`);
  }
  if (ctx.tasks.upcoming.length > 0) {
    lines.push(`Remaining today: ${ctx.tasks.upcoming.map(t => `${t.title} [${t.priority}]`).join(', ')}`);
  }
  lines.push('');
  lines.push('--- NUTRITION ---');
  lines.push(`Meals logged: ${ctx.nutrition.meals_logged}`);
  lines.push(`Calories: ${ctx.nutrition.calories_consumed}/${goals.calories} kcal (${calLeft} remaining)`);
  lines.push(`Protein: ${ctx.nutrition.protein_consumed}/${goals.protein}g (${Math.round(proLeft)}g remaining)`);
  lines.push(`Carbs: ${ctx.nutrition.carbs_consumed}/${goals.carbs}g (${Math.round(carbLeft)}g remaining)`);
  lines.push(`Fats: ${ctx.nutrition.fats_consumed}/${goals.fats}g (${Math.round(fatLeft)}g remaining)`);
  lines.push('');
  lines.push('--- WORKOUTS ---');
  if (ctx.workouts.total === 0) {
    lines.push('No workouts scheduled today.');
  } else {
    lines.push(`Workouts: ${ctx.workouts.completed}/${ctx.workouts.total} completed`);
    if (ctx.workouts.pending_names.length > 0) {
      lines.push(`Pending: ${ctx.workouts.pending_names.join(', ')}`);
    }
  }

  return lines.join('\n');
}

const _MENTOR_SYSTEM_PROMPT = `You are a productivity mentor inside a performance tracking app called FitTrack Pro.

Your job is to:
- Motivate the user
- Hold them accountable
- Encourage consistency
- Suggest actionable next steps
- Be supportive but disciplined

You are NOT casual. You are NOT robotic. You are focused, calm, strong.

You have access to their real-time progress data (provided below). All numbers are pre-calculated " do NOT guess or invent data.

Rules:
- Respond in 4-6 sentences maximum.
- Keep it actionable " mention what is left today.
- Encourage completion.
- If streak is at risk, warn them.
- If they are doing well, praise them.
- If they have overdue tasks, call it out.
- Do NOT hallucinate new tasks or data.
- Do NOT change any data.
- Do NOT use generic motivational quotes.
- Address the user by first name.
- Use line breaks between thoughts for readability.`;

/**
 * Generate the mentor message " calls Gemini with real context.
 * Falls back to a structured local message if Gemini is unavailable.
 */
async function generateMentorMessage() {
  if (_mentorFetching) return;
  _mentorFetching = true;

  // Show typing indicator
  _aiAddMessage('<span class="ai-typing"><span>.</span><span>.</span><span>.</span></span>', 'bot');
  const container = document.getElementById('ai-chat-messages');

  try {
    // 1. Collect context
    let ctx;
    try {
      ctx = await _fetchMentorContextAPI();
    } catch (_e) {
      ctx = _buildMentorContextDemo();
    }

    // 2. Format context
    const mentorContext = _buildMentorPromptString(ctx);

    // 3. Call Gemini via existing chat endpoint with mentor mode
    const payload = {
      message: `[MENTOR_MODE]\n\nHere is the user's current status:\n${mentorContext}\n\nGive them a personalized motivational check-in based on this data.`,
      mode: 'general',
      context: {
        session_id: _aiSessionId(),
        current_page: _detectCurrentPage(),
        mentor_mode: true,
        user_preferences: {
          goal: typeof profileState !== 'undefined' ? (profileState.weightGoal || 'maintenance') : 'maintenance',
          diet_type: 'mixed'
        }
      }
    };

    const response = await fetch('/api/ai/chat', { credentials: 'same-origin', method: 'POST',
      headers: { 'Content-Type': 'application/json'},
      body: JSON.stringify(payload)
    });

    let data = {};
    try { data = await response.json(); } catch (_) { data = {}; }

    // Remove typing indicator
    if (container && container.lastChild) container.removeChild(container.lastChild);

    if (response.ok && data.status === 'chat_response' && data.message) {
      _aiAddMessage(`<div class="mentor-message"><div class="mentor-header"><span class="mentor-icon">🔥</span> <strong>Daily Check-in</strong></div><div class="mentor-body">${_aiMarkdown(data.message)}</div></div>`, 'bot');
    } else {
      // Gemini failed " render structured local fallback
      _renderLocalMentorMessage(ctx);
    }

  } catch (err) {
    console.warn('[Mentor] Failed to generate mentor message:', err.message);
    if (container && container.lastChild) container.removeChild(container.lastChild);
    // Build local fallback
    try {
      const ctx = _buildMentorContextDemo();
      _renderLocalMentorMessage(ctx);
    } catch (_e2) {
      _aiAddMessage('<div class="mentor-message"><div class="mentor-header"><span class="mentor-icon">🔥</span> <strong>Daily Check-in</strong></div><div class="mentor-body">Ready when you are. Let\'s make today count.</div></div>', 'bot');
    }
  } finally {
    _mentorFetching = false;
    _mentorMessageShown = true;
  }
}

/**
 * Structured local mentor message " no AI, pure data-driven.
 */
function _renderLocalMentorMessage(ctx) {
  const goals = nutritionState.baseGoals || { calories: 2200, protein: 140, carbs: 250, fats: 60 };
  const name = (typeof profileState !== 'undefined' && profileState.fullName)
    ? profileState.fullName.split(' ')[0] : 'there';

  const proLeft = Math.max(0, Math.round(goals.protein - (ctx.nutrition.protein_consumed || 0)));
  const calLeft = Math.max(0, goals.calories - (ctx.nutrition.calories_consumed || 0));

  let parts = [];

  // Greeting
  parts.push(`Hey ${name} 👋`);

  // Streak status
  if (ctx.progress.current_streak > 0) {
    parts.push(`You're on a <strong>${ctx.progress.current_streak}-day streak</strong>. Don't break it.`);
  } else {
    parts.push(`No active streak yet. Today's the day to start one.`);
  }

  // Nutrition gap
  if (ctx.nutrition.meals_logged === 0) {
    parts.push(`You haven't logged any meals yet. Fuel up and track it.`);
  } else if (proLeft > 20) {
    parts.push(`You're <strong>${proLeft}g short on protein</strong> and have <strong>${calLeft} kcal</strong> left to hit your target.`);
  } else if (proLeft > 0) {
    parts.push(`Almost there on protein " just <strong>${proLeft}g</strong> to go.`);
  } else {
    parts.push(`Protein goal âœ… " nice work.`);
  }

  // Workouts
  const wPending = ctx.workouts.total - ctx.workouts.completed;
  if (wPending > 0) {
    parts.push(`<strong>${wPending} workout${wPending > 1 ? 's' : ''}</strong> still pending${ctx.workouts.pending_names.length ? ': ' + ctx.workouts.pending_names.join(', ') : ''}.`);
  } else if (ctx.workouts.total > 0) {
    parts.push(`All workouts done âœ…`);
  }

  // Tasks
  if (ctx.tasks.overdue.length > 0) {
    parts.push(`âš ï¸ <strong>${ctx.tasks.overdue.length} overdue task${ctx.tasks.overdue.length > 1 ? 's' : ''}</strong> " don't let those pile up.`);
  }
  if (ctx.tasks.pending > 0) {
    parts.push(`<strong>${ctx.tasks.pending} task${ctx.tasks.pending > 1 ? 's' : ''}</strong> left today. Lock them in.`);
  } else if (ctx.tasks.total > 0) {
    parts.push(`All tasks complete âœ… " solid.`);
  }

  // Closing CTA
  if (wPending > 0 || ctx.tasks.pending > 0 || proLeft > 20) {
    parts.push(`Let's finish strong. 💪`);
  } else {
    parts.push(`Great day so far. Keep the momentum. 🔥`);
  }

  const html = parts.map(p => `<p style="margin:4px 0">${p}</p>`).join('');
  _aiAddMessage(`<div class="mentor-message"><div class="mentor-header"><span class="mentor-icon">🔥</span> <strong>Daily Check-in</strong></div><div class="mentor-body">${html}</div></div>`, 'bot');
}

// ========================================================================
// Â§18  FOCUS / STUDY MODULE
// ========================================================================
// Pomodoro, custom, and stopwatch timer modes. Ambient audio player.
// Focus-mode navigation guard (prevents page switching during session).
// Session tracking via /api/focus/sessions.
// âš ï¸ Global mutable: _focus (large state object with timer, audio,
//    pomodoro config, session history, whitelist)
// âš ï¸ Audio elements created dynamically; URLs in _focusAudioUrls.
// âš ï¸ Focus mode blocks showPage() navigation while active.

const _focus = {
  // State
  mode: 'pomodoro',          // 'pomodoro' | 'custom' | 'stopwatch'
  state: 'idle',             // 'idle' | 'running' | 'paused' | 'break' | 'finished'
  startTimestamp: null,       // Date.now() when timer started
  pauseTimestamp: null,       // Date.now() when paused
  elapsedPaused: 0,          // total ms spent paused
  totalDurationMs: 25 * 60 * 1000,
  intervalId: null,

  // Pomodoro config
  pomodoroFocus: 25,         // minutes
  pomodoroBreak: 5,          // minutes
  pomodoroSessions: 4,
  currentSession: 1,
  isBreak: false,

  // Custom
  customMinutes: 30,
  customLabel: '',

  // Stopwatch
  stopwatchElapsed: 0,

  // Audio
  audioPlaying: false,
  currentTrack: 'lofi',
  audioElement: null,
  audioVolume: 50,

  // Focus mode
  focusModeActive: false,
  whitelist: ['focus'],

  // Session tracking
  sessionStartIso: null,
  sessions: [],              // today's sessions (localStorage for demo)

  // Ring
  ringCircumference: 2 * Math.PI * 90, // r=90
};

// ─── Audio URLs (royalty-free ambient) ────────────────
const _focusAudioUrls = {
  lofi:       '/music/lofi%20beats%20music.mp3',
  rain:       '/music/rain%20music.mp3',
  forest:     '/music/forest%20music.mp3',
  cafe:       '/music/cafe%20music.mp3',
  whitenoise: '/music/white%20noise%20music.mp3',
};

// ─── SVG Gradient (inject once) ──────────────────────
function _focusInjectGradient() {
  const ring = document.querySelector('.focus-progress-ring');
  if (!ring || ring.querySelector('#focusGradient')) return;
  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
  defs.innerHTML = `
    <linearGradient id="focusGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#6366f1"/>
      <stop offset="100%" stop-color="#a78bfa"/>
    </linearGradient>`;
  ring.insertBefore(defs, ring.firstChild);
}

// ─── Init ────────────────────────────────────────────
function initFocusModule() {
  _focusInjectGradient();
  _focusLoadState();
  _focusRenderCycleDots();
  _focusUpdateDisplay();
  _focusLoadSessions();
  _focusUpdateSummary();

  // Visibility API " handle tab switches
  document.addEventListener('visibilitychange', _focusOnVisibilityChange);
}

// ─── Mode Switching ─────────────────────────────────
function switchFocusMode(mode) {
  if (_focus.state !== 'idle') {
    showToast('Stop the current timer first', 'warning');
    return;
  }
  _focus.mode = mode;

  document.querySelectorAll('.focus-mode-tab').forEach(t => t.classList.toggle('active', t.dataset.mode === mode));

  const pomSettings = document.getElementById('focus-pomodoro-settings');
  const customSettings = document.getElementById('focus-custom-settings');
  const cycleInd = document.getElementById('focus-cycle-indicator');

  pomSettings.style.display = mode === 'pomodoro' ? '' : 'none';
  customSettings.style.display = mode === 'custom' ? '' : 'none';
  cycleInd.style.display = mode === 'pomodoro' ? '' : 'none';

  if (mode === 'pomodoro') {
    _focus.totalDurationMs = _focus.pomodoroFocus * 60 * 1000;
  } else if (mode === 'custom') {
    _focus.totalDurationMs = _focus.customMinutes * 60 * 1000;
  } else {
    _focus.totalDurationMs = 0; // stopwatch counts up
  }

  _focus.currentSession = 1;
  _focus.isBreak = false;
  _focusRenderCycleDots();
  _focusUpdateDisplay();
  _focusSaveState();
}

// ─── Pomodoro Presets ───────────────────────────────
function setPomodoroDuration(min) {
  _focus.pomodoroFocus = min;
  _focus.totalDurationMs = min * 60 * 1000;
  document.querySelectorAll('#focus-pomodoro-settings .focus-setting-row:first-child .focus-preset')
    .forEach(b => b.classList.toggle('active', +b.dataset.minutes === min));
  _focusUpdateDisplay();
  _focusSaveState();
}
function setPomodoroBreak(min) {
  _focus.pomodoroBreak = min;
  document.querySelectorAll('#focus-pomodoro-settings .focus-setting-row:nth-child(2) .focus-preset')
    .forEach(b => b.classList.toggle('active', +b.dataset.minutes === min));
  _focusSaveState();
}
function setPomodoroSessions(n) {
  _focus.pomodoroSessions = n;
  document.querySelectorAll('#focus-pomodoro-settings .focus-setting-row:nth-child(3) .focus-preset')
    .forEach(b => b.classList.toggle('active', +b.dataset.sessions === n));
  _focus.currentSession = Math.min(_focus.currentSession, n);
  _focusRenderCycleDots();
  _focusSaveState();
}

// ─── Timer Controls ─────────────────────────────────
function focusTimerStart() {
  if (_focus.state !== 'idle') return;

  if (_focus.mode === 'custom') {
    const val = parseInt(document.getElementById('focus-custom-minutes').value) || 30;
    _focus.customMinutes = Math.max(1, Math.min(480, val));
    _focus.customLabel = (document.getElementById('focus-custom-label').value || '').trim();
    _focus.totalDurationMs = _focus.customMinutes * 60 * 1000;
  }

  _focus.state = 'running';
  _focus.startTimestamp = Date.now();
  _focus.pauseTimestamp = null;
  _focus.elapsedPaused = 0;
  _focus.sessionStartIso = new Date().toISOString();

  _focusStartInterval();
  _focusUpdateControls();
  _focusSaveState();

  document.querySelector('.focus-timer-card')?.classList.add('is-running');
}

function focusTimerPause() {
  if (_focus.state !== 'running') return;
  _focus.state = 'paused';
  _focus.pauseTimestamp = Date.now();
  clearInterval(_focus.intervalId);
  _focus.intervalId = null;
  _focusUpdateControls();
  _focusSaveState();
  document.querySelector('.focus-timer-card')?.classList.remove('is-running');
}

function focusTimerResume() {
  if (_focus.state !== 'paused') return;
  _focus.elapsedPaused += Date.now() - _focus.pauseTimestamp;
  _focus.pauseTimestamp = null;
  _focus.state = 'running';
  _focusStartInterval();
  _focusUpdateControls();
  _focusSaveState();
  document.querySelector('.focus-timer-card')?.classList.add('is-running');
}

function focusTimerStop() {
  if (_focus.state === 'idle') return;
  const elapsedMs = _focusGetElapsed();
  const actualMinutes = Math.round(elapsedMs / 60000);

  _focusLogSession(false, actualMinutes);
  _focusFullReset();
  showToast('Session stopped', 'info');
}

function focusTimerReset() {
  if (_focus.state === 'idle') return;
  _focusFullReset();
  showToast('Timer reset', 'info');
}

function _focusFullReset() {
  clearInterval(_focus.intervalId);
  _focus.intervalId = null;
  _focus.state = 'idle';
  _focus.startTimestamp = null;
  _focus.pauseTimestamp = null;
  _focus.elapsedPaused = 0;
  _focus.isBreak = false;
  if (_focus.mode === 'pomodoro') {
    _focus.currentSession = 1;
    _focus.totalDurationMs = _focus.pomodoroFocus * 60 * 1000;
  }
  _focusRenderCycleDots();
  _focusUpdateDisplay();
  _focusUpdateControls();
  _focusSaveState();
  document.querySelector('.focus-timer-card')?.classList.remove('is-running');
  document.querySelector('.focus-timer-card')?.classList.remove('focus-breathing');
}

// ─── Timer Engine ───────────────────────────────────
function _focusStartInterval() {
  clearInterval(_focus.intervalId);
  _focus.intervalId = setInterval(_focusTick, 250); // 4Hz for smooth ring
}

function _focusTick() {
  const elapsed = _focusGetElapsed();

  if (_focus.mode === 'stopwatch') {
    _focus.stopwatchElapsed = elapsed;
    _focusUpdateDisplay();
    return;
  }

  const remaining = Math.max(0, _focus.totalDurationMs - elapsed);

  _focusUpdateDisplay();

  if (remaining <= 0) {
    _focusTimerComplete();
  }
}

function _focusGetElapsed() {
  if (!_focus.startTimestamp) return 0;
  const now = _focus.state === 'paused' ? _focus.pauseTimestamp : Date.now();
  return now - _focus.startTimestamp - _focus.elapsedPaused;
}

function _focusTimerComplete() {
  clearInterval(_focus.intervalId);
  _focus.intervalId = null;

  // Play completion sound
  _focusPlayNotification();

  if (_focus.mode === 'pomodoro') {
    if (_focus.isBreak) {
      // Break finished â†’ next focus session
      _focus.isBreak = false;
      _focus.currentSession++;
      if (_focus.currentSession > _focus.pomodoroSessions) {
        // All sessions done!
        const totalFocusMin = _focus.pomodoroFocus * _focus.pomodoroSessions;
        _focusLogSession(true, totalFocusMin);
        _focusFullReset();
        showToast(`All ${_focus.pomodoroSessions} pomodoro sessions complete! 🎉`, 'success');
        return;
      }
      _focus.totalDurationMs = _focus.pomodoroFocus * 60 * 1000;
      _focus.startTimestamp = Date.now();
      _focus.pauseTimestamp = null;
      _focus.elapsedPaused = 0;
      _focusStartInterval();
      _focusRenderCycleDots();
      _focusUpdateDisplay();
      document.querySelector('.focus-timer-card')?.classList.remove('focus-breathing');
      showToast(`Break over " Session ${_focus.currentSession} started!`, 'info');
    } else {
      // Focus session finished â†’ start break
      _focusLogSession(true, _focus.pomodoroFocus);
      _focus.isBreak = true;
      const isLongBreak = _focus.currentSession >= _focus.pomodoroSessions;
      _focus.totalDurationMs = (isLongBreak ? _focus.pomodoroBreak * 3 : _focus.pomodoroBreak) * 60 * 1000;
      _focus.startTimestamp = Date.now();
      _focus.pauseTimestamp = null;
      _focus.elapsedPaused = 0;
      _focusStartInterval();
      _focusRenderCycleDots();
      _focusUpdateDisplay();
      document.querySelector('.focus-timer-card')?.classList.add('focus-breathing');
      showToast(`Session ${_focus.currentSession} done! Take a break â˜•`, 'success');
    }
  } else {
    // Custom timer done
    const durMin = _focus.mode === 'custom' ? _focus.customMinutes : Math.round(_focusGetElapsed() / 60000);
    _focusLogSession(true, durMin);
    _focusFullReset();
    showToast('Timer complete! 🎉', 'success');
  }
}

// ─── Notification Sound ─────────────────────────────
function _focusPlayNotification() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 800;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.8);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.8);
    // Second beep
    setTimeout(() => {
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.frequency.value = 1000;
      osc2.type = 'sine';
      gain2.gain.setValueAtTime(0.3, ctx.currentTime);
      gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.6);
      osc2.start(ctx.currentTime);
      osc2.stop(ctx.currentTime + 0.6);
    }, 300);
  } catch(e) { /* no audio context support */ }
}

// ─── Display Updates ────────────────────────────────
function _focusUpdateDisplay() {
  const digits = document.getElementById('focus-timer-digits');
  const stateLabel = document.getElementById('focus-timer-state-label');
  const ring = document.getElementById('focus-ring-progress');
  if (!digits) return;

  if (_focus.mode === 'stopwatch') {
    const elapsed = _focus.state === 'idle' ? 0 : _focusGetElapsed();
    digits.textContent = _focusFormatTime(elapsed);
    stateLabel.textContent = _focus.state === 'idle' ? 'Ready' : _focus.state === 'paused' ? 'Paused' : 'Counting';
    // Ring: fill based on time, cycle every 60 min
    const pct = (elapsed % (60 * 60 * 1000)) / (60 * 60 * 1000);
    if (ring) ring.style.strokeDashoffset = _focus.ringCircumference * (1 - pct);
    return;
  }

  const elapsed = _focusGetElapsed();
  const remaining = Math.max(0, _focus.totalDurationMs - elapsed);
  digits.textContent = _focusFormatTime(remaining);

  if (_focus.state === 'idle') {
    stateLabel.textContent = 'Ready';
    if (ring) ring.style.strokeDashoffset = '0';
  } else if (_focus.isBreak) {
    stateLabel.textContent = 'Break';
  } else if (_focus.state === 'paused') {
    stateLabel.textContent = 'Paused';
  } else {
    stateLabel.textContent = _focus.mode === 'pomodoro' ? `Focus Â· Session ${_focus.currentSession}` : 'Focus';
  }

  // Progress ring
  if (ring && _focus.totalDurationMs > 0) {
    const pct = elapsed / _focus.totalDurationMs;
    ring.style.strokeDashoffset = _focus.ringCircumference * (1 - Math.min(1, pct));
  }
}

function _focusFormatTime(ms) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

function _focusUpdateControls() {
  const startBtn = document.getElementById('focus-start-btn');
  const pauseBtn = document.getElementById('focus-pause-btn');
  const resumeBtn = document.getElementById('focus-resume-btn');
  const stopBtn = document.getElementById('focus-stop-btn');
  const resetBtn = document.getElementById('focus-reset-btn');

  if (!startBtn) return;

  const s = _focus.state;
  startBtn.style.display = s === 'idle' ? '' : 'none';
  pauseBtn.style.display = s === 'running' ? '' : 'none';
  resumeBtn.style.display = s === 'paused' ? '' : 'none';
  stopBtn.style.display = (s === 'running' || s === 'paused') ? '' : 'none';
  resetBtn.style.display = s !== 'idle' ? '' : 'none';
}

// ─── Cycle Dots ─────────────────────────────────────
function _focusRenderCycleDots() {
  const container = document.getElementById('focus-cycle-dots');
  const currentEl = document.getElementById('focus-current-session');
  const totalEl = document.getElementById('focus-total-sessions');
  if (!container) return;

  totalEl.textContent = _focus.pomodoroSessions;
  currentEl.textContent = _focus.currentSession;

  let html = '';
  for (let i = 1; i <= _focus.pomodoroSessions; i++) {
    let cls = 'focus-cycle-dot';
    if (i < _focus.currentSession) cls += ' completed';
    if (i === _focus.currentSession && _focus.state !== 'idle') cls += ' active';
    if (i === _focus.currentSession && _focus.isBreak) cls += ' is-break';
    html += `<div class="${cls}"></div>`;
  }
  container.innerHTML = html;
}

// ─── Session Logging ────────────────────────────────
function _focusLogSession(completed, actualMinutes) {
  if (actualMinutes <= 0) return;

  const session = {
    mode: _focus.mode,
    durationPlanned: _focus.mode === 'pomodoro' ? _focus.pomodoroFocus : (_focus.mode === 'custom' ? _focus.customMinutes : 0),
    durationActual: actualMinutes,
    completed: completed,
    label: _focus.mode === 'custom' ? _focus.customLabel : (_focus.mode === 'pomodoro' ? `Pomodoro S${_focus.currentSession}` : 'Stopwatch'),
    date: new Date().toISOString().slice(0, 10),
    startedAt: _focus.sessionStartIso || new Date().toISOString(),
    endedAt: new Date().toISOString(),
  };

  // Save to API or localStorage
  if (typeof isDemoMode === 'function' && isDemoMode()) {
    const key = `focus_sessions_${session.date}`;
    const stored = JSON.parse(localStorage.getItem(key) || '[]');
    session.id = Date.now();
    stored.push(session);
    localStorage.setItem(key, JSON.stringify(stored));
  } else {
    fetch('/api/focus/sessions', { credentials: 'same-origin', method: 'POST',
      headers: { 'Content-Type': 'application/json'},
      body: JSON.stringify(session),
    }).catch(err => console.warn('Focus session save failed:', err));
  }

  _focus.sessions.push(session);
  _focusRenderSessions();
  _focusUpdateSummary();
  if (typeof syncToAppState === 'function') syncToAppState('focus');
}

function _focusLoadSessions() {
  const today = new Date().toISOString().slice(0, 10);

  if (typeof isDemoMode === 'function' && isDemoMode()) {
    const key = `focus_sessions_${today}`;
    _focus.sessions = JSON.parse(localStorage.getItem(key) || '[]');
    _focusRenderSessions();
    _focusUpdateSummary();
  } else {
    fetch(`/api/focus/sessions?date=${today}`, { credentials: 'same-origin' })
      .then(r => r.json())
      .then(data => {
        _focus.sessions = data || [];
        _focusRenderSessions();
        _focusUpdateSummary();
      })
      .catch(() => {
        _focus.sessions = [];
        _focusRenderSessions();
      });
  }
}

function _focusRenderSessions() {
  const container = document.getElementById('focus-session-list');
  if (!container) return;

  if (_focus.sessions.length === 0) {
    container.innerHTML = `<div class="focus-empty-state"><i class="fas fa-hourglass-half"></i><p>No sessions yet today. Start a timer to begin!</p></div>`;
    return;
  }

  container.innerHTML = _focus.sessions.slice().reverse().map(s => {
    const icon = s.completed ? 'check-circle' : 'times-circle';
    const iconClass = s.completed ? 'completed' : 'abandoned';
    const modeLabel = s.mode === 'pomodoro' ? '🍅' : (s.mode === 'stopwatch' ? '⏱️' : '⏰');
    const label = escapeHtml(s.label || s.mode);
    const time = s.startedAt ? new Date(s.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

    return `<div class="focus-session-item">
      <div class="focus-session-item-left">
        <div class="focus-session-icon ${iconClass}"><i class="fas fa-${icon}"></i></div>
        <div class="focus-session-info">
          <span class="focus-session-title">${modeLabel} ${label}</span>
          <span class="focus-session-meta">${time}${s.durationPlanned ? ` · Planned: ${s.durationPlanned}m` : ''}</span>
        </div>
      </div>
      <span class="focus-session-duration">${s.durationActual}m</span>
    </div>`;
  }).join('');
}

function _focusUpdateSummary() {
  const totalMin = _focus.sessions.reduce((sum, s) => sum + (s.durationActual || 0), 0);
  const completedCount = _focus.sessions.filter(s => s.completed).length;
  const totalCount = _focus.sessions.length;

  const minEl = document.getElementById('focus-total-minutes');
  const compEl = document.getElementById('focus-completed-count');
  const streakEl = document.getElementById('focus-streak-sessions');

  if (minEl) minEl.textContent = totalMin;
  if (compEl) compEl.textContent = completedCount;
  if (streakEl) streakEl.textContent = totalCount;
}

// ─── Audio ──────────────────────────────────────────
function selectFocusTrack(track) {
  _focus.currentTrack = track;
  document.querySelectorAll('.focus-audio-track').forEach(t => t.classList.toggle('active', t.dataset.track === track));

  if (_focus.audioPlaying) {
    _focusStopAudio();
    _focusPlayAudio();
  }
}

function toggleFocusAudio() {
  if (_focus.audioPlaying) {
    _focusStopAudio();
  } else {
    _focusPlayAudio();
  }
}

function _focusPlayAudio() {
  const url = _focusAudioUrls[_focus.currentTrack];
  if (!url) return;

  if (!_focus.audioElement) {
    _focus.audioElement = new Audio();
    _focus.audioElement.loop = true;
  }
  _focus.audioElement.src = url;
  _focus.audioElement.volume = _focus.audioVolume / 100;
  _focus.audioElement.play().catch(() => {});
  _focus.audioPlaying = true;

  const btn = document.getElementById('focus-audio-toggle');
  if (btn) btn.innerHTML = '<i class="fas fa-pause"></i>';
}

function _focusStopAudio() {
  if (_focus.audioElement) {
    _focus.audioElement.pause();
    _focus.audioElement.currentTime = 0;
  }
  _focus.audioPlaying = false;

  const btn = document.getElementById('focus-audio-toggle');
  if (btn) btn.innerHTML = '<i class="fas fa-play"></i>';
}

function setFocusVolume(val) {
  _focus.audioVolume = parseInt(val) || 50;
  if (_focus.audioElement) {
    _focus.audioElement.volume = _focus.audioVolume / 100;
  }
}

// ─── Focus Mode (UI Lock) ───────────────────────────
function toggleFocusMode() {
  if (_focus.focusModeActive) {
    _focusShowExitModal();
  } else {
    _focusEnterFocusMode();
  }
}

function _focusEnterFocusMode() {
  _focus.focusModeActive = true;
  document.body.classList.add('focus-mode-active');

  // Create overlay if needed
  let overlay = document.querySelector('.focus-mode-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'focus-mode-overlay';
    overlay.onclick = () => _focusShowExitModal();
    document.body.appendChild(overlay);
  }

  const focusModeBtn = document.getElementById('focus-mode-btn');
  if (focusModeBtn) {
    focusModeBtn.innerHTML = '<i class="fas fa-compress"></i> Exit Focus';
    focusModeBtn.classList.remove('focus-btn-primary');
    focusModeBtn.classList.add('focus-btn-danger');
  }

  showToast('Focus Mode ON " distractions hidden', 'info');
}

function _focusExitFocusMode() {
  _focus.focusModeActive = false;
  document.body.classList.remove('focus-mode-active');

  const overlay = document.querySelector('.focus-mode-overlay');
  if (overlay) overlay.remove();

  const modal = document.querySelector('.focus-exit-modal');
  if (modal) modal.remove();

  const focusModeBtn = document.getElementById('focus-mode-btn');
  if (focusModeBtn) {
    focusModeBtn.innerHTML = '<i class="fas fa-expand"></i> Focus Mode';
    focusModeBtn.classList.remove('focus-btn-danger');
    focusModeBtn.classList.add('focus-btn-primary');
  }

  showToast('Focus Mode OFF', 'info');
}

function _focusShowExitModal() {
  let modal = document.querySelector('.focus-exit-modal');
  if (modal) { modal.remove(); }

  modal = document.createElement('div');
  modal.className = 'focus-exit-modal active';
  modal.innerHTML = `
    <div class="focus-exit-modal-content">
      <h3>🤔 Exit Focus Mode?</h3>
      <p>You'll regain access to all pages and navigation. Your timer will keep running.</p>
      <div class="focus-exit-modal-actions">
        <button class="focus-btn focus-btn-secondary" onclick="document.querySelector('.focus-exit-modal').remove()">Stay Focused</button>
        <button class="focus-btn focus-btn-danger" onclick="_focusExitFocusMode()">Exit</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
}

// ─── Whitelist ──────────────────────────────────────
function updateFocusWhitelist() {
  const checks = document.querySelectorAll('#focus-whitelist-options input[type="checkbox"]:checked');
  _focus.whitelist = Array.from(checks).map(c => c.value);
  if (!_focus.whitelist.includes('focus')) _focus.whitelist.push('focus');
}

// ─── Visibility API ─────────────────────────────────
function _focusOnVisibilityChange() {
  if (_focus.state !== 'running') return;
  if (document.hidden) return; // timer keeps running via timestamps

  // When tab becomes visible again, force display update
  _focusUpdateDisplay();
}

// ─── Persist timer state in localStorage ────────────
function _focusSaveState() {
  const state = {
    mode: _focus.mode,
    state: _focus.state,
    startTimestamp: _focus.startTimestamp,
    pauseTimestamp: _focus.pauseTimestamp,
    elapsedPaused: _focus.elapsedPaused,
    totalDurationMs: _focus.totalDurationMs,
    pomodoroFocus: _focus.pomodoroFocus,
    pomodoroBreak: _focus.pomodoroBreak,
    pomodoroSessions: _focus.pomodoroSessions,
    currentSession: _focus.currentSession,
    isBreak: _focus.isBreak,
    customMinutes: _focus.customMinutes,
    customLabel: _focus.customLabel,
    sessionStartIso: _focus.sessionStartIso,
    audioVolume: _focus.audioVolume,
    currentTrack: _focus.currentTrack,
    whitelist: _focus.whitelist,
  };
  try { localStorage.setItem('focus_timer_state', JSON.stringify(state)); } catch(e) {}
}

function _focusLoadState() {
  try {
    const saved = JSON.parse(localStorage.getItem('focus_timer_state'));
    if (!saved) return;

    _focus.mode = saved.mode || 'pomodoro';
    _focus.pomodoroFocus = saved.pomodoroFocus || 25;
    _focus.pomodoroBreak = saved.pomodoroBreak || 5;
    _focus.pomodoroSessions = saved.pomodoroSessions || 4;
    _focus.customMinutes = saved.customMinutes || 30;
    _focus.customLabel = saved.customLabel || '';
    _focus.audioVolume = saved.audioVolume ?? 50;
    _focus.currentTrack = saved.currentTrack || 'lofi';
    _focus.whitelist = saved.whitelist || ['focus'];

    // Restore active timer
    if (saved.state === 'running' || saved.state === 'paused') {
      _focus.state = saved.state;
      _focus.startTimestamp = saved.startTimestamp;
      _focus.pauseTimestamp = saved.pauseTimestamp;
      _focus.elapsedPaused = saved.elapsedPaused || 0;
      _focus.totalDurationMs = saved.totalDurationMs;
      _focus.currentSession = saved.currentSession || 1;
      _focus.isBreak = saved.isBreak || false;
      _focus.sessionStartIso = saved.sessionStartIso;

      // Check if timer should have completed while away
      if (saved.state === 'running' && _focus.mode !== 'stopwatch') {
        const elapsed = _focusGetElapsed();
        if (elapsed >= _focus.totalDurationMs) {
          _focusTimerComplete();
          return;
        }
        _focusStartInterval();
      }

      _focusUpdateControls();
      if (saved.state === 'running') {
        document.querySelector('.focus-timer-card')?.classList.add('is-running');
      }
    }

    // Restore UI selections
    switchFocusMode(_focus.mode);

    // Restore volume slider
    const volSlider = document.getElementById('focus-volume-slider');
    if (volSlider) volSlider.value = _focus.audioVolume;

    // Restore track selection
    document.querySelectorAll('.focus-audio-track').forEach(t => t.classList.toggle('active', t.dataset.track === _focus.currentTrack));

    // Restore whitelist checkboxes
    document.querySelectorAll('#focus-whitelist-options input[type="checkbox"]:not(:disabled)').forEach(cb => {
      cb.checked = _focus.whitelist.includes(cb.value);
    });
  } catch(e) { console.warn('Focus state restore failed:', e); }
}

// ========================================================================
// Â§19  NOTES MODULE
// ========================================================================
// Full CRUD via /api/notes. Filter by source (manual/task), search.
// Create/edit/detail modals. Task â†” note linking.
// âš ï¸ Global mutable: _notes (items, filter, searchQuery, editingNoteId)
// âš ï¸ MONKEY-PATCHES showPage() at EOF to auto-load notes on navigate.
//    This means any subsequent monkey-patch would clobber this one.
// âš ï¸ Contains its own escapeHtml() (different impl from Â§4's version).
// âš ï¸ _notesSearchTimer used for debounced search (400ms).

const _notes = {
  items: [],
  filter: 'all',      // 'all' | 'manual' | 'task'
  searchQuery: '',
  editingNoteId: null, // null = creating, number = editing
  viewingNote: null,
  searchTimer: null,
};

// ---------- API ----------
async function notesApiFetch(url, opts = {}) {
  try {
    const res = await fetch(url, { credentials: 'same-origin', ...opts });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (e) {
    console.error('[Notes]', e);
    return null;
  }
}

async function loadNotes() {
  const params = new URLSearchParams();
  if (_notes.filter !== 'all') params.set('source_type', _notes.filter);
  if (_notes.searchQuery) params.set('search', _notes.searchQuery);
  const url = '/api/notes' + (params.toString() ? '?' + params : '');
  const data = await notesApiFetch(url);
  if (data && Array.isArray(data)) {
    _notes.items = data;
  }
  renderNotes();
  if (typeof syncToAppState === 'function') syncToAppState('notes');
}

function renderNotes() {
  const grid = document.getElementById('notes-grid');
  const empty = document.getElementById('notes-empty');
  if (!grid) return;

  // Remove old cards
  grid.querySelectorAll('.note-card').forEach(c => c.remove());

  if (!_notes.items.length) {
    if (empty) empty.style.display = '';
    return;
  }
  if (empty) empty.style.display = 'none';

  _notes.items.forEach(note => {
    const card = document.createElement('div');
    card.className = 'note-card';
    card.onclick = () => openNoteDetail(note.id);

    const tagsHtml = (note.tags || []).map(t => `<span class="note-tag">${escapeHtml(t)}</span>`).join('');
    const sourceClass = note.source_type === 'task' ? 'task' : 'manual';
    const sourceLabel = note.source_type === 'task' ? '<i class="fas fa-link"></i> Task' : '<i class="fas fa-pen"></i> Manual';
    const linkedHtml = note.linked_task_title
      ? `<div class="note-card-linked"><i class="fas fa-check-circle"></i> ${escapeHtml(note.linked_task_title)}</div>`
      : '';
    const dateStr = note.updated_at ? new Date(note.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';

    card.innerHTML = `
      <div class="note-card-title">${escapeHtml(note.title)}</div>
      <div class="note-card-preview">${escapeHtml(note.content || '').substring(0, 180)}</div>
      ${linkedHtml}
      <div class="note-card-meta">
        <span class="note-card-source ${sourceClass}">${sourceLabel}</span>
        <span class="note-card-date">${dateStr}</span>
      </div>
      ${tagsHtml ? `<div class="note-card-tags">${tagsHtml}</div>` : ''}
    `;
    grid.appendChild(card);
  });
}

// Note: escapeHtml is defined globally at ~line 545. Do not duplicate.

// ---------- Filters ----------
function setNotesFilter(f) {
  _notes.filter = f;
  document.querySelectorAll('.notes-filter-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.filter === f);
  });
  loadNotes();
}

let _notesSearchTimer;
function notesSearchDebounce() {
  clearTimeout(_notesSearchTimer);
  _notesSearchTimer = setTimeout(() => {
    _notes.searchQuery = (document.getElementById('notes-search-input')?.value || '').trim();
    loadNotes();
  }, 300);
}

// ---------- Create / Edit Modal ----------
function openNoteCreateModal() {
  _notes.editingNoteId = null;
  const modal = document.getElementById('note-modal');
  const title = document.getElementById('note-modal-title');
  const form = document.getElementById('note-modal-form');
  if (!modal) return;
  if (title) title.textContent = 'New Note';
  if (form) form.reset();
  modal.classList.add('is-open');
  modal.setAttribute('aria-hidden', 'false');
  document.getElementById('note-title-input')?.focus();
}

function openNoteEditModal(note) {
  _notes.editingNoteId = note.id;
  const modal = document.getElementById('note-modal');
  const title = document.getElementById('note-modal-title');
  if (!modal) return;
  if (title) title.textContent = 'Edit Note';
  document.getElementById('note-title-input').value = note.title || '';
  document.getElementById('note-content-input').value = note.content || '';
  document.getElementById('note-tags-input').value = (note.tags || []).join(', ');
  modal.classList.add('is-open');
  modal.setAttribute('aria-hidden', 'false');
  document.getElementById('note-title-input')?.focus();
}

function closeNoteModal() {
  const modal = document.getElementById('note-modal');
  if (modal) {
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
  }
  _notes.editingNoteId = null;
}

async function handleNoteFormSubmit(e) {
  e.preventDefault();
  const titleVal = (document.getElementById('note-title-input')?.value || '').trim();
  const contentVal = (document.getElementById('note-content-input')?.value || '').trim();
  const tagsVal = (document.getElementById('note-tags-input')?.value || '').trim();
  if (!titleVal) return;

  const tags = tagsVal ? tagsVal.split(',').map(t => t.trim().toLowerCase()).filter(Boolean) : [];
  const payload = { title: titleVal, content: contentVal, tags };

  if (_notes.editingNoteId) {
    await notesApiFetch(`/api/notes/${_notes.editingNoteId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } else {
    payload.source_type = 'manual';
    await notesApiFetch('/api/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  }

  closeNoteModal();
  await loadNotes();
}

// ---------- Detail Modal ----------
async function openNoteDetail(noteId) {
  const note = await notesApiFetch(`/api/notes/${noteId}`);
  if (!note) return;
  _notes.viewingNote = note;

  const modal = document.getElementById('note-detail-modal');
  document.getElementById('note-detail-title').textContent = note.title;

  const dateStr = note.created_at ? new Date(note.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
  const sourceLabel = note.source_type === 'task' ? 'Linked to Task' : 'Manual';
  let metaHtml = `<span><i class="fas fa-calendar-alt"></i> ${dateStr}</span>`;
  metaHtml += `<span><i class="fas fa-tag"></i> ${sourceLabel}</span>`;
  if (note.linked_task_title) {
    metaHtml += `<span><i class="fas fa-check-circle"></i> ${escapeHtml(note.linked_task_title)}</span>`;
  }
  document.getElementById('note-detail-meta').innerHTML = metaHtml;
  document.getElementById('note-detail-content').textContent = note.content || '(No content)';

  const tagsHtml = (note.tags || []).map(t => `<span class="note-tag">${escapeHtml(t)}</span>`).join('');
  document.getElementById('note-detail-tags').innerHTML = tagsHtml;

  modal.classList.add('is-open');
  modal.setAttribute('aria-hidden', 'false');
}

function closeNoteDetailModal() {
  const modal = document.getElementById('note-detail-modal');
  if (modal) {
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
  }
  _notes.viewingNote = null;
}

async function deleteCurrentNote() {
  if (!_notes.viewingNote) return;
  if (!confirm('Delete this note? This cannot be undone.')) return;
  await notesApiFetch(`/api/notes/${_notes.viewingNote.id}`, { method: 'DELETE' });
  closeNoteDetailModal();
  await loadNotes();
}

function editCurrentNote() {
  if (!_notes.viewingNote) return;
  closeNoteDetailModal();
  openNoteEditModal(_notes.viewingNote);
}

// ---------- Task â†” Note link ----------
async function viewLinkedNote(e) {
  if (e) e.preventDefault();
  const taskId = Number(taskUiState.editingTaskId);
  if (!taskId) return;
  const note = await notesApiFetch(`/api/notes/from-task/${taskId}`);
  if (note && note.id) {
    closeTaskEditModal();
    showPage('notes');
    setTimeout(() => openNoteDetail(note.id), 200);
  }
}

// ---------- Notes page init on navigate ----------
// âš ï¸ MONKEY-PATCH: wraps the global showPage() function.
// _origShowPage holds the original. If another module patches showPage
// after this, this chain will be silently broken.
const _origShowPage = showPage;
showPage = function(pageName) {
  _origShowPage(pageName);
  if (pageName === 'notes') {
    loadNotes();
  }
};


// ========================================================================
// Â§20  ARCHITECTURE BRIDGE " Controller â†” Monolith Integration
// ========================================================================
// Non-breaking facade that connects the modular Controller / Service /
// Selector layer to the legacy monolith. All existing DOM event handlers
// and global functions continue to work unchanged.
//
// This bridge provides:
//   1. window.FT " unified namespace exposing every Controller
//   2. EventBus subscriptions " auto-refresh UI when state changes
//   3. Startup validation " warns if any feature module failed to load
//
// Why this exists:
//   Controllers load BEFORE script.js but delegate to globals defined
//   HERE (late-binding). This bridge closes the loop by wiring EventBus
//   reactions and exposing a single entry point for new code.
//
// Migration path:
//   New features / cross-module calls should use window.FT.tasks.*,
//   window.FT.nutrition.*, etc. instead of calling globals directly.
//   Once a domain's rendering functions are extracted from this monolith,
//   the EventBus subscriptions below become the primary refresh trigger.
// ========================================================================

(function () {
  'use strict';

  // ── 1. Unified Namespace ──────────────────────────────────────────

  window.FT = {
    tasks:      window.TasksController      || null,
    nutrition:  window.NutritionController   || null,
    workouts:   window.WorkoutsController    || null,
    dashboard:  window.DashboardController   || null,
    calendar:   window.CalendarController    || null,
    streaks:    window.StreaksController      || null,
    projects:   window.ProjectsController    || null,
    statistics: window.StatisticsController  || null,
    profile:    window.ProfileController     || null,
    focus:      window.FocusController       || null,
    notes:      window.NotesController       || null,
    aiChat:     window.AIChatController      || null,

    // Shared infrastructure
    state:    window.AppState   || null,
    bus:      window.EventBus   || null,
    api:      window.ApiClient  || null
  };

  // ── 2. Startup Validation ─────────────────────────────────────────

  var _expected = [
    'TasksController', 'NutritionController', 'WorkoutsController',
    'DashboardController', 'CalendarController', 'StreaksController',
    'ProjectsController', 'StatisticsController', 'ProfileController',
    'FocusController', 'NotesController', 'AIChatController',
    'EventBus', 'ApiClient', 'AppState'
  ];
  var _missing = _expected.filter(function (name) { return !window[name]; });
  if (_missing.length) {
    console.warn('[FT Bridge] Missing modules:', _missing.join(', '));
  } else {
    console.log('[FT Bridge] All 15 modules loaded âœ“');
  }

  // ── 3. EventBus Subscriptions ─────────────────────────────────────
  // React to state changes broadcast by hydration.js / services.
  // Each subscription calls the appropriate rendering function defined
  // in this monolith. When rendering is eventually extracted into
  // feature modules, only these handlers need to change.

  if (window.EventBus) {
    window.EventBus.subscribe('STATE_UPDATED:tasks', function () {
      if (typeof renderAllTaskViews === 'function') renderAllTaskViews();
    });

    window.EventBus.subscribe('STATE_UPDATED:meals', function () {
      if (typeof renderNutritionUI === 'function') renderNutritionUI();
    });

    window.EventBus.subscribe('STATE_UPDATED:workouts', function () {
      if (typeof renderWorkoutUI === 'function') renderWorkoutUI();
    });

    window.EventBus.subscribe('STATE_UPDATED:streaks', function () {
      if (typeof renderStreaksUI === 'function') renderStreaksUI();
    });

    window.EventBus.subscribe('STATE_UPDATED:projects', function () {
      if (typeof renderProjectsUI === 'function') renderProjectsUI();
    });

    window.EventBus.subscribe('STATE_UPDATED:profile', function () {
      if (typeof renderProfileUI === 'function') renderProfileUI();
    });

    window.EventBus.subscribe('STATE_UPDATED:focus', function () {
      if (typeof renderFocusUI === 'function') renderFocusUI();
    });

    window.EventBus.subscribe('STATE_UPDATED:notes', function () {
      if (typeof renderNotesUI === 'function') renderNotesUI();
    });

    window.EventBus.subscribe('STATE_UPDATED:calendar', function () {
      if (typeof renderCalendar === 'function') renderCalendar();
    });

    window.EventBus.subscribe('STATE_UPDATED:dashboard', function () {
      if (typeof refreshDashboardMetrics === 'function') refreshDashboardMetrics();
    });

    console.log('[FT Bridge] EventBus subscriptions wired âœ“');
  }

})();
