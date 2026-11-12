import { shareOf } from './scoring';

/** Answers needed in the subreddit before it is compared with a survey. */
export const MIN_SUB_ANSWERS = 10;

/** A gap smaller than this, in points, is not worth a headline. */
const MIN_GAP = 8;

const fmtRatio = (r: number): string =>
  r >= 10 ? `${Math.round(r)}×` : `${(Math.round(r * 10) / 10).toFixed(1)}×`;

/**
 * One sentence comparing this subreddit's answers with the cited survey.
 * Picks the answer where the two disagree the most. Returns null until the
 * subreddit has enough answers to say anything.
 */
export const contrastLine = (
  options: readonly string[],
  worldPcts: readonly number[],
  subCounts: readonly number[],
  subN: number
): string | null => {
  if (subN < MIN_SUB_ANSWERS) return null;
  let best: { i: number; ratio: number; gap: number } | null = null;
  let widest = 0;
  for (let i = 0; i < options.length; i++) {
    const world = worldPcts[i] ?? 0;
    const sub = shareOf(subCounts[i] ?? 0, subN);
    const gap = Math.abs(sub - world);
    widest = Math.max(widest, gap);
    if (gap < MIN_GAP || world <= 0) continue;
    const ratio = sub / world;
    const strength = Math.abs(Math.log(Math.max(ratio, 0.01)));
    const bestStrength = best
      ? Math.abs(Math.log(Math.max(best.ratio, 0.01)))
      : -1;
    if (strength > bestStrength) best = { i, ratio, gap };
  }
  if (best && best.ratio >= 1.5) {
    return `This sub picks “${options[best.i]}” ${fmtRatio(best.ratio)} as often as the survey did.`;
  }
  if (best && best.ratio <= 1 / 1.5) {
    const sub = shareOf(subCounts[best.i] ?? 0, subN);
    if (sub === 0) {
      return `Nobody here picked “${options[best.i]}”. ${worldPcts[best.i]}% did in the survey.`;
    }
    return `“${options[best.i]}” is ${fmtRatio(1 / best.ratio)} rarer here than in the survey.`;
  }
  return `This sub answers like the survey, within ${Math.max(1, Math.round(widest))} points.`;
};
