const projectCard = (card) => ({
  id: card?.id || '',
  character: card?.character || '',
  value: Number.isInteger(card?.value) ? card.value : -1,
});

export function projectLoveLetterState(state) {
  return {
    players: Object.fromEntries(
      Array.from(state.players?.entries?.() ?? []).map(([id, player]) => [id, {
        sessionId: player.sessionId,
        nickname: player.nickname,
        isHost: player.isHost,
        connected: player.connected,
        eliminated: player.eliminated,
        protected: player.protected,
        favorTokens: player.favorTokens,
        handCount: player.handCount,
        rank: player.rank,
      }])
    ),
    hostSessionId: state.hostSessionId,
    currentTurnId: state.currentTurnId,
    gamePhase: state.gamePhase,
    actionPhase: state.actionPhase,
    turnRevision: state.turnRevision,
    roundCount: state.roundCount,
    deckCount: state.deckCount,
    activeCount: state.activeCount,
    favorTarget: state.favorTarget,
    faceUpRemovedCards: Array.from(state.faceUpRemovedCards ?? [], projectCard),
    lastPlayedCard: projectCard(state.lastPlayedCard),
    lastDiscardedCard: projectCard(state.lastDiscardedCard),
    lastPlayedById: state.lastPlayedById,
    lastTargetId: state.lastTargetId,
    lastGuessCharacter: state.lastGuessCharacter,
    lastOutcome: state.lastOutcome,
    roundWinnerIds: Array.from(state.roundWinnerIds ?? []),
    winnerSessionIds: Array.from(state.winnerSessionIds ?? []),
    rankings: Array.from(state.rankings ?? []),
    lastAction: state.lastAction,
  };
}
