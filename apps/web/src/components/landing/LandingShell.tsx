'use client';

import Link from 'next/link';

import { useI18n } from '@/components/i18n/I18nProvider';
import { InquiryComposer } from '@/components/landing/InquiryComposer';

export function LandingShell() {
  const { t, list } = useI18n();

  return (
    <main className="landing-grid">
      <aside className="landing-side-nav" aria-label={t('landing.sideAria')}>
        <div>
          <p className="brand-mark">{t('landing.title')}</p>
          <p className="brand-subtitle">{t('landing.subtitle')}</p>
        </div>
        <nav>
          <ul>
            {list('landing.links').map((link) => (
              <li key={link}>{link}</li>
            ))}
          </ul>
        </nav>
        <Link href="/app/study" className="launch-link">
          {t('landing.launch')}
        </Link>
      </aside>

      <InquiryComposer />

      <section className="landing-right-panel" aria-label={t('landing.rightAria')}>
        <h2>{t('landing.buildNotes')}</h2>
        <ul>
          {list('landing.notes').map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>

        <div className="status-block">
          <span>{t('landing.webSkeleton')}</span>
          <strong>{t('landing.online')}</strong>
        </div>
      </section>
    </main>
  );
}
