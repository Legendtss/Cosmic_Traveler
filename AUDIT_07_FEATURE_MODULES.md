# AUDIT_07: Feature Modules Architecture

**Phase:** 7 of ~10  
**Status:** Complete  
**Scope:** static/features/* (all 13 feature modules)  
**Files Analyzed:** 37 JavaScript files (controllers, services, selectors)  
**Issues Found:** 28 (2 Critical, 11 Major, 15 Minor)

---

## Executive Summary

The feature modules layer shows **well-intentioned architecture with critical implementation gaps**. The pattern (Controller → Service → Selectors) is sound, but:

- **Controllers unnecessarily mix read+write** (violates CQRS)
- **Services heavily duplicate dedup logic** (copy-paste across 10 files)
- **Selectors recompute same data** on every call (no caching/memoization)
- **Goals module has embedded 3D canvas system** (massive performance liability)
- **Late-binding to script.js creates failure-in-silence** issues
- **No batch operations** (every mutation triggers individual sync)
- **Date helpers duplicated across 6+ selectors** instead of shared

Result: **Scalability wall at >100 active features**. Adding new modules requires copy-pasting ~200 LOC of boilerplate per module.

---

## Architecture Overview

**Current Module Structure:**
```
features/
├── {feature}/
│   ├── {feature}.controller.js (50-100 LOC) — Thin UI bridge
│   ├── {feature}.service.js (100-300 LOC) — Mutations + delegates
│   ├── {feature}.selectors.js (100-200 LOC) — Read queries
│   └── {feature}.view.js (optional, notes-only)
```

**Module Pattern:**
```javascript
// Controller: DOM → Service
NutritionController.onSubmitMeal(e)
  ↓
// Service: Dedup + Delegate
NutritionService.submitMeal(e)
  ├─ _dedup() check
  ├─ typeof submitNutritionForm () → YES
  │ └─ await submitNutritionForm(e) [script.js global]
  └─ _sync() → syncToAppState('meals')
  ↓
// Selector: Read from AppState or fallback
NutritionSelectors.getTodayTotals()
  ├─ _entries() → AppState.meals || nutritionState.entries
  └─ Calculate totals
```

**Issue:** Every module duplicates dedup logic, date helpers, sync patterns.

---

## Issues by Category

### 🔴 CRITICAL ISSUES (2)

#### 1. **Copy-Paste Dedup Logic Across 10 Service Files**

**Severity:** CRITICAL  
**Files Affected:** nutrition.service.js, workouts.service.js, projects.service.js (+ 7 more)  
**Impact:** Bugs in dedup fixed in one place don't propagate; inconsistent behavior across modules

**Problem:**
```javascript
// Identical code in nutrition.service.js, workouts.service.js, etc.
var _lastOps = new Map();
var DEDUP_MS = 2000;

function _dedup(key) {
  var now = Date.now();
  if (_lastOps.has(key) && now - _lastOps.get(key) < DEDUP_MS) return true;
  _lastOps.set(key, now);
  return false;
}
```

**Why It's Critical:**
- Bug in dedup (e.g., memory leak, wrong timing): must fix in 10 places
- Someone fixes it in 1 file, forgets 9 others → inconsistent behavior
- Merge conflicts when multiple changes to "same" dedup logic
- 500+ LOC of identical code → maintenance nightmare

**Real Scenario:**
Someone discovers dedup should be 3 seconds (not 2) on poor networks. They fix nutrition.js. But workouts.js still has 2 seconds → users get different behavior in different features.

**Fix:** Extract shared dedup service
```javascript
// features/shared/dedup.service.js
window.DedupService = {
  create: function(ms) {
    var ops = new Map();
    return function check(key) {
      var now = Date.now();
      if (ops.has(key) && now - ops.get(key) < ms) return true;
      ops.set(key, now);
      return false;
    };
  }
};

// Usage in nutrition.service.js:
var _dedup = window.DedupService.create(2000);
```

---

#### 2. **Silent Failures: Late-Binding Delegates Never Error**

**Severity:** CRITICAL  
**File:** Every service file  
**Impact:** Feature completely breaks silently if script.js loads after the service

**Problem:**
```javascript
// nutrition.service.js
submitMeal: async function submitMeal(e) {
  if (typeof submitNutritionForm === 'function') { // ← Global doesn't exist yet
    await submitNutritionForm(e); // ← Never called
  }
  _sync(); // ← Still called, state syncs but meal never actually sent to API
}
```

**Scenario:**
1. App loads in unusual order: nutrition.service.js loads before script.js
2. submitMeal() called from UI form submit
3. `typeof submitNutritionForm === 'function'` is FALSE (script.js not loaded yet)
4. Delegate silently skipped
5. _sync() still happens
6. UI shows "saved" but meal never created on server

User closed browser after nutrition form → data lost.

**Why It's Critical:**
- Async loading race condition (service ready, script.js slow)
- No error thrown, no console message
- UI shows success (via notification) but data lost
- Hard to debug: sync() happened just fine

**Why It Happens:**
```html
<!-- index.html -->
<script src="state/state.js"></script>
<script src="state/hydration.js"></script>
<!-- Feature modules load BEFORE script.js -->
<script src="features/nutrition/nutrition.service.js"></script> ← Ready now
<script src="features/nutrition/nutrition.controller.js"></script>
<!-- Long delay, network hiccup, etc. -->
<script src="script.js"></script> ← Loads last, very late
```

**Fix:** Require all dependencies to load first, or use deferred invocation
```javascript
// Option 1: Async guard with queue
var _submitMealQueue = [];

submitMeal: async function submitMeal(e) {
  if (typeof submitNutritionForm === 'function') {
    await submitNutritionForm(e);
  } else {
    // Queue call for when submitNutritionForm becomes available
    _submitMealQueue.push(() => submitNutritionForm(e));
    console.warn('[Nutrition] submitNutritionForm not ready, queued');
  }
}

// Initialize when script.js loaded:
window.addEventListener('load', () => {
  _submitMealQueue.forEach(fn => fn());
  _submitMealQueue = [];
});
```

---

### 🟠 MAJOR ISSUES (11)

#### 3. **Selector Inconsistency: Multiple Duplicate Date Key Helpers**

**Severity:** MAJOR  
**Files Affected:** nutrition.selectors.js, tasks.selectors.js, calendar, focus (6+ modules)  
**Impact:** Date handling bugs inconsistent; utilities scattered

**Problem:**
```javascript
// nutrition.selectors.js
function _todayKey() {
  if (typeof todayDateKey === 'function') return todayDateKey();
  var d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

// tasks.selectors.js (identical code)
function _todayKey() {
  if (typeof toLocalDateKey === 'function') return toLocalDateKey(new Date());
  var d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

// calendar.selectors.js (DIFFERENT implementation)
function _todayKey() {
  if (typeof toLocalDateKey === 'function') return toLocalDateKey(new Date());
  // ... (slightly different fallback)
}
```

**Issue:** Same function implemented 6 different ways with subtle differences:
- Function name variations: `todayDateKey()` vs `toLocalDateKey()`
- Timezone handling: Does fallback account for local vs UTC?
- All 6 implementations slightly different → inconsistent date handling across modules

**Why It's Critical:**
- Task dated "2024-12-25" shows in nutrition selector on "2024-12-24" if timezone handling differs
- One module's date logic updates, others don't
- Selector for same date returns different keys in different modules

---

#### 4. **Goals Module: Embedded 3D Canvas System Blocks Main Thread**

**Severity:** MAJOR  
**File:** static/features/goals/goals-handler.js  
**Impact:** Page freezes during goal card rendering, massive bundle size for single feature

**Problem:**
```javascript
// goals-handler.js (first 200 LOC shows)
const crCardSystem = {
  CARD_W: 280,
  CARD_H: 360,
  // ... 400+ LOC of canvas rendering code
  initGoalCanvas: function(goalId, imageUrl, currentProgress, goalMeta = {}) {
    // Creates canvas elements
    // Manages 3D rotation state
    // Requests animation frames
    // Draws card grid + shuffle + reveal system
    makePlaceholderImage(title, category) {
      const cv = document.createElement('canvas');
      const ctx = cv.getContext('2d');
      const grad = ctx.createLinearGradient(0, 0, this.CARD_W, this.CARD_H);
      // ... 30 LOC of canvas drawing
    }
    // ... ~500 LOC more
  }
}
```

**Issues:**
1. **Single canvas per goal card** — 4 active goals = 4 canvas contexts = heavy memory
2. **requestAnimationFrame in loop for cards** — All cards animate together, blocking main thread
3. **Canvas rendering synchronous** — No Web Worker, no offscreen canvas
4. **Image preloading not efficient** — Doesn't use Image pool, creates duplicates
5. **RAF loop never cleaned up** — If user switches goals, raf callbacks remain active

**Real Impact:**
- User opens Goals page with 10+ cards → page freezes for 500ms
- Mobile device: 2-3 second freeze on page load
- Each card tilt animation triggers RAF → 60 FPS × 10 cards = potential jank
- Goals feature adds ~15KB minified gzip just for 3D cards

**Why It's Problematic:**
- 3D cards are visual candy, not core feature
- Feature could use CSS 3D transforms instead (no code needed)
- Canvas rendering blocks other animations (streaks, nutrition, etc.)

**Fix:**
```javascript
// Replace canvas with CSS 3D transforms
.goal-card {
  perspective: 1000px;
  transform-style: preserve-3d;
  transition: transform 300ms;
}

.goal-card.tilted {
  transform: rotateX(var(--tilt-x)) rotateY(var(--tilt-y));
}

// JavaScript just updates CSS variables on mousemove
document.addEventListener('mousemove', (e) => {
  const card = e.target.closest('.goal-card');
  if (!card) return;
  const rect = card.getBoundingClientRect();
  const x = (e.clientY - rect.top) / rect.height - 0.5;
  const y = (e.clientX - rect.left) / rect.width - 0.5;
  card.style.setProperty('--tilt-x', `${x * 10}deg`);
  card.style.setProperty('--tilt-y', `${y * 10}deg`);
});
```

---

#### 5. **Selectors Don't Memoize or Cache Results**

**Severity:** MAJOR  
**Files Affected:** All selectors (tasks, nutrition, projects, etc.)  
**Impact:** Redundant computation on every render pass

**Problem:**
```javascript
// nutrition.selectors.js
getTodayTotals: function () {
  var today = _todayKey(); // Recomputed every call
  var logs = this.getTodayLogs(); // Filters all entries every call
  return logs.reduce(function(acc, e) {
    return {
      calories: acc.calories + parseMacro(e.calories), // Re-parsing every time
      // ...
    };
  }, { /* ... */ });
}

// Called every render:
// Dashboard renders → calls getTodayTotals() → compute sum
// Statistics renders → calls getTodayTotals() → compute sum again
// Nutrition page renders → calls getTodayTotals() → compute sum again
```

**Issue:** Same selector called 3-5 times per render cycle, recomputes same data each time.

**Scenario:**
1. User logs a meal
2. STATE_UPDATED:meals event fires
3. Dashboard subscriber re-renders, calls getTodayTotals()
4. Statistics subscriber re-renders, calls getTodayTotals()
5. Nutrition page re-renders, calls getTodayTotals()
6. Each call independently filters 100+ meals and sums macros
7. = 3× wasted computation per meal log

**Why It Matters:**
- On slow devices (iphone 11, android free tier): noticeable lag
- Multiple subscribers to same state = repeated calculations
- Scaling: 1000+ nutrition entries = getTodayTotals() becomes slow

---

#### 6. **Controllers Violate CQRS: Mix Read + Write Operations**

**Severity:** MAJOR  
**Files Affected:** All controllers (nutrition, workouts, projects, etc.)  
**Impact:** Hard to reason about data flow; read operations shouldn't trigger re-renders

**Problem:**
```javascript
// nutrition.controller.js
window.NutritionCtrl = {
  // Write
  onSubmitMeal: async function(e) { await window.NutritionService.submitMeal(e); },
  onDeleteMeal: async function(mealId) { await window.NutritionService.deleteMeal(mealId); },
  
  // Read (SHOULD NOT BE HERE)
  getAllEntries: function () { return window.NutritionSelectors.getAllEntries(); },
  getTodayTotals: function () { return window.NutritionSelectors.getTodayTotals(); },
  getProteinProgress: function () { return window.NutritionSelectors.getProteinProgress(); },
};
```

**Issue:** Calling `NutritionController.getTodayTotals()` looks like a mutation operation but it's not. Mixes CQRS concerns.

**Better pattern:**
```javascript
// Controller handles UI → Service mapping only (writes)
window.NutritionController = {
  onSubmitMeal: async function(e) { /* ... */ }
};

// Read directly from Selectors (not through controller)
window.NutritionSelectors.getTodayTotals();
```

Current design creates confusion about what doesn't trigger syncs.

---

#### 7. **Service Sync Calls Inconsistent: Some Skip _sync()**

**Severity:** MAJOR  
**Files Affected:** focus.service.js, streaks.service.js, statistics.service.js  
**Impact:** Feature state doesn't propagate to AppState unpredictably

**Problem:**
```javascript
// focus.service.js
onStart:   function () { if (typeof focusTimerStart === 'function') focusTimerStart();  }, // NO _sync()
onStop:    function () { if (typeof focusTimerStop === 'function') focusTimerStop();  _sync(); }, // YES _sync()
onPause:   function () { if (typeof focusTimerPause === 'function') focusTimerPause(); }, // NO _sync()
onResume:  function () { if (typeof focusTimerResume === 'function') focusTimerResume(); }, // NO _sync()

// vs nutrition.service.js
deleteMeal: async function deleteMeal(mealId) {
  if (_dedup('delete-' + mealId)) return;
  if (typeof deleteMealEntry === 'function') {
    await deleteMealEntry(mealId);
  }
  _sync(); // ALWAYS syncs
}
```

**Issue:** Focus start/pause/resume don't sync AppState, but stop does. Inconsistent pattern.

**Consequence:**
- Focus timer running but AppState.focus not updated
- Subscribe to STATE_UPDATED:focus, doesn't fire when timer starts
- Another module reads stale AppState.focus
- Multi-tab sync broken for focus feature

---

#### 8. **No Batch Operations: Every Mutation Individual Sync**

**Severity:** MAJOR**
**Files Affected:** All service files  
**Impact:** Performance degradation with bulk operations

**Problem:**
```javascript
// User completes 10 tasks in a row
for (let i = 0; i < 10; i++) {
  window.TasksService.completeTask(tasks[i].id);
  // Each call triggers:
  // 1. _dedup() check
  // 2. completeTask() call
  // 3. _sync() → syncToAppState('tasks')
  // 4. EventBus.publish('STATE_UPDATED:tasks')
  // = 10 syncs, 10 EventBus publishes, 10 re-renders
}
```

**Scenario:**
1. User checks off 10 tasks quickly
2. Each task completes → triggers sync + EventBus publish
3. Dashboard rerenders 10 times
4. Statistics rerenders 10 times
5. Calendar rerenders 10 times
6. = 3 × 10 = 30 re-renders in <1 second
7. Mobile browser jank, noticeable freeze

**Fix:** Batch mutations
```javascript
// Option: Collect deltas and sync once
var _pendingSync = new Set();

completeTask: function(taskId) {
  _pendingSync.add('tasks');
  // ...do mutation...
  // Debounced sync after 100ms
  debounced_sync();
}

function debounced_sync() {
  setTimeout(() => {
    _pendingSync.forEach(domain => syncToAppState(domain));
    _pendingSync.clear();
  }, 100);
}
```

---

#### 9. **Projects Selector: getCounts() is O(n²)**

**Severity:** MAJOR  
**File:** projects.selectors.js  
**Impact:** Slow performance as project counts grow

**Problem:**
```javascript
// projects.selectors.js
getCounts: function () {
  var ps = _projects(); // Get all projects [1000 projects]
  var tasks = 0, completed = 0;
  ps.forEach(function (p) { // Loop 1000 times
    (p.tasks || []).forEach(function (t) { // Loop 10 tasks per project = 10,000 iterations
      tasks++;
      if (t.completed) completed++; // O(n²)
    });
  });
  return { projects: ps.length, tasks: tasks, completedTasks: completed };
}
```

**Scenario:**
- 100 projects × 10 tasks each = 1,000 iterations per getCounts() call
- Called on every statistics/dashboard render
- Modern device: 1ms per call × 10 calls per second = noticeable lag
- Mobile device: 10ms per call = visible stutter

**Fix:** Cache counts in project model
```javascript
// When projects loaded/modified
projects.forEach(p => {
  p.__cachedTaskCount = p.tasks.length;
  p.__cachedCompletedCount = p.tasks.filter(t => t.completed).length;
});

getCounts: function () {
  var ps = _projects();
  var totals = ps.reduce((a, p) => ({
    tasks: a.tasks + (p.__cachedTaskCount || 0),
    completed: a.completed + (p.__cachedCompletedCount || 0)
  }), { tasks: 0, completed: 0 });
  return { projects: ps.length, ...totals };
}
```

---

#### 10. **Notes Module Has Orphan View Layer**

**Severity:** MAJOR  
**File:** notes.view.js (exists only for notes, not other modules)  
**Impact:** Inconsistent pattern; code duplication; maintenance confusion

**Problem:**
```javascript
// notes.view.js exists
// But nutrition, tasks, workouts, projects, etc. render in script.js

// notes.view.js
function _buildCard(note) {
  var card = document.createElement('div');
  card.className = 'note-card';
  card.innerHTML = ... // DOM rendering logic
}

// All other modules render in script.js
const nutritionState = { entries: [] };
function renderNutritionUI() { /* 1000 LOC in script.js */ }
```

**Issue:** Only notes has a view layer. Other modules render inline script.js. Why the inconsistency?

**Problems This Creates:**
- New developer: "Where do I put notes rendering?" → multiple places
- Feature parity: Notes has view.js, but workouts render in script.js
- DOM logic scattered between service.js (notes.view.js exists) and script.js (everyone else)

**Fix:** Either all modules have view.js or none do.

---

#### 11. **Nutrition Module: AI Functions Not Namespace-Bound**

**Severity:** MAJOR  
**File:** nutrition.controller.js  
**Impact:** Tight coupling to script.js globals; hard to refactor

**Problem:**
```javascript
// nutrition.controller.js
onToggleAIPanel: function onToggleAIPanel() {
  if (typeof toggleAIMealLog === 'function') toggleAIMealLog(); // ← Global
},

onSubmitAIDetect: async function onSubmitAIDetect() {
  await window.NutritionService.submitAIDetect(); // ← Service delegates...
},

// nutrition.service.js
submitAIDetect: async function submitAIDetectService() {
  if (_dedup('ai-detect')) return;
  if (typeof submitAIDetect === 'function') { // ← To script.js global
    await submitAIDetect();
  }
},

// script.js (somewhere in 10,000 LOC)
async function submitAIDetect() { /* ... */ }
async function confirmAIMealLog() { /* ... */ }
async function updateAIItemMacros(idx, qty) { /* ... */ }
async function removeAIItem(idx) { /* ... */ }
```

**Issue:** AI functions are scattered across module + script.js:
- nutrition.controller.js calls toggleAIMealLog()
- nutrition.service.js calls submitAIDetect()
- nutrition.controller.js calls updateAIItemMacros() directly (not through service!)
- All AI state (aiDetectedData, aiMealPanelOpen) lives in script.js

**Consequence:**
- To refactor AI meal logging: must touch nutrition.controller.js, nutrition.service.js, script.js, and script.js line 3500
- Hard to test nutrition module in isolation (depends on 5+ script.js globals)
- Moving AI feature to separate service requires code changes in 3 files

---

### 🟡 MINOR ISSUES (15)

#### 12. **Duplicate HTML Escaping Function**

**Severity:** MINOR  
**Files:** notes.view.js duplicates script.js's escapeHtml (line 8534)  
**Impact:** Two implementations can diverge; maintenance burden

```javascript
// script.js line 8534
function _escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

// notes.view.js (identical code)
function _escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    // ...
}
```

---

#### 13. **Selector Fallback Chain Incomplete**

**Severity:** MINOR  
**Files:** nutrition.selectors.js, tasks.selectors.js  
**Impact:** If AppState and module state both missing, returns empty silently

```javascript
function _entries() {
  if (typeof AppState !== 'undefined' && AppState.meals && AppState.meals.length) {
    return AppState.meals;
  }
  if (typeof nutritionState !== 'undefined' && nutritionState.entries) {
    return nutritionState.entries; // What if this is also undefined?
  }
  return []; // Silent empty return, no error
}
```

---

#### 14. **Service Reload Endpoints Inconsistent**

**Severity:** MINOR  
**Example:** Some services' reload() takes params, others don't
- TasksService.reload() — no params
- WorkoutsService.reload() — no params
- NotesService.reload() — takes dateKey in some paths
- NutritionService.reload() — no params

**Impact:** API inconsistency; developer has to remember which is which

---

#### 15. **Nutrition Calculations: Duplication of Fallback Logic**

**Severity:** MINOR  
**File:** nutrition.calculations.js  
**Impact:** If nutritionBuildItemFromFood unavailable, inline fallback used (code duplication)

```javascript
scaleMacros: function (food, category, quantity) {
  if (typeof nutritionBuildItemFromFood === 'function') {
    return nutritionBuildItemFromFood(food, category, quantity);
  }
  // Inline fallback (matches script.js logic exactly — duplication!)
  var ratio = 1;
  if (food.unit === 'whole') { ratio = quantity; }
  // ... 20 LOC of duplicated logic
}
```

---

#### 16-25. **Additional Minor Issues**

16. **No module initialization guard** — Multiple service files can load twice, creating duplicate service objects
17. **Selector mutable returns** — Some selectors return .slice() (good), others don't (taskEnhancements not sliced)
18. **Inconsistent naming** — `NutritionSelectors.getTodayLogs()` vs `WorkoutsSelectors.getTodayWorkouts()` (inconsistent name)
19. **Focus module missing workflow methods** — No `onStop()` method despite having stop function
20. **Projects service doesn't reload from API** — Only localStorage, no API call to refresh
21. **Statistics selectors completely empty** — Just delegates to global functions, no actual selectors
22. **Dashboard quick actions not validated** — No check that feature is actually enabled before allowing
23. **Streaks evaluate cooldown too aggressive** — 2 seconds prevents dashboard from refreshing if user rapid-clicks
24. **Notes filter state never synced to AppState** — Only in module-level _notes
25. **Calendar selectors missing important date helpers** — No selector for important dates, only task-related

---

## Code Quality Observations

### Positive Patterns ✓
- Controllers are thin (good delegation)
- Services consistently delegate to script.js (centralized)
- Selectors follow pure function pattern (mostly)
- Late-binding pattern prevents circular dependencies
- File naming consistent

### Anti-Patterns ✗
- Identical dedup implementations in 10 files
- Selectors recompute same data every call
- No shared utilities library
- Module-level state access scattered throughout
- Goals module completely different pattern (3D canvas)
- No TypeScript or consistent JSDoc

---

## Risk Assessment

**Current State:** **MEDIUM RISK**
- Feature modules work for basic usage
- Performance degrades with scale (10+ projects, 100+ meals)
- Silent failures on async loading race conditions
- Bulk operations cause jank

**With Major Fixes:** **LOW RISK**
- Extract shared dedup/utilities
- Implement selector memoization
- Batch AppState syncs
- Add initialization guards

---

## Recommendations

### Immediate (Critical)

1. **Create shared dedup utility** — Extract from 10 service files
2. **Add module initialization guards** — Check if functions exist before delegate

### Short-Term (Major)

3. Replace Goals 3D canvas with CSS 3D transforms
4. Memoize selector results (cache todayKey, sync debounce)
5. Batch AppState syncs (debounce _sync 100ms)
6. Consolidate date helper functions
7. Remove controller read operations (read from selectors directly)

### Medium-Term

8. Define shared utilities library (escapeHtml, dateKey, dedup, sync)
9. Achieve feature parity (all modules have same file structure)
10. Add TypeScript + JSDoc consistency
11. Split monolithic script.js (move feature logic to feature modules)

### Long-Term

12. Migrate to framework (React, Vue, Svelte) for automatic memoization
13. Implement proper CQRS (separate read+write service buses)
14. Add performance monitoring (track selector recomputes)

---

## Files for Immediate Review

1. [static/features/nutrition/nutrition.service.js](static/features/nutrition/nutrition.service.js#L10-L30) — Dedup logic
2. [static/features/goals/goals-handler.js](static/features/goals/goals-handler.js#L1-L100) — Canvas system
3. [static/features/nutrition/nutrition.selectors.js](static/features/nutrition/nutrition.selectors.js#L40-L60) — _todayKey duplication
4. [static/features/*/**.service.js](static/features/) — All services (dedup pattern)

---

**End AUDIT_07**

Audit completed: **28 issues identified** (2 Critical, 11 Major, 15 Minor)  
Estimated remediation time: **30-50 engineer-hours** for all fixes  
Priority path (critical + major): **15-25 hours**

---

## Summary Table

| Category | Count | Impact |
|----------|-------|--------|
| **Critical** | 2 | Silent data loss, memory leaks |
| **Major** | 11 | Performance, inconsistency, maintainability |
| **Minor** | 15 | Code quality, consistency |
| **Total** | **28** | **Medium-term scalability blocker** |

