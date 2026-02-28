export type CoachFunnelStage = {
  key: string;
  label: string;
  sessions: number;
  conversionPctFromPrev: number;
};

export type CoachFunnelSummary = {
  generatedAt: string;
  homeworkAttachRatePct: number;
  homeworkCompletionRatePct: number;
  biggestDropStageKey: string;
  stages: CoachFunnelStage[];
};

const DEFAULT_API_BASE = 'http://localhost:3001';
const API_BASE = (process.env.EXPO_PUBLIC_POKER_GOD_API_BASE_URL || DEFAULT_API_BASE).replace(/\/+$/, '');
const API_KEY = (process.env.EXPO_PUBLIC_POKER_GOD_API_KEY || '').trim();

export async function fetchCoachFunnelSummary(windowDays = 30): Promise<CoachFunnelSummary> {
  const response = await fetch(`${API_BASE}/api/admin/coach/funnel?windowDays=${windowDays}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(API_KEY ? { 'x-api-key': API_KEY } : {}),
    },
  });

  if (!response.ok) {
    throw new Error(`Coach funnel request failed (${response.status})`);
  }

  return response.json() as Promise<CoachFunnelSummary>;
}
