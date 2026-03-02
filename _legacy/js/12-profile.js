
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
