const TOKEN_KEY = 'huellas.token';
const USER_KEY = 'huellas.user';

export class ApiError extends Error {
  constructor(message, status = 500) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export async function api(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const token = sessionStorage.getItem(TOKEN_KEY);
  if (token) headers.set('Authorization', `Bearer ${token}`);

  let response;
  try {
    response = await fetch(path, { ...options, headers, credentials: 'same-origin' });
  } catch {
    throw new ApiError('No pude conectar con la API. Confirma que el servidor esté iniciado.', 0);
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(data.mensaje || 'Ocurrió un error al comunicarse con la API.', response.status);
  return data;
}

export function getCachedUser() {
  try { return JSON.parse(sessionStorage.getItem(USER_KEY) || 'null'); }
  catch { return null; }
}

export function saveSession(data) {
  sessionStorage.setItem(TOKEN_KEY, data.sesion.token);
  sessionStorage.setItem(USER_KEY, JSON.stringify(data.usuario));
}

export function clearSession() {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(USER_KEY);
}

export function hasToken() {
  return Boolean(sessionStorage.getItem(TOKEN_KEY));
}
