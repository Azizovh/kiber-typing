import type { Category, Token } from '../engine/types';
import {
  COMMAND_TOPICS,
  COMMANDS,
  SYMBOLS,
  TERMS,
  commandTokens,
  flowTokens,
  type Item,
} from './library';

export type Rng = () => number;

/** Small deterministic PRNG so tests (and lessons) can be reproducible. */
export function seeded(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Endless stream of items in shuffled order, never repeating back to back. */
function shuffledStream(items: Item[], rng: Rng): () => Item {
  let bag: Item[] = [];
  let last: Item | null = null;
  return () => {
    if (bag.length === 0) {
      bag = items.slice();
      for (let i = bag.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [bag[i], bag[j]] = [bag[j], bag[i]];
      }
      if (bag.length > 1 && bag[bag.length - 1] === last) {
        [bag[0], bag[bag.length - 1]] = [bag[bag.length - 1], bag[0]];
      }
    }
    last = bag.pop()!;
    return last;
  };
}

export interface GenerateOptions {
  category: Category;
  /** Restrict commands to one topic id; null = every topic. */
  topic: string | null;
}

/**
 * Returns a function that produces more text each time it is called.
 * The typing screen calls it once for the first screenful and again
 * whenever a timed run gets close to the end of what it has.
 */
export function createGenerator(opts: GenerateOptions, rng: Rng = Math.random) {
  const commandItems =
    (opts.topic && COMMAND_TOPICS.find((t) => t.id === opts.topic)?.items) || COMMANDS;
  const nextCommand = shuffledStream(commandItems, rng);
  const nextSymbol = shuffledStream(SYMBOLS, rng);
  const nextTerm = shuffledStream(TERMS, rng);

  const block = (): Token[] => {
    switch (opts.category) {
      case 'symbols':
        return flowTokens(nextSymbol());
      case 'terms':
        return flowTokens(nextTerm());
      case 'commands':
        return commandTokens(nextCommand());
      case 'mixed': {
        const r = rng();
        if (r < 0.45) return commandTokens(nextCommand());
        const next = r < 0.75 ? nextSymbol : nextTerm;
        const run: Token[] = [];
        const n = 3 + Math.floor(rng() * 3);
        for (let i = 0; i < n; i++) run.push(...flowTokens(next()));
        return run;
      }
    }
  };

  /** At least `minWords` tokens, always ending on a block boundary. */
  return (minWords: number): Token[] => {
    const out: Token[] = [];
    while (out.length < minWords) out.push(...block());
    return out;
  };
}

/** About `count` tokens for words mode: `count`, plus whatever finishes the last item. */
export function takeWords(generate: (n: number) => Token[], count: number): Token[] {
  const tokens = generate(count);
  // A command line is never cut in half: finish the one that crosses the limit.
  let end = Math.min(count, tokens.length);
  while (end < tokens.length && tokens[end - 1].hint === tokens[end].hint && !tokens[end - 1].eol) {
    end++;
  }
  return tokens.slice(0, end);
}
