export type HomeworkPriorityTier = 'P0' | 'P1' | 'P2';

export type HomeworkPriorityQueueItem = {
  sessionId: string;
  homeworkId: string | null;
  priorityTier: HomeworkPriorityTier;
  staleHours: number;
  riskScore: number;
  diagnosis: string;
  recommendedAction: string;
};

export type HomeworkPriorityQueueSummary = {
  queuedCount: number;
  p0Count: number;
  p1Count: number;
  p2Count: number;
  medianStaleHours: number;
};

export type HomeworkPriorityQueueResponse = {
  requestId: string;
  generatedAt: string;
  windowDays: number;
  summary: HomeworkPriorityQueueSummary;
  items: HomeworkPriorityQueueItem[];
};

const DEFAULT_API_BASE = 'http://localhost:3001';
const API_BASE_URL = (
  process.env.EXPO_PUBLIC_POKER_GOD_API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  DEFAULT_API_BASE
).replace(/\/+$/, '');
const PUBLIC_API_KEY = (
  process.env.EXPO_PUBLIC_POKER_GOD_API_KEY ??
  process.env.NEXT_PUBLIC_API_KEY ??
  ''
).trim();

export async function fetchHomeworkPriorityQueue(windowDays: 7 | 30 | 90): Promise<HomeworkPriorityQueueResponse> {
  const url = `${API_BASE_URL}/api/admin/coach/homework-priority-queue?windowDays=${windowDays}&limit=20`;
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(PUBLIC_API_KEY ? { 'x-api-key': PUBLIC_API_KEY } : {}),
    },
  });

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;
    try {
      const payload = (await response.json()) as { message?: string };
      if (typeof payload.message === 'string' && payload.message.length > 0) {
        message = payload.message;
      }
    } catch {
      // keep fallback message
    }
    throw new Error(message);
  }

  return (await response.json()) as HomeworkPriorityQueueResponse;
}
