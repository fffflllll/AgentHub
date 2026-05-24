import { config } from './config';
import type {
  AgentResponse,
  ApiResponse,
  AuthResponse,
  LoginRequest,
  MessagePageQuery,
  MessageResponse,
  RegisterRequest,
  SessionMemberResponse,
  SessionResponse,
  UserInfo,
} from './types';

const apiBase = config.apiUrl.replace(/\/$/, '');
export const AUTH_TOKEN_STORAGE_KEY = 'agenthub_token';

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  query?: Record<string, string | number | undefined>;
  body?: unknown;
  skipAuth?: boolean;
};

export class ApiError extends Error {
  readonly status: number;
  readonly code: number | string;

  constructor(status: number, code: number | string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

const buildUrl = (path: string, query?: Record<string, string | number | undefined>) => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const url = new URL(`${apiBase}${normalizedPath}`, window.location.origin);

  Object.entries(query ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== '') {
      url.searchParams.set(key, String(value));
    }
  });

  return url.toString();
};

export const getStoredToken = () => {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
};

const setStoredToken = (token: string | null) => {
  if (typeof window === 'undefined') {
    return;
  }

  if (token) {
    window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
  } else {
    window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
  }
};

export const persistAuthToken = (token: string) => setStoredToken(token);

export const clearAuthToken = () => setStoredToken(null);

const parsePayload = async <T>(response: Response) => {
  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  if (!text) {
    return undefined as T;
  }

  return JSON.parse(text) as ApiResponse<T> | T;
};

const isApiResponse = <T>(payload: ApiResponse<T> | T): payload is ApiResponse<T> => {
  return Boolean(payload && typeof payload === 'object' && 'data' in payload && 'code' in payload);
};

const unwrap = async <T>(response: Response): Promise<T> => {
  const payload = await parsePayload<T>(response);

  if (!response.ok) {
    const message = isApiResponse(payload) ? payload.message : `${response.status} ${response.statusText}`;
    const code = isApiResponse(payload) ? payload.code : response.status;
    throw new ApiError(response.status, code, message);
  }

  if (isApiResponse(payload)) {
    if (payload.code !== 0) {
      throw new ApiError(response.status, payload.code, payload.message);
    }

    return payload.data;
  }

  return payload;
};

const request = async <T>(path: string, options: RequestOptions = {}) => {
  const headers = new Headers({
    Accept: 'application/json',
  });
  const token = options.skipAuth ? null : getStoredToken();

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const init: RequestInit = {
    method: options.method ?? 'GET',
    headers,
  };

  if (options.body !== undefined) {
    headers.set('Content-Type', 'application/json');
    init.body = JSON.stringify(options.body);
  }

  const response = await fetch(buildUrl(path, options.query), {
    ...init,
  });

  try {
    return await unwrap<T>(response);
  } catch (error) {
    if (!options.skipAuth && error instanceof ApiError && error.status === 401 && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('agenthub:unauthorized'));
    }

    throw error;
  }
};

export const agentHubApi = {
  register: (body: RegisterRequest) =>
    request<AuthResponse>('/auth/register', { method: 'POST', body, skipAuth: true }),
  login: (body: LoginRequest) => request<AuthResponse>('/auth/login', { method: 'POST', body, skipAuth: true }),
  getCurrentUser: () => request<UserInfo>('/users/me'),
  getAgents: () => request<AgentResponse[]>('/agents'),
  getSessions: () => request<SessionResponse[]>('/sessions'),
  getSessionMembers: (sessionId: string) =>
    request<SessionMemberResponse[]>(`/sessions/${encodeURIComponent(sessionId)}/members`),
  getMessages: (sessionId: string, query: MessagePageQuery = {}) =>
    request<MessageResponse[]>(`/sessions/${encodeURIComponent(sessionId)}/messages`, {
      query: {
        before: query.before,
        limit: query.limit ?? 50,
      },
    }),
};
