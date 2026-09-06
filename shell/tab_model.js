// shell/tab_model.js — 리소스와 탭 핵심 모델 (Phase 3)
// 껍데기는 리소스 종류를 알지 못하며, 임의의 종류 문자열을 받아 전달·관리한다 (FR-1, FR-4).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.TabModel = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  let nextSeq = 1;

  function generateTabId() {
    return 'tab-' + Date.now().toString(36) + '-' + (nextSeq++);
  }

  function isPlainObject(val) {
    return val !== null && typeof val === 'object' && !Array.isArray(val);
  }

  function deepEqual(a, b) {
    if (a === b) return true;
    if (a == null || b == null) return false;
    if (typeof a !== typeof b) return false;
    if (typeof a !== 'object') return false;

    if (Array.isArray(a) !== Array.isArray(b)) return false;
    if (Array.isArray(a)) {
      if (a.length !== b.length) return false;
      for (let i = 0; i < a.length; i++) {
        if (!deepEqual(a[i], b[i])) return false;
      }
      return true;
    }

    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false;
    for (const key of keysA) {
      if (!Object.prototype.hasOwnProperty.call(b, key)) return false;
      if (!deepEqual(a[key], b[key])) return false;
    }
    return true;
  }

  const DUPLICATE_POLICY = {
    REUSE_EXISTING: 'reuse_existing',
    ALWAYS_NEW: 'always_new'
  };

  class KindRegistry {
    constructor() {
      this._entries = new Map();
    }

    register(kind, options = {}) {
      if (!kind || typeof kind !== 'string') {
        throw new Error('Kind must be a non-empty string');
      }
      this._entries.set(kind, {
        duplicatePolicy: options.duplicatePolicy || DUPLICATE_POLICY.REUSE_EXISTING,
        equalityChecker: options.equalityChecker || null,
        viewProvider: options.viewProvider || null,
        ...options
      });
    }

    get(kind) {
      return this._entries.get(kind);
    }

    has(kind) {
      return this._entries.has(kind);
    }

    unregister(kind) {
      return this._entries.delete(kind);
    }

    clear() {
      this._entries.clear();
    }
  }

  function createTab({
    id = generateTabId(),
    kind,
    title = '',
    resource = {},
    viewState = null,
    paneId = 'main',
    pinned = false,
    preview = false
  }) {
    if (!kind || typeof kind !== 'string') {
      throw new Error('Tab kind must be a non-empty string');
    }
    if (!id || typeof id !== 'string') {
      throw new Error('Tab id must be a non-empty string');
    }

    return {
      id,
      kind,
      title: String(title),
      resource: isPlainObject(resource) ? { ...resource } : resource,
      viewState: viewState,
      paneId: String(paneId),
      pinned: Boolean(pinned),
      preview: Boolean(preview)
    };
  }

  class TabManager {
    constructor(registry = new KindRegistry()) {
      this.registry = registry;
      this._tabs = new Map();
      this._panes = ['main'];
      this._activePaneId = 'main';
      this._activeTabIdByPane = new Map([['main', null]]);
      this._listeners = new Set();
    }

    subscribe(listener) {
      this._listeners.add(listener);
      return () => this._listeners.delete(listener);
    }

    on(eventName, listener) {
      return this.subscribe((evt, detail) => {
        if (evt === eventName) {
          listener(detail);
        }
      });
    }

    _emit(eventName, detail) {
      for (const listener of this._listeners) {
        try {
          listener(eventName, detail);
        } catch (e) {
          console.error('Error in TabManager listener', e);
        }
      }
    }

    getPanes() {
      return [...this._panes];
    }

    getActivePaneId() {
      return this._activePaneId;
    }

    setActivePaneId(paneId) {
      if (this._panes.includes(paneId)) {
        this._activePaneId = paneId;
        this._emit('pane-activated', { paneId });
      }
    }

    getTab(tabId) {
      return this._tabs.get(tabId) || null;
    }

    getAllTabs() {
      return Array.from(this._tabs.values());
    }

    getTabsByPane(paneId = this._activePaneId) {
      return this.getAllTabs().filter((tab) => tab.paneId === paneId);
    }

    getActiveTab(paneId = this._activePaneId) {
      const tabId = this._activeTabIdByPane.get(paneId);
      return tabId ? this.getTab(tabId) : null;
    }

    hasEquivalentTabInPane(tabId, paneId) {
      const tab = this._tabs.get(tabId);
      if (!tab || !this._panes.includes(paneId)) return false;
      const registeredConfig = this.registry.get(tab.kind) || {};
      const checker = registeredConfig.equalityChecker;

      return this.getTabsByPane(paneId).some((candidate) => {
        if (candidate.id === tab.id || candidate.kind !== tab.kind) return false;
        if (typeof checker === 'function') {
          return checker(candidate.resource, tab.resource);
        }
        return deepEqual(candidate.resource, tab.resource);
      });
    }

    canMoveTabToPane(tabId, targetPaneId) {
      const tab = this._tabs.get(tabId);
      if (!tab || tab.paneId === targetPaneId) return false;
      return !this.hasEquivalentTabInPane(tabId, targetPaneId);
    }

    openTab({
      kind,
      resource = {},
      title = '',
      paneId = this._activePaneId,
      preview = false,
      pinned = false,
      duplicatePolicy = null
    }) {
      if (!kind || typeof kind !== 'string') {
        throw new Error('Kind must be a non-empty string');
      }

      if (paneId && !this._panes.includes(paneId)) {
        this._panes.push(paneId);
        this._activeTabIdByPane.set(paneId, null);
      }
      const targetPaneId = paneId || this._activePaneId;
      const registeredConfig = this.registry.get(kind) || {};
      const policy = duplicatePolicy || registeredConfig.duplicatePolicy || DUPLICATE_POLICY.REUSE_EXISTING;
      const checker = registeredConfig.equalityChecker;

      // 중복 정책 판정 (FR-2, FR-8)
      let mode = DUPLICATE_POLICY.REUSE_EXISTING;
      let scope = 'pane';

      if (typeof policy === 'object' && policy !== null) {
        mode = policy.mode || DUPLICATE_POLICY.REUSE_EXISTING;
        scope = policy.scope || 'pane';
      } else if (typeof policy === 'string') {
        mode = policy;
      } else if (typeof policy === 'function') {
        mode = policy;
      }

      if (mode === DUPLICATE_POLICY.REUSE_EXISTING || typeof mode === 'function') {
        const candidatePool = (scope === 'panel' || scope === 'workspace' || scope === 'all')
          ? this.getAllTabs()
          : this.getTabsByPane(targetPaneId);

        const existing = candidatePool.find((candidate) => {
          if (candidate.kind !== kind) return false;
          if (typeof mode === 'function') {
            return mode(candidate, { kind, resource, paneId: targetPaneId });
          }
          if (typeof checker === 'function') {
            return checker(candidate.resource, resource);
          }
          return deepEqual(candidate.resource, resource);
        });

        if (existing) {
          if (pinned && existing.preview) {
            existing.pinned = true;
            existing.preview = false;
            this._emit('tab-pinned', { tab: existing });
          }
          this.activateTab(existing.id);
          return { tab: existing, isNew: false };
        }
      }

      // 미리보기 탭 단일 유지 정책 (FR-23): 패널마다 미리보기 탭은 최대 1개이며, 새 미리보기는 기존 미리보기를 대체
      if (preview && !pinned) {
        const existingPreview = this.getTabsByPane(targetPaneId).find((t) => t.preview && !t.pinned);
        if (existingPreview) {
          this.closeTab(existingPreview.id);
        }
      }

      // 새 탭 생성: tab.id는 리소스 주소와 완전히 분리된 고유값 (FR-2)
      const newTabId = generateTabId();
      const tab = createTab({
        id: newTabId,
        kind,
        title,
        resource,
        paneId: targetPaneId,
        pinned,
        preview
      });

      this._tabs.set(tab.id, tab);
      this._activeTabIdByPane.set(targetPaneId, tab.id);
      this._activePaneId = targetPaneId;

      this._emit('tab-opened', { tab, isNew: true });
      return { tab, isNew: true };
    }

    activateTab(tabId) {
      const tab = this._tabs.get(tabId);
      if (!tab) return false;

      this._activePaneId = tab.paneId;
      this._activeTabIdByPane.set(tab.paneId, tab.id);
      this._emit('tab-activated', { tab });
      return true;
    }

    pinTab(tabId) {
      const tab = this._tabs.get(tabId);
      if (!tab) return false;

      tab.pinned = true;
      tab.preview = false;
      this._emit('tab-pinned', { tab });
      return true;
    }

    closeTab(tabId) {
      const tab = this._tabs.get(tabId);
      if (!tab) return null;

      const paneId = tab.paneId;
      const paneTabs = this.getTabsByPane(paneId);
      const tabIndex = paneTabs.findIndex((t) => t.id === tabId);

      this._tabs.delete(tabId);

      let nextActiveTab = null;
      if (this._activeTabIdByPane.get(paneId) === tabId) {
        const remaining = this.getTabsByPane(paneId);
        if (remaining.length > 0) {
          const nextIndex = Math.min(tabIndex, remaining.length - 1);
          nextActiveTab = remaining[nextIndex];
          this._activeTabIdByPane.set(paneId, nextActiveTab.id);
        } else {
          this._activeTabIdByPane.set(paneId, null);
        }
      } else {
        nextActiveTab = this.getActiveTab(paneId);
      }

      // 조각의 탭을 모두 닫으면 가르기가 풀린다 (FR-24)
      if (this._panes.length === 2) {
        const remainingInClosedPane = this.getTabsByPane(paneId);
        if (remainingInClosedPane.length === 0) {
          const otherPaneId = this._panes.find((p) => p !== paneId);
          this._panes = [otherPaneId];
          this._activePaneId = otherPaneId;
        }
      }

      this._emit('tab-closed', { tab, nextActiveTab });
      return { closedTab: tab, nextActiveTab };
    }

    moveTabToPane(tabId, targetPaneId) {
      const tab = this._tabs.get(tabId);
      if (!tab || !this.canMoveTabToPane(tabId, targetPaneId)) return false;

      if (!this._panes.includes(targetPaneId)) {
        this._panes.push(targetPaneId);
        this._activeTabIdByPane.set(targetPaneId, null);
      }

      const sourcePaneId = tab.paneId;
      // Close from source pane context
      const sourceTabs = this.getTabsByPane(sourcePaneId).filter((t) => t.id !== tabId);
      if (this._activeTabIdByPane.get(sourcePaneId) === tabId) {
        const newActive = sourceTabs.length > 0 ? sourceTabs[sourceTabs.length - 1] : null;
        this._activeTabIdByPane.set(sourcePaneId, newActive ? newActive.id : null);
      }

      // Move to target pane
      tab.paneId = targetPaneId;
      this._activeTabIdByPane.set(targetPaneId, tab.id);
      this._activePaneId = targetPaneId;

      // 이동 후 소스 조각이 비게 되면 가르기가 풀린다 (FR-24)
      if (this._panes.length === 2) {
        const remainingInSource = this.getTabsByPane(sourcePaneId);
        if (remainingInSource.length === 0) {
          this._panes = [targetPaneId];
          this._activePaneId = targetPaneId;
        }
      }

      this._emit('tab-moved', { tab, sourcePaneId, targetPaneId });
      return true;
    }

    splitActivePane() {
      // 셋 이상으로 갈리지 않는다 (FR-24)
      if (this._panes.length >= 2) return false;
      const currentActive = this.getActiveTab();
      if (!currentActive) return false;

      const newPaneId = this._panes.includes('pane-1') ? 'pane-2' : 'pane-1';
      this._panes.push(newPaneId);
      this._activeTabIdByPane.set(newPaneId, null);

      this.openTab({
        kind: currentActive.kind,
        title: currentActive.title,
        resource: currentActive.resource,
        paneId: newPaneId,
        preview: currentActive.preview,
        pinned: currentActive.pinned
      });
      this._activePaneId = newPaneId;
      this._emit('pane-split', { newPaneId });
      return true;
    }

    unsplit(keepPaneId = this._panes[0]) {
      if (this._panes.length <= 1) return false;
      const otherPaneId = this._panes.find((p) => p !== keepPaneId);
      if (!otherPaneId) return false;

      const otherTabs = this.getTabsByPane(otherPaneId);
      for (const t of otherTabs) {
        this.closeTab(t.id);
      }
      this._panes = [keepPaneId];
      this._activePaneId = keepPaneId;
      this._emit('pane-unsplit', { keepPaneId });
      return true;
    }

    saveViewState(tabId, state) {
      const tab = this._tabs.get(tabId);
      if (!tab) return false;
      tab.viewState = state;
      return true;
    }

    getViewState(tabId) {
      const tab = this._tabs.get(tabId);
      return tab ? tab.viewState : null;
    }
  }

  // 직렬화 지원 (FR-3)
  function serializeResources(tabs) {
    const list = Array.isArray(tabs) ? tabs : [];
    return JSON.stringify(
      list.map((tab) => ({
        id: tab.id,
        kind: tab.kind,
        title: tab.title,
        resource: tab.resource
      }))
    );
  }

  function deserializeResources(jsonString) {
    const parsed = JSON.parse(jsonString);
    if (!Array.isArray(parsed)) {
      throw new Error('Deserialized data must be an array');
    }
    return parsed.map((item) => ({
      id: item.id,
      kind: item.kind,
      title: item.title,
      resource: item.resource
    }));
  }

  return {
    generateTabId,
    createTab,
    KindRegistry,
    TabManager,
    DUPLICATE_POLICY,
    serializeResources,
    deserializeResources
  };
});
