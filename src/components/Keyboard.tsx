import { memo } from 'react';
import { FINGER_NAMES, ROWS, charLabel, keyFor, type KeyDef } from '../keyboard/layout';
import { useT } from '../i18n';

interface Props {
  /**
   * Character to press next. `null` means "fix your mistake first" and
   * lights up Backspace; `undefined` shows the keyboard with nothing lit.
   */
  next?: string | null;
  /** key code -> 0..1 intensity, for the error heatmap. */
  heat?: Record<string, number>;
  /** key code -> tooltip text. */
  titles?: Record<string, string>;
}

/** On-screen US keyboard: shows which key — and which finger — comes next. */
export const Keyboard = memo(function Keyboard({ next, heat, titles }: Props) {
  const t = useT();
  const target = typeof next === 'string' ? keyFor(next) : undefined;
  const litCode = next === null ? 'Backspace' : target?.key.code;
  const shiftCode = target?.shift ?? null;
  const litFinger = next === null ? 'r-pinky' : target?.key.finger;

  const renderKey = (key: KeyDef) => {
    const lit = key.code === litCode;
    const shiftLit = key.code === shiftCode;
    const intensity = heat?.[key.code];
    const style: React.CSSProperties = { flexGrow: key.w ?? 1, flexBasis: `${(key.w ?? 1) * 2.6}em` };
    if (intensity !== undefined && intensity > 0) {
      style.background = `color-mix(in srgb, var(--error) ${Math.round(intensity * 85)}%, var(--key))`;
      style.color = intensity > 0.45 ? 'var(--bg)' : undefined;
    }
    const cls = [
      'key',
      `f-${key.finger}`,
      lit && 'lit',
      shiftLit && 'lit shift-lit',
      key.home && 'home',
      !key.base && 'mod',
    ]
      .filter(Boolean)
      .join(' ');
    return (
      <div key={key.code} className={cls} style={style} title={titles?.[key.code]}>
        {key.base ? (
          <>
            <span className="key-shift">{key.shift.toLowerCase() === key.base ? '' : key.shift}</span>
            <span className="key-base">{key.base}</span>
          </>
        ) : (
          <span className="key-label">{key.label}</span>
        )}
      </div>
    );
  };

  return (
    <div className={`keyboard${heat ? ' heat' : ''}`} aria-hidden="true">
      {ROWS.map((row, i) => (
        <div className={row.length === 1 ? 'key-row space-row' : 'key-row'} key={i}>
          {row.map(renderKey)}
        </div>
      ))}
      {!heat && (
        <div className="finger-hint">
          {litFinger ? (
            <>
              <span className={`finger-dot f-${litFinger}`} />
              {next === null
                ? t('kb.fix')
                : t('kb.press', {
                    key: charLabel(next as string),
                    finger: FINGER_NAMES[litFinger],
                  })}
              {shiftCode &&
                ` + ${shiftCode === 'ShiftLeft' ? t('kb.leftShift') : t('kb.rightShift')}`}
            </>
          ) : (
            <span className="muted">{t('kb.idle')}</span>
          )}
        </div>
      )}
    </div>
  );
});
