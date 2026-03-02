let accessToken: string | null = null;
let refreshToken: string | null = null;
let currentUser: AuthUser | null = null;
let onAuthChange: ((user: AuthUser | null) => void) | null = null;

export interface AuthUser {
  id: string;
  email: string;
  role: string;
}

export function setAuthChangeHandler(handler: (user: AuthUser | null) => void) {
  onAuthChange = handler;
}

export function getToken(): string | null {
  return accessToken;
}

export function getAuthHeaders(): Record<string, string> {
  if (accessToken) {
    return { Authorization: `Bearer ${accessToken}` };
  }
  return {};
}

export function getCurrentUser(): AuthUser | null {
  return currentUser;
}

export function isAuthenticated(): boolean {
  return !!accessToken && !!currentUser;
}

export async function login(email: string, password: string): Promise<AuthUser> {
  const res = await fetch("/api/auth/admin-login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || "Login failed");
  }

  const data = await res.json();
  accessToken = data.token;
  refreshToken = data.refresh_token;
  currentUser = data.user;
  localStorage.setItem("refresh_token", data.refresh_token);
  onAuthChange?.(currentUser);
  return data.user;
}

export function logout() {
  accessToken = null;
  refreshToken = null;
  currentUser = null;
  localStorage.removeItem("refresh_token");
  onAuthChange?.(null);
}

export async function tryRestoreSession(): Promise<AuthUser | null> {
  const stored = localStorage.getItem("refresh_token");
  if (!stored) return null;

  try {
    const res = await fetch("/api/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: stored }),
    });

    if (!res.ok) {
      localStorage.removeItem("refresh_token");
      return null;
    }

    const data = await res.json();
    if (data.user?.role !== "admin") {
      localStorage.removeItem("refresh_token");
      return null;
    }

    accessToken = data.token;
    refreshToken = data.refresh_token;
    currentUser = data.user;
    localStorage.setItem("refresh_token", data.refresh_token);
    onAuthChange?.(currentUser);
    return data.user;
  } catch {
    localStorage.removeItem("refresh_token");
    return null;
  }
}

export async function authFetch(url: string, options?: RequestInit): Promise<Response> {
  let res = await fetch(url, {
    ...options,
    headers: { ...getAuthHeaders(), ...options?.headers },
    credentials: "include",
  });
  if (res.status === 401) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      res = await fetch(url, {
        ...options,
        headers: { ...getAuthHeaders(), ...options?.headers },
        credentials: "include",
      });
    }
    if (res.status === 401) {
      logout();
      window.location.href = "/";
    }
  }
  return res;
}

export async function refreshAccessToken(): Promise<boolean> {
  const stored = refreshToken || localStorage.getItem("refresh_token");
  if (!stored) return false;

  try {
    const res = await fetch("/api/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: stored }),
    });

    if (!res.ok) return false;

    const data = await res.json();
    accessToken = data.token;
    refreshToken = data.refresh_token;
    currentUser = data.user;
    localStorage.setItem("refresh_token", data.refresh_token);
    return true;
  } catch {
    return false;
  }
}
