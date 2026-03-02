// ========================================
// Modal Setup
// ========================================

function setupTaskModal() {
  const modal = document.getElementById('add-task-modal');
  const openBtn = document.getElementById('add-task-btn');
  const closeBtn = document.getElementById('close-task-modal');
  const cancelBtn = document.getElementById('cancel-task-btn');
  const form = document.getElementById('add-task-form');
  const dueSelect = document.getElementById('task-due-select');
  const customDateInput = document.getElementById('custom-datetime-input');
  
  if (!modal || !form) return;
  
  // Open modal
  if (openBtn) {
    openBtn.addEventListener('click', () => {
      modal.style.display = 'flex';
    });
  }
  
  // Close buttons
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      modal.style.display = 'none';
    });
  }
  
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      modal.style.display = 'none';
    });
  }
  
  // Close on background click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.style.display = 'none';
    }
  });
  
  // Handle due date dropdown change
  if (dueSelect) {
    dueSelect.addEventListener('change', () => {
      if (dueSelect.value === 'custom') {
        if (customDateInput) customDateInput.style.display = 'block';
      } else {
        if (customDateInput) customDateInput.style.display = 'none';
      }
    });
  }
  
  // Form submission
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const titleInput = document.getElementById('task-title-input');
    const tagsInput = document.getElementById('task-tags-input');
    const priorityInput = document.getElementById('task-priority-select');
    const dueInput = document.getElementById('task-due-select');
    const repeatInput = document.getElementById('task-repeat-select');
    
    if (titleInput && titleInput.value.trim()) {
      let dueHours = 24;
      
      if (dueInput && dueInput.value !== 'custom') {
        dueHours = parseInt(dueInput.value);
      } else if (customDateInput && customDateInput.value) {
        const customDate = new Date(customDateInput.value);
        const now = new Date();
        dueHours = Math.round((customDate - now) / (1000 * 60 * 60));
      }
      
      addTask(
        titleInput.value.trim(),
        priorityInput ? priorityInput.value : 'medium',
        dueHours,
        repeatInput ? repeatInput.value : 'none',
        customDateInput ? customDateInput.value : null,
        parseTaskTagsInput(tagsInput?.value || '')
      );
      
      form.reset();
      if (dueSelect) dueSelect.value = '24';
      if (customDateInput) customDateInput.style.display = 'none';
      if (tagsInput) tagsInput.value = '';
    }
  });
}

// ========================================
// Initialization
// ========================================

function runInitStep(name, fn) {
  try {
    return fn();
  } catch (err) {
    console.error(`Init step failed: ${name}`, err);
    return null;
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  console.log('FitTrack Pro initializing...');

  runInitStep('loadProfileState', () => loadProfileState());
  runInitStep('loadThemePreference', () => loadThemePreference());

  // Initialize independent modules defensively so one failure does not break the whole app.
  const setupSteps = [
    ['setupDashboard', setupDashboard],
    ['setupStreaks', setupStreaks],
    ['setupTaskModal', setupTaskModal],
    ['setupTaskInteractions', setupTaskInteractions],
    ['setupCalendar', setupCalendar],
    ['setupProjects', setupProjects],
    ['setupNutrition', setupNutrition],
    ['setupWorkout', setupWorkout],
    ['setupStatistics', setupStatistics],
    ['setupProfileMenu', setupProfileMenu],
    ['setupProfile', setupProfile],
    ['setupLayoutCustomizer', setupLayoutCustomizer],
    ['initFocusModule', initFocusModule]
  ];

  setupSteps.forEach(([name, step]) => {
    runInitStep(name, () => step());
  });

  const hasDemoSession = !!runInitStep('bootstrapDemoSession', () => bootstrapDemoSession());

  if (hasDemoSession) {
    runInitStep('showDashboardPage', () => showPage('dashboard'));
    await runInitStep('loadActiveUserDataViews', () => loadActiveUserDataViews());
  }

  window.addEventListener('focus', () => {
    if (activeDemoUserId && !findDemoUserById(activeDemoUserId)) {
      console.warn('Invalid demo user detected - clearing session');
      localStorage.removeItem(DEMO_USER_STORAGE_KEY);
      activeDemoUserId = null;
      location.reload();
    }
  });

  window.addEventListener('beforeunload', () => {
    dashboardState.timerRunning = false;
    if (dashboardState.timerInterval) {
      clearInterval(dashboardState.timerInterval);
      dashboardState.timerInterval = null;
    }
    taskUiState.expanded.clear();
  });

  console.log('Initialization complete');
});
