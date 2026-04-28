import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useApp } from '../AppContext';
import {
  adminBulkUpdate,
  adminGetStats,
  adminListTickets,
  adminUpdateTicket,
} from '../api';
import StatusTimeline from '../components/StatusTimeline';
import TicketsMap from '../components/TicketsMap';

const CATEGORY_LABEL = {
  pothole: 'Pothole / Road Damage',
  falling_tree: 'Tree Hazard',
};

const CATEGORY_ICON = {
  pothole: 'add_road',
  falling_tree: 'park',
};

const STATUS_OPTIONS = [
  { value: 'investigating', label: 'Investigating' },
  { value: 'in_progress',   label: 'In Progress' },
  { value: 'resolved',      label: 'Resolved' },
  { value: 'rejected',      label: 'Rejected' },
];

const STATUS_STYLES = {
  investigating: 'bg-surface-variant text-on-surface-variant',
  in_progress:   'bg-tertiary-fixed text-on-tertiary-fixed',
  resolved:      'bg-secondary-fixed text-on-secondary-fixed',
  rejected:      'bg-error-container text-on-error-container',
};

function relTime(iso) {
  if (!iso) return '';
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function ticketsToCsv(tickets) {
  const headers = [
    'ticket_id', 'category', 'severity', 'status', 'department',
    'user_email', 'latitude', 'longitude', 'created_at', 'updated_at', 'description',
  ];
  const rows = tickets.map((t) => [
    t.ticket_id,
    t.category,
    t.severity,
    t.status,
    t.department,
    t.user_email,
    t.location?.latitude ?? '',
    t.location?.longitude ?? '',
    t.created_at,
    t.updated_at,
    (t.description || '').replace(/\r?\n/g, ' '),
  ]);
  const escape = (v) => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers, ...rows].map((r) => r.map(escape).join(',')).join('\n');
}

function downloadCsv(filename, csv) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

export default function Admin() {
  const navigate = useNavigate();
  const { token, email, role, department, isSuperAdmin, signOut } = useApp();

  const [tickets, setTickets] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters / search
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [search, setSearch] = useState('');
  const [view, setView] = useState('list'); // 'list' | 'map'
  const [heatmap, setHeatmap] = useState(false);

  // Selection
  const [selected, setSelected] = useState(new Set());

  // Drawer
  const [activeTicket, setActiveTicket] = useState(null);

  const refresh = useCallback(() => {
    if (!token) return Promise.resolve();
    const work = Promise.all([
      adminListTickets(token),
      adminGetStats(token).catch(() => null),
    ]);
    work
      .then(([ticketsRes, statsRes]) => {
        setTickets(ticketsRes.tickets || []);
        setStats(statsRes);
        setError('');
      })
      .catch((err) => {
        setError(err.message || 'Failed to load tickets.');
        if (err.status === 401) signOut();
      })
      .finally(() => setLoading(false));
    return work;
  }, [token, signOut]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    Promise.all([
      adminListTickets(token),
      adminGetStats(token).catch(() => null),
    ])
      .then(([ticketsRes, statsRes]) => {
        if (cancelled) return;
        setTickets(ticketsRes.tickets || []);
        setStats(statsRes);
        setError('');
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message || 'Failed to load tickets.');
        if (err.status === 401) signOut();
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [token, signOut]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tickets.filter((t) => {
      if (statusFilter && t.status !== statusFilter) return false;
      if (categoryFilter && t.category !== categoryFilter) return false;
      if (!q) return true;
      const hay = [
        t.ticket_id, t.user_email, t.department, t.description, t.category,
      ].filter(Boolean).join(' ').toLowerCase();
      return hay.includes(q);
    });
  }, [tickets, statusFilter, categoryFilter, search]);

  const allSelected = filtered.length > 0 && filtered.every((t) => selected.has(t.ticket_id));

  function toggleSelect(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((t) => t.ticket_id)));
    }
  }

  async function applyBulk(status) {
    if (selected.size === 0) return;
    if (!window.confirm(`Set ${selected.size} ticket(s) to "${status.replace('_', ' ')}"?`)) return;
    try {
      await adminBulkUpdate(token, { ticket_ids: [...selected], status });
      setSelected(new Set());
      await refresh();
    } catch (err) {
      alert(err.message || 'Bulk update failed.');
    }
  }

  function exportCsv() {
    const rows = selected.size > 0
      ? filtered.filter((t) => selected.has(t.ticket_id))
      : filtered;
    const stamp = new Date().toISOString().slice(0, 10);
    downloadCsv(`baladiya-tickets-${stamp}.csv`, ticketsToCsv(rows));
  }

  return (
    <div className="bg-background min-h-screen flex flex-col font-body-md text-body-md text-on-surface antialiased pb-24 md:pb-0">
      <header className="bg-surface-container-lowest font-['Public_Sans'] sticky top-0 z-40 border-b border-outline-variant">
        <div className="flex justify-between items-center px-margin-mobile h-16 w-full max-w-container-max mx-auto">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-xl font-bold text-primary">Baladiya</span>
            <span className="hidden sm:inline-flex items-center gap-1 bg-primary-container/30 text-primary text-label-sm font-label-bold px-2.5 py-1 rounded-full">
              <span className="material-symbols-outlined text-[14px]">shield_person</span>
              Admin
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={refresh}
              disabled={loading}
              className="text-on-surface-variant hover:text-primary transition-colors text-sm font-medium px-3 py-2 rounded-full hover:bg-surface-container disabled:opacity-50"
              title="Refresh"
              aria-label="Refresh"
            >
              <span className={`material-symbols-outlined align-middle text-[20px] ${loading ? 'animate-spin' : ''}`}>refresh</span>
            </button>
            {isSuperAdmin && (
              <Link
                to="/admin/users"
                className="hidden sm:inline-flex text-on-surface-variant hover:text-primary transition-colors text-sm font-medium px-3 py-2 rounded-full hover:bg-surface-container items-center gap-1"
              >
                <span className="material-symbols-outlined text-[18px]">group</span>
                Users
              </Link>
            )}
            <button
              onClick={() => { if (window.confirm('Sign out?')) signOut(); }}
              className="text-on-surface-variant hover:text-primary transition-colors text-sm font-medium px-3 py-2 rounded-full hover:bg-surface-container"
              title="Sign out"
            >
              <span className="material-symbols-outlined align-middle text-[20px] mr-1">logout</span>
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-grow px-margin-mobile md:px-gutter max-w-container-max mx-auto w-full pt-gutter pb-xl space-y-lg">
        <section>
          <h2 className="text-headline-lg font-headline-lg text-on-background mb-xs">
            Tickets {department ? `· ${department}` : '(all departments)'}
          </h2>
          <p className="text-body-md text-on-surface-variant">
            Signed in as <span className="font-medium">{email}</span> · role <span className="capitalize font-medium">{(role || '').replace('_', ' ')}</span>
          </p>
        </section>

        {/* Stat tiles */}
        {stats && (
          <section className="grid grid-cols-2 md:grid-cols-4 gap-md">
            <StatTile label="Total" value={stats.total} icon="inbox" />
            <StatTile label="Investigating" value={stats.by_status?.investigating || 0} icon="search" />
            <StatTile label="In Progress" value={stats.by_status?.in_progress || 0} icon="engineering" />
            <StatTile label="Resolved" value={stats.by_status?.resolved || 0} icon="verified" />
          </section>
        )}

        {/* Toolbar */}
        <section className="bg-surface-container-lowest border border-outline-variant rounded-xl p-md flex flex-col gap-md">
          <div className="flex flex-col md:flex-row gap-sm md:items-center">
            <div className="flex-1 relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/70 text-[18px]">search</span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search ID, email, description…"
                className="w-full pl-9 pr-3 py-2 bg-surface-container rounded-full border border-outline-variant focus:ring-2 focus:ring-primary focus:border-primary outline-none font-body-md text-body-md"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 bg-surface-container rounded-full border border-outline-variant font-body-md text-body-md focus:ring-2 focus:ring-primary outline-none"
            >
              <option value="">All statuses</option>
              {STATUS_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-2 bg-surface-container rounded-full border border-outline-variant font-body-md text-body-md focus:ring-2 focus:ring-primary outline-none"
            >
              <option value="">All categories</option>
              <option value="pothole">Pothole</option>
              <option value="falling_tree">Tree Hazard</option>
            </select>
            <div className="flex bg-surface-container rounded-full p-1 self-start">
              <button
                onClick={() => setView('list')}
                className={`px-3 py-1.5 rounded-full text-label-bold font-label-bold transition-colors ${view === 'list' ? 'bg-primary text-on-primary' : 'text-on-surface-variant'}`}
              >
                <span className="material-symbols-outlined align-middle text-[18px] mr-1">list</span>
                List
              </button>
              <button
                onClick={() => setView('map')}
                className={`px-3 py-1.5 rounded-full text-label-bold font-label-bold transition-colors ${view === 'map' ? 'bg-primary text-on-primary' : 'text-on-surface-variant'}`}
              >
                <span className="material-symbols-outlined align-middle text-[18px] mr-1">map</span>
                Map
              </button>
            </div>
          </div>

          {/* Bulk-action bar */}
          <div className="flex flex-wrap gap-sm items-center justify-between">
            <div className="flex items-center gap-sm">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleSelectAll}
                className="w-4 h-4 accent-[#6c0028]"
                aria-label="Select all"
              />
              <span className="font-label-sm text-label-sm text-on-surface-variant">
                {selected.size > 0
                  ? `${selected.size} selected`
                  : `${filtered.length} ticket${filtered.length === 1 ? '' : 's'}`}
              </span>
            </div>
            <div className="flex flex-wrap gap-xs">
              <button
                onClick={() => applyBulk('in_progress')}
                disabled={selected.size === 0}
                className="px-3 py-1.5 rounded-full bg-tertiary-fixed text-on-tertiary-fixed text-label-bold font-label-bold disabled:opacity-40"
              >Set In Progress</button>
              <button
                onClick={() => applyBulk('resolved')}
                disabled={selected.size === 0}
                className="px-3 py-1.5 rounded-full bg-secondary-fixed text-on-secondary-fixed text-label-bold font-label-bold disabled:opacity-40"
              >Mark Resolved</button>
              <button
                onClick={() => applyBulk('rejected')}
                disabled={selected.size === 0}
                className="px-3 py-1.5 rounded-full bg-error-container text-on-error-container text-label-bold font-label-bold disabled:opacity-40"
              >Reject</button>
              <button
                onClick={exportCsv}
                className="px-3 py-1.5 rounded-full bg-primary text-on-primary text-label-bold font-label-bold flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-[16px]">download</span>
                CSV
              </button>
            </div>
          </div>
        </section>

        {error && (
          <div className="bg-error-container text-on-error-container px-md py-sm rounded-lg text-label-sm font-label-sm" role="alert">
            {error}
          </div>
        )}

        {view === 'map' ? (
          <section className="bg-surface-container-lowest border border-outline-variant rounded-xl p-md flex flex-col gap-sm">
            <div className="flex items-center justify-between">
              <span className="font-label-bold text-label-bold text-on-surface">Geographic view</span>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={heatmap}
                  onChange={(e) => setHeatmap(e.target.checked)}
                  className="w-4 h-4 accent-[#6c0028]"
                />
                <span className="font-label-sm text-label-sm">Heatmap</span>
              </label>
            </div>
            <TicketsMap
              tickets={filtered}
              heatmap={heatmap}
              colorMode="status"
              height={520}
              onSelect={setActiveTicket}
            />
          </section>
        ) : (
          <section>
            {loading && tickets.length === 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-md">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="bg-surface-container-lowest border border-outline-variant rounded-lg p-md animate-pulse h-[140px]" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-xl text-center">
                <p className="font-body-lg text-body-lg text-on-surface mb-xs">No tickets match these filters.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-md">
                {filtered.map((t) => (
                  <button
                    key={t.ticket_id}
                    type="button"
                    onClick={() => setActiveTicket(t)}
                    className="text-left bg-surface-container-lowest border border-outline-variant rounded-lg p-md shadow-[0_4px_10px_rgba(0,0,0,0.02)] flex flex-col gap-sm hover:border-primary/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <div className="flex justify-between items-start gap-sm">
                      <div className="flex items-center gap-sm min-w-0">
                        <input
                          type="checkbox"
                          checked={selected.has(t.ticket_id)}
                          onClick={(e) => e.stopPropagation()}
                          onChange={() => toggleSelect(t.ticket_id)}
                          className="w-4 h-4 accent-[#6c0028] mt-1"
                        />
                        <div className="bg-surface-container p-2 rounded-full text-primary shrink-0">
                          <span className="material-symbols-outlined">{CATEGORY_ICON[t.category] || 'report'}</span>
                        </div>
                        <div className="min-w-0">
                          <span className="text-label-sm font-label-sm text-on-surface-variant block truncate">#{t.ticket_id}</span>
                          <h4 className="text-body-lg font-body-lg text-on-background font-semibold truncate">
                            {CATEGORY_LABEL[t.category] || t.category}
                          </h4>
                        </div>
                      </div>
                      <span className={`shrink-0 px-2 py-1 rounded-full text-label-sm font-label-sm font-medium capitalize ${STATUS_STYLES[t.status] || ''}`}>
                        {(t.status || '').replace(/_/g, ' ')}
                      </span>
                    </div>
                    {t.description && (
                      <p dir="auto" className="text-body-md text-on-surface-variant line-clamp-2">{t.description}</p>
                    )}
                    <div className="flex justify-between items-center mt-1 pt-1 border-t border-surface-variant gap-sm">
                      <span className="text-label-sm font-label-sm text-on-surface-variant flex items-center gap-1 truncate">
                        <span className="material-symbols-outlined text-[16px]">person</span>
                        <span className="truncate">{t.user_email}</span>
                      </span>
                      <span className="text-label-sm font-label-sm text-on-surface-variant flex items-center gap-1 shrink-0">
                        <span className="material-symbols-outlined text-[16px]">schedule</span>
                        {relTime(t.created_at)}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>
        )}
      </main>

      {activeTicket && (
        <TicketDrawer
          key={activeTicket.ticket_id}
          token={token}
          ticket={activeTicket}
          onClose={() => setActiveTicket(null)}
          onUpdated={(t) => {
            setActiveTicket(t);
            setTickets((prev) => prev.map((x) => x.ticket_id === t.ticket_id ? t : x));
          }}
        />
      )}

      <nav
        className="md:hidden fixed bottom-0 w-full z-50 flex justify-around items-stretch bg-surface-container-lowest border-t border-outline-variant"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <button onClick={() => setView('list')} className={`flex-1 min-h-[56px] flex flex-col items-center justify-center ${view === 'list' ? 'text-primary' : 'text-on-surface-variant'}`}>
          <span className="material-symbols-outlined">list</span>
          <span className="text-[11px] font-medium">List</span>
        </button>
        <button onClick={() => setView('map')} className={`flex-1 min-h-[56px] flex flex-col items-center justify-center ${view === 'map' ? 'text-primary' : 'text-on-surface-variant'}`}>
          <span className="material-symbols-outlined">map</span>
          <span className="text-[11px] font-medium">Map</span>
        </button>
        {isSuperAdmin && (
          <button onClick={() => navigate('/admin/users')} className="flex-1 min-h-[56px] flex flex-col items-center justify-center text-on-surface-variant">
            <span className="material-symbols-outlined">group</span>
            <span className="text-[11px] font-medium">Users</span>
          </button>
        )}
      </nav>
    </div>
  );
}

function StatTile({ label, value, icon }) {
  return (
    <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-md flex items-center gap-md">
      <div className="w-10 h-10 rounded-full bg-primary-container/40 flex items-center justify-center text-primary">
        <span className="material-symbols-outlined">{icon}</span>
      </div>
      <div className="flex flex-col">
        <span className="font-label-sm text-label-sm text-on-surface-variant">{label}</span>
        <span className="text-headline-md font-headline-md text-on-surface">{value ?? 0}</span>
      </div>
    </div>
  );
}

function TicketDrawer({ token, ticket, onClose, onUpdated }) {
  const [status, setStatus] = useState(ticket.status);
  const [note, setNote] = useState('');
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const fileRef = useRef(null);

  // Drawer is keyed by ticket_id from the parent so there's no need to reset
  // these via an effect when switching tickets.

  async function handleSave() {
    setBusy(true);
    setErr('');
    try {
      let resolution_photo = null;
      if (status === 'resolved' && photoFile) {
        resolution_photo = await fileToDataUrl(photoFile);
      }
      const updated = await adminUpdateTicket(token, ticket.ticket_id, {
        status, note, resolution_photo,
      });
      onUpdated(updated);
    } catch (e) {
      setErr(e.message || 'Update failed.');
    } finally {
      setBusy(false);
    }
  }

  function pickPhoto(e) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (f.size > 1_000_000) {
      setErr('Photo too large (max ~1 MB). Try a smaller image.');
      return;
    }
    setPhotoFile(f);
    setPhotoPreview(URL.createObjectURL(f));
  }

  return (
    <div className="fixed inset-0 z-50 flex" role="dialog" aria-modal="true">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="flex-1 bg-black/40 backdrop-blur-sm"
      />
      <aside className="w-full max-w-lg bg-surface-container-lowest h-full overflow-y-auto shadow-2xl flex flex-col">
        <header className="px-margin-mobile py-md border-b border-outline-variant flex items-center justify-between sticky top-0 bg-surface-container-lowest z-10">
          <div className="min-w-0">
            <span className="text-label-sm font-label-sm text-on-surface-variant block">Ticket</span>
            <h3 className="text-headline-md font-headline-md text-on-surface truncate">#{ticket.ticket_id}</h3>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full hover:bg-surface-container flex items-center justify-center"
            aria-label="Close"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </header>

        <div className="px-margin-mobile py-md flex flex-col gap-md flex-1">
          <div className="flex items-center gap-sm">
            <span className="material-symbols-outlined text-primary">{CATEGORY_ICON[ticket.category] || 'report'}</span>
            <span className="font-body-lg font-medium">{CATEGORY_LABEL[ticket.category] || ticket.category}</span>
            <span className={`ml-auto px-2 py-1 rounded-full text-label-sm capitalize ${STATUS_STYLES[ticket.status] || ''}`}>
              {(ticket.status || '').replace(/_/g, ' ')}
            </span>
          </div>

          <dl className="grid grid-cols-2 gap-sm text-label-sm">
            <Item label="Severity" value={<span className="capitalize">{ticket.severity}</span>} />
            <Item label="Department" value={ticket.department} />
            <Item label="Reporter" value={ticket.user_email} />
            <Item label="Submitted" value={ticket.created_at ? new Date(ticket.created_at).toLocaleString() : '—'} />
            <Item
              label="Location"
              value={ticket.location?.latitude != null ? (
                <a
                  className="text-primary hover:underline"
                  href={`https://www.google.com/maps?q=${ticket.location.latitude},${ticket.location.longitude}`}
                  target="_blank" rel="noopener noreferrer"
                  title={`${Number(ticket.location.latitude).toFixed(5)}, ${Number(ticket.location.longitude).toFixed(5)}`}
                >
                  {ticket.address || `${Number(ticket.location.latitude).toFixed(5)}, ${Number(ticket.location.longitude).toFixed(5)}`}
                </a>
              ) : '—'}
            />
          </dl>

          {ticket.photo && (
            <img src={ticket.photo} alt="" className="rounded-xl w-full object-cover max-h-[280px] border border-outline-variant" />
          )}

          {ticket.description && (
            <div className="bg-surface-container rounded-lg p-sm">
              <span className="font-label-sm text-on-surface-variant">Description</span>
              <p dir="auto" className="font-body-md text-on-surface mt-1 whitespace-pre-wrap">{ticket.description}</p>
            </div>
          )}

          {ticket.expected_resolution_at && (
            <div className="flex items-center gap-sm bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-sm py-2">
              <span className="material-symbols-outlined">timer</span>
              <span className="font-label-bold">Expected by</span>
              <span className="font-body-md">{new Date(ticket.expected_resolution_at).toLocaleString()}</span>
            </div>
          )}

          <div>
            <span className="font-label-bold text-label-bold text-on-surface mb-sm block">History</span>
            <StatusTimeline ticket={ticket} />
          </div>

          {/* Update form */}
          <div className="border-t border-outline-variant pt-md flex flex-col gap-sm">
            <span className="font-label-bold text-label-bold text-on-surface">Update status</span>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="px-3 py-2 bg-surface-container rounded-lg border border-outline-variant font-body-md outline-none focus:ring-2 focus:ring-primary"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optional note for the audit log"
              rows={2}
              className="px-3 py-2 bg-surface-container rounded-lg border border-outline-variant font-body-md outline-none focus:ring-2 focus:ring-primary resize-none"
            />
            {status === 'resolved' && (
              <div className="flex flex-col gap-xs">
                <span className="font-label-sm text-label-sm text-on-surface-variant">Resolution photo (optional, max ~1 MB)</span>
                <div className="flex items-center gap-sm">
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="px-3 py-2 rounded-full bg-surface-container border border-outline-variant text-label-bold font-label-bold flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-[16px]">add_a_photo</span>
                    {photoFile ? 'Change' : 'Upload'}
                  </button>
                  {photoPreview && (
                    <img src={photoPreview} alt="" className="h-12 w-12 rounded-lg object-cover border border-outline-variant" />
                  )}
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={pickPhoto} />
                </div>
              </div>
            )}
            {err && <p className="text-error font-label-sm" role="alert">{err}</p>}
            <button
              onClick={handleSave}
              disabled={busy || (status === ticket.status && !note && !photoFile)}
              className="bg-primary text-on-primary px-lg py-3 rounded-full font-label-bold disabled:opacity-50"
            >
              {busy ? 'Saving…' : 'Save changes'}
            </button>
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
