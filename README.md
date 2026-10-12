# 오늘 뭐 먹었지? — 함께 쓰는 음식 리뷰장

휴대폰에서도 사용할 수 있는 날짜별 음식 리뷰 웹사이트입니다.
- 음식 이름 + 작성자 이름
- 0~5점, 0.5점 단위 별점 (별점 없음 가능)
- 자유로운 글 리뷰
- 달력에서 날짜별 기록 확인
- 실시간 공유
- 작성자 본인의 리뷰 수정/삭제

## 구조
- `index.html`: 웹페이지 구조
- `style.css`: 모바일 반응형 디자인
- `script.js`: 달력, 리뷰 입력, Firebase 연결
- `config.js`: Firebase 웹 앱 설정값
- `firestore.rules`: Firestore 데이터 접근 규칙 예시

## 1. Firebase 설정 (공유 데이터 저장소)

1. https://console.firebase.google.com/ 에 접속하고 Google 계정으로 로그인합니다.
2. **프로젝트 추가**를 눌러 프로젝트를 만듭니다. 예: `our-food-diary`
3. 프로젝트 개요에서 웹 앱 아이콘 `</>`을 눌러 웹 앱을 등록합니다.
4. 표시되는 Firebase 설정값 중 `apiKey`, `authDomain`, `projectId`, `appId`를 복사합니다.
5. 이 폴더의 `config.js`를 열고 `여기에_...` 부분을 실제 값으로 바꿉니다.
   - `apiKey`: Firebase 설정의 apiKey
   - `authDomain`: 예) `our-food-diary.firebaseapp.com`
   - `projectId`: 프로젝트 ID
   - `appId`: Firebase 설정의 appId

## 2. 익명 로그인 켜기

1. Firebase Console → **Authentication** → 시작하기
2. **Sign-in method(로그인 방법)**에서 **Anonymous(익명)**를 활성화하고 저장합니다.

사이트 방문자는 이메일/비밀번호 가입 없이 브라우저에서 익명 사용자로 인증됩니다.
리뷰 작성자 이름은 자유 입력이므로 실제 이름 대신 별명 사용을 권장합니다.

## 3. Firestore 데이터베이스 만들기

1. Firebase Console → **Firestore Database** → 데이터베이스 만들기
2. 위치는 주 사용 지역과 가까운 곳을 선택합니다. (한 번 정하면 변경이 번거로우니 신중히 선택)
3. 데이터베이스가 생성되면 **Rules(규칙)** 탭으로 이동합니다.
4. 이 폴더의 `firestore.rules` 파일 내용을 Rules 편집기에 붙여 넣고 **게시(Publish)**를 누릅니다.

중요:
- 테스트 모드의 규칙을 그대로 사용하지 마세요.
- 규칙은 로그인한 방문자가 모든 리뷰를 읽을 수 있게 하고, 각 리뷰는 작성자 UID와 연결해 본인만 수정/삭제할 수 있도록 합니다.
- 익명 계정은 해당 브라우저의 사이트 데이터가 삭제되거나 브라우저 환경이 바뀌면 다른 UID로 인식될 수 있습니다. 따라서 작성한 리뷰의 수정/삭제 권한이 달라질 수 있습니다.
- 링크를 아는 사람은 사이트와 리뷰를 볼 수 있습니다. 비공개 일기나 민감한 정보는 올리지 마세요.

## 4. GitHub Pages에 배포

1. GitHub에서 새 저장소를 만듭니다. 예: `food-review-diary`
2. 가능하면 사이트 파일만 담은 별도 저장소를 만듭니다.
3. `index.html`, `style.css`, `script.js`, `config.js`를 저장소의 최상위(root)에 업로드합니다. `firestore.rules`와 `README.md`도 같이 올려도 됩니다.
4. 저장소의 **Settings → Pages**로 이동합니다.
5. **Build and deployment**의 Source에서 `Deploy from a branch`를 선택합니다.
6. Branch를 `main`, 폴더를 `/(root)`로 설정하고 Save를 누릅니다.
7. 몇 분 기다린 뒤 Settings → Pages에 표시되는 사이트 링크를 엽니다. 보통 `https://깃허브아이디.github.io/저장소이름/` 형태입니다.
8. 그 링크를 지인들에게 공유하면 됩니다.

## 5. 테스트 순서

1. Firebase 설정을 넣은 뒤 GitHub Pages 링크를 엽니다.
2. 음식 이름과 작성자 이름을 입력하고 별점을 선택해 저장합니다.
3. 다른 브라우저나 지인의 휴대폰에서 같은 링크를 열어 기록이 보이는지 확인합니다.
4. 작성자 본인의 브라우저에서 수정/삭제가 되는지 확인합니다.

## 참고 및 문제 해결

- `Firebase 설정이 필요해요`: `config.js`의 값을 확인하고, 변경한 파일을 GitHub에 다시 올립니다.
- `Firestore 보안 규칙` 오류: Authentication에서 Anonymous가 켜져 있는지, Firestore Rules가 게시되었는지 확인합니다.
- 설정을 변경한 뒤 예전 화면이 남아 있으면 페이지를 새로고침하거나 잠시 기다립니다.
- GitHub Pages는 정적 파일 호스팅입니다. 리뷰 공유는 Firebase Authentication + Firestore가 담당합니다.
- Firebase의 무료 사용량 한도 및 약관은 프로젝트 콘솔에서 확인하세요.

## 개인정보 안내
GitHub Pages로 배포한 웹사이트는 인터넷에서 공개적으로 열릴 수 있습니다. 사이트 링크를 아는 사람은 기록을 볼 수 있도록 만든 설계입니다. 별명 사용을 권장하고 개인정보를 기록하지 마세요.
