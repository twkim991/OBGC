let draftSequence = 0;

const nextDraftId = () => `draft-${draftSequence++}`;

export function cloneRummikubDraft(draft) {
  return {
    baseRevision: draft.baseRevision,
    melds: draft.melds.map((meld) => ({
      id: meld.id,
      tileIds: [...meld.tileIds],
    })),
    rackTileIds: [...draft.rackTileIds],
  };
}

export function createRummikubDraft(boardMelds, rackTiles, baseRevision) {
  return {
    baseRevision,
    melds: boardMelds.map((meld) => ({
      id: meld.id || nextDraftId(),
      tileIds: meld.tiles.map((tile) => tile.id),
    })),
    rackTileIds: rackTiles.map((tile) => tile.id),
  };
}

function detachTiles(draft, tileIds) {
  const selected = new Set(tileIds);
  draft.rackTileIds = draft.rackTileIds.filter((id) => !selected.has(id));
  draft.melds.forEach((meld) => {
    meld.tileIds = meld.tileIds.filter((id) => !selected.has(id));
  });
  draft.melds = draft.melds.filter((meld) => meld.tileIds.length > 0);
}

export function moveTilesToNewMeld(draft, tileIds) {
  if (!tileIds.length) return;
  detachTiles(draft, tileIds);
  draft.melds.push({ id: nextDraftId(), tileIds: [...tileIds] });
}

export function moveTilesToMeld(draft, meldId, tileIds) {
  if (!tileIds.length) return;
  detachTiles(draft, tileIds);
  const target = draft.melds.find((meld) => meld.id === meldId);
  if (target) target.tileIds.push(...tileIds);
  else draft.melds.push({ id: meldId || nextDraftId(), tileIds: [...tileIds] });
}

export function moveTilesToRack(draft, tileIds) {
  if (!tileIds.length) return;
  detachTiles(draft, tileIds);
  draft.rackTileIds.push(...tileIds);
}

export function dissolveMeld(draft, meldId) {
  const target = draft.melds.find((meld) => meld.id === meldId);
  if (!target) return;
  moveTilesToRack(draft, target.tileIds);
}

export function reorderTile(draft, meldId, tileId, direction) {
  const meld = draft.melds.find((candidate) => candidate.id === meldId);
  if (!meld) return;
  const index = meld.tileIds.indexOf(tileId);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= meld.tileIds.length) return;
  [meld.tileIds[index], meld.tileIds[target]] = [meld.tileIds[target], meld.tileIds[index]];
}

export function analyzeClientMeld(tiles) {
  if (tiles.length < 3 || tiles.length > 13) return null;
  const numbered = tiles.filter((tile) => !tile.isJoker);
  if (!numbered.length) return null;

  if (tiles.length <= 4) {
    const number = numbered[0].number;
    const colors = new Set(numbered.map((tile) => tile.color));
    if (
      numbered.every((tile) => tile.number === number) &&
      colors.size === numbered.length &&
      colors.size + (tiles.length - numbered.length) <= 4
    ) {
      return { kind: 'group', score: number * tiles.length };
    }
  }

  const anchorIndex = tiles.findIndex((tile) => !tile.isJoker);
  const start = tiles[anchorIndex].number - anchorIndex;
  const end = start + tiles.length - 1;
  const color = tiles[anchorIndex].color;
  if (start < 1 || end > 13) return null;
  for (let index = 0; index < tiles.length; index++) {
    const tile = tiles[index];
    if (!tile.isJoker && (tile.color !== color || tile.number !== start + index)) {
      return null;
    }
  }
  return { kind: 'run', score: ((start + end) * tiles.length) / 2 };
}

export function toCommitPayload(draft) {
  return {
    baseRevision: draft.baseRevision,
    melds: draft.melds.map((meld) => ({ tileIds: [...meld.tileIds] })),
  };
}

