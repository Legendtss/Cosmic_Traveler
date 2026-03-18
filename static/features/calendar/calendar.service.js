/**
 * features/calendar/calendar.service.js
 */
(function () {
  'use strict';

  var _kit = window.FeatureServiceKit || null;
  function _invoke(name, args, fallback) {
    if (_kit) return _kit.invoke(name, args, { feature: 'CalendarService', fallback: fallback });
    var fn = window[name];
    return typeof fn === 'function' ? fn.apply(window, args || []) : fallback;
  }

  window.CalendarService = {
    toggleImportantDate: function (dateKey) {
      if (typeof calendarState !== 'undefined' && calendarState.importantDates) {
        if (calendarState.importantDates.has(dateKey)) calendarState.importantDates.delete(dateKey);
        else calendarState.importantDates.add(dateKey);
        _invoke('persistCalendarImportantDates', []);
        if (typeof syncToAppState === 'function') syncToAppState('calendar');
      }
    },

    rescheduleTask: async function (taskId, newDateKey) {
      await _invoke('calendarRescheduleTask', [taskId, newDateKey]);
    },

    setViewMode: function (mode) {
      _invoke('persistCalendarViewMode', [mode]);
    }
  };
})();
