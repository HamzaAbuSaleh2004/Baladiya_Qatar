import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import { AppProvider, useApp } from './AppContext';
import { I18nProvider } from './i18n';
import AIAgentChat from './pages/AIAgentChat';
import Admin from './pages/Admin';
import AdminUsers from './pages/AdminUsers';
import Authentication from './pages/Authentication';
import Confirmation from './pages/Confirmation';
import Dashboard from './pages/Dashboard';
import Profile from './pages/Profile';
import Public from './pages/Public';
import SmartCapture from './pages/SmartCapture';
import Tickets from './pages/Tickets';

function RequireAuth({ children }) {
  const { email } = useApp();
  if (!email) return <Navigate to="/auth" replace />;
  return children;
}

function RequireAdmin({ children }) {
  const { email, isAdmin } = useApp();
  if (!email) return <Navigate to="/auth" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;
  return children;
}

function RequireSuperAdmin({ children }) {
  const { email, isSuperAdmin } = useApp();
  if (!email) return <Navigate to="/auth" replace />;
  if (!isSuperAdmin) return <Navigate to="/admin" replace />;
  return children;
}

export default function App() {
  return (
    <I18nProvider>
      <AppProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/auth" element={<Authentication />} />
            <Route path="/public" element={<Public />} />
            <Route path="/" element={<RequireAuth><Dashboard /></RequireAuth>} />
            <Route path="/tickets" element={<RequireAuth><Tickets /></RequireAuth>} />
            <Route path="/profile" element={<RequireAuth><Profile /></RequireAuth>} />
            <Route path="/capture" element={<RequireAuth><SmartCapture /></RequireAuth>} />
            <Route path="/chat" element={<RequireAuth><AIAgentChat /></RequireAuth>} />
            <Route path="/confirm" element={<RequireAuth><Confirmation /></RequireAuth>} />
            <Route path="/admin" element={<RequireAdmin><Admin /></RequireAdmin>} />
            <Route path="/admin/users" element={<RequireSuperAdmin><AdminUsers /></RequireSuperAdmin>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AppProvider>
    </I18nProvider>
  );
}
