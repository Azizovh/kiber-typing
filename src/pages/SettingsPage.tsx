import { useState } from 'react';
import { useT } from '../i18n';
import { useAuth } from '../store/auth';
import { useData } from '../store/data';
import { FONT_SIZES, THEMES, useSettings } from '../store/settings';

function Toggle({
  label,
  help,
  value,
  onChange,
}: {
  label: string;
  help: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="setting">
      <div>
        <h3>{label}</h3>
        <p className="muted small">{help}</p>
      </div>
      <div className="seg">
        <button className={value ? 'on' : ''} onClick={() => onChange(true)}>
          on
        </button>
        <button className={!value ? 'on' : ''} onClick={() => onChange(false)}>
          off
        </button>
      </div>
    </div>
  );
}

export function SettingsPage() {
  const t = useT();
  const s = useSettings();
  const signedIn = useAuth((a) => a.status === 'user');
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="page narrow">
      <header className="page-head">
        <h1>{t('settings.title')}</h1>
      </header>

      <div className="setting">
        <div>
          <h3>{t('settings.theme')}</h3>
          <p className="muted small">{t('settings.themeHelp')}</p>
        </div>
        <div className="seg wrap">
          {THEMES.map((theme) => (
            <button key={theme} className={s.theme === theme ? 'on' : ''} onClick={() => s.set({ theme })}>
              {theme}
            </button>
          ))}
        </div>
      </div>

      <div className="setting">
        <div>
          <h3>{t('settings.fontSize')}</h3>
          <p className="muted small">{t('settings.fontSizeHelp')}</p>
        </div>
        <div className="seg">
          {FONT_SIZES.map((n) => (
            <button key={n} className={s.fontSize === n ? 'on' : ''} onClick={() => s.set({ fontSize: n })}>
              {n}
            </button>
          ))}
        </div>
      </div>

      <Toggle
        label={t('opt.strict')}
        help={t('opt.strictHelp')}
        value={s.strict}
        onChange={(strict) => s.set({ strict })}
      />
      <Toggle
        label={t('opt.keyboard')}
        help={t('settings.keyboardHelp')}
        value={s.showKeyboard}
        onChange={(showKeyboard) => s.set({ showKeyboard })}
      />
      <Toggle
        label={t('opt.hints')}
        help={t('settings.hintsHelp')}
        value={s.showHints}
        onChange={(showHints) => s.set({ showHints })}
      />

      <div className="setting">
        <div>
          <h3>{t('settings.language')}</h3>
          <p className="muted small">{t('settings.languageHelp')}</p>
        </div>
        <div className="seg">
          <button className="on">english</button>
          <button disabled>o'zbek</button>
          <button disabled>русский</button>
        </div>
      </div>

      {!signedIn && (
        <div className="setting danger">
          <div>
            <h3>{t('settings.reset')}</h3>
            <p className="muted small">{t('settings.resetHelp')}</p>
          </div>
          {confirming ? (
            <div className="seg">
              <button
                className="on danger"
                onClick={() => {
                  useData.getState().reset();
                  setConfirming(false);
                }}
              >
                {t('settings.resetConfirm')}
              </button>
              <button onClick={() => setConfirming(false)}>{t('settings.cancel')}</button>
            </div>
          ) : (
            <button className="btn" onClick={() => setConfirming(true)}>
              {t('settings.reset')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
