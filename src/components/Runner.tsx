import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { tokenPool } from '../content/library';
import { accuracy, buildResult, liveWpm } from '../engine/metrics';
import { mistakeDrill } from '../engine/profile';
import { expectedChar } from '../engine/session';
import type { RunConfig, SessionState, TestResult, Token } from '../engine/types';
import { useShowHands } from '../hooks/useShowHands';
import { useTypingSession } from '../hooks/useTypingSession';
import { useT } from '../i18n';
import { syncAfterRun } from '../services/sync';
import { useData } from '../store/data';
import { useSettings } from '../store/settings';
import { Keyboard } from './Keyboard';
import { Results } from './Results';
import { TypingArea } from './TypingArea';

/** Fewer keystrokes than this and the numbers are noise — don't save the run. */
const MIN_KEYSTROKES = 8;
const MISTAKE_DRILL_WORDS = 30;

interface Props {
  config: RunConfig;
  /** Produces the text for a new run. */
  build: () => Token[];
  /** Keeps a timed run supplied with text. */
  more?: (minWords: number) => Token[];
  /** Called once per saved result (not for invalid runs). */
  onResult?: (result: TestResult) => void;
  /** Extra content under the result numbers (e.g. lesson stars). */
  resultExtra?: (result: TestResult) => React.ReactNode;
}

interface Run {
  tokens: Token[];
  config: RunConfig;
  timed: boolean;
}

/**
 * One complete typing experience: live counters, the text, the hint line,
 * the on-screen keyboard and, when the run ends, the result screen.
 * Used by the test page, lessons and mistake practice alike.
 */
export function Runner({ config, build, more, onResult, resultExtra }: Props) {
  const t = useT();
  const strict = useSettings((s) => s.strict);
  const showKeyboard = useSettings((s) => s.showKeyboard);
  const showHints = useSettings((s) => s.showHints);
  const fontSize = useSettings((s) => s.fontSize);
  const showHands = useShowHands();

  const baseRun = useCallback(
    (): Run => ({ tokens: build(), config, timed: config.mode === 'time' && config.kind === 'test' }),
    [build, config],
  );
  const [run, setRun] = useState<Run>(baseRun);
  const [done, setDone] = useState<{ result: TestResult; invalid: boolean } | null>(null);

  // New settings (category, length…) mean a new text.
  const builtWith = useRef(baseRun);
  useEffect(() => {
    if (builtWith.current === baseRun) return;
    builtWith.current = baseRun;
    setRun(baseRun());
    setDone(null);
  }, [baseRun]);

  const onFinish = useCallback(
    (session: SessionState) => {
      const result = buildResult(session, { ...run.config, strict });
      const invalid = session.keyLog.length < MIN_KEYSTROKES;
      setDone({ result, invalid });
      if (invalid) return;
      useData.getState().record(result, session.keyLog);
      // A mistake drill started from the result screen is not the caller's run.
      if (run.config === config) onResult?.(result);
      void syncAfterRun();
    },
    [run.config, config, strict, onResult],
  );

  const restart = useCallback(() => {
    setRun(baseRun());
    setDone(null);
  }, [baseRun]);

  const repeat = useCallback(() => {
    setRun((r) => ({ ...r, tokens: r.tokens.slice() }));
    setDone(null);
  }, []);

  const { state, now, running, capsLock } = useTypingSession({
    tokens: run.tokens,
    strict,
    timeLimit: run.timed ? run.config.length : null,
    more: run.timed ? more : undefined,
    enabled: done === null,
    onFinish,
    onRestart: restart,
  });

  // Fade the chrome away while typing; bring it back on mouse movement.
  useEffect(() => {
    if (!running) return;
    document.body.dataset.typing = '1';
    const wake = () => delete document.body.dataset.typing;
    window.addEventListener('mousemove', wake, { once: true });
    return () => {
      window.removeEventListener('mousemove', wake);
      delete document.body.dataset.typing;
    };
  }, [running, state.index]);

  const practiceMistakes = useMemo(() => {
    if (!done || Object.keys(done.result.missedChars).length === 0) return null;
    return () => {
      const { missedChars, missedWords } = done.result;
      const tokens = mistakeDrill(missedChars, missedWords, tokenPool(), MISTAKE_DRILL_WORDS);
      if (tokens.length === 0) return;
      setRun({
        tokens,
        timed: false,
        config: { ...config, kind: 'practice', mode: 'words', length: tokens.length, lessonId: undefined },
      });
      setDone(null);
    };
  }, [done, config]);

  if (done) {
    return (
      <Results
        result={done.result}
        invalid={done.invalid}
        onNext={restart}
        onRepeat={repeat}
        onPracticeMistakes={practiceMistakes}
        extra={done.invalid ? null : resultExtra?.(done.result)}
      />
    );
  }

  const started = state.startedAt !== null;
  const live = liveWpm(state, now);
  const elapsed = started ? (now - state.startedAt!) / 1000 : 0;
  const counter = run.timed
    ? Math.max(0, Math.ceil(run.config.length - elapsed))
    : `${state.index}/${state.tokens.length}`;
  const hint = state.tokens[state.index]?.hint;
  const next = expectedChar(state);

  return (
    <section className="runner" style={{ '--fs': `${fontSize}px` } as React.CSSProperties}>
      <div className="live">
        <span className="counter accent">{counter}</span>
        {started && (
          <>
            <span className="live-stat">{Math.round(live.wpm)} wpm</span>
            <span className="live-stat">{Math.floor(accuracy(state))}%</span>
          </>
        )}
        {run.config.kind === 'practice' && <span className="tag warn">{t('run.practiceTag')}</span>}
        {strict && <span className="tag">{t('opt.strict')}</span>}
        {capsLock && <span className="tag warn">{t('run.capsLock')}</span>}
      </div>

      <TypingArea state={state} idle={!started} />

      {showHints && (
        <div className="hint" aria-live="off">
          {hint ? (
            <>
              <code>{hint.label}</code>
              <span>{hint.desc}</span>
            </>
          ) : (
            <span className="muted">{started ? ' ' : t('run.start')}</span>
          )}
        </div>
      )}

      {showKeyboard && <Keyboard next={next} hands={showHands} />}

      <div className="shortcuts">
        <span>
          <kbd>tab</kbd> {t('run.restart')}
        </span>
        <span>
          <kbd>ctrl</kbd>+<kbd>⌫</kbd> {t('run.deleteWord')}
        </span>
        <span>
          <kbd>↵</kbd> {t('run.enterHelp')}
        </span>
      </div>
    </section>
  );
}
