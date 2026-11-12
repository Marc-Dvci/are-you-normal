import { realtime, redis } from '@devvit/web/server';
import type { LiveMessage } from '../../shared/types';
import { K, liveChannel } from './keys';

export type Counts = { counts: number[]; n: number };

export const readCounts = async (
  n: number,
  q: number,
  optionCount: number
): Promise<Counts> => {
  const raw = await redis.hGetAll(K.votes(n, q));
  const counts = Array.from({ length: optionCount }, (_, i) =>
    Number(raw[String(i)] ?? '0')
  );
  return { counts, n: counts.reduce((a, b) => a + b, 0) };
};

/**
 * Records one vote per player per question. Returns false when the player
 * had already answered; the first answer stands.
 */
export const recordVote = async (
  n: number,
  q: number,
  option: number,
  userId: string
): Promise<boolean> => {
  const first = await redis.hSetNX(K.voters(n, q), userId, String(option));
  if (first !== 1) return false;
  await redis.hIncrBy(K.votes(n, q), String(option), 1);
  if (q === 0) await redis.incrBy(K.players(n), 1);
  return true;
};

/** The player's stored answer, if any. */
export const storedVote = async (
  n: number,
  q: number,
  userId: string
): Promise<number | null> => {
  const raw = await redis.hGet(K.voters(n, q), userId);
  return raw === undefined ? null : Number(raw);
};

/** Pushes live counts to open reveals, at most once a second per question. */
export const broadcastCounts = async (
  n: number,
  q: number,
  optionCount: number
): Promise<void> => {
  const tick = await redis.incrBy(K.live(n, q), 1);
  if (tick !== 1) return;
  await redis.expire(K.live(n, q), 1);
  const { counts } = await readCounts(n, q, optionCount);
  const message: LiveMessage = { q, counts };
  try {
    await realtime.send(liveChannel(n), message);
  } catch (error) {
    console.error('Live count push failed', error);
  }
};
