import { useNavigate } from 'react-router-dom';
import { useApp } from '../AppContext';

const CATEGORY_ICONS = {
  pothole: 'add_road',
  falling_tree: 'park',
};

const CATEGORY_LABELS = {
  pothole: 'Pothole / Road Damage',
  falling_tree: 'Tree Hazard',
};

const STATUS_STYLES = {
  investigating: 'bg-surface-variant text-on-surface-variant',
  in_progress: 'bg-tertiary-fixed text-on-tertiary-fixed',
  resolved: 'bg-secondary-fixed text-on-secondary-fixed',
};

function relTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function prettyName(email) {
  if (!email) return 'Citizen';
  const local = email.split('@')[0];
  return local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ');
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { email, tickets, ticketsLoading, ticketsError, refreshTickets, signOut } = useApp();
  const displayName = prettyName(email);

  function confirmSignOut() {
    if (window.confirm('Sign out of Baladiya?')) signOut();
  }

  return (
    <div className="bg-background min-h-screen flex flex-col font-body-md text-body-md text-on-surface antialiased pb-24 md:pb-0">
      <header className="bg-surface-container-lowest font-['Public_Sans'] sticky top-0 z-40 border-b border-outline-variant">
        <div className="flex justify-between items-center px-margin-mobile h-16 w-full max-w-container-max mx-auto">
          <span className="text-xl font-bold text-primary">Baladiya</span>
          <div className="flex items-center gap-1">
            <button
              onClick={refreshTickets}
              disabled={ticketsLoading}
              className="text-on-surface-variant hover:text-primary transition-colors text-sm font-medium px-3 py-2 rounded-full hover:bg-surface-container disabled:opacity-50"
              title="Refresh tickets"
              aria-label="Refresh tickets"
            >
              <span className={`material-symbols-outlined align-middle text-[20px] ${ticketsLoading ? 'animate-spin' : ''}`}>refresh</span>
            </button>
            <button
              onClick={confirmSignOut}
              className="text-on-surface-variant hover:text-primary transition-colors text-sm font-medium px-3 py-2 rounded-full hover:bg-surface-container"
              title="Sign out"
            >
              <span className="material-symbols-outlined align-middle text-[20px] mr-1">logout</span>
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="flex-grow px-margin-mobile md:px-gutter max-w-container-max mx-auto w-full pt-gutter pb-xl space-y-lg">
        <section>
          <h2 className="text-headline-lg font-headline-lg text-on-background mb-xs">
            Welcome back, {displayName}
          </h2>
          <p className="text-body-md font-body-md text-on-surface-variant">
            Report a civic issue or check the status of your existing tickets.
          </p>
        </section>

        <section className="flex justify-center">
          <button
            onClick={() => navigate('/capture')}
            className="bg-primary text-on-primary rounded-full px-8 py-4 flex items-center gap-2 shadow-[0_4px_10px_rgba(108,0,40,0.3)] hover:shadow-[0_6px_14px_rgba(108,0,40,0.4)] transition-all transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary"
          >
            <span className="material-symbols-outlined icon-fill">add_circle</span>
            <span className="text-label-bold font-label-bold">Report New Issue</span>
          </button>
        </section>

        <section>
          <div className="flex justify-between items-end mb-md">
            <h3 className="text-headline-md font-headline-md text-on-background">My Tickets</h3>
            {tickets.length > 0 && (
              <span className="text-label-sm font-label-sm text-on-surface-variant">{tickets.length} total</span>
            )}
          </div>

          {ticketsError && (
            <div className="mb-md bg-error-container text-on-error-container px-md py-sm rounded-lg text-label-sm font-label-sm" role="alert">
              {ticketsError}
            </div>
          )}

          {ticketsLoading && tickets.length === 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-md">
              {[0, 1, 2].map((i) => (
                <div key={i} className="bg-surface-container-lowest border border-outline-variant rounded-lg p-md animate-pulse h-[120px]" />
              ))}
            </div>
          ) : tickets.length === 0 ? (
            <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-xl text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-surface-container text-on-surface-variant mb-md">
                <span className="material-symbols-outlined text-3xl">inbox</span>
              </div>
              <p className="font-body-lg text-body-lg text-on-surface mb-xs">No tickets yet</p>
              <p className="font-body-md text-body-md text-on-surface-variant">
                Tap “Report New Issue” to file your first report.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-md">
              {tickets.map((t) => (
                <div
                  key={t.ticket_id}
                  className="bg-surface-container-lowest border border-outline-variant rounded-lg p-md shadow-[0_4px_10px_rgba(0,0,0,0.02)] flex flex-col gap-sm"
                >
                  <div className="flex justify-between items-start gap-sm">
                    <div className="flex items-center gap-sm min-w-0">
                      <div className="bg-surface-container p-2 rounded-full text-primary shrink-0">
                        <span className="material-symbols-outlined">{CATEGORY_ICONS[t.category] || 'report'}</span>
                      </div>
                      <div className="min-w-0">
                        <span className="text-label-sm font-label-sm text-on-surface-variant block truncate">ID: #{t.ticket_id}</span>
                        <h4 className="text-body-lg font-body-lg text-on-background font-semibold truncate">
                          {CATEGORY_LABELS[t.category] || t.category}
                        </h4>
                      </div>
                    </div>
                    <span
                      className={`shrink-0 px-2 py-1 rounded-full text-label-sm font-label-sm font-medium capitalize ${
                        STATUS_STYLES[t.status] || 'bg-surface-variant text-on-surface-variant'
                      }`}
                    >
                      {(t.status || '').replace(/_/g, ' ')}
                    </span>
                  </div>
                  {t.description && (
                    <p
                      dir="auto"
                      className="text-body-md font-body-md text-on-surface-variant line-clamp-2"
                    >
                      {t.description}
                    </p>
                  )}
                  <div className="flex justify-between items-center mt-2 pt-2 border-t border-surface-variant gap-sm">
                    <span className="text-label-sm font-label-sm text-on-surface-variant flex items-center gap-1">
                      <span className="material-symbols-outlined text-[16px]">schedule</span>
                      {relTime(t.created_at)}
                    </span>
                    <span className="text-label-sm font-label-sm text-on-surface-variant truncate">{t.department}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      <nav
        className="md:hidden fixed bottom-0 w-full z-50 flex justify-around items-stretch bg-surface-container-lowest border-t border-outline-variant shadow-[0_-2px_10px_rgba(0,0,0,0.05)]"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="flex-1 min-h-[56px] flex flex-col items-center justify-center text-primary"
        >
          <span className="material-symbols-outlined icon-fill">home</span>
          <span className="text-[11px] font-medium">Home</span>
        </button>
        <button
          onClick={() => navigate('/capture')}
          className="flex-1 min-h-[56px] flex flex-col items-center justify-center text-on-surface-variant"
        >
          <span className="material-symbols-outlined">add_a_photo</span>
          <span className="text-[11px] font-medium">Report</span>
        </button>
        <button
          onClick={confirmSignOut}
          className="flex-1 min-h-[56px] flex flex-col items-center justify-center text-on-surface-variant"
        >
          <span className="material-symbols-outlined">logout</span>
          <span className="text-[11px] font-medium">Sign out</span>
        </button>
      </nav>
    </div>
  );
}
