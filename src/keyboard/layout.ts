export type Finger =
  | 'l-pinky'
  | 'l-ring'
  | 'l-middle'
  | 'l-index'
  | 'thumb'
  | 'r-index'
  | 'r-middle'
  | 'r-ring'
  | 'r-pinky';

export const FINGER_NAMES: Record<Finger, string> = {
  'l-pinky': 'left pinky',
  'l-ring': 'left ring',
  'l-middle': 'left middle',
  'l-index': 'left index',
  thumb: 'thumb',
  'r-index': 'right index',
  'r-middle': 'right middle',
  'r-ring': 'right ring',
  'r-pinky': 'right pinky',
};

export interface KeyDef {
  code: string;
  /** Character produced without Shift ('' for modifier keys). */
  base: string;
  /** Character produced with Shift. */
  shift: string;
  finger: Finger;
  /** Width in key units (default 1). */
  w?: number;
  label?: string;
  /** Home-row bump keys (F and J). */
  home?: boolean;
}

const k = (code: string, base: string, shift: string, finger: Finger): KeyDef => ({
  code,
  base,
  shift,
  finger,
});
const mod = (code: string, label: string, finger: Finger, w: number): KeyDef => ({
  code,
  base: '',
  shift: '',
  finger,
  w,
  label,
});

/** US QWERTY — the layout Kali ships with and every cheat sheet assumes. */
export const ROWS: KeyDef[][] = [
  [
    k('Backquote', '`', '~', 'l-pinky'),
    k('Digit1', '1', '!', 'l-pinky'),
    k('Digit2', '2', '@', 'l-ring'),
    k('Digit3', '3', '#', 'l-middle'),
    k('Digit4', '4', '$', 'l-index'),
    k('Digit5', '5', '%', 'l-index'),
    k('Digit6', '6', '^', 'r-index'),
    k('Digit7', '7', '&', 'r-index'),
    k('Digit8', '8', '*', 'r-middle'),
    k('Digit9', '9', '(', 'r-ring'),
    k('Digit0', '0', ')', 'r-pinky'),
    k('Minus', '-', '_', 'r-pinky'),
    k('Equal', '=', '+', 'r-pinky'),
    mod('Backspace', '⌫', 'r-pinky', 2),
  ],
  [
    mod('Tab', 'tab', 'l-pinky', 1.5),
    k('KeyQ', 'q', 'Q', 'l-pinky'),
    k('KeyW', 'w', 'W', 'l-ring'),
    k('KeyE', 'e', 'E', 'l-middle'),
    k('KeyR', 'r', 'R', 'l-index'),
    k('KeyT', 't', 'T', 'l-index'),
    k('KeyY', 'y', 'Y', 'r-index'),
    k('KeyU', 'u', 'U', 'r-index'),
    k('KeyI', 'i', 'I', 'r-middle'),
    k('KeyO', 'o', 'O', 'r-ring'),
    k('KeyP', 'p', 'P', 'r-pinky'),
    k('BracketLeft', '[', '{', 'r-pinky'),
    k('BracketRight', ']', '}', 'r-pinky'),
    { ...k('Backslash', '\\', '|', 'r-pinky'), w: 1.5 },
  ],
  [
    mod('CapsLock', 'caps', 'l-pinky', 1.75),
    k('KeyA', 'a', 'A', 'l-pinky'),
    k('KeyS', 's', 'S', 'l-ring'),
    k('KeyD', 'd', 'D', 'l-middle'),
    { ...k('KeyF', 'f', 'F', 'l-index'), home: true },
    k('KeyG', 'g', 'G', 'l-index'),
    k('KeyH', 'h', 'H', 'r-index'),
    { ...k('KeyJ', 'j', 'J', 'r-index'), home: true },
    k('KeyK', 'k', 'K', 'r-middle'),
    k('KeyL', 'l', 'L', 'r-ring'),
    k('Semicolon', ';', ':', 'r-pinky'),
    k('Quote', "'", '"', 'r-pinky'),
    mod('Enter', 'enter ↵', 'r-pinky', 2.25),
  ],
  [
    mod('ShiftLeft', 'shift', 'l-pinky', 2.25),
    k('KeyZ', 'z', 'Z', 'l-pinky'),
    k('KeyX', 'x', 'X', 'l-ring'),
    k('KeyC', 'c', 'C', 'l-middle'),
    k('KeyV', 'v', 'V', 'l-index'),
    k('KeyB', 'b', 'B', 'l-index'),
    k('KeyN', 'n', 'N', 'r-index'),
    k('KeyM', 'm', 'M', 'r-index'),
    k('Comma', ',', '<', 'r-middle'),
    k('Period', '.', '>', 'r-ring'),
    k('Slash', '/', '?', 'r-pinky'),
    mod('ShiftRight', 'shift', 'r-pinky', 2.75),
  ],
  [mod('Space', 'space', 'thumb', 6.5)],
];

export interface KeyTarget {
  key: KeyDef;
  /** Which Shift to hold (always the hand opposite to the key), or null. */
  shift: 'ShiftLeft' | 'ShiftRight' | null;
}

const targets = new Map<string, KeyTarget>();
const byCode = new Map<string, KeyDef>();

for (const row of ROWS) {
  for (const key of row) {
    byCode.set(key.code, key);
    if (!key.base) continue;
    targets.set(key.base, { key, shift: null });
    const leftHand = key.finger.startsWith('l-');
    targets.set(key.shift, { key, shift: leftHand ? 'ShiftRight' : 'ShiftLeft' });
  }
}
targets.set(' ', { key: byCode.get('Space')!, shift: null });
targets.set('\n', { key: byCode.get('Enter')!, shift: null });

/** Which physical key (and Shift) produces a character. */
export function keyFor(char: string): KeyTarget | undefined {
  return targets.get(char);
}

export function keyByCode(code: string): KeyDef | undefined {
  return byCode.get(code);
}

/** Human-readable name of a character for tables and tooltips. */
export function charLabel(char: string): string {
  if (char === ' ') return 'space';
  if (char === '\n') return 'enter';
  return char;
}
