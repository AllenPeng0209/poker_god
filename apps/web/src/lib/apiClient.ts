import type {
  AnalyticsEvent,
  AnalyticsIngestResponse,
  AnalyzeHandsResponse,
  AnalyzeUploadCreateRequest,
  AnalyzeUploadResponse,
  CoachChatRequest,
  CoachChatResponse,
  CoachCreateDrillRequest,
  CoachCreatePlanRequest,
  CoachCreatePlanResponse,
  DrillCreateRequest,
  DrillCreateResponse,
  DrillListResponse,
  LeakReportResponse,
  PracticeCompleteSessionResponse,
  PracticeSessionStartRequest,
  PracticeSessionStartResponse,
  PracticeSubmitAnswerRequest,
  PracticeSubmitAnswerResponse,
  StudySpotListResponse,
} from '@poker-god/contracts';

type ApiErrorResponse = {
  code?: string;
  message?: string;
  requestId?: string;
};

const DEFAULT_API_BASE = 'http://localhost:3001';
const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? DEFAULT_API_BASE).replace(/\/+$/, '');
const PUBLIC_API_KEY = (process.env.NEXT_PUBLIC_API_KEY ?? '').trim();

async function parseError(response: Response): Promise<Error> {
  let errorMessage = `Request failed with status ${response.status}`;

  try {
    const data = (await response.json()) as ApiErrorResponse;
    if (typeof data.message === 'string' && data.message.length > 0) {
      errorMessage = data.message;
    }
  } catch {
    // Ignore JSON parse failure and keep default message.
  }

  return new Error(errorMessage);
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(PUBLIC_API_KEY ? { 'x-api-key': PUBLIC_API_KEY } : {}),
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    throw await parseError(response);
  }

  return response.json() as Promise<T>;
}

export const apiClient = {
  async createDrill(input: DrillCreateRequest): Promise<DrillCreateResponse> {
    return requestJson<DrillCreateResponse>('/api/practice/drills', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  async listDrills(): Promise<DrillListResponse> {
    return requestJson<DrillListResponse>('/api/practice/drills');
  },

  async listStudySpots(filters?: {
    format?: 'Cash 6-max' | 'Cash Heads-Up' | 'MTT 9-max';
    position?: 'BTN vs BB' | 'CO vs BTN' | 'SB vs BB' | 'UTG vs BB';
    stackBb?: 20 | 40 | 60 | 100;
    street?: 'Flop' | 'Turn' | 'River';
    limit?: number;
    offset?: number;
  }): Promise<StudySpotListResponse> {
    const query = new URLSearchParams();
    if (filters?.format) query.set('format', filters.format);
    if (filters?.position) query.set('position', filters.position);
    if (filters?.stackBb) query.set('stackBb', String(filters.stackBb));
    if (filters?.street) query.set('street', filters.street);
    if (typeof filters?.limit === 'number') query.set('limit', String(filters.limit));
    if (typeof filters?.offset === 'number') query.set('offset', String(filters.offset));

    const querySuffix = query.toString();
    return requestJson<StudySpotListResponse>(`/api/study/spots${querySuffix ? `?${querySuffix}` : ''}`);
  },

  async startPracticeSession(input: PracticeSessionStartRequest): Promise<PracticeSessionStartResponse> {
    return requestJson<PracticeSessionStartResponse>('/api/practice/sessions/start', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  async submitPracticeAnswer(
    sessionId: string,
    input: PracticeSubmitAnswerRequest,
  ): Promise<PracticeSubmitAnswerResponse> {
    return requestJson<PracticeSubmitAnswerResponse>(`/api/practice/sessions/${sessionId}/answer`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  async completePracticeSession(sessionId: string): Promise<PracticeCompleteSessionResponse> {
    return requestJson<PracticeCompleteSessionResponse>(`/api/practice/sessions/${sessionId}/complete`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
  },

  async createAnalyzeUpload(input: AnalyzeUploadCreateRequest): Promise<AnalyzeUploadResponse> {
    return requestJson<AnalyzeUploadResponse>('/api/analyze/uploads', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  async getAnalyzeUpload(uploadId: string): Promise<AnalyzeUploadResponse> {
    return requestJson<AnalyzeUploadResponse>(`/api/analyze/uploads/${uploadId}`);
  },

  async listAnalyzeHands(filters: {
    uploadId?: string;
    sortBy?: 'ev_loss' | 'played_at';
    position?: string;
    tag?: string;
  }): Promise<AnalyzeHandsResponse> {
    const query = new URLSearchParams();
    if (filters.uploadId) query.set('uploadId', filters.uploadId);
    if (filters.sortBy) query.set('sortBy', filters.sortBy);
    if (filters.position) query.set('position', filters.position);
    if (filters.tag) query.set('tag', filters.tag);

    return requestJson<AnalyzeHandsResponse>(`/api/analyze/hands?${query.toString()}`);
  },

  async getLeakReport(windowDays: 7 | 30 | 90): Promise<LeakReportResponse> {
    return requestJson<LeakReportResponse>(`/api/reports/leaks?windowDays=${windowDays}`);
  },

  async coachChat(input: CoachChatRequest): Promise<CoachChatResponse> {
    return requestJson<CoachChatResponse>('/api/coach/chat', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  async coachCreateDrill(input: CoachCreateDrillRequest): Promise<DrillCreateResponse> {
    return requestJson<DrillCreateResponse>('/api/coach/actions/create-drill', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  async coachCreatePlan(input: CoachCreatePlanRequest): Promise<CoachCreatePlanResponse> {
    return requestJson<CoachCreatePlanResponse>('/api/coach/actions/create-plan', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  async ingestEvents(events: AnalyticsEvent[]): Promise<AnalyticsIngestResponse> {
    return requestJson<AnalyticsIngestResponse>('/api/events', {
      method: 'POST',
      body: JSON.stringify({ events }),
    });
  },
};
