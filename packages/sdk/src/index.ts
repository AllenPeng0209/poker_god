import type {
  HealthResponse,
  TrainingZonesResponse,
  ZenChatRequest,
  ZenChatResponse,
} from '@poker-god/contracts';

export interface ApiClientOptions {
  baseUrl: string;
}

export class PokerGodApiClient {
  private readonly baseUrl: string;

  constructor(options: ApiClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, '');
  }

  async getHealth(): Promise<HealthResponse> {
    const response = await fetch(`${this.baseUrl}/health`);
    if (!response.ok) {
      throw new Error(`Health check failed with status ${response.status}`);
    }
    return response.json() as Promise<HealthResponse>;
  }

  async listTrainingZones(): Promise<TrainingZonesResponse> {
    const response = await fetch(`${this.baseUrl}/api/training/zones`);
    if (!response.ok) {
      throw new Error(`listTrainingZones failed with status ${response.status}`);
    }
    return response.json() as Promise<TrainingZonesResponse>;
  }

  async sendZenChat(payload: ZenChatRequest): Promise<ZenChatResponse> {
    const response = await fetch(`${this.baseUrl}/api/zen/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`sendZenChat failed with status ${response.status}`);
    }

    return response.json() as Promise<ZenChatResponse>;
  }
}
