# FitTrack Pro — Architecture Overview

> **Purpose:** Describe the CURRENT system architecture. Not a redesign proposal.
> **Last updated:** 2025-07-15

---

## 1. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                           BROWSER                                   │
│                                                                     │
│  index.html  ←→  Feature Modules (Controller → Service → Selector)  │
│                  script.js (~11,100 lines — legacy monolith)        │
│                  state/ (AppState, EventBus, ApiClient, Hydration)   │
│                  css/ (modular CSS per domain)                       │
│                  localStorage (demo data, prefs, projects)           │
│                  Sortable.js (external CDN)                          │
│                  Font Awesome (external CDN)                         │
│                                                                     │
│  ApiClient / fetch() ────────────────────────────┐                  │
└──────────────────────────────────────────────────│──────────────────┘
                                                    │
                                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        FLASK SERVER                                 │
│                                                                     │
│  run.py → app/__init__.py (factory)                                 │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐               │
│  │ dashboard_bp │  │  tasks_bp    │  │ nutrition_bp │               │
│  │ web_bp       │  │              │  │              │               │
│  └──────────────┘  └──────────────┘  └──────────────┘               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐               │
│  │ workouts_bp  │  │  streaks_bp  │  │   ai_bp      │               │
│  └──────────────┘  └──────────────┘  └──────────────┘               │
│  ┌──────────────┐  ┌──────────────┐                                 │
│  │  focus_bp    │  │  notes_bp    │                                 │
│  └──────────────┘  └──────────────┘                                 │
│                                                                     │
│  Repositories: task_repo, nutrition_repo, workout_repo,             │
│                streaks_repo, notes_repo (DAO layer)                 │
│                                                                     │
│  Shared: db.py, config.py, mappers.py, utils.py, helpers.py        │
│  AI:     ai_avatar.py, nutrition_ai.py, points_engine.py           │
│                                                                     │
│  SQLite ──→ data/fitness.sqlite                                     │
│  Schema ──→ db/schema.sql                                           │
└─────────────────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      EXTERNAL APIs                                  │
│                                                                     │
│  Google Gemini (gemma-3-4b-it / gemini-2.5-flash)                   │
│  └── AI chat, mentor messages, analytics                            │
│                                                                     │
│  USDA FoodData Central                                              │
│  └── Food detection, nutrition search                               │
└─────────────────────────────────────────────────────────────────────┘
```

## 2. Frontend Architecture

### Script Loading Order (index.html)

```
1. Sortable.js (CDN)
2. state/state.js         — AppState singleton
3. state/eventBus.js      — Pub/sub for cross-module communication
4. state/apiClient.js     — Centralized fetch wrapper (window.ApiClient)
5. state/hydration.js     — One-time sync from module state → AppState
6. state/userState.js     — Mutation wrappers
7–9.   features/tasks/    — Selectors → Service → Controller
10–13. features/nutrition/ — Calculations → Selectors → Service → Controller
14–16. features/workouts/  — Selectors → Service → Controller
17–19. features/dashboard/ — Selectors → Service → Controller
20–22. features/calendar/  — Selectors → Service → Controller
23–25. features/streaks/   — Selectors → Service → Controller
26–28. features/projects/  — Selectors → Service → Controller
29–31. features/statistics/ — Selectors → Service → Controller
32–34. features/profile/   — Selectors → Service → Controller
35–37. features/focus/     — Selectors → Service → Controller
38–40. features/notes/     — Selectors → Service → Controller
41–42. features/ai-chat/   — Service → Controller
43. script.js             — Legacy monolith (rendering + DOM wiring)
```

### Feature Module Pattern

Each domain follows a 3-layer pattern:

```
┌───────────────────────┐
│     Controller        │  ← Thin bridge: DOM events → Service calls
│                       │     Zero business logic. Exposes on window.*
├───────────────────────┤
│     Service           │  ← Write operations: delegates to script.js
│                       │     globals via late-binding
├───────────────────────┤
│     Selectors         │  ← Read-only queries: reads from AppState
│                       │     Pure functions, no side effects
└───────────────────────┘
```

**12 domains extracted:** Tasks, Nutrition, Workouts, Dashboard, Calendar,
Streaks, Projects, Statistics, Profile, Focus, Notes, AI Chat.

### FT Facade (window.FT)

The `window.FT` namespace provides unified access to all controllers:
```js
window.FT.tasks.*       // TasksController
window.FT.nutrition.*   // NutritionController
window.FT.workouts.*    // WorkoutsController
// ... all 12 domains + .state, .bus, .api
```

### EventBus Integration

`hydration.js` broadcasts `STATE_UPDATED:<domain>` on every `syncToAppState()` call.
The bridge in script.js subscribes to these events and triggers rendering functions.

## 3. File Inventory

### Frontend (static/)

| Directory | Files | Role |
|-----------|-------|------|
| `state/` | 5 files | AppState, EventBus, ApiClient, Hydration, UserState |
| `features/tasks/` | 3 files | Selectors, Service, Controller |
| `features/nutrition/` | 4 files | Calculations, Selectors, Service, Controller |
| `features/workouts/` | 3 files | Selectors, Service, Controller |
| `features/dashboard/` | 3 files | Selectors, Service, Controller |
| `features/calendar/` | 3 files | Selectors, Service, Controller |
| `features/streaks/` | 3 files | Selectors, Service, Controller |
| `features/projects/` | 3 files | Selectors, Service, Controller |
| `features/statistics/` | 3 files | Selectors, Service, Controller |
| `features/profile/` | 3 files | Selectors, Service, Controller |
| `features/focus/` | 3 files | Selectors, Service, Controller |
| `features/notes/` | 3 files | Selectors, Service, Controller |
| `features/ai-chat/` | 2 files | Service, Controller |
| `css/` | 15 files | Modular CSS per domain |
| `script.js` | ~11,100 | Legacy monolith (rendering, DOM wiring, init) |

### Backend (app/)

| File | Lines | Role |
|------|-------|------|
| `__init__.py` | 43 | Flask app factory, blueprint registration |
| `config.py` | 15 | Paths, API keys, env-var config |
| `db.py` | 253 | SQLite connection, schema init, migration |
| `utils.py` | 25 | Pure helpers: `now_iso()`, `today_str()`, `safe_int()`, `safe_float()` |
| `mappers.py` | 91 | Row→dict mappers for tasks, meals, workouts |
| `ai_avatar.py` | 1,037 | Gemini-powered conversational AI |
| `nutrition_ai.py` | 740 | USDA food detection + macro calculation |
| `points_engine.py` | 422 | Points, streaks, XP, level, achievements |

### Repositories (app/repositories/)

| File | Class(es) | Role |
|------|-----------|------|
| `task_repo.py` | `TaskRepository`, `NoteLinker` | Task CRUD + note linkage |
| `nutrition_repo.py` | `NutritionRepository` | Meal CRUD + bulk create |
| `workout_repo.py` | `WorkoutRepository` | Workout CRUD + toggle |
| `streaks_repo.py` | `StreaksRepository`, `AnalyticsRepository` | Points eval + cross-domain analytics |
| `notes_repo.py` | `NoteRepository` | Note CRUD + task-note linking |

### API Routes (app/api/)

| File | Blueprint | Endpoints | Uses Repository |
|------|-----------|-----------|-----------------|
| `helpers.py` | — | `default_user_id()`, `normalize_tags()` | — |
| `dashboard_routes.py` | `web_bp`, `dashboard_bp` | `GET /`, `GET /api/data` | No raw SQL |
| `tasks_routes.py` | `tasks_bp` | CRUD `/api/tasks`, toggle, note sync | `TaskRepository`, `NoteLinker` |
| `nutrition_routes.py` | `nutrition_bp` | CRUD `/api/meals`, AI detect/log, search | `NutritionRepository` |
| `workouts_routes.py` | `workouts_bp` | CRUD `/api/workouts`, toggle | `WorkoutRepository` |
| `streaks_routes.py` | `streaks_bp` | Evaluate, progress, achievements, analytics | `StreaksRepository`, `AnalyticsRepository` |
| `ai_routes.py` | `ai_bp` | Chat, mentor context, execute actions | — (uses points_engine) |
| `focus_routes.py` | `focus_bp` | Focus session CRUD, summary | — (direct SQL, pending) |
| `notes_routes.py` | `notes_bp` | Notes CRUD, task-note linking | `NoteRepository` |

## 4. Data Storage Strategy

### SQLite (Server-Side / Persistent)

Tables defined in `db/schema.sql`:
- `users` — single default user (ID=1)
- `tasks` — with `note_content`, `note_saved_to_notes` columns
- `nutrition_entries` — meal logs
- `workouts` — workout logs
- `project_subtasks` — project task items (legacy?)
- `stats_snapshots` — periodic stats snapshots
- `user_progress` — XP, level, streaks
- `focus_sessions` — focus/study session records
- `notes` — standalone and task-linked notes

### localStorage (Client-Side / Per-Browser)

| Key Pattern | Data |
|-------------|------|
| `fittrack_demo_user_*` | Demo user ID, prefs, per-user data |
| `fittrack_task_enhancements_*` | Subtasks, Eisenhower quadrant |
| `fittrack_tasks_layout_*` | List/matrix/tag view preference |
| `fittrack_calendar_*` | Important dates, view mode |
| `fittrack_saved_meals_*` | Saved meal presets |
| `fittrack_projects_*` | **Entire projects data** (never touches server) |
| `fittrack_workout_templates_*` | Workout templates and metadata |
| `fittrack_profile_*` | Profile form data |
| `fittrack_theme_*` | Dark/light theme preference |
| `fittrack_streak_cache_*` | Cached streak evaluation |
| `fittrack_dash_quick_actions_*` | Quick action button config |
| `fittrack_ai_session_id_*` | AI chat session ID |

## 5. Authentication Model

**None.** The backend uses a hardcoded `DEFAULT_USER_ID` (env var, defaults to `1`).
No auth headers, no sessions, no tokens. All API calls are unauthenticated.
The demo user system is purely frontend — the backend is unaware of it.

## 6. Theme System

- Default: light theme
- Toggle: `body.classList.toggle('theme-dark')`
- Dark overrides scattered across `styles.css` in:
  - §18 (main dark theme block)
  - §20 (AI chat dark)
  - §21-22 (extended fixes and contrast patches)
  - Inline within each component section

## 7. Known Architectural Debt

1. **Legacy monolith**: `script.js` still contains all rendering & DOM wiring (~11,100 lines) — Controllers delegate to it via late-binding
2. **Monolithic stylesheet**: `styles.css` is ~11,200 lines (split CSS exists in `css/` but `styles.css` is still loaded)
3. **Dual data stores**: Projects are localStorage-only; everything else uses API
4. **Duplicated constants**: Points/streak constants exist in both JS and Python
5. **Duplicated functions**: `escapeHtml()` defined twice in script.js (§4 and §19)
6. **Monkey-patching**: Notes module patches `showPage()` at EOF — fragile chain
7. **No authentication**: Single hardcoded user
8. **Feature toggles are frontend-only**: Backend serves all data regardless
9. **focus_routes.py**: Last route file with raw SQL — needs repository extraction
10. **Controllers are facades only**: DOM event handlers in script.js still call globals directly, not through Controllers

## 8. Migration Path

### Completed
- Backend blueprint decomposition (9 route files)
- Repository pattern for tasks, nutrition, workouts, streaks, notes
- Frontend feature module extraction (12 domains × Controller/Service/Selector)
- State infrastructure (AppState, EventBus, ApiClient, Hydration)
- FT facade namespace unifying all Controllers
- EventBus → rendering bridge in script.js
- Dead code cleanup (routes_legacy.py, root duplicates → `_legacy/`)
- CSS modularization (15 domain-specific files)

### Next Steps
1. **Wire Controllers to DOM**: Replace `addTask()` calls with `TasksController.onAddTask()` in script.js event handlers
2. **Extract rendering**: Move `renderTasksUI()`, etc. out of script.js into feature modules
3. **focus_routes.py** → FocusRepository
4. **ES Module migration**: Convert IIFE/window.* to `export`/`import` with `type="module"`
5. **Authentication layer**: Replace hardcoded user ID
