export function getNextSplendorPlayerId(
  orderedIds: readonly string[],
  currentId: string,
  activeIds: ReadonlySet<string>,
) {
  if (!orderedIds.length) return '';
  const start = Math.max(orderedIds.indexOf(currentId), 0);
  for (let offset = 1; offset <= orderedIds.length; offset += 1) {
    const candidate = orderedIds[(start + offset) % orderedIds.length];
    if (activeIds.has(candidate)) return candidate;
  }
  return '';
}

export function shouldFinishSplendorGame(
  nextPlayerId: string,
  firstPlayerId: string,
  finalRoundTriggered: boolean,
) {
  return finalRoundTriggered && nextPlayerId === firstPlayerId;
}
