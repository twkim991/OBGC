import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      // 추가된 부분: Vite가 모듈을 뜯어보지 못하게 브라우저용 완성본으로 우회시킴
      'colyseus.js': 'colyseus.js/dist/colyseus.js',
    },
  },
});
