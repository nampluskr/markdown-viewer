// presets/active.js — 어느 프리셋을 쓸지 고르는 한 곳 (FR-32)
(function (root) {
  'use strict';

  var ACTIVE_PRESET = 'markdown';

  // 고른 프리셋의 소재만 이어 붙인다. 빌드 단계 없이 파서 단계에서 동기로 로드되므로
  // 껍데기의 app.js가 뜰 때는 이미 등록이 끝나 있다 (제약 3).
  if (typeof document !== 'undefined' && typeof document.write === 'function') {
    // 1. vendor 라이브러리 동기 로드
    var vendorLibs = [
      '../vendor/marked.min.js',
      '../vendor/purify.min.js'
    ];
    for (var v = 0; v < vendorLibs.length; v++) {
      document.write('<script src="' + vendorLibs[v] + '"><\/script>');
    }

    // 2. 프리셋 스타일시트 로드
    var base = '../presets/' + ACTIVE_PRESET + '/';
    document.write('<link rel="stylesheet" href="' + base + 'markdown.css">');

    // 3. 프리셋 스크립트 로드
    var parts = ['view.js', 'preset.js'];
    for (var i = 0; i < parts.length; i++) {
      document.write('<script src="' + base + parts[i] + '"><\/script>');
    }
  }

  if (typeof module === 'object' && module.exports) {
    module.exports = ACTIVE_PRESET;
  } else {
    root.ACTIVE_PRESET = ACTIVE_PRESET;
  }
})(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this));
