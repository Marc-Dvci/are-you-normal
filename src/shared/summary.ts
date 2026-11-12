import { mean, tierOf } from './scoring';
import type { DaySummary, Reveal } from './types';
import { dayLine } from './verdicts';

export type SummaryExtras = {
  rank: number | null;
  players: number;
  streak: number;
  bias: { mean: number; n: number } | null;
};

/** Day result from the player's reveals. Shared so logged-out play gets the same card. */
export const summarize = (
  edition: number,
  reveals: readonly Reveal[],
  extras: SummaryExtras
): DaySummary => {
  const meanShare = mean(reveals.map((r) => r.truth));
  const tier = tierOf(meanShare);
  const scored = reveals.filter((r) => r.points !== null);
  const seed = reveals.map((r) => `${r.q}:${r.option}`).join(',');
  return {
    edition,
    meanShare,
    tier,
    line: dayLine(tier, edition, seed),
    score: scored.reduce((sum, r) => sum + (r.points ?? 0), 0),
    maxScore: scored.length * 100,
    ...extras,
  };
};

/** "You think more people are like you than are." Positive bias means over-estimating. */
export const biasSentence = (bias: { mean: number; n: number }): string => {
  const points = Math.abs(Math.round(bias.mean));
  if (points < 3) return 'You know exactly how normal you are. Unsettling.';
  return bias.mean > 0
    ? `You think ${points} more people in 100 are like you than really are.`
    : `You think you are rarer than you are, by ${points} people in 100.`;
};

/** Guesses needed before the bias line appears. */
export const MIN_BIAS_GUESSES = 3;
