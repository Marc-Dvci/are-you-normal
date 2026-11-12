import { reddit, redis } from '@devvit/web/server';
import {
  checkProposal,
  parseProposalMarkdown,
  proposalMarkdown,
} from '../../shared/proposal';
import { commentId, postId as asPostId } from './ids';
import { K, USER_DAY_TTL } from './keys';

/** A proposal needs one upvote besides its author's own. */
export const MIN_PROPOSAL_SCORE = 2;

/** At most this many proposals are read back when the next edition is made. */
export const MAX_PROPOSALS = 40;

export type CommunityPick = {
  question: string;
  options: string[];
  author: string;
  commentId: string;
  score: number;
};

export class ProposalError extends Error {}

/** Posts the proposal as the player's own comment, so it carries their name. */
export const submitProposal = async (
  n: number,
  postId: string,
  userId: string,
  question: string,
  options: readonly string[]
): Promise<string | null> => {
  const checked = checkProposal(question, options);
  if (!checked.ok) throw new ProposalError(checked.reason);
  const first = await redis.hSetNX(K.proposers(n), userId, '1');
  if (first !== 1)
    throw new ProposalError('You already proposed a question today.');
  const count = await redis.incrBy(K.proposalCount(n), 1);
  if (count > MAX_PROPOSALS) {
    throw new ProposalError('Today’s proposal box is full. Try tomorrow.');
  }
  await redis.expire(K.proposers(n), USER_DAY_TTL);
  const comment = await reddit.submitComment({
    id: asPostId(postId),
    text: proposalMarkdown(n, checked.question, checked.options),
    runAs: 'USER',
  });
  await redis.hSet(K.proposals(n), { [comment.id]: userId });
  return comment.permalink ?? null;
};

/**
 * Picks the most upvoted proposal from edition n. Reads each comment again,
 * so a proposal that was removed, or edited into something the rules forbid,
 * is skipped.
 */
export const pickCommunityQuestion = async (
  n: number
): Promise<CommunityPick | null> => {
  const ids = Object.keys(await redis.hGetAll(K.proposals(n))).slice(
    0,
    MAX_PROPOSALS
  );
  let best: (CommunityPick & { createdAt: number }) | null = null;
  for (const id of ids) {
    try {
      const comment = await reddit.getCommentById(commentId(id));
      if (comment.removed || comment.spam) continue;
      const parsed = parseProposalMarkdown(comment.body ?? '');
      if (!parsed) continue;
      if (comment.score < MIN_PROPOSAL_SCORE) continue;
      const createdAt = comment.createdAt.getTime();
      const better =
        !best ||
        comment.score > best.score ||
        (comment.score === best.score && createdAt < best.createdAt);
      if (better) {
        best = {
          ...parsed,
          author: comment.authorName,
          commentId: comment.id,
          score: comment.score,
          createdAt,
        };
      }
    } catch (error) {
      console.error(`Proposal ${id} could not be read`, error);
    }
  }
  if (!best) return null;
  const { createdAt: _createdAt, ...pick } = best;
  return pick;
};
