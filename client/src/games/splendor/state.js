const projectResources = (value) => ({
  white: value?.white || 0,
  blue: value?.blue || 0,
  green: value?.green || 0,
  red: value?.red || 0,
  black: value?.black || 0,
  gold: value?.gold || 0,
});

const projectCard = (card) => ({
  id: card?.id || '', tier: card?.tier || 1, bonus: card?.bonus || 'white',
  prestige: card?.prestige || 0, cost: projectResources(card?.cost),
});

const projectNoble = (noble) => ({
  id: noble?.id || '', prestige: noble?.prestige || 3,
  requirement: projectResources(noble?.requirement),
});

export function projectSplendorState(state) {
  return {
    players: Object.fromEntries(Array.from(state.players?.entries?.() ?? []).map(([id, player]) => [id, {
      sessionId: player.sessionId,
      nickname: player.nickname,
      isHost: player.isHost,
      connected: player.connected,
      prestige: player.prestige,
      developmentCount: player.developmentCount,
      reservedCount: player.reservedCount,
      tokens: projectResources(player.tokens),
      bonuses: projectResources(player.bonuses),
      nobleIds: Array.from(player.nobleIds ?? []),
      rank: player.rank,
    }])),
    hostSessionId: state.hostSessionId,
    firstPlayerId: state.firstPlayerId,
    currentTurnId: state.currentTurnId,
    turnDeadlineAt: state.turnDeadlineAt || 0,
    gamePhase: state.gamePhase,
    actionPhase: state.actionPhase,
    turnRevision: state.turnRevision,
    turnCount: state.turnCount,
    bank: projectResources(state.bank),
    markets: {
      1: Array.from(state.tierOne ?? [], projectCard),
      2: Array.from(state.tierTwo ?? [], projectCard),
      3: Array.from(state.tierThree ?? [], projectCard),
    },
    deckCounts: { 1: state.tierOneDeckCount, 2: state.tierTwoDeckCount, 3: state.tierThreeDeckCount },
    nobles: Array.from(state.nobles ?? [], projectNoble),
    eligibleNobleIds: Array.from(state.eligibleNobleIds ?? []),
    finalRoundTriggered: state.finalRoundTriggered,
    finalRoundTriggeredBy: state.finalRoundTriggeredBy,
    winnerSessionIds: Array.from(state.winnerSessionIds ?? []),
    rankings: Array.from(state.rankings ?? []),
    lastAction: state.lastAction,
  };
}
