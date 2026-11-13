import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Level = 'beginner' | 'intermediate' | 'advanced';
export type Os = 'windows' | 'linux' | 'macos';

export interface StageScore {
  wpm: number;
  accuracy: number;
  level: Level;
}

export interface OnboardingData {
  /** pending — not asked yet; done — finished; skipped — chose not to. */
  status: 'pending' | 'done' | 'skipped';
  name: string;
  /** ISO 3166-1 alpha-2, or '' when not given. */
  country: string;
  os: Os | '';
  /** Minutes of practice per day the person aims for. */
  dailyGoal: number;
  /** Measured, never self-reported: one score per kind of text. */
  typing: { letters: StageScore; symbols: StageScore; commands: StageScore } | null;
  typingLevel: Level | null;
  knowledge: { correct: number; total: number; level: Level } | null;
  at: number | null;
}

interface OnboardingStore extends OnboardingData {
  set: (patch: Partial<OnboardingData>) => void;
  reset: () => void;
}

export const emptyOnboarding = (): OnboardingData => ({
  status: 'pending',
  name: '',
  country: '',
  os: '',
  dailyGoal: 10,
  typing: null,
  typingLevel: null,
  knowledge: null,
  at: null,
});

export const useOnboarding = create<OnboardingStore>()(
  persist(
    (set) => ({
      ...emptyOnboarding(),
      set: (patch) => set(patch),
      reset: () => set(emptyOnboarding()),
    }),
    { name: 'kibertyping:onboarding', version: 1 },
  ),
);

/** Just the data, without the store's functions — what gets saved to the cloud. */
export function onboardingData(): OnboardingData {
  const { set: _set, reset: _reset, ...data } = useOnboarding.getState();
  return data;
}
