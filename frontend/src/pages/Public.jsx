import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getPublicTickets } from '../api';
import TicketsMap from '../components/TicketsMap';

const CATEGORY_LABEL = {
  pothole: 'Pothole / Road',
  falling_tree: 'Tree Hazard',
};

export default function Public() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [heatmap, setHeatmap] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    let cancelled = false;
    getPublicTickets()
      .then((res) => {
        if (cancelled) return;
        setTickets(res.tickets || []);
        setError('');
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message || 'Could not load public tickets.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => tickets.filter((t) => {
    if (categoryFilter && t.category !== categoryFilter) return false;
    if (statusFilter && t.status !== statusFilter) return false;
    return true;
  }), [tickets, categoryFilter, statusFilter]);

  const counts = useMemo(() => {
    const out = { total: tickets.length, resolved: 0, in_progress: 0, investigating: 0 };
    for (const t of tickets) {
      if (t.status in out) out[t.status] += 1;
    }
    return out;
  }, [tickets]);

  const resolutionRate = counts.total > 0 ? Math.round((counts.resolved / counts.total) * 100) : 0;

  return (
    <div className="bg-background min-h-screen flex flex-col font-body-md text-body-md text-on-surface antialiased">
      <header className="bg-surface-container-lowest border-b border-outline-variant sticky top-0 z-40">
        <div className="px-margin-mobile h-16 max-w-container-max mx-auto w-full flex justify-between items-center">
          <div className="flex items-center gap-3">
            <span className="text-xl font-bold text-primary">Baladiya</span>
            <span className="hidden sm:inline-flex items-center gap-1 bg-secondary-fixed/40 text-on-secondary-fixed text-label-sm font-label-bold px-2.5 py-1 rounded-full">
              <span className="material-symbols-outlined text-[14px]">public</span>
              Transparency
            </span>
          </div>
          <Link to="/auth" className="text-primary text-label-bold font-label-bold hover:underline">Sign in</Link>
        </div>
      </header>

      <main className="flex-1 px-margin-mobile md:px-gutter max-w-container-max mx-auto w-full pt-gutter pb-xl space-y-lg">
        <section>
          <h1 className="text-headline-lg font-headline-lg text-on-background mb-xs">Civic issues across Qatar</h1>
          <p className="font-body-md text-on-surface-variant">
            Anonymized, real-time view of citizen reports and how the city is responding.
          </p>
        </section>

        <section className="grid grid-cols-2 md:grid-cols-4 gap-md">
          <Tile label="Total reports" value={counts.total} icon="forum" />
          <Tile label="Resolved" value={counts.resolved} icon="verified" />
          <Tile label="In progress" value={counts.in_progress} icon="engineering" />
          <Tile label="Resolution rate" value={`${resolutionRate}%`} icon="trending_up" />
        </section>

        <section className="bg-surface-container-lowest border border-outline-variant rounded-xl p-md flex flex-col gap-sm">
          <div className="flex flex-wrap gap-sm items-center">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-2 bg-surface-container rounded-full border border-outline-variant text-body-md outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">All categories</option>
              <option value="pothole">Potholes</option>
              <option value="falling_tree">Tree hazards</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 bg-surface-container rounded-full border border-outline-variant text-body-md outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">All statuses</option>
              <option value="investigating">Investigating</option>
              <option value="in_progress">In progress</option>
              <option value="resolved">Resolved</option>
            </select>
            <label className="flex items-center gap-2 ml-auto cursor-pointer select-none">
              <input
                type="checkbox"
                checked={heatmap}
                onChange={(e) => setHeatmap(e.target.checked)}
                className="w-4 h-4 accent-[#6c0028]"
              />
              <span className="font-label-sm text-label-sm">Heatmap</span>
            </label>
          </div>
          {loading ? (
            <div className="h-[420px] rounded-xl bg-surface-container animate-pulse" />
          ) : (
            <TicketsMap tickets={filtered} heatmap={heatmap} colorMode="status" height={520} />
          )}
        </section>

        <section>
          <h2 className="text-headline-md font-headline-md text-on-background mb-sm">By category</h2>
          {loading ? (
            <div className="grid grid-cols-2 gap-md">
              <div className="h-24 rounded-xl bg-surface-container animate-pulse" />
              <div className="h-24 rounded-xl bg-surface-container animate-pulse" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
              {['pothole', 'falling_tree'].map((cat) => {
                const list = tickets.filter((t) => t.category === cat);
                const resolved = list.filter((t) => t.status === 'resolved').length;
                const open = list.length - resolved;
                return (
                  <div key={cat} className="bg-surface-container-lowest border border-outline-variant rounded-xl p-md flex flex-col gap-xs">
                    <span className="font-label-bold text-label-bold text-primary">{CATEGORY_LABEL[cat]}</span>
                    <span className="text-headline-md font-headline-md">{list.length}</span>
                    <span className="font-label-sm text-on-surface-variant">{resolved} resolved · {open} open</span>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {error && (
          <div className="bg-error-container text-on-error-container px-md py-sm rounded-lg text-label-sm" role="alert">{error}</div>
        )}
      </main>

      <footer className="border-t border-outline-variant text-center py-md text-label-sm text-on-surface-variant">
        Live data, anonymized · Personal information removed.
      </footer>
    </div>
  );
}

function Tile({ label, value, icon }) {
  return (
    <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-md flex items-center gap-md">
      <div className="w-10 h-10 rounded-full bg-primary-container/40 flex items-center justify-center text-primary">
        <span className="material-symbols-outlined">{icon}</span>
      </div>
      <div className="flex flex-col min-w-0">
        <span className="font-label-sm text-label-sm text-on-surface-variant truncate">{label}</span>
        <span className="text-headline-md font-headline-md text-on-surface">{value}</span>
      </div>
    </div>
  );
}
