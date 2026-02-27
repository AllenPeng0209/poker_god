import type { CoachTelemetrySummary, ZenChatResponse, ZenCoachLeakSignal } from '@poker-god/contracts';

type CoachRequestMeta = {
  route?: string;
};

type TelemetryEvent = {
  latencyMs: number;
  provider: ZenChatResponse['provider'] | 'failed';
  ok: boolean;
  isFallback: boolean;
  leakTags: string[];
  module: string;
  createdAt: string;
};

const WINDOW_LIMIT = 240;
const events: TelemetryEvent[] = [];
let lastError: CoachTelemetrySummary['lastError'];

function percentile(values: number[], p: number) {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[index] ?? 0;
}

function inferModule(meta?: CoachRequestMeta) {
  const route = (meta?.route ?? '').toLowerCase();
  if (route.includes('/study')) return 'study';
  if (route.includes('/practice')) return 'practice';
  if (route.includes('/analyze')) return 'analyze';
  if (route.includes('/reports')) return 'reports';
  return 'coach';
}

function trimWindow() {
  if (events.length > WINDOW_LIMIT) {
    events.splice(0, events.length - WINDOW_LIMIT);
  }
}

export function trackCoachSuccess(payload: {
  response: ZenChatResponse;
  latencyMs: number;
  meta?: CoachRequestMeta;
}) {
  events.push({
    latencyMs: Math.max(0, Math.round(payload.latencyMs)),
    provider: payload.response.provider,
    ok: true,
    isFallback: payload.response.provider === 'heuristic' || payload.response.provider === 'fallback',
    leakTags: (payload.response.leakSignals ?? []).map((signal) => signal.tag),
    module: inferModule(payload.meta),
    createdAt: new Date().toISOString(),
  });
  trimWindow();
}

export function trackCoachFailure(payload: { code: string; message: string; latencyMs: number; meta?: CoachRequestMeta }) {
  events.push({
    latencyMs: Math.max(0, Math.round(payload.latencyMs)),
    provider: 'failed',
    ok: false,
    isFallback: true,
    leakTags: [],
    module: inferModule(payload.meta),
    createdAt: new Date().toISOString(),
  });
  lastError = {
    code: payload.code,
    message: payload.message.slice(0, 220),
    at: new Date().toISOString(),
  };
  trimWindow();
}

export function getCoachTelemetrySummary(): CoachTelemetrySummary {
  const latencies = events.map((event) => event.latencyMs);
  const total = events.length;
  const success = events.filter((event) => event.ok).length;
  const fallback = events.filter((event) => event.isFallback).length;
  const byProvider = events.reduce<Record<string, number>>((acc, event) => {
    acc[event.provider] = (acc[event.provider] ?? 0) + 1;
    return acc;
  }, {});

  const tagCount = new Map<string, number>();
  events.forEach((event) => {
    event.leakTags.forEach((tag) => tagCount.set(tag, (tagCount.get(tag) ?? 0) + 1));
  });

  const topLeakTags = Array.from(tagCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([tag, count]) => ({ tag: tag as ZenCoachLeakSignal['tag'], count }));

  return {
    windowSize: WINDOW_LIMIT,
    totalRequests: total,
    successRatePct: total === 0 ? 100 : Number(((success / total) * 100).toFixed(1)),
    fallbackRatePct: total === 0 ? 0 : Number(((fallback / total) * 100).toFixed(1)),
    p50LatencyMs: percentile(latencies, 50),
    p95LatencyMs: percentile(latencies, 95),
    byProvider,
    topLeakTags,
    lastError,
    updatedAt: new Date().toISOString(),
  };
}
