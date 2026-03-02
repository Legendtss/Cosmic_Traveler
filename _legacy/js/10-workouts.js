// ========================================
// Workout Experience
// ========================================

const WORKOUT_TEMPLATE_KEY_BASE = 'fittrack_workout_templates_v1';
const WORKOUT_META_KEY_BASE = 'fittrack_workout_meta_v1';
function workoutTemplateStorageKey() {
  return activeDemoUserId ? (WORKOUT_TEMPLATE_KEY_BASE + '_' + activeDemoUserId) : WORKOUT_TEMPLATE_KEY_BASE;
}
function workoutMetaStorageKey() {
  return activeDemoUserId ? (WORKOUT_META_KEY_BASE + '_' + activeDemoUserId) : WORKOUT_META_KEY_BASE;
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
    if (activeDemoUserId) {
      rows = getActiveUserWorkoutsData();
    } else {
      const res = await fetch('/api/workouts');
      if (!res.ok) throw new Error('Failed to load workouts');
      rows = await res.json();
    }
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
  if (activeDemoUserId) {
    const workouts = getActiveUserWorkoutsData();
    const idx = workouts.findIndex(w => w.id === id);
    if (idx < 0) return false;
    workouts[idx] = { ...workouts[idx], ...payload };
    setActiveUserWorkoutsData(workouts);
    return true;
  }

  const res = await fetch(`/api/workouts/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
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
  if (activeDemoUserId) {
    const workouts = getActiveUserWorkoutsData();
    const created = {
      id: nextLocalId(workouts),
      name: payload.name || 'Workout',
      type: payload.type || 'strength',
      intensity: payload.intensity || 'medium',
      duration: Number(payload.duration) || 0,
      calories_burned: Number(payload.calories_burned) || 0,
      notes: payload.notes || '',
      exercises: Array.isArray(payload.exercises) ? payload.exercises : [],
      date: dateStr(),
      time: '09:00'
    };
    workouts.push(created);
    setActiveUserWorkoutsData(workouts);
    return created;
  }

  const res = await fetch('/api/workouts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
