const _focus = {
  // State
  mode: 'pomodoro',          // 'pomodoro' | 'custom' | 'stopwatch'
  state: 'idle',             // 'idle' | 'running' | 'paused' | 'break' | 'finished'
  startTimestamp: null,       // Date.now() when timer started
  pauseTimestamp: null,       // Date.now() when paused
  elapsedPaused: 0,          // total ms spent paused
  totalDurationMs: 25 * 60 * 1000,
  intervalId: null,

  // Pomodoro config
  pomodoroFocus: 25,         // minutes
  pomodoroBreak: 5,          // minutes
  pomodoroSessions: 4,
  currentSession: 1,
  isBreak: false,

  // Custom
  customMinutes: 30,
  customLabel: '',

  // Stopwatch
  stopwatchElapsed: 0,

  // Audio
  audioPlaying: false,
  currentTrack: 'lofi',
  audioElement: null,
  audioVolume: 50,

  // Focus mode
  focusModeActive: false,
  whitelist: ['focus'],

  // Session tracking
  sessionStartIso: null,
  sessions: [],              // today's sessions (localStorage for demo)

  // Ring
  ringCircumference: 2 * Math.PI * 90, // r=90
};

// ─── Audio URLs (royalty-free ambient) ────────────────
const _focusAudioUrls = {
  lofi:       'https://cdn.pixabay.com/audio/2024/11/01/audio_38e7eb3237.mp3',
  rain:       'https://cdn.pixabay.com/audio/2025/03/06/audio_e51960ea1c.mp3',
  forest:     'https://cdn.pixabay.com/audio/2024/08/22/audio_bf2cf3691b.mp3',
  cafe:       'https://cdn.pixabay.com/audio/2022/02/22/audio_5e58532ff7.mp3',
  whitenoise: 'https://cdn.pixabay.com/audio/2024/04/16/audio_72856f498b.mp3',
};

// ─── SVG Gradient (inject once) ──────────────────────
function _focusInjectGradient() {
  const ring = document.querySelector('.focus-progress-ring');
  if (!ring || ring.querySelector('#focusGradient')) return;
  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
  defs.innerHTML = `
    <linearGradient id="focusGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#6366f1"/>
      <stop offset="100%" stop-color="#a78bfa"/>
    </linearGradient>`;
  ring.insertBefore(defs, ring.firstChild);
}

// ─── Init ────────────────────────────────────────────
function initFocusModule() {
  _focusInjectGradient();
  _focusLoadState();
  _focusRenderCycleDots();
  _focusUpdateDisplay();
  _focusLoadSessions();
  _focusUpdateSummary();

  // Visibility API — handle tab switches
  document.addEventListener('visibilitychange', _focusOnVisibilityChange);
}

// ─── Mode Switching ─────────────────────────────────
function switchFocusMode(mode) {
  if (_focus.state !== 'idle') {
    showToast('Stop the current timer first', 'warning');
    return;
  }
  _focus.mode = mode;

  document.querySelectorAll('.focus-mode-tab').forEach(t => t.classList.toggle('active', t.dataset.mode === mode));

  const pomSettings = document.getElementById('focus-pomodoro-settings');
  const customSettings = document.getElementById('focus-custom-settings');
  const cycleInd = document.getElementById('focus-cycle-indicator');

  pomSettings.style.display = mode === 'pomodoro' ? '' : 'none';
  customSettings.style.display = mode === 'custom' ? '' : 'none';
  cycleInd.style.display = mode === 'pomodoro' ? '' : 'none';

  if (mode === 'pomodoro') {
    _focus.totalDurationMs = _focus.pomodoroFocus * 60 * 1000;
  } else if (mode === 'custom') {
    _focus.totalDurationMs = _focus.customMinutes * 60 * 1000;
  } else {
    _focus.totalDurationMs = 0; // stopwatch counts up
  }

  _focus.currentSession = 1;
  _focus.isBreak = false;
  _focusRenderCycleDots();
  _focusUpdateDisplay();
  _focusSaveState();
}

// ─── Pomodoro Presets ───────────────────────────────
function setPomodoroDuration(min) {
  _focus.pomodoroFocus = min;
  _focus.totalDurationMs = min * 60 * 1000;
  document.querySelectorAll('#focus-pomodoro-settings .focus-setting-row:first-child .focus-preset')
    .forEach(b => b.classList.toggle('active', +b.dataset.minutes === min));
  _focusUpdateDisplay();
  _focusSaveState();
}
function setPomodoroBreak(min) {
  _focus.pomodoroBreak = min;
  document.querySelectorAll('#focus-pomodoro-settings .focus-setting-row:nth-child(2) .focus-preset')
    .forEach(b => b.classList.toggle('active', +b.dataset.minutes === min));
  _focusSaveState();
}
function setPomodoroSessions(n) {
  _focus.pomodoroSessions = n;
  document.querySelectorAll('#focus-pomodoro-settings .focus-setting-row:nth-child(3) .focus-preset')
    .forEach(b => b.classList.toggle('active', +b.dataset.sessions === n));
  _focus.currentSession = Math.min(_focus.currentSession, n);
  _focusRenderCycleDots();
  _focusSaveState();
}

// ─── Timer Controls ─────────────────────────────────
function focusTimerStart() {
  if (_focus.state !== 'idle') return;

  if (_focus.mode === 'custom') {
    const val = parseInt(document.getElementById('focus-custom-minutes').value) || 30;
    _focus.customMinutes = Math.max(1, Math.min(480, val));
    _focus.customLabel = (document.getElementById('focus-custom-label').value || '').trim();
    _focus.totalDurationMs = _focus.customMinutes * 60 * 1000;
  }

  _focus.state = 'running';
  _focus.startTimestamp = Date.now();
  _focus.pauseTimestamp = null;
  _focus.elapsedPaused = 0;
  _focus.sessionStartIso = new Date().toISOString();

  _focusStartInterval();
  _focusUpdateControls();
  _focusSaveState();

  document.querySelector('.focus-timer-card')?.classList.add('is-running');
}

function focusTimerPause() {
  if (_focus.state !== 'running') return;
  _focus.state = 'paused';
  _focus.pauseTimestamp = Date.now();
  clearInterval(_focus.intervalId);
  _focus.intervalId = null;
  _focusUpdateControls();
  _focusSaveState();
  document.querySelector('.focus-timer-card')?.classList.remove('is-running');
}

function focusTimerResume() {
  if (_focus.state !== 'paused') return;
  _focus.elapsedPaused += Date.now() - _focus.pauseTimestamp;
  _focus.pauseTimestamp = null;
  _focus.state = 'running';
  _focusStartInterval();
  _focusUpdateControls();
  _focusSaveState();
  document.querySelector('.focus-timer-card')?.classList.add('is-running');
}

function focusTimerStop() {
  if (_focus.state === 'idle') return;
  const elapsedMs = _focusGetElapsed();
  const actualMinutes = Math.round(elapsedMs / 60000);

  _focusLogSession(false, actualMinutes);
  _focusFullReset();
  showToast('Session stopped', 'info');
}

function focusTimerReset() {
  if (_focus.state === 'idle') return;
  _focusFullReset();
  showToast('Timer reset', 'info');
}

function _focusFullReset() {
  clearInterval(_focus.intervalId);
  _focus.intervalId = null;
  _focus.state = 'idle';
  _focus.startTimestamp = null;
  _focus.pauseTimestamp = null;
  _focus.elapsedPaused = 0;
  _focus.isBreak = false;
  if (_focus.mode === 'pomodoro') {
    _focus.currentSession = 1;
    _focus.totalDurationMs = _focus.pomodoroFocus * 60 * 1000;
  }
  _focusRenderCycleDots();
  _focusUpdateDisplay();
  _focusUpdateControls();
  _focusSaveState();
  document.querySelector('.focus-timer-card')?.classList.remove('is-running');
  document.querySelector('.focus-timer-card')?.classList.remove('focus-breathing');
}

// ─── Timer Engine ───────────────────────────────────
function _focusStartInterval() {
  clearInterval(_focus.intervalId);
  _focus.intervalId = setInterval(_focusTick, 250); // 4Hz for smooth ring
}

function _focusTick() {
  const elapsed = _focusGetElapsed();

  if (_focus.mode === 'stopwatch') {
    _focus.stopwatchElapsed = elapsed;
    _focusUpdateDisplay();
    return;
  }

  const remaining = Math.max(0, _focus.totalDurationMs - elapsed);

  _focusUpdateDisplay();

  if (remaining <= 0) {
    _focusTimerComplete();
  }
}

function _focusGetElapsed() {
  if (!_focus.startTimestamp) return 0;
  const now = _focus.state === 'paused' ? _focus.pauseTimestamp : Date.now();
  return now - _focus.startTimestamp - _focus.elapsedPaused;
}

function _focusTimerComplete() {
  clearInterval(_focus.intervalId);
  _focus.intervalId = null;

  // Play completion sound
  _focusPlayNotification();

  if (_focus.mode === 'pomodoro') {
    if (_focus.isBreak) {
      // Break finished → next focus session
      _focus.isBreak = false;
      _focus.currentSession++;
      if (_focus.currentSession > _focus.pomodoroSessions) {
        // All sessions done!
        const totalFocusMin = _focus.pomodoroFocus * _focus.pomodoroSessions;
        _focusLogSession(true, totalFocusMin);
        _focusFullReset();
        showToast(`All ${_focus.pomodoroSessions} pomodoro sessions complete! 🎉`, 'success');
        return;
      }
      _focus.totalDurationMs = _focus.pomodoroFocus * 60 * 1000;
      _focus.startTimestamp = Date.now();
      _focus.pauseTimestamp = null;
      _focus.elapsedPaused = 0;
      _focusStartInterval();
      _focusRenderCycleDots();
      _focusUpdateDisplay();
      document.querySelector('.focus-timer-card')?.classList.remove('focus-breathing');
      showToast(`Break over — Session ${_focus.currentSession} started!`, 'info');
    } else {
      // Focus session finished → start break
      _focusLogSession(true, _focus.pomodoroFocus);
      _focus.isBreak = true;
      const isLongBreak = _focus.currentSession >= _focus.pomodoroSessions;
      _focus.totalDurationMs = (isLongBreak ? _focus.pomodoroBreak * 3 : _focus.pomodoroBreak) * 60 * 1000;
      _focus.startTimestamp = Date.now();
      _focus.pauseTimestamp = null;
      _focus.elapsedPaused = 0;
      _focusStartInterval();
      _focusRenderCycleDots();
      _focusUpdateDisplay();
      document.querySelector('.focus-timer-card')?.classList.add('focus-breathing');
      showToast(`Session ${_focus.currentSession} done! Take a break ☕`, 'success');
    }
  } else {
    // Custom timer done
    const durMin = _focus.mode === 'custom' ? _focus.customMinutes : Math.round(_focusGetElapsed() / 60000);
    _focusLogSession(true, durMin);
    _focusFullReset();
    showToast('Timer complete! 🎉', 'success');
  }
}

// ─── Notification Sound ─────────────────────────────
function _focusPlayNotification() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 800;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.8);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.8);
    // Second beep
    setTimeout(() => {
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.frequency.value = 1000;
      osc2.type = 'sine';
      gain2.gain.setValueAtTime(0.3, ctx.currentTime);
      gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.6);
      osc2.start(ctx.currentTime);
      osc2.stop(ctx.currentTime + 0.6);
    }, 300);
  } catch(e) { /* no audio context support */ }
}

// ─── Display Updates ────────────────────────────────
function _focusUpdateDisplay() {
  const digits = document.getElementById('focus-timer-digits');
  const stateLabel = document.getElementById('focus-timer-state-label');
  const ring = document.getElementById('focus-ring-progress');
  if (!digits) return;

  if (_focus.mode === 'stopwatch') {
    const elapsed = _focus.state === 'idle' ? 0 : _focusGetElapsed();
    digits.textContent = _focusFormatTime(elapsed);
    stateLabel.textContent = _focus.state === 'idle' ? 'Ready' : _focus.state === 'paused' ? 'Paused' : 'Counting';
    // Ring: fill based on time, cycle every 60 min
    const pct = (elapsed % (60 * 60 * 1000)) / (60 * 60 * 1000);
    if (ring) ring.style.strokeDashoffset = _focus.ringCircumference * (1 - pct);
    return;
  }

  const elapsed = _focusGetElapsed();
  const remaining = Math.max(0, _focus.totalDurationMs - elapsed);
  digits.textContent = _focusFormatTime(remaining);

  if (_focus.state === 'idle') {
    stateLabel.textContent = 'Ready';
    if (ring) ring.style.strokeDashoffset = '0';
  } else if (_focus.isBreak) {
    stateLabel.textContent = 'Break';
  } else if (_focus.state === 'paused') {
    stateLabel.textContent = 'Paused';
  } else {
    stateLabel.textContent = _focus.mode === 'pomodoro' ? `Focus · Session ${_focus.currentSession}` : 'Focus';
  }

  // Progress ring
  if (ring && _focus.totalDurationMs > 0) {
    const pct = elapsed / _focus.totalDurationMs;
    ring.style.strokeDashoffset = _focus.ringCircumference * (1 - Math.min(1, pct));
  }
}

function _focusFormatTime(ms) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

function _focusUpdateControls() {
  const startBtn = document.getElementById('focus-start-btn');
  const pauseBtn = document.getElementById('focus-pause-btn');
  const resumeBtn = document.getElementById('focus-resume-btn');
  const stopBtn = document.getElementById('focus-stop-btn');
  const resetBtn = document.getElementById('focus-reset-btn');

  if (!startBtn) return;

  const s = _focus.state;
  startBtn.style.display = s === 'idle' ? '' : 'none';
  pauseBtn.style.display = s === 'running' ? '' : 'none';
  resumeBtn.style.display = s === 'paused' ? '' : 'none';
  stopBtn.style.display = (s === 'running' || s === 'paused') ? '' : 'none';
  resetBtn.style.display = s !== 'idle' ? '' : 'none';
}

// ─── Cycle Dots ─────────────────────────────────────
function _focusRenderCycleDots() {
  const container = document.getElementById('focus-cycle-dots');
  const currentEl = document.getElementById('focus-current-session');
  const totalEl = document.getElementById('focus-total-sessions');
  if (!container) return;

  totalEl.textContent = _focus.pomodoroSessions;
  currentEl.textContent = _focus.currentSession;

  let html = '';
  for (let i = 1; i <= _focus.pomodoroSessions; i++) {
    let cls = 'focus-cycle-dot';
    if (i < _focus.currentSession) cls += ' completed';
    if (i === _focus.currentSession && _focus.state !== 'idle') cls += ' active';
    if (i === _focus.currentSession && _focus.isBreak) cls += ' is-break';
    html += `<div class="${cls}"></div>`;
  }
  container.innerHTML = html;
}

// ─── Session Logging ────────────────────────────────
function _focusLogSession(completed, actualMinutes) {
  if (actualMinutes <= 0) return;

  const session = {
    mode: _focus.mode,
    durationPlanned: _focus.mode === 'pomodoro' ? _focus.pomodoroFocus : (_focus.mode === 'custom' ? _focus.customMinutes : 0),
    durationActual: actualMinutes,
    completed: completed,
    label: _focus.mode === 'custom' ? _focus.customLabel : (_focus.mode === 'pomodoro' ? `Pomodoro S${_focus.currentSession}` : 'Stopwatch'),
    date: new Date().toISOString().slice(0, 10),
    startedAt: _focus.sessionStartIso || new Date().toISOString(),
    endedAt: new Date().toISOString(),
  };

  // Save to API or localStorage
  if (typeof isDemoMode === 'function' && isDemoMode()) {
    const key = `focus_sessions_${session.date}`;
    const stored = JSON.parse(localStorage.getItem(key) || '[]');
    session.id = Date.now();
    stored.push(session);
    localStorage.setItem(key, JSON.stringify(stored));
  } else {
    fetch('/api/focus/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(session),
    }).catch(err => console.warn('Focus session save failed:', err));
  }

  _focus.sessions.push(session);
  _focusRenderSessions();
  _focusUpdateSummary();
}

function _focusLoadSessions() {
  const today = new Date().toISOString().slice(0, 10);

  if (typeof isDemoMode === 'function' && isDemoMode()) {
    const key = `focus_sessions_${today}`;
    _focus.sessions = JSON.parse(localStorage.getItem(key) || '[]');
    _focusRenderSessions();
    _focusUpdateSummary();
  } else {
    fetch(`/api/focus/sessions?date=${today}`)
      .then(r => r.json())
      .then(data => {
        _focus.sessions = data || [];
        _focusRenderSessions();
        _focusUpdateSummary();
      })
      .catch(() => {
        _focus.sessions = [];
        _focusRenderSessions();
      });
  }
}

function _focusRenderSessions() {
  const container = document.getElementById('focus-session-list');
  if (!container) return;

  if (_focus.sessions.length === 0) {
    container.innerHTML = `<div class="focus-empty-state"><i class="fas fa-hourglass-half"></i><p>No sessions yet today. Start a timer to begin!</p></div>`;
    return;
  }

  container.innerHTML = _focus.sessions.slice().reverse().map(s => {
    const icon = s.completed ? 'check-circle' : 'times-circle';
    const iconClass = s.completed ? 'completed' : 'abandoned';
    const modeLabel = s.mode === 'pomodoro' ? '🍅' : (s.mode === 'stopwatch' ? '⏱️' : '⏰');
    const label = s.label || s.mode;
    const time = s.startedAt ? new Date(s.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

    return `<div class="focus-session-item">
      <div class="focus-session-item-left">
        <div class="focus-session-icon ${iconClass}"><i class="fas fa-${icon}"></i></div>
        <div class="focus-session-info">
          <span class="focus-session-title">${modeLabel} ${label}</span>
          <span class="focus-session-meta">${time}${s.durationPlanned ? ` · Planned: ${s.durationPlanned}m` : ''}</span>
        </div>
      </div>
      <span class="focus-session-duration">${s.durationActual}m</span>
    </div>`;
  }).join('');
}

function _focusUpdateSummary() {
  const totalMin = _focus.sessions.reduce((sum, s) => sum + (s.durationActual || 0), 0);
  const completedCount = _focus.sessions.filter(s => s.completed).length;
  const totalCount = _focus.sessions.length;

  const minEl = document.getElementById('focus-total-minutes');
  const compEl = document.getElementById('focus-completed-count');
  const streakEl = document.getElementById('focus-streak-sessions');

  if (minEl) minEl.textContent = totalMin;
  if (compEl) compEl.textContent = completedCount;
  if (streakEl) streakEl.textContent = totalCount;
}

// ─── Audio ──────────────────────────────────────────
function selectFocusTrack(track) {
  _focus.currentTrack = track;
  document.querySelectorAll('.focus-audio-track').forEach(t => t.classList.toggle('active', t.dataset.track === track));

  if (_focus.audioPlaying) {
    _focusStopAudio();
    _focusPlayAudio();
  }
}

function toggleFocusAudio() {
  if (_focus.audioPlaying) {
    _focusStopAudio();
  } else {
    _focusPlayAudio();
  }
}

function _focusPlayAudio() {
  const url = _focusAudioUrls[_focus.currentTrack];
  if (!url) return;

  if (!_focus.audioElement) {
    _focus.audioElement = new Audio();
    _focus.audioElement.loop = true;
  }
  _focus.audioElement.src = url;
  _focus.audioElement.volume = _focus.audioVolume / 100;
  _focus.audioElement.play().catch(() => {});
  _focus.audioPlaying = true;

  const btn = document.getElementById('focus-audio-toggle');
  if (btn) btn.innerHTML = '<i class="fas fa-pause"></i>';
}

function _focusStopAudio() {
  if (_focus.audioElement) {
    _focus.audioElement.pause();
    _focus.audioElement.currentTime = 0;
  }
  _focus.audioPlaying = false;

  const btn = document.getElementById('focus-audio-toggle');
  if (btn) btn.innerHTML = '<i class="fas fa-play"></i>';
}

function setFocusVolume(val) {
  _focus.audioVolume = parseInt(val) || 50;
  if (_focus.audioElement) {
    _focus.audioElement.volume = _focus.audioVolume / 100;
  }
}

// ─── Focus Mode (UI Lock) ───────────────────────────
function toggleFocusMode() {
  if (_focus.focusModeActive) {
    _focusShowExitModal();
  } else {
    _focusEnterFocusMode();
  }
}

function _focusEnterFocusMode() {
  _focus.focusModeActive = true;
  document.body.classList.add('focus-mode-active');

  // Create overlay if needed
  let overlay = document.querySelector('.focus-mode-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'focus-mode-overlay';
    overlay.onclick = () => _focusShowExitModal();
    document.body.appendChild(overlay);
  }

  const focusModeBtn = document.getElementById('focus-mode-btn');
  if (focusModeBtn) {
    focusModeBtn.innerHTML = '<i class="fas fa-compress"></i> Exit Focus';
    focusModeBtn.classList.remove('focus-btn-primary');
    focusModeBtn.classList.add('focus-btn-danger');
  }

  showToast('Focus Mode ON — distractions hidden', 'info');
}

function _focusExitFocusMode() {
  _focus.focusModeActive = false;
  document.body.classList.remove('focus-mode-active');

  const overlay = document.querySelector('.focus-mode-overlay');
  if (overlay) overlay.remove();

  const modal = document.querySelector('.focus-exit-modal');
  if (modal) modal.remove();

  const focusModeBtn = document.getElementById('focus-mode-btn');
  if (focusModeBtn) {
    focusModeBtn.innerHTML = '<i class="fas fa-expand"></i> Focus Mode';
    focusModeBtn.classList.remove('focus-btn-danger');
    focusModeBtn.classList.add('focus-btn-primary');
  }

  showToast('Focus Mode OFF', 'info');
}

function _focusShowExitModal() {
  let modal = document.querySelector('.focus-exit-modal');
  if (modal) { modal.remove(); }

  modal = document.createElement('div');
  modal.className = 'focus-exit-modal active';
  modal.innerHTML = `
    <div class="focus-exit-modal-content">
      <h3>🎯 Exit Focus Mode?</h3>
      <p>You'll regain access to all pages and navigation. Your timer will keep running.</p>
      <div class="focus-exit-modal-actions">
        <button class="focus-btn focus-btn-secondary" onclick="document.querySelector('.focus-exit-modal').remove()">Stay Focused</button>
        <button class="focus-btn focus-btn-danger" onclick="_focusExitFocusMode()">Exit</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
}

// ─── Whitelist ──────────────────────────────────────
function updateFocusWhitelist() {
  const checks = document.querySelectorAll('#focus-whitelist-options input[type="checkbox"]:checked');
  _focus.whitelist = Array.from(checks).map(c => c.value);
  if (!_focus.whitelist.includes('focus')) _focus.whitelist.push('focus');
}

// ─── Visibility API ─────────────────────────────────
function _focusOnVisibilityChange() {
  if (_focus.state !== 'running') return;
  if (document.hidden) return; // timer keeps running via timestamps

  // When tab becomes visible again, force display update
  _focusUpdateDisplay();
}

// ─── Persist timer state in localStorage ────────────
function _focusSaveState() {
  const state = {
    mode: _focus.mode,
    state: _focus.state,
    startTimestamp: _focus.startTimestamp,
    pauseTimestamp: _focus.pauseTimestamp,
    elapsedPaused: _focus.elapsedPaused,
    totalDurationMs: _focus.totalDurationMs,
    pomodoroFocus: _focus.pomodoroFocus,
    pomodoroBreak: _focus.pomodoroBreak,
    pomodoroSessions: _focus.pomodoroSessions,
    currentSession: _focus.currentSession,
    isBreak: _focus.isBreak,
    customMinutes: _focus.customMinutes,
    customLabel: _focus.customLabel,
    sessionStartIso: _focus.sessionStartIso,
    audioVolume: _focus.audioVolume,
    currentTrack: _focus.currentTrack,
    whitelist: _focus.whitelist,
  };
  try { localStorage.setItem('focus_timer_state', JSON.stringify(state)); } catch(e) {}
}

function _focusLoadState() {
  try {
    const saved = JSON.parse(localStorage.getItem('focus_timer_state'));
    if (!saved) return;

    _focus.mode = saved.mode || 'pomodoro';
    _focus.pomodoroFocus = saved.pomodoroFocus || 25;
    _focus.pomodoroBreak = saved.pomodoroBreak || 5;
    _focus.pomodoroSessions = saved.pomodoroSessions || 4;
    _focus.customMinutes = saved.customMinutes || 30;
    _focus.customLabel = saved.customLabel || '';
    _focus.audioVolume = saved.audioVolume ?? 50;
    _focus.currentTrack = saved.currentTrack || 'lofi';
    _focus.whitelist = saved.whitelist || ['focus'];

    // Restore active timer
    if (saved.state === 'running' || saved.state === 'paused') {
      _focus.state = saved.state;
      _focus.startTimestamp = saved.startTimestamp;
      _focus.pauseTimestamp = saved.pauseTimestamp;
      _focus.elapsedPaused = saved.elapsedPaused || 0;
      _focus.totalDurationMs = saved.totalDurationMs;
      _focus.currentSession = saved.currentSession || 1;
      _focus.isBreak = saved.isBreak || false;
      _focus.sessionStartIso = saved.sessionStartIso;

      // Check if timer should have completed while away
      if (saved.state === 'running' && _focus.mode !== 'stopwatch') {
        const elapsed = _focusGetElapsed();
        if (elapsed >= _focus.totalDurationMs) {
          _focusTimerComplete();
          return;
        }
        _focusStartInterval();
      }

      _focusUpdateControls();
      if (saved.state === 'running') {
        document.querySelector('.focus-timer-card')?.classList.add('is-running');
      }
    }

    // Restore UI selections
    switchFocusMode(_focus.mode);

    // Restore volume slider
    const volSlider = document.getElementById('focus-volume-slider');
    if (volSlider) volSlider.value = _focus.audioVolume;

    // Restore track selection
    document.querySelectorAll('.focus-audio-track').forEach(t => t.classList.toggle('active', t.dataset.track === _focus.currentTrack));

    // Restore whitelist checkboxes
    document.querySelectorAll('#focus-whitelist-options input[type="checkbox"]:not(:disabled)').forEach(cb => {
      cb.checked = _focus.whitelist.includes(cb.value);
    });
  } catch(e) { console.warn('Focus state restore failed:', e); }
}
