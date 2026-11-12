import { CATEGORIES, type Category, type Source } from '../../shared/types';
import questions from './questions.json';

export type BankSource = Source & {
  licenceUrl: string;
  dataUrl: string | null;
};

/** A question with its published answer shares. Never sent to the client before a guess. */
export type BankQuestion = {
  id: string;
  text: string;
  options: string[];
  /** Percent of the surveyed crowd giving each option, same order as options. */
  pcts: number[];
  category: Category;
  crowd: string;
  source: BankSource;
};

const isCategory = (value: string): value is Category =>
  (CATEGORIES as readonly string[]).includes(value);

const load = (): BankQuestion[] =>
  questions.map((q) => {
    if (!isCategory(q.category)) {
      throw new Error(`Unknown category ${q.category} in ${q.id}`);
    }
    return { ...q, category: q.category };
  });

export const BANK: readonly BankQuestion[] = load();

const byId = new Map(BANK.map((q) => [q.id, q]));

export const bankQuestion = (id: string): BankQuestion | undefined =>
  byId.get(id);
