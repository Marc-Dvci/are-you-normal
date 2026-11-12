/**
 * Local server for development and screenshots. Runs the real Hono app with
 * Reddit's own plugin mocks, the same ones `@devvit/test` uses. Nothing here
 * ships: the Devvit build only bundles src/.
 *
 *   npx tsx dev/server.ts                  # http://localhost:8787
 *   DEV_PLAYERS=40 npx tsx dev/server.ts   # with simulated local players
 */
import { TelemetryMock } from '@devvit/analytics/server/reddit/test';
import { MediaMock } from '@devvit/media/test';
import { NotificationsMock } from '@devvit/notifications/test';
import { RealtimeDefinition } from '@devvit/protos/types/devvit/events/v1alpha/realtime.js';
import { MediaServiceDefinition } from '@devvit/protos/types/devvit/plugin/media/media.js';
import { NotificationsDefinition } from '@devvit/protos/types/devvit/plugin/notifications/notifications_svc.js';
import { RedisAPIDefinition } from '@devvit/protos/types/devvit/plugin/redis/redisapi.js';
import { SchedulerDefinition } from '@devvit/protos/types/devvit/plugin/scheduler/scheduler.js';
import { SettingsDefinition } from '@devvit/protos/types/devvit/plugin/settings/v1alpha/settings.js';
import { TelemetryPluginDefinition } from '@devvit/protos/types/devvit/plugin/telemetry/telemetry.js';
import { RealtimeMock } from '@devvit/realtime/server/test';
import { RedditPluginMock } from '@devvit/reddit/test';
import { RedisMock } from '@devvit/redis/test';
import { SchedulerMock } from '@devvit/scheduler/test';
import { Context, runWithContext } from '@devvit/server';
import { SettingsMock } from '@devvit/settings/test';
import {
  getDefaultAppConfig,
  installGlobalConfig,
  makeConfig,
} from '@devvit/shared-types/test/index.js';
import { reddit } from '@devvit/web/server';
import { serve } from '@hono/node-server';
import Redis from 'ioredis-mock';
import { app } from '../src/server/app';

const SUB = 'areyounormal';
const redditMock = new RedditPluginMock();
redditMock.subreddits.addSubreddit({
  id: 't5_dev',
  displayName: SUB,
  title: SUB,
});
for (const name of ['alice', 'bram', 'chen', 'dara']) {
  redditMock.users.addUser({ id: `t2_${name}`, name });
}

const config = makeConfig({
  plugins: {
    [MediaServiceDefinition.fullName]: new MediaMock().plugin,
    [RedisAPIDefinition.fullName]: new RedisMock(new Redis(), 'dev').plugin,
    [RealtimeDefinition.fullName]: new RealtimeMock().plugin,
    [SettingsDefinition.fullName]: new SettingsMock({}).plugin,
    [SchedulerDefinition.fullName]: new SchedulerMock().plugin,
    [NotificationsDefinition.fullName]: new NotificationsMock().plugin,
    [TelemetryPluginDefinition.fullName]: new TelemetryMock().plugin,
    ...redditMock.getPluginRegistrations(),
  },
});
installGlobalConfig(config, getDefaultAppConfig());

// Reddit's mock has no comment API. Locally, comments are printed instead.
let commentSeq = 0;
Object.assign(reddit, {
  submitComment: async (opts: { text: string }) => {
    commentSeq += 1;
    const id = `t1_dev${commentSeq}`;
    console.log(`[comment ${id}]\n${opts.text}\n`);
    return {
      id,
      permalink: `/r/${SUB}/comments/dev/_/${id}`,
      distinguish: async () => undefined,
    };
  },
});

const headersFor = (user: string | null, postId: string | null) => {
  const h: Record<string, string> = {
    'devvit-subreddit': 't5_dev',
    'devvit-subreddit-name': SUB,
    'devvit-app': 'are-you-normal',
    'devvit-version': '0.0.0-dev',
    'devvit-installation': 'dev',
  };
  if (user) {
    h['devvit-user'] = `t2_${user}`;
    h['devvit-user-name'] = user;
    h['devvit-app-user'] = `t2_${user}`;
  }
  if (postId) h['devvit-post'] = postId;
  return h;
};

const inContext = <T>(
  user: string | null,
  postId: string | null,
  fn: () => Promise<T>
): Promise<T> => runWithContext(Context(headersFor(user, postId)), fn);

const call = (
  user: string | null,
  postId: string | null,
  path: string,
  body?: unknown
): Promise<Response> =>
  inContext(user, postId, async () =>
    app.request(
      path,
      body === undefined
        ? {}
        : {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(body),
          }
    )
  );

/** Simulated local players, so the subreddit bars show something in development. */
const simulate = async (postId: string, players: number): Promise<void> => {
  const state = (await (await call('alice', postId, '/api/state')).json()) as {
    edition: { questions: { options: string[] }[] };
  };
  for (let p = 0; p < players; p++) {
    const user = `sim${p}`;
    redditMock.users.addUser({ id: `t2_${user}`, name: user });
    for (const [q, question] of state.edition.questions.entries()) {
      const option = Math.floor(Math.random() * question.options.length);
      await call(user, postId, '/api/guess', {
        q,
        option,
        guess: Math.floor(Math.random() * 101),
      });
    }
  }
};

const boot = async (): Promise<string> => {
  const install = await call(
    null,
    null,
    '/internal/triggers/on-app-install',
    {}
  );
  const message = ((await install.json()) as { message: string }).message;
  const postId = /(t3_\w+)/.exec(message)?.[1];
  if (!postId) throw new Error(`Install failed: ${message}`);
  const players = Number(process.env['DEV_PLAYERS'] ?? '0');
  if (players > 0) await simulate(postId, players);
  return postId;
};

const postId = await boot();
const port = Number(process.env['PORT'] ?? '8787');

serve({
  port,
  fetch: async (request) => {
    const url = new URL(request.url);
    if (url.pathname === '/dev/post') return Response.json({ postId });
    const user = request.headers.get('x-dev-user');
    return inContext(user && user !== 'anon' ? user : null, postId, async () =>
      app.fetch(request)
    );
  },
});

console.log(`Dev server on http://localhost:${port}, edition post ${postId}`);
