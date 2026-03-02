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
  closeMobileSidebar();
  
  // Trigger page-specific animations
  if (pageName === 'streaks') {
    requestAnimationFrame(() => animateStreaksEntry());
  } else if (pageName === 'statistics') {
    requestAnimationFrame(() => animateStatisticsEntry());
  } else if (pageName === 'focus') {
    requestAnimationFrame(() => {
      _focusUpdateDisplay();
      _focusRenderSessions();
      _focusUpdateSummary();
    });
  }

  // Focus mode navigation guard
  if (_focus.focusModeActive && !_focus.whitelist.includes(pageName)) {
    _focusShowExitModal();
    // Re-navigate to focus
    const focusPage = document.getElementById('focus');
    if (focusPage) {
      document.querySelectorAll('.page-section').forEach(p => p.classList.remove('active'));
      focusPage.classList.add('active');
    }
    return;
  }
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

/* ── Mobile sidebar hamburger toggle ── */
function openMobileSidebar() {
  const sidebar = document.querySelector('.sidebar');
  const hamburger = document.getElementById('mobile-hamburger');
  const overlay = document.getElementById('sidebar-overlay');
  if (sidebar) sidebar.classList.add('is-open');
  if (hamburger) { hamburger.classList.add('is-open'); hamburger.setAttribute('aria-expanded', 'true'); }
  if (overlay) overlay.classList.add('is-visible');
}
function closeMobileSidebar() {
  const sidebar = document.querySelector('.sidebar');
  const hamburger = document.getElementById('mobile-hamburger');
  const overlay = document.getElementById('sidebar-overlay');
  if (sidebar) sidebar.classList.remove('is-open');
  if (hamburger) { hamburger.classList.remove('is-open'); hamburger.setAttribute('aria-expanded', 'false'); }
  if (overlay) overlay.classList.remove('is-visible');
}
(function initMobileMenu() {
  const hamburger = document.getElementById('mobile-hamburger');
  const overlay = document.getElementById('sidebar-overlay');
  if (hamburger) hamburger.addEventListener('click', function () {
    const sidebar = document.querySelector('.sidebar');
    if (sidebar && sidebar.classList.contains('is-open')) closeMobileSidebar();
    else openMobileSidebar();
  });
  if (overlay) overlay.addEventListener('click', closeMobileSidebar);
})();
