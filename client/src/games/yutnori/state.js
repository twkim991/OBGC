export function projectYutnoriState(state) {
  return {
    players: Object.fromEntries(
      Array.from(state.players?.entries?.() ?? []).map(([id, player]) => [
        id,
        {
          sessionId: player.sessionId,
          nickname: player.nickname,
          isHost: player.isHost,
          teamColor: player.teamColor,
          pieces: Array.from(player.pieces ?? [], (piece) => ({
            id: piece.id,
            position: piece.position,
            isStealth: piece.isStealth,
          })),
          skillCount: player.skillCount,
          activeSkill: player.activeSkill,
          usedSkillThisTurn: player.usedSkillThisTurn,
        },
      ])
    ),
    currentTurnId: state.currentTurnId,
    remainingThrows: Array.from(state.remainingThrows ?? []),
    gamePhase: state.gamePhase,
    winnerSessionId: state.winnerSessionId,
    titans: Array.from(state.titans ?? []),
  };
}
