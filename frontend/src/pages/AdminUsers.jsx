import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useApp } from '../AppContext';
import {
  adminCreateUser,
  adminDeleteUser,
  adminListUsers,
  adminUpdateUser,
} from '../api';

const ROLE_LABEL = {
  citizen: 'Citizen',
  admin: 'Department Admin',
  super_admin: 'Super Admin',
};

const ROLE_STYLES = {
  citizen: 'bg-surface-variant text-on-surface-variant',
  admin: 'bg-tertiary-fixed text-on-tertiary-fixed',
  super_admin: 'bg-primary text-on-primary',
};

export default function AdminUsers() {
  const navigate = useNavigate();
  const { token, signOut } = useApp();

  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showCreate, setShowCreate] = useState(false);

  const refresh = useCallback(() => {
    if (!token) return Promise.resolve();
    const work = adminListUsers(token);
    work
      .then((res) => {
        setUsers(res.users || []);
        setDepartments(res.departments || []);
        setError('');
      })
      .catch((err) => {
        setError(err.message || 'Failed to load users.');
        if (err.status === 401) signOut();
        if (err.status === 403) navigate('/admin', { replace: true });
      })
      .finally(() => setLoading(false));
    return work;
  }, [token, signOut, navigate]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    adminListUsers(token)
      .then((res) => {
        if (cancelled) return;
        setUsers(res.users || []);
        setDepartments(res.departments || []);
        setError('');
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message || 'Failed to load users.');
        if (err.status === 401) signOut();
        if (err.status === 403) navigate('/admin', { replace: true });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [token, signOut, navigate]);

  async function handleDelete(email) {
    if (!window.confirm(`Delete user ${email}? This cannot be undone.`)) return;
    try {
      await adminDeleteUser(token, email);
      await refresh();
    } catch (err) {
      alert(err.message || 'Delete failed.');
    }
  }

  async function handleRoleChange(email, role, department) {
    try {
      await adminUpdateUser(token, email, { role, department });
      await refresh();
    } catch (err) {
      alert(err.message || 'Update failed.');
    }
  }

  return (
    <div className="bg-background min-h-screen flex flex-col font-body-md text-body-md text-on-surface antialiased">
      <header className="bg-surface-container-lowest font-['Public_Sans'] sticky top-0 z-40 border-b border-outline-variant">
        <div className="flex justify-between items-center px-margin-mobile h-16 w-full max-w-container-max mx-auto">
          <div className="flex items-center gap-3 min-w-0">
            <Link to="/admin" className="w-10 h-10 rounded-full hover:bg-surface-container flex items-center justify-center" aria-label="Back">
              <span className="material-symbols-outlined">arrow_back</span>
            </Link>
            <span className="text-xl font-bold text-primary">User Management</span>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="bg-primary text-on-primary rounded-full px-4 py-2 text-label-bold font-label-bold flex items-center gap-1 shadow-sm active:scale-95 transition-transform"
          >
            <span className="material-symbols-outlined text-[18px]">person_add</span>
            <span className="hidden sm:inline">New user</span>
          </button>
        </div>
      </header>

      <main className="flex-grow px-margin-mobile md:px-gutter max-w-container-max mx-auto w-full pt-gutter pb-xl space-y-lg">
        <section>
          <h2 className="text-headline-md font-headline-md text-on-background mb-xs">All accounts</h2>
          <p className="font-body-md text-on-surface-variant">
            Department admins see only tickets routed to their department. Super admins see everything.
          </p>
        </section>

        {error && (
          <div className="bg-error-container text-on-error-container px-md py-sm rounded-lg text-label-sm" role="alert">{error}</div>
        )}

        {loading ? (
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-xl text-center text-on-surface-variant">Loading…</div>
        ) : users.length === 0 ? (
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-xl text-center text-on-surface-variant">No users.</div>
        ) : (
          <ul className="bg-surface-container-lowest border border-outline-variant rounded-xl divide-y divide-outline-variant overflow-hidden">
            {users.map((u) => (
              <li key={u.email} className="px-md py-sm flex flex-col md:flex-row md:items-center gap-sm">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-body-lg font-medium truncate">{u.email}</span>
                    <span className={`px-2 py-0.5 rounded-full text-label-sm font-label-bold ${ROLE_STYLES[u.role] || 'bg-surface-variant'}`}>
                      {ROLE_LABEL[u.role] || u.role}
                    </span>
                  </div>
                  <span className="font-label-sm text-on-surface-variant">
                    {u.department || (u.role === 'citizen' ? '—' : 'No department')}
                    {u.created_at ? ` · joined ${new Date(u.created_at).toLocaleDateString()}` : ''}
                  </span>
                </div>
                <div className="flex flex-wrap gap-xs">
                  {u.role !== 'super_admin' && (
                    <>
                      <select
                        value={u.role || 'citizen'}
                        onChange={(e) => handleRoleChange(u.email, e.target.value, e.target.value === 'admin' ? (u.department || departments[0] || '') : null)}
                        className="px-2 py-1 bg-surface-container rounded border border-outline-variant text-label-sm"
                      >
                        <option value="citizen">Citizen</option>
                        <option value="admin">Dept admin</option>
                      </select>
                      {(u.role === 'admin') && (
                        <select
                          value={u.department || ''}
                          onChange={(e) => handleRoleChange(u.email, 'admin', e.target.value)}
                          className="px-2 py-1 bg-surface-container rounded border border-outline-variant text-label-sm"
                        >
                          <option value="" disabled>Pick department</option>
                          {departments.map((d) => <option key={d} value={d}>{d}</option>)}
                        </select>
                      )}
                      <button
                        onClick={() => handleDelete(u.email)}
                        className="px-2 py-1 rounded bg-error-container text-on-error-container text-label-sm font-label-bold"
                      >
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>

      {showCreate && (
        <CreateUserModal
          token={token}
          departments={departments}
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); refresh(); }}
        />
      )}
    </div>
  );
}

function CreateUserModal({ token, departments, onClose, onCreated }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('admin');
  const [department, setDepartment] = useState(departments[0] || '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setErr('');
    try {
      await adminCreateUser(token, {
        email: email.trim().toLowerCase(),
        password,
        role,
        department: role === 'admin' ? department : null,
      });
      onCreated();
    } catch (e2) {
      setErr(e2.message || 'Failed to create user.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" role="dialog" aria-modal="true">
      <form
        onSubmit={submit}
        className="bg-surface-container-lowest rounded-2xl shadow-2xl w-full max-w-md p-lg flex flex-col gap-md"
      >
        <div className="flex justify-between items-center">
          <h3 className="text-headline-md font-headline-md text-on-surface">New user</h3>
          <button type="button" onClick={onClose} className="w-9 h-9 rounded-full hover:bg-surface-container flex items-center justify-center" aria-label="Close">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <label className="flex flex-col gap-1">
          <span className="font-label-bold text-label-bold text-on-surface-variant">Email</span>
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required className="px-3 py-2 bg-surface-container rounded-lg border border-outline-variant outline-none focus:ring-2 focus:ring-primary" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-label-bold text-label-bold text-on-surface-variant">Password</span>
          <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" minLength={6} required className="px-3 py-2 bg-surface-container rounded-lg border border-outline-variant outline-none focus:ring-2 focus:ring-primary" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-label-bold text-label-bold text-on-surface-variant">Role</span>
          <select value={role} onChange={(e) => setRole(e.target.value)} className="px-3 py-2 bg-surface-container rounded-lg border border-outline-variant outline-none focus:ring-2 focus:ring-primary">
            <option value="admin">Department admin</option>
            <option value="citizen">Citizen</option>
          </select>
        </label>
        {role === 'admin' && (
          <label className="flex flex-col gap-1">
            <span className="font-label-bold text-label-bold text-on-surface-variant">Department</span>
            <select value={department} onChange={(e) => setDepartment(e.target.value)} required className="px-3 py-2 bg-surface-container rounded-lg border border-outline-variant outline-none focus:ring-2 focus:ring-primary">
              {departments.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </label>
        )}
        {err && <p className="text-error font-label-sm" role="alert">{err}</p>}
        <div className="flex gap-sm justify-end">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-full border border-outline text-on-surface">Cancel</button>
          <button type="submit" disabled={busy} className="px-4 py-2 rounded-full bg-primary text-on-primary font-label-bold disabled:opacity-50">
            {busy ? 'Creating…' : 'Create'}
          </button>
        </div>
      </form>
    </div>
  );
}
