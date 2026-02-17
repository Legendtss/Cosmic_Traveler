// ========================================
// FitTrack Pro - Main Script
// ========================================

// Page Navigation
const NAV_ICON_ANIMATION_CLASSES = [
  'icon-anim-task',
  'icon-anim-project',
  'icon-anim-workout'
];

function navIconAnimationClass(pageName) {
  if (pageName === 'tasks') return 'icon-anim-task';
  if (pageName === 'projects') return 'icon-anim-project';
  if (pageName === 'workout') return 'icon-anim-workout';
  return '';
}

function triggerNavIconAnimation(icon, pageName) {
  if (!icon) return;

  NAV_ICON_ANIMATION_CLASSES.forEach(cls => icon.classList.remove(cls));
  const animClass = navIconAnimationClass(pageName);
  if (!animClass) return;

  // Force reflow so animation can replay on each click.
  void icon.offsetWidth;
  icon.classList.add(animClass);

  const timeoutMs = Number(icon.getAttribute('data-nav-anim-timeout') || 0);
  if (timeoutMs > 0) {
    setTimeout(() => {
      icon.classList.remove(animClass);
    }, timeoutMs);
    return;
  }

  icon.addEventListener('animationend', () => {
    icon.classList.remove(animClass);
  }, { once: true });
}

function showPage(pageName) {
  // UI STATE CONSISTENCY: Prevent navigation to disabled features
  const navItem = document.querySelector(`.sidebar .nav-item[onclick*="'${pageName}'"]`);
  if (navItem && navItem.hasAttribute('data-feature')) {
    const feature = navItem.getAttribute('data-feature');
    const record = getDemoUserPrefsRecord(activeDemoUserId);
    const currentPrefs = (record && record.preferences)
      ? record.preferences
      : activeDemoFeaturePrefs;
    const featureKey = `show${feature.charAt(0).toUpperCase() + feature.slice(1)}`;
    if (currentPrefs && Object.prototype.hasOwnProperty.call(currentPrefs, featureKey) && !currentPrefs[featureKey]) {
      console.warn(`Feature '${feature}' is disabled`)
      return; // Don't navigate to disabled features
    }
  }

  const pages = document.querySelectorAll('.page-section');
  pages.forEach(page => page.classList.remove('active'));
  
  const page = document.getElementById(pageName);
  if (page) page.classList.add('active');
  
  const navItems = document.querySelectorAll('.sidebar .nav-item');
  navItems.forEach(item => item.classList.remove('active'));
  
  if (navItem) {
    navItem.classList.add('active');

    const animTargets = navItem.querySelectorAll('[data-nav-anim-target]');
    if (animTargets.length) {
      animTargets.forEach((target) => triggerNavIconAnimation(target, pageName));
    } else {
      const icon = navItem.querySelector('i');
      triggerNavIconAnimation(icon, pageName);
    }
  }

  openDashboardActionPicker(false);
  closeProfileMenu();
}

// Task Expansion
function toggleTaskDetails(element, event) {
  if (event) event.stopPropagation();
  const details = element.nextElementSibling;
  if (details && details.classList.contains('task-details')) {
    const isVisible = details.style.display !== 'none';
    details.style.display = isVisible ? 'none' : 'block';
    
    const chevron = element.querySelector('.fa-chevron-down');
    if (chevron) {
      chevron.style.transform = isVisible ? 'rotate(0deg)' : 'rotate(180deg)';
    }
  }
}

// ========================================
// Demo User Session (Temporary)
// ========================================

const DEMO_USER_STORAGE_KEY = 'fittrack_demo_user_id';
const DEMO_USER_PREFS_KEY = 'fittrack_demo_user_prefs_v1';
const DEFAULT_DEMO_FEATURE_PREFS = {
  showProjects: true,
  showWorkout: true,
  showNutrition: true
};
let activeDemoUserId = null;
let activeDemoFeaturePrefs = { ...DEFAULT_DEMO_FEATURE_PREFS };
const DEMO_USERS = [
  {
    id: 'student',
    name: 'Student (Gym)',
    role: 'Gym user',
    email: 'student.demo@fittrack.app',
    preferences: {
      weeklyWorkoutTarget: 4,
      calorieGoal: 2400,
      goalLine: 'Balance college, workouts, and consistency.',
      level: 'Beginner',
      goal: 'Muscle Gain'
    }
  },
  {
    id: 'professional',
    name: 'Working Professional',
    role: 'Busy schedule',
    email: 'pro.demo@fittrack.app',
    preferences: {
      weeklyWorkoutTarget: 3,
      calorieGoal: 2200,
      goalLine: 'Stay fit around meetings and deadlines.',
      level: 'Intermediate',
      goal: 'Maintain Fitness'
    }
  },
  {
    id: 'influencer',
    name: 'Fitness Influencer',
    role: 'Performance focused',
    email: 'creator.demo@fittrack.app',
    preferences: {
      weeklyWorkoutTarget: 6,
      calorieGoal: 2600,
      goalLine: 'Train hard and keep performance trending up.',
      level: 'Advanced',
      goal: 'Muscle Gain'
    }
  }
];


const DEMO_USER_DATA_KEY = 'fittrack_demo_user_data_v1';

function isoDateOffset(daysFromToday) {
  const d = new Date();
  d.setDate(d.getDate() + daysFromToday);
  return toLocalDateKey(d);
}

function isoDateTimeOffset(hoursFromNow) {
  const d = new Date();
  d.setHours(d.getHours() + hoursFromNow);
  return d.toISOString();
}

function buildDemoTask(id, userId, title, priority, dueOffsetHours, options = {}) {
  const dueAt = isoDateTimeOffset(dueOffsetHours);
  const completed = !!options.completed;
  const completedHoursAgo = Number(options.completedHoursAgo || 2);
  return {
    id,
    userId,
    title,
    priority,
    category: options.category || 'general',
    description: options.description || '',
    subtasks: Array.isArray(options.subtasks) ? options.subtasks : [],
    date: dueAt.split('T')[0],
    dueAt,
    completed,
    completedAt: completed ? isoDateTimeOffset(-Math.max(1, completedHoursAgo)) : null
  };
}

function defaultDemoNote(title, userId) {
  return `${title}: demo note for ${userId} profile.`;
}

function defaultDemoSubtasks(taskId, title, count = 3) {
  const base = Math.max(1, Number(taskId) || Date.now());
  const labels = [
    `Plan ${title.toLowerCase()}`,
    `Execute ${title.toLowerCase()}`,
    `Review ${title.toLowerCase()} results`
  ];
  return labels.slice(0, count).map((label, idx) => ({
    id: base * 10 + idx + 1,
    title: label,
    completed: false
  }));
}

function taskEnhancementsStorageKeyForUser(userId) {
  return userId ? `${TASK_ENHANCEMENTS_KEY_BASE}_${userId}` : TASK_ENHANCEMENTS_KEY_BASE;
}

function seedDemoTaskEnhancementsForUser(userId, tasks) {
  if (!userId || !Array.isArray(tasks)) return;
  let enh = {};
  try {
    const raw = localStorage.getItem(taskEnhancementsStorageKeyForUser(userId));
    enh = raw ? JSON.parse(raw) : {};
  } catch (_err) {
    enh = {};
  }

  tasks.forEach(task => {
    const key = String(task.id);
    const existing = enh[key] || {};
    const seededSubtasks = Array.isArray(task.subtasks) ? task.subtasks : [];
    const existingSubtasks = Array.isArray(existing.subtasks) ? existing.subtasks : [];
    const mergedSubtasks = [...existingSubtasks];
    seededSubtasks.forEach(seed => {
      const already = mergedSubtasks.some(st => String(st.id) === String(seed.id) || String(st.title) === String(seed.title));
      if (!already) mergedSubtasks.push(seed);
    });
    enh[key] = {
      subtasks: mergedSubtasks.length ? mergedSubtasks : seededSubtasks,
      dueAt: existing.dueAt || task.dueAt || null,
      repeat: existing.repeat || 'none',
      completedDates: existing.completedDates || {},
      completedAtDates: existing.completedAtDates || {}
    };
  });

  localStorage.setItem(taskEnhancementsStorageKeyForUser(userId), JSON.stringify(enh));
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

const DEMO_USER_DUMMY_DATA = {
  student: {
    tasks: [
      buildDemoTask(101, 'student', 'Finish chemistry lab report', 'high', 8, {
        description: 'Lab submission closes tonight. Verify graphs and references.',
        subtasks: [
          { id: 1011, title: 'Finalize experiment chart', completed: false },
          { id: 1012, title: 'Proofread conclusion section', completed: false }
        ]
      }),
      buildDemoTask(102, 'student', 'Leg day workout', 'medium', 20),
      buildDemoTask(103, 'student', 'Upload assignment to portal', 'high', -6),
      buildDemoTask(104, 'student', 'Morning revision session', 'medium', -20, {
        completed: true,
        completedHoursAgo: 10,
        description: 'Focused on formulas for tomorrow test.',
        subtasks: [
          { id: 1041, title: 'Review chapter summaries', completed: true },
          { id: 1042, title: 'Solve 10 practice questions', completed: true }
        ]
      }),
      buildDemoTask(105, 'student', 'Meal prep for tomorrow', 'low', 28),
      buildDemoTask(106, 'student', 'Attend project group call', 'medium', 4),
      buildDemoTask(107, 'student', 'Buy protein powder', 'low', -30),
      buildDemoTask(108, 'student', 'Read two chapters', 'medium', 42),
      buildDemoTask(109, 'student', 'Track calories for the day', 'high', -2, {
        completed: true,
        completedHoursAgo: 1,
        description: 'Hit protein goal; carbs slightly over target.',
        subtasks: [
          { id: 1091, title: 'Log breakfast', completed: true },
          { id: 1092, title: 'Log dinner', completed: true }
        ]
      }),
      buildDemoTask(110, 'student', 'Stretching before sleep', 'low', 12),
      buildDemoTask(131, 'student', 'Completed math worksheet', 'medium', -72, { completed: true, completedHoursAgo: 48 }),
      buildDemoTask(132, 'student', 'Submitted physics assignment', 'high', -96, { completed: true, completedHoursAgo: 70 }),
      buildDemoTask(133, 'student', 'Finished campus run', 'medium', -120, { completed: true, completedHoursAgo: 90 }),
      buildDemoTask(134, 'student', 'Logged breakfast macros', 'low', -36, { completed: true, completedHoursAgo: 20 }),
      buildDemoTask(135, 'student', 'Attended study group', 'medium', -84, { completed: true, completedHoursAgo: 62 }),
      buildDemoTask(136, 'student', 'Prepared gym bag', 'low', -60, { completed: true, completedHoursAgo: 40 }),
      buildDemoTask(137, 'student', 'Reviewed biology notes', 'medium', -108, { completed: true, completedHoursAgo: 82 }),
      buildDemoTask(138, 'student', 'Completed mobility routine', 'low', -54, { completed: true, completedHoursAgo: 34 }),
      buildDemoTask(139, 'student', 'Updated weekly planner', 'medium', -66, { completed: true, completedHoursAgo: 44 }),
      buildDemoTask(140, 'student', 'Finished quiz revision', 'high', -144, { completed: true, completedHoursAgo: 120 })
    ],
    meals: [
      { id: 1001, name: 'Oats + banana', meal_type: 'breakfast', calories: 520, protein: 22, carbs: 78, fats: 12, date: isoDateOffset(0), time: '08:15' },
      { id: 1002, name: 'Chicken rice bowl', meal_type: 'lunch', calories: 760, protein: 48, carbs: 92, fats: 18, date: isoDateOffset(0), time: '13:05' },
      { id: 1003, name: 'Greek yogurt', meal_type: 'snack', calories: 220, protein: 18, carbs: 20, fats: 7, date: isoDateOffset(-1), time: '17:10' },
      { id: 1004, name: 'Paneer wrap', meal_type: 'dinner', calories: 640, protein: 36, carbs: 52, fats: 28, date: isoDateOffset(-1), time: '20:25' },
      { id: 1005, name: 'Peanut smoothie', meal_type: 'snack', calories: 310, protein: 20, carbs: 24, fats: 14, date: isoDateOffset(-2), time: '16:40' }
    ],
    savedMeals: [
      { id: 9101, name: 'Student Power Oats', meal_type: 'breakfast', calories: 540, protein: 28, carbs: 76, fats: 14 },
      { id: 9102, name: 'Peanut Banana Toast', meal_type: 'breakfast', calories: 430, protein: 18, carbs: 52, fats: 16 },
      { id: 9103, name: 'Campus Chicken Bowl', meal_type: 'lunch', calories: 720, protein: 46, carbs: 88, fats: 17 },
      { id: 9104, name: 'Paneer Rice Combo', meal_type: 'lunch', calories: 690, protein: 34, carbs: 82, fats: 21 },
      { id: 9105, name: 'Egg Wrap Plate', meal_type: 'dinner', calories: 610, protein: 33, carbs: 58, fats: 24 },
      { id: 9106, name: 'Grilled Fish + Potato', meal_type: 'dinner', calories: 650, protein: 40, carbs: 48, fats: 27 },
      { id: 9107, name: 'Quick Protein Snack', meal_type: 'snack', calories: 250, protein: 21, carbs: 18, fats: 8 },
      { id: 9108, name: 'Yogurt Fruit Cup', meal_type: 'snack', calories: 220, protein: 14, carbs: 24, fats: 7 }
    ],
    projects: [
      {
        id: 501,
        name: 'Semester Fitness Plan',
        description: 'Stay consistent with workouts and classes.',
        theme: 'blue',
        totalTime: 9600,
        expanded: true,
        tasks: [
          { id: 5011, title: 'Plan weekly workout slots', completed: true, timeSpent: 2400, isTracking: false, expanded: false, subtasks: [] },
          { id: 5012, title: 'Track gym attendance', completed: false, timeSpent: 1800, isTracking: false, expanded: true, subtasks: [{ id: 50121, title: 'Log Monday session', completed: true }, { id: 50122, title: 'Log Wednesday session', completed: false }] }
        ]
      },
      {
        id: 502,
        name: 'Study + Nutrition Routine',
        description: 'Meal prep and study block scheduling.',
        theme: 'green',
        totalTime: 4200,
        expanded: false,
        tasks: [
          { id: 5021, title: 'Sunday meal prep', completed: false, timeSpent: 1200, isTracking: false, expanded: false, subtasks: [] },
          { id: 5022, title: 'Create study + meal calendar', completed: true, timeSpent: 900, isTracking: false, expanded: false, subtasks: [] }
        ]
      }
    ],
    workouts: [
      { id: 2001, name: 'Campus Run', type: 'cardio', intensity: 'medium', duration: 35, calories_burned: 280, date: isoDateOffset(0), time: '06:45', notes: '', exercises: [] },
      { id: 2002, name: 'Leg Strength', type: 'strength', intensity: 'high', duration: 55, calories_burned: 420, date: isoDateOffset(1), time: '18:00', notes: '', exercises: [{ name: 'Squat', sets: 4, reps: 8, weight: 80 }] },
      { id: 2003, name: 'Mobility Session', type: 'flexibility', intensity: 'low', duration: 25, calories_burned: 110, date: isoDateOffset(-2), time: '07:00', notes: '', exercises: [] }
    ]
  },
  professional: {
    tasks: [
      buildDemoTask(111, 'professional', 'Prepare client presentation', 'high', 6, {
        description: 'Need final deck for 4 PM review.',
        subtasks: [
          { id: 1111, title: 'Update KPI slide', completed: false },
          { id: 1112, title: 'Add risk mitigation notes', completed: false }
        ]
      }),
      buildDemoTask(112, 'professional', '30-min evening mobility', 'low', 14),
      buildDemoTask(113, 'professional', 'Submit weekly status update', 'medium', -5),
      buildDemoTask(114, 'professional', 'Lunch walk break', 'low', -22, {
        completed: true,
        completedHoursAgo: 8,
        description: 'Completed 25 minutes at moderate pace.',
        subtasks: [
          { id: 1141, title: 'Walk 20+ minutes', completed: true },
          { id: 1142, title: 'Log steps in tracker', completed: true }
        ]
      }),
      buildDemoTask(115, 'professional', 'Book health checkup', 'medium', 36),
      buildDemoTask(116, 'professional', 'Finish sprint tickets', 'high', 18),
      buildDemoTask(117, 'professional', 'Hydration tracking', 'low', -26),
      buildDemoTask(118, 'professional', 'Review posture routine', 'medium', 50),
      buildDemoTask(119, 'professional', 'Log lunch macros', 'medium', -1, {
        completed: true,
        completedHoursAgo: 1,
        description: 'Protein on target. Keep sodium lower at dinner.',
        subtasks: [
          { id: 1191, title: 'Capture meal photo', completed: true },
          { id: 1192, title: 'Enter macros in app', completed: true }
        ]
      }),
      buildDemoTask(120, 'professional', 'Plan weekend training', 'high', 30),
      buildDemoTask(141, 'professional', 'Closed monthly report', 'high', -80, { completed: true, completedHoursAgo: 56 }),
      buildDemoTask(142, 'professional', 'Completed desk stretch set', 'low', -40, { completed: true, completedHoursAgo: 24 }),
      buildDemoTask(143, 'professional', 'Sent stakeholder summary', 'medium', -64, { completed: true, completedHoursAgo: 46 }),
      buildDemoTask(144, 'professional', 'Logged dinner calories', 'low', -34, { completed: true, completedHoursAgo: 18 }),
      buildDemoTask(145, 'professional', 'Finished HIIT session', 'high', -92, { completed: true, completedHoursAgo: 68 }),
      buildDemoTask(146, 'professional', 'Cleared email backlog', 'medium', -58, { completed: true, completedHoursAgo: 40 }),
      buildDemoTask(147, 'professional', 'Updated sprint notes', 'medium', -74, { completed: true, completedHoursAgo: 52 }),
      buildDemoTask(148, 'professional', 'Completed mobility cooldown', 'low', -46, { completed: true, completedHoursAgo: 28 }),
      buildDemoTask(149, 'professional', 'Booked coaching session', 'medium', -88, { completed: true, completedHoursAgo: 64 }),
      buildDemoTask(150, 'professional', 'Finished morning walk', 'low', -52, { completed: true, completedHoursAgo: 36 })
    ],
    meals: [
      { id: 1101, name: 'Egg sandwich', meal_type: 'breakfast', calories: 430, protein: 24, carbs: 38, fats: 16, date: isoDateOffset(0), time: '07:40' },
      { id: 1102, name: 'Office thali', meal_type: 'lunch', calories: 690, protein: 30, carbs: 88, fats: 20, date: isoDateOffset(0), time: '13:20' },
      { id: 1103, name: 'Protein shake', meal_type: 'snack', calories: 260, protein: 30, carbs: 14, fats: 8, date: isoDateOffset(-1), time: '18:10' },
      { id: 1104, name: 'Grilled fish + quinoa', meal_type: 'dinner', calories: 610, protein: 44, carbs: 46, fats: 22, date: isoDateOffset(-1), time: '20:45' },
      { id: 1105, name: 'Fruit + nuts bowl', meal_type: 'snack', calories: 280, protein: 10, carbs: 24, fats: 16, date: isoDateOffset(-2), time: '16:30' }
    ],
    savedMeals: [
      { id: 9201, name: 'Desk Breakfast Combo', meal_type: 'breakfast', calories: 460, protein: 26, carbs: 40, fats: 17 },
      { id: 9202, name: 'Egg Muffin Pair', meal_type: 'breakfast', calories: 410, protein: 24, carbs: 30, fats: 20 },
      { id: 9203, name: 'High-Protein Office Lunch', meal_type: 'lunch', calories: 680, protein: 38, carbs: 72, fats: 19 },
      { id: 9204, name: 'Turkey Quinoa Box', meal_type: 'lunch', calories: 630, protein: 41, carbs: 58, fats: 20 },
      { id: 9205, name: 'Salmon Dinner Plate', meal_type: 'dinner', calories: 710, protein: 45, carbs: 54, fats: 31 },
      { id: 9206, name: 'Chicken Stir Fry', meal_type: 'dinner', calories: 640, protein: 39, carbs: 62, fats: 23 },
      { id: 9207, name: 'Post-Work Shake', meal_type: 'snack', calories: 290, protein: 32, carbs: 20, fats: 7 },
      { id: 9208, name: 'Nuts + Fruit Pack', meal_type: 'snack', calories: 270, protein: 9, carbs: 22, fats: 17 }
    ],
    projects: [
      {
        id: 601,
        name: 'Quarter Health Goals',
        description: 'Balance work output and personal fitness.',
        theme: 'purple',
        totalTime: 7800,
        expanded: true,
        tasks: [
          { id: 6011, title: 'Set weekly mobility slots', completed: true, timeSpent: 1500, isTracking: false, expanded: false, subtasks: [] },
          { id: 6012, title: 'Plan healthy office lunches', completed: false, timeSpent: 1200, isTracking: false, expanded: false, subtasks: [] }
        ]
      },
      {
        id: 602,
        name: 'Client Delivery Sprint',
        description: 'Track deliverables and personal recovery.',
        theme: 'orange',
        totalTime: 13200,
        expanded: false,
        tasks: [
          { id: 6021, title: 'Finalize presentation draft', completed: true, timeSpent: 3600, isTracking: false, expanded: false, subtasks: [] },
          { id: 6022, title: 'Schedule evening HIIT blocks', completed: false, timeSpent: 900, isTracking: false, expanded: false, subtasks: [] }
        ]
      }
    ],
    workouts: [
      { id: 2101, name: 'Lunch Break HIIT', type: 'cardio', intensity: 'high', duration: 28, calories_burned: 340, date: isoDateOffset(0), time: '12:30', notes: '', exercises: [] },
      { id: 2102, name: 'Upper Body Strength', type: 'strength', intensity: 'medium', duration: 45, calories_burned: 320, date: isoDateOffset(2), time: '19:15', notes: '', exercises: [{ name: 'Bench Press', sets: 4, reps: 6, weight: 75 }] },
      { id: 2103, name: 'Desk Stretch Flow', type: 'flexibility', intensity: 'low', duration: 20, calories_burned: 90, date: isoDateOffset(-1), time: '21:00', notes: '', exercises: [] }
    ]
  },
  influencer: {
    tasks: [
      buildDemoTask(121, 'influencer', 'Shoot upper-body reel', 'high', 5, {
        description: 'Need two takes: tutorial + quick cuts.',
        subtasks: [
          { id: 1211, title: 'Set lighting and tripod', completed: false },
          { id: 1212, title: 'Record voiceover intro', completed: false }
        ]
      }),
      buildDemoTask(122, 'influencer', 'Plan sponsorship pitch', 'medium', 22),
      buildDemoTask(123, 'influencer', 'Review engagement analytics', 'medium', -4),
      buildDemoTask(124, 'influencer', 'Edit short-form clips', 'high', -16, {
        completed: true,
        completedHoursAgo: 9,
        description: 'Exported clips in 9:16 and added captions.',
        subtasks: [
          { id: 1241, title: 'Trim raw footage', completed: true },
          { id: 1242, title: 'Add text overlays', completed: true }
        ]
      }),
      buildDemoTask(125, 'influencer', 'Respond to brand emails', 'medium', 11),
      buildDemoTask(126, 'influencer', 'Live Q&A prep', 'low', 40),
      buildDemoTask(127, 'influencer', 'Schedule tomorrow workout', 'low', -24),
      buildDemoTask(128, 'influencer', 'Post nutrition infographic', 'high', 26),
      buildDemoTask(129, 'influencer', 'Track evening meal', 'medium', -3, {
        completed: true,
        completedHoursAgo: 2,
        description: 'Balanced meal; carbs timed post-workout.',
        subtasks: [
          { id: 1291, title: 'Weigh meal portions', completed: true },
          { id: 1292, title: 'Save meal preset', completed: true }
        ]
      }),
      buildDemoTask(130, 'influencer', 'Recovery and mobility session', 'low', 16),
      buildDemoTask(151, 'influencer', 'Published sponsored reel', 'high', -90, { completed: true, completedHoursAgo: 66 }),
      buildDemoTask(152, 'influencer', 'Edited thumbnails batch', 'medium', -62, { completed: true, completedHoursAgo: 44 }),
      buildDemoTask(153, 'influencer', 'Completed pull-day training', 'high', -78, { completed: true, completedHoursAgo: 58 }),
      buildDemoTask(154, 'influencer', 'Posted story poll', 'low', -38, { completed: true, completedHoursAgo: 22 }),
      buildDemoTask(155, 'influencer', 'Drafted brand proposal', 'medium', -84, { completed: true, completedHoursAgo: 60 }),
      buildDemoTask(156, 'influencer', 'Logged macro breakdown', 'low', -50, { completed: true, completedHoursAgo: 32 }),
      buildDemoTask(157, 'influencer', 'Shot recovery tips clip', 'medium', -70, { completed: true, completedHoursAgo: 50 }),
      buildDemoTask(158, 'influencer', 'Completed cardio intervals', 'high', -56, { completed: true, completedHoursAgo: 38 }),
      buildDemoTask(159, 'influencer', 'Answered community Q&A', 'medium', -44, { completed: true, completedHoursAgo: 26 }),
      buildDemoTask(160, 'influencer', 'Uploaded weekly recap', 'high', -112, { completed: true, completedHoursAgo: 88 })
    ],
    meals: [
      { id: 1201, name: 'Avocado toast + eggs', meal_type: 'breakfast', calories: 610, protein: 30, carbs: 48, fats: 32, date: isoDateOffset(0), time: '08:05' },
      { id: 1202, name: 'Lean turkey pasta', meal_type: 'lunch', calories: 840, protein: 56, carbs: 98, fats: 22, date: isoDateOffset(0), time: '14:00' },
      { id: 1203, name: 'Fruit + whey bowl', meal_type: 'snack', calories: 350, protein: 28, carbs: 42, fats: 8, date: isoDateOffset(-1), time: '17:45' },
      { id: 1204, name: 'Salmon rice plate', meal_type: 'dinner', calories: 760, protein: 52, carbs: 68, fats: 26, date: isoDateOffset(-1), time: '21:10' },
      { id: 1205, name: 'Overnight oats jar', meal_type: 'breakfast', calories: 490, protein: 26, carbs: 58, fats: 15, date: isoDateOffset(-2), time: '07:55' }
    ],
    savedMeals: [
      { id: 9301, name: 'Creator Lean Breakfast', meal_type: 'breakfast', calories: 520, protein: 31, carbs: 52, fats: 18 },
      { id: 9302, name: 'Overnight Oats Pro', meal_type: 'breakfast', calories: 500, protein: 27, carbs: 60, fats: 14 },
      { id: 9303, name: 'Performance Lunch Bowl', meal_type: 'lunch', calories: 810, protein: 54, carbs: 90, fats: 21 },
      { id: 9304, name: 'Lean Beef Rice Box', meal_type: 'lunch', calories: 760, protein: 48, carbs: 84, fats: 22 },
      { id: 9305, name: 'Salmon Recovery Dinner', meal_type: 'dinner', calories: 780, protein: 52, carbs: 66, fats: 28 },
      { id: 9306, name: 'Chicken Pasta Night', meal_type: 'dinner', calories: 730, protein: 46, carbs: 82, fats: 19 },
      { id: 9307, name: 'Recovery Smoothie', meal_type: 'snack', calories: 340, protein: 29, carbs: 36, fats: 9 },
      { id: 9308, name: 'Greek Yogurt Crunch', meal_type: 'snack', calories: 280, protein: 24, carbs: 22, fats: 10 }
    ],
    projects: [
      {
        id: 701,
        name: 'Content Pipeline',
        description: 'Plan and publish weekly fitness content.',
        theme: 'rose',
        totalTime: 16800,
        expanded: true,
        tasks: [
          { id: 7011, title: 'Record weekly reel set', completed: false, timeSpent: 2400, isTracking: false, expanded: false, subtasks: [{ id: 70111, title: 'Push-day clip', completed: false }] },
          { id: 7012, title: 'Prepare caption templates', completed: true, timeSpent: 1500, isTracking: false, expanded: false, subtasks: [] }
        ]
      },
      {
        id: 702,
        name: 'Brand Partnerships',
        description: 'Manage outreach and campaign delivery.',
        theme: 'indigo',
        totalTime: 10400,
        expanded: false,
        tasks: [
          { id: 7021, title: 'Draft sponsor deck', completed: true, timeSpent: 2200, isTracking: false, expanded: false, subtasks: [] },
          { id: 7022, title: 'Publish sponsored post schedule', completed: false, timeSpent: 1300, isTracking: false, expanded: false, subtasks: [] }
        ]
      }
    ],
    workouts: [
      { id: 2201, name: 'Powerlifting Session', type: 'strength', intensity: 'high', duration: 70, calories_burned: 560, date: isoDateOffset(0), time: '07:15', notes: '', exercises: [{ name: 'Deadlift', sets: 5, reps: 5, weight: 140 }] },
      { id: 2202, name: 'Stair Sprint Intervals', type: 'cardio', intensity: 'high', duration: 40, calories_burned: 470, date: isoDateOffset(1), time: '16:20', notes: '', exercises: [] },
      { id: 2203, name: 'Recovery Yoga', type: 'flexibility', intensity: 'low', duration: 30, calories_burned: 120, date: isoDateOffset(-1), time: '20:30', notes: '', exercises: [] }
    ]
  }
};

function readDemoUserDataStore() {
  try {
    const raw = localStorage.getItem(DEMO_USER_DATA_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (_err) {
    return {};
  }
}

function writeDemoUserDataStore(store) {
  localStorage.setItem(DEMO_USER_DATA_KEY, JSON.stringify(store));
}

function ensureDemoUserData(userId) {
  if (!userId) return null;
  const store = readDemoUserDataStore();
  if (!store[userId]) {
    store[userId] = deepClone(DEMO_USER_DUMMY_DATA[userId] || { tasks: [], meals: [], savedMeals: [], workouts: [], projects: [] });
  } else if (Array.isArray(store[userId].tasks)) {
    const seededTasks = deepClone((DEMO_USER_DUMMY_DATA[userId] && DEMO_USER_DUMMY_DATA[userId].tasks) || []);
    const existingById = new Set(store[userId].tasks.map(t => Number(t.id)));
    seededTasks.forEach(task => {
      if (!existingById.has(Number(task.id))) store[userId].tasks.push(task);
    });
  }

  if (Array.isArray(store[userId].tasks)) {
    const seededTemplates = new Map(
      (((DEMO_USER_DUMMY_DATA[userId] && DEMO_USER_DUMMY_DATA[userId].tasks) || []).map(t => [String(t.id), t]))
    );
    store[userId].tasks = store[userId].tasks.map(task => {
      const template = seededTemplates.get(String(task.id));
      const normalized = { ...task, userId: task.userId || userId };
      if (!normalized.dueAt && normalized.date) normalized.dueAt = `${normalized.date}T23:59:00`;
      if (!('completedAt' in normalized)) normalized.completedAt = normalized.completed ? new Date().toISOString() : null;
      if (template) {
        if (!String(normalized.description || '').trim()) {
          normalized.description = String(template.description || '').trim() || defaultDemoNote(normalized.title || 'Task', userId);
        }
        const templateSubs = Array.isArray(template.subtasks) ? deepClone(template.subtasks) : [];
        const currentSubs = Array.isArray(normalized.subtasks) ? normalized.subtasks : [];
        const merged = [...currentSubs];
        const addIfMissing = (candidate) => {
          if (!candidate) return;
          const exists = merged.some(st => String(st.id) === String(candidate.id) || String(st.title) === String(candidate.title));
          if (!exists) merged.push(candidate);
        };
        templateSubs.forEach(addIfMissing);
        if (merged.length < 3) {
          defaultDemoSubtasks(normalized.id, normalized.title || 'task', 3).forEach(addIfMissing);
        }
        normalized.subtasks = merged;
      }
      return normalized;
    });
    seedDemoTaskEnhancementsForUser(userId, store[userId].tasks);
  }
  writeDemoUserDataStore(store);
  return store[userId];
}

function getActiveDemoUserData() {
  if (!activeDemoUserId) return null;
  return ensureDemoUserData(activeDemoUserId);
}

function getActiveUserTasksData() {
  const data = getActiveDemoUserData();
  return data && Array.isArray(data.tasks) ? data.tasks : [];
}

function setActiveUserTasksData(tasks) {
  if (!activeDemoUserId) return;
  const store = readDemoUserDataStore();
  const current = ensureDemoUserData(activeDemoUserId) || {};
  store[activeDemoUserId] = { ...current, tasks: Array.isArray(tasks) ? tasks : [] };
  writeDemoUserDataStore(store);
}

function getActiveUserMealsData() {
  const data = getActiveDemoUserData();
  return data && Array.isArray(data.meals) ? data.meals : [];
}

function setActiveUserMealsData(meals) {
  if (!activeDemoUserId) return;
  const store = readDemoUserDataStore();
  const current = ensureDemoUserData(activeDemoUserId) || {};
  store[activeDemoUserId] = { ...current, meals: Array.isArray(meals) ? meals : [] };
  writeDemoUserDataStore(store);
}

function getActiveUserWorkoutsData() {
  const data = getActiveDemoUserData();
  return data && Array.isArray(data.workouts) ? data.workouts : [];
}

function setActiveUserWorkoutsData(workouts) {
  if (!activeDemoUserId) return;
  const store = readDemoUserDataStore();
  const current = ensureDemoUserData(activeDemoUserId) || {};
  store[activeDemoUserId] = { ...current, workouts: Array.isArray(workouts) ? workouts : [] };
  writeDemoUserDataStore(store);
}

function nextLocalId(items) {
  if (!Array.isArray(items) || items.length === 0) return 1;
  return items.reduce((max, item) => Math.max(max, Number(item.id) || 0), 0) + 1;
}

function findDemoUserById(id) {
  return DEMO_USERS.find(u => u.id === id) || null;
}

function readDemoPrefsStore() {
  try {
    const raw = localStorage.getItem(DEMO_USER_PREFS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (_err) {
    return {};
  }
}

function writeDemoPrefsStore(store) {
  localStorage.setItem(DEMO_USER_PREFS_KEY, JSON.stringify(store));
}

function getDemoUserPrefsRecord(userId) {
  const store = readDemoPrefsStore();
  return store[userId] || null;
}

function saveDemoUserPrefsRecord(userId, record) {
  const store = readDemoPrefsStore();
  store[userId] = record;
  writeDemoPrefsStore(store);
}

function setSessionView(view) {
  const app = document.getElementById('app-wrapper');
  const selector = document.getElementById('demo-user-selector');
  const onboarding = document.getElementById('demo-onboarding');
  if (app) app.style.display = view === 'app' ? 'grid' : 'none';
  if (selector) selector.classList.toggle('hidden', view !== 'selector');
  if (onboarding) onboarding.classList.toggle('hidden', view !== 'onboarding');
}

function renderDemoUserSelector() {
  const cards = document.getElementById('demo-user-cards');
  if (!cards) return;
  cards.innerHTML = DEMO_USERS.map(user => `
    <button class="demo-user-card" type="button" data-action="pick-demo-user" data-user-id="${user.id}">
      <h3>${user.name}</h3>
      <p>${user.role}</p>
      <div class="meta">Target: ${user.preferences.weeklyWorkoutTarget} workouts/week</div>
    </button>
  `).join('');

  cards.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action="pick-demo-user"]');
    if (!btn) return;
    const userId = btn.getAttribute('data-user-id');
    if (!userId) return;
    // DEMO USER VALIDATION: Verify user exists before setting session
    const selected = findDemoUserById(userId);
    if (!selected) {
      alert('❌ Invalid user selection. Please try again.');
      return;
    }
    localStorage.setItem(DEMO_USER_STORAGE_KEY, userId);
    activeDemoUserId = userId;

    const record = getDemoUserPrefsRecord(userId);
    if (!record || record.isFirstLogin !== false) {
      openDemoOnboarding(selected);
      return;
    }

    applyDemoUserContext(selected);
    applyUserFeaturePreferences(record.preferences || DEFAULT_DEMO_FEATURE_PREFS);
    setSessionView('app');
    showPage('dashboard');
    await loadActiveUserDataViews();
  });
}

function applyUserFeaturePreferences(preferences) {
  activeDemoFeaturePrefs = {
    ...DEFAULT_DEMO_FEATURE_PREFS,
    ...(preferences || {})
  };
  const featureMap = [
    { key: 'showProjects', attr: 'projects' },
    { key: 'showWorkout', attr: 'workout' },
    { key: 'showNutrition', attr: 'nutrition' }
  ];
  featureMap.forEach(item => {
    const show = !!activeDemoFeaturePrefs[item.key];
    document.querySelectorAll(`[data-feature="${item.attr}"]`).forEach(el => {
      el.classList.toggle('feature-hidden', !show);
    });
  });

  const activePage = document.querySelector('.page-section.active');
  if (activePage && activePage.classList.contains('feature-hidden')) {
    showPage('dashboard');
  }

  sanitizeDashboardQuickActions();
  persistDashboardQuickActions();
  renderDashboardQuickActionButtons();
  renderDashboardQuickActionPicker();
  updateDashboardTimerUI();
}


function getCurrentLayoutPreferencesForActiveUser() {
  if (!activeDemoUserId) return { ...activeDemoFeaturePrefs };
  const record = getDemoUserPrefsRecord(activeDemoUserId);
  return {
    ...DEFAULT_DEMO_FEATURE_PREFS,
    ...(record?.preferences || activeDemoFeaturePrefs || {})
  };
}

function openLayoutCustomizeModal() {
  const modal = document.getElementById('layout-customize-modal');
  const prefProjects = document.getElementById('layout-pref-projects');
  const prefWorkout = document.getElementById('layout-pref-workout');
  const prefNutrition = document.getElementById('layout-pref-nutrition');
  if (!modal) return;

  const current = getCurrentLayoutPreferencesForActiveUser();
  if (prefProjects) prefProjects.checked = !!current.showProjects;
  if (prefWorkout) prefWorkout.checked = !!current.showWorkout;
  if (prefNutrition) prefNutrition.checked = !!current.showNutrition;

  modal.style.display = 'flex';
}

function closeLayoutCustomizeModal() {
  const modal = document.getElementById('layout-customize-modal');
  if (modal) modal.style.display = 'none';
}

function setupLayoutCustomizer() {
  const modal = document.getElementById('layout-customize-modal');
  const form = document.getElementById('layout-customize-form');
  const closeBtn = document.getElementById('layout-customize-close');
  const cancelBtn = document.getElementById('layout-customize-cancel');
  if (!modal || !form) return;

  if (closeBtn) closeBtn.addEventListener('click', closeLayoutCustomizeModal);
  if (cancelBtn) cancelBtn.addEventListener('click', closeLayoutCustomizeModal);

  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeLayoutCustomizeModal();
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!activeDemoUserId) {
      closeLayoutCustomizeModal();
      return;
    }

    const preferences = {
      showProjects: !!document.getElementById('layout-pref-projects')?.checked,
      showWorkout: !!document.getElementById('layout-pref-workout')?.checked,
      showNutrition: !!document.getElementById('layout-pref-nutrition')?.checked
    };

    const existing = getDemoUserPrefsRecord(activeDemoUserId) || {};
    saveDemoUserPrefsRecord(activeDemoUserId, {
      ...existing,
      isFirstLogin: false,
      preferences
    });

    applyUserFeaturePreferences(preferences);
    await refreshDashboardMetrics();
    updateStatisticsForActiveUser();
    renderStatistics();
    closeLayoutCustomizeModal();
  });
}
function openDemoOnboarding(user) {
  const subtitle = document.getElementById('demo-onboarding-subtitle');
  const prefProjects = document.getElementById('pref-projects');
  const prefWorkout = document.getElementById('pref-workout');
  const prefNutrition = document.getElementById('pref-nutrition');
  if (subtitle) subtitle.textContent = `Welcome ${user.name}. Choose what you want to enable.`;
  if (prefProjects) prefProjects.checked = true;
  if (prefWorkout) prefWorkout.checked = true;
  if (prefNutrition) prefNutrition.checked = true;
  setSessionView('onboarding');
}

function setupDemoOnboarding() {
  const form = document.getElementById('demo-onboarding-form');
  if (!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!activeDemoUserId) return;
    const user = findDemoUserById(activeDemoUserId);
    if (!user) return;
    const preferences = {
      showProjects: !!document.getElementById('pref-projects')?.checked,
      showWorkout: !!document.getElementById('pref-workout')?.checked,
      showNutrition: !!document.getElementById('pref-nutrition')?.checked
    };
    saveDemoUserPrefsRecord(activeDemoUserId, {
      isFirstLogin: false,
      preferences
    });
    applyDemoUserContext(user);
    applyUserFeaturePreferences(preferences);
    setSessionView('app');
    showPage('dashboard');
    await loadActiveUserDataViews();
  });
}

function applyDemoUserContext(user) {
  const prefs = user.preferences || {};
  const inferredWeightGoal = prefs.goal === 'Weight Loss'
    ? 'loss'
    : prefs.goal === 'Muscle Gain'
      ? 'gain'
      : 'maintain';
  profileState = {
    ...profileState,
    fullName: user.name,
    email: user.email,
    level: prefs.level || profileState.level,
    goal: prefs.goal || profileState.goal,
    weightGoal: prefs.weightGoal || profileState.weightGoal || inferredWeightGoal
  };
  dashboardState.weeklyWorkoutTarget = prefs.weeklyWorkoutTarget || dashboardState.weeklyWorkoutTarget;
  dashboardState.calorieGoal = prefs.calorieGoal || dashboardState.calorieGoal;
  const goalLine = document.getElementById('dash-goal-line');
  if (goalLine && prefs.goalLine) goalLine.textContent = prefs.goalLine;
  syncNutritionGoalWithProfile();
  renderProfileUI();
}


async function loadActiveUserDataViews() {
  loadTaskEnhancements();
  loadSavedMeals();
  loadWorkoutStorage();
  loadProjectsState();
  renderProjectsPage();
  await loadTasks();
  await loadMeals();
  await loadWorkoutsForPage();
  updateStatisticsForActiveUser();
  renderStatistics();
}
function bootstrapDemoSession() {
  renderDemoUserSelector();
  setupDemoOnboarding();
  const activeUserId = localStorage.getItem(DEMO_USER_STORAGE_KEY);
  // SECURITY FIX #3: Validate demo userId BEFORE setting it
  const selected = activeUserId ? findDemoUserById(activeUserId) : null;
  if (!selected) {
    // Invalid/tampereduser ID - clear session and show selector
    localStorage.removeItem(DEMO_USER_STORAGE_KEY);
    activeDemoUserId = null;
    setSessionView('selector');
    return false;
  }
  activeDemoUserId = activeUserId;
  const record = getDemoUserPrefsRecord(activeUserId);
  if (!record || record.isFirstLogin !== false) {
    openDemoOnboarding(selected);
    return false;
  }
  applyDemoUserContext(selected);
  applyUserFeaturePreferences(record.preferences || DEFAULT_DEMO_FEATURE_PREFS);
  setSessionView('app');
  return true;
}

// Priority color mapping
function getPriorityColor(priority, isCompleted) {
  if (isCompleted) return '#3b82f6'; // Blue for completed
  const colors = {
    low: '#22c55e',      // Green
    medium: '#eab308',   // Yellow
    high: '#ef4444'      // Red
  };
  return colors[priority] || colors.medium;
}

function getPriorityTextColor(priority, isCompleted) {
  if (isCompleted) return '#ffffff'; // White text for blue background
  const colors = {
    low: '#ffffff',
    medium: '#000000',
    high: '#ffffff'
  };
  return colors[priority] || colors.medium;
}

function getPriorityBorderColor(priority, isCompleted) {
  if (isCompleted) return '#1e40af'; // Darker blue for border
  const colors = {
    low: '#16a34a',      // Dark green
    medium: '#ca8a04',   // Dark yellow
    high: '#dc2626'      // Dark red
  };
  return colors[priority] || colors.medium;
}

// ========================================
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
async function toggleTask(taskId, occDate) {
  try {
    const task = taskUiState.tasks.find(t => t.id === taskId);
    if (!task) return;
    const repeat = getTaskRepeat(task);
    if (repeat !== 'none') {
      const key = occDate || toLocalDateKey(new Date());
      updateTaskEnhancement(taskId, ext => {
        ext.completedDates = ext.completedDates || {};
        ext.completedAtDates = ext.completedAtDates || {};
        const nextCompleted = !ext.completedDates[key];
        ext.completedDates[key] = nextCompleted;
        ext.completedAtDates[key] = nextCompleted ? new Date().toISOString() : null;
      });
      await loadTasks();
      return;
    }

    if (activeDemoUserId) {
      const tasks = getActiveUserTasksData().map(t => {
        if (t.id !== taskId) return t;
        const nextCompleted = !(t.completed || t.completedAt);
        return {
          ...t,
          completed: nextCompleted,
          completedAt: nextCompleted ? new Date().toISOString() : null
        };
      });
      setActiveUserTasksData(tasks);
      await loadTasks();
      return;
    }

    const response = await fetch(`/api/tasks/${taskId}/toggle`, {
      method: 'PATCH'
    });

    if (response.ok) {
      await loadTasks();
    }
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

// ========================================
// Nutrition Experience
// ========================================

const NUTRITION_SAVED_KEY_BASE = 'fittrack_saved_meals_v1';
function nutritionSavedMealsStorageKey() {
  return activeDemoUserId ? (NUTRITION_SAVED_KEY_BASE + '_' + activeDemoUserId) : NUTRITION_SAVED_KEY_BASE;
}

const nutritionState = {
  weightGoal: 'maintain',
  baseGoals: {
    calories: 2200,
    protein: 140,
    carbs: 250,
    fats: 60
  },
  entries: [],
  savedMeals: [],
  showForm: false,
  showSavedMeals: true,
  activeMealType: 'breakfast'
};
let mealsLoadRequestId = 0;

const nutritionFoodDatabase = {
  carbohydrates: [
    // Grains & Cereals
    { id: 'white_rice_cooked', name: 'White rice (cooked)', calories: 130, protein: 2.4, carbs: 28, fats: 0.3, unit: 'grams' },
    { id: 'brown_rice_cooked', name: 'Brown rice (cooked)', calories: 111, protein: 2.6, carbs: 23, fats: 0.9, unit: 'grams' },
    { id: 'oats_dry', name: 'Oats (dry)', calories: 389, protein: 17, carbs: 66, fats: 7, unit: 'grams' },
    { id: 'whole_wheat_bread', name: 'Whole wheat bread', calories: 247, protein: 13, carbs: 41, fats: 4.2, unit: 'grams' },
    { id: 'white_bread', name: 'White bread', calories: 265, protein: 9, carbs: 49, fats: 3.2, unit: 'grams' },
    { id: 'pasta_cooked', name: 'Pasta (cooked)', calories: 131, protein: 5, carbs: 25, fats: 1.1, unit: 'grams' },
    { id: 'quinoa_cooked', name: 'Quinoa (cooked)', calories: 120, protein: 4.4, carbs: 21, fats: 1.9, unit: 'grams' },
    { id: 'sweet_potato', name: 'Sweet potato', calories: 86, protein: 1.6, carbs: 20, fats: 0.1, unit: 'grams' },
    { id: 'potato', name: 'Potato', calories: 77, protein: 2, carbs: 17, fats: 0.1, unit: 'grams' },
    { id: 'jasmine_rice_cooked', name: 'Jasmine rice (cooked)', calories: 130, protein: 2.5, carbs: 28, fats: 0.3, unit: 'grams' },
    { id: 'basmati_rice_cooked', name: 'Basmati rice (cooked)', calories: 130, protein: 2.7, carbs: 28, fats: 0.3, unit: 'grams' },
    { id: 'wild_rice_cooked', name: 'Wild rice (cooked)', calories: 101, protein: 3.9, carbs: 19, fats: 0.3, unit: 'grams' },
    { id: 'rye_bread', name: 'Rye bread', calories: 259, protein: 8, carbs: 48, fats: 3.3, unit: 'grams' },
    { id: 'sourdough_bread', name: 'Sourdough bread', calories: 290, protein: 9, carbs: 54, fats: 1.5, unit: 'grams' },
    { id: 'bagel', name: 'Bagel', calories: 245, protein: 9, carbs: 48, fats: 1.5, unit: 'grams' },
    { id: 'cereal_granola', name: 'Granola cereal', calories: 471, protein: 12, carbs: 63, fats: 20, unit: 'grams' },
    { id: 'bran_cereal', name: 'Bran cereal', calories: 354, protein: 7, carbs: 81, fats: 1.4, unit: 'grams' },
    { id: 'muesli', name: 'Muesli', calories: 363, protein: 10, carbs: 64, fats: 8, unit: 'grams' },
    { id: 'corn_flakes', name: 'Corn flakes', calories: 381, protein: 7, carbs: 85, fats: 0.9, unit: 'grams' },
    { id: 'couscous_cooked', name: 'Couscous (cooked)', calories: 112, protein: 3.8, carbs: 23, fats: 0.1, unit: 'grams' },
    { id: 'whole_wheat_pasta', name: 'Whole wheat pasta (cooked)', calories: 124, protein: 5.3, carbs: 26, fats: 0.5, unit: 'grams' },
    { id: 'noodles_ramen', name: 'Ramen noodles (cooked)', calories: 138, protein: 4.5, carbs: 25, fats: 4.3, unit: 'grams' },
    { id: 'barley_cooked', name: 'Barley (cooked)', calories: 95, protein: 2.3, carbs: 22, fats: 0.4, unit: 'grams' },
    { id: 'millet_cooked', name: 'Millet (cooked)', calories: 119, protein: 3.5, carbs: 23, fats: 1, unit: 'grams' },
    { id: 'buckwheat_cooked', name: 'Buckwheat (cooked)', calories: 92, protein: 3.4, carbs: 20, fats: 0.6, unit: 'grams' },
    // Vegetables
    { id: 'broccoli_raw', name: 'Broccoli (raw)', calories: 34, protein: 2.8, carbs: 7, fats: 0.4, unit: 'grams' },
    { id: 'carrot_raw', name: 'Carrot (raw)', calories: 41, protein: 0.9, carbs: 10, fats: 0.2, unit: 'grams' },
    { id: 'spinach_raw', name: 'Spinach (raw)', calories: 23, protein: 2.7, carbs: 3.6, fats: 0.4, unit: 'grams' },
    { id: 'kale_raw', name: 'Kale (raw)', calories: 49, protein: 4.3, carbs: 9, fats: 0.9, unit: 'grams' },
    { id: 'lettuce_raw', name: 'Lettuce (raw)', calories: 15, protein: 1.2, carbs: 2.9, fats: 0.2, unit: 'grams' },
    { id: 'bell_pepper', name: 'Bell pepper (red)', calories: 31, protein: 1, carbs: 6, fats: 0.3, unit: 'grams' },
    { id: 'cucumber', name: 'Cucumber (raw)', calories: 16, protein: 0.7, carbs: 3.6, fats: 0.1, unit: 'grams' },
    { id: 'tomato_raw', name: 'Tomato (raw)', calories: 18, protein: 0.9, carbs: 3.9, fats: 0.2, unit: 'grams' },
    { id: 'onion_raw', name: 'Onion (raw)', calories: 40, protein: 1.1, carbs: 9, fats: 0.1, unit: 'grams' },
    { id: 'garlic_raw', name: 'Garlic (raw)', calories: 149, protein: 6.4, carbs: 33, fats: 0.5, unit: 'grams' },
    { id: 'zucchini', name: 'Zucchini (raw)', calories: 21, protein: 1.5, carbs: 3.5, fats: 0.4, unit: 'grams' },
    { id: 'eggplant_raw', name: 'Eggplant (raw)', calories: 25, protein: 0.98, carbs: 5.9, fats: 0.2, unit: 'grams' },
    { id: 'asparagus_raw', name: 'Asparagus (raw)', calories: 27, protein: 3, carbs: 5, fats: 0.1, unit: 'grams' },
    { id: 'peas_cooked', name: 'Peas (cooked)', calories: 81, protein: 5.4, carbs: 14, fats: 0.4, unit: 'grams' },
    { id: 'corn_cooked', name: 'Corn (cooked)', calories: 96, protein: 3.4, carbs: 21, fats: 1.5, unit: 'grams' },
    { id: 'green_beans', name: 'Green beans (raw)', calories: 31, protein: 1.8, carbs: 7, fats: 0.2, unit: 'grams' },
    { id: 'cauliflower_raw', name: 'Cauliflower (raw)', calories: 25, protein: 1.9, carbs: 5, fats: 0.3, unit: 'grams' },
    { id: 'mushroom_raw', name: 'Mushroom (raw)', calories: 22, protein: 3.1, carbs: 3.3, fats: 0.3, unit: 'grams' },
    { id: 'cabbage_raw', name: 'Cabbage (raw)', calories: 25, protein: 1.3, carbs: 5.8, fats: 0.1, unit: 'grams' },
    { id: 'brussels_sprouts', name: 'Brussels sprouts (raw)', calories: 43, protein: 3.4, carbs: 8, fats: 0.3, unit: 'grams' },
    { id: 'artichoke', name: 'Artichoke (raw)', calories: 47, protein: 3.3, carbs: 10, fats: 0.1, unit: 'grams' },
    { id: 'beet_raw', name: 'Beet (raw)', calories: 43, protein: 1.6, carbs: 10, fats: 0.2, unit: 'grams' },
    { id: 'radish_raw', name: 'Radish (raw)', calories: 16, protein: 0.7, carbs: 3.4, fats: 0.1, unit: 'grams' },
    // Fruits
    { id: 'apple', name: 'Apple (medium)', calories: 52, protein: 0.3, carbs: 14, fats: 0.2, unit: 'grams' },
    { id: 'banana', name: 'Banana (medium)', calories: 89, protein: 1.1, carbs: 23, fats: 0.3, unit: 'grams' },
    { id: 'orange', name: 'Orange (medium)', calories: 47, protein: 0.9, carbs: 12, fats: 0.3, unit: 'grams' },
    { id: 'blueberries', name: 'Blueberries', calories: 57, protein: 0.7, carbs: 14, fats: 0.3, unit: 'grams' },
    { id: 'strawberries', name: 'Strawberries', calories: 32, protein: 0.8, carbs: 8, fats: 0.3, unit: 'grams' },
    { id: 'grapes', name: 'Grapes (red)', calories: 67, protein: 0.6, carbs: 17, fats: 0.2, unit: 'grams' },
    { id: 'watermelon', name: 'Watermelon', calories: 30, protein: 0.6, carbs: 8, fats: 0.2, unit: 'grams' },
    { id: 'mango', name: 'Mango (raw)', calories: 60, protein: 0.8, carbs: 15, fats: 0.4, unit: 'grams' },
    { id: 'pineapple', name: 'Pineapple (raw)', calories: 50, protein: 0.5, carbs: 13, fats: 0.1, unit: 'grams' },
    { id: 'kiwi', name: 'Kiwi (fruits)', calories: 61, protein: 1.1, carbs: 15, fats: 0.5, unit: 'grams' },
    { id: 'pear', name: 'Pear (medium)', calories: 57, protein: 0.4, carbs: 15, fats: 0.1, unit: 'grams' },
    { id: 'peach', name: 'Peach (medium)', calories: 39, protein: 0.9, carbs: 10, fats: 0.3, unit: 'grams' },
    { id: 'plum', name: 'Plum (medium)', calories: 30, protein: 0.5, carbs: 7, fats: 0.2, unit: 'grams' },
    { id: 'papaya', name: 'Papaya (raw)', calories: 43, protein: 0.5, carbs: 11, fats: 0.3, unit: 'grams' },
    { id: 'coconut_meat', name: 'Coconut meat (dried)', calories: 660, protein: 7.3, carbs: 24, fats: 64, unit: 'grams' },
    { id: 'date', name: 'Date (dried)', calories: 282, protein: 2.5, carbs: 75, fats: 0.15, unit: 'grams' },
    { id: 'raisin', name: 'Raisins', calories: 299, protein: 3.1, carbs: 79, fats: 0.5, unit: 'grams' },
    { id: 'fig_dried', name: 'Figs (dried)', calories: 249, protein: 3.3, carbs: 64, fats: 0.9, unit: 'grams' },
    { id: 'avocado', name: 'Avocado (raw)', calories: 160, protein: 2, carbs: 9, fats: 15, unit: 'grams' },
    { id: 'lemon', name: 'Lemon (raw)', calories: 29, protein: 1.1, carbs: 9, fats: 0.3, unit: 'grams' },
    { id: 'lime', name: 'Lime (raw)', calories: 30, protein: 0.7, carbs: 11, fats: 0.2, unit: 'grams' },
    // Legumes & Pulses
    { id: 'lentils_cooked', name: 'Lentils (cooked)', calories: 116, protein: 9, carbs: 20, fats: 0.4, unit: 'grams' },
    { id: 'beans_black_cooked', name: 'Black beans (cooked)', calories: 132, protein: 8.9, carbs: 24, fats: 0.5, unit: 'grams' },
    { id: 'beans_kidney_cooked', name: 'Kidney beans (cooked)', calories: 127, protein: 8.7, carbs: 23, fats: 0.4, unit: 'grams' },
    { id: 'peas_dry_cooked', name: 'Split peas (cooked)', calories: 118, protein: 8.2, carbs: 21, fats: 0.4, unit: 'grams' },
    { id: 'chickpeas_cooked', name: 'Chickpeas (cooked)', calories: 134, protein: 7.2, carbs: 23, fats: 2.1, unit: 'grams' },
    { id: 'peanuts', name: 'Peanuts (dry roasted)', calories: 567, protein: 26, carbs: 20, fats: 49, unit: 'grams' },
    { id: 'peanut_butter', name: 'Peanut butter', calories: 94, protein: 4, carbs: 3.5, fats: 8, unit: 'tablespoon' }
  ],
  proteins: [
    // Poultry
    { id: 'chicken_breast_cooked_skinless', name: 'Chicken breast (cooked, skinless)', calories: 165, protein: 31, carbs: 0, fats: 3.6, unit: 'grams' },
    { id: 'chicken_thigh_cooked', name: 'Chicken thigh (cooked, skinless)', calories: 209, protein: 26, carbs: 0, fats: 11, unit: 'grams' },
    { id: 'turkey_breast_cooked', name: 'Turkey breast (cooked)', calories: 189, protein: 29, carbs: 0, fats: 7.4, unit: 'grams' },
    { id: 'duck_cooked', name: 'Duck (cooked)', calories: 337, protein: 19, carbs: 0, fats: 29, unit: 'grams' },
    { id: 'chicken_ground_cooked', name: 'Ground chicken (cooked)', calories: 165, protein: 23, carbs: 0, fats: 7.4, unit: 'grams' },
    { id: 'turkey_ground_cooked', name: 'Ground turkey (cooked)', calories: 200, protein: 29, carbs: 0, fats: 8.7, unit: 'grams' },
    // Beef
    { id: 'ground_beef_85_lean', name: 'Ground beef (85% lean)', calories: 217, protein: 23, carbs: 0, fats: 13, unit: 'grams' },
    { id: 'ground_beef_93_lean', name: 'Ground beef (93% lean)', calories: 174, protein: 24, carbs: 0, fats: 8, unit: 'grams' },
    { id: 'beef_sirloin_lean', name: 'Beef sirloin (lean)', calories: 180, protein: 27, carbs: 0, fats: 8, unit: 'grams' },
    { id: 'beef_rib_eye', name: 'Beef rib eye', calories: 291, protein: 24, carbs: 0, fats: 23, unit: 'grams' },
    { id: 'beef_chuck_roast', name: 'Beef chuck roast', calories: 288, protein: 24, carbs: 0, fats: 21, unit: 'grams' },
    { id: 'beef_stew_meat', name: 'Beef stew meat (cooked)', calories: 198, protein: 32, carbs: 0, fats: 8, unit: 'grams' },
    { id: 'lean_ground_beef', name: 'Lean ground beef (90%)', calories: 176, protein: 24, carbs: 0, fats: 8, unit: 'grams' },
    // Fish & Seafood
    { id: 'salmon_atlantic', name: 'Salmon (Atlantic)', calories: 208, protein: 20, carbs: 0, fats: 13, unit: 'grams' },
    { id: 'salmon_wild', name: 'Salmon (wild)', calories: 182, protein: 25, carbs: 0, fats: 8.1, unit: 'grams' },
    { id: 'tuna_canned_water', name: 'Tuna (canned, water)', calories: 116, protein: 26, carbs: 0, fats: 1, unit: 'grams' },
    { id: 'tuna_fresh_cooked', name: 'Tuna (fresh, cooked)', calories: 144, protein: 29, carbs: 0, fats: 1.3, unit: 'grams' },
    { id: 'cod_cooked', name: 'Cod (cooked)', calories: 82, protein: 18, carbs: 0, fats: 0.7, unit: 'grams' },
    { id: 'tilapia_cooked', name: 'Tilapia (cooked)', calories: 128, protein: 26, carbs: 0, fats: 2.7, unit: 'grams' },
    { id: 'halibut_cooked', name: 'Halibut (cooked)', calories: 111, protein: 21, carbs: 0, fats: 2.3, unit: 'grams' },
    { id: 'mackerel_cooked', name: 'Mackerel (cooked)', calories: 305, protein: 21, carbs: 0, fats: 25, unit: 'grams' },
    { id: 'sardines_canned', name: 'Sardines (canned, oil)', calories: 208, protein: 20, carbs: 0, fats: 13, unit: 'grams' },
    { id: 'trout_cooked', name: 'Trout (cooked)', calories: 148, protein: 21, carbs: 0, fats: 7, unit: 'grams' },
    { id: 'shrimp_cooked', name: 'Shrimp (cooked)', calories: 99, protein: 24, carbs: 0, fats: 0.3, unit: 'grams' },
    { id: 'crab_cooked', name: 'Crab (cooked)', calories: 102, protein: 20, carbs: 0, fats: 2, unit: 'grams' },
    { id: 'lobster_cooked', name: 'Lobster (cooked)', calories: 90, protein: 19, carbs: 1.3, fats: 0.9, unit: 'grams' },
    { id: 'oysters_cooked', name: 'Oysters (cooked)', calories: 81, protein: 9.4, carbs: 7, fats: 2.2, unit: 'grams' },
    // Eggs (per 1 whole/unit)
    { id: 'whole_egg', name: 'Whole egg', calories: 78, protein: 6.5, carbs: 0.6, fats: 5.5, unit: 'whole' },
    { id: 'egg_white', name: 'Egg white', calories: 17, protein: 3.6, carbs: 0.2, fats: 0.2, unit: 'whole' },
    { id: 'egg_yolk', name: 'Egg yolk', calories: 55, protein: 2.7, carbs: 0.3, fats: 5.1, unit: 'whole' },
    // Dairy
    { id: 'greek_yogurt_nonfat', name: 'Greek yogurt (nonfat)', calories: 59, protein: 10, carbs: 4, fats: 0.4, unit: 'grams' },
    { id: 'greek_yogurt_full_fat', name: 'Greek yogurt (full-fat)', calories: 100, protein: 10, carbs: 4, fats: 5, unit: 'grams' },
    { id: 'cottage_cheese_low_fat', name: 'Cottage cheese (low-fat)', calories: 98, protein: 11, carbs: 3.4, fats: 4.3, unit: 'grams' },
    { id: 'milk_2percent', name: 'Milk (2%)', calories: 49, protein: 3.3, carbs: 4.8, fats: 1.9, unit: 'grams' },
    { id: 'milk_skim', name: 'Milk (skim)', calories: 34, protein: 3.4, carbs: 4.8, fats: 0.1, unit: 'grams' },
    { id: 'milk_whole', name: 'Milk (whole)', calories: 60, protein: 3.2, carbs: 4.8, fats: 3.2, unit: 'grams' },
    { id: 'kefir', name: 'Kefir (plain)', calories: 60, protein: 3.4, carbs: 4, fats: 3.5, unit: 'grams' },
    { id: 'cheese_cheddar', name: 'Cheese (cheddar)', calories: 403, protein: 23, carbs: 1.3, fats: 33, unit: 'grams' },
    { id: 'cheese_mozzarella', name: 'Cheese (mozzarella)', calories: 280, protein: 28, carbs: 3.1, fats: 17, unit: 'grams' },
    { id: 'cheese_feta', name: 'Cheese (feta)', calories: 264, protein: 14, carbs: 4.1, fats: 21, unit: 'grams' },
    { id: 'cheese_parmesan', name: 'Cheese (parmesan)', calories: 392, protein: 38, carbs: 4.1, fats: 29, unit: 'grams' },
    // Plant-Based Proteins
    { id: 'tofu_firm', name: 'Tofu (firm)', calories: 144, protein: 17, carbs: 3, fats: 9, unit: 'grams' },
    { id: 'tofu_silken', name: 'Tofu (silken)', calories: 61, protein: 6.6, carbs: 1.6, fats: 3.5, unit: 'grams' },
    { id: 'tempeh', name: 'Tempeh (fermented)', calories: 192, protein: 19, carbs: 9, fats: 11, unit: 'grams' },
    { id: 'edamame', name: 'Edamame (cooked)', calories: 111, protein: 11.1, carbs: 10, fats: 5, unit: 'grams' },
    { id: 'hemp_seeds', name: 'Hemp seeds', calories: 560, protein: 31, carbs: 12, fats: 48, unit: 'grams' },
    { id: 'chia_seeds', name: 'Chia seeds', calories: 60, protein: 2.1, carbs: 5, fats: 3.8, unit: 'tablespoon' },
    { id: 'seitan', name: 'Seitan (wheat gluten)', calories: 370, protein: 25, carbs: 14, fats: 5, unit: 'grams' },
    { id: 'textured_vegetable_protein', name: 'Textured vegetable protein (TVP)', calories: 275, protein: 50, carbs: 18, fats: 1.3, unit: 'grams' },
    // Processed Meats
    { id: 'turkey_deli_meat', name: 'Turkey deli meat', calories: 207, protein: 25, carbs: 1.4, fats: 11, unit: 'grams' },
    { id: 'chicken_deli_meat', name: 'Chicken deli meat', calories: 180, protein: 23, carbs: 0, fats: 9.3, unit: 'grams' },
    { id: 'bacon_cooked', name: 'Bacon (cooked)', calories: 541, protein: 37, carbs: 0.1, fats: 43, unit: 'grams' },
    { id: 'sausage_pork', name: 'Pork sausage (cooked)', calories: 301, protein: 27, carbs: 1.5, fats: 23, unit: 'grams' },
    // Nuts & Seeds (High in both protein and healthy fats)
    { id: 'almonds', name: 'Almonds', calories: 579, protein: 21, carbs: 22, fats: 50, unit: 'grams' },
    { id: 'walnuts', name: 'Walnuts', calories: 654, protein: 15, carbs: 14, fats: 65, unit: 'grams' },
    { id: 'cashews', name: 'Cashews', calories: 553, protein: 18, carbs: 30, fats: 44, unit: 'grams' },
    { id: 'pistachios', name: 'Pistachios', calories: 560, protein: 20, carbs: 28, fats: 45, unit: 'grams' },
    { id: 'sunflower_seeds', name: 'Sunflower seeds', calories: 70, protein: 2.9, carbs: 2.6, fats: 6.1, unit: 'tablespoon' },
    { id: 'pumpkin_seeds', name: 'Pumpkin seeds', calories: 67, protein: 3, carbs: 1.3, fats: 5.9, unit: 'tablespoon' },
    { id: 'flax_seeds', name: 'Flax seeds', calories: 64, protein: 2.1, carbs: 3.4, fats: 5, unit: 'tablespoon' },
    { id: 'peanut_butter', name: 'Peanut butter', calories: 94, protein: 4, carbs: 3.5, fats: 8, unit: 'tablespoon' }
  ]
};

const nutritionBuilderState = {
  mode: 'manual',
  items: [],
  totals: { calories: 0, protein: 0, carbs: 0, fats: 0 }
};

function todayDateKey() {
  if (typeof toLocalDateKey === 'function') {
    return toLocalDateKey(new Date());
  }
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatDisplayDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}

function normalizeMealType(mealType) {
  const key = String(mealType || 'other').toLowerCase();
  const map = {
    breakfast: 'Breakfast',
    lunch: 'Lunch',
    dinner: 'Dinner',
    snack: 'Snack',
    other: 'Other'
  };
  return map[key] || 'Other';
}

function parseMacro(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function nutritionRound(value) {
  return Math.round((Number(value) || 0) * 10) / 10;
}

function nutritionBuilderFindFood(category, foodId) {
  const foods = nutritionFoodDatabase[category] || [];
  return foods.find(food => food.id === foodId) || null;
}

function nutritionBuildItemFromFood(food, category, quantity) {
  let ratio = 1;
  let displayQuantity = quantity;
  
  // Convert based on unit type
  if (food.unit === 'whole') {
    // For whole units (like eggs), quantity is already in units
    ratio = quantity;
    displayQuantity = quantity;
  } else if (food.unit === 'tablespoon') {
    // For tablespoons, convert to relative units (1 tbsp ≈ 15g)
    ratio = (quantity * 15) / 100;
    displayQuantity = quantity;
  } else {
    // For grams (default)
    ratio = Math.max(0, Number(quantity) || 0) / 100;
    displayQuantity = quantity;
  }
  
  return {
    id: `${food.id}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    foodId: food.id,
    category,
    name: food.name,
    unit: food.unit || 'grams',
    displayQuantity: Math.max(0, Number(displayQuantity) || 0),
    grams: food.unit === 'whole' ? (quantity * 50) : (food.unit === 'tablespoon' ? (quantity * 15) : displayQuantity),
    calories: nutritionRound(food.calories * ratio),
    protein: nutritionRound(food.protein * ratio),
    carbs: nutritionRound(food.carbs * ratio),
    fats: nutritionRound(food.fats * ratio)
  };
}

function nutritionCalculateBuilderTotals() {
  const totals = nutritionBuilderState.items.reduce((acc, item) => ({
    calories: acc.calories + parseMacro(item.calories),
    protein: acc.protein + parseMacro(item.protein),
    carbs: acc.carbs + parseMacro(item.carbs),
    fats: acc.fats + parseMacro(item.fats)
  }), { calories: 0, protein: 0, carbs: 0, fats: 0 });

  nutritionBuilderState.totals = {
    calories: nutritionRound(totals.calories),
    protein: nutritionRound(totals.protein),
    carbs: nutritionRound(totals.carbs),
    fats: nutritionRound(totals.fats)
  };
}

function nutritionPopulateFoodOptions() {
  const categoryEl = document.getElementById('nutrition-builder-category');
  const foodEl = document.getElementById('nutrition-builder-food');
  if (!categoryEl || !foodEl) return;

  const category = categoryEl.value || 'carbohydrates';
  const foods = nutritionFoodDatabase[category] || [];
  foodEl.innerHTML = foods.map((food) => `<option value="${food.id}">${escapeHtml(food.name)}</option>`).join('');
  
  // Update quantity label and input for first food
  nutritionUpdateQuantityLabel();
}

function nutritionUpdateQuantityLabel() {
  const categoryEl = document.getElementById('nutrition-builder-category');
  const foodEl = document.getElementById('nutrition-builder-food');
  const gramsEl = document.getElementById('nutrition-builder-grams');
  const labelEl = document.getElementById('nutrition-builder-qty-label');
  
  if (!categoryEl || !foodEl || !gramsEl || !labelEl) return;

  const category = categoryEl.value || 'carbohydrates';
  const food = nutritionBuilderFindFood(category, foodEl.value);
  
  if (!food) return;

  const unit = food.unit || 'grams';
  let label = 'Quantity (g)';
  let step = '50';
  let placeholder = '100';
  let defaultValue = '100';

  if (unit === 'whole') {
    label = 'Quantity (whole)';
    step = '1';
    placeholder = '1';
    defaultValue = '1';
  } else if (unit === 'tablespoon') {
    label = 'Quantity (tbsp)';
    step = '0.5';
    placeholder = '1';
    defaultValue = '1';
  }

  labelEl.textContent = label;
  gramsEl.step = step;
  gramsEl.placeholder = placeholder;
  gramsEl.value = defaultValue;
  gramsEl.min = unit === 'grams' ? '50' : '1';
}

function nutritionUpdateBuilderMacroInputs() {
  const calEl = document.getElementById('nutrition-form-calories');
  const proEl = document.getElementById('nutrition-form-protein');
  const carbEl = document.getElementById('nutrition-form-carbs');
  const fatEl = document.getElementById('nutrition-form-fats');

  if (calEl) calEl.value = String(nutritionBuilderState.totals.calories);
  if (proEl) proEl.value = String(nutritionBuilderState.totals.protein);
  if (carbEl) carbEl.value = String(nutritionBuilderState.totals.carbs);
  if (fatEl) fatEl.value = String(nutritionBuilderState.totals.fats);
}

function nutritionBuilderSummaryName() {
  if (!nutritionBuilderState.items.length) return '';
  return nutritionBuilderState.items
    .map(item => {
      let quantityStr = `${Math.round(item.grams)}g`;
      if (item.unit === 'whole') {
        quantityStr = `${item.displayQuantity} whole`;
      } else if (item.unit === 'tablespoon') {
        quantityStr = `${item.displayQuantity} tbsp`;
      }
      return `${item.name} (${quantityStr})`;
    })
    .join(', ');
}

function renderNutritionBuilderList() {
  const listEl = document.getElementById('nutrition-builder-list');
  const totalsEl = document.getElementById('nutrition-builder-totals');
  if (!listEl || !totalsEl) return;

  if (nutritionBuilderState.items.length === 0) {
    listEl.innerHTML = '<div class="nutrition-empty" style="margin-top: 10px;">No foods added yet.</div>';
    totalsEl.innerHTML = '';
    nutritionCalculateBuilderTotals();
    nutritionUpdateBuilderMacroInputs();
    return;
  }

  listEl.innerHTML = nutritionBuilderState.items.map((item) => {
    let quantityDisplay = `${Math.round(item.grams)}g`;
    if (item.unit === 'whole') {
      quantityDisplay = `${item.displayQuantity} ${item.displayQuantity === 1 ? 'whole' : 'wholes'}`;
    } else if (item.unit === 'tablespoon') {
      quantityDisplay = `${item.displayQuantity} tbsp`;
    }
    
    return `
    <div class="nutrition-builder-item">
      <div>
        <strong>${escapeHtml(item.name)}</strong>
        <small>${item.category === 'carbohydrates' ? 'Carbohydrates' : 'Proteins'}</small>
      </div>
      <div><small>${quantityDisplay}</small></div>
      <div class="nutrition-builder-item-macros">
        <span>${nutritionRound(item.calories)} cal</span>
        <span>P ${nutritionRound(item.protein)}g</span>
        <span>C ${nutritionRound(item.carbs)}g</span>
        <span>F ${nutritionRound(item.fats)}g</span>
      </div>
      <button type="button" class="nutrition-builder-remove" data-builder-remove-id="${item.id}">Remove</button>
    </div>
  `}).join('');

  nutritionCalculateBuilderTotals();
  nutritionUpdateBuilderMacroInputs();
  totalsEl.innerHTML = `
    <div><span>Calories</span><strong>${nutritionBuilderState.totals.calories}</strong></div>
    <div><span>Protein</span><strong>${nutritionBuilderState.totals.protein}g</strong></div>
    <div><span>Carbs</span><strong>${nutritionBuilderState.totals.carbs}g</strong></div>
    <div><span>Fats</span><strong>${nutritionBuilderState.totals.fats}g</strong></div>
  `;
}

function clearNutritionBuilderState() {
  nutritionBuilderState.items = [];
  nutritionCalculateBuilderTotals();
  nutritionUpdateBuilderMacroInputs();
  renderNutritionBuilderList();
}

function nutritionSetMode(modeValue) {
  const mode = modeValue === 'builder' ? 'builder' : 'manual';
  nutritionBuilderState.mode = mode;

  const manualSection = document.getElementById('nutrition-manual-fields');
  const builderSection = document.getElementById('nutrition-builder-fields');
  const caloriesEl = document.getElementById('nutrition-form-calories');
  const proteinEl = document.getElementById('nutrition-form-protein');
  const carbsEl = document.getElementById('nutrition-form-carbs');
  const fatsEl = document.getElementById('nutrition-form-fats');

  if (manualSection) manualSection.classList.toggle('nutrition-collapsed', mode !== 'manual');
  if (builderSection) builderSection.classList.toggle('nutrition-collapsed', mode !== 'builder');

  const manualRequired = mode === 'manual';
  [caloriesEl, proteinEl, carbsEl, fatsEl].forEach((el) => {
    if (!el) return;
    if (manualRequired) {
      el.setAttribute('required', 'required');
      el.readOnly = false;
    } else {
      el.removeAttribute('required');
      el.readOnly = true;
    }
  });

  if (mode === 'builder') {
    nutritionPopulateFoodOptions();
    renderNutritionBuilderList();
  }
}

function addNutritionBuilderItem() {
  const categoryEl = document.getElementById('nutrition-builder-category');
  const foodEl = document.getElementById('nutrition-builder-food');
  const gramsEl = document.getElementById('nutrition-builder-grams');
  if (!categoryEl || !foodEl || !gramsEl) return;

  const category = categoryEl.value || 'carbohydrates';
  const food = nutritionBuilderFindFood(category, foodEl.value);
  if (!food) return;

  let quantity = Math.max(1, parseMacro(gramsEl.value));
  
  // Apply rounding based on unit type
  if (food.unit === 'grams' || !food.unit) {
    // Round to nearest 50g for grams
    quantity = Math.round(quantity / 50) * 50;
    if (quantity === 0) quantity = 50;
  } else if (food.unit === 'whole') {
    // Round to whole number
    quantity = Math.max(1, Math.round(quantity));
  } else if (food.unit === 'tablespoon') {
    // Round to nearest 0.5
    quantity = Math.round(quantity * 2) / 2;
  }

  nutritionBuilderState.items.push(nutritionBuildItemFromFood(food, category, quantity));
  renderNutritionBuilderList();
}

function getGoalAdjustedCalories() {
  const dynamic = Number(profileState?.targetCalories);
  if (Number.isFinite(dynamic) && dynamic > 0) return dynamic;
  return nutritionState.baseGoals.calories;
}

function getWeekStartDate(currentDate) {
  const d = new Date(currentDate);
  const day = d.getDay();
  const diff = d.getDate() - day;
  return new Date(d.setDate(diff));
}

function persistSavedMeals() {
  localStorage.setItem(nutritionSavedMealsStorageKey(), JSON.stringify(nutritionState.savedMeals));
}

function loadSavedMeals() {
  nutritionState.savedMeals = [];
  try {
    const raw = localStorage.getItem(nutritionSavedMealsStorageKey());
    if (!raw) {
      if (activeDemoUserId) {
        const seeded = deepClone((DEMO_USER_DUMMY_DATA[activeDemoUserId] && DEMO_USER_DUMMY_DATA[activeDemoUserId].savedMeals) || []);
        if (seeded.length) {
          nutritionState.savedMeals = seeded;
          persistSavedMeals();
        }
      }
      return;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      nutritionState.savedMeals = parsed
        .filter(m => m && typeof m === 'object')
        .map((m) => ({
          ...m,
          meal_type: m.meal_type || m.meal || 'other',
          calories: Math.max(0, Number(m.calories) || 0),
          protein: Math.max(0, Number(m.protein) || 0),
          carbs: Math.max(0, Number(m.carbs) || 0),
          fats: Math.max(0, Number(m.fats) || 0)
        }));
      if (activeDemoUserId) {
        const seeded = deepClone((DEMO_USER_DUMMY_DATA[activeDemoUserId] && DEMO_USER_DUMMY_DATA[activeDemoUserId].savedMeals) || []);
        if (seeded.length) {
          const existingIds = new Set(nutritionState.savedMeals.map((m) => String(m.id)));
          seeded.forEach((meal) => {
            if (!existingIds.has(String(meal.id))) nutritionState.savedMeals.push(meal);
          });
        }
      }
      persistSavedMeals();
      if (activeDemoUserId && nutritionState.savedMeals.length === 0) {
        const seeded = deepClone((DEMO_USER_DUMMY_DATA[activeDemoUserId] && DEMO_USER_DUMMY_DATA[activeDemoUserId].savedMeals) || []);
        if (seeded.length) {
          nutritionState.savedMeals = seeded;
          persistSavedMeals();
        }
      }
    }
  } catch (_err) {
    nutritionState.savedMeals = [];
  }
}

function mealDateKey(entry) {
  const raw = String(entry?.date || '').trim();
  if (!raw) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  if (raw.includes('T')) return raw.split('T')[0];
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return '';
  if (typeof toLocalDateKey === 'function') return toLocalDateKey(parsed);
  const y = parsed.getFullYear();
  const m = String(parsed.getMonth() + 1).padStart(2, '0');
  const d = String(parsed.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function renderNutritionGoals() {
  const goalCalories = getGoalAdjustedCalories();
  const titleEl = document.getElementById('nutrition-goal-title');
  const modeEl = document.getElementById('nutrition-goal-mode-label');
  if (titleEl) {
    if (nutritionState.weightGoal === 'loss') {
      titleEl.textContent = 'Calorie Deficit for Weight Loss';
    } else if (nutritionState.weightGoal === 'gain') {
      titleEl.textContent = 'Calorie Surplus for Weight Gain';
    } else {
      titleEl.textContent = 'Balanced Nutrition for Maintenance';
    }
  }
  if (modeEl) {
    modeEl.textContent = nutritionState.weightGoal === 'loss'
      ? 'Weight Loss'
      : nutritionState.weightGoal === 'gain'
        ? 'Weight Gain'
        : 'Weight Stability';
  }

  const caloriesEl = document.getElementById('nutrition-goal-calories');
  const proteinEl = document.getElementById('nutrition-goal-protein');
  const carbsEl = document.getElementById('nutrition-goal-carbs');
  const fatsEl = document.getElementById('nutrition-goal-fats');
  if (caloriesEl) caloriesEl.textContent = String(goalCalories);
  if (proteinEl) proteinEl.textContent = `${nutritionState.baseGoals.protein}g`;
  if (carbsEl) carbsEl.textContent = `${nutritionState.baseGoals.carbs}g`;
  if (fatsEl) fatsEl.textContent = `${nutritionState.baseGoals.fats}g`;

}

function renderNutritionToday() {
  const today = todayDateKey();
  const todayEntries = nutritionState.entries.filter(e => mealDateKey(e) === today);
  const totals = todayEntries.reduce((acc, e) => ({
    calories: acc.calories + parseMacro(e.calories),
    protein: acc.protein + parseMacro(e.protein),
    carbs: acc.carbs + parseMacro(e.carbs),
    fats: acc.fats + parseMacro(e.fats)
  }), { calories: 0, protein: 0, carbs: 0, fats: 0 });

  const dateEl = document.getElementById('nutrition-today-date');
  if (dateEl) dateEl.textContent = formatDisplayDate(today);
  const calEl = document.getElementById('nutrition-today-calories');
  const proEl = document.getElementById('nutrition-today-protein');
  const carbEl = document.getElementById('nutrition-today-carbs');
  const fatEl = document.getElementById('nutrition-today-fats');
  if (calEl) calEl.textContent = String(Math.round(totals.calories));
  if (proEl) proEl.textContent = `${Math.round(totals.protein)}g`;
  if (carbEl) carbEl.textContent = `${Math.round(totals.carbs)}g`;
  if (fatEl) fatEl.textContent = `${Math.round(totals.fats)}g`;

  const targetCalories = Math.max(0, Number(getGoalAdjustedCalories()) || 0);
  const consumedCalories = Math.max(0, Math.round(totals.calories));
  const calorieProgress = targetCalories > 0 ? Math.max(0, Math.min(100, Math.round((consumedCalories / targetCalories) * 100))) : 0;
  const proteinProgress = nutritionState.baseGoals.protein > 0
    ? Math.max(0, Math.min(100, Math.round((Math.max(0, totals.protein) / nutritionState.baseGoals.protein) * 100)))
    : 0;
  const carbsProgress = nutritionState.baseGoals.carbs > 0
    ? Math.max(0, Math.min(100, Math.round((Math.max(0, totals.carbs) / nutritionState.baseGoals.carbs) * 100)))
    : 0;
  const fatsProgress = nutritionState.baseGoals.fats > 0
    ? Math.max(0, Math.min(100, Math.round((Math.max(0, totals.fats) / nutritionState.baseGoals.fats) * 100)))
    : 0;

  const calorieFillEl = document.getElementById('nutrition-calorie-progress-fill');
  const proteinFillEl = document.getElementById('nutrition-protein-progress-fill');
  const carbsFillEl = document.getElementById('nutrition-carbs-progress-fill');
  const fatsFillEl = document.getElementById('nutrition-fats-progress-fill');

  if (calorieFillEl) calorieFillEl.style.width = `${calorieProgress}%`;
  if (proteinFillEl) proteinFillEl.style.width = `${proteinProgress}%`;
  if (carbsFillEl) carbsFillEl.style.width = `${carbsProgress}%`;
  if (fatsFillEl) fatsFillEl.style.width = `${fatsProgress}%`;
}

function renderNutritionWeek() {
  const today = new Date(todayDateKey());
  const weekStart = getWeekStartDate(today);
  const thisWeekEntries = nutritionState.entries.filter((e) => {
    const key = mealDateKey(e);
    if (!key) return false;
    const parsed = new Date(`${key}T00:00:00`);
    return !Number.isNaN(parsed.getTime()) && parsed >= weekStart;
  });
  const thisWeekTotals = thisWeekEntries.reduce((acc, e) => ({
    calories: acc.calories + parseMacro(e.calories),
    protein: acc.protein + parseMacro(e.protein),
    carbs: acc.carbs + parseMacro(e.carbs),
    fats: acc.fats + parseMacro(e.fats)
  }), { calories: 0, protein: 0, carbs: 0, fats: 0 });

  const days = new Set(thisWeekEntries.map(mealDateKey).filter(Boolean)).size;
  const avgCalories = days > 0 ? Math.round(thisWeekTotals.calories / days) : 0;
  const goalCalories = getGoalAdjustedCalories();
  const weeklyGoalCalories = goalCalories * 7;
  const weeklyDiff = Math.round(thisWeekTotals.calories - weeklyGoalCalories);

  const onTrack = nutritionState.weightGoal === 'loss'
    ? weeklyDiff <= 0
    : nutritionState.weightGoal === 'gain'
      ? weeklyDiff >= 0
      : Math.abs(weeklyDiff) <= 500;

  const goalTypeEl = document.getElementById('nutrition-week-goal-type');
  const avgEl = document.getElementById('nutrition-week-avg-cal');
  const targetEl = document.getElementById('nutrition-week-target');
  const diffEl = document.getElementById('nutrition-week-diff');
  const noteEl = document.getElementById('nutrition-week-note');
  const badgeEl = document.getElementById('nutrition-week-track-badge');

  if (goalTypeEl) {
    goalTypeEl.textContent = nutritionState.weightGoal === 'loss'
      ? 'Weight Loss'
      : nutritionState.weightGoal === 'gain'
        ? 'Weight Gain'
        : 'Maintain Weight';
  }

  if (avgEl) avgEl.textContent = `${avgCalories} cal`;
  if (targetEl) targetEl.textContent = `Target: ${goalCalories} cal/day`;
  if (diffEl) diffEl.textContent = `${weeklyDiff > 0 ? '+' : ''}${weeklyDiff} cal`;
  if (noteEl) {
    noteEl.textContent = nutritionState.weightGoal === 'loss'
      ? (weeklyDiff <= 0 ? 'Deficit maintained!' : 'Reduce intake')
      : nutritionState.weightGoal === 'gain'
        ? (weeklyDiff >= 0 ? 'Surplus achieved!' : 'Increase intake')
        : (Math.abs(weeklyDiff) <= 500 ? 'Balanced intake' : 'Adjust intake');
  }

  if (badgeEl) {
    badgeEl.textContent = onTrack ? 'On Track' : 'Adjust Intake';
    badgeEl.classList.toggle('off', !onTrack);
  }
}

function renderSavedMeals() {
  const section = document.getElementById('nutrition-saved-meals-section');
  const grid = document.getElementById('nutrition-saved-meals-grid');
  if (!section || !grid) return;

  section.classList.toggle('nutrition-collapsed', !nutritionState.showSavedMeals);
  if (!nutritionState.showSavedMeals) return;

  if (nutritionState.savedMeals.length === 0) {
    grid.innerHTML = '<div class="nutrition-empty">No saved meals yet. Save a meal from the form.</div>';
    return;
  }

  const orderedTypes = ['breakfast', 'lunch', 'dinner', 'snack'];
  if (!orderedTypes.includes(nutritionState.activeMealType)) {
    nutritionState.activeMealType = 'breakfast';
  }

  const byType = orderedTypes.reduce((acc, type) => {
    acc[type] = nutritionState.savedMeals.filter((m) => {
      const mealType = String(m.meal_type || m.meal || '').toLowerCase();
      return mealType === type;
    });
    return acc;
  }, {});

  const activeType = nutritionState.activeMealType;
  const activeItems = byType[activeType] || [];
  const tabsHtml = orderedTypes.map((type) => {
    const isActive = activeType === type;
    return `
      <button
        class="nutrition-saved-tab ${isActive ? 'is-active' : ''}"
        type="button"
        data-meal-tab="${type}"
        aria-selected="${isActive ? 'true' : 'false'}"
        role="tab"
      >
        ${normalizeMealType(type)}
      </button>
    `;
  }).join('');

  const itemsHtml = activeItems.map((m) => {
    return `
      <div class="nutrition-saved-item">
        <div class="nutrition-saved-head">
          <h4>${escapeHtml(m.name)}</h4>
          <button class="nutrition-delete-saved" data-id="${m.id}" title="Delete saved meal">
            <i class="fas fa-trash-alt"></i>
          </button>
        </div>
        <span class="nutrition-pill">${normalizeMealType(m.meal_type)}</span>
        <div class="nutrition-saved-macros">
          <span class="cal"><i class="fas fa-fire"></i> ${Math.round(m.calories)} cal</span>
          <span class="protein">${Math.round(m.protein)}g protein</span>
          <span class="carbs">${Math.round(m.carbs)}g carbs</span>
          <span class="fats">${Math.round(m.fats)}g fats</span>
        </div>
        <button class="nutrition-use-saved" data-use-id="${m.id}">Use this meal</button>
      </div>
    `;
  }).join('');

  const emptyTypeHtml = `<div class="nutrition-empty">No saved ${normalizeMealType(activeType).toLowerCase()} meals yet.</div>`;
  grid.innerHTML = `
    <div class="nutrition-saved-tabs" role="tablist" aria-label="Saved meal types">
      ${tabsHtml}
    </div>
    <div class="nutrition-saved-content" data-active-meal-content="${activeType}">
      ${itemsHtml || emptyTypeHtml}
    </div>
  `;
}

function renderNutritionHistory() {
  const list = document.getElementById('nutrition-history-list');
  if (!list) return;

  const today = todayDateKey();
  const sorted = nutritionState.entries
    .filter(entry => mealDateKey(entry) === today)
    .sort((a, b) => {
    const ad = `${a.date || ''} ${a.time || ''}`;
    const bd = `${b.date || ''} ${b.time || ''}`;
    return bd.localeCompare(ad);
    });

  if (sorted.length === 0) {
    list.innerHTML = '<div class="nutrition-empty" style="margin-top: 10px;">No meals logged today yet.</div>';
    return;
  }

  list.innerHTML = sorted.map(entry => `
    <div class="nutrition-history-item">
      <div class="nutrition-history-head">
        <span class="nutrition-pill">${normalizeMealType(entry.meal_type)}</span>
        <button class="nutrition-history-delete" data-history-delete-id="${entry.id}" title="Delete meal" aria-label="Delete meal">
          <i class="fas fa-trash-alt"></i>
        </button>
      </div>
      <div class="nutrition-history-food">${escapeHtml(entry.name)}</div>
      <div class="nutrition-history-time">${escapeHtml(entry.time || '--:--')} - ${escapeHtml(entry.date || '')}</div>
      <div class="nutrition-history-macros">
        <span class="cal"><i class="fas fa-fire"></i> ${Math.round(parseMacro(entry.calories))} cal</span>
        <span class="protein">${Math.round(parseMacro(entry.protein))}g protein</span>
        <span class="carbs">${Math.round(parseMacro(entry.carbs))}g carbs</span>
        <span class="fats">${Math.round(parseMacro(entry.fats))}g fats</span>
      </div>
    </div>
  `).join('');
}

async function deleteMealEntry(mealId) {
  const idNum = Number(mealId);
  if (!Number.isFinite(idNum) || idNum <= 0) return;

  try {
    if (activeDemoUserId) {
      const meals = getActiveUserMealsData();
      const nextMeals = meals.filter(m => Number(m.id) !== idNum);
      setActiveUserMealsData(nextMeals);
    } else {
      const response = await fetch(`/api/meals/${idNum}`, { method: 'DELETE' });
      if (!response.ok) throw new Error(`API error: ${response.status}`);
    }
    await loadMeals();
  } catch (err) {
    console.error('Error deleting meal:', err);
    alert('Could not delete meal right now.');
  }
}

function renderNutritionFormVisibility() {
  const formSection = document.getElementById('nutrition-form-section');
  if (!formSection) return;
  formSection.classList.toggle('nutrition-collapsed', !nutritionState.showForm);
}

function renderNutritionUI() {
  renderNutritionGoals();
  renderNutritionToday();
  renderNutritionWeek();
  renderSavedMeals();
  renderNutritionFormVisibility();
  renderNutritionHistory();
}

async function loadMeals() {
  const requestId = ++mealsLoadRequestId;
  const sourceUserId = activeDemoUserId || '';
  try {
    let meals;
    if (activeDemoUserId) {
      meals = getActiveUserMealsData();
    } else {
      const response = await fetch('/api/meals');
      if (!response.ok) throw new Error('Failed to load meals');
      meals = await response.json();
    }
    if (requestId !== mealsLoadRequestId || sourceUserId !== (activeDemoUserId || '')) return;
    nutritionState.entries = Array.isArray(meals) ? meals : [];
  } catch (err) {
    console.error('Error loading meals:', err);
    if (requestId !== mealsLoadRequestId || sourceUserId !== (activeDemoUserId || '')) return;
    nutritionState.entries = [];
  }
  renderNutritionUI();
  refreshDashboardMetrics();
  updateStatisticsForActiveUser();
  renderStatistics();
}
function resetNutritionForm() {
  const form = document.getElementById('nutrition-form');
  if (form) form.reset();
  clearNutritionBuilderState();
  nutritionSetMode('manual');
}

async function submitNutritionForm(e) {
  e.preventDefault();
  if (!updateNutritionAccessState()) return;

  const mealType = document.getElementById('nutrition-form-meal')?.value || 'other';
  const mode = document.getElementById('nutrition-form-mode')?.value || 'manual';
  let food = (document.getElementById('nutrition-form-food')?.value || '').trim();
  let calories = parseMacro(document.getElementById('nutrition-form-calories')?.value);
  let protein = parseMacro(document.getElementById('nutrition-form-protein')?.value);
  let carbs = parseMacro(document.getElementById('nutrition-form-carbs')?.value);
  let fats = parseMacro(document.getElementById('nutrition-form-fats')?.value);

  if (mode === 'builder') {
    if (nutritionBuilderState.items.length === 0) {
      alert('Add at least one food item before saving the meal.');
      return;
    }
    nutritionCalculateBuilderTotals();
    calories = nutritionBuilderState.totals.calories;
    protein = nutritionBuilderState.totals.protein;
    carbs = nutritionBuilderState.totals.carbs;
    fats = nutritionBuilderState.totals.fats;
  }

  if (!food) {
    alert('Add a food name for this meal.');
    return;
  }

  try {
    const mealData = {
      name: food,
      meal_type: mealType,
      calories: Math.max(0, Number(calories) || 0),
      protein: Math.max(0, Number(protein) || 0),
      carbs: Math.max(0, Number(carbs) || 0),
      fats: Math.max(0, Number(fats) || 0),
      date: todayDateKey(),
      time: new Date().toTimeString().slice(0, 5)
    };

    if (activeDemoUserId) {
      const meals = getActiveUserMealsData();
      meals.push({
        id: nextLocalId(meals),
        ...mealData
      });
      setActiveUserMealsData(meals);
      await loadMeals();
      resetNutritionForm();
      nutritionState.showForm = false;
      renderNutritionFormVisibility();
      return;
    }

    const response = await fetch('/api/meals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mealData)
    });

    if (!response.ok) throw new Error(`API error: ${response.status}`);
    await loadMeals();
    resetNutritionForm();
    nutritionState.showForm = false;
    renderNutritionFormVisibility();
  } catch (err) {
    console.error('Error creating meal:', err);
    alert('Could not add meal right now.');
  }
}
function saveCurrentMealPreset() {
  if (!updateNutritionAccessState()) return;
  const mealType = document.getElementById('nutrition-form-meal')?.value || 'other';
  const mode = document.getElementById('nutrition-form-mode')?.value || 'manual';
  let food = (document.getElementById('nutrition-form-food')?.value || '').trim();
  let calories = parseMacro(document.getElementById('nutrition-form-calories')?.value);
  let protein = parseMacro(document.getElementById('nutrition-form-protein')?.value);
  let carbs = parseMacro(document.getElementById('nutrition-form-carbs')?.value);
  let fats = parseMacro(document.getElementById('nutrition-form-fats')?.value);

  if (mode === 'builder') {
    if (nutritionBuilderState.items.length === 0) {
      alert('Add foods first to save this built meal.');
      return;
    }
    nutritionCalculateBuilderTotals();
    calories = nutritionBuilderState.totals.calories;
    protein = nutritionBuilderState.totals.protein;
    carbs = nutritionBuilderState.totals.carbs;
    fats = nutritionBuilderState.totals.fats;
  }

  if (!food || calories <= 0) {
    alert('Add meal name and macros before saving.');
    return;
  }

  const meal = {
    id: Date.now(),
    name: food,
    meal_type: mealType,
    calories: Math.max(0, Number(calories) || 0),
    protein: Math.max(0, Number(protein) || 0),
    carbs: Math.max(0, Number(carbs) || 0),
    fats: Math.max(0, Number(fats) || 0)
  };
  nutritionState.savedMeals = [meal, ...nutritionState.savedMeals];
  persistSavedMeals();
  renderSavedMeals();
}

async function useSavedMeal(savedId) {
  if (!updateNutritionAccessState()) return;
  const meal = nutritionState.savedMeals.find(m => String(m.id) === String(savedId));
  if (!meal) return;

  const mealData = {
    name: meal.name || 'Saved meal',
    meal_type: meal.meal_type || meal.meal || 'other',
    calories: Math.max(0, Number(meal.calories) || 0),
    protein: Math.max(0, Number(meal.protein) || 0),
    carbs: Math.max(0, Number(meal.carbs) || 0),
    fats: Math.max(0, Number(meal.fats) || 0),
    date: todayDateKey(),
    time: new Date().toTimeString().slice(0, 5)
  };

  try {
    if (activeDemoUserId) {
      const meals = getActiveUserMealsData();
      meals.push({ id: nextLocalId(meals), ...mealData });
      setActiveUserMealsData(meals);
    } else {
      const response = await fetch('/api/meals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mealData)
      });
      if (!response.ok) throw new Error(`API error: ${response.status}`);
    }

    await loadMeals();
  } catch (err) {
    console.error('Error using saved meal:', err);
    alert('Could not add saved meal right now.');
  }
}

function deleteSavedMeal(savedId) {
  nutritionState.savedMeals = nutritionState.savedMeals.filter(m => String(m.id) !== String(savedId));
  persistSavedMeals();
  renderSavedMeals();
}

function setupNutrition() {
  if (!document.getElementById('nutrition')) return;

  loadSavedMeals();
  syncNutritionGoalWithProfile();
  updateNutritionAccessState();

  const toggleSavedBtn = document.getElementById('nutrition-toggle-saved-btn');
  const toggleFormBtn = document.getElementById('nutrition-toggle-form-btn');
  const cancelFormBtn = document.getElementById('nutrition-cancel-form-btn');
  const saveMealBtn = document.getElementById('nutrition-save-meal-btn');
  const nutritionForm = document.getElementById('nutrition-form');
  const savedGrid = document.getElementById('nutrition-saved-meals-grid');
  const historyList = document.getElementById('nutrition-history-list');
  const modeEl = document.getElementById('nutrition-form-mode');
  const builderCategoryEl = document.getElementById('nutrition-builder-category');
  const builderAddBtn = document.getElementById('nutrition-builder-add-btn');
  const builderList = document.getElementById('nutrition-builder-list');

  if (toggleSavedBtn) {
    toggleSavedBtn.addEventListener('click', () => {
      nutritionState.showSavedMeals = !nutritionState.showSavedMeals;
      renderSavedMeals();
    });
  }

  if (toggleFormBtn) {
    toggleFormBtn.addEventListener('click', () => {
      if (!updateNutritionAccessState()) return;
      nutritionState.showForm = !nutritionState.showForm;
      renderNutritionFormVisibility();
    });
  }

  if (cancelFormBtn) {
    cancelFormBtn.addEventListener('click', () => {
      nutritionState.showForm = false;
      renderNutritionFormVisibility();
    });
  }

  if (saveMealBtn) {
    saveMealBtn.addEventListener('click', saveCurrentMealPreset);
  }

  if (modeEl) {
    modeEl.addEventListener('change', (e) => {
      nutritionSetMode(e.target.value);
    });
  }

  if (builderCategoryEl) {
    builderCategoryEl.addEventListener('change', nutritionPopulateFoodOptions);
  }

  const builderFoodEl = document.getElementById('nutrition-builder-food');
  if (builderFoodEl) {
    builderFoodEl.addEventListener('change', nutritionUpdateQuantityLabel);
  }

  if (builderAddBtn) {
    builderAddBtn.addEventListener('click', addNutritionBuilderItem);
  }

  if (builderList) {
    builderList.addEventListener('click', (e) => {
      const removeBtn = e.target.closest?.('[data-builder-remove-id]');
      if (!removeBtn) return;
      const removeId = removeBtn.getAttribute('data-builder-remove-id');
      nutritionBuilderState.items = nutritionBuilderState.items.filter(item => item.id !== removeId);
      renderNutritionBuilderList();
    });
  }

  if (nutritionForm) {
    nutritionForm.addEventListener('submit', submitNutritionForm);
  }

  if (savedGrid) {
    savedGrid.addEventListener('click', (e) => {
      const target = e.target;
      const tabBtn = target.closest?.('[data-meal-tab]');
      const deleteBtn = target.closest?.('[data-id]');
      const useBtn = target.closest?.('[data-use-id]');
      if (tabBtn) {
        const mealType = String(tabBtn.getAttribute('data-meal-tab') || '').toLowerCase();
        if (mealType) {
          nutritionState.activeMealType = mealType;
        }
        renderSavedMeals();
      } else if (deleteBtn) {
        deleteSavedMeal(deleteBtn.getAttribute('data-id'));
      } else if (useBtn) {
        useSavedMeal(useBtn.getAttribute('data-use-id'));
      }
    });
  }

  if (historyList) {
    historyList.addEventListener('click', (e) => {
      const target = e.target;
      const deleteBtn = target.closest?.('[data-history-delete-id]');
      if (!deleteBtn) return;
      deleteMealEntry(deleteBtn.getAttribute('data-history-delete-id'));
    });
  }

  nutritionPopulateFoodOptions();
  nutritionSetMode(modeEl?.value || 'manual');
  renderNutritionBuilderList();
  renderNutritionUI();
  updateNutritionAccessState();
  loadMeals();
}

// ========================================
// Dashboard Experience
// ========================================

const dashboardState = {
  timerRunning: false,
  timerSeconds: 0,
  timerInterval: null,
  calorieGoal: 2200,
  weeklyWorkoutTarget: 5,
  selectedQuickActions: ['start_timer', 'log_workout', 'log_meal']
};

const DASH_QUICK_ACTIONS_KEY = 'fittrack_dash_quick_actions_v1';
const DASH_QUICK_ACTION_OPTIONS = [
  { id: 'start_timer', label: 'Start Timer', icon: 'fa-stopwatch', colorClass: 'blue' },
  { id: 'log_workout', label: 'Log Workout', icon: 'fa-dumbbell', colorClass: 'green' },
  { id: 'log_meal', label: 'Log Meal', icon: 'fa-apple-whole', colorClass: 'orange' },
  { id: 'add_task', label: 'Add Task', icon: 'fa-square-check', colorClass: 'pink' },
  { id: 'new_project', label: 'New Project', icon: 'fa-folder-plus', colorClass: 'indigo' },
  { id: 'view_streaks', label: 'View Streaks', icon: 'fa-fire', colorClass: 'amber' }
];
const QUICK_ACTION_FEATURE_MAP = {
  log_workout: 'showWorkout',
  log_meal: 'showNutrition',
  new_project: 'showProjects'
};

function isFeatureEnabled(featureKey) {
  if (!featureKey) return true;
  return !!activeDemoFeaturePrefs[featureKey];
}

function isQuickActionAllowed(actionId) {
  const requiredFeature = QUICK_ACTION_FEATURE_MAP[actionId];
  return isFeatureEnabled(requiredFeature);
}

function getAllowedQuickActionOptions() {
  return DASH_QUICK_ACTION_OPTIONS.filter(option => isQuickActionAllowed(option.id));
}

function defaultQuickActionsByPreferences() {
  const preferred = ['start_timer', 'log_workout', 'log_meal', 'add_task', 'new_project', 'view_streaks'];
  return preferred.filter(isQuickActionAllowed).slice(0, 3);
}

function sanitizeDashboardQuickActions() {
  const cleaned = dashboardState.selectedQuickActions
    .filter((id, idx, arr) => arr.indexOf(id) === idx)
    .filter(isQuickActionAllowed)
    .slice(0, 3);

  if (cleaned.length) {
    dashboardState.selectedQuickActions = cleaned;
    return;
  }

  const fallback = defaultQuickActionsByPreferences();
  dashboardState.selectedQuickActions = fallback.length ? fallback : ['start_timer'];
}

function loadDashboardQuickActions() {
  try {
    const raw = localStorage.getItem(DASH_QUICK_ACTIONS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const validIds = new Set(DASH_QUICK_ACTION_OPTIONS.map(opt => opt.id));
        dashboardState.selectedQuickActions = parsed.filter(id => validIds.has(id)).slice(0, 3);
      }
    }
  } catch (_err) {
    dashboardState.selectedQuickActions = defaultQuickActionsByPreferences();
  }
  sanitizeDashboardQuickActions();
}

function persistDashboardQuickActions() {
  localStorage.setItem(DASH_QUICK_ACTIONS_KEY, JSON.stringify(dashboardState.selectedQuickActions));
}

function actionOptionById(actionId) {
  return getAllowedQuickActionOptions().find(opt => opt.id === actionId) || null;
}

function renderDashboardQuickActionButtons() {
  const wrap = document.getElementById('dash-actions');
  if (!wrap) return;
  wrap.innerHTML = dashboardState.selectedQuickActions
    .map(actionId => {
      const option = actionOptionById(actionId);
      if (!option) return '';
      return `
        <button class="dash-action ${option.colorClass}" data-action="dash-quick-run" data-quick-action="${option.id}">
          <i class="fas ${option.icon}"></i> ${option.label}
        </button>
      `;
    })
    .join('');
}

function renderDashboardQuickActionPicker() {
  const list = document.getElementById('dash-action-option-list');
  if (!list) return;

  list.innerHTML = getAllowedQuickActionOptions().map(option => {
    const selected = dashboardState.selectedQuickActions.includes(option.id);
    const atLimit = dashboardState.selectedQuickActions.length >= 3;
    const disabledAdd = !selected && atLimit;
    return `
      <div class="dash-action-option ${selected ? 'is-selected' : ''} ${option.id}">
        <i class="fas ${option.icon}"></i>
        <span class="name">${option.label}</span>
        <button type="button" data-action="dash-quick-toggle" data-quick-action="${option.id}" ${disabledAdd ? 'disabled' : ''}>
          <i class="fas ${selected ? 'fa-minus' : 'fa-plus'}"></i>
        </button>
      </div>
    `;
  }).join('');
}

function openDashboardActionPicker(open) {
  const picker = document.getElementById('dash-action-picker');
  const btn = document.getElementById('dash-action-picker-btn');
  const panel = document.getElementById('dash-action-picker-panel');
  if (!picker || !btn || !panel) return;

  picker.classList.toggle('open', open);
  btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  panel.setAttribute('aria-hidden', open ? 'false' : 'true');
}

function runDashboardQuickAction(actionId) {
  if (!isQuickActionAllowed(actionId)) return;
  if (actionId === 'start_timer') {
    toggleDashboardTimer();
    return;
  }
  if (actionId === 'log_workout') {
    showPage('workout');
    return;
  }
  if (actionId === 'log_meal') {
    showPage('nutrition');
    const toggleBtn = document.getElementById('nutrition-toggle-form-btn');
    if (toggleBtn) toggleBtn.click();
    return;
  }
  if (actionId === 'add_task') {
    showPage('tasks');
    const addBtn = document.getElementById('add-task-btn');
    if (addBtn) addBtn.click();
    return;
  }
  if (actionId === 'new_project') {
    showPage('projects');
    const newBtn = document.getElementById('projects-new-btn');
    if (newBtn) newBtn.click();
    return;
  }
  if (actionId === 'view_streaks') {
    showPage('streaks');
  }
}

function formatTimer(seconds) {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${String(hrs).padStart(2, '0')}h ${String(mins).padStart(2, '0')}m ${String(secs).padStart(2, '0')}s`;
}

function updateDashboardTimerUI() {
  const timeEl = document.getElementById('dash-stat-time');
  const pillEl = document.getElementById('dash-timer-pill');
  const timerBtn = document.querySelector('[data-quick-action="start_timer"]');
  const floatingTimer = document.getElementById('dash-floating-timer');
  const floatingValue = document.getElementById('dash-floating-timer-value');
  const floatingToggle = document.getElementById('dash-floating-timer-toggle');
  if (timeEl) timeEl.textContent = formatTimer(dashboardState.timerSeconds);
  if (pillEl) {
    pillEl.textContent = dashboardState.timerRunning ? 'Timer running' : 'Timer off';
    pillEl.classList.toggle('running', dashboardState.timerRunning);
  }
  if (timerBtn) {
    timerBtn.innerHTML = dashboardState.timerRunning
      ? '<i class="fas fa-circle-stop"></i> Stop Timer'
      : '<i class="fas fa-stopwatch"></i> Start Timer';
  }
  if (floatingValue) {
    floatingValue.textContent = formatTimer(dashboardState.timerSeconds);
  }
  if (floatingToggle) {
    floatingToggle.innerHTML = dashboardState.timerRunning
      ? '<i class="fas fa-circle-stop"></i><span>Stop Timer</span>'
      : '<i class="fas fa-stopwatch"></i><span>Start Timer</span>';
  }
  if (floatingTimer) {
    floatingTimer.classList.toggle('running', dashboardState.timerRunning);
  }
}

function toggleDashboardTimer() {
  if (dashboardState.timerRunning) {
    dashboardState.timerRunning = false;
    if (dashboardState.timerInterval) clearInterval(dashboardState.timerInterval);
    dashboardState.timerInterval = null;
  } else {
    // TIMER ABUSE PREVENTION: Max 12 hours (43200 sec) per session to prevent time inflation
    if (dashboardState.timerSeconds >= 12 * 3600) {
      alert('⏱️ Timer limit reached (12 hours). Start a new session.');
      return;
    }
    dashboardState.timerRunning = true;
    dashboardState.timerInterval = setInterval(() => {
      dashboardState.timerSeconds += 1;
      updateDashboardTimerUI();
    }, 1000);
  }
  updateDashboardTimerUI();
}

async function refreshDashboardMetrics() {
  try {
    let summary;
    let workouts;
    if (activeDemoUserId) {
      const meals = getActiveUserMealsData();
      const today = todayDateKey();
      workouts = workoutState.workouts.length
        ? workoutState.workouts
        : getActiveUserWorkoutsData().map(w => ({ ...w, completed: !!workoutMeta(w.id).completed }));
      const todayCalories = meals
        .filter(m => String(m.date) === today)
        .reduce((sum, m) => sum + parseMacro(m.calories), 0);
      const todayWorkoutCount = workouts.filter(w => String(w.date) === today && w.completed).length;
      const burned = workouts.filter(w => w.completed).reduce((sum, w) => sum + (Number(w.calories_burned) || 0), 0);
      summary = {
        workouts: { total_workouts: todayWorkoutCount, total_calories_burned: burned },
        nutrition: { total_calories: todayCalories }
      };
    } else {
      const summaryRes = await fetch('/api/analytics/summary');
      const workoutsRes = await fetch('/api/workouts');
      if (!summaryRes.ok || !workoutsRes.ok) return;
      summary = await summaryRes.json();
      workouts = await workoutsRes.json();
    }
    const tasks = taskUiState.tasks || [];

    const completedTasks = tasks.filter(t => t.completed).length;
    const totalTasks = tasks.length;

    const todayWorkoutDone = isFeatureEnabled('showWorkout') && (summary.workouts?.total_workouts || 0) > 0 ? 1 : 0;
    const nutritionCal = isFeatureEnabled('showNutrition') ? Math.round(summary.nutrition?.total_calories || 0) : 0;
    const caloriesBurned = Math.round(summary.workouts?.total_calories_burned || 0);

    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weeklyCount = isFeatureEnabled('showWorkout') ? (Array.isArray(workouts) ? workouts : []).filter(w => {
      const d = new Date(w.date || '');
      return d >= weekAgo;
    }).length : 0;
    const weeklyPct = Math.max(0, Math.min(100, Math.round((weeklyCount / dashboardState.weeklyWorkoutTarget) * 100)));

    const workoutBar = document.getElementById('dash-workout-bar');
    const statWorkouts = document.getElementById('dash-stat-workouts');
    const statGoals = document.getElementById('dash-stat-goals');
    const statBurned = document.getElementById('dash-stat-burned');
    const taskLabel = document.getElementById('dash-progress-tasks-label');
    const workoutLabel = document.getElementById('dash-progress-workout-label');
    const nutritionLabel = document.getElementById('dash-progress-nutrition-label');
    const taskBar = document.getElementById('dash-progress-tasks-bar');
    const workoutProgressBar = document.getElementById('dash-progress-workout-bar');
    const nutritionBar = document.getElementById('dash-progress-nutrition-bar');

    if (workoutBar) workoutBar.style.width = `${weeklyPct}%`;
    if (statWorkouts) statWorkouts.textContent = `${weeklyCount}/${dashboardState.weeklyWorkoutTarget}`;
    if (statGoals) statGoals.textContent = `${completedTasks}/${Math.max(totalTasks, 1)}`;
    if (statBurned) statBurned.textContent = String(caloriesBurned);

    if (taskLabel) taskLabel.textContent = `${completedTasks}/${Math.max(totalTasks, 1)}`;
    if (workoutLabel) workoutLabel.textContent = `${todayWorkoutDone}/1`;
    if (nutritionLabel) nutritionLabel.textContent = `${nutritionCal}/${dashboardState.calorieGoal} cal`;
    if (taskBar) taskBar.style.width = `${Math.round((completedTasks / Math.max(totalTasks, 1)) * 100)}%`;
    if (workoutProgressBar) workoutProgressBar.style.width = `${todayWorkoutDone ? 100 : 0}%`;
    if (nutritionBar) nutritionBar.style.width = `${Math.max(0, Math.min(100, Math.round((nutritionCal / dashboardState.calorieGoal) * 100)))}%`;

    const activityList = document.getElementById('dash-activity-list');
    if (activityList) {
      const taskActivities = materializeTasksForRender(tasks)
        .filter(t => !t.completed)
        .sort((a, b) => taskDueAt(a).getTime() - taskDueAt(b).getTime())
        .slice(0, 3)
        .map(t => ({
          title: t.title,
          category: 'Task',
          priority: t.priority || 'medium',
          time: formatTaskDue(t),
          icon: 'fa-list-check',
          page: 'tasks',
          taskId: t.id
        }));

      const workoutActivities = isFeatureEnabled('showWorkout')
        ? (Array.isArray(workouts) ? workouts : [])
          .sort((a, b) => {
            const aTs = new Date(`${a.date || ''}T${a.time || '09:00'}`).getTime();
            const bTs = new Date(`${b.date || ''}T${b.time || '09:00'}`).getTime();
            return aTs - bTs;
          })
          .slice(0, 2)
          .map(w => {
            const dateObj = new Date(`${w.date || ''}T${w.time || '09:00'}`);
            const isToday = isTodayDate(dateObj);
            return {
              title: w.name || 'Workout',
              category: 'Workout',
              priority: isToday ? 'high' : 'medium',
              time: dateObj.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
              icon: 'fa-dumbbell',
              page: 'workout'
            };
          })
        : [];

      const activities = [...taskActivities, ...workoutActivities]
        .sort((a, b) => {
          const aIsTask = a.page === 'tasks' ? 0 : 1;
          const bIsTask = b.page === 'tasks' ? 0 : 1;
          return aIsTask - bIsTask;
        })
        .slice(0, 5);

      activityList.innerHTML = activities.length
        ? activities.map(a => `
          <div class="dash-activity-item" data-action="dash-open-page" data-page="${a.page}" ${a.taskId ? `data-task-id="${a.taskId}"` : ''}>
            <div class="dash-activity-icon"><i class="fas ${a.icon}"></i></div>
            <div class="dash-activity-main"><strong>${escapeHtml(a.title)}</strong><span>${a.category}</span></div>
            <span class="dash-priority ${a.priority}">${a.priority}</span>
            <time>${escapeHtml(a.time)}</time>
          </div>
        `).join('')
        : '<div class="tasks-empty-state">No upcoming activities yet.</div>';
    }
  } catch (err) {
    console.error('Dashboard metrics refresh failed:', err);
  }
}

function setupDashboard() {
  if (!document.getElementById('dashboard')) return;

  const actionsWrap = document.getElementById('dash-actions');
  const actionPicker = document.getElementById('dash-action-picker');
  const pickerBtn = document.getElementById('dash-action-picker-btn');
  const pickerList = document.getElementById('dash-action-option-list');
  const floatingToggle = document.getElementById('dash-floating-timer-toggle');
  const activityList = document.getElementById('dash-activity-list');
  const workoutsCard = document.getElementById('dash-stat-card-workouts');
  const goalsCard = document.getElementById('dash-stat-card-goals');
  const caloriesCard = document.getElementById('dash-stat-burned')?.closest('.dash-stat-card');
  const tasksProgressRow = document.getElementById('dash-progress-row-tasks');
  const workoutProgressRow = document.getElementById('dash-progress-row-workout');

  loadDashboardQuickActions();
  renderDashboardQuickActionButtons();
  renderDashboardQuickActionPicker();

  if (actionsWrap) {
    actionsWrap.addEventListener('click', (e) => {
      const actionEl = e.target.closest('[data-action="dash-quick-run"]');
      if (!actionEl) return;
      const actionId = actionEl.getAttribute('data-quick-action');
      if (!actionId) return;
      runDashboardQuickAction(actionId);
      updateDashboardTimerUI();
    });
  }

  if (pickerBtn) {
    pickerBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = actionPicker?.classList.contains('open');
      openDashboardActionPicker(!isOpen);
    });
  }

  if (pickerList) {
    pickerList.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action="dash-quick-toggle"]');
      if (!btn) return;
      const actionId = btn.getAttribute('data-quick-action');
      if (!actionId) return;
      if (!isQuickActionAllowed(actionId)) return;

      const exists = dashboardState.selectedQuickActions.includes(actionId);
      if (exists) {
        dashboardState.selectedQuickActions = dashboardState.selectedQuickActions.filter(id => id !== actionId);
      } else if (dashboardState.selectedQuickActions.length < 3) {
        dashboardState.selectedQuickActions.push(actionId);
      }

      sanitizeDashboardQuickActions();

      persistDashboardQuickActions();
      renderDashboardQuickActionButtons();
      renderDashboardQuickActionPicker();
      updateDashboardTimerUI();
    });
  }

  document.addEventListener('click', (e) => {
    if (!actionPicker) return;
    if (!actionPicker.contains(e.target)) {
      openDashboardActionPicker(false);
    }
  });

  if (floatingToggle) {
    floatingToggle.addEventListener('click', toggleDashboardTimer);
  }

  if (workoutsCard) {
    workoutsCard.classList.add('is-link');
    workoutsCard.addEventListener('click', () => showPage('workout'));
  }

  if (goalsCard) {
    goalsCard.classList.add('is-link');
    goalsCard.addEventListener('click', () => showPage('tasks'));
  }

  if (caloriesCard) {
    caloriesCard.classList.add('is-link');
    caloriesCard.addEventListener('click', () => showPage('nutrition'));
  }

  if (tasksProgressRow) {
    tasksProgressRow.classList.add('is-link');
    tasksProgressRow.addEventListener('click', () => showPage('tasks'));
  }

  if (workoutProgressRow) {
    workoutProgressRow.classList.add('is-link');
    workoutProgressRow.addEventListener('click', () => showPage('workout'));
  }

  if (activityList) {
    activityList.addEventListener('click', (e) => {
      const actionEl = e.target.closest('[data-action="dash-open-page"]');
      if (!actionEl) return;
      const page = actionEl.getAttribute('data-page');
      const taskId = Number(actionEl.getAttribute('data-task-id'));
      if (!page) return;
      showPage(page);
      if (page === 'tasks' && taskId) {
        taskUiState.expanded.add(taskId);
        renderTasks(taskUiState.tasks);
      }
    });
  }

  updateDashboardTimerUI();
  refreshDashboardMetrics();
}

// ========================================
// Streaks Experience
// ========================================

function setupStreaks() {
  if (!document.getElementById('streaks')) return;

  const currentStreak = 12;
  const longestStreak = 28;
  const totalPoints = 2450;
  const level = 15;
  const pointsToNextLevel = 150;
  const progressPct = 65;

  const activities = [
    { action: 'Completed High Intensity Training', points: 50, time: '2 hours ago', priority: 'high' },
    { action: 'Met daily protein goal', points: 30, time: '4 hours ago', priority: 'medium' },
    { action: 'Tracked 60 minutes cardio', points: 25, time: '6 hours ago', priority: 'medium' },
    { action: 'Completed weekly running goal', points: 40, time: 'Yesterday', priority: 'high' },
    { action: 'Logged all meals for the day', points: 20, time: 'Yesterday', priority: 'low' }
  ];

  const achievements = [
    { title: 'First Workout', description: 'Complete your first workout', icon: 'fa-dumbbell', earned: true, date: 'Jan 15, 2025' },
    { title: '7 Day Streak', description: 'Maintain a 7-day workout streak', icon: 'fa-fire', earned: true, date: 'Feb 2, 2025' },
    { title: '1000 Points', description: 'Earn 1000 total points', icon: 'fa-star', earned: true, date: 'Mar 10, 2025' },
    { title: 'Early Bird', description: 'Complete 10 workouts before 8 AM', icon: 'fa-award', earned: true, date: 'Apr 5, 2025' },
    { title: '30 Day Streak', description: 'Maintain a 30-day workout streak', icon: 'fa-trophy', earned: false },
    { title: 'Nutrition Master', description: 'Log meals for 30 consecutive days', icon: 'fa-apple-alt', earned: false },
    { title: '5000 Points', description: 'Earn 5000 total points', icon: 'fa-crown', earned: false },
    { title: 'Century Club', description: 'Complete 100 workouts', icon: 'fa-medal', earned: false }
  ];

  const currentEl = document.getElementById('streaks-current');
  const longestEl = document.getElementById('streaks-longest');
  const pointsEl = document.getElementById('streaks-points');
  const levelEl = document.getElementById('streaks-level');
  const nextEl = document.getElementById('streaks-level-next');
  const levelNumEl = document.getElementById('streaks-level-num');
  const levelPctEl = document.getElementById('streaks-level-pct');
  const levelBarEl = document.getElementById('streaks-level-bar');
  const levelNoteEl = document.getElementById('streaks-level-note');
  const ringEl = document.getElementById('streaks-level-ring');
  const calendarEl = document.getElementById('streaks-calendar');
  const activityEl = document.getElementById('streaks-activity-list');
  const achievementsEl = document.getElementById('streaks-achievements');

  if (currentEl) currentEl.textContent = `${currentStreak} Days`;
  if (longestEl) longestEl.textContent = `${longestStreak} Days`;
  if (pointsEl) pointsEl.textContent = totalPoints.toLocaleString();
  if (levelEl) levelEl.textContent = `Level ${level}`;
  if (nextEl) nextEl.textContent = `${pointsToNextLevel} to level ${level + 1}`;
  if (levelNumEl) levelNumEl.textContent = String(level);
  if (levelPctEl) levelPctEl.textContent = `${progressPct}%`;
  if (levelBarEl) levelBarEl.style.width = `${progressPct}%`;
  if (levelNoteEl) levelNoteEl.textContent = `${pointsToNextLevel} more points needed`;
  if (ringEl) ringEl.style.setProperty('--pct', String(progressPct));

  if (calendarEl) {
    const cells = [];
    for (let i = 13; i >= 0; i -= 1) {
      const active = i < currentStreak;
      cells.push(`<div class="streaks-day ${active ? 'active' : ''}">${active ? '<i class="fas fa-fire"></i>' : ''}</div>`);
    }
    calendarEl.innerHTML = cells.join('');
  }

  if (activityEl) {
    activityEl.innerHTML = activities.map(item => `
      <article class="streaks-activity-item">
        <div class="streaks-activity-icon"><i class="fas fa-arrow-trend-up"></i></div>
        <div class="streaks-activity-main">
          <strong>${item.action}</strong>
          <div class="meta">
            <span>${item.time}</span>
            <span class="streaks-priority ${item.priority}">${item.priority} priority</span>
          </div>
        </div>
        <div class="streaks-activity-points"><strong>+${item.points}</strong><span>points</span></div>
      </article>
    `).join('');
  }

  if (achievementsEl) {
    achievementsEl.innerHTML = achievements.map(item => `
      <article class="streaks-achievement ${item.earned ? '' : 'locked'}">
        <div class="icon"><i class="fas ${item.icon}"></i></div>
        <h4>${item.title}</h4>
        <p>${item.description}</p>
        <span>${item.earned ? `Earned: ${item.date}` : 'Locked'}</span>
      </article>
    `).join('');
  }
}

// ========================================
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

// ========================================
// Profile Experience
// ========================================

const PROFILE_STORAGE_KEY = 'fittrack_profile_v1';
const THEME_STORAGE_KEY = 'fittrack_theme_v1';
const defaultProfile = {
  fullName: 'Alex Johnson',
  email: 'alex.johnson@email.com',
  dob: '1990-05-15',
  age: 30,
  gender: 'Prefer not to say',
  height: 175,
  currentWeight: 75,
  targetWeight: 70,
  level: 'Intermediate',
  goal: 'Weight Loss',
  weightGoal: 'loss',
  bmi: 0,
  bmr: 0,
  tdee: 0,
  targetCalories: 2200,
  targetProtein: 140,
  targetCarbs: 250,
  targetFats: 60,
  memberSince: 'Jan 2024',
  theme: 'light'
};

let profileState = { ...defaultProfile };

function renderTopProfileMenu() {
  const name = profileState.fullName || defaultProfile.fullName;
  const email = profileState.email || defaultProfile.email;

  const topName = document.getElementById('top-profile-name');
  const topEmail = document.getElementById('top-profile-email');
  const headName = document.getElementById('top-profile-head-name');
  const headEmail = document.getElementById('top-profile-head-email');

  if (topName) topName.textContent = name;
  if (topEmail) topEmail.textContent = email;
  if (headName) headName.textContent = name;
  if (headEmail) headEmail.textContent = email;
}

function closeProfileMenu() {
  const wrap = document.getElementById('profile-menu-wrap');
  const btn = document.getElementById('profile-menu-btn');
  const panel = document.getElementById('profile-menu-panel');

  if (wrap) wrap.classList.remove('open');
  if (btn) btn.setAttribute('aria-expanded', 'false');
  if (panel) panel.setAttribute('aria-hidden', 'true');
}

function setupProfileMenu() {
  const wrap = document.getElementById('profile-menu-wrap');
  const btn = document.getElementById('profile-menu-btn');
  const panel = document.getElementById('profile-menu-panel');
  const themeToggle = document.getElementById('theme-toggle-input');

  if (!wrap || !btn || !panel) return;

  renderTopProfileMenu();
  if (themeToggle) {
    themeToggle.checked = profileState.theme === 'dark';
    themeToggle.addEventListener('change', () => {
      profileState.theme = themeToggle.checked ? 'dark' : 'light';
      persistProfileState();
      applyTheme(profileState.theme);
      const profileThemeEl = document.getElementById('profile-theme');
      if (profileThemeEl) profileThemeEl.value = profileState.theme;
    });
  }

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = wrap.classList.toggle('open');
    btn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    panel.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
  });

  panel.addEventListener('click', (e) => {
    const actionBtn = e.target.closest('button[data-action]');
    if (!actionBtn) return;

    const action = actionBtn.getAttribute('data-action');
    if (action === 'open-profile-page' || action === 'open-settings-page') {
      showPage('profile');
      closeProfileMenu();
      return;
    }

    if (action === 'customize-layout') {
      openLayoutCustomizeModal();
      closeProfileMenu();
      return;
    }

    if (action === 'sign-out') {
      localStorage.removeItem(DEMO_USER_STORAGE_KEY);
      activeDemoUserId = null;
      activeDemoFeaturePrefs = { ...DEFAULT_DEMO_FEATURE_PREFS };
      closeProfileMenu();
      setSessionView('selector');
      return;
    }
  });

  document.addEventListener('click', (e) => {
    if (!wrap.contains(e.target)) {
      closeProfileMenu();
    }
  });
}

function loadProfileState() {
  try {
    const raw = localStorage.getItem(PROFILE_STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    profileState = { ...defaultProfile, ...parsed };
    if (!profileState.weightGoal) {
      profileState.weightGoal = profileState.goal === 'Weight Loss'
        ? 'loss'
        : profileState.goal === 'Muscle Gain'
          ? 'gain'
          : 'maintain';
    }
    // Sanitize core numeric fields to avoid invalid profile state locking nutrition.
    if (!Number.isFinite(Number(profileState.age)) || Number(profileState.age) <= 0) {
      profileState.age = defaultProfile.age;
    }
    if (!Number.isFinite(Number(profileState.height)) || Number(profileState.height) <= 0) {
      profileState.height = defaultProfile.height;
    }
    if (!Number.isFinite(Number(profileState.currentWeight)) || Number(profileState.currentWeight) <= 0) {
      profileState.currentWeight = defaultProfile.currentWeight;
    }
    const ruleGoal = effectiveWeightRuleGoal(profileState.goal, profileState.weightGoal);
    if (ruleGoal === 'maintain') {
      profileState.targetWeight = profileState.currentWeight;
    } else if (!Number.isFinite(Number(profileState.targetWeight)) || Number(profileState.targetWeight) <= 0) {
      profileState.targetWeight = ruleGoal === 'loss'
        ? Math.max(1, profileState.currentWeight - 5)
        : profileState.currentWeight + 5;
    }
    const validation = validateProfileWeights({
      goal: profileState.goal,
      weightGoal: profileState.weightGoal,
      currentWeight: profileState.currentWeight,
      targetWeight: profileState.targetWeight
    });
    if (!validation.valid) {
      profileState.targetWeight = ruleGoal === 'loss'
        ? Math.max(1, profileState.currentWeight - 5)
        : ruleGoal === 'gain'
          ? profileState.currentWeight + 5
          : profileState.currentWeight;
    }
    profileState = { ...profileState, ...calculateProfileHealthMetrics(profileState) };
    persistProfileState();
  } catch (_err) {
    profileState = { ...defaultProfile };
  }
}

function persistProfileState() {
  localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profileState));
}

function applyTheme(themeValue) {
  const isDark = themeValue === 'dark';
  document.body.classList.toggle('theme-dark', isDark);
  localStorage.setItem(THEME_STORAGE_KEY, isDark ? 'dark' : 'light');
  const themeToggle = document.getElementById('theme-toggle-input');
  if (themeToggle) themeToggle.checked = isDark;
}

function loadThemePreference() {
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === 'dark' || stored === 'light') {
    profileState.theme = stored;
  }
  applyTheme(profileState.theme);
}

function profileInputValue(id, fallback = '') {
  const el = document.getElementById(id);
  return el ? el.value : fallback;
}

function activityMultiplierFromLevel(level) {
  const key = String(level || '').toLowerCase();
  if (key === 'advanced') return 1.55;
  if (key === 'intermediate') return 1.375;
  return 1.2;
}

function calculateProfileHealthMetrics(input) {
  const age = Number(input?.age);
  const heightCm = Number(input?.height);
  const weightKg = Number(input?.currentWeight);
  const gender = String(input?.gender || '').toLowerCase();
  const weightGoal = String(input?.weightGoal || '').toLowerCase();
  const level = String(input?.level || '');

  if (!Number.isFinite(age) || !Number.isFinite(heightCm) || !Number.isFinite(weightKg) || age <= 0 || heightCm <= 0 || weightKg <= 0) {
    return {
      bmi: 0,
      bmr: 0,
      tdee: 0,
      activityMultiplier: activityMultiplierFromLevel(level),
      targetCalories: 0,
      targetProtein: 0,
      targetCarbs: 0,
      targetFats: 0
    };
  }

  const heightM = heightCm / 100;
  const bmi = weightKg / (heightM * heightM);

  let bmr = (10 * weightKg) + (6.25 * heightCm) - (5 * age);
  if (gender === 'male') bmr += 5;
  else if (gender === 'female') bmr -= 161;

  const activityMultiplier = activityMultiplierFromLevel(level);
  const tdee = bmr * activityMultiplier;

  let adjustment = 0;
  if (weightGoal === 'loss') adjustment = -400;
  else if (weightGoal === 'gain') adjustment = 400;
  let target = tdee + adjustment;

  const lowerBound = Math.max(bmr, tdee - 500);
  const upperBound = tdee + 500;
  target = Math.max(lowerBound, Math.min(upperBound, target));
  target = Math.round(target / 10) * 10;
  if (target < bmr) target = Math.ceil(bmr / 10) * 10;

  const macroGoal = weightGoal === 'loss' || weightGoal === 'gain' || weightGoal === 'maintain'
    ? weightGoal
    : 'maintain';
  const proteinPerKg = macroGoal === 'loss' ? 2.0 : macroGoal === 'gain' ? 1.8 : 1.6;
  const fatPct = macroGoal === 'maintain' ? 0.30 : 0.25;

  let proteinG = Math.round(weightKg * proteinPerKg);
  let fatG = Math.round((target * fatPct) / 9);
  let carbCalories = target - ((proteinG * 4) + (fatG * 9));
  if (carbCalories < 0) carbCalories = 0;
  let carbsG = Math.round(carbCalories / 4);

  // Keep rounded macro calories near target with deterministic correction.
  let macroCalories = (proteinG * 4) + (fatG * 9) + (carbsG * 4);
  if (Math.abs(target - macroCalories) > 50) {
    const carbAdjust = Math.round((target - macroCalories) / 4);
    carbsG = Math.max(0, carbsG + carbAdjust);
    macroCalories = (proteinG * 4) + (fatG * 9) + (carbsG * 4);
  }
  if (Math.abs(target - macroCalories) > 50) {
    const fatAdjust = Math.round((target - macroCalories) / 9);
    fatG = Math.max(0, fatG + fatAdjust);
  }

  return {
    bmi: Math.round(bmi * 10) / 10,
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    activityMultiplier,
    targetCalories: Math.max(0, Number(target) || 0),
    targetProtein: Math.max(0, Number(proteinG) || 0),
    targetCarbs: Math.max(0, Number(carbsG) || 0),
    targetFats: Math.max(0, Number(fatG) || 0)
  };
}

function isProfileCoreDataComplete(values = profileState) {
  const age = Number(values?.age);
  const height = Number(values?.height);
  const currentWeight = Number(values?.currentWeight);
  return Number.isFinite(age) && age > 0 && Number.isFinite(height) && height > 0 && Number.isFinite(currentWeight) && currentWeight > 0;
}

function isHalfKgStep(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return false;
  return Math.abs((n * 2) - Math.round(n * 2)) < 1e-9;
}

function effectiveWeightRuleGoal(goalValue, weightGoalValue) {
  const wg = String(weightGoalValue || '').toLowerCase();
  if (wg === 'loss' || wg === 'gain' || wg === 'maintain') return wg;
  const g = String(goalValue || '').toLowerCase();
  if (g.includes('loss')) return 'loss';
  if (g.includes('gain') || g.includes('bulk')) return 'gain';
  return 'maintain';
}

function validateProfileWeights(values) {
  const currentWeight = Number(values?.currentWeight);
  const targetWeight = Number(values?.targetWeight);
  const goal = values?.goal || profileState.goal;
  const weightGoal = values?.weightGoal || profileState.weightGoal;
  const ruleGoal = effectiveWeightRuleGoal(goal, weightGoal);

  if (!Number.isFinite(currentWeight) || currentWeight <= 0) {
    return { valid: false, message: 'Enter a valid current weight.', ruleGoal };
  }
  if (!isHalfKgStep(currentWeight)) {
    return { valid: false, message: 'Weight must be in 0.5 kg steps.', ruleGoal };
  }
  if (ruleGoal === 'maintain') {
    return { valid: true, message: '', ruleGoal };
  }

  if (!Number.isFinite(targetWeight) || targetWeight <= 0) {
    return { valid: false, message: 'Enter a valid target weight.', ruleGoal };
  }
  if (!isHalfKgStep(targetWeight)) {
    return { valid: false, message: 'Weight must be in 0.5 kg steps.', ruleGoal };
  }
  if (ruleGoal === 'gain' && !(targetWeight > currentWeight)) {
    return { valid: false, message: 'For Weight Gain (Bulk), target weight must be greater than current weight.', ruleGoal };
  }
  if (ruleGoal === 'loss' && !(targetWeight < currentWeight)) {
    return { valid: false, message: 'For Weight Loss, target weight must be less than current weight.', ruleGoal };
  }
  return { valid: true, message: '', ruleGoal };
}

function currentProfileFormValues() {
  const weightGoal = profileInputValue('profile-weight-goal', profileState.weightGoal) || 'maintain';
  const currentWeight = Number(profileInputValue('profile-current-weight', String(profileState.currentWeight)));
  const rawTarget = Number(profileInputValue('profile-target-weight', String(profileState.targetWeight)));
  const targetWeight = weightGoal === 'maintain' ? currentWeight : rawTarget;
  return {
    goal: profileInputValue('profile-goal', profileState.goal),
    weightGoal,
    level: profileInputValue('profile-level', profileState.level),
    age: Number(profileInputValue('profile-age', String(profileState.age))),
    gender: profileInputValue('profile-gender', profileState.gender),
    height: Number(profileInputValue('profile-height', String(profileState.height))),
    currentWeight,
    targetWeight
  };
}

function updateProfileValidationUI(showWhenValid = false) {
  const msgEl = document.getElementById('profile-validation-msg');
  if (!msgEl) return { valid: true, message: '' };
  const draft = currentProfileFormValues();
  const age = Number(draft.age);
  if (!Number.isFinite(age) || age < 10 || age > 120) {
    msgEl.textContent = 'Age is required.';
    msgEl.style.display = 'inline-block';
    return { valid: false, message: 'Age is required.' };
  }
  const result = validateProfileWeights(draft);
  if (result.valid) {
    msgEl.textContent = '';
    msgEl.style.display = showWhenValid ? 'inline-block' : 'none';
  } else {
    msgEl.textContent = result.message;
    msgEl.style.display = 'inline-block';
  }
  return result;
}

function isProfileCompleteAndValid() {
  if (!isProfileCoreDataComplete(profileState)) return false;
  const result = validateProfileWeights({
    goal: profileState.goal,
    weightGoal: profileState.weightGoal,
    currentWeight: profileState.currentWeight,
    targetWeight: profileState.targetWeight
  });
  return result.valid;
}

function applyWeightPlanFieldVisibility() {
  const planEl = document.getElementById('profile-weight-goal');
  const targetWrap = document.getElementById('profile-target-weight-wrap');
  const targetEl = document.getElementById('profile-target-weight');

  const plan = String(planEl?.value || profileState.weightGoal || 'maintain').toLowerCase();
  const isMaintain = plan === 'maintain';

  if (targetWrap) targetWrap.style.display = isMaintain ? 'none' : '';
  if (targetEl) {
    if (isMaintain) {
      targetEl.removeAttribute('required');
    } else {
      targetEl.setAttribute('required', 'required');
    }
  }
}

function refreshCalculatedProfileMetricsFromForm(persist = false) {
  const draft = {
    ...profileState,
    ...currentProfileFormValues()
  };
  const metrics = calculateProfileHealthMetrics(draft);
  const nextState = {
    ...profileState,
    ...draft,
    ...metrics
  };
  const validation = validateProfileWeights({
    goal: nextState.goal,
    weightGoal: nextState.weightGoal,
    currentWeight: nextState.currentWeight,
    targetWeight: nextState.targetWeight
  });
  const canApplyDraft = isProfileCoreDataComplete(nextState) && validation.valid;
  if (persist || canApplyDraft) {
    profileState = nextState;
    if (persist) persistProfileState();
  }
  syncNutritionGoalWithProfile();
  renderNutritionUI();
  updateNutritionAccessState();
}

function updateNutritionAccessState() {
  const hasCoreData = isProfileCoreDataComplete(profileState);
  const isValid = hasCoreData && isProfileCompleteAndValid();
  const gateEl = document.getElementById('nutrition-profile-gate-msg');
  const formSection = document.getElementById('nutrition-form-section');
  const toggleFormBtn = document.getElementById('nutrition-toggle-form-btn');
  const saveMealBtn = document.getElementById('nutrition-save-meal-btn');
  const nutritionForm = document.getElementById('nutrition-form');

  if (gateEl) {
    gateEl.classList.toggle('nutrition-collapsed', isValid);
    if (!isValid) {
      gateEl.innerHTML = `<div class="nutrition-empty">Complete your profile to calculate nutrition targets</div>`;
    }
  }
  if (!isValid) nutritionState.showForm = false;
  if (formSection && !isValid) formSection.classList.add('nutrition-collapsed');
  if (toggleFormBtn) toggleFormBtn.disabled = !isValid;
  if (saveMealBtn) saveMealBtn.disabled = !isValid;
  if (nutritionForm) {
    Array.from(nutritionForm.elements || []).forEach((el) => {
      if (!el || typeof el.disabled === 'undefined') return;
      if (el.id === 'nutrition-cancel-form-btn') return;
      el.disabled = !isValid;
    });
  }

  return isValid;
}

function syncNutritionGoalWithProfile() {
  const goal = profileState.weightGoal || 'maintain';
  nutritionState.weightGoal = goal === 'loss' || goal === 'gain' ? goal : 'maintain';
  const targetCalories = Number(profileState?.targetCalories);
  const targetProtein = Number(profileState?.targetProtein);
  const targetCarbs = Number(profileState?.targetCarbs);
  const targetFats = Number(profileState?.targetFats);
  if (Number.isFinite(targetCalories) && targetCalories > 0) nutritionState.baseGoals.calories = targetCalories;
  if (Number.isFinite(targetProtein) && targetProtein >= 0) nutritionState.baseGoals.protein = Math.round(targetProtein);
  if (Number.isFinite(targetCarbs) && targetCarbs >= 0) nutritionState.baseGoals.carbs = Math.round(targetCarbs);
  if (Number.isFinite(targetFats) && targetFats >= 0) nutritionState.baseGoals.fats = Math.round(targetFats);
}

function renderProfileUI() {
  const mapValues = [
    ['profile-full-name', profileState.fullName],
    ['profile-email', profileState.email],
    ['profile-dob', profileState.dob],
    ['profile-age', String(profileState.age)],
    ['profile-gender', profileState.gender],
    ['profile-height', String(profileState.height)],
    ['profile-current-weight', String(profileState.currentWeight)],
    ['profile-target-weight', String(profileState.targetWeight)],
    ['profile-level', profileState.level],
    ['profile-goal', profileState.goal],
    ['profile-weight-goal', profileState.weightGoal],
    ['profile-theme', profileState.theme]
  ];
  mapValues.forEach(([id, value]) => {
    const el = document.getElementById(id);
    if (el) el.value = value;
  });
  applyWeightPlanFieldVisibility();

  const heroName = document.getElementById('profile-hero-name');
  const heroMember = document.getElementById('profile-hero-member');
  const quickHeight = document.getElementById('profile-quick-height');
  const quickCurrent = document.getElementById('profile-quick-current');
  const quickTarget = document.getElementById('profile-quick-target');

  if (heroName) heroName.textContent = profileState.fullName;
  if (heroMember) heroMember.textContent = `Member since ${profileState.memberSince}`;
  if (quickHeight) quickHeight.textContent = `${profileState.height} cm`;
  if (quickCurrent) quickCurrent.textContent = `${profileState.currentWeight} kg`;
  if (quickTarget) quickTarget.textContent = `${profileState.targetWeight} kg`;

  renderTopProfileMenu();
  applyTheme(profileState.theme);
}

async function renderProfileDynamicStats() {
  const workoutsEl = document.getElementById('profile-hero-workouts');
  const goalsEl = document.getElementById('profile-hero-goals');
  if (!workoutsEl || !goalsEl) return;

  try {
    let workouts;
    if (activeDemoUserId) {
      workouts = getActiveUserWorkoutsData();
    } else {
      const workoutsRes = await fetch('/api/workouts');
      workouts = workoutsRes.ok ? await workoutsRes.json() : [];
    }
    const totalWorkouts = Array.isArray(workouts) ? workouts.length : 0;
    const goalsDone = (taskUiState.tasks || []).filter(t => t.completed).length;
    workoutsEl.textContent = String(totalWorkouts);
    goalsEl.textContent = String(goalsDone);
  } catch (_err) {
    workoutsEl.textContent = '0';
    goalsEl.textContent = String((taskUiState.tasks || []).filter(t => t.completed).length);
  }
}
function setupProfile() {
  const page = document.getElementById('profile');
  if (!page) return;
  loadProfileState();
  renderProfileUI();
  renderProfileDynamicStats();

  const saveBtn = document.getElementById('profile-save-btn');
  const profileGoalEl = document.getElementById('profile-goal');
  const profileWeightGoalEl = document.getElementById('profile-weight-goal');
  const profileLevelEl = document.getElementById('profile-level');
  const profileAgeEl = document.getElementById('profile-age');
  const profileGenderEl = document.getElementById('profile-gender');
  const profileHeightEl = document.getElementById('profile-height');
  const profileCurrentWeightEl = document.getElementById('profile-current-weight');
  const profileTargetWeightEl = document.getElementById('profile-target-weight');

  [profileCurrentWeightEl, profileTargetWeightEl].forEach((el) => {
    if (el) el.step = '0.5';
  });

  const validateProfileFormLive = (showAlertForGoalChange = false) => {
    applyWeightPlanFieldVisibility();
    const result = updateProfileValidationUI();
    if (showAlertForGoalChange && !result.valid) {
      alert('Please correct current/target weight to match your selected goal.');
    }
    return result.valid;
  };

  if (profileGoalEl) {
    profileGoalEl.addEventListener('change', () => {
      refreshCalculatedProfileMetricsFromForm(false);
      validateProfileFormLive(true);
    });
  }
  if (profileWeightGoalEl) {
    profileWeightGoalEl.addEventListener('change', () => {
      refreshCalculatedProfileMetricsFromForm(false);
      validateProfileFormLive(true);
    });
  }
  if (profileLevelEl) profileLevelEl.addEventListener('change', () => refreshCalculatedProfileMetricsFromForm(false));
  if (profileGenderEl) profileGenderEl.addEventListener('change', () => refreshCalculatedProfileMetricsFromForm(false));
  if (profileHeightEl) profileHeightEl.addEventListener('input', () => refreshCalculatedProfileMetricsFromForm(false));
  if (profileAgeEl) profileAgeEl.addEventListener('input', () => refreshCalculatedProfileMetricsFromForm(false));
  if (profileCurrentWeightEl) {
    profileCurrentWeightEl.addEventListener('input', () => {
      applyWeightPlanFieldVisibility();
      refreshCalculatedProfileMetricsFromForm(false);
    });
  }
  if (profileTargetWeightEl) profileTargetWeightEl.addEventListener('input', () => refreshCalculatedProfileMetricsFromForm(false));

  applyWeightPlanFieldVisibility();
  refreshCalculatedProfileMetricsFromForm(false);
  updateProfileValidationUI();

  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      applyWeightPlanFieldVisibility();
      const validation = updateProfileValidationUI();
      if (!validation.valid) return;
      profileState = {
        ...profileState,
        fullName: profileInputValue('profile-full-name', profileState.fullName).trim() || profileState.fullName,
        email: profileInputValue('profile-email', profileState.email).trim() || profileState.email,
        dob: profileInputValue('profile-dob', profileState.dob) || profileState.dob,
        theme: profileInputValue('profile-theme', profileState.theme) || 'light'
      };
      refreshCalculatedProfileMetricsFromForm(true);
      renderProfileUI();
      alert('Profile updated.');
    });
  }
}

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
    ['setupLayoutCustomizer', setupLayoutCustomizer]
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


