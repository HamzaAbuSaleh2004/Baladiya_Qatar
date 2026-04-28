import { useNavigate } from 'react-router-dom';
import { useApp } from '../AppContext';
import BottomNav from '../components/BottomNav';
import { useI18n } from '../i18n';

export default function Profile() {
  const navigate = useNavigate();
  const { email, role, department, signOut } = useApp();
  const { t, lang, setLang } = useI18n();

  function confirmSignOut() {
    if (window.confirm(t('signOutConfirm'))) {
      signOut();
      navigate('/auth', { replace: true });
    }
  }

  const initials = (email || '?').split('@')[0].slice(0, 2).toUpperCase();

  return (
    <div
      className="min-h-screen flex flex-col font-body-md text-body-md text-on-surface antialiased pb-24 md:pb-0"
      style={{
        background:
          'radial-gradient(900px 500px at 0% -10%, #f8e9ef 0%, transparent 60%),' +
          'linear-gradient(180deg, #fffafb 0%, #fff7f8 100%)',
      }}
    >
      <header className="bg-surface-container-lowest/80 backdrop-blur-md font-['Public_Sans'] sticky top-0 z-40 border-b border-outline-variant">
        <div className="flex justify-between items-center px-margin-mobile h-16 w-full max-w-container-max mx-auto">
          <span className="text-xl font-bold text-primary">{t('appName')}</span>
        </div>
      </header>

      <main className="flex-grow px-margin-mobile md:px-gutter max-w-container-max mx-auto w-full pt-gutter pb-xl space-y-md">
        <section className="flex flex-col items-center gap-sm pt-md">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary to-[#a4123f] text-white flex items-center justify-center text-2xl font-bold shadow-lg">
            {initials}
          </div>
          <span className="font-headline-md text-headline-md text-on-surface">{email}</span>
          <span className="font-label-sm text-label-sm text-on-surface-variant capitalize">
            {(role || 'citizen').replace('_', ' ')}
          </span>
        </section>

        <section className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-md flex flex-col gap-md">
          <span className="font-label-bold text-label-bold text-on-surface-variant uppercase tracking-wider">{t('settings')}</span>

          <Row icon="language" label={t('language')}>
            <div role="tablist" className="bg-surface-container rounded-full p-1 flex">
              <button
                type="button"
                role="tab"
                aria-selected={lang === 'en'}
                onClick={() => setLang('en')}
                className={`px-4 py-1.5 rounded-full text-label-bold text-label-bold transition-colors ${lang === 'en' ? 'bg-primary text-on-primary' : 'text-on-surface-variant'}`}
              >
                {t('english')}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={lang === 'ar'}
                onClick={() => setLang('ar')}
                className={`px-4 py-1.5 rounded-full text-label-bold text-label-bold transition-colors ${lang === 'ar' ? 'bg-primary text-on-primary' : 'text-on-surface-variant'}`}
              >
                {t('arabic')}
              </button>
            </div>
          </Row>

          <Row icon="badge" label={t('role')}>
            <span className="capitalize">{(role || 'citizen').replace('_', ' ')}</span>
          </Row>

          <Row icon="apartment" label={t('department')}>
            <span>{department || t('none')}</span>
          </Row>
        </section>

        <button
          onClick={confirmSignOut}
          className="w-full bg-surface-container-lowest border border-outline-variant rounded-2xl p-md flex items-center justify-center gap-2 text-error font-label-bold hover:bg-error-container/30"
        >
          <span className="material-symbols-outlined">logout</span>
          {t('signOut')}
        </button>
      </main>

      <BottomNav />
    </div>
  );
}

function Row({ icon, label, children }) {
  return (
    <div className="flex items-center justify-between gap-md py-1 border-b border-outline-variant/40 last:border-b-0 last:pb-0 first:pt-0">
      <div className="flex items-center gap-sm min-w-0">
        <div className="w-9 h-9 rounded-full bg-primary-container/30 text-primary flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined text-[18px]">{icon}</span>
        </div>
        <span className="font-body-md font-medium text-on-surface">{label}</span>
      </div>
      <div className="text-on-surface-variant flex items-center gap-sm">{children}</div>
    </div>
  );
}
