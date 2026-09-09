# CLAUDE.md

## 프로젝트
"우리집 가계부" — 바닐라 HTML/CSS/JS로 만든 가계부 웹앱. 빌드 도구 없이 `index.html` / `style.css` / `script.js` 정적 파일로 구성되며, 데이터는 브라우저 localStorage에 저장한다. Chart.js(cdnjs UMD), Google Fonts(Jua, Gowun Dodum)를 외부 리소스로 사용한다.

## Git 워크플로우
- 이 저장소에서 기능 추가, 버그 수정 등 의미 있는 작업 단위가 끝날 때마다, 매번 확인을 구하지 않고 자동으로 `git commit` 하고 `origin/master`로 `push`한다.
- 커밋 메시지는 무엇을 왜 바꿨는지 간결하게 요약한다.
- 오타 수정 등 사소한 실험적 변경까지 매번 커밋할 필요는 없다 — 하나의 완결된 작업 단위 기준으로 커밋한다.
- 사용자가 특정 변경에 대해 "커밋하지 마" 등으로 예외를 요청하면 그 요청을 우선한다.
