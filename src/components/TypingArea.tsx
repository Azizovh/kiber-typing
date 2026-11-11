import { Fragment, memo, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { SessionState } from '../engine/types';

type Status = 'done' | 'active' | 'pending';

interface WordProps {
  text: string;
  /** undefined for words not reached yet, so they never re-render. */
  input: string | undefined;
  status: Status;
  eol: boolean;
}

const Word = memo(function Word({ text, input, status, eol }: WordProps) {
  const typed = input ?? '';
  const chars = [];
  for (let i = 0; i < text.length; i++) {
    const cls = i >= typed.length ? 'ch' : typed[i] === text[i] ? 'ch ok' : 'ch bad';
    chars.push(
      <span key={i} className={cls}>
        {text[i]}
      </span>,
    );
  }
  for (let i = text.length; i < typed.length; i++) {
    chars.push(
      <span key={i} className="ch extra">
        {typed[i]}
      </span>,
    );
  }
  const wrong = status === 'done' && typed !== text;
  return (
    <span className={`word ${status}${wrong ? ' wrong' : ''}`}>
      {chars}
      {eol && <span className="eol">↵</span>}
    </span>
  );
});

interface Props {
  state: SessionState;
  /** Dim the text and show a hint when the run has not started. */
  idle: boolean;
}

/** The text being typed: three visible lines that scroll with the caret. */
export function TypingArea({ state, idle }: Props) {
  const wordsRef = useRef<HTMLDivElement>(null);
  const [caret, setCaret] = useState({ x: 0, y: 0 });
  const [scroll, setScroll] = useState(0);
  const [resized, setResized] = useState(0);
  const input = state.inputs[state.index] ?? '';

  useEffect(() => {
    const onResize = () => setResized((n) => n + 1);
    window.addEventListener('resize', onResize);
    // Web fonts change glyph widths after first paint.
    void document.fonts?.ready.then(onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useLayoutEffect(() => {
    const root = wordsRef.current;
    const active = root?.querySelector<HTMLElement>('.word.active');
    if (!root || !active) return;
    const letters = active.querySelectorAll<HTMLElement>('.ch');
    let x = active.offsetLeft;
    if (letters.length > 0) {
      if (input.length < letters.length) {
        x += letters[input.length].offsetLeft;
      } else {
        const last = letters[letters.length - 1];
        x += last.offsetLeft + last.offsetWidth;
      }
    }
    const line = active.offsetHeight;
    setCaret({ x, y: active.offsetTop });
    // Keep the active line as the second visible line.
    setScroll(Math.max(0, active.offsetTop - line));
  }, [state.index, input, state.tokens, resized]);

  return (
    <div className={`words-viewport${idle ? ' idle' : ''}`}>
      <div className="words" ref={wordsRef} style={{ transform: `translateY(${-scroll}px)` }}>
        <div
          className={`caret${idle ? ' blink' : ''}`}
          style={{ transform: `translate(${caret.x}px, ${caret.y}px)` }}
        />
        {state.tokens.map((token, i) => {
          const status: Status = i < state.index ? 'done' : i === state.index ? 'active' : 'pending';
          const prev = state.tokens[i - 1];
          return (
            <Fragment key={i}>
              {token.bol && prev && !prev.eol && <span className="brk" />}
              {token.bol && <span className="prompt">$</span>}
              <Word
                text={token.text}
                input={i <= state.index ? (state.inputs[i] ?? '') : undefined}
                status={status}
                eol={!!token.eol}
              />
              {token.eol && <span className="brk" />}
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}
