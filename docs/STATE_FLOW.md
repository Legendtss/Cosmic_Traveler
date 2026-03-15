# FitTrack Pro — State Flow

> **Purpose:** Document how state flows through the application.
> **Last updated:** 2026-03-15

---

## 1. Global State Objects

All mutable state lives in these top-level objects. There is no centralized
state management (no Redux, no Vuex). Most are still defined in script.js,
while Notes state is now owned by the Notes feature service.

| Object | Section | Storage | Description |
|--------|---------|---------|-------------|
| `taskUiState` | §4 | Memory + API | Tasks array, layout, expanded set, edit state |
| `taskEnhancements` | §4 | localStorage | Per-task subtasks and Eisenhower quadrant |
| `calendarState` | §6 | localStorage | Selected date, view mode, important dates, Sortable instances |
| `nutritionState` | §7 | Memory + API | Meal entries, calorie goals, saved meals |
| `nutritionBuilderState` | §7 | Memory | Current builder-mode item list |
| `dashboardState` | §8 | Memory | Timer state, goals, quick actions |
| `projectsState` | §10 | localStorage | Projects array (never touches server) |
| `workoutState` | §11 | Memory + API | Workouts, templates, metadata |
| `statisticsState` | §12 | Memory | Chart data, period settings |
| `profileState` | §13 | localStorage | User profile, theme, macro targets |
| `_focus` | §18 | Memory + API | Timer state, audio, pomodoro config, sessions |
| `_notes` | features/notes | Memory + API | Notes array, filter, search, editing state |

### AI Chat State (loose variables, §16–17)

| Variable | Description |
|----------|-------------|
| `aiChatOpen` | Boolean — is the chat panel visible |
| `aiPendingAction` | Last AI-proposed action awaiting user confirmation |
| `_aiSending` | Lock — prevents concurrent API requests |
| `chatbotMode` | Active mode: general / nutrition / workout / task |
| `_mentorMessageShown` | Boolean — has mentor message been shown this session |

---

## 2. Data Flow Patterns

### Pattern A: API-Backed Resources (Tasks, Meals, Workouts, Focus, Notes)

```
User Action
    │
    ▼
Event Handler (click/submit)
    │
    ▼
fetch() to /api/*
    │
    ▼
Flask route handler
    │
    ▼
SQLite/PostgreSQL CRUD via get_db()
    │
    ▼
JSON response
    │
    ▼
Update state object
    │
    ▼
Re-render UI
```

### Pattern B: localStorage-Only Resources (Projects, Profile, Prefs)

```
User Action
    │
    ▼
Event Handler
    │
    ▼
Update state object
    │
    ▼
Persist to localStorage
    │
    ▼
Re-render UI
```

### Pattern C: AI Chat Flow

```
User types message
    │
    ▼
Rate-limit check (_AI_COOLDOWN_MS)
    │
    ▼
POST /api/ai/chat  (with mode, message, session_id)
    │
    ▼
ai_avatar.process_avatar_message()
    │
    ├── Gemini API call (with system prompt + context)
    │
    ▼
Parse JSON response → {intent, status, message, data?}
    │
    ├── status = "chat_response"    → Display message
    ├── status = "needs_confirmation" → Show confirm bar
    │        │
    │        └── User confirms → POST /api/ai/execute
    │                              │
    │                              ▼
    │                          Execute action (create task, log meal, etc.)
    │                              │
    │                              ▼
    │                          Reload relevant data
    │
    └── status = "error"        → Show error message
```

### Pattern D: Streak Evaluation

```
Task completed / Meal logged / Workout logged
    │
    ▼
POST /api/streaks/evaluate
    │
    ▼
points_engine.evaluate_and_save()
    │
    ├── Calculate daily points from actual DB data
    ├── Check protein goal, workout completion
    ├── Update streak counter
    ├── Calculate XP and level
    │
    ▼
Return {day, streak, points, level, xp, ...}
    │
    ▼
Cache in localStorage (STREAK_CACHE_KEY)
    │
    ▼
Re-render streaks UI
```

---

## 3. Initialization Sequence

```
DOMContentLoaded fires
    │
    ▼
loadProfileState()            — Restore local profile defaults
loadThemePreference()         — Apply dark/light theme
    │
    ▼
Setup steps (each wrapped in try/catch):
    setupDashboard()
    setupStreaks()
    setupTaskModal()
    setupTaskInteractions()
    setupCalendar()
    setupProjects()
    setupNutrition()
    setupWorkout()
    setupStatistics()
    setupProfileMenu()
    setupProfile()
    setupLayoutCustomizer()
    initFocusModule()
    │
    ▼
bootstrapSession()            — GET /api/auth/me
    │
    ├── Has authenticated user?
    │      ├── onboarding complete → show app shell, showPage('dashboard'), loadActiveUserDataViews()
    │      └── onboarding incomplete → route to demo-tour or profile-essentials
    │
    └── No authenticated user → intro/auth screens
    │
    ▼
Register global listeners:
    document visibilitychange — focus timer refresh
    window beforeunload       — timer cleanup and persistence
    EventBus PAGE_SHOWN       — page-specific lazy loads such as notes via feature-owned subscribers
```

---

## 4. Cross-Module Communication

There is a lightweight EventBus, but the architecture is still hybrid rather than fully event-driven. Modules communicate via:

1. EventBus publications such as STATE_UPDATED:tasks and PAGE_SHOWN
2. Direct function calls across legacy code paths
3. Shared state mutation, for example taskUiState, nutritionState, _focus, and _notes
4. DOM re-rendering from centralized render functions inside script.js, plus feature-owned rendering for Notes

### Key Cross-Module Dependencies

| When this happens... | ...these also update |
|---------------------|---------------------|
| Task created/toggled | Calendar re-renders, streaks re-evaluate, dashboard refreshes |
| Meal logged | Nutrition UI updates, streaks re-evaluate |
| Workout logged | Workout list updates, streaks re-evaluate, dashboard refreshes |
| Page navigation | Relevant `setup*()` or `render*()` fires |
| Auth session changed | User-scoped localStorage keys and server-backed data rehydrate |
| Profile saved | Nutrition goals may update, theme may change |

---

## 5. Stale-Render Guards

Two modules use sequence counters to prevent rendering stale async data:

| Guard | Module | Purpose |
|-------|--------|---------|
| `mealsLoadRequestId` | Nutrition (§7) | Incremented on each loadMeals() call; response ignored if ID doesn't match |
| `_streakEvalSeq` | Streaks (§9) | Incremented on each evaluation; prevents concurrent renders from clobbering |
