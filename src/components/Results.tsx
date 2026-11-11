import type { TestResult } from '../engine/types';
import { charLabel } from '../keyboard/layout';
import { useT } from '../i18n';
import { Chart } from './Chart';

interface Props {
  result: TestResult;
  /** Shown instead of saving when the run was too short to mean anything. */
  invalid: boolean;
  onNext: () => void;
  onRepeat: () => void;
  onPracticeMistakes: (() => void) | null;
  extra?: React.ReactNode;
}

export function Results({ result, invalid, onNext, onRepeat, onPracticeMistakes, extra }: Props) {
  const t = useT();
  const samples = result.samples ?? [];
  const missed = Object.entries(result.missedChars).sort((a, b) => b[1] - a[1]);
  const { chars } = result;

  return (
    <section className="results">
      <div className="results-top">
        <div className="big-stat">
          <span className="label">{t('res.wpm')}</span>
          <span className="value accent">{Math.round(result.wpm)}</span>
        </div>
        <div className="big-stat">
          <span className="label">{t('res.acc')}</span>
          <span className="value accent">{Math.floor(result.accuracy)}%</span>
        </div>
        <div className="result-chart">
          {samples.length >= 2 ? (
            <Chart
              xs={samples.map((s) => s.t)}
              series={[
                { values: samples.map((s) => s.raw), className: 'raw' },
                { values: samples.map((s) => s.wpm), className: 'wpm', area: true },
              ]}
              marks={samples.filter((s) => s.errors > 0).map((s) => ({ x: s.t, n: s.errors }))}
              xLabel={t('res.seconds')}
              yLabel={t('res.wpm')}
            />
          ) : (
            <p className="muted center">{t('res.tooShortChart')}</p>
          )}
        </div>
      </div>

      <div className="stat-row">
        <div className="stat">
          <span className="label">{t('res.raw')}</span>
          <span className="value">{Math.round(result.raw)}</span>
        </div>
        <div className="stat" title={t('res.charsHelp')}>
          <span className="label">{t('res.chars')}</span>
          <span className="value">
            {chars.correct}/<span className="bad">{chars.incorrect}</span>/{chars.extra}/{chars.missed}
          </span>
        </div>
        <div className="stat">
          <span className="label">{t('res.consistency')}</span>
          <span className="value">{Math.round(result.consistency)}%</span>
        </div>
        <div className="stat">
          <span className="label">{t('res.time')}</span>
          <span className="value">{Math.round(result.durationMs / 1000)}s</span>
        </div>
        <div className="stat">
          <span className="label">{t('res.mode')}</span>
          <span className="value small">
            {result.config.kind === 'test'
              ? `${result.config.category} · ${result.config.mode} ${result.config.length}`
              : result.config.kind}
            {result.config.strict ? ` · ${t('opt.strict')}` : ''}
          </span>
        </div>
      </div>

      {invalid && <p className="notice warn">{t('res.invalid')}</p>}
      {extra}

      <div className="mistakes">
        <h3>{t('res.mistakes')}</h3>
        {missed.length === 0 ? (
          <p className="muted">{t('res.noMistakes')}</p>
        ) : (
          <>
            <div className="chips">
              {missed.slice(0, 14).map(([ch, n]) => (
                <span className="chip key-chip" key={ch}>
                  <kbd>{charLabel(ch)}</kbd>
                  <span className="count">×{n}</span>
                </span>
              ))}
            </div>
            {result.missedWords.length > 0 && (
              <div className="chips words">
                {result.missedWords.slice(0, 16).map((w) => (
                  <span className="chip" key={w}>
                    {w}
                  </span>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <div className="actions">
        <button className="btn primary" onClick={onNext}>
          {t('res.next')} <kbd>tab</kbd>
        </button>
        <button className="btn" onClick={onRepeat}>
          {t('res.repeat')}
        </button>
        {onPracticeMistakes && (
          <button className="btn warn" onClick={onPracticeMistakes}>
            {t('res.practice')}
          </button>
        )}
      </div>
    </section>
  );
}
