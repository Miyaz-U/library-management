const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";
const TOKEN_KEY = "library_token";

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (token) => localStorage.setItem(TOKEN_KEY, token);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

// An error that keeps the server's message and the list of field problems
export class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

// Calls the backend. Example: api("/api/books?q=clean")
export async function api(path, { method = "GET", body } = {}) {
  const headers = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, "Cannot reach the server. Is the backend running?");
  }

  let data = null;
  try {
    data = await res.json();
  } catch {
    // the response had no JSON body
  }

  if (!res.ok) {
    // An expired or invalid session: tell the app to log out
    if (res.status === 401 && token && !path.startsWith("/api/auth/login")) {
      window.dispatchEvent(new Event("auth:expired"));
    }
    throw new ApiError(res.status, data?.error || "Something went wrong", data?.details);
  }
  return data;
}