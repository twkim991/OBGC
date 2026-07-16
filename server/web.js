// Cafe24 호스팅을 위한 Entry Point 래퍼 스크립트
console.log(
  JSON.stringify({
    level: 'info',
    event: 'server.entrypoint_loaded',
    nodeVersion: process.version,
    configuredPort:
      typeof process.env.PORT === 'undefined' ? null : process.env.PORT,
  }),
);

try {
  require('./dist/main.js');
} catch (error) {
  console.error(
    JSON.stringify({
      level: 'error',
      event: 'server.entrypoint_failed',
      message: error && error.stack ? error.stack : String(error),
    }),
  );
  process.exitCode = 1;
}
