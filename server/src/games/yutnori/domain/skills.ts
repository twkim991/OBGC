export const YUT_SKILLS = [
  'MO_MAGNET',
  'DOUBLE_CAST',
  'BACK_GEAR',
  'EARTHQUAKE',
  'TITAN_DROP',
  'STEALTH_MODE',
] as const;

export type YutSkill = (typeof YUT_SKILLS)[number];

export function isYutSkill(value: string): value is YutSkill {
  return (YUT_SKILLS as readonly string[]).includes(value);
}

export function drawSkills(count: number, random = Math.random): YutSkill[] {
  const pool = [...YUT_SKILLS];
  for (let index = pool.length - 1; index > 0; index--) {
    const target = Math.floor(random() * (index + 1));
    [pool[index], pool[target]] = [pool[target], pool[index]];
  }
  return pool.slice(0, count);
}
