export type AppLanguage = 'zh-TW' | 'zh-CN' | 'en-US';

export type TrackKey = 'foundation' | 'mathRange' | 'preflop' | 'postflop' | 'profit' | 'procamp';

export type Copy = {
  zhTw: string;
  zhCn: string;
  en: string;
};

export type ConceptLesson = {
  title: Copy;
  bullets: Copy[];
};

export type VideoLesson = {
  title: Copy;
  duration: string;
  objective: Copy;
  deliverable: Copy;
};

export type HandCase = {
  title: Copy;
  setup: Copy;
  objective: Copy;
  streetPlan: Copy[];
  coachTakeaways: Copy[];
  passChecks: Copy[];
};

export type CourseModule = {
  id: string;
  week: string;
  track: TrackKey;
  level: 'L1' | 'L2' | 'L3' | 'L4';
  title: Copy;
  summary: Copy;
  coachCore: Copy;
  conceptLessons: ConceptLesson[];
  videoLessons: VideoLesson[];
  handCases: HandCase[];
  acceptanceChecks: Copy[];
  homework: Copy[];
  targetSample: Copy;
  passRule: Copy;
};

export function c(zh: string, en: string): Copy {
  return { zhTw: zh, zhCn: zh, en };
}

export function l(language: AppLanguage, zhTw: string, zhCn: string, en: string): string {
  if (language === 'zh-CN') return zhCn;
  if (language === 'en-US') return en;
  return zhTw;
}

export function lc(language: AppLanguage, copy: Copy): string {
  return l(language, copy.zhTw, copy.zhCn, copy.en);
}
