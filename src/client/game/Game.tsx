import {
  connectRealtime,
  disconnectRealtime,
  navigateTo,
  showForm,
  showLoginPrompt,
  showToast,
} from '@devvit/web/client';
import { useEffect, useRef, useState } from 'react';
import { formatEditionDate } from '../../shared/edition';
import { summarize } from '../../shared/summary';
import type {
  BoardRow,
  DaySummary,
  LiveMessage,
  Reveal,
  StateResponse,
} from '../../shared/types';
import { api, ApiError } from '../lib/api';
import { journey } from '../lib/journey';
import { localDay, pending } from '../lib/progress';
import { Masthead } from '../ui/Parts';
import { AskScreen, DayScreen, GuessScreen, RevealScreen } from './Screens';

type Step =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ask'; q: number }
  | { kind: 'guess'; q: number; option: number }
  | { kind: 'reveal'; q: number }
  | { kind: 'day' };

const nextStep = (
  answers: (number | null)[],
  reveals: (Reveal | null)[]
): Step => {
  const q = reveals.findIndex((r) => r === null);
  if (q === -1) return { kind: 'day' };
  const option = answers[q];
  return option === null || option === undefined
    ? { kind: 'ask', q }
    : { kind: 'guess', q, option };
};

const message = (error: unknown) =>
  error instanceof ApiError
    ? error.message
    : 'Could not reach the game. Check your connection.';

const isLive = (data: unknown): data is LiveMessage =>
  typeof data === 'object' && data !== null && 'q' in data && 'counts' in data;

const localSummary = (s: StateResponse, all: Reveal[]): DaySummary =>
  summarize(s.edition.number, all, {
    rank: null,
    players: s.edition.players,
    streak: 0,
    bias: null,
  });

/** Merges server state with local memory: logged-out progress and an answer tapped in the feed. */
const prepare = async (s: StateResponse) => {
  const n = s.edition.number;
  let a = [...s.me.answers];
  let r = [...s.me.reveals];
  if (!s.me.loggedIn) {
    const local = localDay.get(n);
    if (local && local.answers.length === a.length) {
      a = local.answers;
      r = local.reveals;
    }
  }
  const pend = pending.get(n);
  if (pend && r[pend.q] === null && a[pend.q] === null) {
    a[pend.q] = pend.option;
    journey.start();
    if (s.me.loggedIn)
      await api.answer(pend.q, pend.option).catch(() => undefined);
  }
  pending.clear(n);
  return { s, a, r };
};

export const Game = () => {
  const [state, setState] = useState<StateResponse | null>(null);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [reveals, setReveals] = useState<(Reveal | null)[]>([]);
  const [summary, setSummary] = useState<DaySummary | null>(null);
  const [board, setBoard] = useState<BoardRow[]>([]);
  const [step, setStep] = useState<Step>({ kind: 'loading' });
  const [busy, setBusy] = useState(false);
  const [verdictPosted, setVerdictPosted] = useState(false);
  const [flair, setFlair] = useState<string | null>(null);
  const [joined, setJoined] = useState(false);
  const top = useRef<HTMLDivElement>(null);

  const loggedIn = state?.me.loggedIn ?? false;
  const edition = state?.edition.number ?? 0;

  const [loadCount, setLoadCount] = useState(0);
  const stepKey = `${step.kind}:${'q' in step ? step.q : -1}`;

  useEffect(() => {
    let cancelled = false;
    api
      .state()
      .then(prepare)
      .then((loaded) => {
        if (cancelled) return;
        const { s, a, r } = loaded;
        setState(s);
        setAnswers(a);
        setReveals(r);
        setBoard(s.board);
        const finished = r.filter((x): x is Reveal => x !== null);
        const localDone = finished.length === r.length && !s.me.loggedIn;
        setSummary(
          s.me.summary ?? (localDone ? localSummary(s, finished) : null)
        );
        setStep(nextStep(a, r));
        journey.ready();
      })
      .catch((error: unknown) => {
        if (!cancelled) setStep({ kind: 'error', message: message(error) });
      });
    return () => {
      cancelled = true;
    };
  }, [loadCount]);

  useEffect(() => {
    top.current?.scrollIntoView({ block: 'start' });
  }, [stepKey]);

  useEffect(() => {
    if (!edition) return;
    const channel = `ed${edition}`;
    try {
      connectRealtime<LiveMessage>({
        channel,
        onMessage: (data) => {
          if (!isLive(data)) return;
          setReveals((prev) =>
            prev.map((r) =>
              r && r.q === data.q
                ? {
                    ...r,
                    sub: {
                      counts: data.counts,
                      n: data.counts.reduce((x, y) => x + y, 0),
                    },
                  }
                : r
            )
          );
        },
      });
    } catch {
      return;
    }
    return () => {
      try {
        disconnectRealtime(channel);
      } catch {
        // Already closed.
      }
    };
  }, [edition]);

  const saveLocal = (a: (number | null)[], r: (Reveal | null)[]) => {
    if (!loggedIn && edition) localDay.set(edition, { answers: a, reveals: r });
  };

  const onAnswer = (q: number, option: number) => {
    journey.start();
    const a = answers.map((x, i) => (i === q ? option : x));
    setAnswers(a);
    saveLocal(a, reveals);
    setStep({ kind: 'guess', q, option });
    if (loggedIn) {
      api
        .answer(q, option)
        .catch((error: unknown) => showToast(message(error)));
    }
  };

  const onLock = async (q: number, option: number, guess: number) => {
    if (!state) return;
    setBusy(true);
    try {
      const res = await api.guess(q, guess, option);
      const r = reveals.map((x, i) => (i === q ? res.reveal : x));
      setReveals(r);
      setBoard(res.board);
      saveLocal(answers, r);
      const all = r.filter((x): x is Reveal => x !== null);
      if (res.summary) setSummary(res.summary);
      else if (all.length === r.length) setSummary(localSummary(state, all));
      journey.interaction('lock_guess', `q${q + 1}`);
      journey.progress(q + 1, r.length);
      setStep({ kind: 'reveal', q });
    } catch (error) {
      showToast(message(error));
    } finally {
      setBusy(false);
    }
  };

  const onNext = (q: number) => {
    if (q + 1 >= reveals.length) {
      setStep({ kind: 'day' });
      if (summary) journey.end(summary.score, summary.maxScore);
    } else {
      setStep(nextStep(answers, reveals));
    }
  };

  const onVerdict = async () => {
    setBusy(true);
    try {
      await api.verdict();
      setVerdictPosted(true);
      showToast('Your verdict is in the results thread.');
      journey.interaction('post_verdict');
    } catch (error) {
      showToast(message(error));
    } finally {
      setBusy(false);
    }
  };

  const onFlair = async () => {
    setBusy(true);
    try {
      const res = await api.flair();
      setFlair(res.text);
      showToast(`Your flair now reads “${res.text}”.`);
      journey.interaction('wear_flair');
    } catch (error) {
      showToast(message(error));
    } finally {
      setBusy(false);
    }
  };

  const onJoin = async () => {
    setBusy(true);
    try {
      await api.join();
      setJoined(true);
      showToast('Joined. Tomorrow’s edition will be in your feed.');
      journey.interaction('join_subreddit');
    } catch (error) {
      showToast(message(error));
    } finally {
      setBusy(false);
    }
  };

  const onPropose = async () => {
    const result = await showForm({
      title: 'Propose tomorrow’s question',
      description:
        'Posted as your comment. The most upvoted proposal becomes tomorrow’s community question. Everyday habits only: no health, sex, religion, politics or drugs.',
      acceptLabel: 'Post proposal',
      fields: [
        {
          type: 'string',
          name: 'question',
          label: 'Question (ends with ?)',
          required: true,
        },
        { type: 'string', name: 'a', label: 'Answer 1', required: true },
        { type: 'string', name: 'b', label: 'Answer 2', required: true },
        { type: 'string', name: 'c', label: 'Answer 3 (optional)' },
        { type: 'string', name: 'd', label: 'Answer 4 (optional)' },
      ],
    });
    if (result.action !== 'SUBMITTED') return;
    const v = result.values;
    const options = [v.a, v.b, v.c, v.d].filter(
      (o): o is string => typeof o === 'string' && o.trim().length > 0
    );
    setBusy(true);
    try {
      await api.propose(v.question ?? '', options);
      showToast('Proposal posted. Upvotes decide.');
      journey.interaction('propose_question');
    } catch (error) {
      showToast(message(error));
    } finally {
      setBusy(false);
    }
  };

  const onOpen = (url: string) => {
    journey.interaction('open_source');
    navigateTo(url);
  };

  if (step.kind === 'loading' || !state) {
    return (
      <div className="page">
        <header className="masthead">
          <span className="wordmark">
            Are you normal<b>?</b>
          </span>
        </header>
        {step.kind === 'error' ? (
          <div className="screen center">
            <p className="line">{step.message}</p>
            <button
              type="button"
              className="btn"
              onClick={() => {
                setStep({ kind: 'loading' });
                setLoadCount((c) => c + 1);
              }}
            >
              <span>Try again</span>
              <span className="arrow" aria-hidden="true">
                ↻
              </span>
            </button>
          </div>
        ) : (
          <p className="loading">Counting people…</p>
        )}
      </div>
    );
  }

  const questions = state.edition.questions;
  const total = questions.length;
  const dateLabel = formatEditionDate(state.edition.date);

  return (
    <div className="page" ref={top}>
      <Masthead edition={edition} right={dateLabel} />
      {step.kind === 'ask' && questions[step.q] && (
        <AskScreen
          key={`ask-${step.q}`}
          question={questions[step.q]!}
          index={step.q}
          total={total}
          onAnswer={(option) => onAnswer(step.q, option)}
        />
      )}
      {step.kind === 'guess' && questions[step.q] && (
        <GuessScreen
          key={`guess-${step.q}`}
          question={questions[step.q]!}
          index={step.q}
          total={total}
          option={step.option}
          busy={busy}
          onLock={(g) => void onLock(step.q, step.option, g)}
        />
      )}
      {step.kind === 'reveal' && questions[step.q] && reveals[step.q] && (
        <RevealScreen
          key={`reveal-${step.q}`}
          question={questions[step.q]!}
          index={step.q}
          total={total}
          reveal={reveals[step.q]!}
          last={step.q + 1 >= total}
          onNext={() => onNext(step.q)}
          onOpen={onOpen}
        />
      )}
      {step.kind === 'day' && summary && (
        <DayScreen
          summary={summary}
          questions={questions}
          reveals={reveals.filter((r): r is Reveal => r !== null)}
          board={board}
          username={state.me.username}
          loggedIn={loggedIn}
          nextAt={state.edition.nextAt}
          isToday={state.edition.isToday}
          today={state.edition.today}
          onToday={() => {
            if (!state.edition.today.url) return;
            journey.interaction('open_today');
            navigateTo(state.edition.today.url);
          }}
          onVerdict={() => void onVerdict()}
          onPropose={() => void onPropose()}
          onLogin={() => showLoginPrompt()}
          onFlair={() => void onFlair()}
          onJoin={() => void onJoin()}
          subreddit={state.edition.subreddit}
          flair={flair}
          joined={joined}
          verdictPosted={verdictPosted}
          busy={busy}
        />
      )}
    </div>
  );
};
