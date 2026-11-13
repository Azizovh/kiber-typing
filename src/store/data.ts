import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { emptyProfile, mergeRun } from '../engine/profile';
import type { KeyEvent, TestResult, TypingProfile } from '../engine/types';

export const MAX_RESULTS = 300;

export interface LessonProgress {
  stars: number;
  wpm: number;
  accuracy: number;
  at: number;
  runs: number;
}

export interface UserData {
  results: TestResult[];
  profile: TypingProfile;
  lessons: Record<string, LessonProgress>;
  /** Account these records belong to; null while typing as a guest. */
  ownerId: string | null;
  /** True when profile/lessons changed since the last successful cloud save. */
  dirty: boolean;
}

interface DataStore extends UserData {
  /** Save a finished run and fold its keystrokes into the profile. */
  record: (result: TestResult, keyLog: KeyEvent[]) => void;
  /** Learn from keystrokes without adding a result to the history (placement test). */
  absorb: (keyLog: KeyEvent[], missedWords: string[]) => void;
  recordLesson: (lessonId: string, result: TestResult, stars: number) => void;
  markSynced: (ids: string[]) => void;
  replace: (patch: Partial<UserData>) => void;
  reset: () => void;
}

const empty = (): UserData => ({
  results: [],
  profile: emptyProfile(),
  lessons: {},
  ownerId: null,
  dirty: false,
});

/** History keeps the numbers, not the per-second samples of every run. */
const slim = (r: TestResult): TestResult => {
  const { samples: _samples, ...rest } = r;
  return rest;
};

export function mergeLessons(
  a: Record<string, LessonProgress>,
  b: Record<string, LessonProgress>,
): Record<string, LessonProgress> {
  const out = { ...a };
  for (const [id, p] of Object.entries(b)) {
    const q = out[id];
    if (!q) {
      out[id] = p;
      continue;
    }
    const better = p.stars > q.stars || (p.stars === q.stars && p.wpm > q.wpm) ? p : q;
    out[id] = { ...better, runs: Math.max(p.runs, q.runs), at: Math.max(p.at, q.at) };
  }
  return out;
}

export const useData = create<DataStore>()(
  persist(
    (set) => ({
      ...empty(),
      record: (result, keyLog) =>
        set((s) => ({
          results: [slim(result), ...s.results].slice(0, MAX_RESULTS),
          profile: mergeRun(s.profile, keyLog, result.missedWords),
          dirty: true,
        })),
      absorb: (keyLog, missedWords) =>
        set((s) => ({ profile: mergeRun(s.profile, keyLog, missedWords), dirty: true })),
      recordLesson: (lessonId, result, stars) =>
        set((s) => {
          const prev = s.lessons[lessonId];
          const improved =
            !prev || stars > prev.stars || (stars === prev.stars && result.wpm > prev.wpm);
          return {
            dirty: true,
            lessons: {
              ...s.lessons,
              [lessonId]: improved
                ? {
                    stars,
                    wpm: result.wpm,
                    accuracy: result.accuracy,
                    at: result.at,
                    runs: (prev?.runs ?? 0) + 1,
                  }
                : { ...prev, runs: prev.runs + 1, at: result.at },
            },
          };
        }),
      markSynced: (ids) =>
        set((s) => {
          const done = new Set(ids);
          return { results: s.results.map((r) => (done.has(r.id) ? { ...r, synced: true } : r)) };
        }),
      replace: (patch) => set(patch),
      reset: () => set(empty()),
    }),
    { name: 'kibertyping:data', version: 1 },
  ),
);
