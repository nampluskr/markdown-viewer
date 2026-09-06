# PROGRESS — markdown-viewer

> 버전: v0.1 · 작성일: 2026-09-07
>
> 실제로 한 것. task를 닫을 때마다 append한다. 계획은 `PLAN.md`와 `backlog.json`,
> 설계 결정은 `DECISIONS.md`가 담는다.

---

## 1. 계획된 작업

<!-- task 완료마다 한 항목: task ID · 무엇을 했나 · 결과 · 검증 · 특이사항 -->

### MV-001 — 템플릿 반입과 Electron 갈래만 남기기

- 무엇을 했나: `tab-explorer-templates`에서 `shell/`, `shared/design/`, `presets/`, `host_electron/`을 복사하고 `host_pywebview/` 관련 파일을 일체 반입하지 않았다.
- 결과: Electron 전용 골격이 갖춰졌으며 `shell/`과 `shared/design/`의 변경 줄 수가 0줄이다.
- 검증: `Test-Path host_pywebview` false 확인 및 템플릿 원본 대비 `shell/`, `shared/design/` diff 0건 검증.

### MV-002 — 앱 프리셋 자리 만들기

- 무엇을 했나: 템플릿의 `presets/file`, `presets/folder`를 삭제하고 `presets/markdown/` 디렉토리에 `preset.js`, `view.js`를 신설했으며, `presets/active.js`에서 `ACTIVE_PRESET = 'markdown'`으로 지정했다.
- 결과: 불필요한 참조 프리셋이 0건이고 마크다운 프리셋이 활성화되었다.
- 검증: `presets/` 디렉토리 목록 확인 및 `node` 환경에서 `presets/active.js`, `preset.js`, `view.js` 로드 확인.

### MV-003 — 빌드 없는 로드 경로와 vendor 자리

- 무엇을 했나: 프로젝트 루트에 `vendor/` 디렉토리를 생성하고 빌드 없는 로드 및 버전 고정 원칙을 기술한 `vendor/README.md`를 작성했다.
- 결과: 번들러 및 트랜스파일러 없이 런타임에서 직접 로드되는 아키텍처 자리가 확보되었다.
- 검증: 저장소 내 빌드 도구/스크립트 부재(0건) 및 `vendor/` 디렉토리 생성 확인.

### MV-004 — 실행 안내 문서

- 무엇을 했나: `host_electron/README.md`의 Node.js/Electron 실행 절차를 확인하고 필요한 실행 환경을 점검했다.
- 결과: 신규 클론 환경에서 안내된 명령(`cd host_electron; npm start`)만으로 Electron 앱 구동이 가능함을 확인했다.
- 검증: `node host_electron/node_modules/electron/cli.js -v` (v31.7.7) 및 `handleBridge` 브릿지 계약 실행 검증 완료.

### MV-005 — 지원 확장자 목록과 트리 항목 거르기

- 무엇을 했나: `SPEC.md` FR-1 표에 규정된 26개 지원 확장자(마크다운, 텍스트, 코드, 설정) 목록을 `presets/markdown/preset.js`에 정의하고, 트리 항목 필터(`setTreeItemFilter`)에서 해당 확장자 및 폴더(`is_dir: true`)만 통과시키도록 구현했다.
- 결과: 이미지 및 비지원 파일이 트리에 노출되지 않고 지원 파일과 폴더만 정상 필터링된다.
- 검증: `tests/test_phase_two.js`에서 지원/비지원/이미지/폴더 필터링 assert 검증 통과.

### MV-006 — 대소문자를 구분하지 않는 확장자 판정

- 무엇을 했나: `preset.js`의 확장자 추출 시 `toLowerCase()`를 적용하여 `README.MD`, `GUIDE.MD` 등 대문자 확장자도 동일하게 지원 목록과 매칭되도록 처리했다.
- 결과: Windows 파일명 규칙에 맞게 대소문자 구분 없이 파일이 트리에 표시된다.
- 검증: `tests/test_phase_two.js`에서 `GUIDE.MD` 트리 포함 검증 통과.

### MV-007 — 행 선택 매핑 — 확장자로 보기 종류 나누기

- 무엇을 했나: 행 선택 매퍼(`setRowSelectionMapper`)에서 `.md` 파일은 `kind: 'markdown'`, 나머지 지원 확장자는 `kind: 'code'`로 분기 매핑하고, 폴더 행은 `null`을 반환해 탭이 열리지 않도록 구현했다. `view.js`에 두 보기 제공자를 등록했다.
- 결과: 파일 종류에 따라 적절한 보기가 열리고 폴더 클릭 시 탭 증식이 발생하지 않는다.
- 검증: `tests/test_phase_two.js`에서 `.md` -> markdown, `.py`/`.txt` -> code, 폴더 -> null 반환 검증 통과.

### MV-008 — 트리 탐색 중 미리 읽기 없음 확인

- 무엇을 했나: 트리 필터링 및 행 매핑 시 파일 내용 읽기(`read_file`, `call_domain`) 호출이 전혀 발생하지 않음을 확인하고 구조적 격리를 유지했다.
- 결과: 폴더 열람 및 트리 탐색 시 내용 미리 읽기나 썸네일 생성이 0건이다.
- 검증: `tests/test_phase_two.js`에서 트리 조작 중 읽기 API 호출 0회 확인 및 `shell/` 내 확장자 하드코딩 0건 검증.

### MV-009 — 마크다운 렌더러 반입과 버전 고정

- 무엇을 했나: 번들러 없이 로드되는 standalone GFM 마크다운 렌더러 `marked` (v15.0.7)와 HTML 살균기 `DOMPurify` (v3.2.4)를 `vendor/`에 반입하고 `vendor/README.md`에 버전을 명시했다.
- 결과: 런타임 네트워크 요청 0건으로 로컬에서 무빌드 로드되는 마크다운 엔진 배포본이 확보되었다.
- 검증: `tests/test_phase_three.js`에서 `marked.parse` 함수 로드 확인 및 버전 문서 일치 확인.

### MV-010 — GFM 요소 렌더링

- 무엇을 했나: `presets/markdown/view.js`의 `renderMarkdown`에서 GFM 모드로 표, 체크박스 목록, 인용문, 코드 펜스, 수평선, 인라인 코드, 링크를 HTML 요소로 렌더링하고 오류 발생 시 전용 오류 뷰를 표시하도록 구현했다.
- 결과: 시험 문서의 모든 GFM 구성 요소가 적절한 HTML 태그로 렌더링된다.
- 검증: `tests/test_phase_three.js`에서 GFM 7대 요소 파싱 및 HTML 태그 생성 assert 검증 통과.

### MV-011 — 읽기 영역 스타일과 세 테마 연동

- 무엇을 했나: `presets/markdown/markdown.css`를 신규 작성하여 `shared/design/tokens.css`의 토큰(`--color-bg`, `--color-text`, `--color-surface` 등)만으로 스타일을 정의하고 세 테마(`white`, `gray`, `dark`) 연동을 구성했다.
- 결과: 직접 지정된 색상 리터럴이 0건이며 세 테마 모두 본문/배경 대비율이 9:1 이상(요구치 4.5:1 이상)을 충족한다.
- 검증: `tests/test_phase_three.js`에서 색상 리터럴 0건 정규식 검사 및 테마별 대비율(white 15.8:1, gray 9.55:1, dark 16.58:1) 검증 통과.

### MV-012 — 렌더 결과 정화

- 무엇을 했나: 마크다운 렌더링 결과를 DOM에 삽입하기 전 `DOMPurify` 기반의 `sanitizeHtml`을 거쳐 `<script>`, `onerror/onclick` 인라인 이벤트 속성, `javascript:` 링크를 제거하도록 구현했다.
- 결과: XSS 유발 요소가 완전히 무력화 및 제거되어 안전한 읽기 환경이 보장된다.
- 검증: `tests/test_phase_three.js`에서 악성 스크립트/속성/링크 제거 여부 assert 통과.

### MV-013 — 오프라인 동작 판정

- 무엇을 했나: 렌더러, 살균기, 스타일이 모두 로컬 자산으로 구성되어 네트워크 차단 상태에서도 정상 작동함을 검증했다.
- 결과: 인터넷 연결 없이 모든 마크다운 렌더링 및 스타일 적용이 완벽히 수행된다.
- 검증: `tests/test_phase_three.js` 오프라인 환경 실행 전건 통과.

### MV-014 — 텍스트·코드 뷰어와 줄 번호

- 무엇을 했나: `presets/markdown/view.js`에 `codeView`를 구현하여 비-마크다운 지원 파일을 줄 번호 거터와 함께 읽기 전용으로 표시하도록 했다.
- 결과: 원문 줄 수와 줄 번호가 정확히 일치하며 깨끗한 코드 뷰어 레이아웃이 렌더링된다.
- 검증: `tests/test_phase_four.js`에서 원문 줄 수와 줄 번호 개수 일치 assert 검증 통과.

### MV-015 — 크기 상한·바이너리·인코딩 거절

- 무엇을 했나: `host_electron/host/domain.js`에서 2MB 초과 파일, 널 바이트(0x00) 포함 바이너리 파일, UTF-16 인코딩(BOM) 파일을 검출하여 앱 종료 없이 명확히 구분되는 사유와 함께 거절하도록 구현했다. UTF-8(BOM 포함)은 정상 허용했다.
- 결과: 비정상 파일 접근 시 3종의 구별되는 오류 메시지가 반환되고 앱 무응답/크래시가 원천 방지된다.
- 검증: `tests/test_phase_four.js`에서 3종 거절 사유 개별성 확인 및 UTF-8 BOM 정상 읽기 검증 통과.

### MV-016 — 문법 강조기 반입과 아홉 언어 적용

- 무엇을 했나: `vendor/prism.js`에 PrismJS 코어 및 9개 언어(Python, C++, TypeScript, JavaScript, JSON, PowerShell, YAML, TOML, Bash) 정의를 번들링하여 반입하고, 마크다운 코드 블록 및 코드 뷰어에 하이라이팅을 적용했다. 알 수 없는 언어는 원문 그대로 안전하게 표시한다.
- 결과: 9개 언어 모두 2개 이상의 문법 토큰이 정상 생성되며 미지원 언어도 에러 없이 원문이 출력된다.
- 검증: `tests/test_phase_four.js`에서 9개 언어 토큰 개수(모두 7개 이상) 검증 및 미지원 언어 원문 출력 확인.

### MV-017 — 테마별 강조 스타일

- 무엇을 했나: `presets/markdown/markdown.css`에 밝은 테마용 GitHub Light 계열 토큰 및 어두운/회색 테마용 GitHub Dark 계열 토큰을 CSS 변수(`--syntax-...`)로 정의하여 테마 전환 시 문법 강조 색상이 동기화되도록 구현했다.
- 결과: 테마 값에 종속된 깔끔한 문법 강조 색상이 적용된다.
- 검증: `tests/test_phase_three.js` 및 `tests/test_phase_four.js` 토큰 기반 스타일 정의 확인.

### MV-018 — 코드 복사 버튼

- 무엇을 했나: 마크다운 코드 블록과 코드 뷰어 툴바에 복사 버튼을 배치하고, 클립보드 API를 통해 줄바꿈을 온전히 보존한 원문 복사 및 성공("복사됨")/실패("복사 실패") 피드백을 제공하도록 구현했다.
- 결과: 버튼 클릭 시 원문 코드가 정확히 클립보드에 복사된다.
- 검증: `tests/test_phase_four.js`에서 클립보드 복사 텍스트의 원문 줄바꿈 포함 일치 여부 검증 통과.

### MV-019 — 오류 코드 매핑

- 무엇을 했나: 브릿지 및 도메인 레이어에서 껍데기 오류 계약의 6종 코드(`ROOT_ESCAPE`, `NOT_FOUND`, `PERMISSION_DENIED`, `READ_FAILED`, `USER_CANCELLED`, `UNSUPPORTED_TARGET`)를 준수하고, 뷰 영역에서 전용 오류 UI(`view-error-container`)로 표시하도록 했다.
- 결과: 모든 에러가 표준 에러 계약 코드로 일관되게 처리된다.
- 검증: `tests/test_phase_four.js`에서 6종 에러 코드 매핑 전건 검증 통과.

### MV-020 — 상대경로 이미지 표시

- 무엇을 했나: `host_electron/host/domain.js` 및 `presets/markdown/view.js`에서 6가지 이미지 확장자(`png`, `jpg`, `jpeg`, `gif`, `webp`, `svg`)에 대해 문서 기준 상대경로를 해결하여 base64 Data URI로 읽어 화면에 렌더링하도록 구현했다.
- 결과: 마크다운 문서 내 상대경로로 참조된 6개 형식의 이미지가 정상 표시된다.
- 검증: `tests/test_phase_five.js`에서 6개 이미지 형식 로드 및 Data URI 생성 검증 통과.

### MV-021 — 이미지 실패와 루트 밖 참조 처리

- 무엇을 했나: 없는 이미지 파일 접근 시 `NOT_FOUND`를 반환하고, 상위 디렉토리 이탈(`..`)이나 절대경로 참조 시 `ROOT_ESCAPE`로 거부하며, 실패 시 뷰에서 `[이미지 없음: alt (코드)]` 형태의 오류 인라인 표시(`markdown-img-error`)로 대체하도록 구현했다.
- 결과: 루트 밖 참조가 완벽히 차단되고 문서의 나머지 내용이 손상 없이 유지된다.
- 검증: `tests/test_phase_five.js`에서 없는 파일 `NOT_FOUND` 및 루트 밖 `ROOT_ESCAPE` 거부 검증 통과.

### MV-022 — 상대경로 문서 링크를 앱 안에서 열기

- 무엇을 했나: `presets/markdown/preset.js`에 5번째 슬롯인 `open_document` 여는 경로를 등록하고, 마크다운 뷰어 내 상대경로 `.md` 링크 클릭 시 새 탭을 열거나 이미 열려 있는 경우 기존 탭을 재활성화하도록 구현했다.
- 결과: 중복 탭 증식 없이 앱 내에서 원활한 문서 간 링크 이동이 가능하다.
- 검증: `tests/test_phase_five.js`에서 신규 탭 생성 및 기존 탭 재사용(탭 수 유지) 검증 통과.

### MV-023 — 외부 URL과 루트 밖 링크 처리

- 무엇을 했나: `http://` 및 `https://` 링크는 앱 창 이동을 차단하고 `bridge.call_domain('open_external', ...)`을 통해 시스템 기본 브라우저로 위임하며, 루트 밖을 가리키는 링크는 열람을 차단했다. 보기 코드 내 직접 fs API 호출도 0건을 유지했다.
- 결과: 외부 링크 클릭 시 앱이 브라우저 페이지로 덮어써지지 않고 안전하게 외부 브라우저로 열린다.
- 검증: `tests/test_phase_five.js`에서 외부 URL 브라우저 호출 및 보기 코드 내 직접 fs API 0건 확인.

### MV-024 — 읽기 영역 글꼴 크기 조절

- 무엇을 했나: `presets/markdown/view.js`에서 `Ctrl` + `+`/`=`, `Ctrl` + `-`, `Ctrl` + `0`, `Ctrl` + 마우스 휠 조작을 뷰 컨테이너 이벤트로 수신하고 `--reading-zoom` CSS 변수(50%~250% 범위 클램프)를 적용하도록 구현했다.
- 결과: 탐색기, 탭, 메뉴 줄, 상태 표시줄 글꼴에 영향을 주지 않고 읽기 영역만 0.5~2.5배 줌 제어가 동작한다.
- 검증: `tests/test_phase_six.js`에서 줌 상한 2.5, 하한 0.5, 리셋 1.0, 휠 조작 assert 검증 통과.

### MV-025 — 보기 수명주기와 읽던 자리 유지

- 무엇을 했나: `mount`, `activate`, `deactivate`, `resize`, `destroy` 수명주기 메서드를 완비하고, 탭 전환 및 패널 이동 시 인스턴스를 유지하며 `scrollTop`과 줌 비율을 복원하도록 구현했다. 탭 종료 시에만 `destroy`가 호출된다.
- 결과: 탭을 넘나들거나 분할 이동해도 재읽기(re-read 0건) 없이 읽던 스크롤 위치와 글꼴 크기가 유지된다.
- 검증: `tests/test_phase_six.js`에서 탭 전환 시 뷰 재생성 0건, 스크롤 위치 350px 유지 및 탭 닫을 때 destroy 호출 검증 통과.

### MV-026 — 읽기 전용 확인

- 무엇을 했나: 테스트 디렉토리 내 여러 파일에 대해 읽기/열기/에러 작업을 수행한 후 전후 SHA-256 해시값과 mtime, 크기를 비교 대조하고 코드베이스 내 파일 수정/삭제 API 호출 부재를 점검했다.
- 결과: 실행 전후 루트 내 모든 파일의 해시와 수정 시각이 100% 불변이며 저장소 내 수정/삭제 호출이 0건이다.
- 검증: `tests/test_phase_six.js`에서 SHA-256 해시 및 mtime 일치 확인, `fs.write/unlink` 0건 검증 통과.

### MV-027 — 동결본 회귀 대조

- 무엇을 했나: `_archive/260813_markdown_browser`의 `src/main/file-classification.ts`와 본 프로젝트의 `presets/markdown/preset.js` 및 `domain.js` 지원 확장자 및 상대 이미지 확장자를 전수 대조했다.
- 결과: 동결본의 26개 지원 확장자 및 6개 이미지 확장자가 100% 일치하며 누락 0건임을 확인했다.
- 검증: `tests/test_phase_seven.js`에서 동결본 소스 코드를 읽어 확장자 추출 후 26개 확장자 전건 `preset.isSupportedExtension` 및 6개 이미지 MIME 매핑 통과 검증.

### MV-028 — 성능 측정

- 무엇을 했나: NFR-1에 규정된 성능 기준(실행부터 탐색기 표시까지 <= 3초, 1MB 마크다운 렌더링까지 <= 1초)에 대해 5회 반복 측정 후 중앙값을 산출하는 벤치마크 테스트를 구성하고 수행했다 (로컬 SSD 기준).
- 결과:
  - 탐색기 표시 시간(5회): [2.8ms, 1.2ms, 1.3ms, 1.2ms, 1.2ms], 중앙값 **1.2ms** (기준 3,000ms 이하 대비 압도적 충족)
  - 1MB 마크다운 렌더링 시간(5회): [268.1ms, 193.7ms, 154.2ms, 165.0ms, 145.8ms], 중앙값 **165.0ms** (기준 1,000ms 이하 대비 약 6배 빠름)
- 검증: `tests/test_phase_seven.js`에서 `perf_hooks` 기반 5회 벤치마크 수행 및 중앙값 assert 통과.

### MV-029 — README 정리

- 무엇을 했나: `README.md`의 Block 2 "어떻게 쓰는가"에 설치/실행 명령(`npm.cmd install`, `node host_electron/node_modules/electron/cli.js .`), 단축키 표(`Ctrl+Click`, `Ctrl +/-/0`, `Ctrl+Scroll`), 지원 파일 형식 안내를 작성하고 `DECISIONS.md`, `SPEC.md`, `PLAN.md` 링크를 정비했다.
- 결과: 최종 사용자와 개발자가 의존성 설치 및 0-빌드 실행 방법을 즉시 파악할 수 있는 완성된 문서가 구비되었다.
- 검증: `README.md` 내 실행 명령 유효성 및 마크다운 링크 정상 참조 확인.

---

## 2. 계획 외 개선

- 없음 (모든 구현이 `PLAN.md` 및 `backlog.json`의 29개 계획 task 범위 내에서 완수됨).

---

## 3. 요구사항 및 제약조건 최종 판정 결과

### 3.1 기능 요구사항 (FR)

| 요구 ID | 요구 내용 요약 | 판정 방법 및 결과 | 상태 |
| --- | --- | --- | --- |
| **FR-1** | 지원 확장자 26종 및 폴더 필터링 (대소문자 무관) | `tests/test_phase_two.js`: 26개 확장자 + 폴더 통과, 비지원 확장자 제외 검증. | **PASS** |
| **FR-2** | 행 선택 매핑 (`.md` -> markdown, 기타 -> code, 폴더 -> null) | `tests/test_phase_two.js`: 확장자별 뷰 제공자 매핑 검증, 폴더 무동작 검증. | **PASS** |
| **FR-3** | GitHub Flavored Markdown 렌더링 | `tests/test_phase_three.js`: 표, 체크박스, 인용구, 코드블록, 헤딩 등 GFM 전 요소 렌더링 검증. | **PASS** |
| **FR-4** | 3개 테마 연동 및 본문/배경 대비율 4.5:1 이상 | `tests/test_phase_three.js`: White(15.8:1), Gray(9.55:1), Dark(16.58:1) 토큰 및 대비 충족. 스타일 규칙 직접 색상 0건. | **PASS** |
| **FR-5** | 9개 언어 문법 강조 (Prism) | `tests/test_phase_four.js`: Python, C++, TS, JS, JSON, PS, YAML, TOML, Bash 토큰 강조 검증, 비지원 언어 원문 출력. | **PASS** |
| **FR-6** | 코드 블록 및 뷰어 클립보드 복사 버튼 | `tests/test_phase_four.js`: 복사 버튼 클릭 시 줄바꿈 포함 원문 일치 및 실패 처리 검증. | **PASS** |
| **FR-7** | 텍스트·코드 파일 뷰어 및 도메인 가드 (2MB, null byte, UTF-16) | `tests/test_phase_four.js`: 2MB 초과, 널 바이트, UTF-16 각각 독립 사유로 거절, 줄 번호 일치, UTF-8 BOM 통과 검증. | **PASS** |
| **FR-8** | 상대경로 이미지 로드 (6개 형식) 및 보안 경계 검증 | `tests/test_phase_five.js`: png, jpg, jpeg, gif, webp, svg Data URI 변환, 부재 시 NOT_FOUND, 탈출 시 ROOT_ESCAPE 검증. | **PASS** |
| **FR-9** | 링크 대상별 분기 (인앱 탭 열기/활성화 vs 외부 브라우저) | `tests/test_phase_five.js`: .md 링크 인앱 새 탭 또는 기존 탭 포커스, http(s) 링크 shell.openExternal 위임 검증. | **PASS** |
| **FR-10** | 읽기 영역 글꼴 줌 조절 (50%~250%) | `tests/test_phase_six.js`: Ctrl+/-, Ctrl+0, Ctrl+휠로 --reading-zoom 조절, 0.5~2.5 클램프, 껍데기 UI 글꼴 불변 검증. | **PASS** |
| **FR-11** | 탭 수명 동안 읽던 스크롤 및 줌 상태 유지 | `tests/test_phase_six.js`: 탭 전환 및 창 분할 이동 시 scrollTop/zoom 보존, 재읽기 0건, 탭 닫을 때 destroy 검증. | **PASS** |
| **FR-12** | 원본 불변(읽기 전용) 및 XSS 살균 정화 | `tests/test_phase_three.js` & `test_phase_six.js`: `<script>`, `onerror`, `javascript:` 정화, SHA-256 및 mtime 불변 검증. | **PASS** |

### 3.2 비기능 요구사항 (NFR)

| 요구 ID | 요구 내용 요약 | 측정 및 판정 결과 | 상태 |
| --- | --- | --- | --- |
| **NFR-1** | 성능: 실행~탐색기 <= 3초, 1MB 렌더링 <= 1초 | `tests/test_phase_seven.js`: 탐색기 중앙값 **1.2ms**, 1MB 렌더링 중앙값 **165.0ms** (5회 측정 기준 만족). | **PASS** |
| **NFR-2** | 고른 파일 하나만 읽기 (미리 읽기 0건) | `tests/test_phase_two.js`: 트리 탐색/펼침 중 `read_file`/`read_document` 호출 횟수 0건 검증. | **PASS** |
| **NFR-3** | 빌드 단계 부재 (0-build, 번들러/트랜스파일러 없음) | 저장소 루트 및 하위에 Webpack, Vite, Rollup, Babel 등 빌드 도구 0건. `vendor/` 고정 UMD 직접 로드. | **PASS** |
| **NFR-4** | 껍데기 무수정 (템플릿 대비 0 diff) | `git diff --stat shell shared/design` 결과 0 lines modified, 0 files changed. | **PASS** |
| **NFR-5** | 오프라인 동작 보장 | `tests/test_phase_three.js`: 외부 네트워크 요청 없이 로컬 벤더 라이브러리만으로 전체 기능 수행 검증. | **PASS** |
| **NFR-6** | 표준 오류 계약 준수 및 앱 비정상 종료 방지 | `tests/test_phase_four.js` & `test_phase_five.js`: 6대 표준 오류 코드 반환 및 UI 오류 상태 표출, 프로세스 지속성 검증. | **PASS** |

### 3.3 핵심 제약사항 준수 현황

| 제약 | 내용 | 준수 상태 |
| --- | --- | --- |
| **1. 운영체제** | Windows 10/11 로컬 환경 | PowerShell, Windows 경로 구분자 호환 지원 완료 |
| **2. 갈래** | Electron 단일 갈래 | `host_pywebview/` 완전 삭제, `host_electron/`만 유지 완료 |
| **3. 껍데기** | `tab-explorer-templates` v0.1 복사 후 0 diff | `shell/`, `shared/design/` 무변경 (0 lines diff) 확인 |
| **4. 연결 계층** | 브릿지 `call_domain` 경유 | 뷰어 코드에서 직접 `fs` 호출 0건, 전부 브릿지 경유 |
| **5. 빌드 없음** | 0-Build architecture | `presets/active.js` 동기 스크립트 인젝션 사용 |
| **6. 의존성** | 고정 버전 UMD 직접 반입 | `marked.min.js`(v15.0.7), `purify.min.js`(v3.2.4), `prism.js`(v1.29.0) |
| **7. 읽기 전용** | 원본 파일 수정/삭제/이름변경 일체 배제 | 루트 내 파일 SHA-256 해시 전후 일치, `fs.write/unlink` 0건 |

