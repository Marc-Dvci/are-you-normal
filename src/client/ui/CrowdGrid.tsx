import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from 'react';
import { FIG_H, FIG_W } from './figure-shape';

const COLS = 10;
const ROWS = 10;
const CELL_W = 30;
const CELL_H = 39;
const FIG_DRAW_H = 33;
const FIG_DRAW_W = (FIG_DRAW_H / FIG_H) * FIG_W;
const PAD_TOP = 8;
const WIDTH = COLS * CELL_W;
const HEIGHT = ROWS * CELL_H + PAD_TOP;

type Props = {
  mode: 'guess' | 'reveal';
  guess: number | null;
  truth?: number;
  onGuess?: (value: number) => void;
  label: string;
};

const cellOf = (i: number) => ({
  x: (i % COLS) * CELL_W + (CELL_W - FIG_DRAW_W) / 2,
  y: Math.floor(i / COLS) * CELL_H + PAD_TOP + (CELL_H - FIG_DRAW_H) / 2,
});

/** Counts up to the truth, a figure at a time, like a tally being taken. */
const prefersReducedMotion = (): boolean =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const useCountUp = (target: number, run: boolean): number => {
  const [animated, setAnimated] = useState(0);
  const [reduce] = useState(prefersReducedMotion);
  const animate = run && !reduce;
  useEffect(() => {
    if (!animate) return;
    const duration = 380 + target * 9;
    const start = performance.now();
    let frame = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      setAnimated(target * (1 - Math.pow(1 - t, 3)));
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target, animate]);
  return animate ? animated : target;
};

/**
 * One hundred people. In guess mode the player taps how many answered like
 * them; in reveal mode the real count fills in and the guess stays marked.
 */
export const CrowdGrid = ({
  mode,
  guess,
  truth = 0,
  onGuess,
  label,
}: Props) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const dragging = useRef(false);
  const shown = useCountUp(truth, mode === 'reveal');
  const [clipId] = useState(
    () => `crowd-clip-${Math.random().toString(36).slice(2)}`
  );

  const pick = (event: PointerEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg || mode !== 'guess' || !onGuess) return;
    const box = svg.getBoundingClientRect();
    const x = ((event.clientX - box.left) / box.width) * WIDTH;
    const y = ((event.clientY - box.top) / box.height) * HEIGHT - PAD_TOP;
    const col = Math.min(COLS - 1, Math.max(0, Math.floor(x / CELL_W)));
    const row = Math.min(ROWS - 1, Math.max(0, Math.floor(y / CELL_H)));
    onGuess(row * COLS + col + 1);
  };

  const onKey = (event: KeyboardEvent<SVGSVGElement>) => {
    if (mode !== 'guess' || !onGuess) return;
    const current = guess ?? 0;
    const delta: Record<string, number> = {
      ArrowRight: 1,
      ArrowUp: 1,
      ArrowLeft: -1,
      ArrowDown: -1,
      PageUp: 10,
      PageDown: -10,
    };
    if (event.key in delta) {
      event.preventDefault();
      onGuess(Math.min(100, Math.max(0, current + (delta[event.key] ?? 0))));
    } else if (event.key === 'Home') {
      event.preventDefault();
      onGuess(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      onGuess(100);
    }
  };

  const whole = Math.floor(shown);
  const part = shown - whole;
  const marker = guess !== null && guess > 0 ? cellOf(guess - 1) : null;

  return (
    <svg
      ref={svgRef}
      className={`crowd crowd-${mode}`}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      role={mode === 'guess' ? 'slider' : 'img'}
      aria-label={label}
      aria-valuemin={mode === 'guess' ? 0 : undefined}
      aria-valuemax={mode === 'guess' ? 100 : undefined}
      aria-valuenow={mode === 'guess' ? (guess ?? 0) : undefined}
      aria-valuetext={mode === 'guess' ? `${guess ?? 0} out of 100` : undefined}
      tabIndex={mode === 'guess' ? 0 : undefined}
      onKeyDown={(e) => {
        delete e.currentTarget.dataset['pointer'];
        onKey(e);
      }}
      onPointerDown={(e) => {
        e.currentTarget.dataset['pointer'] = '1';
        dragging.current = true;
        pick(e);
      }}
      onPointerMove={(e) => {
        if (dragging.current && e.buttons > 0) pick(e);
      }}
      onPointerUp={() => {
        dragging.current = false;
      }}
      onPointerLeave={() => {
        dragging.current = false;
      }}
    >
      {Array.from({ length: COLS * ROWS }, (_, i) => {
        const { x, y } = cellOf(i);
        let tone = 'fig-empty';
        if (mode === 'guess' && guess !== null && i < guess) tone = 'fig-red';
        if (mode === 'reveal' && i < whole) tone = 'fig-ink';
        return (
          <use
            key={i}
            href="#ayn-fig"
            x={x}
            y={y}
            width={FIG_DRAW_W}
            height={FIG_DRAW_H}
            className={tone}
          />
        );
      })}
      {mode === 'reveal' && part > 0.02 && whole < 100 && (
        <>
          <clipPath id={clipId}>
            <rect
              x={cellOf(whole).x}
              y={cellOf(whole).y}
              width={FIG_DRAW_W * part}
              height={FIG_DRAW_H}
            />
          </clipPath>
          <use
            href="#ayn-fig"
            x={cellOf(whole).x}
            y={cellOf(whole).y}
            width={FIG_DRAW_W}
            height={FIG_DRAW_H}
            className="fig-ink"
            clipPath={`url(#${clipId})`}
          />
        </>
      )}
      {mode === 'reveal' && marker && (
        <g className="guess-mark" aria-hidden="true">
          <rect
            x={marker.x + FIG_DRAW_W + (CELL_W - FIG_DRAW_W) / 2 - 2}
            y={marker.y - 5}
            width={3}
            height={FIG_DRAW_H + 10}
            className="fig-red"
          />
          <path
            d={`M${marker.x + FIG_DRAW_W + (CELL_W - FIG_DRAW_W) / 2 - 7} ${marker.y - 9}h13l-6.5 7z`}
            className="fig-red"
          />
        </g>
      )}
    </svg>
  );
};
