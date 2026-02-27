import { Platform } from 'react-native';
import type { CoachDiagnosisResponse } from '@poker-god/contracts';

function defaultBaseUrl() {
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:3001';
  }
  return 'http://localhost:3001';
}

function apiBaseUrl() {
  return process.env.EXPO_PUBLIC_API_BASE_URL?.trim() || defaultBaseUrl();
}

export async function fetchCoachDiagnosis(userId: string): Promise<CoachDiagnosisResponse> {
  const response = await fetch(`${apiBaseUrl()}/api/coach/diagnosis?userId=${encodeURIComponent(userId)}`);
  if (!response.ok) {
    throw new Error(`fetch diagnosis failed: ${response.status}`);
  }
  return response.json() as Promise<CoachDiagnosisResponse>;
}
