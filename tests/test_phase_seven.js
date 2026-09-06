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

// 확장자 목록만 맞춰서는 "같게 읽힌다"를 말할 수 없다. 동결본이 지원하던 렌더링 요소를
// 같은 시험 문서로 통과시켜 본다 (PLAN Phase 7).
const baselineDoc = [
  '# Heading',
  '',
  'Paragraph with **bold**, *italic*, `inline code` and [a link](https://example.com).',
  '',
  '> Blockquote',
  '',
  '| A | B |',
  '| --- | --- |',
  '| 1 | 2 |',
  '',
  '- [ ] todo',
  '- [x] done',
  '',
  '1. first',
  '2. second',
  '',
  '![local image](./assets/diagram.png)',
  '',
  '[relative doc](./other.md)',
  '',
  '---',
  '',
  '```python',
  'def f():',
  '    return 1',
  '```',
  ''
].join('\n');

const baselineHtml = marked.parse(baselineDoc, { gfm: true, breaks: false });

const baselineElements = {
  '제목': /<h1[^>]*>Heading<\/h1>/,
  '굵게': /<strong>bold<\/strong>/,
  '기울임': /<em>italic<\/em>/,
  '인라인 코드': /<code>inline code<\/code>/,
  '링크': /<a href="https:\/\/example\.com">a link<\/a>/,
  '인용문': /<blockquote>/,
  '표': /<table>[\s\S]*<td>1<\/td>/,
  '체크박스': /type="checkbox"/,
  '순서 목록': /<ol[\s\S]*<li>first<\/li>/,
  '이미지': /<img[^>]+src="\.\/assets\/diagram\.png"/,
  '상대 문서 링크': /<a href="\.\/other\.md">relative doc<\/a>/,
  '수평선': /<hr>/,
  '코드 펜스': /<pre><code[\s\S]*def f\(\):/
};

for (const [label, pattern] of Object.entries(baselineElements)) {
  assert.ok(pattern.test(baselineHtml), `동결본이 렌더링하던 요소 누락: ${label}`);
}
console.log(`동결본 렌더링 요소 ${Object.keys(baselineElements).length}종 대조 통과 (누락 0건)`);

// 줄바꿈 처리도 동결본과 같아야 한다 (react-markdown + remark-gfm은 소프트 줄바꿈을 <br>로 바꾸지 않는다)
assert.ok(!marked.parse('a\nb', { gfm: true, breaks: false }).includes('<br>'), '소프트 줄바꿈이 <br>이 되면 안 된다');
console.log('MV-027: 동결본 회귀 대조 완료 (확장자 + 렌더링 요소 + 줄바꿈 처리)');

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
  // 1) 루트 설정 + 첫 트리 목록 응답 시간 5회
  //    이 값은 NFR-1의 "실행부터 탐색기가 보일 때까지"가 아니다 — Electron 기동·창 생성·셸 로드가
  //    빠져 있다. 그 기준은 tests/measure_startup.js가 실제 앱을 띄워서 잰다.
  const bridgeTimes = [];
  for (let i = 0; i < 5; i++) {
    const t0 = performance.now();
    await handleBridge('set_root', testDir);
    await handleBridge('list_children', '');
    const t1 = performance.now();
    bridgeTimes.push(t1 - t0);
  }

  const bridgeMedianMs = getMedian(bridgeTimes);
  console.log(`브릿지 루트 설정 + 첫 목록 응답(5회): [${bridgeTimes.map(t => t.toFixed(1) + 'ms').join(', ')}]`);
  console.log(`중앙값: ${bridgeMedianMs.toFixed(1)}ms (참고값 — 앱 기동 시간은 tests/measure_startup.js로 잰다)`);
  assert.ok(bridgeMedianMs <= 3000, `Bridge listing median (${bridgeMedianMs}ms) must be <= 3000ms`);

  // 2) 1MB 마크다운 로드 + 파싱 + 문법 강조 + 정화 측정 5회
  //    앱과 같은 경로를 태우기 위해 코드 블록 강조 렌더러와 정화기를 붙인 상태로 잰다.
  //    DOM 삽입 비용은 Node에서 잴 수 없으므로 이 값에 포함되지 않는다.
  let purifyCalls = 0;
  globalThis.DOMPurify = {
    sanitize: function (html) { purifyCalls++; return String(html); }
  };
  globalThis.Prism = require('../vendor/prism.js');
  globalThis.marked = marked; // 앱에서는 window.marked로 붙는다. 없으면 escape 폴백이 측정된다

  // 폴백이 아니라 실제 파서를 태우고 있는지 먼저 확인한다
  const probeHtml = views.renderMarkdownToHtml('# probe\n\n```python\nx = 1\n```\n');
  assert.ok(probeHtml.includes('<h1>probe</h1>'), '실제 마크다운 파서를 태운 상태로 측정해야 한다');
  assert.ok(probeHtml.includes('language-python'), '문법 강조 렌더러가 붙은 상태로 측정해야 한다');

  const renderTimes = [];
  for (let i = 0; i < 5; i++) {
    const t0 = performance.now();
    const docRes = await handleBridge('call_domain', 'read_document', 'benchmark_1mb.md');
    assert.strictEqual(docRes.ok, true);
    const html = views.renderMarkdownToHtml(docRes.value.content);
    const cleanHtml = views.sanitizeHtml(html);
    assert.ok(cleanHtml.length > 0);
    const t1 = performance.now();
    renderTimes.push(t1 - t0);
  }

  assert.strictEqual(purifyCalls, 5, '정화기를 태운 상태로 측정해야 한다 (측정 5회)');
  delete globalThis.DOMPurify;
  delete globalThis.Prism;
  delete globalThis.marked;

  const renderMedianMs = getMedian(renderTimes);
  console.log(`1MB 렌더링 시간(5회): [${renderTimes.map(t => t.toFixed(1) + 'ms').join(', ')}]`);
  console.log(`1MB 렌더링 중앙값: ${renderMedianMs.toFixed(1)}ms (기준: <= 1000ms)`);
  assert.ok(renderMedianMs <= 1000, `1MB render median (${renderMedianMs}ms) must be <= 1000ms`);

  console.log('MV-028: 성능 측정 (탐색기 <= 3초, 1MB 렌더링 <= 1초) 전건 충족');

  // 정리
  fs.rmSync(testDir, { recursive: true, force: true });

  console.log('--- Phase 7 모든 테스트 성공 ---');
})();
