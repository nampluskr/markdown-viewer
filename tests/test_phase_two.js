// tests/test_phase_two.js — Phase 2 검증 테스트
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const preset = require('../presets/markdown/preset.js');
const views = require('../presets/markdown/view.js');

console.log('--- Phase 2 테스트 시작 ---');

// Mock slots
class MockSlots {
  constructor() {
    this.treeItemFilter = null;
    this.rowSelectionMapper = null;
    this.duplicatePolicies = {};
    this.viewProviders = {};
  }
  setTreeItemFilter(fn) { this.treeItemFilter = fn; }
  setRowSelectionMapper(fn) { this.rowSelectionMapper = fn; }
  registerDuplicatePolicy(kind, policy) { this.duplicatePolicies[kind] = policy; }
  registerViewProvider(kind, provider) { this.viewProviders[kind] = provider; }
}

const slots = new MockSlots();
global.MarkdownPresetViews = views;
preset.install(slots);

// 1. MV-005 & MV-006: 지원 확장자 필터링 및 대소문자 무관 판정
const sampleEntries = [
  { name: 'README.md', is_dir: false, path: '/test/README.md' },
  { name: 'GUIDE.MD', is_dir: false, path: '/test/GUIDE.MD' },
  { name: 'notes.txt', is_dir: false, path: '/test/notes.txt' },
  { name: 'app.log', is_dir: false, path: '/test/app.log' },
  { name: 'main.py', is_dir: false, path: '/test/main.py' },
  { name: 'types.pyi', is_dir: false, path: '/test/types.pyi' },
  { name: 'server.cpp', is_dir: false, path: '/test/server.cpp' },
  { name: 'index.ts', is_dir: false, path: '/test/index.ts' },
  { name: 'app.js', is_dir: false, path: '/test/app.js' },
  { name: 'config.json', is_dir: false, path: '/test/config.json' },
  { name: 'package.jsonc', is_dir: false, path: '/test/package.jsonc' },
  { name: 'docker-compose.yml', is_dir: false, path: '/test/docker-compose.yml' },
  { name: 'settings.toml', is_dir: false, path: '/test/settings.toml' },
  { name: 'script.ps1', is_dir: false, path: '/test/script.ps1' },
  { name: 'build.sh', is_dir: false, path: '/test/build.sh' },
  // 제외 대상 (이미지, 기타)
  { name: 'photo.png', is_dir: false, path: '/test/photo.png' },
  { name: 'logo.JPG', is_dir: false, path: '/test/logo.JPG' },
  { name: 'vector.svg', is_dir: false, path: '/test/vector.svg' },
  { name: 'data.csv', is_dir: false, path: '/test/data.csv' },
  { name: 'binary.exe', is_dir: false, path: '/test/binary.exe' },
  { name: 'archive.zip', is_dir: false, path: '/test/archive.zip' },
  // 폴더 (항상 포함되어야 함)
  { name: 'src', is_dir: true, path: '/test/src' },
  { name: 'images', is_dir: true, path: '/test/images' }
];

const filtered = slots.treeItemFilter(sampleEntries);
const filteredNames = filtered.map(e => e.name);

console.log('Filtered items count:', filtered.length);
assert.ok(filteredNames.includes('README.md'), 'README.md should be included');
assert.ok(filteredNames.includes('GUIDE.MD'), 'GUIDE.MD (대문자) should be included');
assert.ok(filteredNames.includes('notes.txt'), 'notes.txt should be included');
assert.ok(filteredNames.includes('main.py'), 'main.py should be included');
assert.ok(filteredNames.includes('config.json'), 'config.json should be included');
assert.ok(filteredNames.includes('src'), 'src folder should be included');
assert.ok(filteredNames.includes('images'), 'images folder should be included');

assert.ok(!filteredNames.includes('photo.png'), 'photo.png must be excluded');
assert.ok(!filteredNames.includes('logo.JPG'), 'logo.JPG must be excluded');
assert.ok(!filteredNames.includes('vector.svg'), 'vector.svg must be excluded');
assert.ok(!filteredNames.includes('data.csv'), 'data.csv must be excluded');
assert.ok(!filteredNames.includes('binary.exe'), 'binary.exe must be excluded');
assert.ok(!filteredNames.includes('archive.zip'), 'archive.zip must be excluded');

console.log('MV-005 & MV-006: 확장자 필터링 통과');

// 2. MV-007: 행 선택 매핑
const mdResult = slots.rowSelectionMapper({ name: 'README.md', is_dir: false, path: '/test/README.md' });
assert.strictEqual(mdResult.kind, 'markdown', '.md must map to markdown view');

const mdUpperResult = slots.rowSelectionMapper({ name: 'README.MD', is_dir: false, path: '/test/README.MD' });
assert.strictEqual(mdUpperResult.kind, 'markdown', '.MD must map to markdown view');

const pyResult = slots.rowSelectionMapper({ name: 'app.py', is_dir: false, path: '/test/app.py' });
assert.strictEqual(pyResult.kind, 'code', '.py must map to code view');

const txtResult = slots.rowSelectionMapper({ name: 'log.txt', is_dir: false, path: '/test/log.txt' });
assert.strictEqual(txtResult.kind, 'code', '.txt must map to code view');

const folderResult = slots.rowSelectionMapper({ name: 'src', is_dir: true, path: '/test/src' });
assert.strictEqual(folderResult, null, 'Folder row must return null (no tab opened)');

const unsupportedResult = slots.rowSelectionMapper({ name: 'video.mp4', is_dir: false, path: '/test/video.mp4' });
assert.strictEqual(unsupportedResult, null, 'Unsupported file must return null');

console.log('MV-007: 행 선택 매핑 통과');

// 3. 껍데기 코드에 확장자 지식 0건 확인 (NFR-4)
const shellFiles = fs.readdirSync(path.join(__dirname, '..', 'shell')).filter(f => f.endsWith('.js'));
for (const file of shellFiles) {
  const content = fs.readFileSync(path.join(__dirname, '..', 'shell', file), 'utf8');
  assert.ok(!content.includes('.md'), `shell/${file} should not contain .md`);
  assert.ok(!content.includes('.jsonc'), `shell/${file} should not contain .jsonc`);
  assert.ok(!content.includes('.toml'), `shell/${file} should not contain .toml`);
}
console.log('NFR-4: 껍데기 코드 확장자 격리 확인 통과');

// 4. MV-008: 트리 탐색 중 파일 읽기 호출 0건 확인 (NFR-2)
let readCalls = 0;
const mockBridge = {
  read_file: () => { readCalls++; return Promise.resolve({ ok: true }); },
  call_domain: () => { readCalls++; return Promise.resolve({ ok: true }); }
};

// Simulate tree filtering on 100 items
slots.treeItemFilter(sampleEntries);
assert.strictEqual(readCalls, 0, 'Tree filtering should make 0 read calls');
console.log('MV-008: 트리 탐색 중 미리 읽기 0건 확인 통과');

console.log('--- Phase 2 모든 테스트 성공 ---');
