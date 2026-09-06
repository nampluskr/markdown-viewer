// shell/slot_registry.js — 갈아끼우는 자리 다섯 (Phase 5)
// 껍데기와 앱의 경계를 5개 자리로 분리하여 껍데기 수정 없이 새 종류를 수용한다 (FR-5 ~ FR-10).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.SlotRegistry = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  class SlotRegistry {
    constructor() {
      // 1. 트리 항목 자리 (FR-5): 트리에 무엇을 표시할지 고른다.
      // 기본값: 아무것도 갈아끼우지 않으면 받은 것을 그대로 표시한다.
      this._treeItemFilter = (entries) => (Array.isArray(entries) ? entries.slice() : []);

      // 2. 행 선택 매핑 자리 (FR-6): 행을 골랐을 때 어떤 종류의 탭을 열지 정한다.
      // 기본값: 일반 항목 선택 시 기본 열기 대상 반환 (열지 않음을 돌려줄 수 있음).
      this._rowSelectionMapper = (entry) => {
        if (!entry || entry.is_dir) return null;
        return {
          kind: 'default',
          resource: { path: entry.path },
          title: entry.name
        };
      };

      // 3. 보기 제공자 자리 (FR-7): 탭 안을 그린다.
      this._viewProviders = new Map();

      // 4. 중복 정책 자리 (FR-8): 같은 대상을 다시 열 때 기존 탭을 쓸지 정한다.
      this._duplicatePolicies = new Map();

      // 5. 여는 경로 자리 (FR-9): 트리를 거치지 않고 탭을 여는 수단을 더한다.
      this._openRoutes = new Map();

      // 등록되지 않은 종류 알림 콜백 (FR-7, FR-35)
      this._unregisteredKindListeners = new Set();
    }

    // --- 1. 트리 항목 자리 (FR-5) ---
    setTreeItemFilter(filterFn) {
      if (typeof filterFn === 'function') {
        this._treeItemFilter = filterFn;
      }
    }

    filterTreeItems(entries, context) {
      return this._treeItemFilter(entries, context);
    }

    // --- 2. 행 선택 매핑 자리 (FR-6) ---
    setRowSelectionMapper(mapperFn) {
      if (typeof mapperFn === 'function') {
        this._rowSelectionMapper = mapperFn;
      }
    }

    mapRowSelection(entry, context) {
      return this._rowSelectionMapper(entry, context);
    }

    // --- 3. 보기 제공자 자리 (FR-7) ---
    registerViewProvider(kind, provider) {
      if (!kind || typeof kind !== 'string') {
        throw new Error('Kind must be a non-empty string');
      }
      this._viewProviders.set(kind, provider);
    }

    getViewProvider(kind) {
      return this._viewProviders.get(kind) || null;
    }

    unregisterViewProvider(kind) {
      return this._viewProviders.delete(kind);
    }

    onUnregisteredKind(listener) {
      if (typeof listener === 'function') {
        this._unregisteredKindListeners.add(listener);
        return () => this._unregisteredKindListeners.delete(listener);
      }
      return () => {};
    }

    notifyUnregisteredKind(kind, tab) {
      for (const listener of this._unregisteredKindListeners) {
        try {
          listener(kind, tab);
        } catch (e) {
          console.error('Error in unregistered kind listener', e);
        }
      }
    }

    // --- 4. 중복 정책 자리 (FR-8) ---
    registerDuplicatePolicy(kind, policy) {
      if (!kind || typeof kind !== 'string') {
        throw new Error('Kind must be a non-empty string');
      }
      this._duplicatePolicies.set(kind, policy);
    }

    getDuplicatePolicy(kind) {
      return this._duplicatePolicies.get(kind) || null;
    }

    unregisterDuplicatePolicy(kind) {
      return this._duplicatePolicies.delete(kind);
    }

    // --- 5. 여는 경로 자리 (FR-9) ---
    registerOpenRoute(routeId, handler) {
      if (!routeId || typeof routeId !== 'string') {
        throw new Error('Route ID must be a non-empty string');
      }
      this._openRoutes.set(routeId, handler);
    }

    executeOpenRoute(routeId, tabManager, options = {}) {
      const handler = this._openRoutes.get(routeId);
      if (typeof handler === 'function') {
        return handler(tabManager, options);
      }
      return null;
    }

    getOpenRoute(routeId) {
      return this._openRoutes.get(routeId) || null;
    }

    unregisterOpenRoute(routeId) {
      return this._openRoutes.delete(routeId);
    }
  }

  // 중복 정책 자리를 탭 모델의 종류 등록표 자리에 물리는 어댑터 (FR-8)
  // 자리에 등록된 정책을 먼저 보고, 없으면 종류 등록표의 값으로 떨어진다.
  // 껍데기가 이 연결을 갖되 판정 자체는 자리가 한다.
  function createSlotBackedRegistry(slots, baseRegistry) {
    if (!baseRegistry) return null;
    return {
      get: (kind) => {
        const base = baseRegistry.get(kind) || {};
        const fromSlot = slots ? slots.getDuplicatePolicy(kind) : null;
        return fromSlot ? { ...base, duplicatePolicy: fromSlot } : base;
      },
      has: (kind) => baseRegistry.has(kind),
      register: (kind, options) => baseRegistry.register(kind, options),
      unregister: (kind) => baseRegistry.unregister(kind),
      clear: () => baseRegistry.clear()
    };
  }

  SlotRegistry.createSlotBackedRegistry = createSlotBackedRegistry;

  return SlotRegistry;
});
