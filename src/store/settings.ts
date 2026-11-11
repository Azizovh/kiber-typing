import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Category, LengthMode } from '../engine/types';

export const THEMES = ['kali', 'matrix', 'dracula', 'nord', 'paper'] as const;
export type Theme = (typeof THEMES)[number];

export const DURATIONS = [15, 30, 60, 120] as const;
export const WORD_COUNTS = [10, 25, 50, 100] as const;
export const FONT_SIZES = [20, 24, 28, 32] as const;

export interface Settings {
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
  showHints: boolean;
  fontSize: number;
}

interface SettingsStore extends Settings {
  set: (patch: Partial<Settings>) => void;
}

export const useSettings = create<SettingsStore>()(
  persist(
    (set) => ({
      theme: 'kali',
      category: 'mixed',
      topic: null,
      mode: 'time',
      duration: 30,
      wordCount: 25,
      strict: false,
      showKeyboard: true,
      showHints: true,
      fontSize: 24,
      set: (patch) => set(patch),
    }),
    { name: 'kibertyping:settings', version: 1 },
  ),
);
