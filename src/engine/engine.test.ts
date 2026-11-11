import { describe, expect, it } from 'vitest';
import { createGenerator, seeded, takeWords } from '../content/generate';
import { LESSONS } from '../content/lessons';
import { COMMANDS, SYMBOLS, TERMS, tokenPool } from '../content/library';
import { keyFor } from '../keyboard/layout';
import { accuracy, buildResult, consistency, tally } from './metrics';
import { emptyProfile, mergeRun, mistakeDrill, profileDrill, weakKeys } from './profile';
import { backspace, createSession, expectedChar, finish, sample, typeChar } from './session';
import type { RunConfig, SessionState, Token } from './types';

const CONFIG: RunConfig = {
  kind: 'test',
  category: 'mixed',
  mode: 'words',
  length: 2,
  topic: null,
  strict: false,
};

/** Type a string, 100 ms per key. '\n' is Enter. */
function type(s: SessionState, text: string, start = 1000): SessionState {
  let t = s.lastKeyAt ?? start;
  for (const ch of text) {
    t += 100;
    s = typeChar(s, ch, t);
  }
  return s;
}

const flow = (text: string): Token[] => text.split(' ').map((t) => ({ text: t }));
const line = (text: string): Token[] => {
  const words = text.split(' ');
  return words.map((t, i) => ({ text: t, bol: i === 0, eol: i === words.length - 1 }));
};

describe('session', () => {
  it('finishes flowing text when the last word is correct', () => {
    const s = type(createSession(flow('ls -la')), 'ls -la');
    expect(s.endedAt).not.toBeNull();
    expect(accuracy(s)).toBe(100);
    expect(tally(s)).toMatchObject({ correct: 5, incorrect: 0, extra: 0, missed: 0 });
  });

  it('requires Enter to finish a command line', () => {
    let s = type(createSession(line('nmap -sV')), 'nmap -sV');
    expect(s.endedAt).toBeNull();
    expect(expectedChar(s)).toBe('\n');
    s = type(s, '\n');
    expect(s.endedAt).not.toBeNull();
    expect(s.incorrectKeys).toBe(0);
  });

  it('counts Space instead of Enter as a mistake', () => {
    const s = type(createSession(line('id')), 'id ');
    expect(s.endedAt).not.toBeNull();
    expect(s.incorrectKeys).toBe(1);
    expect(s.keyLog.at(-1)).toMatchObject({ expected: '\n', typed: ' ', correct: false });
  });

  it('ignores leading spaces and does not start the clock', () => {
    const s = type(createSession(flow('a b')), '  ');
    expect(s.startedAt).toBeNull();
    expect(s.keyLog).toHaveLength(0);
  });

  it('records wrong, extra and missed characters', () => {
    // "cat" typed as "cet", then "ls" typed as "lsx", then "pw" for "pwd".
    const s = type(createSession(flow('cat ls pwd end')), 'cet lsx pw ');
    expect(s.index).toBe(3);
    expect(tally(s)).toMatchObject({ correct: 6, incorrect: 1, extra: 1, missed: 1 });
    // e-for-a, the extra x, and the early space.
    expect(s.incorrectKeys).toBe(3);
  });

  it('backspace returns to a previous word only if it was wrong', () => {
    let s = type(createSession(flow('aa bb cc')), 'aa ');
    expect(backspace(s)).toBe(s);
    s = type(s, 'bx ');
    expect(s.index).toBe(2);
    s = backspace(s);
    expect(s.index).toBe(1);
    expect(s.inputs[1]).toBe('bx');
    expect(expectedChar(s)).toBeNull();
    s = backspace(s);
    expect(expectedChar(s)).toBe('b');
  });

  it('ctrl+backspace clears the whole word', () => {
    const s = backspace(type(createSession(flow('hello x')), 'hel'), true);
    expect(s.inputs[0]).toBe('');
  });

  it('strict mode refuses wrong keys but still counts them', () => {
    let s = type(createSession(flow('ab cd'), true), 'xa');
    expect(s.inputs[0]).toBe('a');
    expect(s.incorrectKeys).toBe(1);
    // Space before the word is complete is refused too.
    s = type(s, ' ');
    expect(s.index).toBe(0);
    s = type(s, 'b cd');
    expect(s.endedAt).not.toBeNull();
    expect(tally(s).incorrect).toBe(0);
  });

  it('samples once per second and can be stopped by the timer', () => {
    let s = type(createSession(flow('aaaa bbbb cccc dddd')), 'aaaa bbbb ');
    s = sample(s, s.startedAt! + 1000);
    expect(s.samples).toHaveLength(1);
    expect(s.samples[0].raw).toBe((10 / 5) * 60);
    s = finish(s, s.startedAt! + 2000);
    expect(s.endedAt).toBe(s.startedAt! + 2000);
    expect(typeChar(s, 'c', 9999)).toBe(s);
  });
});

describe('metrics', () => {
  it('computes wpm from correctly typed words', () => {
    // 10 chars + 1 space in 1.0 s of typing (11 keys, first at t=0).
    const s = type(createSession(flow('aaaaa bbbbb')), 'aaaaa bbbbb');
    const r = buildResult(s, CONFIG);
    expect(r.durationMs).toBe(1000);
    expect(r.wpm).toBeCloseTo((11 / 5) * 60, 0);
    expect(r.accuracy).toBe(100);
    expect(r.missedWords).toEqual([]);
  });

  it('a wrong word does not count towards net wpm', () => {
    const s = type(createSession(flow('aaaaa bbbbb')), 'aaaax bbbbb');
    const r = buildResult(s, CONFIG);
    expect(r.wpm).toBeLessThan(r.raw);
    expect(r.missedChars).toEqual({ a: 1 });
    expect(r.missedWords).toEqual(['aaaaa']);
  });

  it('consistency is 100 for perfectly even speed and lower otherwise', () => {
    expect(consistency([60, 60, 60, 60])).toBe(100);
    expect(consistency([20, 100, 30, 90])).toBeLessThan(70);
  });
});

describe('profile', () => {
  it('finds weak keys and builds drills around them', () => {
    let profile = emptyProfile();
    // Miss '|' half of the time, always hit 'a'.
    const tokens = flow('a|a| a|a| a|a| a|a|');
    const s = type(createSession(tokens), 'a|a\\ a|a\\ a|a\\ a|a\\');
    const r = buildResult(s, CONFIG);
    profile = mergeRun(profile, s.keyLog, r.missedWords);

    const weak = weakKeys(profile);
    expect(weak[0].char).toBe('|');
    expect(weak[0].errorRate).toBeCloseTo(0.5);
    expect(weak[0].typedInstead).toEqual(['\\']);

    const drill = profileDrill(profile, tokenPool(), 40, seeded(1));
    expect(drill).toHaveLength(40);
    const withPipe = drill.filter((t) => t.text.includes('|') || t.text === 'a|a|').length;
    expect(withPipe).toBeGreaterThan(30);
  });

  it('builds a drill from the mistakes of one run', () => {
    const drill = mistakeDrill({ $: 3 }, ['$HOME'], tokenPool(), 20, seeded(2));
    expect(drill).toHaveLength(20);
    expect(drill.every((t) => t.text.includes('$'))).toBe(true);
  });

  it('has nothing to drill for an empty profile', () => {
    expect(profileDrill(emptyProfile(), tokenPool(), 20)).toEqual([]);
  });
});

describe('content', () => {
  it('parses the library', () => {
    expect(COMMANDS.length).toBeGreaterThan(200);
    expect(SYMBOLS.length).toBeGreaterThan(120);
    expect(TERMS.length).toBeGreaterThan(120);
    for (const item of [...COMMANDS, ...SYMBOLS, ...TERMS]) {
      expect(item.text).not.toBe('');
      expect(item.desc).not.toBe('');
      expect(item.text).not.toMatch(/\s\s/);
    }
  });

  it('only uses characters that exist on a US keyboard', () => {
    const untypable = new Set<string>();
    for (const item of [...COMMANDS, ...SYMBOLS, ...TERMS]) {
      for (const ch of item.text) if (!keyFor(ch)) untypable.add(ch);
    }
    for (const lesson of LESSONS) {
      for (const token of lesson.build()) {
        for (const ch of token.text) if (!keyFor(ch)) untypable.add(ch);
      }
    }
    expect([...untypable]).toEqual([]);
  });

  it('generates command lines that start with a prompt and end with Enter', () => {
    const gen = createGenerator({ category: 'commands', topic: 'recon' }, seeded(7));
    const tokens = gen(50);
    expect(tokens.length).toBeGreaterThanOrEqual(50);
    expect(tokens[0].bol).toBe(true);
    expect(tokens.at(-1)!.eol).toBe(true);
    for (let i = 1; i < tokens.length; i++) {
      expect(!!tokens[i].bol).toBe(!!tokens[i - 1].eol);
    }
  });

  it('never cuts a command line in half in words mode', () => {
    for (const category of ['commands', 'mixed', 'symbols', 'terms'] as const) {
      const tokens = takeWords(createGenerator({ category, topic: null }, seeded(3)), 25);
      expect(tokens.length).toBeGreaterThanOrEqual(25);
      expect(tokens.length).toBeLessThan(45);
      const last = tokens.at(-1)!;
      const open = tokens.filter((t) => t.bol).length - tokens.filter((t) => t.eol).length;
      expect(open).toBe(0);
      expect(last.text).not.toBe('');
    }
  });

  it('every lesson has text and a unique id', () => {
    const ids = new Set(LESSONS.map((l) => l.id));
    expect(ids.size).toBe(LESSONS.length);
    for (const lesson of LESSONS) expect(lesson.build().length).toBeGreaterThan(8);
  });
});
