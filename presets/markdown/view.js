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

  function sanitizeHtml(dirtyHtml) {
    var purifier = (typeof window !== 'undefined' && window.DOMPurify) ||
                   (typeof root !== 'undefined' && root.DOMPurify) || null;
    if (purifier && typeof purifier.sanitize === 'function') {
      return purifier.sanitize(dirtyHtml, {
        USE_PROFILES: { html: true },
        FORBID_TAGS: ['script'],
        FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur']
      });
    }
    return dirtyHtml
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/on\w+\s*=\s*"[^"]*"/gi, '')
      .replace(/on\w+\s*=\s*'[^']*'/gi, '')
      .replace(/href\s*=\s*"javascript:[^"]*"/gi, 'href="#"')
      .replace(/href\s*=\s*'javascript:[^']*'/gi, "href='#'");
  }

  function copyToClipboard(text, buttonEl) {
    var nav = (typeof root !== 'undefined' && root.mockNavigator) ||
              (typeof window !== 'undefined' && window.navigator) ||
              (typeof globalThis !== 'undefined' && globalThis.navigator) || null;
    var clip = nav && nav.clipboard;
    if (!clip || typeof clip.writeText !== 'function') {
      if (buttonEl) {
        buttonEl.textContent = '복사 실패';
        buttonEl.classList.add('copy-failed');
        setTimeout(function () {
          buttonEl.textContent = '복사';
          buttonEl.classList.remove('copy-failed');
        }, 1500);
      }
      return Promise.reject(new Error('Clipboard API not available'));
    }

    return clip.writeText(text).then(function () {
      if (buttonEl) {
        buttonEl.textContent = '복사됨';
        buttonEl.classList.add('copied');
        setTimeout(function () {
          buttonEl.textContent = '복사';
          buttonEl.classList.remove('copied');
        }, 1500);
      }
    }).catch(function () {
      if (buttonEl) {
        buttonEl.textContent = '복사 실패';
        buttonEl.classList.add('copy-failed');
        setTimeout(function () {
          buttonEl.textContent = '복사';
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
      btn.textContent = '복사';
      btn.setAttribute('aria-label', '코드 복사');
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
          errSpan.textContent = '[이미지 없음: ' + (img.alt || src) + ' (' + code + ')]';
          img.parentNode.replaceChild(errSpan, img);
        }
      }).catch(function () {
        if (!img.parentNode) return;
        var errSpan = container.ownerDocument.createElement('span');
        errSpan.className = 'markdown-img-error';
        errSpan.textContent = '[이미지 로드 실패: ' + (img.alt || src) + ']';
        img.parentNode.replaceChild(errSpan, img);
      });
    });
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
          console.warn('ROOT_ESCAPE 링크 차단됨:', href);
          return;
        }

        if (typeof window !== 'undefined') {
          var event = new CustomEvent('app:open_path', {
            bubbles: true,
            detail: { path: combined, title: getBaseName(combined) }
          });
          container.dispatchEvent(event);
        }
      });
    });
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
        errMsg.textContent = message || '문서를 불러오지 못했습니다.';
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
          var parser = (typeof window !== 'undefined' && window.marked) ||
                       (typeof root !== 'undefined' && root.marked) || null;
          var html = '';
          if (parser && typeof parser.parse === 'function') {
            // 문법 강조를 포함하는 렌더러 설정
            var customRenderer = {
              code: function (args) {
                var text = args.text || '';
                var lang = args.lang || '';
                var language = resolvePrismLanguage(lang);
                var highlighted = highlightCode(text, language);
                return '<pre><code class="language-' + (language || 'text') + '">' + highlighted + '</code></pre>\n';
              }
            };
            if (parser.use) {
              parser.use({ renderer: customRenderer });
            }
            html = parser.parse(rawMd, { gfm: true, breaks: true });
          } else {
            html = '<pre>' + escapeHtml(rawMd) + '</pre>';
          }

          var cleanHtml = sanitizeHtml(html);
          el.innerHTML = '<div class="markdown-body">' + cleanHtml + '</div>';

          attachCodeCopyButtons(el);
          resolveImages(el, getDirName(filePath));
          attachLinkHandlers(el, getDirName(filePath));

          if (currentScrollTop > 0) {
            el.scrollTop = currentScrollTop;
          }
        } catch (err) {
          renderError('RENDER_ERROR', '마크다운 렌더링 중 오류가 발생했습니다: ' + err.message);
        }
      }

      async function loadAndRender() {
        if (destroyed || !el) return;
        var filePath = tab && tab.resource && tab.resource.path;
        if (!filePath) {
          renderError('NOT_FOUND', '파일 경로가 없습니다.');
          return;
        }

        var bridge = getBridge();
        if (!bridge || !bridge.call_domain) {
          renderError('READ_FAILED', '호스트 브릿지를 사용할 수 없습니다.');
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
        errMsg.textContent = message || '파일을 불러오지 못했습니다.';
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
        infoSpan.textContent = getBaseName(filePath) + ' (' + lineCount + ' 줄)' + langLabel;
        toolbar.appendChild(infoSpan);

        var copyBtn = el.ownerDocument.createElement('button');
        copyBtn.type = 'button';
        copyBtn.className = 'code-copy-btn';
        copyBtn.style.position = 'static';
        copyBtn.textContent = '복사';
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
          renderError('NOT_FOUND', '파일 경로가 없습니다.');
          return;
        }

        var bridge = getBridge();
        if (!bridge || !bridge.call_domain) {
          renderError('READ_FAILED', '호스트 브릿지를 사용할 수 없습니다.');
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
          if (el) el.classList.add('active');
        },

        deactivate: function () {
          if (el) el.classList.remove('active');
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
        }
      };
    }
  };

  var views = {
    markdown: markdownView,
    code: codeView,
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
