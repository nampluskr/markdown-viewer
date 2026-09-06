// shell/view_lifecycle.js — 보기의 수명과 상태 관리 (Phase 4)
// 보기는 탭 수명 동안 유지되는 컴포넌트이며, 껍데기는 상태 내부를 해석하지 않는다 (FR-11, FR-12, FR-13).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.ViewLifecycle = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function createDefaultContainer() {
    if (typeof document !== 'undefined' && document.createElement) {
      const el = document.createElement('div');
      el.className = 'view-instance-container';
      el.style.width = '100%';
      el.style.height = '100%';
      el.style.overflow = 'hidden';
      return el;
    }
    // Headless / Node 테스트용 경량 컨테이너
    return {
      children: [],
      style: {},
      className: 'view-instance-container',
      appendChild(child) {
        this.children.push(child);
      },
      removeChild(child) {
        const idx = this.children.indexOf(child);
        if (idx !== -1) this.children.splice(idx, 1);
      },
      remove() {
        if (this.parentNode && this.parentNode.removeChild) {
          this.parentNode.removeChild(this);
        }
      }
    };
  }

  class ViewManager {
    constructor({ tabManager, providerResolver = null } = {}) {
      this.tabManager = tabManager || null;
      this.providerResolver = providerResolver;
      this._instances = new Map(); // tabId -> instanceRecord
      this._viewCreationCounts = new Map(); // kind or tabId -> count

      // TabManager 이벤트 자동 연동
      if (this.tabManager && typeof this.tabManager.subscribe === 'function') {
        this._unsubscribe = this.tabManager.subscribe((event, detail) => {
          this._handleTabEvent(event, detail);
        });
      }
    }

    dispose() {
      if (this._unsubscribe) {
        this._unsubscribe();
        this._unsubscribe = null;
      }
      for (const tabId of Array.from(this._instances.keys())) {
        this.destroyView(tabId);
      }
    }

    _handleTabEvent(event, detail) {
      if (event === 'tab-activated' && detail.tab) {
        this.activateView(detail.tab.id);
      } else if (event === 'tab-closed' && detail.tab) {
        this.destroyView(detail.tab.id);
      } else if (event === 'tab-moved' && detail.tab) {
        // 패널 이동 시 보기는 유지됨
        this._syncViewLocation(detail.tab.id, detail.targetPaneId);
      }
    }

    getCreationCount(tabId) {
      return this._viewCreationCounts.get(tabId) || 0;
    }

    getViewInstance(tabId) {
      const rec = this._instances.get(tabId);
      return rec ? rec.view : null;
    }

    getViewRecord(tabId) {
      return this._instances.get(tabId) || null;
    }

    getOrCreateView(tab, parentElement = null) {
      if (!tab || !tab.id) return null;

      let rec = this._instances.get(tab.id);
      if (rec) {
        // 탭 전환·패널 이동·재렌더링 시 기존 인스턴스 그대로 유지 (FR-12)
        if (parentElement && rec.container.parentNode !== parentElement) {
          parentElement.appendChild(rec.container);
        }
        return rec;
      }

      // 새 보기 인스턴스 생성
      const container = createDefaultContainer();
      if (parentElement) {
        parentElement.appendChild(container);
      }

      const provider = this._resolveProvider(tab.kind);
      let viewInstance;

      if (provider && typeof provider.createView === 'function') {
        viewInstance = provider.createView(container, tab);
      } else if (typeof provider === 'function') {
        try {
          viewInstance = new provider(container, tab);
        } catch {
          viewInstance = provider(container, tab);
        }
      } else {
        // 기본 뷰 스텁 (FR-7, FR-35)
        viewInstance = {
          mount: (el) => {
            if (el && typeof el.appendChild === 'function') {
              el.innerHTML = `
                <div class="view-unregistered" style="padding: 24px; color: var(--text-muted); font-size: var(--font-base);">
                  <div style="font-weight: bold; margin-bottom: 8px; color: var(--text-main); font-size: 14px;">
                    ${tab.title || tab.id}
                  </div>
                  <div>종류: <code>${tab.kind}</code></div>
                  <div style="margin-top: 4px;">경로: <code>${tab.resource && tab.resource.path ? tab.resource.path : '(없음)'}</code></div>
                </div>
              `;
            }
          },
          activate: () => {},
          deactivate: () => {},
          resize: () => {},
          destroy: () => {}
        };
      }

      const currentCount = this._viewCreationCounts.get(tab.id) || 0;
      this._viewCreationCounts.set(tab.id, currentCount + 1);

      rec = {
        tabId: tab.id,
        tab: tab,
        view: viewInstance,
        container: container,
        isActive: false,
        isDestroyed: false,
        isMounted: false
      };
      this._instances.set(tab.id, rec);

      // mount 통보 (FR-11)
      if (typeof viewInstance.mount === 'function') {
        viewInstance.mount(container, {
          tab: tab,
          initialViewState: tab.viewState // 껍데기는 내부를 읽지 않고 전달만 함 (FR-13)
        });
      }
      rec.isMounted = true;

      return rec;
    }

    activateView(tabId, parentElement = null) {
      const tab = (this.tabManager && typeof this.tabManager.getTab === 'function')
        ? (this.tabManager.getTab(tabId) || this._instances.get(tabId)?.tab)
        : (this._instances.get(tabId)?.tab || { id: tabId });
      if (!tab) return null;

      const rec = this.getOrCreateView(tab, parentElement);
      if (!rec || rec.isDestroyed) return null;
      if (rec.isActive) return rec;

      // 같은 패널 내 다른 활성 뷰 비활성화
      for (const other of this._instances.values()) {
        if (other.tabId !== tabId && other.isActive) {
          if (!this.tabManager || other.tab.paneId === tab.paneId) {
            this.deactivateView(other.tabId);
          }
        }
      }

      // 세션 상태 복원 통보 (FR-13)
      if (typeof rec.view.restoreState === 'function') {
        rec.view.restoreState(tab.viewState);
      }

      // 활성화 통보 (FR-11)
      rec.container.style.display = '';
      if (typeof rec.view.activate === 'function') {
        rec.view.activate();
      }
      rec.isActive = true;

      return rec;
    }

    mountView(parentElement, tab) {
      if (!tab) return null;
      const tabObj = typeof tab === 'object' ? tab : (this.tabManager ? this.tabManager.getTab(tab) : { id: tab });
      if (!tabObj || !tabObj.id) return null;
      const rec = this.getOrCreateView(tabObj, parentElement);
      if (!rec || rec.isDestroyed) return null;
      return this.activateView(tabObj.id, parentElement);
    }

    deactivateView(tabId) {
      const rec = this._instances.get(tabId);
      if (!rec || !rec.isActive || rec.isDestroyed) return;

      // 세션 상태 보관 통보 (FR-13)
      // 껍데기는 보기가 반환한 값을 해석하거나 비교하지 않고 보관만 함
      if (typeof rec.view.saveState === 'function') {
        const state = rec.view.saveState();
        if (this.tabManager) {
          this.tabManager.saveViewState(tabId, state);
        } else if (rec.tab) {
          rec.tab.viewState = state;
        }
      }

      // 비활성화 통보 (FR-11)
      if (typeof rec.view.deactivate === 'function') {
        rec.view.deactivate();
      }
      rec.container.style.display = 'none';
      rec.isActive = false;
    }

    resize(dimensions) {
      for (const rec of this._instances.values()) {
        if (rec.isActive && !rec.isDestroyed) {
          if (typeof rec.view.resize === 'function') {
            rec.view.resize(dimensions);
          }
        }
      }
    }

    destroyView(tabId) {
      const rec = this._instances.get(tabId);
      if (!rec) return;

      if (rec.isActive) {
        this.deactivateView(tabId);
      }

      // 폐기 통보 (FR-11, FR-12)
      if (typeof rec.view.destroy === 'function') {
        rec.view.destroy();
      }
      rec.isDestroyed = true;

      if (rec.container && typeof rec.container.remove === 'function') {
        rec.container.remove();
      }

      this._instances.delete(tabId);
    }

    _syncViewLocation(tabId, targetPaneId) {
      const rec = this._instances.get(tabId);
      if (!rec) return;
      rec.tab.paneId = targetPaneId;
    }

    _resolveProvider(kind) {
      if (typeof this.providerResolver === 'function') {
        const resolved = this.providerResolver(kind);
        if (resolved) return resolved;
      }
      if (this.tabManager && this.tabManager.registry) {
        const reg = this.tabManager.registry.get(kind);
        if (reg && reg.viewProvider) return reg.viewProvider;
      }
      return null;
    }

    // 껍데기 재렌더링 시 기존 뷰들을 새로운 DOM 컨테이너에 재연결 (FR-12)
    rerenderViews(paneContainersMap) {
      for (const rec of this._instances.values()) {
        if (rec.isDestroyed) continue;
        const targetContainer = paneContainersMap ? paneContainersMap.get(rec.tab.paneId) : null;
        if (targetContainer && rec.container.parentNode !== targetContainer) {
          targetContainer.appendChild(rec.container);
        }
      }
    }
  }

  return {
    ViewManager
  };
});
