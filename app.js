// API Base URL
const API_URL = '/api';

// Global state
let currentTab = 'dashboard';
let currentTaskFilter = 'all';
let tasks = [];
let meals = [];
let workouts = [];
let charts = {};

// ==================== INITIALIZATION ====================

document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

function initializeApp() {
    updateCurrentDate();
    setupEventListeners();
    loadAllData();
    initializeCharts();
}

function updateCurrentDate() {
    const today = new Date();
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    document.getElementById('currentDate').textContent = today.toLocaleDateString('en-US', options);
}

// ==================== EVENT LISTENERS ====================

function setupEventListeners() {
    // Tab navigation
    document.querySelectorAll('.nav-item').forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });
    
    // Task filter buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => filterTasks(btn.dataset.filter));
    });
    
    // Form submissions
    document.getElementById('taskForm').addEventListener('submit', handleTaskSubmit);
    document.getElementById('mealForm').addEventListener('submit', handleMealSubmit);
    document.getElementById('workoutForm').addEventListener('submit', handleWorkoutSubmit);
}

function switchTab(tabName) {
    // Update nav items
    document.querySelectorAll('.nav-item').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabName);
    });
    
    // Update tab content
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    document.getElementById(`${tabName}-tab`).classList.add('active');
    
    currentTab = tabName;
    
    // Refresh data for the current tab
    if (tabName === 'dashboard') {
        updateDashboard();
    }
}

// ==================== DATA LOADING ====================

async function loadAllData() {
    await Promise.all([
        loadTasks(),
        loadMeals(),
        loadWorkouts()
    ]);
    updateDashboard();
}

async function loadTasks() {
    try {
        const today = new Date().toISOString().split('T')[0];
        const response = await fetch(`${API_URL}/tasks?date=${today}`);
        tasks = await response.json();
        renderTasks();
    } catch (error) {
        console.error('Error loading tasks:', error);
    }
}

async function loadMeals() {
    try {
        const today = new Date().toISOString().split('T')[0];
        const response = await fetch(`${API_URL}/meals?date=${today}`);
        meals = await response.json();
        renderMeals();
        updateNutritionSummary();
    } catch (error) {
        console.error('Error loading meals:', error);
    }
}

async function loadWorkouts() {
    try {
        const today = new Date().toISOString().split('T')[0];
        const response = await fetch(`${API_URL}/workouts?date=${today}`);
        workouts = await response.json();
        renderWorkouts();
        updateWorkoutSummary();
    } catch (error) {
        console.error('Error loading workouts:', error);
    }
}

// ==================== TASKS ====================

function renderTasks() {
    const container = document.getElementById('tasks-list');
    let filteredTasks = tasks;
    
    if (currentTaskFilter === 'completed') {
        filteredTasks = tasks.filter(t => t.completed);
    } else if (currentTaskFilter === 'pending') {
        filteredTasks = tasks.filter(t => !t.completed);
    }
    
    if (filteredTasks.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📝</div>
                <p>No tasks found. Add your first task to get started!</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = filteredTasks.map(task => `
        <div class="item-card ${task.completed ? 'completed' : ''}">
            <div class="item-header">
                <input type="checkbox" ${task.completed ? 'checked' : ''} 
                       onchange="toggleTask(${task.id})">
                <div class="item-title">${escapeHtml(task.title)}</div>
                <div class="item-actions">
                    <button class="btn btn-danger" onclick="deleteTask(${task.id})">Delete</button>
                </div>
            </div>
            ${task.description ? `<p style="color: var(--text-secondary); margin: 0.5rem 0;">${escapeHtml(task.description)}</p>` : ''}
            <div class="item-meta">
                <span class="item-badge badge-priority-${task.priority}">${task.priority}</span>
                <span class="item-badge badge-category">${task.category}</span>
                <span>⏱️ ${task.time_spent || 0} min</span>
            </div>
        </div>
    `).join('');
}

function filterTasks(filter) {
    currentTaskFilter = filter;
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.filter === filter);
    });
    renderTasks();
}

async function handleTaskSubmit(e) {
    e.preventDefault();
    
    const taskData = {
        title: document.getElementById('task-title').value,
        description: document.getElementById('task-description').value,
        category: document.getElementById('task-category').value,
        priority: document.getElementById('task-priority').value
    };
    
    try {
        const response = await fetch(`${API_URL}/tasks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(taskData)
        });
        
        if (response.ok) {
            closeModal('taskModal');
            document.getElementById('taskForm').reset();
            await loadTasks();
            updateDashboard();
        }
    } catch (error) {
        console.error('Error creating task:', error);
    }
}

async function toggleTask(id) {
    try {
        const response = await fetch(`${API_URL}/tasks/${id}/toggle`, {
            method: 'PATCH'
        });
        
        if (response.ok) {
            await loadTasks();
            updateDashboard();
        }
    } catch (error) {
        console.error('Error toggling task:', error);
    }
}

async function deleteTask(id) {
    if (!confirm('Are you sure you want to delete this task?')) return;
    
    try {
        const response = await fetch(`${API_URL}/tasks/${id}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            await loadTasks();
            updateDashboard();
        }
    } catch (error) {
        console.error('Error deleting task:', error);
    }
}

// ==================== NUTRITION ====================

function renderMeals() {
    const container = document.getElementById('meals-list');
    
    if (meals.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">🍽️</div>
                <p>No meals logged today. Start tracking your nutrition!</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = meals.map(meal => `
        <div class="item-card">
            <div class="item-header">
                <div class="item-title">${escapeHtml(meal.name)}</div>
                <div class="item-actions">
                    <button class="btn btn-danger" onclick="deleteMeal(${meal.id})">Delete</button>
                </div>
            </div>
            <div class="item-meta">
                <span class="item-badge badge-category">${meal.meal_type}</span>
                <span>🔥 ${meal.calories} cal</span>
                <span>🥩 ${meal.protein}g protein</span>
                <span>🍞 ${meal.carbs}g carbs</span>
                <span>🧈 ${meal.fats}g fats</span>
            </div>
            ${meal.notes ? `<p style="color: var(--text-secondary); margin-top: 0.5rem;">${escapeHtml(meal.notes)}</p>` : ''}
        </div>
    `).join('');
}

function updateNutritionSummary() {
    const totalCalories = meals.reduce((sum, m) => sum + (m.calories || 0), 0);
    const totalProtein = meals.reduce((sum, m) => sum + (m.protein || 0), 0);
    const totalCarbs = meals.reduce((sum, m) => sum + (m.carbs || 0), 0);
    const totalFats = meals.reduce((sum, m) => sum + (m.fats || 0), 0);
    
    document.getElementById('total-calories').textContent = totalCalories;
    document.getElementById('total-protein').textContent = totalProtein + 'g';
    document.getElementById('total-carbs').textContent = totalCarbs + 'g';
    document.getElementById('total-fats').textContent = totalFats + 'g';
}

async function handleMealSubmit(e) {
    e.preventDefault();
    
    const mealData = {
        name: document.getElementById('meal-name').value,
        meal_type: document.getElementById('meal-type').value,
        calories: parseInt(document.getElementById('meal-calories').value) || 0,
        protein: parseInt(document.getElementById('meal-protein').value) || 0,
        carbs: parseInt(document.getElementById('meal-carbs').value) || 0,
        fats: parseInt(document.getElementById('meal-fats').value) || 0,
        notes: document.getElementById('meal-notes').value
    };
    
    try {
        const response = await fetch(`${API_URL}/meals`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(mealData)
        });
        
        if (response.ok) {
            closeModal('mealModal');
            document.getElementById('mealForm').reset();
            await loadMeals();
            updateDashboard();
        }
    } catch (error) {
        console.error('Error creating meal:', error);
    }
}

async function deleteMeal(id) {
    if (!confirm('Are you sure you want to delete this meal?')) return;
    
    try {
        const response = await fetch(`${API_URL}/meals/${id}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            await loadMeals();
            updateDashboard();
        }
    } catch (error) {
        console.error('Error deleting meal:', error);
    }
}

// ==================== WORKOUTS ====================

function renderWorkouts() {
    const container = document.getElementById('workouts-list');
    
    if (workouts.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">💪</div>
                <p>No workouts logged today. Time to get moving!</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = workouts.map(workout => `
        <div class="item-card">
            <div class="item-header">
                <div class="item-title">${escapeHtml(workout.name)}</div>
                <div class="item-actions">
                    <button class="btn btn-danger" onclick="deleteWorkout(${workout.id})">Delete</button>
                </div>
            </div>
            <div class="item-meta">
                <span class="item-badge badge-category">${workout.type}</span>
                <span class="item-badge badge-priority-${workout.intensity}">${workout.intensity} intensity</span>
                <span>⏱️ ${workout.duration} min</span>
                <span>🔥 ${workout.calories_burned} cal</span>
            </div>
            ${workout.notes ? `<p style="color: var(--text-secondary); margin-top: 0.5rem;">${escapeHtml(workout.notes)}</p>` : ''}
        </div>
    `).join('');
}

function updateWorkoutSummary() {
    const totalDuration = workouts.reduce((sum, w) => sum + (w.duration || 0), 0);
    const totalCalories = workouts.reduce((sum, w) => sum + (w.calories_burned || 0), 0);
    
    document.getElementById('total-workout-time').textContent = totalDuration + ' min';
    document.getElementById('total-calories-burned').textContent = totalCalories;
    document.getElementById('total-workouts').textContent = workouts.length;
}

async function handleWorkoutSubmit(e) {
    e.preventDefault();
    
    const workoutData = {
        name: document.getElementById('workout-name').value,
        type: document.getElementById('workout-type').value,
        intensity: document.getElementById('workout-intensity').value,
        duration: parseInt(document.getElementById('workout-duration').value) || 0,
        calories_burned: parseInt(document.getElementById('workout-calories').value) || 0,
        notes: document.getElementById('workout-notes').value
    };
    
    try {
        const response = await fetch(`${API_URL}/workouts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(workoutData)
        });
        
        if (response.ok) {
            closeModal('workoutModal');
            document.getElementById('workoutForm').reset();
            await loadWorkouts();
            updateDashboard();
        }
    } catch (error) {
        console.error('Error creating workout:', error);
    }
}

async function deleteWorkout(id) {
    if (!confirm('Are you sure you want to delete this workout?')) return;
    
    try {
        const response = await fetch(`${API_URL}/workouts/${id}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            await loadWorkouts();
            updateDashboard();
        }
    } catch (error) {
        console.error('Error deleting workout:', error);
    }
}

// ==================== DASHBOARD ====================

async function updateDashboard() {
    try {
        const response = await fetch(`${API_URL}/analytics/summary`);
        const summary = await response.json();
        
        // Update stats
        document.getElementById('dash-tasks-completed').textContent = summary.tasks.completed;
        document.getElementById('dash-calories-consumed').textContent = summary.nutrition.total_calories;
        document.getElementById('dash-workout-time').textContent = summary.workouts.total_duration;
        document.getElementById('dash-calories-burned').textContent = summary.workouts.total_calories_burned;
        
        // Update quick lists
        updateDashboardLists();
        
        // Update charts
        await updateCharts();
    } catch (error) {
        console.error('Error updating dashboard:', error);
    }
}

function updateDashboardLists() {
    // Tasks
    const taskList = document.getElementById('dash-task-list');
    const recentTasks = tasks.slice(0, 3);
    taskList.innerHTML = recentTasks.length > 0 
        ? recentTasks.map(t => `
            <div class="quick-item">
                ${t.completed ? '✅' : '⏳'} ${escapeHtml(t.title)}
            </div>
          `).join('')
        : '<div class="quick-item">No tasks for today</div>';
    
    // Meals
    const mealList = document.getElementById('dash-meal-list');
    const recentMeals = meals.slice(0, 3);
    mealList.innerHTML = recentMeals.length > 0
        ? recentMeals.map(m => `
            <div class="quick-item">
                🍽️ ${escapeHtml(m.name)} - ${m.calories} cal
            </div>
          `).join('')
        : '<div class="quick-item">No meals logged</div>';
    
    // Workouts
    const workoutList = document.getElementById('dash-workout-list');
    const recentWorkouts = workouts.slice(0, 3);
    workoutList.innerHTML = recentWorkouts.length > 0
        ? recentWorkouts.map(w => `
            <div class="quick-item">
                💪 ${escapeHtml(w.name)} - ${w.duration} min
            </div>
          `).join('')
        : '<div class="quick-item">No workouts logged</div>';
}

// ==================== CHARTS ====================

function initializeCharts() {
    const weeklyCtx = document.getElementById('weeklyChart');
    const nutritionCtx = document.getElementById('nutritionChart');
    
    charts.weekly = new Chart(weeklyCtx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                {
                    label: 'Tasks Completed',
                    data: [],
                    borderColor: '#4F46E5',
                    backgroundColor: 'rgba(79, 70, 229, 0.1)',
                    tension: 0.4
                },
                {
                    label: 'Workout Minutes',
                    data: [],
                    borderColor: '#10B981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    tension: 0.4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            },
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
    
    charts.nutrition = new Chart(nutritionCtx, {
        type: 'doughnut',
        data: {
            labels: ['Protein', 'Carbs', 'Fats'],
            datasets: [{
                data: [0, 0, 0],
                backgroundColor: [
                    '#EF4444',
                    '#F59E0B',
                    '#8B5CF6'
                ]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            }
        }
    });
}

async function updateCharts() {
    try {
        const response = await fetch(`${API_URL}/analytics/weekly`);
        const weeklyData = await response.json();
        
        // Update weekly chart
        const labels = weeklyData.map(d => new Date(d.date).toLocaleDateString('en-US', { weekday: 'short' }));
        charts.weekly.data.labels = labels;
        charts.weekly.data.datasets[0].data = weeklyData.map(d => d.tasks_completed);
        charts.weekly.data.datasets[1].data = weeklyData.map(d => d.workout_minutes);
        charts.weekly.update();
        
        // Update nutrition chart
        const totalProtein = meals.reduce((sum, m) => sum + (m.protein || 0), 0);
        const totalCarbs = meals.reduce((sum, m) => sum + (m.carbs || 0), 0);
        const totalFats = meals.reduce((sum, m) => sum + (m.fats || 0), 0);
        
        charts.nutrition.data.datasets[0].data = [totalProtein, totalCarbs, totalFats];
        charts.nutrition.update();
    } catch (error) {
        console.error('Error updating charts:', error);
    }
}

// ==================== MODALS ====================

function showAddTaskModal() {
    document.getElementById('taskModal').classList.add('active');
}

function showAddMealModal() {
    document.getElementById('mealModal').classList.add('active');
}

function showAddWorkoutModal() {
    document.getElementById('workoutModal').classList.add('active');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

// Close modal when clicking outside
window.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) {
        e.target.classList.remove('active');
    }
});

// ==================== UTILITIES ====================

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
