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

export async function getMe(token) {
  const res = await fetch(`${API_URL}/api/me`, { headers: { ...authHeaders(token) } });
  return handle(res);
}

export async function getTickets(token) {
  const res = await fetch(`${API_URL}/api/tickets`, {
    headers: { ...authHeaders(token) },
  });
  return handle(res);
}

export async function startReport({ token, latitude, longitude, image, address = '', uiLanguage = 'en' }) {
  const fd = new FormData();
  fd.append('latitude', String(latitude));
  fd.append('longitude', String(longitude));
  fd.append('image', image);
  if (address) fd.append('address', address);
  fd.append('ui_language', uiLanguage || 'en');
  const res = await fetch(`${API_URL}/api/report/start`, {
    method: 'POST',
    headers: { ...authHeaders(token) },
    body: fd,
  });
  return handle(res);
}

export async function checkDuplicates({ token, latitude, longitude, image }) {
  const fd = new FormData();
  fd.append('latitude', String(latitude));
  fd.append('longitude', String(longitude));
  fd.append('image', image);
  const res = await fetch(`${API_URL}/api/report/check-duplicates`, {
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

// --- Admin ----------------------------------------------------------------

export async function adminListTickets(token, { status, category } = {}) {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (category) params.set('category', category);
  const qs = params.toString();
  const res = await fetch(`${API_URL}/api/admin/tickets${qs ? `?${qs}` : ''}`, {
    headers: { ...authHeaders(token) },
  });
  return handle(res);
}

export async function adminGetTicket(token, ticketId) {
  const res = await fetch(`${API_URL}/api/admin/tickets/${ticketId}`, {
    headers: { ...authHeaders(token) },
  });
  return handle(res);
}

export async function adminUpdateTicket(token, ticketId, payload) {
  const res = await fetch(`${API_URL}/api/admin/tickets/${ticketId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
    body: JSON.stringify(payload),
  });
  return handle(res);
}

export async function adminBulkUpdate(token, { ticket_ids, status, note }) {
  const res = await fetch(`${API_URL}/api/admin/tickets/bulk`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
    body: JSON.stringify({ ticket_ids, status, note: note || '' }),
  });
  return handle(res);
}

export async function adminGetStats(token) {
  const res = await fetch(`${API_URL}/api/admin/stats`, {
    headers: { ...authHeaders(token) },
  });
  return handle(res);
}

export async function adminListUsers(token) {
  const res = await fetch(`${API_URL}/api/admin/users`, {
    headers: { ...authHeaders(token) },
  });
  return handle(res);
}

export async function adminCreateUser(token, payload) {
  const res = await fetch(`${API_URL}/api/admin/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
    body: JSON.stringify(payload),
  });
  return handle(res);
}

export async function adminUpdateUser(token, email, payload) {
  const res = await fetch(`${API_URL}/api/admin/users/${encodeURIComponent(email)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
    body: JSON.stringify(payload),
  });
  return handle(res);
}

export async function adminDeleteUser(token, email) {
  const res = await fetch(`${API_URL}/api/admin/users/${encodeURIComponent(email)}`, {
    method: 'DELETE',
    headers: { ...authHeaders(token) },
  });
  return handle(res);
}

// --- Public --------------------------------------------------------------

export async function getPublicTickets() {
  const res = await fetch(`${API_URL}/api/public/tickets`);
  return handle(res);
}
