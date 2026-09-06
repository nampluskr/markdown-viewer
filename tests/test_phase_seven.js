// tests/test_phase_seven.js — Phase 7 동결본 회귀 대조 및 성능 측정
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');

const { handleBridge, setRootPath } = require('../host_electron/host/main.js');
const preset = require('../presets/markdown/preset.js');
const marked = require('../vendor/marked.min.js');
const views = require('../presets/markdown/view.js');

console.log('--- Phase 7 테스트 시작 ---');

// 1. MV-027: 동결본 회귀 대조 (_archive/260813_markdown_browser)
const archiveClassificationPath = path.join(__dirname, '..', '..', '_archive', '260813_markdown_browser', 'src', 'main', 'file-classification.ts');
assert.ok(fs.existsSync(archiveClassificationPath), 'Archive file-classification.ts must exist');

const archiveContent = fs.readFileSync(archiveClassificationPath, 'utf8');

// 동결본의 지원 확장자 추출
const extMatches = archiveContent.match(/'(\.[a-zA-Z0-9]+)':/g) || [];
const archiveExtensions = extMatches.map(m => m.slice(1, -2).toLowerCase());

console.log('Archive supported extensions count:', archiveExtensions.length);
assert.ok(archiveExtensions.length >= 26, 'Archive must have at least 26 supported extensions');

// 우리 앱의 지원 확장자와 대조
for (const ext of archiveExtensions) {
  const supported = preset.isSupportedExtension(ext);
  assert.ok(supported, `Extension ${ext} from frozen archive must be supported in markdown-viewer`);
}
console.log('동결본 26개 확장자 전건 대조 통과 (누락 0건)');

// 동결본 이미지 확장자 대조
const archiveImgMatches = archiveContent.match(/imageExtensions = new Set\(\[(.*?)\]\)/s);
assert.ok(archiveImgMatches, 'Image extensions found in archive');
const imgExts = archiveImgMatches[1].match(/'(\.[a-zA-Z0-9]+)'/g).map(m => m.slice(1, -1).toLowerCase());

const { IMAGE_MIME_MAP } = require('../host_electron/host/domain.js');
for (const iext of imgExts) {
  assert.ok(IMAGE_MIME_MAP[iext], `Image extension ${iext} from frozen archive must be supported`);
}
console.log('동결본 6개 이미지 확장자 전건 대조 통과 (누락 0건)');
console.log('MV-027: 동결본 회귀 대조 완료');

// 2. MV-028: 성능 측정 (NFR-1)
// 기준:
// 1) 실행부터 탐색기 표시까지: 5회 측정 중앙값 <= 3초
// 2) 1MB 마크다운 렌더링까지: 5회 측정 중앙값 <= 1초

const testDir = path.join(__dirname, 'temp_phase7');
if (!fs.existsSync(testDir)) fs.mkdirSync(testDir, { recursive: true });
setRootPath(testDir);

// 1MB 마크다운 파일 생성 (다양한 GFM 요소 포함)
let oneMbContent = '# 1MB Benchmark Document\n\n';
const chunk = `
## Section Heading

Here is a paragraph with **bold text**, *italic text*, and \`inline code\`.
[Link to somewhere](https://example.com)

| Header A | Header B | Header C |
| :--- | :---: | ---: |
| Value 1 | Value 2 | Value 3 |
| Value 4 | Value 5 | Value 6 |

- [ ] Task 1
- [x] Task 2

\`\`\`python
def example(n):
    return [x * 2 for x in range(n)]
\`\`\`

> Blockquote containing notes and guidelines.

---
`;

while (Buffer.byteLength(oneMbContent, 'utf8') < 1024 * 1024) {
  oneMbContent += chunk;
}

const oneMbFile = path.join(testDir, 'benchmark_1mb.md');
fs.writeFileSync(oneMbFile, oneMbContent, 'utf8');
const actualSizeMb = (fs.statSync(oneMbFile).size / (1024 * 1024)).toFixed(2);
console.log(`Generated 1MB document: ${actualSizeMb} MB`);

function getMedian(arr) {
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

(async () => {
  // 1) 실행 ~ 탐색기 표시 측정 5회
  const startupTimes = [];
  for (let i = 0; i < 5; i++) {
    const t0 = performance.now();
    // Simulate init, bridge root resolve, and list_children
    await handleBridge('set_root', testDir);
    await handleBridge('list_children', '');
    const t1 = performance.now();
    startupTimes.push(t1 - t0);
  }

  const startupMedianMs = getMedian(startupTimes);
  console.log(`탐색기 표시 시간(5회): [${startupTimes.map(t => t.toFixed(1) + 'ms').join(', ')}]`);
  console.log(`탐색기 표시 중앙값: ${startupMedianMs.toFixed(1)}ms (기준: <= 3000ms)`);
  assert.ok(startupMedianMs <= 3000, `Startup to tree explorer median (${startupMedianMs}ms) must be <= 3000ms`);

  // 2) 1MB 마크다운 로드 및 렌더링 측정 5회
  const renderTimes = [];
  for (let i = 0; i < 5; i++) {
    const t0 = performance.now();
    const docRes = await handleBridge('call_domain', 'read_document', 'benchmark_1mb.md');
    assert.strictEqual(docRes.ok, true);
    const html = marked.parse(docRes.value.content, { gfm: true, breaks: true });
    const cleanHtml = views.sanitizeHtml(html);
    assert.ok(cleanHtml.length > 0);
    const t1 = performance.now();
    renderTimes.push(t1 - t0);
  }

  const renderMedianMs = getMedian(renderTimes);
  console.log(`1MB 렌더링 시간(5회): [${renderTimes.map(t => t.toFixed(1) + 'ms').join(', ')}]`);
  console.log(`1MB 렌더링 중앙값: ${renderMedianMs.toFixed(1)}ms (기준: <= 1000ms)`);
  assert.ok(renderMedianMs <= 1000, `1MB render median (${renderMedianMs}ms) must be <= 1000ms`);

  console.log('MV-028: 성능 측정 (탐색기 <= 3초, 1MB 렌더링 <= 1초) 전건 충족');

  // 정리
  fs.rmSync(testDir, { recursive: true, force: true });

  console.log('--- Phase 7 모든 테스트 성공 ---');
})();
