import { context, reddit } from '@devvit/web/server';
import { Hono, type Context } from 'hono';
import type {
  AnswerResponse,
  CommentResponse,
  ErrorResponse,
  GuessResponse,
  ProposalResponse,
  StateResponse,
} from '../../shared/types';
import { ProposalError, submitProposal } from '../core/community';
import { editionForPost, ensureTodayEdition } from '../core/editions';
import { answer, getState, guess, PlayError, type Player } from '../core/play';
import { postVerdict } from '../core/share';
import { telemetryRoutes } from './telemetry';

export const api = new Hono();

api.route('/telemetry', telemetryRoutes);

const currentPlayer = async (): Promise<Player> => {
  const userId = context.userId;
  if (!userId) return null;
  const username =
    context.username ?? (await reddit.getCurrentUsername()) ?? 'someone';
  return { userId, username };
};

const currentEdition = async (): Promise<{ n: number; postId: string }> => {
  const postId = context.postId;
  if (!postId) throw new PlayError('Open the game from its post.');
  const n = await editionForPost(postId);
  if (n === null) throw new PlayError('This post is not an edition.', 404);
  return { n, postId };
};

type Body = Record<string, unknown>;

const readBody = async (c: Context): Promise<Body> => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    body = null;
  }
  if (typeof body === 'object' && body !== null) return body as Body;
  throw new PlayError('The request body must be JSON.');
};

const int = (body: Body, field: string): number => {
  const value = body[field];
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new PlayError(`${field} must be a whole number.`);
  }
  return value;
};

const fail = (c: Context, error: unknown): Response => {
  if (error instanceof PlayError) {
    return c.json<ErrorResponse>(
      { type: 'error', message: error.message },
      error.status
    );
  }
  if (error instanceof ProposalError) {
    return c.json<ErrorResponse>(
      { type: 'error', message: error.message },
      400
    );
  }
  console.error('API error', error);
  return c.json<ErrorResponse>(
    { type: 'error', message: 'Something went wrong. Try again.' },
    500
  );
};

api.get('/state', async (c) => {
  try {
    const now = new Date();
    const { n } = await currentEdition();
    try {
      await ensureTodayEdition(now, context.subredditName);
    } catch (error) {
      console.error('Could not make today’s edition', error);
    }
    return c.json<StateResponse>(await getState(n, await currentPlayer(), now));
  } catch (error) {
    return fail(c, error);
  }
});

api.post('/answer', async (c) => {
  try {
    const body = await readBody(c);
    const { n } = await currentEdition();
    const recorded = await answer(
      n,
      int(body, 'q'),
      int(body, 'option'),
      await currentPlayer()
    );
    return c.json<AnswerResponse>({ type: 'answer', recorded });
  } catch (error) {
    return fail(c, error);
  }
});

api.post('/guess', async (c) => {
  try {
    const body = await readBody(c);
    const { n } = await currentEdition();
    const result = await guess(
      n,
      int(body, 'q'),
      int(body, 'guess'),
      int(body, 'option'),
      await currentPlayer(),
      new Date()
    );
    return c.json<GuessResponse>(result);
  } catch (error) {
    return fail(c, error);
  }
});

api.post('/verdict', async (c) => {
  try {
    const player = await currentPlayer();
    if (!player) throw new PlayError('Log in to post your verdict.');
    const { n, postId } = await currentEdition();
    const permalink = await postVerdict(n, postId, player, new Date());
    return c.json<CommentResponse>({ type: 'comment', permalink });
  } catch (error) {
    return fail(c, error);
  }
});

api.post('/propose', async (c) => {
  try {
    const player = await currentPlayer();
    if (!player) throw new PlayError('Log in to propose a question.');
    const body = await readBody(c);
    const question = body['question'];
    const options = body['options'];
    if (
      typeof question !== 'string' ||
      !Array.isArray(options) ||
      !options.every((o): o is string => typeof o === 'string')
    ) {
      throw new PlayError('Send a question and its answers.');
    }
    const { n, postId } = await currentEdition();
    const permalink = await submitProposal(
      n,
      postId,
      player.userId,
      question,
      options
    );
    return c.json<ProposalResponse>({ type: 'proposal', permalink });
  } catch (error) {
    return fail(c, error);
  }
});
