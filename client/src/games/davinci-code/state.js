const projectTile = (tile) => ({
  id: tile.id,
  color: tile.color,
  revealed: tile.revealed,
  number: tile.number,
});

export function projectDavinciCodeState(state) {
  return {
    players: Object.fromEntries(
      Array.from(state.players?.entries?.() ?? []).map(([id, player]) => [
        id,
        {
          sessionId: player.sessionId,
          nickname: player.nickname,
          isHost: player.isHost,
          connected: player.connected,
          setupComplete: player.setupComplete,
          eliminated: player.eliminated,
          hiddenCount: player.hiddenCount,
          rank: player.rank,
          code: Array.from(player.code ?? [], projectTile),
        },
      ])
    ),
    hostSessionId: state.hostSessionId,
    currentTurnId: state.currentTurnId,
    turnDeadlineAt: state.turnDeadlineAt || 0,
    gamePhase: state.gamePhase,
    turnPhase: state.turnPhase,
    turnRevision: state.turnRevision,
    turnCount: state.turnCount,
    lightPoolCount: state.lightPoolCount,
    darkPoolCount: state.darkPoolCount,
    drawnTileColor: state.drawnTileColor,
    winnerSessionId: state.winnerSessionId,
    rankings: Array.from(state.rankings ?? []),
    lastAction: state.lastAction,
  };
}
