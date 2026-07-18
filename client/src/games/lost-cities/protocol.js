export const LOST_CITIES_PROTOCOL = Object.freeze({
  version: 1,
  messages: Object.freeze({
    requestPrivateState: 'request_private_state',
    privateHand: 'private_hand',
    startGame: 'start_game',
    playCard: 'play_card',
    drawCard: 'draw_card',
    nextRound: 'next_round',
    returnToTable: 'return_to_table',
  }),
});

