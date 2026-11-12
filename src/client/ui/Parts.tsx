import { useEffect, useState, type MouseEvent } from 'react';
import { STAMP_WORD } from '../../shared/scoring';
import type { Category, Tier } from '../../shared/types';
import { TopicIcon } from './Icons';
import { topicLabel } from './topics';

export const Wordmark = () => (
  <span className="wordmark">
    Are you normal<b>?</b>
  </span>
);

export const Masthead = ({
  edition,
  right,
}: {
  edition: number;
  right?: string;
}) => (
  <header className="masthead">
    <Wordmark />
    <span className="edition num">
      No. <strong>{edition}</strong>
      {right ? ` · ${right}` : ''}
    </span>
  </header>
);

export const Kicker = ({
  topic,
  children,
}: {
  topic: Category | 'community';
  children?: string;
}) => (
  <div className="kicker">
    <TopicIcon topic={topic} />
    <span>{children ?? topicLabel(topic)}</span>
  </div>
);

export const Stamp = ({ tier, big = false }: { tier: Tier; big?: boolean }) => (
  <span
    className={`stamp drop${big ? ' big' : ''}`}
    role="img"
    aria-label={`Stamped: ${STAMP_WORD[tier]}`}
  >
    {STAMP_WORD[tier]}
  </span>
);

const KEYS = ['A', 'B', 'C', 'D', 'E', 'F'];

/** Answers as ruled rows with tick boxes, like a printed questionnaire. */
export const AnswerRows = ({
  options,
  chosen,
  onChoose,
  compact = false,
  disabled = false,
}: {
  options: readonly string[];
  chosen: number | null;
  onChoose: (index: number, event: MouseEvent<HTMLButtonElement>) => void;
  compact?: boolean;
  disabled?: boolean;
}) => (
  <ul className={`form${compact ? ' compact' : ''}`}>
    {options.map((option, i) => (
      <li key={option}>
        <button
          type="button"
          className="row"
          aria-pressed={chosen === i}
          disabled={disabled || (chosen !== null && chosen !== i)}
          onClick={(event) => onChoose(i, event)}
        >
          <span className="box" aria-hidden="true">
            <svg viewBox="0 0 34 34">
              <path d="M7 18.5l6.5 6.8L29 6" />
            </svg>
          </span>
          <span>{option}</span>
          <span className="key" aria-hidden="true">
            {KEYS[i]}
          </span>
        </button>
      </li>
    ))}
  </ul>
);

const pad = (n: number) => String(n).padStart(2, '0');

export const Countdown = ({ to }: { to: string }) => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const left = Math.max(0, Date.parse(to) - now);
  const h = Math.floor(left / 3_600_000);
  const m = Math.floor((left % 3_600_000) / 60_000);
  const s = Math.floor((left % 60_000) / 1000);
  return (
    <span className="num">
      {pad(h)}:{pad(m)}:{pad(s)}
    </span>
  );
};
