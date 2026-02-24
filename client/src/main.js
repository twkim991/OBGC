import { createApp } from 'vue';
import './style.css';
import App from './App.vue';

createApp(App).mount('#app');

import { Client } from 'colyseus.js';

// 개발 환경(Vite 기본 포트 5173)에서는 3000번 포트를 직접 바라보게 하고,
// 배포 환경에서는 같은 호스트를 바라보도록 설정합니다.
const endpoint = import.meta.env.DEV ? 'ws://localhost:3000' : `ws://${window.location.host}`;

const client = new Client(endpoint);

// 연결 테스트용 (방이 없으므로 에러가 나는 것이 정상입니다)
client
  .joinOrCreate('chat_lobby')
  .then((room) => {
    console.log('로비에 성공적으로 접속했습니다!', room.sessionId);
  })
  .catch((e) => {
    console.log('접속 에러 (아직 서버에 방을 안 만들어서 정상입니다):', e);
  });
