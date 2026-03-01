export type MobileEvHotspotRow = {
  key: string;
  label: string;
  sampleSize: number;
  totalEvLossBb100: number;
  sharePct: number;
};

export type MobileEvHotspotsSummary = {
  totalHands: number;
  totalEvLossBb100: number;
  biggestLeakKey: string | null;
  biggestLeakSharePct: number;
};

export type MobileEvHotspotsResponse = {
  generatedAt: string;
  windowDays: number;
  byStreet: MobileEvHotspotRow[];
  byPosition: MobileEvHotspotRow[];
  summary: MobileEvHotspotsSummary;
};

function resolveApiBaseUrl(): string {
  const baseUrl = process.env.EXPO_PUBLIC_POKER_GOD_API_BASE_URL?.trim();
  if (baseUrl && baseUrl.length > 0) {
    return baseUrl.replace(/\/+$/, '');
  }
  return 'http://localhost:3001';
}

export async function getMobileEvHotspots(windowDays: number): Promise<MobileEvHotspotsResponse> {
  const baseUrl = resolveApiBaseUrl();
  const url = `${baseUrl}/api/admin/coach/ev-hotspots?windowDays=${windowDays}`;
  const apiKey = process.env.EXPO_PUBLIC_POKER_GOD_API_KEY?.trim();

  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey ? { 'x-api-key': apiKey } : {}),
    },
  });

  if (!response.ok) {
    let message = `Failed to load EV hotspots (${response.status})`;
    try {
      const body = await response.json();
      if (body?.message && typeof body.message === 'string') {
        message = body.message;
      }
    } catch {
      // keep fallback message
    }
    throw new Error(message);
  }

  return (await response.json()) as MobileEvHotspotsResponse;
}
