const API_BASE = '/api';

export const fetchApi = async <T = any>(endpoint: string, options: RequestInit = {}): Promise<T> => {
  const token = localStorage.getItem('token');

  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errMsg =
      errorData.message ||
      errorData.error?.message ||
      (typeof errorData.error === 'string' ? errorData.error : null) ||
      `HTTP Error ${response.status}`;
    const error = new Error(errMsg);
    (error as any).status = response.status;
    (error as any).data = errorData;
    (error as any).code = errorData.error?.code || errorData.code;
    (error as any).email = errorData.error?.email || errorData.email;
    (error as any).organizationName = errorData.error?.organizationName || errorData.organizationName;
    (error as any).requestedAt = errorData.error?.requestedAt || errorData.requestedAt;
    (error as any).requestStatus = errorData.error?.requestStatus || errorData.requestStatus;
    throw error;
  }

  return response.json();
};
