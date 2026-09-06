// shell/tree.js — 트리 탐색기 모델 및 렌더러 (Phase 6)
(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.TreeExplorer = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function escapeHtml(str) {
    if (typeof str !== 'string') return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function getBaseName(path) {
    if (!path) return '';
    const parts = path.split(/[\\/]/).filter(Boolean);
    return parts.length ? parts[parts.length - 1] : path;
  }

  function getParentPath(path) {
    if (!path) return '';
    const isBackslash = path.includes('\\');
    const norm = path.replace(/\\/g, '/');
    const idx = norm.lastIndexOf('/');
    if (idx < 0) return '';
    const parent = norm.slice(0, idx);
    return isBackslash ? parent.replace(/\//g, '\\') : parent;
  }

  // 행마다 무슨 아이콘을 어떻게 그릴지는 디자인 파일의 해석기가 정한다 (FR-30).
  // 껍데기는 이름과 펼침 여부만 넘기고 돌려받은 서술값대로 그린다.
  function resolveIconTag(row, isExpanded, iconTheme) {
    const registry = (typeof globalThis !== 'undefined' && globalThis.IconTheme) || null;
    const entry = { name: row.name, is_dir: Boolean(row.is_dir), expanded: Boolean(isExpanded) };
    const descriptor = registry
      ? registry.resolve(iconTheme || 'simple', entry)
      : { render: 'symbol', href: '../shared/design/icons.svg#icon-' + (entry.is_dir ? (entry.expanded ? 'fol' + 'der-open' : 'fol' + 'der') : 'fi' + 'le') };

    if (descriptor.render === 'glyph') {
      const style = descriptor.color ? ` style="color:${escapeHtml(descriptor.color)}"` : '';
      return `<span class="tree-icon glyph-icon ${escapeHtml(descriptor.font)}-icon"${style} aria-hidden="true">${escapeHtml(descriptor.char)}</span>`;
    }
    if (descriptor.render === 'image') {
      return `<img class="tree-icon" src="${escapeHtml(descriptor.src)}" alt="" aria-hidden="true">`;
    }
    return `<svg class="tree-icon" aria-hidden="true"><use href="${escapeHtml(descriptor.href)}"/></svg>`;
  }

  class TreeModel {
    constructor(options = {}) {
      this.bridge = options.bridge || null;
      this.slots = options.slots || null;
      this.tabManager = options.tabManager || null;
      this.onStatusChange = options.onStatusChange || null;
      this.onRender = options.onRender || null;

      this.rootPath = '';
      this.children = new Map(); // path -> Array<entry>
      this.expanded = new Set(['']); // 루트('')는 기본 펼침 상태
      this.cursorPath = ''; // 트리 커서 경로
      this.isFocused = false;
      this.isLoading = new Set(); // 로딩 진행 중인 path 목록

      // 지연 로딩 검증용 호출 통계 (FR-17)
      this.readRequestCount = 0;
      this.readHistory = [];
    }

    setBridge(bridge) {
      this.bridge = bridge;
    }

    setSlots(slots) {
      this.slots = slots;
    }

    setTabManager(tabManager) {
      this.tabManager = tabManager;
    }

    async setRoot(path) {
      this.rootPath = path;
      this.children.clear();
      this.expanded = new Set(['']);
      this.cursorPath = '';
      if (this.bridge && typeof this.bridge.set_root === 'function') {
        await this.bridge.set_root(path);
      }
      // 직하 1단계만 로드 (NFR-4, FR-17)
      await this.loadChildren('', true);
      this.notifyRender();
    }

    async loadChildren(path, force = false) {
      // 이미 읽은 폴더는 다시 읽지 않고 기억 사용 (FR-17)
      if (!force && this.children.has(path)) {
        return this.children.get(path);
      }

      this.isLoading.add(path);
      this.readRequestCount += 1;
      this.readHistory.push({ path, timestamp: Date.now() });
      this.notifyRender();

      try {
        let items = [];
        if (this.bridge && typeof this.bridge.list_children === 'function') {
          const res = await this.bridge.list_children(path);
          if (res && res.ok && Array.isArray(res.value)) {
            items = res.value;
          }
        }

        // 트리 항목 슬롯 필터링 적용 (FR-5, TE-023)
        if (this.slots && typeof this.slots.filterTreeItems === 'function') {
          items = this.slots.filterTreeItems(items);
        }

        this.children.set(path, items);
        return items;
      } finally {
        this.isLoading.delete(path);
        this.notifyRender();
      }
    }

    async refresh() {
      // 새로 읽기: 기억(캐시)을 버리고 다시 읽되, 펼침 상태는 유지 (FR-17, TE-031)
      const currentExpanded = Array.from(this.expanded);
      this.children.clear();

      // 상위 경로(깊이 순)부터 순차 리로드
      currentExpanded.sort((a, b) => {
        const depthA = a ? a.split(/[\\/]/).length : 0;
        const depthB = b ? b.split(/[\\/]/).length : 0;
        return depthA - depthB;
      });

      for (const p of currentExpanded) {
        await this.loadChildren(p, true);
      }
      this.notifyRender();
    }

    collapseAll() {
      // 모두 접기: 루트('')만 남기고 모든 하위 펼침 해제 (FR-14, TE-029)
      this.expanded = new Set(['']);
      this.notifyRender();
    }

    async toggleExpand(path) {
      if (this.expanded.has(path)) {
        this.expanded.delete(path);
      } else {
        await this.loadChildren(path);
        this.expanded.add(path);
      }
      this.notifyRender();
    }

    getVisibleRows() {
      if (!this.rootPath && !this.children.has('')) return [];

      const rows = [];
      const rootName = getBaseName(this.rootPath) || 'ROOT';
      // 루트 행
      rows.push({
        path: '',
        name: rootName,
        is_dir: true,
        depth: 0,
        isRoot: true,
        isExpanded: this.expanded.has(''),
        isLoading: this.isLoading.has('')
      });

      const appendChildren = (parentPath, depth) => {
        if (!this.expanded.has(parentPath)) return;
        const items = this.children.get(parentPath) || [];
        for (const item of items) {
          const isExpanded = this.expanded.has(item.path);
          const isLoading = this.isLoading.has(item.path);
          rows.push({
            ...item,
            depth,
            isExpanded,
            isLoading
          });
          if (item.is_dir && isExpanded) {
            appendChildren(item.path, depth + 1);
          }
        }
      };

      appendChildren('', 1);
      return rows;
    }

    setCursor(path) {
      this.cursorPath = path;
      this.notifyRender();
    }

    // 트리 탐색 키 여섯 가지 (FR-18, TE-032)
    async handleKeyDown(event) {
      const rows = this.getVisibleRows();
      if (!rows.length) return;

      const currentIndex = rows.findIndex(r => r.path === this.cursorPath);
      const currentRow = currentIndex >= 0 ? rows[currentIndex] : rows[0];

      switch (event.key) {
        case 'ArrowDown': {
          event.preventDefault();
          const nextIndex = Math.min(rows.length - 1, (currentIndex < 0 ? 0 : currentIndex + 1));
          this.cursorPath = rows[nextIndex].path;
          this.notifyRender();
          break;
        }
        case 'ArrowUp': {
          event.preventDefault();
          const prevIndex = Math.max(0, (currentIndex < 0 ? 0 : currentIndex - 1));
          this.cursorPath = rows[prevIndex].path;
          this.notifyRender();
          break;
        }
        case 'ArrowRight': {
          event.preventDefault();
          if (currentRow && currentRow.is_dir) {
            if (!this.expanded.has(currentRow.path)) {
              await this.loadChildren(currentRow.path);
              this.expanded.add(currentRow.path);
              this.notifyRender();
            } else {
              // 이미 펼쳐져 있으면 첫 자식으로 이동
              const nextIndex = currentIndex + 1;
              if (nextIndex < rows.length && rows[nextIndex].depth > currentRow.depth) {
                this.cursorPath = rows[nextIndex].path;
                this.notifyRender();
              }
            }
          }
          break;
        }
        case 'ArrowLeft': {
          event.preventDefault();
          if (currentRow) {
            if (currentRow.is_dir && this.expanded.has(currentRow.path)) {
              // 1) 펼쳐진 디렉토리면 먼저 접기
              this.expanded.delete(currentRow.path);
              this.notifyRender();
            } else if (currentRow.depth > 0) {
              // 2) 접혔거나 단말(자식 없는 폴더/파일)이면 직속 부모 폴더로 단계별 이동
              let foundParent = false;
              for (let i = currentIndex - 1; i >= 0; i--) {
                if (rows[i].depth === currentRow.depth - 1) {
                  this.cursorPath = rows[i].path;
                  this.notifyRender();
                  foundParent = true;
                  break;
                }
              }
              if (!foundParent) {
                const parent = getParentPath(currentRow.path);
                this.cursorPath = parent;
                this.notifyRender();
              }
            }
          }
          break;
        }
        case 'Enter': {
          event.preventDefault();
          if (currentRow) {
            // 펼치고 접는 것은 트리 탐색이고, 탭을 여는 것은 행 선택 매핑 자리의 몫이다.
            // 둘은 분리되어 있어 같은 행에서 함께 일어날 수 있다 (FR-6, FR-18)
            if (currentRow.is_dir) {
              await this.toggleExpand(currentRow.path);
            }

            // FR-23: 첫 번째 Enter는 미리보기 열기(이탤릭), 미리보기 탭에서 Enter를 반복해 누르면 고정 승격
            const activeTab = this.tabManager ? this.tabManager.getActiveTab() : null;
            const isCurrentPreview = activeTab && activeTab.preview && !activeTab.pinned &&
              (activeTab.resource?.path === currentRow.path || activeTab.title === currentRow.name);

            if (isCurrentPreview) {
              this.openRowTab(currentRow, false); // 두 번째 Enter: 고정(Pinned) 승격
            } else {
              this.openRowTab(currentRow, true); // 첫 번째 Enter: 미리보기 열기 (이탤릭 표시)
            }
          }
          break;
        }
        case 'Home': {
          event.preventDefault();
          if (rows.length > 0) {
            this.cursorPath = rows[0].path;
            this.notifyRender();
          }
          break;
        }
        case 'End': {
          event.preventDefault();
          if (rows.length > 0) {
            this.cursorPath = rows[rows.length - 1].path;
            this.notifyRender();
          }
          break;
        }
      }
    }

    openRowTab(row, isPreview = true) {
      if (!row) return;
      if (!this.tabManager) return;

      // 무엇을 열지는 행 선택 매핑 자리가 정한다. 껍데기는 행의 종류를 보지 않는다 (FR-4, FR-6)
      let mapped = null;
      if (this.slots && typeof this.slots.mapRowSelection === 'function') {
        mapped = this.slots.mapRowSelection(row);
      } else {
        mapped = row.is_dir ? null : { kind: 'default', resource: { path: row.path }, title: row.name };
      }

      if (!mapped) return; // 열지 않음 (null)

      return this.tabManager.openTab({
        kind: mapped.kind,
        resource: mapped.resource,
        preview: isPreview,
        pinned: !isPreview,
        title: mapped.title || row.name
      });
    }

    notifyRender() {
      if (typeof this.onRender === 'function') {
        this.onRender();
      }
    }
  }

  // 트리 HTML 렌더러 (FR-16, TE-030)
  function renderTreeHtml(treeModel, iconTheme) {
    const rows = treeModel.getVisibleRows();
    if (!rows.length) {
      return '<div class="tree-empty">루트 폴더를 열어주세요.</div>';
    }

    return rows.map(row => {
      const isExpanded = row.isExpanded;
      const isSelected = row.path === treeModel.cursorPath;
      const isDir = Boolean(row.is_dir);
      const isRoot = Boolean(row.isRoot);
      const depth = row.depth || 0;

      // 종류 무지 클래스: directory / leaf
      const typeClass = isDir ? 'directory' : 'leaf';
      const selClass = isSelected ? ' selected' : '';
      const expClass = isExpanded ? ' expanded' : '';
      const rootClass = isRoot ? ' is-root' : '';

      const iconTag = resolveIconTag(row, isExpanded, iconTheme);

      return `
        <div class="tree-row ${typeClass}${selClass}${expClass}${rootClass}"
             data-path="${escapeHtml(row.path)}"
             data-dir="${isDir}"
             data-depth="${depth}"
             style="--depth: ${depth};"
             role="treeitem"
             aria-selected="${isSelected}"
             tabindex="-1">
          <span class="twistie" aria-hidden="true"></span>
          ${iconTag}
          <span class="tree-label">${escapeHtml(row.name)}</span>
        </div>
      `;
    }).join('');
  }

  return {
    TreeModel,
    renderTreeHtml,
    escapeHtml,
    getBaseName,
    getParentPath
  };
}));
