(function () {
  'use strict';

  var _bound = false;
  var _subscribed = false;

  function _state() {
    if (window.NotesService && typeof window.NotesService.getState === 'function') {
      return window.NotesService.getState();
    }
    return window._notes || {
      items: [],
      filter: 'all',
      searchQuery: '',
      editingNoteId: null,
      viewingNote: null,
      searchTimer: null,
    };
  }

  function _escapeHtml(value) {
    return String(value || '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function _byId(id) {
    return document.getElementById(id);
  }

  function _openModal(modal) {
    if (!modal) return;
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
  }

  function _closeModal(modal) {
    if (!modal) return;
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
  }

  function _focusTitleInput() {
    var input = _byId('note-title-input');
    if (!input) return;
    window.setTimeout(function () {
      input.focus();
    }, 0);
  }

  function _renderFilterButtons() {
    var filter = _state().filter;
    document.querySelectorAll('.notes-filter-btn').forEach(function (button) {
      button.classList.toggle('active', button.dataset.filter === filter);
    });
  }

  function _renderSearchInput() {
    var input = _byId('notes-search-input');
    var query = _state().searchQuery || '';
    if (input && input.value !== query) {
      input.value = query;
    }
  }

  function _buildCard(note) {
    var card = document.createElement('div');
    var tagsHtml = (note.tags || []).map(function (tag) {
      return '<span class="note-tag">' + _escapeHtml(tag) + '</span>';
    }).join('');
    var sourceClass = note.source_type === 'task' ? 'task' : 'manual';
    var sourceLabel = note.source_type === 'task'
      ? '<i class="fas fa-link"></i> Task'
      : '<i class="fas fa-pen"></i> Manual';
    var linkedHtml = note.linked_task_title
      ? '<div class="note-card-linked"><i class="fas fa-check-circle"></i> ' + _escapeHtml(note.linked_task_title) + '</div>'
      : '';
    var dateStr = note.updated_at
      ? new Date(note.updated_at).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })
      : '';

    card.className = 'note-card';
    card.dataset.noteId = String(note.id);
    card.innerHTML = '' +
      '<div class="note-card-title">' + _escapeHtml(note.title) + '</div>' +
      '<div class="note-card-preview">' + _escapeHtml(note.content || '').substring(0, 180) + '</div>' +
      linkedHtml +
      '<div class="note-card-meta">' +
        '<span class="note-card-source ' + sourceClass + '">' + sourceLabel + '</span>' +
        '<span class="note-card-date">' + dateStr + '</span>' +
      '</div>' +
      (tagsHtml ? '<div class="note-card-tags">' + tagsHtml + '</div>' : '');

    return card;
  }

  function _renderDetail(note) {
    var title = _byId('note-detail-title');
    var meta = _byId('note-detail-meta');
    var content = _byId('note-detail-content');
    var tags = _byId('note-detail-tags');
    var dateStr = note.created_at
      ? new Date(note.created_at).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      : '';
    var sourceLabel = note.source_type === 'task' ? 'Linked to Task' : 'Manual';
    var metaHtml = '<span><i class="fas fa-calendar-alt"></i> ' + dateStr + '</span>' +
      '<span><i class="fas fa-tag"></i> ' + sourceLabel + '</span>';

    if (note.linked_task_title) {
      metaHtml += '<span><i class="fas fa-check-circle"></i> ' + _escapeHtml(note.linked_task_title) + '</span>';
    }

    if (title) title.textContent = note.title;
    if (meta) meta.innerHTML = metaHtml;
    if (content) content.textContent = note.content || '(No content)';
    if (tags) {
      tags.innerHTML = (note.tags || []).map(function (tag) {
        return '<span class="note-tag">' + _escapeHtml(tag) + '</span>';
      }).join('');
    }
  }

  function render() {
    var grid = _byId('notes-grid');
    var empty = _byId('notes-empty');
    var items = _state().items || [];

    _renderFilterButtons();
    _renderSearchInput();

    if (!grid) return;

    grid.querySelectorAll('.note-card').forEach(function (card) {
      card.remove();
    });

    if (!items.length) {
      if (empty) empty.style.display = '';
      return;
    }

    if (empty) empty.style.display = 'none';

    var fragment = document.createDocumentFragment();
    items.forEach(function (note) {
      fragment.appendChild(_buildCard(note));
    });
    grid.appendChild(fragment);
  }

  function openNoteCreateModal() {
    if (window.NotesController && typeof window.NotesController.onBeginCreate === 'function') {
      window.NotesController.onBeginCreate();
    }
    var form = _byId('note-modal-form');
    var title = _byId('note-modal-title');
    if (title) title.textContent = 'New Note';
    if (form) form.reset();
    _openModal(_byId('note-modal'));
    _focusTitleInput();
  }

  function openNoteEditModal(noteOrId) {
    var note = noteOrId;
    if (note && typeof note !== 'object' && window.NotesController && typeof window.NotesController.getById === 'function') {
      note = window.NotesController.getById(noteOrId);
    }
    if (!note) return;

    if (window.NotesController && typeof window.NotesController.onBeginEdit === 'function') {
      window.NotesController.onBeginEdit(note);
    }

    var title = _byId('note-modal-title');
    if (title) title.textContent = 'Edit Note';

    var titleInput = _byId('note-title-input');
    var contentInput = _byId('note-content-input');
    var tagsInput = _byId('note-tags-input');
    if (titleInput) titleInput.value = note.title || '';
    if (contentInput) contentInput.value = note.content || '';
    if (tagsInput) tagsInput.value = (note.tags || []).join(', ');

    _openModal(_byId('note-modal'));
    _focusTitleInput();
  }

  function closeNoteModal() {
    var form = _byId('note-modal-form');
    _closeModal(_byId('note-modal'));
    if (form) form.reset();
    if (window.NotesController && typeof window.NotesController.onCancelEdit === 'function') {
      window.NotesController.onCancelEdit();
    }
  }

  async function handleNoteFormSubmit(event) {
    if (event && typeof event.preventDefault === 'function') {
      event.preventDefault();
    }

    var titleVal = (_byId('note-title-input') && _byId('note-title-input').value || '').trim();
    var contentVal = (_byId('note-content-input') && _byId('note-content-input').value || '').trim();
    var tagsVal = (_byId('note-tags-input') && _byId('note-tags-input').value || '').trim();
    if (!titleVal) return false;

    var payload = {
      title: titleVal,
      content: contentVal,
      tags: tagsVal
        ? tagsVal.split(',').map(function (tag) { return tag.trim().toLowerCase(); }).filter(Boolean)
        : [],
    };
    var saved = null;

    if (window.NotesController && typeof window.NotesController.onSaveNote === 'function') {
      saved = await window.NotesController.onSaveNote(payload);
    }

    if (!saved) {
      window.alert('Could not save note right now.');
      return false;
    }

    closeNoteModal();
    return false;
  }

  async function openNoteDetail(noteId) {
    var note = null;
    if (window.NotesController && typeof window.NotesController.onFetchDetail === 'function') {
      note = await window.NotesController.onFetchDetail(noteId);
    }
    if (!note) return;

    _renderDetail(note);
    _openModal(_byId('note-detail-modal'));
  }

  function closeNoteDetailModal() {
    _closeModal(_byId('note-detail-modal'));
    if (window.NotesController && typeof window.NotesController.onClearViewingNote === 'function') {
      window.NotesController.onClearViewingNote();
    }
  }

  async function deleteCurrentNote() {
    var state = _state();
    if (!state.viewingNote) return false;
    if (!window.confirm('Delete this note? This cannot be undone.')) return false;

    var deleted = false;
    if (window.NotesController && typeof window.NotesController.onDeleteViewingNote === 'function') {
      deleted = await window.NotesController.onDeleteViewingNote();
    }

    if (!deleted) {
      window.alert('Could not delete note right now.');
      return false;
    }

    closeNoteDetailModal();
    return true;
  }

  function editCurrentNote() {
    var note = null;
    if (window.NotesController && typeof window.NotesController.onEditViewingNote === 'function') {
      note = window.NotesController.onEditViewingNote();
    }
    if (!note) return;

    closeNoteDetailModal();
    openNoteEditModal(note);
  }

  function notesSearchDebounce() {
    var state = _state();
    var input = _byId('notes-search-input');
    var query = (input && input.value || '').trim();

    window.clearTimeout(state.searchTimer);
    state.searchTimer = window.setTimeout(function () {
      if (window.NotesController && typeof window.NotesController.onSearchQueryChange === 'function') {
        window.NotesController.onSearchQueryChange(query);
      }
    }, 300);
  }

  function setNotesFilter(filter) {
    if (window.NotesController && typeof window.NotesController.onSetFilter === 'function') {
      return window.NotesController.onSetFilter(filter);
    }
    return Promise.resolve([]);
  }

  async function viewLinkedNote(event) {
    if (event && typeof event.preventDefault === 'function') {
      event.preventDefault();
    }

    if (typeof taskUiState === 'undefined') return;

    var taskId = Number(taskUiState.editingTaskId);
    if (!taskId) return;

    var note = null;
    if (window.NotesController && typeof window.NotesController.onFetchLinkedTaskNote === 'function') {
      note = await window.NotesController.onFetchLinkedTaskNote(taskId);
    }
    if (!note || !note.id) return;

    if (typeof closeTaskEditModal === 'function') {
      closeTaskEditModal();
    }
    if (typeof showPage === 'function') {
      showPage('notes');
    }

    window.setTimeout(function () {
      openNoteDetail(note.id);
    }, 200);
  }

  function _bindDom() {
    if (_bound) return;

    var createButton = _byId('notes-new-note-btn');
    if (createButton) {
      createButton.addEventListener('click', openNoteCreateModal);
    }

    var searchInput = _byId('notes-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', notesSearchDebounce);
    }

    var filterGroup = document.querySelector('.notes-filter-group');
    if (filterGroup) {
      filterGroup.addEventListener('click', function (event) {
        var button = event.target.closest('.notes-filter-btn');
        if (!button || !filterGroup.contains(button)) return;
        event.preventDefault();
        setNotesFilter(button.dataset.filter || 'all');
      });
    }

    var grid = _byId('notes-grid');
    if (grid) {
      grid.addEventListener('click', function (event) {
        var card = event.target.closest('.note-card');
        if (!card || !grid.contains(card)) return;
        openNoteDetail(card.dataset.noteId);
      });
    }

    var noteForm = _byId('note-modal-form');
    if (noteForm) {
      noteForm.addEventListener('submit', handleNoteFormSubmit);
    }

    document.querySelectorAll('[data-notes-close-modal]').forEach(function (button) {
      button.addEventListener('click', closeNoteModal);
    });

    document.querySelectorAll('[data-notes-close-detail]').forEach(function (button) {
      button.addEventListener('click', closeNoteDetailModal);
    });

    var deleteButton = _byId('note-detail-delete-btn');
    if (deleteButton) {
      deleteButton.addEventListener('click', deleteCurrentNote);
    }

    var editButton = _byId('note-detail-edit-btn');
    if (editButton) {
      editButton.addEventListener('click', editCurrentNote);
    }

    var viewLinkedButton = _byId('task-edit-view-note-link');
    if (viewLinkedButton) {
      viewLinkedButton.addEventListener('click', viewLinkedNote);
    }

    _bound = true;
  }

  function _subscribe() {
    if (_subscribed || !window.EventBus) return;

    window.EventBus.subscribe('PAGE_SHOWN', function (pageName) {
      if (pageName === 'notes' && window.NotesController && typeof window.NotesController.onPageShown === 'function') {
        window.NotesController.onPageShown();
      }
    });

    window.EventBus.subscribe('STATE_UPDATED:notes', function () {
      render();
    });

    _subscribed = true;
  }

  function init() {
    _bindDom();
    _subscribe();
    render();
  }

  window.NotesView = {
    init: init,
    render: render,
    openCreateModal: openNoteCreateModal,
    openEditModal: openNoteEditModal,
    closeModal: closeNoteModal,
    handleFormSubmit: handleNoteFormSubmit,
    openDetail: openNoteDetail,
    closeDetailModal: closeNoteDetailModal,
    deleteCurrentNote: deleteCurrentNote,
    editCurrentNote: editCurrentNote,
    setFilter: setNotesFilter,
    searchDebounce: notesSearchDebounce,
    viewLinkedNote: viewLinkedNote,
  };

  window.renderNotesUI = render;
  window.renderNotes = render;
  window.openNoteCreateModal = openNoteCreateModal;
  window.openNoteEditModal = openNoteEditModal;
  window.closeNoteModal = closeNoteModal;
  window.handleNoteFormSubmit = handleNoteFormSubmit;
  window.openNoteDetail = openNoteDetail;
  window.closeNoteDetailModal = closeNoteDetailModal;
  window.deleteCurrentNote = deleteCurrentNote;
  window.editCurrentNote = editCurrentNote;
  window.setNotesFilter = setNotesFilter;
  window.notesSearchDebounce = notesSearchDebounce;
  window.viewLinkedNote = viewLinkedNote;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();