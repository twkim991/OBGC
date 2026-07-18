export const LOST_CITIES_COLORS = ['yellow', 'blue', 'white', 'green', 'red'];

const projectCard = (card) => ({
  id: card?.id || '',
  color: card?.color || '',
  kind: card?.kind || '',
  value: Number.isInteger(card?.value) ? card.value : 0,
});

const projectExpeditions = (expeditions) => Object.fromEntries(
  LOST_CITIES_COLORS.map((color) => [color, {
    cards: Array.from(expeditions?.[color]?.cards ?? [], projectCard),
    score: expeditions?.[color]?.score || 0,
  }])
);

const projectDiscards = (discards) => Object.fromEntries(
  LOST_CITIES_COLORS.map((color) => [color, {
    count: discards?.[color]?.count || 0,
    topCard: projectCard(discards?.[color]?.topCard),
  }])
);

export function projectLostCitiesState(state) {
  return {
    players: Object.fromEntries(
      Array.from(state.players?.entries?.() ?? []).map(([id, player]) => [id, {
        sessionId: player.sessionId,
        nickname: player.nickname,
        isHost: player.isHost,
        connected: player.connected,
        handCount: player.handCount,
        roundScore: player.roundScore,
        totalScore: player.totalScore,
        rank: player.rank,
        expeditions: projectExpeditions(player.expeditions),
      }])
    ),
    hostSessionId: state.hostSessionId,
    currentTurnId: state.currentTurnId,
    roundStarterId: state.roundStarterId,
    gamePhase: state.gamePhase,
    actionPhase: state.actionPhase,
    turnRevision: state.turnRevision,
    turnCount: state.turnCount,
    roundCount: state.roundCount,
    deckCount: state.deckCount,
    blockedDiscardColor: state.blockedDiscardColor,
    discards: projectDiscards(state.discards),
    roundWinnerIds: Array.from(state.roundWinnerIds ?? []),
    winnerSessionIds: Array.from(state.winnerSessionIds ?? []),
    rankings: Array.from(state.rankings ?? []),
    lastAction: state.lastAction,
  };
}

