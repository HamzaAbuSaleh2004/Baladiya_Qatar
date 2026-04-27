import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../AppContext';
import { login, signup } from '../api';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Authentication() {
  const { signIn } = useApp();
  const navigate = useNavigate();

  const [mode, setMode] = useState('signin'); // 'signin' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const isSignup = mode === 'signup';

  function switchMode(next) {
    setMode(next);
    setError('');
    setConfirm('');
  }

  async function onSubmit(e) {
    e.preventDefault();
    const em = email.trim().toLowerCase();
    if (!EMAIL_RE.test(em)) {
      setError('Please enter a valid email address.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (isSignup && password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const res = isSignup ? await signup(em, password) : await login(em, password);
      signIn({ email: res.email, token: res.token });
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message || 'Could not authenticate. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-background min-h-screen flex items-center justify-center font-body-md text-body-md text-on-surface antialiased px-margin-mobile py-xl">
      <main className="w-full max-w-md">
        <div className="text-center mb-xl">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary-container text-on-primary-container mb-md shadow-sm">
            <span className="material-symbols-outlined text-4xl icon-fill">account_balance</span>
          </div>
          <h1 className="font-headline-xl text-headline-xl text-primary tracking-tight">Baladiya</h1>
          <p className="font-body-lg text-body-lg text-on-surface-variant mt-sm">Civic Services Portal</p>
        </div>

        <div className="bg-surface-container-lowest rounded-xl shadow-[0_4px_24px_rgba(0,0,0,0.04)] border border-surface-container-high p-lg md:p-xl w-full relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-primary-container" />

          <div role="tablist" className="flex bg-surface-container rounded-full p-1 mb-gutter">
            <button
              role="tab"
              aria-selected={!isSignup}
              onClick={() => switchMode('signin')}
              className={`flex-1 h-10 rounded-full text-label-bold font-label-bold transition-colors ${
                !isSignup ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              Sign In
            </button>
            <button
              role="tab"
              aria-selected={isSignup}
              onClick={() => switchMode('signup')}
              className={`flex-1 h-10 rounded-full text-label-bold font-label-bold transition-colors ${
                isSignup ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              Sign Up
            </button>
          </div>

          <h2 className="font-headline-md text-headline-md text-on-surface mb-md">
            {isSignup ? 'Create your account' : 'Welcome back'}
          </h2>

          <form onSubmit={onSubmit} className="space-y-md" noValidate>
            <div>
              <label className="block font-label-bold text-label-bold text-on-surface-variant mb-sm" htmlFor="email">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span className="material-symbols-outlined text-on-surface-variant/70 text-[20px]">mail</span>
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); if (error) setError(''); }}
                  placeholder="user@example.com"
                  className="block w-full pl-10 bg-[#F3F4F6] border border-[#D1D5DB] rounded-lg focus:ring-2 focus:ring-primary focus:border-primary font-body-md text-body-md text-on-surface h-12 outline-none px-3"
                />
              </div>
            </div>

            <div>
              <label className="block font-label-bold text-label-bold text-on-surface-variant mb-sm" htmlFor="password">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span className="material-symbols-outlined text-on-surface-variant/70 text-[20px]">lock</span>
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPwd ? 'text' : 'password'}
                  autoComplete={isSignup ? 'new-password' : 'current-password'}
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); if (error) setError(''); }}
                  placeholder={isSignup ? 'At least 6 characters' : 'Your password'}
                  className="block w-full pl-10 pr-12 bg-[#F3F4F6] border border-[#D1D5DB] rounded-lg focus:ring-2 focus:ring-primary focus:border-primary font-body-md text-body-md text-on-surface h-12 outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((v) => !v)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-on-surface-variant/70 hover:text-on-surface"
                  aria-label={showPwd ? 'Hide password' : 'Show password'}
                  tabIndex={-1}
                >
                  <span className="material-symbols-outlined text-[20px]">
                    {showPwd ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
            </div>

            {isSignup && (
              <div>
                <label className="block font-label-bold text-label-bold text-on-surface-variant mb-sm" htmlFor="confirm">
                  Confirm Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="material-symbols-outlined text-on-surface-variant/70 text-[20px]">lock</span>
                  </div>
                  <input
                    id="confirm"
                    name="confirm"
                    type={showPwd ? 'text' : 'password'}
                    autoComplete="new-password"
                    required
                    minLength={6}
                    value={confirm}
                    onChange={(e) => { setConfirm(e.target.value); if (error) setError(''); }}
                    placeholder="Repeat your password"
                    className="block w-full pl-10 bg-[#F3F4F6] border border-[#D1D5DB] rounded-lg focus:ring-2 focus:ring-primary focus:border-primary font-body-md text-body-md text-on-surface h-12 outline-none px-3"
                  />
                </div>
              </div>
            )}

            {error && (
              <p className="font-label-sm text-label-sm text-error" role="alert">{error}</p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full flex justify-center items-center h-12 bg-primary hover:bg-primary-container text-on-primary font-label-bold text-label-bold rounded-lg shadow-sm transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {busy
                ? (isSignup ? 'Creating account…' : 'Signing in…')
                : (
                  <>
                    {isSignup ? 'Create account' : 'Continue'}
                    <span className="material-symbols-outlined ml-2 text-[18px]">arrow_forward</span>
                  </>
                )}
            </button>
          </form>

          <p className="mt-md text-center font-label-sm text-label-sm text-on-surface-variant">
            {isSignup ? 'Already have an account?' : "Don't have an account?"}{' '}
            <button
              type="button"
              onClick={() => switchMode(isSignup ? 'signin' : 'signup')}
              className="text-primary font-label-bold hover:underline"
            >
              {isSignup ? 'Sign in' : 'Sign up'}
            </button>
          </p>
        </div>

        <div className="mt-lg flex items-center justify-center text-on-surface-variant/60 font-label-sm text-label-sm gap-1">
          <span className="material-symbols-outlined text-[14px]">shield</span>
          <span>Secure Government Portal — Pilot</span>
        </div>
      </main>
    </div>
  );
}
