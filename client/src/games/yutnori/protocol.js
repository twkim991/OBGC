export const YUTNORI_PROTOCOL = Object.freeze({
  version: 1,
  messages: Object.freeze({
    requestPrivateState: 'request_private_state',
    privateSkills: 'private_skills',
    startGame: 'start_game',
    throwYut: 'throw_yut',
    movePiece: 'move_piece',
    activateSkill: 'activate_skill',
    returnToTable: 'return_to_table',
  }),
});
