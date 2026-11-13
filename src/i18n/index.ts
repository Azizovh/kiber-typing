import { useMemo } from 'react';
import { useSettings, type Lang } from '../store/settings';
import { en } from './en';
import { ru } from './ru';
import { uz } from './uz';

export type MessageKey = keyof typeof en;

/**
 * A language must translate every key of `en.ts`. It may add optional keys
 * (lesson titles, topic names, finger names…) whose English text lives next
 * to the thing it names; those are looked up with `t.opt`.
 */
export type Dictionary = Record<MessageKey, string> & Record<string, string>;

/**
 * Interface languages. Only the site's own interface is translated: the text
 * you type and its explanations stay English, like a real terminal.
 */
export const LANGUAGES: { id: Lang; label: string }[] = [
  { id: 'en', label: 'english' },
  { id: 'uz', label: "o'zbek" },
  { id: 'ru', label: 'русский' },
];

const dictionaries: Record<Lang, Dictionary> = { en, uz, ru };

type Vars = Record<string, string | number>;

function fill(text: string, vars?: Vars): string {
  if (!vars) return text;
  for (const [name, value] of Object.entries(vars)) {
    text = text.replaceAll(`{${name}}`, String(value));
  }
  return text;
}

export interface Translator {
  (key: MessageKey, vars?: Vars): string;
  /** Optional key: falls back to the given English text when not translated. */
  opt: (key: string, fallback: string, vars?: Vars) => string;
}

function translator(lang: Lang): Translator {
  const dict = dictionaries[lang] ?? en;
  const t = ((key, vars) => fill(dict[key] ?? en[key] ?? key, vars)) as Translator;
  t.opt = (key, fallback, vars) => fill(dict[key] ?? fallback, vars);
  return t;
}

/** Translator for the language chosen in settings; changes identity when it changes. */
export function useT(): Translator {
  const lang = useSettings((s) => s.lang);
  return useMemo(() => translator(lang), [lang]);
}
