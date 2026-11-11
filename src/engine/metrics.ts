import type { CharCounts, RunConfig, SessionState, TestResult } from './types';

interface Tally extends CharCounts {
  /** Characters (plus separators) of words typed entirely right — the basis of net WPM. */
  net: number;
  /** Every character that ended up on screen, plus separators — the basis of raw WPM. */
  all: number;
}

export function tally(s: SessionState): Tally {
  const out: Tally = { correct: 0, incorrect: 0, extra: 0, missed: 0, net: 0, all: 0 };
  for (let i = 0; i <= s.index && i < s.tokens.length; i++) {
    const text = s.tokens[i].text;
    const input = s.inputs[i] ?? '';
    const committed = i < s.index || (s.endedAt !== null && input === text);
    const shared = Math.min(text.length, input.length);
    let ok = 0;
    for (let c = 0; c < shared; c++) if (text[c] === input[c]) ok++;
    out.correct += ok;
    out.incorrect += shared - ok;
    out.extra += Math.max(0, input.length - text.length);
    if (i < s.index) out.missed += Math.max(0, text.length - input.length);

    const sep = i < s.index ? 1 : 0;
    out.all += input.length + sep;
    if (committed) {
      if (input === text) out.net += text.length + sep;
    } else if (text.startsWith(input)) {
      // The word in progress counts as long as it is right so far.
      out.net += input.length;
    }
  }
  return out;
}

export function elapsedMs(s: SessionState, now: number): number {
  if (s.startedAt === null) return 0;
  return Math.max(0, (s.endedAt ?? now) - s.startedAt);
}

export function accuracy(s: SessionState): number {
  const total = s.correctKeys + s.incorrectKeys;
  return total === 0 ? 100 : (s.correctKeys / total) * 100;
}

export function liveWpm(s: SessionState, now: number): { wpm: number; raw: number } {
  const ms = elapsedMs(s, now);
  if (ms < 400) return { wpm: 0, raw: 0 };
  const minutes = ms / 60000;
  const t = tally(s);
  return { wpm: t.net / 5 / minutes, raw: t.all / 5 / minutes };
}

/**
 * 0–100: how even the typing speed was. Uses the same shape of curve as
 * monkeytype (a squashed coefficient of variation of per-second raw speed).
 */
export function consistency(raws: number[]): number {
  const xs = raws.filter((x) => Number.isFinite(x));
  if (xs.length < 2) return 100;
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  if (mean === 0) return 0;
  const variance = xs.reduce((a, b) => a + (b - mean) ** 2, 0) / xs.length;
  const cov = Math.sqrt(variance) / mean;
  const squashed = Math.tanh(cov + cov ** 3 / 3 + cov ** 5 / 5);
  return Math.max(0, Math.min(100, 100 * (1 - squashed)));
}

const round1 = (x: number) => Math.round(x * 10) / 10;

export function buildResult(s: SessionState, config: RunConfig): TestResult {
  const end = s.endedAt ?? s.lastKeyAt ?? 0;
  const { wpm, raw } = liveWpm(s, end);
  const t = tally(s);

  const missedChars: Record<string, number> = {};
  const missedWordSet = new Set<string>();
  for (const ev of s.keyLog) {
    if (ev.correct) continue;
    missedChars[ev.expected] = (missedChars[ev.expected] ?? 0) + 1;
    const word = s.tokens[ev.w]?.text;
    if (word) missedWordSet.add(word);
  }

  return {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    at: Date.now(),
    config,
    wpm: round1(wpm),
    raw: round1(raw),
    accuracy: round1(accuracy(s)),
    consistency: round1(consistency(s.samples.map((x) => x.raw))),
    durationMs: Math.round(elapsedMs(s, end)),
    chars: { correct: t.correct, incorrect: t.incorrect, extra: t.extra, missed: t.missed },
    samples: s.samples,
    missedChars,
    missedWords: [...missedWordSet],
  };
}
