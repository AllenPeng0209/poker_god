'use client';

import type { Route } from 'next';
import Link from 'next/link';
import { useI18n } from '@/components/i18n/I18nProvider';
import { MODULE_CONFIG, type ModuleKey } from './moduleConfig';

type ModuleViewProps = {
  moduleKey: ModuleKey;
  actionHref?: Route;
  actionLabelKey?: string;
};

export function ModuleView({ moduleKey, actionHref, actionLabelKey }: ModuleViewProps) {
  const { t, list } = useI18n();
  const config = MODULE_CONFIG[moduleKey];
  const title = t(config.titleKey);
  const summary = t(config.summaryKey);
  const highlights = list(config.highlightsKey);

  return (
    <section className="module-panel" aria-labelledby={`module-title-${title}`}>
      <header>
        <p className="module-eyebrow">{t('module.common.workspace')}</p>
        <h1 id={`module-title-${title}`}>{title}</h1>
        <p>{summary}</p>
      </header>

      <div className="module-grid">
        <article className="module-card">
          <h2>{t('module.common.capabilityTitle')}</h2>
          <ul>
            {highlights.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>

        <article className="module-card module-card--accent">
          <h2>{t('module.common.placeholderTitle')}</h2>
          <p>{t('module.common.placeholderDesc1')}</p>
          <p>{t('module.common.placeholderDesc2')}</p>
          {actionHref && actionLabelKey ? (
            <div className="module-next-entry">
              <Link className="module-next-link" href={actionHref}>
                {t(actionLabelKey)}
              </Link>
            </div>
          ) : null}
        </article>
      </div>
    </section>
  );
}
