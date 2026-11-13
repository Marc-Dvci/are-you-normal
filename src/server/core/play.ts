import { context, redis } from '@devvit/web/server';
import { contrastLine } from '../../shared/compare';
import { nextEditionAt } from '../../shared/edition';
import {
  MIN_COMMUNITY_ANSWERS,
  clampGuess,
  scoreGuess,
  shareOf,
  tierOf,
} from '../../shared/scoring';
import { summarize } from '../../shared/summary';
import type {
  BoardRow,
  DaySummary,
  GuessResponse,
  Reveal,
  StateResponse,
} from '../../shared/types';
import { answerLine } from '../../shared/verdicts';
import { editionDate, todayEdition } from './editions';
import { K, USER_DAY_TTL } from './keys';
import {
  loadEdition,
  publicQuestion,
  worldQuestion,
  type StoredQuestion,
} from './stored';
import {
  biasOf,
  completeEdition,
  currentStreak,
  readStats,
  recordBias,
} from './users';
import { broadcastCounts, readCounts, recordVote, storedVote } from './votes';

export type Player = { userId: string; username: string } | null;

export class PlayError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 404 | 409 = 400
  ) {
    super(message);
  }
}

const BOARD_SIZE = 5;

const questionAt = async (
  n: number,
  q: number
): Promise<{ sq: StoredQuestion; count: number }> => {
  const stored = await loadEdition(n);
  if (!stored) throw new PlayError(`No. ${n} does not exist.`, 404);
  const sq = stored[q];
  if (!sq) throw new PlayError('No such question.', 404);
  return { sq, count: stored.length };
};

const checkOption = (sq: StoredQuestion, option: number): void => {
  const options = publicQuestion(sq).options.length;
  if (!Number.isInteger(option) || option < 0 || option >= options) {
    throw new PlayError('No such answer.');
  }
};

type Fixed = { truth: number; points: number | null };

const buildReveal = async (
  n: number,
  q: number,
  sq: StoredQuestion,
  option: number,
  guess: number,
  fixed: Fixed | null,
  countsIncludePlayer: boolean
): Promise<Reveal> => {
  const pub = publicQuestion(sq);
  const sub = await readCounts(n, q, pub.options.length);
  const bq = worldQuestion(sq);
  let truth: number;
  let points: number | null;
  if (fixed) {
    ({ truth, points } = fixed);
  } else if (bq) {
    truth = bq.pcts[option] ?? 0;
    points = scoreGuess(guess, truth);
  } else {
    const withPlayer = countsIncludePlayer ? 0 : 1;
    const others = sub.n - (countsIncludePlayer ? 1 : 0);
    truth = shareOf((sub.counts[option] ?? 0) + withPlayer, sub.n + withPlayer);
    points = others >= MIN_COMMUNITY_ANSWERS ? scoreGuess(guess, truth) : null;
  }
  const tier = tierOf(truth);
  return {
    q,
    option,
    guess,
    truth,
    points,
    tier,
    line: answerLine(tier, n, sq.id, option),
    world: bq
      ? {
          pcts: bq.pcts,
          source: {
            name: bq.source.name,
            url: bq.source.url,
            licence: bq.source.licence,
            sample: bq.source.sample,
            year: bq.source.year,
          },
        }
      : null,
    sub,
    contrast: bq ? contrastLine(bq.options, bq.pcts, sub.counts, sub.n) : null,
  };
};

export const readBoard = async (n: number): Promise<BoardRow[]> => {
  const top = await redis.zRange(K.scores(n), 0, BOARD_SIZE - 1, {
    by: 'rank',
    reverse: true,
  });
  if (top.length === 0) return [];
  const names = await redis.hGetAll(K.names(n));
  return top.map(({ member, score }) => ({
    username: names[member] ?? 'someone',
    score,
  }));
};

const rankOf = async (n: number, userId: string): Promise<number | null> => {
  const asc = await redis.zRank(K.scores(n), userId);
  if (asc === undefined) return null;
  return (await redis.zCard(K.scores(n))) - asc;
};

type UserDay = {
  answers: (number | null)[];
  guesses: (number | null)[];
  fixed: (Fixed | null)[];
  done: boolean;
};

const readUserDay = async (
  userId: string,
  n: number,
  count: number
): Promise<UserDay> => {
  const raw = await redis.hGetAll(K.userDay(userId, n));
  const val = (field: string): number | null =>
    raw[field] === undefined || raw[field] === '' ? null : Number(raw[field]);
  return {
    answers: Array.from({ length: count }, (_, q) => val(`a${q}`)),
    guesses: Array.from({ length: count }, (_, q) => val(`g${q}`)),
    fixed: Array.from({ length: count }, (_, q) => {
      const truth = val(`t${q}`);
      return truth === null ? null : { truth, points: val(`p${q}`) };
    }),
    done: raw['done'] === '1',
  };
};

const summaryFor = async (
  n: number,
  userId: string,
  reveals: Reveal[],
  now: Date
): Promise<DaySummary> => {
  const [stats, today, rank, players] = await Promise.all([
    readStats(userId),
    todayEdition(now),
    rankOf(n, userId),
    redis.get(K.players(n)),
  ]);
  return summarize(n, reveals, {
    rank,
    players: Number(players ?? '0'),
    streak: currentStreak(stats, today),
    bias: biasOf(stats),
  });
};

export const getState = async (
  n: number,
  player: Player,
  now: Date
): Promise<StateResponse> => {
  const stored = await loadEdition(n);
  if (!stored) throw new PlayError(`No. ${n} does not exist.`, 404);
  const [date, today, players, board] = await Promise.all([
    editionDate(n, now),
    todayEdition(now),
    redis.get(K.players(n)),
    readBoard(n),
  ]);
  const todayPost = n === today ? null : await redis.get(K.editionPost(today));
  const answers: (number | null)[] = stored.map(() => null);
  const reveals: (Reveal | null)[] = stored.map(() => null);
  let summary: DaySummary | null = null;
  let streak = 0;
  if (player) {
    const day = await readUserDay(player.userId, n, stored.length);
    for (const [q, sq] of stored.entries()) {
      answers[q] = day.answers[q] ?? null;
      const option = day.answers[q];
      const guess = day.guesses[q];
      if (
        option !== null &&
        option !== undefined &&
        guess !== null &&
        guess !== undefined
      ) {
        reveals[q] = await buildReveal(
          n,
          q,
          sq,
          option,
          guess,
          day.fixed[q] ?? null,
          true
        );
      }
    }
    const complete = reveals.every((r) => r !== null);
    if (complete && day.done) {
      summary = await summaryFor(
        n,
        player.userId,
        reveals.filter((r) => r !== null),
        now
      );
    }
    streak = currentStreak(await readStats(player.userId), today);
  }
  return {
    type: 'state',
    edition: {
      number: n,
      date,
      questions: stored.map(publicQuestion),
      players: Number(players ?? '0'),
      nextAt: nextEditionAt(now).toISOString(),
      isToday: n === today,
      today: {
        number: today,
        url: todayPost
          ? `https://www.reddit.com/r/${context.subredditName}/comments/${todayPost.replace(/^t3_/, '')}/`
          : null,
      },
      subreddit: context.subredditName,
    },
    me: {
      loggedIn: player !== null,
      username: player?.username ?? null,
      answers,
      reveals,
      summary,
      streak,
    },
    board,
  };
};

export const answer = async (
  n: number,
  q: number,
  option: number,
  player: Player
): Promise<boolean> => {
  const { sq } = await questionAt(n, q);
  checkOption(sq, option);
  if (!player) return false;
  const recorded = await recordVote(n, q, option, player.userId);
  if (recorded) {
    await redis.hSet(K.userDay(player.userId, n), {
      [`a${q}`]: String(option),
    });
    await redis.expire(K.userDay(player.userId, n), USER_DAY_TTL);
    await broadcastCounts(n, q, publicQuestion(sq).options.length);
  }
  return recorded;
};

export const guess = async (
  n: number,
  q: number,
  rawGuess: number,
  option: number,
  player: Player,
  now: Date
): Promise<GuessResponse> => {
  if (!Number.isFinite(rawGuess))
    throw new PlayError('The guess must be a number.');
  const g = clampGuess(rawGuess);
  const { sq, count } = await questionAt(n, q);
  checkOption(sq, option);

  if (!player) {
    const reveal = await buildReveal(n, q, sq, option, g, null, false);
    return { type: 'guess', reveal, summary: null, board: await readBoard(n) };
  }

  await answer(n, q, option, player);
  const chosen = (await storedVote(n, q, player.userId)) ?? option;
  const dayKey = K.userDay(player.userId, n);
  const firstGuess = await redis.hSetNX(dayKey, `g${q}`, String(g));

  let reveal: Reveal;
  if (firstGuess === 1) {
    reveal = await buildReveal(n, q, sq, chosen, g, null, true);
    await redis.hSet(dayKey, {
      [`t${q}`]: String(reveal.truth),
      [`p${q}`]: reveal.points === null ? '' : String(reveal.points),
    });
    await redis.expire(dayKey, USER_DAY_TTL);
    if (sq.kind === 'world') await recordBias(player.userId, g, reveal.truth);
  } else {
    const day = await readUserDay(player.userId, n, count);
    reveal = await buildReveal(
      n,
      q,
      sq,
      chosen,
      day.guesses[q] ?? g,
      day.fixed[q] ?? null,
      true
    );
  }

  const day = await readUserDay(player.userId, n, count);
  let summary: DaySummary | null = null;
  if (day.guesses.every((x) => x !== null)) {
    const stored = await loadEdition(n);
    const reveals: Reveal[] = [];
    for (const [i, s] of (stored ?? []).entries()) {
      const opt = day.answers[i];
      const gs = day.guesses[i];
      if (opt === null || opt === undefined || gs === null || gs === undefined)
        continue;
      reveals.push(
        i === q
          ? reveal
          : await buildReveal(n, i, s, opt, gs, day.fixed[i] ?? null, true)
      );
    }
    const finished = await redis.hSetNX(dayKey, 'done', '1');
    if (finished === 1) {
      const score = reveals.reduce((sum, r) => sum + (r.points ?? 0), 0);
      await redis.zAdd(K.scores(n), { member: player.userId, score });
      await redis.hSet(K.names(n), { [player.userId]: player.username });
      await completeEdition(player.userId, n, await todayEdition(now));
    }
    summary = await summaryFor(n, player.userId, reveals, now);
  }
  return { type: 'guess', reveal, summary, board: await readBoard(n) };
};
