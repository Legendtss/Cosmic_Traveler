/**
 * ============================================================================
 * features/ai-chat/ai-chat.service.js — AI Chat Mutations
 * ============================================================================
 *
 * Write-side operations for the AI assistant chat widget.
 * Delegates to existing globals.
 *
 * Exposed on window.AIChatService.
 */
(function () {
  'use strict';

  window.AIChatService = {

    /**
     * Toggle AI chat panel visibility.
     */
    toggle: function () {
      if (typeof toggleAIChat === 'function') toggleAIChat();
    },

    /**
     * Send a message to the AI assistant.
     * @param {string} message
     */
    send: async function (message) {
      if (typeof sendAIMessage === 'function') await sendAIMessage(message);
    },

    /**
     * Confirm an AI-proposed action (task/meal/workout creation).
     * @param {string} type — 'task'|'meal'|'workout'
     * @param {Object} payload
     */
    confirmAction: async function (type, payload) {
      if (typeof aiConfirmAction === 'function') await aiConfirmAction(type, payload);
    },

    /**
     * Edit an AI-proposed action before confirming.
     */
    editAction: function () {
      if (typeof aiEditAction === 'function') aiEditAction();
    },

    /**
     * Cancel an AI-proposed action.
     */
    cancelAction: function () {
      if (typeof aiCancelAction === 'function') aiCancelAction();
    },

    /**
     * Generate and display the daily mentor/analytics message.
     */
    generateMentor: async function () {
      if (typeof generateMentorMessage === 'function') await generateMentorMessage();
    }
  };

})();
