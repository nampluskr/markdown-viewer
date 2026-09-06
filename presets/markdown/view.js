// presets/markdown/view.js — 마크다운 및 문서 뷰어 컴포넌트
(function (root) {
  'use strict';

  function getBaseName(path) {
    if (!path) return '';
    var normalized = String(path).replace(/[\\/]+$/, '');
    var cut = Math.max(normalized.lastIndexOf('/'), normalized.lastIndexOf('\\'));
    return cut >= 0 ? normalized.slice(cut + 1) : normalized;
  }

  var markdownView = {
    kind: 'markdown',

    createView: function (container, tab) {
      var el = null;
      var destroyed = false;

      return {
        mount: function (mountTarget) {
          if (destroyed) return;
          var target = mountTarget || container;
          if (!target || !target.ownerDocument) return;

          el = target.ownerDocument.createElement('div');
          el.className = 'markdown-view-container';

          var header = target.ownerDocument.createElement('div');
          header.className = 'markdown-view-title';
          header.textContent = (tab && tab.title) || getBaseName(tab && tab.resource && tab.resource.path);
          el.appendChild(header);

          target.appendChild(el);
        },

        activate: function () {
          if (el) el.classList.add('active');
        },

        deactivate: function () {
          if (el) el.classList.remove('active');
        },

        resize: function () {
        },

        destroy: function () {
          destroyed = true;
          if (el && el.parentNode) {
            el.parentNode.removeChild(el);
          }
          el = null;
        }
      };
    }
  };

  if (typeof module === 'object' && module.exports) {
    module.exports = { markdown: markdownView };
  } else {
    root.MarkdownPresetViews = root.MarkdownPresetViews || {};
    root.MarkdownPresetViews.markdown = markdownView;
  }
})(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this));
