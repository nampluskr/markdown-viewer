// presets/markdown/preset.js — 마크다운 뷰어 프리셋 (FR-1, FR-2)
(function (root) {
  'use strict';

  var MARKDOWN_EXT = ['.md'];

  var TEXT_EXT = ['.txt', '.log'];

  var CODE_EXT = [
    '.py', '.pyi',
    '.cpp', '.cc', '.cxx', '.h', '.hpp',
    '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
    '.ps1', '.psm1', '.psd1',
    '.sh', '.bash'
  ];

  var CONFIG_EXT = [
    '.json', '.jsonc',
    '.yml', '.yaml',
    '.toml'
  ];

  var CODE_AND_TEXT_EXT = TEXT_EXT.concat(CODE_EXT, CONFIG_EXT);
  var ALL_SUPPORTED_EXT = MARKDOWN_EXT.concat(CODE_AND_TEXT_EXT);

  var ALL_SUPPORTED_SET = {};
  for (var i = 0; i < ALL_SUPPORTED_EXT.length; i++) {
    ALL_SUPPORTED_SET[ALL_SUPPORTED_EXT[i]] = true;
  }

  var CODE_AND_TEXT_SET = {};
  for (var j = 0; j < CODE_AND_TEXT_EXT.length; j++) {
    CODE_AND_TEXT_SET[CODE_AND_TEXT_EXT[j]] = true;
  }

  function getExtension(name) {
    if (!name || typeof name !== 'string') return '';
    var idx = name.lastIndexOf('.');
    if (idx < 0) return '';
    return name.slice(idx).toLowerCase();
  }

  function isSupportedExtension(ext) {
    return Boolean(ALL_SUPPORTED_SET[ext]);
  }

  function isMarkdownExtension(ext) {
    return ext === '.md';
  }

  var preset = {
    id: 'markdown',
    supportedExtensions: ALL_SUPPORTED_EXT,
    markdownExtensions: MARKDOWN_EXT,
    codeAndTextExtensions: CODE_AND_TEXT_EXT,
    getExtension: getExtension,
    isSupportedExtension: isSupportedExtension,
    isMarkdownExtension: isMarkdownExtension,

    install: function (slots) {
      if (!slots) return;

      // 1. 트리 항목 자리 (FR-1) — 표의 확장자만 표시, 폴더는 항상 표시, 대소문자 무관
      slots.setTreeItemFilter(function (entries) {
        if (!Array.isArray(entries)) return [];
        return entries.filter(function (entry) {
          if (!entry) return false;
          if (entry.is_dir) return true;
          var ext = getExtension(entry.name);
          return isSupportedExtension(ext);
        });
      });

      // 2. 행 선택 매핑 자리 (FR-2) — .md는 markdown 보기, 기타 지원 확장자는 code 보기, 폴더는 열지 않음
      slots.setRowSelectionMapper(function (entry) {
        if (!entry || entry.is_dir) return null;
        var ext = getExtension(entry.name);
        if (isMarkdownExtension(ext)) {
          return {
            kind: 'markdown',
            resource: { path: entry.path },
            title: entry.name
          };
        }
        if (CODE_AND_TEXT_SET[ext]) {
          return {
            kind: 'code',
            resource: { path: entry.path },
            title: entry.name
          };
        }
        return null;
      });

      // 3. 중복 정책 자리 — 같은 주소면 기존 탭 재사용, 판정 범위는 조각 안
      slots.registerDuplicatePolicy('markdown', {
        mode: 'reuse_existing',
        scope: 'pane'
      });
      slots.registerDuplicatePolicy('code', {
        mode: 'reuse_existing',
        scope: 'pane'
      });

      // 4. 보기 제공자 자리 (FR-2)
      var views = (typeof root !== 'undefined' && root.MarkdownPresetViews) || null;
      if (views) {
        if (views.markdown) {
          slots.registerViewProvider('markdown', views.markdown);
        }
        if (views.code) {
          slots.registerViewProvider('code', views.code);
        }
      }

      // 5. 여는 경로 자리 (FR-9) — 상대경로 문서 링크 등에서 탭 열기
      slots.registerOpenRoute('open_document', function (tabManager, options) {
        if (!tabManager || !options || !options.path) return null;
        var p = options.path;
        var title = options.title || (function (fp) {
          var cut = Math.max(fp.lastIndexOf('/'), fp.lastIndexOf('\\'));
          return cut >= 0 ? fp.slice(cut + 1) : fp;
        })(p);

        return tabManager.openTab({
          kind: 'markdown',
          resource: { path: p },
          title: title
        });
      });
    }
  };

  if (typeof module === 'object' && module.exports) {
    module.exports = preset;
  } else {
    root.Presets = root.Presets || {};
    root.Presets[preset.id] = preset;
  }
})(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this));
