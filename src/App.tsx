import { useEffect } from 'react';
import { HashRouter, Navigate, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { LANGUAGES, useT, type MessageKey } from './i18n';
import { WelcomePage } from './pages/WelcomePage';
import { useOnboarding } from './store/onboarding';
import { AccountPage } from './pages/AccountPage';
import { LeaderboardPage } from './pages/LeaderboardPage';
import { LessonPage, LessonsPage } from './pages/LessonsPage';
import { PracticePage } from './pages/PracticePage';
import { SettingsPage } from './pages/SettingsPage';
import { StatsPage } from './pages/StatsPage';
import { TypePage } from './pages/TypePage';
import { initAuth } from './services/sync';
import { useAuth } from './store/auth';
import { useSettings } from './store/settings';

/** Shown during placement, where the settings page is not reachable yet. */
function LanguagePicker() {
  const lang = useSettings((s) => s.lang);
  const set = useSettings((s) => s.set);
  return (
    <div className="seg">
      {LANGUAGES.map((l) => (
        <button key={l.id} className={lang === l.id ? 'on' : ''} onClick={() => set({ lang: l.id })}>
          {l.id}
        </button>
      ))}
    </div>
  );
}

const NAV: { to: string; label: MessageKey }[] = [
  { to: '/', label: 'nav.type' },
  { to: '/lessons', label: 'nav.lessons' },
  { to: '/practice', label: 'nav.practice' },
  { to: '/stats', label: 'nav.stats' },
  { to: '/leaderboard', label: 'nav.leaderboard' },
  { to: '/settings', label: 'nav.settings' },
];

/** First visit: everyone goes through placement before anything else. */
function OnboardingGate() {
  const status = useOnboarding((s) => s.status);
  const { pathname } = useLocation();
  if (status === 'pending' && pathname !== '/welcome' && pathname !== '/account') {
    return <Navigate to="/welcome" replace />;
  }
  return null;
}

function Header() {
  const t = useT();
  const user = useAuth((s) => s.user);
  const placing = useOnboarding((s) => s.status === 'pending');
  if (placing) {
    return (
      <header className="site-header chrome">
        <span className="logo">
          <span className="logo-mark">❯_</span>
          <span>
            kiber<b>typing</b>
          </span>
        </span>
        <nav />
        <LanguagePicker />
        <NavLink to="/account" className="account-link">
          {user ? user.username : t('nav.account')}
        </NavLink>
      </header>
    );
  }
  return (
    <header className="site-header chrome">
      <NavLink to="/" className="logo">
        <span className="logo-mark">❯_</span>
        <span>
          kiber<b>typing</b>
        </span>
      </NavLink>
      <nav>
        {NAV.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.to === '/'}>
            {t(item.label)}
          </NavLink>
        ))}
      </nav>
      <NavLink to="/account" className="account-link">
        {user ? user.username : t('nav.account')}
      </NavLink>
    </header>
  );
}

export function App() {
  const t = useT();
  const theme = useSettings((s) => s.theme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const lang = useSettings((s) => s.lang);
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  useEffect(() => {
    initAuth();
  }, []);

  return (
    <HashRouter>
      <div className="app">
        <Header />
        <OnboardingGate />
        <main>
          <Routes>
            <Route path="/" element={<TypePage />} />
            <Route path="/welcome" element={<WelcomePage />} />
            <Route path="/lessons" element={<LessonsPage />} />
            <Route path="/lessons/:id" element={<LessonPage />} />
            <Route path="/practice" element={<PracticePage />} />
            <Route path="/stats" element={<StatsPage />} />
            <Route path="/leaderboard" element={<LeaderboardPage />} />
            <Route path="/account" element={<AccountPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<TypePage />} />
          </Routes>
        </main>
        <footer className="site-footer chrome">
          <span>{t('footer.tagline')}</span>
          <a href="https://github.com/Azizovh/kiber-typing" target="_blank" rel="noreferrer">
            github
          </a>
        </footer>
      </div>
    </HashRouter>
  );
}
