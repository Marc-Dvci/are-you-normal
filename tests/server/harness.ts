import { Context, runWithContext } from '@devvit/server';
import { createDevvitTest } from '@devvit/test/server/vitest';
import { reddit } from '@devvit/web/server';
import { vi } from 'vitest';
import { app } from '../../src/server/app';

export const test = createDevvitTest({
  username: 'alice',
  userId: 't2_alice',
  subredditName: 'areyounormal',
});

export type As = { userId?: string; username?: string; postId?: string };

export const ANON: As = { userId: '' };

/** Calls the real Hono app as a given player on a given post. */
export const call = async (
  base: Record<string, string | undefined>,
  as: As,
  path: string,
  body?: unknown
): Promise<Response> => {
  const headers: Record<string, string> = {};
  for (const [k, v] of Object.entries(base)) if (v) headers[k] = v;
  if (as.userId === '') {
    delete headers['devvit-user'];
    delete headers['devvit-user-name'];
  } else {
    if (as.userId) headers['devvit-user'] = as.userId;
    if (as.username) headers['devvit-user-name'] = as.username;
  }
  if (as.postId) headers['devvit-post'] = as.postId;
  const init: RequestInit =
    body === undefined
      ? { method: 'GET' }
      : {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: typeof body === 'string' ? body : JSON.stringify(body),
        };
  return runWithContext(Context(headers), async () => app.request(path, init));
};

export const json = async <T>(response: Response): Promise<T> =>
  (await response.json()) as T;

/** Installs the app and returns the post id of No. 1. */
export const install = async (
  headers: Record<string, string | undefined>
): Promise<string> => {
  const res = await call(headers, {}, '/internal/triggers/on-app-install', {});
  const body = await json<{ message: string }>(res);
  const postId = /(t3_\w+)/.exec(body.message)?.[1];
  if (!postId) throw new Error(`Install failed: ${body.message}`);
  return postId;
};

/**
 * Reddit's plugin mock has no comment API, so tests record comments here.
 * This is the one Reddit call the tests fake by hand.
 */
export const recordComments = () => {
  const posted: { id: string; parent: string; text: string; runAs: string }[] =
    [];
  vi.spyOn(reddit, 'submitComment').mockImplementation(async (opts) => {
    const id = `t1_c${posted.length + 1}`;
    const text = 'text' in opts ? opts.text : '';
    posted.push({
      id,
      parent: opts.id,
      text,
      runAs: opts.runAs ?? 'APP',
    });
    const comment = {
      id,
      body: text,
      permalink: `/r/areyounormal/comments/x/_/${id}`,
      distinguish: async () => undefined,
    };
    return comment as unknown as Awaited<
      ReturnType<typeof reddit.submitComment>
    >;
  });
  return posted;
};
