'use client';

import { useMemo, useState } from 'react';
import { useI18n } from '@/components/i18n/I18nProvider';

const MAX_LENGTH = 2000;

export function InquiryComposer() {
  const { t, list } = useI18n();
  const examples = list('landing.composer.examples');
  const [value, setValue] = useState<string>(examples[0] ?? '');
  const [activeExample, setActiveExample] = useState(0);

  const remaining = useMemo(() => MAX_LENGTH - value.length, [value.length]);

  return (
    <section className="landing-composer" aria-label={t('landing.composer.aria')}>
      <header className="landing-composer__header">
        <p className="landing-eyebrow">{t('landing.composer.eyebrow')}</p>
        <h1>{t('landing.composer.title')}</h1>
      </header>

      <label className="landing-label" htmlFor="prompt-input">
        {t('landing.composer.label')}
      </label>
      <textarea
        id="prompt-input"
        value={value}
        maxLength={MAX_LENGTH}
        onChange={(event) => {
          setValue(event.target.value);
        }}
        aria-label={t('landing.composer.inputAria')}
      />

      <footer className="landing-composer__footer">
        <span className={remaining <= 120 ? 'text-warning' : 'text-muted'}>
          {t('landing.composer.remaining', { count: remaining.toString() })}
        </span>
        <button type="button" className="ghost-button">
          {t('landing.composer.saveDraft')}
        </button>
      </footer>

      <div className="landing-examples" aria-label={t('landing.composer.aria')}>
        {examples.map((question, index) => (
          <button
            key={question}
            type="button"
            className={index === activeExample ? 'chip chip--active' : 'chip'}
            onClick={() => {
              setActiveExample(index);
              setValue(question);
            }}
          >
            {t('landing.composer.example', { index: (index + 1).toString() })}
          </button>
        ))}
      </div>

      <div className="landing-actions">
        <button type="button" className="primary-button">
          {t('landing.composer.joinBeta')}
        </button>
        <button type="button" className="secondary-button">
          {t('landing.composer.docs')}
        </button>
      </div>
    </section>
  );
}
