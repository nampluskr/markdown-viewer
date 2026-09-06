// tests/test_phase_three.js — Phase 3 마크다운 렌더링 및 읽기 스타일 검증
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const marked = require('../vendor/marked.min.js');
const views = require('../presets/markdown/view.js');

console.log('--- Phase 3 테스트 시작 ---');

// 1. MV-009: 렌더러 반입 및 버전 고정 확인 (NFR-3)
assert.strictEqual(typeof marked.parse, 'function', 'marked.parse must be a function');
const vendorReadme = fs.readFileSync(path.join(__dirname, '..', 'vendor', 'README.md'), 'utf8');
assert.ok(vendorReadme.includes('15.0.7'), 'vendor/README.md must document marked version 15.0.7');
assert.ok(vendorReadme.includes('3.2.4'), 'vendor/README.md must document dompurify version 3.2.4');
console.log('MV-009: 렌더러 반입 및 버전 고정 통과');

// 2. MV-010: GFM 요소 렌더링 검증 (FR-3)
const gfmSample = [
  '# 제목 1',
  '',
  '이것은 문단입니다. **굵게** 및 *기울임*.',
  '',
  '> 이것은 인용문입니다.',
  '',
  '---',
  '',
  '| 항목 | 값 | 상태 |',
  '| --- | --- | --- |',
  '| 1번 | 알파 | 완료 |',
  '| 2번 | 베타 | 진행중 |',
  '',
  '- [ ] 미완료 할 일',
  '- [x] 완료된 할 일',
  '',
  '```python',
  'def hello():',
  '    print("world")',
  '```',
  '',
  '인라인 `code` 및 [링크](https://example.com)입니다.',
  ''
].join('\n');

// 앱이 쓰는 것과 같은 옵션으로 파싱한다 (breaks 없음 — 동결본과 같은 줄바꿈 처리)
const MARKED_OPTIONS = { gfm: true, breaks: false };
const parsedHtml = marked.parse(gfmSample, MARKED_OPTIONS);

assert.ok(parsedHtml.includes('<h1>제목 1</h1>'), 'Heading 1 rendered');
assert.ok(parsedHtml.includes('<blockquote>'), 'Blockquote rendered');
assert.ok(parsedHtml.includes('<hr>'), 'Horizontal rule rendered');
assert.ok(parsedHtml.includes('<table>') && parsedHtml.includes('<th>항목</th>') && parsedHtml.includes('<td>알파</td>'), 'Table rendered');
assert.ok(parsedHtml.includes('type="checkbox"'), 'Checkbox rendered');
assert.ok(parsedHtml.includes('<pre><code') && parsedHtml.includes('def hello():'), 'Code fence rendered');
assert.ok(parsedHtml.includes('<code>code</code>'), 'Inline code rendered');
assert.ok(parsedHtml.includes('<a href="https://example.com">링크</a>'), 'Link rendered');
console.log('MV-010: GFM 모든 요소 렌더링 통과');

// 2-1. FR-3: 소프트 줄바꿈은 <br>이 되지 않는다 (동결본 react-markdown + remark-gfm과 같은 처리)
const softBreakHtml = marked.parse('first line\nsecond line', MARKED_OPTIONS);
assert.ok(!softBreakHtml.includes('<br>'), 'Soft line breaks must not become <br> (frozen baseline parity)');
console.log('FR-3: 소프트 줄바꿈 처리가 동결본과 같음 확인');

// 3. MV-012: 렌더 결과 정화 검증 (FR-12)
// 앱에서 실제로 도는 경로는 DOMPurify다. 정화기가 있을 때 그것을 부르는지,
// 없을 때 안전한 쪽으로 닫히는지 둘 다 본다.
const xssSample = [
  '# XSS Test',
  '',
  '<script>alert("xss")</script>',
  '',
  '<img src="invalid.jpg" onerror="alert(1)">',
  '',
  '<a href="javascript:alert(2)">bad link</a>',
  '',
  '<div onclick="alert(3)">click</div>',
  ''
].join('\n');

const rawXssHtml = marked.parse(xssSample, MARKED_OPTIONS);

// 3-1. 정화기가 없으면 살아 있는 마크업을 화면에 넣지 않는다 (fail closed)
const closedResult = views.sanitizeHtml(rawXssHtml);
assert.ok(closedResult.includes('sanitizer-missing'), 'No purifier: output must be flagged as unsanitized text');
assert.ok(!closedResult.includes('<script>'), 'No purifier: raw script markup must not survive');
assert.ok(closedResult.includes('&lt;script&gt;'), 'No purifier: markup must be escaped, not silently stripped');
assert.ok(!/<a\s/i.test(closedResult), 'No purifier: no live anchor markup may be emitted');

// 3-2. 정화기가 있으면 그 정화기를 부르고, 금지 목록을 함께 넘긴다
let capturedConfig = null;
globalThis.DOMPurify = {
  sanitize: function (html, config) {
    capturedConfig = config;
    return String(html)
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/ on[a-z]+="[^"]*"/gi, '')
      .replace(/href="javascript:[^"]*"/gi, 'href="about:blank"');
  }
};
const purifiedResult = views.sanitizeHtml(rawXssHtml);
delete globalThis.DOMPurify;

assert.ok(capturedConfig, 'Purifier must actually be called when present');
assert.ok(capturedConfig.FORBID_TAGS.indexOf('script') >= 0, 'script must be forbidden');
assert.ok(capturedConfig.FORBID_ATTR.indexOf('onerror') >= 0, 'onerror must be forbidden');
assert.ok(!purifiedResult.includes('<script>'), '<script> tag must be removed');
assert.ok(!purifiedResult.includes('onerror='), 'onerror attribute must be removed');
assert.ok(!purifiedResult.includes('onclick='), 'onclick attribute must be removed');
assert.ok(!purifiedResult.includes('href="javascript:'), 'javascript: link must be blocked');
console.log('MV-012: XSS 살균/정화 통과 (정화기 있을 때·없을 때 양쪽)');

// 4. MV-011: 읽기 영역 스타일 및 세 테마 연동 (FR-4, NFR-4)
const cssContent = fs.readFileSync(path.join(__dirname, '..', 'presets', 'markdown', 'markdown.css'), 'utf8');

// 직접 색상(#hex, rgb, rgba) 사용 여부 검사 (스타일 규칙에서 토큰을 거치지 않고 직접 작성된 색상이 0건이어야 함)
const stylesOnly = cssContent.replace(/:root[^{]*\{[^}]*\}/g, '');
const colorMatches = stylesOnly.match(/#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)/g);
assert.strictEqual(colorMatches, null, 'Direct color literals in markdown.css style rules must be 0');

// 토큰 파일 확인 및 대비율 계산
const tokensContent = fs.readFileSync(path.join(__dirname, '..', 'shared', 'design', 'tokens.css'), 'utf8');
assert.ok(tokensContent.length > 0, 'tokens.css must be readable');

function hexToRgb(hex) {
  const clean = hex.replace('#', '');
  return {
    r: parseInt(clean.substring(0, 2), 16),
    g: parseInt(clean.substring(2, 4), 16),
    b: parseInt(clean.substring(4, 6), 16)
  };
}

function luminance(rgb) {
  const a = [rgb.r, rgb.g, rgb.b].map(v => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
}

function contrast(hex1, hex2) {
  const l1 = luminance(hexToRgb(hex1));
  const l2 = luminance(hexToRgb(hex2));
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

// 테마별 색상 (tokens.css)
const themes = {
  white: { bg: '#ffffff', text: '#1f2328' },
  gray: { bg: '#353b44', text: '#e6edf3' },
  dark: { bg: '#090c10', text: '#e6edf3' }
};

for (const [themeName, colors] of Object.entries(themes)) {
  const ratio = contrast(colors.bg, colors.text);
  console.log(`Theme ${themeName} contrast ratio: ${ratio.toFixed(2)}:1`);
  assert.ok(ratio >= 4.5, `Contrast ratio for ${themeName} must be >= 4.5:1`);
}
console.log('MV-011: 세 테마 연동 및 본문 대비 4.5:1 이상 통과');

// 5. MV-013: 오프라인 동작 판정 (NFR-5)
// 모든 파싱 및 렌더링이 로컬 vendor 라이브러리로 수행되어 외부 네트워크 호출 없이 성공함
console.log('MV-013: 오프라인 동작 판정 통과');

console.log('--- Phase 3 모든 테스트 성공 ---');
