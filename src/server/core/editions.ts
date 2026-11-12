import { context, reddit, redis } from '@devvit/web/server';
import { dayOfEdition, editionOn, isoDay } from '../../shared/edition';
import type { PublicQuestion } from '../../shared/types';
import { BANK } from '../content/bank';
import { closeEdition } from './close';
import { pickCommunityQuestion, type CommunityPick } from './community';
import { postId as asPostId } from './ids';
import { K } from './keys';
import { loadEdition, publicQuestion, type StoredQuestion } from './stored';

export const QUESTIONS_PER_EDITION = 3;

/** The epoch is the UTC day of edition 1. It is set once, at install. */
export const ensureEpoch = async (now: Date): Promise<string> => {
  const existing = await redis.get(K.epoch);
  if (existing) return existing;
  await redis.set(K.epoch, isoDay(now), { nx: true });
  return (await redis.get(K.epoch)) ?? isoDay(now);
};

export const todayEdition = async (now: Date): Promise<number> =>
  editionOn(now, await ensureEpoch(now));

export const editionDate = async (n: number, now: Date): Promise<string> =>
  dayOfEdition(n, await ensureEpoch(now));

export const editionForPost = async (
  postId: string
): Promise<number | null> => {
  const stored = await redis.get(K.postEdition(postId));
  if (stored) return Number(stored);
  const fromPostData = context.postData?.['edition'];
  return typeof fromPostData === 'number' ? fromPostData : null;
};

/** Takes the next questions from the bank, in bank order, wrapping at the end. */
const nextWorldQuestions = async (count: number): Promise<StoredQuestion[]> => {
  const end = await redis.incrBy(K.cursor, count);
  const start = end - count;
  return Array.from({ length: count }, (_, i) => {
    const q = BANK[(start + i) % BANK.length];
    if (!q) throw new Error('The question bank is empty');
    return { kind: 'world' as const, id: q.id };
  });
};

const communityStored = (n: number, pick: CommunityPick): StoredQuestion => ({
  kind: 'community',
  id: `community-${n}`,
  text: pick.question,
  options: pick.options,
  askedBy: pick.author,
});

const fallbackText = (n: number, qs: PublicQuestion[]): string =>
  [
    `**Are You Normal? No. ${n}**`,
    '',
    ...qs.map((q, i) => `${i + 1}. ${q.text}`),
    '',
    'Answer, guess how many people answered like you, then see the real numbers.',
  ].join('\n');

export type CreatedEdition = { postId: string | null; created: boolean };

/** Chooses and freezes edition n's questions, once. */
export const prepareEdition = async (n: number): Promise<StoredQuestion[]> => {
  const existing = await loadEdition(n);
  if (existing) return existing;
  const pick = n > 1 ? await pickCommunityQuestion(n - 1) : null;
  const world = await nextWorldQuestions(
    pick ? QUESTIONS_PER_EDITION - 1 : QUESTIONS_PER_EDITION
  );
  const stored = pick ? [...world, communityStored(n, pick)] : world;
  await redis.set(K.editionQuestions(n), JSON.stringify(stored));
  return stored;
};

/**
 * Creates edition n and its post, once. Safe to call from the scheduler, a
 * menu item and a player request at the same time.
 */
export const createEdition = async (
  n: number,
  subredditName: string
): Promise<CreatedEdition> => {
  const existing = await redis.get(K.editionPost(n));
  if (existing) return { postId: existing, created: false };

  const lock = await redis.incrBy(K.lock(n), 1);
  await redis.expire(K.lock(n), 120);
  if (lock !== 1) return { postId: null, created: false };

  try {
    const pub = (await prepareEdition(n)).map(publicQuestion);
    const post = await reddit.submitCustomPost({
      subredditName,
      title: `${pub[0]?.text ?? 'Are you normal?'} · Are You Normal? No. ${n}`,
      entry: 'default',
      postData: { edition: n },
      textFallback: { text: fallbackText(n, pub) },
    });
    await redis.set(K.editionPost(n), post.id);
    await redis.set(K.postEdition(post.id), String(n));
    await startResultsThread(n, post.id);
    if (n > 1) await closeEdition(n - 1);
    return { postId: post.id, created: true };
  } finally {
    await redis.del(K.lock(n));
  }
};

const startResultsThread = async (n: number, postId: string): Promise<void> => {
  try {
    const comment = await reddit.submitComment({
      id: asPostId(postId),
      text: [
        `**Results thread for No. ${n}.**`,
        '',
        'Post your verdict from the game as a reply here.',
        `Propose a question at the end of the game. The most upvoted proposal runs as the community question in No. ${n + 1}.`,
      ].join('\n'),
      runAs: 'APP',
    });
    await redis.set(K.sticky(n), comment.id);
    await comment.distinguish(true);
  } catch (error) {
    console.error(`Results thread for No. ${n} failed`, error);
  }
};

export const ensureTodayEdition = async (
  now: Date,
  subredditName: string
): Promise<CreatedEdition & { edition: number }> => {
  const n = await todayEdition(now);
  return { ...(await createEdition(n, subredditName)), edition: n };
};
