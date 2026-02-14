export type ModuleKey =
  | 'play'
  | 'study'
  | 'solver'
  | 'practice'
  | 'analyze'
  | 'reports'
  | 'arena'
  | 'learn'
  | 'aiCoachHistory';

export type ModuleConfig = {
  titleKey: string;
  summaryKey: string;
  highlightsKey: string;
};

export const MODULE_CONFIG: Record<ModuleKey, ModuleConfig> = {
  play: {
    titleKey: 'module.play.title',
    summaryKey: 'module.play.summary',
    highlightsKey: 'module.play.highlights',
  },
  study: {
    titleKey: 'module.study.title',
    summaryKey: 'module.study.summary',
    highlightsKey: 'module.study.highlights',
  },
  solver: {
    titleKey: 'module.solver.title',
    summaryKey: 'module.solver.summary',
    highlightsKey: 'module.solver.highlights',
  },
  practice: {
    titleKey: 'module.practice.title',
    summaryKey: 'module.practice.summary',
    highlightsKey: 'module.practice.highlights',
  },
  analyze: {
    titleKey: 'module.analyze.title',
    summaryKey: 'module.analyze.summary',
    highlightsKey: 'module.analyze.highlights',
  },
  reports: {
    titleKey: 'module.reports.title',
    summaryKey: 'module.reports.summary',
    highlightsKey: 'module.reports.highlights',
  },
  arena: {
    titleKey: 'module.arena.title',
    summaryKey: 'module.arena.summary',
    highlightsKey: 'module.arena.highlights',
  },
  learn: {
    titleKey: 'module.learn.title',
    summaryKey: 'module.learn.summary',
    highlightsKey: 'module.learn.highlights',
  },
  aiCoachHistory: {
    titleKey: 'module.aiCoachHistory.title',
    summaryKey: 'module.aiCoachHistory.summary',
    highlightsKey: 'module.aiCoachHistory.highlights',
  },
};
