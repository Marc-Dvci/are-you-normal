import { describe, expect, it } from 'vitest';
import { contrastLine, MIN_SUB_ANSWERS } from '../../src/shared/compare';
import {
  dayOfEdition,
  editionOn,
  isoDay,
  nextEditionAt,
} from '../../src/shared/edition';
import { verdictMarkdown } from '../../src/shared/share';
import { biasSentence, summarize } from '../../src/shared/summary';
import type { PublicQuestion, Reveal, Tier } from '../../src/shared/types';
import {
  ANSWER_LINES,
  answerLine,
  DAY_LINES,
  hash,
} from '../../src/shared/verdicts';

describe('verdict lines', () => {
  it('give the same line to everyone with the same answer', () => {
    expect(answerLine('odd', 3, 'steak', 2)).toBe(
      answerLine('odd', 3, 'steak', 2)
    );
  });

  it('hash is stable across runtimes', () => {
    expect(hash('')).toBe(0x811c9dc5);
    expect(hash('a')).toBe(0xe40c292c);
  });

  it('every tier has at least four short lines with no emoji', () => {
    for (const pools of [ANSWER_LINES, DAY_LINES]) {
      for (const lines of Object.values(pools)) {
        expect(lines.length).toBeGreaterThanOrEqual(4);
        for (const line of lines) {
          expect(line.length).toBeLessThanOrEqual(64);
          expect(line).not.toMatch(/\p{Extended_Pictographic}/u);
        }
      }
    }
  });

  it('spreads answers over the pool', () => {
    const seen = new Set<string>();
    for (let option = 0; option < 40; option++)
      seen.add(answerLine('rare', 1, 'q', option));
    expect(seen.size).toBeGreaterThan(4);
  });
});

describe('editions', () => {
  it('numbers UTC days from the epoch, starting at 1', () => {
    expect(editionOn(new Date('2026-11-20T00:00:00Z'), '2026-11-20')).toBe(1);
    expect(editionOn(new Date('2026-11-20T23:59:59Z'), '2026-11-20')).toBe(1);
    expect(editionOn(new Date('2026-11-21T00:00:00Z'), '2026-11-20')).toBe(2);
    expect(editionOn(new Date('2026-12-09T12:00:00Z'), '2026-11-20')).toBe(20);
  });

  it('maps an edition back to its day', () => {
    for (let n = 1; n < 400; n += 37) {
      const day = dayOfEdition(n, '2026-11-20');
      expect(editionOn(new Date(`${day}T08:00:00Z`), '2026-11-20')).toBe(n);
    }
  });

  it('rolls over at the next UTC midnight', () => {
    expect(nextEditionAt(new Date('2026-12-31T22:10:00Z')).toISOString()).toBe(
      '2027-01-01T00:00:00.000Z'
    );
    expect(isoDay(new Date('2026-12-31T23:59:59Z'))).toBe('2026-12-31');
  });

  it('rejects a malformed epoch', () => {
    expect(() => editionOn(new Date(), 'not-a-day')).toThrow(/Invalid day/);
  });
});

describe('contrastLine', () => {
  const options = ['Always', 'Sometimes', 'Never'];
  const world = [10, 40, 50];

  it(`stays silent below ${MIN_SUB_ANSWERS} answers`, () => {
    expect(contrastLine(options, world, [9, 0, 0], 9)).toBeNull();
  });

  it('names the answer the sub over-picks', () => {
    expect(contrastLine(options, world, [6, 2, 2], 10)).toBe(
      'This sub picks “Always” 6.0× as often as the survey did.'
    );
  });

  it('names the answer the sub under-picks', () => {
    expect(contrastLine(options, [40, 30, 30], [1, 5, 4], 10)).toBe(
      '“Always” is 4.0× rarer here than in the survey.'
    );
  });

  it('says when nobody here picked a common answer', () => {
    expect(contrastLine(options, [40, 30, 30], [0, 5, 5], 10)).toBe(
      'Nobody here picked “Always”. 40% did in the survey.'
    );
  });

  it('says when the sub matches the survey', () => {
    expect(contrastLine(options, world, [1, 4, 5], 10)).toBe(
      'This sub answers like the survey, within 1 points.'
    );
  });
});

const reveal = (
  q: number,
  option: number,
  truth: number,
  points: number | null,
  tier: Tier
): Reveal => ({
  q,
  option,
  guess: 30,
  truth,
  points,
  tier,
  line: 'x',
  world: null,
  sub: { counts: [], n: 0 },
  contrast: null,
});

describe('summaries', () => {
  it('averages the shares and adds only scored points', () => {
    const s = summarize(
      4,
      [
        reveal(0, 1, 20.4, 73, 'odd'),
        reveal(1, 2, 30.6, 90, 'odd'),
        reveal(2, 0, 21, null, 'odd'),
      ],
      {
        rank: 2,
        players: 9,
        streak: 3,
        bias: null,
      }
    );
    expect(s.meanShare).toBe(24);
    expect(s.tier).toBe('odd');
    expect(s.score).toBe(163);
    expect(s.maxScore).toBe(200);
    expect(s.rank).toBe(2);
  });

  it.each([
    [
      { mean: 12.4, n: 6 },
      'You think 12 more people in 100 are like you than really are.',
    ],
    [
      { mean: -8, n: 6 },
      'You think you are rarer than you are, by 8 people in 100.',
    ],
    [{ mean: 1.2, n: 6 }, 'You know exactly how normal you are. Unsettling.'],
  ])('bias %o reads as a sentence', (bias, text) => {
    expect(biasSentence(bias)).toBe(text);
  });

  it('builds the verdict comment from the day', () => {
    const questions: PublicQuestion[] = [
      {
        id: 'a',
        kind: 'world',
        text: 'Do you recline?',
        options: ['Yes', 'No'],
        category: 'travel',
        crowd: 'flyers',
        askedBy: null,
      },
    ];
    const s = summarize(7, [reveal(0, 1, 19.9, 80, 'odd')], {
      rank: 1,
      players: 1,
      streak: 1,
      bias: null,
    });
    expect(verdictMarkdown(s, questions, [reveal(0, 1, 19.9, 80, 'odd')])).toBe(
      '**No. 7 · ODD** · 80 of 100 points\n\n- Do you recline? **No**, like 19.9% of flyers'
    );
  });
});
