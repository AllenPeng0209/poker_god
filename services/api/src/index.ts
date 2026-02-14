import Fastify, { type FastifyReply } from 'fastify';
import cors from '@fastify/cors';
import type {
  AnalyticsIngestRequest,
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
  HealthResponse,
  LeakReportResponse,
  PracticeCompleteSessionResponse,
  PracticeSessionStartRequest,
  PracticeSessionStartResponse,
  PracticeSubmitAnswerRequest,
  PracticeSubmitAnswerResponse,
  TrainingZonesResponse,
  ZenChatRequest,
  ZenChatResponse,
} from '@poker-god/contracts';
import { trainingZones } from '@poker-god/domain-poker/data/zones';
import {
  buildLeakReport,
  coachChat,
  coachCreateDrillAction,
  coachCreatePlanAction,
  completePracticeSession,
  createAnalyzeUpload,
  createDrill,
  getAnalyzeUpload,
  ingestAnalyticsEvents,
  listAnalyzeHands,
  listDrills,
  startPracticeSession,
  submitPracticeAnswer,
} from './mvpStore';
import { generateZenChat } from './zenChat';

type ErrorBody = {
  code: string;
  message: string;
  requestId: string;
};

const app = Fastify({
  logger: true,
});

await app.register(cors, {
  origin: true,
});

function requestId() {
  return crypto.randomUUID();
}

function badRequest(reply: FastifyReply, id: string, code: string, message: string): ErrorBody {
  reply.code(400);
  return { code, message, requestId: id };
}

function notFound(reply: FastifyReply, id: string, code: string, message: string): ErrorBody {
  reply.code(404);
  return { code, message, requestId: id };
}

function conflict(reply: FastifyReply, id: string, code: string, message: string): ErrorBody {
  reply.code(409);
  return { code, message, requestId: id };
}

app.get('/health', async (): Promise<HealthResponse> => {
  return {
    status: 'ok',
    service: 'poker-god-api',
    timestamp: new Date().toISOString(),
  };
});

app.get('/api/training/zones', async (): Promise<TrainingZonesResponse> => {
  return {
    zones: trainingZones,
  };
});

app.post<{ Body: ZenChatRequest }>(
  '/api/zen/chat',
  async (
    request,
    reply,
  ): Promise<ZenChatResponse | ErrorBody> => {
    const id = requestId();
    const body = request.body;
    if (!body || typeof body !== 'object') {
      return badRequest(reply, id, 'invalid_body', 'invalid request body');
    }

    if (!body.sessionId || typeof body.sessionId !== 'string') {
      return badRequest(reply, id, 'missing_session_id', 'sessionId is required');
    }

    const message = typeof body.message === 'string' ? body.message.trim() : '';
    if (!message || message.length > 2000) {
      return badRequest(reply, id, 'invalid_message', 'message must be between 1 and 2000 chars');
    }

    return generateZenChat({
      ...body,
      message,
    });
  },
);

app.get('/api/practice/drills', async (): Promise<DrillListResponse> => {
  return listDrills(requestId());
});

app.post<{ Body: DrillCreateRequest }>(
  '/api/practice/drills',
  async (
    request,
    reply,
  ): Promise<DrillCreateResponse | ErrorBody> => {
    const id = requestId();
    const body = request.body;
    if (!body || typeof body.title !== 'string' || typeof body.itemCount !== 'number') {
      return badRequest(reply, id, 'invalid_body', 'title and itemCount are required');
    }

    if (body.itemCount < 1 || body.itemCount > 500) {
      return badRequest(reply, id, 'invalid_item_count', 'itemCount must be between 1 and 500');
    }

    return createDrill(id, body);
  },
);

app.post<{ Body: PracticeSessionStartRequest }>(
  '/api/practice/sessions/start',
  async (
    request,
    reply,
  ): Promise<PracticeSessionStartResponse | ErrorBody> => {
    const id = requestId();
    const body = request.body;
    if (!body || typeof body.drillId !== 'string') {
      return badRequest(reply, id, 'invalid_body', 'drillId is required');
    }

    const result = startPracticeSession(id, body);
    if (!result) {
      return notFound(reply, id, 'drill_not_found', `drill ${body.drillId} not found`);
    }

    return result;
  },
);

app.post<{ Params: { sessionId: string }; Body: PracticeSubmitAnswerRequest }>(
  '/api/practice/sessions/:sessionId/answer',
  async (
    request,
    reply,
  ): Promise<PracticeSubmitAnswerResponse | ErrorBody> => {
    const id = requestId();
    const { sessionId } = request.params;
    const body = request.body;
    if (!body || typeof body.itemId !== 'string' || typeof body.chosenAction !== 'string') {
      return badRequest(reply, id, 'invalid_body', 'itemId and chosenAction are required');
    }

    const decisionTimeMs = typeof body.decisionTimeMs === 'number' ? body.decisionTimeMs : 1000;
    const result = submitPracticeAnswer(id, sessionId, { ...body, decisionTimeMs });
    if (!result) {
      return notFound(reply, id, 'session_not_found', `session ${sessionId} not found or already completed`);
    }

    return result;
  },
);

app.post<{ Params: { sessionId: string } }>(
  '/api/practice/sessions/:sessionId/complete',
  async (
    request,
    reply,
  ): Promise<PracticeCompleteSessionResponse | ErrorBody> => {
    const id = requestId();
    const { sessionId } = request.params;
    const result = completePracticeSession(id, sessionId);
    if (!result) {
      return notFound(reply, id, 'session_not_found', `session ${sessionId} not found`);
    }

    return result;
  },
);

app.post<{ Body: AnalyzeUploadCreateRequest }>(
  '/api/analyze/uploads',
  async (
    request,
    reply,
  ): Promise<AnalyzeUploadResponse | ErrorBody> => {
    const id = requestId();
    const body = request.body;
    if (!body || typeof body.fileName !== 'string' || typeof body.content !== 'string') {
      return badRequest(reply, id, 'invalid_body', 'fileName and content are required');
    }

    return createAnalyzeUpload(id, {
      sourceSite: body.sourceSite || 'manual',
      fileName: body.fileName,
      content: body.content,
    });
  },
);

app.get<{ Params: { uploadId: string } }>(
  '/api/analyze/uploads/:uploadId',
  async (
    request,
    reply,
  ): Promise<AnalyzeUploadResponse | ErrorBody> => {
    const id = requestId();
    const result = getAnalyzeUpload(id, request.params.uploadId);
    if (!result) {
      return notFound(reply, id, 'upload_not_found', `upload ${request.params.uploadId} not found`);
    }

    return result;
  },
);

app.get<{
  Querystring: { uploadId?: string; sortBy?: 'ev_loss' | 'played_at'; position?: string; tag?: string };
}>(
  '/api/analyze/hands',
  async (
    request,
  ): Promise<AnalyzeHandsResponse> => {
    return listAnalyzeHands(requestId(), {
      uploadId: request.query.uploadId,
      sortBy: request.query.sortBy,
      position: request.query.position,
      tag: request.query.tag,
    });
  },
);

app.get<{ Querystring: { windowDays?: string } }>(
  '/api/reports/leaks',
  async (
    request,
  ): Promise<LeakReportResponse> => {
    const windowDays = Number(request.query.windowDays);
    const parsedWindow = windowDays === 7 || windowDays === 90 ? windowDays : 30;
    return buildLeakReport(requestId(), parsedWindow);
  },
);

app.post<{ Body: CoachChatRequest }>(
  '/api/coach/chat',
  async (
    request,
    reply,
  ): Promise<CoachChatResponse | ErrorBody> => {
    const id = requestId();
    const body = request.body;
    if (!body || typeof body.conversationId !== 'string' || typeof body.message !== 'string') {
      return badRequest(reply, id, 'invalid_body', 'conversationId and message are required');
    }

    const message = body.message.trim();
    if (message.length === 0 || message.length > 2000) {
      return badRequest(reply, id, 'invalid_message', 'message must be between 1 and 2000 chars');
    }

    return coachChat(id, { ...body, message });
  },
);

app.post<{ Body: CoachCreateDrillRequest }>(
  '/api/coach/actions/create-drill',
  async (
    request,
    reply,
  ): Promise<DrillCreateResponse | ErrorBody> => {
    const id = requestId();
    const body = request.body;
    if (!body || typeof body.conversationId !== 'string' || typeof body.itemCount !== 'number') {
      return badRequest(reply, id, 'invalid_body', 'conversationId and itemCount are required');
    }

    const result = coachCreateDrillAction(id, body);
    if ('code' in result) {
      return conflict(reply, id, result.code, result.message);
    }

    return result;
  },
);

app.post<{ Body: CoachCreatePlanRequest }>(
  '/api/coach/actions/create-plan',
  async (
    request,
    reply,
  ): Promise<CoachCreatePlanResponse | ErrorBody> => {
    const id = requestId();
    const body = request.body;
    if (!body || typeof body.conversationId !== 'string' || typeof body.weekStart !== 'string') {
      return badRequest(reply, id, 'invalid_body', 'conversationId and weekStart are required');
    }

    const result = coachCreatePlanAction(id, body);
    if ('code' in result) {
      return conflict(reply, id, result.code, result.message);
    }

    return result;
  },
);

app.post<{ Body: AnalyticsIngestRequest }>(
  '/api/events',
  async (
    request,
    reply,
  ): Promise<AnalyticsIngestResponse | ErrorBody> => {
    const id = requestId();
    const body = request.body;
    if (!body || !Array.isArray(body.events)) {
      return badRequest(reply, id, 'invalid_body', 'events must be an array');
    }

    return ingestAnalyticsEvents(id, body);
  },
);

const port = Number(process.env.PORT ?? 3001);
const host = process.env.HOST ?? '0.0.0.0';

try {
  await app.listen({ port, host });
  app.log.info(`API listening on http://${host}:${port}`);
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
