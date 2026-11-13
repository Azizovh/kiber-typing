import { useCallback, useMemo } from 'react';
import { Runner } from '../components/Runner';
import { createGenerator, takeWords } from '../content/generate';
import { COMMAND_TOPICS } from '../content/library';
import type { Category, RunConfig } from '../engine/types';
import { useT, type MessageKey } from '../i18n';
import { DURATIONS, WORD_COUNTS, useSettings } from '../store/settings';

const CATEGORIES: { id: Category; label: MessageKey; glyph: string }[] = [
  { id: 'symbols', label: 'cat.symbols', glyph: '~/' },
  { id: 'commands', label: 'cat.commands', glyph: '$_' },
  { id: 'terms', label: 'cat.terms', glyph: 'Aa' },
  { id: 'mixed', label: 'cat.mixed', glyph: '⁂' },
];

function ModeBar() {
  const t = useT();
  const s = useSettings();
  const lengths = s.mode === 'time' ? DURATIONS : WORD_COUNTS;
  const length = s.mode === 'time' ? s.duration : s.wordCount;

  return (
    <div className="modebar">
      <div className="seg">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            className={s.category === c.id ? 'on' : ''}
            onClick={() => s.set({ category: c.id })}
          >
            <span className="glyph">{c.glyph}</span> {t(c.label)}
          </button>
        ))}
      </div>

      {s.category === 'commands' && (
        <div className="seg">
          <select
            value={s.topic ?? ''}
            onChange={(e) => {
              s.set({ topic: e.target.value || null });
              // Give the keyboard back to the typing area.
              e.target.blur();
            }}
            aria-label={t('opt.topic')}
          >
            <option value="">{t('opt.allTopics')}</option>
            {COMMAND_TOPICS.map((topic) => (
              <option key={topic.id} value={topic.id}>
                {t.opt(`topic.cmd.${topic.id}`, topic.title)}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="seg">
        <button className={s.mode === 'time' ? 'on' : ''} onClick={() => s.set({ mode: 'time' })}>
          {t('mode.time')}
        </button>
        <button className={s.mode === 'words' ? 'on' : ''} onClick={() => s.set({ mode: 'words' })}>
          {t('mode.words')}
        </button>
      </div>

      <div className="seg">
        {lengths.map((n) => (
          <button
            key={n}
            className={length === n ? 'on' : ''}
            onClick={() => s.set(s.mode === 'time' ? { duration: n } : { wordCount: n })}
          >
            {n}
          </button>
        ))}
      </div>

      <div className="seg">
        <button
          className={s.strict ? 'on' : ''}
          onClick={() => s.set({ strict: !s.strict })}
          title={t('opt.strictHelp')}
        >
          {t('opt.strict')}
        </button>
        <button
          className={s.showKeyboard ? 'on' : ''}
          onClick={() => s.set({ showKeyboard: !s.showKeyboard })}
        >
          {t('opt.keyboard')}
        </button>
        <button className={s.showHints ? 'on' : ''} onClick={() => s.set({ showHints: !s.showHints })}>
          {t('opt.hints')}
        </button>
      </div>
    </div>
  );
}

export function TypePage() {
  const category = useSettings((s) => s.category);
  const topicSetting = useSettings((s) => s.topic);
  const mode = useSettings((s) => s.mode);
  const duration = useSettings((s) => s.duration);
  const wordCount = useSettings((s) => s.wordCount);

  const topic = category === 'commands' ? topicSetting : null;
  const length = mode === 'time' ? duration : wordCount;

  const config = useMemo<RunConfig>(
    () => ({ kind: 'test', category, mode, length, topic, strict: false }),
    [category, mode, length, topic],
  );
  const generate = useMemo(() => createGenerator({ category, topic }), [category, topic]);
  const build = useCallback(
    () => (mode === 'time' ? generate(60) : takeWords(generate, length)),
    [generate, mode, length],
  );

  return (
    <div className="page type-page">
      <ModeBar />
      <Runner config={config} build={build} more={generate} />
    </div>
  );
}
