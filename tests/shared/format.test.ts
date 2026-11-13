import { describe, expect, it } from 'vitest';
import { count, ordinal, pctText } from '../../src/shared/format';

describe('display formats', () => {
  it.each([
    [0, 'player', '0 players'],
    [1, 'player', '1 player'],
    [2, 'player', '2 players'],
    [1, 'answer', '1 answer'],
    [10, 'answer', '10 answers'],
  ])('count(%i, %s) reads "%s"', (n, noun, expected) => {
    expect(count(n, noun)).toBe(expected);
  });

  it.each([
    [1, '1st'],
    [2, '2nd'],
    [3, '3rd'],
    [4, '4th'],
    [11, '11th'],
    [12, '12th'],
    [13, '13th'],
    [21, '21st'],
    [102, '102nd'],
    [111, '111th'],
  ])('ordinal(%i) is %s', (n, expected) => {
    expect(ordinal(n)).toBe(expected);
  });

  it('pctText keeps whole numbers whole and gives one decimal otherwise', () => {
    expect(pctText(30)).toBe('30%');
    expect(pctText(20.9)).toBe('20.9%');
    expect(pctText(35.75)).toBe('35.8%');
  });
});
