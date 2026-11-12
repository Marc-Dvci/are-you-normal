import { reddit, redis } from '@devvit/web/server';
import { afterEach, describe, expect, vi } from 'vitest';
import { BANK } from '../../src/server/content/bank';
import type { GuessResponse, StateResponse } from '../../src/shared/types';
import { ANON, call, install, json, recordComments, test } from './harness';

const ALICE = { userId: 't2_alice', username: 'alice' };
const BOB = { userId: 't2_bob', username: 'bob' };
const DAY1 = new Date('2026-11-20T09:00:00Z');
const DAY2 = new Date('2026-11-21T09:00:00Z');

afterEach(() => {
  vi.useRealTimers();
});

const at = (when: Date) => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(when);
};

const propose = (
  headers: Record<string, string>,
  as: object,
  postId: string,
  question: string,
  options: string[]
) => call(headers, { ...as, postId }, '/api/propose', { question, options });

type Posted = ReturnType<typeof recordComments>;

/** Serves the recorded proposal comments back with the given scores. */
const serveComments = (
  posted: Posted,
  scores: Record<string, number>,
  removed: string[] = []
) => {
  vi.spyOn(reddit, 'getCommentById').mockImplementation(async (id) => {
    const c = posted.find((p) => p.id === id);
    if (!c) throw new Error(`no comment ${id}`);
    const comment = {
      id,
      body: c.text,
      score: scores[id] ?? 1,
      removed: removed.includes(id),
      spam: false,
      createdAt: new Date(DAY1.getTime() + posted.indexOf(c) * 1000),
      authorName:
        c.runAs === 'USER'
          ? c.text.includes('socks')
            ? 'alice'
            : 'bob'
          : 'app',
    };
    return comment as unknown as Awaited<
      ReturnType<typeof reddit.getCommentById>
    >;
  });
};

const nextDay = async (headers: Record<string, string>) => {
  at(DAY2);
  await call(headers, {}, '/internal/scheduler/new-edition', {});
  const id = await redis.get('ed:2:post');
  if (!id) throw new Error('No. 2 was not posted');
  return id;
};

describe('community questions', () => {
  test('a proposal is posted as the player’s own comment, once a day', async ({
    headers,
  }) => {
    at(DAY1);
    const posted = recordComments();
    const postId = await install(headers);
    const ok = await propose(
      headers,
      ALICE,
      postId,
      'Do you sleep with socks on?',
      ['Always', 'Never']
    );
    expect(ok.status).toBe(200);
    const comment = posted.at(-1);
    expect(comment?.runAs).toBe('USER');
    expect(comment?.parent).toBe(postId);
    expect(comment?.text).toContain(
      '**Proposal for No. 2:** Do you sleep with socks on?'
    );
    const again = await propose(
      headers,
      ALICE,
      postId,
      'Do you make your bed?',
      ['Yes', 'No']
    );
    expect(again.status).toBe(400);
    expect((await json<{ message: string }>(again)).message).toContain(
      'already proposed'
    );
  });

  test('off-limits and logged-out proposals are refused before anything is posted', async ({
    headers,
  }) => {
    at(DAY1);
    const posted = recordComments();
    const postId = await install(headers);
    const before = posted.length;
    expect(
      (
        await propose(
          headers,
          BOB,
          postId,
          'Who will you vote for next year?',
          ['A', 'B']
        )
      ).status
    ).toBe(400);
    expect(
      (
        await propose(headers, ANON, postId, 'Do you make your bed?', [
          'Yes',
          'No',
        ])
      ).status
    ).toBe(400);
    expect(posted.length).toBe(before);
  });

  test('the most upvoted proposal becomes tomorrow’s third question', async ({
    headers,
  }) => {
    at(DAY1);
    const posted = recordComments();
    const postId = await install(headers);
    await propose(headers, ALICE, postId, 'Do you sleep with socks on?', [
      'Always',
      'Never',
    ]);
    await propose(headers, BOB, postId, 'Do you make your bed every morning?', [
      'Yes',
      'No',
      'Weekends only',
    ]);
    const [alices, bobs] = posted.filter((p) => p.runAs === 'USER');
    serveComments(posted, { [alices!.id]: 3, [bobs!.id]: 5 });
    const ed2 = await nextDay(headers);
    const s = await json<StateResponse>(
      await call(headers, { ...ALICE, postId: ed2 }, '/api/state')
    );
    expect(s.edition.questions.map((q) => q.kind)).toEqual([
      'world',
      'world',
      'community',
    ]);
    expect(s.edition.questions.slice(0, 2).map((q) => q.id)).toEqual(
      BANK.slice(3, 5).map((q) => q.id)
    );
    expect(s.edition.questions[2]).toMatchObject({
      text: 'Do you make your bed every morning?',
      options: ['Yes', 'No', 'Weekends only'],
      askedBy: 'bob',
    });
  });

  test('removed or unvoted proposals are skipped', async ({ headers }) => {
    at(DAY1);
    const posted = recordComments();
    const postId = await install(headers);
    await propose(headers, ALICE, postId, 'Do you sleep with socks on?', [
      'Always',
      'Never',
    ]);
    await propose(headers, BOB, postId, 'Do you make your bed every morning?', [
      'Yes',
      'No',
    ]);
    const [alices, bobs] = posted.filter((p) => p.runAs === 'USER');
    serveComments(posted, { [alices!.id]: 1, [bobs!.id]: 9 }, [bobs!.id]);
    const ed2 = await nextDay(headers);
    const s = await json<StateResponse>(
      await call(headers, { ...ALICE, postId: ed2 }, '/api/state')
    );
    expect(s.edition.questions.map((q) => q.kind)).toEqual([
      'world',
      'world',
      'world',
    ]);
  });

  test('a community answer is scored only once ten other players have answered', async ({
    headers,
  }) => {
    at(DAY1);
    const posted = recordComments();
    const postId = await install(headers);
    await propose(headers, BOB, postId, 'Do you make your bed every morning?', [
      'Yes',
      'No',
    ]);
    const bobs = posted.filter((p) => p.runAs === 'USER')[0]!;
    serveComments(posted, { [bobs.id]: 4 });
    const ed2 = await nextDay(headers);
    const early = await json<GuessResponse>(
      await call(headers, { ...ALICE, postId: ed2 }, '/api/guess', {
        q: 2,
        option: 0,
        guess: 50,
      })
    );
    expect(early.reveal.points).toBeNull();
    expect(early.reveal.world).toBeNull();
    expect(early.reveal.truth).toBe(100);
    for (let i = 0; i < 10; i++) {
      await call(
        headers,
        { userId: `t2_p${i}`, username: `p${i}`, postId: ed2 },
        '/api/answer',
        { q: 2, option: i % 2 }
      );
    }
    const late = await json<GuessResponse>(
      await call(
        headers,
        { userId: 't2_carol', username: 'carol', postId: ed2 },
        '/api/guess',
        { q: 2, option: 0, guess: 50 }
      )
    );
    expect(late.reveal.sub.n).toBe(12);
    expect(late.reveal.truth).toBe(58.3);
    expect(late.reveal.points).toBe(83);
  });
});

describe('verdicts', () => {
  test('need a finished day, reply once to the results thread as the player', async ({
    headers,
  }) => {
    at(DAY1);
    const posted = recordComments();
    const postId = await install(headers);
    const thread = posted.find((p) =>
      p.text.startsWith('**Results thread for No. 1.**')
    );
    expect(thread?.runAs).toBe('APP');
    const early = await call(headers, { ...ALICE, postId }, '/api/verdict', {});
    expect(early.status).toBe(409);
    for (let q = 0; q < 3; q++) {
      await call(headers, { ...ALICE, postId }, '/api/guess', {
        q,
        option: 0,
        guess: 40,
      });
    }
    const ok = await call(headers, { ...ALICE, postId }, '/api/verdict', {});
    expect(ok.status).toBe(200);
    const verdict = posted.at(-1);
    expect(verdict?.runAs).toBe('USER');
    expect(verdict?.parent).toBe(thread?.id);
    expect(verdict?.text).toMatch(
      /^\*\*No\. 1 · [A-Z]+\*\* · \d+ of 300 points/
    );
    const twice = await call(headers, { ...ALICE, postId }, '/api/verdict', {});
    expect(twice.status).toBe(409);
  });
});

describe('journey telemetry routes', () => {
  test('start a journey and refuse malformed events', async ({ headers }) => {
    const start = await call(headers, {}, '/api/telemetry/journey/start', {});
    expect(start.status).toBe(200);
    const bad = await call(headers, {}, '/api/telemetry/journey/progress', {
      progress: 2,
    });
    expect(bad.status).toBe(400);
    const noAction = await call(
      headers,
      {},
      '/api/telemetry/journey/interaction',
      {}
    );
    expect(noAction.status).toBe(400);
    const noId = await call(headers, {}, '/api/telemetry/journey/end', {
      complete: true,
    });
    expect(noId.status).toBe(400);
  });
});
