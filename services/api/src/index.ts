import Fastify from 'fastify';
import cors from '@fastify/cors';
import type {
  HealthResponse,
  TrainingZonesResponse,
  ZenChatRequest,
  ZenChatResponse,
} from '@poker-god/contracts';
import { trainingZones } from '@poker-god/domain-poker/data/zones';
import { generateZenChat } from './zenChat';

const app = Fastify({
  logger: true,
});

await app.register(cors, {
  origin: true,
});

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
  ): Promise<ZenChatResponse | { code: string; message: string }> => {
  const body = request.body;

  if (!body || typeof body !== 'object') {
    return reply.code(400).send({
      code: 'invalid_body',
      message: 'invalid request body',
    });
  }

  if (!body.sessionId || typeof body.sessionId !== 'string') {
    return reply.code(400).send({
      code: 'missing_session_id',
      message: 'sessionId is required',
    });
  }

  const message = typeof body.message === 'string' ? body.message.trim() : '';
  if (!message || message.length > 2000) {
    return reply.code(400).send({
      code: 'invalid_message',
      message: 'message must be between 1 and 2000 chars',
    });
  }

  return generateZenChat({
    ...body,
    message,
  });
});

const port = Number(process.env.PORT ?? 3001);
const host = process.env.HOST ?? '0.0.0.0';

try {
  await app.listen({ port, host });
  app.log.info(`API listening on http://${host}:${port}`);
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
