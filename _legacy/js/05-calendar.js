// ========================================
// Calendar Experience
// ========================================

const calendarState = {
  visibleMonth: null,
  selectedDate: null,
  importantDates: new Set()
};

const CALENDAR_IMPORTANT_KEY_BASE = 'fittrack_calendar_important_v1';
function calendarImportantStorageKey() {
  return activeDemoUserId ? `${CALENDAR_IMPORTANT_KEY_BASE}_${activeDemoUserId}` : CALENDAR_IMPORTANT_KEY_BASE;
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
  if (task?.dueAt) return toLocalDateKey(new Date(task.dueAt));
  if (task?.date) return String(task.date);
  return toLocalDateKey(new Date());
}

function calendarMonthLabel(date) {
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
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
      dueAt: combineDateAndTime(selectedDate, taskDueAt(task)).toISOString(),
      __occurrenceDate: selectedDate
    }))
    .sort((a, b) => taskDueAt(a).getTime() - taskDueAt(b).getTime());

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

function renderCalendar() {
  if (!document.getElementById('calendar')) return;
  loadCalendarImportantDates();
  if (!calendarState.visibleMonth) {
    const now = new Date();
    calendarState.visibleMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  }
  if (!calendarState.selectedDate) {
    calendarState.selectedDate = toLocalDateKey(new Date());
  }
  renderCalendarGrid();
  renderCalendarTaskList();
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

  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      const v = calendarState.visibleMonth;
      calendarState.visibleMonth = new Date(v.getFullYear(), v.getMonth() - 1, 1);
      renderCalendar();
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      const v = calendarState.visibleMonth;
      calendarState.visibleMonth = new Date(v.getFullYear(), v.getMonth() + 1, 1);
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

  renderCalendar();
}
