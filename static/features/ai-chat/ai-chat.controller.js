/**
 * ============================================================================
 * features/ai-chat/ai-chat.controller.js — UI ↔ Service Bridge
 * ============================================================================
 *
 * Thin bridge between DOM events and AIChatService.
 * Contains ZERO business logic — every handler delegates immediately.
 *
 * Exposed on window.AIChatController.
 *
 * Loaded AFTER ai-chat.service.js and state/ files,
 * but BEFORE script.js.
 */
(function () {
  'use strict';

  window.AIChatController = {

    // ── Write Operations ──────────────────────────────────────

    onToggle: function () {
      window.AIChatService.toggle();
    },

    onSend: async function (message) {
      await window.AIChatService.send(message);
    },

    onConfirmAction: async function (type, payload) {
      await window.AIChatService.confirmAction(type, payload);
    },

    onEditAction: function () {
      window.AIChatService.editAction();
    },

    onCancelAction: function () {
      window.AIChatService.cancelAction();
    },

    onGenerateMentor: async function () {
      await window.AIChatService.generateMentor();
    }
  };

})();
