// Cliente HTTP y manejo local de la sesión de usuario.
const TOKEN_KEY = "huellas.token";
const USER_KEY = "huellas.user";

export class ApiError extends Error {
  constructor(message, status = 500) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/** Envía una solicitud JSON al backend e incluye el token de sesión disponible. */
export async function api(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (options.body && !headers.has("Content-Type"))
    headers.set("Content-Type", "application/json");
  const token = sessionStorage.getItem(TOKEN_KEY);
  if (token) headers.set("Authorization", `Bearer ${token}`);

  let response;
  try {
    response = await fetch(path, {
      ...options,
      headers,
      credentials: "same-origin",
    });
  } catch {
    throw new ApiError(
      "No pude conectar con la API. Confirma que el servidor esté iniciado.",
      0,
    );
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new ApiError(
      data.mensaje || "Ocurrió un error al comunicarse con la API.",
      response.status,
    );
  return data;
}

/** Descarga una foto usando la sesión cuando el perfil todavía es privado. */
export async function apiBlob(path) {
  const headers = new Headers();
  const token = sessionStorage.getItem(TOKEN_KEY);
  if (token) headers.set("Authorization", `Bearer ${token}`);

  let response;
  try {
    response = await fetch(path, {
      headers,
      credentials: "same-origin",
    });
    if (response.status === 401 && token) {
      response = await fetch(path, {
        credentials: "same-origin",
      });
    }
  } catch {
    throw new ApiError(
      "No pude conectar con la API. Confirma que el servidor esté iniciado.",
      0,
    );
  }
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new ApiError(
      data.mensaje || "No se pudo cargar la foto de la mascota.",
      response.status,
    );
  }
  return response.blob();
}

/** Lee los datos de usuario guardados en el navegador. */
export function getCachedUser() {
  try {
    return JSON.parse(sessionStorage.getItem(USER_KEY) || "null");
  } catch {
    return null;
  }
}

/** Guarda el usuario y el token devueltos al iniciar sesión. */
export function saveSession(data) {
  sessionStorage.setItem(TOKEN_KEY, data.sesion.token);
  sessionStorage.setItem(USER_KEY, JSON.stringify(data.usuario));
}

/** Elimina del navegador los datos locales de la sesión. */
export function clearSession() {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(USER_KEY);
}

/** Informa si hay un token de sesión guardado. */
export function hasToken() {
  return Boolean(sessionStorage.getItem(TOKEN_KEY));
}
