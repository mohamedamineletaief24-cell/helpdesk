// All calls to the server are in this file.
const BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const KEY = 'helpdesk_session';

// Page that matches each role (used after login and by the route guard)
export const ROLE_HOME = {
  user: '/user',
  technician: '/technician',
  admin: '/admin',
};

// ----- session (token + role + name kept in the browser) -----
export function getSession() {
  try {
    return JSON.parse(localStorage.getItem(KEY));
  } catch {
    return null;
  }
}

function saveSession(session) {
  try {
    localStorage.setItem(KEY, JSON.stringify(session));
  } catch {
    /* storage can be blocked: the user will simply have to log in again */
  }
}

export function logout() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* nothing to do */
  }
}

// ----- generic request: adds the token, turns errors into exceptions -----
async function request(path, { method = 'GET', body } = {}) {
  const session = getSession();
  const headers = { 'Content-Type': 'application/json' };
  if (session && session.token) {
    headers.Authorization = `Bearer ${session.token}`;
  }

  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error('Cannot reach the server. Is it running on port 5000?');
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    // Expired or invalid token while logged in: back to the login page
    if (res.status === 401 && session) {
      logout();
      window.location.assign('/login');
    }
    const error = new Error(data.error || 'Request failed');
    error.status = res.status;
    throw error;
  }
  return data;
}

// ----- 6.1 authentication -----
export async function login(email, password) {
  const data = await request('/login', { method: 'POST', body: { email, password } });
  saveSession(data); // { token, role, name }
  return data;
}

// ----- 6.2 open a ticket -----
export function createTicket({ title, description, category, priority }) {
  return request('/tickets', {
    method: 'POST',
    body: { title, description, category, priority },
  });
}

// ----- 6.3 follow my tickets -----
export function getMyTickets() {
  return request('/tickets/mine');
}

// ----- 6.4 take a ticket in charge (technician) -----
export function getMe() {
  return request('/me'); // { id, name, role, active_count }
}

// 6.7: filters = { status, priority, technician }. Only the filters that are filled are sent (BR6).
export function getAllTickets(filters = {}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value) params.set(key, value);
  }
  const query = params.toString();
  return request(query ? `/tickets?${query}` : '/tickets');
}

export function takeTicket(ticketId) {
  return request(`/tickets/${ticketId}/take`, { method: 'PATCH' }); // { ticket, active_count }
}

// ----- 6.10 create an account (visitor, no token needed) -----
export function register(name, email, password) {
  return request('/register', { method: 'POST', body: { name, email, password } });
}

// ----- 6.9 add a technician (admin) -----
export function createTechnician({ name, email, password }) {
  return request('/technicians', { method: 'POST', body: { name, email, password } });
}

// ----- 6.11 approve or reject account requests (admin) -----
export function getPendingAccounts() {
  return request('/accounts/pending');
}

export function approveAccount(accountId) {
  return request(`/accounts/${accountId}/approve`, { method: 'PATCH' });
}

export function rejectAccount(accountId) {
  return request(`/accounts/${accountId}/reject`, { method: 'PATCH' });
}

// ----- 6.5 comment and resolve (technician) -----
export function resolveTicket(ticketId, comment) {
  return request(`/tickets/${ticketId}/resolve`, { method: 'POST', body: { comment } });
  // returns { ticket, comment, active_count }
}

// ----- 6.6 close and reopen (owner of the ticket) -----
export function closeTicket(ticketId) {
  return request(`/tickets/${ticketId}/close`, { method: 'PATCH' });
}

export function reopenTicket(ticketId) {
  return request(`/tickets/${ticketId}/reopen`, { method: 'PATCH' });
}

// ----- 6.7 technician filter of the Kanban board -----
export function getTechnicians() {
  return request('/technicians'); // [{ _id, name }]
}

// ----- 6.8 statistics (admin) -----
export function getStats() {
  return request('/stats');
}

export function getTechnicianActivity() {
  return request('/stats/technicians');
}
