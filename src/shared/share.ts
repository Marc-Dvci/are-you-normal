import { STAMP_WORD } from './scoring';
import type { DaySummary, PublicQuestion, Reveal } from './types';

const pct = (value: number): string =>
  Number.isInteger(value) ? `${value}%` : `${value.toFixed(1)}%`;

/** The comment a player can choose to post with their day's result. */
export const verdictMarkdown = (
  summary: DaySummary,
  questions: readonly PublicQuestion[],
  reveals: readonly Reveal[]
): string => {
  const head =
    summary.maxScore > 0
      ? `**No. ${summary.edition} · ${STAMP_WORD[summary.tier].toUpperCase()}** · ${summary.score} of ${summary.maxScore} points`
      : `**No. ${summary.edition} · ${STAMP_WORD[summary.tier].toUpperCase()}**`;
  const rows = reveals.map((r) => {
    const q = questions[r.q];
    if (!q) return '';
    const answer = q.options[r.option] ?? '';
    return `- ${q.text} **${answer}**, like ${pct(r.truth)} of ${q.crowd}`;
  });
  return [head, '', ...rows.filter((row) => row.length > 0)].join('\n');
};
