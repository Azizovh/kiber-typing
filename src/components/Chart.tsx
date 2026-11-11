interface Series {
  values: number[];
  className: string;
  /** Fill the area under the line. */
  area?: boolean;
}

interface Props {
  /** Shared x positions (e.g. seconds, or test index). */
  xs: number[];
  series: Series[];
  /** Optional markers: [x, count] — drawn as dots along the bottom scale. */
  marks?: { x: number; n: number }[];
  xLabel: string;
  yLabel: string;
  height?: number;
}

const W = 800;
const PAD = { l: 44, r: 16, t: 14, b: 30 };

function niceMax(v: number): number {
  if (v <= 0) return 10;
  const step = v <= 40 ? 10 : v <= 100 ? 20 : v <= 200 ? 40 : 50;
  return Math.ceil((v * 1.05) / step) * step;
}

/** Minimal dependency-free line chart. */
export function Chart({ xs, series, marks, xLabel, yLabel, height = 220 }: Props) {
  if (xs.length < 2) return null;
  const H = height;
  const xMin = xs[0];
  const xMax = xs[xs.length - 1];
  const yMax = niceMax(Math.max(...series.flatMap((s) => s.values)));
  const px = (x: number) => PAD.l + ((x - xMin) / (xMax - xMin || 1)) * (W - PAD.l - PAD.r);
  const py = (y: number) => H - PAD.b - (y / yMax) * (H - PAD.t - PAD.b);

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(yMax * f));
  const xTickCount = Math.min(xs.length, 8);
  const xTicks = Array.from({ length: xTickCount }, (_, i) =>
    xs[Math.round((i * (xs.length - 1)) / (xTickCount - 1))],
  );

  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${yLabel} / ${xLabel}`}>
      {yTicks.map((v) => (
        <g key={v}>
          <line className="grid" x1={PAD.l} x2={W - PAD.r} y1={py(v)} y2={py(v)} />
          <text className="tick" x={PAD.l - 8} y={py(v) + 4} textAnchor="end">
            {v}
          </text>
        </g>
      ))}
      {xTicks.map((v, i) => (
        <text key={i} className="tick" x={px(v)} y={H - 10} textAnchor="middle">
          {v}
        </text>
      ))}
      {series.map((s, i) => {
        const pts = s.values.map((v, j) => `${px(xs[j]).toFixed(1)},${py(v).toFixed(1)}`);
        return (
          <g key={i}>
            {s.area && (
              <polygon
                className={`${s.className} area`}
                points={`${px(xs[0])},${py(0)} ${pts.join(' ')} ${px(xs[xs.length - 1])},${py(0)}`}
              />
            )}
            <polyline className={`${s.className} line`} points={pts.join(' ')} />
          </g>
        );
      })}
      {marks?.map((m, i) => (
        <circle key={i} className="mark" cx={px(m.x)} cy={PAD.t + 4} r={Math.min(3 + m.n, 7)}>
          <title>{`${m.n} × ✗`}</title>
        </circle>
      ))}
    </svg>
  );
}
