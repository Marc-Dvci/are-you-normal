import { useId } from 'react';
import { FIG_H, FIG_W, FIGURE_PATH } from './figure-shape';

/** Put once per page; every figure is a <use> of this symbol. */
export const FigureDefs = () => (
  <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
    <defs>
      <symbol id="ayn-fig" viewBox={`0 0 ${FIG_W} ${FIG_H}`}>
        <path d={FIGURE_PATH} />
      </symbol>
    </defs>
  </svg>
);

type RowProps = {
  /** Percent to fill, 0 to 100. */
  value: number;
  /** Figures in the row; each stands for 100 / count percent. */
  count?: number;
  tone: 'ink' | 'red' | 'blue';
  height?: number;
  label: string;
};

/** A row of figures where the filled share reads at a glance. */
export const FigureRow = ({
  value,
  count = 10,
  tone,
  height = 22,
  label,
}: RowProps) => {
  const clipBase = useId().replace(/:/g, '');
  const per = 100 / count;
  const gap = 3;
  const w = (height / FIG_H) * FIG_W;
  const total = count * w + (count - 1) * gap;
  return (
    <svg
      className="figure-row"
      width={total}
      height={height}
      viewBox={`0 0 ${total} ${height}`}
      role="img"
      aria-label={label}
    >
      {Array.from({ length: count }, (_, i) => {
        const x = i * (w + gap);
        const filled = Math.min(1, Math.max(0, (value - i * per) / per));
        const clipId = `${clipBase}-${i}`;
        return (
          <g key={i}>
            <use
              href="#ayn-fig"
              x={x}
              y={0}
              width={w}
              height={height}
              className="fig-empty"
            />
            {filled > 0 && (
              <>
                {filled < 1 && (
                  <clipPath id={clipId}>
                    <rect x={x} y={0} width={w * filled} height={height} />
                  </clipPath>
                )}
                <use
                  href="#ayn-fig"
                  x={x}
                  y={0}
                  width={w}
                  height={height}
                  className={`fig-${tone}`}
                  clipPath={filled < 1 ? `url(#${clipId})` : undefined}
                />
              </>
            )}
          </g>
        );
      })}
    </svg>
  );
};
