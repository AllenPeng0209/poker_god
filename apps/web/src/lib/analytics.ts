import type { AnalyticsEvent, AnalyticsEventName } from '@poker-god/contracts';
import { apiClient } from './apiClient';

const SESSION_KEY = 'zengto_web_session_id';

function getSessionId() {
  if (typeof window === 'undefined') {
    return 'server-render';
  }

  const stored = window.localStorage.getItem(SESSION_KEY);
  if (stored) {
    return stored;
  }

  const generated = crypto.randomUUID();
  window.localStorage.setItem(SESSION_KEY, generated);
  return generated;
}

function inferModuleFromPath(pathname: string): AnalyticsEvent['module'] {
  if (pathname.startsWith('/app/study')) return 'study';
  if (pathname.startsWith('/app/practice')) return 'practice';
  if (pathname.startsWith('/app/analyze')) return 'analyze';
  if (pathname.startsWith('/app/reports')) return 'reports';
  return 'coach';
}

export function trackEvent(
  eventName: AnalyticsEventName,
  options?: {
    module?: AnalyticsEvent['module'];
    requestId?: string;
    payload?: Record<string, unknown>;
  },
) {
  if (typeof window === 'undefined') {
    return;
  }

  const route = window.location.pathname + window.location.search;
  const event: AnalyticsEvent = {
    eventName,
    eventTime: new Date().toISOString(),
    sessionId: getSessionId(),
    route,
    module: options?.module ?? inferModuleFromPath(window.location.pathname),
    requestId: options?.requestId,
    payload: options?.payload,
  };

  void apiClient.ingestEvents([event]).catch(() => {
    // Avoid blocking core UX when analytics endpoint is unavailable.
  });
}
