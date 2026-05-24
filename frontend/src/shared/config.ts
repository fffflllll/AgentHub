const resolveWebSocketUrl = (value: string | undefined) => {
  const fallbackPath = '/ws/chat';
  const raw = value || fallbackPath;

  if (raw.startsWith('ws://') || raw.startsWith('wss://')) {
    return raw;
  }

  if (typeof window === 'undefined') {
    return `ws://localhost:3000${raw.startsWith('/') ? raw : `/${raw}`}`;
  }

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const path = raw.startsWith('/') ? raw : `/${raw}`;
  return `${protocol}//${window.location.host}${path}`;
};

export const config = {
  apiUrl: import.meta.env.VITE_API_URL || '/api',
  wsUrl: resolveWebSocketUrl(import.meta.env.VITE_WS_URL),
};
