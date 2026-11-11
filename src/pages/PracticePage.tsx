import { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Keyboard } from '../components/Keyboard';
import { Runner } from '../components/Runner';
import { tokenPool } from '../content/library';
import { keyTable, missedWords, profileDrill, weakKeys } from '../engine/profile';
import type { RunConfig } from '../engine/types';
import { useT } from '../i18n';
import { charLabel, keyFor } from '../keyboard/layout';
import { useData } from '../store/data';

const DRILL_WORDS = 40;

const CONFIG: RunConfig = {
  kind: 'practice',
  category: 'mixed',
  mode: 'words',
  length: DRILL_WORDS,
  topic: null,
  strict: false,
};

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

/** Stamina-style "work on mistakes": shows what goes wrong and drills exactly that. */
export function PracticePage() {
  const t = useT();
  const profile = useData((s) => s.profile);
  const [drilling, setDrilling] = useState(false);

  const table = useMemo(() => keyTable(profile), [profile]);
  const weak = useMemo(() => weakKeys(profile), [profile]);
  const words = useMemo(() => missedWords(profile), [profile]);

  // Per physical key: worst error rate of the characters it produces.
  const { heat, titles } = useMemo(() => {
    const heat: Record<string, number> = {};
    const titles: Record<string, string> = {};
    const worst = Math.max(0.05, ...table.map((k) => k.errorRate));
    for (const k of table) {
      const code = keyFor(k.char)?.key.code;
      if (!code) continue;
      heat[code] = Math.max(heat[code] ?? 0, k.errorRate / worst);
      const line = `${charLabel(k.char)}: ${pct(k.errorRate)} (${k.samples})`;
      titles[code] = titles[code] ? `${titles[code]}\n${line}` : line;
    }
    return { heat, titles };
  }, [table]);

  const build = useCallback(
    () => profileDrill(useData.getState().profile, tokenPool(), DRILL_WORDS),
    [],
  );

  if (drilling) {
    return (
      <div className="page type-page">
        <header className="lesson-head">
          <button className="back" onClick={() => setDrilling(false)}>
            ← {t('practice.title')}
          </button>
          <h1>{t('practice.drillTitle')}</h1>
          <p className="muted">{t('practice.drillDesc')}</p>
        </header>
        <Runner config={CONFIG} build={build} />
      </div>
    );
  }

  const hasData = table.length > 0;
  const canDrill = weak.length > 0 || words.length > 0;

  return (
    <div className="page">
      <header className="page-head">
        <h1>{t('practice.title')}</h1>
        <p className="muted">{t('practice.subtitle')}</p>
      </header>

      {!hasData ? (
        <div className="empty">
          <p>{t('practice.empty')}</p>
          <Link to="/" className="btn primary">
            {t('practice.goType')}
          </Link>
        </div>
      ) : (
        <>
          <div className="practice-cta">
            <button className="btn primary big" disabled={!canDrill} onClick={() => setDrilling(true)}>
              {t('practice.start')}
            </button>
            <p className="muted small">{canDrill ? t('practice.startHelp') : t('practice.clean')}</p>
          </div>

          <section>
            <h2>{t('practice.heatmap')}</h2>
            <p className="muted small">{t('practice.heatmapHelp')}</p>
            <Keyboard heat={heat} titles={titles} />
          </section>

          <div className="two-col">
            <section>
              <h2>{t('practice.weakKeys')}</h2>
              {weak.length === 0 ? (
                <p className="muted">{t('practice.noWeak')}</p>
              ) : (
                <table className="table">
                  <thead>
                    <tr>
                      <th>{t('practice.key')}</th>
                      <th>{t('practice.errorRate')}</th>
                      <th>{t('practice.speed')}</th>
                      <th>{t('practice.instead')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {weak.map((k) => (
                      <tr key={k.char}>
                        <td>
                          <kbd>{charLabel(k.char)}</kbd>
                        </td>
                        <td className={k.errorRate > 0.1 ? 'bad' : ''}>{pct(k.errorRate)}</td>
                        <td>{k.avgMs === null ? '—' : `${Math.round(k.avgMs)} ms`}</td>
                        <td>
                          {k.typedInstead.length === 0
                            ? '—'
                            : k.typedInstead.map((c) => <kbd key={c}>{charLabel(c)}</kbd>)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>

            <section>
              <h2>{t('practice.missedWords')}</h2>
              {words.length === 0 ? (
                <p className="muted">{t('practice.noWords')}</p>
              ) : (
                <div className="chips words">
                  {words.map(({ word, count }) => (
                    <span className="chip" key={word}>
                      {word} <span className="count">×{count}</span>
                    </span>
                  ))}
                </div>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
