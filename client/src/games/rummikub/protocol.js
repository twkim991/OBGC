export const RUMMIKUB_PROTOCOL = Object.freeze({
  version: 1,
  messages: Object.freeze({
    requestPrivateState: 'request_private_state',
    privateRack: 'private_rack',
    startGame: 'start_game',
    commitTurn: 'commit_turn',
    drawTile: 'draw_tile',
    passTurn: 'pass_turn',
    returnToTable: 'return_to_table',
  }),
});

