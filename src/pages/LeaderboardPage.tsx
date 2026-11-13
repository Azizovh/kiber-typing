import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Category, LengthMode } from '../engine/types';
import { useT, type MessageKey } from '../i18n';
import { cloudEnabled } from '../services/supabase';
import { fetchLeaderboard, type LeaderboardRow } from '../services/sync';
import { useAuth } from '../store/auth';
import { useData } from '../store/data';
import { DURATIONS, WORD_COUNTS, useSettings } from '../store/settings';

const CATEGORIES: { id: Category; label: MessageKey }[] = [
  { id: 'mixed', label: 'cat.mixed' },
  { id: 'commands', label: 'cat.commands' },
  { id: 'symbols', label: 'cat.symbols' },
  { id: 'terms', label: 'cat.terms' },
];

type Load =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; rows: LeaderboardRow[] };

export function LeaderboardPage() {
  const t = useT();
  const me = useAuth((s) => s.user);
  const results = useData((s) => s.results);
  // Open on the board for the test the person actually plays, not a fixed one —
  // otherwise their own results look like they were never saved.
  const settings = useSettings.getState();
  const [category, setCategory] = useState<Category>(settings.category);
  const [mode, setMode] = useState<LengthMode>(settings.mode);
  const [length, setLength] = useState<number>(
    settings.mode === 'time' ? settings.duration : settings.wordCount,
  );
  const [load, setLoad] = useState<Load>({ status: 'loading' });

  const lengths = mode === 'time' ? DURATIONS : WORD_COUNTS;

  useEffect(() => {
    if (!cloudEnabled) return;
    let cancelled = false;
    setLoad({ status: 'loading' });
    fetchLeaderboard(category, mode, length)
      .then((rows) => !cancelled && setLoad({ status: 'ready', rows }))
      .catch((e: Error) => !cancelled && setLoad({ status: 'error', message: e.message }));
    return () => {
      cancelled = true;
    };
  }, [category, mode, length]);

  // Your own best for the selected board, from this browser's history.
  const myBest = results
    .filter(
      (r) =>
        r.config.kind === 'test' &&
        r.config.topic === null &&
        r.config.category === category &&
        r.config.mode === mode &&
        r.config.length === length,
    )
    .sort((a, b) => b.wpm - a.wpm)[0];

  return (
    <div className="page">
      <header className="page-head">
        <h1>{t('board.title')}</h1>
        <p className="muted">{t('board.subtitle')}</p>
      </header>

      <div className="modebar left">
        <div className="seg">
          {CATEGORIES.map((c) => (
            <button key={c.id} className={category === c.id ? 'on' : ''} onClick={() => setCategory(c.id)}>
              {t(c.label)}
            </button>
          ))}
        </div>
        <div className="seg">
          {(['time', 'words'] as const).map((m) => (
            <button
              key={m}
              className={mode === m ? 'on' : ''}
              onClick={() => {
                setMode(m);
                setLength(m === 'time' ? settings.duration : settings.wordCount);
              }}
            >
              {t(m === 'time' ? 'mode.time' : 'mode.words')}
            </button>
          ))}
        </div>
        <div className="seg">
          {lengths.map((n) => (
            <button key={n} className={length === n ? 'on' : ''} onClick={() => setLength(n)}>
              {n}
            </button>
          ))}
        </div>
      </div>

      <div className="tiles small">
        <div className="tile">
          <span className="label">{t('board.yourBest')}</span>
          <span className="value accent">{myBest ? myBest.wpm.toFixed(1) : '—'}</span>
        </div>
      </div>

      {!cloudEnabled ? (
        <div className="notice">
          <p>{t('board.disabled')}</p>
          <Link to="/account" className="btn">
            {t('board.howTo')}
          </Link>
        </div>
      ) : load.status === 'loading' ? (
        <p className="muted">{t('board.loading')}</p>
      ) : load.status === 'error' ? (
        <p className="notice warn">
          {t('board.error')} {load.message}
        </p>
      ) : load.rows.length === 0 ? (
        <p className="muted">{t('board.empty')}</p>
      ) : (
        <div className="table-wrap">
          <table className="table board">
            <thead>
              <tr>
                <th>#</th>
                <th>{t('board.user')}</th>
                <th>{t('res.wpm')}</th>
                <th>{t('res.acc')}</th>
                <th>{t('res.raw')}</th>
                <th>{t('res.consistency')}</th>
                <th>{t('stats.date')}</th>
              </tr>
            </thead>
            <tbody>
              {load.rows.map((row, i) => (
                <tr key={row.user_id} className={row.user_id === me?.id ? 'me' : ''}>
                  <td className="muted">{i + 1}</td>
                  <td>{row.username}</td>
                  <td className="accent">{Number(row.wpm).toFixed(1)}</td>
                  <td>{Number(row.accuracy).toFixed(1)}%</td>
                  <td>{Number(row.raw).toFixed(1)}</td>
                  <td>{Math.round(Number(row.consistency))}%</td>
                  <td className="muted">{new Date(row.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
