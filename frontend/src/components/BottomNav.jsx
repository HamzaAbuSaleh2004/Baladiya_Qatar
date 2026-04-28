import { useNavigate, useLocation } from 'react-router-dom';
import { useApp } from '../AppContext';
import { useI18n } from '../i18n';

export default function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAdmin } = useApp();
  const { t } = useI18n();

  const items = [
    { path: '/',         icon: 'home',         filled: 'home',         label: t('home') },
    { path: '/capture',  icon: 'add_a_photo',  filled: 'add_a_photo',  label: t('report') },
    { path: '/tickets',  icon: 'receipt_long', filled: 'receipt_long', label: t('tickets') },
    { path: '/profile',  icon: 'person',       filled: 'person',       label: t('profile') },
  ];
  if (isAdmin) {
    items.splice(3, 0, { path: '/admin', icon: 'shield_person', filled: 'shield_person', label: t('admin') });
  }

  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-50 flex justify-around items-stretch bg-surface-container-lowest border-t border-outline-variant shadow-[0_-2px_10px_rgba(0,0,0,0.05)]"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {items.map((it) => {
        const active = location.pathname === it.path;
        return (
          <button
            key={it.path}
            type="button"
            onClick={() => navigate(it.path)}
            className={`flex-1 min-h-[56px] flex flex-col items-center justify-center transition-colors ${
              active ? 'text-primary' : 'text-on-surface-variant'
            }`}
          >
            <span className={`material-symbols-outlined ${active ? 'icon-fill' : ''}`}>{active ? it.filled : it.icon}</span>
            <span className="text-[11px] font-medium">{it.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
