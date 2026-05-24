import { config } from './config';
import type {
  AgentResponse,
  ApiResponse,
  MessagePageQuery,
  MessageResponse,
  SessionMemberResponse,
  SessionResponse,
} from './types';

const apiBase = config.apiUrl.replace(/\/$/, '');

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

const unwrap = async <T>(response: Response): Promise<T> => {
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const payload = (await response.json()) as ApiResponse<T> | T;

  if (payload && typeof payload === 'object' && 'data' in payload && 'code' in payload) {
    return (payload as ApiResponse<T>).data;
  }

  return payload as T;
};

const request = async <T>(path: string, query?: Record<string, string | number | undefined>) => {
  const response = await fetch(buildUrl(path, query), {
    headers: {
      Accept: 'application/json',
    },
  });

  return unwrap<T>(response);
};

export const agentHubApi = {
  getAgents: () => request<AgentResponse[]>('/agents'),
  getSessions: () => request<SessionResponse[]>('/sessions'),
  getSessionMembers: (sessionId: string) =>
    request<SessionMemberResponse[]>(`/sessions/${encodeURIComponent(sessionId)}/members`),
  getMessages: (sessionId: string, query: MessagePageQuery = {}) =>
    request<MessageResponse[]>(`/sessions/${encodeURIComponent(sessionId)}/messages`, {
      before: query.before,
      limit: query.limit ?? 50,
    }),
};
