/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { getTickets } from './api';

const AppContext = createContext(null);

const LS_KEY = 'baladiya.app.v3';

function readPersisted() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return { email: '', token: '', role: '', department: '' };
    const saved = JSON.parse(raw);
    return {
      email: saved.email || '',
      token: saved.token || '',
      role: saved.role || '',
      department: saved.department || '',
    };
  } catch {
    return { email: '', token: '', role: '', department: '' };
  }
}

export function AppProvider({ children }) {
  const initial = readPersisted();
  const [email, setEmail] = useState(initial.email);
  const [token, setToken] = useState(initial.token);
  const [role, setRole] = useState(initial.role);
  const [department, setDepartment] = useState(initial.department);
  const [tickets, setTickets] = useState([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [ticketsError, setTicketsError] = useState('');

  const [report, setReport] = useState({
    sessionId: null,
    image: null,
    imagePreview: null,
    gps: null,
    messages: [],
    ticket: null,
  });

  useEffect(() => {
    localStorage.setItem(LS_KEY, JSON.stringify({ email, token, role, department }));
  }, [email, token, role, department]);

  const refreshTickets = useCallback(() => {
    if (!token) return Promise.resolve();
    setTicketsLoading(true);
    setTicketsError('');
    return getTickets(token)
      .then((res) => setTickets(Array.isArray(res.tickets) ? res.tickets : []))
      .catch((err) => {
        setTicketsError(err.message || 'Could not load tickets.');
        if (err.status === 401) {
          setEmail(''); setToken(''); setRole(''); setDepartment('');
          setTickets([]);
        }
      })
      .finally(() => setTicketsLoading(false));
  }, [token]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    getTickets(token)
      .then((res) => {
        if (cancelled) return;
        setTickets(Array.isArray(res.tickets) ? res.tickets : []);
        setTicketsError('');
      })
      .catch((err) => {
        if (cancelled) return;
        setTicketsError(err.message || 'Could not load tickets.');
        if (err.status === 401) {
          setEmail(''); setToken(''); setRole(''); setDepartment('');
          setTickets([]);
        }
      })
      .finally(() => {
        if (!cancelled) setTicketsLoading(false);
      });
    return () => { cancelled = true; };
  }, [token]);

  function resetReport() {
    if (report.imagePreview) URL.revokeObjectURL(report.imagePreview);
    setReport({ sessionId: null, image: null, imagePreview: null, gps: null, messages: [], ticket: null });
  }

  function addTicket(t) {
    setTickets((prev) => {
      if (prev.some((x) => x.ticket_id === t.ticket_id)) return prev;
      return [t, ...prev];
    });
  }

  function signIn({ email: e, token: tk, role: r, department: d }) {
    setEmail(e);
    setToken(tk);
    setRole(r || 'citizen');
    setDepartment(d || '');
  }

  function signOut() {
    setEmail('');
    setToken('');
    setRole('');
    setDepartment('');
    setTickets([]);
    resetReport();
    localStorage.removeItem(LS_KEY);
  }

  const isAdmin = role === 'admin' || role === 'super_admin';
  const isSuperAdmin = role === 'super_admin';

  return (
    <AppContext.Provider
      value={{
        email, token, role, department, isAdmin, isSuperAdmin,
        signIn, signOut,
        tickets, ticketsLoading, ticketsError, refreshTickets, addTicket,
        report, setReport, resetReport,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside <AppProvider>');
  return ctx;
}
