// presets/active.js — 어느 프리셋을 쓸지 고르는 한 곳
(function (root) {
  'use strict';

  var ACTIVE_PRESET = 'markdown';

  // 고른 프리셋의 소재만 이어 붙인다. 빌드 단계 없이 파서 단계에서 동기로 로드되므로
  // 껍데기의 app.js가 뜰 때는 이미 등록이 끝나 있다 (제약 3).
  if (typeof document !== 'undefined' && typeof document.write === 'function') {
    var base = '../presets/' + ACTIVE_PRESET + '/';
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
