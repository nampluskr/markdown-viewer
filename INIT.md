# INIT — 이 프로젝트를 초기화할 에이전트에게

이 폴더는 기획 5종과 `README.md`를 갖춘 채 착수 직전 상태로 놓여 있다.
초기화 절차는 여기 적지 않는다. **아래 가이드를 읽고 그대로 실행한다.**

```
D:\projects\project-workflow\docs\INIT.md
```

절차 문서를 이 폴더로 복사하지 않는다. 원본이 갱신돼도 옛 사본을 따르게 된다.

---

## 지금 상태

| 항목 | 상태 |
| --- | --- |
| 경우 | **A — 신규 프로젝트** (`v0.1`). `docs/current/`가 없다 |
| 문서 | `BRIEF.md` · `DECISIONS.md` · `SPEC.md` · `PLAN.md` · `backlog.json` · `README.md`가 루트에 있다 |
| 버전 표기 | 네 문서 모두 `v0.1 · 2026-09-07`, `backlog.json`의 `meta.note`가 `markdown-viewer v0.1` |
| `backlog validate` | 통과 확인함 (task 29건, `MV-001`~`MV-029`, `P1`~`P7`) |
| git | 저장소가 아직 없다. `git init`은 초기화 절차가 한다 |
| GitHub | `origin` 없음. 만들 때 저장소명은 폴더명과 같은 `markdown-viewer` |
| `README.md` | 1번 블럭만 채워져 있다. "어떻게 쓰는가"는 버전 마감 때 채운다 |

`INIT.md`(이 파일)는 5종에 속하지 않는다. `docs/current/`로 옮기지 않는다.

---

## 구현 전에 알아야 할 것

- **껍데기는 `D:\projects\tab-explorer-templates`를 복사해 쓴다**(`DECISIONS.md` D-2).
  `shell/`과 `shared/design/`은 고치지 않는다. 앱 코드는 `presets/markdown/`,
  보기 컴포넌트, `host_electron/`의 도메인 계층에만 둔다.
- **Electron 갈래만 남긴다**(D-3). 복사 후 `host_pywebview/`를 지운다.
- **빌드 단계를 넣지 않는다**(D-5, 제약 5). 마크다운 렌더러와 문법 강조기는 빌드 없이
  로드되는 배포본을 `vendor/`에 버전 고정해 반입한다.
- **범위는 `_archive\260813_markdown_browser\` v0.2가 구현한 열람 기능까지다**(D-7).
  이미지 단독 보기와 Jupyter Notebook은 이번 버전에 넣지 않는다(`SPEC.md` 4절).
- 동결본은 참고 자료다. 코드를 그대로 옮기지 않는다.

---

## 초기화가 끝난 뒤

`PLAN.md`의 Phase 1부터 한 Phase씩 진행한다. task를 닫을 때마다
`docs/current/PROGRESS.md`에 무엇을·결과·검증을 남긴다. 계획 밖 작업은 `backlog.json`에
추가하지 않고 `PROGRESS.md`의 "계획 외 개선"에 적는다.
