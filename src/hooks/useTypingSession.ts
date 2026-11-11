import { useCallback, useEffect, useRef, useState } from 'react';
import { backspace, createSession, extend, finish, sample, typeChar } from '../engine/session';
import type { SessionState, Token } from '../engine/types';

interface Options {
  tokens: Token[];
  strict: boolean;
  /** Seconds; null = run until the text is finished. */
  timeLimit: number | null;
  /** Supplies more text when a timed run gets near the end. */
  more?: (minWords: number) => Token[];
  /** Typing is paused (e.g. results are on screen). */
  enabled: boolean;
  onFinish: (session: SessionState) => void;
  onRestart: () => void;
}

const isEditable = (el: EventTarget | null): boolean =>
  el instanceof HTMLElement &&
  (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);

/**
 * Owns one typing run: listens to the keyboard, drives the pure engine,
 * samples once a second and stops the clock in time mode.
 */
export function useTypingSession(opts: Options) {
  const { tokens, strict, timeLimit, enabled } = opts;
  const [state, setState] = useState<SessionState>(() => createSession(tokens, strict));
  const [now, setNow] = useState(0);
  const [capsLock, setCapsLock] = useState(false);
  const ref = useRef(state);
  const latest = useRef(opts);
  latest.current = opts;

  const commit = useCallback((next: SessionState) => {
    const prev = ref.current;
    if (next === prev) return;
    const { more } = latest.current;
    if (more && next.endedAt === null && next.index > next.tokens.length - 30) {
      next = extend(next, more(40));
    }
    ref.current = next;
    setState(next);
    if (prev.endedAt === null && next.endedAt !== null) latest.current.onFinish(next);
  }, []);

  // A new text (or a strictness change) starts a fresh run.
  useEffect(() => {
    const fresh = createSession(tokens, strict);
    ref.current = fresh;
    setState(fresh);
    setNow(0);
  }, [tokens, strict]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isEditable(e.target)) return;
      setCapsLock(e.getModifierState?.('CapsLock') ?? false);

      if (e.key === 'Tab' || e.key === 'Escape') {
        e.preventDefault();
        latest.current.onRestart();
        return;
      }
      if (!latest.current.enabled) return;

      // A button clicked earlier keeps focus and would "click" again on Space/Enter.
      const focused = document.activeElement;
      if (focused instanceof HTMLElement && focused !== document.body && !e.ctrlKey && !e.metaKey) {
        focused.blur();
      }

      const t = performance.now();
      // AltGr reports as Ctrl+Alt on Windows; plain Ctrl/Meta/Alt combos are shortcuts.
      const altGr = e.ctrlKey && e.altKey;
      if (e.key === 'Backspace') {
        e.preventDefault();
        commit(backspace(ref.current, e.ctrlKey || e.altKey || e.metaKey));
        return;
      }
      if ((e.ctrlKey || e.metaKey || e.altKey) && !altGr) return;
      if (e.key === 'Enter') {
        e.preventDefault();
        commit(typeChar(ref.current, '\n', t));
        return;
      }
      if (e.key.length === 1) {
        // Space would scroll the page; / and ' open quick-find in Firefox.
        e.preventDefault();
        commit(typeChar(ref.current, e.key, t));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [commit]);

  const running = state.startedAt !== null && state.endedAt === null;
  useEffect(() => {
    if (!running || !enabled) return;
    const id = window.setInterval(() => {
      let s = ref.current;
      if (s.startedAt === null || s.endedAt !== null) return;
      const t = performance.now();
      const elapsed = t - s.startedAt;
      const lastT = s.samples[s.samples.length - 1]?.t ?? 0;
      if (Math.floor(elapsed / 1000) > lastT) s = sample(s, t);
      if (timeLimit !== null && elapsed >= timeLimit * 1000) {
        s = finish(s, s.startedAt! + timeLimit * 1000);
      }
      commit(s);
      setNow(t);
    }, 100);
    return () => window.clearInterval(id);
  }, [running, enabled, timeLimit, commit]);

  return { state, now: Math.max(now, state.lastKeyAt ?? 0), running, capsLock };
}
