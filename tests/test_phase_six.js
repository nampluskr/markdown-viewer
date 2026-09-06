// tests/test_phase_six.js — Phase 6 읽기 경험, 수명주기 및 읽기 전용 불변성 검증
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const { handleBridge, setRootPath } = require('../host_electron/host/main.js');
const TabModel = require('../shell/tab_model.js');
const SlotRegistry = require('../shell/slot_registry.js');
const ViewLifecycle = require('../shell/view_lifecycle.js');
const preset = require('../presets/markdown/preset.js');
const views = require('../presets/markdown/view.js');

console.log('--- Phase 6 테스트 시작 ---');

// 1. MV-024: 읽기 영역 글꼴 크기 조절 (FR-10)
// 뷰 컴포넌트 생성 및 줌 제어 테스트
function createMockElement() {
  const listeners = {};
  const styles = {};
  const classes = new Set();
  const children = [];
  const elem = {
    tagName: 'DIV',
    children: children,
    ownerDocument: {
      createElement: () => createMockElement()
    },
    style: {
      setProperty: (k, v) => { styles[k] = v; },
      getProperty: (k) => styles[k]
    },
    classList: {
      add: (c) => classes.add(c),
      remove: (c) => classes.delete(c),
      contains: (c) => classes.has(c)
    },
    addEventListener: (evt, fn) => { listeners[evt] = fn; },
    removeEventListener: (evt) => { delete listeners[evt]; },
    appendChild: (child) => {
      children.push(child);
      elem._lastAppended = child;
    },
    removeChild: () => {},
    innerHTML: '',
    scrollTop: 0,
    _listeners: listeners,
    _styles: styles
  };
  return elem;
}

const mockContainer = createMockElement();
const mockTab = {
  id: 'tab-zoom-test',
  kind: 'markdown',
  resource: { path: 'README.md' }
};

const viewInstance = views.markdown.createView(mockContainer, mockTab);
viewInstance.mount(mockContainer);

// 줌 핸들러 직접 테스트: Ctrl +
const targetEl = mockContainer._lastAppended;
assert.ok(targetEl, 'Mounted element must be appended to container');
const keydownHandler = targetEl._listeners['keydown'];
assert.ok(keydownHandler, 'keydown handler must be registered');

// 기본 줌: 1.0 (100%)
assert.strictEqual(viewInstance.getState().zoomLevel, 1.0);

// Ctrl + 누름 -> 1.1
keydownHandler({ ctrlKey: true, key: '+', preventDefault: () => {} });
assert.strictEqual(viewInstance.getState().zoomLevel, 1.1);

// 20번 확대 시도 -> 최대 2.5(250%) 초과 금지
for (let i = 0; i < 20; i++) {
  keydownHandler({ ctrlKey: true, key: '+', preventDefault: () => {} });
}
assert.strictEqual(viewInstance.getState().zoomLevel, 2.5, 'Max zoom must not exceed 2.5 (250%)');

// 30번 축소 시도 -> 최소 0.5(50%) 미만 축소 금지
for (let i = 0; i < 30; i++) {
  keydownHandler({ ctrlKey: true, key: '-', preventDefault: () => {} });
}
assert.strictEqual(viewInstance.getState().zoomLevel, 0.5, 'Min zoom must not go below 0.5 (50%)');

// Ctrl + 0 누름 -> 기본값 1.0 복귀
keydownHandler({ ctrlKey: true, key: '0', preventDefault: () => {} });
assert.strictEqual(viewInstance.getState().zoomLevel, 1.0, 'Ctrl+0 must reset zoom to 1.0');

// 마우스 휠 줌 테스트
const wheelHandler = targetEl._listeners['wheel'];
assert.ok(wheelHandler, 'wheel handler must be registered');
wheelHandler({ ctrlKey: true, deltaY: -100, preventDefault: () => {} }); // 위로 휠 = 확대
assert.strictEqual(viewInstance.getState().zoomLevel, 1.1);
wheelHandler({ ctrlKey: true, deltaY: 100, preventDefault: () => {} }); // 아래로 휠 = 축소
assert.strictEqual(viewInstance.getState().zoomLevel, 1.0);

console.log('MV-024: 글꼴 크기 조절 (50%~250%, Ctrl+/-, 휠, Ctrl 0) 통과');

// 2. MV-025: 보기 수명주기와 읽던 자리 유지 (FR-11)
const slots = new SlotRegistry();
const tabRegistry = new TabModel.KindRegistry();
const slotBacked = SlotRegistry.createSlotBackedRegistry(slots, tabRegistry);
const tabManager = new TabModel.TabManager(slotBacked);

preset.install(slots);

let destroyCalled = false;
let createCount = 0;

// 추적 가능한 뷰 프로바이더 등록
slots.registerViewProvider('markdown', {
  kind: 'markdown',
  createView: function (container, tab) {
    createCount++;
    let currentScroll = 0;
    return {
      mount: (target) => {},
      activate: () => {},
      deactivate: () => {},
      resize: () => {},
      destroy: () => { destroyCalled = true; },
      setScroll: (s) => { currentScroll = s; },
      getScroll: () => currentScroll
    };
  }
});

const viewManager = new ViewLifecycle.ViewManager({
  tabManager,
  providerResolver: (kind) => slots.getViewProvider(kind)
});

// 탭 1 열기
const t1 = tabManager.openTab({ kind: 'markdown', resource: { path: 'doc1.md' } }).tab;
const rec1 = viewManager.getOrCreateView(t1);
rec1.view.setScroll(350); // 아래로 350px 스크롤

// 탭 2 열기
const t2 = tabManager.openTab({ kind: 'markdown', resource: { path: 'doc2.md' } }).tab;
const rec2 = viewManager.getOrCreateView(t2);

// 탭 1로 다시 전환
tabManager.activateTab(t1.id);
const rec1After = viewManager.getOrCreateView(t1);

// 검증: 뷰 재생성 0회, 스크롤 위치 350 유지
assert.strictEqual(createCount, 2, 'Total view creation count must be 2 (no re-creation on tab switch)');
assert.strictEqual(rec1After.view.getScroll(), 350, 'Scroll position must be preserved');
assert.strictEqual(destroyCalled, false, 'View must NOT be destroyed on tab switch');

// 탭 1을 닫을 때만 destroy 호출 확인
tabManager.closeTab(t1.id);
assert.strictEqual(destroyCalled, true, 'View MUST be destroyed when tab is closed');
console.log('MV-025: 보기 수명주기 및 탭 수명 동안 상태 유지 통과 (껍데기 계약)');

// 2-1. 실제 보기 구현이 읽던 자리를 되돌리는지 본다.
// 껍데기는 비활성 탭을 display:none으로 감추고, 그러면 스크롤 위치가 초기화된다.
// 위 검사는 시험용 스텁 보기로 껍데기 쪽만 확인하므로 여기서 실물 두 보기를 직접 본다 (FR-11).
function findScrollContainer(mockEl) {
  // el > viewer > [toolbar, contentDiv]
  const viewer = mockEl.children[0];
  if (!viewer || !viewer.children) return null;
  return viewer.children[1] || null;
}

async function checkScrollRestored(view, label) {
  const container = createMockElement();
  globalThis.bridge = {
    call_domain: async () => ({ ok: true, value: { content: 'line1\nline2\nline3\nline4', size: 24, path: 'x' } })
  };

  const instance = view.createView(container, { id: 't', kind: view.kind, resource: { path: 'sample.py' } });
  instance.mount(container);
  await new Promise((resolve) => setImmediate(resolve));

  const mounted = container._lastAppended;
  const scrollBox = view.kind === 'markdown' ? mounted : findScrollContainer(mounted);
  assert.ok(scrollBox, `${label}: scroll container must exist after render`);

  // 사용자가 아래로 스크롤한 상태를 만든다
  scrollBox.scrollTop = 220;
  const scrollHandler = scrollBox._listeners['scroll'];
  if (scrollHandler) scrollHandler();

  // 다른 탭으로 갔다가 (deactivate) 껍데기가 감추면서 스크롤이 초기화되고,
  instance.deactivate();
  scrollBox.scrollTop = 0;

  // 돌아왔을 때 (activate) 읽던 자리가 되돌아와야 한다
  instance.activate();
  assert.strictEqual(scrollBox.scrollTop, 220, `${label}: scroll position must be restored on activate`);

  // 껍데기의 세션 상태 계약도 구현돼 있어야 한다
  const saved = instance.saveState();
  assert.strictEqual(saved.scrollTop, 220, `${label}: saveState must carry the scroll position`);
  instance.restoreState({ scrollTop: 111, zoomLevel: 1.5 });
  assert.strictEqual(instance.getState().scrollTop, 111, `${label}: restoreState must apply the scroll position`);
  assert.strictEqual(instance.getState().zoomLevel, 1.5, `${label}: restoreState must apply the zoom level`);

  instance.destroy();
  delete globalThis.bridge;
}

(async () => {
  await checkScrollRestored(views.code, 'code view');
  await checkScrollRestored(views.markdown, 'markdown view');
  console.log('FR-11: 실물 보기 둘 다 탭 전환 뒤 읽던 자리 복원 확인');
})();

// 3. MV-026: 읽기 전용 확인 — 해시 및 수정 시각 불변성 검증 (FR-12, 제약 7)
const testDir = path.join(__dirname, 'temp_phase6');
if (!fs.existsSync(testDir)) fs.mkdirSync(testDir, { recursive: true });

// 테스트용 파일들 생성
const files = ['sample1.md', 'sample2.txt', 'code.py', 'config.json'];
for (const f of files) {
  fs.writeFileSync(path.join(testDir, f), `Sample content of ${f}\nDate: ${Date.now()}`);
}

setRootPath(testDir);

function getSnapshot(dir) {
  const snapshot = {};
  const entries = fs.readdirSync(dir);
  for (const entry of entries) {
    const full = path.join(dir, entry);
    const stat = fs.statSync(full);
    const content = fs.readFileSync(full);
    const hash = crypto.createHash('sha256').update(content).digest('hex');
    snapshot[entry] = {
      hash,
      mtimeMs: stat.mtimeMs,
      size: stat.size
    };
  }
  return snapshot;
}

const beforeSnapshot = getSnapshot(testDir);

(async () => {
  // 다양한 읽기 및 열기 작업 수행
  for (const f of files) {
    const r = await handleBridge('call_domain', 'read_document', f);
    assert.strictEqual(r.ok, true);
  }

  // 존재하지 않는 파일 / 오류 유발 작업 수행
  await handleBridge('call_domain', 'read_document', 'non_existent.md');
  await handleBridge('call_domain', 'read_document', '../outside.md');

  // 작업 후 스냅샷 대조
  const afterSnapshot = getSnapshot(testDir);

  for (const f of files) {
    assert.strictEqual(beforeSnapshot[f].hash, afterSnapshot[f].hash, `File hash of ${f} must remain identical`);
    assert.strictEqual(beforeSnapshot[f].mtimeMs, afterSnapshot[f].mtimeMs, `mtimeMs of ${f} must remain identical`);
    assert.strictEqual(beforeSnapshot[f].size, afterSnapshot[f].size, `Size of ${f} must remain identical`);
  }

  // 소스코드 내 루트 파일 수정/삭제/생성 호출 0건 확인
  const domainCode = fs.readFileSync(path.join(__dirname, '..', 'host_electron', 'host', 'domain.js'), 'utf8');
  assert.ok(!domainCode.includes('fs.writeFileSync'), 'domain.js must have 0 writeFileSync');
  assert.ok(!domainCode.includes('fs.writeFile'), 'domain.js must have 0 writeFile');
  assert.ok(!domainCode.includes('fs.unlink'), 'domain.js must have 0 unlink');
  assert.ok(!domainCode.includes('fs.rename'), 'domain.js must have 0 rename');
  assert.ok(!domainCode.includes('fs.rm'), 'domain.js must have 0 rm');

  fs.rmSync(testDir, { recursive: true, force: true });

  console.log('MV-026: 루트 내 파일 해시 및 mtime 불변성 (읽기 전용) 검증 통과');
  console.log('--- Phase 6 모든 테스트 성공 ---');
})();
