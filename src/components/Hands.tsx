import { useEffect, useLayoutEffect, useState, type RefObject } from 'react';
import type { Finger } from '../keyboard/layout';

interface Props {
  /** The element that contains the key rows; keys carry `data-code`. */
  keysRef: RefObject<HTMLDivElement | null>;
  /** Key the active finger should reach, or undefined when nothing is lit. */
  targetCode?: string;
  targetFinger?: Finger;
  /** Shift to hold with the opposite pinky, if any. */
  shiftCode?: string | null;
}

type Side = 'l' | 'r';
type Digit = 'pinky' | 'ring' | 'middle' | 'index' | 'thumb';
interface Point {
  x: number;
  y: number;
}

/** Where each finger rests. */
const HOME: Record<Side, Record<Exclude<Digit, 'thumb'>, string>> = {
  l: { pinky: 'KeyA', ring: 'KeyS', middle: 'KeyD', index: 'KeyF' },
  r: { index: 'KeyJ', middle: 'KeyK', ring: 'KeyL', pinky: 'Semicolon' },
};
const DIGITS: Exclude<Digit, 'thumb'>[] = ['pinky', 'ring', 'middle', 'index'];
/** Finger thickness in key widths. */
const WIDTH: Record<Digit, number> = { pinky: 0.5, ring: 0.58, middle: 0.62, index: 0.6, thumb: 0.66 };

interface Geometry {
  width: number;
  height: number;
  /** One key width. */
  u: number;
  /** Distance between two rows. */
  pitch: number;
  centers: Map<string, Point>;
}

function measure(root: HTMLDivElement): Geometry | null {
  const centers = new Map<string, Point>();
  const box = root.getBoundingClientRect();
  for (const el of root.querySelectorAll<HTMLElement>('[data-code]')) {
    const r = el.getBoundingClientRect();
    centers.set(el.dataset.code!, { x: r.left - box.left + r.width / 2, y: r.top - box.top + r.height / 2 });
  }
  const a = root.querySelector<HTMLElement>('[data-code="KeyA"]');
  const q = centers.get('KeyQ');
  const home = centers.get('KeyA');
  if (!a || !q || !home || box.width === 0) return null;
  return {
    width: box.width,
    height: box.height,
    u: a.getBoundingClientRect().width,
    pitch: home.y - q.y,
    centers,
  };
}

/**
 * Two translucent hands resting on the home row, drawn over the keyboard.
 * The finger that has to move reaches for its key in that finger's colour —
 * a beginner sees which finger to use, not just which key to hit.
 */
export function Hands({ keysRef, targetCode, targetFinger, shiftCode }: Props) {
  const [geo, setGeo] = useState<Geometry | null>(null);

  useLayoutEffect(() => {
    if (keysRef.current) setGeo(measure(keysRef.current));
  }, [keysRef]);

  useEffect(() => {
    const root = keysRef.current;
    if (!root) return;
    const update = () => setGeo(measure(root));
    const observer = new ResizeObserver(update);
    observer.observe(root);
    void document.fonts?.ready.then(update);
    return () => observer.disconnect();
  }, [keysRef]);

  if (!geo) return null;
  const { u, pitch, centers } = geo;
  const at = (code: string): Point => centers.get(code) ?? { x: 0, y: 0 };
  const space = at('Space');
  /** Fingertip position on a key: a little below centre, so the label stays readable. */
  const tip = (code: string): Point => {
    const c = at(code);
    return { x: c.x, y: c.y + pitch * 0.2 };
  };

  // Which finger of which hand is busy, and where it has to go.
  const moves = new Map<string, { to: Point; finger: Finger }>();
  if (targetCode && targetFinger) {
    const key = targetFinger === 'thumb' ? 'r-thumb' : targetFinger;
    moves.set(key, { to: tip(targetCode), finger: targetFinger });
  }
  if (shiftCode) {
    const finger: Finger = shiftCode === 'ShiftLeft' ? 'l-pinky' : 'r-pinky';
    moves.set(finger, { to: tip(shiftCode), finger });
  }

  const hand = (side: Side) => {
    const dir = side === 'l' ? 1 : -1;
    const tips = DIGITS.map((d) => at(HOME[side][d]));
    const palm = {
      x: tips.reduce((sum, p) => sum + p.x, 0) / tips.length + dir * 0.25 * u,
      y: tips[0].y + pitch * 2.45,
    };
    const knuckleY = palm.y - pitch * 0.75;
    const order = side === 'l' ? DIGITS : [...DIGITS].reverse();
    // Fingers leave the palm closer together than the keys they rest on.
    const knuckle = (i: number): Point => ({ x: palm.x + (i - 1.5) * u * 0.82, y: knuckleY });

    const fingers = order.map((digit, i) => {
      const id = `${side}-${digit}`;
      const move = moves.get(id);
      return { id, digit: digit as Digit, from: knuckle(i), to: move?.to ?? tip(HOME[side][digit]), move };
    });
    // Thumbs rest on the space bar, each on its own side of the centre, and
    // press it right there — so an active thumb lights up without moving.
    fingers.push({
      id: `${side}-thumb`,
      digit: 'thumb',
      from: { x: palm.x + dir * u * 1.55, y: palm.y - pitch * 0.1 },
      to: { x: space.x - dir * u * 0.9, y: space.y },
      move: moves.get(`${side}-thumb`),
    });

    return (
      <g key={side}>
        {/* One flat shape per hand, so overlapping parts do not darken each other. */}
        <g className="hand-skin">
          <rect
            x={palm.x - u * 1.55}
            y={palm.y + pitch * 0.5}
            width={u * 3.1}
            height={pitch * 4}
            rx={u * 0.9}
          />
          <ellipse cx={palm.x} cy={palm.y} rx={u * 2.05} ry={pitch * 1.05} />
          {fingers.map((f) => (
            <line
              key={f.id}
              x1={f.from.x}
              y1={f.from.y}
              x2={f.to.x}
              y2={f.to.y}
              strokeWidth={u * WIDTH[f.digit]}
            />
          ))}
        </g>
        {fingers
          .filter((f) => f.move)
          .map((f) => (
            <g key={f.id} className={`hand-active f-${f.move!.finger}`}>
              <line
                x1={f.from.x}
                y1={f.from.y}
                x2={f.to.x}
                y2={f.to.y}
                strokeWidth={u * WIDTH[f.digit]}
              />
              <circle cx={f.to.x} cy={f.to.y} r={u * WIDTH[f.digit] * 0.5} />
            </g>
          ))}
      </g>
    );
  };

  // The wrists hang a little below the keys; the SVG's own edge cuts them off.
  const height = geo.height + pitch * 1.35;
  return (
    <svg
      className="hands"
      width={geo.width}
      height={height}
      viewBox={`0 0 ${geo.width} ${height}`}
      aria-hidden="true"
    >
      {hand('l')}
      {hand('r')}
    </svg>
  );
}
