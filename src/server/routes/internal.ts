import { context } from '@devvit/web/server';
import type { UiResponse } from '@devvit/web/shared';
import { Hono } from 'hono';
import { refreshFinalCounts } from '../core/close';
import {
  createEdition,
  ensureEpoch,
  ensureTodayEdition,
  todayEdition,
} from '../core/editions';

export const internal = new Hono();

const postUrl = (postId: string): string =>
  `https://reddit.com/r/${context.subredditName}/comments/${postId.replace(/^t3_/, '')}`;

/** Daily job: makes today's edition if it does not exist yet. */
internal.post('/scheduler/new-edition', async (c) => {
  try {
    const result = await ensureTodayEdition(new Date(), context.subredditName);
    console.log(
      `No. ${result.edition}: ${result.created ? 'created' : 'already up'}`
    );
    return c.json({ status: 'ok' }, 200);
  } catch (error) {
    console.error('Daily edition failed', error);
    return c.json({ status: 'error' }, 500);
  }
});

/** Moderator fallback for the daily job. */
internal.post('/menu/new-edition', async (c) => {
  try {
    const result = await ensureTodayEdition(new Date(), context.subredditName);
    if (!result.postId) {
      return c.json<UiResponse>({
        showToast: 'Today’s edition is being made. Try again in a minute.',
      });
    }
    return c.json<UiResponse>({ navigateTo: postUrl(result.postId) });
  } catch (error) {
    console.error('Menu edition failed', error);
    return c.json<UiResponse>(
      { showToast: 'Could not post today’s edition.' },
      400
    );
  }
});

/** Install: today becomes No. 1. */
internal.post('/triggers/on-app-install', async (c) => {
  try {
    await ensureEpoch(new Date());
    const result = await createEdition(1, context.subredditName);
    return c.json({
      status: 'success',
      message: `No. 1 posted as ${result.postId ?? 'pending'}`,
    });
  } catch (error) {
    console.error('Install failed', error);
    return c.json({ status: 'error', message: 'Could not post No. 1' }, 400);
  }
});

/** Upgrade: rewrites posted final counts in the current wording. */
internal.post('/triggers/on-app-upgrade', async (c) => {
  try {
    const edited = await refreshFinalCounts(await todayEdition(new Date()));
    return c.json({
      status: 'success',
      message: `${edited} final counts rewritten`,
    });
  } catch (error) {
    console.error('Upgrade failed', error);
    return c.json({ status: 'error', message: 'Upgrade step failed' }, 400);
  }
});
