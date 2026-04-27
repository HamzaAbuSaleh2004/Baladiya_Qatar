import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../AppContext';

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
  const { report, resetReport } = useApp();
  const t = report.ticket;
  const [copied, setCopied] = useState(false);

  function copyId() {
    if (!t?.ticket_id) return;
    navigator.clipboard?.writeText(t.ticket_id).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  useEffect(() => {
    if (!t) navigate('/', { replace: true });
  }, [t, navigate]);

  if (!t) return null;

  function done() {
    resetReport();
    navigate('/', { replace: true });
  }

  return (
    <div className="bg-background min-h-screen flex flex-col font-body-md text-body-md text-on-surface antialiased">
      <header className="bg-surface-container-lowest border-b border-outline-variant flex justify-between items-center px-margin-mobile h-16 sticky top-0 z-50">
        <span className="text-xl font-bold text-primary">Baladiya</span>
        <button
          onClick={done}
          className="text-on-surface-variant hover:text-primary transition-colors text-sm font-medium px-3 py-2 rounded-full hover:bg-surface-container"
        >
          Close
        </button>
      </header>

      <main className="flex-grow w-full max-w-[800px] mx-auto px-margin-mobile md:px-gutter py-lg md:py-xl flex flex-col gap-lg">
        {/* Success banner */}
        <section className="flex flex-col items-center text-center gap-md mt-md">
          <div className="w-20 h-20 rounded-full bg-primary text-on-primary flex items-center justify-center shadow-[0_4px_16px_rgba(108,0,40,0.3)]">
            <span className="material-symbols-outlined text-5xl icon-fill">check_circle</span>
          </div>
          <div>
            <h1 className="font-headline-lg text-headline-lg text-on-background">Report Submitted</h1>
            <p className="font-body-md text-body-md text-on-surface-variant mt-xs">
              Your ticket has been routed to the responsible department.
            </p>
          </div>
          <button
            type="button"
            onClick={copyId}
            className="font-mono font-label-bold text-label-bold text-primary bg-primary-container/30 px-4 py-2 rounded-full inline-flex items-center gap-2 hover:bg-primary-container/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            title="Copy ticket ID"
          >
            #{t.ticket_id}
            <span className="material-symbols-outlined text-[16px]">
              {copied ? 'check' : 'content_copy'}
            </span>
          </button>
        </section>

        {/* Detail card */}
        <section className="bg-surface-container-lowest border border-outline-variant rounded-xl p-md md:p-lg shadow-[0_4px_24px_rgba(0,0,0,0.02)] flex flex-col gap-md">
          <div className="flex items-center justify-between border-b border-surface-variant pb-sm">
            <div className="flex items-center gap-sm text-primary">
              <span className="material-symbols-outlined">{CATEGORY_ICON[t.category] || 'report'}</span>
              <h2 className="font-headline-md text-headline-md text-on-surface">
                {CATEGORY_LABEL[t.category] || t.category}
              </h2>
            </div>
            <span className={`px-3 py-1 rounded-full font-label-bold text-label-bold capitalize ${SEVERITY_STYLES[t.severity] || 'bg-surface-variant text-on-surface-variant'}`}>
              {t.severity} priority
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-lg">
            <div className="flex flex-col gap-xs">
              <span className="font-label-bold text-label-bold text-secondary">Routed to</span>
              <div className="flex items-center gap-sm">
                <span className="material-symbols-outlined text-outline">apartment</span>
                <span className="font-body-lg text-body-lg text-on-surface font-medium">{t.department}</span>
              </div>
            </div>
            <div className="flex flex-col gap-xs">
              <span className="font-label-bold text-label-bold text-secondary">Status</span>
              <div className="flex items-center gap-sm">
                <span className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse" />
                <span className="font-body-lg text-body-lg text-on-surface font-medium capitalize">
                  {(t.status || 'investigating').replace('_', ' ')}
                </span>
              </div>
            </div>
          </div>

          <div className="border-t border-surface-variant pt-md grid grid-cols-1 md:grid-cols-2 gap-lg">
            <div className="flex flex-col gap-xs">
              <span className="font-label-bold text-label-bold text-secondary">Location (GPS)</span>
              <span className="font-body-md text-body-md text-on-surface font-mono">
                {t.location?.latitude?.toFixed?.(5) ?? t.location?.latitude}°,{' '}
                {t.location?.longitude?.toFixed?.(5) ?? t.location?.longitude}°
              </span>
              {t.location?.latitude != null && (
                <a
                  href={`https://www.google.com/maps?q=${t.location.latitude},${t.location.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary text-label-sm font-label-sm hover:underline mt-1 w-fit"
                >
                  View on map →
                </a>
              )}
            </div>
            <div className="flex flex-col gap-xs">
              <span className="font-label-bold text-label-bold text-secondary">Submitted</span>
              <span className="font-body-md text-body-md text-on-surface">
                {t.created_at ? new Date(t.created_at).toLocaleString() : 'Just now'}
              </span>
            </div>
          </div>

          {t.description && (
            <div className="border-t border-surface-variant pt-md flex flex-col gap-xs">
              <span className="font-label-bold text-label-bold text-secondary">Description</span>
              <p
                dir="auto"
                className="font-body-md text-body-md text-on-surface whitespace-pre-wrap"
              >
                {t.description}
              </p>
            </div>
          )}
        </section>

        {/* Photo */}
        {report.imagePreview && (
          <section className="bg-surface-container-lowest border border-outline-variant rounded-xl p-md shadow-[0_4px_24px_rgba(0,0,0,0.02)] flex flex-col gap-sm">
            <span className="font-label-bold text-label-bold text-secondary">Your photo</span>
            <img
              src={report.imagePreview}
              alt="Reported issue"
              className="rounded-lg w-full max-h-[280px] object-cover border border-outline-variant"
            />
          </section>
        )}

        {/* Action */}
        <section className="flex flex-col md:flex-row-reverse gap-sm md:gap-md mt-sm pt-lg border-t border-outline-variant">
          <button
            onClick={done}
            className="w-full md:w-auto bg-primary text-on-primary px-xl py-3 rounded-full font-label-bold text-label-bold hover:bg-primary-container transition-colors shadow-sm active:scale-[0.98]"
          >
            Back to Dashboard
          </button>
          <button
            onClick={() => { resetReport(); navigate('/capture'); }}
            className="w-full md:w-auto bg-transparent border border-outline text-primary px-xl py-3 rounded-full font-label-bold text-label-bold hover:bg-surface-variant transition-colors active:scale-[0.98]"
          >
            File another report
          </button>
        </section>
      </main>
    </div>
  );
}
