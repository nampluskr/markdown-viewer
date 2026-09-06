// presets/markdown/preset.js — 마크다운 뷰어 프리셋
(function (root) {
  'use strict';

  var preset = {
    id: 'markdown',

    install: function (slots) {
      if (!slots) return;

      // 1. 트리 항목 자리 (Phase 1 기본, Phase 2에서 FR-1 확장자 필터 적용)
      slots.setTreeItemFilter(function (entries) {
        return Array.isArray(entries) ? entries.slice() : [];
      });

      // 2. 행 선택 매핑 자리
      slots.setRowSelectionMapper(function (entry) {
        if (!entry || entry.is_dir) return null;
        return {
          kind: 'markdown',
          resource: { path: entry.path },
          title: entry.name
        };
      });

      // 3. 중복 정책 자리 — 같은 주소면 기존 탭, 판정 범위는 조각 안
      slots.registerDuplicatePolicy('markdown', {
        mode: 'reuse_existing',
        scope: 'pane'
      });

      // 4. 보기 제공자 자리
      var views = (typeof root !== 'undefined' && root.MarkdownPresetViews) || null;
      if (views && views.markdown) {
        slots.registerViewProvider('markdown', views.markdown);
      }
    }
  };

  if (typeof module === 'object' && module.exports) {
    module.exports = preset;
  } else {
    root.Presets = root.Presets || {};
    root.Presets[preset.id] = preset;
  }
})(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this));
