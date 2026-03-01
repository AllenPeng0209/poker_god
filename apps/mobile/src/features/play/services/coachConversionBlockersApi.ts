export type MobileCoachConversionBlockerItem = {
  stageKey: 'coach_message_sent' | 'coach_action_executed' | 'drill_started' | 'drill_completed';
  stageLabel: string;
  sessions: number;
  dropoffPct: number;
  impactScore: number;
  recommendation: string;
};

export type MobileCoachConversionBlockersResponse = {
  requestId: string;
  windowDays: 7 | 30 | 90;
  generatedAt: string;
  attachRatePct: number;
  completionRatePct: number;
  biggestBlockerStage: string;
  items: MobileCoachConversionBlockerItem[];
};

function getApiBaseUrl(): string {
  const base = process.env.EXPO_PUBLIC_POKER_GOD_API_BASE_URL?.trim();
  return base && base.length > 0 ? base.replace(/\/$/, '') : 'http://127.0.0.1:8000';
}

export async function fetchCoachConversionBlockers(windowDays: 7 | 30 | 90 = 30): Promise<MobileCoachConversionBlockersResponse> {
  const baseUrl = getApiBaseUrl();
  const apiKey = process.env.EXPO_PUBLIC_POKER_GOD_API_KEY?.trim();
  const response = await fetch(`${baseUrl}/api/admin/coach/conversion-blockers?windowDays=${windowDays}`, {
    headers: {
      ...(apiKey ? { 'x-api-key': apiKey } : {}),
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || `conversion blockers request failed (${response.status})`);
  }

  return (await response.json()) as MobileCoachConversionBlockersResponse;
}
