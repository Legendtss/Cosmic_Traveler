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
      /* ── Day 0 (today) ── protein ≈ 146 g ── */
      { id: 1001, name: 'Oats + banana', meal_type: 'breakfast', calories: 520, protein: 22, carbs: 78, fats: 12, date: isoDateOffset(0), time: '08:15' },
      { id: 1002, name: 'Chicken rice bowl', meal_type: 'lunch', calories: 760, protein: 48, carbs: 92, fats: 18, date: isoDateOffset(0), time: '13:05' },
      { id: 1006, name: 'Trail mix + banana', meal_type: 'snack', calories: 280, protein: 12, carbs: 34, fats: 12, date: isoDateOffset(0), time: '16:30' },
      { id: 1007, name: 'Rajma + rice + curd', meal_type: 'dinner', calories: 680, protein: 34, carbs: 82, fats: 20, date: isoDateOffset(0), time: '20:00' },
      { id: 1008, name: 'Whey protein shake', meal_type: 'snack', calories: 240, protein: 30, carbs: 8, fats: 4, date: isoDateOffset(0), time: '21:30' },
      /* ── Day −1 (yesterday) ── protein ≈ 140 g ── */
      { id: 1009, name: 'Masala omelette + toast', meal_type: 'breakfast', calories: 440, protein: 28, carbs: 32, fats: 18, date: isoDateOffset(-1), time: '08:00' },
      { id: 1010, name: 'Chicken keema + roti', meal_type: 'lunch', calories: 680, protein: 42, carbs: 54, fats: 24, date: isoDateOffset(-1), time: '13:15' },
      { id: 1003, name: 'Greek yogurt', meal_type: 'snack', calories: 220, protein: 18, carbs: 20, fats: 7, date: isoDateOffset(-1), time: '17:10' },
      { id: 1004, name: 'Paneer wrap', meal_type: 'dinner', calories: 640, protein: 36, carbs: 52, fats: 28, date: isoDateOffset(-1), time: '20:25' },
      { id: 1011, name: 'Roasted chana', meal_type: 'snack', calories: 200, protein: 16, carbs: 26, fats: 5, date: isoDateOffset(-1), time: '22:00' },
      /* ── Day −2 ── protein ≈ 140 g ── */
      { id: 1012, name: 'Egg bhurji + paratha', meal_type: 'breakfast', calories: 480, protein: 26, carbs: 36, fats: 22, date: isoDateOffset(-2), time: '07:45' },
      { id: 1013, name: 'Grilled chicken salad', meal_type: 'lunch', calories: 520, protein: 44, carbs: 24, fats: 18, date: isoDateOffset(-2), time: '13:00' },
      { id: 1005, name: 'Peanut smoothie', meal_type: 'snack', calories: 310, protein: 20, carbs: 24, fats: 14, date: isoDateOffset(-2), time: '16:40' },
      { id: 1014, name: 'Curd rice + pickle', meal_type: 'dinner', calories: 460, protein: 18, carbs: 62, fats: 12, date: isoDateOffset(-2), time: '20:30' },
      { id: 1015, name: 'Paneer tikka (3 pcs)', meal_type: 'snack', calories: 340, protein: 32, carbs: 10, fats: 20, date: isoDateOffset(-2), time: '22:15' }
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
      /* ── Day 0 ── */
      { id: 2001, name: 'Campus Run', type: 'cardio', intensity: 'medium', duration: 35, calories_burned: 280, date: isoDateOffset(0), time: '06:45', completed: true, notes: '', exercises: [] },
      /* ── Day +1 (upcoming) ── */
      { id: 2002, name: 'Leg Strength', type: 'strength', intensity: 'high', duration: 55, calories_burned: 420, date: isoDateOffset(1), time: '18:00', completed: false, notes: '', exercises: [{ name: 'Squat', sets: 4, reps: 8, weight: 80 }] },
      /* ── Day −1 ── */
      { id: 2004, name: 'HIIT Circuit', type: 'cardio', intensity: 'high', duration: 30, calories_burned: 350, date: isoDateOffset(-1), time: '17:30', completed: true, notes: '', exercises: [] },
      /* ── Day −2 ── */
      { id: 2003, name: 'Mobility Session', type: 'flexibility', intensity: 'low', duration: 25, calories_burned: 110, date: isoDateOffset(-2), time: '07:00', completed: true, notes: '', exercises: [] }
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
      /* ── Day 0 (today) ── protein ≈ 140 g ── */
      { id: 1101, name: 'Egg sandwich', meal_type: 'breakfast', calories: 430, protein: 24, carbs: 38, fats: 16, date: isoDateOffset(0), time: '07:40' },
      { id: 1102, name: 'Office thali', meal_type: 'lunch', calories: 690, protein: 30, carbs: 88, fats: 20, date: isoDateOffset(0), time: '13:20' },
      { id: 1106, name: 'Grilled chicken wrap', meal_type: 'snack', calories: 360, protein: 32, carbs: 28, fats: 14, date: isoDateOffset(0), time: '16:45' },
      { id: 1107, name: 'Salmon + steamed veggies', meal_type: 'dinner', calories: 680, protein: 46, carbs: 32, fats: 26, date: isoDateOffset(0), time: '20:30' },
      { id: 1108, name: 'Mixed nuts handful', meal_type: 'snack', calories: 220, protein: 8, carbs: 10, fats: 18, date: isoDateOffset(0), time: '22:00' },
      /* ── Day −1 (yesterday) ── protein ≈ 142 g ── */
      { id: 1109, name: 'Egg white omelette + toast', meal_type: 'breakfast', calories: 380, protein: 32, carbs: 28, fats: 12, date: isoDateOffset(-1), time: '07:30' },
      { id: 1110, name: 'Turkey club sandwich', meal_type: 'lunch', calories: 540, protein: 36, carbs: 42, fats: 18, date: isoDateOffset(-1), time: '13:00' },
      { id: 1103, name: 'Protein shake', meal_type: 'snack', calories: 260, protein: 30, carbs: 14, fats: 8, date: isoDateOffset(-1), time: '18:10' },
      { id: 1104, name: 'Grilled fish + quinoa', meal_type: 'dinner', calories: 610, protein: 44, carbs: 46, fats: 22, date: isoDateOffset(-1), time: '20:45' },
      /* ── Day −2 ── protein ≈ 140 g ── */
      { id: 1111, name: 'Masala oats + boiled egg', meal_type: 'breakfast', calories: 420, protein: 22, carbs: 48, fats: 14, date: isoDateOffset(-2), time: '07:45' },
      { id: 1112, name: 'Chicken biryani + raita', meal_type: 'lunch', calories: 740, protein: 38, carbs: 86, fats: 22, date: isoDateOffset(-2), time: '13:30' },
      { id: 1105, name: 'Fruit + nuts bowl', meal_type: 'snack', calories: 280, protein: 10, carbs: 24, fats: 16, date: isoDateOffset(-2), time: '16:30' },
      { id: 1113, name: 'Tofu stir fry + brown rice', meal_type: 'dinner', calories: 560, protein: 34, carbs: 56, fats: 16, date: isoDateOffset(-2), time: '20:15' },
      { id: 1114, name: 'Whey protein shake', meal_type: 'snack', calories: 280, protein: 36, carbs: 10, fats: 4, date: isoDateOffset(-2), time: '21:45' }
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
      /* ── Day 0 ── */
      { id: 2101, name: 'Lunch Break HIIT', type: 'cardio', intensity: 'high', duration: 28, calories_burned: 340, date: isoDateOffset(0), time: '12:30', completed: true, notes: '', exercises: [] },
      /* ── Day +2 (upcoming) ── */
      { id: 2102, name: 'Upper Body Strength', type: 'strength', intensity: 'medium', duration: 45, calories_burned: 320, date: isoDateOffset(2), time: '19:15', completed: false, notes: '', exercises: [{ name: 'Bench Press', sets: 4, reps: 6, weight: 75 }] },
      /* ── Day −1 ── */
      { id: 2103, name: 'Desk Stretch Flow', type: 'flexibility', intensity: 'low', duration: 20, calories_burned: 90, date: isoDateOffset(-1), time: '21:00', completed: true, notes: '', exercises: [] },
      /* ── Day −2 ── */
      { id: 2104, name: 'Morning Jog', type: 'cardio', intensity: 'medium', duration: 30, calories_burned: 260, date: isoDateOffset(-2), time: '06:30', completed: true, notes: '', exercises: [] }
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
      /* ── Day 0 (today) ── protein ≈ 164 g ── */
      { id: 1201, name: 'Avocado toast + eggs', meal_type: 'breakfast', calories: 610, protein: 30, carbs: 48, fats: 32, date: isoDateOffset(0), time: '08:05' },
      { id: 1202, name: 'Lean turkey pasta', meal_type: 'lunch', calories: 840, protein: 56, carbs: 98, fats: 22, date: isoDateOffset(0), time: '14:00' },
      { id: 1206, name: 'Grilled chicken + sweet potato', meal_type: 'dinner', calories: 720, protein: 48, carbs: 62, fats: 20, date: isoDateOffset(0), time: '20:00' },
      { id: 1207, name: 'Recovery whey smoothie', meal_type: 'snack', calories: 340, protein: 30, carbs: 28, fats: 8, date: isoDateOffset(0), time: '21:30' },
      /* ── Day −1 (yesterday) ── protein ≈ 164 g ── */
      { id: 1208, name: 'Scrambled eggs + avocado toast', meal_type: 'breakfast', calories: 580, protein: 34, carbs: 42, fats: 28, date: isoDateOffset(-1), time: '07:50' },
      { id: 1209, name: 'Grilled steak + quinoa bowl', meal_type: 'lunch', calories: 780, protein: 50, carbs: 64, fats: 24, date: isoDateOffset(-1), time: '13:30' },
      { id: 1203, name: 'Fruit + whey bowl', meal_type: 'snack', calories: 350, protein: 28, carbs: 42, fats: 8, date: isoDateOffset(-1), time: '17:45' },
      { id: 1204, name: 'Salmon rice plate', meal_type: 'dinner', calories: 760, protein: 52, carbs: 68, fats: 26, date: isoDateOffset(-1), time: '21:10' },
      /* ── Day −2 ── protein ≈ 164 g ── */
      { id: 1205, name: 'Overnight oats jar', meal_type: 'breakfast', calories: 490, protein: 26, carbs: 58, fats: 15, date: isoDateOffset(-2), time: '07:55' },
      { id: 1210, name: 'Chicken tikka + brown rice', meal_type: 'lunch', calories: 720, protein: 48, carbs: 76, fats: 18, date: isoDateOffset(-2), time: '13:15' },
      { id: 1211, name: 'Lean beef + veggie stir fry', meal_type: 'dinner', calories: 680, protein: 44, carbs: 38, fats: 26, date: isoDateOffset(-2), time: '20:00' },
      { id: 1212, name: 'Greek yogurt parfait', meal_type: 'snack', calories: 320, protein: 28, carbs: 30, fats: 8, date: isoDateOffset(-2), time: '16:30' },
      { id: 1213, name: 'Post-workout shake', meal_type: 'snack', calories: 280, protein: 18, carbs: 22, fats: 6, date: isoDateOffset(-2), time: '22:00' }
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
      /* ── Day 0 ── */
      { id: 2201, name: 'Powerlifting Session', type: 'strength', intensity: 'high', duration: 70, calories_burned: 560, date: isoDateOffset(0), time: '07:15', completed: true, notes: '', exercises: [{ name: 'Deadlift', sets: 5, reps: 5, weight: 140 }] },
      /* ── Day +1 (upcoming) ── */
      { id: 2202, name: 'Stair Sprint Intervals', type: 'cardio', intensity: 'high', duration: 40, calories_burned: 470, date: isoDateOffset(1), time: '16:20', completed: false, notes: '', exercises: [] },
      /* ── Day −1 ── */
      { id: 2203, name: 'Recovery Yoga', type: 'flexibility', intensity: 'low', duration: 30, calories_burned: 120, date: isoDateOffset(-1), time: '20:30', completed: true, notes: '', exercises: [] },
      /* ── Day −2 ── */
      { id: 2204, name: 'Push Day — Chest & Shoulders', type: 'strength', intensity: 'high', duration: 60, calories_burned: 480, date: isoDateOffset(-2), time: '08:00', completed: true, notes: '', exercises: [{ name: 'Bench Press', sets: 4, reps: 8, weight: 90 }, { name: 'OHP', sets: 3, reps: 10, weight: 45 }] }
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
  // Final streak evaluation with ALL data loaded (tasks + meals + workouts)
  refreshStreaksAfterChange();
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
