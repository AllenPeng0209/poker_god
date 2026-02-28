export type AdminLatencyRouteStat = {
  route: string;
  count: number;
  avgMs: number;
  p50Ms: number;
  p95Ms: number;
  maxMs: number;
};

export type AdminLatencyOpsResponse = {
  requestId: string;
  generatedAt: string;
  sampleSize: number;
  routes: AdminLatencyRouteStat[];
};

const DEFAULT_BASE_URL = 'http://127.0.0.1:8000';

function normalizeBaseUrl(rawBaseUrl: string): string {
  const trimmed = rawBaseUrl.trim();
  if (!trimmed) return DEFAULT_BASE_URL;
  return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
}

export async function fetchAdminLatencyOps(): Promise<AdminLatencyOpsResponse> {
  const baseUrl = normalizeBaseUrl(process.env.EXPO_PUBLIC_POKER_GOD_API_BASE_URL ?? DEFAULT_BASE_URL);
  const endpoint = `${baseUrl}/api/admin/ops/latency`;
  const apiKey = process.env.EXPO_PUBLIC_POKER_GOD_API_KEY?.trim();

  const response = await fetch(endpoint, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      ...(apiKey ? { 'x-api-key': apiKey } : {}),
    },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    const message = body
      ? `Failed to load admin latency telemetry (${response.status}): ${body}`
      : `Failed to load admin latency telemetry (${response.status})`;
    throw new Error(message);
  }

  return response.json() as Promise<AdminLatencyOpsResponse>;
}
