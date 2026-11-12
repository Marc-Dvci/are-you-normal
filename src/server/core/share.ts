import { reddit, redis } from '@devvit/web/server';
import { verdictMarkdown } from '../../shared/share';
import type { Reveal } from '../../shared/types';
import { thingId } from './ids';
import { K } from './keys';
import { getState, PlayError, type Player } from './play';

/** Posts the player's result as their own reply to the results thread. */
export const postVerdict = async (
  n: number,
  postId: string,
  player: NonNullable<Player>,
  now: Date
): Promise<string | null> => {
  const state = await getState(n, player, now);
  const summary = state.me.summary;
  if (!summary) throw new PlayError('Finish today’s questions first.', 409);
  const first = await redis.hSetNX(K.verdictComments(n), player.userId, '1');
  if (first !== 1) throw new PlayError('Your verdict is already posted.', 409);
  const reveals = state.me.reveals.filter((r): r is Reveal => r !== null);
  const sticky = await redis.get(K.sticky(n));
  const comment = await reddit.submitComment({
    id: thingId(sticky ?? postId),
    text: verdictMarkdown(summary, state.edition.questions, reveals),
    runAs: 'USER',
  });
  return comment.permalink ?? null;
};
