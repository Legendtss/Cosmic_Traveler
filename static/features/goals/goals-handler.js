/**
 * Goals Feature Handler
 * Manages goal creation, updating, sharing, and progressive blur reveal system
 */

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

    // Build blur segments HTML
    let segmentsHTML = '';
    for (let i = 0; i < 10; i++) {
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

    // Background image
    const bgImg = clone.querySelector('.card-image');
    bgImg.src = goal.card_image_url || 'https://via.placeholder.com/800x600/e0e7ff/6366f1?text=Goal';
    bgImg.alt = goal.title;

    // Content
    clone.querySelector('.goal-title').textContent = goal.title;
    clone.querySelector('.goal-category').textContent = goal.category;

    // Progress
    const progressFill = clone.querySelector('.progress-fill');
    progressFill.style.width = goal.current_progress + '%';
    clone.querySelector('.progress-text').textContent = Math.round(goal.current_progress) + '%';

    // Deadline
    if (goal.time_limit) {
      const deadline = new Date(goal.time_limit);
      clone.querySelector('.deadline-date').textContent = deadline.toLocaleDateString();
    } else {
      clone.querySelector('.goal-deadline').style.display = 'none';
    }

    // Status badge
    const badge = clone.querySelector('.status-badge');
    badge.textContent = goal.status === 'completed' ? 'Completed' : goal.status === 'archived' ? 'Archived' : 'Active';

    // Setup blur reveal system
    this.setupBlurReveal(clone, goal);

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
  setupBlurReveal: function(cardElement, goal) {
    const segments = cardElement.querySelectorAll('.blur-segment');
    const overlay = cardElement.querySelector('.card-blur-overlay');
    const segmentsContainer = cardElement.querySelector('.blur-segments');

    // Calculate how many segments should be unlocked (10 total segments)
    const unlockedCount = Math.ceil((goal.current_progress / 100) * 10);

    // Update segments
    segments.forEach((segment, index) => {
      if (index < unlockedCount) {
        segment.classList.add('unlocked');
        segment.classList.add('unlocking'); // Trigger animation
      } else {
        segment.classList.remove('unlocked');
      }
    });

    // If fully completed (100%), add special gold effect
    if (goal.current_progress >= 100) {
      overlay.classList.add('completed');
      segmentsContainer.classList.add('fully-unlocked');
    }
  },

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

      if (response.ok) {
        this.closeModal('goal-modal');
        this.loadGoals();
        this.showNotification('Goal ' + (this.goalsState.editingGoalId ? 'updated' : 'created') + ' successfully!', 'success');
      } else {
        this.showNotification('Failed to save goal', 'error');
      }
    } catch (error) {
      console.error('Error submitting goal:', error);
      this.showNotification('Error saving goal', 'error');
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
