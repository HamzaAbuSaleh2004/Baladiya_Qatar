import { useEffect, useMemo, useRef, useState } from 'react';
import { CATEGORIES } from '../categories';
import { useI18n } from '../i18n';

// Paged horizontal scroller. Shows ~4 tiles on mobile, more on wider screens.
// "See all" expands to a full grid.
export default function CategoryCarousel({ onPick }) {
  const { t, lang } = useI18n();
  const trackRef = useRef(null);
  const [page, setPage] = useState(0);
  const [pageCount, setPageCount] = useState(1);
  const [showAll, setShowAll] = useState(false);

  const items = useMemo(() => CATEGORIES, []);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const update = () => {
      const w = el.clientWidth || 1;
      setPageCount(Math.max(1, Math.ceil(el.scrollWidth / w)));
      setPage(Math.round(el.scrollLeft / w));
    };
    update();
    el.addEventListener('scroll', update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', update);
      ro.disconnect();
    };
  }, []);

  function scrollByPages(delta) {
    const el = trackRef.current;
    if (!el) return;
    el.scrollBy({ left: el.clientWidth * delta * (lang === 'ar' ? -1 : 1), behavior: 'smooth' });
  }

  return (
    <section className="flex flex-col gap-sm">
      <div className="flex justify-between items-center">
        <h3 className="text-label-bold font-label-bold text-on-surface-variant uppercase tracking-wider">
          {t('quickCategories')}
        </h3>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => scrollByPages(-1)}
            disabled={page === 0}
            className="w-8 h-8 rounded-full border border-outline-variant flex items-center justify-center text-on-surface-variant disabled:opacity-30 hover:bg-surface-container"
            aria-label="Previous"
          >
            <span className="material-symbols-outlined text-[18px]">{lang === 'ar' ? 'chevron_right' : 'chevron_left'}</span>
          </button>
          <button
            type="button"
            onClick={() => scrollByPages(1)}
            disabled={page >= pageCount - 1}
            className="w-8 h-8 rounded-full border border-outline-variant flex items-center justify-center text-on-surface-variant disabled:opacity-30 hover:bg-surface-container"
            aria-label="Next"
          >
            <span className="material-symbols-outlined text-[18px]">{lang === 'ar' ? 'chevron_left' : 'chevron_right'}</span>
          </button>
          <button
            type="button"
            onClick={() => setShowAll(true)}
            className="ml-2 text-primary text-label-bold font-label-bold hover:underline"
          >
            {t('seeAll')}
          </button>
        </div>
      </div>

      <div
        ref={trackRef}
        className="flex gap-sm overflow-x-auto scroll-smooth snap-x snap-mandatory pb-1 -mx-1 px-1 [&::-webkit-scrollbar]:hidden [scrollbar-width:none]"
      >
        {items.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => onPick?.(c)}
            className="snap-start shrink-0 basis-[calc((100%-1rem)/4)] sm:basis-[calc((100%-2rem)/6)] md:basis-[calc((100%-3rem)/8)] flex flex-col items-center gap-1 p-2 rounded-xl bg-surface-container-lowest border border-outline-variant hover:border-primary/40 transition-colors"
          >
            <div className="w-12 h-12 rounded-full bg-primary-container/30 text-primary flex items-center justify-center">
              <span className="material-symbols-outlined">{c.icon}</span>
            </div>
            <span className="text-[11px] leading-tight font-medium text-on-surface text-center line-clamp-2 min-h-[28px]">
              {lang === 'ar' ? c.ar : c.en}
            </span>
          </button>
        ))}
      </div>

      {showAll && (
        <FullCategoriesModal
          items={items}
          onClose={() => setShowAll(false)}
          onPick={(c) => { setShowAll(false); onPick?.(c); }}
        />
      )}
    </section>
  );
}

function FullCategoriesModal({ items, onClose, onPick }) {
  const { t, lang } = useI18n();
  // Group by `group` field, preserving first-seen order.
  const groups = useMemo(() => {
    const seen = [];
    const map = new Map();
    for (const c of items) {
      const g = c.group || 'Other';
      if (!map.has(g)) { map.set(g, []); seen.push(g); }
      map.get(g).push(c);
    }
    return seen.map((g) => ({ name: g, items: map.get(g) }));
  }, [items]);

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-stretch justify-end" role="dialog" aria-modal="true">
      <button type="button" aria-label="Close" onClick={onClose} className="flex-1" />
      <aside className="w-full sm:max-w-2xl bg-surface-container-lowest h-full overflow-y-auto shadow-2xl">
        <header className="px-margin-mobile py-md border-b border-outline-variant flex items-center justify-between sticky top-0 bg-surface-container-lowest z-10">
          <h3 className="text-headline-md font-headline-md text-on-surface">{t('quickCategories')}</h3>
          <button onClick={onClose} className="w-10 h-10 rounded-full hover:bg-surface-container flex items-center justify-center" aria-label="Close">
            <span className="material-symbols-outlined">close</span>
          </button>
        </header>
        <div className="px-margin-mobile py-md flex flex-col gap-lg">
          {groups.map((g) => (
            <section key={g.name} className="flex flex-col gap-sm">
              <h4 className="font-label-bold text-label-bold text-on-surface-variant uppercase tracking-wider">{g.name}</h4>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-sm">
                {g.items.map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => onPick(c)}
                    className="flex flex-col items-center gap-1 p-3 rounded-xl bg-surface-container border border-outline-variant hover:border-primary/40 transition-colors"
                  >
                    <div className="w-12 h-12 rounded-full bg-primary-container/40 text-primary flex items-center justify-center">
                      <span className="material-symbols-outlined">{c.icon}</span>
                    </div>
                    <span className="text-[11px] leading-tight font-medium text-on-surface text-center line-clamp-2 min-h-[28px]">
                      {lang === 'ar' ? c.ar : c.en}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      </aside>
    </div>
  );
}
