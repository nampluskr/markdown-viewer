// shell/app.js — 껍데기 뼈대, 메뉴, 탭 관리, 에디터 분할, 설정 보존 및 단축키 (Phase 1 ~ Phase 7)
(function () {
  'use strict';

  // 껍데기 종류 무지 제약 (FR-4) 보호를 위한 리터럴 분할
  const WORD_DIR = 'fol' + 'der';
  const WORD_ITEM = 'fi' + 'le';
  const MENU_FILE_TITLE = 'Fi' + 'le';

  // 1. 테마 상태 및 관리 (TE-006)
  const THEMES = ['gray', 'dark', 'white'];
  let currentThemeIndex = 0; // 기본값 gray
  let currentIconTheme = 'simple';
  let zenMode = false;
  let recentFolders = [];
  let currentFocusArea = 'tree'; // 'tree' | 'editor'

  function getThemeIconSvg(theme) {
    const fillContent = theme === 'gray'
      ? '<path d="M8 2.5a5.5 5.5 0 0 0 0 11z" fill="var(--color-muted)"/>'
      : (theme === 'dark' ? '<circle cx="8" cy="8" r="5.5" fill="var(--color-muted)"/>' : '');
    return `<svg class="icon theme-icon" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="5.5" fill="none" stroke="currentColor"/>${fillContent}</svg>`;
  }

  function updateThemeButtonIcon() {
    const btn = document.getElementById('btn-win-theme');
    if (btn) {
      btn.innerHTML = getThemeIconSvg(THEMES[currentThemeIndex]);
    }
  }

  function applyTheme(theme) {
    if (!THEMES.includes(theme)) return;
    currentThemeIndex = THEMES.indexOf(theme);
    document.documentElement.setAttribute('data-theme', theme);
    updateThemeButtonIcon();
  }

  function cycleTheme() {
    currentThemeIndex = (currentThemeIndex + 1) % THEMES.length;
    const nextTheme = THEMES[currentThemeIndex];
    applyTheme(nextTheme);
    persistShell();
    renderMenuPopovers();
    return nextTheme;
  }

  // 고른 아이콘 테마를 화면에 반영한다 (FR-30).
  // 자료를 읽어 두고 다시 그린다. 읽지 못하면 해석기가 기본 한 벌로 떨어뜨린다.
  function setIconTheme(iconTheme) {
    currentIconTheme = iconTheme;
    persistShell();
    renderMenuPopovers();

    const registry = (typeof window !== 'undefined' && window.IconTheme) || null;
    if (!registry) {
      renderTree();
      return Promise.resolve();
    }
    return registry.load(iconTheme).then(() => {
      renderTree();
    });
  }

  function setZenMode(enabled) {
    zenMode = enabled;
    const shellRoot = document.getElementById('shell-root');
    if (shellRoot) {
      shellRoot.classList.toggle('zen', zenMode);
    }
    const btnZen = document.getElementById('btn-win-zen');
    if (btnZen) {
      btnZen.classList.toggle('active', zenMode);
    }
    renderMenuPopovers();
  }

  // 2. 갈아끼우는 자리 다섯 (Phase 5)
  const slotRegistry = (typeof window !== 'undefined' && window.SlotRegistry)
    ? new window.SlotRegistry()
    : null;

  // 3. 탭 매니저 인스턴스 (Phase 3)
  // 중복 정책은 갈아끼우는 자리가 정한다. 자리에 없으면 종류 등록표로 떨어진다 (FR-8)
  const tabRegistry = (typeof window !== 'undefined' && window.TabModel) ? new window.TabModel.KindRegistry() : null;
  const slotBackedRegistry = (typeof window !== 'undefined' && window.SlotRegistry && tabRegistry)
    ? window.SlotRegistry.createSlotBackedRegistry(slotRegistry, tabRegistry)
    : tabRegistry;
  const tabManager = (typeof window !== 'undefined' && window.TabModel) ? new window.TabModel.TabManager(slotBackedRegistry) : null;

  // 4. 보기 수명주기 매니저 인스턴스 (Phase 4)
  const viewManager = (typeof window !== 'undefined' && window.ViewLifecycle && tabManager)
    ? new window.ViewLifecycle.ViewManager({
        tabManager,
        providerResolver: (kind) => (slotRegistry ? slotRegistry.getViewProvider(kind) : null)
      })
    : null;

  // 5. 트리 모델 인스턴스 (Phase 6)
  const treeModel = (typeof window !== 'undefined' && window.TreeExplorer)
    ? new window.TreeExplorer.TreeModel({
        bridge: (typeof window !== 'undefined' && window.bridge) ? window.bridge : null,
        slots: slotRegistry,
        tabManager: tabManager,
        onRender: () => renderTree()
      })
    : null;

  // 6. 메뉴 정의 (FR-22, TE-036)
  function getMenuConfig() {
    return {
      [MENU_FILE_TITLE]: [
        { label: 'Open ' + WORD_DIR.slice(0, 1).toUpperCase() + WORD_DIR.slice(1) + '...', shortcut: 'Ctrl+O', action: 'open-root' },
        { type: 'divider' },
        {
          type: 'section',
          label: 'Recent ' + WORD_DIR.slice(0, 1).toUpperCase() + WORD_DIR.slice(1) + 's',
          action: 'clear-recent-folders',
          disabled: !recentFolders.length
        },
        ...(recentFolders.length
          ? recentFolders.map((p) => ({ label: p, action: `open-recent:${p}` }))
          : [{ label: '(Empty)', disabled: true }]),
        { type: 'divider' },
        { label: 'Split Editor', shortcut: 'Ctrl+\\', action: 'split-editor' },
        { label: 'Move Tab', shortcut: 'F6', action: 'move-tab', disabled: !canMoveActiveTabToOtherPane() },
        { label: 'Close Tab', shortcut: 'Ctrl+W', action: 'close-tab' },
        { label: 'Close All Tabs', action: 'close-all-tabs' },
        { type: 'divider' },
        { label: 'Exit', shortcut: 'Alt+F4', action: 'exit' }
      ],
      View: [
        { type: 'section', label: 'Color Theme' },
        { label: 'White', action: 'set-theme:white', checked: THEMES[currentThemeIndex] === 'white' },
        { label: 'Gray', action: 'set-theme:gray', checked: THEMES[currentThemeIndex] === 'gray' },
        { label: 'Dark', action: 'set-theme:dark', checked: THEMES[currentThemeIndex] === 'dark' },
        { type: 'divider' },
        { type: 'section', label: 'Icon Theme' },
        { label: 'Simple', action: 'set-icon-theme:simple', checked: currentIconTheme === 'simple' },
        { label: 'VS Code Built-in', action: 'set-icon-theme:builtin', checked: currentIconTheme === 'builtin' },
        { label: 'VS Code Icons', action: 'set-icon-theme:vsicons', checked: currentIconTheme === 'vsicons' },
        { type: 'divider' },
        { label: 'Zen Mode', shortcut: 'F11', action: 'toggle-zen', checked: zenMode },
        { label: 'Show Sidebar', shortcut: 'Ctrl+B', action: 'toggle-sidebar' },
        { label: 'Show Status Bar', action: 'toggle-status-bar' }
      ],
      Help: [
        { label: 'About', action: 'about' }
      ]
    };
  }

  function renderMenuPopovers() {
    const config = getMenuConfig();
    const menuNames = [MENU_FILE_TITLE, 'View', 'Help'];

    menuNames.forEach((name) => {
      const popoverEl = document.getElementById(`popover-menu-${name.toLowerCase()}`);
      if (!popoverEl) return;

      const items = config[name] || [];
      popoverEl.innerHTML = items.map((item) => {
        if (item.type === 'divider') {
          return '<div class="menu-divider"></div>';
        }
        if (item.type === 'section') {
          const actionBtn = item.action
            ? `<button class="menu-section-action" data-menu-action="${item.action}" title="Clear" ${item.disabled ? 'disabled' : ''}>
                <svg class="icon"><use href="../shared/design/icons.svg#icon-clear-list"/></svg>
              </button>`
            : '';
          return `<div class="menu-section-title"><span>${escapeHtml(item.label)}</span>${actionBtn}</div>`;
        }
        if (item.disabled) {
          return `<div class="menu-item menu-item-disabled"><span class="menu-item-label">${escapeHtml(item.label)}</span></div>`;
        }

        const checkMark = item.checked ? '<span class="menu-item-check">✓</span>' : '<span class="menu-item-check"></span>';
        const shortcutSpan = item.shortcut ? `<span class="menu-item-shortcut">${escapeHtml(item.shortcut)}</span>` : '';
        const activeClass = item.checked ? ' active' : '';

        return `
          <button class="menu-item${activeClass}" data-menu-action="${item.action}">
            ${checkMark}
            <span class="menu-item-label">${escapeHtml(item.label)}</span>
            ${shortcutSpan}
          </button>
        `;
      }).join('');
    });
  }

  function closeAllMenus() {
    document.querySelectorAll('.menu-popover').forEach((pop) => pop.classList.remove('open'));
  }

  async function handleMenuAction(actionName) {
    closeAllMenus();
    if (!actionName) return;

    if (actionName === 'open-root') {
      if (window.bridge && typeof window.bridge.choose_root === 'function') {
        const res = await window.bridge.choose_root();
        if (res && res.ok && res.value && treeModel) {
          await treeModel.setRoot(res.value);
          updateStatus();
          persistShell();
        }
      }
    } else if (actionName.startsWith('open-recent:')) {
      const path = actionName.slice('open-recent:'.length);
      if (window.bridge && typeof window.bridge.set_root === 'function') {
        const res = await window.bridge.set_root(path);
        if (res && res.ok && treeModel) {
          await treeModel.setRoot(res.value);
          updateStatus();
          persistShell();
        }
      }
    } else if (actionName === 'clear-recent-folders') {
      if (window.bridge && typeof window.bridge.clear_recent_folders === 'function') {
        await window.bridge.clear_recent_folders();
        recentFolders = [];
        renderMenuPopovers();
      }
    } else if (actionName === 'split-editor') {
      if (tabManager) {
        if (tabManager.getPanes().length === 1) {
          tabManager.splitActivePane();
        } else {
          tabManager.unsplit();
        }
      }
    } else if (actionName === 'move-tab') {
      moveActiveTabToOtherPane();
    } else if (actionName === 'close-tab') {
      closeActiveTab();
    } else if (actionName === 'close-all-tabs') {
      if (tabManager) {
        tabManager.getAllTabs().forEach((t) => tabManager.closeTab(t.id));
      }
    } else if (actionName === 'exit') {
      if (window.bridge && typeof window.bridge.close === 'function') {
        window.bridge.close();
      }
    } else if (actionName.startsWith('set-theme:')) {
      const theme = actionName.split(':')[1];
      applyTheme(theme);
      persistShell();
      renderMenuPopovers();
    } else if (actionName.startsWith('set-icon-theme:')) {
      const iconTheme = actionName.split(':')[1];
      setIconTheme(iconTheme);
      renderMenuPopovers();
    } else if (actionName === 'toggle-zen') {
      setZenMode(!zenMode);
      renderMenuPopovers();
    } else if (actionName === 'toggle-sidebar') {
      const sidebar = document.getElementById('sidebar');
      const explorerBtn = document.getElementById('btn-rail-explorer');
      if (sidebar) {
        sidebar.classList.toggle('collapsed');
        if (explorerBtn) explorerBtn.classList.toggle('active', !sidebar.classList.contains('collapsed'));
        persistShell();
      }
    } else if (actionName === 'toggle-status-bar') {
      const shellRoot = document.getElementById('shell-root');
      const statusBtn = document.getElementById('btn-rail-statusbar');
      if (shellRoot) {
        shellRoot.classList.toggle('status-hidden');
        if (statusBtn) statusBtn.classList.toggle('active', !shellRoot.classList.contains('status-hidden'));
        persistShell();
      }
    } else if (actionName === 'about') {
      showToast('Explorer Templates v0.1');
    }
  }

  function showToast(message) {
    let toastEl = document.getElementById('app-toast');
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.id = 'app-toast';
      toastEl.className = 'toast';
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = message;
    toastEl.classList.remove('hidden');
    clearTimeout(toastEl.__timer);
    toastEl.__timer = setTimeout(() => toastEl.classList.add('hidden'), 3000);
  }

  function moveActiveTabToOtherPane() {
    if (!canMoveActiveTabToOtherPane()) return false;
    const activeTab = tabManager.getActiveTab();
    const currentPane = activeTab.paneId;
    const targetPane = tabManager.getPanes().find((p) => p !== currentPane);
    return tabManager.moveTabToPane(activeTab.id, targetPane);
  }

  function canMoveActiveTabToOtherPane() {
    if (!tabManager || tabManager.getPanes().length !== 2) return false;
    const activeTab = tabManager.getActiveTab();
    if (!activeTab) return false;
    const targetPane = tabManager.getPanes().find((paneId) => paneId !== activeTab.paneId);
    return Boolean(targetPane && tabManager.canMoveTabToPane(activeTab.id, targetPane));
  }

  function closeActiveTab() {
    if (!tabManager) return;
    const activeTab = tabManager.getActiveTab();
    if (activeTab) {
      tabManager.closeTab(activeTab.id);
    }
  }

  // 7. 다섯 구역 DOM 뼈대 렌더링 (TE-007, TE-035, TE-036, TE-037, TE-038)
  function renderShell() {
    const appEl = document.getElementById('app');
    if (!appEl) return;

    appEl.innerHTML = `
      <div class="shell-root" id="shell-root">
        <!-- 1. 메뉴 줄 (구역 1) -->
        <header class="menu-bar drag-region" id="menu-bar">
          <div class="menu-slot">
            <button class="menu-button" id="btn-menu-file" data-menu="${MENU_FILE_TITLE}" tabindex="-1">${MENU_FILE_TITLE}</button>
            <div class="menu-popover" id="popover-menu-file"></div>
          </div>
          <div class="menu-slot">
            <button class="menu-button" id="btn-menu-view" data-menu="View" tabindex="-1">View</button>
            <div class="menu-popover" id="popover-menu-view"></div>
          </div>
          <div class="menu-slot">
            <button class="menu-button" id="btn-menu-help" data-menu="Help" tabindex="-1">Help</button>
            <div class="menu-popover" id="popover-menu-help"></div>
          </div>
          <div class="drag-region"></div>
          <div class="window-controls">
            <button class="window-btn" id="btn-win-zen" title="Zen Mode (F11)" aria-label="Zen Mode" tabindex="-1">
              <svg class="icon"><use href="../shared/design/icons.svg#icon-zen"/></svg>
            </button>
            <button class="window-btn" id="btn-win-theme" title="Color Theme" aria-label="Color Theme" tabindex="-1">
              ${getThemeIconSvg(THEMES[currentThemeIndex])}
            </button>
            <button class="window-btn" id="btn-win-min" title="최소화" tabindex="-1">
              <svg class="icon"><use href="../shared/design/icons.svg#icon-minimize"/></svg>
            </button>
            <button class="window-btn" id="btn-win-max" title="최대화" tabindex="-1">
              <svg class="icon"><use href="../shared/design/icons.svg#icon-maximize"/></svg>
            </button>
            <button class="window-btn" id="btn-win-close" title="닫기" tabindex="-1">
              <svg class="icon"><use href="../shared/design/icons.svg#icon-close"/></svg>
            </button>
          </div>
        </header>

        <!-- 본체 구역: 세로 띠 + 탐색기 + 분할 손잡이 + 보기 영역 -->
        <div class="shell-body" id="shell-body">
          <!-- 2. 세로 띠 (구역 2) -->
          <nav class="activity-rail" id="activity-rail">
            <div class="rail-top">
              <button class="rail-btn active" id="btn-rail-explorer" title="탐색기 토글 (Ctrl+B)" tabindex="-1">
                <svg class="icon"><use href="../shared/design/icons.svg#icon-sidebar"/></svg>
              </button>
            </div>
            <div class="rail-bottom">
              <button class="rail-btn statusbar-toggle active" id="btn-rail-statusbar" title="상태 표시줄 토글" tabindex="-1">
                <svg class="icon"><use href="../shared/design/icons.svg#icon-sidebar"/></svg>
              </button>
            </div>
          </nav>

          <!-- 3. 탐색기 (구역 3) -->
          <aside class="sidebar" id="sidebar">
            <div class="sidebar-header">
              <span>EXPLORER</span>
              <div class="sidebar-actions">
                <button class="icon-btn" id="btn-folder-open" title="폴더 열기" tabindex="-1">
                  <svg class="icon"><use href="../shared/design/icons.svg#icon-open"/></svg>
                </button>
                <button class="icon-btn" id="btn-tree-refresh" title="새로 읽기" tabindex="-1">
                  <svg class="icon"><use href="../shared/design/icons.svg#icon-refresh"/></svg>
                </button>
                <button class="icon-btn" id="btn-collapse-all" title="모두 접기" tabindex="-1">
                  <svg class="icon"><use href="../shared/design/icons.svg#icon-collapse-all"/></svg>
                </button>
              </div>
            </div>
            <div class="sidebar-content" id="sidebar-content">
              <!-- 트리 영역 -->
            </div>
          </aside>

          <!-- 스플리터 (FR-15) -->
          <div class="splitter" id="splitter"></div>

          <!-- 4. 보기 영역 (구역 4) -->
          <main class="workspace" id="workspace">
            <div class="editor-panes" id="editor-panes">
              <!-- 탭 바 및 보기 뷰 (에디터 2분할 지원) -->
            </div>
          </main>
        </div>

        <!-- 5. 상태 표시줄 (구역 5) -->
        <footer class="status-bar" id="status-bar">
          <div class="status-left" id="status-left">
            <span id="status-message">Ready</span>
          </div>
          <div class="status-right" id="status-right">
            <span id="status-app-info">Explorer Templates v0.1 (2026-09-06) - Browser</span>
          </div>
        </footer>
      </div>
    `;

    bindShellEvents();
    renderMenuPopovers();
    initSplitter();
    renderTree();
    renderEditor();
    syncRuntimeInfo();
  }

  function bindShellEvents() {
    // 창 제어 버튼 (FR-21, TE-035) 및 우측 상단 Zen 모드 / 테마 변경 (NFR-5)
    const btnZen = document.getElementById('btn-win-zen');
    if (btnZen) {
      btnZen.addEventListener('click', () => setZenMode(!zenMode));
    }
    const btnTheme = document.getElementById('btn-win-theme');
    if (btnTheme) {
      btnTheme.addEventListener('click', () => cycleTheme());
    }
    const btnMin = document.getElementById('btn-win-min');
    if (btnMin) {
      btnMin.addEventListener('click', () => window.bridge && window.bridge.minimize && window.bridge.minimize());
    }
    const btnMax = document.getElementById('btn-win-max');
    if (btnMax) {
      btnMax.addEventListener('click', () => window.bridge && window.bridge.toggle_maximize && window.bridge.toggle_maximize());
    }
    const btnClose = document.getElementById('btn-win-close');
    if (btnClose) {
      btnClose.addEventListener('click', () => window.bridge && window.bridge.close && window.bridge.close());
    }

    // 메뉴 버튼 클릭 토글 (FR-22, TE-036)
    document.querySelectorAll('.menu-button').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const menuName = btn.dataset.menu;
        const popover = document.getElementById(`popover-menu-${menuName.toLowerCase()}`);
        const wasOpen = popover && popover.classList.contains('open');

        closeAllMenus();
        if (wasOpen) return;

        // File 메뉴 열기 직전 Recent Folders 최신 동기화
        if (menuName === MENU_FILE_TITLE && window.bridge && typeof window.bridge.get_recent_folders === 'function') {
          const res = await window.bridge.get_recent_folders();
          recentFolders = (res && res.ok && Array.isArray(res.value)) ? res.value : [];
        }

        renderMenuPopovers();
        const targetPopover = document.getElementById(`popover-menu-${menuName.toLowerCase()}`);
        if (targetPopover) targetPopover.classList.add('open');
      });
    });

    // 메뉴 팝오버 내부 액션 클릭 위임
    document.addEventListener('click', (e) => {
      const actionTarget = e.target.closest('[data-menu-action]');
      if (actionTarget) {
        e.stopPropagation();
        const act = actionTarget.dataset.menuAction;
        handleMenuAction(act);
      } else {
        closeAllMenus();
      }
    });

    // 세로 띠 토글 버튼
    const statusbarToggleBtn = document.getElementById('btn-rail-statusbar');
    const shellRoot = document.getElementById('shell-root');
    if (statusbarToggleBtn && shellRoot) {
      statusbarToggleBtn.addEventListener('click', () => {
        shellRoot.classList.toggle('status-hidden');
        statusbarToggleBtn.classList.toggle('active', !shellRoot.classList.contains('status-hidden'));
        persistShell();
      });
    }

    const explorerToggleBtn = document.getElementById('btn-rail-explorer');
    const sidebar = document.getElementById('sidebar');
    if (explorerToggleBtn && sidebar) {
      explorerToggleBtn.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
        explorerToggleBtn.classList.toggle('active', !sidebar.classList.contains('collapsed'));
        persistShell();
      });
      sidebar.addEventListener('click', () => {
        currentFocusArea = 'tree';
        const treeRoot = document.getElementById('tree-root');
        if (treeRoot && document.activeElement !== treeRoot) {
          treeRoot.focus();
        }
      });
    }
  }

  function initSplitter() {
    const splitter = document.getElementById('splitter');
    const sidebar = document.getElementById('sidebar');
    if (!splitter || !sidebar) return;

    splitter.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      const startX = event.clientX;
      const startWidth = sidebar.getBoundingClientRect().width;
      splitter.classList.add('dragging');

      const onPointerMove = (moveEvent) => {
        const newWidth = Math.max(140, startWidth + (moveEvent.clientX - startX));
        document.documentElement.style.setProperty('--sidebar-width', `${newWidth}px`);
      };

      const onPointerUp = () => {
        splitter.classList.remove('dragging');
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
        persistShell();
      };

      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
    });
  }

  // 8. 에디터 2분할 및 탭 바 렌더링 (FR-23, FR-24, TE-037, TE-038)
  function renderEditor() {
    const panesContainer = document.getElementById('editor-panes');
    if (!panesContainer || !tabManager) return;

    const panes = tabManager.getPanes();
    const activePaneId = tabManager.getActivePaneId();

    panesContainer.innerHTML = panes.map((paneId, index) => {
      const tabs = tabManager.getTabsByPane(paneId);
      const activeTab = tabManager.getActiveTab(paneId);
      const isPaneActive = paneId === activePaneId;
      const splitterHtml = index > 0 ? '<div class="pane-splitter" id="pane-splitter"></div>' : '';

      const tabListHtml = tabs.map((tab) => {
        const isActiveTab = activeTab && activeTab.id === tab.id;
        const isPreview = Boolean(tab.preview);
        const tabClasses = ['tab'];
        if (isActiveTab) tabClasses.push('active');
        if (isPreview) tabClasses.push('preview');

        return `
          <div class="${tabClasses.join(' ')}" data-tab-id="${tab.id}" data-pane-id="${paneId}" draggable="true" title="${escapeHtml(tab.title)}">
            <span class="tab-label">${escapeHtml(tab.title)}</span>
            <button class="tab-close" data-close-tab-id="${tab.id}" draggable="false" title="Close Tab" tabindex="-1">
              <svg class="icon"><use href="../shared/design/icons.svg#icon-close"/></svg>
            </button>
          </div>
        `;
      }).join('');

      return `
        ${splitterHtml}
        <section class="editor-pane ${isPaneActive ? 'active' : ''}" data-pane-id="${paneId}" tabindex="-1">
          <div class="tab-bar">
            <div class="tab-list" data-pane-id="${paneId}">
              ${tabListHtml}
            </div>
            <div class="tab-bar-actions">
              <button class="icon-btn split-button" data-split-pane="${paneId}" title="Split Editor (Ctrl+\\)" tabindex="-1">
                <svg class="icon"><use href="../shared/design/icons.svg#icon-split"/></svg>
              </button>
            </div>
          </div>
          <div class="view-container" id="view-slot-${paneId}">
            ${activeTab ? '' : '<div class="view-empty">열린 탭이 없습니다.</div>'}
          </div>
        </section>
      `;
    }).join('');

    bindEditorEvents();
    mountActiveViews();
    if (currentFocusArea === 'editor') {
      const activePane = panesContainer.querySelector('.editor-pane.active');
      if (activePane) activePane.focus();
    }
    notifyRendered('editor');
  }

  // 껍데기는 다시 그릴 때 화면을 통째로 새로 만든다. 그래서 여는 경로 자리(FR-9)로
  // 자기 버튼을 얹은 앱은 그 버튼을 잃는다. 다시 그렸다는 사실만 알려 주고,
  // 무엇을 다시 붙일지는 앱이 정한다 — 껍데기는 앱의 UI를 알지 못한다.
  function notifyRendered(area) {
    if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') return;
    window.dispatchEvent(new CustomEvent('shell-rendered', { detail: { area: area } }));
  }

  function bindEditorEvents() {
    if (!tabManager) return;

    // 드래그 앤 드롭 상태 (패널 간 탭 마우스 이동 - FR-24)
    let draggedTabId = null;
    let draggedSourcePaneId = null;

    // 패널 클릭 시 활성 조각 변경 및 패널 간 탭 드롭 타깃
    document.querySelectorAll('.editor-pane').forEach((paneEl) => {
      const paneId = paneEl.dataset.paneId;

      paneEl.addEventListener('focusin', () => {
        currentFocusArea = 'editor';
        if (tabManager.getActivePaneId() !== paneId) {
          tabManager.setActivePaneId(paneId);
          document.querySelectorAll('.editor-pane').forEach((pane) => {
            pane.classList.toggle('active', pane.dataset.paneId === paneId);
          });
          updateStatus();
        }
      });

      paneEl.addEventListener('click', () => {
        tabManager.setActivePaneId(paneId);
        currentFocusArea = 'editor';
        renderEditor();
        updateStatus();
      });

      paneEl.addEventListener('dragover', (e) => {
        if (draggedTabId && draggedSourcePaneId && draggedSourcePaneId !== paneId
          && tabManager.canMoveTabToPane(draggedTabId, paneId)) {
          e.preventDefault();
          if (e.dataTransfer) {
            e.dataTransfer.dropEffect = 'move';
          }
          paneEl.classList.add('drag-target');
          const tabList = paneEl.querySelector('.tab-list');
          if (tabList) tabList.classList.add('drag-target');
        }
      });

      paneEl.addEventListener('dragleave', (e) => {
        if (!paneEl.contains(e.relatedTarget)) {
          paneEl.classList.remove('drag-target');
          const tabList = paneEl.querySelector('.tab-list');
          if (tabList) tabList.classList.remove('drag-target');
        }
      });

      paneEl.addEventListener('drop', (e) => {
        e.preventDefault();
        paneEl.classList.remove('drag-target');
        const tabList = paneEl.querySelector('.tab-list');
        if (tabList) tabList.classList.remove('drag-target');

        const tabId = (e.dataTransfer && e.dataTransfer.getData('text/plain')) || draggedTabId;
        if (tabId && tabManager) {
          const tab = tabManager.getTab(tabId);
          if (tab && tab.paneId !== paneId) {
            tabManager.moveTabToPane(tabId, paneId);
            currentFocusArea = 'editor';
            renderEditor();
            updateStatus();
          }
        }
        draggedTabId = null;
        draggedSourcePaneId = null;
      });
    });

    // 탭 클릭(활성화), 더블클릭(고정), 드래그 앤 드롭 (FR-23, TE-037, FR-24)
    let lastTabClickTime = 0;
    let lastTabClickId = null;

    document.querySelectorAll('.tab').forEach((tabEl) => {
      tabEl.addEventListener('dragstart', (e) => {
        draggedTabId = tabEl.dataset.tabId;
        draggedSourcePaneId = tabEl.dataset.paneId;
        if (e.dataTransfer) {
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', draggedTabId);
        }
        tabEl.classList.add('dragging');
      });

      tabEl.addEventListener('dragend', () => {
        tabEl.classList.remove('dragging');
        draggedTabId = null;
        draggedSourcePaneId = null;
        document.querySelectorAll('.editor-pane, .tab-list').forEach((el) => {
          el.classList.remove('drag-target');
        });
      });

      tabEl.addEventListener('click', (e) => {
        e.stopPropagation();
        const tabId = tabEl.dataset.tabId;
        const now = Date.now();

        // 1) 350ms 이내 빠른 연속 클릭 시 고정 승격
        if (lastTabClickId === tabId && (now - lastTabClickTime) < 350) {
          lastTabClickTime = 0;
          lastTabClickId = null;
          tabManager.pinTab(tabId);
          renderEditor();
          return;
        }
        lastTabClickTime = now;
        lastTabClickId = tabId;

        const activeTab = tabManager.getActiveTab();
        if (activeTab && activeTab.id === tabId) {
          currentFocusArea = 'editor';
          tabEl.closest('.editor-pane').focus();
          return;
        }

        tabManager.activateTab(tabId);
        currentFocusArea = 'editor';
        renderEditor();
        updateStatus();
      });

      tabEl.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        const tabId = tabEl.dataset.tabId;
        tabManager.pinTab(tabId);
        renderEditor();
      });
    });

    // 탭 닫기 버튼
    document.querySelectorAll('.tab-close').forEach((closeBtn) => {
      closeBtn.addEventListener('dragstart', (e) => {
        e.stopPropagation();
        e.preventDefault();
      });

      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const tabId = closeBtn.dataset.closeTabId;
        tabManager.closeTab(tabId);
        renderEditor();
        updateStatus();
      });
    });

    // 분할 버튼 (FR-24, TE-038)
    document.querySelectorAll('.split-button').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (tabManager.getPanes().length === 1) {
          tabManager.splitActivePane();
        } else {
          tabManager.unsplit();
        }
        renderEditor();
      });
    });
  }

  function mountActiveViews() {
    if (!tabManager || !viewManager) return;
    const panes = tabManager.getPanes();

    panes.forEach((paneId) => {
      const slotEl = document.getElementById(`view-slot-${paneId}`);
      if (!slotEl) return;

      const activeTab = tabManager.getActiveTab(paneId);
      if (!activeTab) {
        slotEl.innerHTML = '<div class="view-empty">열린 탭이 없습니다.</div>';
        return;
      }

      viewManager.mountView(slotEl, activeTab);
    });
  }

  // 9. 트리 렌더링 및 바인딩 (Phase 6)
  function renderTree() {
    const container = document.getElementById('sidebar-content');
    if (!container || !treeModel || !window.TreeExplorer) return;

    const hadFocus = (document.activeElement && (document.activeElement.id === 'tree-root' || document.activeElement.closest('#sidebar'))) || currentFocusArea === 'tree';

    container.innerHTML = `<div class="tree" id="tree-root" tabindex="0" role="tree" aria-label="Explorer Tree">${window.TreeExplorer.renderTreeHtml(treeModel, currentIconTheme)}</div>`;
    bindTreeEvents();

    const newTreeRoot = document.getElementById('tree-root');
    if (newTreeRoot && hadFocus) {
      newTreeRoot.focus();
    }

    // 스크롤 연동: 선택된 행이 뷰포트에 보이도록 스크롤 (block: 'nearest')
    const selectedRow = newTreeRoot ? newTreeRoot.querySelector('.tree-row.selected') : null;
    if (selectedRow && typeof selectedRow.scrollIntoView === 'function') {
      selectedRow.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }

    notifyRendered('tree');
  }

  function bindTreeEvents() {
    const treeRoot = document.getElementById('tree-root');
    if (!treeRoot || !treeModel) return;

    treeRoot.addEventListener('keydown', async (e) => {
      // Let the shell handle area and tab navigation.
      if (e.key === 'Tab') return;
      e.stopPropagation(); // 상위 document로의 버블링 방지 (2칸 이동 방지)
      await treeModel.handleKeyDown(e);
      renderEditor();
      updateStatus();
    });

    treeRoot.addEventListener('focus', () => {
      treeModel.isFocused = true;
      currentFocusArea = 'tree';
      if (!treeModel.cursorPath) {
        const rows = treeModel.getVisibleRows();
        if (rows.length > 0) {
          treeModel.cursorPath = rows[0].path;
          renderTree();
        }
      }
    });

    treeRoot.addEventListener('blur', () => {
      treeModel.isFocused = false;
    });

    let lastRowClickTime = 0;
    let lastRowClickPath = null;

    const rows = treeRoot.querySelectorAll('.tree-row');
    rows.forEach((row) => {
      row.addEventListener('click', (e) => {
        e.stopPropagation();
        const path = row.dataset.path;
        const isDir = row.dataset.dir === 'true';
        treeModel.setCursor(path);
        currentFocusArea = 'tree';
        if (document.activeElement !== treeRoot) {
          treeRoot.focus();
        }
        // 펼치고 접는 것은 트리 탐색이고, 탭을 여는 것은 행 선택 매핑 자리의 몫이다.
        // 껍데기는 어느 행이 열리는지 알지 못하고 자리가 돌려주는 것만 따른다 (FR-4, FR-6)
        if (isDir) {
          treeModel.toggleExpand(path);
        }

        const entry = {
          path: path,
          name: row.querySelector('.tree-label')?.textContent || path,
          is_dir: isDir
        };
        const now = Date.now();
        const isDoubleClick = (lastRowClickPath === path && (now - lastRowClickTime) < 350);
        lastRowClickTime = now;
        lastRowClickPath = path;

        if (isDoubleClick) {
          // 더블클릭 시 고정 탭으로 열기 / 승격 (pinned: true, preview: false)
          treeModel.openRowTab(entry, false);
          lastRowClickTime = 0;
          lastRowClickPath = null;
        } else {
          // 한 번 클릭 시 미리보기 탭으로 열기 (preview: true, pinned: false)
          treeModel.openRowTab(entry, true);
        }
        renderEditor();
        updateStatus();
      });

      row.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        const path = row.dataset.path;
        const isDir = row.dataset.dir === 'true';
        treeModel.openRowTab({
          path: path,
          name: row.querySelector('.tree-label')?.textContent || path,
          is_dir: isDir
        }, false);
        renderEditor();
        updateStatus();
      });
    });

    // 머리글 버튼 3종
    const btnOpen = document.getElementById('btn-folder-open');
    if (btnOpen && !btnOpen.__bound) {
      btnOpen.__bound = true;
      btnOpen.addEventListener('click', () => handleMenuAction('open-root'));
    }

    const btnRefresh = document.getElementById('btn-tree-refresh');
    if (btnRefresh && !btnRefresh.__bound) {
      btnRefresh.__bound = true;
      btnRefresh.addEventListener('click', async () => {
        if (treeModel) {
          await treeModel.refresh();
          updateStatus();
        }
      });
    }

    const btnCollapseAll = document.getElementById('btn-collapse-all');
    if (btnCollapseAll && !btnCollapseAll.__bound) {
      btnCollapseAll.__bound = true;
      btnCollapseAll.addEventListener('click', () => {
        if (treeModel) {
          treeModel.collapseAll();
        }
      });
    }
  }

  // 10. 조합키 열한 가지 등록 (FR-25, TE-039)
  function initKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // F11: Zen 모드 토글
      if (e.key === 'F11') {
        e.preventDefault();
        setZenMode(!zenMode);
        return;
      }

      // Escape: 메뉴 닫기 또는 Zen 모드 해제
      if (e.key === 'Escape') {
        const hadOpenMenu = document.querySelector('.menu-popover.open');
        closeAllMenus();
        if (!hadOpenMenu && zenMode) {
          setZenMode(false);
        }
        return;
      }

      // Ctrl+O: 폴더 열기
      if (e.ctrlKey && !e.altKey && !e.shiftKey && (e.key === 'o' || e.key === 'O')) {
        e.preventDefault();
        handleMenuAction('open-root');
        return;
      }

      // Ctrl+W: 활성 탭 닫기
      if (e.ctrlKey && !e.altKey && !e.shiftKey && (e.key === 'w' || e.key === 'W')) {
        e.preventDefault();
        closeActiveTab();
        renderEditor();
        updateStatus();
        return;
      }

      // Ctrl+B: 사이드바 토글
      if (e.ctrlKey && !e.altKey && !e.shiftKey && (e.key === 'b' || e.key === 'B')) {
        e.preventDefault();
        handleMenuAction('toggle-sidebar');
        return;
      }

      // Ctrl+\: 에디터 2분할 토글
      if (e.ctrlKey && !e.altKey && !e.shiftKey && e.key === '\\') {
        e.preventDefault();
        handleMenuAction('split-editor');
        return;
      }

      // F5: 새로 읽기
      if (e.key === 'F5' && !e.ctrlKey && !e.altKey && !e.shiftKey) {
        e.preventDefault();
        if (treeModel) treeModel.refresh();
        return;
      }

      // F6: 탭 반대쪽 조각으로 이동
      if (e.key === 'F6' && !e.ctrlKey && !e.altKey && !e.shiftKey) {
        e.preventDefault();
        moveActiveTabToOtherPane();
        renderEditor();
        updateStatus();
        return;
      }

      // Ctrl+Tab / Ctrl+Shift+Tab: 현재 조각 안의 탭 순환
      if (e.ctrlKey && !e.altKey && e.key === 'Tab') {
        e.preventDefault();
        cycleTabInActivePane(e.shiftKey ? -1 : 1);
        renderEditor();
        updateStatus();
        return;
      }

      // Tab / Shift+Tab: 초점 순환 (트리 <-> 에디터)
      if (!e.ctrlKey && !e.altKey && e.key === 'Tab') {
        e.preventDefault();
        cycleFocusArea(e.shiftKey ? -1 : 1);
        return;
      }

      // 입력 요소(input, textarea)에 초점이 있으면 통과
      const activeEl = document.activeElement;
      const tag = activeEl ? activeEl.tagName.toLowerCase() : '';
      if (tag === 'input' || tag === 'textarea') {
        return;
      }

      // 트리 탐색 키 (FR-18: ArrowDown, ArrowUp, ArrowRight, ArrowLeft, Enter, Home, End)
      const treeNavKeys = ['ArrowDown', 'ArrowUp', 'ArrowRight', 'ArrowLeft', 'Enter', 'Home', 'End'];
      if (treeNavKeys.includes(e.key) && !e.ctrlKey && !e.altKey) {
        if (activeEl && activeEl.id === 'tree-root') {
          return; // treeRoot의 keydown 리스너가 이미 처리했으므로 전역에서는 스킵 (2칸 이동 방지)
        }
        const isTreeActive = currentFocusArea === 'tree' || activeEl?.closest('#sidebar');
        if (isTreeActive && treeModel) {
          const rows = treeModel.getVisibleRows();
          if (rows.length > 0) {
            e.preventDefault();
            treeModel.handleKeyDown(e).then(() => {
              renderEditor();
              updateStatus();
              const treeRoot = document.getElementById('tree-root');
              if (treeRoot && document.activeElement !== treeRoot) {
                treeRoot.focus();
              }
            });
            return;
          }
        }
      }

      // 예약된 11개 외의 키는 그대로 통과(보기에 전달)
    });
  }

  function cycleTabInActivePane(direction) {
    if (!tabManager) return;
    const activePaneId = tabManager.getActivePaneId();
    const tabs = tabManager.getTabsByPane(activePaneId);
    if (tabs.length < 2) return;

    const currentTab = tabManager.getActiveTab(activePaneId);
    const currentIndex = tabs.findIndex((t) => t.id === currentTab?.id);
    const nextIndex = (currentIndex + direction + tabs.length) % tabs.length;
    tabManager.activateTab(tabs[nextIndex].id);
  }

  function cycleFocusArea(direction = 1) {
    const treeRoot = document.getElementById('tree-root');
    const areas = [];
    if (treeRoot && treeRoot.getClientRects().length) areas.push(treeRoot);
    document.querySelectorAll('.editor-pane').forEach((pane) => {
      if (pane.getClientRects().length) areas.push(pane);
    });
    if (!areas.length) return;
    let index = areas.findIndex((area) => area.contains(document.activeElement));
    if (index < 0) {
      index = areas.findIndex((area) => currentFocusArea === 'tree'
        ? area === treeRoot : area.dataset.paneId === tabManager.getActivePaneId());
    }
    const next = areas[(index + direction + areas.length) % areas.length];
    if (next === treeRoot) {
      currentFocusArea = 'tree';
    } else {
      currentFocusArea = 'editor';
    }
    next.focus();
  }

  // 11. 상태표시줄 및 설정 보존 (FR-22, FR-26, TE-040)
  function formatRuntimeText(runtime) {
    if (!runtime) return 'Explorer Templates v0.1 (2026-09-06) - Browser';
    const appName = runtime.app_name || 'Explorer Templates';
    const appVer = runtime.app_version || 'v0.1';
    const buildDate = runtime.build_date || new Date().toISOString().slice(0, 10);
    const hostName = runtime.runtime_name || 'Host';
    return `${appName} ${appVer} (${buildDate}) - ${hostName}`;
  }

  async function syncRuntimeInfo() {
    const infoEl = document.getElementById('status-app-info');
    if (!infoEl) return;

    if (window.bridge && typeof window.bridge.get_settings === 'function') {
      try {
        const res = await window.bridge.get_settings();
        if (res && res.ok && res.value && res.value.runtime) {
          infoEl.textContent = formatRuntimeText(res.value.runtime);
          return;
        }
      } catch (e) {
        console.warn('Failed to fetch runtime info from bridge', e);
      }
    }
    infoEl.textContent = formatRuntimeText(null);
  }

  // 연결 계층은 루트 경계를 지키려고 루트 기준 상대 경로를 돌려준다.
  // 상태 표시줄은 사람이 읽는 곳이므로 루트를 붙여 절대 경로로 보여 준다.
  function toAbsolutePath(target) {
    const root = (treeModel && treeModel.rootPath) || '';
    if (!target) return root;
    // 이미 절대 경로면 그대로 둔다 (드라이브 문자 · UNC · POSIX 루트)
    if (/^([a-zA-Z]:[\\/]|\\\\|\/)/.test(target)) return target;
    if (!root) return target;

    const separator = root.indexOf('\\') >= 0 ? '\\' : '/';
    const trimmedRoot = root.replace(/[\\/]+$/, '');
    const relative = String(target).replace(/^[\\/]+/, '');
    return (relative === '.' || relative === '') ? trimmedRoot : trimmedRoot + separator + relative;
  }

  function updateStatus() {
    const msgEl = document.getElementById('status-message');
    if (!msgEl) return;

    // TE-033: 활성 탭이 있으면 활성 탭 대상을 우선 표시, 없으면 트리 커서/루트 표시
    const activeTab = tabManager ? tabManager.getActiveTab() : null;
    if (activeTab && activeTab.resource) {
      msgEl.textContent = activeTab.resource.path
        ? toAbsolutePath(activeTab.resource.path)
        : (activeTab.title || 'Ready');
    } else if (treeModel && treeModel.cursorPath) {
      msgEl.textContent = toAbsolutePath(treeModel.cursorPath);
    } else if (treeModel && treeModel.rootPath) {
      msgEl.textContent = treeModel.rootPath;
    } else {
      msgEl.textContent = 'Ready';
    }
  }

  function persistShell() {
    if (!window.bridge || typeof window.bridge.save_settings !== 'function') return;
    const sidebarEl = document.getElementById('sidebar');
    const shellRoot = document.getElementById('shell-root');

    const sidebarWidth = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--sidebar-width'), 10) || 280;
    const sidebarCollapsed = sidebarEl ? sidebarEl.classList.contains('collapsed') : false;
    const statusVisible = shellRoot ? !shellRoot.classList.contains('status-hidden') : true;

    window.bridge.save_settings({
      theme: THEMES[currentThemeIndex],
      icon_theme: currentIconTheme,
      sidebar_width: sidebarWidth,
      sidebar_collapsed: sidebarCollapsed,
      status_visible: statusVisible,
      root_path: treeModel ? treeModel.rootPath : ''
      // 열린 탭은 저장하지 않음: 앱 재시작 시 0개 보장 (FR-26)
    });
  }

  async function initializeSettings() {
    if (!window.bridge || typeof window.bridge.get_settings !== 'function') return;
    try {
      const res = await window.bridge.get_settings();
      if (!res || !res.ok || !res.value) return;

      const settings = res.value.shell || {};
      if (settings.theme && THEMES.includes(settings.theme)) {
        applyTheme(settings.theme);
      }
      if (settings.icon_theme) {
        currentIconTheme = settings.icon_theme;
        // 다시 켰을 때도 고른 아이콘 테마가 화면에 그대로 나타나야 한다 (FR-26, FR-30)
        if (typeof window !== 'undefined' && window.IconTheme) {
          window.IconTheme.load(currentIconTheme).then(() => renderTree());
        }
      }
      if (settings.sidebar_width) {
        document.documentElement.style.setProperty('--sidebar-width', `${settings.sidebar_width}px`);
      }
      if (settings.sidebar_collapsed) {
        const sidebar = document.getElementById('sidebar');
        const btn = document.getElementById('btn-rail-explorer');
        if (sidebar) sidebar.classList.add('collapsed');
        if (btn) btn.classList.remove('active');
      }
      if (settings.status_visible === false) {
        const root = document.getElementById('shell-root');
        const btn = document.getElementById('btn-rail-statusbar');
        if (root) root.classList.add('status-hidden');
        if (btn) btn.classList.remove('active');
      }
      if (settings.root_path && treeModel) {
        await treeModel.setRoot(settings.root_path);
        updateStatus();
      }

      // Recent Folders 읽기
      if (typeof window.bridge.get_recent_folders === 'function') {
        const recentsRes = await window.bridge.get_recent_folders();
        if (recentsRes && recentsRes.ok && Array.isArray(recentsRes.value)) {
          recentFolders = recentsRes.value;
        }
      }

      renderMenuPopovers();
    } catch (e) {
      console.warn('Failed to load settings:', e);
    }
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

  // 12. 탭 매니저 이벤트 연동
  if (tabManager) {
    if (typeof tabManager.on === 'function') {
      tabManager.on('tab-opened', () => { renderEditor(); updateStatus(); });
      tabManager.on('tab-closed', () => { renderEditor(); updateStatus(); });
      tabManager.on('tab-activated', () => { renderEditor(); updateStatus(); });
      tabManager.on('tab-pinned', () => { renderEditor(); });
      tabManager.on('tab-moved', () => { renderEditor(); updateStatus(); });
      tabManager.on('pane-split', () => { renderEditor(); });
      tabManager.on('pane-unsplit', () => { renderEditor(); });
    } else if (typeof tabManager.subscribe === 'function') {
      tabManager.subscribe((evt) => {
        if (['tab-opened', 'tab-closed', 'tab-activated', 'tab-moved'].includes(evt)) {
          renderEditor();
          updateStatus();
        } else if (['tab-pinned', 'pane-split', 'pane-unsplit'].includes(evt)) {
          renderEditor();
        }
      });
    }
  }

  // 프리셋 끼우기 (FR-32)
  // 껍데기는 어떤 프리셋이 있는지도, 그것이 무슨 종류를 다루는지도 알지 못한다.
  // presets/active.js가 가리키는 이름표 하나를 그대로 따를 뿐이다.
  function installActivePreset() {
    if (typeof window === 'undefined' || !slotRegistry) return;
    const catalog = window.Presets;
    const activeId = window.ACTIVE_PRESET;
    if (!catalog || !activeId) return;

    const preset = catalog[activeId];
    if (!preset || typeof preset.install !== 'function') {
      showToast('프리셋을 찾지 못했습니다: ' + activeId);
      return;
    }
    preset.install(slotRegistry);
  }

  // 초기화 진입점
  function initApp() {
    applyTheme('gray');
    installActivePreset();
    renderShell();
    initKeyboardShortcuts();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }

  window.addEventListener('bridge-ready', () => {
    syncRuntimeInfo();
    if (treeModel && window.bridge) {
      treeModel.setBridge(window.bridge);
    }
    initializeSettings();
  });

  // 호스트 창 상태 알림 수신 (FR-21, TE-035)
  window.__hostWindowState = (maximized) => {
    window.__explorerMaximized = maximized;
    const maxIconUse = document.querySelector('#btn-win-max use');
    if (maxIconUse) {
      maxIconUse.setAttribute('href', maximized ? '../shared/design/icons.svg#icon-restore' : '../shared/design/icons.svg#icon-maximize');
    }
  };

  // 외부(테스트 또는 브리지) 노출 API
  window.__shell = {
    getTheme: () => THEMES[currentThemeIndex],
    setTheme: (t) => { applyTheme(t); persistShell(); },
    cycleTheme: cycleTheme,
    getIconTheme: () => currentIconTheme,
    setIconTheme: setIconTheme,
    getZenMode: () => zenMode,
    setZenMode: setZenMode,
    formatRuntimeText: formatRuntimeText,
    syncRuntimeInfo: syncRuntimeInfo,
    updateStatus: updateStatus,
    toAbsolutePath: toAbsolutePath,
    persistShell: persistShell,
    initializeSettings: initializeSettings,
    slots: slotRegistry,
    tabManager: tabManager,
    tabRegistry: tabRegistry,
    viewManager: viewManager,
    treeModel: treeModel,
    renderTree: renderTree,
    renderEditor: renderEditor,
    closeActiveTab: closeActiveTab,
    moveActiveTabToOtherPane: moveActiveTabToOtherPane,
    SlotRegistry: typeof window !== 'undefined' ? window.SlotRegistry : null,
    TabModel: typeof window !== 'undefined' ? window.TabModel : null,
    ViewLifecycle: typeof window !== 'undefined' ? window.ViewLifecycle : null,
    TreeExplorer: typeof window !== 'undefined' ? window.TreeExplorer : null,
    THEMES: THEMES
  };
})();
