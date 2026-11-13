import { reddit, redis } from '@devvit/web/server';
import { afterEach, beforeEach, describe, expect, vi } from 'vitest';
import { BANK } from '../../src/server/content/bank';
import type { GuessResponse, StateResponse } from '../../src/shared/types';
import { ANON, call, install, json, recordComments, test } from './harness';

const ALICE = { userId: 't2_alice', username: 'alice' };
const BOB = { userId: 't2_bob', username: 'bob' };

const DAY1 = new Date('2026-11-20T09:00:00Z');
const DAY2 = new Date('2026-11-21T09:00:00Z');
const DAY4 = new Date('2026-11-23T09:00:00Z');

/** Markdown paragraph break in the app's comments. */
const PARA = '\n\n';

beforeEach(() => {
  recordComments();
});

afterEach(() => {
  vi.useRealTimers();
});

const at = (when: Date) => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(when);
};

const state = async (
  headers: Record<string, string>,
  as: object,
  postId: string
) => json<StateResponse>(await call(headers, { ...as, postId }, '/api/state'));

const play = async (
  headers: Record<string, string>,
  as: object,
  postId: string,
  q: number,
  option: number,
  guess: number
) =>
  json<GuessResponse>(
    await call(headers, { ...as, postId }, '/api/guess', { q, option, guess })
  );

const playDay = async (
  headers: Record<string, string>,
  as: object,
  postId: string,
  guesses = [30, 30, 30]
) => {
  let last: GuessResponse | null = null;
  for (const [q, g] of guesses.entries())
    last = await play(headers, as, postId, q, 0, g);
  return last!;
};

describe('an edition', () => {
  test('install posts No. 1 with the first three bank questions and no figures', async ({
    headers,
  }) => {
    at(DAY1);
    const postId = await install(headers);
    const res = await call(headers, { ...ALICE, postId }, '/api/state');
    expect(res.status).toBe(200);
    const raw = await res.text();
    const s = JSON.parse(raw) as StateResponse;
    expect(s.edition.number).toBe(1);
    expect(s.edition.date).toBe('2026-11-20');
    expect(s.edition.questions.map((q) => q.id)).toEqual(
      BANK.slice(0, 3).map((q) => q.id)
    );
    expect(raw).not.toContain('pcts');
    expect(raw).not.toContain('"source"');
    expect(s.me.reveals).toEqual([null, null, null]);
  });

  test('a guess reveals the cited share, scores it and stamps it', async ({
    headers,
  }) => {
    at(DAY1);
    const postId = await install(headers);
    const bq = BANK[0]!;
    const res = await play(headers, ALICE, postId, 0, 1, 34);
    expect(res.reveal.truth).toBe(bq.pcts[1]);
    expect(res.reveal.points).toBe(
      Math.max(0, Math.round(100 - 2 * Math.abs(34 - bq.pcts[1]!)))
    );
    expect(res.reveal.world?.source.name).toBe(bq.source.name);
    expect(res.reveal.world?.pcts).toEqual(bq.pcts);
    expect(res.reveal.sub).toEqual({ counts: [0, 1, 0, 0, 0], n: 1 });
    expect(res.reveal.contrast).toBeNull();
    expect(res.reveal.line.length).toBeGreaterThan(0);
  });

  test('one vote per player per question: the first answer stands', async ({
    headers,
  }) => {
    at(DAY1);
    const postId = await install(headers);
    const first = await json<{ recorded: boolean }>(
      await call(headers, { ...ALICE, postId }, '/api/answer', {
        q: 0,
        option: 1,
      })
    );
    const second = await json<{ recorded: boolean }>(
      await call(headers, { ...ALICE, postId }, '/api/answer', {
        q: 0,
        option: 3,
      })
    );
    expect(first.recorded).toBe(true);
    expect(second.recorded).toBe(false);
    const res = await play(headers, ALICE, postId, 0, 3, 50);
    expect(res.reveal.option).toBe(1);
    expect(res.reveal.sub.counts).toEqual([0, 1, 0, 0, 0]);
  });

  test('guessing twice keeps the first guess', async ({ headers }) => {
    at(DAY1);
    const postId = await install(headers);
    const a = await play(headers, ALICE, postId, 0, 2, 10);
    const b = await play(headers, ALICE, postId, 0, 2, 90);
    expect(b.reveal.guess).toBe(10);
    expect(b.reveal.points).toBe(a.reveal.points);
  });

  test('logged-out players play the whole day without being counted', async ({
    headers,
  }) => {
    at(DAY1);
    const postId = await install(headers);
    const res = await playDay(headers, ANON, postId);
    expect(res.reveal.points).not.toBeNull();
    expect(res.summary).toBeNull();
    const s = await state(headers, ANON, postId);
    expect(s.me.loggedIn).toBe(false);
    expect(s.edition.players).toBe(0);
    expect(s.board).toEqual([]);
  });

  test('finishing the day returns a summary, rank, streak and board', async ({
    headers,
  }) => {
    at(DAY1);
    const postId = await install(headers);
    const res = await playDay(headers, ALICE, postId, [16, 79, 7]);
    expect(res.summary).not.toBeNull();
    expect(res.summary?.maxScore).toBe(300);
    expect(res.summary?.rank).toBe(1);
    expect(res.summary?.players).toBe(1);
    expect(res.summary?.streak).toBe(1);
    expect(res.board).toEqual([
      { username: 'alice', score: res.summary?.score },
    ]);
    const s = await state(headers, ALICE, postId);
    expect(s.me.summary?.score).toBe(res.summary?.score);
  });

  test('rank counts every finisher', async ({ headers }) => {
    at(DAY1);
    const postId = await install(headers);
    await playDay(headers, ALICE, postId, [90, 90, 90]);
    await playDay(headers, BOB, postId, [16, 79, 7]);
    const s = await state(headers, ALICE, postId);
    expect(s.edition.players).toBe(2);
    expect(s.me.summary?.rank).toBe(2);
    expect(s.board.map((r) => r.username)).toEqual(['bob', 'alice']);
  });

  test('the bias line appears after three guesses and carries their sign', async ({
    headers,
  }) => {
    at(DAY1);
    const postId = await install(headers);
    const res = await playDay(headers, ALICE, postId, [100, 100, 100]);
    expect(res.summary?.bias?.n).toBe(3);
    expect(res.summary?.bias?.mean).toBeGreaterThan(0);
  });
});

describe('streaks', () => {
  test('grow on consecutive days and restart after a gap', async ({
    headers,
  }) => {
    at(DAY1);
    const p1 = await install(headers);
    expect((await playDay(headers, ALICE, p1)).summary?.streak).toBe(1);

    at(DAY2);
    await call(headers, {}, '/internal/scheduler/new-edition', {});
    const ed2 = await findPost(headers, 2);
    expect((await playDay(headers, ALICE, ed2)).summary?.streak).toBe(2);

    at(DAY4);
    await call(headers, {}, '/internal/scheduler/new-edition', {});
    const ed4 = await findPost(headers, 4);
    expect((await playDay(headers, ALICE, ed4)).summary?.streak).toBe(1);
  });

  test('catching up on an old edition does not extend a streak', async ({
    headers,
  }) => {
    at(DAY1);
    const p1 = await install(headers);
    at(DAY2);
    await call(headers, {}, '/internal/scheduler/new-edition', {});
    expect((await playDay(headers, ALICE, p1)).summary?.streak).toBe(0);
    const ed2 = await findPost(headers, 2);
    expect((await playDay(headers, ALICE, ed2)).summary?.streak).toBe(1);
  });
});

/** The post id the server stored for edition n. */
const findPost = async (
  _headers: Record<string, string>,
  n: number
): Promise<string> => {
  const id = await redis.get(`ed:${n}:post`);
  if (!id) throw new Error(`No. ${n} has no post`);
  return id;
};

describe('the daily job', () => {
  test('makes one post per day, takes the next questions and closes yesterday', async ({
    headers,
  }) => {
    at(DAY1);
    const comments = recordComments();
    const p1 = await install(headers);
    await playDay(headers, ALICE, p1);
    at(DAY2);
    const submit = vi.spyOn(reddit, 'submitCustomPost');
    await call(headers, {}, '/internal/scheduler/new-edition', {});
    await call(headers, {}, '/internal/scheduler/new-edition', {});
    expect(submit).toHaveBeenCalledTimes(1);
    const ed2 = await findPost(headers, 2);
    const s = await state(headers, ALICE, ed2);
    expect(s.edition.number).toBe(2);
    expect(s.edition.isToday).toBe(true);
    expect(s.edition.questions.map((q) => q.id)).toEqual(
      BANK.slice(3, 6).map((q) => q.id)
    );
    const final = comments.find((c) =>
      c.text.startsWith('**Final count for No. 1**')
    );
    expect(final?.parent).toBe(p1);
    expect(final?.runAs).toBe('APP');
    expect(final?.text).toContain('**Final count for No. 1**: 1 player.');
    expect(final?.text).not.toContain('players');
    expect(await redis.get('ed:1:final')).toBe(final?.id);
  });

  test('the final count lists both rows in the survey order and names the survey', async ({
    headers,
  }) => {
    at(DAY1);
    const comments = recordComments();
    const p1 = await install(headers);
    const first = BANK[0]!;
    const last = first.options.length - 1;
    await play(headers, ALICE, p1, 0, last, 10);
    at(DAY2);
    await call(headers, {}, '/internal/scheduler/new-edition', {});
    const text = comments.find(
      (c) => c.parent === p1 && c.text.startsWith('**Final')
    )!.text;
    const order = first.pcts
      .map((p, i) => ({ p, i }))
      .sort((a, b) => b.p - a.p)
      .map(({ i }) => first.options[i]!);
    const paras = text.split(PARA);
    const head = paras.indexOf(`**${first.text}**`);
    const [subLine, surveyLine, sourceLine] = paras.slice(head + 1, head + 4);
    expect(subLine).toMatch(/^This sub, 1 answer: /);
    expect(surveyLine).toMatch(/^Survey: /);
    expect(sourceLine).toBe(`*Source: ${first.source.name}.*`);
    const names = (line: string) =>
      line
        .split(': ')
        .slice(1)
        .join(': ')
        .split(' · ')
        .map((x) => x.replace(/ [\d.]+%$/, ''));
    expect(names(subLine!)).toEqual(order);
    expect(names(surveyLine!)).toEqual(order);
    const third = paras.indexOf(`**${BANK[2]!.text}**`);
    expect(paras[third + 1]).toBe('This sub: no answers.');
  });

  test('an upgrade rewrites a final count posted in older wording', async ({
    headers,
  }) => {
    at(DAY1);
    const p1 = await install(headers);
    await playDay(headers, ALICE, p1);
    at(DAY2);
    await call(headers, {}, '/internal/scheduler/new-edition', {});
    await redis.del('ed:1:final');
    const edit = vi.fn(async () => undefined);
    const old = {
      id: 't1_old',
      parentId: p1,
      body: '**Final count for No. 1**, 1 players.',
      edit,
    };
    const other = { id: 't1_other', parentId: p1, body: 'Results', edit };
    vi.spyOn(reddit, 'getComments').mockImplementation(
      () =>
        ({ all: async () => [other, old] }) as unknown as ReturnType<
          typeof reddit.getComments
        >
    );
    const res = await call(
      headers,
      {},
      '/internal/triggers/on-app-upgrade',
      {}
    );
    expect((await json<{ message: string }>(res)).message).toBe(
      '1 final counts rewritten'
    );
    expect(edit).toHaveBeenCalledTimes(1);
    const calls = edit.mock.calls as unknown as [{ text: string }][];
    expect(calls[0]![0].text).toMatch(
      /^\*\*Final count for No\. 1\*\*: 1 player\./
    );
    expect(await redis.get('ed:1:final')).toBe('t1_old');
  });

  test('an old edition points to today’s post', async ({ headers }) => {
    at(DAY1);
    const p1 = await install(headers);
    expect((await state(headers, ALICE, p1)).edition.today).toEqual({
      number: 1,
      url: null,
    });
    at(DAY2);
    await call(headers, {}, '/internal/scheduler/new-edition', {});
    const ed2 = await findPost(headers, 2);
    const old = await state(headers, ALICE, p1);
    expect(old.edition.isToday).toBe(false);
    expect(old.edition.today.number).toBe(2);
    expect(old.edition.today.url).toBe(
      `https://www.reddit.com/r/areyounormal/comments/${ed2.replace('t3_', '')}/`
    );
  });

  test('the moderator menu posts today if the job did not', async ({
    headers,
  }) => {
    at(DAY1);
    await install(headers);
    at(DAY2);
    const res = await call(headers, {}, '/internal/menu/new-edition', {});
    const body = await json<{ navigateTo?: string }>(res);
    const ed2 = await findPost(headers, 2);
    expect(body.navigateTo).toContain(ed2.replace('t3_', ''));
  });

  test('opening any post makes today’s edition if it is missing', async ({
    headers,
  }) => {
    at(DAY1);
    const p1 = await install(headers);
    at(DAY2);
    await state(headers, ALICE, p1);
    expect(await findPost(headers, 2)).toMatch(/^t3_/);
  });
});

describe('bad requests', () => {
  test('malformed or out-of-range input is refused with an error body', async ({
    headers,
  }) => {
    at(DAY1);
    const postId = await install(headers);
    const cases: [string, unknown, number][] = [
      ['/api/guess', { q: 9, option: 0, guess: 5 }, 404],
      ['/api/guess', { q: 0, option: 7, guess: 5 }, 400],
      ['/api/guess', { q: 0, option: 0, guess: 'x' }, 400],
      ['/api/guess', { q: 0.5, option: 0, guess: 5 }, 400],
      ['/api/answer', { q: 0, option: -1 }, 400],
      ['/api/answer', 'not json', 400],
    ];
    for (const [path, body, status] of cases) {
      const res = await call(headers, { ...ALICE, postId }, path, body);
      expect(res.status, `${path} ${JSON.stringify(body)}`).toBe(status);
      expect((await json<{ type: string }>(res)).type).toBe('error');
    }
  });

  test('a post that is not an edition is a 404', async ({ headers }) => {
    at(DAY1);
    await install(headers);
    const res = await call(
      headers,
      { ...ALICE, postId: 't3_unknown' },
      '/api/state'
    );
    expect(res.status).toBe(404);
  });

  test('a call without a post is refused', async ({ headers }) => {
    const res = await call(headers, ALICE, '/api/state');
    expect(res.status).toBe(400);
  });
});
