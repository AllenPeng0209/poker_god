import { Platform } from 'react-native';
import type { CoachHomeworkCompleteResponse, CoachHomeworkListResponse } from '@poker-god/contracts';

function defaultBaseUrl() {
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:3001';
  }
  return 'http://localhost:3001';
}

function apiBaseUrl() {
  return process.env.EXPO_PUBLIC_API_BASE_URL?.trim() || defaultBaseUrl();
}

export async function fetchCoachHomework(userId: string): Promise<CoachHomeworkListResponse> {
  const response = await fetch(`${apiBaseUrl()}/api/coach/homework?userId=${encodeURIComponent(userId)}`);
  if (!response.ok) {
    throw new Error(`fetch homework failed: ${response.status}`);
  }
  return response.json() as Promise<CoachHomeworkListResponse>;
}

export async function completeCoachHomeworkTask(userId: string, taskId: string): Promise<CoachHomeworkCompleteResponse> {
  const response = await fetch(`${apiBaseUrl()}/api/coach/homework/${encodeURIComponent(taskId)}/complete`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({ userId }),
  });

  if (!response.ok) {
    throw new Error(`complete homework failed: ${response.status}`);
  }

  return response.json() as Promise<CoachHomeworkCompleteResponse>;
}
