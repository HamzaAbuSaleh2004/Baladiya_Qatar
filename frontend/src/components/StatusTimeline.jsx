const STEP_ORDER = ['investigating', 'in_progress', 'resolved'];

const STEP_META = {
  investigating: { label: 'Investigating',  icon: 'search'  },
  in_progress:   { label: 'In Progress',    icon: 'engineering' },
  resolved:      { label: 'Resolved',       icon: 'verified' },
  rejected:      { label: 'Rejected',       icon: 'block'   },
};

function fmt(ts) {
  if (!ts) return '';
  try {
    return new Date(ts).toLocaleString();
  } catch { return ''; }
}

export default function StatusTimeline({ ticket }) {
  if (!ticket) return null;
  const history = Array.isArray(ticket.history) ? ticket.history : [];
  const current = ticket.status || 'investigating';
  const isRejected = current === 'rejected';

  // Use the visible flow steps (or rejection-only).
  const flow = isRejected ? ['investigating', 'rejected'] : STEP_ORDER;

  // Map status → most-recent history entry (for timestamps + photo).
  const lastEntryByStatus = {};
  for (const h of history) {
    lastEntryByStatus[h.status] = h;
  }

  const currentIdx = flow.indexOf(current);

  return (
    <ol className="relative pl-6">
      <span aria-hidden className="absolute left-2.5 top-2 bottom-2 w-px bg-outline-variant" />
      {flow.map((step, idx) => {
        const meta = STEP_META[step] || { label: step, icon: 'circle' };
        const reached = idx <= currentIdx && currentIdx !== -1;
        const isCurrent = idx === currentIdx;
        const entry = lastEntryByStatus[step];
        return (
          <li key={step} className="relative pb-md last:pb-0">
            <span
              aria-hidden
              className={`absolute -left-6 top-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center text-[12px] ${
                reached ? 'bg-primary border-primary text-on-primary' : 'bg-surface-container border-outline-variant text-on-surface-variant'
              } ${isCurrent ? 'ring-4 ring-primary/15' : ''}`}
            >
              <span className="material-symbols-outlined text-[12px]">{meta.icon}</span>
            </span>
            <div className="flex flex-col gap-0.5">
              <span className={`font-label-bold text-label-bold ${reached ? 'text-on-surface' : 'text-on-surface-variant'}`}>
                {meta.label}
              </span>
              {entry?.at && (
                <span className="font-label-sm text-label-sm text-on-surface-variant">
                  {fmt(entry.at)}{entry.by ? ` · ${entry.by}` : ''}
                </span>
              )}
              {entry?.note && (
                <span dir="auto" className="font-body-md text-body-md text-on-surface-variant">
                  {entry.note}
                </span>
              )}
              {entry?.resolution_photo && step === 'resolved' && (
                <a
                  href={entry.resolution_photo}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-xs inline-block"
                >
                  <img
                    src={entry.resolution_photo}
                    alt="Resolution evidence"
                    className="rounded-lg border border-outline-variant max-h-[180px]"
                  />
                </a>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
