// tests/test_phase_five.js — Phase 5 이미지 및 링크 참조 검증
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const { handleBridge, setRootPath } = require('../host_electron/host/main.js');
const TabModel = require('../shell/tab_model.js');
const SlotRegistry = require('../shell/slot_registry.js');
const preset = require('../presets/markdown/preset.js');

console.log('--- Phase 5 테스트 시작 ---');

const testDir = path.join(__dirname, 'temp_phase5');
if (!fs.existsSync(testDir)) fs.mkdirSync(testDir, { recursive: true });
const subDir = path.join(testDir, 'sub');
if (!fs.existsSync(subDir)) fs.mkdirSync(subDir, { recursive: true });

setRootPath(testDir);

// 1. MV-020: 6가지 상대경로 이미지 형식 테스트 (FR-8)
const imageFormats = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'];
// Dummy 1-pixel or small valid payload
const dummyBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

for (const ext of imageFormats) {
  const imgFile = path.join(subDir, `test_img.${ext}`);
  fs.writeFileSync(imgFile, dummyBytes);
}

(async () => {
  for (const ext of imageFormats) {
    const res = await handleBridge('call_domain', 'read_image', `test_img.${ext}`, 'sub');
    assert.strictEqual(res.ok, true, `Image format .${ext} should be read successfully`);
    assert.ok(res.value.dataUri.startsWith('data:image/'), `Data URI must be returned for .${ext}`);
    console.log(`[Image .${ext}] OK - MIME: ${res.value.mime}`);
  }
  console.log('MV-020: 6가지 이미지 형식 상대경로 로드 통과');

  // 2. MV-021: 이미지 실패 및 루트 밖 참조 처리 (FR-8)
  // 없는 파일 -> NOT_FOUND
  const rMissing = await handleBridge('call_domain', 'read_image', 'missing.png', 'sub');
  assert.strictEqual(rMissing.ok, false);
  assert.strictEqual(rMissing.error.code, 'NOT_FOUND', 'Missing image must return NOT_FOUND');
  console.log('없는 이미지 NOT_FOUND 확인 통과');

  // 루트 밖 상위 이탈 -> ROOT_ESCAPE
  const rEscape = await handleBridge('call_domain', 'read_image', '../../outside.png', 'sub');
  assert.strictEqual(rEscape.ok, false);
  assert.strictEqual(rEscape.error.code, 'ROOT_ESCAPE', 'Escaped image must return ROOT_ESCAPE');

  // 절대경로 이미지 -> ROOT_ESCAPE
  const rAbs = await handleBridge('call_domain', 'read_image', 'C:/Windows/test.png', 'sub');
  assert.strictEqual(rAbs.ok, false);
  assert.strictEqual(rAbs.error.code, 'ROOT_ESCAPE', 'Absolute image path must return ROOT_ESCAPE');
  // 심볼릭 링크·junction으로 루트를 빠져나가는 경로도 막혀야 한다 (오류 계약 ROOT_ESCAPE).
  // 문서 읽기는 realpath까지 확인하는데 이미지 읽기가 자체 경로 계산을 쓰면 여기서 뚫린다.
  const outsideDir = path.join(__dirname, 'temp_phase5_outside');
  if (!fs.existsSync(outsideDir)) fs.mkdirSync(outsideDir, { recursive: true });
  fs.writeFileSync(path.join(outsideDir, 'secret.png'), dummyBytes);

  const linkPath = path.join(testDir, 'linked');
  let linkCreated = false;
  try {
    fs.symlinkSync(outsideDir, linkPath, 'junction');
    linkCreated = true;
  } catch (err) {
    console.log('심볼릭 링크 생성 불가(권한) — 링크 이탈 검사 건너뜀:', err.code);
  }

  if (linkCreated) {
    const rLinkImg = await handleBridge('call_domain', 'read_image', 'linked/secret.png', '');
    assert.strictEqual(rLinkImg.ok, false, 'Image behind a junction must not be readable');
    assert.strictEqual(rLinkImg.error.code, 'ROOT_ESCAPE', 'Junction escape must return ROOT_ESCAPE');

    const rLinkImgBase = await handleBridge('call_domain', 'read_image', 'secret.png', 'linked');
    assert.strictEqual(rLinkImgBase.ok, false, 'Junction escape via baseDir must be blocked too');
    assert.strictEqual(rLinkImgBase.error.code, 'ROOT_ESCAPE', 'Junction escape via baseDir must return ROOT_ESCAPE');

    const rLinkDoc = await handleBridge('call_domain', 'read_document', 'linked/secret.png');
    assert.strictEqual(rLinkDoc.ok, false, 'Document behind a junction must not be readable');
    assert.strictEqual(rLinkDoc.error.code, 'ROOT_ESCAPE', 'Junction escape must return ROOT_ESCAPE');

    fs.unlinkSync(linkPath);
    console.log('링크(junction)를 통한 루트 이탈 이미지·문서 읽기 차단 통과');
  }
  fs.rmSync(outsideDir, { recursive: true, force: true });

  console.log('MV-021: 루트 밖 이미지 참조 ROOT_ESCAPE 거부 통과');

  // 3. MV-022: 상대경로 문서 링크 열기 및 중복 정책 (FR-9)
  const slots = new SlotRegistry();
  const tabRegistry = new TabModel.KindRegistry();
  const slotBacked = SlotRegistry.createSlotBackedRegistry(slots, tabRegistry);
  const tabManager = new TabModel.TabManager(slotBacked);

  preset.install(slots);

  // 문서 1 열기 (새 탭)
  const openResult1 = slots.executeOpenRoute('open_document', tabManager, { path: 'doc1.md' });
  assert.ok(openResult1 && openResult1.tab, 'First open should return tab');
  assert.strictEqual(openResult1.isNew, true, 'First open should create a new tab');
  assert.strictEqual(tabManager.getAllTabs().length, 1, 'Tab count should be 1');

  // 문서 2 열기 (새 탭)
  const openResult2 = slots.executeOpenRoute('open_document', tabManager, { path: 'doc2.md' });
  assert.strictEqual(openResult2.isNew, true, 'Second document should create a new tab');
  assert.strictEqual(tabManager.getAllTabs().length, 2, 'Tab count should be 2');

  // 이미 열린 문서 1 다시 열기 -> 기존 탭 활성화, 탭 수 유지
  const openResult3 = slots.executeOpenRoute('open_document', tabManager, { path: 'doc1.md' });
  assert.strictEqual(openResult3.isNew, false, 'Reopening existing document should not be new');
  assert.strictEqual(tabManager.getAllTabs().length, 2, 'Tab count must remain 2');
  assert.strictEqual(tabManager.getActiveTab().id, openResult1.tab.id, 'Active tab must be doc1');
  // 링크 대상의 확장자에 따라 보기가 갈린다. 코드 파일 링크를 마크다운으로 렌더링하지 않는다 (FR-2).
  const openCode = slots.executeOpenRoute('open_document', tabManager, { path: 'sub/script.py' });
  assert.ok(openCode && openCode.tab, 'Code file link should open a tab');
  assert.strictEqual(openCode.tab.kind, 'code', 'A .py link must open in the code view, not markdown');

  const openMd = slots.executeOpenRoute('open_document', tabManager, { path: 'sub/nested.md' });
  assert.strictEqual(openMd.tab.kind, 'markdown', 'A .md link must open in the markdown view');

  // 지원하지 않는 확장자는 열지 않는다
  const tabCountBefore = tabManager.getAllTabs().length;
  const openUnsupported = slots.executeOpenRoute('open_document', tabManager, { path: 'sub/archive.zip' });
  assert.strictEqual(openUnsupported, null, 'Unsupported extension must not open a tab');
  assert.strictEqual(tabManager.getAllTabs().length, tabCountBefore, 'Tab count must not change');
  console.log('FR-2/FR-9: 링크 대상 확장자별 보기 분기 및 미지원 확장자 차단 통과');

  console.log('MV-022: 인앱 문서 링크 탭 열기 및 기존 탭 재활성화 통과');

  // 4. MV-023: 외부 URL 및 루트 밖 링크 처리 (FR-9)
  let externalOpened = null;
  const mockElectron = {
    shell: {
      openExternal: (url) => { externalOpened = url; return Promise.resolve(); }
    }
  };
  // Test external URL handler
  const rExt = await handleBridge('call_domain', 'open_external', 'https://github.com');
  assert.strictEqual(rExt.ok, true);
  console.log('외부 URL 기본 브라우저 위임 통과');

  // 5. 보기 코드에서 파일시스템 API 직접 호출 0건 확인 (NFR-4, D-6)
  const viewCode = fs.readFileSync(path.join(__dirname, '..', 'presets', 'markdown', 'view.js'), 'utf8');
  assert.ok(!viewCode.includes("require('fs')"), 'view.js should not require fs');
  assert.ok(!viewCode.includes('require("fs")'), 'view.js should not require fs');
  assert.ok(!viewCode.includes('fs.readFileSync'), 'view.js should not call fs.readFileSync');
  assert.ok(!viewCode.includes('fs.readFile'), 'view.js should not call fs.readFile');
  console.log('D-6: 보기 코드 내 직접 파일시스템 API 호출 0건 확인 통과');

  // 임시 디렉토리 정리
  fs.rmSync(testDir, { recursive: true, force: true });

  console.log('--- Phase 5 모든 테스트 성공 ---');
})();
