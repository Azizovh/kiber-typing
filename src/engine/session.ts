import type { KeyEvent, SessionState, Token } from './types';
import { liveWpm } from './metrics';

/** How many characters past the end of a word may be typed before input is ignored. */
export const MAX_EXTRA = 8;

export const ENTER = '\n';
export const SPACE = ' ';

export function createSession(tokens: Token[], strict = false): SessionState {
  return {
    tokens,
    inputs: [''],
    index: 0,
    strict,
    startedAt: null,
    endedAt: null,
    lastKeyAt: null,
    correctKeys: 0,
    incorrectKeys: 0,
    keyLog: [],
    samples: [],
    typedSinceSample: 0,
    errorsSinceSample: 0,
  };
}

/** The key that commits a token: Enter at the end of a command line, Space otherwise. */
export function commitKey(token: Token): string {
  return token.eol ? ENTER : SPACE;
}

/** The character the typist should press next, or null when the input must be corrected first. */
export function expectedChar(s: SessionState): string | null {
  const token = s.tokens[s.index];
  if (!token || s.endedAt !== null) return null;
  const input = s.inputs[s.index] ?? '';
  if (!token.text.startsWith(input)) return null;
  return input.length < token.text.length ? token.text[input.length] : commitKey(token);
}

function record(s: SessionState, ev: Omit<KeyEvent, 'dt' | 'w'>, now: number): SessionState {
  const dt = s.lastKeyAt === null ? 0 : now - s.lastKeyAt;
  return {
    ...s,
    startedAt: s.startedAt ?? now,
    lastKeyAt: now,
    correctKeys: s.correctKeys + (ev.correct ? 1 : 0),
    incorrectKeys: s.incorrectKeys + (ev.correct ? 0 : 1),
    typedSinceSample: s.typedSinceSample + 1,
    errorsSinceSample: s.errorsSinceSample + (ev.correct ? 0 : 1),
    keyLog: s.keyLog.concat({ ...ev, dt, w: s.index }),
  };
}

/**
 * Feed one printable character (or ' ' / '\n') into the session.
 * Pure: returns a new state, or the same object when the key is ignored.
 */
export function typeChar(s: SessionState, ch: string, now: number): SessionState {
  if (s.endedAt !== null) return s;
  const token = s.tokens[s.index];
  if (!token) return s;
  const input = s.inputs[s.index] ?? '';
  const commit = commitKey(token);
  const isLast = s.index === s.tokens.length - 1;

  if (ch === SPACE || ch === ENTER) {
    // Leading whitespace is ignored and does not start the clock.
    if (input.length === 0) return s;
    // The separator itself is judged on its own: pressing it early (word not
    // finished) or pressing the wrong one (Space for Enter) is a mistake, but
    // a typo earlier in the word is not counted a second time here.
    const expected = input.length < token.text.length ? token.text[input.length] : commit;
    const correct = ch === expected;
    let next = record(s, { expected, typed: ch, correct }, now);
    if (s.strict && !correct) return next;
    if (isLast) return { ...next, endedAt: now };
    const inputs = next.inputs.slice();
    inputs[s.index + 1] = '';
    next = { ...next, inputs, index: s.index + 1 };
    return next;
  }

  const inWord = input.length < token.text.length;
  const expected = inWord ? token.text[input.length] : commit;
  const correct = inWord && ch === expected;
  const next = record(s, { expected, typed: ch, correct }, now);
  if (s.strict && !correct) return next;
  if (input.length >= token.text.length + MAX_EXTRA) return next;

  const inputs = next.inputs.slice();
  inputs[s.index] = input + ch;
  // A flowing text ends as soon as its last word is right; a command line
  // still needs its Enter, exactly like a real terminal.
  if (isLast && !token.eol && inputs[s.index] === token.text) {
    return { ...next, inputs, endedAt: now };
  }
  return { ...next, inputs };
}

/** Backspace. `word` deletes the whole current word (Ctrl+Backspace). */
export function backspace(s: SessionState, word = false): SessionState {
  if (s.endedAt !== null) return s;
  const input = s.inputs[s.index] ?? '';
  if (input.length > 0) {
    const inputs = s.inputs.slice();
    inputs[s.index] = word ? '' : input.slice(0, -1);
    return { ...s, inputs };
  }
  // Step back into the previous word only if it was left with a mistake.
  if (s.index > 0 && s.inputs[s.index - 1] !== s.tokens[s.index - 1].text) {
    const inputs = s.inputs.slice(0, s.index);
    if (word) inputs[s.index - 1] = '';
    return { ...s, inputs, index: s.index - 1 };
  }
  return s;
}

/** Append more tokens (time mode never runs out of text). */
export function extend(s: SessionState, more: Token[]): SessionState {
  return { ...s, tokens: s.tokens.concat(more) };
}

/** Take a once-per-second sample for the result chart. */
export function sample(s: SessionState, now: number): SessionState {
  if (s.startedAt === null || s.endedAt !== null) return s;
  const t = Math.round((now - s.startedAt) / 1000);
  if (t <= 0) return s;
  const last = s.samples[s.samples.length - 1];
  const span = Math.max(1, t - (last?.t ?? 0));
  return {
    ...s,
    samples: s.samples.concat({
      t,
      wpm: liveWpm(s, now).wpm,
      raw: (s.typedSinceSample / 5) * (60 / span),
      errors: s.errorsSinceSample,
    }),
    typedSinceSample: 0,
    errorsSinceSample: 0,
  };
}

/** Stop the run (timer ran out). */
export function finish(s: SessionState, now: number): SessionState {
  if (s.endedAt !== null || s.startedAt === null) return s;
  return { ...s, endedAt: now };
}
