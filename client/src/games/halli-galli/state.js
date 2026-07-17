const projectCard = (card) => ({
  id: card?.id || '',
  fruit: card?.fruit || '',
  count: card?.count || 0,
});

export function projectHalliGalliState(state) {
  return {
    players: Object.fromEntries(
      Array.from(state.players?.entries?.() ?? []).map(([id, player]) => [
        id,
        {
          sessionId: player.sessionId,
          nickname: player.nickname,
          isHost: player.isHost,
          connected: player.connected,
          eliminated: player.eliminated,
          deckCount: player.deckCount,
          faceUpCount: player.faceUpCount,
          rank: player.rank,
          topCard: projectCard(player.topCard),
        },
      ])
    ),
    hostSessionId: state.hostSessionId,
    currentTurnId: state.currentTurnId,
    gamePhase: state.gamePhase,
    boardRevision: state.boardRevision,
    turnCount: state.turnCount,
    roundCount: state.roundCount,
    bellLocked: state.bellLocked,
    finalRound: state.finalRound,
    exactFiveFruit: state.exactFiveFruit,
    lastBellPlayerId: state.lastBellPlayerId,
    lastBellResult: state.lastBellResult,
    winnerSessionId: state.winnerSessionId,
    rankings: Array.from(state.rankings ?? []),
    lastAction: state.lastAction,
  };
}
