import { isRecord, readInteger, readString } from '../protocol';
import { isYutSkill, type YutSkill } from './domain/skills';

export const YUTNORI_MESSAGES = {
  requestPrivateState: 'request_private_state',
  privateSkills: 'private_skills',
  startGame: 'start_game',
  throwYut: 'throw_yut',
  movePiece: 'move_piece',
  activateSkill: 'activate_skill',
  returnToTable: 'return_to_table',
} as const;

export interface MovePiecePayload {
  pieceIndex: number;
  throwIndex: number;
}

export function parseMovePiecePayload(value: unknown): MovePiecePayload | null {
  if (!isRecord(value)) return null;
  const pieceIndex = readInteger(value.pieceIndex, { min: 0, max: 3 });
  const throwIndex = readInteger(value.throwIndex, { min: 0, max: 100 });
  return pieceIndex === null || throwIndex === null
    ? null
    : { pieceIndex, throwIndex };
}

export function parseSkillId(value: unknown): YutSkill | null {
  const skillId = readString(value, { maxLength: 30 });
  return skillId && isYutSkill(skillId) ? skillId : null;
}
