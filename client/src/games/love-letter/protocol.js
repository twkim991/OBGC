export const LOVE_LETTER_PROTOCOL = Object.freeze({
  version: 2,
  messages: Object.freeze({
    requestPrivateState: 'request_private_state',
    privateHand: 'private_hand',
    privateReveal: 'private_reveal',
    startGame: 'start_game',
    drawCard: 'draw_card',
    playCard: 'play_card',
    resolveChancellor: 'resolve_chancellor',
    nextRound: 'next_round',
    returnToTable: 'return_to_table',
  }),
});
