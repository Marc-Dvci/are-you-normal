import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  clampGuess,
  isBullseye,
  mean,
  scoreGuess,
  shareOf,
  tierOf,
} from '../../src/shared/scoring';

describe('scoreGuess', () => {
  it.each([
    [20, 20, 100],
    [21, 20, 98],
    [30, 20, 80],
    [45, 20, 50],
    [70, 20, 0],
    [100, 0, 0],
    [34, 20.4, 73],
  ])('a guess of %d against %d scores %d', (guess, truth, points) => {
    expect(scoreGuess(guess, truth)).toBe(points);
  });

  it('never leaves 0 to 100 and is symmetric around the truth', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100 }),
        fc.double({ min: 0, max: 100, noNaN: true }),
        (g, t) => {
          const s = scoreGuess(g, t);
          expect(s).toBeGreaterThanOrEqual(0);
          expect(s).toBeLessThanOrEqual(100);
          const mirror = 2 * t - g;
          if (mirror >= 0 && mirror <= 100) {
            expect(scoreGuess(mirror, t)).toBe(s);
          }
        }
      )
    );
  });

  it('a closer guess never scores less', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 100, noNaN: true }),
        fc.integer({ min: 0, max: 100 }),
        fc.integer({ min: 0, max: 100 }),
        (t, a, b) => {
          const [near, far] =
            Math.abs(a - t) <= Math.abs(b - t) ? [a, b] : [b, a];
          expect(scoreGuess(near, t)).toBeGreaterThanOrEqual(
            scoreGuess(far, t)
          );
        }
      )
    );
  });
});

describe('tierOf', () => {
  it.each([
    [0, 'weirdo'],
    [4.9, 'weirdo'],
    [5, 'rare'],
    [14.9, 'rare'],
    [15, 'odd'],
    [34.9, 'odd'],
    [35, 'normal'],
    [70, 'normal'],
    [70.1, 'boring'],
    [100, 'boring'],
  ])('a share of %d%% is %s', (share, tier) => {
    expect(tierOf(share)).toBe(tier);
  });
});

describe('helpers', () => {
  it('shareOf rounds to one decimal and survives an empty crowd', () => {
    expect(shareOf(1, 3)).toBe(33.3);
    expect(shareOf(2, 3)).toBe(66.7);
    expect(shareOf(0, 0)).toBe(0);
  });

  it('clampGuess keeps guesses inside 0 to 100 as whole numbers', () => {
    expect(clampGuess(-4)).toBe(0);
    expect(clampGuess(140)).toBe(100);
    expect(clampGuess(33.6)).toBe(34);
  });

  it('isBullseye allows two points either side', () => {
    expect(isBullseye(22, 20)).toBe(true);
    expect(isBullseye(23, 20)).toBe(false);
  });

  it('mean is 0 for no values and rounds to one decimal', () => {
    expect(mean([])).toBe(0);
    expect(mean([20.4, 30.6, 20.9])).toBe(24);
  });
});
