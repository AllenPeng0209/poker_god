export type CoachHomeworkTask = {
  id: string;
  title: string;
  reason: string;
  leakTag: string;
  targetDrillId: string;
  estimatedMinutes: number;
  priorityScore: number;
  dueAt: string;
  completed: boolean;
};

export type CoachHomeworkFeedResponse = {
  requestId: string;
  userId: string;
  generatedAt: string;
  tasks: CoachHomeworkTask[];
  streakDays: number;
};

const DEFAULT_API_BASE = 'http://localhost:3001';
const API_BASE_URL = (process.env.EXPO_PUBLIC_API_BASE_URL ?? DEFAULT_API_BASE).replace(/\/+$/, '');

export async function fetchCoachHomework(userId: string): Promise<CoachHomeworkFeedResponse> {
  const response = await fetch(`${API_BASE_URL}/api/coach/homework?userId=${encodeURIComponent(userId)}`);
  if (!response.ok) {
    throw new Error(`coach_homework_fetch_failed_${response.status}`);
  }
  return response.json() as Promise<CoachHomeworkFeedResponse>;
}

export async function startCoachHomeworkTask(userId: string, taskId: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/coach/homework/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, taskId, source: 'mobile_profile' }),
  });
  if (!response.ok) {
    throw new Error(`coach_homework_start_failed_${response.status}`);
  }
}
