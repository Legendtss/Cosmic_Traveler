// Projects Experience
// ========================================

const PROJECTS_STORAGE_KEY_BASE = 'fittrack_projects_v2';
const PROJECT_THEMES = ['blue', 'green', 'purple', 'orange', 'rose', 'indigo'];
function projectsStorageKey() {
  return activeDemoUserId ? `${PROJECTS_STORAGE_KEY_BASE}_${activeDemoUserId}` : PROJECTS_STORAGE_KEY_BASE;
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
      const seeded = activeDemoUserId
        ? deepClone((DEMO_USER_DUMMY_DATA[activeDemoUserId] && DEMO_USER_DUMMY_DATA[activeDemoUserId].projects) || [])
        : [];
      projectsState.projects = seeded.length ? normalizeProjects(seeded) : defaultProjects();
      return;
    }
    projectsState.projects = normalizeProjects(JSON.parse(raw));
  } catch (_err) {
    const seeded = activeDemoUserId
      ? deepClone((DEMO_USER_DUMMY_DATA[activeDemoUserId] && DEMO_USER_DUMMY_DATA[activeDemoUserId].projects) || [])
      : [];
    projectsState.projects = seeded.length ? normalizeProjects(seeded) : defaultProjects();
  }
}

function persistProjectsState() {
  localStorage.setItem(projectsStorageKey(), JSON.stringify(projectsState.projects));
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
