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

## 2. 계획 외 개선

<!-- 사람의 요청 건마다 한 항목: 요청 · 조치 · 결과 · 검증 -->
