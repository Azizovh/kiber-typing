import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Category, LengthMode } from '../engine/types';

export const THEMES = ['kali', 'matrix', 'dracula', 'nord', 'paper'] as const;
export type Theme = (typeof THEMES)[number];

export const DURATIONS = [15, 30, 60, 120] as const;
export const WORD_COUNTS = [10, 25, 50, 100] as const;
export const FONT_SIZES = [20, 24, 28, 32] as const;

export type Lang = 'en' | 'uz' | 'ru';

/** First visit: follow the browser's language when we have it. */
function detectLang(): Lang {
  const nav = typeof navigator === 'undefined' ? '' : navigator.language.toLowerCase();
  if (nav.startsWith('uz')) return 'uz';
  if (nav.startsWith('ru')) return 'ru';
  return 'en';
}

export interface Settings {
  /** Interface language. The typing content is always English. */
  lang: Lang;
  theme: Theme;
  category: Category;
  /** Command topic filter; null = all topics. */
  topic: string | null;
  mode: LengthMode;
  duration: number;
  wordCount: number;
  /** Stamina-style: a wrong key is not accepted, you must hit the right one. */
  strict: boolean;
  showKeyboard: boolean;
  /**
   * Translucent hands over the on-screen keyboard.
   * auto — shown while the measured typing level is "beginner".
   */
  hands: 'auto' | 'on' | 'off';
  showHints: boolean;
  fontSize: number;
}

interface SettingsStore extends Settings {
  set: (patch: Partial<Settings>) => void;
}

export const useSettings = create<SettingsStore>()(
  persist(
    (set) => ({
      lang: detectLang(),
      theme: 'kali',
      category: 'mixed',
      topic: null,
      mode: 'time',
      duration: 30,
      wordCount: 25,
      strict: false,
      showKeyboard: true,
      hands: 'auto',
      showHints: true,
      fontSize: 24,
      set: (patch) => set(patch),
    }),
    { name: 'kibertyping:settings', version: 1 },
  ),
);
