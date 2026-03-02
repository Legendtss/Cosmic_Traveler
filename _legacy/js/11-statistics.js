
// ========================================
// Statistics Experience
// ========================================

const DEFAULT_STATISTICS_STATE = {
  weeklyData: [
    { day: 'Mon', workouts: 2, nutrition: 3, tasks: 5, time: 90, calories: 650 },
    { day: 'Tue', workouts: 1, nutrition: 2, tasks: 3, time: 45, calories: 380 },
    { day: 'Wed', workouts: 2, nutrition: 3, tasks: 6, time: 105, calories: 720 },
    { day: 'Thu', workouts: 1, nutrition: 2, tasks: 4, time: 60, calories: 420 },
    { day: 'Fri', workouts: 2, nutrition: 3, tasks: 5, time: 85, calories: 580 },
    { day: 'Sat', workouts: 1, nutrition: 3, tasks: 4, time: 90, calories: 650 },
    { day: 'Sun', workouts: 1, nutrition: 2, tasks: 2, time: 30, calories: 150 }
  ],
  workoutTypeData: [
    { name: 'Cardio', value: 35, color: '#3B82F6' },
    { name: 'Strength', value: 40, color: '#10B981' },
    { name: 'Flexibility', value: 15, color: '#8B5CF6' },
    { name: 'Sports', value: 10, color: '#F59E0B' }
  ],
  monthlyProgress: [
    { month: 'Jul', workouts: 18, calories: 8500 },
    { month: 'Aug', workouts: 22, calories: 9800 },
    { month: 'Sep', workouts: 20, calories: 9200 },
    { month: 'Oct', workouts: 25, calories: 10500 },
    { month: 'Nov', workouts: 23, calories: 9900 },
    { month: 'Dec', workouts: 15, calories: 6500 }
  ],
  nutritionData: [
    { day: 'Mon', calories: 2100, protein: 145, carbs: 240 },
    { day: 'Tue', calories: 2300, protein: 152, carbs: 260 },
    { day: 'Wed', calories: 1950, protein: 138, carbs: 220 },
    { day: 'Thu', calories: 2200, protein: 148, carbs: 245 },
    { day: 'Fri', calories: 2400, protein: 160, carbs: 270 },
    { day: 'Sat', calories: 2150, protein: 142, carbs: 235 },
    { day: 'Sun', calories: 2050, protein: 140, carbs: 230 }
  ],
  macroDistribution: [
    { name: 'Protein', value: 30, color: '#EF4444' },
    { name: 'Carbs', value: 45, color: '#3B82F6' },
    { name: 'Fats', value: 25, color: '#F59E0B' }
  ],
  taskTotals: {
    total: 0,
    completed: 0,
    open: 0,
    overdue: 0
  }
};

let statisticsState = deepClone(DEFAULT_STATISTICS_STATE);

function getEnabledStatisticsModules() {
  const profileModules = profileState && typeof profileState.enabledModules === 'object'
    ? profileState.enabledModules
    : null;
  if (profileModules) {
    return {
      workout: !!profileModules.workout,
      nutrition: !!profileModules.nutrition,
      tasks: !!profileModules.tasks
    };
  }

  const prefs = typeof getCurrentLayoutPreferencesForActiveUser === 'function'
    ? getCurrentLayoutPreferencesForActiveUser()
    : (activeDemoFeaturePrefs || {});
  return {
    workout: !!prefs.showWorkout,
    nutrition: !!prefs.showNutrition,
    tasks: !!prefs.showProjects
  };
}

function updateStatisticsForActiveUser() {
  const tasks = activeDemoUserId ? getActiveUserTasksData() : (Array.isArray(taskUiState.tasks) ? taskUiState.tasks : []);
  const meals = activeDemoUserId ? getActiveUserMealsData() : (Array.isArray(nutritionState.entries) ? nutritionState.entries : []);
  const workoutRows = activeDemoUserId
    ? getActiveUserWorkoutsData()
    : (Array.isArray(workoutState.workouts) ? workoutState.workouts : []);
  const workouts = workoutRows.map(w => ({ ...w, completed: !!workoutMeta(w.id).completed }));

  const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const now = new Date();
  const monday = new Date(now);
  const mondayOffset = (now.getDay() + 6) % 7;
  monday.setDate(now.getDate() - mondayOffset);
  monday.setHours(0, 0, 0, 0);

  const weeklyData = weekDays.map((day, idx) => {
    const dayDate = new Date(monday);
    dayDate.setDate(monday.getDate() + idx);
    const dayKey = toLocalDateKey(dayDate);

    const dayWorkouts = workouts.filter(w => String(w.date) === dayKey);
    const dayMeals = meals.filter(m => mealDateKey(m) === dayKey);
    const dayTasks = tasks.filter(t => String(t.date) === dayKey);

    return {
      day,
      workouts: dayWorkouts.length,
      nutrition: dayMeals.length,
      tasks: dayTasks.length,
      time: dayWorkouts.reduce((sum, w) => sum + (Number(w.duration) || 0), 0),
      calories: dayWorkouts.reduce((sum, w) => sum + (Number(w.calories_burned) || 0), 0)
    };
  });

  const typeColors = { cardio: '#3B82F6', strength: '#10B981', flexibility: '#8B5CF6', sports: '#F59E0B' };
  const typeNames = { cardio: 'Cardio', strength: 'Strength', flexibility: 'Flexibility', sports: 'Sports' };
  const typeCounts = { cardio: 0, strength: 0, flexibility: 0, sports: 0 };
  workouts.forEach(w => {
    const key = String(w.type || 'strength').toLowerCase();
    if (typeCounts[key] !== undefined) typeCounts[key] += 1;
    else typeCounts.strength += 1;
  });
  const totalTypes = Object.values(typeCounts).reduce((sum, v) => sum + v, 0) || 1;
  const workoutTypeData = Object.keys(typeCounts).map(key => ({
    name: typeNames[key],
    value: Math.round((typeCounts[key] / totalTypes) * 100),
    color: typeColors[key]
  }));

  const monthlyProgress = Array.from({ length: 6 }, (_, idx) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - idx), 1);
    const month = d.toLocaleDateString('en-US', { month: 'short' });
    const monthNum = d.getMonth();
    const yearNum = d.getFullYear();
    const monthWorkouts = workouts.filter(w => {
      const wd = new Date(`${w.date || ''}T00:00:00`);
      return wd.getMonth() === monthNum && wd.getFullYear() === yearNum;
    });
    return {
      month,
      workouts: monthWorkouts.length,
      calories: monthWorkouts.reduce((sum, w) => sum + (Number(w.calories_burned) || 0), 0)
    };
  });

  const nutritionData = weekDays.map((day, idx) => {
    const dayDate = new Date(monday);
    dayDate.setDate(monday.getDate() + idx);
    const dayKey = toLocalDateKey(dayDate);
    const dayMeals = meals.filter(m => mealDateKey(m) === dayKey);
    return {
      day,
      calories: Math.round(dayMeals.reduce((sum, m) => sum + parseMacro(m.calories), 0)),
      protein: Math.round(dayMeals.reduce((sum, m) => sum + parseMacro(m.protein), 0)),
      carbs: Math.round(dayMeals.reduce((sum, m) => sum + parseMacro(m.carbs), 0))
    };
  });

  const macroTotals = {
    protein: meals.reduce((sum, m) => sum + parseMacro(m.protein), 0),
    carbs: meals.reduce((sum, m) => sum + parseMacro(m.carbs), 0),
    fats: meals.reduce((sum, m) => sum + parseMacro(m.fats), 0)
  };
  const macroTotal = macroTotals.protein + macroTotals.carbs + macroTotals.fats;
  const macroDistribution = macroTotal > 0
    ? [
      { name: 'Protein', value: Math.round((macroTotals.protein / macroTotal) * 100), color: '#EF4444' },
      { name: 'Carbs', value: Math.round((macroTotals.carbs / macroTotal) * 100), color: '#3B82F6' },
      { name: 'Fats', value: Math.round((macroTotals.fats / macroTotal) * 100), color: '#F59E0B' }
    ]
    : deepClone(DEFAULT_STATISTICS_STATE.macroDistribution);

  const taskRenderable = materializeTasksForRender(tasks);
  const overdueTaskCount = taskRenderable.filter(t => t.__state === 'overdue').length;
  const completedTaskCount = tasks.filter(t => !!t.completed || !!t.completedAt).length;
  const totalTaskCount = tasks.length;
  const openTaskCount = Math.max(0, totalTaskCount - completedTaskCount);

  statisticsState = {
    weeklyData,
    workoutTypeData,
    monthlyProgress,
    nutritionData,
    macroDistribution,
    taskTotals: {
      total: totalTaskCount,
      completed: completedTaskCount,
      open: openTaskCount,
      overdue: overdueTaskCount
    }
  };
}
function statisticsSummaryCards(enabledModules) {
  const weeklyWorkouts = statisticsState.weeklyData.reduce((sum, row) => sum + row.workouts, 0);
  const totalMinutes = statisticsState.weeklyData.reduce((sum, row) => sum + row.time, 0);
  const totalCalories = statisticsState.weeklyData.reduce((sum, row) => sum + row.calories, 0);
  const weeklyCaloriesIntake = statisticsState.nutritionData.reduce((sum, row) => sum + (Number(row.calories) || 0), 0);
  const avgProtein = Math.round(
    statisticsState.nutritionData.reduce((sum, row) => sum + (Number(row.protein) || 0), 0)
    / Math.max(statisticsState.nutritionData.length, 1)
  );
  const avgDuration = Math.round(totalMinutes / Math.max(weeklyWorkouts, 1));
  const hours = (totalMinutes / 60).toFixed(1);
  const cards = [];

  if (enabledModules.workout) {
    cards.push({
      icon: 'fa-wave-square',
      color: 'blue',
      title: 'This Week',
      value: `${weeklyWorkouts} Workouts`,
      note: '+25% from last week',
      noteClass: ''
    });
    cards.push({
      icon: 'fa-clock',
      color: 'green',
      title: 'Total Time',
      value: `${hours} Hours`,
      note: '+15% from last week',
      noteClass: ''
    });
    cards.push({
      icon: 'fa-fire',
      color: 'orange',
      title: 'Calories',
      value: `${totalCalories.toLocaleString()} kcal`,
      note: '+18% from last week',
      noteClass: ''
    });
    cards.push({
      icon: 'fa-heart-pulse',
      color: 'purple',
      title: 'Avg. Duration',
      value: `${avgDuration} minutes`,
      note: 'per workout',
      noteClass: 'neutral'
    });
  }

  if (enabledModules.nutrition) {
    cards.push({
      icon: 'fa-utensils',
      color: 'orange',
      title: 'Weekly Intake',
      value: `${weeklyCaloriesIntake.toLocaleString()} kcal`,
      note: 'nutrition total',
      noteClass: 'neutral'
    });
    cards.push({
      icon: 'fa-drumstick-bite',
      color: 'green',
      title: 'Avg Protein',
      value: `${avgProtein} g/day`,
      note: 'weekly average',
      noteClass: 'neutral'
    });
  }

  if (enabledModules.tasks) {
    cards.push({
      icon: 'fa-list-check',
      color: 'blue',
      title: 'Open Tasks',
      value: `${statisticsState.taskTotals.open}`,
      note: `${statisticsState.taskTotals.overdue} overdue`,
      noteClass: statisticsState.taskTotals.overdue > 0 ? '' : 'neutral'
    });
    cards.push({
      icon: 'fa-check-double',
      color: 'purple',
      title: 'Completed',
      value: `${statisticsState.taskTotals.completed}`,
      note: `${statisticsState.taskTotals.total} total tasks`,
      noteClass: 'neutral'
    });
  }

  return cards;
}

function renderStatisticsSummary(enabledModules) {
  const grid = document.getElementById('statistics-summary-grid');
  if (!grid) return;
  const cards = statisticsSummaryCards(enabledModules);
  if (!cards.length) {
    grid.innerHTML = '';
    return;
  }
  grid.innerHTML = cards.map((card, index) => `
    <article class="statistics-summary-card" style="--stat-delay:${80 + (index * 70)}ms;">
      <div class="statistics-summary-top">
        <span class="statistics-icon-badge ${card.color}"><i class="fas ${card.icon}"></i></span>
        <p class="statistics-summary-title">${card.title}</p>
      </div>
      <h4 class="statistics-summary-value">${card.value}</h4>
      <span class="statistics-summary-note ${card.noteClass}">
        ${card.noteClass === 'neutral' ? '' : '<i class="fas fa-arrow-trend-up"></i>'}${card.note}
      </span>
    </article>
  `).join('');
}

function renderStatisticsBars(enabledModules) {
  const bars = document.getElementById('statistics-weekly-bars');
  const legend = document.getElementById('statistics-weekly-legend');
  if (!bars) return;
  const stackHeight = 220;
  const includeWorkout = !!enabledModules.workout;
  const includeNutrition = !!enabledModules.nutrition;
  const includeTasks = !!enabledModules.tasks;

  const maxTotalRaw = Math.max(...statisticsState.weeklyData.map((row) => {
    let total = 0;
    if (includeWorkout) total += row.workouts;
    if (includeNutrition) total += row.nutrition;
    if (includeTasks) total += row.tasks;
    return total;
  }), 1);
  const maxTotal = Math.max(1, Math.ceil(maxTotalRaw * 1.05));
  const yAxisMax = Math.max(1, Math.ceil(maxTotalRaw));
  const yTicks = Array.from({ length: 5 }, (_, i) => Math.round((yAxisMax * (4 - i)) / 4));
  if (legend) {
    const legendItems = [];
    if (includeWorkout) legendItems.push('<span style="--stat-delay:260ms;"><i class="dot blue"></i> Workouts</span>');
    if (includeNutrition) legendItems.push('<span style="--stat-delay:320ms;"><i class="dot green"></i> Nutrition</span>');
    if (includeTasks) legendItems.push('<span style="--stat-delay:380ms;"><i class="dot purple"></i> Tasks</span>');
    legend.innerHTML = legendItems.join('');
  }
  const barCols = statisticsState.weeklyData.map((row, index) => {
    const workouts = Number(row.workouts) || 0;
    const nutrition = Number(row.nutrition) || 0;
    const tasks = Number(row.tasks) || 0;
    const workoutPx = includeWorkout ? Math.max(0, Math.round((workouts / maxTotal) * stackHeight)) : 0;
    const nutritionPx = includeNutrition ? Math.max(0, Math.round((nutrition / maxTotal) * stackHeight)) : 0;
    const tasksPx = includeTasks ? Math.max(0, Math.round((tasks / maxTotal) * stackHeight)) : 0;
    return `
      <div class="statistics-bar-col">
        <div class="statistics-stack" title="Workouts: ${workouts}, Nutrition: ${nutrition}, Tasks: ${tasks}">
          ${includeTasks ? `<div class="statistics-seg purple" style="height:${tasksPx}px; animation-delay:${index * 0.06}s"></div>` : ''}
          ${includeNutrition ? `<div class="statistics-seg green" style="height:${nutritionPx}px; animation-delay:${index * 0.06 + 0.02}s"></div>` : ''}
          ${includeWorkout ? `<div class="statistics-seg blue" style="height:${workoutPx}px; animation-delay:${index * 0.06 + 0.04}s"></div>` : ''}
        </div>
        <span class="statistics-bar-label">${row.day}</span>
      </div>
    `;
  }).join('');

  bars.innerHTML = `
    <div class="statistics-y-axis">
      ${yTicks.map(v => `<span>${v}</span>`).join('')}
    </div>
    <div class="statistics-bars-grid">
      ${barCols}
    </div>
  `;
}

function renderStatisticsTaskOverview() {
  const wrap = document.getElementById('statistics-task-overview');
  if (!wrap) return;
  wrap.innerHTML = `
    <div class="statistics-task-metric">
      <span>Open Tasks</span>
      <strong>${statisticsState.taskTotals.open}</strong>
    </div>
    <div class="statistics-task-metric">
      <span>Completed</span>
      <strong>${statisticsState.taskTotals.completed}</strong>
    </div>
    <div class="statistics-task-metric">
      <span>Overdue</span>
      <strong>${statisticsState.taskTotals.overdue}</strong>
    </div>
    <div class="statistics-task-metric">
      <span>Total Tasks</span>
      <strong>${statisticsState.taskTotals.total}</strong>
    </div>
  `;
}

function renderStatisticsDynamicLayout(enabledModules) {
  const container = document.getElementById('statistics-dynamic-content');
  if (!container) return;

  const noneEnabled = !enabledModules.workout && !enabledModules.nutrition && !enabledModules.tasks;
  if (noneEnabled) {
    container.innerHTML = `
      <section class="statistics-panel statistics-empty-state">
        Enable modules in Profile to see statistics.
      </section>
    `;
    return;
  }

  const rows = [];
  if (enabledModules.workout) {
    rows.push(`
      <div class="statistics-two-grid">
        <section class="statistics-panel">
          <h3>Weekly Activity</h3>
          <div id="statistics-weekly-legend" class="statistics-legend-inline"></div>
          <div id="statistics-weekly-bars" class="statistics-bars"></div>
        </section>
        <section class="statistics-panel">
          <h3>Workout Distribution</h3>
          <div class="statistics-pie-wrap">
            <div id="statistics-workout-pie" class="statistics-pie"></div>
            <div id="statistics-workout-legend" class="statistics-legend"></div>
          </div>
        </section>
      </div>
      <section class="statistics-panel">
        <h3>6-Month Progress</h3>
        <div class="statistics-chart-wrap">
          <svg id="statistics-monthly-svg" class="statistics-line-svg tall" viewBox="0 0 680 320" preserveAspectRatio="none"></svg>
          <div id="statistics-monthly-labels" class="statistics-x-labels"></div>
        </div>
      </section>
    `);
  }

  if (enabledModules.nutrition) {
    rows.push(`
      <div class="statistics-two-grid">
        <section class="statistics-panel">
          <h3>Weekly Nutrition Intake</h3>
          <div class="statistics-chart-wrap">
            <svg id="statistics-nutrition-svg" class="statistics-line-svg" viewBox="0 0 680 280" preserveAspectRatio="none"></svg>
            <div id="statistics-nutrition-labels" class="statistics-x-labels"></div>
          </div>
        </section>
        <section class="statistics-panel">
          <h3>Macro Distribution</h3>
          <div class="statistics-pie-wrap">
            <div id="statistics-macro-pie" class="statistics-pie"></div>
            <div id="statistics-macro-legend" class="statistics-legend"></div>
          </div>
        </section>
      </div>
    `);
  }

  if (enabledModules.tasks) {
    rows.push(`
      <section class="statistics-panel">
        <h3>Task Overview</h3>
        <div id="statistics-task-overview" class="statistics-task-overview-grid"></div>
      </section>
    `);
  }

  container.innerHTML = rows.join('');
}

function renderStatisticsPie(pieEl, legendEl, data) {
  if (!pieEl || !legendEl) return;
  const total = Math.max(1, data.reduce((sum, item) => sum + (Number(item.value) || 0), 0));
  const size = 210;
  const radius = 78;
  const stroke = 24;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * radius;

  let offset = 0;
  const segmentsMarkup = data.map((item, index) => {
    const value = Number(item.value) || 0;
    const arcLength = (value / total) * circumference;
    const segment = `
      <circle
        class="statistics-pie-segment"
        data-name="${item.name}"
        data-value="${item.value}"
        data-color="${item.color}"
        data-index="${index}"
        cx="${cx}"
        cy="${cy}"
        r="${radius}"
        stroke="${item.color}"
        stroke-dasharray="0 ${circumference}"
        stroke-dashoffset="${-offset.toFixed(2)}"
      ></circle>
    `;
    offset += arcLength;
    return { segment, arcLength };
  });

  pieEl.innerHTML = `
    <svg class="statistics-pie-svg" viewBox="0 0 ${size} ${size}" aria-hidden="true">
      <circle class="statistics-pie-track" cx="${cx}" cy="${cy}" r="${radius}" stroke-width="${stroke}"></circle>
      ${segmentsMarkup.map(item => item.segment).join('')}
    </svg>
    <div class="statistics-pie-center">
      <strong class="statistics-pie-percentage"></strong>
      <span class="statistics-pie-label"></span>
    </div>
  `;

  legendEl.innerHTML = data.map((item, index) => `
    <div class="statistics-legend-item" style="--stat-delay:${280 + (index * 70)}ms;">
      <div class="statistics-legend-left">
        <span class="statistics-dot" style="background:${item.color};"></span>
        <span>${item.name}</span>
      </div>
      <strong class="statistics-legend-value">${item.value}%</strong>
    </div>
  `).join('');

  const prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const arcs = Array.from(pieEl.querySelectorAll('.statistics-pie-segment'));
  const center = pieEl.querySelector('.statistics-pie-center');
  const centerStrong = center?.querySelector('.statistics-pie-percentage');
  const centerSpan = center?.querySelector('.statistics-pie-label');

  const clearCenter = () => {
    if (!center) return;
    center.classList.remove('has-hover-content');
    if (centerStrong) {
      centerStrong.textContent = '';
      centerStrong.style.color = '';
    }
    if (centerSpan) {
      centerSpan.textContent = '';
      centerSpan.style.color = '';
    }
  };

  const showCenter = (arc) => {
    if (!centerStrong || !centerSpan || !center) return;
    const name = arc.getAttribute('data-name') || '';
    const value = arc.getAttribute('data-value') || '0';
    const color = arc.getAttribute('data-color') || '';
    centerStrong.textContent = `${value}%`;
    centerStrong.style.color = color;
    centerSpan.textContent = name;
    centerSpan.style.color = color;
    center.classList.add('has-hover-content');
  };

  clearCenter();

  // Show contextual center content for the active slice only.
  arcs.forEach((arc) => {
    arc.addEventListener('mouseenter', () => {
      showCenter(arc);
    });
  });

  pieEl.addEventListener('mouseleave', clearCenter);

  if (prefersReducedMotion) {
    arcs.forEach((arc, index) => {
      const arcLength = segmentsMarkup[index]?.arcLength || 0;
      arc.style.strokeDasharray = `${arcLength} ${circumference}`;
    });
    return;
  }

  requestAnimationFrame(() => {
    arcs.forEach((arc, index) => {
      const arcLength = segmentsMarkup[index]?.arcLength || 0;
      arc.style.strokeDasharray = `${arcLength} ${circumference}`;
    });
  });
}

function createPolylinePoints(values, width, height, padding, min, max) {
  const usableW = width - (padding * 2);
  const usableH = height - (padding * 2);
  const step = usableW / Math.max(values.length - 1, 1);
  return values.map((value, idx) => {
    const x = padding + (idx * step);
    const y = padding + ((max - value) / Math.max(max - min, 1)) * usableH;
    return { x, y };
  });
}

function pathFromPoints(points) {
  if (!points.length) return '';
  return points.map((point, idx) => `${idx === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(' ');
}

function areaPathFromPoints(points, width, height, padding) {
  if (!points.length) return '';
  const line = pathFromPoints(points);
  const last = points[points.length - 1];
  const first = points[0];
  const baseY = height - padding;
  return `${line} L ${last.x.toFixed(2)} ${baseY.toFixed(2)} L ${first.x.toFixed(2)} ${baseY.toFixed(2)} Z`;
}

function renderNutritionAreaChart() {
  const svg = document.getElementById('statistics-nutrition-svg');
  const labels = document.getElementById('statistics-nutrition-labels');
  if (!svg || !labels) return;
  const width = 680;
  const height = 280;
  const padding = 28;
  const values = statisticsState.nutritionData.map(row => row.calories);
  const min = Math.min(...values) - 120;
  const max = Math.max(...values) + 120;
  const points = createPolylinePoints(values, width, height, padding, min, max);

  const linePath = pathFromPoints(points);
  svg.innerHTML = `
    <g class="statistics-svg-grid">
      <line x1="${padding}" y1="${padding}" x2="${width - padding}" y2="${padding}"></line>
      <line x1="${padding}" y1="${padding + ((height - padding * 2) * 0.33)}" x2="${width - padding}" y2="${padding + ((height - padding * 2) * 0.33)}"></line>
      <line x1="${padding}" y1="${padding + ((height - padding * 2) * 0.66)}" x2="${width - padding}" y2="${padding + ((height - padding * 2) * 0.66)}"></line>
      <line x1="${padding}" y1="${height - padding}" x2="${width - padding}" y2="${height - padding}"></line>
    </g>
    <path class="statistics-svg-area is-revealing" d="${areaPathFromPoints(points, width, height, padding)}" fill="#FDE68A"></path>
    <path class="statistics-svg-path is-drawing" d="${linePath}" stroke="#F59E0B"></path>
  `;

  labels.innerHTML = statisticsState.nutritionData.map((row, index) => `<span style="--stat-delay:${360 + (index * 40)}ms;">${row.day}</span>`).join('');

  const prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const line = svg.querySelector('.statistics-svg-path.is-drawing');
  const area = svg.querySelector('.statistics-svg-area.is-revealing');
  if (!line || !area || prefersReducedMotion) {
    if (area) area.classList.add('is-revealed');
    return;
  }

  const length = line.getTotalLength();
  line.style.strokeDasharray = `${length}`;
  line.style.strokeDashoffset = `${length}`;
  requestAnimationFrame(() => {
    line.style.strokeDashoffset = '0';
    window.setTimeout(() => area.classList.add('is-revealed'), 320);
  });
}

function renderMonthlyLineChart() {
  const svg = document.getElementById('statistics-monthly-svg');
  const labels = document.getElementById('statistics-monthly-labels');
  if (!svg || !labels) return;
  const width = 680;
  const height = 320;
  const padding = 28;
  const workouts = statisticsState.monthlyProgress.map(row => row.workouts);
  const calories = statisticsState.monthlyProgress.map(row => row.calories);
  const wPoints = createPolylinePoints(workouts, width, height, padding, Math.min(...workouts) - 2, Math.max(...workouts) + 2);
  const cPoints = createPolylinePoints(calories, width, height, padding, Math.min(...calories) - 600, Math.max(...calories) + 600);

  const wDots = wPoints.map(point => `<circle class="statistics-svg-dot" cx="${point.x.toFixed(2)}" cy="${point.y.toFixed(2)}" fill="#3B82F6"></circle>`).join('');
  const cDots = cPoints.map(point => `<circle class="statistics-svg-dot" cx="${point.x.toFixed(2)}" cy="${point.y.toFixed(2)}" fill="#F59E0B"></circle>`).join('');

  svg.innerHTML = `
    <g class="statistics-svg-grid">
      <line x1="${padding}" y1="${padding}" x2="${width - padding}" y2="${padding}"></line>
      <line x1="${padding}" y1="${padding + ((height - padding * 2) * 0.33)}" x2="${width - padding}" y2="${padding + ((height - padding * 2) * 0.33)}"></line>
      <line x1="${padding}" y1="${padding + ((height - padding * 2) * 0.66)}" x2="${width - padding}" y2="${padding + ((height - padding * 2) * 0.66)}"></line>
      <line x1="${padding}" y1="${height - padding}" x2="${width - padding}" y2="${height - padding}"></line>
    </g>
    <path class="statistics-svg-path" d="${pathFromPoints(wPoints)}" stroke="#3B82F6"></path>
    <path class="statistics-svg-path" d="${pathFromPoints(cPoints)}" stroke="#F59E0B"></path>
    ${wDots}
    ${cDots}
  `;

  labels.classList.add('months');
  labels.innerHTML = statisticsState.monthlyProgress.map(row => `<span>${row.month}</span>`).join('');
}

function renderStatistics() {
  const enabledModules = getEnabledStatisticsModules();
  renderStatisticsSummary(enabledModules);
  renderStatisticsDynamicLayout(enabledModules);

  if (enabledModules.workout) {
    renderStatisticsBars(enabledModules);
    renderStatisticsPie(
      document.getElementById('statistics-workout-pie'),
      document.getElementById('statistics-workout-legend'),
      statisticsState.workoutTypeData
    );
    renderMonthlyLineChart();
  }

  if (enabledModules.nutrition) {
    renderStatisticsPie(
      document.getElementById('statistics-macro-pie'),
      document.getElementById('statistics-macro-legend'),
      statisticsState.macroDistribution
    );
    renderNutritionAreaChart();
  }

  if (enabledModules.tasks) {
    renderStatisticsTaskOverview();
  }

  animateStatisticsEntry();
}

function animateStatisticsEntry() {
  const shell = document.querySelector('#statistics .statistics-shell');
  if (!shell) return;
  const panels = shell.querySelectorAll('.statistics-panel');
  panels.forEach((panel, index) => {
    panel.style.setProperty('--stat-delay', `${200 + (index * 70)}ms`);
  });
  shell.classList.remove('is-animated');
  void shell.offsetWidth;
  shell.classList.add('is-animated');
}

function setupStatistics() {
  if (!document.getElementById('statistics')) return;
  updateStatisticsForActiveUser();
  renderStatistics();
}
