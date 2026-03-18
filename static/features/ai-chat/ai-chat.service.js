/**
 * features/ai-chat/ai-chat.service.js
 */
(function () {
  'use strict';

  var _kit = window.FeatureServiceKit || null;
  function _invoke(name, args, fallback) {
    if (_kit) return _kit.invoke(name, args, { feature: 'AIChatService', fallback: fallback });
    var fn = window[name];
    return typeof fn === 'function' ? fn.apply(window, args || []) : fallback;
  }

  window.AIChatService = {
    toggle: function () { _invoke('toggleAIChat', []); },
    send: async function (message) { await _invoke('sendAIMessage', [message]); },
    confirmAction: async function (type, payload) { await _invoke('aiConfirmAction', [type, payload]); },
    editAction: function () { _invoke('aiEditAction', []); },
    cancelAction: function () { _invoke('aiCancelAction', []); },
    generateMentor: async function () { await _invoke('generateMentorMessage', []); }
  };
})();
