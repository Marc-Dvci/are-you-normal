import { redis } from '@devvit/web/server';
import type { PublicQuestion } from '../../shared/types';
import { bankQuestion, type BankQuestion } from '../content/bank';
import { K } from './keys';

/** An edition's questions, frozen when the edition is made. */
export type StoredQuestion =
  | { kind: 'world'; id: string }
  | {
      kind: 'community';
      id: string;
      text: string;
      options: string[];
      askedBy: string;
    };

export const loadEdition = async (
  n: number
): Promise<StoredQuestion[] | null> => {
  const raw = await redis.get(K.editionQuestions(n));
  return raw ? (JSON.parse(raw) as StoredQuestion[]) : null;
};

export const worldQuestion = (sq: StoredQuestion): BankQuestion | null => {
  if (sq.kind !== 'world') return null;
  const bq = bankQuestion(sq.id);
  if (!bq) throw new Error(`Question ${sq.id} is missing from the bank`);
  return bq;
};

export const publicQuestion = (sq: StoredQuestion): PublicQuestion => {
  if (sq.kind === 'community') {
    return {
      id: sq.id,
      kind: 'community',
      text: sq.text,
      options: sq.options,
      category: 'social',
      crowd: 'players here',
      askedBy: sq.askedBy,
    };
  }
  const bq = worldQuestion(sq);
  if (!bq) throw new Error(`Question ${sq.id} is missing from the bank`);
  return {
    id: bq.id,
    kind: 'world',
    text: bq.text,
    options: bq.options,
    category: bq.category,
    crowd: bq.crowd,
    askedBy: null,
  };
};
