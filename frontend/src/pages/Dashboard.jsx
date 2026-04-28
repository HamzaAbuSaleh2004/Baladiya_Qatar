import { Link, useNavigate } from 'react-router-dom';
import { useApp } from '../AppContext';
import BottomNav from '../components/BottomNav';
import CategoryCarousel from '../components/CategoryCarousel';
import WeatherCard from '../components/WeatherCard';
import { ACTIVE_CATEGORY_KEYS } from '../categories';
import { useI18n } from '../i18n';

function prettyName(email) {
  if (!email) return '';
  const local = email.split('@')[0];
  return local.split(/[._-]+/).filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ');
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { email, isAdmin, signOut } = useApp();
  const { t, lang, setLang } = useI18n();
  const displayName = prettyName(email);

  function confirmSignOut() {
    if (window.confirm(t('signOutConfirm'))) signOut();
  }

  function pickCategory() {
    // Active categories start the real flow; the visual-only ones go through
    // the same capture screen — the agent will politely decline at runtime.
    void ACTIVE_CATEGORY_KEYS;
    navigate('/capture');
  }

  return (
    <div
      className="min-h-screen flex flex-col font-body-md text-body-md text-on-surface antialiased pb-24 md:pb-0"
      style={{
        background:
          'radial-gradient(1200px 600px at 20% -10%, #f8e9ef 0%, transparent 60%),' +
          'radial-gradient(900px 500px at 110% 10%, #fff4e5 0%, transparent 60%),' +
          'linear-gradient(180deg, #fffafb 0%, #fff7f8 100%)',
      }}
    >
      <header className="bg-surface-container-lowest/80 backdrop-blur-md font-['Public_Sans'] sticky top-0 z-40 border-b border-outline-variant">
        <div className="flex justify-between items-center px-margin-mobile h-16 w-full max-w-container-max mx-auto">
          <span className="text-xl font-bold text-primary">{t('appName')}</span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setLang(lang === 'en' ? 'ar' : 'en')}
              className="text-on-surface-variant hover:text-primary transition-colors text-sm font-medium px-3 py-2 rounded-full hover:bg-surface-container flex items-center gap-1"
              title={t('language')}
            >
              <span className="material-symbols-outlined text-[18px]">language</span>
              <span>{lang === 'en' ? 'AR' : 'EN'}</span>
            </button>
            {isAdmin && (
              <Link
                to="/admin"
                className="text-on-surface-variant hover:text-primary transition-colors text-sm font-medium px-3 py-2 rounded-full hover:bg-surface-container flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-[18px]">shield_person</span>
                <span className="hidden sm:inline">{t('admin')}</span>
              </Link>
            )}
            <button
              onClick={confirmSignOut}
              className="text-on-surface-variant hover:text-primary transition-colors text-sm font-medium px-3 py-2 rounded-full hover:bg-surface-container hidden md:flex"
              title={t('signOut')}
            >
              <span className="material-symbols-outlined align-middle text-[20px] mr-1">logout</span>
              <span>{t('signOut')}</span>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-grow px-margin-mobile md:px-gutter max-w-container-max mx-auto w-full pt-gutter pb-xl space-y-lg">
        <section className="flex flex-col gap-md">
          <div className="flex flex-col gap-1">
            <span className="font-body-md text-on-surface-variant">{t('welcome')}</span>
            <h2 className="text-headline-lg font-headline-lg text-on-background">
              {displayName || t('citizen')}
            </h2>
            <p className="font-body-md text-on-surface-variant max-w-xl">
              {t('welcomeSub')}
            </p>
          </div>

          <WeatherCard city="Doha" />
        </section>

        <section className="flex flex-col items-center justify-center py-md">
          <ShutterButton onClick={() => navigate('/capture')} label={t('shutter')} />
          <span className="mt-md font-label-bold text-label-bold text-primary uppercase tracking-wider">
            {t('reportNewIssue')}
          </span>
          <span className="font-label-sm text-label-sm text-on-surface-variant text-center mt-1 max-w-xs">
            {t('tapShutter')}
          </span>
        </section>

        <CategoryCarousel onPick={pickCategory} />
      </main>

      <BottomNav />
    </div>
  );
}

// Big "camera shutter" button: concentric rings + camera glyph + ripple on press.
function ShutterButton({ onClick, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="group relative w-44 h-44 sm:w-52 sm:h-52 rounded-full focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/30"
    >
      {/* Outer ring */}
      <span className="absolute inset-0 rounded-full bg-gradient-to-br from-primary to-[#a4123f] shadow-[0_18px_40px_rgba(108,0,40,0.35)]" />
      {/* Mid ring */}
      <span className="absolute inset-2 rounded-full bg-white/95 shadow-inner" />
      {/* Inner ring */}
      <span className="absolute inset-5 rounded-full bg-gradient-to-br from-primary to-[#7a0030] shadow-[inset_0_4px_8px_rgba(0,0,0,0.25)] flex items-center justify-center transition-transform duration-150 group-active:scale-95">
        {/* Lens glint */}
        <span className="absolute top-3 left-6 w-6 h-6 rounded-full bg-white/30 blur-sm" />
        {/* Camera icon */}
        <span className="material-symbols-outlined icon-fill text-white text-[56px] sm:text-[72px] drop-shadow-md relative">
          photo_camera
        </span>
      </span>
      {/* Spinning subtle aperture */}
      <span aria-hidden className="absolute inset-1 rounded-full border-[3px] border-dashed border-white/40 animate-[spin_18s_linear_infinite] pointer-events-none" />
      {/* "SHUTTER" label inside the white ring */}
      <span className="absolute inset-x-0 bottom-6 text-center text-[11px] font-bold tracking-widest text-primary/70 select-none">
        {label}
      </span>
    </button>
  );
}
