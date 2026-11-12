import { redis } from '@devvit/web/server';
import { MIN_BIAS_GUESSES } from '../../shared/summary';
import { K } from './keys';

export type Stats = {
  streak: number;
  best: number;
  lastEdition: number;
  played: number;
  biasTenths: number;
  biasN: number;
};

const num = (raw: string | undefined): number => Number(raw ?? '0') || 0;

export const readStats = async (userId: string): Promise<Stats> => {
  const raw = await redis.hGetAll(K.userStats(userId));
  return {
    streak: num(raw['streak']),
    best: num(raw['best']),
    lastEdition: num(raw['lastEdition']),
    played: num(raw['played']),
    biasTenths: num(raw['biasTenths']),
    biasN: num(raw['biasN']),
  };
};

/** A streak survives until the day after the last edition played on its own day. */
export const currentStreak = (stats: Stats, today: number): number =>
  stats.lastEdition >= today - 1 ? stats.streak : 0;

/** Positive when the guess was higher than the truth. */
export const recordBias = async (
  userId: string,
  guess: number,
  truth: number
): Promise<void> => {
  await redis.hIncrBy(
    K.userStats(userId),
    'biasTenths',
    Math.round((guess - truth) * 10)
  );
  await redis.hIncrBy(K.userStats(userId), 'biasN', 1);
};

export const biasOf = (stats: Stats): { mean: number; n: number } | null =>
  stats.biasN >= MIN_BIAS_GUESSES
    ? {
        mean: Math.round(stats.biasTenths / stats.biasN) / 10,
        n: stats.biasN,
      }
    : null;

/**
 * Counts a finished edition. Only an edition finished on its own UTC day
 * extends the streak; catching up on an old post does not.
 */
export const completeEdition = async (
  userId: string,
  edition: number,
  today: number
): Promise<Stats> => {
  const stats = await readStats(userId);
  const next = { ...stats, played: stats.played + 1 };
  if (edition === today) {
    if (stats.lastEdition === today - 1) next.streak = stats.streak + 1;
    else if (stats.lastEdition !== today) next.streak = 1;
    next.lastEdition = today;
    next.best = Math.max(stats.best, next.streak);
  }
  await redis.hSet(K.userStats(userId), {
    streak: String(next.streak),
    best: String(next.best),
    lastEdition: String(next.lastEdition),
    played: String(next.played),
  });
  return next;
};
