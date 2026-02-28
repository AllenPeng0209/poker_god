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
  StudySpotMatrixResponse,
  StudySpotListResponse,
  ZenChatRequest,
  ZenChatResponse,
} from '@poker-god/contracts';

type ApiErrorResponse = {
  code?: string;
  message?: string;
  requestId?: string;
};

const DEFAULT_API_BASE = 'http://localhost:3001';
const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? DEFAULT_API_BASE).replace(/\/+$/, '');
const PUBLIC_API_KEY = (process.env.NEXT_PUBLIC_API_KEY ?? '').trim();
const REQUEST_TIMEOUT_MS = Number(process.env.NEXT_PUBLIC_API_TIMEOUT_MS ?? 8000);
const RETRY_ENABLED = process.env.NEXT_PUBLIC_API_RETRY_V1 === '1';
const RETRYABLE_METHODS = new Set(['GET', 'HEAD']);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function nextRequestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `req_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
}

function parseRetryAfter(response: Response): number | null {
  const retryAfter = response.headers.get('Retry-After');
  if (!retryAfter) return null;

  const numericSeconds = Number(retryAfter);
  if (Number.isFinite(numericSeconds) && numericSeconds > 0) {
    return Math.min(numericSeconds * 1000, 3000);
  }

  const absolute = Date.parse(retryAfter);
  if (Number.isNaN(absolute)) return null;
  return Math.max(0, Math.min(absolute - Date.now(), 3000));
}

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

type RequestOptions = RequestInit & {
  timeoutMs?: number;
  retry?: boolean;
};

async function requestJson<T>(path: string, init?: RequestOptions): Promise<T> {
  const method = (init?.method ?? 'GET').toUpperCase();
  const timeoutMs = init?.timeoutMs ?? REQUEST_TIMEOUT_MS;
  const retryable = RETRY_ENABLED && (init?.retry ?? RETRYABLE_METHODS.has(method));
  const maxAttempts = retryable ? 2 : 1;

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const abortController = new AbortController();
    const timeoutHandle = setTimeout(() => abortController.abort(new Error('request_timeout')), timeoutMs);

    try {
      const requestId = nextRequestId();
      const response = await fetch(`${API_BASE_URL}${path}`, {
        ...init,
        signal: abortController.signal,
        headers: {
          'Content-Type': 'application/json',
          'x-request-id': requestId,
          ...(PUBLIC_API_KEY ? { 'x-api-key': PUBLIC_API_KEY } : {}),
          ...(init?.headers ?? {}),
        },
      });

      clearTimeout(timeoutHandle);

      if (!response.ok) {
        const statusRetryable = response.status >= 500 || response.status === 429;
        const canRetry = retryable && attempt < maxAttempts && statusRetryable;

        if (canRetry) {
          const serverBackoff = parseRetryAfter(response);
          const jitterBackoff = 250 + Math.floor(Math.random() * 250);
          await sleep(serverBackoff ?? jitterBackoff);
          continue;
        }

        throw await parseError(response);
      }

      return response.json() as Promise<T>;
    } catch (error) {
      clearTimeout(timeoutHandle);
      const requestError = error instanceof Error ? error : new Error(String(error));
      const isAbort = requestError.name === 'AbortError' || requestError.message.includes('request_timeout');
      const canRetry = retryable && attempt < maxAttempts && isAbort;
      lastError = isAbort
        ? new Error('请求超时，请检查网络后重试。')
        : requestError;

      if (canRetry) {
        await sleep(250 + Math.floor(Math.random() * 250));
        continue;
      }

      break;
    }
  }

  throw lastError ?? new Error('unknown_request_error');
}

export const apiClient = {
  async createDrill(input: DrillCreateRequest): Promise<DrillCreateResponse> {
    return requestJson<DrillCreateResponse>('/api/practice/drills', {
      method: 'POST',
      body: JSON.stringify(input),
      retry: false,
    });
  },

  async listDrills(): Promise<DrillListResponse> {
    return requestJson<DrillListResponse>('/api/practice/drills');
  },

  async listStudySpots(filters?: {
    format?: 'Cash 6-max' | 'Cash Heads-Up' | 'MTT 9-max';
    position?: 'BTN vs BB' | 'CO vs BTN' | 'SB vs BB' | 'UTG vs BB';
    stackBb?: 20 | 40 | 60 | 100 | 200;
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

  async getStudySpotMatrix(spotId: string): Promise<StudySpotMatrixResponse> {
    return requestJson<StudySpotMatrixResponse>(`/api/study/spots/${spotId}/matrix`);
  },

  async startPracticeSession(input: PracticeSessionStartRequest): Promise<PracticeSessionStartResponse> {
    return requestJson<PracticeSessionStartResponse>('/api/practice/sessions/start', {
      method: 'POST',
      body: JSON.stringify(input),
      retry: false,
    });
  },

  async submitPracticeAnswer(
    sessionId: string,
    input: PracticeSubmitAnswerRequest,
  ): Promise<PracticeSubmitAnswerResponse> {
    return requestJson<PracticeSubmitAnswerResponse>(`/api/practice/sessions/${sessionId}/answer`, {
      method: 'POST',
      body: JSON.stringify(input),
      retry: false,
    });
  },

  async completePracticeSession(sessionId: string): Promise<PracticeCompleteSessionResponse> {
    return requestJson<PracticeCompleteSessionResponse>(`/api/practice/sessions/${sessionId}/complete`, {
      method: 'POST',
      body: JSON.stringify({}),
      retry: false,
    });
  },

  async createAnalyzeUpload(input: AnalyzeUploadCreateRequest): Promise<AnalyzeUploadResponse> {
    return requestJson<AnalyzeUploadResponse>('/api/analyze/uploads', {
      method: 'POST',
      body: JSON.stringify(input),
      retry: false,
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

  async zenChat(input: ZenChatRequest): Promise<ZenChatResponse> {
    return requestJson<ZenChatResponse>('/api/zen/chat', {
      method: 'POST',
      body: JSON.stringify(input),
      retry: false,
    });
  },

  async coachChat(input: CoachChatRequest): Promise<CoachChatResponse> {
    return requestJson<CoachChatResponse>('/api/coach/chat', {
      method: 'POST',
      body: JSON.stringify(input),
      retry: false,
    });
  },

  async coachCreateDrill(input: CoachCreateDrillRequest): Promise<DrillCreateResponse> {
    return requestJson<DrillCreateResponse>('/api/coach/actions/create-drill', {
      method: 'POST',
      body: JSON.stringify(input),
      retry: false,
    });
  },

  async coachCreatePlan(input: CoachCreatePlanRequest): Promise<CoachCreatePlanResponse> {
    return requestJson<CoachCreatePlanResponse>('/api/coach/actions/create-plan', {
      method: 'POST',
      body: JSON.stringify(input),
      retry: false,
    });
  },

  async ingestEvents(events: AnalyticsEvent[]): Promise<AnalyticsIngestResponse> {
    return requestJson<AnalyticsIngestResponse>('/api/events', {
      method: 'POST',
      body: JSON.stringify({ events }),
      retry: false,
    });
  },
};
