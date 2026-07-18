export const SPLENDOR_PROTOCOL = Object.freeze({
  version: 1,
  messages: Object.freeze({
    requestPrivateState: 'request_private_state',
    privateReservations: 'private_reservations',
    startGame: 'start_game',
    takeGems: 'take_gems',
    reserveCard: 'reserve_card',
    purchaseCard: 'purchase_card',
    returnTokens: 'return_tokens',
    chooseNoble: 'choose_noble',
    returnToTable: 'return_to_table',
  }),
});
