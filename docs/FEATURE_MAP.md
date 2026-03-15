# FitTrack Pro — Feature Map

> **Purpose:** Map every user-facing feature to its code locations.
> **Last updated:** 2026-03-15

---

## How to Read This Document

Each feature lists:
- **HTML** — element IDs or containers in `static/index.html`
- **JS** — section(s) in `static/script.js` (§-number from section headers)
- **CSS** — section(s) in `static/styles.css` (§-number from section headers)
- **API** — Flask endpoint(s) and route file
- **Storage** — where data persists

---

## 1. Dashboard

| Layer | Location |
|-------|----------|
| HTML | `<div id="dashboard">`, `#daily-goals`, `#quick-actions` |
| JS | §8 Dashboard |
| CSS | §4 Legacy Dashboard, §5 Quick Actions, §14 Dashboard v2 |
| API | `GET /api/dashboard/summary` → `dashboard_routes.py` |
| Storage | API (aggregated from tasks, meals, workouts) |

---

## 2. Tasks

| Layer | Location |
|-------|----------|
| HTML | `<div id="tasks">`, `#task-list`, `#task-modal` |
| JS | §4 Task Card Rendering, §5 Tasks API + CRUD, §14 Task Modal Setup |
| CSS | §6 Task Buttons, §8 Task States, §13 Tasks v2 |
| API | `GET/POST /api/tasks`, `GET/PATCH/DELETE /api/tasks/<id>` → `tasks_routes.py` |
| Storage | SQLite `tasks` table (API); subtasks + quadrant in `localStorage` |

---

## 3. Calendar — Monthly View

| Layer | Location |
|-------|----------|
| HTML | `<div id="calendar">`, `#calendar-grid` |
| JS | §6 Calendar (Month + Weekly) |
| CSS | §27 Calendar Weekly (shared base styles apply) |
| API | Uses tasks API to fetch tasks by date |
| Storage | `calendarState` in memory; important dates in `localStorage` |

---

## 4. Calendar — Weekly View

| Layer | Location |
|-------|----------|
| HTML | `#weekly-view`, `.weekly-day-column` (rendered dynamically) |
| JS | §6 Calendar — `renderWeeklyView()`, `initWeeklySortable()` |
| CSS | §27 Calendar Weekly |
| API | `PATCH /api/tasks/<id>` for drag-and-drop date changes |
| Storage | Task data via API; Sortable.js instances in `calendarState._sortables` |

---

## 5. Nutrition

| Layer | Location |
|-------|----------|
| HTML | `<div id="nutrition">`, `#meal-list`, `#nutrition-chatbot` |
| JS | §7 Nutrition Module |
| CSS | §12 Nutrition |
| API | `GET/POST /api/nutrition/meals`, `PATCH/DELETE /api/nutrition/meals/<id>`, `POST /api/nutrition/detect` → `nutrition_routes.py` |
| Storage | SQLite `nutrition_entries` table; `nutritionState` in memory |

---

## 6. Workouts

| Layer | Location |
|-------|----------|
| HTML | `<div id="workouts">`, `#workout-list` |
| JS | §11 Workouts |
| CSS | §16 Workouts |
| API | `GET/POST /api/workouts`, `GET/PATCH/DELETE /api/workouts/<id>`, `GET /api/workouts/templates` → `workouts_routes.py` |
| Storage | SQLite `workouts` table; `workoutState` in memory |

---

## 7. Projects

| Layer | Location |
|-------|----------|
| HTML | `<div id="projects">` |
| JS | §10 Projects (100% client-side) |
| CSS | §7 Projects Legacy, §9 Projects v2 |
| API | **None** — projects never touch the server |
| Storage | `localStorage` only (`projectsState`) |

---

## 8. Statistics

| Layer | Location |
|-------|----------|
| HTML | `<div id="statistics">`, canvas elements for charts |
| JS | §12 Statistics |
| CSS | §10 Statistics |
| API | `GET /api/streaks/analytics?period=...` → `streaks_routes.py` |
| Storage | API-fetched data; `statisticsState` in memory |

---

## 9. Streaks & Points

| Layer | Location |
|-------|----------|
| HTML | `<div id="streaks">`, streak counter, XP bar |
| JS | §9 Streaks |
| CSS | §15 Streaks |
| API | `POST /api/streaks/evaluate`, `GET /api/streaks/analytics` → `streaks_routes.py` |
| Storage | SQLite `user_progress` table; cached in `localStorage` |

Backend engine: `app/points_engine.py` — scoring rules, XP/level math.

---

## 10. Profile & Settings

| Layer | Location |
|-------|----------|
| HTML | `<div id="profile">`, `#profile-menu` |
| JS | §13 Profile |
| CSS | §11 Profile |
| API | None — profile is client-only |
| Storage | `localStorage` (`profileState`) |

---

## 11. Focus / Study Module

| Layer | Location |
|-------|----------|
| HTML | `<div id="focus">`, timer display, session list |
| JS | §18 Focus Module |
| CSS | §25 Focus |
| API | `GET/POST /api/focus/sessions`, `GET/PATCH/DELETE /api/focus/sessions/<id>`, `GET /api/focus/stats`, `GET /api/focus/streaks` → `focus_routes.py` |
| Storage | SQLite `focus_sessions` table; `_focus` state in memory |

---

## 12. Notes

| Layer | Location |
|-------|----------|
| HTML | `<div id="notes">`, `#notes-modal` |
| JS | §19 Notes Module |
| CSS | §26 Notes |
| API | `GET/POST /api/notes`, `GET/PATCH/DELETE /api/notes/<id>` → `notes_routes.py` |
| Storage | SQLite `notes` table; `_notes` state in memory |

---

## 13. AI Chat

| Layer | Location |
|-------|----------|
| HTML | `#ai-chat-panel`, `#ai-messages` |
| JS | §16 AI Chat |
| CSS | §19 AI Chat, §20 Dark AI Chat |
| API | `POST /api/ai/chat`, `POST /api/ai/execute` → `ai_routes.py` |
| Backend | `app/ai_avatar.py` — Gemini prompt construction + response parsing |
| Storage | Chat history in DOM only (lost on refresh) |

---

## 14. Mentor AI

| Layer | Location |
|-------|----------|
| HTML | `#mentor-message-container` |
| JS | §17 Mentor AI |
| CSS | §24 Mentor |
| API | `POST /api/ai/chat` (mode = "mentor") → `ai_routes.py` |
| Storage | `_mentorMessageShown` flag in memory |

---

## 15. Auth Session & Onboarding

| Layer | Location |
|-------|----------|
| HTML | `#auth-root`, `#welcome-screen`, `#profile-essentials-screen`, `#demo-tour-screen` |
| JS | `static/js/00-auth.js` and `script.js` §2 Auth Session Bootstrap |
| CSS | `static/css/00-auth.css`, `static/css/01-onboarding.css` |
| API | `POST /api/auth/signup`, `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/logout`, onboarding completion routes in `auth_routes.py` |
| Storage | HttpOnly session cookie + server-side `sessions` table; user-scoped localStorage keys for prefs |

---

## 16. Dark Mode / Theming

| Layer | Location |
|-------|----------|
| HTML | `<body class="dark-mode">` (toggled) |
| JS | §13 Profile — `loadThemePreference()`, `saveThemePreference()` |
| CSS | §18 Dark Mode, §20 Dark AI Chat, §21 Dark Extended, §22 Dark Contrast |
| Storage | `localStorage` (theme key inside `profileState`) |

---

## Cross-Cutting Concerns

| Concern | Location |
|---------|----------|
| Mobile responsive | CSS §23 Mobile Responsive |
| Base reset & typography | CSS §1 Base Reset |
| Sidebar navigation | CSS §2 Sidebar, §3 Nav Keyframes; JS §1 Page Navigation |
| Global polish (scrollbars, tooltips) | CSS §17 Global Polish |
| Emoji icon animations | `static/emoji animations/*.html` (embedded via iframes) |
| DB connection management | `app/db.py` — `get_db()`, `close_db()`, teardown hook |
| Row→dict mapping | `app/mappers.py` — `map_task()`, `map_nutrition()`, etc. |
| Shared route helpers | `app/api/helpers.py` — `default_user_id()`, `normalize_tags()` |
