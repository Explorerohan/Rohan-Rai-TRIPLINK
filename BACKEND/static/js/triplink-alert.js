/**
 * TRIPLINK web alerts — same visual language as the mobile AppAlert (card, icon, OK / confirm).
 * Replaces window.alert / window.confirm for agent & admin templates.
 */
(function (global) {
  'use strict';

  function escapeHtml(s) {
    if (s == null) return '';
    var d = document.createElement('div');
    d.textContent = String(s);
    return d.innerHTML;
  }

  function hideServerMessages() {
    // Hide legacy server-rendered flash blocks only when a modal alert is shown.
    var blocks = document.querySelectorAll(
      '.messages, .pd-messages, .admin-messages, .alert.alert-success, .alert.alert-danger, .alert.alert-error, .alert.alert-warning, .alert.alert-info, .pd-alert, .msg'
    );
    for (var i = 0; i < blocks.length; i++) {
      blocks[i].style.display = 'none';
    }
  }

  function iconSvg(type) {
    if (type === 'success') {
      return '<svg width="36" height="36" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>';
    }
    if (type === 'error') {
      return '<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>';
    }
    if (type === 'warning') {
      return '<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';
    }
    return '<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>';
  }

  function primaryBtnClass(type, destructive) {
    if (destructive) return 'triplink-btn-danger';
    switch (type) {
      case 'success': return 'triplink-btn-success';
      case 'error': return 'triplink-btn-neutral';
      case 'warning': return 'triplink-btn-warning';
      default: return 'triplink-btn-info';
    }
  }

  function removeBackdrop(el) {
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }

  function show(opts) {
    opts = opts || {};
    var title = opts.title != null ? String(opts.title) : '';
    var message = opts.message != null ? String(opts.message) : '';
    var type = opts.type || 'info';
    var onOk = typeof opts.onOk === 'function' ? opts.onOk : function () {};

    hideServerMessages();

    var existing = document.getElementById('triplink-alert-backdrop');
    if (existing) removeBackdrop(existing);

    var backdrop = document.createElement('div');
    backdrop.id = 'triplink-alert-backdrop';
    backdrop.className = 'triplink-alert-backdrop';
    backdrop.setAttribute('role', 'dialog');
    backdrop.setAttribute('aria-modal', 'true');

    var btnClass = primaryBtnClass(type, false);
    backdrop.innerHTML =
      '<div class="triplink-alert-card" tabindex="-1">' +
      '<div class="triplink-alert-icon-wrap triplink-type-' + escapeHtml(type) + '">' + iconSvg(type) + '</div>' +
      (title ? '<div class="triplink-alert-title">' + escapeHtml(title) + '</div>' : '') +
      (message ? '<div class="triplink-alert-message">' + escapeHtml(message) + '</div>' : '') +
      '<div class="triplink-alert-actions triplink-single">' +
      '<button type="button" class="triplink-alert-btn triplink-alert-btn-primary ' + btnClass + ' triplink-alert-ok">OK</button>' +
      '</div></div>';

    document.body.appendChild(backdrop);

    function close() {
      removeBackdrop(backdrop);
      document.removeEventListener('keydown', onKey);
      onOk();
    }

    function onKey(e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
      }
    }

    backdrop.addEventListener('click', function (e) {
      if (e.target === backdrop) close();
    });
    document.addEventListener('keydown', onKey);
    backdrop.querySelector('.triplink-alert-ok').addEventListener('click', close);
    backdrop.querySelector('.triplink-alert-card').focus && backdrop.querySelector('.triplink-alert-card').focus();
  }

  function confirm(opts) {
    opts = opts || {};
    var title = opts.title != null ? String(opts.title) : 'Confirm';
    var message = opts.message != null ? String(opts.message) : '';
    var type = opts.type || 'info';
    var destructive = !!opts.destructive;
    var confirmText = opts.confirmText != null ? String(opts.confirmText) : 'OK';
    var cancelText = opts.cancelText != null ? String(opts.cancelText) : 'Cancel';
    var onConfirm = typeof opts.onConfirm === 'function' ? opts.onConfirm : function () {};
    var onCancel = typeof opts.onCancel === 'function' ? opts.onCancel : function () {};

    var existing = document.getElementById('triplink-alert-backdrop');
    if (existing) removeBackdrop(existing);

    var backdrop = document.createElement('div');
    backdrop.id = 'triplink-alert-backdrop';
    backdrop.className = 'triplink-alert-backdrop';
    backdrop.setAttribute('role', 'dialog');
    backdrop.setAttribute('aria-modal', 'true');

    var iconType = destructive ? 'error' : type;
    var btnClass = primaryBtnClass(type, destructive);

    backdrop.innerHTML =
      '<div class="triplink-alert-card">' +
      '<div class="triplink-alert-icon-wrap triplink-type-' + escapeHtml(iconType) + '">' + iconSvg(iconType) + '</div>' +
      '<div class="triplink-alert-title">' + escapeHtml(title) + '</div>' +
      (message ? '<div class="triplink-alert-message">' + escapeHtml(message) + '</div>' : '') +
      '<div class="triplink-alert-actions">' +
      '<button type="button" class="triplink-alert-btn triplink-alert-btn-secondary triplink-alert-cancel">' + escapeHtml(cancelText) + '</button>' +
      '<button type="button" class="triplink-alert-btn triplink-alert-btn-primary ' + btnClass + ' triplink-alert-confirm">' + escapeHtml(confirmText) + '</button>' +
      '</div></div>';

    document.body.appendChild(backdrop);

    function cleanup() {
      removeBackdrop(backdrop);
      document.removeEventListener('keydown', onKey);
    }

    function onKey(e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        cleanup();
        onCancel();
      }
    }

    backdrop.addEventListener('click', function (e) {
      if (e.target === backdrop) {
        cleanup();
        onCancel();
      }
    });
    document.addEventListener('keydown', onKey);
    backdrop.querySelector('.triplink-alert-cancel').addEventListener('click', function () {
      cleanup();
      onCancel();
    });
    backdrop.querySelector('.triplink-alert-confirm').addEventListener('click', function () {
      cleanup();
      onConfirm();
    });
  }

  function showOptions(opts) {
    opts = opts || {};
    var title = opts.title != null ? String(opts.title) : '';
    var message = opts.message != null ? String(opts.message) : '';
    var options = Array.isArray(opts.options) ? opts.options : [];

    hideServerMessages();

    var existing = document.getElementById('triplink-alert-backdrop');
    if (existing) removeBackdrop(existing);

    var backdrop = document.createElement('div');
    backdrop.id = 'triplink-alert-backdrop';
    backdrop.className = 'triplink-alert-backdrop';

    var html =
      '<div class="triplink-alert-card">' +
      (title ? '<div class="triplink-alert-title">' + escapeHtml(title) + '</div>' : '') +
      (message ? '<div class="triplink-alert-message">' + escapeHtml(message) + '</div>' : '') +
      '<div class="triplink-alert-options">';
    options.forEach(function (opt, i) {
      var label = opt.label != null ? String(opt.label) : '';
      var cls = 'triplink-alert-option';
      if (opt.variant === 'cancel') cls += ' triplink-opt-cancel';
      if (opt.variant === 'destructive') cls += ' triplink-opt-destructive';
      html += '<button type="button" class="' + cls + '" data-idx="' + i + '">' + escapeHtml(label) + '</button>';
    });
    html += '</div></div>';
    backdrop.innerHTML = html;
    document.body.appendChild(backdrop);

    function cleanup() {
      removeBackdrop(backdrop);
    }

    backdrop.querySelectorAll('.triplink-alert-option').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var idx = parseInt(btn.getAttribute('data-idx'), 10);
        var opt = options[idx];
        cleanup();
        if (opt && typeof opt.onPress === 'function') opt.onPress();
      });
    });

    backdrop.addEventListener('click', function (e) {
      if (e.target === backdrop) cleanup();
    });
  }

  /** Delegated confirm for <a href="..." data-triplink-confirm="message"> */
  function bindDelegatedConfirms() {
    document.addEventListener('click', function (e) {
      var el = e.target.closest('[data-triplink-confirm]');
      if (!el) return;
      if (el.tagName === 'A' && el.getAttribute('href')) {
        e.preventDefault();
        var href = el.getAttribute('href');
        var msg = el.getAttribute('data-triplink-confirm') || '';
        var ttl = el.getAttribute('data-triplink-confirm-title') || 'Are you sure?';
        var destructive = el.getAttribute('data-triplink-destructive') !== '0';
        confirm({
          title: ttl,
          message: msg,
          destructive: destructive,
          confirmText: el.getAttribute('data-triplink-confirm-ok') || 'OK',
          cancelText: el.getAttribute('data-triplink-confirm-cancel') || 'Cancel',
          onConfirm: function () {
            window.location.href = href;
          },
        });
        return;
      }
      if (el.tagName === 'BUTTON' && (el.type === 'submit' || el.getAttribute('type') === 'submit')) {
        e.preventDefault();
        var form = el.form;
        if (!form) return;
        var msg2 = el.getAttribute('data-triplink-confirm') || '';
        var ttl2 = el.getAttribute('data-triplink-confirm-title') || 'Are you sure?';
        var destructive2 = el.getAttribute('data-triplink-destructive') !== '0';
        confirm({
          title: ttl2,
          message: msg2,
          destructive: destructive2,
          confirmText: el.getAttribute('data-triplink-confirm-ok') || 'OK',
          cancelText: el.getAttribute('data-triplink-confirm-cancel') || 'Cancel',
          onConfirm: function () {
            if (el.name) {
              var h = document.createElement('input');
              h.type = 'hidden';
              h.name = el.name;
              h.value = el.value || '1';
              form.appendChild(h);
            }
            form.submit();
          },
        });
      }
    }, true);
  }

  var TriplinkAlert = {
    show: show,
    alert: show,
    confirm: confirm,
    showOptions: showOptions,
  };

  global.TriplinkAlert = TriplinkAlert;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindDelegatedConfirms);
  } else {
    bindDelegatedConfirms();
  }
})(typeof window !== 'undefined' ? window : this);
