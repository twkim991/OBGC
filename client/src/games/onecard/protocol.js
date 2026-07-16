export const ONECARD_PROTOCOL = Object.freeze({
  version: 1,
  messages: Object.freeze({
    requestPrivateState: 'request_private_state',
    privateHand: 'private_hand',
    playCard: 'play_card',
    drawCard: 'draw_card',
    startGame: 'start_game',
    returnToTable: 'return_to_table',
  }),
});
