// shared/design/icon_theme.js — 파일 타입 아이콘 테마 해석기 (FR-30)
//
// 껍데기는 확장자 규칙도 아이콘 자산의 생김새도 알지 못한다. 트리 행의 이름과
// 펼침 여부만 넘기고 "무엇을 어떻게 그릴지"를 서술한 값 하나를 돌려받는다.
// 값의 출처를 디자인 파일 한 곳에 두는 규칙(FR-28)과 같은 자리다.
//
// 돌려주는 서술값
//   { render: 'symbol', href }              아이콘 파일의 심볼 (Simple)
//   { render: 'glyph',  char, color, font } 글꼴 글리프 (VS Code Built-in)
//   { render: 'image',  src }               SVG 파일 (VS Code Icons)
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.IconTheme = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this), function () {
  'use strict';

  var THEMES = ['simple', 'builtin', 'vsicons'];
  var BASE = '../shared/design/';
  var SYMBOL_PREFIX = BASE + 'icons.svg#icon-';

  // 껍데기 아이콘 한 벌의 심볼 이름 (Simple)
  var SYMBOL = {
    dirClosed: 'fol' + 'der',
    dirOpen: 'fol' + 'der-open',
    leaf: 'fi' + 'le'
  };

  // VS Code Built-in에서 폴더는 codicon 글리프를 쓴다 (v0.1과 같은 코드포인트)
  var CODICON_DIR_OPEN = 0xeaf7;
  var CODICON_DIR_CLOSED = 0xea83;

  var cache = { simple: null, builtin: null, vsicons: null };
  var inflight = {};

  function themeUrl(name) {
    if (name === 'builtin') return BASE + 'icons/seti/theme.json';
    if (name === 'vsicons') return BASE + 'icons/vscode-icons/theme.json';
    return null;
  }

  // 테마 자료를 한 번만 읽어 둔다. 읽지 못하면 null을 돌려주고 Simple로 떨어진다.
  function load(name) {
    if (name === 'simple') return Promise.resolve(null);
    if (cache[name]) return Promise.resolve(cache[name]);
    if (inflight[name]) return inflight[name];

    var url = themeUrl(name);
    if (!url || typeof fetch !== 'function') return Promise.resolve(null);

    inflight[name] = fetch(url)
      .then(function (res) { return res.ok ? res.json() : null; })
      .then(function (data) { cache[name] = data; delete inflight[name]; return data; })
      .catch(function () { delete inflight[name]; return null; });
    return inflight[name];
  }

  function isLoaded(name) {
    return name === 'simple' || Boolean(cache[name]);
  }

  function symbolFor(entry) {
    if (entry && entry.is_dir) {
      return { render: 'symbol', href: SYMBOL_PREFIX + (entry.expanded ? SYMBOL.dirOpen : SYMBOL.dirClosed) };
    }
    return { render: 'symbol', href: SYMBOL_PREFIX + SYMBOL.leaf };
  }

  // 두 아이콘 테마 모두 흔한 확장자를 languageIds로 잇는다. 그 표는 편집기가
  // 자기 언어 등록표에서 대주는 것이라 테마 파일에 없다. 여기가 그 다리다 —
  // 확장자를 언어 이름으로 옮기기만 하고 그 밖의 판단은 하지 않는다.
  var LANGUAGE_BY_EXTENSION = {
    md: 'markdown', markdown: 'markdown',
    js: 'javascript', mjs: 'javascript', cjs: 'javascript', jsx: 'javascriptreact',
    ts: 'typescript', tsx: 'typescriptreact',
    py: 'python', pyw: 'python',
    json: 'json', jsonc: 'jsonc',
    html: 'html', htm: 'html',
    css: 'css', scss: 'scss', less: 'less',
    xml: 'xml', yaml: 'yaml', yml: 'yaml', toml: 'toml', ini: 'ini',
    sh: 'shellscript', bash: 'shellscript', zsh: 'shellscript',
    ps1: 'powershell', bat: 'bat', cmd: 'bat',
    c: 'c', h: 'c', cpp: 'cpp', cc: 'cpp', cxx: 'cpp', hpp: 'cpp',
    cs: 'csharp', java: 'java', go: 'go', rs: 'rust', rb: 'ruby',
    php: 'php', lua: 'lua', sql: 'sql', r: 'r', swift: 'swift', kt: 'kotlin',
    txt: 'plaintext', log: 'log', csv: 'csv', tex: 'tex', vue: 'vue', svelte: 'svelte'
  };

  // 이름으로 아이콘 열쇠를 찾는다.
  // 이름 전체 → 두 마디 확장자 → 한 마디 확장자 → 확장자가 가리키는 언어
  function lookupByName(theme, lowerName) {
    var key = theme.fileNames && theme.fileNames[lowerName];
    if (key) return key;

    var parts = lowerName.split('.');
    if (parts.length < 2) return null;

    if (theme.fileExtensions) {
      if (parts.length > 2) {
        key = theme.fileExtensions[parts.slice(-2).join('.')];
        if (key) return key;
      }
      key = theme.fileExtensions[parts[parts.length - 1]];
      if (key) return key;
    }

    if (theme.languageIds) {
      var language = LANGUAGE_BY_EXTENSION[parts[parts.length - 1]];
      if (language) {
        key = theme.languageIds[language];
        if (key) return key;
      }
    }
    return null;
  }

  function resolveBuiltin(entry) {
    var theme = cache.builtin;
    if (!theme) return null;

    if (entry.is_dir) {
      var point = entry.expanded ? CODICON_DIR_OPEN : CODICON_DIR_CLOSED;
      return { render: 'glyph', char: String.fromCodePoint(point), color: null, font: 'codicon' };
    }

    var lower = String(entry.name || '').toLowerCase();
    var key = lookupByName(theme, lower) || theme.file || '_default';
    var def = theme.iconDefinitions && theme.iconDefinitions[key];
    if (!def || !def.fontCharacter) return null;

    var code = parseInt(String(def.fontCharacter).replace(/^\\/, ''), 16);
    if (Number.isNaN(code)) return null;
    return { render: 'glyph', char: String.fromCodePoint(code), color: def.fontColor || null, font: 'seti' };
  }

  function resolveVsicons(entry) {
    var theme = cache.vsicons;
    if (!theme) return null;

    var lower = String(entry.name || '').toLowerCase();
    var key;
    if (entry.is_dir) {
      if (entry.expanded) {
        key = (theme.folderNamesExpanded && theme.folderNamesExpanded[lower]) || theme.folderExpanded || '_folder_open';
      } else {
        key = (theme.folderNames && theme.folderNames[lower]) || theme.folder || '_folder';
      }
    } else {
      key = lookupByName(theme, lower) || theme.file || '_file';
    }

    var def = theme.iconDefinitions && theme.iconDefinitions[key];
    if (!def || !def.iconPath) return null;

    var fileName = String(def.iconPath).replace(/^(\.\.\/)+/, '').replace(/^icons\//, '');
    return { render: 'image', src: BASE + 'icons/vscode-icons/icons/' + fileName };
  }

  // 고른 테마로 서술값을 만든다. 자료가 없거나 맞는 것이 없으면 Simple로 떨어진다.
  function resolve(themeName, entry) {
    var safeEntry = entry || {};
    if (THEMES.indexOf(themeName) < 0 || themeName === 'simple') return symbolFor(safeEntry);
    var resolved = themeName === 'builtin' ? resolveBuiltin(safeEntry) : resolveVsicons(safeEntry);
    return resolved || symbolFor(safeEntry);
  }

  return {
    THEMES: THEMES,
    load: load,
    isLoaded: isLoaded,
    resolve: resolve,
    // 시험이 자료를 직접 물려 줄 수 있게 열어 둔다 (네트워크 없이 판정하기 위함)
    __setData: function (name, data) { cache[name] = data; },
    __reset: function () { cache = { simple: null, builtin: null, vsicons: null }; inflight = {}; }
  };
});
