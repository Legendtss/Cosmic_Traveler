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
  
  // Initialize canvas and game state for a goal
  initGoalCanvas: function(goalId, imageUrl, currentProgress) {
    if (goalCardStates.has(goalId)) {
      return; // Already initialized
    }

    // Create state container
    const state = {
      goalId,
      sourceImg: null,
      revealed: false,
      collected: 0,
      snippetOrder: [],
      isAnimating: false,
      isUnlocked: currentProgress >= 100,
      autoRotate: { x: 0, y: 0, vx: 0, vy: 0 },
      targetRotate: { x: 0, y: 0 },
      dragActive: false,
      lastMouseX: 0,
      lastMouseY: 0,
      tiltT: 0,
      raqId: null,
      snippetCanvases: new Map(),
    };

    goalCardStates.set(goalId, state);

    // Load image
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      state.sourceImg = img;
      this.drawFoggyCard(goalId);
      
      // Initialize snippets for current progress
      const totalQuads = 4;
      for (let i = 0; i < totalQuads; i++) {
        if (currentProgress >= ((i + 1) * 25)) {
          state.collected++;
        }
      }
      
      // Start auto-tilt loop
      this.startAutoTilt(goalId);
    };
    img.onerror = () => {
      console.error('Failed to load goal image:', imageUrl);
      state.sourceImg = null;
    };
    img.src = imageUrl;
  },

  /**
   * Draw the current card state with quads
   */
  drawFoggyCard: function(goalId) {
    const state = goalCardStates.get(goalId);
    if (!state || !state.sourceImg) return;

    const canvas = document.getElementById(`mainCanvas-${goalId}`);
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, this.CARD_W, this.CARD_H);

    const quadW = this.CARD_W / this.COLS;
    const quadH = this.CARD_H / this.ROWS;

    // Draw all quads
    for (let i = 0; i < this.TOTAL; i++) {
      const row = Math.floor(i / this.COLS);
      const col = i % this.COLS;
      const sx = col * quadW;
      const sy = row * quadH;
      const dx = sx;
      const dy = sy;

      // Draw quad from source image
      ctx.drawImage(
        state.sourceImg,
        sx, sy, quadW, quadH, // Source
        dx, dy, quadW, quadH  // Destination
      );

      // Apply reveal effect if collected
      if (state.collected > i) {
        // Fully revealed - bright
        ctx.globalAlpha = 1;
      } else {
        // Unrevealed - foggy/dimmed
        ctx.globalAlpha = 0.4;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(dx, dy, quadW, quadH);
      }
    }
    ctx.globalAlpha = 1;
  },

  /**
   * Collect a snippet (quad) - called from progress update
   */
  collectSnippet: function(goalId) {
    const state = goalCardStates.get(goalId);
    if (!state || state.collected >= this.TOTAL) return;

    state.collected++;
    state.isAnimating = true;

    // Animate reveal
    const targetIdx = state.collected - 1;
    this.revealQuadAnimated(goalId, targetIdx);

    // Check for full unlock
    if (state.collected >= this.TOTAL) {
      setTimeout(() => {
        this.triggerGoldUnlock(goalId);
      }, 700);
    }
  },

  /**
   * Reveal a quad with animation
   */
  revealQuadAnimated: function(goalId, quadIdx) {
    const state = goalCardStates.get(goalId);
    if (!state) return;

    const canvas = document.getElementById(`mainCanvas-${goalId}`);
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const quadW = this.CARD_W / this.COLS;
    const quadH = this.CARD_H / this.ROWS;
    const row = Math.floor(quadIdx / this.COLS);
    const col = quadIdx % this.COLS;
    const sx = col * quadW;
    const sy = row * quadH;
    const dx = sx;
    const dy = sy;

    // Animate fade-in for this quad over 16 frames
    let frame = 0;
    const totalFrames = 16;
    const animationFrame = () => {
      frame++;
      const progress = frame / totalFrames;

      // Redraw entire card
      ctx.clearRect(0, 0, this.CARD_W, this.CARD_H);

      // Draw all quads
      for (let i = 0; i < this.TOTAL; i++) {
        const r = Math.floor(i / this.COLS);
        const c = i % this.COLS;
        const ssx = c * quadW;
        const ssy = r * quadH;
        const ddx = ssx;
        const ddy = ssy;

        if (i < quadIdx) {
          // Already revealed - draw normally
          ctx.globalAlpha = 1;
          ctx.drawImage(state.sourceImg, ssx, ssy, quadW, quadH, ddx, ddy, quadW, quadH);
        } else if (i === quadIdx) {
          // Currently revealing - animated
          ctx.globalAlpha = progress;
          ctx.drawImage(state.sourceImg, ssx, ssy, quadW, quadH, ddx, ddy, quadW, quadH);
          ctx.globalAlpha = 1;
        } else {
          // Not yet revealed - dimmed
          ctx.globalAlpha = 1;
          ctx.drawImage(state.sourceImg, ssx, ssy, quadW, quadH, ddx, ddy, quadW, quadH);
          ctx.globalAlpha = 0.4;
          ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
          ctx.fillRect(ddx, ddy, quadW, quadH);
          ctx.globalAlpha = 1;
        }
      }

      if (frame < totalFrames) {
        requestAnimationFrame(animationFrame);
      }
    };

    animationFrame();
  },

  /**
   * Trigger the full gold unlock sequence
   */
  triggerGoldUnlock: function(goalId) {
    const state = goalCardStates.get(goalId);
    if (!state) return;

    state.isUnlocked = true;

    const holo = document.getElementById(`holo-${goalId}`);
    const shine = document.getElementById(`shine-${goalId}`);
    const goldBorder = document.getElementById(`gold-border-${goalId}`);
    const stars = document.getElementById(`stars-${goalId}`);
    const card3d = document.getElementById(`card3d-${goalId}`);

    if (!card3d) return;

    // Phase 1: 3D Flip (150ms delay, 400ms duration)
    setTimeout(() => {
      card3d.style.transform = 'rotateY(360deg)';
      card3d.style.transition = 'transform 0.4s ease-out';
    }, 150);

    // Phase 2: Holographic effect (550ms - starts at 150+400)
    setTimeout(() => {
      if (holo) {
        holo.classList.add('active');
      }
    }, 550);

    // Phase 3: Shine sweep (750ms)
    setTimeout(() => {
      if (shine) {
        shine.classList.add('active');
      }
    }, 750);

    // Phase 4: Gold border pulse (950ms)
    setTimeout(() => {
      if (goldBorder) {
        goldBorder.classList.add('active');
      }
    }, 950);

    // Phase 5: Star burst (1250ms)
    setTimeout(() => {
      if (stars) {
        stars.classList.add('active');
      }
      this.fireParticles(goalId);
    }, 1250);

    // Phase 6: Flip reset + auto-tilt (1900ms)
    setTimeout(() => {
      card3d.style.transform = 'rotateY(0deg)';
      card3d.style.transition = 'transform 0.3s ease-out';
      state.isAnimating = false;
    }, 1900);
  },

  /**
   * Start auto-tilt animation loop
   */
  startAutoTilt: function(goalId) {
    const state = goalCardStates.get(goalId);
    if (!state) return;

    state.tiltT = 0;
    this.tiltLoop(goalId);
  },

  /**
   * Continuous tilt animation loop
   */
  tiltLoop: function(goalId) {
    const state = goalCardStates.get(goalId);
    if (!state) return;

    const card3d = document.getElementById(`card3d-${goalId}`);
    if (!card3d) return;

    state.tiltT += 0.016; // ~60fps

    // If unlocked, manage target rotation
    if (state.isUnlocked && !state.isAnimating) {
      // If not dragging, apply auto-tilt
      if (!state.dragActive) {
        state.targetRotate.x = Math.sin(state.tiltT * 0.7) * 8;
        state.targetRotate.y = Math.sin(state.tiltT) * 18;
      }
      // If dragging, targets are already set by mouse handler
    }

    // Lerp toward targets
    const lerpSpeed = 0.1;
    state.autoRotate.x += (state.targetRotate.x - state.autoRotate.x) * lerpSpeed;
    state.autoRotate.y += (state.targetRotate.y - state.autoRotate.y) * lerpSpeed;

    // Apply transforms
    card3d.style.transform = `rotateX(${state.autoRotate.x}deg) rotateY(${state.autoRotate.y}deg)`;

    // Update holo position based on tilt
    const holo = document.getElementById(`holo-${goalId}`);
    if (holo && state.isUnlocked) {
      const offset = state.autoRotate.y * 0.5;
      holo.style.backgroundPosition = `${50 + offset}% ${50}%`;
    }

    state.raqId = requestAnimationFrame(() => this.tiltLoop(goalId));
  },

  /**
   * Fire particle burst effect
   */
  fireParticles: function(goalId) {
    const pCanvas = document.getElementById(`pCanvas-${goalId}`);
    if (!pCanvas) return;

    const ctx = pCanvas.getContext('2d');
    const particles = [];
    const particleCount = 30;

    // Create particles
    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: this.CARD_W / 2,
        y: this.CARD_H / 2,
        vx: (Math.random() - 0.5) * 8,
        vy: (Math.random() - 0.5) * 8 - 2,
        life: 1,
        decay: Math.random() * 0.05 + 0.02,
        color: ['#FFD700', '#FFA500', '#FF69B4'][Math.floor(Math.random() * 3)],
        size: Math.random() * 4 + 2,
      });
    }

    const animateParticles = () => {
      ctx.clearRect(0, 0, this.CARD_W, this.CARD_H);

      let hasAlive = false;
      particles.forEach(p => {
        p.life -= p.decay;
        if (p.life > 0) {
          hasAlive = true;
          p.x += p.vx;
          p.y += p.vy;
          p.vy += 0.3; // gravity

          ctx.globalAlpha = p.life;
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        }
      });
      ctx.globalAlpha = 1;

      if (hasAlive) {
        requestAnimationFrame(animateParticles);
      }
    };

    animateParticles();
  },

  /**
   * Build snippet display slots
   */
  buildSnippetSlots: function(goalId) {
    const snippetRow = document.getElementById(`snippetRow-${goalId}`);
    if (!snippetRow) return;

    snippetRow.innerHTML = '';

    for (let i = 0; i < this.TOTAL; i++) {
      const slot = document.createElement('div');
      slot.className = 'cr-snippet-slot';
      slot.id = `snippet-${goalId}-${i}`;

      const canvas = document.createElement('canvas');
      canvas.width = this.SNIPPET_W;
      canvas.height = this.SNIPPET_H;
      canvas.style.width = '100%';
      canvas.style.height = '100%';

      const label = document.createElement('div');
      label.className = 'label';
      label.textContent = `${i + 1}/4`;

      slot.appendChild(canvas);
      slot.appendChild(label);

      // Add shimmer effect
      const shimmer = document.createElement('div');
      shimmer.className = 'shimmer';
      slot.appendChild(shimmer);

      snippetRow.appendChild(slot);
    }

    this.preloadThumbs(goalId);
    this.setupCardInteraction(goalId);
  },

  /**
   * Setup mouse interaction for card tilt override
   */
  setupCardInteraction: function(goalId) {
    const state = goalCardStates.get(goalId);
    if (!state) return;

    const scene = document.getElementById(`scene-${goalId}`);
    if (!scene) return;

    scene.addEventListener('mouseenter', () => {
      state.dragActive = true;
    });

    scene.addEventListener('mouseleave', () => {
      state.dragActive = false;
      // Reset tilt on mouse leave
      state.targetRotate.x = 0;
      state.targetRotate.y = 0;
    });

    scene.addEventListener('mousemove', (e) => {
      if (!state.dragActive) return;

      const rect = scene.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;

      // Calculate tilt based on mouse position
      const maxTilt = 15;
      state.targetRotate.x = (y / rect.height) * maxTilt;
      state.targetRotate.y = -(x / rect.width) * maxTilt;
    });
  },

  /**
   * Pre-render snippet thumbnails
   */
  preloadThumbs: function(goalId) {
    const state = goalCardStates.get(goalId);
    if (!state || !state.sourceImg) return;

    const quadW = this.CARD_W / this.COLS;
    const quadH = this.CARD_H / this.ROWS;

    for (let i = 0; i < this.TOTAL; i++) {
      const thumbCanvas = document.createElement('canvas');
      thumbCanvas.width = this.SNIPPET_W;
      thumbCanvas.height = this.SNIPPET_H;

      const ctx = thumbCanvas.getContext('2d');

      const row = Math.floor(i / this.COLS);
      const col = i % this.COLS;
      const sx = col * quadW;
      const sy = row * quadH;

      // Draw quad to thumbnail
      ctx.drawImage(
        state.sourceImg,
        sx, sy, quadW, quadH,
        0, 0, this.SNIPPET_W, this.SNIPPET_H
      );

      // Render to slot canvas
      const slotCanvas = document.querySelector(`#snippet-${goalId}-${i} canvas`);
      if (slotCanvas) {
        const slotCtx = slotCanvas.getContext('2d');
        slotCtx.drawImage(thumbCanvas, 0, 0);
      }

      state.snippetCanvases.set(i, thumbCanvas);
    }
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
  displaySharedGoal: function(goal, unlockedSegments) {
    const container = document.getElementById('shared-goal-container');
    if (!container) return;

    // Hide normal goals UI
    document.getElementById('goals-container').style.display = 'none';
    container.style.display = 'block';

    // Build blur segments HTML - 4 milestones: 25%, 50%, 75%, 100%
    let segmentsHTML = '';
    for (let i = 0; i < 4; i++) {
      const isUnlocked = unlockedSegments.includes(i);
      segmentsHTML += `<div class="blur-segment ${isUnlocked ? 'unlocked' : ''}" data-segment="${i}"></div>`;
    }

    // Get status badge
    let statusBadge = '🎯 Active';
    if (goal.status === 'completed') {
      statusBadge = '✓ Completed';
    } else if (goal.status === 'archived') {
      statusBadge = '📦 Archived';
    }

    // Get image URL
    const imageUrl = goal.card_image_url || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"%3E%3Crect fill="%23ccc" width="400" height="300"/%3E%3Ctext x="50%25" y="50%25" font-size="24" fill="%23666" text-anchor="middle" dominant-baseline="middle"%3ENo Image%3C/text%3E%3C/svg%3E';

    // Render shared goal view
    container.innerHTML = `
      <div class="shared-goal-header">
        <h1>${goal.title}</h1>
        <p class="shared-by">Shared Goal</p>
      </div>

      <div class="shared-goal-content">
        <div class="card-container">
          <div class="card-blur-wrapper">
            <div class="card-background">
              <img src="${imageUrl}" alt="goal card" class="card-image" />
            </div>

            <div class="card-blur-overlay ${goal.current_progress >= 100 ? 'completed' : ''}">
              <div class="blur-segments ${goal.current_progress >= 100 ? 'fully-unlocked' : ''}">
                ${segmentsHTML}
              </div>
            </div>

            <div class="card-content">
              <h3 class="goal-title">${goal.title}</h3>
              <p class="goal-category">${goal.category}</p>

              <div class="card-progress">
                <div class="progress-bar">
                  <div class="progress-fill" style="width: ${goal.current_progress}%"></div>
                </div>
                <span class="progress-text">${goal.current_progress.toFixed(0)}%</span>
              </div>

              <div class="goal-deadline">
                <span class="deadline-label">Due:</span>
                <span class="deadline-date">${goal.time_limit ? goal.time_limit.split('T')[0] : 'No deadline'}</span>
              </div>
            </div>
          </div>

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
        ${goal.notes ? `<div class="detail-section">
          <h3>Notes</h3>
          <p>${goal.notes}</p>
        </div>` : ''}
        <div class="detail-section">
          <h3>Created</h3>
          <p>${goal.created_at ? new Date(goal.created_at).toLocaleDateString() : 'Unknown'}</p>
        </div>
      </div>
    `;
  },

  // Setup Event Listeners
  setupEventListeners: function() {
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

    if (filtered.length === 0) {
      grid.style.display = 'none';
      empty.style.display = 'block';
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
    const clone = template.content.cloneNode(true);

    const card = clone.querySelector('.goal-card');
    card.dataset.goalId = goal.id;
    card.dataset.status = goal.status;

    // Set data for interactions
    card.dataset.title = goal.title;
    card.dataset.category = goal.category;

    // Replace template placeholders with actual goal ID
    const goalId = goal.id;
    const placeholdersToReplace = [
      'scene', 'card3d', 'mainCanvas', 'pCanvas', 'holo', 'shine', 'gold-border', 'stars', 'snippetRow'
    ];
    
    placeholdersToReplace.forEach(id => {
      const elements = clone.querySelectorAll(`#${id}-{{goalId}}`);
      elements.forEach(el => {
        el.id = `${id}-${goalId}`;
      });
    });

    // Background image (for shared view compatibility)
    const bgImg = clone.querySelector('.card-image');
    if (bgImg) {
      bgImg.src = goal.card_image_url || 'https://via.placeholder.com/800x600/e0e7ff/6366f1?text=Goal';
      bgImg.alt = goal.title;
    }

    // Content
    clone.querySelector('.goal-title').textContent = goal.title;
    clone.querySelector('.goal-category').textContent = goal.category;

    // Progress
    const progressFill = clone.querySelector('.progress-fill');
    progressFill.style.width = goal.current_progress + '%';
    clone.querySelector('.progress-text').textContent = Math.round(goal.current_progress) + '%';

    // Deadline (only shown for certain views)
    const deadlineEl = clone.querySelector('.goal-deadline');
    if (deadlineEl) {
      if (goal.time_limit) {
        const deadline = new Date(goal.time_limit);
        clone.querySelector('.deadline-date').textContent = deadline.toLocaleDateString();
      } else {
        deadlineEl.style.display = 'none';
      }
    }

    // Status badge
    const badge = clone.querySelector('.status-badge');
    if (badge) {
      badge.textContent = goal.status === 'completed' ? 'Completed' : goal.status === 'archived' ? 'Archived' : 'Active';
    }

    // Setup CR 3D canvas reveal system
    const imageUrl = goal.card_image_url || 'https://via.placeholder.com/800x600/e0e7ff/6366f1?text=Goal';
    Promise.resolve().then(() => {
      crCardSystem.initGoalCanvas(goalId, imageUrl, goal.current_progress);
      crCardSystem.buildSnippetSlots(goalId);
    });

    // Action buttons
    clone.querySelector('.edit-btn')?.addEventListener('click', () => this.openEditModal(goal.id));
    clone.querySelector('.share-btn')?.addEventListener('click', () => this.openShareModal(goal.id));
    clone.querySelector('.download-btn')?.addEventListener('click', () => this.downloadCard(goal.id));
    clone.querySelector('.delete-btn')?.addEventListener('click', () => this.deleteGoal(goal.id));

    // Click to update progress
    const cardContainer = clone.querySelector('.card-container');
    cardContainer.addEventListener('click', () => this.openProgressModal(goal.id));

    return clone;
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
        const oldQuads = Math.floor(oldProgress / 25);
        const newQuads = Math.floor(progress / 25);
        
        if (newQuads > oldQuads && newQuads <= 4) {
          crCardSystem.collectSnippet(goalId);
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
