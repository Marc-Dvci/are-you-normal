import { reddit, redis } from '@devvit/web/server';
import { contrastLine } from '../../shared/compare';
import { count } from '../../shared/format';
import { shareOf } from '../../shared/scoring';
import { commentId, postId as asPostId } from './ids';
import { K } from './keys';
import { loadEdition, publicQuestion, worldQuestion } from './stored';
import { readCounts } from './votes';

/** Option indexes, largest share first. */
const byShare = (pcts: readonly number[]): number[] =>
  pcts
    .map((p, i) => ({ p, i }))
    .sort((a, b) => b.p - a.p)
    .map(({ i }) => i);

const splitText = (
  options: readonly string[],
  pcts: readonly number[],
  order: readonly number[]
) => order.map((i) => `${options[i]} ${pcts[i] ?? 0}%`).join(' · ');

const finalHead = (n: number) => `**Final count for No. ${n}**`;

/**
 * The closing comment for edition n: each question's split in this subreddit
 * and in the survey, both rows in the survey's order so they line up.
 */
export const finalCountText = async (n: number): Promise<string | null> => {
  const stored = await loadEdition(n);
  if (!stored) return null;
  const players = Number((await redis.get(K.players(n))) ?? '0');
  const blocks: string[] = [];
  for (const [q, sq] of stored.entries()) {
    const pub = publicQuestion(sq);
    const { counts, n: total } = await readCounts(n, q, pub.options.length);
    const subPcts = counts.map((c) => shareOf(c, total));
    const bq = worldQuestion(sq);
    const order = byShare(bq ? bq.pcts : subPcts);
    const lines = [
      `**${pub.text}**`,
      '',
      total === 0
        ? 'This sub: no answers.'
        : `This sub, ${count(total, 'answer')}: ${splitText(pub.options, subPcts, order)}`,
    ];
    if (bq) {
      const year = bq.source.year ? `, ${bq.source.year}` : '';
      lines.push(
        '',
        `Survey: ${splitText(bq.options, bq.pcts, order)}`,
        '',
        `*Source: ${bq.source.name}${year}.*`
      );
      const contrast = contrastLine(bq.options, bq.pcts, counts, total);
      if (contrast) lines.push('', contrast);
    } else if (sq.kind === 'community') {
      lines.push('', `Asked by u/${sq.askedBy}.`);
    }
    blocks.push(lines.join('\n'));
  }
  return [`${finalHead(n)}: ${count(players, 'player')}.`, ...blocks].join(
    '\n\n'
  );
};

/** Writes the final count on yesterday's post, once. */
export const closeEdition = async (n: number): Promise<void> => {
  const first = await redis.incrBy(K.closed(n), 1);
  if (first !== 1) return;
  const postId = await redis.get(K.editionPost(n));
  const text = await finalCountText(n);
  if (!postId || !text) return;
  try {
    const comment = await reddit.submitComment({
      id: asPostId(postId),
      text,
      runAs: 'APP',
    });
    await redis.set(K.finalComment(n), comment.id);
  } catch (error) {
    console.error(`Final count for No. ${n} failed`, error);
  }
};

/** The app's final-count comment on edition n, from its stored id or by search. */
const findFinalComment = async (n: number, postId: string) => {
  const id = await redis.get(K.finalComment(n));
  if (id) return reddit.getCommentById(commentId(id));
  const post = asPostId(postId);
  const comments = await reddit.getComments({ postId: post, limit: 100 }).all();
  const found = comments.find(
    (c) => c.parentId === post && c.body.startsWith(finalHead(n))
  );
  if (found) await redis.set(K.finalComment(n), found.id);
  return found ?? null;
};

/**
 * Rewrites the final-count comments of closed editions when the app is
 * upgraded, so a wording fix reaches the comments already posted.
 */
export const refreshFinalCounts = async (today: number): Promise<number> => {
  let edited = 0;
  for (let n = 1; n < today; n++) {
    try {
      if (!(await redis.get(K.closed(n)))) continue;
      const postId = await redis.get(K.editionPost(n));
      const text = await finalCountText(n);
      if (!postId || !text) continue;
      const comment = await findFinalComment(n, postId);
      if (!comment || comment.body === text) continue;
      await comment.edit({ text });
      edited++;
    } catch (error) {
      console.error(`Final count for No. ${n} not refreshed`, error);
    }
  }
  return edited;
};
