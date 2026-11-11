export type Category = 'symbols' | 'commands' | 'terms' | 'mixed';
export type LengthMode = 'time' | 'words';
export type RunKind = 'test' | 'lesson' | 'practice';

/** Short explanation shown under the typing area while a token is active. */
export interface Hint {
  label: string;
  desc: string;
}

/** One space-separated unit of the text to type. */
export interface Token {
  text: string;
  /** First word of a command line — rendered with a shell prompt. */
  bol?: boolean;
  /** Last word of a command line — committed with Enter instead of Space. */
  eol?: boolean;
  hint?: Hint;
}

export interface KeyEvent {
  /** The character that should have been typed (' ' = space, '\n' = enter). */
  expected: string;
  typed: string;
  correct: boolean;
  /** Milliseconds since the previous keystroke (0 for the first). */
  dt: number;
  /** Index of the token being typed. */
  w: number;
}

export interface Sample {
  /** Seconds since the start of the run. */
  t: number;
  /** Cumulative net WPM at that moment. */
  wpm: number;
  /** Raw WPM during that single second. */
  raw: number;
  /** Mistakes made during that second. */
  errors: number;
}

export interface SessionState {
  tokens: Token[];
  /** What was typed for each token up to and including `index`. */
  inputs: string[];
  index: number;
  strict: boolean;
  startedAt: number | null;
  endedAt: number | null;
  lastKeyAt: number | null;
  correctKeys: number;
  incorrectKeys: number;
  keyLog: KeyEvent[];
  samples: Sample[];
  /** Counters reset every time a sample is taken. */
  typedSinceSample: number;
  errorsSinceSample: number;
}

export interface CharCounts {
  correct: number;
  incorrect: number;
  extra: number;
  missed: number;
}

export interface RunConfig {
  kind: RunKind;
  category: Category;
  mode: LengthMode;
  /** Seconds in time mode, word count in words mode. */
  length: number;
  topic: string | null;
  strict: boolean;
  lessonId?: string;
}

export interface TestResult {
  id: string;
  at: number;
  config: RunConfig;
  wpm: number;
  raw: number;
  accuracy: number;
  consistency: number;
  durationMs: number;
  chars: CharCounts;
  /** Per-second samples; dropped from persisted history to save space. */
  samples?: Sample[];
  /** expected character -> number of times it was missed in this run */
  missedChars: Record<string, number>;
  missedWords: string[];
  synced?: boolean;
}

export interface KeyStat {
  hits: number;
  misses: number;
  /** Sum of latencies of correct keystrokes, for average speed per key. */
  timeMs: number;
  timed: number;
}

/** Long-term picture of how a person types — drives "work on mistakes". */
export interface TypingProfile {
  keys: Record<string, KeyStat>;
  /** expected -> typed -> count */
  confusions: Record<string, Record<string, number>>;
  /** word -> number of runs in which it was mistyped */
  words: Record<string, number>;
}
