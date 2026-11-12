import type { Tier } from './types';

/** Points lost for each percentage point between the guess and the truth. */
export const POINTS_PER_POINT_OFF = 2;

/** A guess this close or closer counts as a bullseye. */
export const BULLSEYE_MARGIN = 2;

/** Community answers needed, besides the player's own, before a guess is scored. */
export const MIN_COMMUNITY_ANSWERS = 10;

/** Score one guess: 100 for exact, minus 2 for each point off, never below 0. */
export const scoreGuess = (guess: number, truth: number): number => {
  const off = Math.abs(guess - truth);
  return Math.max(0, Math.round(100 - POINTS_PER_POINT_OFF * off));
};

export const isBullseye = (guess: number, truth: number): boolean =>
  Math.abs(guess - truth) <= BULLSEYE_MARGIN;

/**
 * Tier for the share of people who gave the same answer.
 * Under 5% is a weirdo; over 70% is boring.
 */
export const tierOf = (share: number): Tier => {
  if (share < 5) return 'weirdo';
  if (share < 15) return 'rare';
  if (share < 35) return 'odd';
  if (share <= 70) return 'normal';
  return 'boring';
};

export const STAMP_WORD: Record<Tier, string> = {
  weirdo: 'Weirdo',
  rare: 'Rare',
  odd: 'Odd',
  normal: 'Normal',
  boring: 'Boring',
};

/** Share in percent, one decimal. Returns 0 when nobody answered. */
export const shareOf = (count: number, total: number): number =>
  total > 0 ? Math.round((count / total) * 1000) / 10 : 0;

export const clampGuess = (guess: number): number =>
  Math.min(100, Math.max(0, Math.round(guess)));

export const mean = (values: number[]): number =>
  values.length === 0
    ? 0
    : Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;
