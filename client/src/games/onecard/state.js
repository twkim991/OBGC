function projectCard(card) {
  if (!card || typeof card !== 'object') return null;

  return {
    id: typeof card.id === 'string' ? card.id : '',
    color: typeof card.color === 'string' ? card.color : '',
    type: typeof card.type === 'string' ? card.type : '',
    number: typeof card.number === 'number' ? card.number : 0,
  };
}

export function projectOneCardState(state) {
  return {
    players: Object.fromEntries(
      Array.from(state.players?.entries?.() ?? []).map(([id, player]) => [
        id,
        {
          sessionId: player.sessionId,
          nickname: player.nickname,
          isHost: player.isHost,
          handCount: player.handCount,
          alive: player.alive,
          bankrupt: player.bankrupt,
          rank: player.rank,
          shieldActive: player.shieldActive,
          shieldPendingExpire: player.shieldPendingExpire,
        },
      ])
    ),
    discardPile: Array.from(state.discardPile ?? [], projectCard).filter(Boolean),
    currentTurnId: state.currentTurnId,
    turnDeadlineAt: state.turnDeadlineAt || 0,
    direction: state.direction,
    gamePhase: state.gamePhase,
    currentColor: state.currentColor,
    pendingAttack: state.pendingAttack,
    winnerSessionId: state.winnerSessionId,
    rankings: Array.from(state.rankings ?? []),
    lastAction: state.lastAction,
    turnCount: state.turnCount,
  };
}
