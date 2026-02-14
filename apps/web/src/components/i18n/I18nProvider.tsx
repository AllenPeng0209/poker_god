'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { DEFAULT_LOCALE, MESSAGES, SUPPORTED_LOCALES, type Locale } from '@/lib/i18n/messages';

type TranslateParams = Record<string, string | number>;

type I18nContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, params?: TranslateParams) => string;
  list: (key: string) => string[];
};

const I18N_STORAGE_KEY = 'zengto.locale';

const I18nContext = createContext<I18nContextValue | null>(null);

function isLocale(value: string): value is Locale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

function getByPath(source: unknown, key: string): unknown {
  const parts = key.split('.');
  let current: unknown = source;
  for (const part of parts) {
    if (!current || typeof current !== 'object' || !(part in current)) {
      return null;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function interpolate(template: string, params?: TranslateParams): string {
  if (!params) {
    return template;
  }
  return template.replace(/\{(\w+)\}/g, (_, token: string) => {
    const value = params[token];
    return value === undefined ? `{${token}}` : String(value);
  });
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);

  useEffect(() => {
    const saved = window.localStorage.getItem(I18N_STORAGE_KEY);
    if (saved && isLocale(saved)) {
      setLocaleState(saved);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(I18N_STORAGE_KEY, locale);
    document.documentElement.lang = locale;
  }, [locale]);

  const value = useMemo<I18nContextValue>(() => {
    const t = (key: string, params?: TranslateParams): string => {
      const localized = getByPath(MESSAGES[locale], key);
      const fallback = getByPath(MESSAGES[DEFAULT_LOCALE], key);
      const template =
        typeof localized === 'string' ? localized : typeof fallback === 'string' ? fallback : key;
      return interpolate(template, params);
    };

    const list = (key: string): string[] => {
      const localized = getByPath(MESSAGES[locale], key);
      if (Array.isArray(localized) && localized.every((item) => typeof item === 'string')) {
        return localized;
      }
      const fallback = getByPath(MESSAGES[DEFAULT_LOCALE], key);
      if (Array.isArray(fallback) && fallback.every((item) => typeof item === 'string')) {
        return fallback;
      }
      return [];
    };

    return {
      locale,
      setLocale: (nextLocale: Locale) => setLocaleState(nextLocale),
      t,
      list,
    };
  }, [locale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used inside I18nProvider');
  }
  return context;
}
