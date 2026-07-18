# OBGC
온라인에서 여러 보드게임을 즐길 수 있는 멀티플레이 플랫폼 프로젝트입니다.

## 1) 프로젝트 개요
OBGC는 **로비 → 테이블(대기실) → 실제 게임방** 흐름으로 동작합니다.

- 로비에서 방 목록을 실시간으로 조회/생성
- 테이블(대기실)에서 참여자 대기 및 게임 종류 선택
- 선택된 게임 전용 룸으로 전체 인원 이동
- 게임 종료 후 다시 테이블로 복귀하여 리매치 가능

## 2) 기술 스택

### Frontend (`client`)
- **Vue 3**: 화면 렌더링 및 상태 기반 UI 구성
- **Vite**: 개발 서버/번들링
- **colyseus.js**: 서버 Colyseus 룸과 WebSocket 통신

### Backend (`server`)
- **NestJS (TypeScript)**: 서버 애플리케이션 구조화
- **Colyseus**: 멀티플레이 룸/실시간 메시징/룸 매치메이킹
- **@colyseus/schema**: 룸 상태 동기화를 위한 스키마 정의
- **Jest + ts-jest + Supertest**: 단위/E2E 테스트

### 배포/서빙 구조
- NestJS의 `ServeStaticModule`을 통해 프론트 빌드 산출물(`client-dist`) 정적 서빙
- 게임 서버는 `main.ts`에서 Colyseus Room 타입을 등록하여 라우팅

## 3) 현재 지원하는 보드게임
현재 테이블에서 선택 가능한 게임은 아래 8종입니다.

1. **윷놀이 (`yutnori`)**
   - 커스텀 이동 규칙, 잡기, 스킬 시스템(예: 스텔스/거인 등) 포함
2. **메이플 원카드 (`onecard`)**
   - 공격 누적, 특수 카드 효과, 랭킹 처리 포함
3. **루미큐브 (`rummikub`)**
   - 30점 최초 등록, 그룹·런·조커, 보드 재배치와 점수 계산 포함
4. **다빈치 코드 (`davinci-code`)**
   - 검정·흰색 숫자 타일의 오름차순 단서를 이용한 코드 추리와 연속 추측 포함
5. **할리갈리 (`halli-galli`)**
   - 56장 클래식 과일 덱, 정확히 5개 종 판정, 오답 페널티와 2인 최종 라운드 포함
6. **러브레터 (`love-letter`)**
   - 최신판 21장 인물 덱, 카드 효과, 라운드·호감 토큰 승리와 2~6인 플레이 포함
   - 누적 공개 카드 기록을 제공하지 않아 플레이어가 직접 관찰하고 기억해 추리
7. **스플렌더 (`splendor`)**
   - 90장 개발 카드, 10명 귀족, 보석 수집·카드 예약·구매와 15점 최종 라운드 포함
   - 예약한 카드의 정체는 소유자에게만 공개하고 다른 플레이어에게는 장수만 표시
8. **로스트시티 (`lost-cities`)**
   - 5개 탐험대, 내기 카드와 오름차순 숫자 배치, 버림 더미 선택 드로우 포함
   - 공식 점수식과 8장 탐험 보너스를 적용해 2명이 3라운드 동안 누적 점수로 승부

### 메이플 원카드 브금(BGM) 파일 넣기
메이플 원카드 화면은 `/audio/maple-onecard-bgm.mp3`를 반복 재생하도록 되어 있습니다.

1. `client/public/audio` 폴더를 만듭니다. (없으면 생성)
2. 원하는 음원 파일을 `client/public/audio/maple-onecard-bgm.mp3` 이름으로 저장합니다.
3. 프론트 개발 서버를 다시 실행하면 게임 화면에서 자동으로 로드됩니다.

> 브라우저 자동재생 정책 때문에 최초 1회는 클릭/키 입력 같은 사용자 상호작용이 필요할 수 있습니다.

## 4) 로컬 실행 방법
루트에서 각각 설치/실행합니다.

```bash
# frontend
cd client
npm install
npm run dev

# backend
cd ../server
npm install
npm run start:dev
```

기본적으로 개발 환경에서 프론트는 `ws://localhost:8002`로 서버에 접속합니다.

## 5) 코드 테스트 방법
테스트는 현재 서버(`server`) 기준으로 구성되어 있습니다.

```bash
cd server

# 단위 테스트
npm run test

# e2e 테스트
npm run test:e2e

# 커버리지
npm run test:cov
```

추가로 코드 품질 점검/빌드 확인에 추천되는 명령어:

```bash
# 린트 자동수정
npm run lint

# 프로덕션 빌드
npm run build
```

## 6) Cafe24 Node.js 호스팅 배포

### 배포 저장소 구조

개발 소스와 Cafe24 실행 산출물은 서로 다른 Git 저장소로 관리합니다.

- 개발 저장소: `C:\WORK\OBGC`
- Cafe24 배포 저장소: `C:\WORK\bis2203_obgc_clean`
- Cafe24 진입점: 배포 저장소 루트의 `web.js`
- 서버 번들: `dist/main.js`
- 프론트 빌드: `client-dist`

`client-dist`는 NestJS `ServeStaticModule`에서 사용하는 고정 경로입니다. 과거 오타인
`clinet-dist`를 다시 만들거나 배포 대상으로 사용하지 마세요.

### 배포 산출물 준비

PowerShell에서 개발 저장소 루트를 기준으로 실행합니다.

```powershell
cd C:\WORK\OBGC
.\scripts\prepare-cafe24.ps1
```

스크립트는 다음 작업을 순서대로 수행합니다.

1. 개발·배포 저장소가 Git 저장소이며 변경사항이 없는지 확인
2. Vue 클라이언트와 NestJS 서버 빌드
3. NestJS 서버와 운영 의존성을 Node.js 14용 단일 JavaScript 번들로 생성
4. 이전 빌드 폴더를 제거하고 `client-dist`, `dist`를 완전 동기화
5. `web.js`와 의존성이 없는 Cafe24 전용 `package.json` 복사
6. 배포 저장소의 `node_modules`, `.npmrc`, `package-lock.json` 제거
7. 번들에 외부 운영 의존성이 남지 않았는지 확인
8. 배포본의 원본 커밋을 `SOURCE_COMMIT`에 기록

처음 실행하거나 의존성이 변경된 경우 개발 의존성도 다시 설치합니다.

```powershell
.\scripts\prepare-cafe24.ps1 -InstallSourceDependencies
```

기본적으로 커밋되지 않은 소스는 배포할 수 없습니다. 임시 확인용으로만
`-AllowDirtySource`를 사용할 수 있으며, 이 경우 `SOURCE_COMMIT` 뒤에 `-dirty`가 붙습니다.

스크립트는 테스트, Git commit, push, Cafe24 앱 재시작을 실행하지 않습니다.

### 변경사항 확인 및 배포

스크립트 완료 후 배포 저장소의 변경사항을 검토합니다.

```powershell
git -C C:\WORK\bis2203_obgc_clean status --short
git -C C:\WORK\bis2203_obgc_clean diff --check
git -C C:\WORK\bis2203_obgc_clean diff
```

문제가 없으면 `SOURCE_COMMIT`에 기록된 짧은 커밋 해시를 메시지에 넣어 배포 커밋을
생성하고 Cafe24의 `master` 브랜치로 push합니다.

```powershell
git -C C:\WORK\bis2203_obgc_clean add -A
git -C C:\WORK\bis2203_obgc_clean commit -m "deploy: <source-commit>"
git -C C:\WORK\bis2203_obgc_clean push origin master
```

push 후 Cafe24 나의서비스관리의 **앱 생성/관리**에서 앱을 **중지 → 실행**해야 변경사항이
반영됩니다. 앱 재시작 시 진행 중인 Colyseus 방과 게임이 종료되므로 이용자가 없을 때
배포하세요.

### 권장 확인 명령

프로젝트 정책상 배포 스크립트는 테스트를 자동 실행하지 않습니다. 배포 준비 전에 필요한
검증을 직접 실행하세요.

```powershell
cd C:\WORK\OBGC\server
npm test -- --runInBand
npm run test:e2e -- --runInBand
npm run build:cafe24

cd C:\WORK\OBGC\client
npm run build
```

## 7) 새 보드게임 추가(확장) 가이드
새 게임은 게임별 모듈을 만든 뒤 서버와 클라이언트 레지스트리에 한 번씩 연결합니다.
`main.ts`, 로비, 대기실, `App.vue`를 게임마다 직접 수정하지 않습니다.

### Step 1. 서버 게임 모듈 작성

`server/src/games/<game-id>`에 아래 역할을 분리합니다.

```text
definition.ts       # 룸 클래스와 메타데이터 결합
metadata.ts         # ID, 표시명, 인원, 프로토콜 버전
protocol.ts         # payload 런타임 검증
schema.ts           # 모든 사용자에게 공개할 Schema만 정의
domain/             # 네트워크와 무관한 순수 규칙 및 상태 전이
```

비공개 패, 덱, 타일은 Schema에 넣지 않고 서버 내부에 보관한 뒤 해당 플레이어에게만 전용
메시지로 전달합니다. 룸 클래스는 접속, 권한, 검증, 도메인 호출을 담당합니다.

게임 룸은 서버가 발급한 일회용 좌석 예약만 허용합니다. 예약된 참가자 전원이 실제로 연결된
뒤에만 `migrationReady`를 확정하며, 제한 시간 안에 모이지 못하면 새 룸을 종료해 기존
테이블에서 다시 시도할 수 있게 합니다.

### Step 2. 서버 레지스트리 연결

완성한 `GameDefinition`을 `server/src/games/registry.ts`의 `GAME_DEFINITIONS`에 추가합니다.
룸 등록, 인원 제한, 대기실 게임 변경, 공개 카탈로그는 이 정의를 사용합니다.

### Step 3. 클라이언트 게임 모듈 작성

`client/src/games/<game-id>`에 프로토콜 버전과 상태 투영 로직을 두고, 게임 화면은 작은 보드,
개인 패, 플레이어 패널, 컨트롤 컴포넌트로 분리합니다. 서버 Schema 전체를 JSON으로 복제하지
말고 화면에 필요한 공개 상태만 투영합니다.

### Step 4. 클라이언트 로더 연결

`client/src/games.js`의 `LOCAL_GAME_VIEWS`에 화면 로더와 시각 속성을 추가합니다. 서버
`/api/games` 카탈로그의 ID와 프로토콜 버전이 일치하는 게임만 로비와 대기실에 표시됩니다.

### Step 5. 검증 항목 추가

- 순수 도메인 규칙 및 상태 전이
- 잘못된 payload와 권한 없는 행동 거부
- 다른 플레이어의 비공개 상태가 전달되지 않음
- 좌석 예약의 만료, 변조, 재사용 거부
- 서버 카탈로그와 클라이언트 로더의 ID 및 프로토콜 버전 일치
- 게임 종료 후 예약 기반 테이블 복귀

## 8) 구현 시 체크리스트
- [ ] 공개 Schema에 다른 사용자의 패나 서버 덱이 없음
- [ ] 모든 메시지 payload에 런타임 검증과 크기 제한이 있음
- [ ] 서버 정의와 클라이언트 로더의 게임 ID 및 프로토콜 버전 일치
- [ ] 서버가 발급한 좌석 예약으로만 게임방 이동 가능
- [ ] 이동 실패 시 기존 방 연결 유지
- [ ] 재접속 후 본인의 개인 상태만 다시 수신
- [ ] 게임 종료 후 예약 기반으로 테이블 복귀 가능
- [ ] 서버 테스트와 빌드, 클라이언트 빌드 통과

상세한 단계와 완료 기준은 `doc/scalability_refactoring_plan.md`를 참고합니다.
