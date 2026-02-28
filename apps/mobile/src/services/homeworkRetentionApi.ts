export type HomeworkRetentionStage = {
  key: string;
  label: string;
  sessions: number;
  conversionFromPreviousPct: number | null;
};

export type HomeworkRetentionSnapshot = {
  generatedAt: string;
  windowDays: number;
  attachRatePct: number;
  completionRatePct: number;
  staleRiskRatePct: number;
  biggestDropStageKey: string | null;
  stages: HomeworkRetentionStage[];
};

const DEFAULT_BASE_URL = 'http://127.0.0.1:8000';

function getBaseUrl(): string {
  const configured = process.env.EXPO_PUBLIC_POKER_GOD_API_BASE_URL?.trim();
  return configured && configured.length > 0 ? configured.replace(/\/$/, '') : DEFAULT_BASE_URL;
}

export async function fetchHomeworkRetention(windowDays = 30): Promise<HomeworkRetentionSnapshot> {
  const baseUrl = getBaseUrl();
  const requestUrl = `${baseUrl}/api/admin/coach/homework-retention?windowDays=${windowDays}`;

  const headers: Record<string, string> = {
    Accept: 'application/json',
  };
  const apiKey = process.env.EXPO_PUBLIC_POKER_GOD_API_KEY?.trim();
  if (apiKey) {
    headers['x-api-key'] = apiKey;
  }

  const response = await fetch(requestUrl, { method: 'GET', headers });
  if (!response.ok) {
    throw new Error(`retention_fetch_failed_${response.status}`);
  }

  const payload = (await response.json()) as HomeworkRetentionSnapshot;
  return payload;
}
