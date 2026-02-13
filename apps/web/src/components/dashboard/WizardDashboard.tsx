type DashboardModule = {
  title: string;
  subtitle: string;
  tone: 'mint' | 'blue' | 'gold';
  active?: boolean;
  badge?: string;
};

const DASHBOARD_MODULES: DashboardModule[] = [
  {
    title: 'Study',
    subtitle: 'Study any spot you want',
    tone: 'mint'
  },
  {
    title: 'Trainer',
    subtitle: 'Play vs. GTO opponent',
    tone: 'blue',
    active: true
  },
  {
    title: 'Uploads',
    subtitle: 'Analyze your game',
    tone: 'gold'
  },
  {
    title: 'Custom solutions',
    subtitle: 'Use AI to solve any spot',
    tone: 'mint'
  },
  {
    title: 'Range builder',
    subtitle: 'Practice range construction',
    tone: 'blue'
  },
  {
    title: 'Hands',
    subtitle: 'Study analyzed hands',
    tone: 'gold',
    badge: 'NEW'
  },
  {
    title: 'Custom reports',
    subtitle: 'Use AI to study all flops',
    tone: 'mint'
  },
  {
    title: 'Drills',
    subtitle: 'Manage training drills',
    tone: 'blue'
  },
  {
    title: 'Coaching',
    subtitle: 'Live coaching with pros',
    tone: 'mint'
  }
];

const TRAINER_STATS = [
  { label: 'Best', value: 77, tone: 'good' },
  { label: 'Correct', value: 11, tone: 'good-light' },
  { label: 'Inaccuracy', value: 3, tone: 'warn' },
  { label: 'Wrong', value: 5, tone: 'bad' },
  { label: 'Blunder', value: 13, tone: 'bad-dark' }
] as const;

export function WizardDashboard() {
  return (
    <section className="wizard-dashboard">
      <article className="panel panel--dashboard">
        <header className="panel__header">
          <h3>Dashboard</h3>
        </header>

        <div className="dashboard-module-grid">
          {DASHBOARD_MODULES.map((module) => (
            <button
              type="button"
              key={module.title}
              className={
                module.active
                  ? `module-tile module-tile--${module.tone} module-tile--active`
                  : `module-tile module-tile--${module.tone}`
              }
            >
              <span className="module-tile__icon">{module.title.slice(0, 1)}</span>
              <span className="module-tile__body">
                <strong>{module.title}</strong>
                <small>{module.subtitle}</small>
              </span>
              {module.badge ? <em className="module-tile__badge">{module.badge}</em> : null}
            </button>
          ))}
        </div>
      </article>

      <div className="dashboard-stats-grid">
        <article className="panel panel--stats">
          <header className="panel__header">
            <h3>Trainer stats</h3>
          </header>

          <div className="stats-layout">
            <div className="stats-kpis">
              <div>
                <span>HANDS</span>
                <strong>72</strong>
              </div>
              <div>
                <span>MOVES</span>
                <strong>109</strong>
              </div>
              <div>
                <span>MISTAKES</span>
                <strong>18</strong>
              </div>
              <div>
                <span>GTOW SCORE</span>
                <strong>57%</strong>
              </div>
            </div>

            <div className="stats-bars">
              {TRAINER_STATS.map((stat) => (
                <div key={stat.label} className="stats-bar-row">
                  <span className={`stats-bar-row__label stats-bar-row__label--${stat.tone}`}>{stat.label}</span>
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
            <h3>Analyzer stats</h3>
          </header>

          <div className="stats-kpis stats-kpis--compact">
            <div>
              <span>HANDS</span>
              <strong>0</strong>
            </div>
            <div>
              <span>MOVES</span>
              <strong>0</strong>
            </div>
            <div>
              <span>MISTAKES</span>
              <strong>0</strong>
            </div>
            <div>
              <span>GTOW SCORE</span>
              <strong>0</strong>
            </div>
          </div>
        </article>
      </div>
    </section>
  );
}
