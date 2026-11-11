import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Chart } from '../components/Chart';
import type { TestResult } from '../engine/types';
import { useT } from '../i18n';
import { useData } from '../store/data';
import { DURATIONS } from '../store/settings';

const avg = (xs: number[]) => (xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length);

function formatDuration(ms: number): string {
  const minutes = Math.round(ms / 60000);
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}

function describe(r: TestResult): string {
  if (r.config.kind === 'lesson') return `lesson · ${r.config.lessonId ?? ''}`;
  if (r.config.kind === 'practice') return 'mistake drill';
  const topic = r.config.topic ? ` (${r.config.topic})` : '';
  return `${r.config.category}${topic} · ${r.config.mode} ${r.config.length}`;
}

export function StatsPage() {
  const t = useT();
  const results = useData((s) => s.results);

  const summary = useMemo(() => {
    const tests = results.filter((r) => r.config.kind === 'test');
    const recent = results.slice(0, 10);
    return {
      runs: results.length,
      time: results.reduce((a, r) => a + r.durationMs, 0),
      best: Math.max(0, ...tests.map((r) => r.wpm)),
      avgWpm: avg(recent.map((r) => r.wpm)),
      avgAcc: avg(recent.map((r) => r.accuracy)),
      bests: DURATIONS.map((d) => ({
        length: d,
        wpm: Math.max(
          0,
          ...tests.filter((r) => r.config.mode === 'time' && r.config.length === d).map((r) => r.wpm),
        ),
      })),
    };
  }, [results]);

  // Oldest first, so the line reads left to right as progress.
  const trend = useMemo(() => results.slice(0, 60).reverse(), [results]);

  if (results.length === 0) {
    return (
      <div className="page">
        <header className="page-head">
          <h1>{t('stats.title')}</h1>
        </header>
        <div className="empty">
          <p>{t('stats.empty')}</p>
          <Link to="/" className="btn primary">
            {t('practice.goType')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="page-head">
        <h1>{t('stats.title')}</h1>
      </header>

      <div className="tiles">
        <div className="tile">
          <span className="label">{t('stats.best')}</span>
          <span className="value accent">{Math.round(summary.best)}</span>
        </div>
        <div className="tile">
          <span className="label">{t('stats.avgWpm')}</span>
          <span className="value">{Math.round(summary.avgWpm)}</span>
        </div>
        <div className="tile">
          <span className="label">{t('stats.avgAcc')}</span>
          <span className="value">{summary.avgAcc.toFixed(1)}%</span>
        </div>
        <div className="tile">
          <span className="label">{t('stats.runs')}</span>
          <span className="value">{summary.runs}</span>
        </div>
        <div className="tile">
          <span className="label">{t('stats.time')}</span>
          <span className="value">{formatDuration(summary.time)}</span>
        </div>
      </div>

      <section>
        <h2>{t('stats.bests')}</h2>
        <div className="tiles small">
          {summary.bests.map((b) => (
            <div className="tile" key={b.length}>
              <span className="label">{b.length}s</span>
              <span className="value">{b.wpm > 0 ? Math.round(b.wpm) : '—'}</span>
            </div>
          ))}
        </div>
      </section>

      {trend.length >= 2 && (
        <section>
          <h2>{t('stats.trend')}</h2>
          <Chart
            xs={trend.map((_, i) => i + 1)}
            series={[
              { values: trend.map((r) => r.accuracy), className: 'raw' },
              { values: trend.map((r) => r.wpm), className: 'wpm', area: true },
            ]}
            xLabel={t('stats.runs')}
            yLabel={t('res.wpm')}
          />
          <p className="legend">
            <span className="swatch wpm" /> {t('res.wpm')} <span className="swatch raw" /> {t('res.acc')}
          </p>
        </section>
      )}

      <section>
        <h2>{t('stats.history')}</h2>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{t('res.wpm')}</th>
                <th>{t('res.acc')}</th>
                <th>{t('res.raw')}</th>
                <th>{t('res.consistency')}</th>
                <th>{t('res.mode')}</th>
                <th>{t('stats.date')}</th>
              </tr>
            </thead>
            <tbody>
              {results.slice(0, 40).map((r) => (
                <tr key={r.id}>
                  <td className="accent">{r.wpm.toFixed(1)}</td>
                  <td>{r.accuracy.toFixed(1)}%</td>
                  <td>{r.raw.toFixed(1)}</td>
                  <td>{Math.round(r.consistency)}%</td>
                  <td>{describe(r)}</td>
                  <td className="muted">{new Date(r.at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
