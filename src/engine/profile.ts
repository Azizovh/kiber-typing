import type { KeyEvent, KeyStat, Token, TypingProfile } from './types';

/** Latencies above this are pauses (thinking, looking away), not typing speed. */
const MAX_TIMED_MS = 2000;

export function emptyProfile(): TypingProfile {
  return { keys: {}, confusions: {}, words: {} };
}

/** Fold one finished run into the long-term profile. Returns a new profile. */
export function mergeRun(
  profile: TypingProfile,
  keyLog: KeyEvent[],
  missedWords: string[],
): TypingProfile {
  const keys: Record<string, KeyStat> = { ...profile.keys };
  const confusions: Record<string, Record<string, number>> = { ...profile.confusions };
  const words = { ...profile.words };

  for (const ev of keyLog) {
    const prev = keys[ev.expected] ?? { hits: 0, misses: 0, timeMs: 0, timed: 0 };
    const stat = { ...prev };
    if (ev.correct) {
      stat.hits++;
      if (ev.dt > 0 && ev.dt <= MAX_TIMED_MS) {
        stat.timeMs += ev.dt;
        stat.timed++;
      }
    } else {
      stat.misses++;
      const row = { ...(confusions[ev.expected] ?? {}) };
      row[ev.typed] = (row[ev.typed] ?? 0) + 1;
      confusions[ev.expected] = row;
    }
    keys[ev.expected] = stat;
  }
  for (const w of missedWords) words[w] = (words[w] ?? 0) + 1;
  return { keys, confusions, words };
}

/** Sum two profiles (used when a guest's local history is attached to an account). */
export function addProfiles(a: TypingProfile, b: TypingProfile): TypingProfile {
  const out: TypingProfile = {
    keys: { ...a.keys },
    confusions: { ...a.confusions },
    words: { ...a.words },
  };
  for (const [k, s] of Object.entries(b.keys)) {
    const p = out.keys[k];
    out.keys[k] = p
      ? {
          hits: p.hits + s.hits,
          misses: p.misses + s.misses,
          timeMs: p.timeMs + s.timeMs,
          timed: p.timed + s.timed,
        }
      : { ...s };
  }
  for (const [k, row] of Object.entries(b.confusions)) {
    const merged = { ...(out.confusions[k] ?? {}) };
    for (const [typed, n] of Object.entries(row)) merged[typed] = (merged[typed] ?? 0) + n;
    out.confusions[k] = merged;
  }
  for (const [w, n] of Object.entries(b.words)) out.words[w] = (out.words[w] ?? 0) + n;
  return out;
}

export interface WeakKey {
  char: string;
  samples: number;
  errorRate: number;
  /** Average milliseconds to hit the key, or null when never timed. */
  avgMs: number | null;
  /** Higher = needs more practice. */
  score: number;
  /** What gets pressed instead, most frequent first. */
  typedInstead: string[];
}

export function keyTable(profile: TypingProfile, minSamples = 6): WeakKey[] {
  const entries = Object.entries(profile.keys);
  let time = 0;
  let timed = 0;
  for (const [, s] of entries) {
    time += s.timeMs;
    timed += s.timed;
  }
  const globalAvg = timed > 0 ? time / timed : 0;

  const rows: WeakKey[] = [];
  for (const [char, s] of entries) {
    const samples = s.hits + s.misses;
    if (samples < minSamples) continue;
    const errorRate = s.misses / samples;
    const avgMs = s.timed > 0 ? s.timeMs / s.timed : null;
    const slowness = avgMs !== null && globalAvg > 0 ? Math.max(0, avgMs / globalAvg - 1) : 0;
    const typedInstead = Object.entries(profile.confusions[char] ?? {})
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([c]) => c);
    rows.push({ char, samples, errorRate, avgMs, score: errorRate * 100 + slowness * 15, typedInstead });
  }
  return rows.sort((a, b) => b.score - a.score);
}

/** Keys that really need work: noticeably error-prone or noticeably slow. */
export function weakKeys(profile: TypingProfile, limit = 8): WeakKey[] {
  return keyTable(profile)
    .filter((k) => k.score >= 4)
    .slice(0, limit);
}

export function missedWords(profile: TypingProfile, limit = 20): { word: string; count: number }[] {
  return Object.entries(profile.words)
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

function pickWeighted<T>(items: T[], weights: number[], total: number, rng: () => number): T {
  let r = rng() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

/**
 * Build a drill that leans on what the typist gets wrong.
 * `charWeights` maps a character to how badly it needs practice,
 * `wordWeights` does the same for whole words. Tokens from `pool` are drawn
 * with probability proportional to how much weak material they contain.
 */
export function buildDrill(
  pool: Token[],
  charWeights: Record<string, number>,
  wordWeights: Record<string, number>,
  count: number,
  rng: () => number = Math.random,
): Token[] {
  const seen = new Set<string>();
  const items: Token[] = [];
  const weights: number[] = [];
  let total = 0;

  const add = (token: Token, weight: number) => {
    if (weight <= 0 || seen.has(token.text)) return;
    seen.add(token.text);
    items.push({ text: token.text, hint: token.hint });
    weights.push(weight);
    total += weight;
  };

  // Words that were mistyped before come first and weigh the most.
  const byText = new Map(pool.map((t) => [t.text, t]));
  for (const [word, w] of Object.entries(wordWeights)) {
    add(byText.get(word) ?? { text: word }, 4 + w * 2);
  }
  for (const token of pool) {
    let w = 0;
    for (const ch of token.text) w += charWeights[ch] ?? 0;
    // Normalise a little so very long tokens don't dominate.
    add(token, w / Math.sqrt(token.text.length));
  }
  if (items.length === 0) return [];

  const out: Token[] = [];
  let last = '';
  for (let i = 0; i < count; i++) {
    let token = pickWeighted(items, weights, total, rng);
    if (token.text === last && items.length > 1) token = pickWeighted(items, weights, total, rng);
    last = token.text;
    out.push(token);
  }
  return out;
}

/** Drill built from the long-term profile. Empty when there is not enough data yet. */
export function profileDrill(
  profile: TypingProfile,
  pool: Token[],
  count: number,
  rng: () => number = Math.random,
): Token[] {
  const charWeights: Record<string, number> = {};
  for (const k of weakKeys(profile, 10)) {
    if (k.char !== ' ' && k.char !== '\n') charWeights[k.char] = k.score;
  }
  const wordWeights: Record<string, number> = {};
  for (const { word, count: n } of missedWords(profile, 15)) wordWeights[word] = Math.min(n, 5);
  return buildDrill(pool, charWeights, wordWeights, count, rng);
}

/** Drill built from the mistakes of a single run. */
export function mistakeDrill(
  missedChars: Record<string, number>,
  missed: string[],
  pool: Token[],
  count: number,
  rng: () => number = Math.random,
): Token[] {
  const charWeights: Record<string, number> = {};
  for (const [ch, n] of Object.entries(missedChars)) {
    if (ch !== ' ' && ch !== '\n') charWeights[ch] = n * 5;
  }
  const wordWeights: Record<string, number> = {};
  for (const w of missed) wordWeights[w] = 3;
  return buildDrill(pool, charWeights, wordWeights, count, rng);
}
