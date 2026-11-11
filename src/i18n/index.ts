import { en } from './en';

export type MessageKey = keyof typeof en;
type Dictionary = Record<MessageKey, string>;

/**
 * Interface languages. The typing content itself stays English — that is
 * what a real terminal speaks. To add a language: create `uz.ts` exporting
 * the same keys as `en.ts`, register it here, and add it to the settings page.
 */
const dictionaries: Record<string, Dictionary> = { en };

let current: Dictionary = en;

export function setLanguage(lang: string): void {
  current = dictionaries[lang] ?? en;
}

export function t(key: MessageKey, vars?: Record<string, string | number>): string {
  let text = current[key] ?? en[key] ?? key;
  if (vars) {
    for (const [name, value] of Object.entries(vars)) {
      text = text.replaceAll(`{${name}}`, String(value));
    }
  }
  return text;
}

/** Hook form, so components re-render when language switching is added. */
export function useT() {
  return t;
}
