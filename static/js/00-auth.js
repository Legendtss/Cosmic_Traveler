/* ════════════════════════════════════════════════════════════
   00-auth.js — Authentication & Onboarding Module
   ════════════════════════════════════════════════════════════
   Handles signup, login, logout, session check, and onboarding flow.
   Loaded BEFORE script.js so that the auth state is available
   during the legacy bootstrap.

   Routing State Machine:
     unauthenticated          → intro-screen
     authenticated (new)      → demo-tour → profile-essentials → app
     authenticated (complete) → app

   Exposes on window:
     AuthModule.checkSession()   → Promise<user|null>
     AuthModule.login(email, pw) → Promise<{ok, user?, errors?}>
     AuthModule.signup(...)      → Promise<{ok, user?, errors?}>
     AuthModule.logout()         → Promise<void>
     AuthModule.updateOnboarding({introSeen, demoCompleted})
     AuthModule.updateProfileEssentials({age, height, ...})
     AuthModule.currentUser      → user object or null
   ──────────────────────────────────────────────────────────── */

window.AuthModule = (() => {
  'use strict';

  let _currentUser = null;

  // ── API helpers ──────────────────────────────────────────

  async function _post(url, body) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(body),
    });
    return res.json();
  }

  async function _put(url, body) {
    const res = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(body),
    });
    return res.json();
  }

  async function _get(url) {
    const res = await fetch(url, { credentials: 'same-origin' });
    return res.json();
  }

  // ── Public API ───────────────────────────────────────────

  async function checkSession() {
    try {
      const data = await _get('/api/auth/me');
      if (data.ok && data.user) {
        _currentUser = data.user;
        return data.user;
      }
    } catch (_e) { /* no session */ }
    _currentUser = null;
    return null;
  }

  async function signup({ displayName, email, password }) {
    const data = await _post('/api/auth/signup', { displayName, email, password });
    if (data.ok && data.user) {
      _currentUser = data.user;
    }
    return data;
  }

  async function login(email, password) {
    const data = await _post('/api/auth/login', { email, password });
    if (data.ok && data.user) {
      _currentUser = data.user;
    }
    return data;
  }

  function _clearBrowserState() {
    try {
      const keysToRemove = [];
      for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index);
        if (key && key.startsWith('focus_timer_state')) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
      sessionStorage.removeItem('fittrack_ai_session_id_v1');
    } catch (_e) {
      // Ignore storage cleanup failures and continue logout.
    }
  }

  async function logout() {
    await _post('/api/auth/logout', {});
    _clearBrowserState();
    _currentUser = null;
    // Reload page to clear all in-memory state (AppState, task lists, etc.)
    // This prevents any data leaking to the next user on the same device.
    window.location.reload();
  }

  async function updateProfile(fields) {
    const data = await _put('/api/auth/profile', fields);
    if (data.ok && data.user) {
      _currentUser = data.user;
    }
    return data;
  }

  async function updateOnboarding(flags) {
    const data = await _put('/api/auth/onboarding', flags);
    if (data.ok && data.user) {
      _currentUser = data.user;
    }
    return data;
  }

  async function updateProfileEssentials(essentials) {
    const data = await _put('/api/auth/profile-essentials', essentials);
    if (data.ok && data.user) {
      _currentUser = data.user;
    }
    return data;
  }

  return {
    checkSession,
    signup,
    login,
    logout,
    updateProfile,
    updateOnboarding,
    updateProfileEssentials,
    get currentUser() { return _currentUser; },
  };
})();


/* ══════════════════════════════════════════════════════════════
   Auth & Onboarding UI Controller
   ══════════════════════════════════════════════════════════════ */

(function initAuthUI() {
  'use strict';

  // ── DOM References ─────────────────────────────────────────
  const introScreen = document.getElementById('intro-screen');
  const authScreen = document.getElementById('auth-screen');
  const demoTour = document.getElementById('demo-tour');
  const profileEssentials = document.getElementById('profile-essentials');
  const appWrapper = document.getElementById('app-wrapper');

  const loginForm = document.getElementById('auth-login-form');
  const signupForm = document.getElementById('auth-signup-form');
  const showSignupLink = document.getElementById('show-signup');
  const showLoginLink = document.getElementById('show-login');
  const loginError = document.getElementById('login-error');
  const signupError = document.getElementById('signup-error');

  // Demo tour state
  let _demoStep = 1;
  const _demoTotalSteps = 4;

  // ══════════════════════════════════════════════════════════
  // ROUTING STATE MACHINE
  // ══════════════════════════════════════════════════════════

  function _hideAllScreens() {
    [introScreen, authScreen, demoTour, profileEssentials].forEach(el => {
      if (el) el.classList.add('hidden');
    });
    if (appWrapper) appWrapper.style.display = 'none';
  }

  function _showScreen(screenId) {
    _hideAllScreens();
    const screen = document.getElementById(screenId);
    if (screen) {
      screen.classList.remove('hidden');
      if (screenId === 'app-wrapper' && appWrapper) {
        appWrapper.style.display = 'grid';
      }
    }
  }

  /**
   * Determine and navigate to the correct screen based on auth/onboarding state.
   * @param {object|null} user - Current user or null if unauthenticated
   * @param {boolean} isNewSignup - True if user just signed up this session
   */
  function _routeToCorrectScreen(user, isNewSignup = false) {
    if (!user) {
      // Unauthenticated → intro landing page
      _showScreen('intro-screen');
      return;
    }

    const onboarding = user.onboarding || {};

    // Check if profile essentials are completed
    if (onboarding.profileEssentialsCompletedAt) {
      // Fully onboarded → show app
      _showApp(user);
      return;
    }

    // New user flow: demo tour → profile essentials
    if (isNewSignup || !onboarding.demoCompletedAt) {
      // Show demo tour (can be skipped)
      _showScreen('demo-tour');
      _initDemoTour();
      return;
    }

    // Demo completed but profile essentials not done
    _showScreen('profile-essentials');
  }

  // ══════════════════════════════════════════════════════════
  // INTRO SCREEN HANDLERS
  // ══════════════════════════════════════════════════════════

  function _initIntroHandlers() {
    const getStartedBtn = document.getElementById('intro-get-started');
    const loginBtn = document.getElementById('intro-login');
    const footerCta = document.getElementById('intro-footer-cta');

    if (getStartedBtn) {
      getStartedBtn.addEventListener('click', () => {
        _showScreen('auth-screen');
        // Show signup form
        if (loginForm) loginForm.classList.add('hidden');
        if (signupForm) signupForm.classList.remove('hidden');
      });
    }

    if (loginBtn) {
      loginBtn.addEventListener('click', () => {
        _showScreen('auth-screen');
        // Show login form
        if (signupForm) signupForm.classList.add('hidden');
        if (loginForm) loginForm.classList.remove('hidden');
      });
    }

    if (footerCta) {
      footerCta.addEventListener('click', () => {
        _showScreen('auth-screen');
        if (loginForm) loginForm.classList.add('hidden');
        if (signupForm) signupForm.classList.remove('hidden');
      });
    }
  }

  // ══════════════════════════════════════════════════════════
  // AUTH FORM HANDLERS
  // ══════════════════════════════════════════════════════════

  // Toggle between login / signup forms
  if (showSignupLink) {
    showSignupLink.addEventListener('click', (e) => {
      e.preventDefault();
      loginForm.classList.add('hidden');
      signupForm.classList.remove('hidden');
      if (loginError) loginError.classList.add('hidden');
    });
  }
  if (showLoginLink) {
    showLoginLink.addEventListener('click', (e) => {
      e.preventDefault();
      signupForm.classList.add('hidden');
      loginForm.classList.remove('hidden');
      if (signupError) signupError.classList.add('hidden');
    });
  }

  // ── Login submit ──────────────────────────────────────────
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (loginError) loginError.classList.add('hidden');

      const email = document.getElementById('login-email').value.trim();
      const password = document.getElementById('login-password').value;

      try {
        const data = await AuthModule.login(email, password);
        if (data.ok) {
          _routeToCorrectScreen(data.user, false);
        } else {
          _showError(loginError, data.errors);
        }
      } catch (err) {
        _showError(loginError, ['Network error. Please try again.']);
      }
    });
  }

  // ── Signup submit ─────────────────────────────────────────
  if (signupForm) {
    signupForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (signupError) signupError.classList.add('hidden');

      const displayName = document.getElementById('signup-name').value.trim();
      const email = document.getElementById('signup-email').value.trim();
      const password = document.getElementById('signup-password').value;

      try {
        const data = await AuthModule.signup({ displayName, email, password });
        if (data.ok) {
          // Mark intro as seen for new signups
          await AuthModule.updateOnboarding({ introSeen: true });
          _routeToCorrectScreen(data.user, true);
        } else {
          _showError(signupError, data.errors);
        }
      } catch (err) {
        _showError(signupError, ['Network error. Please try again.']);
      }
    });
  }

  // ══════════════════════════════════════════════════════════
  // DEMO TOUR HANDLERS
  // ══════════════════════════════════════════════════════════

  function _initDemoTour() {
    _demoStep = 1;
    _updateDemoTourUI();
  }

  function _updateDemoTourUI() {
    // Update progress dots
    document.querySelectorAll('.demo-tour-dot').forEach(dot => {
      const step = parseInt(dot.dataset.step, 10);
      dot.classList.toggle('active', step === _demoStep);
      dot.classList.toggle('completed', step < _demoStep);
    });

    // Update step cards
    document.querySelectorAll('.demo-tour-step').forEach(card => {
      const step = parseInt(card.dataset.step, 10);
      card.classList.toggle('active', step === _demoStep);
    });

    // Update buttons
    const prevBtn = document.getElementById('demo-tour-prev');
    const nextBtn = document.getElementById('demo-tour-next');

    if (prevBtn) prevBtn.disabled = _demoStep === 1;
    if (nextBtn) {
      nextBtn.textContent = _demoStep === _demoTotalSteps ? 'Continue' : 'Next';
    }
  }

  function _initDemoTourHandlers() {
    const prevBtn = document.getElementById('demo-tour-prev');
    const nextBtn = document.getElementById('demo-tour-next');
    const skipBtn = document.getElementById('demo-tour-skip');

    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        if (_demoStep > 1) {
          _demoStep--;
          _updateDemoTourUI();
        }
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener('click', async () => {
        if (_demoStep < _demoTotalSteps) {
          _demoStep++;
          _updateDemoTourUI();
        } else {
          // Demo completed → go to profile essentials
          await AuthModule.updateOnboarding({ demoCompleted: true });
          _showScreen('profile-essentials');
        }
      });
    }

    if (skipBtn) {
      skipBtn.addEventListener('click', async () => {
        // Skip demo → mark as completed and go to profile essentials
        await AuthModule.updateOnboarding({ demoCompleted: true });
        _showScreen('profile-essentials');
      });
    }
  }

  // ══════════════════════════════════════════════════════════
  // PROFILE ESSENTIALS HANDLERS
  // ══════════════════════════════════════════════════════════

  function _initProfileEssentialsHandlers() {
    const form = document.getElementById('profile-essentials-form');
    const submitBtn = document.getElementById('profile-essentials-submit');
    const globalError = document.getElementById('profile-essentials-global-error');

    // Form fields
    const ageInput = document.getElementById('pe-age');
    const heightInput = document.getElementById('pe-height');
    const weightInput = document.getElementById('pe-weight');
    const goalSelect = document.getElementById('pe-goal');
    const activitySelect = document.getElementById('pe-activity');

    // Real-time validation
    function validateForm() {
      const errors = [];
      let isValid = true;

      // Clear previous errors
      document.querySelectorAll('.profile-essentials-error').forEach(el => {
        el.textContent = '';
      });

      // Validate age
      const age = parseFloat(ageInput?.value);
      if (!age || age < 10 || age > 120) {
        isValid = false;
        _setFieldError('age', 'Age must be 10-120');
      }

      // Validate height
      const height = parseFloat(heightInput?.value);
      if (!height || height < 50 || height > 300) {
        isValid = false;
        _setFieldError('height', 'Height must be 50-300 cm');
      }

      // Validate weight
      const weight = parseFloat(weightInput?.value);
      if (!weight || weight < 20 || weight > 500) {
        isValid = false;
        _setFieldError('currentWeight', 'Weight must be 20-500 kg');
      }

      // Validate goal
      if (!goalSelect?.value) {
        isValid = false;
        _setFieldError('goal', 'Please select a goal');
      }

      // Validate activity level
      if (!activitySelect?.value) {
        isValid = false;
        _setFieldError('activityLevel', 'Please select activity level');
      }

      // Enable/disable submit button
      if (submitBtn) submitBtn.disabled = !isValid;

      return isValid;
    }

    function _setFieldError(field, message) {
      const errorEl = document.querySelector(`.profile-essentials-error[data-field="${field}"]`);
      if (errorEl) errorEl.textContent = message;
    }

    // Add input listeners for real-time validation
    [ageInput, heightInput, weightInput, goalSelect, activitySelect].forEach(el => {
      if (el) {
        el.addEventListener('input', validateForm);
        el.addEventListener('change', validateForm);
      }
    });

    // Form submit
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (!validateForm()) return;

        // Hide any previous global error
        if (globalError) globalError.classList.add('hidden');

        // Disable button and show loading state
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.textContent = 'Saving...';
        }

        try {
          const data = await AuthModule.updateProfileEssentials({
            age: parseInt(ageInput.value, 10),
            height: parseInt(heightInput.value, 10),
            currentWeight: parseFloat(weightInput.value),
            goal: goalSelect.value,
            activityLevel: activitySelect.value,
          });

          if (data.ok) {
            // Success → show app
            _showApp(data.user);
          } else {
            // Show server-side errors
            if (globalError) {
              globalError.textContent = (data.errors || ['Something went wrong.']).join(' ');
              globalError.classList.remove('hidden');
            }
            if (submitBtn) {
              submitBtn.disabled = false;
              submitBtn.textContent = 'Complete Setup';
            }
          }
        } catch (err) {
          if (globalError) {
            globalError.textContent = 'Network error. Please try again.';
            globalError.classList.remove('hidden');
          }
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Complete Setup';
          }
        }
      });
    }
  }

  // ══════════════════════════════════════════════════════════
  // SHOW APP (after successful auth/onboarding)
  // ══════════════════════════════════════════════════════════

  function _showApp(user) {
    _hideAllScreens();
    if (appWrapper) appWrapper.style.display = 'grid';

    // Apply user context to the legacy profile state
    if (typeof profileState !== 'undefined' && user) {
      profileState.fullName = user.displayName || profileState.fullName;
      profileState.email = user.email || profileState.email;
      profileState.level = user.level || profileState.level;
      profileState.goal = user.goal || profileState.goal;
      // Apply new profile essentials
      if (user.age) profileState.age = user.age;
      if (user.height) profileState.height = user.height;
      if (user.currentWeight) profileState.currentWeight = user.currentWeight;
    }
    if (typeof dashboardState !== 'undefined' && user) {
      dashboardState.weeklyWorkoutTarget = user.weeklyWorkoutTarget || dashboardState.weeklyWorkoutTarget;
      dashboardState.calorieGoal = user.calorieGoal || dashboardState.calorieGoal;
    }
    if (typeof syncNutritionGoalWithProfile === 'function') syncNutritionGoalWithProfile();
    if (typeof renderProfileUI === 'function') renderProfileUI();
  }

  // ══════════════════════════════════════════════════════════
  // HELPERS
  // ══════════════════════════════════════════════════════════

  function _showError(el, errors) {
    if (!el) return;
    el.textContent = (errors || ['Something went wrong.']).join(' ');
    el.classList.remove('hidden');
  }

  // ══════════════════════════════════════════════════════════
  // INITIALIZATION
  // ══════════════════════════════════════════════════════════

  // Initialize all handlers
  _initIntroHandlers();
  _initDemoTourHandlers();
  _initProfileEssentialsHandlers();

  // Expose functions for external use
  window._authShowApp = _showApp;
  window._authRouteToCorrectScreen = _routeToCorrectScreen;
})();
