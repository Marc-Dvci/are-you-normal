import { reddit, redis } from '@devvit/web/server';
import { contrastLine } from '../../shared/compare';
import { shareOf } from '../../shared/scoring';
import { postId as asPostId } from './ids';
import { K } from './keys';
import { loadEdition, publicQuestion, worldQuestion } from './stored';
import { readCounts } from './votes';

const splitText = (options: readonly string[], pcts: readonly number[]) =>
  options
    .map((o, i) => ({ o, p: pcts[i] ?? 0 }))
    .sort((a, b) => b.p - a.p)
    .map(({ o, p }) => `${o} ${p}%`)
    .join(' · ');

/** Writes the final count on yesterday's post, once. */
export const closeEdition = async (n: number): Promise<void> => {
  const first = await redis.incrBy(K.closed(n), 1);
  if (first !== 1) return;
  const postId = await redis.get(K.editionPost(n));
  const stored = await loadEdition(n);
  if (!postId || !stored) return;
  const players = Number((await redis.get(K.players(n))) ?? '0');
  const blocks: string[] = [];
  for (const [q, sq] of stored.entries()) {
    const pub = publicQuestion(sq);
    const { counts, n: total } = await readCounts(n, q, pub.options.length);
    const subPcts = counts.map((c) => shareOf(c, total));
    const lines = [
      `**${pub.text}**`,
      '',
      `This sub (${total}): ${splitText(pub.options, subPcts)}`,
    ];
    const bq = worldQuestion(sq);
    if (bq) {
      lines.push('', `Survey: ${splitText(bq.options, bq.pcts)}`);
      const contrast = contrastLine(bq.options, bq.pcts, counts, total);
      if (contrast) lines.push('', contrast);
    } else if (sq.kind === 'community') {
      lines.push('', `Asked by u/${sq.askedBy}.`);
    }
    blocks.push(lines.join('\n'));
  }
  try {
    await reddit.submitComment({
      id: asPostId(postId),
      text: [
        `**Final count for No. ${n}**, ${players} players.`,
        ...blocks,
      ].join('\n\n'),
      runAs: 'APP',
    });
  } catch (error) {
    console.error(`Final count for No. ${n} failed`, error);
  }
};
