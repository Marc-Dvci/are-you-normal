import { useEffect, useState } from 'react';
import { biasSentence } from '../../shared/summary';
import type {
  BoardRow,
  DaySummary,
  PublicQuestion,
  Reveal,
} from '../../shared/types';
import { CrowdGrid } from '../ui/CrowdGrid';
import { FigureRow } from '../ui/Figure';
import { count, ordinal, pctText } from '../../shared/format';
import { AnswerRows, Countdown, Kicker, Stamp } from '../ui/Parts';

const topicOf = (q: PublicQuestion) =>
  q.kind === 'community' ? 'community' : q.category;

const QuestionHead = ({
  question,
  index,
  total,
  small = false,
}: {
  question: PublicQuestion;
  index: number;
  total: number;
  small?: boolean;
}) => (
  <>
    <Kicker topic={topicOf(question)}>
      {`Question ${index + 1} of ${total}`}
    </Kicker>
    <h1 className={`question${small ? ' small' : ''}`}>{question.text}</h1>
    {question.askedBy && (
      <p className="asked-by">
        Asked by u/{question.askedBy}. Answers come from players here.
      </p>
    )}
  </>
);

export const AskScreen = ({
  question,
  index,
  total,
  onAnswer,
}: {
  question: PublicQuestion;
  index: number;
  total: number;
  onAnswer: (option: number) => void;
}) => {
  const [chosen, setChosen] = useState<number | null>(null);
  const choose = (option: number) => {
    if (chosen !== null) return;
    setChosen(option);
    window.setTimeout(() => onAnswer(option), 380);
  };
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const i = 'abcdef'.indexOf(event.key.toLowerCase());
      if (i >= 0 && i < question.options.length) choose(i);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  return (
    <section className="screen" aria-live="polite">
      <QuestionHead question={question} index={index} total={total} />
      <AnswerRows
        options={question.options}
        chosen={chosen}
        onChoose={choose}
      />
      <p className="hint">Answer for yourself. The points come next.</p>
    </section>
  );
};

export const GuessScreen = ({
  question,
  index,
  total,
  option,
  busy,
  onLock,
}: {
  question: PublicQuestion;
  index: number;
  total: number;
  option: number;
  busy: boolean;
  onLock: (guess: number) => void;
}) => {
  const [guess, setGuess] = useState<number | null>(null);
  const answer = question.options[option] ?? '';
  const nudge = (d: number) =>
    setGuess((g) => Math.min(100, Math.max(0, (g ?? 0) + d)));
  return (
    <section className="screen guess-screen">
      <QuestionHead question={question} index={index} total={total} small />
      <p className="prompt">
        Out of 100 {question.crowd}, how many also said <em>{answer}</em>?
      </p>
      <div className="crowd-wrap">
        <CrowdGrid
          mode="guess"
          guess={guess}
          onGuess={setGuess}
          label={`Your guess, out of 100 ${question.crowd}`}
        />
      </div>
      {guess === null && (
        <p className="hint guess-hint">
          Each figure is one person. Tap or drag across the crowd.
        </p>
      )}
      <div className="readout">
        <span className="big num" aria-live="polite">
          {guess ?? <span className="unset">?</span>}
        </span>
        <span className="of">in 100</span>
        <span className="nudge">
          <button
            type="button"
            aria-label="One fewer"
            onClick={() => nudge(-1)}
          >
            −
          </button>
          <button type="button" aria-label="One more" onClick={() => nudge(1)}>
            +
          </button>
        </span>
      </div>
      <div className="actionbar">
        <button
          type="button"
          className="btn"
          disabled={guess === null || busy}
          onClick={() => guess !== null && onLock(guess)}
        >
          <span>
            {guess === null ? 'Tap the crowd to guess' : 'Lock my guess'}
          </span>
          <span className="arrow" aria-hidden="true">
            →
          </span>
        </button>
      </div>
    </section>
  );
};

const SourceLine = ({
  reveal,
  onOpen,
}: {
  reveal: Reveal;
  onOpen: (url: string) => void;
}) => {
  const source = reveal.world?.source;
  if (!source) {
    return (
      <p className="source">
        Source: players of this subreddit, {count(reveal.sub.n, 'answer')} so
        far.
      </p>
    );
  }
  return (
    <p className="source">
      Source:{' '}
      <button type="button" className="link" onClick={() => onOpen(source.url)}>
        {source.name}
      </button>
      {source.year ? `, ${source.year}` : ''}. {source.sample}. {source.licence}
      .
    </p>
  );
};

export const RevealScreen = ({
  question,
  index,
  total,
  reveal,
  onNext,
  onOpen,
  last,
}: {
  question: PublicQuestion;
  index: number;
  total: number;
  reveal: Reveal;
  onNext: () => void;
  onOpen: (url: string) => void;
  last: boolean;
}) => {
  const answer = question.options[reveal.option] ?? '';
  const off = Math.round(Math.abs(reveal.guess - reveal.truth));
  const subShare =
    reveal.sub.n > 0
      ? ((reveal.sub.counts[reveal.option] ?? 0) / reveal.sub.n) * 100
      : 0;
  const crowdName = reveal.world ? 'the survey' : 'players here';
  return (
    <section className="screen reveal-screen">
      <QuestionHead question={question} index={index} total={total} small />
      <div className="verdict">
        <div className="truth">
          <span className="big num">{Math.round(reveal.truth)}</span>
          <span className="of">
            in 100 {question.crowd} said <strong>{answer}</strong>
          </span>
        </div>
      </div>
      <p className="line">{reveal.line}</p>
      <div className="crowd-wrap reveal">
        <Stamp tier={reveal.tier} />
        <CrowdGrid
          mode="reveal"
          guess={reveal.guess}
          truth={reveal.truth}
          label={`${pctText(reveal.truth)} of ${crowdName} answered ${answer}. You guessed ${reveal.guess}.`}
        />
      </div>
      <p className="legend" aria-hidden="true">
        <span className="key-ink" /> said {answer}
        <span className="key-red" /> your guess
      </p>
      <p className="score-line">
        <span className="mark" aria-hidden="true" />
        <span>
          You guessed <strong className="num">{reveal.guess}</strong>.{' '}
          {off === 0 ? 'Exactly right.' : `${off} off.`}
        </span>
        {reveal.points === null ? (
          <span className="muted">
            Not scored until 10 players have answered.
          </span>
        ) : (
          <strong className="points num">+{reveal.points}</strong>
        )}
      </p>
      <dl className="compare">
        {reveal.world && (
          <div>
            <dt>Survey</dt>
            <dd>
              <FigureRow
                value={reveal.truth}
                tone="ink"
                label={`Survey: ${pctText(reveal.truth)}`}
              />
              <span className="num">{pctText(reveal.truth)}</span>
            </dd>
          </div>
        )}
        <div>
          <dt>
            This sub{' '}
            <span className="n num">{count(reveal.sub.n, 'player')}</span>
          </dt>
          <dd>
            <FigureRow
              value={subShare}
              tone="blue"
              label={`This subreddit: ${pctText(Math.round(subShare * 10) / 10)} of ${reveal.sub.n}`}
            />
            <span className="num">
              {reveal.sub.n > 0 ? pctText(Math.round(subShare * 10) / 10) : '–'}
            </span>
          </dd>
        </div>
      </dl>
      {reveal.world && (
        <div className="contrast">
          <p className="kicker">This sub vs the survey</p>
          <p>
            {reveal.contrast ??
              `Too few players here to compare yet: ${reveal.sub.n} of the 10 needed.`}
          </p>
        </div>
      )}
      <SourceLine reveal={reveal} onOpen={onOpen} />
      <div className="actionbar">
        <button type="button" className="btn" onClick={onNext}>
          <span>{last ? 'See my day' : 'Next question'}</span>
          <span className="arrow" aria-hidden="true">
            →
          </span>
        </button>
      </div>
    </section>
  );
};

export const DayScreen = ({
  summary,
  questions,
  reveals,
  board,
  username,
  loggedIn,
  nextAt,
  isToday,
  today,
  onToday,
  onVerdict,
  onPropose,
  onLogin,
  onFlair,
  onJoin,
  subreddit,
  flair,
  joined,
  verdictPosted,
  busy,
}: {
  summary: DaySummary;
  questions: PublicQuestion[];
  reveals: Reveal[];
  board: BoardRow[];
  username: string | null;
  loggedIn: boolean;
  nextAt: string;
  isToday: boolean;
  today: { number: number; url: string | null };
  onToday: () => void;
  onVerdict: () => void;
  onPropose: () => void;
  onLogin: () => void;
  onFlair: () => void;
  onJoin: () => void;
  subreddit: string;
  flair: string | null;
  joined: boolean;
  verdictPosted: boolean;
  busy: boolean;
}) => (
  <section className="screen day-screen">
    <div className="day-head">
      <p className="kicker">Your day in numbers</p>
      <Stamp tier={summary.tier} big />
      <p className="line">{summary.line}</p>
      <div className="mean-row">
        <FigureRow
          value={summary.meanShare}
          tone="red"
          height={30}
          label={`${pctText(summary.meanShare)} answered like you on average`}
        />
      </div>
      <p className="mean">
        On average,{' '}
        <strong className="num">{pctText(summary.meanShare)}</strong> of people
        answered like you.
      </p>
    </div>
    <dl className="stats">
      <div>
        <dt>Score</dt>
        <dd className="num">
          {summary.score}
          <small>/{summary.maxScore}</small>
        </dd>
      </div>
      <div>
        <dt>Rank</dt>
        <dd className="num">
          {summary.rank ? ordinal(summary.rank) : '–'}
          <small>{summary.players > 0 ? ` of ${summary.players}` : ''}</small>
        </dd>
      </div>
      <div>
        <dt>Streak</dt>
        <dd className="num">
          {summary.streak}
          <small>{summary.streak === 1 ? ' day' : ' days'}</small>
        </dd>
      </div>
    </dl>
    {summary.bias && <p className="bias">{biasSentence(summary.bias)}</p>}
    <ol className="answers">
      {reveals.map((r) => {
        const q = questions[r.q];
        if (!q) return null;
        return (
          <li key={r.q}>
            <p className="q">{q.text}</p>
            <p className="a">
              <strong>{q.options[r.option]}</strong>
              <span className="num">{pctText(r.truth)}</span>
            </p>
            <FigureRow
              value={r.truth}
              tone="red"
              height={18}
              label={`${pctText(r.truth)} answered like you`}
            />
          </li>
        );
      })}
    </ol>
    <div className="actions">
      {loggedIn ? (
        <>
          <button
            type="button"
            className="btn"
            disabled={verdictPosted || busy}
            onClick={onVerdict}
          >
            <span>{verdictPosted ? 'Verdict posted' : 'Post my verdict'}</span>
            <span className="arrow" aria-hidden="true">
              {verdictPosted ? '✓' : '→'}
            </span>
          </button>
          <p className="fine">Replies to the results thread as u/{username}.</p>
          <div className="pair">
            <button
              type="button"
              className="btn ghost small"
              disabled={flair !== null || busy}
              onClick={onFlair}
            >
              <span>{flair ? 'Wearing it' : 'Wear it as flair'}</span>
            </button>
            <button
              type="button"
              className="btn ghost small"
              disabled={joined || busy}
              onClick={onJoin}
              title={`r/${subreddit}`}
            >
              <span>{joined ? 'Joined' : 'Join this sub'}</span>
            </button>
          </div>
          {isToday && (
            <button
              type="button"
              className="btn ghost"
              disabled={busy}
              onClick={onPropose}
              aria-describedby="propose-note"
            >
              <span>Propose a question</span>
              <span className="arrow" aria-hidden="true">
                +
              </span>
            </button>
          )}
          {isToday && (
            <p className="fine" id="propose-note">
              The most upvoted proposal runs tomorrow, answered by this sub.
            </p>
          )}
        </>
      ) : (
        <button type="button" className="btn" onClick={onLogin}>
          <span>Log in to keep a streak</span>
          <span className="arrow" aria-hidden="true">
            →
          </span>
        </button>
      )}
    </div>
    {board.length > 0 && (
      <div className="board">
        <p className="kicker">
          {isToday
            ? 'Best readers of people today'
            : `Best readers of people on No. ${summary.edition}`}
        </p>
        <ol>
          {board.map((row) => (
            <li key={row.username}>
              <span>u/{row.username}</span>
              <span className="num">{row.score}</span>
            </li>
          ))}
        </ol>
      </div>
    )}
    {isToday ? (
      <p className="next">
        Next edition in <Countdown to={nextAt} />
      </p>
    ) : today.url ? (
      <div className="actions">
        <button type="button" className="btn" onClick={onToday}>
          <span>Play today’s edition, No. {today.number}</span>
          <span className="arrow" aria-hidden="true">
            →
          </span>
        </button>
      </div>
    ) : (
      <p className="next">Today’s edition is up in the subreddit.</p>
    )}
  </section>
);
