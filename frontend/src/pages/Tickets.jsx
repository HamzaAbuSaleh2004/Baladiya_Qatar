import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../AppContext';
import BottomNav from '../components/BottomNav';
import StatusTimeline from '../components/StatusTimeline';
import { useI18n } from '../i18n';

const CATEGORY_ICONS = {
  pothole: 'add_road',
  falling_tree: 'park',
};

const STATUS_STYLES = {
  investigating: 'bg-amber-100 text-amber-700',
  in_progress: 'bg-sky-100 text-sky-700',
  resolved: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-rose-100 text-rose-700',
};

function relTime(iso, lang) {
  if (!iso) return '';
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (lang === 'ar') {
    if (diff < 60) return 'الآن';
    if (diff < 3600) return `قبل ${Math.floor(diff / 60)} د`;
    if (diff < 86400) return `قبل ${Math.floor(diff / 3600)} س`;
    return `قبل ${Math.floor(diff / 86400)} يوم`;
  }
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

const FILTERS = [
  { key: 'all',           statuses: null },
  { key: 'in_progress',   statuses: ['in_progress', 'investigating'] },
  { key: 'resolved',      statuses: ['resolved'] },
];

export default function Tickets() {
  const navigate = useNavigate();
  const { tickets, ticketsLoading, ticketsError, refreshTickets } = useApp();
  const { t, lang } = useI18n();
  const [filter, setFilter] = useState('all');
  const [active, setActive] = useState(null);

  // Auto-refresh whenever the user lands on this page (covers bug #5).
  useEffect(() => { refreshTickets(); }, [refreshTickets]);

  const visible = useMemo(() => {
    const f = FILTERS.find((x) => x.key === filter);
    if (!f?.statuses) return tickets;
    return tickets.filter((t) => f.statuses.includes(t.status));
  }, [tickets, filter]);

  const filterLabel = (k) => {
    if (k === 'all') return t('allTickets');
    if (k === 'in_progress') return t('inProgress');
    if (k === 'resolved') return t('resolved');
    return k;
  };

  return (
    <div
      className="min-h-screen flex flex-col font-body-md text-body-md text-on-surface antialiased pb-24 md:pb-0"
      style={{
        background:
          'radial-gradient(1000px 500px at 100% -10%, #f8e9ef 0%, transparent 60%),' +
          'linear-gradient(180deg, #fffafb 0%, #fff7f8 100%)',
      }}
    >
      <header className="bg-surface-container-lowest/80 backdrop-blur-md font-['Public_Sans'] sticky top-0 z-40 border-b border-outline-variant">
        <div className="flex justify-between items-center px-margin-mobile h-16 w-full max-w-container-max mx-auto">
          <span className="text-xl font-bold text-primary">{t('appName')}</span>
          <button
            onClick={refreshTickets}
            disabled={ticketsLoading}
            className="text-on-surface-variant hover:text-primary text-sm font-medium px-3 py-2 rounded-full hover:bg-surface-container disabled:opacity-50"
            title="Refresh"
            aria-label="Refresh"
          >
            <span className={`material-symbols-outlined align-middle text-[20px] ${ticketsLoading ? 'animate-spin' : ''}`}>refresh</span>
          </button>
        </div>
      </header>

      <main className="flex-grow px-margin-mobile md:px-gutter max-w-container-max mx-auto w-full pt-gutter pb-xl space-y-md">
        <section className="flex flex-col gap-1">
          <h1 className="text-headline-lg font-headline-lg text-on-background">{t('myTickets')}</h1>
          <p className="font-body-md text-on-surface-variant">{t('myTicketsSub')}</p>
        </section>

        <div role="tablist" className="flex gap-sm overflow-x-auto pb-1">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              role="tab"
              type="button"
              onClick={() => setFilter(f.key)}
              aria-selected={filter === f.key}
              className={`shrink-0 px-4 py-2 rounded-full font-label-bold text-label-bold transition-colors ${
                filter === f.key ? 'bg-primary text-on-primary shadow-sm' : 'bg-surface-container border border-outline-variant text-on-surface-variant hover:text-on-surface'
              }`}
            >
              {filterLabel(f.key)}
            </button>
          ))}
        </div>

        {ticketsError && (
          <div className="bg-error-container text-on-error-container px-md py-sm rounded-lg text-label-sm" role="alert">{ticketsError}</div>
        )}

        {ticketsLoading && tickets.length === 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
            {[0,1,2].map((i) => (
              <div key={i} className="bg-surface-container-lowest border border-outline-variant rounded-xl p-md animate-pulse h-[150px]" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-xl text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-surface-container text-on-surface-variant mb-md">
              <span className="material-symbols-outlined text-3xl">inbox</span>
            </div>
            <p className="font-body-lg text-body-lg text-on-surface mb-xs">{t('noTicketsYet')}</p>
            <p className="font-body-md text-on-surface-variant">{t('noTicketsSub')}</p>
            <button
              onClick={() => navigate('/capture')}
              className="mt-md bg-primary text-on-primary px-lg py-2 rounded-full font-label-bold text-label-bold"
            >
              {t('reportNewIssue')}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
            {visible.map((tk) => {
              const statusLabel =
                tk.status === 'in_progress' ? t('inProgress') :
                tk.status === 'resolved' ? t('resolved') :
                tk.status === 'rejected' ? t('rejected') :
                t('investigating');
              return (
                <div
                  key={tk.ticket_id}
                  className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-md shadow-[0_4px_10px_rgba(0,0,0,0.04)] flex flex-col gap-sm"
                >
                  <div className="flex justify-between items-start gap-sm">
                    <div className="min-w-0 flex flex-col">
                      <span className="font-label-sm text-label-sm text-on-surface-variant">#{tk.ticket_id}</span>
                      <h3 className="text-headline-md font-headline-md text-on-surface truncate">
                        {tk.category === 'pothole' ? t('myTickets') && (lang === 'ar' ? 'حفرة / تلف بالطريق' : 'Pothole / Road Damage')
                          : tk.category === 'falling_tree' ? (lang === 'ar' ? 'خطر شجرة' : 'Tree Hazard')
                          : tk.category}
                      </h3>
                    </div>
                    <span className={`shrink-0 px-2 py-1 rounded-full text-label-sm font-label-bold uppercase ${STATUS_STYLES[tk.status] || 'bg-surface-variant text-on-surface-variant'}`}>
                      {statusLabel}
                    </span>
                  </div>
                  <div className="flex items-center gap-sm text-on-surface-variant text-label-sm">
                    <span className="bg-surface-container p-1.5 rounded-md text-primary">
                      <span className="material-symbols-outlined text-[16px]">{tk.address ? 'location_on' : CATEGORY_ICONS[tk.category] || 'place'}</span>
                    </span>
                    <span className="truncate">{tk.address || tk.department || '—'}</span>
                  </div>
                  <div className="flex justify-between items-center text-label-sm text-on-surface-variant">
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-[16px]">schedule</span>
                      {relTime(tk.created_at, lang)}
                    </span>
                    {tk.expected_resolution_at && tk.status !== 'resolved' && (
                      <span className="flex items-center gap-1 text-amber-700">
                        <span className="material-symbols-outlined text-[16px]">timer</span>
                        {new Date(tk.expected_resolution_at).toLocaleDateString(lang === 'ar' ? 'ar-QA' : 'en-GB', { day: 'numeric', month: 'short' })}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setActive(tk)}
                    className={`mt-1 w-full py-2 rounded-full font-label-bold text-label-bold transition-colors ${
                      tk.status === 'resolved'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'border border-outline text-primary hover:bg-primary/5'
                    }`}
                  >
                    {tk.status === 'resolved' ? t('resolved') : t('viewDetails')}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {active && <CitizenTicketModal ticket={active} onClose={() => setActive(null)} />}
      <BottomNav />
    </div>
  );
}

function CitizenTicketModal({ ticket, onClose }) {
  const { t, lang } = useI18n();
  const sla = ticket.expected_resolution_at
    ? new Date(ticket.expected_resolution_at).toLocaleString(lang === 'ar' ? 'ar-QA' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' })
    : null;
  return (
    <div className="fixed inset-0 z-50 flex" role="dialog" aria-modal="true">
      <button type="button" aria-label="Close" onClick={onClose} className="flex-1 bg-black/40 backdrop-blur-sm" />
      <aside className="w-full max-w-md bg-surface-container-lowest h-full overflow-y-auto shadow-2xl">
        <header className="px-margin-mobile py-md border-b border-outline-variant flex items-center justify-between sticky top-0 bg-surface-container-lowest z-10">
          <div className="min-w-0">
            <span className="text-label-sm text-on-surface-variant block">{t('myTickets')}</span>
            <h3 className="text-headline-md font-headline-md truncate">#{ticket.ticket_id}</h3>
          </div>
          <button onClick={onClose} className="w-10 h-10 rounded-full hover:bg-surface-container flex items-center justify-center" aria-label="Close">
            <span className="material-symbols-outlined">close</span>
          </button>
        </header>
        <div className="px-margin-mobile py-md flex flex-col gap-md">
          {ticket.photo && (
            <img src={ticket.photo} alt="" className="rounded-xl w-full object-cover max-h-[260px] border border-outline-variant" />
          )}
          <dl className="grid grid-cols-2 gap-sm text-label-sm">
            <Item label={t('severity')} value={<span className="capitalize">{ticket.severity}</span>} />
            <Item label={t('routedTo')} value={ticket.department} />
            {sla && <Item label={t('expectedResolution')} value={sla} />}
            <Item label={t('locationGps')}
              value={ticket.address ? ticket.address : (ticket.location?.latitude != null ? `${ticket.location.latitude.toFixed(5)}, ${ticket.location.longitude.toFixed(5)}` : '—')}
            />
          </dl>
          {ticket.description && (
            <div className="bg-surface-container rounded-lg p-sm">
              <span className="font-label-sm text-on-surface-variant">{t('description')}</span>
              <p dir="auto" className="font-body-md text-on-surface mt-1 whitespace-pre-wrap">{ticket.description}</p>
            </div>
          )}
          <div>
            <span className="font-label-bold text-label-bold text-on-surface mb-sm block">{t('progress')}</span>
            <StatusTimeline ticket={ticket} />
          </div>
        </div>
      </aside>
    </div>
  );
}

function Item({ label, value }) {
  return (
    <div className="flex flex-col">
      <span className="text-on-surface-variant">{label}</span>
      <span className="text-on-surface font-medium truncate">{value || '—'}</span>
    </div>
  );
}
