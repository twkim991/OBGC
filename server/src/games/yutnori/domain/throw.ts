export interface YutThrow {
  name: string;
  steps: number;
  weight: number;
}

const THROW_OPTIONS: YutThrow[] = [
  { name: '개', steps: 2, weight: 345 },
  { name: '걸', steps: 3, weight: 345 },
  { name: '윷', steps: 4, weight: 130 },
  { name: '도', steps: 1, weight: 115 },
  { name: '빽도', steps: -1, weight: 38 },
  { name: '모', steps: 5, weight: 27 },
];

export function throwYut(random = Math.random): YutThrow {
  let value = Math.floor(random() * 1000);

  for (const option of THROW_OPTIONS) {
    if (value < option.weight) return { ...option };
    value -= option.weight;
  }

  return { ...THROW_OPTIONS[0] };
}
