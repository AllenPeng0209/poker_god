'use client';

import { useI18n } from '@/components/i18n/I18nProvider';

type DashboardModule = {
  id: string;
  tone: 'mint' | 'blue' | 'gold';
  active?: boolean;
  badgeKey?: string;
};

const DASHBOARD_MODULES: DashboardModule[] = [
  {
    id: 'study',
    tone: 'mint'
  },
  {
    id: 'trainer',
    tone: 'blue',
    active: true
  },
  {
    id: 'uploads',
    tone: 'gold'
  },
  {
    id: 'customSolutions',
    tone: 'mint'
  },
  {
    id: 'rangeBuilder',
    tone: 'blue'
  },
  {
    id: 'hands',
    tone: 'gold',
    badgeKey: 'dashboard.module.hands.badge'
  },
  {
    id: 'customReports',
    tone: 'mint'
  },
  {
    id: 'drills',
    tone: 'blue'
  },
  {
    id: 'coaching',
    tone: 'mint'
  }
];

const TRAINER_STATS = [
  { labelKey: 'dashboard.stats.bars.best', value: 77, tone: 'good' },
  { labelKey: 'dashboard.stats.bars.correct', value: 11, tone: 'good-light' },
  { labelKey: 'dashboard.stats.bars.inaccuracy', value: 3, tone: 'warn' },
  { labelKey: 'dashboard.stats.bars.wrong', value: 5, tone: 'bad' },
  { labelKey: 'dashboard.stats.bars.blunder', value: 13, tone: 'bad-dark' }
] as const;

export function WizardDashboard() {
  const { t } = useI18n();

  return (
    <section className="wizard-dashboard">
      <article className="panel panel--dashboard">
        <header className="panel__header">
          <h3>{t('dashboard.title')}</h3>
        </header>

        <div className="dashboard-module-grid">
          {DASHBOARD_MODULES.map((module) => (
            <button
              type="button"
              key={module.id}
              className={
                module.active
                  ? `module-tile module-tile--${module.tone} module-tile--active`
                  : `module-tile module-tile--${module.tone}`
              }
            >
              <span className="module-tile__icon">{t(`dashboard.module.${module.id}.title`).slice(0, 1)}</span>
              <span className="module-tile__body">
                <strong>{t(`dashboard.module.${module.id}.title`)}</strong>
                <small>{t(`dashboard.module.${module.id}.subtitle`)}</small>
              </span>
              {module.badgeKey ? <em className="module-tile__badge">{t(module.badgeKey)}</em> : null}
            </button>
          ))}
        </div>
      </article>

      <div className="dashboard-stats-grid">
        <article className="panel panel--stats">
          <header className="panel__header">
            <h3>{t('dashboard.stats.trainerTitle')}</h3>
          </header>

          <div className="stats-layout">
            <div className="stats-kpis">
              <div>
                <span>{t('dashboard.stats.kpi.hands')}</span>
                <strong>72</strong>
              </div>
              <div>
                <span>{t('dashboard.stats.kpi.moves')}</span>
                <strong>109</strong>
              </div>
              <div>
                <span>{t('dashboard.stats.kpi.mistakes')}</span>
                <strong>18</strong>
              </div>
              <div>
                <span>{t('dashboard.stats.kpi.score')}</span>
                <strong>57%</strong>
              </div>
            </div>

            <div className="stats-bars">
              {TRAINER_STATS.map((stat) => (
                <div key={stat.labelKey} className="stats-bar-row">
                  <span className={`stats-bar-row__label stats-bar-row__label--${stat.tone}`}>{t(stat.labelKey)}</span>
                  <div className="stats-bar-row__track">
                    <div
                      className={`stats-bar-row__fill stats-bar-row__fill--${stat.tone}`}
                      style={{ width: `${Math.max(stat.value, 4)}%` }}
                    />
                  </div>
                  <strong>{stat.value}</strong>
                </div>
              ))}
            </div>
          </div>
        </article>

        <article className="panel panel--stats panel--compact">
          <header className="panel__header">
            <h3>{t('dashboard.stats.analyzerTitle')}</h3>
          </header>

          <div className="stats-kpis stats-kpis--compact">
            <div>
              <span>{t('dashboard.stats.kpi.hands')}</span>
              <strong>0</strong>
            </div>
            <div>
              <span>{t('dashboard.stats.kpi.moves')}</span>
              <strong>0</strong>
            </div>
            <div>
              <span>{t('dashboard.stats.kpi.mistakes')}</span>
              <strong>0</strong>
            </div>
            <div>
              <span>{t('dashboard.stats.kpi.score')}</span>
              <strong>0</strong>
            </div>
          </div>
        </article>
      </div>
    </section>
  );
}
