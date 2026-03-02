// Task Rendering
// ========================================

const TASK_ENHANCEMENTS_KEY_BASE = 'fittrack_task_enhancements_v1';
function taskEnhancementsStorageKey() {
  return activeDemoUserId ? (TASK_ENHANCEMENTS_KEY_BASE + '_' + activeDemoUserId) : TASK_ENHANCEMENTS_KEY_BASE;
}
const TASK_LAYOUT_KEY_BASE = 'fittrack_tasks_layout_v1';
const EISENHOWER_QUADRANTS = [
  { key: 'urgent_important', title: 'Urgent & Important' },
  { key: 'important_not_urgent', title: 'Important but Not Urgent' },
  { key: 'urgent_not_important', title: 'Urgent but Not Important' },
  { key: 'not_urgent_not_important', title: 'Not Urgent & Not Important' }
];

function taskLayoutStorageKey() {
  return activeDemoUserId ? (TASK_LAYOUT_KEY_BASE + '_' + activeDemoUserId) : TASK_LAYOUT_KEY_BASE;
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
    taskEnhancements[key] = { subtasks: [], dueAt: null, repeat: 'none', completedDates: {}, completedAtDates: {}, eisenhowerQuadrant: '', tags: [] };
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
  if (task.dueAt) return new Date(task.dueAt);
  return new Date(`${task.date}T23:59:00`);
}

function isTodayDate(dateObj) {
  const today = new Date();
  return dateObj.getDate() === today.getDate()
    && dateObj.getMonth() === today.getMonth()
    && dateObj.getFullYear() === today.getFullYear();
}

function formatTaskDue(task) {
  const due = taskDueAt(task);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const time = due.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  if (isTodayDate(due)) return `Today, ${time}`;
  if (due.getDate() === tomorrow.getDate() && due.getMonth() === tomorrow.getMonth() && due.getFullYear() === tomorrow.getFullYear()) {
    return `Tomorrow, ${time}`;
  }
  return due.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function taskTimeRemaining(task) {
  if (task.completed) return '';
  const diffMs = taskDueAt(task).getTime() - Date.now();
  if (diffMs < 0) return 'Overdue';
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    return `${days} day${days !== 1 ? 's' : ''} left`;
  }
  if (hours > 0) return `${hours} hour${hours !== 1 ? 's' : ''} left`;
  const mins = Math.floor(diffMs / (1000 * 60));
  return `${Math.max(mins, 1)} min${mins !== 1 ? 's' : ''} left`;
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
  if (task.dueAt) return toLocalDateKey(new Date(task.dueAt));
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
  const due = taskDueAt(task);
  if (due.getTime() < Date.now()) return 'overdue';
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
    const due = combineDateAndTime(occDate, taskDueAt(task));
    const done = isTaskOccurrenceDone(task, occDate);
    const completedAt = taskOccurrenceCompletedAt(task, occDate);
    const state = deriveTaskState({
      ...task,
      completed: done,
      completedAt,
      dueAt: due.toISOString()
    });
    return {
      ...task,
      completed: done,
      completedAt,
      dueAt: due.toISOString(),
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

// ========================================
// Tasks API Functions
// ========================================

async function loadTasks() {
  try {
    taskUiState.layout = loadTaskLayoutPreference();
    renderTaskViewToggleState();
    let tasks;
    if (activeDemoUserId) {
      tasks = getActiveUserTasksData();
    } else {
      const response = await fetch('/api/tasks');
      if (!response.ok) throw new Error('Failed to load tasks');
      tasks = await response.json();
    }
    taskUiState.tasks = (Array.isArray(tasks) ? tasks : []).map(t => {
      const ext = getTaskEnhancement(t.id);
      return {
        ...t,
        description: t.description || '',
        subtasks: Array.isArray(ext.subtasks) ? ext.subtasks : [],
        tags: normalizeTaskTags(Array.isArray(t.tags) ? t.tags : ext.tags),
        dueAt: t.dueAt || ext.dueAt || null,
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
  } catch (err) {
    console.error('Error loading tasks:', err);
    taskUiState.tasks = [];
    renderTasks(taskUiState.tasks);
  }
}
async function addTask(title, priority, dueHours, repeat, customDateTime, tags = []) {
  try {
    const dueDate = new Date(Date.now() + dueHours * 60 * 60 * 1000);
    const dueAt = customDateTime ? new Date(customDateTime) : dueDate;
    const taskDate = toLocalDateKey(dueAt);

    if (activeDemoUserId) {
      const tasks = getActiveUserTasksData();
      const createdTask = {
        id: nextLocalId(tasks),
        userId: activeDemoUserId,
        title,
        priority: priority || 'medium',
        date: taskDate,
        category: repeat || 'general',
        completed: false,
        completedAt: null,
        dueAt: dueAt.toISOString(),
        description: ''
      };
      tasks.push(createdTask);
      setActiveUserTasksData(tasks);

      const ext = getTaskEnhancement(createdTask.id);
      ext.dueAt = dueAt.toISOString();
      ext.subtasks = ext.subtasks || [];
      ext.repeat = repeat || 'none';
      ext.completedDates = ext.completedDates || {};
      ext.completedAtDates = ext.completedAtDates || {};
      ext.tags = normalizeTaskTags(tags);
      saveTaskEnhancements();
      await loadTasks();
      const modal = document.getElementById('add-task-modal');
      if (modal) modal.style.display = 'none';
      return;
    }

    const response = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: title,
        priority: priority || 'medium',
        tags: normalizeTaskTags(tags),
        date: taskDate,
        dueAt: dueAt.toISOString(),
        category: repeat || 'general',
        completed: false
      })
    });

    if (response.ok) {
      const createdTask = await response.json();
      const ext = getTaskEnhancement(createdTask.id);
      ext.dueAt = dueAt.toISOString();
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
    const tasks = activeDemoUserId ? getActiveUserTasksData() : (taskUiState.tasks || []);
    const meals = activeDemoUserId ? getActiveUserMealsData() : (nutritionState.entries || []);
    const workouts = activeDemoUserId ? getActiveUserWorkoutsData() : (workoutState.workouts || []);
    
    // STEP 3-5: Branch between demo (local eval) and API (server-side eval)
    let streakResult;

    if (activeDemoUserId) {
      // DEMO MODE: local evaluation
      const proteinGoal = nutritionState.baseGoals.protein || 140;
      const dayEval = streakEvaluateDay(todayKey, tasks, meals, workouts, proteinGoal);
      console.log(`[Progress Engine] Day recalculated - taskPoints=${dayEval.taskPoints}, totalPoints=${dayEval.totalPoints}, validDay=${dayEval.validDay}`);

      streakResult = streakFullEvalDemo();
      const totalPoints = streakResult.progress.total_points;
      const currentStreak = streakResult.progress.current_streak;
      const longestStreak = streakResult.progress.longest_streak;
      const level = streakResult.progress.level;

      console.log(`[Progress Engine] Global stats recalculated - totalPoints=${totalPoints}, currentStreak=${currentStreak}, level=${level}`);

      _persistUserStats(activeDemoUserId, {
        totalPoints,
        currentStreak,
        longestStreak,
        level,
        lastUpdated: new Date().toISOString()
      });
    } else {
      // API MODE: delegate to server-side authoritative evaluation
      try {
        const resp = await fetch('/api/streaks/evaluate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ date: todayKey })
        });
        streakResult = await resp.json();
        // Normalize server snake_case keys → camelCase for renderStreaksUI
        if (streakResult && streakResult.day) streakResult.day = _normalizeDayEval(streakResult.day);
        console.log(`[Progress Engine] Server eval result:`, streakResult);
      } catch (apiErr) {
        console.warn('[Progress Engine] Server eval failed, falling back to local:', apiErr);
        const proteinGoal = nutritionState.baseGoals.protein || 140;
        streakEvaluateDay(todayKey, tasks, meals, workouts, proteinGoal);
        streakResult = streakFullEvalDemo();
      }
    }
    
    // STEP 6: Refresh dashboard/UI
    console.log('[Progress Engine] Refreshing UI...');
    renderStreaksUI(streakResult);
    renderTasks(taskUiState.tasks);
    
    console.log('[Progress Engine] ✓ Complete - all systems updated');
    
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
    // Recurring task — update specific date
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
    // Single task — update directly
    if (activeDemoUserId) {
      const currentTasks = getActiveUserTasksData();
      const currTask = currentTasks.find(t => t.id === taskId);
      wasCompleted = !!(currTask.completed || currTask.completedAt);
      isNowCompleted = !wasCompleted;
      
      const updated = currentTasks.map(t => {
        if (t.id !== taskId) return t;
        return {
          ...t,
          completed: isNowCompleted,
          completedAt: isNowCompleted ? new Date().toISOString() : null
        };
      });
      setActiveUserTasksData(updated);
    } else {
      // Non-demo: rely on API to toggle
      const response = await fetch(`/api/tasks/${taskId}/toggle`, { method: 'PATCH' });
      if (!response.ok) throw new Error('Failed to toggle task on server');
      
      const currTask = taskUiState.tasks.find(t => t.id === taskId);
      wasCompleted = !!(currTask.completed || currTask.completedAt);
      isNowCompleted = !wasCompleted;
    }
  }
  
  return { todayKey, wasCompleted, isNowCompleted };
}

/**
 * Persist user stats to demo storage
 */
function _persistUserStats(userId, stats) {
  if (!userId) return;
  const store = readDemoUserDataStore();
  const current = ensureDemoUserData(userId) || {};
  store[userId] = { ...current, stats };
  writeDemoUserDataStore(store);
  console.log(`[Progress Engine] Stats persisted to storage:`, stats);
}

/**
 * Get user stats from demo storage
 */
function _getUserStats(userId) {
  if (!userId) return null;
  const data = getActiveDemoUserData();
  return data?.stats || null;
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
    if (activeDemoUserId) {
      const tasks = getActiveUserTasksData().filter(t => t.id !== taskId);
      setActiveUserTasksData(tasks);
      delete taskEnhancements[String(taskId)];
      taskUiState.expanded.delete(taskId);
      saveTaskEnhancements();
      await loadTasks();
      return;
    }

    const response = await fetch(`/api/tasks/${taskId}`, {
      method: 'DELETE'
    });

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
  if (activeDemoUserId) {
    const tasks = getActiveUserTasksData().map(task => task.id === taskId ? { ...task, ...payload } : task);
    setActiveUserTasksData(tasks);
    return true;
  }

  const response = await fetch(`/api/tasks/${taskId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
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

  if (activeDemoUserId) {
    const tasks = getActiveUserTasksData().map((task) => (
      Number(task.id) === Number(taskId)
        ? { ...task, eisenhowerQuadrant: quadrant }
        : task
    ));
    setActiveUserTasksData(tasks);
  }
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
  dueCustomInput.value = dateTimeLocalValue(taskDueAt(task));
  repeatSelect.value = repeatCfg.mode === 'interval' ? 'interval' : repeatCfg.mode;
  repeatIntervalInput.value = String(Math.max(2, repeatCfg.intervalDays || 2));
  syncTaskEditModalDueInput();
  syncTaskEditModalRepeatInput();

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

  let dueAt;
  if (dueMode === 'custom') {
    if (!dueCustomInput.value) return;
    dueAt = new Date(dueCustomInput.value);
  } else {
    const hours = Number(dueMode);
    dueAt = new Date(Date.now() + (hours * 60 * 60 * 1000));
  }
  if (!dueAt || Number.isNaN(dueAt.getTime())) return;

  let repeatValue = repeatMode;
  if (repeatMode === 'interval') {
    const everyDays = Math.max(2, Number(repeatIntervalInput.value || 2));
    repeatValue = `interval:${everyDays}`;
  }
  const categoryValue = ['daily', 'weekly', 'monthly'].includes(repeatMode) ? repeatMode : 'general';
  const dueAtIso = dueAt.toISOString();
  const dueKey = toLocalDateKey(dueAt);

  if (saveBtn) saveBtn.disabled = true;
  const ok = await updateTask(taskId, {
    title,
    tags,
    priority,
    dueAt: dueAtIso,
    date: dueKey,
    category: categoryValue
  });
  if (saveBtn) saveBtn.disabled = false;

  if (!ok) {
    alert('Could not save task changes.');
    return;
  }

  updateTaskEnhancement(taskId, ext => {
    ext.dueAt = dueAtIso;
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
