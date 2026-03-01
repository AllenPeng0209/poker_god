export type MobileCoachMistakeClusterItem = {
  tag: string;
  sampleSize: number;
  avgEvLossBb100: number;
  sharePct: number;
  repeatSessionRatePct: number;
  riskLevel: 'high' | 'medium' | 'low';
  suggestedCampaign: 'quick_drill' | 'homework_recovery' | 'coach_nudge';
};

export type MobileCoachMistakeClustersResponse = {
  requestId: string;
  windowDays: 7 | 30 | 90;
  generatedAt: string;
  summary: {
    totalHands: number;
    distinctSessions: number;
    biggestClusterTag?: string | null;
    biggestClusterSharePct: number;
  };
  items: MobileCoachMistakeClusterItem[];
};

const DEFAULT_API_BASE_URL = 'http://127.0.0.1:3001';

function resolveApiBaseUrl(): string {
  return (process.env.EXPO_PUBLIC_POKER_GOD_API_BASE_URL ?? DEFAULT_API_BASE_URL).replace(/\/+$/, '');
}

function resolveApiKey(): string {
  return (process.env.EXPO_PUBLIC_POKER_GOD_API_KEY ?? '').trim();
}

export async function getMobileCoachMistakeClusters(
  windowDays: 7 | 30 | 90,
  limit = 5,
): Promise<MobileCoachMistakeClustersResponse> {
  const apiBase = resolveApiBaseUrl();
  const apiKey = resolveApiKey();
  const response = await fetch(
    `${apiBase}/api/admin/coach/mistake-clusters?windowDays=${windowDays}&limit=${limit}`,
    {
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { 'x-api-key': apiKey } : {}),
      },
    },
  );

  if (!response.ok) {
    let message = `Failed to load mistake clusters (${response.status})`;
    try {
      const payload = (await response.json()) as { message?: string };
      if (payload?.message) {
        message = payload.message;
      }
    } catch {
      // ignore parse errors and keep default message
    }
    throw new Error(message);
  }

  return (await response.json()) as MobileCoachMistakeClustersResponse;
}
