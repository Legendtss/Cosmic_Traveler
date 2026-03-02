/**
 * ============================================================================
 * state/hydration.js — One-Time Data Hydration & Sync Helpers
 * ============================================================================
 *
 * Responsibilities:
 *   1. hydrateAppState()   — called ONCE after all setup*() functions run;
 *                            populates AppState from module-level state objects.
 *   2. syncAllToAppState() — copies every module state into AppState (safe to
 *                            call multiple times).
 *   3. syncToAppState(domain) — lightweight per-domain sync after a mutation.
 *   4. syncStreakResult(result) — updates AppState.streaks from eval result.
 *
 * RULES:
 *   - Must be idempotent (hydrateAppState guards with AppState.hydrated).
 *   - Does NOT modify module-level state — only copies INTO AppState.
 *   - Does NOT call fetch() or write localStorage.
 *
 * Loaded AFTER state/state.js and BEFORE script.js.
 */
(function () {
  'use strict';

  // ── Full hydration (one-time) ────────────────────────────────

  /**
   * Populate AppState from existing module-level state objects.
   * Called once at the end of the DOMContentLoaded init sequence.
   * Idempotent — does nothing if already hydrated.
   */
  window.hydrateAppState = function hydrateAppState() {
    if (window.AppState.hydrated) {
      console.warn('[AppState] Already hydrated — skipping');
      return;
    }
    syncAllToAppState();
    window.AppState.hydrated = true;
    console.log('[AppState] Hydrated successfully');
  };

  // ── Bulk sync ────────────────────────────────────────────────

  /**
   * Copy ALL module-level state objects into AppState.
   * Safe to call any number of times.
   */
  window.syncAllToAppState = function syncAllToAppState() {
    var S = window.AppState;

    // Tasks
    if (typeof taskUiState !== 'undefined') {
      S.tasks = taskUiState.tasks || [];
    }

    // Nutrition
    if (typeof nutritionState !== 'undefined') {
      S.meals = nutritionState.entries || [];
      S.savedMeals = nutritionState.savedMeals || [];
    }

    // Workouts
    if (typeof workoutState !== 'undefined') {
      S.workouts = workoutState.workouts || [];
    }

    // Projects
    if (typeof projectsState !== 'undefined') {
      S.projects = projectsState.projects || [];
    }

    // Notes
    if (typeof _notes !== 'undefined') {
      S.notes = _notes.items || [];
    }

    // Focus
    if (typeof _focus !== 'undefined') {
      S.focusSessions = _focus.sessions || [];
    }

    // Calendar
    if (typeof calendarState !== 'undefined' && calendarState.importantDates) {
      S.importantDates = Array.from(calendarState.importantDates);
    }

    // Demo user
    if (typeof activeDemoUserId !== 'undefined') {
      S.demoUserId = activeDemoUserId;
    }

    // Profile
    if (typeof profileState !== 'undefined') {
      S.profile = Object.assign({}, profileState);
      S.theme = profileState.theme || 'light';
      S.user = {
        id: (typeof activeDemoUserId !== 'undefined' && activeDemoUserId) || 'default',
        fullName: profileState.fullName || '',
        email: profileState.email || '',
      };
    }

    S.lastSyncAt = Date.now();
  };

  // ── Per-domain sync ──────────────────────────────────────────

  /**
   * Lightweight sync for a single domain after a mutation.
   * @param {'tasks'|'meals'|'workouts'|'notes'|'focus'|'projects'|'streaks'|'profile'|'calendar'} domain
   */
  window.syncToAppState = function syncToAppState(domain) {
    var S = window.AppState;
    switch (domain) {
      case 'tasks':
        S.tasks = (typeof taskUiState !== 'undefined') ? (taskUiState.tasks || []) : [];
        break;
      case 'meals':
        if (typeof nutritionState !== 'undefined') {
          S.meals = nutritionState.entries || [];
          S.savedMeals = nutritionState.savedMeals || [];
        }
        break;
      case 'workouts':
        S.workouts = (typeof workoutState !== 'undefined') ? (workoutState.workouts || []) : [];
        break;
      case 'notes':
        S.notes = (typeof _notes !== 'undefined') ? (_notes.items || []) : [];
        break;
      case 'focus':
        S.focusSessions = (typeof _focus !== 'undefined') ? (_focus.sessions || []) : [];
        break;
      case 'projects':
        S.projects = (typeof projectsState !== 'undefined') ? (projectsState.projects || []) : [];
        break;
      case 'calendar':
        if (typeof calendarState !== 'undefined' && calendarState.importantDates) {
          S.importantDates = Array.from(calendarState.importantDates);
        }
        break;
      case 'profile':
        if (typeof profileState !== 'undefined') {
          S.profile = Object.assign({}, profileState);
          S.theme = profileState.theme || 'light';
        }
        break;
      case 'streaks':
        // Streaks are synced via syncStreakResult() — no-op here
        break;
      default:
        console.warn('[AppState] Unknown sync domain:', domain);
    }
    S.lastSyncAt = Date.now();

    // Publish domain update event via EventBus
    if (typeof EventBus !== 'undefined' && EventBus.publish) {
      EventBus.publish('STATE_UPDATED:' + domain);
    }
  };

  // ── Streak result sync ───────────────────────────────────────

  /**
   * Update AppState.streaks from a streak evaluation result object.
   * @param {Object} result - From evaluateStreaksAndPoints()
   */
  window.syncStreakResult = function syncStreakResult(result) {
    if (!result || !result.progress) return;
    var S = window.AppState;
    S.streaks = {
      currentStreak: result.progress.current_streak || 0,
      longestStreak: result.progress.longest_streak || 0,
      totalPoints: result.progress.total_points || 0,
      level: result.progress.level || 1,
      xpIntoLevel: result.progress.xp_into_level || 0,
      xpNeeded: result.progress.xp_needed || 200,
    };
    S.lastSyncAt = Date.now();

    // Publish streaks update event
    if (typeof EventBus !== 'undefined' && EventBus.publish) {
      EventBus.publish('STATE_UPDATED:streaks');
    }
  };

})();
