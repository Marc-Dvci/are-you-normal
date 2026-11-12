import type { Tier } from './types';

/**
 * One line per answer. The same answer to the same question always gets the
 * same line, so players who agree can quote it to each other.
 */
export const ANSWER_LINES: Record<Tier, readonly string[]> = {
  weirdo: [
    'Statistically, you are a rounding error.',
    'The survey checked your row twice.',
    'Fewer than 1 in 20 people agree with you. Bold.',
    'You would need a big room to find another one of you.',
    'Somewhere, a statistician raised an eyebrow.',
    'You are the footnote.',
    'Your answer gets its own column. It is a short column.',
    'Rare enough to be filed separately.',
  ],
  rare: [
    'A minority, and a firm one.',
    'Uncommon, but there are a few of you on every bus.',
    'Not alone. Outnumbered.',
    'About one per office floor.',
    'Your people exist. They keep it quiet.',
    'Unusual enough to mention, normal enough to get away with.',
    'This answer starts arguments at dinner.',
    'Small club. Strict door policy.',
  ],
  odd: [
    'A respectable minority.',
    'Odd, but well represented.',
    'Enough of you to fill a meeting room.',
    'Outvoted, but not by a landslide.',
    'The fringe, with decent numbers.',
    'Nobody will stare. A few might ask.',
    'One of the bigger small groups.',
    'Different, in a way most people have heard of.',
  ],
  normal: [
    'Normal. Carry on.',
    'You are the person the survey had in mind.',
    'Mainstream, and comfortable there.',
    'Most of the room would nod.',
    'Statistically unremarkable, in a good way.',
    'This answer survives any family dinner.',
    'Normal. The survey thanks you for your cooperation.',
    'Squarely inside the bell curve.',
  ],
  boring: [
    'Boring... like nearly everyone else.',
    'You and almost everybody.',
    'Textbook. Literally in the textbook.',
    'The survey could have guessed this one.',
    'As predictable as a Monday.',
    'The default setting.',
    'Congratulations on being the majority. Again.',
    'Safe, sensible, slightly disappointing.',
  ],
};

export const DAY_LINES: Record<Tier, readonly string[]> = {
  weirdo: [
    'Three questions, three minority reports.',
    'Today you were the outlier in every room.',
    'The bureau has opened a file on you.',
    'A remarkable day for unusual answers.',
  ],
  rare: [
    'Mostly off the beaten path today.',
    'You took the side road more often than not.',
    'Uncommon taste, consistently applied.',
    'Hard to find in a crowd today.',
  ],
  odd: [
    'A little odd, all day.',
    'Normal-adjacent.',
    'You kept the statisticians slightly awake.',
    'Close to the middle, never quite in it.',
  ],
  normal: [
    'A thoroughly normal day.',
    'You blended in.',
    'Middle of the bell curve, all day long.',
    'Nothing unusual to report. Well done.',
  ],
  boring: [
    'Peak normal. Nothing to report.',
    'You could be the survey’s mascot.',
    'Predictable from start to finish.',
    'The average person, in person.',
  ],
};

/** 32-bit FNV-1a hash, stable across runtimes. */
export const hash = (text: string): number => {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
};

const pick = (pool: readonly string[], seed: string): string =>
  pool[hash(seed) % pool.length] ?? pool[0] ?? '';

export const answerLine = (
  tier: Tier,
  edition: number,
  questionId: string,
  option: number
): string => pick(ANSWER_LINES[tier], `${edition}|${questionId}|${option}`);

export const dayLine = (tier: Tier, edition: number, seed: string): string =>
  pick(DAY_LINES[tier], `${edition}|day|${seed}`);
