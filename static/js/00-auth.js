/* ════════════════════════════════════════════════════════════
   00-auth.js — Authentication Module
   ════════════════════════════════════════════════════════════
   Handles signup, login, logout, and session check.
   Loaded BEFORE script.js so that the auth state is available
   during the legacy bootstrap.

   Exposes on window:
     AuthModule.checkSession()   → Promise<user|null>
     AuthModule.login(email, pw) → Promise<{ok, user?, errors?}>
     AuthModule.signup(...)      → Promise<{ok, user?, errors?}>
     AuthModule.logout()         → Promise<void>
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

  async function logout() {
    await _post('/api/auth/logout', {});
    _currentUser = null;
  }

  async function updateProfile(fields) {
    const res = await fetch('/api/auth/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(fields),
    });
    const data = await res.json();
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
    get currentUser() { return _currentUser; },
  };
})();


/* ── Auth UI wiring ────────────────────────────────────────── */

(function initAuthUI() {
  'use strict';

  const loginForm = document.getElementById('auth-login-form');
  const signupForm = document.getElementById('auth-signup-form');
  const showSignupLink = document.getElementById('show-signup');
  const showLoginLink = document.getElementById('show-login');
  const loginError = document.getElementById('login-error');
  const signupError = document.getElementById('signup-error');

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
          _onAuthSuccess(data.user, false);
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
          _onAuthSuccess(data.user, true);
        } else {
          _showError(signupError, data.errors);
        }
      } catch (err) {
        _showError(signupError, ['Network error. Please try again.']);
      }
    });
  }

  // ── Helpers ────────────────────────────────────────────────

  function _showError(el, errors) {
    if (!el) return;
    el.textContent = (errors || ['Something went wrong.']).join(' ');
    el.classList.remove('hidden');
  }

  function _onAuthSuccess(user, isNewUser) {
    // Hide auth screen
    const authScreen = document.getElementById('auth-screen');
    if (authScreen) authScreen.classList.add('hidden');

    if (isNewUser) {
      // Show onboarding for new signups
      const onboarding = document.getElementById('demo-onboarding');
      const subtitle = document.getElementById('demo-onboarding-subtitle');
      if (subtitle) subtitle.textContent = `Welcome ${user.displayName}! Choose what you want to enable.`;
      if (onboarding) onboarding.classList.remove('hidden');
    } else {
      // Returning user — go straight to app
      _showApp(user);
    }
  }

  function _showApp(user) {
    const app = document.getElementById('app-wrapper');
    if (app) app.style.display = 'grid';

    // Apply user context to the legacy profile state
    if (typeof profileState !== 'undefined' && user) {
      profileState.fullName = user.displayName || profileState.fullName;
      profileState.email = user.email || profileState.email;
      profileState.level = user.level || profileState.level;
      profileState.goal = user.goal || profileState.goal;
    }
    if (typeof dashboardState !== 'undefined' && user) {
      dashboardState.weeklyWorkoutTarget = user.weeklyWorkoutTarget || dashboardState.weeklyWorkoutTarget;
      dashboardState.calorieGoal = user.calorieGoal || dashboardState.calorieGoal;
    }
    if (typeof syncNutritionGoalWithProfile === 'function') syncNutritionGoalWithProfile();
    if (typeof renderProfileUI === 'function') renderProfileUI();
  }

  // Expose _showApp so script.js bootstrap can call it after onboarding
  window._authShowApp = _showApp;
})();
