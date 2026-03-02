
// ---------------------------------------------------------------------------
// AI Avatar Chat Widget
// ---------------------------------------------------------------------------

let aiChatOpen = false;
let aiPendingAction = null; // Stores the last confirmation payload
let _aiSending = false;      // Lock: true while a request is in-flight
let _aiLastSendTs = 0;       // Epoch ms of last send (cooldown guard)
const _AI_COOLDOWN_MS = 2500; // Minimum ms between sends

// --- Mode-based state ---
let chatbotMode = 'general'; // "nutrition" | "workout" | "task" | "general"
const AI_SESSION_STORAGE_KEY = 'fittrack_ai_session_id_v1';

const _AI_MODE_META = {
  general:   { label: 'General Query',  emoji: '💬', placeholder: 'Ask me anything...' },
  nutrition: { label: 'Nutrition Logging', emoji: '🍽️', placeholder: 'Describe what you ate…' },
  workout:   { label: 'Workout Logging',  emoji: '🏋️', placeholder: 'Describe your workout…' },
  task:      { label: 'Add Task',        emoji: '📋', placeholder: 'Describe the task…' },
};

function _aiSessionId() {
  let sessionId = null;
  try {
    sessionId = sessionStorage.getItem(AI_SESSION_STORAGE_KEY);
    if (!sessionId) {
      sessionId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      sessionStorage.setItem(AI_SESSION_STORAGE_KEY, sessionId);
    }
  } catch (_err) {
    sessionId = 'no-session-storage';
  }
  return sessionId;
}

function _aiSetMode(mode) {
  if (!_AI_MODE_META[mode]) mode = 'general';
  chatbotMode = mode;

  // Update indicator ribbon
  const indicator = document.getElementById('ai-chat-mode-indicator');
  const badge = document.getElementById('ai-mode-badge');
  if (indicator) indicator.setAttribute('data-mode', mode);
  if (badge) badge.textContent = `${_AI_MODE_META[mode].emoji} Mode: ${_AI_MODE_META[mode].label}`;

  // Update placeholder
  const inp = document.getElementById('ai-chat-input');
  if (inp) inp.placeholder = _AI_MODE_META[mode].placeholder;

  // Clear any pending confirmation when mode changes
  if (aiPendingAction) {
    aiPendingAction = null;
    _aiShowConfirmBar(false);
  }
}

function toggleAIChat(forceClose) {
  if (forceClose === true) {
    aiChatOpen = false;
  } else {
    aiChatOpen = !aiChatOpen;
  }
  const panel = document.getElementById('ai-chat-panel');
  if (!panel) return;
  panel.classList.toggle('ai-chat-hidden', !aiChatOpen);

  if (aiChatOpen) {
    const inp = document.getElementById('ai-chat-input');
    if (inp) {
      setTimeout(() => inp.focus(), 150);
      // Attach Enter key listener once
      if (!inp._aiKeyBound) {
        inp._aiKeyBound = true;
        inp.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendAIMessage();
          }
        });
      }
    }
    // Auto-trigger mentor check-in on first open
    if (!_mentorMessageShown) {
      setTimeout(() => generateMentorMessage(), 300);
    }
  }
}

// Click-away: close chat when clicking outside panel and FAB
document.addEventListener('click', (e) => {
  if (!aiChatOpen) return;
  const panel = document.getElementById('ai-chat-panel');
  const fab = document.getElementById('ai-avatar-fab');
  if (!panel || !fab) return;
  if (!panel.contains(e.target) && !fab.contains(e.target)) {
    toggleAIChat(true);
  }
});

function _aiAddMessage(html, sender) {
  const container = document.getElementById('ai-chat-messages');
  if (!container) return;
  const div = document.createElement('div');
  div.className = `ai-msg ai-msg-${sender}`;
  div.innerHTML = `<div class="ai-msg-bubble">${html}</div>`;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

function _aiShowConfirmBar(show) {
  const bar = document.getElementById('ai-chat-confirm-bar');
  if (bar) bar.classList.toggle('ai-chat-hidden', !show);
}

function _escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/** Lightweight markdown-to-HTML for bot messages (bold, italic, bullets, newlines, code) */
function _aiMarkdown(text) {
  if (!text) return '';
  let html = _escapeHtml(text);
  // Code blocks (triple backtick)
  html = html.replace(/```([\s\S]*?)```/g, '<pre class="ai-code-block">$1</pre>');
  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  // Bold (**text** or __text__)
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');
  // Italic (*text* or _text_) — careful not to match inside words
  html = html.replace(/(?<!\w)\*([^*]+?)\*(?!\w)/g, '<em>$1</em>');
  html = html.replace(/(?<!\w)_([^_]+?)_(?!\w)/g, '<em>$1</em>');
  // Bullet points (lines starting with - or •)
  html = html.replace(/^[\-•]\s+(.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>');
  // Numbered lists (1. 2. etc)
  html = html.replace(/^\d+\.\s+(.+)$/gm, '<li>$1</li>');
  // Newlines to <br>
  html = html.replace(/\n/g, '<br>');
  return html;
}

function _detectCurrentPage() {
  // Try to detect which page is active
  const pages = ['dashboard', 'nutrition', 'tasks', 'projects', 'workout', 'statistics', 'profile'];
  for (const p of pages) {
    const el = document.getElementById(p);
    if (el && !el.classList.contains('hidden') && el.offsetParent !== null) return p;
  }
  return 'dashboard';
}

async function sendAIMessage() {
  // --- Guard 1: prevent concurrent sends ---
  if (_aiSending) return;

  // --- Guard 2: cooldown ---
  const now = Date.now();
  if (now - _aiLastSendTs < _AI_COOLDOWN_MS) {
    console.log('[AI] Cooldown active, skipping duplicate send');
    return;
  }

  const inp = document.getElementById('ai-chat-input');
  const msg = (inp?.value || '').trim();
  if (!msg) return;
  inp.value = '';

  _aiSending = true;
  _aiLastSendTs = now;

  // Show user message
  _aiAddMessage(_escapeHtml(msg), 'user');

  // Show typing indicator
  _aiAddMessage('<span class="ai-typing"><span>.</span><span>.</span><span>.</span></span>', 'bot');
  const container = document.getElementById('ai-chat-messages');

  try {
    const payload = {
      message: msg,
      mode: chatbotMode,
      context: {
        session_id: _aiSessionId(),
        current_page: _detectCurrentPage(),
        user_preferences: {
          goal: typeof profileState !== 'undefined' ? (profileState.weightGoal || 'maintenance') : 'maintenance',
          diet_type: 'mixed'
        }
      }
    };

    console.log('[AI] Sending to Gemini proxy:', payload);

    const response = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    let data = {};
    try {
      data = await response.json();
    } catch (_jsonErr) {
      data = {};
    }

    console.log('[AI] Gemini response:', data);

    if (!response.ok) {
      throw new Error(data.error || `AI request failed (${response.status})`);
    }

    // Remove typing indicator
    if (container && container.lastChild) container.removeChild(container.lastChild);

    _renderAIResponse(data);

  } catch (err) {
    if (container && container.lastChild) container.removeChild(container.lastChild);
    // In demo mode, fall back to local AI parser when server is unreachable
    if (activeDemoUserId && typeof _aiLocalFallback === 'function') {
      console.warn('[AI] Server unavailable, using local fallback:', err.message);
      const fallbackData = _aiLocalFallback(msg, chatbotMode);
      _renderAIResponse(fallbackData);
    } else {
      _aiAddMessage(`<i class="fas fa-exclamation-triangle"></i> ${_escapeHtml(err.message || 'Something went wrong.')}`, 'bot');
    }
  } finally {
    _aiSending = false;
  }
}

function _renderAIResponse(data) {
  if (!data || !data.status) {
    _aiAddMessage('I received an unexpected response. Please try again.', 'bot');
    return;
  }

  if (data.status === 'chat_response') {
    _aiAddMessage(_aiMarkdown(data.message || 'No response.'), 'bot');
    return;
  }

  if (data.status === 'clarification_needed') {
    _aiAddMessage(`<i class="fas fa-question-circle" style="color:#f59e0b;margin-right:4px"></i> ${_aiMarkdown(data.message)}`, 'bot');
    return;
  }

  if (data.status === 'manual_fallback') {
    _aiAddMessage(`<i class="fas fa-tools" style="color:#f59e0b;margin-right:4px"></i> ${_aiMarkdown(data.message || 'Please use manual forms for this entry.')}`, 'bot');
    return;
  }

  if (data.status === 'confirmation_required') {
    // Clean up old nutrition item markers from previous confirmations to prevent stale data
    document.querySelectorAll('[data-ai-item]').forEach(el => el.removeAttribute('data-ai-item'));
    aiPendingAction = data;
    let html = '';

    // Summary
    html += `<strong>${_escapeHtml(data.summary || 'Action detected')}</strong><br>`;

    if (data.confidence) {
      const confClass = data.confidence === 'high' ? 'ai-conf-high' : data.confidence === 'medium' ? 'ai-conf-med' : 'ai-conf-low';
      html += `<span class="ai-conf-badge ${confClass}" style="margin:6px 0;display:inline-flex"><i class="fas fa-${data.confidence === 'high' ? 'check-circle' : data.confidence === 'medium' ? 'info-circle' : 'exclamation-triangle'}"></i> ${data.confidence} confidence</span><br>`;
    }

    // Render EDITABLE details by action type
    if (data.action_type === 'log_nutrition' && data.details) {
      const d = data.details;
      html += `<div class="nutrition-card" style="border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; background: #fff; margin-top: 8px; animation: softPop 0.25s ease-out;">`;
      html += `<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">`;
      html += `<strong style="font-size: 1.05rem; color: #0f2538;">🥗 Log Nutrition</strong>`;
      if (data.confidence) {
        const confColor = data.confidence === 'high' ? '#10b981' : data.confidence === 'medium' ? '#f59e0b' : '#ef4444';
        const confIcon = data.confidence === 'high' ? 'check-circle' : data.confidence === 'medium' ? 'info-circle' : 'exclamation-triangle';
        html += `<span style="color: ${confColor}; font-size: 0.85rem; font-weight: 600; display: flex; align-items: center; gap: 4px;"><i class="fas fa-${confIcon}"></i> ${data.confidence.charAt(0).toUpperCase() + data.confidence.slice(1)} Confidence</span>`;
      }
      html += `</div>`;
      
      html += `<div style="margin-bottom: 16px; font-size: 0.9rem; color: #475569;">`;
      html += `Meal: <select id="ai-edit-meal-type" class="ai-edit-select" style="padding: 4px 8px; border-radius: 6px; border: 1px solid #cbd5e1; background: #f8fafc; font-weight: 500; color: #0f2538;">`;
      for (const mt of ['breakfast', 'lunch', 'dinner', 'snack']) {
        html += `<option value="${mt}"${(d.meal_type || 'snack') === mt ? ' selected' : ''}>${mt.charAt(0).toUpperCase() + mt.slice(1)}</option>`;
      }
      html += `</select></div>`;
      
      html += `<div style="display: flex; flex-direction: column; gap: 12px;">`;
      (d.items || []).forEach((item, idx) => {
        const componentsText = Array.isArray(item.components)
          ? item.components.map(c => `${c.item || ''} (${c.qty || ''})`).filter(Boolean).join(', ')
          : '';
        // Compute per-unit base macros for qty scaling
        const bq = parseFloat(item.quantity) || 1;
        const bCal = bq > 0 ? item.calories / bq : item.calories;
        const bP = bq > 0 ? item.protein / bq : item.protein;
        const bC = bq > 0 ? item.carbs / bq : item.carbs;
        const bF = bq > 0 ? item.fats / bq : item.fats;
        
        html += `<div data-ai-item="${idx}" data-base-cal="${bCal}" data-base-p="${bP}" data-base-c="${bC}" data-base-f="${bF}" style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px; position: relative;">`;
        html += `<button class="ai-edit-del" onclick="_aiRemoveItem(${idx})" title="Remove" style="position: absolute; top: 12px; right: 12px; background: none; border: none; color: #ef4444; cursor: pointer; padding: 4px; border-radius: 4px;"><i class="fas fa-trash-alt"></i></button>`;
        
        html += `<div style="display: flex; gap: 8px; margin-bottom: 12px; padding-right: 24px;">`;
        html += `<input class="ai-edit-input ai-edit-name food-input" data-idx="${idx}" value="${_escapeHtml(item.name)}" style="flex: 1; font-weight: 600; color: #0f2538; border: 1px solid #cbd5e1; border-radius: 8px; padding: 6px 10px;" placeholder="Food name">`;
        html += `<div style="display: flex; align-items: center; gap: 4px; background: #fff; border: 1px solid #cbd5e1; border-radius: 8px; padding: 2px 8px;"><span style="font-size: 0.8rem; color: #64748b;">Qty</span><input class="ai-edit-input ai-edit-qty food-input" data-idx="${idx}" type="number" min="0" step="0.5" value="${item.quantity}" oninput="_aiOnQtyChange(${idx})" style="width: 40px; border: none; background: transparent; font-weight: 600; color: #0f2538; text-align: center; padding: 4px 0;"></div>`;
        html += `</div>`;
        
        if (componentsText) {
          html += `<input class="ai-edit-input ai-edit-components food-input" data-idx="${idx}" value="${_escapeHtml(componentsText)}" style="width: 100%; margin-bottom: 12px; font-size: 0.85rem; color: #64748b; border: 1px solid #e2e8f0; border-radius: 6px; padding: 4px 8px; background: #fff;" placeholder="Components">`;
        }
        
        html += `<div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px;">`;
        
        // Calories (Prominent)
        html += `<div style="display: flex; align-items: center; justify-content: space-between; background: #fff5eb; border: 1px solid #fed7aa; border-radius: 8px; padding: 8px 12px;">`;
        html += `<span style="font-size: 0.85rem; font-weight: 600; color: #ea580c; display: flex; align-items: center; gap: 6px;">🔥 Calories</span>`;
        html += `<div style="display: flex; align-items: center; gap: 4px;"><input class="ai-edit-input ai-edit-cal calorie-input" data-idx="${idx}" type="number" min="0" value="${item.calories}" oninput="_aiOnMacroEdit(${idx})" style="width: 50px; border: none; background: transparent; font-weight: 700; color: #ea580c; text-align: right; font-size: 15px;"> <span style="font-size: 0.8rem; color: #ea580c; font-weight: 600;">kcal</span></div>`;
        html += `</div>`;
        
        // Protein
        html += `<div class="macro-pill" style="display: flex; align-items: center; justify-content: space-between; background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 8px 12px;">`;
        html += `<span style="font-size: 0.85rem; font-weight: 600; color: #dc2626; display: flex; align-items: center; gap: 6px;">🥩 Protein</span>`;
        html += `<div style="display: flex; align-items: center; gap: 4px;"><input class="ai-edit-input ai-edit-p" data-idx="${idx}" type="number" min="0" step="0.1" value="${item.protein}" oninput="_aiOnMacroEdit(${idx})" style="width: 40px; border: none; background: transparent; font-weight: 600; color: #dc2626; text-align: right;"> <span style="font-size: 0.8rem; color: #dc2626; font-weight: 600;">g</span></div>`;
        html += `</div>`;
        
        // Carbs
        html += `<div class="macro-pill" style="display: flex; align-items: center; justify-content: space-between; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 8px 12px;">`;
        html += `<span style="font-size: 0.85rem; font-weight: 600; color: #2563eb; display: flex; align-items: center; gap: 6px;">🍞 Carbs</span>`;
        html += `<div style="display: flex; align-items: center; gap: 4px;"><input class="ai-edit-input ai-edit-c" data-idx="${idx}" type="number" min="0" step="0.1" value="${item.carbs}" oninput="_aiOnMacroEdit(${idx})" style="width: 40px; border: none; background: transparent; font-weight: 600; color: #2563eb; text-align: right;"> <span style="font-size: 0.8rem; color: #2563eb; font-weight: 600;">g</span></div>`;
        html += `</div>`;
        
        // Fats
        html += `<div class="macro-pill" style="display: flex; align-items: center; justify-content: space-between; background: #fefce8; border: 1px solid #fef08a; border-radius: 8px; padding: 8px 12px;">`;
        html += `<span style="font-size: 0.85rem; font-weight: 600; color: #ca8a04; display: flex; align-items: center; gap: 6px;">🧈 Fats</span>`;
        html += `<div style="display: flex; align-items: center; gap: 4px;"><input class="ai-edit-input ai-edit-f" data-idx="${idx}" type="number" min="0" step="0.1" value="${item.fats}" oninput="_aiOnMacroEdit(${idx})" style="width: 40px; border: none; background: transparent; font-weight: 600; color: #ca8a04; text-align: right;"> <span style="font-size: 0.8rem; color: #ca8a04; font-weight: 600;">g</span></div>`;
        html += `</div>`;
        
        html += `</div></div>`;
      });
      html += `</div>`;
      
      html += `<div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center;">`;
      html += `<button class="ai-edit-add-btn" onclick="_aiAddItem()" style="background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; padding: 6px 12px; border-radius: 6px; font-size: 0.85rem; font-weight: 600; cursor: pointer; transition: all 0.2s;"><i class="fas fa-plus"></i> Add Item</button>`;
      html += `<span style="font-size: 0.8rem; color: #64748b;"><i class="fas fa-pencil-alt"></i> Edit before confirm</span>`;
      html += `</div>`;
      html += `</div>`;
    } else if (data.action_type === 'add_task' && data.details) {
      const d = data.details;
      html += `<div class="ai-chat-detail ai-edit-task-form">`;
      html += `📋 <label>Title:</label> <input class="ai-edit-input ai-edit-task-title" value="${_escapeHtml(d.title)}" style="width:100%"><br>`;
      html += `📅 <label>Date:</label> <input class="ai-edit-input ai-edit-task-date" type="date" value="${d.date || ''}"><br>`;
      html += `⚡ <label>Priority:</label> <select class="ai-edit-select ai-edit-task-priority">`;
      for (const p of ['low', 'medium', 'high']) {
        html += `<option value="${p}"${(d.priority || 'medium') === p ? ' selected' : ''}>${p.charAt(0).toUpperCase() + p.slice(1)}</option>`;
      }
      html += `</select><br>`;
      html += `🏷️ <label>Tags:</label> <input class="ai-edit-input ai-edit-task-tags" value="${(d.tags || []).map(t => '#' + t).join(' ')}" placeholder="#tag1 #tag2">`;
      html += `</div>`;
    } else if (data.action_type === 'log_workout' && data.details) {
      const d = data.details;
      html += `<div class="ai-chat-detail ai-edit-workout-form">`;
      html += `🏋️ <label>Name:</label> <input class="ai-edit-input ai-edit-workout-name" value="${_escapeHtml(d.name || '')}" style="width:100%"><br>`;
      html += `🏃 <label>Type:</label> <select class="ai-edit-select ai-edit-workout-type">`;
      for (const t of ['cardio', 'strength', 'flexibility', 'hiit', 'sports', 'other']) {
        html += `<option value="${t}"${(d.type || 'other') === t ? ' selected' : ''}>${t.charAt(0).toUpperCase() + t.slice(1)}</option>`;
      }
      html += `</select><br>`;
      html += `⏱️ <label>Duration (min):</label> <input class="ai-edit-input ai-edit-workout-duration" type="number" min="0" value="${d.duration || 0}" style="width:60px"><br>`;
      html += `🔥 <label>Calories burned:</label> <input class="ai-edit-input ai-edit-workout-cals" type="number" min="0" value="${d.calories_burned || 0}" style="width:60px"><br>`;
      html += `💪 <label>Intensity:</label> <select class="ai-edit-select ai-edit-workout-intensity">`;
      for (const i of ['low', 'medium', 'high']) {
        html += `<option value="${i}"${(d.intensity || 'medium') === i ? ' selected' : ''}>${i.charAt(0).toUpperCase() + i.slice(1)}</option>`;
      }
      html += `</select><br>`;
      if (d.exercises && d.exercises.length) {
        html += `<label>Exercises:</label><br>`;
        d.exercises.forEach((ex, idx) => {
          html += `<div class="ai-edit-subtask-row"><input class="ai-edit-input ai-edit-exercise" data-idx="${idx}" value="${_escapeHtml(typeof ex === 'string' ? ex : (ex.name || ''))}" style="flex:1"></div>`;
        });
      }
      html += `📝 <label>Notes:</label> <input class="ai-edit-input ai-edit-workout-notes" value="${_escapeHtml(d.notes || '')}" style="width:100%">`;
      html += `</div>`;
    } else if (data.action_type === 'add_project' && data.details) {
      const d = data.details;
      html += `<div class="ai-chat-detail ai-edit-project-form">`;
      html += `📁 <label>Name:</label> <input class="ai-edit-input ai-edit-proj-name" value="${_escapeHtml(d.name)}" style="width:100%"><br>`;
      html += `📝 <label>Description:</label> <input class="ai-edit-input ai-edit-proj-desc" value="${_escapeHtml(d.description || '')}" style="width:100%"><br>`;
      if (d.subtasks && d.subtasks.length) {
        html += `<br><small>Subtasks:</small><br>`;
        d.subtasks.forEach((st, i) => {
          html += `<div class="ai-edit-subtask-row"><input class="ai-edit-input ai-edit-subtask" data-idx="${i}" value="${_escapeHtml(st)}"> <button class="ai-edit-del" onclick="_aiRemoveSubtask(${i})" title="Remove"><i class="fas fa-trash-alt"></i></button></div>`;
        });
      }
      html += `<button class="ai-edit-add-btn" onclick="_aiAddSubtask()"><i class="fas fa-plus"></i> Add subtask</button>`;
      html += `</div>`;
    }

    html += `<br><small>✏️ Edit any field above, then Confirm or Cancel.</small>`;
    _aiAddMessage(html, 'bot');
    _aiShowConfirmBar(true);
    return;
  }

  // Unknown status
  _aiAddMessage(data.message || JSON.stringify(data), 'bot');
}

async function aiConfirmAction() {
  if (!aiPendingAction) return;
  _aiSyncEditsToPayload(); // read any edited values from inline form
  _aiShowConfirmBar(false);

  const data = aiPendingAction;
  aiPendingAction = null;
  // Strip old nutrition item markers so they can't leak into future confirmations
  document.querySelectorAll('[data-ai-item]').forEach(el => el.removeAttribute('data-ai-item'));

  _aiAddMessage('<span class="ai-typing"><span>.</span><span>.</span><span>.</span></span>', 'bot');
  const container = document.getElementById('ai-chat-messages');

  try {
    let result;

    if (typeof activeDemoUserId !== 'undefined' && activeDemoUserId) {
      result = _aiExecuteDemo(data);
    } else {
      const response = await fetch('/api/ai/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          confirmed: true,
          action_type: data.action_type,
          payload: data.details
        })
      });
      result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Execution failed');
    }

    if (container && container.lastChild) container.removeChild(container.lastChild);

    if (result.status === 'executed') {
      let msg = '<i class="fas fa-check-circle" style="color:#10b981"></i> ';
      if (result.action_type === 'log_nutrition') {
        const firstItemName = data.details.items && data.details.items.length > 0 ? data.details.items[0].name : 'food';
        const mealType = data.details.meal_type ? data.details.meal_type.charAt(0).toUpperCase() + data.details.meal_type.slice(1) : 'Snack';
        msg += `Logged ${firstItemName}${data.details.items.length > 1 ? ` and ${data.details.items.length - 1} other item(s)` : ''} as ${mealType} 🍽️<br><br>Want to add another item or finish?`;
        if (typeof loadMeals === 'function') loadMeals();
        if (typeof refreshStreaksAfterChange === 'function') refreshStreaksAfterChange();
      } else if (result.action_type === 'add_task') {
        msg += `Task "${_escapeHtml(result.task?.title || '')}" is on your list! 📋 Check your Tasks page or Calendar.`;
        if (typeof loadTasks === 'function') loadTasks();
        if (typeof renderCalendar === 'function') renderCalendar();
        if (typeof refreshStreaksAfterChange === 'function') refreshStreaksAfterChange();
      } else if (result.action_type === 'log_workout') {
        msg += `Workout "${_escapeHtml(result.workout?.name || '')}" logged! 🏋️ Check your Workout page.`;
        if (typeof loadWorkoutsForPage === 'function') loadWorkoutsForPage();
        if (typeof refreshStreaksAfterChange === 'function') refreshStreaksAfterChange();
      } else if (result.action_type === 'add_project') {
        msg += `Project "${_escapeHtml(result.project?.name || '')}" created! 📁`;
      }
      _aiAddMessage(msg, 'bot');
    } else {
      _aiAddMessage('Action completed.', 'bot');
    }

  } catch (err) {
    if (container && container.lastChild) container.removeChild(container.lastChild);
    _aiAddMessage(`<i class="fas fa-exclamation-triangle"></i> ${_escapeHtml(err.message)}`, 'bot');
  }
}

/** Read edited values from the inline form back into aiPendingAction before confirming */
function _aiSyncEditsToPayload() {
  if (!aiPendingAction) return;
  const d = aiPendingAction.details;

  if (aiPendingAction.action_type === 'log_nutrition' && d) {
    // Meal type
    const mtSel = document.querySelector('#ai-edit-meal-type');
    if (mtSel) d.meal_type = mtSel.value;

    // Items — scope to the LAST nutrition card to avoid picking up old confirmed meals
    const activeCard = Array.from(document.querySelectorAll('.nutrition-card')).pop();
    const rows = activeCard ? activeCard.querySelectorAll('[data-ai-item]') : document.querySelectorAll('[data-ai-item]');
    const newItems = [];
    rows.forEach((row) => {
      const idx = parseInt(row.dataset.aiItem, 10);
      const nameEl = row.querySelector('.ai-edit-name');
      const qtyEl = row.querySelector('.ai-edit-qty');
      const calEl = row.querySelector('.ai-edit-cal');
      const pEl = row.querySelector('.ai-edit-p');
      const cEl = row.querySelector('.ai-edit-c');
      const fEl = row.querySelector('.ai-edit-f');
      const compsEl = row.querySelector('.ai-edit-components');
      const components = (compsEl?.value || '')
        .split(',')
        .map(s => s.trim())
        .filter(Boolean)
        .map(raw => {
          const m = raw.match(/^(.*)\((.*)\)$/);
          if (m) return { item: m[1].trim(), qty: m[2].trim() || '1 serving' };
          return { item: raw, qty: '1 serving' };
        });
      newItems.push({
        name: nameEl ? nameEl.value.trim() || 'Item' : (d.items[idx]?.name || 'Item'),
        quantity: qtyEl ? parseFloat(qtyEl.value) || 1 : 1,
        unit: d.items[idx]?.unit || 'serving',
        components,
        calories: calEl ? parseInt(calEl.value) || 0 : 0,
        protein: pEl ? parseFloat(pEl.value) || 0 : 0,
        carbs: cEl ? parseFloat(cEl.value) || 0 : 0,
        fats: fEl ? parseFloat(fEl.value) || 0 : 0,
        is_estimate: d.items[idx]?.is_estimate ?? true,
        note: d.items[idx]?.note || ''
      });
    });
    d.items = newItems;
    d.total = {
      calories: newItems.reduce((s, i) => s + i.calories, 0),
      protein: Math.round(newItems.reduce((s, i) => s + i.protein, 0) * 10) / 10,
      carbs: Math.round(newItems.reduce((s, i) => s + i.carbs, 0) * 10) / 10,
      fats: Math.round(newItems.reduce((s, i) => s + i.fats, 0) * 10) / 10,
    };
  }

  if (aiPendingAction.action_type === 'add_task' && d) {
    const titleEl = document.querySelector('.ai-edit-task-title');
    const dateEl = document.querySelector('.ai-edit-task-date');
    const prioEl = document.querySelector('.ai-edit-task-priority');
    const tagsEl = document.querySelector('.ai-edit-task-tags');
    if (titleEl) d.title = titleEl.value.trim() || d.title;
    if (dateEl) d.date = dateEl.value || d.date;
    if (prioEl) d.priority = prioEl.value || d.priority;
    if (tagsEl) d.tags = (tagsEl.value.match(/#(\w+)/g) || []).map(t => t.slice(1));
  }

  if (aiPendingAction.action_type === 'log_workout' && d) {
    const nameEl = document.querySelector('.ai-edit-workout-name');
    const typeEl = document.querySelector('.ai-edit-workout-type');
    const durEl = document.querySelector('.ai-edit-workout-duration');
    const calsEl = document.querySelector('.ai-edit-workout-cals');
    const intEl = document.querySelector('.ai-edit-workout-intensity');
    const notesEl = document.querySelector('.ai-edit-workout-notes');
    if (nameEl) d.name = nameEl.value.trim() || d.name;
    if (typeEl) d.type = typeEl.value || d.type;
    if (durEl) d.duration = parseInt(durEl.value) || 0;
    if (calsEl) d.calories_burned = parseInt(calsEl.value) || 0;
    if (intEl) d.intensity = intEl.value || d.intensity;
    if (notesEl) d.notes = notesEl.value.trim();
    const exerciseEls = document.querySelectorAll('.ai-edit-exercise');
    if (exerciseEls.length) {
      d.exercises = Array.from(exerciseEls).map(el => el.value.trim()).filter(Boolean);
    }
  }

  if (aiPendingAction.action_type === 'add_project' && d) {
    const nameEl = document.querySelector('.ai-edit-proj-name');
    const descEl = document.querySelector('.ai-edit-proj-desc');
    if (nameEl) d.name = nameEl.value.trim() || d.name;
    if (descEl) d.description = descEl.value.trim();
    const subtaskEls = document.querySelectorAll('.ai-edit-subtask');
    if (subtaskEls.length) {
      d.subtasks = Array.from(subtaskEls).map(el => el.value.trim()).filter(Boolean);
    }
  }
}

/** Recalculate macros when user changes quantity */
function _aiOnQtyChange(idx) {
  const activeCard = Array.from(document.querySelectorAll('.nutrition-card')).pop();
  if (!activeCard) return;
  const card = activeCard.querySelector(`[data-ai-item="${idx}"]`);
  if (!card) return;
  const qty = parseFloat(card.querySelector('.ai-edit-qty')?.value) || 1;
  const baseCal = parseFloat(card.dataset.baseCal) || 0;
  const baseP = parseFloat(card.dataset.baseP) || 0;
  const baseC = parseFloat(card.dataset.baseC) || 0;
  const baseF = parseFloat(card.dataset.baseF) || 0;
  const calInput = card.querySelector('.ai-edit-cal');
  const pInput = card.querySelector('.ai-edit-p');
  const cInput = card.querySelector('.ai-edit-c');
  const fInput = card.querySelector('.ai-edit-f');
  if (calInput) calInput.value = Math.round(baseCal * qty);
  if (pInput) pInput.value = Math.round(baseP * qty * 10) / 10;
  if (cInput) cInput.value = Math.round(baseC * qty * 10) / 10;
  if (fInput) fInput.value = Math.round(baseF * qty * 10) / 10;
}

/** When user manually edits a macro, update its per-unit base so future qty changes stay proportional */
function _aiOnMacroEdit(idx) {
  const activeCard = Array.from(document.querySelectorAll('.nutrition-card')).pop();
  if (!activeCard) return;
  const card = activeCard.querySelector(`[data-ai-item="${idx}"]`);
  if (!card) return;
  const qty = parseFloat(card.querySelector('.ai-edit-qty')?.value) || 1;
  const calInput = card.querySelector('.ai-edit-cal');
  const pInput = card.querySelector('.ai-edit-p');
  const cInput = card.querySelector('.ai-edit-c');
  const fInput = card.querySelector('.ai-edit-f');
  if (calInput) card.dataset.baseCal = (parseFloat(calInput.value) || 0) / qty;
  if (pInput) card.dataset.baseP = (parseFloat(pInput.value) || 0) / qty;
  if (cInput) card.dataset.baseC = (parseFloat(cInput.value) || 0) / qty;
  if (fInput) card.dataset.baseF = (parseFloat(fInput.value) || 0) / qty;
}

/** Remove a nutrition item card */
function _aiRemoveItem(idx) {
  const activeCard = Array.from(document.querySelectorAll('.nutrition-card')).pop();
  const row = activeCard ? activeCard.querySelector(`[data-ai-item="${idx}"]`) : document.querySelector(`[data-ai-item="${idx}"]`);
  if (row) row.remove();
  // Re-index remaining cards and update inline handlers
  const remaining = activeCard ? activeCard.querySelectorAll('[data-ai-item]') : document.querySelectorAll('[data-ai-item]');
  remaining.forEach((r, i) => {
    r.dataset.aiItem = i;
    r.querySelectorAll('[data-idx]').forEach(el => { el.dataset.idx = i; });
    const delBtn = r.querySelector('.ai-edit-del');
    if (delBtn) delBtn.setAttribute('onclick', `_aiRemoveItem(${i})`);
    const qtyEl = r.querySelector('.ai-edit-qty');
    if (qtyEl) qtyEl.setAttribute('oninput', `_aiOnQtyChange(${i})`);
    r.querySelectorAll('.ai-edit-cal, .ai-edit-p, .ai-edit-c, .ai-edit-f').forEach(el => {
      el.setAttribute('oninput', `_aiOnMacroEdit(${i})`);
    });
  });
  if (aiPendingAction?.details?.items) {
    aiPendingAction.details.items.splice(idx, 1);
  }
}

/** Add new blank nutrition item card */
function _aiAddItem() {
  if (!aiPendingAction?.details?.items) return;
  const newIdx = aiPendingAction.details.items.length;
  aiPendingAction.details.items.push({ name: '', quantity: 1, unit: 'serving', components: [], calories: 0, protein: 0, carbs: 0, fats: 0, is_estimate: true, note: '' });
  // Scope to the LAST nutrition card
  const activeNutritionCard = Array.from(document.querySelectorAll('.nutrition-card')).pop();
  if (!activeNutritionCard) return;
  const existingItems = activeNutritionCard.querySelectorAll('[data-ai-item]');
  const container = existingItems.length > 0 ? existingItems[0].parentElement : activeNutritionCard.querySelector('div[style*="flex-direction"]');
  if (!container) return;
  const card = document.createElement('div');
  card.dataset.aiItem = newIdx;
  card.dataset.baseCal = '0';
  card.dataset.baseP = '0';
  card.dataset.baseC = '0';
  card.dataset.baseF = '0';
  card.style.cssText = 'background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px; position: relative;';
  card.innerHTML = `<button class="ai-edit-del" onclick="_aiRemoveItem(${newIdx})" title="Remove" style="position: absolute; top: 12px; right: 12px; background: none; border: none; color: #ef4444; cursor: pointer; padding: 4px; border-radius: 4px;"><i class="fas fa-trash-alt"></i></button><div style="display: flex; gap: 8px; margin-bottom: 12px; padding-right: 24px;"><input class="ai-edit-input ai-edit-name food-input" data-idx="${newIdx}" value="" style="flex: 1; font-weight: 600; color: #0f2538; border: 1px solid #cbd5e1; border-radius: 8px; padding: 6px 10px;" placeholder="Food name"><div style="display: flex; align-items: center; gap: 4px; background: #fff; border: 1px solid #cbd5e1; border-radius: 8px; padding: 2px 8px;"><span style="font-size: 0.8rem; color: #64748b;">Qty</span><input class="ai-edit-input ai-edit-qty food-input" data-idx="${newIdx}" type="number" min="0" step="0.5" value="1" oninput="_aiOnQtyChange(${newIdx})" style="width: 40px; border: none; background: transparent; font-weight: 600; color: #0f2538; text-align: center; padding: 4px 0;"></div></div><div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px;"><div style="display: flex; align-items: center; justify-content: space-between; background: #fff5eb; border: 1px solid #fed7aa; border-radius: 8px; padding: 8px 12px;"><span style="font-size: 0.85rem; font-weight: 600; color: #ea580c; display: flex; align-items: center; gap: 6px;">🔥 Calories</span><div style="display: flex; align-items: center; gap: 4px;"><input class="ai-edit-input ai-edit-cal calorie-input" data-idx="${newIdx}" type="number" min="0" value="0" oninput="_aiOnMacroEdit(${newIdx})" style="width: 50px; border: none; background: transparent; font-weight: 700; color: #ea580c; text-align: right; font-size: 15px;"> <span style="font-size: 0.8rem; color: #ea580c; font-weight: 600;">kcal</span></div></div><div style="display: flex; align-items: center; justify-content: space-between; background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 8px 12px;"><span style="font-size: 0.85rem; font-weight: 600; color: #dc2626; display: flex; align-items: center; gap: 6px;">🥩 Protein</span><div style="display: flex; align-items: center; gap: 4px;"><input class="ai-edit-input ai-edit-p" data-idx="${newIdx}" type="number" min="0" step="0.1" value="0" oninput="_aiOnMacroEdit(${newIdx})" style="width: 40px; border: none; background: transparent; font-weight: 600; color: #dc2626; text-align: right;"> <span style="font-size: 0.8rem; color: #dc2626; font-weight: 600;">g</span></div></div><div style="display: flex; align-items: center; justify-content: space-between; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 8px 12px;"><span style="font-size: 0.85rem; font-weight: 600; color: #2563eb; display: flex; align-items: center; gap: 6px;">🍞 Carbs</span><div style="display: flex; align-items: center; gap: 4px;"><input class="ai-edit-input ai-edit-c" data-idx="${newIdx}" type="number" min="0" step="0.1" value="0" oninput="_aiOnMacroEdit(${newIdx})" style="width: 40px; border: none; background: transparent; font-weight: 600; color: #2563eb; text-align: right;"> <span style="font-size: 0.8rem; color: #2563eb; font-weight: 600;">g</span></div></div><div style="display: flex; align-items: center; justify-content: space-between; background: #fefce8; border: 1px solid #fef08a; border-radius: 8px; padding: 8px 12px;"><span style="font-size: 0.85rem; font-weight: 600; color: #ca8a04; display: flex; align-items: center; gap: 6px;">🧈 Fats</span><div style="display: flex; align-items: center; gap: 4px;"><input class="ai-edit-input ai-edit-f" data-idx="${newIdx}" type="number" min="0" step="0.1" value="0" oninput="_aiOnMacroEdit(${newIdx})" style="width: 40px; border: none; background: transparent; font-weight: 600; color: #ca8a04; text-align: right;"> <span style="font-size: 0.8rem; color: #ca8a04; font-weight: 600;">g</span></div></div></div>`;
  container.appendChild(card);
  card.querySelector('.ai-edit-name')?.focus();
}

/** Remove a project subtask */
function _aiRemoveSubtask(idx) {
  const rows = document.querySelectorAll('.ai-edit-subtask-row');
  if (rows[idx]) rows[idx].remove();
  if (aiPendingAction?.details?.subtasks) {
    aiPendingAction.details.subtasks.splice(idx, 1);
  }
}

/** Add a project subtask */
function _aiAddSubtask() {
  if (!aiPendingAction?.details) return;
  if (!aiPendingAction.details.subtasks) aiPendingAction.details.subtasks = [];
  const idx = aiPendingAction.details.subtasks.length;
  aiPendingAction.details.subtasks.push('');
  const container = document.querySelector('.ai-edit-project-form');
  if (!container) return;
  const addBtn = container.querySelector('.ai-edit-add-btn');
  const div = document.createElement('div');
  div.className = 'ai-edit-subtask-row';
  div.innerHTML = `<input class="ai-edit-input ai-edit-subtask" data-idx="${idx}" value="" placeholder="Subtask name"> <button class="ai-edit-del" onclick="_aiRemoveSubtask(${idx})" title="Remove"><i class="fas fa-trash-alt"></i></button>`;
  if (addBtn) container.insertBefore(div, addBtn);
  else container.appendChild(div);
  div.querySelector('.ai-edit-subtask')?.focus();
}

function aiEditAction() {
  // Edit now just focuses the first editable field — the form is already inline
  _aiShowConfirmBar(true); // keep confirm bar visible
  const firstInput = document.querySelector('.ai-edit-input');
  if (firstInput) {
    firstInput.focus();
    firstInput.select();
    _aiAddMessage('✏️ Edit the fields above and click <strong>Confirm</strong> when ready, or <strong>Cancel</strong> to discard.', 'bot');
  } else {
    _aiAddMessage('No editable fields found. Try rephrasing your request.', 'bot');
    aiPendingAction = null;
    _aiShowConfirmBar(false);
  }
}

function aiCancelAction() {
  _aiShowConfirmBar(false);
  aiPendingAction = null;
  // Strip old nutrition item markers
  document.querySelectorAll('[data-ai-item]').forEach(el => el.removeAttribute('data-ai-item'));
  _aiAddMessage('Action cancelled. Let me know if you need anything else!', 'bot');
}

// --- Demo mode execution ---
function _aiExecuteDemo(data) {
  if (data.action_type === 'log_nutrition' && data.details) {
    const meals = typeof getActiveUserMealsData === 'function' ? getActiveUserMealsData() : [];
    const items = data.details.items || [];
    for (const item of items) {
      meals.push({
        id: typeof nextLocalId === 'function' ? nextLocalId(meals) : Date.now(),
        name: item.name,
        meal_type: data.details.meal_type || 'snack',
        calories: Math.round(item.calories || 0),
        protein: Math.round((item.protein || 0) * 10) / 10,
        carbs: Math.round((item.carbs || 0) * 10) / 10,
        fats: Math.round((item.fats || 0) * 10) / 10,
        date: typeof todayDateKey === 'function' ? todayDateKey() : new Date().toISOString().slice(0, 10),
        time: new Date().toTimeString().slice(0, 5)
      });
    }
    if (typeof setActiveUserMealsData === 'function') setActiveUserMealsData(meals);
    if (typeof loadMeals === 'function') loadMeals();
    return { status: 'executed', action_type: 'log_nutrition', count: items.length };
  }

  if (data.action_type === 'add_task' && data.details) {
    // Demo mode task creation using the proper demo user data store
    const tasks = typeof getActiveUserTasksData === 'function' ? getActiveUserTasksData() : [];
    const dueAt = data.details.date
      ? new Date(data.details.date + 'T12:00:00').toISOString()
      : new Date().toISOString();
    const newTask = {
      id: typeof nextLocalId === 'function' ? nextLocalId(tasks) : Date.now(),
      userId: activeDemoUserId || '1',
      title: data.details.title,
      description: data.details.description || '',
      category: data.details.category || 'general',
      priority: data.details.priority || 'medium',
      completed: false,
      completedAt: null,
      date: data.details.date || (typeof todayDateKey === 'function' ? todayDateKey() : new Date().toISOString().slice(0, 10)),
      dueAt: dueAt,
      tags: data.details.tags || [],
      time_spent: 0,
    };
    tasks.push(newTask);
    if (typeof setActiveUserTasksData === 'function') setActiveUserTasksData(tasks);
    if (typeof loadTasks === 'function') loadTasks();
    return { status: 'executed', action_type: 'add_task', task: newTask };
  }

  if (data.action_type === 'log_workout' && data.details) {
    const workouts = typeof getActiveUserWorkoutsData === 'function' ? getActiveUserWorkoutsData() : [];
    const d = data.details;
    const newW = {
      id: typeof nextLocalId === 'function' ? nextLocalId(workouts) : Date.now(),
      userId: activeDemoUserId || '1',
      name: d.name || 'Workout',
      type: d.type || 'general',
      duration: d.duration || 0,
      calories_burned: d.calories_burned || 0,
      intensity: d.intensity || 'medium',
      exercises: d.exercises || [],
      notes: d.notes || '',
      date: typeof todayDateKey === 'function' ? todayDateKey() : new Date().toISOString().slice(0, 10)
    };
    workouts.push(newW);
    if (typeof setActiveUserWorkoutsData === 'function') setActiveUserWorkoutsData(workouts);
    if (typeof loadWorkoutsForPage === 'function') loadWorkoutsForPage();
    return { status: 'executed', action_type: 'log_workout', workout: newW };
  }

  if (data.action_type === 'add_project' && data.details) {
    return { status: 'executed', action_type: 'add_project', project: { name: data.details.name, subtasks: data.details.subtasks || [] } };
  }

  return { status: 'executed', action_type: data.action_type };
}

// --- Demo mode local fallback for AI chat ---
function _aiLocalFallback(msg, mode) {
  const lower = msg.toLowerCase();

  // ---------- Workout mode ----------
  if (mode === 'workout') return _aiLocalParseWorkout(msg);

  // ---------- Task mode ----------
  if (mode === 'task') return _aiLocalParseTask(msg);

  // ---------- Nutrition mode ----------
  if (mode === 'nutrition') return _aiLocalParseNutrition(msg);

  // ---------- General mode (chat / auto-detect projects) ----------
  const projectKw = ['project', 'create project', 'new project', 'start project'];
  if (projectKw.some(k => lower.includes(k))) {
    const name = msg.replace(/(?:create|new|add|start|make)\s*(?:a\s*)?project\s*:?\s*/i, '').trim() || 'Untitled Project';
    return {
      status: 'confirmation_required',
      action_type: 'add_project',
      summary: 'Create project: ' + name,
      details: { name, description: '', subtasks: [], due_date: '' },
      confidence: 'medium',
      message: 'Please confirm, edit, or cancel.'
    };
  }

  // General chat responses
  if (lower.match(/^(hi|hello|hey|howdy|yo|sup|namaste)/)) return { status: 'chat_response', message: "Hey there! 👋 How's it going? I'm your FitTrack AI buddy. Select a mode above and tell me what to log!" };
  if (lower.match(/^(bye|goodbye|see ya|later|good night)/)) return { status: 'chat_response', message: "See ya! 👋 Stay on track and take care. I'm always here when you need me!" };
  if (lower.includes('how are you') || lower.includes("what's up") || lower.includes('whats up')) return { status: 'chat_response', message: "I'm doing great! 😄 Ready to help you crush your goals. What can I do for you?" };
  if (lower.includes('who are you') || lower.includes('your name')) return { status: 'chat_response', message: "I'm **FitTrack AI** — your personal productivity & fitness assistant! 🤖✨ Select a mode from the dropdown above and I'll log meals, workouts, or tasks for you!" };
  if (lower.includes('help') || lower.includes('what can you do')) return { status: 'chat_response', message: "Here's what I can do! ✨\n\nUse the **mode selector** above to pick an action:\n\n🍽️ **Nutrition** — \"2 rotis and dal for lunch\"\n🏋️ **Workout** — \"30 min running, burned 300 cal\"\n📋 **Task** — \"finish report by tomorrow\"\n💬 **General** — Ask me anything!\n\nPick a mode and type naturally!" };
  if (lower.includes('thank') || lower.includes('thx')) return { status: 'chat_response', message: "You're welcome! 😊 Always happy to help. Anything else?" };
  if (lower.includes('motivate') || lower.includes('lazy') || lower.includes('unmotivated')) { const q = ['🔥 "The only bad workout is the one that didn\'t happen." Just start small!', '💪 "Discipline is choosing what you want most over what you want now." You\'ve got this!', '🚀 "Every expert was once a beginner." One step at a time!', '⭐ "Don\'t have to be extreme, just consistent." Small wins add up!']; return { status: 'chat_response', message: q[Math.floor(Math.random() * q.length)] }; }
  if (lower.includes('protein') && (lower.includes('how much') || lower.includes('daily'))) return { status: 'chat_response', message: "Great question! 💪 Aim for **0.7-1g per pound of bodyweight** (~1.6-2.2g/kg). If you're 70kg, target **112-154g/day**. Sources: chicken, eggs, dal, paneer, Greek yogurt!" };
  if (lower.includes('calorie') && (lower.includes('how many') || lower.includes('daily'))) return { status: 'chat_response', message: "It depends on your goals! 📊\n- **Maintain**: ~2000-2500 cal/day\n- **Lose weight**: Cut 300-500 cal below maintenance\n- **Gain muscle**: Add 200-300 cal above\n\nSearch for a TDEE calculator for a precise number!" };
  if (msg.includes('?') || lower.includes('what is') || lower.includes('how to') || lower.includes('explain')) return { status: 'chat_response', message: "That's a great question! 🤔 My local brain is a bit limited for general knowledge, but I'm a pro at nutrition, fitness, and productivity topics. Try asking me about those, or select a mode above to log something!" };

  return { status: 'chat_response', message: "Hmm, I'm not quite sure what you mean 🤔 but I'm here to help!\n\nUse the **mode selector** above:\n🍽️ **Nutrition** — Log meals\n🏋️ **Workout** — Log exercises\n📋 **Task** — Create tasks\n\nPick a mode and type naturally!" };
}

// --- Local parser: Workout ---
function _aiLocalParseWorkout(msg) {
  const lower = msg.toLowerCase();
  let name = 'Workout', type = 'general', duration = 0, calories_burned = 0;
  let intensity = 'medium', exercises = [], notes = '';

  const typeMap = {
    'cardio': 'cardio', 'running': 'cardio', 'run': 'cardio', 'jogging': 'cardio', 'jog': 'cardio',
    'cycling': 'cardio', 'bike': 'cardio', 'swimming': 'cardio', 'swim': 'cardio',
    'walking': 'cardio', 'walk': 'cardio', 'hiit': 'cardio', 'jumping': 'cardio',
    'strength': 'strength', 'weight': 'strength', 'lifting': 'strength', 'gym': 'strength',
    'push': 'strength', 'pull': 'strength', 'squat': 'strength', 'deadlift': 'strength',
    'bench': 'strength', 'curl': 'strength', 'press': 'strength',
    'yoga': 'flexibility', 'stretch': 'flexibility', 'pilates': 'flexibility',
    'sports': 'sports', 'basketball': 'sports', 'football': 'sports', 'soccer': 'sports',
    'cricket': 'sports', 'badminton': 'sports', 'tennis': 'sports', 'volleyball': 'sports'
  };
  for (const [kw, t] of Object.entries(typeMap)) {
    if (lower.includes(kw)) { type = t; name = kw.charAt(0).toUpperCase() + kw.slice(1); break; }
  }

  const durMatch = lower.match(/(\d+)\s*(?:min(?:ute)?s?|hrs?|hours?)/);
  if (durMatch) { duration = parseInt(durMatch[1]); if (lower.includes('hour') || lower.includes('hr')) duration *= 60; }

  const calMatch = lower.match(/(?:burn(?:ed|t)?|cal(?:orie)?s?)\s*[:=]?\s*(\d+)/i) || lower.match(/(\d+)\s*(?:cal(?:orie)?s?\s*(?:burn(?:ed)?)?|kcal)/i);
  if (calMatch) calories_burned = parseInt(calMatch[1]);

  if (lower.includes('light') || lower.includes('easy')) intensity = 'light';
  else if (lower.includes('intense') || lower.includes('hard') || lower.includes('heavy') || lower.includes('high')) intensity = 'high';

  const exSegs = msg.split(/,|\band\b|\+|;/i).map(s => s.trim()).filter(Boolean);
  if (exSegs.length > 1) {
    exercises = exSegs.map(s => s.replace(/\d+\s*(?:min(?:ute)?s?|hrs?|hours?|cal(?:orie)?s?|kcal)\s*/gi, '').trim()).filter(s => s.length > 1 && s.length < 60);
  }

  if (!calories_burned && duration > 0) {
    const rateMap = { cardio: 10, strength: 7, flexibility: 4, sports: 8, general: 6 };
    calories_burned = Math.round(duration * (rateMap[type] || 6));
  }

  if (name === 'Workout' && exercises.length) name = exercises[0];
  const today = typeof todayDateKey === 'function' ? todayDateKey() : new Date().toISOString().slice(0, 10);

  return {
    status: 'confirmation_required', action_type: 'log_workout',
    summary: `Log workout: ${name} (${duration} min, ~${calories_burned} cal)`,
    details: { name, type, duration, calories_burned, intensity, exercises, notes, date: today },
    confidence: duration > 0 ? 'medium' : 'low',
    message: 'These are estimated values. Please review and confirm, edit, or cancel.'
  };
}

// --- Local parser: Task ---
function _aiLocalParseTask(msg) {
  const lower = msg.toLowerCase();
  let title = msg.replace(/(?:add|create|new|make)\s*(?:a\s*)?(?:task|todo|to-do|reminder)\s*:?\s*/i, '').trim();
  title = title.replace(/(?:i need to|i have to|i must|remind me to|i should|i gotta)\s*/i, '').trim() || 'Untitled Task';
  const today = typeof todayDateKey === 'function' ? todayDateKey() : new Date().toISOString().slice(0, 10);
  let priority = 'medium';
  if (lower.includes('urgent') || lower.includes('high priority') || lower.includes('important')) priority = 'high';
  else if (lower.includes('low priority') || lower.includes('minor')) priority = 'low';
  let date = today;
  if (lower.includes('tomorrow')) {
    const d = new Date(); d.setDate(d.getDate() + 1);
    date = d.toISOString().slice(0, 10);
    title = title.replace(/\s*(?:by\s+)?tomorrow\s*/i, '').trim();
  }
  return {
    status: 'confirmation_required', action_type: 'add_task',
    summary: 'Create task: ' + title,
    details: { title, description: '', category: 'general', priority, date, tags: [] },
    confidence: 'high', message: 'Please confirm, edit, or cancel.'
  };
}

// --- Local parser: Nutrition ---
function _aiLocalParseNutrition(msg) {
  const lower = msg.toLowerCase();
  const indianFoods = {
    // Indian staples
    roti: {cal:120, p:3, c:20, f:3.5}, chapati: {cal:120, p:3, c:20, f:3.5},
    naan: {cal:260, p:9, c:45, f:5}, paratha: {cal:230, p:5, c:30, f:10},
    'aloo paratha': {cal:280, p:6, c:38, f:12}, 'gobi paratha': {cal:260, p:6, c:35, f:11},
    'paneer paratha': {cal:300, p:10, c:32, f:15},
    dal: {cal:180, p:12, c:24, f:4}, 'dal chawal': {cal:350, p:14, c:58, f:6},
    rice: {cal:200, p:4, c:45, f:0.5},
    biryani: {cal:450, p:18, c:52, f:18}, 'chicken biryani': {cal:500, p:25, c:52, f:20},
    'paneer butter masala': {cal:400, p:18, c:15, f:30}, 'butter chicken': {cal:440, p:28, c:12, f:32},
    chole: {cal:240, p:12, c:36, f:6}, 'chana masala': {cal:240, p:12, c:36, f:6},
    rajma: {cal:220, p:14, c:35, f:3}, 'palak paneer': {cal:300, p:16, c:10, f:22},
    'aloo gobi': {cal:180, p:5, c:25, f:7},
    samosa: {cal:260, p:5, c:30, f:14}, 'pav bhaji': {cal:400, p:10, c:50, f:18},
    'vada pav': {cal:300, p:6, c:40, f:13},
    dosa: {cal:170, p:4, c:28, f:5}, 'masala dosa': {cal:280, p:6, c:38, f:12},
    idli: {cal:60, p:2, c:12, f:0.5},
    poha: {cal:180, p:4, c:32, f:5}, upma: {cal:200, p:5, c:28, f:8},
    khichdi: {cal:220, p:8, c:35, f:5},
    chai: {cal:80, p:2, c:12, f:2.5}, lassi: {cal:180, p:5, c:28, f:5},
    // Proteins
    egg: {cal:78, p:6, c:0.6, f:5}, 'boiled egg': {cal:78, p:6, c:0.6, f:5},
    omelette: {cal:154, p:11, c:1, f:12}, 'egg bhurji': {cal:180, p:12, c:2, f:14},
    paneer: {cal:260, p:18, c:4, f:20}, chicken: {cal:165, p:31, c:0, f:3.6},
    'chicken breast': {cal:165, p:31, c:0, f:3.6}, 'chicken curry': {cal:250, p:20, c:8, f:15},
    fish: {cal:206, p:22, c:0, f:12}, 'fish curry': {cal:250, p:20, c:8, f:15},
    // Global / compound foods
    'peanut butter sandwich': {cal:350, p:14, c:31, f:18},
    'peanut butter': {cal:190, p:8, c:6, f:16}, sandwich: {cal:250, p:12, c:30, f:10},
    toast: {cal:80, p:3, c:14, f:1}, bread: {cal:80, p:3, c:14, f:1},
    'protein shake': {cal:250, p:30, c:12, f:5}, 'whey protein': {cal:120, p:24, c:3, f:1.5},
    'peanut butter toast': {cal:270, p:11, c:20, f:17},
    pasta: {cal:350, p:12, c:60, f:5}, pizza: {cal:270, p:12, c:33, f:10},
    burger: {cal:350, p:20, c:30, f:16}, fries: {cal:310, p:4, c:42, f:15},
    salad: {cal:120, p:4, c:12, f:6}, 'chicken salad': {cal:250, p:28, c:10, f:12},
    wrap: {cal:300, p:15, c:32, f:12}, 'chicken wrap': {cal:350, p:25, c:30, f:14},
    smoothie: {cal:200, p:8, c:35, f:4}, 'protein smoothie': {cal:280, p:25, c:28, f:8},
    coffee: {cal:5, p:0.3, c:0, f:0}, 'black coffee': {cal:5, p:0.3, c:0, f:0},
    latte: {cal:150, p:8, c:15, f:6}, cappuccino: {cal:120, p:6, c:12, f:5},
    juice: {cal:110, p:1, c:26, f:0.3}, 'orange juice': {cal:110, p:1, c:26, f:0.3},
    // Dairy & snacks
    milk: {cal:120, p:6, c:10, f:6}, curd: {cal:60, p:3, c:5, f:3}, yogurt: {cal:60, p:3, c:5, f:3},
    'greek yogurt': {cal:100, p:17, c:6, f:0.7},
    cheese: {cal:110, p:7, c:0.4, f:9},
    // Fruits
    banana: {cal:105, p:1.3, c:27, f:0.4}, apple: {cal:95, p:0.5, c:25, f:0.3},
    mango: {cal:100, p:1, c:25, f:0.5}, orange: {cal:62, p:1.2, c:15, f:0.2},
    // Other
    maggi: {cal:310, p:7, c:44, f:12}, oats: {cal:150, p:5, c:27, f:3},
    butter: {cal:36, p:0, c:0, f:4}, ghee: {cal:45, p:0, c:0, f:5},
    'peanut butter and jelly': {cal:380, p:12, c:45, f:18},
    'avocado toast': {cal:280, p:6, c:26, f:18}, avocado: {cal:160, p:2, c:9, f:15},
    'scrambled eggs': {cal:180, p:12, c:2, f:14}
  };
  const text = msg.replace(/(?:i |i've |i have |had |ate |eaten |log |add |please )+(?:for )?(?:breakfast |lunch |dinner |snack )?/gi, '').replace(/\s+for\s+(breakfast|lunch|dinner|snack)\s*$/i, '').trim();
  const segments = text.split(/,|\band\b|\+|;|\bwith\b/i).map(s => s.trim()).filter(Boolean);
  const items = [];
  for (const seg of segments) {
    let qty = 1, food = seg;
    const qm = seg.match(/^(\d+(?:\.\d+)?)\s*(.*)/);
    if (qm) { qty = parseFloat(qm[1]) || 1; food = qm[2]; }
    const fl = food.toLowerCase().trim();
    let matched = null;
    // Try longest-key-first match (compound foods like 'peanut butter sandwich' before 'butter')
    const sortedKeys = Object.keys(indianFoods).sort((a, b) => b.length - a.length);
    for (const key of sortedKeys) {
      if (fl.includes(key)) { matched = { key, ...indianFoods[key] }; break; }
    }
    // Fallback: if multi-word input, try matching input as substring of a key
    if (!matched && fl.split(/\s+/).length >= 2) {
      for (const key of sortedKeys) {
        if (key.includes(fl)) { matched = { key, ...indianFoods[key] }; break; }
      }
    }
    if (matched) {
      items.push({ name: matched.key.charAt(0).toUpperCase() + matched.key.slice(1), quantity: qty, unit: 'serving', calories: Math.round(matched.cal * qty), protein: Math.round(matched.p * qty * 10) / 10, carbs: Math.round(matched.c * qty * 10) / 10, fats: Math.round(matched.f * qty * 10) / 10, is_estimate: true, note: 'Estimated from common values' });
    } else {
      items.push({ name: food.trim() || seg, quantity: qty, unit: 'serving', calories: 0, protein: 0, carbs: 0, fats: 0, is_estimate: true, note: 'Could not estimate — please enter values manually' });
    }
  }
  const mealType = lower.includes('breakfast') ? 'breakfast' : lower.includes('lunch') ? 'lunch' : lower.includes('dinner') ? 'dinner' : 'snack';
  const total = { calories: items.reduce((s, i) => s + i.calories, 0), protein: Math.round(items.reduce((s, i) => s + i.protein, 0) * 10) / 10, carbs: Math.round(items.reduce((s, i) => s + i.carbs, 0) * 10) / 10, fats: Math.round(items.reduce((s, i) => s + i.fats, 0) * 10) / 10 };
  return {
    status: 'confirmation_required', action_type: 'log_nutrition',
    summary: `Log ${items.length} food item${items.length > 1 ? 's' : ''} as ${mealType}`,
    details: { meal_type: mealType, items, total },
    confidence: items.some(i => i.calories === 0) ? 'low' : 'medium',
    message: 'These are estimated values. Please review and confirm, edit, or cancel.'
  };
}

// ---------------------------------------------------------------------------
// Mentor AI  — Context-Aware Motivational System
// ---------------------------------------------------------------------------
let _mentorMessageShown = false;   // one mentor message per chat session
let _mentorFetching = false;       // lock to prevent concurrent requests

/**
 * Build a mentor context object from DEMO-mode localStorage data.
 * Returns the same shape as /api/mentor/context.
 */
function _buildMentorContextDemo() {
  const today = toLocalDateKey(new Date());
  const tasks = activeDemoUserId ? getActiveUserTasksData() : (taskUiState.tasks || []);
  const meals = activeDemoUserId ? getActiveUserMealsData() : (nutritionState.entries || []);
  const workouts = activeDemoUserId ? getActiveUserWorkoutsData() : (workoutState?.workouts || []);

  // Tasks
  const todayTasks = tasks.filter(t => {
    const d = t.dueAt ? toLocalDateKey(new Date(t.dueAt)) : (t.date || '');
    return d === today;
  });
  const tasksCompleted = todayTasks.filter(t => !!(t.completed || t.completedAt)).length;
  const overdueTasks = tasks.filter(t => {
    const d = t.dueAt ? toLocalDateKey(new Date(t.dueAt)) : (t.date || '');
    return d && d < today && !(t.completed || t.completedAt);
  }).slice(0, 10).map(t => ({ title: t.title, date: t.date || t.dueAt, priority: t.priority || 'medium' }));
  const upcoming = todayTasks.filter(t => !(t.completed || t.completedAt))
    .map(t => ({ title: t.title, priority: t.priority || 'medium' }));

  // Nutrition
  const todayMeals = meals.filter(m => String(m.date || '') === today);
  const totalCal = todayMeals.reduce((s, m) => s + parseMacro(m.calories), 0);
  const totalP = todayMeals.reduce((s, m) => s + parseMacro(m.protein), 0);
  const totalC = todayMeals.reduce((s, m) => s + parseMacro(m.carbs), 0);
  const totalF = todayMeals.reduce((s, m) => s + parseMacro(m.fats), 0);

  // Workouts
  const todayWorkouts = workouts.filter(w => String(w.date || '') === today);
  const wCompleted = todayWorkouts.filter(w => !!w.completed).length;
  const pendingWNames = todayWorkouts.filter(w => !w.completed).map(w => w.name || 'Workout');

  // Streak / progress
  const stats = _getUserStats(activeDemoUserId) || {};

  return {
    date: today,
    tasks: {
      total: todayTasks.length,
      completed: tasksCompleted,
      pending: todayTasks.length - tasksCompleted,
      overdue: overdueTasks,
      upcoming: upcoming,
    },
    nutrition: {
      meals_logged: todayMeals.length,
      calories_consumed: Math.round(totalCal),
      protein_consumed: Math.round(totalP * 10) / 10,
      carbs_consumed: Math.round(totalC * 10) / 10,
      fats_consumed: Math.round(totalF * 10) / 10,
    },
    workouts: {
      total: todayWorkouts.length,
      completed: wCompleted,
      pending_names: pendingWNames,
    },
    progress: {
      current_streak: stats.currentStreak || 0,
      longest_streak: stats.longestStreak || 0,
      total_points: stats.totalPoints || 0,
      level: stats.level || 1,
      level_pct: 0,
    },
  };
}

/**
 * Fetch mentor context from the server (API mode).
 */
async function _fetchMentorContextAPI() {
  const res = await fetch('/api/mentor/context');
  if (!res.ok) throw new Error(`Mentor context failed (${res.status})`);
  return await res.json();
}

/**
 * Convert context object → human-readable summary string for Gemini.
 */
function _buildMentorPromptString(ctx) {
  const goals = nutritionState.baseGoals || { calories: 2200, protein: 140, carbs: 250, fats: 60 };
  const calLeft = Math.max(0, goals.calories - (ctx.nutrition.calories_consumed || 0));
  const proLeft = Math.max(0, goals.protein - (ctx.nutrition.protein_consumed || 0));
  const carbLeft = Math.max(0, goals.carbs - (ctx.nutrition.carbs_consumed || 0));
  const fatLeft = Math.max(0, goals.fats - (ctx.nutrition.fats_consumed || 0));

  const name = (typeof profileState !== 'undefined' && profileState.fullName)
    ? profileState.fullName.split(' ')[0] : 'there';

  let lines = [];
  lines.push(`User's name: ${name}`);
  lines.push(`Date: ${ctx.date}`);
  lines.push('');
  lines.push('--- STREAK & PROGRESS ---');
  lines.push(`Current streak: ${ctx.progress.current_streak} days`);
  lines.push(`Longest streak: ${ctx.progress.longest_streak} days`);
  lines.push(`Total XP: ${ctx.progress.total_points} | Level: ${ctx.progress.level}`);
  lines.push('');
  lines.push('--- TASKS ---');
  lines.push(`Tasks completed today: ${ctx.tasks.completed}/${ctx.tasks.total}`);
  if (ctx.tasks.overdue.length > 0) {
    lines.push(`Overdue tasks (${ctx.tasks.overdue.length}): ${ctx.tasks.overdue.map(t => t.title).join(', ')}`);
  }
  if (ctx.tasks.upcoming.length > 0) {
    lines.push(`Remaining today: ${ctx.tasks.upcoming.map(t => `${t.title} [${t.priority}]`).join(', ')}`);
  }
  lines.push('');
  lines.push('--- NUTRITION ---');
  lines.push(`Meals logged: ${ctx.nutrition.meals_logged}`);
  lines.push(`Calories: ${ctx.nutrition.calories_consumed}/${goals.calories} kcal (${calLeft} remaining)`);
  lines.push(`Protein: ${ctx.nutrition.protein_consumed}/${goals.protein}g (${Math.round(proLeft)}g remaining)`);
  lines.push(`Carbs: ${ctx.nutrition.carbs_consumed}/${goals.carbs}g (${Math.round(carbLeft)}g remaining)`);
  lines.push(`Fats: ${ctx.nutrition.fats_consumed}/${goals.fats}g (${Math.round(fatLeft)}g remaining)`);
  lines.push('');
  lines.push('--- WORKOUTS ---');
  if (ctx.workouts.total === 0) {
    lines.push('No workouts scheduled today.');
  } else {
    lines.push(`Workouts: ${ctx.workouts.completed}/${ctx.workouts.total} completed`);
    if (ctx.workouts.pending_names.length > 0) {
      lines.push(`Pending: ${ctx.workouts.pending_names.join(', ')}`);
    }
  }

  return lines.join('\n');
}

const _MENTOR_SYSTEM_PROMPT = `You are a productivity mentor inside a performance tracking app called FitTrack Pro.

Your job is to:
- Motivate the user
- Hold them accountable
- Encourage consistency
- Suggest actionable next steps
- Be supportive but disciplined

You are NOT casual. You are NOT robotic. You are focused, calm, strong.

You have access to their real-time progress data (provided below). All numbers are pre-calculated — do NOT guess or invent data.

Rules:
- Respond in 4-6 sentences maximum.
- Keep it actionable — mention what is left today.
- Encourage completion.
- If streak is at risk, warn them.
- If they are doing well, praise them.
- If they have overdue tasks, call it out.
- Do NOT hallucinate new tasks or data.
- Do NOT change any data.
- Do NOT use generic motivational quotes.
- Address the user by first name.
- Use line breaks between thoughts for readability.`;

/**
 * Generate the mentor message — calls Gemini with real context.
 * Falls back to a structured local message if Gemini is unavailable.
 */
async function generateMentorMessage() {
  if (_mentorFetching) return;
  _mentorFetching = true;

  // Show typing indicator
  _aiAddMessage('<span class="ai-typing"><span>.</span><span>.</span><span>.</span></span>', 'bot');
  const container = document.getElementById('ai-chat-messages');

  try {
    // 1. Collect context
    let ctx;
    if (activeDemoUserId) {
      ctx = _buildMentorContextDemo();
    } else {
      try {
        ctx = await _fetchMentorContextAPI();
      } catch (_e) {
        // If API fails, build from whatever frontend state we have
        ctx = _buildMentorContextDemo();
      }
    }

    // 2. Format context
    const mentorContext = _buildMentorPromptString(ctx);

    // 3. Call Gemini via existing chat endpoint with mentor mode
    const payload = {
      message: `[MENTOR_MODE]\n\nHere is the user's current status:\n${mentorContext}\n\nGive them a personalized motivational check-in based on this data.`,
      mode: 'general',
      context: {
        session_id: _aiSessionId(),
        current_page: _detectCurrentPage(),
        mentor_mode: true,
        user_preferences: {
          goal: typeof profileState !== 'undefined' ? (profileState.weightGoal || 'maintenance') : 'maintenance',
          diet_type: 'mixed'
        }
      }
    };

    const response = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    let data = {};
    try { data = await response.json(); } catch (_) { data = {}; }

    // Remove typing indicator
    if (container && container.lastChild) container.removeChild(container.lastChild);

    if (response.ok && data.status === 'chat_response' && data.message) {
      _aiAddMessage(`<div class="mentor-message"><div class="mentor-header"><span class="mentor-icon">🔥</span> <strong>Daily Check-in</strong></div><div class="mentor-body">${_aiMarkdown(data.message)}</div></div>`, 'bot');
    } else {
      // Gemini failed — render structured local fallback
      _renderLocalMentorMessage(ctx);
    }

  } catch (err) {
    console.warn('[Mentor] Failed to generate mentor message:', err.message);
    if (container && container.lastChild) container.removeChild(container.lastChild);
    // Build local fallback
    try {
      const ctx = _buildMentorContextDemo();
      _renderLocalMentorMessage(ctx);
    } catch (_e2) {
      _aiAddMessage('<div class="mentor-message"><div class="mentor-header"><span class="mentor-icon">🔥</span> <strong>Daily Check-in</strong></div><div class="mentor-body">Ready when you are. Let\'s make today count.</div></div>', 'bot');
    }
  } finally {
    _mentorFetching = false;
    _mentorMessageShown = true;
  }
}

/**
 * Structured local mentor message — no AI, pure data-driven.
 */
function _renderLocalMentorMessage(ctx) {
  const goals = nutritionState.baseGoals || { calories: 2200, protein: 140, carbs: 250, fats: 60 };
  const name = (typeof profileState !== 'undefined' && profileState.fullName)
    ? profileState.fullName.split(' ')[0] : 'there';

  const proLeft = Math.max(0, Math.round(goals.protein - (ctx.nutrition.protein_consumed || 0)));
  const calLeft = Math.max(0, goals.calories - (ctx.nutrition.calories_consumed || 0));

  let parts = [];

  // Greeting
  parts.push(`Hey ${name} 👋`);

  // Streak status
  if (ctx.progress.current_streak > 0) {
    parts.push(`You're on a <strong>${ctx.progress.current_streak}-day streak</strong>. Don't break it.`);
  } else {
    parts.push(`No active streak yet. Today's the day to start one.`);
  }

  // Nutrition gap
  if (ctx.nutrition.meals_logged === 0) {
    parts.push(`You haven't logged any meals yet. Fuel up and track it.`);
  } else if (proLeft > 20) {
    parts.push(`You're <strong>${proLeft}g short on protein</strong> and have <strong>${calLeft} kcal</strong> left to hit your target.`);
  } else if (proLeft > 0) {
    parts.push(`Almost there on protein — just <strong>${proLeft}g</strong> to go.`);
  } else {
    parts.push(`Protein goal ✅ — nice work.`);
  }

  // Workouts
  const wPending = ctx.workouts.total - ctx.workouts.completed;
  if (wPending > 0) {
    parts.push(`<strong>${wPending} workout${wPending > 1 ? 's' : ''}</strong> still pending${ctx.workouts.pending_names.length ? ': ' + ctx.workouts.pending_names.join(', ') : ''}.`);
  } else if (ctx.workouts.total > 0) {
    parts.push(`All workouts done ✅`);
  }

  // Tasks
  if (ctx.tasks.overdue.length > 0) {
    parts.push(`⚠️ <strong>${ctx.tasks.overdue.length} overdue task${ctx.tasks.overdue.length > 1 ? 's' : ''}</strong> — don't let those pile up.`);
  }
  if (ctx.tasks.pending > 0) {
    parts.push(`<strong>${ctx.tasks.pending} task${ctx.tasks.pending > 1 ? 's' : ''}</strong> left today. Lock them in.`);
  } else if (ctx.tasks.total > 0) {
    parts.push(`All tasks complete ✅ — solid.`);
  }

  // Closing CTA
  if (wPending > 0 || ctx.tasks.pending > 0 || proLeft > 20) {
    parts.push(`Let's finish strong. 💪`);
  } else {
    parts.push(`Great day so far. Keep the momentum. 🔥`);
  }

  const html = parts.map(p => `<p style="margin:4px 0">${p}</p>`).join('');
  _aiAddMessage(`<div class="mentor-message"><div class="mentor-header"><span class="mentor-icon">🔥</span> <strong>Daily Check-in</strong></div><div class="mentor-body">${html}</div></div>`, 'bot');
}

/* ═══════════════════════════════════════════════════════════════
   FOCUS / STUDY MODULE
   ═══════════════════════════════════════════════════════════════ */
