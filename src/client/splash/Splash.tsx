import { navigateTo, requestExpandedMode } from '@devvit/web/client';
import { useEffect, useState, type MouseEvent } from 'react';
import { formatEditionDate } from '../../shared/edition';
import { STAMP_WORD } from '../../shared/scoring';
import { summarize } from '../../shared/summary';
import type {
  DaySummary,
  EditionInfo,
  Reveal,
  StateResponse,
} from '../../shared/types';
import { api } from '../lib/api';
import { journey } from '../lib/journey';
import { localDay, pending } from '../lib/progress';
import { FigureRow } from '../ui/Figure';
import { AnswerRows, Countdown, Kicker, Masthead, Stamp } from '../ui/Parts';

type View =
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'fresh'; s: StateResponse }
  | { kind: 'partway'; s: StateResponse; done: number }
  | { kind: 'done'; s: StateResponse; summary: DaySummary };

const viewOf = (s: StateResponse): View => {
  const n = s.edition.number;
  let reveals = s.me.reveals;
  let answers = s.me.answers;
  if (!s.me.loggedIn) {
    const local = localDay.get(n);
    if (local && local.reveals.length === reveals.length) {
      reveals = local.reveals;
      answers = local.answers;
    }
  }
  const finished = reveals.filter((r): r is Reveal => r !== null);
  if (finished.length === reveals.length && finished.length > 0) {
    const summary =
      s.me.summary ??
      summarize(n, finished, {
        rank: null,
        players: s.edition.players,
        streak: 0,
        bias: null,
      });
    return { kind: 'done', s, summary };
  }
  const started = answers.some((a) => a !== null) || finished.length > 0;
  return started
    ? { kind: 'partway', s, done: finished.length }
    : { kind: 'fresh', s };
};

const open = (event: MouseEvent) =>
  requestExpandedMode(event.nativeEvent, 'game');

/** On an old edition: a link to today's post. */
const TodayLink = ({ today }: { today: EditionInfo['today'] }) =>
  today.url ? (
    <button
      type="button"
      className="link today-link"
      onClick={() => {
        journey.interaction('open_today');
        navigateTo(today.url!);
      }}
    >
      Today’s is No. {today.number} →
    </button>
  ) : null;

export const Splash = () => {
  const [view, setView] = useState<View>({ kind: 'loading' });

  useEffect(() => {
    api
      .state()
      .then((s) => {
        setView(viewOf(s));
        journey.ready();
      })
      .catch(() => setView({ kind: 'error' }));
  }, []);

  if (view.kind === 'loading' || view.kind === 'error') {
    return (
      <main className="splash">
        <header className="masthead">
          <span className="wordmark">
            Are you normal<b>?</b>
          </span>
        </header>
        <p className="loading">
          {view.kind === 'error'
            ? 'Could not load today’s questions.'
            : 'Counting people…'}
        </p>
      </main>
    );
  }

  const { s } = view;
  const n = s.edition.number;
  const first = s.edition.questions[0];
  const total = s.edition.questions.length;

  return (
    <main className="splash">
      <Masthead edition={n} right={formatEditionDate(s.edition.date)} />
      {view.kind === 'fresh' && first && (
        <>
          <Kicker
            topic={first.kind === 'community' ? 'community' : first.category}
          >
            {`Question 1 of ${total}`}
          </Kicker>
          <h1 className="question">{first.text}</h1>
          <AnswerRows
            compact
            options={first.options}
            chosen={null}
            onChoose={(option, event) => {
              pending.set(n, { q: 0, option });
              requestExpandedMode(event.nativeEvent, 'game');
              if (s.me.loggedIn)
                void api.answer(0, option).catch(() => undefined);
            }}
          />
          <p className="foot">
            <span>
              Tap your answer to play. {total} questions, about a minute.
            </span>
            {s.edition.isToday ? (
              s.edition.players > 0 && (
                <span className="num">{s.edition.players} played today</span>
              )
            ) : (
              <TodayLink today={s.edition.today} />
            )}
          </p>
          <div className="splash-strip" aria-hidden="true">
            <FigureRow value={5} count={20} tone="red" height={30} label="" />
            <p>How many people in 100 answer like you?</p>
          </div>
        </>
      )}
      {view.kind === 'partway' && (
        <div className="splash-mid">
          <p className="question">
            You are on question {Math.min(total, view.done + 1)} of {total}.
          </p>
          <button type="button" className="btn" onClick={open}>
            <span>Carry on</span>
            <span className="arrow" aria-hidden="true">
              →
            </span>
          </button>
        </div>
      )}
      {view.kind === 'done' && (
        <div className="splash-done">
          <div className="splash-verdict">
            <Stamp tier={view.summary.tier} big />
            <p className="line">{view.summary.line}</p>
          </div>
          <FigureRow
            value={view.summary.meanShare}
            tone="red"
            height={26}
            label={`On average ${view.summary.meanShare}% answered like you`}
          />
          <p className="foot">
            <span>
              {STAMP_WORD[view.summary.tier]} on No. {n}
              {view.summary.maxScore > 0
                ? ` · ${view.summary.score}/${view.summary.maxScore} points`
                : ''}
              {view.summary.streak > 1
                ? ` · ${view.summary.streak}-day streak`
                : ''}
            </span>
          </p>
          <button type="button" className="btn ghost" onClick={open}>
            <span>See my results</span>
            <span className="arrow" aria-hidden="true">
              →
            </span>
          </button>
          {s.edition.isToday ? (
            <p className="foot">
              <span>
                Next edition in <Countdown to={s.edition.nextAt} />
              </span>
            </p>
          ) : (
            <p className="foot">
              <TodayLink today={s.edition.today} />
            </p>
          )}
        </div>
      )}
    </main>
  );
};
