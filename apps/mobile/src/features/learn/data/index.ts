import type { Copy, CourseModule, TrackKey } from '../types';
import { c } from '../types';
import { foundationModules } from './foundation';
import { mathRangeModules } from './mathRange';
import { postflopModules } from './postflop';
import { preflopModules } from './preflop';
import { procampModules } from './procamp';
import { profitModules } from './profit';

export const trackAccent: Record<TrackKey, string> = {
  foundation: '#86eaff',
  mathRange: '#ffbe78',
  preflop: '#cfff8c',
  postflop: '#ffe079',
  profit: '#ff9f85',
  procamp: '#d3b4ff',
};

export const trackLabel: Record<TrackKey, Copy> = {
  foundation: c('新手起步', 'Starter Core'),
  mathRange: c('数学与范围', 'Math and Range'),
  preflop: c('翻前实战', 'Preflop Combat'),
  postflop: c('翻后实战', 'Postflop Combat'),
  profit: c('进阶盈利', 'Exploit Profit'),
  procamp: c('职业训练营', 'Pro Camp'),
};

export const courseModules: CourseModule[] = [
  ...foundationModules,
  ...mathRangeModules,
  ...preflopModules,
  ...postflopModules,
  ...profitModules,
  ...procampModules,
];
