export const DAVINCI_CODE_PROTOCOL = Object.freeze({
  version: 1,
  messages: Object.freeze({
    requestPrivateState: 'request_private_state',
    privateCode: 'private_code',
    startGame: 'start_game',
    chooseInitialColors: 'choose_initial_colors',
    drawTile: 'draw_tile',
    guessTile: 'guess_tile',
    stopGuessing: 'stop_guessing',
    returnToTable: 'return_to_table',
  }),
});
