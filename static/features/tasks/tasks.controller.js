/**
 * ============================================================================
 * features/tasks/tasks.controller.js — UI ↔ Service Bridge
 * ============================================================================
 *
 * Thin bridge between DOM events and TasksService / TasksSelectors.
 * Contains ZERO business logic — every handler delegates immediately.
 *
 * This file is the public API for the tasks feature module. Other modules
 * (calendar, AI chat, dashboard, etc.) should prefer calling
 * TasksController methods over directly calling script.js globals.
 *
 * RULES:
 *   - No business logic here.
 *   - No direct DOM manipulation (that stays in script.js renderers).
 *   - All functions are exposed on window.TasksController.
 *
 * Loaded AFTER tasks.selectors.js, tasks.service.js, and state/ files,
 * but BEFORE script.js.
 */
(function () {
  'use strict';

  window.TasksController = {

    // ── Write Operations (delegate to TasksService) ───────────

    /**
     * Create a new task.
     * @param {string} title
     * @param {string} priority
     * @param {string} dueDate  YYYY-MM-DD date string
     * @param {string} repeat
     * @param {string[]} tags
     * @param {string} noteContent
     * @param {boolean} saveToNotes
     */
    onAddTask: async function onAddTask(title, priority, dueDate, repeat, tags, noteContent, saveToNotes) {
      await window.TasksService.createTask(title, priority, dueDate, repeat, tags, noteContent, saveToNotes);
    },

    /**
     * Toggle task completion (complete ↔ uncomplete).
     * @param {number|string} taskId
     * @param {string|null} occDate
     */
    onTaskComplete: async function onTaskComplete(taskId, occDate) {
      await window.TasksService.completeTask(taskId, occDate);
    },

    /**
     * Delete a task.
     * @param {number|string} taskId
     */
    onTaskDelete: async function onTaskDelete(taskId) {
      await window.TasksService.deleteTask(taskId);
    },

    /**
     * Update task fields.
     * @param {number|string} taskId
     * @param {Object} payload
     * @returns {Promise<boolean>}
     */
    onTaskUpdate: async function onTaskUpdate(taskId, payload) {
      return await window.TasksService.updateTask(taskId, payload);
    },

    /**
     * Set Eisenhower quadrant.
     * @param {number|string} taskId
     * @param {string} quadrant
     */
    onSetQuadrant: function onSetQuadrant(taskId, quadrant) {
      window.TasksService.setQuadrant(taskId, quadrant);
    },

    /**
     * Set tags on a task.
     * @param {number|string} taskId
     * @param {string[]} tags
     */
    onSetTags: function onSetTags(taskId, tags) {
      window.TasksService.setTags(taskId, tags);
    },

    /**
     * Switch task view layout.
     * @param {'list'|'matrix'|'tag'} layout
     */
    onSetLayout: function onSetLayout(layout) {
      window.TasksService.setLayout(layout);
    },

    /**
     * Reload tasks from source (API or localStorage).
     */
    onReload: async function onReload() {
      await window.TasksService.reload();
    },

    // ── Read Operations (delegate to TasksSelectors) ──────────

    /**
     * @returns {Array}
     */
    getAllTasks: function getAllTasks() {
      return window.TasksSelectors.getAllTasks();
    },

    /**
     * @returns {Array}
     */
    getActiveTasks: function getActiveTasks() {
      return window.TasksSelectors.getActiveTasks();
    },

    /**
     * @returns {Array}
     */
    getCompletedTasks: function getCompletedTasks() {
      return window.TasksSelectors.getCompletedTasks();
    },

    /**
     * @returns {Array}
     */
    getOverdueTasks: function getOverdueTasks() {
      return window.TasksSelectors.getOverdueTasks();
    },

    /**
     * @param {string} tag
     * @returns {Array}
     */
    getTasksByTag: function getTasksByTag(tag) {
      return window.TasksSelectors.getTasksByTag(tag);
    },

    /**
     * @returns {{ total: number, active: number, completed: number, overdue: number }}
     */
    getTaskCounts: function getTaskCounts() {
      return window.TasksSelectors.getTaskCounts();
    },

    /**
     * @param {number|string} taskId
     * @returns {Object|null}
     */
    getTaskById: function getTaskById(taskId) {
      return window.TasksSelectors.getTaskById(taskId);
    },

    /**
     * @returns {string[]}
     */
    getAllTags: function getAllTags() {
      return window.TasksSelectors.getAllTags();
    },

    /**
     * @param {string} quadrantKey
     * @returns {Array}
     */
    getTasksByQuadrant: function getTasksByQuadrant(quadrantKey) {
      return window.TasksSelectors.getTasksByQuadrant(quadrantKey);
    },
  };

})();
