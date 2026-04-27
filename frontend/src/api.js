const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

async function handle(res) {
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try { msg = (await res.json()).detail || msg; } catch { /* ignore */ }
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

function authHeaders(token) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function login(email, password) {
  const res = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  return handle(res);
}

export async function signup(email, password) {
  const res = await fetch(`${API_URL}/api/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  return handle(res);
}

export async function getTickets(token) {
  const res = await fetch(`${API_URL}/api/tickets`, {
    headers: { ...authHeaders(token) },
  });
  return handle(res);
}

export async function startReport({ token, latitude, longitude, image }) {
  const fd = new FormData();
  fd.append('latitude', String(latitude));
  fd.append('longitude', String(longitude));
  fd.append('image', image);
  const res = await fetch(`${API_URL}/api/report/start`, {
    method: 'POST',
    headers: { ...authHeaders(token) },
    body: fd,
  });
  return handle(res);
}

export async function sendMessage({ token, sessionId, message }) {
  const res = await fetch(`${API_URL}/api/report/${sessionId}/message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
    body: JSON.stringify({ message }),
  });
  return handle(res);
}
