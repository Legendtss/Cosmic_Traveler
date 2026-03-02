/**
 * ============================================================================
 * state/state.js — Central Application State
 * ============================================================================
 *
 * Single authoritative state container for FitTrack Pro.
 * All modules sync their data here after mutations.
 *
 * RULES:
 *   - This file contains NO business logic.
 *   - Do NOT read/write localStorage here.
 *   - Do NOT call fetch() here.
 *   - Mutations go through state/userState.js.
 *   - Hydration goes through state/hydration.js.
 *
 * All properties mirror the shapes already used by existing module-level
 * state objects (taskUiState, nutritionState, workoutState, etc.).
 *
 * Loaded BEFORE script.js via <script> tag.
 */
(function () {
  'use strict';

  window.AppState = {
    // ── User identity ──────────────────────────────────────────
    user: null,               // { id, fullName, email }
    demoUserId: null,         // mirrors activeDemoUserId

    // ── Core data arrays ───────────────────────────────────────
    tasks: [],                // mirrors taskUiState.tasks
    meals: [],                // mirrors nutritionState.entries
    workouts: [],             // mirrors workoutState.workouts
    notes: [],                // mirrors _notes.items
    focusSessions: [],        // mirrors _focus.sessions

    // ── localStorage-only resources ────────────────────────────
    projects: [],             // mirrors projectsState.projects
    savedMeals: [],           // mirrors nutritionState.savedMeals
    importantDates: [],       // mirrors calendarState.importantDates (as array)

    // ── Streaks & Points ───────────────────────────────────────
    streaks: {
      currentStreak: 0,
      longestStreak: 0,
      totalPoints: 0,
      level: 1,
      xpIntoLevel: 0,
      xpNeeded: 200,
    },

    // ── Profile / Settings ─────────────────────────────────────
    profile: null,            // mirrors profileState
    theme: 'light',           // mirrors profileState.theme

    // ── Lifecycle ──────────────────────────────────────────────
    hydrated: false,          // set true by hydrateAppState()
    lastSyncAt: null,         // epoch ms of last syncToAppState()
  };

})();
