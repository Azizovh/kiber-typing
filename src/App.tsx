import { useEffect } from 'react';
import { HashRouter, NavLink, Route, Routes } from 'react-router-dom';
import { useT, type MessageKey } from './i18n';
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

const NAV: { to: string; label: MessageKey }[] = [
  { to: '/', label: 'nav.type' },
  { to: '/lessons', label: 'nav.lessons' },
  { to: '/practice', label: 'nav.practice' },
  { to: '/stats', label: 'nav.stats' },
  { to: '/leaderboard', label: 'nav.leaderboard' },
  { to: '/settings', label: 'nav.settings' },
];

function Header() {
  const t = useT();
  const user = useAuth((s) => s.user);
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

  useEffect(() => {
    initAuth();
  }, []);

  return (
    <HashRouter>
      <div className="app">
        <Header />
        <main>
          <Routes>
            <Route path="/" element={<TypePage />} />
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
