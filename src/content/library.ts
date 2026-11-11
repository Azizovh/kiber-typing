import commandsRaw from './data/commands.txt?raw';
import symbolsRaw from './data/symbols.txt?raw';
import termsRaw from './data/terms.txt?raw';
import type { Hint, Token } from '../engine/types';

/**
 * Content lives in plain text files (`text ## explanation`, grouped by
 * `@topic id | Title` lines) so that adding commands never means fighting
 * with string escaping — shell syntax is full of quotes and backslashes.
 */
export interface Item {
  text: string;
  desc: string;
  topic: string;
}

export interface Topic {
  id: string;
  title: string;
  items: Item[];
}

function parseItems(raw: string, grouped: boolean): Topic[] {
  const topics: Topic[] = [];
  let current: Topic | null = grouped ? null : { id: 'all', title: 'All', items: [] };
  if (current) topics.push(current);

  for (const rawLine of raw.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    if (grouped && line.startsWith('@topic ')) {
      const [id, title] = line.slice(7).split('|').map((x) => x.trim());
      current = { id, title: title ?? id, items: [] };
      topics.push(current);
      continue;
    }
    const cut = line.lastIndexOf(' ## ');
    if (cut <= 0 || !current) continue;
    current.items.push({
      text: line.slice(0, cut).trim(),
      desc: line.slice(cut + 4).trim(),
      topic: current.id,
    });
  }
  return topics;
}

export const COMMAND_TOPICS = parseItems(commandsRaw, true);
export const TERM_TOPICS = parseItems(termsRaw, true);
export const SYMBOLS = parseItems(symbolsRaw, false)[0].items;

export const COMMANDS = COMMAND_TOPICS.flatMap((t) => t.items);
export const TERMS = TERM_TOPICS.flatMap((t) => t.items);

const hintOf = (item: Item): Hint => ({ label: item.text, desc: item.desc });

/** A command becomes one line: prompt on the first word, Enter after the last. */
export function commandTokens(item: Item): Token[] {
  const hint = hintOf(item);
  const words = item.text.split(' ').filter(Boolean);
  return words.map((text, i) => ({
    text,
    hint,
    bol: i === 0 || undefined,
    eol: i === words.length - 1 || undefined,
  }));
}

/** Terms and symbols flow like ordinary words. */
export function flowTokens(item: Item): Token[] {
  const hint = hintOf(item);
  return item.text
    .split(' ')
    .filter(Boolean)
    .map((text) => ({ text, hint }));
}

let poolCache: Token[] | null = null;

/** Every distinct word in the library — raw material for mistake drills. */
export function tokenPool(): Token[] {
  if (poolCache) return poolCache;
  const seen = new Set<string>();
  const pool: Token[] = [];
  for (const item of [...SYMBOLS, ...COMMANDS, ...TERMS]) {
    for (const token of flowTokens(item)) {
      if (seen.has(token.text)) continue;
      seen.add(token.text);
      pool.push(token);
    }
  }
  poolCache = pool;
  return pool;
}
