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
현재 테이블에서 선택 가능한 게임은 아래 2종입니다.

1. **윷놀이 (`yutnori`)**
   - 커스텀 이동 규칙, 잡기, 스킬 시스템(예: 스텔스/거인 등) 포함
2. **메이플 원카드 (`onecard`)**
   - 공격 누적, 특수 카드 효과, 랭킹 처리 포함

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

## 6) 새 보드게임 추가(확장) 가이드
아래 순서대로 구현하면 기존 구조와 가장 자연스럽게 연결됩니다.

### Step 1. 서버 게임 룸 클래스 추가
`server/src/rooms`에 `NewGameRoom.ts`를 추가합니다.

핵심 구현 포인트:
- `Room<NewGameState>` 상속
- `onCreate`, `onJoin`, `onLeave` 구현
- `this.setState(...)`로 스키마 상태 초기화
- 필요한 메시지 이벤트(`this.onMessage('...')`) 정의
- 게임 종료 시 `move_room` 이벤트로 테이블 복귀 시나리오 지원

### Step 2. 서버 메인 등록
`server/src/main.ts`에서 게임 룸을 등록합니다.

예시:
```ts
gameServer.define('newgame', NewGameRoom);
```

> `define`에 넣는 문자열(`newgame`)이 클라이언트에서 사용하는 게임 타입 키가 됩니다.

### Step 3. 대기실 게임 선택 목록 추가
`client/src/components/TableRoomView.vue`의 게임 선택 `<select>`에 옵션을 추가합니다.

예시:
```html
<option value="newgame">새 게임 이름</option>
```

방장이 `start_game` 메시지로 보낸 값이 그대로 서버 `matchMaker.createRoom(selectedGame)`에 전달되므로,
옵션 value는 `main.ts`의 `define('newgame', ...)` 키와 반드시 일치해야 합니다.

### Step 4. 게임 UI 컴포넌트 추가
`client/src/components/games/NewGameView.vue`를 추가합니다.

구현 포인트:
- `props.gameConnection` 수신
- `onStateChange`로 서버 상태 반영
- `onMessage('chat')`, `onMessage('move_room')` 등 이벤트 처리
- 게임 액션 시 `gameConnection.send('event_name', payload)` 호출

### Step 5. App 동적 라우팅 맵 등록
`client/src/App.vue`의 `games` 맵에 동적 컴포넌트를 등록합니다.

예시:
```js
const games = {
  yutnori: defineAsyncComponent(() => import('./components/games/YutnoriView.vue')),
  onecard: defineAsyncComponent(() => import('./components/games/MapleOneCardView.vue')),
  newgame: defineAsyncComponent(() => import('./components/games/NewGameView.vue')),
};
```

### Step 6. (권장) 테스트 추가
서버 룸 로직은 룰이 복잡해지기 쉬우므로 최소 아래를 권장합니다.

- 턴 전환/승패 판정 단위 테스트
- 불법 액션 차단 테스트(내 턴 아님, 잘못된 카드/말 선택 등)
- 게임 종료 후 리턴 룸 이동 메시지 테스트

## 7) 구현 시 체크리스트
- [ ] 서버 룸 키(`define`)와 클라이언트 선택 값(`option value`) 일치
- [ ] 게임방 입장 후 `onStateChange`가 정상적으로 화면 갱신
- [ ] 게임 종료 시 `move_room` 이벤트로 테이블 복귀 가능
- [ ] 서버 테스트(`test`, `test:e2e`) 통과

---
필요 시 다음 단계로, 게임별 공통 인터페이스(예: `BaseGameRoom`, 공통 이벤트 타입)를 도입해
새 게임 추가 비용을 더 낮출 수 있습니다.
