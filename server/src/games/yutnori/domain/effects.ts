import type { YutThrow } from './throw';

export interface ResolvedYutThrow {
  result: YutThrow;
  throws: number[];
  consumeSkill: boolean;
  keepsThrowing: boolean;
  notices: Array<'mo_magnet' | 'back_gear' | 'double_cast'>;
}

export function resolveYutThrow(
  original: YutThrow,
  activeSkill?: string,
): ResolvedYutThrow {
  const notices: ResolvedYutThrow['notices'] = [];
  const result =
    activeSkill === 'MO_MAGNET'
      ? { name: '모', steps: 5, weight: 0 }
      : { ...original };

  if (activeSkill === 'MO_MAGNET') notices.push('mo_magnet');

  let steps = result.steps;
  if (activeSkill === 'BACK_GEAR') {
    steps = steps > 0 ? -steps : Math.abs(steps);
    notices.push('back_gear');
  }

  const throws = [steps];
  if (activeSkill === 'DOUBLE_CAST') {
    throws.push(steps);
    notices.push('double_cast');
  }

  return {
    result,
    throws,
    consumeSkill: Boolean(activeSkill && activeSkill !== 'STEALTH_MODE'),
    keepsThrowing: result.steps === 4 || result.steps === 5,
    notices,
  };
}

export interface TitanCollisionResult {
  endPosition: number;
  eaten: boolean;
  consumedTitanIndex: number;
  passedTitanCount: number;
}

export function resolveTitanCollision(
  path: number[],
  titanPositions: number[],
  isStealth: boolean,
): TitanCollisionResult {
  let endPosition = path[0] ?? 0;
  let passedTitanCount = 0;

  for (const position of path) {
    endPosition = position;
    if (position === 0 || position === 99) break;

    const titanIndex = titanPositions.indexOf(position);
    if (titanIndex === -1) continue;
    if (isStealth) {
      passedTitanCount += 1;
      continue;
    }

    return {
      endPosition: 0,
      eaten: true,
      consumedTitanIndex: titanIndex,
      passedTitanCount,
    };
  }

  return {
    endPosition,
    eaten: false,
    consumedTitanIndex: -1,
    passedTitanCount,
  };
}

export function getEmptyTitanNodes(
  occupiedPositions: Iterable<number>,
  titanPositions: number[],
): number[] {
  const occupied = new Set(occupiedPositions);
  const titans = new Set(titanPositions);
  const empty: number[] = [];

  for (let position = 1; position <= 28; position++) {
    if (!occupied.has(position) && !titans.has(position)) empty.push(position);
  }
  return empty;
}

export function selectRandomNode(
  nodes: number[],
  random: () => number = Math.random,
): number | null {
  if (nodes.length === 0) return null;
  const index = Math.min(
    nodes.length - 1,
    Math.max(0, Math.floor(random() * nodes.length)),
  );
  return nodes[index];
}

export interface CapturePiece {
  sessionId: string;
  pieceIndex: number;
}

export function resolveCaptures(
  players: Array<{
    sessionId: string;
    pieces: Array<{ position: number; isStealth: boolean }>;
  }>,
  movingSessionId: string,
  endPosition: number,
): { captured: CapturePiece[]; stealthOverlapCount: number } {
  const captured: CapturePiece[] = [];
  let stealthOverlapCount = 0;

  if (endPosition === 0 || endPosition === 99) {
    return { captured, stealthOverlapCount };
  }

  players.forEach((player) => {
    if (player.sessionId === movingSessionId) return;
    player.pieces.forEach((piece, pieceIndex) => {
      if (piece.position !== endPosition) return;
      if (piece.isStealth) stealthOverlapCount += 1;
      else captured.push({ sessionId: player.sessionId, pieceIndex });
    });
  });

  return { captured, stealthOverlapCount };
}

export function hasFinishedAllPieces(pieces: Array<{ position: number }>): boolean {
  return pieces.length > 0 && pieces.every((piece) => piece.position === 99);
}

export type SkillActivationKind =
  | 'already_used'
  | 'cancel'
  | 'missing'
  | 'earthquake'
  | 'titan_drop'
  | 'arm';

export function resolveSkillActivation(input: {
  skillId: string;
  availableSkills: string[];
  activeSkill: string;
  usedSkillThisTurn: boolean;
}): { kind: SkillActivationKind; skillIndex: number } {
  if (input.usedSkillThisTurn) return { kind: 'already_used', skillIndex: -1 };
  if (input.activeSkill === input.skillId) return { kind: 'cancel', skillIndex: -1 };

  const skillIndex = input.availableSkills.indexOf(input.skillId);
  if (skillIndex === -1) return { kind: 'missing', skillIndex };
  if (input.skillId === 'EARTHQUAKE') return { kind: 'earthquake', skillIndex };
  if (input.skillId === 'TITAN_DROP') return { kind: 'titan_drop', skillIndex };
  return { kind: 'arm', skillIndex };
}
