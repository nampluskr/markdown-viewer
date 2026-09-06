# host_electron

Python/NumPy 연계가 필요 없는 환경을 위한 Electron 갈래다.

## 실행 방법

Node.js(v18 이상)가 필요하다. 최초 1회 의존성을 설치한다.

```powershell
cd host_electron
npm install
```

이후 실행한다.

```powershell
npm start
```

## 조합키

껍데기가 예약하는 것은 아래 열한 가지뿐이다 (FR-25). 그 밖의 `Ctrl`·`Alt` 조합은
예약하지 않고 보기에 그대로 전달한다. 열두 가지 기능 모두 눌러서 닿는 자리도 함께
있으므로, 조합키로만 닿는 기능은 없다 (NFR-5).

| 조합키 | 하는 일 | 눌러서 닿는 자리 |
| --- | --- | --- |
| `F11` | Zen 모드 켜고 끄기 | 메뉴 줄 오른쪽 Zen 버튼 · `View > Zen Mode` |
| `Esc` | 열린 메뉴 닫기 (없으면 Zen 해제) | 메뉴 바깥 누르기 |
| `Ctrl+O` | 폴더 열기 | 탐색기 머리글 열기 버튼 · `File > Open Folder...` |
| `Ctrl+W` | 활성 탭 닫기 | 탭의 닫기 버튼 · `File > Close Tab` |
| `Ctrl+B` | 탐색기 접고 펴기 | 세로 띠 위쪽 탐색기 버튼 · `View > Show Sidebar` |
| `Ctrl+\` | 보기 영역 가르기 | 탭 줄 오른쪽 가르기 버튼 · `File > Split Editor` |
| `F5` | 새로 읽기 | 탐색기 머리글 새로 읽기 버튼 |
| `Alt+F4` | 창 닫기 | 메뉴 줄 오른쪽 닫기 버튼 · `File > Exit` |
| `Tab` / `Shift+Tab` | 초점 영역 순환 | 각 영역을 눌러서 초점 옮기기 |
| `Ctrl+Tab` / `Ctrl+Shift+Tab` | 조각 안에서 탭 넘기기 | 탭을 눌러서 전환 |

`F6`(탭을 반대쪽 조각으로 옮기기)은 `File > Move Tab`으로도 닿는다.

## 동작 원리

- `host/main.js`가 상위의 `shell/index.html`을 `BrowserWindow.loadFile`로 직접 로드한다.
- 껍데기(`shell/`)와 디자인 파일(`shared/design/`)은 갈래 폴더 밖에 한 벌로 두고, 번들러/트랜스파일러 없이 그대로 로드된다. 다른 갈래(`host_*`)가 함께 있다면 같은 파일을 가리킨다.
- 이 갈래를 쓰지 않는 프로젝트는 `host_electron/` 폴더를 통째로 삭제해도 pywebview 갈래 실행에 영향이 없다.