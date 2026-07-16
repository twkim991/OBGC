const projectTile = (tile) => ({
  id: tile.id,
  color: tile.color,
  number: tile.number,
  isJoker: tile.isJoker,
});

export function projectRummikubState(state) {
  return {
    players: Object.fromEntries(
      Array.from(state.players?.entries?.() ?? []).map(([id, player]) => [
        id,
        {
          sessionId: player.sessionId,
          nickname: player.nickname,
          isHost: player.isHost,
          connected: player.connected,
          handCount: player.handCount,
          hasInitialMeld: player.hasInitialMeld,
          score: player.score,
          rank: player.rank,
        },
      ])
    ),
    melds: Array.from(state.melds ?? [], (meld, index) => ({
      id: `server-${state.boardRevision}-${index}`,
      tiles: Array.from(meld.tiles ?? [], projectTile),
    })),
    currentTurnId: state.currentTurnId,
    hostSessionId: state.hostSessionId,
    gamePhase: state.gamePhase,
    poolCount: state.poolCount,
    boardRevision: state.boardRevision,
    consecutivePasses: state.consecutivePasses,
    turnCount: state.turnCount,
    winnerSessionId: state.winnerSessionId,
    rankings: Array.from(state.rankings ?? []),
    lastAction: state.lastAction,
  };
}

