import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { getAuthHeaders, logout, refreshAccessToken } from "./auth";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const headers: Record<string, string> = {
    ...getAuthHeaders(),
  };
  if (data) {
    headers["Content-Type"] = "application/json";
  }

  let res = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  if (res.status === 401) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      const retryHeaders: Record<string, string> = { ...getAuthHeaders() };
      if (data) retryHeaders["Content-Type"] = "application/json";
      res = await fetch(url, {
        method,
        headers: retryHeaders,
        body: data ? JSON.stringify(data) : undefined,
        credentials: "include",
      });
    }

    if (res.status === 401) {
      logout();
      window.location.href = "/";
      throw new Error("Session expired. Please log in again.");
    }
  }

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey[0] as string, {
      credentials: "include",
      headers: getAuthHeaders(),
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    if (res.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        const retryRes = await fetch(queryKey[0] as string, {
          credentials: "include",
          headers: getAuthHeaders(),
        });
        if (retryRes.ok) return await retryRes.json();
      }
      logout();
      window.location.href = "/";
      throw new Error("Session expired");
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: 30000,
      retry: 2,
      retryDelay: 1000,
    },
    mutations: {
      retry: false,
    },
  },
});
