import { useState, type FormEvent } from 'react';
import { useT } from '../i18n';
import { signIn, signOut, signUp } from '../services/sync';
import { useAuth } from '../store/auth';
import { useData } from '../store/data';

const USERNAME = /^[A-Za-z0-9_-]{3,20}$/;

function AuthForm() {
  const t = useT();
  const [tab, setTab] = useState<'in' | 'up'>('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (tab === 'up' && !USERNAME.test(username)) {
      setError(t('account.usernameRule'));
      return;
    }
    if (password.length < 8) {
      setError(t('account.passwordRule'));
      return;
    }
    setBusy(true);
    try {
      if (tab === 'in') {
        await signIn(email.trim(), password);
      } else {
        const { needsConfirmation } = await signUp(email.trim(), password, username);
        if (needsConfirmation) {
          setInfo(t('account.confirm'));
          // The next thing to do here is sign in, so show that form.
          setTab('in');
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="auth-form" onSubmit={submit}>
      <div className="seg">
        <button type="button" className={tab === 'in' ? 'on' : ''} onClick={() => setTab('in')}>
          {t('account.signIn')}
        </button>
        <button type="button" className={tab === 'up' ? 'on' : ''} onClick={() => setTab('up')}>
          {t('account.signUp')}
        </button>
      </div>

      {tab === 'up' && (
        <label>
          {t('account.username')}
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            maxLength={20}
            required
          />
        </label>
      )}
      <label>
        {t('account.email')}
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
        />
      </label>
      <label>
        {t('account.password')}
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete={tab === 'in' ? 'current-password' : 'new-password'}
          required
        />
      </label>

      {error && <p className="notice warn">{error}</p>}
      {info && <p className="notice">{info}</p>}

      <button className="btn primary" disabled={busy}>
        {busy ? '…' : tab === 'in' ? t('account.signIn') : t('account.create')}
      </button>
      <p className="muted small">{t('account.guestKept')}</p>
    </form>
  );
}

export function AccountPage() {
  const t = useT();
  const { status, user, syncError } = useAuth();
  const results = useData((s) => s.results);
  const pending = results.filter((r) => !r.synced).length;

  return (
    <div className="page narrow">
      <header className="page-head">
        <h1>{t('account.title')}</h1>
      </header>

      {status === 'disabled' && (
        <div className="notice">
          <h3>{t('account.disabledTitle')}</h3>
          <p>{t('account.disabledBody')}</p>
          <ol className="steps">
            <li>{t('account.step1')}</li>
            <li>
              {t('account.step2')} <code>supabase/schema.sql</code>
            </li>
            <li>
              {t('account.step3')} <code>.env.local</code>:
              <pre>{'VITE_SUPABASE_URL=...\nVITE_SUPABASE_ANON_KEY=...'}</pre>
            </li>
            <li>{t('account.step4')}</li>
          </ol>
        </div>
      )}

      {status === 'loading' && <p className="muted">{t('board.loading')}</p>}

      {status === 'guest' && <AuthForm />}

      {status === 'user' && user && (
        <div className="account-card">
          <div className="avatar">{user.username.slice(0, 1).toUpperCase()}</div>
          <div>
            <h2>{user.username}</h2>
            <p className="muted">{user.email}</p>
          </div>
          <dl>
            <dt>{t('stats.runs')}</dt>
            <dd>{results.length}</dd>
            <dt>{t('account.sync')}</dt>
            <dd className={syncError ? 'bad' : ''}>
              {syncError ?? (pending > 0 ? t('account.pending', { n: pending }) : t('account.synced'))}
            </dd>
          </dl>
          <button className="btn" onClick={() => void signOut()}>
            {t('account.signOut')}
          </button>
          <p className="muted small">{t('account.signOutHelp')}</p>
        </div>
      )}
    </div>
  );
}
