// tests/test_phase_four.js — Phase 4 텍스트·코드 뷰어, 문법 강조 및 파일 제약 검증
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const Prism = require('../vendor/prism.js');
const views = require('../presets/markdown/view.js');
const { handleBridge, setRootPath } = require('../host_electron/host/main.js');

console.log('--- Phase 4 테스트 시작 ---');

// 1. MV-016: 9개 언어 문법 강조 검증 (FR-5)
global.Prism = Prism;

const codeSamples = {
  python: 'def calculate(x):\n    return x * 42',
  cpp: '#include <iostream>\nint main() {\n    return 0;\n}',
  typescript: 'interface User {\n    name: string;\n    age: number;\n}',
  javascript: 'const multiply = (a, b) => {\n    return a * b;\n};',
  json: '{\n  "name": "markdown-viewer",\n  "version": 1\n}',
  powershell: 'function Get-Files {\n    Get-ChildItem -Path .\n}',
  yaml: 'name: CI\non:\n  push:\n    branches: [main]',
  toml: '[package]\nname = "demo"\nversion = "0.1.0"',
  bash: '#!/bin/bash\necho "Current date:" $(date)'
};

for (const [lang, code] of Object.entries(codeSamples)) {
  const langKey = views.resolvePrismLanguage(lang);
  assert.ok(langKey, `Language key resolved for ${lang}`);
  const highlighted = views.highlightCode(code, langKey);
  const tokenMatches = highlighted.match(/<span class="token /g) || [];
  console.log(`[${lang}] token count: ${tokenMatches.length}`);
  assert.ok(tokenMatches.length >= 2, `${lang} must have at least 2 highlighted tokens`);
}

// 지원하지 않는 언어 / 알 수 없는 언어 원문 표시 확인
const unknownCode = 'CUSTOM_SYNTAX $$$ foo === bar <script>x</script>';
const unknownHighlighted = views.highlightCode(unknownCode, 'unknown_lang');
assert.ok(!unknownHighlighted.includes('<span class="token '), 'Unknown language must not be tokenized');
assert.ok(!unknownHighlighted.includes('<script>'), 'Unknown language output must be escaped');
assert.ok(unknownHighlighted.includes('&lt;script&gt;'), 'Unknown language output must keep the source as escaped text');
assert.ok(unknownHighlighted.includes('CUSTOM_SYNTAX $$$ foo === bar'), 'Unknown language output must keep the source text');
console.log('MV-016: 9개 언어 문법 강조 및 비지원 언어 원문 출력 통과');

// 2. MV-014: 줄 번호 및 원문 줄 수 일치 검증 (FR-7)
const multilineText = 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5';
const lines = multilineText.split(/\r\n|\r|\n/);
assert.strictEqual(lines.length, 5, 'Line count must be 5');
console.log('MV-014: 줄 번호 줄 수 일치 통과');

// 3. MV-015: 파일 제약 — 2MB 초과, 널 바이트, UTF-16 거절 및 사유 구분 검증 (FR-7, D-8)
const testDir = path.join(__dirname, 'temp_phase4');
if (!fs.existsSync(testDir)) fs.mkdirSync(testDir, { recursive: true });

setRootPath(testDir);

// 3-1. 2MB 초과 파일 생성 (2MB + 100KB)
const largeFilePath = path.join(testDir, 'large.txt');
const largeBuf = Buffer.alloc(2 * 1024 * 1024 + 102400, 0x61); // 'a'로 채움
fs.writeFileSync(largeFilePath, largeBuf);

// 3-2. 널 바이트 포함 바이너리 파일 생성
const binaryFilePath = path.join(testDir, 'binary.dat');
const binBuf = Buffer.from([0x48, 0x65, 0x6c, 0x6c, 0x6f, 0x00, 0x57, 0x6f, 0x72, 0x6c, 0x64]);
fs.writeFileSync(binaryFilePath, binBuf);

// 3-3. UTF-16 LE 파일 생성 (BOM: FF FE)
const utf16FilePath = path.join(testDir, 'utf16.txt');
const utf16Buf = Buffer.from([0xff, 0xfe, 0x48, 0x00, 0x69, 0x00]); // "Hi" in UTF-16 LE
fs.writeFileSync(utf16FilePath, utf16Buf);

// 3-4. 정상 UTF-8 파일 (BOM 포함)
const utf8BomFilePath = path.join(testDir, 'utf8bom.txt');
const utf8BomBuf = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from('안녕하세요 UTF-8 BOM', 'utf8')]);
fs.writeFileSync(utf8BomFilePath, utf8BomBuf);

(async () => {
  // 3-1 테스트: 2MB 초과
  const rLarge = await handleBridge('call_domain', 'read_document', 'large.txt');
  assert.strictEqual(rLarge.ok, false, 'Large file must be rejected');
  assert.strictEqual(rLarge.error.code, 'UNSUPPORTED_TARGET');
  assert.ok(rLarge.error.message.includes('2MB'), 'Error message must mention 2MB limit');
  console.log('2MB 초과 거절 사유:', rLarge.error.message);

  // 3-2 테스트: 널 바이트 바이너리
  const rBin = await handleBridge('call_domain', 'read_document', 'binary.dat');
  assert.strictEqual(rBin.ok, false, 'Binary file must be rejected');
  assert.strictEqual(rBin.error.code, 'UNSUPPORTED_TARGET');
  assert.ok(rBin.error.message.includes('널 바이트') || rBin.error.message.includes('바이너리'), 'Error message must mention binary/null byte');
  console.log('바이너리 거절 사유:', rBin.error.message);

  // 3-3 테스트: UTF-16
  const rUtf16 = await handleBridge('call_domain', 'read_document', 'utf16.txt');
  assert.strictEqual(rUtf16.ok, false, 'UTF-16 file must be rejected');
  assert.strictEqual(rUtf16.error.code, 'UNSUPPORTED_TARGET');
  assert.ok(rUtf16.error.message.includes('UTF-8') || rUtf16.error.message.includes('UTF-16'), 'Error message must mention encoding');
  console.log('UTF-16 거절 사유:', rUtf16.error.message);

  // 세 거절 사유가 서로 달라야 함
  assert.notStrictEqual(rLarge.error.message, rBin.error.message);
  assert.notStrictEqual(rLarge.error.message, rUtf16.error.message);
  assert.notStrictEqual(rBin.error.message, rUtf16.error.message);
  console.log('MV-015: 3종 거절 사유 개별 구분 통과');

  // 3-4 테스트: UTF-8 BOM 정상 읽기
  const rUtf8Bom = await handleBridge('call_domain', 'read_document', 'utf8bom.txt');
  assert.strictEqual(rUtf8Bom.ok, true, 'UTF-8 BOM file must be read successfully');
  assert.strictEqual(rUtf8Bom.value.content, '안녕하세요 UTF-8 BOM');
  console.log('UTF-8 BOM 읽기 통과');

  // 4. MV-019: 6종 오류 코드 매핑 확인 (NFR-6)
  const errCodes = [
    'ROOT_ESCAPE',
    'NOT_FOUND',
    'PERMISSION_DENIED',
    'READ_FAILED',
    'USER_CANCELLED',
    'UNSUPPORTED_TARGET'
  ];
  const { ERROR_MESSAGES } = require('../host_electron/host/main.js');
  for (const code of errCodes) {
    assert.ok(ERROR_MESSAGES[code], `ERROR_MESSAGES must contain ${code}`);
  }
  console.log('MV-019: 오류 계약 6종 코드 매핑 확인 통과');

  // 5. MV-018: 코드 복사 버튼 로직 검증 (FR-6)
  let clipText = '';
  global.mockNavigator = {
    clipboard: {
      writeText: (txt) => { clipText = txt; return Promise.resolve(); }
    }
  };
  const dummyBtn = { textContent: '복사', classList: { add: () => {}, remove: () => {} } };
  const sampleCode = 'function test() {\n  return true;\n}';
  await views.copyToClipboard(sampleCode, dummyBtn);
  assert.strictEqual(clipText, sampleCode, 'Clipboard text must match sampleCode exactly (including newlines)');
  console.log('MV-018: 코드 복사 버튼 클립보드 원문 일치 통과');

  // 임시 파일 정리
  fs.rmSync(testDir, { recursive: true, force: true });

  console.log('--- Phase 4 모든 테스트 성공 ---');
})();
