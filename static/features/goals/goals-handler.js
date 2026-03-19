/**
 * Goals Feature Handler
 * Manages goal creation, updating, sharing, and progressive blur reveal system
 */

// ==================== CLASH ROYALE 3D CARD SYSTEM ====================
// State tracking for all goal cards (independent per card instance)
const goalCardStates = new Map();

const crCardSystem = {
  // Constants
  COLS: 2,
  ROWS: 2,
  TOTAL: 4,
  CARD_W: 280,
  CARD_H: 360,
  SNIPPET_W: 54,
  SNIPPET_H: 64,
  isReducedMotion: function() {
    return typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  },
  scheduleTimeout: function(state, fn, delay) {
    if (!state) return null;
    if (!state.timeoutIds) state.timeoutIds = new Set();
    const id = setTimeout(() => {
      state.timeoutIds?.delete(id);
      fn();
    }, delay);
    state.timeoutIds.add(id);
    return id;
  },
  clearTimersAndFrames: function(state) {
    if (!state) return;
    if (state.timeoutIds) {
      state.timeoutIds.forEach((id) => clearTimeout(id));
      state.timeoutIds.clear();
    }
    if (state.rafId) {
      cancelAnimationFrame(state.rafId);
      state.rafId = null;
    }
    if (state.revealRafId) {
      cancelAnimationFrame(state.revealRafId);
      state.revealRafId = null;
    }
    if (state.particleRafId) {
      cancelAnimationFrame(state.particleRafId);
      state.particleRafId = null;
    }
  },
  unbindCardTilt: function(goalId) {
    const state = goalCardStates.get(goalId);
    if (!state || !state.sceneEl || !state.handlers) return;
    state.sceneEl.removeEventListener('mouseenter', state.handlers.mouseEnter);
    state.sceneEl.removeEventListener('mousemove', state.handlers.mouseMove);
    state.sceneEl.removeEventListener('mouseleave', state.handlers.mouseLeave);
    state.sceneEl.removeEventListener('touchmove', state.handlers.touchMove);
    state.sceneEl.removeEventListener('touchend', state.handlers.touchEnd);
    state.sceneEl = null;
    state.handlers = null;
    state.listenersBound = false;
  },
  destroyGoalCanvas: function(goalId, keepState = false) {
    const state = goalCardStates.get(goalId);
    if (!state) return;
    this.clearTimersAndFrames(state);
    this.unbindCardTilt(goalId);
    state.autoRotate = false;
    state.dragActive = false;
    state.isAnimating = false;
    state.flyingGhosts?.forEach((ghost) => ghost.remove());
    state.flyingGhosts?.clear();
    state.snippetCanvases?.forEach((thumb) => {
      if (thumb) {
        thumb.width = 1;
        thumb.height = 1;
      }
    });
    state.snippetCanvases?.clear();
    if (state.sourceCanvas) {
      state.sourceCanvas.width = 1;
      state.sourceCanvas.height = 1;
      state.sourceCanvas = null;
    }
    const mainCanvas = document.getElementById(`mainCanvas-${goalId}`);
    if (mainCanvas) {
      const ctx = mainCanvas.getContext('2d');
      ctx?.clearRect(0, 0, mainCanvas.width, mainCanvas.height);
    }
    const pCanvas = document.getElementById(`pCanvas-${goalId}`);
    if (pCanvas) {
      const pCtx = pCanvas.getContext('2d');
      pCtx?.clearRect(0, 0, pCanvas.width, pCanvas.height);
    }
    if (!keepState) goalCardStates.delete(goalId);
  },
  categoryEmoji: function(category) {
    const key = String(category || '').toLowerCase();
    if (key.includes('fit') || key.includes('health') || key.includes('workout')) return '💪';
    if (key.includes('learn') || key.includes('study') || key.includes('career')) return '📚';
    if (key.includes('creative') || key.includes('art')) return '🎨';
    if (key.includes('travel')) return '✈️';
    if (key.includes('well')) return '🧘';
    return '🎯';
  },

  shuffleOrder: function() {
    const arr = [0, 1, 2, 3];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  },

  makePlaceholderImage: function(title, category) {
    const cv = document.createElement('canvas');
    cv.width = this.CARD_W;
    cv.height = this.CARD_H;
    const ctx = cv.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, this.CARD_W, this.CARD_H);
    grad.addColorStop(0, '#334155');
    grad.addColorStop(1, '#0f172a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.CARD_W, this.CARD_H);
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    for (let i = 0; i < 12; i++) {
      ctx.fillRect((i * 38) % this.CARD_W, i * 30, 120, 8);
    }
    ctx.font = '600 22px Manrope, sans-serif';
    ctx.fillStyle = '#f8fafc';
    ctx.fillText(this.categoryEmoji(category), 20, 42);
    ctx.font = '700 20px Manrope, sans-serif';
    ctx.fillText(String(title || 'Goal').slice(0, 20), 52, 42);
    ctx.font = '500 14px Manrope, sans-serif';
    ctx.fillStyle = '#cbd5e1';
    ctx.fillText(String(category || 'Personal'), 20, 68);
    return cv;
  },

  initGoalCanvas: function(goalId, imageUrl, currentProgress, goalMeta = {}) {
    let state = goalCardStates.get(goalId);
    if (!state) {
      state = {
        sourceCanvas: null,
        revealed: 0,
        collected: 0,
        snippetOrder: this.shuffleOrder(),
        isAnimating: false,
        isUnlocked: false,
        autoRotate: false,
        autoT: 0,
        dragActive: false,
        rotX: 0,
        rotY: 0,
        targetX: 0,
        targetY: 0,
        rafId: null,
        revealRafId: null,
        particleRafId: null,
        timeoutIds: new Set(),
        flyingGhosts: new Set(),
        sceneEl: null,
        handlers: null,
        snippetCanvases: new Map(),
        listenersBound: false,
      };
      goalCardStates.set(goalId, state);
    }
    this.clearTimersAndFrames(state);
    this.unbindCardTilt(goalId);

    state.revealed = Math.max(0, Math.min(this.TOTAL, Math.floor((Number(currentProgress || 0) / 100) * this.TOTAL)));
    state.collected = state.revealed;
    state.isUnlocked = state.revealed >= this.TOTAL;
    state.isAnimating = false;
    state.autoRotate = false;

    const onSourceReady = (sourceCanvas) => {
      state.sourceCanvas = sourceCanvas;
      this.drawFoggyCard(goalId);
      this.buildSnippetSlots(goalId);
      this.preloadThumbs(goalId);
      if (!this.isReducedMotion()) {
        this.bindCardTilt(goalId);
      }

      if (state.isUnlocked) {
        document.getElementById(`holo-${goalId}`)?.classList.add('active');
        document.getElementById(`shine-${goalId}`)?.classList.add('active');
        document.getElementById(`goldBorder-${goalId}`)?.classList.add('active');
        document.getElementById(`starBadge-${goalId}`)?.classList.add('active');
      }
    };

    if (!imageUrl) {
      onSourceReady(this.makePlaceholderImage(goalMeta.title, goalMeta.category));
      return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const src = document.createElement('canvas');
      src.width = this.CARD_W;
      src.height = this.CARD_H;
      src.getContext('2d').drawImage(img, 0, 0, this.CARD_W, this.CARD_H);
      onSourceReady(src);
    };
    img.onerror = () => onSourceReady(this.makePlaceholderImage(goalMeta.title, goalMeta.category));
    img.src = imageUrl;
  },

  updateCardImage: function(goalId, imageUrl, goalMeta = {}) {
    const state = goalCardStates.get(goalId);
    if (!state) return;
    this.initGoalCanvas(goalId, imageUrl, (state.revealed / this.TOTAL) * 100, goalMeta);
  },

  drawFoggyCard: function(goalId) {
    const state = goalCardStates.get(goalId);
    const canvas = document.getElementById(`mainCanvas-${goalId}`);
    if (!state || !state.sourceCanvas || !canvas) return;

    const ctx = canvas.getContext('2d');
    const quadW = this.CARD_W / this.COLS;
    const quadH = this.CARD_H / this.ROWS;
    ctx.clearRect(0, 0, this.CARD_W, this.CARD_H);

    for (let i = 0; i < this.TOTAL; i++) {
      const row = Math.floor(i / this.COLS);
      const col = i % this.COLS;
      const sx = col * quadW;
      const sy = row * quadH;
      ctx.drawImage(state.sourceCanvas, sx, sy, quadW, quadH, sx, sy, quadW, quadH);
      if (i >= state.revealed) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.62)';
        ctx.fillRect(sx, sy, quadW, quadH);
      }
    }
  },

  collectSnippet: function(goalId) {
    const state = goalCardStates.get(goalId);
    if (!state || state.isAnimating || state.collected >= this.TOTAL) return;

    const slotIdx = state.collected;
    const slot = document.getElementById(`snippet-${goalId}-${slotIdx}`);
    state.isAnimating = true;

    if (slot) {
      slot.classList.add('collecting');
      const ghost = slot.cloneNode(true);
      ghost.classList.add('snippet-flying');
      ghost.style.position = 'absolute';
      const rect = slot.getBoundingClientRect();
      const parentRect = slot.parentElement.getBoundingClientRect();
      ghost.style.left = `${rect.left - parentRect.left}px`;
      ghost.style.top = `${rect.top - parentRect.top}px`;
      ghost.style.width = `${rect.width}px`;
      ghost.style.height = `${rect.height}px`;
      slot.parentElement.appendChild(ghost);
      state.flyingGhosts.add(ghost);
      this.scheduleTimeout(state, () => {
        ghost.remove();
        state.flyingGhosts.delete(ghost);
      }, 620);
    }

    const revealDelay = this.isReducedMotion() ? 0 : 240;
    this.scheduleTimeout(state, () => {
      const quadIdx = state.snippetOrder[slotIdx];
      state.collected += 1;
      this.revealQuadAnimated(goalId, quadIdx, slotIdx, this.isReducedMotion());
    }, revealDelay);
  },

  revealQuadAnimated: function(goalId, quadIdx, slotIdx, immediate = false) {
    const state = goalCardStates.get(goalId);
    const canvas = document.getElementById(`mainCanvas-${goalId}`);
    if (!state || !state.sourceCanvas || !canvas) return;

    const ctx = canvas.getContext('2d');
    const quadW = this.CARD_W / this.COLS;
    const quadH = this.CARD_H / this.ROWS;
    const row = Math.floor(quadIdx / this.COLS);
    const col = quadIdx % this.COLS;
    const sx = col * quadW;
    const sy = row * quadH;
    if (immediate) {
      this.drawFoggyCard(goalId);
      ctx.drawImage(state.sourceCanvas, sx, sy, quadW, quadH, sx, sy, quadW, quadH);
      state.revealed = Math.max(state.revealed, state.collected);
      const slot = document.getElementById(`snippet-${goalId}-${slotIdx}`);
      slot?.classList.add('collected');
      if (state.revealed === this.TOTAL) this.triggerGoldUnlock(goalId);
      else state.isAnimating = false;
      return;
    }
    const frames = 16;
    let frame = 0;

    const drawFrame = () => {
      frame += 1;
      const alpha = Math.min(1, frame / frames);
      this.drawFoggyCard(goalId);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.drawImage(state.sourceCanvas, sx, sy, quadW, quadH, sx, sy, quadW, quadH);
      ctx.restore();

      if (frame < frames) {
        state.revealRafId = requestAnimationFrame(drawFrame);
        return;
      }
      state.revealRafId = null;

      state.revealed = Math.max(state.revealed, state.collected);
      const slot = document.getElementById(`snippet-${goalId}-${slotIdx}`);
      slot?.classList.add('collected');
      const flash = document.getElementById(`goldBorder-${goalId}`);
      flash?.classList.add('flash');
      this.scheduleTimeout(state, () => flash?.classList.remove('flash'), 320);

      if (state.revealed === this.TOTAL) {
        this.triggerGoldUnlock(goalId);
      } else {
        state.isAnimating = false;
      }
    };

    drawFrame();
  },

  triggerGoldUnlock: function(goalId) {
    const state = goalCardStates.get(goalId);
    const canvas = document.getElementById(`mainCanvas-${goalId}`);
    const card3d = document.getElementById(`card3d-${goalId}`);
    if (!state || !state.sourceCanvas || !canvas || !card3d) return;

    state.isAnimating = true;
    state.isUnlocked = true;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, this.CARD_W, this.CARD_H);
    ctx.drawImage(state.sourceCanvas, 0, 0, this.CARD_W, this.CARD_H);
    const foil = ctx.createLinearGradient(0, 0, this.CARD_W, this.CARD_H);
    foil.addColorStop(0, 'rgba(255,215,0,0.1)');
    foil.addColorStop(0.5, 'rgba(255,255,255,0.14)');
    foil.addColorStop(1, 'rgba(255,215,0,0.22)');
    ctx.fillStyle = foil;
    ctx.fillRect(0, 0, this.CARD_W, this.CARD_H);

    const badge = document.querySelector(`.goal-card[data-goal-id="${goalId}"] .status-badge`);
    if (badge) badge.textContent = 'Legendary card unlocked!';

    if (this.isReducedMotion()) {
      document.getElementById(`holo-${goalId}`)?.classList.add('active');
      document.getElementById(`shine-${goalId}`)?.classList.add('active');
      document.getElementById(`goldBorder-${goalId}`)?.classList.add('active');
      document.getElementById(`starBadge-${goalId}`)?.classList.add('active');
      state.autoRotate = false;
      state.isAnimating = false;
      return;
    }

    this.scheduleTimeout(state, () => {
      document.getElementById(`holo-${goalId}`)?.classList.add('active');
      document.getElementById(`shine-${goalId}`)?.classList.add('active');
      document.getElementById(`goldBorder-${goalId}`)?.classList.add('active');
    }, 150);
    this.scheduleTimeout(state, () => document.getElementById(`starBadge-${goalId}`)?.classList.add('active'), 400);
    this.scheduleTimeout(state, () => this.fireParticles(goalId), 300);

    this.scheduleTimeout(state, () => {
      card3d.style.transition = 'transform 0.9s cubic-bezier(.34,1.56,.64,1)';
      card3d.style.transform = 'rotateY(360deg) rotateX(8deg)';
      this.scheduleTimeout(state, () => {
        card3d.style.transition = 'transform 0.6s ease';
        card3d.style.transform = 'rotateY(0deg) rotateX(0deg)';
        this.scheduleTimeout(state, () => {
          card3d.style.transition = 'transform 0.08s linear';
          state.autoRotate = true;
          state.isAnimating = false;
          this.startAutoTilt(goalId);
        }, 650);
      }, 950);
    }, 200);
  },

  startAutoTilt: function(goalId) {
    const state = goalCardStates.get(goalId);
    if (!state) return;
    state.autoRotate = true;
    state.autoT = 0;
    this.ensureTiltLoop(goalId);
  },

  ensureTiltLoop: function(goalId) {
    const state = goalCardStates.get(goalId);
    if (!state || state.rafId || this.isReducedMotion()) return;
    state.rafId = requestAnimationFrame(() => this.tiltLoop(goalId));
  },

  tiltLoop: function(goalId) {
    const state = goalCardStates.get(goalId);
    const card3d = document.getElementById(`card3d-${goalId}`);
    if (!state || !card3d) return;
    if (this.isReducedMotion()) {
      state.autoRotate = false;
      return;
    }

    if (!state.isAnimating) {
      if (state.isUnlocked && state.autoRotate && !state.dragActive) {
        state.autoT += 0.016;
        state.targetX = Math.sin(state.autoT * 0.7) * 8;
        state.targetY = Math.sin(state.autoT) * 18;
      }

      state.rotX += (state.targetX - state.rotX) * 0.1;
      state.rotY += (state.targetY - state.rotY) * 0.1;
      card3d.style.transform = `rotateX(${state.rotX}deg) rotateY(${state.rotY}deg)`;

      if (state.isUnlocked) {
        const holo = document.getElementById(`holo-${goalId}`);
        if (holo) {
          holo.style.backgroundPosition = `${50 + (state.rotY * 0.8)}% ${50 + (state.rotX * 0.4)}%`;
        }
      }
    }

    const closeEnough = Math.abs(state.targetX - state.rotX) < 0.05 && Math.abs(state.targetY - state.rotY) < 0.05;
    const shouldContinue = state.isUnlocked && (state.autoRotate || state.dragActive || !closeEnough);
    if (shouldContinue) {
      state.rafId = requestAnimationFrame(() => this.tiltLoop(goalId));
    } else {
      state.rafId = null;
    }
  },

  bindCardTilt: function(goalId) {
    const state = goalCardStates.get(goalId);
    const scene = document.getElementById(`scene-${goalId}`);
    if (!state || !scene) return;
    if (state.sceneEl === scene && state.listenersBound) return;
    if (state.sceneEl && state.sceneEl !== scene) this.unbindCardTilt(goalId);

    const applyPointerTilt = (clientX, clientY) => {
      if (!state.isUnlocked) return;
      const rect = scene.getBoundingClientRect();
      const nx = ((clientX - rect.left) / rect.width) * 2 - 1;
      const ny = ((clientY - rect.top) / rect.height) * 2 - 1;
      state.targetY = Math.max(-28, Math.min(28, nx * 28));
      state.targetX = Math.max(-20, Math.min(20, -ny * 20));
    };

    const mouseEnter = () => {
      if (!state.isUnlocked) return;
      state.dragActive = true;
      state.autoRotate = false;
      this.ensureTiltLoop(goalId);
    };
    const mouseMove = (e) => applyPointerTilt(e.clientX, e.clientY);
    const mouseLeave = () => {
      state.dragActive = false;
      if (state.isUnlocked) state.autoRotate = true;
      this.ensureTiltLoop(goalId);
    };
    const touchMove = (e) => {
      const t = e.touches?.[0];
      if (!t) return;
      state.dragActive = true;
      state.autoRotate = false;
      this.ensureTiltLoop(goalId);
      applyPointerTilt(t.clientX, t.clientY);
    };
    const touchEnd = () => {
      state.dragActive = false;
      if (state.isUnlocked) state.autoRotate = true;
      this.ensureTiltLoop(goalId);
    };

    scene.addEventListener('mouseenter', mouseEnter);
    scene.addEventListener('mousemove', mouseMove);
    scene.addEventListener('mouseleave', mouseLeave);
    scene.addEventListener('touchmove', touchMove, { passive: true });
    scene.addEventListener('touchend', touchEnd);

    state.sceneEl = scene;
    state.handlers = { mouseEnter, mouseMove, mouseLeave, touchMove, touchEnd };
    state.listenersBound = true;
  },

  buildSnippetSlots: function(goalId) {
    const row = document.getElementById(`snippetRow-${goalId}`);
    const state = goalCardStates.get(goalId);
    if (!row || !state) return;
    row.innerHTML = '';
    for (let i = 0; i < this.TOTAL; i++) {
      const slot = document.createElement('div');
      slot.className = 'cr-snippet-slot';
      slot.id = `snippet-${goalId}-${i}`;
      if (i < state.revealed) slot.classList.add('collected');
      slot.innerHTML = `
        <canvas width="${this.SNIPPET_W}" height="${this.SNIPPET_H}"></canvas>
        <div class="shimmer"></div>
        <div class="slot-num">${i + 1}</div>
        <div class="slot-frac">${i + 1}/4</div>
      `;
      row.appendChild(slot);
    }
  },

  preloadThumbs: function(goalId) {
    const state = goalCardStates.get(goalId);
    if (!state || !state.sourceCanvas) return;
    const quadW = this.CARD_W / this.COLS;
    const quadH = this.CARD_H / this.ROWS;
    for (let i = 0; i < this.TOTAL; i++) {
      const quadIdx = state.snippetOrder[i];
      const row = Math.floor(quadIdx / this.COLS);
      const col = quadIdx % this.COLS;
      const sx = col * quadW;
      const sy = row * quadH;
      const thumb = document.createElement('canvas');
      thumb.width = this.SNIPPET_W;
      thumb.height = this.SNIPPET_H;
      thumb.getContext('2d').drawImage(state.sourceCanvas, sx, sy, quadW, quadH, 0, 0, this.SNIPPET_W, this.SNIPPET_H);
      state.snippetCanvases.set(i, thumb);
      const slotCanvas = document.querySelector(`#snippet-${goalId}-${i} canvas`);
      if (slotCanvas) {
        const slotCtx = slotCanvas.getContext('2d');
        slotCtx.clearRect(0, 0, this.SNIPPET_W, this.SNIPPET_H);
        slotCtx.drawImage(thumb, 0, 0);
      }
    }
  },

  fireParticles: function(goalId) {
    if (this.isReducedMotion()) return;
    const state = goalCardStates.get(goalId);
    const pCanvas = document.getElementById(`pCanvas-${goalId}`);
    if (!pCanvas || !state) return;
    pCanvas.width = this.CARD_W;
    pCanvas.height = this.CARD_H;
    const ctx = pCanvas.getContext('2d');
    const particles = [];
    for (let i = 0; i < 110; i++) {
      const gold = i < 80;
      particles.push({
        x: this.CARD_W / 2,
        y: this.CARD_H / 2,
        vx: (Math.random() - 0.5) * (gold ? 8 : 10),
        vy: (Math.random() - 0.5) * 9 - 2,
        a: 1,
        d: Math.random() * 0.028 + 0.012,
        r: Math.random() * 2 + 1,
        c: gold ? '#facc15' : '#ffffff',
      });
    }
    const tick = () => {
      ctx.clearRect(0, 0, this.CARD_W, this.CARD_H);
      let alive = 0;
      particles.forEach((p) => {
        p.a -= p.d;
        if (p.a <= 0) return;
        alive += 1;
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.16;
        ctx.globalAlpha = p.a;
        ctx.fillStyle = p.c;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;
      if (alive > 0) {
        state.particleRafId = requestAnimationFrame(tick);
      } else {
        state.particleRafId = null;
      }
    };
    tick();
  },
};

// Key: When progress updates come in, call crCardSystem.collectSnippet(goalId)
// This will automatically reveal quads and trigger unlock at 100%

const goalsHandler = {
  // State
  goalsState: {
    goals: [],
    currentFilter: 'active',
    editingGoalId: null,
    selectedImageFile: null,
    selectedTemplate: null,
  },

  // Initialize Goals Feature
  init: function() {
    // Check if this is a shared goal view
    const pathMatch = window.location.pathname.match(/\/shared\/goal\/([a-zA-Z0-9\-_]+)$/);
    if (pathMatch) {
      this.loadSharedGoal(pathMatch[1]);
    } else {
      this.loadGoals();
      this.setupEventListeners();
      this.loadTemplates();
    }
  },

  // Load and display a shared goal
  loadSharedGoal: async function(shareToken) {
    try {
      const response = await fetch(`/api/goals/shared/${shareToken}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.ok) {
        const data = await response.json();
        this.displaySharedGoal(data.goal, data.unlocked_segments);
      } else {
        document.getElementById('shared-goal-container').innerHTML = `
          <div class="shared-goal-error">
            <h2>Goal not found or is no longer shared</h2>
            <p>The shared goal link may be expired or invalid.</p>
          </div>
        `;
      }
    } catch (error) {
      console.error('Error loading shared goal:', error);
      document.getElementById('shared-goal-container').innerHTML = `
        <div class="shared-goal-error">
          <h2>Error loading goal</h2>
          <p>${error.message}</p>
        </div>
      `;
    }
  },

  // Display shared goal in read-only view
  displaySharedGoal: function(goal, _unlockedSegments) {
    const container = document.getElementById('shared-goal-container');
    if (!container) return;

    document.getElementById('goals-container').style.display = 'none';
    container.style.display = 'block';
    goalCardStates.forEach((_, id) => crCardSystem.destroyGoalCanvas(id));

    let statusBadge = 'Active';
    if (goal.status === 'completed') statusBadge = 'Completed';
    if (goal.status === 'archived') statusBadge = 'Archived';

    const imageUrl = goal.card_image_url || null;

    container.innerHTML = `
      <div class="shared-goal-header">
        <h1>${goal.title}</h1>
        <p class="shared-by">Shared Goal</p>
      </div>

      <div class="shared-goal-content">
        <div class="goal-card shared-goal-card" data-goal-id="shared-preview" data-status="${goal.status}">
          <div class="card-container">
            <div class="cr-scene" id="scene-shared-preview">
              <div class="cr-card-3d" id="card3d-shared-preview">
                <div class="cr-card-face">
                  <canvas class="cr-main-canvas" id="mainCanvas-shared-preview" width="280" height="360"></canvas>
                  <div class="cr-holo" id="holo-shared-preview"></div>
                  <div class="cr-shine" id="shine-shared-preview"></div>
                  <div class="cr-gold-border" id="goldBorder-shared-preview"></div>
                  <div class="star-badge" id="starBadge-shared-preview"><span>&#11088;</span><span>&#11088;</span><span>&#11088;</span></div>
                  <div class="cr-card-info">
                    <h3 class="goal-title">${goal.title}</h3>
                    <p class="goal-category">${goal.category}</p>
                    <div class="card-progress">
                      <div class="progress-bar">
                        <div class="progress-fill" style="width: ${goal.current_progress}%"></div>
                      </div>
                      <span class="progress-text">${goal.current_progress.toFixed(0)}%</span>
                    </div>
                  </div>
                </div>
              </div>
              <canvas class="cr-particles" id="pCanvas-shared-preview"></canvas>
            </div>
            <div class="cr-snippet-row" id="snippetRow-shared-preview"></div>
            <div class="status-badge">${statusBadge}</div>
          </div>
        </div>

        <div class="shared-goal-details">
          <h2>About This Goal</h2>
          <div class="detail-section">
            <h3>Description</h3>
            <p>${goal.description || 'No description provided'}</p>
          </div>
          <div class="detail-section">
            <h3>Progress</h3>
            <p>${goal.current_progress.toFixed(0)}% Complete</p>
            <div class="progress-bar" style="margin-top: 10px;">
              <div class="progress-fill" style="width: ${goal.current_progress}%"></div>
            </div>
          </div>
          ${goal.notes ? `<div class="detail-section"><h3>Notes</h3><p>${goal.notes}</p></div>` : ''}
          <div class="detail-section">
            <h3>Created</h3>
            <p>${goal.created_at ? new Date(goal.created_at).toLocaleDateString() : 'Unknown'}</p>
          </div>
        </div>
      </div>
    `;

    crCardSystem.initGoalCanvas('shared-preview', imageUrl, goal.current_progress, {
      title: goal.title,
      category: goal.category,
    });
  },

  // Setup Event Listeners
  setupEventListeners: function() {
    if (!this._cleanupBound) {
      window.addEventListener('beforeunload', () => {
        goalCardStates.forEach((_, id) => crCardSystem.destroyGoalCanvas(id));
      });
      this._cleanupBound = true;
    }

    // Add goal button
    document.getElementById('goals-add-btn')?.addEventListener('click', () => this.openCreateModal());

    // Filter buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        this.goalsState.currentFilter = e.target.dataset.status || 'all';
        this.renderGoals();
      });
    });

    // Modal controls
    document.getElementById('goals-add-btn')?.addEventListener('click', () => this.openCreateModal());
    document.getElementById('goal-modal-close')?.addEventListener('click', () => this.closeModal('goal-modal'));
    document.getElementById('goal-modal-cancel')?.addEventListener('click', () => this.closeModal('goal-modal'));
    document.getElementById('goal-form')?.addEventListener('submit', (e) => this.handleGoalSubmit(e));

    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
    });

    // File upload
    document.getElementById('image-file')?.addEventListener('change', (e) => this.handleFileSelect(e));
    document.querySelector('.upload-label')?.addEventListener('dragover', (e) => e.preventDefault());
    document.querySelector('.upload-label')?.addEventListener('drop', (e) => this.handleFileDrop(e));

    // AI Generation
    document.getElementById('generate-ai-btn')?.addEventListener('click', () => this.generateAIImage());

    // Share Modal
    document.getElementById('share-modal-close')?.addEventListener('click', () => this.closeModal('share-modal'));
    document.getElementById('generate-share-btn')?.addEventListener('click', () => this.generateShareLink());
    document.getElementById('copy-share-url-btn')?.addEventListener('click', () => this.copyShareURL());
    document.getElementById('revoke-share-btn')?.addEventListener('click', () => this.revokeShare());

    // Progress Modal
    document.getElementById('progress-modal-close')?.addEventListener('click', () => this.closeModal('progress-modal'));
    document.getElementById('progress-cancel')?.addEventListener('click', () => this.closeModal('progress-modal'));
    document.getElementById('progress-submit')?.addEventListener('click', () => this.submitProgress());

    // Progress slider
    document.getElementById('progress-slider')?.addEventListener('input', (e) => {
      document.querySelector('.slider-value').textContent = e.target.value + '%';
    });

    // Quick progress buttons
    document.querySelectorAll('.quick-btn').forEach(btn => {
      btn.addEventListener('click', (e) => this.quickProgressUpdate(e.target.dataset.increment));
    });
  },

  // Load Goals from API
  loadGoals: async function() {
    try {
      const response = await fetch('/api/goals', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        this.goalsState.goals = data.goals || [];
        this.renderGoals();
      }
    } catch (error) {
      console.error('Error loading goals:', error);
    }
  },

  // Render Goals Grid
  renderGoals: function() {
    const grid = document.getElementById('goals-grid');
    const empty = document.getElementById('goals-empty');

    // Filter goals
    let filtered = this.goalsState.goals;
    if (this.goalsState.currentFilter !== 'all') {
      filtered = filtered.filter(g => g.status === this.goalsState.currentFilter);
    }

    const activeIds = new Set(filtered.map((g) => String(g.id)));
    goalCardStates.forEach((_, id) => {
      if (!activeIds.has(String(id))) crCardSystem.destroyGoalCanvas(id);
    });

    if (filtered.length === 0) {
      grid.style.display = 'none';
      empty.style.display = 'block';
      grid.innerHTML = '';
      return;
    }

    grid.style.display = 'grid';
    empty.style.display = 'none';
    grid.innerHTML = '';

    filtered.forEach(goal => {
      const card = this.createGoalCard(goal);
      grid.appendChild(card);
    });
  },

  // Create Goal Card DOM Element
  createGoalCard: function(goal) {
    const template = document.getElementById('goal-card-template');
    const goalId = goal.id;
    const rawClone = template.content.cloneNode(true);

    const tempDiv = document.createElement('div');
    tempDiv.appendChild(rawClone);
    tempDiv.innerHTML = tempDiv.innerHTML.replace(/\{\{goalId\}\}/g, goalId);

    const card = tempDiv.querySelector('.goal-card');
    card.dataset.goalId = goal.id;
    card.dataset.status = goal.status;
    card.dataset.title = goal.title;
    card.dataset.category = goal.category;

    const bgImg = card.querySelector('.card-image');
    if (bgImg) {
      bgImg.src = goal.card_image_url || 'https://via.placeholder.com/800x600/e0e7ff/6366f1?text=Goal';
      bgImg.alt = goal.title;
    }

    card.querySelector('.goal-title').textContent = goal.title;
    const categoryEl = card.querySelector('.goal-category');
    if (categoryEl) {
      categoryEl.innerHTML = `<span class="goal-category-icon">${crCardSystem.categoryEmoji(goal.category)}</span><span>${goal.category}</span>`;
    }

    const progressFill = card.querySelector('.progress-fill');
    progressFill.style.width = goal.current_progress + '%';
    card.querySelector('.progress-text').textContent = Math.round(goal.current_progress) + '%';

    const deadlineEl = card.querySelector('.goal-deadline');
    if (deadlineEl) {
      if (goal.time_limit) {
        const deadline = new Date(goal.time_limit);
        card.querySelector('.deadline-date').textContent = deadline.toLocaleDateString();
      } else {
        deadlineEl.style.display = 'none';
      }
    }

    const badge = card.querySelector('.status-badge');
    if (badge) {
      badge.textContent = goal.status === 'completed' ? 'Completed' : goal.status === 'archived' ? 'Archived' : 'Active';
    }

    const imageUrl = goal.card_image_url || null;
    setTimeout(() => {
      crCardSystem.initGoalCanvas(goalId, imageUrl, goal.current_progress, {
        title: goal.title,
        category: goal.category,
      });
    }, 0);

    card.querySelector('.edit-btn')?.addEventListener('click', (e) => { e.stopPropagation(); this.openEditModal(goal.id); });
    card.querySelector('.share-btn')?.addEventListener('click', (e) => { e.stopPropagation(); this.openShareModal(goal.id); });
    card.querySelector('.download-btn')?.addEventListener('click', (e) => { e.stopPropagation(); this.downloadCard(goal.id); });
    card.querySelector('.delete-btn')?.addEventListener('click', (e) => { e.stopPropagation(); this.deleteGoal(goal.id); });

    const cardContainer = card.querySelector('.card-container');
    cardContainer.addEventListener('click', () => this.openProgressModal(goal.id));

    return card;
  },

  /**
   * BLUR REVEAL SYSTEM - Core feature (Clash Royale style)
   * Unlocks segments based on progress percentage
   */
  // Modal Management
  openModal: function(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.style.display = 'flex';
      modal.classList.add('show');
    }
  },

  closeModal: function(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.style.display = 'none';
      modal.classList.remove('show');
    }
  },

  // Create Goal Modal
  openCreateModal: function() {
    this.goalsState.editingGoalId = null;
    document.getElementById('modal-title').textContent = 'Create New Goal';
    document.getElementById('goal-submit-btn').textContent = 'Create Goal';
    document.getElementById('goal-form').reset();
    document.getElementById('image-preview').style.display = 'none';
    this.goalsState.selectedImageFile = null;
    this.openModal('goal-modal');
  },

  // Edit Goal Modal
  openEditModal: async function(goalId) {
    try {
      const response = await fetch(`/api/goals/${goalId}`);
      const data = await response.json();
      const goal = data.goal;

      this.goalsState.editingGoalId = goalId;
      document.getElementById('modal-title').textContent = 'Edit Goal';
      document.getElementById('goal-submit-btn').textContent = 'Update Goal';

      // Populate form
      document.getElementById('goal-title').value = goal.title;
      document.getElementById('goal-description').value = goal.description || '';
      document.getElementById('goal-category').value = goal.category;
      document.getElementById('goal-target').value = goal.target_progress;
      document.getElementById('goal-deadline').value = goal.time_limit || '';
      document.getElementById('goal-notes').value = goal.notes || '';

      // Show image if exists
      if (goal.card_image_url) {
        const preview = document.getElementById('image-preview');
        preview.src = goal.card_image_url;
        preview.style.display = 'block';
      }

      this.openModal('goal-modal');
    } catch (error) {
      console.error('Error loading goal:', error);
    }
  },

  // Handle Goal Form Submit
  handleGoalSubmit: async function(e) {
    e.preventDefault();

    const formData = {
      title: document.getElementById('goal-title').value,
      description: document.getElementById('goal-description').value,
      category: document.getElementById('goal-category').value,
      target_progress: parseFloat(document.getElementById('goal-target').value),
      time_limit: document.getElementById('goal-deadline').value || null,
      notes: document.getElementById('goal-notes').value
    };

    // Add image if selected
    if (this.goalsState.selectedImageFile) {
      const reader = new FileReader();
      reader.onload = async (e) => {
        formData.card_image_url = e.target.result;
        await this.submitGoal(formData);
      };
      reader.readAsDataURL(this.goalsState.selectedImageFile);
    } else {
      await this.submitGoal(formData);
    }
  },

  // Submit Goal to API
  submitGoal: async function(formData) {
    try {
      const method = this.goalsState.editingGoalId ? 'PUT' : 'POST';
      const url = this.goalsState.editingGoalId 
        ? `/api/goals/${this.goalsState.editingGoalId}` 
        : '/api/goals';

      const response = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (response.ok) {
        this.closeModal('goal-modal');
        this.loadGoals();
        this.showNotification('Goal ' + (this.goalsState.editingGoalId ? 'updated' : 'created') + ' successfully!', 'success');
      } else {
        const errorMsg = data.error || data.message || 'Failed to save goal';
        console.error('API Error:', { status: response.status, data: data });
        this.showNotification(errorMsg, 'error');
      }
    } catch (error) {
      console.error('Error submitting goal:', error);
      this.showNotification(error.message || 'Error saving goal', 'error');
    }
  },

  // File Upload Handlers
  handleFileSelect: function(e) {
    const file = e.target.files[0];
    this.processFile(file);
  },

  handleFileDrop: function(e) {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      this.processFile(files[0]);
    }
  },

  processFile: function(file) {
    if (!file.type.match('image.*')) {
      this.showNotification('Please select an image file', 'error');
      return;
    }

    this.goalsState.selectedImageFile = file;

    const reader = new FileReader();
    reader.onload = (e) => {
      const preview = document.getElementById('image-preview');
      preview.src = e.target.result;
      preview.style.display = 'block';

      const editingGoalId = this.goalsState.editingGoalId;
      if (editingGoalId !== null && editingGoalId !== undefined) {
        const goal = this.goalsState.goals.find(g => g.id === editingGoalId) || {};
        crCardSystem.updateCardImage(editingGoalId, e.target.result, {
          title: goal.title || document.getElementById('goal-title')?.value || 'Goal',
          category: goal.category || document.getElementById('goal-category')?.value || 'Personal'
        });
      }
    };
    reader.readAsDataURL(file);
  },

  // AI Image Generation
  generateAIImage: async function() {
    const prompt = document.getElementById('ai-prompt').value;
    if (!prompt) {
      this.showNotification('Please enter a prompt', 'error');
      return;
    }

    try {
      this.showNotification('Generating image with AI...', 'info');
      
      const response = await fetch('/api/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          title: 'Goal',
          category: 'AI Generated',
          ai_prompt: prompt
        })
      });

      if (response.ok) {
        this.showNotification('Image generation initiated! Please check back soon.', 'success');
      }
    } catch (error) {
      console.error('Error generating image:', error);
      this.showNotification('Error generating image', 'error');
    }
  },

  // Tab Switching
  switchTab: function(tabName) {
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(tab => {
      tab.classList.remove('active');
    });

    // Remove active from buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.remove('active');
    });

    // Show selected tab
    const selectedTab = document.getElementById(tabName + '-tab');
    if (selectedTab) {
      selectedTab.classList.add('active');
    }

    // Mark button as active
    document.querySelector(`[data-tab="${tabName}"]`)?.classList.add('active');
  },

  // Goal Templates
  loadTemplates: function() {
    const templates = [
      { id: 1, name: 'Fitness Champion', icon: '💪', description: 'Track your fitness journey', category: 'Fitness' },
      { id: 2, name: 'Learning Master', icon: '📚', description: 'Learning new skills', category: 'Learning' },
      { id: 3, name: 'Career Growth', icon: '🚀', description: 'Professional development', category: 'Career' },
      { id: 4, name: 'Wellness', icon: '🧘', description: 'Personal wellbeing', category: 'Wellness' },
      { id: 5, name: 'Creative Journey', icon: '🎨', description: 'Artistic pursuits', category: 'Creative' },
      { id: 6, name: 'Travel Goals', icon: '✈️', description: 'Places to explore', category: 'Travel' }
    ];

    const gridEl = document.querySelector('.template-grid');
    if (!gridEl) return;

    gridEl.innerHTML = '';
    templates.forEach(template => {
      const btn = document.createElement('div');
      btn.className = 'goal-template';
      btn.innerHTML = `
        <div class="template-icon">${template.icon}</div>
        <h4>${template.name}</h4>
        <p>${template.description}</p>
        <button type="button" class="btn btn-sm btn-primary use-template" data-category="${template.category}">Use</button>
      `;
      btn.querySelector('.use-template').addEventListener('click', () => {
        document.getElementById('goal-category').value = template.category;
      });
      gridEl.appendChild(btn);
    });
  },

  // Progress Update
  openProgressModal: function(goalId) {
    const goal = this.goalsState.goals.find(g => g.id === goalId);
    if (!goal) return;

    this.goalsState.editingGoalId = goalId;

    // Populate modal
    document.querySelector('#progress-modal .goal-title').textContent = goal.title;
    document.querySelector('#progress-modal .goal-category').textContent = goal.category;
    document.querySelector('#progress-modal .current-percent').textContent = Math.round(goal.current_progress);

    const progressBar = document.querySelector('#progress-modal .progress-fill');
    progressBar.style.width = goal.current_progress + '%';

    const slider = document.getElementById('progress-slider');
    slider.value = goal.current_progress;
    document.querySelector('.slider-value').textContent = Math.round(goal.current_progress) + '%';

    this.openModal('progress-modal');
  },

  quickProgressUpdate: function(increment) {
    const slider = document.getElementById('progress-slider');
    let newValue = parseFloat(slider.value) + parseFloat(increment);
    newValue = Math.min(100, newValue);
    slider.value = newValue;
    document.querySelector('.slider-value').textContent = newValue + '%';
  },

  submitProgress: async function() {
    const goalId = this.goalsState.editingGoalId;
    const progress = parseFloat(document.getElementById('progress-slider').value);
    const notes = document.getElementById('progress-notes').value;

    try {
      const response = await fetch(`/api/goals/${goalId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          current_progress: progress,
          notes: notes
        })
      });

      if (response.ok) {
        this.closeModal('progress-modal');
        
        // Trigger CR snippet reveal if progress moved to next milestone
        const oldProgress = this.goalsState.goals.find(g => g.id === goalId)?.current_progress || 0;
        const oldQuads = Math.max(0, Math.min(4, Math.floor(oldProgress / 25)));
        const newQuads = Math.max(0, Math.min(4, Math.floor(progress / 25)));
        const gained = newQuads - oldQuads;

        if (gained > 0) {
          const state = goalCardStates.get(goalId);
          if (state) {
            for (let i = 0; i < gained; i++) {
              crCardSystem.scheduleTimeout(state, () => crCardSystem.collectSnippet(goalId), i * 700);
            }
          }
        }
        
        this.loadGoals();
        
        if (progress >= 100) {
          this.showNotification('🎉 Goal Completed! Download your achievement card!', 'success');
        } else {
          this.showNotification('Progress updated! ' + Math.round(progress) + '% complete', 'success');
        }
      }
    } catch (error) {
      console.error('Error updating progress:', error);
      this.showNotification('Error updating progress', 'error');
    }
  },

  // Share Functionality
  openShareModal: async function(goalId) {
    this.goalsState.editingGoalId = goalId;

    try {
      const response = await fetch(`/api/goals/${goalId}`);
      const data = await response.json();
      const goal = data.goal;

      // Show respective containers
      if (goal.is_shared) {
        document.getElementById('share-generate-container').style.display = 'none';
        document.getElementById('share-url-container').style.display = 'block';
        document.getElementById('share-url-input').value = goal.share_token 
          ? window.location.origin + '/shared/goal/' + goal.share_token 
          : '';
      } else {
        document.getElementById('share-generate-container').style.display = 'block';
        document.getElementById('share-url-container').style.display = 'none';
      }

      this.openModal('share-modal');
    } catch (error) {
      console.error('Error loading goal:', error);
    }
  },

  generateShareLink: async function() {
    const goalId = this.goalsState.editingGoalId;

    try {
      const response = await fetch(`/api/goals/${goalId}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        document.getElementById('share-url-input').value = window.location.origin + data.share_url;
        document.getElementById('share-generate-container').style.display = 'none';
        document.getElementById('share-url-container').style.display = 'block';
        this.showNotification('Share link generated!', 'success');
      }
    } catch (error) {
      console.error('Error generating share link:', error);
      this.showNotification('Error generating share link', 'error');
    }
  },

  copyShareURL: function() {
    const input = document.getElementById('share-url-input');
    input.select();
    document.execCommand('copy');
    this.showNotification('Share link copied to clipboard!', 'success');
  },

  revokeShare: async function() {
    if (!confirm('Are you sure you want to stop sharing this goal?')) return;

    const goalId = this.goalsState.editingGoalId;

    try {
      const response = await fetch(`/api/goals/${goalId}/share`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });

      if (response.ok) {
        this.closeModal('share-modal');
        this.showNotification('Sharing stopped', 'success');
      }
    } catch (error) {
      console.error('Error revoking share:', error);
      this.showNotification('Error stopping share', 'error');
    }
  },

  // Download Card
  downloadCard: function(goalId) {
    window.location.href = `/api/goals/${goalId}/download`;
    this.showNotification('Downloading your achievement card...', 'info');
  },

  // Delete Goal
  deleteGoal: async function(goalId) {
    if (!confirm('Are you sure you want to delete this goal?')) return;

    try {
      const response = await fetch(`/api/goals/${goalId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });

      if (response.ok) {
        this.loadGoals();
        this.showNotification('Goal deleted', 'success');
      }
    } catch (error) {
      console.error('Error deleting goal:', error);
      this.showNotification('Error deleting goal', 'error');
    }
  },

  // Utility: Show Notification
  showNotification: function(message, type = 'info') {
    // Use existing notification system or create one
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 16px 24px;
      background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
      color: white;
      border-radius: 8px;
      font-weight: 600;
      z-index: 2000;
      animation: slideIn 0.3s ease;
    `;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);
  }
};

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => goalsHandler.init());
} else {
  goalsHandler.init();
}
