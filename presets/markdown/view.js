// presets/markdown/view.js — 마크다운 및 텍스트/코드 뷰어 컴포넌트 (FR-3 ~ FR-12)
(function (root) {
  'use strict';

  function getBaseName(path) {
    if (!path) return '';
    var normalized = String(path).replace(/[\\/]+$/, '');
    var cut = Math.max(normalized.lastIndexOf('/'), normalized.lastIndexOf('\\'));
    return cut >= 0 ? normalized.slice(cut + 1) : normalized;
  }

  function getDirName(path) {
    if (!path) return '';
    var normalized = String(path).replace(/[\\/]+$/, '');
    var cut = Math.max(normalized.lastIndexOf('/'), normalized.lastIndexOf('\\'));
    return cut >= 0 ? normalized.slice(0, cut) : '';
  }

  function getExtension(name) {
    if (!name || typeof name !== 'string') return '';
    var idx = name.lastIndexOf('.');
    if (idx < 0) return '';
    return name.slice(idx).toLowerCase();
  }

  function escapeHtml(str) {
    if (typeof str !== 'string') return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function getBridge() {
    if (typeof window !== 'undefined' && window.bridge) return window.bridge;
    if (typeof globalThis !== 'undefined' && globalThis.bridge) return globalThis.bridge;
    return null;
  }

  var LANG_MAP = {
    'python': 'python',
    'py': 'python',
    '.py': 'python',
    '.pyi': 'python',

    'cpp': 'cpp',
    'c++': 'cpp',
    '.cpp': 'cpp',
    '.cc': 'cpp',
    '.cxx': 'cpp',
    '.h': 'cpp',
    '.hpp': 'cpp',

    'typescript': 'typescript',
    'ts': 'typescript',
    '.ts': 'typescript',
    '.tsx': 'typescript',

    'javascript': 'javascript',
    'js': 'javascript',
    '.js': 'javascript',
    '.jsx': 'javascript',
    '.mjs': 'javascript',
    '.cjs': 'javascript',

    'json': 'json',
    'jsonc': 'json',
    '.json': 'json',
    '.jsonc': 'json',

    'powershell': 'powershell',
    'ps1': 'powershell',
    '.ps1': 'powershell',
    '.psm1': 'powershell',
    '.psd1': 'powershell',

    'yaml': 'yaml',
    'yml': 'yaml',
    '.yaml': 'yaml',
    '.yml': 'yaml',

    'toml': 'toml',
    '.toml': 'toml',

    'bash': 'bash',
    'sh': 'bash',
    '.sh': 'bash',
    '.bash': 'bash'
  };

  function resolvePrismLanguage(identifier) {
    if (!identifier || typeof identifier !== 'string') return null;
    var clean = identifier.trim().toLowerCase();
    return LANG_MAP[clean] || null;
  }

  function highlightCode(code, langKey) {
    var prism = (typeof window !== 'undefined' && window.Prism) ||
                (typeof root !== 'undefined' && root.Prism) || null;
    if (!prism || !langKey || !prism.languages || !prism.languages[langKey]) {
      return escapeHtml(code);
    }
    try {
      return prism.highlight(code, prism.languages[langKey], langKey);
    } catch {
      return escapeHtml(code);
    }
  }

  function getPurifier() {
    var purifier = (typeof window !== 'undefined' && window.DOMPurify) ||
                   (typeof root !== 'undefined' && root.DOMPurify) || null;
    return (purifier && typeof purifier.sanitize === 'function') ? purifier : null;
  }

  // 정화기가 없으면 원본 HTML을 넣지 않는다. 정규식으로 흉내 내면 조용히 약한 상태가 된다 (D-6).
  function sanitizeHtml(dirtyHtml) {
    var purifier = getPurifier();
    if (!purifier) {
      return '<pre class="sanitizer-missing">' + escapeHtml(String(dirtyHtml)) + '</pre>';
    }
    return purifier.sanitize(String(dirtyHtml), {
      USE_PROFILES: { html: true },
      FORBID_TAGS: ['script'],
      FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur']
    });
  }

  // 렌더러 등록은 한 번만 한다. marked.use는 호출할 때마다 쌓인다.
  var markedConfigured = false;

  function getMarkedParser() {
    var parser = (typeof window !== 'undefined' && window.marked) ||
                 (typeof root !== 'undefined' && root.marked) || null;
    if (!parser || typeof parser.parse !== 'function') return null;

    if (!markedConfigured && typeof parser.use === 'function') {
      parser.use({
        renderer: {
          code: function (args) {
            var text = args.text || '';
            var lang = args.lang || '';
            var language = resolvePrismLanguage(lang);
            var highlighted = highlightCode(text, language);
            return '<pre><code class="language-' + (language || 'text') + '">' + highlighted + '</code></pre>\n';
          }
        }
      });
      markedConfigured = true;
    }
    return parser;
  }

  // 동결본(react-markdown + remark-gfm)과 같게 소프트 줄바꿈을 <br>로 바꾸지 않는다.
  var MARKED_OPTIONS = { gfm: true, breaks: false };

  // 마크다운 -> HTML. 화면에 넣기 전 단계이며, 정화는 sanitizeHtml이 따로 한다 (D-6).
  function renderMarkdownToHtml(rawMd) {
    var parser = getMarkedParser();
    if (!parser) {
      return '<pre>' + escapeHtml(String(rawMd)) + '</pre>';
    }
    return parser.parse(String(rawMd), MARKED_OPTIONS);
  }

  function copyToClipboard(text, buttonEl) {
    var nav = (typeof root !== 'undefined' && root.mockNavigator) ||
              (typeof window !== 'undefined' && window.navigator) ||
              (typeof globalThis !== 'undefined' && globalThis.navigator) || null;
    var clip = nav && nav.clipboard;
    if (!clip || typeof clip.writeText !== 'function') {
      if (buttonEl) {
        buttonEl.textContent = 'Copy failed';
        buttonEl.classList.add('copy-failed');
        setTimeout(function () {
          buttonEl.textContent = 'Copy';
          buttonEl.classList.remove('copy-failed');
        }, 1500);
      }
      return Promise.reject(new Error('Clipboard API not available'));
    }

    return clip.writeText(text).then(function () {
      if (buttonEl) {
        buttonEl.textContent = 'Copied';
        buttonEl.classList.add('copied');
        setTimeout(function () {
          buttonEl.textContent = 'Copy';
          buttonEl.classList.remove('copied');
        }, 1500);
      }
    }).catch(function () {
      if (buttonEl) {
        buttonEl.textContent = 'Copy failed';
        buttonEl.classList.add('copy-failed');
        setTimeout(function () {
          buttonEl.textContent = 'Copy';
          buttonEl.classList.remove('copy-failed');
        }, 1500);
      }
    });
  }

  function attachCodeCopyButtons(container) {
    var preBlocks = container.querySelectorAll('pre');
    preBlocks.forEach(function (pre) {
      if (pre.parentNode && pre.parentNode.classList.contains('code-block-wrapper')) {
        return;
      }
      var wrapper = container.ownerDocument.createElement('div');
      wrapper.className = 'code-block-wrapper';
      pre.parentNode.insertBefore(wrapper, pre);
      wrapper.appendChild(pre);

      var btn = container.ownerDocument.createElement('button');
      btn.type = 'button';
      btn.className = 'code-copy-btn';
      btn.textContent = 'Copy';
      btn.setAttribute('aria-label', 'Copy code');
      btn.addEventListener('click', function () {
        var codeEl = pre.querySelector('code');
        var text = (codeEl ? codeEl.textContent : pre.textContent) || '';
        copyToClipboard(text, btn);
      });
      wrapper.appendChild(btn);
    });
  }

  function resolveImages(container, baseDir) {
    var images = container.querySelectorAll('img');
    var bridge = getBridge();
    if (!bridge || !bridge.call_domain) return;

    images.forEach(function (img) {
      var src = img.getAttribute('src');
      if (!src) return;
      if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('data:')) {
        return;
      }

      bridge.call_domain('read_image', src, baseDir).then(function (res) {
        if (!img.parentNode) return;
        if (res && res.ok && res.value && res.value.dataUri) {
          img.src = res.value.dataUri;
        } else {
          var errSpan = container.ownerDocument.createElement('span');
          errSpan.className = 'markdown-img-error';
          var code = (res && res.error && res.error.code) || 'NOT_FOUND';
          errSpan.textContent = '[Image not found: ' + (img.alt || src) + ' (' + code + ')]';
          img.parentNode.replaceChild(errSpan, img);
        }
      }).catch(function () {
        if (!img.parentNode) return;
        var errSpan = container.ownerDocument.createElement('span');
        errSpan.className = 'markdown-img-error';
        errSpan.textContent = '[Image load failed: ' + (img.alt || src) + ']';
        img.parentNode.replaceChild(errSpan, img);
      });
    });
  }

  // 차단된 링크를 사용자가 알 수 있게 알린다. 콘솔 경고만으로는 화면에서 아무 일도 없어 보인다.
  function showViewNotice(container, message) {
    if (!container || !container.ownerDocument) return;
    var doc = container.ownerDocument;
    var existing = container.querySelector && container.querySelector('.view-notice');
    if (existing && existing.parentNode) existing.parentNode.removeChild(existing);

    var notice = doc.createElement('div');
    notice.className = 'view-notice';
    notice.textContent = message;
    container.appendChild(notice);

    var timer = (typeof setTimeout === 'function') ? setTimeout : null;
    if (timer) {
      timer(function () {
        if (notice.parentNode) notice.parentNode.removeChild(notice);
      }, 3000);
    }
  }

  // 링크 대상의 확장자로 어떤 보기로 열지 정한다. 프리셋이 가진 분류를 그대로 쓴다 (FR-2).
  function resolveLinkTargetKind(targetPath) {
    var presets = (typeof window !== 'undefined' && window.Presets) ||
                  (typeof root !== 'undefined' && root.Presets) || null;
    var preset = presets && presets.markdown;
    var ext = getExtension(getBaseName(targetPath));

    if (preset && typeof preset.isSupportedExtension === 'function') {
      if (!preset.isSupportedExtension(ext)) return null;
      return preset.isMarkdownExtension(ext) ? 'markdown' : 'code';
    }
    return ext === '.md' ? 'markdown' : null;
  }

  function attachLinkHandlers(container, baseDir) {
    var links = container.querySelectorAll('a');
    var bridge = getBridge();

    links.forEach(function (a) {
      a.addEventListener('click', function (e) {
        var href = a.getAttribute('href');
        if (!href) return;

        if (href.startsWith('#')) {
          return;
        }

        e.preventDefault();

        if (href.startsWith('http://') || href.startsWith('https://')) {
          if (bridge && bridge.call_domain) {
            bridge.call_domain('open_external', href);
          }
          return;
        }

        var combined = baseDir ? (baseDir + '/' + href).replace(/\\/g, '/').replace(/\/+/g, '/') : href;
        if (combined.split('/').includes('..') || href.startsWith('/') || /^[a-zA-Z]:/.test(href)) {
          showViewNotice(container, 'Blocked (ROOT_ESCAPE): ' + href);
          return;
        }

        var kind = resolveLinkTargetKind(combined);
        if (!kind) {
          showViewNotice(container, 'Unsupported target: ' + href);
          return;
        }

        openDocumentLink(combined, kind);
      });
    });
  }

  function openDocumentLink(targetPath, kind) {
    var viewKind = kind || 'markdown';
    var shell = (typeof window !== 'undefined' && window.__shell) || null;
    if (shell && shell.slots && typeof shell.slots.executeOpenRoute === 'function') {
      shell.slots.executeOpenRoute('open_document', shell.tabManager, {
        path: targetPath,
        title: getBaseName(targetPath),
        kind: viewKind
      });
      if (shell.renderEditor) shell.renderEditor();
      return;
    }
    if (shell && shell.tabManager) {
      shell.tabManager.openTab({
        kind: viewKind,
        resource: { path: targetPath },
        title: getBaseName(targetPath)
      });
      if (shell.renderEditor) shell.renderEditor();
    }
  }

  // 1. 마크다운 뷰어
  var markdownView = {
    kind: 'markdown',

    createView: function (container, tab) {
      var el = null;
      var destroyed = false;
      var currentScrollTop = 0;
      var zoomLevel = 1.0;
      var loadedContent = null;

      function renderError(code, message) {
        if (!el) return;
        el.innerHTML = '';
        var errBox = el.ownerDocument.createElement('div');
        errBox.className = 'view-error-container';

        var errCode = el.ownerDocument.createElement('div');
        errCode.className = 'view-error-code';
        errCode.textContent = code || 'READ_FAILED';
        errBox.appendChild(errCode);

        var errMsg = el.ownerDocument.createElement('div');
        errMsg.className = 'view-error-message';
        errMsg.textContent = message || 'Could not load the document.';
        errBox.appendChild(errMsg);

        el.appendChild(errBox);
      }

      function updateZoom() {
        if (!el) return;
        el.style.setProperty('--reading-zoom', zoomLevel.toString());
      }

      function handleWheel(e) {
        if (e.ctrlKey) {
          e.preventDefault();
          if (e.deltaY < 0) {
            zoomLevel = Math.min(2.5, Math.round((zoomLevel + 0.1) * 10) / 10);
          } else if (e.deltaY > 0) {
            zoomLevel = Math.max(0.5, Math.round((zoomLevel - 0.1) * 10) / 10);
          }
          updateZoom();
        }
      }

      function handleKeydown(e) {
        if (e.ctrlKey) {
          if (e.key === '=' || e.key === '+') {
            e.preventDefault();
            zoomLevel = Math.min(2.5, Math.round((zoomLevel + 0.1) * 10) / 10);
            updateZoom();
          } else if (e.key === '-') {
            e.preventDefault();
            zoomLevel = Math.max(0.5, Math.round((zoomLevel - 0.1) * 10) / 10);
            updateZoom();
          } else if (e.key === '0') {
            e.preventDefault();
            zoomLevel = 1.0;
            updateZoom();
          }
        }
      }

      function renderMarkdown(rawMd, filePath) {
        try {
          var html = renderMarkdownToHtml(rawMd);

          var cleanHtml = sanitizeHtml(html);
          el.innerHTML = '<div class="markdown-body">' + cleanHtml + '</div>';

          attachCodeCopyButtons(el);
          resolveImages(el, getDirName(filePath));
          attachLinkHandlers(el, getDirName(filePath));

          if (currentScrollTop > 0) {
            el.scrollTop = currentScrollTop;
          }
        } catch (err) {
          renderError('RENDER_ERROR', 'Markdown rendering failed: ' + err.message);
        }
      }

      async function loadAndRender() {
        if (destroyed || !el) return;
        var filePath = tab && tab.resource && tab.resource.path;
        if (!filePath) {
          renderError('NOT_FOUND', 'No file path was given.');
          return;
        }

        var bridge = getBridge();
        if (!bridge || !bridge.call_domain) {
          renderError('READ_FAILED', 'Host bridge is unavailable.');
          return;
        }

        var res = await bridge.call_domain('read_document', filePath);
        if (destroyed || !el) return;

        if (!res || !res.ok) {
          var err = (res && res.error) || {};
          renderError(err.code || 'READ_FAILED', err.message);
          return;
        }

        loadedContent = res.value.content;
        renderMarkdown(loadedContent, filePath);
      }

      return {
        mount: function (mountTarget) {
          if (destroyed) return;
          var target = mountTarget || container;
          if (!target || !target.ownerDocument) return;

          el = target.ownerDocument.createElement('div');
          el.className = 'markdown-view-container';
          el.tabIndex = 0;

          updateZoom();

          el.addEventListener('wheel', handleWheel, { passive: false });
          el.addEventListener('keydown', handleKeydown);
          el.addEventListener('scroll', function () {
            if (el) currentScrollTop = el.scrollTop;
          });

          target.appendChild(el);
          loadAndRender();
        },

        activate: function () {
          if (el) {
            el.classList.add('active');
            if (currentScrollTop > 0) {
              el.scrollTop = currentScrollTop;
            }
          }
        },

        deactivate: function () {
          if (el) {
            currentScrollTop = el.scrollTop;
            el.classList.remove('active');
          }
        },

        resize: function () {
        },

        destroy: function () {
          destroyed = true;
          if (el) {
            el.removeEventListener('wheel', handleWheel);
            el.removeEventListener('keydown', handleKeydown);
            if (el.parentNode) {
              el.parentNode.removeChild(el);
            }
          }
          el = null;
        },

        getState: function () {
          return {
            zoomLevel: zoomLevel,
            scrollTop: currentScrollTop,
            contentLoaded: Boolean(loadedContent)
          };
        },

        // 껍데기가 보관·복원하는 세션 상태 (shell/view_lifecycle.js의 saveState/restoreState)
        saveState: function () {
          return { zoomLevel: zoomLevel, scrollTop: currentScrollTop };
        },

        restoreState: function (state) {
          if (!state || typeof state !== 'object') return;
          if (typeof state.zoomLevel === 'number') {
            zoomLevel = Math.min(2.5, Math.max(0.5, state.zoomLevel));
            updateZoom();
          }
          if (typeof state.scrollTop === 'number') {
            currentScrollTop = state.scrollTop;
          }
        }
      };
    }
  };

  // 2. 텍스트/코드 뷰어 (FR-5, FR-6, FR-7)
  var codeView = {
    kind: 'code',

    createView: function (container, tab) {
      var el = null;
      var destroyed = false;
      var currentScrollTop = 0;
      var zoomLevel = 1.0;
      var loadedContent = null;
      var scrollEl = null; // 실제로 스크롤되는 요소(.code-viewer-content)

      function renderError(code, message) {
        if (!el) return;
        el.innerHTML = '';
        var errBox = el.ownerDocument.createElement('div');
        errBox.className = 'view-error-container';

        var errCode = el.ownerDocument.createElement('div');
        errCode.className = 'view-error-code';
        errCode.textContent = code || 'READ_FAILED';
        errBox.appendChild(errCode);

        var errMsg = el.ownerDocument.createElement('div');
        errMsg.className = 'view-error-message';
        errMsg.textContent = message || 'Could not load the file.';
        errBox.appendChild(errMsg);

        el.appendChild(errBox);
      }

      function updateZoom() {
        if (!el) return;
        el.style.setProperty('--reading-zoom', zoomLevel.toString());
      }

      function handleWheel(e) {
        if (e.ctrlKey) {
          e.preventDefault();
          if (e.deltaY < 0) {
            zoomLevel = Math.min(2.5, Math.round((zoomLevel + 0.1) * 10) / 10);
          } else if (e.deltaY > 0) {
            zoomLevel = Math.max(0.5, Math.round((zoomLevel - 0.1) * 10) / 10);
          }
          updateZoom();
        }
      }

      function handleKeydown(e) {
        if (e.ctrlKey) {
          if (e.key === '=' || e.key === '+') {
            e.preventDefault();
            zoomLevel = Math.min(2.5, Math.round((zoomLevel + 0.1) * 10) / 10);
            updateZoom();
          } else if (e.key === '-') {
            e.preventDefault();
            zoomLevel = Math.max(0.5, Math.round((zoomLevel - 0.1) * 10) / 10);
            updateZoom();
          } else if (e.key === '0') {
            e.preventDefault();
            zoomLevel = 1.0;
            updateZoom();
          }
        }
      }

      function renderCodeView(content, filePath) {
        var lines = content.split(/\r\n|\r|\n/);
        var lineCount = lines.length;
        var ext = getExtension(filePath);
        var langKey = resolvePrismLanguage(ext);

        el.innerHTML = '';

        var viewer = el.ownerDocument.createElement('div');
        viewer.className = 'code-viewer-container';

        // 툴바 (파일명, 줄수, 복사 버튼)
        var toolbar = el.ownerDocument.createElement('div');
        toolbar.className = 'code-viewer-toolbar';

        var infoSpan = el.ownerDocument.createElement('span');
        var langLabel = langKey ? ' [' + langKey + ']' : '';
        infoSpan.textContent = getBaseName(filePath) + ' (' + lineCount + ' lines)' + langLabel;
        toolbar.appendChild(infoSpan);

        var copyBtn = el.ownerDocument.createElement('button');
        copyBtn.type = 'button';
        copyBtn.className = 'code-copy-btn';
        copyBtn.style.position = 'static';
        copyBtn.textContent = 'Copy';
        copyBtn.addEventListener('click', function () {
          copyToClipboard(content, copyBtn);
        });
        toolbar.appendChild(copyBtn);

        viewer.appendChild(toolbar);

        // 본문 영역 (줄 번호 거터 + 코드 라인)
        var contentDiv = el.ownerDocument.createElement('div');
        contentDiv.className = 'code-viewer-content';

        var gutters = el.ownerDocument.createElement('div');
        gutters.className = 'code-viewer-gutters';
        var gutterText = '';
        for (var i = 1; i <= lineCount; i++) {
          gutterText += i + '\n';
        }
        gutters.textContent = gutterText;
        contentDiv.appendChild(gutters);

        var linesPre = el.ownerDocument.createElement('pre');
        linesPre.className = 'code-viewer-lines';
        // 문법 강조 적용 (FR-5)
        var highlightedHtml = highlightCode(content, langKey);
        linesPre.innerHTML = highlightedHtml;
        contentDiv.appendChild(linesPre);

        viewer.appendChild(contentDiv);
        el.appendChild(viewer);

        scrollEl = contentDiv;
        if (currentScrollTop > 0) {
          contentDiv.scrollTop = currentScrollTop;
        }

        contentDiv.addEventListener('scroll', function () {
          currentScrollTop = contentDiv.scrollTop;
        });
      }

      async function loadAndRender() {
        if (destroyed || !el) return;
        var filePath = tab && tab.resource && tab.resource.path;
        if (!filePath) {
          renderError('NOT_FOUND', 'No file path was given.');
          return;
        }

        var bridge = getBridge();
        if (!bridge || !bridge.call_domain) {
          renderError('READ_FAILED', 'Host bridge is unavailable.');
          return;
        }

        var res = await bridge.call_domain('read_document', filePath);
        if (destroyed || !el) return;

        if (!res || !res.ok) {
          var err = (res && res.error) || {};
          renderError(err.code || 'READ_FAILED', err.message);
          return;
        }

        loadedContent = res.value.content;
        renderCodeView(loadedContent, filePath);
      }

      return {
        mount: function (mountTarget) {
          if (destroyed) return;
          var target = mountTarget || container;
          if (!target || !target.ownerDocument) return;

          el = target.ownerDocument.createElement('div');
          el.className = 'code-view-container';
          el.tabIndex = 0;

          updateZoom();

          el.addEventListener('wheel', handleWheel, { passive: false });
          el.addEventListener('keydown', handleKeydown);

          target.appendChild(el);
          loadAndRender();
        },

        activate: function () {
          if (!el) return;
          el.classList.add('active');
          // 껍데기가 display:none으로 감추면 스크롤 위치가 초기화된다. 직접 되돌린다 (FR-11).
          if (scrollEl && currentScrollTop > 0) {
            scrollEl.scrollTop = currentScrollTop;
          }
        },

        deactivate: function () {
          if (!el) return;
          if (scrollEl) currentScrollTop = scrollEl.scrollTop;
          el.classList.remove('active');
        },

        resize: function () {
        },

        destroy: function () {
          destroyed = true;
          if (el) {
            el.removeEventListener('wheel', handleWheel);
            el.removeEventListener('keydown', handleKeydown);
            if (el.parentNode) {
              el.parentNode.removeChild(el);
            }
          }
          el = null;
        },

        getState: function () {
          return {
            zoomLevel: zoomLevel,
            scrollTop: currentScrollTop,
            contentLoaded: Boolean(loadedContent)
          };
        },

        saveState: function () {
          return { zoomLevel: zoomLevel, scrollTop: currentScrollTop };
        },

        restoreState: function (state) {
          if (!state || typeof state !== 'object') return;
          if (typeof state.zoomLevel === 'number') {
            zoomLevel = Math.min(2.5, Math.max(0.5, state.zoomLevel));
            updateZoom();
          }
          if (typeof state.scrollTop === 'number') {
            currentScrollTop = state.scrollTop;
          }
        }
      };
    }
  };

  var views = {
    markdown: markdownView,
    code: codeView,
    renderMarkdownToHtml: renderMarkdownToHtml,
    resolvePrismLanguage: resolvePrismLanguage,
    highlightCode: highlightCode,
    sanitizeHtml: sanitizeHtml,
    copyToClipboard: copyToClipboard
  };

  if (typeof module === 'object' && module.exports) {
    module.exports = views;
  } else {
    root.MarkdownPresetViews = views;
  }
})(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this));
