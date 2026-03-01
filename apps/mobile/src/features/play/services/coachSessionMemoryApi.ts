export type CoachSessionMemorySummary = {
  sessions: number;
  highRiskSessions: number;
  averageAttachRatePct: number;
  staleRiskRatePct: number;
};

export type CoachSessionMemoryItem = {
  sessionId: string;
  messageCount: number;
  actionCount: number;
  attachRatePct: number;
  staleHours: number;
  riskLevel: 'low' | 'medium' | 'high';
  recommendedAction: string;
};

export type CoachSessionMemoryResponse = {
  requestId: string;
  generatedAt: string;
  windowDays: number;
  summary: CoachSessionMemorySummary;
  sessions: CoachSessionMemoryItem[];
};

type ApiErrorResponse = {
  message?: string;
};

const DEFAULT_API_BASE_URL = 'http://localhost:3001';
const API_BASE_URL = (process.env.EXPO_PUBLIC_POKER_GOD_API_BASE_URL ?? DEFAULT_API_BASE_URL).replace(/\/+$/, '');
const API_KEY = (process.env.EXPO_PUBLIC_POKER_GOD_API_KEY ?? '').trim();

async function parseError(response: Response): Promise<Error> {
  let message = `Request failed with status ${response.status}`;
  try {
    const payload = (await response.json()) as ApiErrorResponse;
    if (typeof payload.message === 'string' && payload.message.length > 0) {
      message = payload.message;
    }
  } catch {
    // keep fallback message
  }
  return new Error(message);
}

export async function fetchCoachSessionMemory(params?: {
  windowDays?: 7 | 30 | 90;
  limit?: number;
}): Promise<CoachSessionMemoryResponse> {
  const query = new URLSearchParams();
  query.set('windowDays', String(params?.windowDays ?? 30));
  query.set('limit', String(params?.limit ?? 5));

  const response = await fetch(`${API_BASE_URL}/api/admin/coach/session-memory?${query.toString()}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(API_KEY ? { 'x-api-key': API_KEY } : {}),
    },
  });

  if (!response.ok) {
    throw await parseError(response);
  }

  return response.json() as Promise<CoachSessionMemoryResponse>;
}
