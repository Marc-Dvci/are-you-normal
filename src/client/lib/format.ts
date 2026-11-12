export const pctText = (value: number): string =>
  Number.isInteger(value) ? `${value}%` : `${value.toFixed(1)}%`;

export const ordinal = (n: number): string => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
};

/** "1 player", "2 players". */
export const count = (n: number, noun: string): string =>
  `${n} ${n === 1 ? noun : `${noun}s`}`;
