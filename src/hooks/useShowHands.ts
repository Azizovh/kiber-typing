import { useData } from '../store/data';
import { useOnboarding } from '../store/onboarding';
import { useSettings } from '../store/settings';

/** Recent results at or above this mean the hands have done their job. */
const GRADUATE_RUNS = 10;
const GRADUATE_WPM = 30;
const GRADUATE_ACCURACY = 94;

/**
 * Whether to draw the guiding hands over the keyboard.
 * In "auto" they appear for people whose placement came out as beginner and
 * step aside once their last ten runs show they no longer need them.
 */
export function useShowHands(): boolean {
  const mode = useSettings((s) => s.hands);
  const level = useOnboarding((s) => s.typingLevel);
  const graduated = useData((s) => {
    const recent = s.results.slice(0, GRADUATE_RUNS);
    if (recent.length < GRADUATE_RUNS) return false;
    const avg = (pick: (r: (typeof recent)[number]) => number) =>
      recent.reduce((sum, r) => sum + pick(r), 0) / recent.length;
    return avg((r) => r.wpm) >= GRADUATE_WPM && avg((r) => r.accuracy) >= GRADUATE_ACCURACY;
  });

  if (mode === 'on') return true;
  if (mode === 'off') return false;
  return level === 'beginner' && !graduated;
}
