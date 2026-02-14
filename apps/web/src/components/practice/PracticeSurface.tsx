'use client';

import { useMemo } from 'react';
import { useI18n } from '@/components/i18n/I18nProvider';
import { PracticeSessionPanel } from '@/components/practice/PracticeSessionPanel';

type PracticeSurfaceMode = 'expo' | 'legacy';

const DEFAULT_EXPO_WEB_URL = 'http://localhost:8081';

function normalizeSurfaceMode(raw: string | undefined): PracticeSurfaceMode {
  return raw?.trim().toLowerCase() === 'legacy' ? 'legacy' : 'expo';
}

function normalizeExpoWebBaseUrl(raw: string | undefined): string {
  return (raw?.trim() || DEFAULT_EXPO_WEB_URL).replace(/\/+$/, '');
}

function mapLocaleToMobileLanguage(locale: string): 'zh-CN' | 'en-US' {
  return locale === 'en-US' ? 'en-US' : 'zh-CN';
}

function buildPracticeIframeSrc(baseUrl: string, locale: string): string {
  try {
    const url = new URL(`${baseUrl}/`);
    url.searchParams.set('entry', 'practice');
    url.searchParams.set('embed', '1');
    url.searchParams.set('lang', mapLocaleToMobileLanguage(locale));
    return url.toString();
  } catch {
    const fallback = new URL(`${DEFAULT_EXPO_WEB_URL}/`);
    fallback.searchParams.set('entry', 'practice');
    fallback.searchParams.set('embed', '1');
    fallback.searchParams.set('lang', mapLocaleToMobileLanguage(locale));
    return fallback.toString();
  }
}

export function PracticeSurface() {
  const { locale, t } = useI18n();
  const mode = normalizeSurfaceMode(process.env.NEXT_PUBLIC_PRACTICE_SURFACE);

  if (mode === 'legacy') {
    return <PracticeSessionPanel />;
  }

  const expoBaseUrl = normalizeExpoWebBaseUrl(process.env.NEXT_PUBLIC_PRACTICE_EXPO_WEB_URL);
  const iframeSrc = useMemo(() => buildPracticeIframeSrc(expoBaseUrl, locale), [expoBaseUrl, locale]);

  return (
    <section className="practice-expo-panel" aria-labelledby="practice-title">
      <header className="mvp-panel__header">
        <div>
          <p className="module-eyebrow">{t('practice.eyebrow')}</p>
          <h1 id="practice-title">{t('practice.title')}</h1>
          <p>{t('practice.description')}</p>
        </div>
      </header>

      <div className="practice-expo-frame-shell">
        <iframe
          key={iframeSrc}
          className="practice-expo-frame"
          src={iframeSrc}
          title="Practice (Expo Web)"
          loading="eager"
          allow="clipboard-read; clipboard-write; autoplay"
        />
      </div>
    </section>
  );
}
