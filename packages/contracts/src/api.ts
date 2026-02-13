import type { TrainingZone } from './poker';

export interface HealthResponse {
  status: 'ok';
  service: 'poker-god-api';
  timestamp: string;
}

export interface TrainingZonesResponse {
  zones: TrainingZone[];
}

export type ZenChatRole = 'user' | 'assistant';

export interface ZenChatMessage {
  role: ZenChatRole;
  content: string;
  createdAt?: string;
}

export interface ZenChatRequest {
  sessionId: string;
  message: string;
  history?: ZenChatMessage[];
  locale?: 'zh-CN' | 'en-US';
  context?: {
    source?: string;
    analysisJobId?: string;
  };
}

export interface ZenChatResponse {
  sessionId: string;
  reply: string;
  suggestions: string[];
  provider: 'heuristic' | 'openai' | 'qwen' | 'fallback';
  createdAt: string;
}
