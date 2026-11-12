import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BANK } from '../../src/server/content/bank';
import {
  hitsOffLimits,
  OPTION_MAX,
  QUESTION_MAX,
} from '../../src/shared/proposal';
import { CATEGORIES } from '../../src/shared/types';
import { parseCsv } from './csv';

const LICENCES = [
  'CC BY 4.0',
  'Public domain',
  'Open Government Licence v3.0',
  'Quoted with attribution, Pew Research Center use policy',
];

describe('question bank', () => {
  it('has unique ids and unique wording', () => {
    expect(new Set(BANK.map((q) => q.id)).size).toBe(BANK.length);
    expect(new Set(BANK.map((q) => q.text)).size).toBe(BANK.length);
  });

  it.each(BANK.map((q) => [q.id, q] as const))(
    '%s is playable and cited',
    (_id, q) => {
      expect(q.text.length).toBeLessThanOrEqual(QUESTION_MAX);
      expect(q.options.length).toBeGreaterThanOrEqual(2);
      expect(q.options.length).toBeLessThanOrEqual(6);
      for (const option of q.options)
        expect(option.length).toBeLessThanOrEqual(OPTION_MAX);
      expect(new Set(q.options).size).toBe(q.options.length);
      expect(q.pcts).toHaveLength(q.options.length);
      for (const p of q.pcts) {
        expect(p).toBeGreaterThanOrEqual(0);
        expect(p).toBeLessThanOrEqual(100);
      }
      expect(
        Math.abs(q.pcts.reduce((a, b) => a + b, 0) - 100)
      ).toBeLessThanOrEqual(1.5);
      expect(CATEGORIES).toContain(q.category);
      expect(q.crowd.length).toBeGreaterThan(0);
      expect(LICENCES).toContain(q.source.licence);
      expect(q.source.url).toMatch(/^https:\/\//);
      expect(q.source.licenceUrl).toMatch(/^https:\/\//);
      expect(q.source.sample.length).toBeGreaterThan(0);
      expect(hitsOffLimits([q.text, ...q.options].join(' '))).toBe(false);
    }
  );
});

type Check =
  | {
      id: string;
      kind: 'single';
      file: string;
      columnIndex: number;
      column: string;
      map: Record<string, number>;
    }
  | {
      id: string;
      kind: 'checkbox';
      file: string;
      columnIndex: number;
      column: string;
    };

const checks: Check[] = JSON.parse(
  readFileSync(
    new URL('../../content/fivethirtyeight-checks.json', import.meta.url),
    'utf8'
  )
);

const MISSING = new Set(['', '-']);
const cache = new Map<string, { header: string[]; body: string[][] }>();

/** FiveThirtyEight CSVs carry a second label row whose first cell is empty. */
const load = (file: string) => {
  const hit = cache.get(file);
  if (hit) return hit;
  const rows = parseCsv(
    readFileSync(
      new URL(`../../content/fivethirtyeight/${file}`, import.meta.url),
      'utf8'
    )
  );
  const header = rows[0] ?? [];
  const body = rows
    .slice(1)
    .filter((r) => r.length > 1 && (r[0] ?? '').trim() !== '');
  const loaded = { header, body };
  cache.set(file, loaded);
  return loaded;
};

const sampleSize = (sample: string): number =>
  Number((/^([\d,]+)/.exec(sample)?.[1] ?? '').replace(/,/g, ''));

describe('FiveThirtyEight figures, recomputed from the raw survey files', () => {
  it('covers every FiveThirtyEight question in the bank', () => {
    const fte = BANK.filter((q) =>
      q.source.name.startsWith('FiveThirtyEight')
    ).map((q) => q.id);
    expect(checks.map((c) => c.id).sort()).toEqual([...fte].sort());
  });

  it.each(checks.map((c) => [c.id, c] as const))(
    '%s matches its CSV',
    (id, check) => {
      const q = BANK.find((b) => b.id === id);
      if (!q) throw new Error(`${id} is not in the bank`);
      const { header, body } = load(check.file);
      const counts = q.options.map(() => 0);
      let n = 0;
      if (check.kind === 'single') {
        const col = check.columnIndex;
        expect(header[col]).toBe(check.column);
        for (const row of body) {
          const raw = (row[col] ?? '').trim();
          if (MISSING.has(raw)) continue;
          const index = check.map[raw];
          if (index === undefined)
            throw new Error(`${id}: unmapped answer ${JSON.stringify(raw)}`);
          counts[index] = (counts[index] ?? 0) + 1;
          n++;
        }
      } else {
        expect(header[check.columnIndex]).toBe(check.column);
        n = body.length;
        counts[0] = body.filter(
          (row) => !MISSING.has((row[check.columnIndex] ?? '').trim())
        ).length;
        counts[1] = n - (counts[0] ?? 0);
      }
      expect(n).toBe(sampleSize(q.source.sample));
      q.pcts.forEach((published, i) => {
        expect(Math.abs(published - (100 * (counts[i] ?? 0)) / n)).toBeLessThan(
          0.1
        );
      });
    }
  );
});
