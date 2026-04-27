import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import { AppProvider, useApp } from './AppContext';
import AIAgentChat from './pages/AIAgentChat';
import Authentication from './pages/Authentication';
import Confirmation from './pages/Confirmation';
import Dashboard from './pages/Dashboard';
import SmartCapture from './pages/SmartCapture';

function RequireAuth({ children }) {
  const { email } = useApp();
  if (!email) return <Navigate to="/auth" replace />;
  return children;
}

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/auth" element={<Authentication />} />
          <Route path="/" element={<RequireAuth><Dashboard /></RequireAuth>} />
          <Route path="/capture" element={<RequireAuth><SmartCapture /></RequireAuth>} />
          <Route path="/chat" element={<RequireAuth><AIAgentChat /></RequireAuth>} />
          <Route path="/confirm" element={<RequireAuth><Confirmation /></RequireAuth>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AppProvider>
  );
}
