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
    discardPile: Array.from(state.discardPile ?? [], (card) => ({
      id: card.id,
      color: card.color,
      type: card.type,
      number: card.number,
    })),
    currentTurnId: state.currentTurnId,
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
