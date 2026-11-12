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
  'CC0 1.0',
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

type Dataset = 'fivethirtyeight' | 'young-people-survey';

type ColumnsCheck = {
  id: string;
  dataset: 'food-and-you-2';
  kind: 'columns';
  file: string;
  table: string;
  /** Columns summed for each option; an empty list is the complement. */
  options: string[][];
};

type Check =
  | ColumnsCheck
  | {
      id: string;
      dataset: Dataset;
      kind: 'single';
      file: string;
      columnIndex: number;
      column: string;
      map: Record<string, number>;
    }
  | {
      id: string;
      dataset: Dataset;
      kind: 'checkbox';
      file: string;
      columnIndex: number;
      column: string;
    };

const checks: Check[] = JSON.parse(
  readFileSync(new URL('../../content/checks.json', import.meta.url), 'utf8')
);

const MISSING = new Set(['', '-']);
const cache = new Map<string, { header: string[]; body: string[][] }>();

/**
 * Loads a raw survey file. FiveThirtyEight files carry a second label row
 * whose first cell is empty; the Young People Survey has one header row.
 */
const load = (dataset: Dataset, file: string) => {
  const key = `${dataset}/${file}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const rows = parseCsv(
    readFileSync(new URL(`../../content/data/${key}`, import.meta.url), 'utf8')
  );
  const header = rows[0] ?? [];
  const body = rows
    .slice(1)
    .filter((r) => r.length > 1)
    .filter((r) => dataset !== 'fivethirtyeight' || (r[0] ?? '').trim() !== '');
  const loaded = { header, body };
  cache.set(key, loaded);
  return loaded;
};

const sampleSize = (sample: string): number =>
  Number((/^([\d,]+)/.exec(sample)?.[1] ?? '').replace(/,/g, ''));

const FROM_RAW_FILES = [
  'FiveThirtyEight',
  'Young People Survey',
  'Food Standards Agency',
];

const tableTotals = (file: string): Map<string, number> => {
  const rows = parseCsv(
    readFileSync(
      new URL(`../../content/data/food-and-you-2/${file}`, import.meta.url),
      'utf8'
    )
  );
  return new Map(
    rows
      .slice(1)
      .filter((r) => r.length === 3)
      .map((r) => [`${r[0]}|${r[1]}`, Number(r[2])])
  );
};

/** Published shares are the weighted Total row of each table, summed per option. */
const checkColumns = (check: ColumnsCheck) => {
  const q = BANK.find((b) => b.id === check.id);
  if (!q) throw new Error(`${check.id} is not in the bank`);
  const totals = tableTotals(check.file);
  const cell = (column: string): number => {
    const value = totals.get(`${check.table}|${column}`);
    if (value === undefined)
      throw new Error(`${check.id}: no ${column} in ${check.table}`);
    return value;
  };
  expect(cell('Sample Size')).toBe(sampleSize(q.source.sample));
  expect(check.options).toHaveLength(q.options.length);
  const sums = check.options.map((cols) =>
    cols.reduce((sum, c) => sum + cell(c), 0)
  );
  const shares = check.options.map((cols, i) =>
    cols.length > 0
      ? (sums[i] ?? 0)
      : 100 - sums.reduce((a, b, j) => (j === i ? a : a + b), 0)
  );
  q.pcts.forEach((published, i) => {
    expect(Math.abs(published - (shares[i] ?? 0))).toBeLessThan(0.1);
  });
};

describe('survey figures, recomputed from the raw response files', () => {
  it('covers every question that comes from a raw response file', () => {
    const fromFiles = BANK.filter((q) =>
      FROM_RAW_FILES.some((name) => q.source.name.startsWith(name))
    ).map((q) => q.id);
    expect(checks.map((c) => c.id).sort()).toEqual([...fromFiles].sort());
  });

  it.each(checks.map((c) => [c.id, c] as const))(
    '%s matches its raw file',
    (id, check) => {
      if (check.kind === 'columns') {
        checkColumns(check);
        return;
      }
      const q = BANK.find((b) => b.id === id);
      if (!q) throw new Error(`${id} is not in the bank`);
      const { header, body } = load(check.dataset, check.file);
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
