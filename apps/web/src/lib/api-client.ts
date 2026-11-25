import { getAccessToken, setGlobalAccessToken } from './auth-context';

export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export async function apiClient<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<ApiResponse<T>> {
  const url = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

  const token = getAccessToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers as Record<string, string>),
  };

  let response = await fetch(url, {
    credentials: 'include',
    ...options,
    headers,
  });

  // Attempt automatic session refresh on 401 if we had a token
  if (response.status === 401 && token) {
    try {
      const refreshRes = await fetch('/api/v1/auth/refresh', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });

      if (refreshRes.ok) {
        const refreshData = await refreshRes.json();
        const newToken = refreshData.data?.accessToken;
        if (newToken) {
          setGlobalAccessToken(newToken);
          headers.Authorization = `Bearer ${newToken}`;
          response = await fetch(url, {
            credentials: 'include',
            ...options,
            headers,
          });
        }
      }
    } catch {
      // Refresh failed, proceed with original response handling
    }
  }

  const json = (await response.json()) as ApiResponse<T>;

  if (!response.ok) {
    throw new Error(json.error?.message || json.message || 'An unexpected error occurred');
  }

  return json;
}
