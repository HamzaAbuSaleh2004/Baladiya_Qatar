import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../AppContext';
import { useI18n } from '../i18n';

const CATEGORY_LABEL = {
  pothole: 'Pothole / Road Damage',
  falling_tree: 'Tree Hazard',
};

const CATEGORY_ICON = {
  pothole: 'add_road',
  falling_tree: 'park',
};

const SEVERITY_STYLES = {
  low: 'bg-tertiary-fixed text-on-tertiary-fixed',
  medium: 'bg-secondary-fixed text-on-secondary-fixed',
  high: 'bg-error-container text-on-error-container',
};

export default function Confirmation() {
  const navigate = useNavigate();
  const { report, resetReport, refreshTickets } = useApp();
  const { t, lang } = useI18n();
  const tk = report.ticket;
  const [copied, setCopied] = useState(false);

  function copyId() {
    if (!tk?.ticket_id) return;
    navigator.clipboard?.writeText(tk.ticket_id).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  useEffect(() => {
    if (!tk) navigate('/', { replace: true });
  }, [tk, navigate]);

  if (!tk) return null;

  function done() {
    refreshTickets(); // Bug #5: tickets list shows the new ticket immediately.
    resetReport();
    navigate('/tickets', { replace: true });
  }

  const eta = tk.expected_resolution_at
    ? new Date(tk.expected_resolution_at).toLocaleString(lang === 'ar' ? 'ar-QA' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' })
    : null;

  return (
    <div className="bg-background min-h-screen flex flex-col font-body-md text-body-md text-on-surface antialiased">
      <header className="bg-surface-container-lowest border-b border-outline-variant flex justify-between items-center px-margin-mobile h-16 sticky top-0 z-50">
        <span className="text-xl font-bold text-primary">{t('appName')}</span>
        <button
          onClick={done}
          className="text-on-surface-variant hover:text-primary transition-colors text-sm font-medium px-3 py-2 rounded-full hover:bg-surface-container"
        >
          {t('backToDashboard')}
        </button>
      </header>

      <main className="flex-grow w-full max-w-[800px] mx-auto px-margin-mobile md:px-gutter py-lg md:py-xl flex flex-col gap-lg">
        <section className="flex flex-col items-center text-center gap-md mt-md">
          <div className="w-20 h-20 rounded-full bg-primary text-on-primary flex items-center justify-center shadow-[0_4px_16px_rgba(108,0,40,0.3)]">
            <span className="material-symbols-outlined text-5xl icon-fill">check_circle</span>
          </div>
          <div>
            <h1 className="font-headline-lg text-headline-lg text-on-background">{t('reportSubmitted')}</h1>
            <p className="font-body-md text-on-surface-variant mt-xs">{t('reportSubmittedSub')}</p>
          </div>
          <button
            type="button"
            onClick={copyId}
            className="font-mono font-label-bold text-label-bold text-primary bg-primary-container/30 px-4 py-2 rounded-full inline-flex items-center gap-2 hover:bg-primary-container/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            title="Copy ticket ID"
          >
            #{tk.ticket_id}
            <span className="material-symbols-outlined text-[16px]">{copied ? 'check' : 'content_copy'}</span>
          </button>
        </section>

        <section className="bg-surface-container-lowest border border-outline-variant rounded-xl p-md md:p-lg shadow-[0_4px_24px_rgba(0,0,0,0.02)] flex flex-col gap-md">
          <div className="flex items-center justify-between border-b border-surface-variant pb-sm">
            <div className="flex items-center gap-sm text-primary">
              <span className="material-symbols-outlined">{CATEGORY_ICON[tk.category] || 'report'}</span>
              <h2 className="font-headline-md text-headline-md text-on-surface">{CATEGORY_LABEL[tk.category] || tk.category}</h2>
            </div>
            <span className={`px-3 py-1 rounded-full font-label-bold text-label-bold capitalize ${SEVERITY_STYLES[tk.severity] || 'bg-surface-variant text-on-surface-variant'}`}>
              {tk.severity}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-lg">
            <Row label={t('routedTo')} icon="apartment" value={tk.department} />
            <Row label={t('status')} icon="schedule_send" value={<span className="capitalize">{(tk.status || 'investigating').replace('_', ' ')}</span>} />
            {eta && <Row label={t('expectedResolution')} icon="timer" value={eta} />}
            <Row label={t('locationGps')} icon="location_on" value={tk.address || (tk.location?.latitude != null ? `${tk.location.latitude.toFixed(5)}, ${tk.location.longitude.toFixed(5)}` : '—')} />
          </div>

          {tk.description && (
            <div className="border-t border-surface-variant pt-md flex flex-col gap-xs">
              <span className="font-label-bold text-label-bold text-secondary">{t('description')}</span>
              <p dir="auto" className="font-body-md text-on-surface whitespace-pre-wrap">{tk.description}</p>
            </div>
          )}
        </section>

        {(tk.photo || report.imagePreview) && (
          <section className="bg-surface-container-lowest border border-outline-variant rounded-xl p-md shadow-[0_4px_24px_rgba(0,0,0,0.02)] flex flex-col gap-sm">
            <span className="font-label-bold text-label-bold text-secondary">{t('yourPhoto')}</span>
            <img
              src={tk.photo || report.imagePreview}
              alt="Reported issue"
              className="rounded-lg w-full max-h-[280px] object-cover border border-outline-variant"
            />
          </section>
        )}

        <section className="flex flex-col md:flex-row-reverse gap-sm md:gap-md mt-sm pt-lg border-t border-outline-variant">
          <button
            onClick={done}
            className="w-full md:w-auto bg-primary text-on-primary px-xl py-3 rounded-full font-label-bold text-label-bold hover:bg-primary-container transition-colors shadow-sm active:scale-[0.98]"
          >
            {t('backToDashboard')}
          </button>
          <button
            onClick={() => { resetReport(); navigate('/capture'); }}
            className="w-full md:w-auto bg-transparent border border-outline text-primary px-xl py-3 rounded-full font-label-bold text-label-bold hover:bg-surface-variant transition-colors active:scale-[0.98]"
          >
            {t('fileAnother')}
          </button>
        </section>
      </main>
    </div>
  );
}

function Row({ label, icon, value }) {
  return (
    <div className="flex flex-col gap-xs">
      <span className="font-label-bold text-label-bold text-secondary">{label}</span>
      <div className="flex items-center gap-sm">
        <span className="material-symbols-outlined text-outline">{icon}</span>
        <span className="font-body-lg text-body-lg text-on-surface font-medium">{value}</span>
      </div>
    </div>
  );
}
