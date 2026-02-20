import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import * as Speech from 'expo-speech';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, DimensionValue, Easing, GestureResponderEvent, LayoutChangeEvent, Platform, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { BottomTabBar } from './src/components/navigation/BottomTabBar';
import { leakLabels, trainingZones } from './src/data/zones';
import { cardToDisplay } from './src/engine/cards';
import { analyzeCurrentSpot, applyHeroAction, createNewHand } from './src/engine/game';
import { accumulateHeroStats, createEmptyHeroStats, statRatePercent } from './src/engine/heroStats';
import type { HeroStatsSnapshot, RatioStat } from './src/engine/heroStats';
import { buildSpotInsight } from './src/engine/insights';
import { buildLocalCoachSummary, requestCoachVoiceAdvice } from './src/engine/qwenCoach';
import type { RootTab, RootTabItem } from './src/navigation/rootTabs';
import { LearnScreen } from './src/screens/LearnScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { ReviewScreen } from './src/screens/ReviewScreen';
import { applyDecisionResult, applyHandResult, getTopLeak, initialProgress, winRate } from './src/engine/progression';
import {
  countRecordedHands,
  ensureDefaultProfile,
  getHandRecordDetail,
  initializeLocalDb,
  listHandRecordSummaries,
  listRecordedZoneHandStats,
  loadProfileSnapshot,
  saveCompletedHandRecord,
  saveProfileSnapshot,
} from './src/storage/localDb';
import type { HandRecordDetail, HandRecordSummary, LocalProfile } from './src/storage/localDb';
import { ActionAdvice, ActionType, AiProfile, Card, HandState, HeroLeak, ProgressState, Street, TablePosition, TrainingZone } from './src/types/poker';

type Phase = 'lobby' | 'table';
type OppLeakGuess = keyof AiProfile['leakProfile'];
type SeatRole = 'hero' | 'ai' | 'empty';
type TableEventKind = 'deal' | 'blind' | 'action' | 'street' | 'reveal' | 'hint';
type SfxKey = 'deal' | 'blind' | 'check' | 'call' | 'raise' | 'allIn' | 'fold' | 'reveal' | 'ui';
type SfxVariant = { asset: number; volume: number };
type CoachMissionKind = 'steal_preflop' | 'bluff_catch' | 'profit_bb' | 'triple_barrel' | 'win_hands';
type CoachStatKey = 'vpip' | 'pfr' | 'threeBetPreflop' | 'foldToThreeBet' | 'flopCBet' | 'foldVsFlopCBet' | 'postflopReraise';
type CoachBenchmarkRange = { min: number; max: number };
type CoachBenchmarkVerdictTone = 'pending' | 'inRange' | 'high' | 'low';
type TrainingMode = 'career' | 'practice';
type AppLanguage = 'zh-TW' | 'zh-CN' | 'en-US';
type WebEntryMode = 'default' | 'practice';
type WebEntryConfig = { mode: WebEntryMode; embed: boolean; language: AppLanguage | null };

type Seat = { id: string; pos: TablePosition; role: SeatRole; ai?: AiProfile };
type SeatVisual = { cardsDealt: number; inHand: boolean; folded: boolean; lastAction: string };
type CoachMission = {
  id: string;
  kind: CoachMissionKind;
  title: string;
  detail: string;
  target: number;
  rewardXp: number;
  progress: number;
  completed: boolean;
  rewarded: boolean;
};
type ZoneTrainingState = {
  bankroll: Record<string, number>;
  heroBaseline: number;
  missions: CoachMission[];
  heroStats: HeroStatsSnapshot;
  handsPlayed: number;
  handsWon: number;
  handsTied: number;
  aidUses: number;
  subsidyClaimDate: string | null;
  loanDebt: number;
};
type HandMissionSignals = {
  heroWon: boolean;
  stealWin: boolean;
  bluffCatchWin: boolean;
  tripleBarrelWin: boolean;
};
type MissionResolution = {
  nextState: ZoneTrainingState;
  rewardXp: number;
  completedMissionTitles: string[];
};
type TableEvent = {
  id: string;
  kind: TableEventKind;
  seatId?: string;
  text: string;
  action?: ActionType;
  amount?: number;
  allIn?: boolean;
};

type SeatAnchor = {
  id: string;
  pos: TablePosition;
  seatLeft: DimensionValue;
  seatTop: DimensionValue;
};

type PersistedSeat = {
  id: string;
  role: SeatRole;
  aiId?: string;
};

type PersistedAppSnapshot = {
  schemaVersion: number;
  savedAt: string;
  zoneIndex: number;
  lobbyZone: number;
  progress: ProgressState;
  zoneTrainingById: Record<string, ZoneTrainingState>;
  seats: PersistedSeat[];
  buttonSeatId: string;
  selectedSeatId: string;
  battleSeatId: string | null;
  politeMode: boolean;
  autoPlayEvents: boolean;
  sfxEnabled: boolean;
  aiVoiceAssistEnabled?: boolean;
  trainingMode?: TrainingMode;
  appLanguage?: AppLanguage;
};

const HERO_SEAT = 'btn';
const BIG_BLIND_SIZE = 2;
const STARTING_BB = 100;
const STARTING_STACK = BIG_BLIND_SIZE * STARTING_BB;
const ACTION_FEED_LIMIT = 200;
const APP_SNAPSHOT_SCHEMA_VERSION = 1;
const BANKRUPTCY_RETURN_DELAY_MS = 16000;
const PRACTICE_XP_MULTIPLIER = 0.35;
const CAREER_XP_RESCUE_PENALTY_STEP = 0.3;
const CAREER_XP_RESCUE_MIN_MULTIPLIER = 0.4;
const SUBSIDY_BB = 40;
const LOAN_BB = 100;
const LOAN_REPAY_RATE = 0.25;
const NAV_DRAWER_WIDTH = 90;
const NAV_COLLAPSED_WIDTH = 44;
const NAV_IOS_LANDSCAPE_SAFE_LEFT = 0;
const tableOrder: TablePosition[] = ['UTG', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'];
function positionRelativeToButton(position: TablePosition, buttonPosition: TablePosition): TablePosition {
  const positionIdx = tableOrder.indexOf(position);
  const buttonIdx = tableOrder.indexOf(buttonPosition);
  const canonicalButtonIdx = tableOrder.indexOf('BTN');
  if (positionIdx === -1 || buttonIdx === -1 || canonicalButtonIdx === -1) {
    return position;
  }
  const relativeIdx = (positionIdx - buttonIdx + canonicalButtonIdx + tableOrder.length) % tableOrder.length;
  return tableOrder[relativeIdx];
}
const COACH_STAT_BENCHMARKS: Record<CoachStatKey, CoachBenchmarkRange> = {
  vpip: { min: 22, max: 32 },
  pfr: { min: 16, max: 26 },
  threeBetPreflop: { min: 6, max: 12 },
  foldToThreeBet: { min: 45, max: 65 },
  flopCBet: { min: 48, max: 68 },
  foldVsFlopCBet: { min: 35, max: 55 },
  postflopReraise: { min: 8, max: 18 },
};
const SFX_VARIANTS: Record<SfxKey, SfxVariant[]> = {
  deal: [
    { asset: require('./assets/sfx/deal-1.ogg'), volume: 0.95 },
    { asset: require('./assets/sfx/deal-2.ogg'), volume: 0.95 },
  ],
  blind: [
    { asset: require('./assets/sfx/blind-1.ogg'), volume: 0.88 },
    { asset: require('./assets/sfx/blind-2.ogg'), volume: 0.88 },
  ],
  check: [
    { asset: require('./assets/sfx/check-1.ogg'), volume: 0.7 },
    { asset: require('./assets/sfx/check-2.ogg'), volume: 0.7 },
  ],
  call: [
    { asset: require('./assets/sfx/call-1.ogg'), volume: 0.9 },
    { asset: require('./assets/sfx/call-2.ogg'), volume: 0.9 },
  ],
  raise: [
    { asset: require('./assets/sfx/raise-1.ogg'), volume: 0.96 },
    { asset: require('./assets/sfx/raise-2.ogg'), volume: 0.96 },
  ],
  allIn: [
    { asset: require('./assets/sfx/allin-1.ogg'), volume: 1.0 },
    { asset: require('./assets/sfx/allin-2.ogg'), volume: 1.0 },
  ],
  fold: [
    { asset: require('./assets/sfx/fold-1.ogg'), volume: 0.8 },
    { asset: require('./assets/sfx/fold-2.ogg'), volume: 0.8 },
  ],
  reveal: [
    { asset: require('./assets/sfx/reveal-1.ogg'), volume: 0.8 },
    { asset: require('./assets/sfx/reveal-2.ogg'), volume: 0.8 },
  ],
  ui: [
    { asset: require('./assets/sfx/ui-1.ogg'), volume: 0.75 },
  ],
};

const EMPTY_SPOT_INSIGHT = {
  outsGroups: [],
  outsCount: 0,
  oneCardHitRate: 0,
  twoCardHitRate: 0,
  rangeBuckets: [],
  rangeSamples: [],
  equity: { heroWin: 0, tie: 0, villainWin: 0 },
  potOddsNeed: 0,
  combosConsidered: 0,
  simulations: 0,
  notes: [],
};

function createEmptySfxMap(): Record<SfxKey, Audio.Sound[]> {
  return {
    deal: [],
    blind: [],
    check: [],
    call: [],
    raise: [],
    allIn: [],
    fold: [],
    reveal: [],
    ui: [],
  };
}

function findAiById(aiId?: string): AiProfile | undefined {
  if (!aiId) return undefined;
  for (const zone of trainingZones) {
    const hit = zone.aiPool.find((ai) => ai.id === aiId);
    if (hit) return hit;
  }
  return undefined;
}

const seatLayout: SeatAnchor[] = [
  { id: 'utg', pos: 'UTG', seatLeft: '20%', seatTop: '22%' },
  { id: 'lj', pos: 'LJ', seatLeft: '50%', seatTop: '9%' },
  { id: 'hj', pos: 'HJ', seatLeft: '80%', seatTop: '22%' },
  { id: 'co', pos: 'CO', seatLeft: '87%', seatTop: '47%' },
  { id: 'btn', pos: 'BTN', seatLeft: '69%', seatTop: '78%' },
  { id: 'sb', pos: 'SB', seatLeft: '31%', seatTop: '78%' },
  { id: 'bb', pos: 'BB', seatLeft: '13%', seatTop: '47%' },
];

const oppLeakKeys: OppLeakGuess[] = ['overFoldToRaise', 'callsTooWide', 'overBluffsRiver', 'cBetsTooMuch', 'missesThinValue'];
const heroLeakLabelsByLanguage: Record<AppLanguage, Record<HeroLeak, string>> = {
  'zh-TW': leakLabels,
  'zh-CN': {
    overFold: '面对压力过度弃牌',
    overCall: '过度跟注',
    overBluff: '无效唬牌太多',
    missedValue: '强牌价值下注不足',
    passiveCheck: '太被动，该进攻时没有进攻',
  },
  'en-US': {
    overFold: 'Over-folding under pressure',
    overCall: 'Over-calling',
    overBluff: 'Too many low-EV bluffs',
    missedValue: 'Missing value with strong hands',
    passiveCheck: 'Too passive in aggressive spots',
  },
};
const oppLeakLabelsByLanguage: Record<AppLanguage, Record<OppLeakGuess, string>> = {
  'zh-TW': {
    overFoldToRaise: '被加注常棄牌',
    callsTooWide: '跟注過寬',
    overBluffsRiver: '河牌唬牌過量',
    cBetsTooMuch: 'c-bet 過高',
    missesThinValue: '薄價值下注不足',
  },
  'zh-CN': {
    overFoldToRaise: '被加注常弃牌',
    callsTooWide: '跟注过宽',
    overBluffsRiver: '河牌唬牌过量',
    cBetsTooMuch: 'c-bet 过高',
    missesThinValue: '薄价值下注不足',
  },
  'en-US': {
    overFoldToRaise: 'Folds too much vs raises',
    callsTooWide: 'Calls too wide',
    overBluffsRiver: 'Over-bluffs river',
    cBetsTooMuch: 'C-bets too often',
    missesThinValue: 'Misses thin value',
  },
};
const appLanguages: AppLanguage[] = ['zh-TW', 'zh-CN', 'en-US'];
const appLanguageLabels: Record<AppLanguage, string> = {
  'zh-TW': '繁體中文',
  'zh-CN': '简体中文',
  'en-US': 'English',
};
const uiTranslations: Record<AppLanguage, Record<string, string>> = {
  'zh-TW': {
    lobby_marquee: '今日重點：用已解鎖房間穩定累積資金與任務 XP，再往高難度區推進。',
    lobby_title: '德州撲克牌桌大廳',
    lobby_subtitle: '固定橫向佈局，直接點房間進場，不用下拉捲動。',
    lobby_stat_unlocked: '已解鎖',
    lobby_stat_hands: '對局',
    lobby_stat_record: '紀錄',
    lobby_stat_win_rate: '勝率',
    lobby_rooms_title: '房間難度選擇',
    lobby_rooms_count: '{count} 區房間',
    lobby_room_table: '桌 {count}',
    lobby_room_online: '在線 {count}',
    lobby_room_tail: '資金 {bb}bb · 任務 {done}/{total}',
    lobby_panel_locked: '待解鎖',
    lobby_panel_ready: '可立即進場',
    mode_career: '生涯模式',
    mode_practice: '練習模式',
    mode_short_career: '生涯',
    mode_short_practice: '練習',
    mode_hint_practice: '練習模式：不限資金續打，任務停用，XP {xp}%。',
    mode_hint_career: '生涯模式：資金與任務生效，XP 係數 {xp}%。',
    meta_zone_bankroll: '區域資金',
    meta_profit: '資金累積',
    meta_missions: '任務進度',
    meta_opponents: '對手池',
    enter_table: '進入 {zone} 牌桌 · {mode}',
    settings_title: '基礎設定',
    settings_subtitle: '先放帳號、語言、預設玩法，之後功能都往這裡擴充。',
    close: '關閉',
    settings_account: '帳號',
    settings_identity: '目前身份：{name}',
    guest_mode: '訪客模式',
    settings_account_desc: '這裡預留登入、綁定、同步進度等帳號能力。',
    settings_account_center: '帳號中心（預留）',
    note_account_center_reserved: '帳號中心入口已預留，後續可接登入與綁定流程。',
    settings_language: '語言',
    settings_current_language: '目前語言：{language}',
    note_language_switched: '語言已切換為 {language}。',
    settings_defaults: '預設體驗',
    settings_sfx_title: '音效',
    settings_sfx_sub: '進桌後是否播放音效',
    settings_ai_voice_title: 'AI 語音建議',
    settings_ai_voice_sub: '輪到你時自動播報',
    settings_polite_title: '禮貌模式',
    settings_polite_sub: '改用較保守的對話語氣',
    toggle_on: '開',
    toggle_off: '關',
    zone_unlocked: '已解鎖',
    zone_unlock_hint: '完成 {zone} 全部任務 或 再拿 {xp} XP',
    lobby_locked_note: '尚未解鎖 {zone}。條件：{hint}。',
    opponent_few_leaks: '此對手漏洞較少',
    opponent_not_assigned: '尚未指定對手',
    table_line_mode_stack: '{mode}資金 {stack}（{bb}bb）',
    button_select_game: '選局',
    room_state_open: 'OPEN',
    room_state_live: 'LIVE',
    room_state_lock: 'LOCK',
    room_count_unit: 'rooms',
  },
  'zh-CN': {
    lobby_marquee: '今日重点：先在已解锁房间稳定积累资金与任务 XP，再往高难度区推进。',
    lobby_title: '德州扑克牌桌大厅',
    lobby_subtitle: '固定横向布局，直接点房间进场，不用下拉滚动。',
    lobby_stat_unlocked: '已解锁',
    lobby_stat_hands: '对局',
    lobby_stat_record: '记录',
    lobby_stat_win_rate: '胜率',
    lobby_rooms_title: '房间难度选择',
    lobby_rooms_count: '{count} 区房间',
    lobby_room_table: '桌 {count}',
    lobby_room_online: '在线 {count}',
    lobby_room_tail: '资金 {bb}bb · 任务 {done}/{total}',
    lobby_panel_locked: '待解锁',
    lobby_panel_ready: '可立即进场',
    mode_career: '生涯模式',
    mode_practice: '练习模式',
    mode_short_career: '生涯',
    mode_short_practice: '练习',
    mode_hint_practice: '练习模式：不限资金续打，任务停用，XP {xp}%。',
    mode_hint_career: '生涯模式：资金与任务生效，XP 系数 {xp}%。',
    meta_zone_bankroll: '区域资金',
    meta_profit: '资金累积',
    meta_missions: '任务进度',
    meta_opponents: '对手池',
    enter_table: '进入 {zone} 牌桌 · {mode}',
    settings_title: '基础设置',
    settings_subtitle: '先放账号、语言、预设玩法，之后功能都往这里扩充。',
    close: '关闭',
    settings_account: '账号',
    settings_identity: '当前身份：{name}',
    guest_mode: '访客模式',
    settings_account_desc: '这里预留登录、绑定、同步进度等账号能力。',
    settings_account_center: '账号中心（预留）',
    note_account_center_reserved: '账号中心入口已预留，后续可接登录与绑定流程。',
    settings_language: '语言',
    settings_current_language: '当前语言：{language}',
    note_language_switched: '语言已切换为 {language}。',
    settings_defaults: '预设体验',
    settings_sfx_title: '音效',
    settings_sfx_sub: '进桌后是否播放音效',
    settings_ai_voice_title: 'AI 语音建议',
    settings_ai_voice_sub: '轮到你时自动播报',
    settings_polite_title: '礼貌模式',
    settings_polite_sub: '改用较保守的对话语气',
    toggle_on: '开',
    toggle_off: '关',
    zone_unlocked: '已解锁',
    zone_unlock_hint: '完成 {zone} 全部任务 或 再拿 {xp} XP',
    lobby_locked_note: '尚未解锁 {zone}。条件：{hint}。',
    opponent_few_leaks: '此对手漏洞较少',
    opponent_not_assigned: '尚未指定对手',
    table_line_mode_stack: '{mode}资金 {stack}（{bb}bb）',
    button_select_game: '选局',
    room_state_open: 'OPEN',
    room_state_live: 'LIVE',
    room_state_lock: 'LOCK',
    room_count_unit: 'rooms',
  },
  'en-US': {
    lobby_marquee: 'Today: grow bankroll and mission XP in unlocked rooms, then move up.',
    lobby_title: 'Texas Holdem Lobby',
    lobby_subtitle: 'Fixed landscape layout. Tap a room to enter, no vertical scrolling.',
    lobby_stat_unlocked: 'Unlocked',
    lobby_stat_hands: 'Hands',
    lobby_stat_record: 'Record',
    lobby_stat_win_rate: 'Win Rate',
    lobby_rooms_title: 'Room Difficulty',
    lobby_rooms_count: '{count} rooms',
    lobby_room_table: 'Tbl {count}',
    lobby_room_online: 'On {count}',
    lobby_room_tail: 'Bankroll {bb}bb · Missions {done}/{total}',
    lobby_panel_locked: 'Locked',
    lobby_panel_ready: 'Ready',
    mode_career: 'Career',
    mode_practice: 'Practice',
    mode_short_career: 'Career',
    mode_short_practice: 'Practice',
    mode_hint_practice: 'Practice: infinite bankroll, missions off, XP {xp}%.',
    mode_hint_career: 'Career: bankroll and missions active, XP factor {xp}%.',
    meta_zone_bankroll: 'Zone Bankroll',
    meta_profit: 'Profit',
    meta_missions: 'Mission Progress',
    meta_opponents: 'Opponent Pool',
    enter_table: 'Enter {zone} · {mode}',
    settings_title: 'Basic Settings',
    settings_subtitle: 'Account, language, and defaults. More options will be added here.',
    close: 'Close',
    settings_account: 'Account',
    settings_identity: 'Current role: {name}',
    guest_mode: 'Guest Mode',
    settings_account_desc: 'Login, account linking, and progress sync will be added here.',
    settings_account_center: 'Account Center (Coming Soon)',
    note_account_center_reserved: 'Account Center entry is reserved for login and linking flow.',
    settings_language: 'Language',
    settings_current_language: 'Current language: {language}',
    note_language_switched: 'Language switched to {language}.',
    settings_defaults: 'Default Experience',
    settings_sfx_title: 'Sound Effects',
    settings_sfx_sub: 'Play sounds after entering a table',
    settings_ai_voice_title: 'AI Voice Tips',
    settings_ai_voice_sub: 'Auto-play tips when it is your turn',
    settings_polite_title: 'Polite Mode',
    settings_polite_sub: 'Use a more conservative coaching tone',
    toggle_on: 'On',
    toggle_off: 'Off',
    zone_unlocked: 'Unlocked',
    zone_unlock_hint: 'Complete all missions in {zone} or earn {xp} XP',
    lobby_locked_note: '{zone} is locked. Requirement: {hint}.',
    opponent_few_leaks: 'This opponent has few obvious leaks',
    opponent_not_assigned: 'No opponent selected',
    table_line_mode_stack: '{mode} bankroll {stack} ({bb}bb)',
    button_select_game: 'Lobby',
    room_state_open: 'OPEN',
    room_state_live: 'LIVE',
    room_state_lock: 'LOCK',
    room_count_unit: 'rooms',
  },
};
const zoneTranslations: Record<AppLanguage, Record<string, { name: string; subtitle: string; recommendedFocus: string[] }>> = {
  'zh-TW': {},
  'zh-CN': {
    rookie: {
      name: '小白区',
      subtitle: '建立基本框架：位置、底池赔率、标准下注',
      recommendedFocus: ['Preflop 入池范围', 'Flop 不乱跟注', '理解 fold / call / raise 的代价'],
    },
    starter: {
      name: '入门区',
      subtitle: '开始辨认对手类型并调整对策',
      recommendedFocus: ['对抗 c-bet 过高对手', '减少无计划的 turn 跟注', '学习 value raise'],
    },
    advanced: {
      name: '进阶区',
      subtitle: '加入混合策略与河牌决策压力',
      recommendedFocus: ['分辨 bluff catcher', '平衡 value 与 bluff 比例', '学习 exploit 切换时机'],
    },
    pro: {
      name: '高手区',
      subtitle: '偏 GTO + 少量精准剥削',
      recommendedFocus: ['掌握多街规划', '读懂下注尺寸背后范围', '减少情绪下注'],
    },
    legend: {
      name: '大神区',
      subtitle: '高压对局，几乎没有明显漏洞',
      recommendedFocus: ['对抗高压 3-barrel', '反向 exploit', '最小可被剥削策略'],
    },
    godrealm: {
      name: '神域区',
      subtitle: '终局试炼，对手会持续自适应你的每个习惯',
      recommendedFocus: ['反制动态频率调整', '高压下注线最小损失', '即时 exploit / anti-exploit 切换'],
    },
  },
  'en-US': {
    rookie: {
      name: 'Rookie',
      subtitle: 'Build core fundamentals: position, pot odds, standard sizing',
      recommendedFocus: ['Preflop entry ranges', 'Do not over-call flops', 'Understand fold / call / raise tradeoffs'],
    },
    starter: {
      name: 'Starter',
      subtitle: 'Identify opponent archetypes and adjust',
      recommendedFocus: ['Exploit high c-bet opponents', 'Reduce unplanned turn calls', 'Learn value raises'],
    },
    advanced: {
      name: 'Advanced',
      subtitle: 'Add mixed strategies and river pressure',
      recommendedFocus: ['Identify bluff catchers', 'Balance value and bluff', 'Switch exploit timing'],
    },
    pro: {
      name: 'Pro',
      subtitle: 'Mostly GTO with precise exploits',
      recommendedFocus: ['Plan multi-street lines', 'Read ranges behind sizing', 'Avoid emotional betting'],
    },
    legend: {
      name: 'Legend',
      subtitle: 'High-pressure games with few obvious leaks',
      recommendedFocus: ['Defend against 3-barrel pressure', 'Reverse exploit adjustments', 'Minimally exploitable play'],
    },
    godrealm: {
      name: 'Godrealm',
      subtitle: 'Endgame trial with adaptive opponents',
      recommendedFocus: ['Counter dynamic frequency shifts', 'Min-loss lines under pressure', 'Real-time exploit / anti-exploit'],
    },
  },
};
const missionTitleTranslations: Record<string, { 'zh-CN': string; 'en-US': string }> = {
  '偷盲入門': { 'zh-CN': '偷盲入门', 'en-US': 'Steal Basics' },
  '穩定拿池': { 'zh-CN': '稳定拿池', 'en-US': 'Stable Pot Wins' },
  '淨贏 80bb': { 'zh-CN': '净赢 80bb', 'en-US': 'Net +80bb' },
  '位置偷雞': { 'zh-CN': '位置偷鸡', 'en-US': 'Positional Steal' },
  '抓河牌唬牌': { 'zh-CN': '抓河牌唬牌', 'en-US': 'Catch River Bluffs' },
  '淨贏 120bb': { 'zh-CN': '净赢 120bb', 'en-US': 'Net +120bb' },
  '高壓 bluff catch': { 'zh-CN': '高压 bluff catch', 'en-US': 'High-pressure Bluff Catch' },
  '三槍壓制': { 'zh-CN': '三枪压制', 'en-US': 'Triple Barrel Control' },
  '淨贏 180bb': { 'zh-CN': '净赢 180bb', 'en-US': 'Net +180bb' },
  '精準抓牌': { 'zh-CN': '精准抓牌', 'en-US': 'Precise Bluff Catch' },
  '多街線路規劃': { 'zh-CN': '多街线路规划', 'en-US': 'Multi-street Planning' },
  '淨贏 240bb': { 'zh-CN': '净赢 240bb', 'en-US': 'Net +240bb' },
  '大神抓牌課': { 'zh-CN': '大神抓牌课', 'en-US': 'Legend Bluff-catch Class' },
  '極限三槍': { 'zh-CN': '极限三枪', 'en-US': 'Extreme Triple Barrel' },
  '淨贏 300bb': { 'zh-CN': '净赢 300bb', 'en-US': 'Net +300bb' },
  '神域讀牌': { 'zh-CN': '神域读牌', 'en-US': 'Godrealm Hand Reading' },
  '終局連壓': { 'zh-CN': '终局连压', 'en-US': 'Endgame Barrel Run' },
  '淨贏 380bb': { 'zh-CN': '净赢 380bb', 'en-US': 'Net +380bb' },
};
const missionDetailTranslations: Record<string, { 'zh-CN': string; 'en-US': string }> = {
  'Preflop 主動加注後直接拿下底池 3 次': { 'zh-CN': 'Preflop 主动加注后直接拿下底池 3 次', 'en-US': 'Win the pot immediately after a preflop raise 3 times' },
  '贏下 4 手牌，先養成基礎勝率': { 'zh-CN': '赢下 4 手牌，先养成基础胜率', 'en-US': 'Win 4 hands to build baseline win rate' },
  '本區資金相對起始累積 +80bb': { 'zh-CN': '本区资金相对起始累计 +80bb', 'en-US': 'Accumulate +80bb from this zone baseline' },
  '利用 CO/BTN/SB 位置偷盲成功 4 次': { 'zh-CN': '利用 CO/BTN/SB 位置偷盲成功 4 次', 'en-US': 'Steal blinds from CO/BTN/SB successfully 4 times' },
  'River 跟注抓唬後贏牌 2 次': { 'zh-CN': 'River 跟注抓唬后赢牌 2 次', 'en-US': 'Win 2 hands by bluff-catching on river' },
  '本區資金累積 +120bb': { 'zh-CN': '本区资金累计 +120bb', 'en-US': 'Accumulate +120bb in this zone' },
  '在河牌做正確 bluff catch 並贏牌 3 次': { 'zh-CN': '在河牌做正确 bluff catch 并赢牌 3 次', 'en-US': 'Make correct river bluff-catches and win 3 times' },
  'Flop/Turn/River 連續進攻並拿下底池 2 次': { 'zh-CN': 'Flop/Turn/River 连续进攻并拿下底池 2 次', 'en-US': 'Run flop/turn/river aggression and win the pot 2 times' },
  '本區資金累積 +180bb': { 'zh-CN': '本区资金累计 +180bb', 'en-US': 'Accumulate +180bb in this zone' },
  '對高強度對手抓唬成功 4 次': { 'zh-CN': '对高强度对手抓唬成功 4 次', 'en-US': 'Bluff-catch successfully vs strong opponents 4 times' },
  '完成三槍施壓並贏牌 3 次': { 'zh-CN': '完成三枪施压并赢牌 3 次', 'en-US': 'Complete triple-barrel pressure and win 3 times' },
  '本區資金累積 +240bb': { 'zh-CN': '本区资金累计 +240bb', 'en-US': 'Accumulate +240bb in this zone' },
  '河牌 bluff catch 成功 5 次': { 'zh-CN': '河牌 bluff catch 成功 5 次', 'en-US': 'Land river bluff-catches 5 times' },
  '三槍壓制成功 4 次': { 'zh-CN': '三枪压制成功 4 次', 'en-US': 'Successful triple-barrel pressure 4 times' },
  '本區資金累積 +300bb': { 'zh-CN': '本区资金累计 +300bb', 'en-US': 'Accumulate +300bb in this zone' },
  '高壓河牌 bluff catch 成功 6 次': { 'zh-CN': '高压河牌 bluff catch 成功 6 次', 'en-US': 'High-pressure river bluff-catch success 6 times' },
  '三槍壓制成功 5 次': { 'zh-CN': '三枪压制成功 5 次', 'en-US': 'Successful triple-barrel pressure 5 times' },
  '本區資金累積 +380bb': { 'zh-CN': '本区资金累计 +380bb', 'en-US': 'Accumulate +380bb in this zone' },
};
type UiTranslationKey = keyof typeof uiTranslations['zh-TW'];

function t(language: AppLanguage, key: UiTranslationKey, vars?: Record<string, string | number>): string {
  const template = uiTranslations[language]?.[key] ?? uiTranslations['zh-TW'][key] ?? key;
  if (!vars) {
    return template;
  }
  return template.replace(/\{(\w+)\}/g, (_, token) => {
    const value = vars[token];
    return value === undefined || value === null ? '' : String(value);
  });
}

function l(language: AppLanguage, zhTW: string, zhCN: string, enUS: string): string {
  if (language === 'zh-CN') return zhCN;
  if (language === 'en-US') return enUS;
  return zhTW;
}

function containsCjk(text: string): boolean {
  return /[\u3400-\u9fff]/.test(text);
}

const zhTwToCnCharMap: Record<string, string> = {
  '體': '体',
  '點': '点',
  '擊': '击',
  '資': '资',
  '籌': '筹',
  '對': '对',
  '開': '开',
  '關': '关',
  '錄': '录',
  '戰': '战',
  '擇': '择',
  '時': '时',
  '這': '这',
  '來': '来',
  '會': '会',
  '動': '动',
  '務': '务',
  '區': '区',
  '龍': '龙',
  '數': '数',
  '樣': '样',
  '標': '标',
  '壓': '压',
  '學': '学',
  '習': '习',
  '練': '练',
  '進': '进',
  '後': '后',
  '與': '与',
  '優': '优',
  '線': '线',
  '價': '价',
  '佈': '布',
  '幣': '币',
  '補': '补',
  '將': '将',
  '沒': '没',
  '現': '现',
  '處': '处',
  '場': '场',
  '該': '该',
  '幾': '几',
  '還': '还',
  '歸': '归',
  '無': '无',
  '復': '复',
  '單': '单',
  '開牌': '开牌',
};

function toSimplified(text: string): string {
  let next = text;
  Object.entries(zhTwToCnCharMap).forEach(([from, to]) => {
    next = next.split(from).join(to);
  });
  return next;
}

function rt(text: string, language: AppLanguage, enFallback?: string): string {
  if (language === 'zh-TW') return text;
  if (language === 'zh-CN') return toSimplified(text);
  if (!containsCjk(text)) return text;
  return enFallback ?? 'Localized summary pending.';
}

function localizedZone(zone: TrainingZone, language: AppLanguage): { name: string; subtitle: string; recommendedFocus: string[] } {
  const localized = zoneTranslations[language]?.[zone.id];
  if (!localized) {
    return {
      name: zone.name,
      subtitle: zone.subtitle,
      recommendedFocus: zone.recommendedFocus,
    };
  }
  return localized;
}

function zoneName(zone: TrainingZone, language: AppLanguage): string {
  return localizedZone(zone, language).name;
}

function zoneSubtitle(zone: TrainingZone, language: AppLanguage): string {
  return localizedZone(zone, language).subtitle;
}

function zoneFocus(zone: TrainingZone, language: AppLanguage): string[] {
  return localizedZone(zone, language).recommendedFocus;
}

function oppLeakLabel(leak: OppLeakGuess, language: AppLanguage): string {
  return oppLeakLabelsByLanguage[language]?.[leak] ?? oppLeakLabelsByLanguage['zh-TW'][leak];
}

function heroLeakLabel(leak: HeroLeak, language: AppLanguage): string {
  return heroLeakLabelsByLanguage[language]?.[leak] ?? heroLeakLabelsByLanguage['zh-TW'][leak];
}

function missionTitle(title: string, language: AppLanguage): string {
  if (language === 'zh-TW') return title;
  return missionTitleTranslations[title]?.[language] ?? title;
}

function missionDetail(detail: string, language: AppLanguage): string {
  if (language === 'zh-TW') return detail;
  return missionDetailTranslations[detail]?.[language] ?? detail;
}

function coachMissionTemplates(zoneId: string): Array<Omit<CoachMission, 'progress' | 'completed' | 'rewarded'>> {
  if (zoneId === 'rookie') {
    return [
      { id: 'rk-steal', kind: 'steal_preflop', title: '偷盲入門', detail: 'Preflop 主動加注後直接拿下底池 3 次', target: 3, rewardXp: 38 },
      { id: 'rk-win', kind: 'win_hands', title: '穩定拿池', detail: '贏下 4 手牌，先養成基礎勝率', target: 4, rewardXp: 34 },
      { id: 'rk-profit', kind: 'profit_bb', title: '淨贏 80bb', detail: '本區資金相對起始累積 +80bb', target: 80, rewardXp: 90 },
    ];
  }
  if (zoneId === 'starter') {
    return [
      { id: 'st-steal', kind: 'steal_preflop', title: '位置偷雞', detail: '利用 CO/BTN/SB 位置偷盲成功 4 次', target: 4, rewardXp: 56 },
      { id: 'st-catch', kind: 'bluff_catch', title: '抓河牌唬牌', detail: 'River 跟注抓唬後贏牌 2 次', target: 2, rewardXp: 72 },
      { id: 'st-profit', kind: 'profit_bb', title: '淨贏 120bb', detail: '本區資金累積 +120bb', target: 120, rewardXp: 120 },
    ];
  }
  if (zoneId === 'advanced') {
    return [
      { id: 'ad-catch', kind: 'bluff_catch', title: '高壓 bluff catch', detail: '在河牌做正確 bluff catch 並贏牌 3 次', target: 3, rewardXp: 92 },
      { id: 'ad-3barrel', kind: 'triple_barrel', title: '三槍壓制', detail: 'Flop/Turn/River 連續進攻並拿下底池 2 次', target: 2, rewardXp: 108 },
      { id: 'ad-profit', kind: 'profit_bb', title: '淨贏 180bb', detail: '本區資金累積 +180bb', target: 180, rewardXp: 155 },
    ];
  }
  if (zoneId === 'pro') {
    return [
      { id: 'pr-catch', kind: 'bluff_catch', title: '精準抓牌', detail: '對高強度對手抓唬成功 4 次', target: 4, rewardXp: 118 },
      { id: 'pr-3barrel', kind: 'triple_barrel', title: '多街線路規劃', detail: '完成三槍施壓並贏牌 3 次', target: 3, rewardXp: 142 },
      { id: 'pr-profit', kind: 'profit_bb', title: '淨贏 240bb', detail: '本區資金累積 +240bb', target: 240, rewardXp: 188 },
    ];
  }
  if (zoneId === 'legend') {
    return [
      { id: 'lg-catch', kind: 'bluff_catch', title: '大神抓牌課', detail: '河牌 bluff catch 成功 5 次', target: 5, rewardXp: 146 },
      { id: 'lg-3barrel', kind: 'triple_barrel', title: '極限三槍', detail: '三槍壓制成功 4 次', target: 4, rewardXp: 182 },
      { id: 'lg-profit', kind: 'profit_bb', title: '淨贏 300bb', detail: '本區資金累積 +300bb', target: 300, rewardXp: 260 },
    ];
  }
  if (zoneId === 'godrealm') {
    return [
      { id: 'gr-catch', kind: 'bluff_catch', title: '神域讀牌', detail: '高壓河牌 bluff catch 成功 6 次', target: 6, rewardXp: 176 },
      { id: 'gr-3barrel', kind: 'triple_barrel', title: '終局連壓', detail: '三槍壓制成功 5 次', target: 5, rewardXp: 228 },
      { id: 'gr-profit', kind: 'profit_bb', title: '淨贏 380bb', detail: '本區資金累積 +380bb', target: 380, rewardXp: 320 },
    ];
  }
  return [
    { id: 'lg-catch', kind: 'bluff_catch', title: '大神抓牌課', detail: '河牌 bluff catch 成功 5 次', target: 5, rewardXp: 146 },
    { id: 'lg-3barrel', kind: 'triple_barrel', title: '極限三槍', detail: '三槍壓制成功 4 次', target: 4, rewardXp: 182 },
    { id: 'lg-profit', kind: 'profit_bb', title: '淨贏 300bb', detail: '本區資金累積 +300bb', target: 300, rewardXp: 260 },
  ];
}

function createCoachMissions(zoneId: string): CoachMission[] {
  return coachMissionTemplates(zoneId).map((template) => ({
    ...template,
    progress: 0,
    completed: false,
    rewarded: false,
  }));
}

function normalizeStackValue(raw: number): number {
  return Math.max(0, Math.round(raw));
}

function normalizeCounter(raw: number | undefined): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) {
    return 0;
  }
  return Math.max(0, Math.round(raw));
}

function normalizeDateKey(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== 'string') {
    return null;
  }
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null;
}

function normalizeTrainingMode(mode: TrainingMode | undefined): TrainingMode {
  return mode === 'practice' ? 'practice' : 'career';
}

function normalizeAppLanguage(language: AppLanguage | string | undefined): AppLanguage {
  if (language === 'zh-CN' || language === 'en-US') {
    return language;
  }
  return 'zh-TW';
}

function parseWebEntryLanguage(raw: string | null): AppLanguage | null {
  if (!raw) {
    return null;
  }
  const value = raw.trim();
  return value === 'zh-TW' || value === 'zh-CN' || value === 'en-US' ? value : null;
}

function readWebEntryConfig(): WebEntryConfig {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return { mode: 'default', embed: false, language: null };
  }

  const params = new URLSearchParams(window.location.search);
  const entryRaw = (params.get('entry') ?? '').trim().toLowerCase();
  const embedRaw = (params.get('embed') ?? '').trim().toLowerCase();

  return {
    mode: entryRaw === 'practice' ? 'practice' : 'default',
    embed: embedRaw === '1' || embedRaw === 'true' || embedRaw === 'yes',
    language: parseWebEntryLanguage(params.get('lang')),
  };
}

function localDateKey(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function bbToChips(bb: number): number {
  return Math.max(0, Math.round(bb * BIG_BLIND_SIZE));
}

function chipsToBb(chips: number, bigBlind: number = BIG_BLIND_SIZE): number {
  return Math.floor(Math.max(0, chips) / Math.max(1, bigBlind));
}

function careerXpMultiplier(aidUses: number): number {
  const adjusted = 1 - normalizeCounter(aidUses) * CAREER_XP_RESCUE_PENALTY_STEP;
  return Math.max(CAREER_XP_RESCUE_MIN_MULTIPLIER, Number(adjusted.toFixed(2)));
}

function resolveXpMultiplier(mode: TrainingMode, zoneState: ZoneTrainingState): number {
  if (mode === 'practice') {
    return PRACTICE_XP_MULTIPLIER;
  }
  return careerXpMultiplier(zoneState.aidUses);
}

function applyXpMultiplier(prev: ProgressState, next: ProgressState, multiplier: number): ProgressState {
  if (multiplier >= 0.999) {
    return next;
  }
  const delta = next.xp - prev.xp;
  if (delta <= 0) {
    return next;
  }
  const scaledXp = prev.xp + Math.round(delta * Math.max(0, multiplier));
  return {
    ...next,
    xp: scaledXp,
    zoneIndex: Math.max(prev.zoneIndex, unlockedZoneByXp(scaledXp)),
  };
}

function normalizeBankrollForSeats(seats: Seat[], bankroll?: Record<string, number>): Record<string, number> {
  const next: Record<string, number> = {};
  seats.forEach((seat) => {
    if (seat.role === 'empty') return;
    const raw = bankroll?.[seat.id];
    if (typeof raw === 'number' && Number.isFinite(raw)) {
      next[seat.id] = normalizeStackValue(raw);
      return;
    }
    next[seat.id] = STARTING_STACK;
  });
  return next;
}

function createZoneTrainingState(zone: TrainingZone, seats: Seat[]): ZoneTrainingState {
  const bankroll = normalizeBankrollForSeats(seats);
  return {
    bankroll,
    heroBaseline: bankroll[HERO_SEAT] ?? STARTING_STACK,
    missions: createCoachMissions(zone.id),
    heroStats: createEmptyHeroStats(),
    handsPlayed: 0,
    handsWon: 0,
    handsTied: 0,
    aidUses: 0,
    subsidyClaimDate: null,
    loanDebt: 0,
  };
}

function syncZoneTrainingState(zone: TrainingZone, seats: Seat[], current?: ZoneTrainingState): ZoneTrainingState {
  if (!current) {
    return createZoneTrainingState(zone, seats);
  }
  return {
    ...current,
    bankroll: normalizeBankrollForSeats(seats, current.bankroll),
    heroStats: current.heroStats ?? createEmptyHeroStats(),
    handsPlayed: normalizeCounter(current.handsPlayed),
    handsWon: normalizeCounter(current.handsWon),
    handsTied: normalizeCounter(current.handsTied),
    aidUses: normalizeCounter(current.aidUses),
    subsidyClaimDate: normalizeDateKey(current.subsidyClaimDate),
    loanDebt: normalizeCounter(current.loanDebt),
  };
}

type LobbyZoneStats = {
  handsPlayed: number;
  handsWon: number;
  handsTied: number;
};

function winRateFromCounts(handsPlayed: number, handsWon: number): number {
  if (handsPlayed <= 0) {
    return 0;
  }
  return Math.round((handsWon / handsPlayed) * 100);
}

function resolveLobbyZoneStats(zoneState: ZoneTrainingState): LobbyZoneStats {
  const handsPlayed = normalizeCounter(zoneState.handsPlayed);
  const handsWon = Math.min(handsPlayed, normalizeCounter(zoneState.handsWon));
  const handsTied = Math.min(Math.max(0, handsPlayed - handsWon), normalizeCounter(zoneState.handsTied));
  return {
    handsPlayed,
    handsWon,
    handsTied,
  };
}

function extractBankrollFromHand(hand: HandState, seats: Seat[], fallback: Record<string, number>): Record<string, number> {
  const next = normalizeBankrollForSeats(seats, fallback);
  seats.forEach((seat) => {
    if (seat.role === 'empty') return;
    const player = hand.players.find((p) => p.id === seat.id);
    if (player) {
      next[seat.id] = normalizeStackValue(player.stack);
    }
  });
  return next;
}

function buildHandBankrollForMode(
  mode: TrainingMode,
  seats: Seat[],
  bankroll: Record<string, number>,
): Record<string, number> {
  if (mode === 'career') {
    return normalizeBankrollForSeats(seats, bankroll);
  }
  const next: Record<string, number> = {};
  seats.forEach((seat) => {
    if (seat.role === 'empty') {
      return;
    }
    const current = bankroll[seat.id] ?? STARTING_STACK;
    next[seat.id] = Math.max(STARTING_STACK, normalizeStackValue(current));
  });
  return next;
}

function cloneProgressState(progress: ProgressState): ProgressState {
  return {
    ...progress,
    leaks: { ...progress.leaks },
  };
}

function normalizeProgressSnapshot(progress?: ProgressState): ProgressState {
  if (!progress) {
    return cloneProgressState(initialProgress);
  }
  return {
    xp: Number.isFinite(progress.xp) ? Math.max(0, Math.round(progress.xp)) : 0,
    zoneIndex: Number.isFinite(progress.zoneIndex) ? Math.max(0, Math.round(progress.zoneIndex)) : 0,
    handsPlayed: Number.isFinite(progress.handsPlayed) ? Math.max(0, Math.round(progress.handsPlayed)) : 0,
    handsWon: Number.isFinite(progress.handsWon) ? Math.max(0, Math.round(progress.handsWon)) : 0,
    leaks: {
      overFold: Number.isFinite(progress.leaks?.overFold) ? Math.max(0, Math.round(progress.leaks.overFold)) : 0,
      overCall: Number.isFinite(progress.leaks?.overCall) ? Math.max(0, Math.round(progress.leaks.overCall)) : 0,
      overBluff: Number.isFinite(progress.leaks?.overBluff) ? Math.max(0, Math.round(progress.leaks.overBluff)) : 0,
      missedValue: Number.isFinite(progress.leaks?.missedValue) ? Math.max(0, Math.round(progress.leaks.missedValue)) : 0,
      passiveCheck: Number.isFinite(progress.leaks?.passiveCheck) ? Math.max(0, Math.round(progress.leaks.passiveCheck)) : 0,
    },
  };
}

function normalizeZoneIndex(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 0;
  }
  const rounded = Math.round(value);
  return Math.max(0, Math.min(trainingZones.length - 1, rounded));
}

function restoreZoneTrainingById(snapshot?: Record<string, ZoneTrainingState>): Record<string, ZoneTrainingState> {
  return trainingZones.reduce<Record<string, ZoneTrainingState>>((acc, zone, idx) => {
    const defaultSeats = makeSeats(idx);
    acc[zone.id] = syncZoneTrainingState(zone, defaultSeats, snapshot?.[zone.id]);
    return acc;
  }, {});
}

function mergeZoneTrainingWithRecordedStats(
  zoneTrainingById: Record<string, ZoneTrainingState>,
  recordedStats: Array<{ zoneId: string; handsPlayed: number; handsWon: number; handsTied: number }>,
): Record<string, ZoneTrainingState> {
  const statsByZoneId = new Map(recordedStats.map((item) => [item.zoneId, item]));
  return trainingZones.reduce<Record<string, ZoneTrainingState>>((acc, zone, idx) => {
    const base = zoneTrainingById[zone.id] ?? syncZoneTrainingState(zone, makeSeats(idx));
    const stats = statsByZoneId.get(zone.id);
    if (!stats) {
      acc[zone.id] = base;
      return acc;
    }

    const handsPlayed = normalizeCounter(stats.handsPlayed);
    const handsWon = Math.min(handsPlayed, normalizeCounter(stats.handsWon));
    const handsTied = Math.min(Math.max(0, handsPlayed - handsWon), normalizeCounter(stats.handsTied));
    acc[zone.id] = {
      ...base,
      handsPlayed,
      handsWon,
      handsTied,
    };
    return acc;
  }, {});
}

function serializeSeatsForSnapshot(seats: Seat[]): PersistedSeat[] {
  return seats.map((seat) => ({
    id: seat.id,
    role: seat.role,
    aiId: seat.role === 'ai' ? seat.ai?.id : undefined,
  }));
}

function restoreSeatsFromSnapshot(snapshotSeats: PersistedSeat[] | undefined, zoneIndex: number): Seat[] {
  if (!snapshotSeats || snapshotSeats.length === 0) {
    return makeSeats(zoneIndex);
  }
  const snapshotBySeatId = new Map(snapshotSeats.map((seat) => [seat.id, seat]));
  const restored: Seat[] = seatLayout.map((anchor) => {
    if (anchor.id === HERO_SEAT) {
      return {
        id: anchor.id,
        pos: anchor.pos,
        role: 'hero',
      };
    }
    const savedSeat = snapshotBySeatId.get(anchor.id);
    if (savedSeat?.role === 'ai') {
      return {
        id: anchor.id,
        pos: anchor.pos,
        role: 'ai',
        ai: findAiById(savedSeat.aiId) ?? pickAi(zoneIndex),
      };
    }
    return {
      id: anchor.id,
      pos: anchor.pos,
      role: 'empty',
    };
  });

  if (!restored.some((seat) => seat.role === 'ai')) {
    const fallback =
      restored.find((seat) => seat.id === 'utg' && seat.role === 'empty')
      ?? restored.find((seat) => seat.id !== HERO_SEAT && seat.role === 'empty');
    if (fallback) {
      fallback.role = 'ai';
      fallback.ai = pickAi(zoneIndex);
    }
  }
  return restored;
}

function summarizeHandSignals(hand: HandState): HandMissionSignals {
  const heroId = hand.heroPlayerId;
  const heroWon = hand.winner === 'hero';
  const heroRaisedPreflop = hand.history.some(
    (log) => log.actorId === heroId && log.street === 'preflop' && log.action === 'raise' && !log.forcedBlind,
  );
  const hasPlayerPostflopAction = hand.history.some(
    (log) => log.actorId && (log.street === 'flop' || log.street === 'turn' || log.street === 'river'),
  );
  const bluffCatchWin = heroWon && hand.history.some((log) => log.actorId === heroId && log.street === 'river' && log.action === 'call');
  const heroRaiseFlop = hand.history.some((log) => log.actorId === heroId && log.street === 'flop' && log.action === 'raise');
  const heroRaiseTurn = hand.history.some((log) => log.actorId === heroId && log.street === 'turn' && log.action === 'raise');
  const heroRaiseRiver = hand.history.some((log) => log.actorId === heroId && log.street === 'river' && log.action === 'raise');
  return {
    heroWon,
    stealWin: heroWon && heroRaisedPreflop && !hasPlayerPostflopAction,
    bluffCatchWin,
    tripleBarrelWin: heroWon && heroRaiseFlop && heroRaiseTurn && heroRaiseRiver,
  };
}

function missionIncrement(kind: CoachMissionKind, signals: HandMissionSignals): number {
  if (kind === 'steal_preflop') return signals.stealWin ? 1 : 0;
  if (kind === 'bluff_catch') return signals.bluffCatchWin ? 1 : 0;
  if (kind === 'triple_barrel') return signals.tripleBarrelWin ? 1 : 0;
  if (kind === 'win_hands') return signals.heroWon ? 1 : 0;
  return 0;
}

function applyZoneMissionUpdates(zoneState: ZoneTrainingState, hand: HandState, bankrollAfter: Record<string, number>): MissionResolution {
  const heroStack = bankrollAfter[hand.heroPlayerId] ?? hand.heroStack;
  const bigBlind = Math.max(1, hand.bigBlind || BIG_BLIND_SIZE);
  const signals = summarizeHandSignals(hand);
  let rewardXp = 0;
  const completedMissionTitles: string[] = [];

  const missions = zoneState.missions.map((missionItem) => {
    let progress = missionItem.progress;
    if (missionItem.kind === 'profit_bb') {
      progress = Math.max(0, Math.floor((heroStack - zoneState.heroBaseline) / bigBlind));
    } else if (!missionItem.completed) {
      progress += missionIncrement(missionItem.kind, signals);
    }

    const completed = missionItem.completed || progress >= missionItem.target;
    let rewarded = missionItem.rewarded;
    if (completed && !rewarded) {
      rewarded = true;
      rewardXp += missionItem.rewardXp;
      completedMissionTitles.push(missionItem.title);
    }

    return {
      ...missionItem,
      progress: Math.min(Math.max(progress, missionItem.completed ? missionItem.target : 0), missionItem.target),
      completed,
      rewarded,
    };
  });

  return {
    nextState: {
      ...zoneState,
      bankroll: bankrollAfter,
      missions,
    },
    rewardXp,
    completedMissionTitles,
  };
}

function nextEventId(seed: number): string {
  return `ev-${seed}-${Date.now()}`;
}

function streetBoardCount(street: string): number {
  if (street === 'flop') return 3;
  if (street === 'turn') return 4;
  if (street === 'river') return 5;
  return 0;
}

function eventDelayMs(event: TableEvent): number {
  if (event.kind === 'deal') return 260;
  if (event.kind === 'blind') return 320;
  if (event.kind === 'action') return event.action === 'fold' ? 300 : 360;
  if (event.kind === 'street') return 360;
  if (event.kind === 'reveal') return 420;
  return 260;
}

function buildSeatVisualMap(seats: Seat[], language: AppLanguage = 'zh-TW'): Record<string, SeatVisual> {
  const result: Record<string, SeatVisual> = {};
  seats.forEach((seat) => {
    result[seat.id] = {
      cardsDealt: 0,
      inHand: seat.role !== 'empty',
      folded: seat.role === 'empty',
      lastAction: seat.role === 'empty'
        ? l(language, '點擊新增', '点击新增', 'Tap to add')
        : l(language, '等待中', '等待中', 'Waiting'),
    };
  });
  return result;
}

const initialSeatsForApp = makeSeats(0);
const initialZoneTrainingState = createZoneTrainingState(trainingZones[0], initialSeatsForApp);

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

function pickAi(zoneIndex: number): AiProfile {
  const pool = trainingZones[zoneIndex].aiPool;
  return pool[Math.floor(Math.random() * pool.length)] ?? pool[0];
}

function makeSeats(zoneIndex: number): Seat[] {
  const seats: Seat[] = seatLayout.map((s) => ({ id: s.id, pos: s.pos, role: s.id === HERO_SEAT ? 'hero' : 'empty' }));
  ['utg', 'bb'].forEach((id) => {
    const target = seats.find((s) => s.id === id);
    if (target && target.role === 'empty') {
      target.role = 'ai';
      target.ai = pickAi(zoneIndex);
    }
  });
  return seats;
}

function restoreSeatsFromRecordedHand(handState: HandState, fallbackZoneIndex: number): Seat[] {
  const seats: Seat[] = seatLayout.map((anchor) => ({
    id: anchor.id,
    pos: anchor.pos,
    role: 'empty',
  }));

  handState.players.forEach((player) => {
    const seatIdxById = seats.findIndex((seat) => seat.id === player.id);
    const seatIdx = seatIdxById !== -1 ? seatIdxById : seats.findIndex((seat) => seat.pos === player.position);
    if (seatIdx === -1) {
      return;
    }
    if (player.role === 'hero') {
      seats[seatIdx] = {
        id: seats[seatIdx].id,
        pos: seats[seatIdx].pos,
        role: 'hero',
      };
      return;
    }
    seats[seatIdx] = {
      id: seats[seatIdx].id,
      pos: seats[seatIdx].pos,
      role: 'ai',
      ai: player.ai ?? pickAi(fallbackZoneIndex),
    };
  });

  if (!seats.some((seat) => seat.role === 'hero')) {
    const heroSeatIdx = seats.findIndex((seat) => seat.id === HERO_SEAT);
    if (heroSeatIdx !== -1) {
      seats[heroSeatIdx] = {
        id: seats[heroSeatIdx].id,
        pos: seats[heroSeatIdx].pos,
        role: 'hero',
      };
    }
  }

  return seats;
}

function seatName(seat: Seat, language: AppLanguage = 'zh-TW'): string {
  if (seat.role === 'hero') return 'Hero';
  if (seat.role === 'ai') return seat.ai?.name ?? 'AI';
  return l(language, '空位', '空位', 'Empty');
}

function unlockedZoneByXp(xp: number): number {
  let idx = 0;
  for (let i = 0; i < trainingZones.length; i += 1) if (xp >= trainingZones[i].unlockXp) idx = i;
  return idx;
}

function zoneMissionsCompleted(zoneState?: ZoneTrainingState): boolean {
  if (!zoneState || zoneState.missions.length === 0) {
    return false;
  }
  return zoneState.missions.every((missionItem) => missionItem.completed);
}

function unlockedZoneByCompletedMissions(zoneTrainingById: Record<string, ZoneTrainingState>): number {
  let idx = 0;
  for (let i = 0; i < trainingZones.length - 1; i += 1) {
    const zoneState = zoneTrainingById[trainingZones[i].id];
    if (!zoneMissionsCompleted(zoneState)) {
      break;
    }
    idx = i + 1;
  }
  return idx;
}

function unlockedZone(progress: ProgressState, zoneTrainingById: Record<string, ZoneTrainingState>): number {
  return Math.max(progress.zoneIndex, unlockedZoneByXp(progress.xp), unlockedZoneByCompletedMissions(zoneTrainingById));
}

function zoneUnlockHint(zoneIdx: number, progress: ProgressState, language: AppLanguage = 'zh-TW'): string {
  const zoneDef = trainingZones[zoneIdx] ?? trainingZones[0];
  const needXp = Math.max(0, zoneDef.unlockXp - progress.xp);
  if (zoneIdx <= 0) {
    return t(language, 'zone_unlocked');
  }
  const prevZone = trainingZones[zoneIdx - 1] ?? trainingZones[0];
  return t(language, 'zone_unlock_hint', { zone: zoneName(prevZone, language), xp: needXp });
}

function addXp(p: ProgressState, delta: number): ProgressState {
  const xp = p.xp + delta;
  return { ...p, xp, zoneIndex: Math.max(p.zoneIndex, unlockedZoneByXp(xp)) };
}

function actionLabel(a: ActionType, language: AppLanguage = 'zh-TW'): string {
  if (a === 'fold') return l(language, '棄牌', '弃牌', 'Fold');
  if (a === 'check') return l(language, '過牌', '过牌', 'Check');
  if (a === 'call') return l(language, '跟注', '跟注', 'Call');
  return l(language, '加注', '加注', 'Raise');
}

function actionDisplayText(
  action: ActionType | undefined,
  amount: number | undefined,
  allIn: boolean | undefined,
  language: AppLanguage = 'zh-TW',
): string {
  if (allIn) {
    return `All-in${(amount ?? 0) > 0 ? ` ${amount}` : ''}`;
  }
  const label = action ? actionLabel(action, language) : l(language, '行動', '行动', 'Action');
  if ((amount ?? 0) > 0 && action !== 'fold' && action !== 'check') {
    return `${label} ${amount}`;
  }
  return label;
}

function actionSfxKey(action: ActionType | undefined, amount: number | undefined, allIn: boolean | undefined, text?: string): SfxKey {
  if (text && (/盲/.test(text) || /\bblind\b/i.test(text))) return 'blind';
  if (allIn) return 'allIn';
  if (action === 'raise') return 'raise';
  if (action === 'call') return 'call';
  if (action === 'check') return 'check';
  if (action === 'fold') return 'fold';
  return (amount ?? 0) > 0 ? 'call' : 'check';
}

function createHeroTurnSpotKey(hand: HandState): string {
  const board = hand.board.slice(0, hand.revealedBoardCount).map((card) => card.code).join(',');
  const hero = hand.heroCards.map((card) => card.code).join(',');
  const historyTail = hand.history
    .slice(-18)
    .map((log) => `${log.street}:${log.actorId ?? log.actor}:${log.action}:${log.amount}:${log.allIn ? 'A' : 'N'}`)
    .join('|');
  return [
    hand.street,
    hand.actingPlayerId ?? '-',
    hand.pot,
    hand.toCall,
    hand.minRaise,
    hand.heroStack,
    hand.villainStack,
    hero,
    board,
    hand.history.length,
    historyTail,
  ].join('#');
}

function mission(leak: HeroLeak, language: AppLanguage = 'zh-TW'): string {
  if (leak === 'overFold') return l(language, '任務：多做符合賠率的防守跟注', '任务：多做符合赔率的防守跟注', 'Mission: defend more when pot odds are right');
  if (leak === 'overCall') return l(language, '任務：高壓下注前先算 pot odds', '任务：高压下注前先算 pot odds', 'Mission: calculate pot odds before calling pressure');
  if (leak === 'overBluff') return l(language, '任務：減少無效唬牌', '任务：减少无效唬牌', 'Mission: reduce low-EV bluffs');
  if (leak === 'missedValue') return l(language, '任務：中強牌多拿價值', '任务：中强牌多拿价值', 'Mission: extract more value with medium-strong hands');
  return l(language, '任務：找 3 個可主動施壓節點', '任务：找 3 个可主动施压节点', 'Mission: identify 3 proactive pressure spots');
}

function shortName(name: string): string {
  return name.length <= 6 ? name : `${name.slice(0, 6)}…`;
}

function CardView({ card, hidden, compact }: { card?: Card; hidden?: boolean; compact?: boolean }) {
  const cardStyle = compact ? styles.tableCardCompact : styles.tableCard;
  if (!card || hidden) {
    return (
      <LinearGradient colors={['#1b2d4f', '#0f1a2f']} style={[cardStyle, styles.cardBack]}>
        <View style={styles.cardBackStripe} />
        <Text style={styles.cardBackText}>?</Text>
      </LinearGradient>
    );
  }
  const red = card.suit === 'h' || card.suit === 'd';
  return (
    <LinearGradient colors={['#fdfefe', '#d8dde5']} style={cardStyle}>
      <Text style={[styles.cardFaceText, red && styles.cardFaceRed]}>{cardToDisplay(card)}</Text>
    </LinearGradient>
  );
}

function Advice({ title, advice, language }: { title: string; advice: ActionAdvice; language: AppLanguage }) {
  const summaryText = rt(advice.summary, language, 'Model-generated summary for this spot.');
  const rationaleLines = advice.rationale.map((line) => rt(line, language, 'Model-generated rationale.'));
  return (
    <View style={styles.adviceBox}>
      <Text style={styles.adviceTitle}>{title}</Text>
      <Text style={styles.adviceMain}>
        {actionLabel(advice.action, language)}
        {advice.amount ? ` ${advice.amount}` : ''} · {l(language, '信心', '信心', 'Confidence')} {Math.round(advice.confidence * 100)}%
      </Text>
      <Text style={styles.textMuted}>{summaryText}</Text>
      {rationaleLines.map((line, idx) => (
        <Text key={`${title}-${idx}-${line}`} style={styles.textTiny}>
          - {line}
        </Text>
      ))}
    </View>
  );
}

function PercentMeter({ label, value, accent }: { label: string; value: number; accent: string }) {
  const pct = clamp(value, 0, 100);
  return (
    <View style={styles.meterRow}>
      <View style={styles.meterHead}>
        <Text style={styles.textTiny}>{label}</Text>
        <Text style={styles.textTiny}>{pct.toFixed(1)}%</Text>
      </View>
      <View style={styles.meterTrack}>
        <View style={[styles.meterFill, { width: `${pct}%`, backgroundColor: accent }]} />
      </View>
    </View>
  );
}

function sampleTier(opportunities: number): 'low' | 'mid' | 'high' {
  if (opportunities >= 80) return 'high';
  if (opportunities >= 20) return 'mid';
  return 'low';
}

function sampleTierLabel(opportunities: number, language: AppLanguage = 'zh-TW'): string {
  const tier = sampleTier(opportunities);
  if (tier === 'high') return l(language, '高樣本', '高样本', 'High Sample');
  if (tier === 'mid') return l(language, '中樣本', '中样本', 'Medium Sample');
  return l(language, '低樣本', '低样本', 'Low Sample');
}

function coachBenchmarkRangeLabel(range: CoachBenchmarkRange): string {
  return `${range.min}-${range.max}%`;
}

function coachBenchmarkVerdict(
  stat: RatioStat,
  range: CoachBenchmarkRange,
  language: AppLanguage = 'zh-TW',
): { text: string; tone: CoachBenchmarkVerdictTone } {
  if (stat.opportunities <= 0) {
    return { text: l(language, '待收樣本', '待收样本', 'Collecting sample'), tone: 'pending' };
  }

  const rate = statRatePercent(stat);
  if (rate > range.max) {
    return { text: l(language, `偏高 +${(rate - range.max).toFixed(1)}%`, `偏高 +${(rate - range.max).toFixed(1)}%`, `High +${(rate - range.max).toFixed(1)}%`), tone: 'high' };
  }
  if (rate < range.min) {
    return { text: l(language, `偏低 -${(range.min - rate).toFixed(1)}%`, `偏低 -${(range.min - rate).toFixed(1)}%`, `Low -${(range.min - rate).toFixed(1)}%`), tone: 'low' };
  }
  return { text: l(language, '標準內', '标准内', 'Within Range'), tone: 'inRange' };
}

function coachStatsSummary(stats: HeroStatsSnapshot, language: AppLanguage = 'zh-TW'): string {
  if (stats.hands < 12) {
    return l(language, '樣本仍少，先累積 12-20 手再判讀頻率偏差。', '样本仍少，先累计 12-20 手再判断频率偏差。', 'Sample is still small. Build 12-20 hands before judging frequency bias.');
  }

  const vpip = statRatePercent(stats.vpip);
  const pfr = statRatePercent(stats.pfr);
  const vpipGap = vpip - pfr;
  if (stats.vpip.opportunities >= 20 && vpipGap > 12) {
    return l(language, 'VPIP-PFR 差距偏大，可能冷跟注過多，建議縮減被動入池。', 'VPIP-PFR 差距偏大，可能冷跟注过多，建议缩减被动入池。', 'VPIP-PFR gap is wide. You may be over cold-calling; tighten passive entries.');
  }

  const flopCbet = statRatePercent(stats.flopCBet);
  if (stats.flopCBet.opportunities >= 15 && flopCbet > 72) {
    return l(language, 'Flop c-bet 偏高，建議加入更多 check back 來保護中段範圍。', 'Flop c-bet 偏高，建议加入更多 check back 来保护中段范围。', 'Flop c-bet is high. Add more check-backs to protect your middle range.');
  }

  const foldVsCbet = statRatePercent(stats.foldVsFlopCBet);
  if (stats.foldVsFlopCBet.opportunities >= 12 && foldVsCbet > 58) {
    return l(language, '面對 flop c-bet 的棄牌偏高，建議擴充最低防守頻率。', '面对 flop c-bet 的弃牌偏高，建议扩充最低防守频率。', 'Fold vs flop c-bet is high. Expand your minimum defense frequency.');
  }

  const foldTo3bet = statRatePercent(stats.foldToThreeBet);
  if (stats.foldToThreeBet.opportunities >= 10 && foldTo3bet > 65) {
    return l(language, '面對 preflop 3bet 棄牌偏高，對手可高頻 exploit 你。', '面对 preflop 3bet 弃牌偏高，对手可高频 exploit 你。', 'Fold to preflop 3-bet is high. Opponents can exploit this frequently.');
  }

  return l(language, '目前頻率沒有明顯失衡，持續觀察樣本與對手類型變化。', '目前频率没有明显失衡，持续观察样本与对手类型变化。', 'No obvious frequency imbalance. Keep monitoring sample and opponent types.');
}

function CoachStatTile(
  { label, statKey, stat, language }: { label: string; statKey: CoachStatKey; stat: RatioStat; language: AppLanguage },
) {
  const rate = statRatePercent(stat);
  const tier = sampleTier(stat.opportunities);
  const benchmark = COACH_STAT_BENCHMARKS[statKey];
  const verdict = coachBenchmarkVerdict(stat, benchmark, language);

  return (
    <View style={styles.coachStatTile}>
      <View style={styles.coachStatHead}>
        <Text style={styles.textTiny}>{label}</Text>
        <Text style={styles.coachStatRate}>{rate.toFixed(1)}%</Text>
      </View>
      <View style={styles.coachStatMeta}>
        <Text style={styles.coachStatCount}>{stat.hits}/{stat.opportunities}</Text>
        <Text style={styles.coachStatRange}>{l(language, '標準', '标准', 'Target')} {coachBenchmarkRangeLabel(benchmark)}</Text>
      </View>
      <View style={styles.coachStatMeta}>
        <Text
          style={[
            styles.coachStatBenchmark,
            verdict.tone === 'inRange'
              ? styles.coachStatBenchmarkInRange
              : verdict.tone === 'high'
                ? styles.coachStatBenchmarkHigh
                : verdict.tone === 'low'
                  ? styles.coachStatBenchmarkLow
                  : styles.coachStatBenchmarkPending,
          ]}
        >
          {verdict.text}
        </Text>
        <Text
          style={[
            styles.coachStatTier,
            tier === 'high' ? styles.coachStatTierHigh : tier === 'mid' ? styles.coachStatTierMid : styles.coachStatTierLow,
          ]}
        >
          {sampleTierLabel(stat.opportunities, language)}
        </Text>
      </View>
    </View>
  );
}

export default function App() {
  const { width, height } = useWindowDimensions();
  const navSafeInsetLeft = Platform.OS === 'ios' && width > height ? NAV_IOS_LANDSCAPE_SAFE_LEFT : 0;
  const navCollapsedOffset = NAV_COLLAPSED_WIDTH + navSafeInsetLeft;
  const navExpandedOffset = NAV_DRAWER_WIDTH + navSafeInsetLeft;
  const webEntryConfig = useMemo(() => readWebEntryConfig(), []);
  const hasAppliedWebEntryRef = useRef(false);
  const [tableViewportWidth, setTableViewportWidth] = useState(width);
  const [rootTab, setRootTab] = useState<RootTab>('play');
  const [navDrawerOpen, setNavDrawerOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>('lobby');
  const [lobbyZone, setLobbyZone] = useState(0);
  const [zoneIndex, setZoneIndex] = useState(0);

  const [progress, setProgress] = useState<ProgressState>({ ...initialProgress, leaks: { ...initialProgress.leaks } });
  const [zoneTrainingById, setZoneTrainingById] = useState<Record<string, ZoneTrainingState>>(() => ({
    [trainingZones[0].id]: initialZoneTrainingState,
  }));
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [opsOpen, setOpsOpen] = useState(false);
  const [missionOpen, setMissionOpen] = useState(false);
  const [lobbySettingsOpen, setLobbySettingsOpen] = useState(false);
  const [trainingMode, setTrainingMode] = useState<TrainingMode>('career');
  const [appLanguage, setAppLanguage] = useState<AppLanguage>('zh-TW');
  const [politeMode, setPoliteMode] = useState(false);
  const [aiVoiceAssistEnabled, setAiVoiceAssistEnabled] = useState(true);
  const [aiVoiceBusy, setAiVoiceBusy] = useState(false);
  const [aiVoiceLastAdvice, setAiVoiceLastAdvice] = useState('');
  const [autoPlayEvents, setAutoPlayEvents] = useState(true);
  const [sfxEnabled, setSfxEnabled] = useState(true);
  const [sfxReady, setSfxReady] = useState(false);
  const [sfxLoadError, setSfxLoadError] = useState(false);
  const [note, setNote] = useState(l('zh-TW', '先選牌桌水平，進桌後可直接點座位新增/移除 AI。', '先选牌桌水平，进桌后可直接点座位新增/移除 AI。', 'Pick a room first, then tap seats to add/remove AIs.'));
  const [bankruptcyPromptOpen, setBankruptcyPromptOpen] = useState(false);
  const [bankruptcyPromptText, setBankruptcyPromptText] = useState('');
  const [bankruptcyCountdown, setBankruptcyCountdown] = useState(0);
  const [activeProfile, setActiveProfile] = useState<LocalProfile | null>(null);
  const [localDbReady, setLocalDbReady] = useState(false);
  const [handRecordCount, setHandRecordCount] = useState(0);
  const [reviewRecords, setReviewRecords] = useState<HandRecordSummary[]>([]);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewSelectedId, setReviewSelectedId] = useState<number | null>(null);
  const [reviewSelectedDetail, setReviewSelectedDetail] = useState<HandRecordDetail | null>(null);

  const [seats, setSeats] = useState<Seat[]>(() => initialSeatsForApp);
  const [buttonSeatId, setButtonSeatId] = useState(HERO_SEAT);
  const [selectedSeatId, setSelectedSeatId] = useState('utg');
  const [battleSeatId, setBattleSeatId] = useState<string | null>('utg');
  const [pendingReplacementSeatIds, setPendingReplacementSeatIds] = useState<string[]>([]);
  const [leakGuess, setLeakGuess] = useState<OppLeakGuess | null>(null);
  const [seatVisual, setSeatVisual] = useState<Record<string, SeatVisual>>(() => buildSeatVisualMap(initialSeatsForApp));
  const [eventQueue, setEventQueue] = useState<TableEvent[]>([]);
  const [tableFeed, setTableFeed] = useState<string[]>([]);
  const [actionFeed, setActionFeed] = useState<string[]>([]);
  const [displayedBoardCount, setDisplayedBoardCount] = useState(0);
  const [eventSeed, setEventSeed] = useState(1);
  const [activeSeatAnimId, setActiveSeatAnimId] = useState<string | null>(null);
  const seatPulse = useRef(new Animated.Value(0)).current;
  const chipPulse = useRef(new Animated.Value(0)).current;
  const drawerTranslateX = useRef(new Animated.Value(Math.max(900, width + 60))).current;
  const drawerBackdropOpacity = useRef(new Animated.Value(0)).current;
  const opsTranslateX = useRef(new Animated.Value(Math.max(760, width + 40))).current;
  const opsBackdropOpacity = useRef(new Animated.Value(0)).current;
  const missionTranslateX = useRef(new Animated.Value(760)).current;
  const missionBackdropOpacity = useRef(new Animated.Value(0)).current;
  const autoPlayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bankruptcyReturnTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bankruptcyCountdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const snapshotSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const soundsRef = useRef<Record<SfxKey, Audio.Sound[]>>(createEmptySfxMap());
  const aiCoachAbortRef = useRef<AbortController | null>(null);
  const aiCoachSpotRef = useRef('');
  const aiCoachVoiceSoundRef = useRef<Audio.Sound | null>(null);
  const aiCoachAudioTempUrisRef = useRef<string[]>([]);

  const [hand, setHand] = useState(() => {
    const firstAi = initialSeatsForApp.find((s) => s.role === 'ai')?.ai ?? trainingZones[0].aiPool[0];
    return createNewHand(trainingZones[0], firstAi, {
      tablePlayers: initialSeatsForApp
        .filter((s) => s.role !== 'empty')
        .map((s) => ({
          id: s.id,
          position: s.pos,
          role: s.role === 'hero' ? 'hero' as const : 'ai' as const,
          ai: s.ai,
          name: s.role === 'hero' ? 'Hero' : s.ai?.name ?? 'AI',
        })),
      focusVillainId: initialSeatsForApp.find((s) => s.role === 'ai')?.id,
      buttonPosition: 'BTN',
      stackByPlayerId: initialZoneTrainingState.bankroll,
    });
  });
  const [raiseAmount, setRaiseAmount] = useState(10);
  const [raiseSliderWidth, setRaiseSliderWidth] = useState(0);

  const zone = trainingZones[zoneIndex] ?? trainingZones[0];
  const unlockedIdx = unlockedZone(progress, zoneTrainingById);
  const zoneDisplayName = zoneName(zone, appLanguage);
  const unlockedZoneName = zoneName(trainingZones[unlockedIdx] ?? trainingZones[0], appLanguage);
  const selectedSeat = seats.find((s) => s.id === selectedSeatId) ?? seats[0];
  const selectedSeatDisplayPos = positionRelativeToButton(selectedSeat.pos, hand.buttonPosition);
  const battleSeat = seats.find((s) => s.id === battleSeatId) ?? null;
  const analysis = useMemo(() => hand.lastAnalysis ?? analyzeCurrentSpot(hand), [hand]);
  const spotInsight = useMemo(() => (analysisOpen ? buildSpotInsight(hand) : EMPTY_SPOT_INSIGHT), [analysisOpen, hand]);
  const analysisDrawerWidth = useMemo(() => {
    const availableWidth = Math.max(320, tableViewportWidth);
    const ratio = availableWidth >= 1380 ? 0.76 : availableWidth >= 1120 ? 0.82 : availableWidth >= 860 ? 0.88 : 0.96;
    const minWidth = Math.min(360, availableWidth);
    return Math.round(clamp(availableWidth * ratio, minWidth, availableWidth));
  }, [tableViewportWidth]);
  const analysisDrawerHiddenX = analysisDrawerWidth + 40;
  const opsPanelHiddenX = Math.max(760, width + 40);
  const topLeak = getTopLeak(progress);
  const zoneTrainingState = syncZoneTrainingState(zone, seats, zoneTrainingById[zone.id]);
  const zoneHeroStats = zoneTrainingState.heroStats;
  const zoneStatsCoachNote = coachStatsSummary(zoneHeroStats, appLanguage);
  const zoneVpipPfrGap = Number((statRatePercent(zoneHeroStats.vpip) - statRatePercent(zoneHeroStats.pfr)).toFixed(1));
  const todayKey = localDateKey();
  const canClaimSubsidyToday = zoneTrainingState.subsidyClaimDate !== todayKey;
  const zoneCareerXpFactor = careerXpMultiplier(zoneTrainingState.aidUses);
  const activeXpFactor = resolveXpMultiplier(trainingMode, zoneTrainingState);
  const zoneLoanDebt = zoneTrainingState.loanDebt;
  const zoneBankroll = zoneTrainingState.bankroll;
  const zoneHeroStack = zoneBankroll[HERO_SEAT] ?? STARTING_STACK;
  const heroPlayer = hand.players.find((player) => player.id === hand.heroPlayerId);
  const currentHeroStack = heroPlayer?.stack ?? hand.heroStack;
  const headerHeroStack = trainingMode === 'practice' ? currentHeroStack : zoneHeroStack;
  const headerHeroBb = Math.floor(headerHeroStack / Math.max(1, hand.bigBlind || BIG_BLIND_SIZE));
  const zoneHeroBb = Math.floor(zoneHeroStack / Math.max(1, hand.bigBlind || BIG_BLIND_SIZE));
  const zoneLoanDebtBb = chipsToBb(zoneLoanDebt, Math.max(1, hand.bigBlind || BIG_BLIND_SIZE));
  const zoneProfitBb = Math.floor((zoneHeroStack - zoneTrainingState.heroBaseline) / Math.max(1, hand.bigBlind || BIG_BLIND_SIZE));
  const completedMissionCount = zoneTrainingState.missions.filter((missionItem) => missionItem.completed).length;
  const lobbyZoneDef = trainingZones[lobbyZone] ?? trainingZones[0];
  const lobbyZoneState = syncZoneTrainingState(lobbyZoneDef, seats, zoneTrainingById[lobbyZoneDef.id]);
  const lobbyZoneStack = lobbyZoneState.bankroll[HERO_SEAT] ?? STARTING_STACK;
  const lobbyZoneBb = Math.floor(lobbyZoneStack / BIG_BLIND_SIZE);
  const lobbyZoneProfitBb = Math.floor((lobbyZoneStack - lobbyZoneState.heroBaseline) / BIG_BLIND_SIZE);
  const lobbyZoneMissionDone = lobbyZoneState.missions.filter((missionItem) => missionItem.completed).length;
  const lobbyZoneLocked = lobbyZone > unlockedIdx;
  const lobbyUnlockHint = zoneUnlockHint(lobbyZone, progress, appLanguage);
  const lobbyAvgSkill = Math.round(
    lobbyZoneDef.aiPool.reduce((sum, ai) => sum + ai.skill, 0) / Math.max(1, lobbyZoneDef.aiPool.length),
  );
  const lobbyZoneName = zoneName(lobbyZoneDef, appLanguage);
  const lobbyZoneSub = zoneSubtitle(lobbyZoneDef, appLanguage);
  const lobbyZoneFocus = zoneFocus(lobbyZoneDef, appLanguage);
  const lobbyArchetypes = Array.from(new Set(lobbyZoneDef.aiPool.map((ai) => ai.archetype))).join(' / ');
  const lobbyZoneStats = resolveLobbyZoneStats(lobbyZoneState);
  const lobbyZoneLosses = Math.max(0, lobbyZoneStats.handsPlayed - lobbyZoneStats.handsWon - lobbyZoneStats.handsTied);
  const lobbyZoneRecord = lobbyZoneStats.handsTied > 0
    ? `${lobbyZoneStats.handsWon}W-${lobbyZoneLosses}L-${lobbyZoneStats.handsTied}T`
    : `${lobbyZoneStats.handsWon}W-${lobbyZoneLosses}L`;
  const lobbyZoneWinRate = winRateFromCounts(lobbyZoneStats.handsPlayed, lobbyZoneStats.handsWon);
  const compactLobby = webEntryConfig.embed || width < 1080 || height < 620;
  const appLanguageLabel = appLanguageLabels[appLanguage];
  const heroEquityEdge = Number((spotInsight.equity.heroWin + spotInsight.equity.tie * 0.5 - spotInsight.potOddsNeed).toFixed(1));
  const rootTabItems = useMemo<RootTabItem[]>(() => ([
    { key: 'play', icon: '♠', label: l(appLanguage, '實戰', '实战', 'Play') },
    { key: 'learn', icon: '📗', label: l(appLanguage, '學習', '学习', 'Learn') },
    { key: 'review', icon: '📑', label: l(appLanguage, '復盤', '复盘', 'Review') },
    { key: 'profile', icon: '👤', label: l(appLanguage, '我的', '我的', 'My') },
  ]), [appLanguage]);

  const visibleBoard = hand.board.slice(0, displayedBoardCount);
  const holes = Math.max(0, 5 - visibleBoard.length);
  const callOrCheck: ActionType = hand.toCall > 0 ? 'call' : 'check';
  const minRaise = hand.toCall + hand.minRaise;
  const raiseCap = Math.max(minRaise, hand.heroStack);
  const heroAllIn = !!heroPlayer?.allIn || currentHeroStack <= 0;
  const canRaise = !heroAllIn && hand.heroStack >= minRaise;
  const raiseRange = Math.max(0, raiseCap - minRaise);
  const raiseSliderRatio = !canRaise ? 0 : raiseRange <= 0 ? 1 : clamp((raiseAmount - minRaise) / raiseRange, 0, 1);
  const raiseSliderPercent: DimensionValue = `${Math.round(raiseSliderRatio * 100)}%`;
  const isAllInRaise = canRaise && raiseAmount >= raiseCap;
  const hasPendingEvent = eventQueue.length > 0;
  const recentActionLines = actionFeed;
  const isHeroTurn =
    phase === 'table'
    && !hand.isOver
    && !hasPendingEvent
    && hand.actingPlayerId === hand.heroPlayerId;
  const canHeroActNow = isHeroTurn && !heroAllIn;
  const heroTurnSpotKey = useMemo(() => createHeroTurnSpotKey(hand), [hand]);

  const cleanupAiCoachAudioTemps = useCallback(() => {
    const uris = aiCoachAudioTempUrisRef.current.splice(0);
    uris.forEach((uri) => {
      try {
        const file = new FileSystem.File(uri);
        if (file.exists) {
          file.delete();
        }
      } catch {
        // Ignore temp cleanup failures.
      }
    });
  }, []);

  const stopAiCoachAudioPlayback = useCallback(() => {
    const currentSound = aiCoachVoiceSoundRef.current;
    aiCoachVoiceSoundRef.current = null;
    if (currentSound) {
      void currentSound.stopAsync().catch(() => undefined);
      void currentSound.unloadAsync().catch(() => undefined);
    }
    void Speech.stop().catch(() => undefined);
  }, []);

  const playAiCoachAudio = useCallback(
    async (result: { audioUrl?: string; audioBase64?: string; audioFormat?: string; audioMimeType?: string }) => {
      let uri = (result.audioUrl || '').trim();
      if (!uri) {
        const rawBase64 = (result.audioBase64 || '').trim();
        if (!rawBase64) return false;
        const normalizedBase64 = rawBase64.startsWith('data:')
          ? rawBase64.slice(rawBase64.indexOf(',') + 1)
          : rawBase64;

        const extRaw = (result.audioFormat || result.audioMimeType?.split('/')[1] || 'mp3').toLowerCase();
        const ext = extRaw.replace(/[^a-z0-9]/g, '') || 'mp3';
        const tempFile = new FileSystem.File(
          FileSystem.Paths.cache,
          `coach-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`,
        );
        if (!tempFile.exists) {
          tempFile.create({ intermediates: true, overwrite: true });
        }
        tempFile.write(normalizedBase64, { encoding: 'base64' });
        uri = tempFile.uri;
        aiCoachAudioTempUrisRef.current.push(uri);
      }

      stopAiCoachAudioPlayback();
      const { sound } = await Audio.Sound.createAsync(
        { uri },
        {
          shouldPlay: true,
          volume: 1,
        },
      );
      aiCoachVoiceSoundRef.current = sound;
      sound.setOnPlaybackStatusUpdate((status) => {
        if (!status.isLoaded) {
          return;
        }
        if (status.didJustFinish) {
          if (aiCoachVoiceSoundRef.current === sound) {
            aiCoachVoiceSoundRef.current = null;
          }
          void sound.unloadAsync().catch(() => undefined);
        }
      });
      return true;
    },
    [stopAiCoachAudioPlayback],
  );

  const clearBankruptcyTimers = useCallback(() => {
    if (bankruptcyReturnTimerRef.current) {
      clearTimeout(bankruptcyReturnTimerRef.current);
      bankruptcyReturnTimerRef.current = null;
    }
    if (bankruptcyCountdownTimerRef.current) {
      clearInterval(bankruptcyCountdownTimerRef.current);
      bankruptcyCountdownTimerRef.current = null;
    }
  }, []);

  const closeBankruptcyOverlay = useCallback(() => {
    clearBankruptcyTimers();
    setBankruptcyPromptOpen(false);
    setBankruptcyCountdown(0);
  }, [clearBankruptcyTimers]);

  const returnToLobbyAfterBankruptcy = useCallback(() => {
    closeBankruptcyOverlay();
    setPhase('lobby');
    setNote(l(appLanguage, '你的當前籌碼已歸零，已返回遊戲大廳。', '你的当前筹码已归零，已返回游戏大厅。', 'Your current stack hit zero. Returned to the lobby.'));
  }, [appLanguage, closeBankruptcyOverlay]);

  const closeTransientPanels = useCallback(() => {
    setAnalysisOpen(false);
    setOpsOpen(false);
    setMissionOpen(false);
    setLobbySettingsOpen(false);
  }, []);

  const handleRootTabChange = useCallback((next: RootTab) => {
    setRootTab(next);
    setNavDrawerOpen(false);
    if (next !== 'play') {
      closeTransientPanels();
    }
  }, [closeTransientPanels]);

  const handleResumePlay = useCallback(() => {
    setRootTab('play');
    setNavDrawerOpen(false);
  }, []);

  const loadReviewRecords = useCallback(
    async (preferredRecordId?: number | null) => {
      if (!localDbReady || !activeProfile) {
        setReviewRecords([]);
        setReviewSelectedId(null);
        setReviewSelectedDetail(null);
        return;
      }
      setReviewLoading(true);
      try {
        const rows = await listHandRecordSummaries(activeProfile.id, 80, 0);
        setReviewRecords(rows);
        const target = preferredRecordId ?? reviewSelectedId;
        const hasTarget = target !== null && rows.some((row) => row.id === target);
        const nextId = hasTarget ? target : (rows[0]?.id ?? null);
        setReviewSelectedId(nextId);
        if (nextId === null) {
          setReviewSelectedDetail(null);
        } else {
          const detail = await getHandRecordDetail(activeProfile.id, nextId);
          setReviewSelectedDetail(detail);
        }
      } catch (err) {
        console.warn('Load review records failed', err);
      } finally {
        setReviewLoading(false);
      }
    },
    [activeProfile, localDbReady, reviewSelectedId],
  );

  const handleReviewSelect = useCallback(
    async (recordId: number) => {
      setReviewSelectedId(recordId);
      if (!localDbReady || !activeProfile) {
        setReviewSelectedDetail(null);
        return;
      }
      setReviewLoading(true);
      try {
        const detail = await getHandRecordDetail(activeProfile.id, recordId);
        setReviewSelectedDetail(detail);
      } catch (err) {
        console.warn('Load review detail failed', err);
      } finally {
        setReviewLoading(false);
      }
    },
    [activeProfile, localDbReady],
  );

  const handleReplayFromReview = useCallback(
    async (recordId: number) => {
      if (!localDbReady || !activeProfile) {
        setRootTab('play');
        return;
      }

      setReviewLoading(true);
      try {
        const detail = reviewSelectedDetail?.id === recordId
          ? reviewSelectedDetail
          : await getHandRecordDetail(activeProfile.id, recordId);

        if (!detail) {
          setNote(l(appLanguage, '找不到這手牌的復盤資料。', '找不到这手牌的复盘资料。', 'Replay data for this hand was not found.'));
          return;
        }

        const targetZoneIdx = trainingZones.findIndex((zoneItem) => zoneItem.id === detail.zoneId);
        const nextZoneIdx = targetZoneIdx >= 0 ? targetZoneIdx : zoneIndex;
        const replaySeats = restoreSeatsFromRecordedHand(detail.hand, nextZoneIdx);
        const replayBattleSeatId = replaySeats.some((seat) => seat.id === detail.focusVillainId && seat.role === 'ai')
          ? detail.focusVillainId
          : (replaySeats.find((seat) => seat.role === 'ai')?.id ?? null);
        const replayButtonSeatId = replaySeats.find((seat) => seat.pos === detail.hand.buttonPosition && seat.role !== 'empty')?.id
          ?? HERO_SEAT;

        closeTransientPanels();
        setRootTab('play');
        setPhase('table');
        setZoneIndex(nextZoneIdx);
        setLobbyZone(nextZoneIdx);
        setReviewSelectedId(detail.id);
        setReviewSelectedDetail(detail);
        setSeats(replaySeats);
        setButtonSeatId(replayButtonSeatId);
        setSelectedSeatId(replayBattleSeatId ?? HERO_SEAT);
        setBattleSeatId(replayBattleSeatId);
        setPendingReplacementSeatIds([]);
        setLeakGuess(null);
        setDisplayedBoardCount(0);
        setTableFeed([]);
        setActionFeed([]);
        setSeatVisual(buildSeatVisualMap(replaySeats, appLanguage));
        setEventQueue([]);
        setAutoPlayEvents(true);
        setHand(detail.hand);
        setRaiseAmount(detail.hand.toCall + detail.hand.minRaise);
        enqueueTableEvents(buildHandOpeningEvents(replaySeats, detail.hand));
        setNote(
          l(
            appLanguage,
            `已載入復盤 #${detail.id}，正在按原始行動線回放。`,
            `已载入复盘 #${detail.id}，正在按原始行动线回放。`,
            `Loaded replay #${detail.id}. Replaying the original action line now.`,
          ),
        );
      } catch (err) {
        console.warn('Replay from review failed', err);
        setNote(l(appLanguage, '復盤回放失敗，請重試。', '复盘回放失败，请重试。', 'Replay failed. Please try again.'));
      } finally {
        setReviewLoading(false);
      }
    },
    [
      activeProfile,
      appLanguage,
      closeTransientPanels,
      localDbReady,
      reviewSelectedDetail,
      zoneIndex,
    ],
  );

  useEffect(() => setRaiseAmount((v) => clamp(v, minRaise, raiseCap)), [minRaise, raiseCap]);
  useEffect(() => {
    let active = true;

    async function bootstrapLocalPersistence() {
      try {
        await initializeLocalDb();
        const profile = await ensureDefaultProfile();
        const [snapshot, savedHands, recordedZoneStats] = await Promise.all([
          loadProfileSnapshot<PersistedAppSnapshot>(profile.id),
          countRecordedHands(profile.id),
          listRecordedZoneHandStats(profile.id),
        ]);
        if (!active) {
          return;
        }

        setActiveProfile(profile);
        setHandRecordCount(savedHands);

        if (snapshot && snapshot.schemaVersion === APP_SNAPSHOT_SCHEMA_VERSION) {
          const restoredZoneIndex = normalizeZoneIndex(snapshot.zoneIndex);
          const restoredLobbyZone = normalizeZoneIndex(snapshot.lobbyZone);
          const restoredProgress = normalizeProgressSnapshot(snapshot.progress);
          const restoredZoneTraining = mergeZoneTrainingWithRecordedStats(
            restoreZoneTrainingById(snapshot.zoneTrainingById),
            recordedZoneStats,
          );
          const restoredSeats = restoreSeatsFromSnapshot(snapshot.seats, restoredZoneIndex);
          const seatIdSet = new Set(restoredSeats.map((seat) => seat.id));
          const restoredButtonSeatId = seatIdSet.has(snapshot.buttonSeatId) ? snapshot.buttonSeatId : HERO_SEAT;
          const restoredSelectedSeatId = seatIdSet.has(snapshot.selectedSeatId) ? snapshot.selectedSeatId : HERO_SEAT;
          const restoredBattleSeatId =
            snapshot.battleSeatId && restoredSeats.some((seat) => seat.id === snapshot.battleSeatId && seat.role === 'ai')
              ? snapshot.battleSeatId
              : restoredSeats.find((seat) => seat.role === 'ai')?.id ?? null;
          const restoredZone = trainingZones[restoredZoneIndex] ?? trainingZones[0];
          const restoredZoneState = syncZoneTrainingState(restoredZone, restoredSeats, restoredZoneTraining[restoredZone.id]);
          const restoredFocusSeat =
            restoredSeats.find((seat) => seat.id === restoredBattleSeatId && seat.role === 'ai' && seat.ai)
            ?? restoredSeats.find((seat) => seat.role === 'ai' && seat.ai);
          const restoredButtonSeat = restoredSeats.find((seat) => seat.id === restoredButtonSeatId);
          const restoredHand = createNewHand(restoredZone, restoredFocusSeat?.ai ?? restoredZone.aiPool[0], {
            tablePlayers: restoredSeats
              .filter((seat) => seat.role !== 'empty')
              .map((seat) => ({
                id: seat.id,
                position: seat.pos,
                role: seat.role === 'hero' ? 'hero' as const : 'ai' as const,
                ai: seat.ai,
                name: seat.role === 'hero' ? 'Hero' : seat.ai?.name ?? 'AI',
              })),
            focusVillainId: restoredFocusSeat?.id,
            buttonPosition: restoredButtonSeat?.pos ?? 'BTN',
            stackByPlayerId: restoredZoneState.bankroll,
            startingStack: STARTING_STACK,
          });

          setProgress(restoredProgress);
          setZoneTrainingById(restoredZoneTraining);
          setZoneIndex(restoredZoneIndex);
          setLobbyZone(restoredLobbyZone);
          setSeats(restoredSeats);
          setButtonSeatId(restoredButtonSeatId);
          setSelectedSeatId(restoredSelectedSeatId);
          setBattleSeatId(restoredBattleSeatId);
          setPoliteMode(!!snapshot.politeMode);
          setAiVoiceAssistEnabled(snapshot.aiVoiceAssistEnabled !== false);
          setAutoPlayEvents(snapshot.autoPlayEvents !== false);
          setSfxEnabled(snapshot.sfxEnabled !== false);
          setTrainingMode(normalizeTrainingMode(snapshot.trainingMode));
          const restoredLanguage = normalizeAppLanguage(snapshot.appLanguage);
          setAppLanguage(restoredLanguage);
          setPhase('lobby');
          setAnalysisOpen(false);
          setOpsOpen(false);
          setMissionOpen(false);
          setLobbySettingsOpen(false);
          setLeakGuess(null);
          setSeatVisual(buildSeatVisualMap(restoredSeats, restoredLanguage));
          setEventQueue([]);
          setTableFeed([]);
          setActionFeed([]);
          setDisplayedBoardCount(0);
          setEventSeed(1);
          setHand(restoredHand);
          setRaiseAmount(restoredHand.toCall + restoredHand.minRaise);
          setNote(l(restoredLanguage, `已載入本地資料：${profile.displayName}，歷史保存 ${savedHands} 手牌。`, `已加载本地资料：${profile.displayName}，历史保存 ${savedHands} 手牌。`, `Loaded local data: ${profile.displayName}, ${savedHands} saved hands.`));
        } else {
          setZoneTrainingById((prev) => mergeZoneTrainingWithRecordedStats(restoreZoneTrainingById(prev), recordedZoneStats));
          setNote(l(appLanguage, '本地資料庫已啟用，之後會自動保存籌碼、統計與牌局紀錄。', '本地数据库已启用，之后会自动保存筹码、统计与牌局记录。', 'Local database is enabled. Stacks, stats, and hand records will auto-save.'));
        }
      } catch (err) {
        if (!active) {
          return;
        }
        console.warn('Local DB bootstrap failed', err);
        setNote(l(appLanguage, '本地資料庫初始化失敗，暫以本次會話資料運行。', '本地数据库初始化失败，暂以本次会话数据运行。', 'Failed to initialize local DB. Continuing with session-only data.'));
      } finally {
        if (active) {
          setLocalDbReady(true);
        }
      }
    }

    void bootstrapLocalPersistence();
    return () => {
      active = false;
      if (snapshotSaveTimerRef.current) {
        clearTimeout(snapshotSaveTimerRef.current);
        snapshotSaveTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web' || hasAppliedWebEntryRef.current || !localDbReady) {
      return;
    }

    if (webEntryConfig.mode === 'practice') {
      setPhase('lobby');
      setTrainingMode('practice');
    }
    if (webEntryConfig.language) {
      setAppLanguage(webEntryConfig.language);
    }

    hasAppliedWebEntryRef.current = true;
  }, [localDbReady, webEntryConfig]);

  useEffect(() => {
    if (rootTab !== 'review') {
      return;
    }
    void loadReviewRecords();
  }, [rootTab, handRecordCount, loadReviewRecords]);

  useEffect(() => {
    if (!localDbReady || !activeProfile) {
      return;
    }
    if (snapshotSaveTimerRef.current) {
      clearTimeout(snapshotSaveTimerRef.current);
      snapshotSaveTimerRef.current = null;
    }

    const snapshot: PersistedAppSnapshot = {
      schemaVersion: APP_SNAPSHOT_SCHEMA_VERSION,
      savedAt: new Date().toISOString(),
      zoneIndex,
      lobbyZone,
      progress: cloneProgressState(progress),
      zoneTrainingById,
      seats: serializeSeatsForSnapshot(seats),
      buttonSeatId,
      selectedSeatId,
      battleSeatId,
      politeMode,
      aiVoiceAssistEnabled,
      autoPlayEvents,
      sfxEnabled,
      trainingMode,
      appLanguage,
    };

    snapshotSaveTimerRef.current = setTimeout(() => {
      void saveProfileSnapshot(activeProfile.id, snapshot).catch((err) => {
        console.warn('Local snapshot save failed', err);
      });
    }, 260);

    return () => {
      if (snapshotSaveTimerRef.current) {
        clearTimeout(snapshotSaveTimerRef.current);
        snapshotSaveTimerRef.current = null;
      }
    };
  }, [
    activeProfile,
    appLanguage,
    aiVoiceAssistEnabled,
    autoPlayEvents,
    battleSeatId,
    buttonSeatId,
    localDbReady,
    lobbyZone,
    politeMode,
    progress,
    seats,
    selectedSeatId,
    sfxEnabled,
    trainingMode,
    zoneIndex,
    zoneTrainingById,
  ]);

  useEffect(() => {
    if (hand.focusVillainId && seats.some((s) => s.id === hand.focusVillainId && s.role === 'ai')) {
      setBattleSeatId(hand.focusVillainId);
    }
  }, [hand.focusVillainId, seats]);

  useEffect(() => {
    if (phase !== 'table' || trainingMode === 'practice' || !hand.isOver || currentHeroStack > 0 || bankruptcyPromptOpen) {
      return;
    }
    setAnalysisOpen(false);
    setOpsOpen(false);
    setMissionOpen(false);
    setEventQueue([]);
    const resultLine = hand.resultText
      ? rt(hand.resultText, appLanguage, 'Hand ended. Hero bankroll reached zero.')
      : l(appLanguage, '本手結束，Hero 籌碼歸零。', '本手结束，Hero 筹码归零。', 'Hand ended, Hero stack is zero.');
    const lastActions = hand.history
      .slice(-4)
      .map((entry) => rt(entry.text, appLanguage, 'Action log'))
      .filter((entry) => !!entry);
    const detailLine = lastActions.length > 0
      ? l(appLanguage, `最後動作：${lastActions.join(' ｜ ')}`, `最后动作：${lastActions.join(' ｜ ')}`, `Last actions: ${lastActions.join(' | ')}`)
      : '';
    setBankruptcyPromptText(detailLine ? `${resultLine}\n${detailLine}` : resultLine);
    setBankruptcyPromptOpen(true);
    const countdownSeconds = Math.max(1, Math.ceil(BANKRUPTCY_RETURN_DELAY_MS / 1000));
    setBankruptcyCountdown(countdownSeconds);
    clearBankruptcyTimers();
    bankruptcyReturnTimerRef.current = setTimeout(() => {
      returnToLobbyAfterBankruptcy();
    }, BANKRUPTCY_RETURN_DELAY_MS);
    bankruptcyCountdownTimerRef.current = setInterval(() => {
      setBankruptcyCountdown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => {
      clearBankruptcyTimers();
    };
  }, [clearBankruptcyTimers, currentHeroStack, hand.history, hand.isOver, hand.resultText, phase, returnToLobbyAfterBankruptcy, trainingMode]);

  useEffect(() => {
    if (phase === 'table') {
      return;
    }
    clearBankruptcyTimers();
    if (bankruptcyPromptOpen) {
      setBankruptcyPromptOpen(false);
    }
    if (bankruptcyCountdown !== 0) {
      setBankruptcyCountdown(0);
    }
  }, [bankruptcyCountdown, bankruptcyPromptOpen, clearBankruptcyTimers, phase]);

  useEffect(() => {
    if (phase !== 'lobby' && lobbySettingsOpen) {
      setLobbySettingsOpen(false);
    }
  }, [lobbySettingsOpen, phase]);

  useEffect(() => {
    setTableViewportWidth(width);
  }, [width]);

  useEffect(() => {
    if (!analysisOpen) {
      drawerTranslateX.setValue(analysisDrawerHiddenX);
    }
  }, [analysisDrawerHiddenX, analysisOpen, drawerTranslateX]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(drawerTranslateX, {
        toValue: analysisOpen ? 0 : analysisDrawerHiddenX,
        duration: analysisOpen ? 230 : 190,
        easing: analysisOpen ? Easing.out(Easing.cubic) : Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(drawerBackdropOpacity, {
        toValue: analysisOpen ? 1 : 0,
        duration: analysisOpen ? 230 : 190,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    ]).start();
  }, [analysisDrawerHiddenX, analysisOpen, drawerBackdropOpacity, drawerTranslateX]);

  useEffect(() => {
    if (!opsOpen) {
      opsTranslateX.setValue(opsPanelHiddenX);
    }
  }, [opsOpen, opsPanelHiddenX, opsTranslateX]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opsTranslateX, {
        toValue: opsOpen ? 0 : opsPanelHiddenX,
        duration: opsOpen ? 230 : 190,
        easing: opsOpen ? Easing.out(Easing.cubic) : Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(opsBackdropOpacity, {
        toValue: opsOpen ? 1 : 0,
        duration: opsOpen ? 230 : 190,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    ]).start();
  }, [opsOpen, opsPanelHiddenX, opsBackdropOpacity, opsTranslateX]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(missionTranslateX, {
        toValue: missionOpen ? 0 : 760,
        duration: missionOpen ? 230 : 190,
        easing: missionOpen ? Easing.out(Easing.cubic) : Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(missionBackdropOpacity, {
        toValue: missionOpen ? 1 : 0,
        duration: missionOpen ? 230 : 190,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    ]).start();
  }, [missionOpen, missionBackdropOpacity, missionTranslateX]);

  useEffect(() => {
    let active = true;
    const emptyMap = createEmptySfxMap();

    async function loadSounds() {
      const loadedMap = createEmptySfxMap();
      const loadedSounds: Audio.Sound[] = [];
      try {
        setSfxReady(false);
        setSfxLoadError(false);
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
        });
        const keys = Object.keys(SFX_VARIANTS) as SfxKey[];
        for (const key of keys) {
          const sounds = await Promise.all(
            SFX_VARIANTS[key].map((variant) => Audio.Sound.createAsync(variant.asset, { volume: variant.volume })),
          );
          loadedMap[key] = sounds.map((item) => item.sound);
          loadedSounds.push(...loadedMap[key]);
        }
        if (!active) {
          await Promise.all(loadedSounds.map((sound) => sound.unloadAsync().catch(() => undefined)));
          return;
        }
        soundsRef.current = loadedMap;
        setSfxReady(true);
      } catch (err) {
        await Promise.all(loadedSounds.map((sound) => sound.unloadAsync().catch(() => undefined)));
        setSfxLoadError(true);
        setSfxReady(false);
        console.warn('SFX init failed', err);
      }
    }

    void loadSounds();
    return () => {
      active = false;
      if (autoPlayTimerRef.current) {
        clearTimeout(autoPlayTimerRef.current);
        autoPlayTimerRef.current = null;
      }
      if (bankruptcyReturnTimerRef.current) {
        clearTimeout(bankruptcyReturnTimerRef.current);
        bankruptcyReturnTimerRef.current = null;
      }
      if (bankruptcyCountdownTimerRef.current) {
        clearInterval(bankruptcyCountdownTimerRef.current);
        bankruptcyCountdownTimerRef.current = null;
      }
      setSfxReady(false);
      const current = soundsRef.current;
      soundsRef.current = emptyMap;
      Object.values(current).flat().forEach((sound) => {
        void sound.unloadAsync();
      });
    };
  }, []);

  useEffect(() => {
    if (aiVoiceAssistEnabled) {
      return;
    }
    aiCoachSpotRef.current = '';
    if (aiCoachAbortRef.current) {
      aiCoachAbortRef.current.abort();
      aiCoachAbortRef.current = null;
    }
    setAiVoiceBusy(false);
    stopAiCoachAudioPlayback();
  }, [aiVoiceAssistEnabled, stopAiCoachAudioPlayback]);

  useEffect(() => () => {
    if (aiCoachAbortRef.current) {
      aiCoachAbortRef.current.abort();
      aiCoachAbortRef.current = null;
    }
    stopAiCoachAudioPlayback();
    cleanupAiCoachAudioTemps();
  }, [cleanupAiCoachAudioTemps, stopAiCoachAudioPlayback]);

  useEffect(() => {
    if (!aiVoiceAssistEnabled || !isHeroTurn) {
      return;
    }
    if (aiCoachSpotRef.current === heroTurnSpotKey) {
      return;
    }
    aiCoachSpotRef.current = heroTurnSpotKey;
    if (aiCoachAbortRef.current) {
      aiCoachAbortRef.current.abort();
      aiCoachAbortRef.current = null;
    }

    const abortController = new AbortController();
    aiCoachAbortRef.current = abortController;
    setAiVoiceBusy(true);

    const currentSpotInsight = analysisOpen ? spotInsight : buildSpotInsight(hand, 900);
    const coachInput = {
      hand,
      analysis,
      spotInsight: currentSpotInsight,
      recentActionLines,
    };

    void requestCoachVoiceAdvice(coachInput, abortController.signal)
      .then(async (result) => {
        if (abortController.signal.aborted) {
          return;
        }
        const spokenText = result.text || buildLocalCoachSummary(coachInput);
        const localizedSpokenText = rt(spokenText, appLanguage, 'Voice suggestion generated.');
        setAiVoiceLastAdvice(localizedSpokenText);
        const sourceLabel =
          result.source === 'openai_omni'
            ? 'OpenAI Omni'
            : result.source === 'qwen'
              ? 'Qwen'
              : l(appLanguage, '本地回退', '本地回退', 'Local fallback');
        setNote(
          result.error
            ? l(appLanguage, `AI 語音建議（${sourceLabel}，部分回退）：${localizedSpokenText}`, `AI 语音建议（${sourceLabel}，部分回退）：${localizedSpokenText}`, `AI voice tip (${sourceLabel}, partial fallback): ${localizedSpokenText}`)
            : l(appLanguage, `AI 語音建議（${sourceLabel}）：${localizedSpokenText}`, `AI 语音建议（${sourceLabel}）：${localizedSpokenText}`, `AI voice tip (${sourceLabel}): ${localizedSpokenText}`),
        );
        let played = false;
        try {
          played = await playAiCoachAudio(result);
        } catch (playErr) {
          console.warn('AI voice api audio play failed, fallback to local TTS', playErr);
        }
        if (!played) {
          stopAiCoachAudioPlayback();
          Speech.speak(localizedSpokenText, {
            language: appLanguage,
            rate: 0.95,
            pitch: 1.0,
          });
        }
      })
      .catch((err) => {
        if (abortController.signal.aborted) {
          return;
        }
        console.warn('AI voice coach failed', err);
        const fallbackText = buildLocalCoachSummary(coachInput);
        const localizedFallbackText = rt(fallbackText, appLanguage, 'Voice suggestion generated from local fallback.');
        setAiVoiceLastAdvice(localizedFallbackText);
        setNote(l(appLanguage, `AI 語音建議（本地回退）：${localizedFallbackText}`, `AI 语音建议（本地回退）：${localizedFallbackText}`, `AI voice tip (local fallback): ${localizedFallbackText}`));
        stopAiCoachAudioPlayback();
        Speech.speak(localizedFallbackText, {
          language: appLanguage,
          rate: 0.95,
          pitch: 1.0,
        });
      })
      .finally(() => {
        if (aiCoachAbortRef.current === abortController) {
          aiCoachAbortRef.current = null;
        }
        if (!abortController.signal.aborted) {
          setAiVoiceBusy(false);
        }
      });

    return () => {
      abortController.abort();
      if (aiCoachAbortRef.current === abortController) {
        aiCoachAbortRef.current = null;
      }
    };
  }, [
    appLanguage,
    aiVoiceAssistEnabled,
    isHeroTurn,
    heroTurnSpotKey,
    analysisOpen,
    spotInsight,
    hand,
    analysis,
    recentActionLines,
    playAiCoachAudio,
    stopAiCoachAudioPlayback,
  ]);

  const engineLabel =
    analysis.gto.source === 'preflop_cfr'
      ? l(appLanguage, '本地 Preflop HU-CFR', '本地 Preflop HU-CFR', 'Local Preflop HU-CFR')
      : analysis.gto.source === 'postflop_cfr'
        ? l(appLanguage, '本地 Postflop 抽象 CFR', '本地 Postflop 抽象 CFR', 'Local Postflop Abstract CFR')
        : l(appLanguage, '啟發式', '启发式', 'Heuristic');

  function enqueueTableEvents(events: TableEvent[]) {
    if (events.length === 0) return;
    setEventQueue((prev) => [...prev, ...events]);
  }

  function playSfx(kind: SfxKey) {
    if (!sfxEnabled || !sfxReady) return;
    const pool = soundsRef.current[kind];
    if (!pool || pool.length === 0) return;
    const sound = pool[Math.floor(Math.random() * pool.length)] ?? pool[0];
    void sound.replayAsync().catch((err) => {
      console.warn(`SFX play failed: ${kind}`, err);
    });
  }

  function seatById(id: string, list: Seat[] = seats): Seat | undefined {
    return list.find((s) => s.id === id);
  }

  function nextButtonSeatId(list: Seat[], current: string): string {
    const occupiedIds = seatLayout
      .map((anchor) => anchor.id)
      .filter((seatId) => list.some((seat) => seat.id === seatId && seat.role !== 'empty'));
    if (occupiedIds.length === 0) {
      return current;
    }

    const occupiedSet = new Set(occupiedIds);
    const currentInOccupied = occupiedSet.has(current);
    const currentIdx = seatLayout.findIndex((anchor) => anchor.id === current);
    if (currentInOccupied) {
      const idx = occupiedIds.indexOf(current);
      return occupiedIds[(idx + 1) % occupiedIds.length];
    }

    if (currentIdx === -1) {
      return occupiedIds[0];
    }

    for (let step = 1; step <= seatLayout.length; step += 1) {
      const candidate = seatLayout[(currentIdx + step) % seatLayout.length]?.id;
      if (candidate && occupiedSet.has(candidate)) {
        return candidate;
      }
    }

    return occupiedIds[0];
  }

  function buildTableConfig(list: Seat[]) {
    return list
      .filter((seat) => seat.role !== 'empty')
      .map((seat) => ({
        id: seat.id,
        position: seat.pos,
        role: seat.role === 'hero' ? 'hero' as const : 'ai' as const,
        ai: seat.ai,
        name: seat.role === 'hero' ? 'Hero' : seat.ai?.name ?? 'AI',
      }));
  }

  function dealOrderFromSmallBlind(smallBlind: TablePosition, players: typeof hand.players): TablePosition[] {
    // Dealing should follow strict clockwise order from SB and include everyone
    // who was actually dealt cards this hand, even if they folded before UI replay.
    const dealtPositions = tableOrder.filter((pos) => {
      const player = players.find((p) => p.position === pos);
      if (!player) return false;
      return player.inHand;
    });

    if (dealtPositions.length === 0) {
      return [];
    }

    const sbIdx = dealtPositions.indexOf(smallBlind);
    const startIdx = sbIdx === -1 ? 0 : sbIdx;
    const order: TablePosition[] = [];
    for (let i = 0; i < dealtPositions.length; i += 1) {
      order.push(dealtPositions[(startIdx + i) % dealtPositions.length]);
    }
    return order;
  }

  function buildHandOpeningEvents(nextSeats: Seat[], nextHand: typeof hand): TableEvent[] {
    let seed = eventSeed;
    const events: TableEvent[] = [];
    const push = (event: Omit<TableEvent, 'id'>) => {
      events.push({ id: nextEventId(seed), ...event });
      seed += 1;
    };

    const dealOrder = dealOrderFromSmallBlind(nextHand.smallBlindPosition, nextHand.players);
    for (let round = 0; round < 2; round += 1) {
      dealOrder.forEach((pos) => {
        const seat = nextSeats.find((s) => s.pos === pos && s.role !== 'empty');
        if (!seat || seat.role === 'empty') return;
        push({
          kind: 'deal',
          seatId: seat.id,
          text: l(appLanguage, `發牌：${seatName(seat, appLanguage)} 收到第 ${round + 1} 張`, `发牌：${seatName(seat, appLanguage)} 收到第 ${round + 1} 张`, `Deal: ${seatName(seat, appLanguage)} receives card ${round + 1}`),
        });
      });
    }

    let trackedStreet: Street = 'preflop';
    nextHand.history.forEach((log) => {
      if (log.street !== trackedStreet) {
        const revealDelta = streetBoardCount(log.street) - streetBoardCount(trackedStreet);
        if (revealDelta > 0) {
          push({ kind: 'street', text: l(appLanguage, `進入 ${log.street.toUpperCase()}`, `进入 ${log.street.toUpperCase()}`, `Enter ${log.street.toUpperCase()}`) });
          for (let i = 0; i < revealDelta; i += 1) {
            push({ kind: 'reveal', text: l(appLanguage, `發出 ${log.street.toUpperCase()} 公牌 ${i + 1}`, `发出 ${log.street.toUpperCase()} 公牌 ${i + 1}`, `Reveal ${log.street.toUpperCase()} board card ${i + 1}`) });
          }
        }
        trackedStreet = log.street;
      }
      const kind: TableEventKind = log.forcedBlind ? 'blind' : 'action';
      const fallbackText = kind === 'blind'
        ? l(appLanguage, `盲注 ${log.amount ?? ''}`.trim(), `盲注 ${log.amount ?? ''}`.trim(), `Blind ${log.amount ?? ''}`.trim())
        : actionDisplayText(log.action, log.amount, log.allIn, appLanguage);
      push({
        kind,
        seatId: log.actorId,
        action: log.action,
        amount: log.amount,
        allIn: log.allIn,
        text: rt(log.text, appLanguage, fallbackText),
      });
    });

    push({ kind: 'hint', text: nextHand.isOver ? nextHand.resultText : l(appLanguage, '輪到你行動。', '轮到你行动。', 'Your turn.') });
    setEventSeed(seed);
    return events;
  }

  function buildTransitionEvents(prevHand: typeof hand, nextHand: typeof hand): TableEvent[] {
    let seed = eventSeed;
    const events: TableEvent[] = [];
    const push = (event: Omit<TableEvent, 'id'>) => {
      events.push({ id: nextEventId(seed), ...event });
      seed += 1;
    };

    const newLogs = nextHand.history.slice(prevHand.history.length);
    let trackedStreet = prevHand.street;
    newLogs.forEach((log) => {
      if (log.street !== trackedStreet) {
        const revealDelta = streetBoardCount(log.street) - streetBoardCount(trackedStreet);
        if (revealDelta > 0) {
          push({ kind: 'street', text: l(appLanguage, `進入 ${log.street.toUpperCase()}`, `进入 ${log.street.toUpperCase()}`, `Enter ${log.street.toUpperCase()}`) });
          for (let i = 0; i < revealDelta; i += 1) {
            push({ kind: 'reveal', text: l(appLanguage, `發出 ${log.street.toUpperCase()} 公牌 ${i + 1}`, `发出 ${log.street.toUpperCase()} 公牌 ${i + 1}`, `Reveal ${log.street.toUpperCase()} board card ${i + 1}`) });
          }
        }
        trackedStreet = log.street;
      }
      const kind: TableEventKind = log.forcedBlind ? 'blind' : 'action';
      const fallbackText = kind === 'blind'
        ? l(appLanguage, `盲注 ${log.amount ?? ''}`.trim(), `盲注 ${log.amount ?? ''}`.trim(), `Blind ${log.amount ?? ''}`.trim())
        : actionDisplayText(log.action, log.amount, log.allIn, appLanguage);
      push({
        kind,
        seatId: log.actorId ?? (log.actor === 'hero' ? HERO_SEAT : undefined),
        action: log.action,
        amount: log.amount,
        allIn: log.allIn,
        text: rt(log.text, appLanguage, fallbackText),
      });
    });

    if (nextHand.isOver) {
      push({ kind: 'hint', text: nextHand.resultText || l(appLanguage, '本手結束', '本手结束', 'Hand complete') });
    }

    setEventSeed(seed);
    return events;
  }

  function animateSeatDeal(seatId: string) {
    setActiveSeatAnimId(seatId);
    seatPulse.setValue(0);
    Animated.sequence([
      Animated.timing(seatPulse, {
        toValue: 1,
        duration: 170,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(seatPulse, {
        toValue: 0,
        duration: 170,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start(() => {
      setActiveSeatAnimId((current) => (current === seatId ? null : current));
    });
  }

  function animateChipPush() {
    chipPulse.setValue(0);
    Animated.timing(chipPulse, {
      toValue: 1,
      duration: 320,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      Animated.timing(chipPulse, {
        toValue: 0,
        duration: 220,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }).start();
    });
  }

  function applyTableEvent(event: TableEvent) {
    setTableFeed((prev) => [event.text, ...prev].slice(0, 18));
    if (event.kind === 'action' || event.kind === 'blind') {
      setActionFeed((prev) => [event.text, ...prev].slice(0, ACTION_FEED_LIMIT));
    }

    if (event.kind === 'street') {
      playSfx('reveal');
      return;
    }

    if (event.kind === 'reveal') {
      playSfx('reveal');
      setDisplayedBoardCount((count) => Math.min(hand.revealedBoardCount, count + 1));
      return;
    }

    if (event.kind === 'hint') {
      playSfx('ui');
      return;
    }

    if (!event.seatId) {
      return;
    }
    const seatId = event.seatId;

    setSeatVisual((prev) => {
      const target = prev[seatId];
      if (!target) return prev;
      const next = { ...prev };
      const updated = { ...target };
      if (event.kind === 'deal') {
        playSfx('deal');
        animateSeatDeal(seatId);
        updated.cardsDealt = Math.min(2, updated.cardsDealt + 1);
        updated.lastAction = l(appLanguage, '收牌', '收牌', 'Dealt');
      } else if (event.kind === 'blind') {
        playSfx('blind');
        if ((event.amount ?? 0) > 0) {
          animateChipPush();
        }
        updated.lastAction = l(appLanguage, `盲注 ${event.amount ?? ''}`.trim(), `盲注 ${event.amount ?? ''}`.trim(), `Blind ${event.amount ?? ''}`.trim());
      } else if (event.kind === 'action') {
        const soundKey = actionSfxKey(event.action, event.amount, event.allIn, event.text);
        playSfx(soundKey);
        if (soundKey === 'call' || soundKey === 'raise' || soundKey === 'allIn' || soundKey === 'blind') {
          animateChipPush();
        }
        updated.lastAction = actionDisplayText(event.action, event.amount, event.allIn, appLanguage);
        if (event.action === 'fold') {
          updated.folded = true;
          updated.inHand = false;
        } else if (event.action === 'raise' || event.action === 'call' || event.action === 'check') {
          updated.inHand = true;
          updated.folded = false;
        }
      }
      next[seatId] = updated;
      return next;
    });
  }

  function runNextEvent() {
    if (autoPlayTimerRef.current) {
      clearTimeout(autoPlayTimerRef.current);
      autoPlayTimerRef.current = null;
    }
    setEventQueue((prev) => {
      if (prev.length === 0) return prev;
      const [head, ...rest] = prev;
      applyTableEvent(head);
      return rest;
    });
  }

  useEffect(() => {
    if (autoPlayTimerRef.current) {
      clearTimeout(autoPlayTimerRef.current);
      autoPlayTimerRef.current = null;
    }
    if (!autoPlayEvents || eventQueue.length === 0) return;
    autoPlayTimerRef.current = setTimeout(() => {
      runNextEvent();
    }, eventDelayMs(eventQueue[0]));
    return () => {
      if (autoPlayTimerRef.current) {
        clearTimeout(autoPlayTimerRef.current);
        autoPlayTimerRef.current = null;
      }
    };
  }, [autoPlayEvents, eventQueue]);

  function setRaiseAmountBySliderLocation(locationX: number) {
    if (!canRaise || raiseSliderWidth <= 0) {
      return;
    }
    const ratio = clamp(locationX / raiseSliderWidth, 0, 1);
    if (raiseRange <= 0) {
      setRaiseAmount(raiseCap);
      return;
    }
    const nextAmount = minRaise + Math.round(raiseRange * ratio);
    setRaiseAmount(clamp(nextAmount, minRaise, raiseCap));
  }

  function handleRaiseSliderLayout(event: LayoutChangeEvent) {
    setRaiseSliderWidth(event.nativeEvent.layout.width);
  }

  function handleTableScreenLayout(event: LayoutChangeEvent) {
    const nextWidth = event.nativeEvent.layout.width;
    if (!Number.isFinite(nextWidth) || nextWidth <= 0) {
      return;
    }
    setTableViewportWidth((prev) => (Math.abs(prev - nextWidth) > 1 ? nextWidth : prev));
  }

  function handleRaiseSliderGesture(event: GestureResponderEvent) {
    setRaiseAmountBySliderLocation(event.nativeEvent.locationX);
  }

  function stackText(seat: Seat): string {
    if (seat.role === 'empty') return '--';
    const player = hand.players.find((p) => p.id === seat.id);
    if (player) {
      const stack = normalizeStackValue(player.stack);
      if (seat.role === 'ai' && hand.isOver && stack <= 0) {
        return l(appLanguage, '出局', '出局', 'Busted');
      }
      return `${stack}`;
    }
    const persistentStack = zoneBankroll[seat.id];
    if (typeof persistentStack === 'number') {
      if (seat.role === 'ai' && persistentStack <= 0) {
        return l(appLanguage, '出局', '出局', 'Busted');
      }
      return `${normalizeStackValue(persistentStack)}`;
    }
    if (seat.role === 'hero') return `${normalizeStackValue(hand.heroStack)}`;
    return `${STARTING_STACK}`;
  }

  function startHand(targetSeatId?: string, options?: { zoneStateOverride?: ZoneTrainingState; modeOverride?: TrainingMode }) {
    const mode = options?.modeOverride ?? trainingMode;
    const syncedZoneState = options?.zoneStateOverride ?? syncZoneTrainingState(zone, seats, zoneTrainingById[zone.id]);
    const bankroll = syncedZoneState.bankroll;
    const handBankroll = buildHandBankrollForMode(mode, seats, bankroll);
    if (mode === 'career' && (bankroll[HERO_SEAT] ?? STARTING_STACK) <= 0) {
      setNote(l(appLanguage, '你在本區已無可用籌碼，請到燈泡抽屜點「重置本區 100bb」。', '你在本区已无可用筹码，请到灯泡抽屉点「重置本区 100bb」。', 'No chips left in this zone. Open the bulb drawer and tap "Reset zone to 100bb".'));
      return;
    }

    const aiSeats = seats.filter((s): s is Seat & { role: 'ai' } => s.role === 'ai');
    if (aiSeats.length === 0) {
      setNote(l(appLanguage, '請先新增一位 AI 再開局。', '请先新增一位 AI 再开局。', 'Add at least one AI before starting a hand.'));
      return;
    }

    const preferredSeatId = targetSeatId ?? battleSeatId ?? aiSeats[0]?.id;
    const preferredSeat = aiSeats.find((s) => s.id === preferredSeatId);
    const seat = mode === 'practice'
      ? (preferredSeat ?? aiSeats[0])
      : ((preferredSeat && (handBankroll[preferredSeat.id] ?? STARTING_STACK) > 0)
        ? preferredSeat
        : aiSeats.find((candidate) => (handBankroll[candidate.id] ?? STARTING_STACK) > 0));

    if (!seat) {
      setNote(l(appLanguage, '所有 AI 都已出局，請新增 AI 或重置本區資金。', '所有 AI 都已出局，请新增 AI 或重置本区资金。', 'All AIs are busted. Add AI players or reset this zone bankroll.'));
      return;
    }
    if (!seat.ai) {
      setNote(l(appLanguage, '請先新增或選擇一位 AI 當本手對手', '请先新增或选择一位 AI 当本手对手', 'Add or select an AI opponent first.'));
      return;
    }

    const switchedOpponent = !!preferredSeat && preferredSeat.id !== seat.id;
    const tableConfig = buildTableConfig(seats);
    const nextButtonId = nextButtonSeatId(seats, buttonSeatId);
    const buttonSeat = seatById(nextButtonId, seats);
    const fresh = createNewHand(zone, seat.ai, {
      tablePlayers: tableConfig,
      focusVillainId: seat.id,
      buttonPosition: buttonSeat?.pos ?? 'BTN',
      stackByPlayerId: handBankroll,
      startingStack: STARTING_STACK,
    });
    setZoneTrainingById((prev) => ({
      ...prev,
      [zone.id]: {
        ...syncedZoneState,
        bankroll: { ...bankroll },
      },
    }));
    setBattleSeatId(seat.id);
    setPendingReplacementSeatIds([]);
    setButtonSeatId(nextButtonId);
    setHand(fresh);
    setRaiseAmount(fresh.toCall + fresh.minRaise);
    setDisplayedBoardCount(0);
    setTableFeed([]);
    setActionFeed([]);
    const visual = buildSeatVisualMap(seats, appLanguage);
    setSeatVisual(visual);
    setEventQueue([]);
    enqueueTableEvents(buildHandOpeningEvents(seats, fresh));
    const actor = fresh.players.find((p) => p.id === fresh.actingPlayerId);
    const heroStack = handBankroll[HERO_SEAT] ?? STARTING_STACK;
    const switchHint = switchedOpponent
      ? l(appLanguage, `已切換對手為 ${seatName(seat, appLanguage)}。`, `已切换对手为 ${seatName(seat, appLanguage)}。`, `Switched opponent to ${seatName(seat, appLanguage)}.`)
      : '';
    const modeHint = mode === 'practice'
      ? l(appLanguage, `練習模式（不消耗區域資金，XP ${Math.round(PRACTICE_XP_MULTIPLIER * 100)}%）`, `练习模式（不消耗区域资金，XP ${Math.round(PRACTICE_XP_MULTIPLIER * 100)}%）`, `Practice mode (no zone bankroll cost, XP ${Math.round(PRACTICE_XP_MULTIPLIER * 100)}%)`)
      : l(appLanguage, `生涯模式（XP ${Math.round(careerXpMultiplier(syncedZoneState.aidUses) * 100)}%）`, `生涯模式（XP ${Math.round(careerXpMultiplier(syncedZoneState.aidUses) * 100)}%）`, `Career mode (XP ${Math.round(careerXpMultiplier(syncedZoneState.aidUses) * 100)}%)`);
    setNote(
      l(
        appLanguage,
        `${switchHint}新手牌：${fresh.position.situationLabel}，按鈕 ${buttonSeat?.pos ?? 'BTN'}。資金 ${heroStack}（${Math.floor(heroStack / Math.max(1, fresh.bigBlind))}bb）。${modeHint}。${actor?.name === 'Hero' ? '輪到你行動。' : `目前行動：${actor?.name ?? '等待'}`}`,
        `${switchHint}新手牌：${fresh.position.situationLabel}，按钮 ${buttonSeat?.pos ?? 'BTN'}。资金 ${heroStack}（${Math.floor(heroStack / Math.max(1, fresh.bigBlind))}bb）。${modeHint}。${actor?.name === 'Hero' ? '轮到你行动。' : `当前行动：${actor?.name ?? '等待'}`}`,
        `${switchHint}New hand: ${fresh.position.situationLabel}, button ${buttonSeat?.pos ?? 'BTN'}. Bankroll ${heroStack} (${Math.floor(heroStack / Math.max(1, fresh.bigBlind))}bb). ${modeHint}. ${actor?.name === 'Hero' ? 'Your turn.' : `Acting now: ${actor?.name ?? 'Waiting'}`}`,
      ),
    );
  }

  function enterTable(z: number) {
    if (z > unlockedIdx) {
      const zoneDef = trainingZones[z] ?? trainingZones[0];
      setNote(l(appLanguage, `目前只解鎖到 ${unlockedZoneName}。${zoneName(zoneDef, appLanguage)} 解鎖條件：${zoneUnlockHint(z, progress, appLanguage)}。`, `目前只解锁到 ${unlockedZoneName}。${zoneName(zoneDef, appLanguage)} 解锁条件：${zoneUnlockHint(z, progress, appLanguage)}。`, `Unlocked up to ${unlockedZoneName}. Requirement for ${zoneName(zoneDef, appLanguage)}: ${zoneUnlockHint(z, progress, appLanguage)}.`));
      return;
    }
    const zoneDef = trainingZones[z];
    const mode = trainingMode;
    const nextSeats = makeSeats(z);
    const syncedZoneState = syncZoneTrainingState(zoneDef, nextSeats, zoneTrainingById[zoneDef.id]);
    const bankroll = syncedZoneState.bankroll;
    const handBankroll = buildHandBankrollForMode(mode, nextSeats, bankroll);
    if (mode === 'career' && (bankroll[HERO_SEAT] ?? STARTING_STACK) <= 0) {
      setNote(l(appLanguage, `${zoneName(zoneDef, appLanguage)} 的 Hero 籌碼已歸零，請先重置本區 100bb。`, `${zoneName(zoneDef, appLanguage)} 的 Hero 筹码已归零，请先重置本区 100bb。`, `Hero stack in ${zoneName(zoneDef, appLanguage)} is zero. Reset this zone to 100bb first.`));
      return;
    }
    const aiSeats = nextSeats.filter((s): s is Seat & { role: 'ai' } => s.role === 'ai');
    const firstAiSeat = mode === 'practice'
      ? aiSeats.find((s) => !!s.ai)
      : aiSeats.find((s) => !!s.ai && (handBankroll[s.id] ?? STARTING_STACK) > 0)
        ?? aiSeats.find((s) => !!s.ai);
    const firstAiId = firstAiSeat?.id ?? null;
    const firstAi = firstAiSeat?.ai ?? pickAi(z);
    const nextButtonId = nextSeats.some((seat) => seat.id === buttonSeatId && seat.role !== 'empty')
      ? buttonSeatId
      : (nextSeats.find((seat) => seat.role !== 'empty')?.id ?? HERO_SEAT);
    const buttonSeat = seatById(nextButtonId, nextSeats);
    const hasPlayableAi = mode === 'practice'
      ? aiSeats.some((s) => !!s.ai)
      : aiSeats.some((s) => !!s.ai && (handBankroll[s.id] ?? STARTING_STACK) > 0);

    setZoneIndex(z);
    setSeats(nextSeats);
    setButtonSeatId(nextButtonId);
    setSelectedSeatId(firstAiId ?? HERO_SEAT);
    setBattleSeatId(firstAiId);
    setPendingReplacementSeatIds([]);
    setLeakGuess(null);
    setZoneTrainingById((prev) => ({
      ...prev,
      [zoneDef.id]: {
        ...syncedZoneState,
        bankroll: { ...bankroll },
      },
    }));

    if (!hasPlayableAi) {
      setDisplayedBoardCount(0);
      setTableFeed([]);
      setActionFeed([]);
      setSeatVisual(buildSeatVisualMap(nextSeats, appLanguage));
      setEventQueue([]);
      setPhase('lobby');
      setNote(l(appLanguage, `無法進桌：${zoneName(zoneDef, appLanguage)} 目前沒有可對戰 AI，請重置本區資金或先補上 AI。`, `无法进桌：${zoneName(zoneDef, appLanguage)} 目前没有可对战 AI，请重置本区资金或先补上 AI。`, `Cannot enter: ${zoneName(zoneDef, appLanguage)} has no playable AI. Reset bankroll or add AI first.`));
      return;
    }

    const fresh = createNewHand(zoneDef, firstAi, {
      tablePlayers: buildTableConfig(nextSeats),
      focusVillainId: firstAiId ?? undefined,
      buttonPosition: buttonSeat?.pos ?? 'BTN',
      stackByPlayerId: handBankroll,
      startingStack: STARTING_STACK,
    });
    setHand(fresh);
    setDisplayedBoardCount(0);
    setTableFeed([]);
    setActionFeed([]);
    const visual = buildSeatVisualMap(nextSeats, appLanguage);
    setSeatVisual(visual);
    setEventQueue([]);
    if (firstAiId) {
      enqueueTableEvents(buildHandOpeningEvents(nextSeats, fresh));
    }
    setPhase('table');
    const heroStack = handBankroll[HERO_SEAT] ?? STARTING_STACK;
    const heroBb = Math.floor(heroStack / Math.max(1, fresh.bigBlind));
    setNote(
      mode === 'practice'
        ? l(appLanguage, `已進入 ${zoneName(zoneDef, appLanguage)}：練習模式起手資金 ${heroStack}（${heroBb}bb），不消耗生涯資金。`, `已进入 ${zoneName(zoneDef, appLanguage)}：练习模式起手资金 ${heroStack}（${heroBb}bb），不消耗生涯资金。`, `Entered ${zoneName(zoneDef, appLanguage)}: practice starting stack ${heroStack} (${heroBb}bb), career bankroll unchanged.`)
        : l(appLanguage, `已進入 ${zoneName(zoneDef, appLanguage)}：起手資金 ${heroStack}（${heroBb}bb），同區域資金會累積不重置。`, `已进入 ${zoneName(zoneDef, appLanguage)}：起手资金 ${heroStack}（${heroBb}bb），同区域资金会累积不重置。`, `Entered ${zoneName(zoneDef, appLanguage)}: starting stack ${heroStack} (${heroBb}bb), zone bankroll persists and accumulates.`),
    );
  }

  function addAiToSeats(seatIds: string[]): Array<{ seatId: string; ai: AiProfile; pos: TablePosition }> {
    const requested = new Set(seatIds);
    if (requested.size === 0) {
      return [];
    }

    const additions: Array<{ seatId: string; ai: AiProfile; pos: TablePosition }> = [];
    const nextSeats = seats.map((seat) => {
      if (!requested.has(seat.id) || seat.role !== 'empty') {
        return seat;
      }
      const ai = pickAi(zoneIndex);
      additions.push({ seatId: seat.id, ai, pos: seat.pos });
      return { ...seat, role: 'ai' as const, ai };
    });

    if (additions.length === 0) {
      return [];
    }

    const addedIds = new Set(additions.map((item) => item.seatId));
    setSeats(nextSeats);
    const syncedZoneState = syncZoneTrainingState(zone, nextSeats, zoneTrainingById[zone.id]);
    const bankroll = { ...syncedZoneState.bankroll };
    additions.forEach((item) => {
      bankroll[item.seatId] = STARTING_STACK;
    });
    setZoneTrainingById((prev) => ({
      ...prev,
      [zone.id]: {
        ...syncedZoneState,
        bankroll,
      },
    }));
    setSeatVisual((prev) => {
      const next = { ...prev };
      additions.forEach((item) => {
        next[item.seatId] = {
          cardsDealt: 0,
          inHand: true,
          folded: false,
          lastAction: l(appLanguage, '等待中', '等待中', 'Waiting'),
        };
      });
      return next;
    });

    const firstAddedSeatId = additions[0]?.seatId;
    if (firstAddedSeatId) {
      setSelectedSeatId(firstAddedSeatId);
      setBattleSeatId(firstAddedSeatId);
    }
    setPendingReplacementSeatIds((prev) => prev.filter((id) => !addedIds.has(id)));
    return additions;
  }

  function addAiToSeat(seatId: string): boolean {
    const additions = addAiToSeats([seatId]);
    if (additions.length === 0) {
      return false;
    }
    const added = additions[0];
    setNote(l(appLanguage, `已在 ${added.pos} 新增 ${added.ai.name}。再次點同座位可移除。`, `已在 ${added.pos} 新增 ${added.ai.name}。再次点同座位可移除。`, `Added ${added.ai.name} to ${added.pos}. Tap the same seat again to remove.`));
    return true;
  }

  function addPendingReplacementPlayers(): void {
    const additions = addAiToSeats(pendingReplacementSeatIds);
    if (additions.length === 0) {
      setPendingReplacementSeatIds([]);
      setNote(l(appLanguage, '目前沒有可補位的空座位。', '目前没有可补位的空座位。', 'No empty seats available for replacement.'));
      return;
    }
    const seatPositions = additions.map((item) => item.pos).join('、');
    setPendingReplacementSeatIds([]);
    setNote(l(appLanguage, `已補進 ${additions.length} 位新玩家（${seatPositions}）。點「下一手」繼續。`, `已补进 ${additions.length} 位新玩家（${seatPositions}）。点「下一手」继续。`, `Added ${additions.length} new player(s) (${seatPositions}). Tap "Next Hand" to continue.`));
  }

  function skipPendingReplacementPlayers(): void {
    setPendingReplacementSeatIds([]);
    setNote(l(appLanguage, '已保留空位。之後可隨時點空位加入新玩家。', '已保留空位。之后可随时点空位加入新玩家。', 'Empty seats are kept. You can add players later anytime.'));
  }

  function removeAiFromSeat(seatId: string): boolean {
    const targetSeat = seats.find((s) => s.id === seatId);
    if (!targetSeat || targetSeat.role !== 'ai') {
      return false;
    }

    const nextSeats = seats.map((seat) => (seat.id === seatId ? { ...seat, role: 'empty' as const, ai: undefined } : seat));
    setSeats(nextSeats);
    const syncedZoneState = syncZoneTrainingState(zone, nextSeats, zoneTrainingById[zone.id]);
    setZoneTrainingById((prev) => ({
      ...prev,
      [zone.id]: syncedZoneState,
    }));
    setSeatVisual((prev) => ({
      ...prev,
      [seatId]: {
        cardsDealt: 0,
        inHand: false,
        folded: true,
        lastAction: l(appLanguage, '點擊新增', '点击新增', 'Tap to add'),
      },
    }));

    const nextAi = nextSeats.find((seat) => seat.role === 'ai');
    setSelectedSeatId(nextAi?.id ?? HERO_SEAT);
    if (battleSeatId === seatId) {
      setBattleSeatId(nextAi?.id ?? null);
    }
    setNote(l(appLanguage, `已移除 ${targetSeat.pos} 的 AI。`, `已移除 ${targetSeat.pos} 的 AI。`, `Removed AI from ${targetSeat.pos}.`));
    return true;
  }

  function handleSeatTap(seat: Seat) {
    const wasSelected = selectedSeatId === seat.id;
    const wasBattleSeat = battleSeatId === seat.id;
    setSelectedSeatId(seat.id);

    if (seat.role === 'hero') {
      setNote(l(appLanguage, '這是 Hero 座位。點空位可新增 AI，點已鎖定 AI 可移除。', '这是 Hero 座位。点空位可新增 AI，点已锁定 AI 可移除。', 'This is the Hero seat. Tap an empty seat to add AI, tap locked AI to remove.'));
      return;
    }

    if (seat.role === 'empty') {
      if (!hand.isOver) {
        setNote(l(appLanguage, '本手進行中，請先打完本手再新增 AI。', '本手进行中，请先打完本手再新增 AI。', 'Hand in progress. Finish this hand before adding AI.'));
        return;
      }
      setLeakGuess(null);
      void addAiToSeat(seat.id);
      return;
    }

    if (!wasSelected || !wasBattleSeat) {
      setBattleSeatId(seat.id);
      setNote(l(appLanguage, `已鎖定 ${seatName(seat, appLanguage)} 為本手對手。再次點同座位可移除。`, `已锁定 ${seatName(seat, appLanguage)} 为本手对手。再次点同座位可移除。`, `Locked ${seatName(seat, appLanguage)} as the current opponent. Tap again to remove.`));
      return;
    }

    if (!hand.isOver) {
      setNote(l(appLanguage, '本手進行中，請先打完本手再移除 AI。', '本手进行中，请先打完本手再移除 AI。', 'Hand in progress. Finish this hand before removing AI.'));
      return;
    }

    setLeakGuess(null);
    void removeAiFromSeat(seat.id);
  }

  function resetZoneTrainingState() {
    const fresh = createZoneTrainingState(zone, seats);
    setZoneTrainingById((prev) => ({
      ...prev,
      [zone.id]: fresh,
    }));
    setNote(l(appLanguage, `已重置 ${zoneName(zone, appLanguage)}：所有在座玩家回到 ${STARTING_BB}bb 起手。`, `已重置 ${zoneName(zone, appLanguage)}：所有在座玩家回到 ${STARTING_BB}bb 起手。`, `Reset ${zoneName(zone, appLanguage)}: all seated players are back to ${STARTING_BB}bb.`));
  }

  function applyCareerBankruptcyRescue(kind: 'subsidy' | 'loan') {
    const syncedZoneState = syncZoneTrainingState(zone, seats, zoneTrainingById[zone.id]);
    const today = localDateKey();
    if (kind === 'subsidy' && syncedZoneState.subsidyClaimDate === today) {
      setNote(l(appLanguage, '本區今日補助已領取，請改用教練貸款或切換練習模式。', '本区今日补助已领取，请改用教练贷款或切换练习模式。', 'Today subsidy already claimed in this zone. Use coach loan or switch to practice mode.'));
      return;
    }

    const rescueBb = kind === 'subsidy' ? SUBSIDY_BB : LOAN_BB;
    const rescueChips = bbToChips(rescueBb);
    const heroStack = syncedZoneState.bankroll[HERO_SEAT] ?? 0;
    const nextZoneState: ZoneTrainingState = {
      ...syncedZoneState,
      bankroll: {
        ...syncedZoneState.bankroll,
        [HERO_SEAT]: normalizeStackValue(heroStack + rescueChips),
      },
      aidUses: syncedZoneState.aidUses + 1,
      subsidyClaimDate: kind === 'subsidy' ? today : syncedZoneState.subsidyClaimDate,
      loanDebt: kind === 'loan' ? syncedZoneState.loanDebt + rescueChips : syncedZoneState.loanDebt,
    };

    setZoneTrainingById((prev) => ({
      ...prev,
      [zone.id]: nextZoneState,
    }));

    closeBankruptcyOverlay();
    startHand(battleSeatId ?? selectedSeatId, { zoneStateOverride: nextZoneState, modeOverride: 'career' });
  }

  function continueInPracticeMode() {
    setTrainingMode('practice');
    closeBankruptcyOverlay();
    startHand(battleSeatId ?? selectedSeatId, { modeOverride: 'practice' });
  }

  function doAction(action: ActionType) {
    if (!seats.find((s) => s.id === battleSeatId && s.role === 'ai')) {
      setNote(l(appLanguage, '先指定一位 AI 當本手對手', '先指定一位 AI 当本手对手', 'Select an AI as the current opponent first.'));
      return;
    }
    if (heroAllIn) {
      setNote(l(appLanguage, '你已全下，牌局會自動推演到攤牌。', '你已全下，牌局会自动推演到摊牌。', 'You are all-in. The hand will auto-run to showdown.'));
      return;
    }
    if (hand.actingPlayerId && hand.actingPlayerId !== HERO_SEAT) {
      const actor = hand.players.find((p) => p.id === hand.actingPlayerId);
      setNote(l(appLanguage, `目前行動權在 ${actor?.name ?? '其他玩家'}，等系統播放到你。`, `当前行动权在 ${actor?.name ?? '其他玩家'}，等系统播放到你。`, `Action is on ${actor?.name ?? 'another player'}. Wait for your turn.`));
      return;
    }
    if (hasPendingEvent) {
      setNote(l(appLanguage, '桌上動作仍在播放中，等到你時再決策。', '桌上动作仍在播放中，等到你时再决策。', 'Table actions are still replaying. Decide when it is your turn.'));
      return;
    }
    if (hand.isOver) {
      setNote(l(appLanguage, '本手已結束，請開下一手', '本手已结束，请开下一手', 'This hand is over. Start the next hand.'));
      return;
    }
    const prevHand = hand;
    const res = applyHeroAction(hand, { action, raiseAmount }, politeMode);
    let missionRewardXp = 0;
    let missionCompleteText = '';
    let missionUnlockText = '';
    let seatUpdateText = '';
    let modeUpdateText = '';
    let missionUnlockTargetIdx: number | null = null;
    let recordedZoneState = syncZoneTrainingState(zone, seats, zoneTrainingById[zone.id]);
    const xpMultiplier = resolveXpMultiplier(trainingMode, recordedZoneState);
    if (res.hand.isOver) {
      const heroWon = res.hand.winner === 'hero';
      const heroTied = res.hand.winner === 'tie';
      let seatsAfterHand = seats;
      let nextZoneStateBase: ZoneTrainingState;

      if (trainingMode === 'career') {
        const handStartHeroStack = recordedZoneState.bankroll[HERO_SEAT] ?? 0;
        const bankrollAfter = extractBankrollFromHand(res.hand, seats, recordedZoneState.bankroll);
        let loanDebtAfter = recordedZoneState.loanDebt;
        if (loanDebtAfter > 0) {
          const heroAfter = bankrollAfter[HERO_SEAT] ?? 0;
          const handProfit = Math.max(0, heroAfter - handStartHeroStack);
          const repay = Math.min(loanDebtAfter, Math.floor(handProfit * LOAN_REPAY_RATE));
          if (repay > 0) {
            bankrollAfter[HERO_SEAT] = Math.max(0, heroAfter - repay);
            loanDebtAfter -= repay;
            seatUpdateText += l(appLanguage, `｜自動還款 ${chipsToBb(repay, Math.max(1, res.hand.bigBlind || BIG_BLIND_SIZE))}bb`, `｜自动还款 ${chipsToBb(repay, Math.max(1, res.hand.bigBlind || BIG_BLIND_SIZE))}bb`, ` | Auto repayment ${chipsToBb(repay, Math.max(1, res.hand.bigBlind || BIG_BLIND_SIZE))}bb`);
            if (loanDebtAfter <= 0) {
              seatUpdateText += l(appLanguage, '（已清償）', '（已清偿）', ' (paid off)');
            }
          }
        }

        const bustedAiSeats = seats.filter(
          (seat): seat is Seat & { role: 'ai' } => seat.role === 'ai' && (bankrollAfter[seat.id] ?? STARTING_STACK) <= 0,
        );
        if (bustedAiSeats.length > 0) {
          const bustedIds = new Set(bustedAiSeats.map((seat) => seat.id));
          seatsAfterHand = seats.map((seat) => (
            bustedIds.has(seat.id)
              ? { ...seat, role: 'empty' as const, ai: undefined }
              : seat
          ));
          setSeats(seatsAfterHand);
          setSeatVisual((prev) => {
            const next = { ...prev };
            bustedAiSeats.forEach((seat) => {
              next[seat.id] = {
                cardsDealt: 0,
                inHand: false,
                folded: true,
                lastAction: l(appLanguage, '點擊新增', '点击新增', 'Tap to add'),
              };
            });
            return next;
          });
          const nextAi = seatsAfterHand.find((seat) => seat.role === 'ai');
          if (bustedIds.has(selectedSeatId)) {
            setSelectedSeatId(nextAi?.id ?? HERO_SEAT);
          }
          if (battleSeatId && bustedIds.has(battleSeatId)) {
            setBattleSeatId(nextAi?.id ?? null);
          }
          setPendingReplacementSeatIds((prev) => Array.from(new Set([...prev, ...bustedAiSeats.map((seat) => seat.id)])));
          seatUpdateText += l(appLanguage, `｜${bustedAiSeats.map((seat) => seat.pos).join('、')} 籌碼歸零已離桌，請選擇是否補位。`, `｜${bustedAiSeats.map((seat) => seat.pos).join('、')} 筹码归零已离桌，请选择是否补位。`, ` | ${bustedAiSeats.map((seat) => seat.pos).join(', ')} busted and left. Choose whether to refill seats.`);
        }

        const missionResolution = applyZoneMissionUpdates(recordedZoneState, res.hand, bankrollAfter);
        missionRewardXp = missionResolution.rewardXp;
        if (missionResolution.completedMissionTitles.length > 0) {
          missionCompleteText = l(
            appLanguage,
            `｜任務完成：${missionResolution.completedMissionTitles.map((title) => missionTitle(title, appLanguage)).join('、')}（+${missionRewardXp} XP）`,
            `｜任务完成：${missionResolution.completedMissionTitles.map((title) => missionTitle(title, appLanguage)).join('、')}（+${missionRewardXp} XP）`,
            ` | Mission complete: ${missionResolution.completedMissionTitles.map((title) => missionTitle(title, appLanguage)).join(', ')} (+${missionRewardXp} XP)`,
          );
        }
        nextZoneStateBase = {
          ...missionResolution.nextState,
          loanDebt: loanDebtAfter,
          heroStats: accumulateHeroStats(missionResolution.nextState.heroStats, res.hand),
          handsPlayed: missionResolution.nextState.handsPlayed + 1,
          handsWon: missionResolution.nextState.handsWon + (heroWon ? 1 : 0),
          handsTied: missionResolution.nextState.handsTied + (heroTied ? 1 : 0),
        };
      } else {
        modeUpdateText = l(appLanguage, '｜練習模式：不消耗資金、不推進任務。', '｜练习模式：不消耗资金、不推进任务。', ' | Practice mode: no bankroll cost and no mission progress.');
        nextZoneStateBase = {
          ...recordedZoneState,
          heroStats: accumulateHeroStats(recordedZoneState.heroStats, res.hand),
          handsPlayed: recordedZoneState.handsPlayed + 1,
          handsWon: recordedZoneState.handsWon + (heroWon ? 1 : 0),
          handsTied: recordedZoneState.handsTied + (heroTied ? 1 : 0),
        };
      }

      const nextZoneState = syncZoneTrainingState(zone, seatsAfterHand, nextZoneStateBase);
      if (trainingMode === 'career') {
        const zoneCompletedBefore = zoneMissionsCompleted(recordedZoneState);
        const zoneCompletedAfter = zoneMissionsCompleted(nextZoneState);
        if (zoneCompletedAfter && !zoneCompletedBefore && zoneIndex < trainingZones.length - 1) {
          missionUnlockTargetIdx = zoneIndex + 1;
          const unlockedZoneDef = trainingZones[missionUnlockTargetIdx];
          missionUnlockText = l(
            appLanguage,
            `｜區域通關：${zoneName(unlockedZoneDef, appLanguage)} 已解鎖`,
            `｜区域通关：${zoneName(unlockedZoneDef, appLanguage)} 已解锁`,
            ` | Zone clear: ${zoneName(unlockedZoneDef, appLanguage)} unlocked`,
          );
        }
      }
      setZoneTrainingById((prev) => ({
        ...prev,
        [zone.id]: nextZoneState,
      }));
      recordedZoneState = nextZoneState;
    }
    setHand(res.hand);
    const transitionEvents = buildTransitionEvents(prevHand, res.hand);
    if (transitionEvents.length > 0) {
      const [first, ...rest] = transitionEvents;
      applyTableEvent(first);
      enqueueTableEvents(rest);
    }
    const xpModeText = xpMultiplier < 0.999
      ? l(appLanguage, `｜XP 係數 ${Math.round(xpMultiplier * 100)}%`, `｜XP 系数 ${Math.round(xpMultiplier * 100)}%`, ` | XP factor ${Math.round(xpMultiplier * 100)}%`)
      : '';
    const localizedBestSummary = rt(res.analysis.best.summary, appLanguage, 'Review the recommended action from the model output.');
    setNote(
      `${res.decisionBest
        ? l(appLanguage, `正確：${localizedBestSummary}`, `正确：${localizedBestSummary}`, `Correct: ${localizedBestSummary}`)
        : l(appLanguage, `可優化：${localizedBestSummary}`, `可优化：${localizedBestSummary}`, `Can improve: ${localizedBestSummary}`)}${missionCompleteText}${missionUnlockText}${seatUpdateText}${modeUpdateText}${xpModeText}`,
    );
    let nextProgress = applyDecisionResult(progress, res.decisionBest, res.leakTag);
    if (res.hand.isOver) nextProgress = applyHandResult(nextProgress, res.hand);
    if (missionRewardXp > 0) nextProgress = addXp(nextProgress, missionRewardXp);
    nextProgress = applyXpMultiplier(progress, nextProgress, xpMultiplier);
    if (missionUnlockTargetIdx !== null && missionUnlockTargetIdx > nextProgress.zoneIndex) {
      nextProgress = { ...nextProgress, zoneIndex: missionUnlockTargetIdx };
    }
    nextProgress = {
      ...nextProgress,
      zoneIndex: Math.max(nextProgress.zoneIndex, progress.zoneIndex, unlockedZoneByXp(nextProgress.xp)),
    };
    setProgress(nextProgress);

    if (res.hand.isOver && localDbReady && activeProfile) {
      void saveCompletedHandRecord({
        profileId: activeProfile.id,
        zoneId: zone.id,
        phase,
        hand: res.hand,
        bankrollSnapshot: recordedZoneState.bankroll,
        heroStatsSnapshot: recordedZoneState.heroStats,
        progressSnapshot: nextProgress,
      })
        .then(() => {
          setHandRecordCount((count) => count + 1);
        })
        .catch((err) => {
          console.warn('Save hand record failed', err);
        });
    }
  }

  function verifyLeak() {
    if (selectedSeat.role !== 'ai' || !selectedSeat.ai) {
      setNote(l(appLanguage, '先選 AI 座位', '先选 AI 座位', 'Select an AI seat first.'));
      return;
    }
    if (!leakGuess) {
      setNote(l(appLanguage, '先選你判斷的漏洞', '先选你判断的漏洞', 'Choose your leak guess first.'));
      return;
    }
    const ok = selectedSeat.ai.leakProfile[leakGuess];
    const firstActual = oppLeakKeys.find((k) => selectedSeat.ai?.leakProfile[k]);
    const xpGain = Math.max(1, Math.round((ok ? 24 : 6) * activeXpFactor));
    if (ok) {
      setProgress((p) => addXp(p, xpGain));
      setNote(l(appLanguage, `判斷正確：${oppLeakLabel(leakGuess, appLanguage)}（+${xpGain} XP）`, `判断正确：${oppLeakLabel(leakGuess, appLanguage)}（+${xpGain} XP）`, `Correct: ${oppLeakLabel(leakGuess, appLanguage)} (+${xpGain} XP)`));
    } else {
      setProgress((p) => addXp(p, xpGain));
      setNote(l(appLanguage, `這次不準。提示：${firstActual ? oppLeakLabel(firstActual, appLanguage) : t(appLanguage, 'opponent_few_leaks')}（+${xpGain} XP）`, `这次不准。提示：${firstActual ? oppLeakLabel(firstActual, appLanguage) : t(appLanguage, 'opponent_few_leaks')}（+${xpGain} XP）`, `Not this time. Hint: ${firstActual ? oppLeakLabel(firstActual, appLanguage) : t(appLanguage, 'opponent_few_leaks')} (+${xpGain} XP)`));
    }
  }

  if (rootTab === 'learn') {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar style="light" />
        <LinearGradient colors={['#0a1b2c', '#081d32', '#06261a']} style={styles.bg}>
          <View style={styles.navRoot}>
            <View style={[styles.navContent, { marginLeft: navDrawerOpen ? navExpandedOffset : navCollapsedOffset }]}>
              <LearnScreen
                language={appLanguage}
                zoneName={zoneDisplayName}
                zoneFocus={zoneFocus(zone, appLanguage)}
                onResumePlay={handleResumePlay}
              />
            </View>
            <BottomTabBar
              activeTab={rootTab}
              items={rootTabItems}
              onTabChange={handleRootTabChange}
              open={navDrawerOpen}
              onOpenChange={setNavDrawerOpen}
              drawerWidth={NAV_DRAWER_WIDTH}
              collapsedWidth={NAV_COLLAPSED_WIDTH}
              safeInsetLeft={navSafeInsetLeft}
            />
          </View>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  if (rootTab === 'review') {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar style="light" />
        <LinearGradient colors={['#0a1b2c', '#081d32', '#06261a']} style={styles.bg}>
          <View style={styles.navRoot}>
            <View style={[styles.navContent, { marginLeft: navDrawerOpen ? navExpandedOffset : navCollapsedOffset }]}>
              <ReviewScreen
                language={appLanguage}
                loading={reviewLoading}
                records={reviewRecords}
                selectedRecordId={reviewSelectedId}
                detail={reviewSelectedDetail}
                onSelectRecord={(recordId) => { void handleReviewSelect(recordId); }}
                onRefresh={() => { void loadReviewRecords(reviewSelectedId); }}
                onReplayHand={(recordId) => { void handleReplayFromReview(recordId); }}
                onResumePlay={handleResumePlay}
              />
            </View>
            <BottomTabBar
              activeTab={rootTab}
              items={rootTabItems}
              onTabChange={handleRootTabChange}
              open={navDrawerOpen}
              onOpenChange={setNavDrawerOpen}
              drawerWidth={NAV_DRAWER_WIDTH}
              collapsedWidth={NAV_COLLAPSED_WIDTH}
              safeInsetLeft={navSafeInsetLeft}
            />
          </View>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  if (rootTab === 'profile') {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar style="light" />
        <LinearGradient colors={['#0a1b2c', '#081d32', '#06261a']} style={styles.bg}>
          <View style={styles.navRoot}>
            <View style={[styles.navContent, { marginLeft: navDrawerOpen ? navExpandedOffset : navCollapsedOffset }]}>
              <ProfileScreen
                language={appLanguage}
                profileName={activeProfile?.displayName ?? t(appLanguage, 'guest_mode')}
                appName="POKER GOD"
                xp={progress.xp}
                handsPlayed={progress.handsPlayed}
                handsWon={progress.handsWon}
                recordsCount={handRecordCount}
                currentZoneName={zoneDisplayName}
                topLeakLabel={heroLeakLabel(topLeak, appLanguage)}
                topLeakMission={mission(topLeak, appLanguage)}
                onResumePlay={handleResumePlay}
                onOpenAccountCenter={() => setNote(t(appLanguage, 'note_account_center_reserved'))}
                subscriptionPlanName={l(appLanguage, '本地預覽方案', '本地预览方案', 'Local Preview Plan')}
                subscriptionStatusText={l(appLanguage, '未綁定商店訂閱', '未绑定商店订阅', 'No store subscription linked')}
                subscriptionRenewalText={l(appLanguage, '尚未開通', '尚未开通', 'Not activated yet')}
                onManageSubscription={() => setNote(l(appLanguage, '訂閱入口已預留，後續可接 App Store / Google Play。', '订阅入口已预留，后续可接 App Store / Google Play。', 'Subscription entry reserved. Connect App Store / Google Play later.'))}
                availableLanguages={appLanguages.map((language) => ({
                  key: language,
                  label: appLanguageLabels[language],
                }))}
                sfxEnabled={sfxEnabled}
                aiVoiceAssistEnabled={aiVoiceAssistEnabled}
                politeMode={politeMode}
                onChangeLanguage={(language) => {
                  setAppLanguage(language);
                  setNote(t(language, 'note_language_switched', { language: appLanguageLabels[language] }));
                }}
                onToggleSfx={() => setSfxEnabled((v) => !v)}
                onToggleAiVoiceAssist={() => setAiVoiceAssistEnabled((v) => !v)}
                onTogglePoliteMode={() => setPoliteMode((v) => !v)}
              />
            </View>
            <BottomTabBar
              activeTab={rootTab}
              items={rootTabItems}
              onTabChange={handleRootTabChange}
              open={navDrawerOpen}
              onOpenChange={setNavDrawerOpen}
              drawerWidth={NAV_DRAWER_WIDTH}
              collapsedWidth={NAV_COLLAPSED_WIDTH}
              safeInsetLeft={navSafeInsetLeft}
            />
          </View>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  if (phase === 'lobby') {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar style="light" />
        <LinearGradient colors={['#0a1b2c', '#081d32', '#06261a']} style={styles.bg}>
          <View style={styles.navRoot}>
            <View style={[styles.navContent, { marginLeft: navDrawerOpen ? navExpandedOffset : navCollapsedOffset }]}>
              <View style={[styles.lobbyScreen, compactLobby && styles.lobbyScreenCompact]}>
            <View pointerEvents="none" style={styles.lobbyAuraA} />
            <View pointerEvents="none" style={styles.lobbyAuraB} />

            {!compactLobby ? (
              <View style={styles.lobbyMarquee}>
                <Text style={styles.lobbyMarqueeText} numberOfLines={1}>
                  {t(appLanguage, 'lobby_marquee')}
                </Text>
              </View>
            ) : null}

            <LinearGradient colors={['rgba(16, 67, 89, 0.96)', 'rgba(10, 38, 56, 0.96)']} style={[styles.lobbyHeader, compactLobby && styles.lobbyHeaderCompact]}>
              <View style={styles.brandBlock}>
                <Text style={styles.brandText}>POKER GOD</Text>
                <Text style={[styles.h1, compactLobby && styles.h1Compact]}>{t(appLanguage, 'lobby_title')}</Text>
                <Text style={[styles.sub, compactLobby && styles.subCompact]} numberOfLines={1}>{t(appLanguage, 'lobby_subtitle')}</Text>
              </View>
              <View style={[styles.lobbyHeaderStats, styles.lobbyHeaderStatsWithGear]}>
                <View style={styles.lobbyHeaderStat}>
                  <Text style={styles.lobbyHeaderStatLabel}>XP</Text>
                  <Text style={styles.lobbyHeaderStatValue}>{progress.xp}</Text>
                </View>
                <View style={styles.lobbyHeaderStat}>
                  <Text style={styles.lobbyHeaderStatLabel}>{t(appLanguage, 'lobby_stat_unlocked')}</Text>
                  <Text style={styles.lobbyHeaderStatValue}>{unlockedZoneName}</Text>
                </View>
                <View style={styles.lobbyHeaderStat}>
                  <Text style={styles.lobbyHeaderStatLabel}>{t(appLanguage, 'lobby_stat_hands')}</Text>
                  <Text style={styles.lobbyHeaderStatValue}>{lobbyZoneStats.handsPlayed}</Text>
                </View>
                <View style={styles.lobbyHeaderStat}>
                  <Text style={styles.lobbyHeaderStatLabel}>{t(appLanguage, 'lobby_stat_record')}</Text>
                  <Text style={styles.lobbyHeaderStatValue}>{lobbyZoneRecord}</Text>
                </View>
                <View style={styles.lobbyHeaderStat}>
                  <Text style={styles.lobbyHeaderStatLabel}>{t(appLanguage, 'lobby_stat_win_rate')}</Text>
                  <Text style={styles.lobbyHeaderStatValue}>{lobbyZoneWinRate}%</Text>
                </View>
              </View>
              <TouchableOpacity
                style={[styles.lobbyHeaderGearBtn, compactLobby && styles.lobbyHeaderGearBtnCompact, lobbySettingsOpen && styles.lobbyHeaderGearBtnOn]}
                onPress={() => setLobbySettingsOpen((prev) => !prev)}
              >
                <Text style={styles.lobbyHeaderGearIcon}>⚙</Text>
              </TouchableOpacity>
            </LinearGradient>

            <View style={[styles.lobbyBody, compactLobby && styles.lobbyBodyCompact]}>
              <LinearGradient colors={['rgba(10, 35, 50, 0.96)', 'rgba(7, 23, 34, 0.96)']} style={styles.lobbyRoomsPanel}>
                <View style={styles.lobbyRoomsHead}>
                  <Text style={styles.lobbyRoomsTitle}>{t(appLanguage, 'lobby_rooms_title')}</Text>
                  <Text style={styles.textMuted}>{t(appLanguage, 'lobby_rooms_count', { count: trainingZones.length })}</Text>
                </View>

                <View style={[styles.lobbyRoomGrid, compactLobby && styles.lobbyRoomGridCompact]}>
                  {trainingZones.map((z, i) => {
                    const locked = i > unlockedIdx;
                    const selected = i === lobbyZone;
                    const zoneState = syncZoneTrainingState(z, seats, zoneTrainingById[z.id]);
                    const zoneMissionDone = zoneState.missions.filter((missionItem) => missionItem.completed).length;
                    const zoneStack = zoneState.bankroll[HERO_SEAT] ?? STARTING_STACK;
                    const zoneBb = Math.floor(zoneStack / BIG_BLIND_SIZE);
                    const zoneLockHint = zoneUnlockHint(i, progress, appLanguage);
                    const zoneLabel = zoneName(z, appLanguage);
                    const zoneSubLabel = zoneSubtitle(z, appLanguage);
                    const tableCount = 2 + ((i + progress.handsPlayed) % 5);
                    const tableTraffic = 20 + (((i + 1) * 17 + progress.handsPlayed * 3 + progress.xp) % 61);
                    const zoneAvgSkill = Math.round(
                      z.aiPool.reduce((sum, ai) => sum + ai.skill, 0) / Math.max(1, z.aiPool.length),
                    );
                    const roomColors: [string, string] = locked
                      ? ['#1e2833', '#151d26']
                      : selected
                        ? ['#1a6654', '#12453e']
                        : i % 2 === 0
                          ? ['#15374c', '#102737']
                          : ['#1b3146', '#122334'];
                    return (
                      <TouchableOpacity
                        key={z.id}
                        style={[styles.lobbyRoomTouch, compactLobby && styles.lobbyRoomTouchCompact, locked && styles.lobbyRoomLocked]}
                        onPress={() => {
                          if (locked) {
                            setNote(t(appLanguage, 'lobby_locked_note', { zone: zoneLabel, hint: zoneLockHint }));
                            return;
                          }
                          setLobbyZone(i);
                        }}
                      >
                        <LinearGradient colors={roomColors} style={[styles.lobbyRoomCard, compactLobby && styles.lobbyRoomCardCompact, selected && styles.lobbyRoomCardOn]}>
                          <View style={styles.lobbyRoomCardHead}>
                            <Text style={[styles.lobbyRoomTitle, compactLobby && styles.lobbyRoomTitleCompact]} numberOfLines={1}>{zoneLabel}</Text>
                            <Text
                              style={[
                                styles.lobbyDoorChip,
                                locked ? styles.lobbyDoorChipLocked : selected ? styles.lobbyDoorChipLive : styles.lobbyDoorChipOpen,
                              ]}
                            >
                              {locked ? t(appLanguage, 'room_state_lock') : selected ? t(appLanguage, 'room_state_live') : t(appLanguage, 'room_state_open')}
                            </Text>
                          </View>
                          <Text style={[styles.lobbyRoomSub, compactLobby && styles.lobbyRoomSubCompact]} numberOfLines={1}>{zoneSubLabel}</Text>
                          <View style={styles.lobbyRoomMetaRow}>
                            <Text style={[styles.lobbyRoomMeta, compactLobby && styles.lobbyRoomMetaCompact]}>{t(appLanguage, 'lobby_room_table', { count: tableCount })}</Text>
                            <Text style={[styles.lobbyRoomMeta, compactLobby && styles.lobbyRoomMetaCompact]}>{t(appLanguage, 'lobby_room_online', { count: tableTraffic })}</Text>
                            <Text style={[styles.lobbyRoomMeta, compactLobby && styles.lobbyRoomMetaCompact]}>Skill {zoneAvgSkill}</Text>
                          </View>
                          <Text style={[styles.lobbyRoomTail, compactLobby && styles.lobbyRoomTailCompact, locked && styles.lobbyRoomTailLocked]} numberOfLines={1}>
                            {locked
                              ? zoneLockHint
                              : t(appLanguage, 'lobby_room_tail', {
                                  bb: zoneBb,
                                  done: zoneMissionDone,
                                  total: zoneState.missions.length,
                                })}
                          </Text>
                        </LinearGradient>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </LinearGradient>

              <LinearGradient
                colors={['rgba(13, 54, 51, 0.98)', 'rgba(8, 26, 35, 0.98)']}
                style={[styles.lobbyControlPanel, compactLobby && styles.lobbyControlPanelCompact]}
              >
                <View style={[styles.lobbyControlContent, compactLobby && styles.lobbyControlContentCompact]}>
                  <View style={[styles.lobbyControlTop, compactLobby && styles.lobbyControlTopCompact]}>
                    <View style={[styles.lobbyControlTitleRow, compactLobby && styles.lobbyControlTitleRowCompact]}>
                      <View>
                        <Text style={[styles.lobbyControlTitle, compactLobby && styles.lobbyControlTitleCompact]}>{lobbyZoneName}</Text>
                        <Text style={[styles.lobbyControlSub, compactLobby && styles.lobbyControlSubCompact]} numberOfLines={compactLobby ? 1 : 2}>
                          {lobbyZoneSub}
                        </Text>
                      </View>
                      <Text style={[styles.lobbyDoorChip, lobbyZoneLocked ? styles.lobbyDoorChipLocked : styles.lobbyDoorChipLive]}>
                        {lobbyZoneLocked ? t(appLanguage, 'lobby_panel_locked') : t(appLanguage, 'lobby_panel_ready')}
                      </Text>
                    </View>

                    <View style={[styles.lobbyModeRow, compactLobby && styles.lobbyModeRowCompact]}>
                      <TouchableOpacity
                        style={[styles.lobbyModeBtn, compactLobby && styles.lobbyModeBtnCompact, trainingMode === 'career' && styles.lobbyModeBtnOn]}
                        onPress={() => setTrainingMode('career')}
                      >
                        <Text style={[styles.lobbyModeBtnText, compactLobby && styles.lobbyModeBtnTextCompact, trainingMode === 'career' && styles.lobbyModeBtnTextOn]}>
                          {t(appLanguage, 'mode_career')}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.lobbyModeBtn, compactLobby && styles.lobbyModeBtnCompact, trainingMode === 'practice' && styles.lobbyModeBtnOn]}
                        onPress={() => setTrainingMode('practice')}
                      >
                        <Text style={[styles.lobbyModeBtnText, compactLobby && styles.lobbyModeBtnTextCompact, trainingMode === 'practice' && styles.lobbyModeBtnTextOn]}>
                          {t(appLanguage, 'mode_practice')}
                        </Text>
                      </TouchableOpacity>
                    </View>

                    <Text style={[styles.lobbyModeHint, compactLobby && styles.lobbyModeHintCompact]} numberOfLines={1}>
                      {trainingMode === 'practice'
                        ? t(appLanguage, 'mode_hint_practice', { xp: Math.round(PRACTICE_XP_MULTIPLIER * 100) })
                        : t(appLanguage, 'mode_hint_career', { xp: Math.round(zoneCareerXpFactor * 100) })}
                    </Text>

                    <View style={[styles.lobbyFocusList, compactLobby && styles.lobbyFocusListCompact]}>
                      {lobbyZoneFocus.slice(0, compactLobby ? 1 : 3).map((focus, idx) => (
                        <Text key={`${lobbyZoneDef.id}-focus-${focus}`} style={[styles.lobbyFocusLine, compactLobby && styles.lobbyFocusLineCompact]} numberOfLines={1}>
                          {idx + 1}. {focus}
                        </Text>
                      ))}
                    </View>
                  </View>

                  <View style={[styles.lobbyControlMetaGrid, compactLobby && styles.lobbyControlMetaGridCompact]}>
                    <View style={[styles.lobbyControlMetaCard, compactLobby && styles.lobbyControlMetaCardCompact]}>
                      <Text style={[styles.lobbyControlMetaLabel, compactLobby && styles.lobbyControlMetaLabelCompact]}>{t(appLanguage, 'meta_zone_bankroll')}</Text>
                      <Text style={[styles.lobbyControlMetaValue, compactLobby && styles.lobbyControlMetaValueCompact]}>{lobbyZoneBb}bb</Text>
                    </View>
                    <View style={[styles.lobbyControlMetaCard, compactLobby && styles.lobbyControlMetaCardCompact]}>
                      <Text style={[styles.lobbyControlMetaLabel, compactLobby && styles.lobbyControlMetaLabelCompact]}>{t(appLanguage, 'meta_profit')}</Text>
                      <Text style={[styles.lobbyControlMetaValue, compactLobby && styles.lobbyControlMetaValueCompact]}>{lobbyZoneProfitBb >= 0 ? '+' : ''}{lobbyZoneProfitBb}bb</Text>
                    </View>
                    <View style={[styles.lobbyControlMetaCard, compactLobby && styles.lobbyControlMetaCardCompact]}>
                      <Text style={[styles.lobbyControlMetaLabel, compactLobby && styles.lobbyControlMetaLabelCompact]}>{t(appLanguage, 'meta_missions')}</Text>
                      <Text style={[styles.lobbyControlMetaValue, compactLobby && styles.lobbyControlMetaValueCompact]}>{lobbyZoneMissionDone}/{lobbyZoneState.missions.length}</Text>
                    </View>
                    <View style={[styles.lobbyControlMetaCard, compactLobby && styles.lobbyControlMetaCardCompact]}>
                      <Text style={[styles.lobbyControlMetaLabel, compactLobby && styles.lobbyControlMetaLabelCompact]}>{t(appLanguage, 'meta_opponents')}</Text>
                      <Text style={[styles.lobbyControlMetaValue, compactLobby && styles.lobbyControlMetaValueCompact]} numberOfLines={1}>
                        Skill {lobbyAvgSkill} · {lobbyArchetypes}
                      </Text>
                    </View>
                  </View>

                  <View style={[styles.lobbyControlBottom, compactLobby && styles.lobbyControlBottomCompact]}>
                    <TouchableOpacity
                      style={[styles.primary, lobbyZoneLocked && styles.dim]}
                      disabled={lobbyZoneLocked}
                      onPress={() => enterTable(lobbyZone)}
                    >
                      <LinearGradient
                        colors={lobbyZoneLocked ? ['#305069', '#26445b'] : ['#2ad88f', '#1d8f67']}
                        style={[styles.primaryGrad, compactLobby && styles.primaryGradCompact]}
                      >
                        <Text style={[styles.primaryText, compactLobby && styles.primaryTextCompact]}>
                          {lobbyZoneLocked
                            ? lobbyUnlockHint
                            : t(appLanguage, 'enter_table', {
                                zone: lobbyZoneName,
                                mode: trainingMode === 'practice' ? t(appLanguage, 'mode_short_practice') : t(appLanguage, 'mode_short_career'),
                              })}
                        </Text>
                      </LinearGradient>
                    </TouchableOpacity>

                    {!compactLobby ? (
                      <Text style={styles.lobbyControlNote} numberOfLines={2}>{note}</Text>
                    ) : null}
                  </View>
                </View>
              </LinearGradient>
            </View>

            {lobbySettingsOpen ? (
              <View style={styles.lobbySettingsOverlay}>
                <TouchableOpacity style={styles.lobbySettingsBackdrop} activeOpacity={1} onPress={() => setLobbySettingsOpen(false)} />

                <LinearGradient colors={['rgba(13, 50, 62, 0.98)', 'rgba(8, 27, 38, 0.98)']} style={styles.lobbySettingsPanel}>
                  <View style={styles.lobbySettingsHead}>
                    <View>
                      <Text style={styles.lobbySettingsTitle}>{t(appLanguage, 'settings_title')}</Text>
                      <Text style={styles.textTiny}>{t(appLanguage, 'settings_subtitle')}</Text>
                    </View>
                    <TouchableOpacity style={styles.iconBtn} onPress={() => setLobbySettingsOpen(false)}>
                      <Text style={styles.iconBtnText}>{t(appLanguage, 'close')}</Text>
                    </TouchableOpacity>
                  </View>

                  <ScrollView style={styles.lobbySettingsScroll} contentContainerStyle={styles.lobbySettingsScrollContent} showsVerticalScrollIndicator={false}>
                    <View style={styles.lobbySettingCard}>
                      <Text style={styles.lobbySettingTitle}>{t(appLanguage, 'settings_account')}</Text>
                      <Text style={styles.textMuted}>{t(appLanguage, 'settings_identity', { name: activeProfile?.displayName ?? t(appLanguage, 'guest_mode') })}</Text>
                      <Text style={styles.textTiny}>{t(appLanguage, 'settings_account_desc')}</Text>
                      <TouchableOpacity style={styles.secondary} onPress={() => setNote(t(appLanguage, 'note_account_center_reserved'))}>
                        <Text style={styles.secondaryText}>{t(appLanguage, 'settings_account_center')}</Text>
                      </TouchableOpacity>
                    </View>

                    <View style={styles.lobbySettingCard}>
                      <Text style={styles.lobbySettingTitle}>{t(appLanguage, 'settings_language')}</Text>
                      <Text style={styles.textMuted}>{t(appLanguage, 'settings_current_language', { language: appLanguageLabel })}</Text>
                      <View style={styles.chips}>
                        {appLanguages.map((language) => (
                          <TouchableOpacity
                            key={language}
                            style={[styles.chip, appLanguage === language && styles.chipOn]}
                            onPress={() => {
                              setAppLanguage(language);
                              setNote(t(language, 'note_language_switched', { language: appLanguageLabels[language] }));
                            }}
                          >
                            <Text style={styles.chipText}>{appLanguageLabels[language]}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>

                    <View style={styles.lobbySettingCard}>
                      <Text style={styles.lobbySettingTitle}>{t(appLanguage, 'settings_defaults')}</Text>
                      <View style={styles.lobbySettingRow}>
                        <View style={styles.lobbySettingRowCopy}>
                          <Text style={styles.lobbySettingRowTitle}>{t(appLanguage, 'settings_sfx_title')}</Text>
                          <Text style={styles.lobbySettingRowSub}>{t(appLanguage, 'settings_sfx_sub')}</Text>
                        </View>
                        <TouchableOpacity style={[styles.lobbySettingSwitch, sfxEnabled && styles.lobbySettingSwitchOn]} onPress={() => setSfxEnabled((v) => !v)}>
                          <Text style={styles.lobbySettingSwitchText}>{sfxEnabled ? t(appLanguage, 'toggle_on') : t(appLanguage, 'toggle_off')}</Text>
                        </TouchableOpacity>
                      </View>
                      <View style={styles.lobbySettingRow}>
                        <View style={styles.lobbySettingRowCopy}>
                          <Text style={styles.lobbySettingRowTitle}>{t(appLanguage, 'settings_ai_voice_title')}</Text>
                          <Text style={styles.lobbySettingRowSub}>{t(appLanguage, 'settings_ai_voice_sub')}</Text>
                        </View>
                        <TouchableOpacity style={[styles.lobbySettingSwitch, aiVoiceAssistEnabled && styles.lobbySettingSwitchOn]} onPress={() => setAiVoiceAssistEnabled((v) => !v)}>
                          <Text style={styles.lobbySettingSwitchText}>{aiVoiceAssistEnabled ? t(appLanguage, 'toggle_on') : t(appLanguage, 'toggle_off')}</Text>
                        </TouchableOpacity>
                      </View>
                      <View style={styles.lobbySettingRow}>
                        <View style={styles.lobbySettingRowCopy}>
                          <Text style={styles.lobbySettingRowTitle}>{t(appLanguage, 'settings_polite_title')}</Text>
                          <Text style={styles.lobbySettingRowSub}>{t(appLanguage, 'settings_polite_sub')}</Text>
                        </View>
                        <TouchableOpacity style={[styles.lobbySettingSwitch, politeMode && styles.lobbySettingSwitchOn]} onPress={() => setPoliteMode((v) => !v)}>
                          <Text style={styles.lobbySettingSwitchText}>{politeMode ? t(appLanguage, 'toggle_on') : t(appLanguage, 'toggle_off')}</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </ScrollView>
                </LinearGradient>
              </View>
            ) : null}
              </View>
            </View>
            <BottomTabBar
              activeTab={rootTab}
              items={rootTabItems}
              onTabChange={handleRootTabChange}
              open={navDrawerOpen}
              onOpenChange={setNavDrawerOpen}
              drawerWidth={NAV_DRAWER_WIDTH}
              collapsedWidth={NAV_COLLAPSED_WIDTH}
              safeInsetLeft={navSafeInsetLeft}
            />
          </View>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      <LinearGradient colors={['#0a1b2c', '#081b2d', '#062215']} style={styles.bg}>
        <View style={styles.navRoot}>
          <View style={[styles.navContent, { marginLeft: navDrawerOpen ? navExpandedOffset : navCollapsedOffset }]}>
            <View style={styles.tableScreen} onLayout={handleTableScreenLayout}>
          <View style={styles.topRow}>
            <View style={styles.brandBlockMini}>
              <Text style={styles.brandText}>POKER GOD</Text>
              <Text style={styles.sub} numberOfLines={1}>
                {zoneDisplayName} · {battleSeat?.ai?.name ?? t(appLanguage, 'opponent_not_assigned')} · {t(appLanguage, 'table_line_mode_stack', {
                  mode: trainingMode === 'practice' ? t(appLanguage, 'mode_short_practice') : t(appLanguage, 'mode_short_career'),
                  stack: headerHeroStack,
                  bb: headerHeroBb,
                })}
              </Text>
              <Text style={styles.sub} numberOfLines={1}>
                {l(appLanguage, `${hand.position.situationLabel} · 盲注 ${hand.smallBlind}/${hand.bigBlind} · 按鈕 ${hand.buttonPosition} · XP ${Math.round(activeXpFactor * 100)}%`, `${hand.position.situationLabel} · 盲注 ${hand.smallBlind}/${hand.bigBlind} · 按钮 ${hand.buttonPosition} · XP ${Math.round(activeXpFactor * 100)}%`, `${hand.position.situationLabel} · Blinds ${hand.smallBlind}/${hand.bigBlind} · Button ${hand.buttonPosition} · XP ${Math.round(activeXpFactor * 100)}%`)}
              </Text>
            </View>
            <View style={styles.topActions}>
              <TouchableOpacity
                style={styles.iconBtn}
                onPress={() => {
                  setAnalysisOpen(false);
                  setOpsOpen(false);
                  setMissionOpen(false);
                  setPhase('lobby');
                }}
              >
                <Text style={styles.iconBtnText}>{t(appLanguage, 'button_select_game')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.iconBtn}
                onPress={() => {
                  setAnalysisOpen(false);
                  setMissionOpen(false);
                  setOpsOpen((v) => !v);
                }}
              >
                <Text style={styles.iconEmoji}>📊</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.iconBtn}
                onPress={() => {
                  setOpsOpen(false);
                  setMissionOpen(false);
                  setAnalysisOpen((v) => !v);
                }}
              >
                <Text style={styles.iconEmoji}>💡</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.iconBtn}
                onPress={() => {
                  setOpsOpen(false);
                  setAnalysisOpen(false);
                  setMissionOpen((v) => !v);
                }}
              >
                <Text style={styles.iconEmoji}>📘</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.iconBtn}
                onPress={() => {
                  const next = !sfxEnabled;
                  setSfxEnabled(next);
                  if (next && sfxReady) {
                    const preview = soundsRef.current.ui[0];
                    if (preview) {
                      void preview.replayAsync().catch((err) => {
                        console.warn('SFX preview failed: ui', err);
                      });
                    }
                  }
                }}
              >
                <Text style={styles.iconBtnText}>
                  {sfxLoadError
                    ? l(appLanguage, '音效錯誤', '音效错误', 'SFX Error')
                    : sfxEnabled
                      ? (sfxReady ? l(appLanguage, '音效開', '音效开', 'SFX On') : l(appLanguage, '音效載入', '音效载入', 'SFX Loading'))
                      : l(appLanguage, '音效關', '音效关', 'SFX Off')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.iconBtn}
                onPress={() => {
                  const next = !aiVoiceAssistEnabled;
                  setAiVoiceAssistEnabled(next);
                  if (!next) {
                    aiCoachSpotRef.current = '';
                    if (aiCoachAbortRef.current) {
                      aiCoachAbortRef.current.abort();
                      aiCoachAbortRef.current = null;
                    }
                    stopAiCoachAudioPlayback();
                    setAiVoiceBusy(false);
                    setNote(l(appLanguage, 'AI 輔助打牌語音已關閉。', 'AI 辅助打牌语音已关闭。', 'AI voice gameplay assist is off.'));
                  } else {
                    setNote(l(appLanguage, 'AI 輔助打牌語音已開啟，輪到你時會自動播報最佳建議。', 'AI 辅助打牌语音已开启，轮到你时会自动播报最佳建议。', 'AI voice gameplay assist is on. It will auto-speak on your turn.'));
                  }
                }}
              >
                <Text style={styles.iconBtnText}>
                  {aiVoiceAssistEnabled
                    ? (aiVoiceBusy ? l(appLanguage, 'AI語音中', 'AI语音中', 'AI Voice Running') : l(appLanguage, 'AI語音開', 'AI语音开', 'AI Voice On'))
                    : l(appLanguage, 'AI語音關', 'AI语音关', 'AI Voice Off')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.tableCore}>
            <View style={styles.tableShell}>
              <LinearGradient colors={['#392814', '#281d0f']} style={styles.tableRail}>
                <LinearGradient colors={['#11483d', '#0c3a33', '#0b302a']} style={styles.tableFelt}>
                  <View style={styles.feltGlowA} />
                  <View style={styles.feltGlowB} />

                  <View style={styles.centerBoardWrap}>
                    <Text style={styles.centerLabel}>POT {hand.pot}</Text>
                    <Text style={styles.centerSub}>
                      {hasPendingEvent
                        ? l(appLanguage, `動作回放中（剩 ${eventQueue.length}）`, `动作回放中（剩 ${eventQueue.length}）`, `Replaying actions (${eventQueue.length} left)`)
                        : `Street ${hand.street.toUpperCase()} · To Call ${hand.toCall}`}
                    </Text>
                    <Text style={styles.centerSub}>{hand.position.preflopOrderHint}</Text>
                    <Text style={styles.centerSub}>
                      {hasPendingEvent
                        ? l(appLanguage, `播放：${tableFeed[0] ?? '等待事件'}`, `播放：${tableFeed[0] ?? '等待事件'}`, `Now: ${tableFeed[0] ?? 'Waiting events'}`)
                        : `Action: ${hand.players.find((p) => p.id === hand.actingPlayerId)?.name ?? l(appLanguage, '等待下一街', '等待下一街', 'Waiting next street')}`}
                    </Text>
                    <Animated.View
                      pointerEvents="none"
                      style={[
                        styles.chipPulse,
                        {
                          opacity: chipPulse.interpolate({ inputRange: [0, 1], outputRange: [0, 0.9] }),
                          transform: [
                            { scale: chipPulse.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.25] }) },
                            { translateY: chipPulse.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) },
                          ],
                        },
                      ]}
                    >
                      <Text style={styles.chipPulseText}>◎</Text>
                    </Animated.View>
                    <View style={styles.boardRow}>
                      {visibleBoard.map((c) => (
                        <CardView key={c.code} card={c} compact />
                      ))}
                      {Array.from({ length: holes }).map((_, i) => (
                        <CardView key={`hole-${i}`} hidden compact />
                      ))}
                    </View>
                  </View>

                  {seatLayout.map((layout) => {
                    const seat = seats.find((s) => s.id === layout.id);
                    if (!seat || seat.role === 'empty') return null;
                    const visual = seatVisual[seat.id];
                    const dealt = visual?.cardsDealt ?? 0;
                    if (dealt <= 0) return null;

                    const isHero = seat.role === 'hero';
                    const player = hand.players.find((p) => p.id === seat.id);
                    const reachedShowdown = !!player && player.inHand && !player.folded;
                    const showFace = isHero || (hand.isOver && reachedShowdown);
                    const sourceCards = player?.cards;
                    const isPulseSeat = activeSeatAnimId === seat.id;

                    return (
                      <Animated.View
                        key={`cards-${seat.id}`}
                        style={[
                          styles.seatCards,
                          styles.seatCardsOffset,
                          { left: layout.seatLeft, top: layout.seatTop },
                          isPulseSeat
                            ? {
                                transform: [{ scale: seatPulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.14] }) }],
                              }
                            : undefined,
                        ]}
                      >
                        {dealt >= 1 ? <CardView card={sourceCards?.[0]} hidden={!showFace} compact /> : null}
                        {dealt >= 2 ? <CardView card={sourceCards?.[1]} hidden={!showFace} compact /> : null}
                      </Animated.View>
                    );
                  })}

                  {seatLayout.map((layout) => {
                    const seat = seats.find((s) => s.id === layout.id);
                    if (!seat) return null;
                    const isSelected = seat.id === selectedSeatId;
                    const isBattle = seat.id === battleSeatId;
                    const visual = seatVisual[seat.id];
                    const displayPos = positionRelativeToButton(seat.pos, hand.buttonPosition);
                    const isButton = displayPos === 'BTN';

                    return (
                      <TouchableOpacity
                        key={layout.id}
                        onPress={() => handleSeatTap(seat)}
                        style={[
                          styles.seatBadge,
                          { left: layout.seatLeft, top: layout.seatTop },
                          isSelected && styles.seatBadgeOn,
                          isBattle && styles.seatBadgeBattle,
                          seat.role === 'empty' && styles.seatBadgeEmpty,
                          visual?.folded && styles.seatBadgeFolded,
                        ]}
                      >
                        <View style={styles.avatarDot} />
                        <Text style={styles.seatPos}>{displayPos}{isButton ? ' (D)' : ''}</Text>
                        <Text style={styles.seatName}>{shortName(seatName(seat, appLanguage))}</Text>
                        <Text style={styles.seatStack}>{stackText(seat)}</Text>
                        <Text style={styles.seatActionText}>{visual?.lastAction ?? l(appLanguage, '等待', '等待', 'Waiting')}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </LinearGradient>
              </LinearGradient>
            </View>

            <View style={styles.actionDock}>
              <View style={styles.actionDockTop}>
                <Text style={styles.text}>
                  {hasPendingEvent
                    ? autoPlayEvents
                      ? l(appLanguage, `桌上動作播放中（剩 ${eventQueue.length}）`, `桌上动作播放中（剩 ${eventQueue.length}）`, `Table replaying (${eventQueue.length} left)`)
                      : l(appLanguage, `已暫停播放（剩 ${eventQueue.length}）`, `已暂停播放（剩 ${eventQueue.length}）`, `Replay paused (${eventQueue.length} left)`)
                    : hand.isOver
                      ? rt(hand.resultText || '', appLanguage, 'Hand complete.')
                      : canHeroActNow
                        ? l(appLanguage, '輪到你決策', '轮到你决策', 'Your decision')
                        : l(appLanguage, '等待牌局推演', '等待牌局推演', 'Waiting hand simulation')}
                </Text>
                <Text style={styles.textTiny} numberOfLines={2}>
                  {aiVoiceAssistEnabled
                    ? aiVoiceBusy
                      ? l(appLanguage, 'AI 語音助手分析中...', 'AI 语音助手分析中...', 'AI voice assistant is analyzing...')
                      : aiVoiceLastAdvice
                        ? l(appLanguage, `AI 語音助手：${rt(aiVoiceLastAdvice, appLanguage, 'Voice suggestion available.')}`, `AI 语音助手：${rt(aiVoiceLastAdvice, appLanguage, 'Voice suggestion available.')}`, `AI voice assistant: ${rt(aiVoiceLastAdvice, appLanguage, 'Voice suggestion available.')}`)
                        : l(appLanguage, 'AI 語音助手待命中（輪到你時自動播報）', 'AI 语音助手待命中（轮到你时自动播报）', 'AI voice assistant standing by (auto on your turn)')
                    : l(appLanguage, 'AI 語音助手已關閉', 'AI 语音助手已关闭', 'AI voice assistant is off')}
                </Text>

                <View style={styles.actionSummaryCard}>
                  <Text style={styles.actionSummaryTitle}>{l(appLanguage, '最近動作', '最近动作', 'Recent Actions')}</Text>
                  <ScrollView
                    style={styles.actionSummaryScroll}
                    contentContainerStyle={styles.actionSummaryScrollContent}
                    showsVerticalScrollIndicator
                    nestedScrollEnabled
                  >
                    {recentActionLines.length > 0 ? (
                      recentActionLines.map((line, i) => (
                        <Text key={`dock-action-${line}-${i}`} numberOfLines={1} style={styles.actionSummaryLine}>
                          {line}
                        </Text>
                      ))
                    ) : (
                      <Text style={styles.actionSummaryEmpty}>{l(appLanguage, '尚未有動作，等待開局。', '尚未有动作，等待开局。', 'No actions yet. Start a hand.')}</Text>
                    )}
                  </ScrollView>
                </View>
              </View>

              <View style={styles.actionDockBottom}>
                {hand.isOver && pendingReplacementSeatIds.length > 0 ? (
                  <View style={styles.noteCard}>
                    <Text style={styles.textTiny}>{l(appLanguage, `有 ${pendingReplacementSeatIds.length} 位 AI 籌碼歸零離桌，要補進新玩家嗎？`, `有 ${pendingReplacementSeatIds.length} 位 AI 筹码归零离桌，要补进新玩家吗？`, `${pendingReplacementSeatIds.length} AI players busted and left. Refill with new players?`)}</Text>
                    <View style={styles.row3}>
                      <TouchableOpacity style={styles.secondary} onPress={addPendingReplacementPlayers}>
                        <Text style={styles.secondaryText}>{l(appLanguage, '補進新玩家', '补进新玩家', 'Refill Players')}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.secondary} onPress={skipPendingReplacementPlayers}>
                        <Text style={styles.secondaryText}>{l(appLanguage, '先不要', '先不要', 'Not Now')}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : null}

                <View style={styles.row3}>
                  <TouchableOpacity style={styles.secondary} onPress={() => setAutoPlayEvents((v) => !v)}>
                    <Text style={styles.secondaryText}>{autoPlayEvents ? l(appLanguage, '暫停播牌', '暂停播牌', 'Pause Replay') : l(appLanguage, '播放牌局', '播放牌局', 'Play Replay')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.secondary, (!hasPendingEvent || autoPlayEvents) && styles.dim]} disabled={!hasPendingEvent || autoPlayEvents} onPress={runNextEvent}>
                    <Text style={styles.secondaryText}>{hasPendingEvent ? l(appLanguage, `單步 ${eventQueue.length}`, `单步 ${eventQueue.length}`, `Step ${eventQueue.length}`) : l(appLanguage, '單步', '单步', 'Step')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.secondary} onPress={() => startHand(battleSeatId ?? selectedSeatId)}>
                    <Text style={styles.secondaryText}>{hand.isOver ? l(appLanguage, '下一手', '下一手', 'Next Hand') : l(appLanguage, '重新開局', '重新开局', 'Restart Hand')}</Text>
                  </TouchableOpacity>
                </View>

                {!hand.isOver ? (
                    <>
                    <View style={styles.raiseRow}>
                      <Text style={styles.raiseValue}>{l(appLanguage, '加注額', '加注额', 'Raise')} {isAllInRaise ? 'All-in' : raiseAmount}</Text>
                      <View
                        style={[styles.raiseSliderTrack, (!canRaise || !canHeroActNow) && styles.raiseSliderTrackDisabled]}
                        onLayout={handleRaiseSliderLayout}
                        onStartShouldSetResponder={() => canRaise && canHeroActNow}
                        onMoveShouldSetResponder={() => canRaise && canHeroActNow}
                        onResponderGrant={handleRaiseSliderGesture}
                        onResponderMove={handleRaiseSliderGesture}
                      >
                        <LinearGradient
                          colors={isAllInRaise ? ['#b16a1a', '#d6a344'] : ['#1d6687', '#3ca2c9']}
                          start={{ x: 0, y: 0.5 }}
                          end={{ x: 1, y: 0.5 }}
                          style={[styles.raiseSliderFill, { width: raiseSliderPercent }]}
                        />
                        <View style={[styles.raiseSliderThumb, { left: raiseSliderPercent }, isAllInRaise && styles.raiseSliderThumbAllIn]} />
                      </View>
                      <View style={styles.raiseMetaRow}>
                        <Text style={styles.raiseMetaText}>{l(appLanguage, '最小', '最小', 'Min')} {minRaise}</Text>
                        <Text style={[styles.raiseMetaText, isAllInRaise && styles.raiseMetaTextHot]}>All-in {raiseCap}</Text>
                      </View>
                    </View>

                    <View style={styles.row3}>
                      <TouchableOpacity style={[styles.actionDanger, !canHeroActNow && styles.dim]} disabled={!canHeroActNow} onPress={() => doAction('fold')}>
                        <Text style={styles.actionText}>{l(appLanguage, '棄牌', '弃牌', 'Fold')}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.actionMain, !canHeroActNow && styles.dim]} disabled={!canHeroActNow} onPress={() => doAction(callOrCheck)}>
                        <Text style={styles.actionText}>{callOrCheck === 'call' ? l(appLanguage, `跟注 ${hand.toCall}`, `跟注 ${hand.toCall}`, `Call ${hand.toCall}`) : l(appLanguage, '過牌', '过牌', 'Check')}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.actionGold, (!canRaise || !canHeroActNow) && styles.dim]} disabled={!canRaise || !canHeroActNow} onPress={() => doAction('raise')}>
                        <Text style={styles.actionText}>{l(appLanguage, '加注', '加注', 'Raise')} {isAllInRaise ? 'All-in' : raiseAmount}</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                ) : null}
              </View>
            </View>
          </View>
        </View>

        {bankruptcyPromptOpen ? (
          <View pointerEvents="auto" style={styles.bankruptcyOverlay}>
            <ScrollView style={styles.bankruptcyScroll} contentContainerStyle={styles.bankruptcyScrollContent} showsVerticalScrollIndicator={false}>
              <View style={styles.bankruptcyCard}>
                <Text style={styles.bankruptcyTitle}>{l(appLanguage, '資金歸零', '资金归零', 'Bankroll Depleted')}</Text>
                <Text style={styles.bankruptcyText}>{bankruptcyPromptText}</Text>
                <Text style={styles.bankruptcyHint}>
                  {l(appLanguage, `生涯模式 XP 係數 ${Math.round(zoneCareerXpFactor * 100)}% · 未償貸款 ${zoneLoanDebtBb}bb`, `生涯模式 XP 系数 ${Math.round(zoneCareerXpFactor * 100)}% · 未偿贷款 ${zoneLoanDebtBb}bb`, `Career XP factor ${Math.round(zoneCareerXpFactor * 100)}% · Outstanding loan ${zoneLoanDebtBb}bb`)}
                </Text>
                <Text style={styles.bankruptcyCoachHint}>
                  {l(appLanguage, '主要漏點：', '主要漏点：', 'Top leak: ')}
                  {heroLeakLabel(topLeak, appLanguage)} · {mission(topLeak, appLanguage)}
                </Text>
                <View style={styles.bankruptcyActionRow}>
                  <TouchableOpacity
                    style={[styles.bankruptcyActionBtn, !canClaimSubsidyToday && styles.dim]}
                    disabled={!canClaimSubsidyToday}
                    onPress={() => applyCareerBankruptcyRescue('subsidy')}
                  >
                    <Text style={styles.bankruptcyActionTitle}>{l(appLanguage, '訓練補助', '训练补助', 'Training Subsidy')} +{SUBSIDY_BB}bb</Text>
                    <Text style={styles.bankruptcyActionSub}>{canClaimSubsidyToday ? l(appLanguage, '每日一次（本區）', '每日一次（本区）', 'Once per day (this zone)') : l(appLanguage, '今日已領取', '今日已领取', 'Already claimed today')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.bankruptcyActionBtn}
                    onPress={() => applyCareerBankruptcyRescue('loan')}
                  >
                    <Text style={styles.bankruptcyActionTitle}>{l(appLanguage, '教練貸款', '教练贷款', 'Coach Loan')} +{LOAN_BB}bb</Text>
                    <Text style={styles.bankruptcyActionSub}>{l(appLanguage, '後續盈利自動償還', '后续盈利自动偿还', 'Auto-repay from future profits')} {Math.round(LOAN_REPAY_RATE * 100)}%</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.bankruptcyActionRow}>
                  <TouchableOpacity style={styles.bankruptcyActionBtn} onPress={continueInPracticeMode}>
                    <Text style={styles.bankruptcyActionTitle}>{l(appLanguage, '切換練習模式續打', '切换练习模式续打', 'Continue in Practice')}</Text>
                    <Text style={styles.bankruptcyActionSub}>{l(appLanguage, '不消耗資金 · 任務停用', '不消耗资金 · 任务停用', 'No bankroll cost · Missions disabled')} · XP {Math.round(PRACTICE_XP_MULTIPLIER * 100)}%</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.bankruptcyActionBtn} onPress={returnToLobbyAfterBankruptcy}>
                    <Text style={styles.bankruptcyActionTitle}>{l(appLanguage, '返回大廳', '返回大厅', 'Back to Lobby')}</Text>
                    <Text style={styles.bankruptcyActionSub}>{l(appLanguage, '可切房間或重置本區資金', '可切房间或重置本区资金', 'Switch rooms or reset this zone')}</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.bankruptcyHint}>{l(appLanguage, `未操作將在 ${bankruptcyCountdown} 秒後自動返回大廳`, `未操作将在 ${bankruptcyCountdown} 秒后自动返回大厅`, `Auto-return to lobby in ${bankruptcyCountdown}s`)}</Text>
              </View>
            </ScrollView>
          </View>
        ) : null}

        <View pointerEvents={analysisOpen ? 'auto' : 'none'} style={styles.drawerRoot}>
          <Animated.View style={[styles.drawerBackdrop, { opacity: drawerBackdropOpacity }]}>
            <TouchableOpacity style={styles.drawerBackdropTouch} activeOpacity={1} onPress={() => setAnalysisOpen(false)} />
          </Animated.View>

          <Animated.View style={[styles.drawerPanel, { width: analysisDrawerWidth, maxWidth: analysisDrawerWidth }, { transform: [{ translateX: drawerTranslateX }] }]}>
            <View style={styles.drawerHeader}>
              <Text style={styles.text}>{l(appLanguage, '打法解說', '打法解说', 'Strategy Breakdown')}</Text>
              <TouchableOpacity style={styles.iconBtn} onPress={() => setAnalysisOpen(false)}>
                <Text style={styles.iconBtnText}>{t(appLanguage, 'close')}</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.drawerScroll} contentContainerStyle={styles.drawerScrollContent} showsVerticalScrollIndicator>
              <View style={styles.panelBlue}>
                <Text style={styles.text}>{l(appLanguage, '完整打法解說', '完整打法解说', 'Full Strategy Explanation')}</Text>
                <Text style={styles.textMuted}>
                  {l(appLanguage, '最佳局面：', '最佳局面：', 'Best mode: ')}
                  {analysis.bestMode === 'gto' ? 'GTO' : l(appLanguage, '剝削', '剥削', 'Exploit')}
                  {l(appLanguage, ' · 引擎 ', ' · 引擎 ', ' · Engine ')}
                  {engineLabel}
                </Text>
                <Text style={styles.textMuted}>
                  {l(appLanguage, '目標漏洞：', '目标漏洞：', 'Target leak: ')}
                  {rt(analysis.targetLeak || '', appLanguage, 'Generated exploit target from opponent profile.')}
                </Text>
                <View style={styles.adviceCompareRow}>
                  <View style={styles.adviceCompareCol}>
                    <Advice title="GTO" advice={analysis.gto} language={appLanguage} />
                  </View>
                  <View style={styles.adviceCompareCol}>
                    <Advice title={l(appLanguage, '剝削', '剥削', 'Exploit')} advice={analysis.exploit} language={appLanguage} />
                  </View>
                </View>

                <View style={styles.insightGrid}>
                  <View style={styles.insightCardWide}>
                    <Text style={styles.text}>{l(appLanguage, '勝率估算（非 EV）', '胜率估算（非 EV）', 'Win-rate Estimate (not EV)')}</Text>
                    <Text style={styles.textMuted}>
                      {l(appLanguage, `Hero 勝率 ${spotInsight.equity.heroWin}% · 平手 ${spotInsight.equity.tie}% · 對手 ${spotInsight.equity.villainWin}%`, `Hero 胜率 ${spotInsight.equity.heroWin}% · 平手 ${spotInsight.equity.tie}% · 对手 ${spotInsight.equity.villainWin}%`, `Hero win ${spotInsight.equity.heroWin}% · Tie ${spotInsight.equity.tie}% · Villain ${spotInsight.equity.villainWin}%`)}
                    </Text>
                    <Text style={styles.textMuted}>
                      {l(appLanguage, `Pot Odds 需求 ${spotInsight.potOddsNeed}% · 權益差值 (Equity - Pot Odds) ${heroEquityEdge >= 0 ? '+' : ''}${heroEquityEdge}%`, `Pot Odds 需求 ${spotInsight.potOddsNeed}% · 权益差值 (Equity - Pot Odds) ${heroEquityEdge >= 0 ? '+' : ''}${heroEquityEdge}%`, `Pot odds need ${spotInsight.potOddsNeed}% · Equity edge (Equity - Pot Odds) ${heroEquityEdge >= 0 ? '+' : ''}${heroEquityEdge}%`)}
                    </Text>
                    <Text style={styles.textTiny}>{l(appLanguage, '此區塊顯示的是權益估算，不能直接視為每手 bbEV。', '此区块显示的是权益估算，不能直接视为每手 bbEV。', 'This section shows equity estimates, not direct per-hand bbEV.')}</Text>
                    <View style={styles.stackBarTrack}>
                      <View style={[styles.stackBarHero, { width: `${spotInsight.equity.heroWin}%` }]} />
                      <View style={[styles.stackBarTie, { width: `${spotInsight.equity.tie}%` }]} />
                      <View style={[styles.stackBarVillain, { width: `${Math.max(0, 100 - spotInsight.equity.heroWin - spotInsight.equity.tie)}%` }]} />
                    </View>
                    <View style={styles.stackLegendRow}>
                      <Text style={styles.stackLegendText}>Hero</Text>
                      <Text style={styles.stackLegendText}>Tie</Text>
                      <Text style={styles.stackLegendText}>Villain</Text>
                    </View>
                    <PercentMeter label="Hero Win" value={spotInsight.equity.heroWin} accent="#50c8f0" />
                    <PercentMeter label={l(appLanguage, '可接受最低勝率 (Pot Odds)', '可接受最低胜率 (Pot Odds)', 'Minimum Required Win Rate (Pot Odds)')} value={spotInsight.potOddsNeed} accent="#d9ab4a" />
                  </View>

                  <View style={styles.insightCard}>
                    <Text style={styles.text}>{l(appLanguage, 'Outs 組合', 'Outs 组合', 'Outs Breakdown')}</Text>
                    {spotInsight.outsCount > 0 ? (
                      <>
                        <Text style={styles.textMuted}>
                          {l(appLanguage, `總 outs ${spotInsight.outsCount} 張 · 下一張命中 ${spotInsight.oneCardHitRate}%`, `总 outs ${spotInsight.outsCount} 张 · 下一张命中 ${spotInsight.oneCardHitRate}%`, `Total outs ${spotInsight.outsCount} · Next-card hit ${spotInsight.oneCardHitRate}%`)}
                          {hand.street === 'flop'
                            ? l(appLanguage, ` · 到河牌約 ${spotInsight.twoCardHitRate}%`, ` · 到河牌约 ${spotInsight.twoCardHitRate}%`, ` · By river about ${spotInsight.twoCardHitRate}%`)
                            : ''}
                        </Text>
                        {spotInsight.outsGroups.map((group) => (
                          <View key={`outs-${group.label}`} style={styles.outsRow}>
                            <Text style={styles.outsRowTitle}>
                              {rt(group.label, appLanguage, `Out group`)} · {group.count} {l(appLanguage, '張', '张', 'cards')}
                            </Text>
                            <Text style={styles.textTiny}>{group.cards.join(' ')}</Text>
                          </View>
                        ))}
                      </>
                    ) : (
                      <Text style={styles.textMuted}>{l(appLanguage, '目前街口沒有可直接統計的 outs（翻牌前或已到河牌）。', '目前街口没有可直接统计的 outs（翻牌前或已到河牌）。', 'No directly countable outs at this street (preflop or river).')}</Text>
                    )}
                  </View>

                  <View style={styles.insightCard}>
                    <Text style={styles.text}>{l(appLanguage, '對手範圍估算', '对手范围估算', 'Opponent Range Estimate')}</Text>
                    <Text style={styles.textMuted}>{l(appLanguage, `加權組合 ${spotInsight.combosConsidered} 組`, `加权组合 ${spotInsight.combosConsidered} 组`, `Weighted combos ${spotInsight.combosConsidered}`)}</Text>
                    {spotInsight.rangeBuckets.map((bucket) => (
                      <PercentMeter
                        key={`range-${bucket.key}`}
                        label={l(
                          appLanguage,
                          `${rt(bucket.label, appLanguage, bucket.key === 'value' ? 'Strong Value' : bucket.key === 'made' ? 'Made Hand' : bucket.key === 'draw' ? 'Draw' : 'Air / Weak Showdown')} · ${bucket.combos} 組`,
                          `${rt(bucket.label, appLanguage, bucket.key === 'value' ? 'Strong Value' : bucket.key === 'made' ? 'Made Hand' : bucket.key === 'draw' ? 'Draw' : 'Air / Weak Showdown')} · ${bucket.combos} 组`,
                          `${rt(bucket.label, appLanguage, bucket.key === 'value' ? 'Strong Value' : bucket.key === 'made' ? 'Made Hand' : bucket.key === 'draw' ? 'Draw' : 'Air / Weak Showdown')} · ${bucket.combos} combos`,
                        )}
                        value={bucket.ratio}
                        accent={
                          bucket.key === 'value'
                            ? '#5eb2ff'
                            : bucket.key === 'made'
                              ? '#57d3b2'
                              : bucket.key === 'draw'
                                ? '#f0ba5d'
                                : '#8f9aaa'
                        }
                      />
                    ))}
                    <View style={styles.rangeSampleWrap}>
                      {spotInsight.rangeSamples.map((sample, idx) => (
                        <View key={`range-sample-${sample.text}-${idx}`} style={styles.rangeSamplePill}>
                          <Text style={styles.rangeSampleText}>{rt(sample.text, appLanguage, 'Range sample')}</Text>
                          <Text style={styles.rangeSampleTextMuted}>{sample.ratio}%</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                </View>

                <View style={styles.algoBox}>
                  <Text style={styles.text}>{l(appLanguage, '當前背後算法', '当前背后算法', 'Current Engine Logic')}</Text>
                  <Text style={styles.textTiny}>{l(appLanguage, '- GTO：Preflop 用本地 CFR 查表（20/40/100bb 插值）；Postflop 先命中第三方 river subgame override，未命中再回退本地 MCCFR 抽象查表。', '- GTO：Preflop 用本地 CFR 查表（20/40/100bb 插值）；Postflop 先命中第三方 river subgame override，未命中再回退本地 MCCFR 抽象查表。', '- GTO: preflop uses local CFR lookup (20/40/100bb interpolation); postflop tries river subgame override first, then local MCCFR abstraction fallback.')}</Text>
                  <Text style={styles.textTiny}>{l(appLanguage, '- 剝削：依 AI 漏洞標籤（過度棄牌、過寬跟注等）做規則型 exploit 調整。', '- 剥削：依 AI 漏洞标签（过度弃牌、过宽跟注等）做规则型 exploit 调整。', '- Exploit: applies rule-based adjustments from AI leak tags (over-fold, over-call, etc.).')}</Text>
                  <Text style={styles.textTiny}>{l(appLanguage, '- 最佳局面：比較 GTO / 剝削信心分數，若可穩定放大 EV 才切剝削。', '- 最佳局面：比较 GTO / 剥削信心分数，若可稳定放大 EV 才切剥削。', '- Best mode: compares confidence between GTO and exploit; switches only when exploit can reliably increase EV.')}</Text>
                  <Text style={styles.textTiny}>{l(appLanguage, '- 位置模型：UTG/LJ/HJ/CO/BTN/SB/BB；同牌力在 IP 與 OOP 會套不同門檻。', '- 位置模型：UTG/LJ/HJ/CO/BTN/SB/BB；同牌力在 IP 与 OOP 会套不同门槛。', '- Position model: UTG/LJ/HJ/CO/BTN/SB/BB; same hand strength uses different thresholds in-position vs out-of-position.')}</Text>
                  <Text style={styles.textTiny}>{l(appLanguage, '- AI API：支援 OpenAI Omni 音頻直出（EXPO_PUBLIC_OPENAI_API_KEY）或 Qwen（EXPO_PUBLIC_QWEN_API_KEY / EXPO_PUBLIC_BAILIAN_API_KEY）。', '- AI API：支持 OpenAI Omni 音频直出（EXPO_PUBLIC_OPENAI_API_KEY）或 Qwen（EXPO_PUBLIC_QWEN_API_KEY / EXPO_PUBLIC_BAILIAN_API_KEY）。', '- AI API: supports OpenAI Omni direct audio output or Qwen endpoints via env keys.')}</Text>
                </View>
                {spotInsight.notes.map((line, idx) => (
                  <Text key={`insight-note-${idx}`} style={styles.textTiny}>
                    - {rt(line, appLanguage, 'Spot insight note')}
                  </Text>
                ))}
              </View>
            </ScrollView>
          </Animated.View>
        </View>

        <View pointerEvents={opsOpen ? 'auto' : 'none'} style={styles.drawerRoot}>
          <Animated.View style={[styles.drawerBackdrop, { opacity: opsBackdropOpacity }]}>
            <TouchableOpacity style={styles.drawerBackdropTouch} activeOpacity={1} onPress={() => setOpsOpen(false)} />
          </Animated.View>

          <Animated.View style={[styles.opsDrawerPanel, { transform: [{ translateX: opsTranslateX }] }]}>
            <View style={styles.drawerHeader}>
              <Text style={styles.text}>{l(appLanguage, '桌況概覽 · 桌位管理', '桌况概览 · 桌位管理', 'Table Overview · Seat Management')}</Text>
              <TouchableOpacity style={styles.iconBtn} onPress={() => setOpsOpen(false)}>
                <Text style={styles.iconBtnText}>{t(appLanguage, 'close')}</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.drawerScroll} contentContainerStyle={styles.opsScrollContent} showsVerticalScrollIndicator>
              <LinearGradient colors={['#184d67', '#123848', '#102d3b']} style={styles.opsHeroCard}>
                <Text style={styles.opsHeroTitle}>{l(appLanguage, '桌況概覽', '桌况概览', 'Table Overview')}</Text>
                <Text style={styles.opsHeroSub}>
                  {l(appLanguage, `${zoneDisplayName} · ${battleSeat?.ai?.name ?? t(appLanguage, 'opponent_not_assigned')} · 盲注 ${hand.smallBlind}/${hand.bigBlind}`, `${zoneDisplayName} · ${battleSeat?.ai?.name ?? t(appLanguage, 'opponent_not_assigned')} · 盲注 ${hand.smallBlind}/${hand.bigBlind}`, `${zoneDisplayName} · ${battleSeat?.ai?.name ?? t(appLanguage, 'opponent_not_assigned')} · Blinds ${hand.smallBlind}/${hand.bigBlind}`)}
                </Text>
                <View style={styles.opsHeroGrid}>
                  <View style={styles.opsHeroItem}>
                    <Text style={styles.opsHeroLabel}>XP</Text>
                    <Text style={styles.opsHeroValue}>{progress.xp}</Text>
                  </View>
                  <View style={styles.opsHeroItem}>
                    <Text style={styles.opsHeroLabel}>{l(appLanguage, '勝率', '胜率', 'Win Rate')}</Text>
                    <Text style={styles.opsHeroValue}>{winRate(progress)}%</Text>
                  </View>
                  <View style={styles.opsHeroItem}>
                    <Text style={styles.opsHeroLabel}>{l(appLanguage, '對局數', '对局数', 'Hands')}</Text>
                    <Text style={styles.opsHeroValue}>{progress.handsPlayed}</Text>
                  </View>
                  <View style={styles.opsHeroItem}>
                    <Text style={styles.opsHeroLabel}>{t(appLanguage, 'meta_zone_bankroll')}</Text>
                    <Text style={styles.opsHeroValue}>{zoneHeroBb}bb</Text>
                  </View>
                </View>
                <Text style={styles.textMuted}>
                  {l(appLanguage, `區域資金 ${zoneHeroStack}（${zoneHeroBb}bb）· 累積 ${zoneProfitBb >= 0 ? '+' : ''}${zoneProfitBb}bb · 紀錄 ${handRecordCount}`, `区域资金 ${zoneHeroStack}（${zoneHeroBb}bb）· 累积 ${zoneProfitBb >= 0 ? '+' : ''}${zoneProfitBb}bb · 记录 ${handRecordCount}`, `Zone bankroll ${zoneHeroStack} (${zoneHeroBb}bb) · Profit ${zoneProfitBb >= 0 ? '+' : ''}${zoneProfitBb}bb · Records ${handRecordCount}`)}
                  {activeProfile ? l(appLanguage, ` · 帳號 ${activeProfile.displayName}`, ` · 账号 ${activeProfile.displayName}`, ` · Account ${activeProfile.displayName}`) : ''}
                </Text>
                <Text style={styles.textMuted}>
                  {l(appLanguage, '桌上語音：', '桌上语音：', 'Table voice: ')}
                  {rt(hand.trashTalk || '', appLanguage, 'Opponent table talk')}
                </Text>
                <Text style={styles.textTiny}>{l(appLanguage, `教練：${note}`, `教练：${note}`, `Coach: ${note}`)}</Text>
                <Text style={styles.textTiny}>
                  {l(appLanguage, '目前主要破綻：', '目前主要破绽：', 'Current main leak: ')}
                  {heroLeakLabel(topLeak, appLanguage)} · {mission(topLeak, appLanguage)}
                </Text>
              </LinearGradient>

              <View style={styles.opsGrid}>
                <View style={[styles.panelBlue, styles.opsGridCard]}>
                  <Text style={styles.text}>{l(appLanguage, '教練統計儀表', '教练统计仪表', 'Coach Stats Dashboard')}</Text>
                  <Text style={styles.textMuted}>
                    {l(appLanguage, `本區樣本 ${zoneHeroStats.hands} 手 · VPIP-PFR 差 ${zoneVpipPfrGap >= 0 ? '+' : ''}${zoneVpipPfrGap}%`, `本区样本 ${zoneHeroStats.hands} 手 · VPIP-PFR 差 ${zoneVpipPfrGap >= 0 ? '+' : ''}${zoneVpipPfrGap}%`, `Zone sample ${zoneHeroStats.hands} hands · VPIP-PFR gap ${zoneVpipPfrGap >= 0 ? '+' : ''}${zoneVpipPfrGap}%`)}
                  </Text>
                  <View style={styles.coachStatsGrid}>
                    <CoachStatTile label="VPIP" statKey="vpip" stat={zoneHeroStats.vpip} language={appLanguage} />
                    <CoachStatTile label="PFR" statKey="pfr" stat={zoneHeroStats.pfr} language={appLanguage} />
                    <CoachStatTile label="Preflop 3Bet" statKey="threeBetPreflop" stat={zoneHeroStats.threeBetPreflop} language={appLanguage} />
                    <CoachStatTile label="Fold to 3Bet" statKey="foldToThreeBet" stat={zoneHeroStats.foldToThreeBet} language={appLanguage} />
                    <CoachStatTile label="Flop C-Bet" statKey="flopCBet" stat={zoneHeroStats.flopCBet} language={appLanguage} />
                    <CoachStatTile label="Fold vs Flop C-Bet" statKey="foldVsFlopCBet" stat={zoneHeroStats.foldVsFlopCBet} language={appLanguage} />
                    <CoachStatTile label={l(appLanguage, '翻後再加注', '翻后再加注', 'Postflop Re-raise')} statKey="postflopReraise" stat={zoneHeroStats.postflopReraise} language={appLanguage} />
                  </View>
                  <Text style={styles.textTiny}>- {zoneStatsCoachNote}</Text>
                </View>

                <View style={[styles.panel, styles.opsGridCard]}>
                  <Text style={styles.text}>{l(appLanguage, '桌位管理', '桌位管理', 'Seat Management')}</Text>
                  <Text style={styles.textMuted}>
                    {l(appLanguage, `選中座位：${selectedSeatDisplayPos}`, `选中座位：${selectedSeatDisplayPos}`, `Selected seat: ${selectedSeatDisplayPos}`)}
                    {selectedSeatDisplayPos === 'BTN' ? ' (D)' : ''} · {seatName(selectedSeat, appLanguage)}
                  </Text>
                  <Text style={styles.textTiny}>{l(appLanguage, '- 點空位：新增 AI。點 AI：先鎖定對手，再點同座位可移除。', '- 点空位：新增 AI。点 AI：先锁定对手，再点同座位可移除。', '- Tap empty seat: add AI. Tap AI: lock opponent, tap same seat again to remove.')}</Text>
                  <TouchableOpacity style={styles.secondary} onPress={() => startHand(selectedSeat.role === 'ai' ? selectedSeat.id : battleSeatId ?? undefined)}>
                    <Text style={styles.secondaryText}>{l(appLanguage, '對該座位開局', '对该座位开局', 'Start Hand vs Seat')}</Text>
                  </TouchableOpacity>
                  {selectedSeat.role === 'ai' && selectedSeat.ai ? (
                    <>
                      <Text style={styles.textMuted}>{l(appLanguage, `風格：${rt(selectedSeat.ai.styleLabel, appLanguage, 'Profile style')} · Skill ${selectedSeat.ai.skill}`, `风格：${rt(selectedSeat.ai.styleLabel, appLanguage, 'Profile style')} · Skill ${selectedSeat.ai.skill}`, `Style: ${rt(selectedSeat.ai.styleLabel, appLanguage, 'Profile style')} · Skill ${selectedSeat.ai.skill}`)}</Text>
                      <Text style={styles.text}>{l(appLanguage, '漏洞識別（自行判斷）', '漏洞识别（自行判断）', 'Leak Detection (Manual)')}</Text>
                      <View style={styles.chips}>
                        {oppLeakKeys.map((k) => (
                          <TouchableOpacity key={k} style={[styles.chip, leakGuess === k && styles.chipOn]} onPress={() => setLeakGuess(k)}>
                            <Text style={styles.chipText}>{oppLeakLabel(k, appLanguage)}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                      <TouchableOpacity style={styles.secondary} onPress={verifyLeak}><Text style={styles.secondaryText}>{l(appLanguage, '提交漏洞判斷', '提交漏洞判断', 'Submit Leak Guess')}</Text></TouchableOpacity>
                    </>
                  ) : (
                    <Text style={styles.textMuted}>{l(appLanguage, '選擇一個 AI 座位可做漏洞判斷練習。', '选择一个 AI 座位可做漏洞判断练习。', 'Select an AI seat to practice leak judgment.')}</Text>
                  )}
                </View>
              </View>
            </ScrollView>
          </Animated.View>
        </View>

            <View pointerEvents={missionOpen ? 'auto' : 'none'} style={styles.drawerRoot}>
          <Animated.View style={[styles.drawerBackdrop, { opacity: missionBackdropOpacity }]}>
            <TouchableOpacity style={styles.drawerBackdropTouch} activeOpacity={1} onPress={() => setMissionOpen(false)} />
          </Animated.View>

          <Animated.View style={[styles.missionDrawerPanel, { transform: [{ translateX: missionTranslateX }] }]}>
            <View style={styles.drawerHeader}>
              <Text style={styles.text}>{l(appLanguage, `任務課程 · ${zoneDisplayName}`, `任务课程 · ${zoneDisplayName}`, `Mission Course · ${zoneDisplayName}`)}</Text>
              <TouchableOpacity style={styles.iconBtn} onPress={() => setMissionOpen(false)}>
                <Text style={styles.iconBtnText}>{t(appLanguage, 'close')}</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.drawerScroll} contentContainerStyle={styles.drawerScrollContent} showsVerticalScrollIndicator>
              <View style={styles.panelBlue}>
                <Text style={styles.text}>{t(appLanguage, 'meta_zone_bankroll')}</Text>
                <Text style={styles.textMuted}>{l(appLanguage, `目前 ${zoneHeroStack}（${zoneHeroBb}bb）`, `当前 ${zoneHeroStack}（${zoneHeroBb}bb）`, `Current ${zoneHeroStack} (${zoneHeroBb}bb)`)} </Text>
                <Text style={styles.textMuted}>{l(appLanguage, `相對起手 ${zoneProfitBb >= 0 ? '+' : ''}${zoneProfitBb}bb`, `相对起手 ${zoneProfitBb >= 0 ? '+' : ''}${zoneProfitBb}bb`, `From baseline ${zoneProfitBb >= 0 ? '+' : ''}${zoneProfitBb}bb`)}</Text>
                <Text style={styles.textMuted}>{l(appLanguage, `任務完成 ${completedMissionCount}/${zoneTrainingState.missions.length}`, `任务完成 ${completedMissionCount}/${zoneTrainingState.missions.length}`, `Missions completed ${completedMissionCount}/${zoneTrainingState.missions.length}`)}</Text>
                <Text style={styles.textMuted}>
                  {l(appLanguage, `模式 ${trainingMode === 'practice' ? '練習（任務停用）' : '生涯'} · XP ${Math.round(activeXpFactor * 100)}%`, `模式 ${trainingMode === 'practice' ? '练习（任务停用）' : '生涯'} · XP ${Math.round(activeXpFactor * 100)}%`, `Mode ${trainingMode === 'practice' ? 'Practice (missions off)' : 'Career'} · XP ${Math.round(activeXpFactor * 100)}%`)}
                  {zoneLoanDebtBb > 0 ? l(appLanguage, ` · 貸款餘額 ${zoneLoanDebtBb}bb`, ` · 贷款余额 ${zoneLoanDebtBb}bb`, ` · Loan balance ${zoneLoanDebtBb}bb`) : ''}
                </Text>
                <TouchableOpacity style={styles.missionResetBtn} onPress={resetZoneTrainingState}>
                  <Text style={styles.missionResetText}>{l(appLanguage, '重置本區 100bb', '重置本区 100bb', 'Reset Zone to 100bb')}</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.panel}>
                <Text style={styles.text}>{l(appLanguage, '當前任務列表', '当前任务列表', 'Current Mission List')}</Text>
                {zoneTrainingState.missions.map((missionItem) => (
                  <View key={missionItem.id} style={[styles.missionCard, missionItem.completed && styles.missionCardDone]}>
                    <Text style={styles.missionTitle}>{missionTitle(missionItem.title, appLanguage)}</Text>
                    <Text style={styles.textTiny}>{missionDetail(missionItem.detail, appLanguage)}</Text>
                    <Text style={styles.textMuted}>
                      {l(appLanguage, `進度 ${missionItem.progress}/${missionItem.target} · 獎勵 XP ${missionItem.rewardXp}`, `进度 ${missionItem.progress}/${missionItem.target} · 奖励 XP ${missionItem.rewardXp}`, `Progress ${missionItem.progress}/${missionItem.target} · Reward XP ${missionItem.rewardXp}`)}
                    </Text>
                  </View>
                ))}
              </View>
            </ScrollView>
          </Animated.View>
            </View>
          </View>
          <BottomTabBar
            activeTab={rootTab}
            items={rootTabItems}
            onTabChange={handleRootTabChange}
            open={navDrawerOpen}
            onOpenChange={setNavDrawerOpen}
            drawerWidth={NAV_DRAWER_WIDTH}
            collapsedWidth={NAV_COLLAPSED_WIDTH}
            safeInsetLeft={navSafeInsetLeft}
          />
        </View>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0a1b2c' },
  bg: { flex: 1 },
  navRoot: { flex: 1 },
  navContent: { flex: 1 },
  wrap: { padding: 14, paddingBottom: 28, gap: 10 },
  tableScreen: { flex: 1, padding: 10, gap: 8 },
  tableCore: { flex: 1, gap: 8, flexDirection: 'row', minHeight: 0 },

  brandBlock: { gap: 3, marginBottom: 4, flexShrink: 1, paddingRight: 8 },
  brandBlockMini: { gap: 2 },
  brandText: { color: '#6ff0b9', fontSize: 12, letterSpacing: 2, fontFamily: 'monospace' },
  h1: { fontSize: 26, fontWeight: '900', color: '#ecfff7', fontFamily: 'serif' },
  sub: { fontSize: 12, color: '#a8d6c7' },

  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  topActions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end', flexShrink: 1, maxWidth: '58%' },
  iconBtn: {
    minWidth: 50,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2c5f6a',
    backgroundColor: '#112733',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  iconBtnText: { color: '#e1f5ff', fontSize: 12, fontWeight: '700' },
  iconEmoji: { fontSize: 18 },

  lobbyScreen: { flex: 1, position: 'relative', overflow: 'hidden', padding: 10, gap: 8 },
  lobbyScreenCompact: { padding: 8, gap: 6 },
  lobbyAuraA: {
    position: 'absolute',
    width: 340,
    height: 340,
    borderRadius: 999,
    backgroundColor: 'rgba(44, 187, 160, 0.14)',
    top: -140,
    left: -110,
  },
  lobbyAuraB: {
    position: 'absolute',
    width: 420,
    height: 420,
    borderRadius: 999,
    backgroundColor: 'rgba(38, 131, 196, 0.12)',
    bottom: -210,
    right: -140,
  },
  lobbyMarquee: {
    borderWidth: 1,
    borderColor: '#317b68',
    borderRadius: 10,
    backgroundColor: 'rgba(11, 48, 39, 0.80)',
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  lobbyMarqueeText: { color: '#9af8d3', fontSize: 11, fontWeight: '700', fontFamily: 'monospace' },
  lobbyHeader: {
    borderWidth: 1,
    borderColor: '#397990',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 9,
    position: 'relative',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  lobbyHeaderCompact: { paddingHorizontal: 10, paddingVertical: 8, gap: 8 },
  h1Compact: { fontSize: 22 },
  subCompact: { fontSize: 11 },
  lobbyHeaderStats: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 6, flex: 1, maxWidth: '55%' },
  lobbyHeaderStatsWithGear: { paddingRight: 44 },
  lobbyHeaderGearBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 36,
    height: 36,
    borderWidth: 1,
    borderColor: '#4f8ca2',
    borderRadius: 18,
    backgroundColor: 'rgba(11, 37, 52, 0.88)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lobbyHeaderGearBtnCompact: { top: 6, right: 6, width: 32, height: 32, borderRadius: 16 },
  lobbyHeaderGearBtnOn: { borderColor: '#85ffe4', backgroundColor: 'rgba(18, 78, 65, 0.88)' },
  lobbyHeaderGearIcon: { color: '#dff5ff', fontSize: 18, fontWeight: '900', lineHeight: 20 },
  lobbyHeaderStat: {
    minWidth: 86,
    borderWidth: 1,
    borderColor: '#2a5f75',
    borderRadius: 9,
    backgroundColor: 'rgba(8, 29, 42, 0.82)',
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 1,
  },
  lobbyHeaderStatLabel: { color: '#9cc3d3', fontSize: 9, fontFamily: 'monospace' },
  lobbyHeaderStatValue: { color: '#f0fff9', fontSize: 13, fontWeight: '900' },
  lobbyBody: { flex: 1, minHeight: 0, flexDirection: 'row', gap: 8 },
  lobbyBodyCompact: { gap: 6 },
  lobbySettingsOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 25,
    justifyContent: 'center',
    alignItems: 'flex-end',
    padding: 10,
  },
  lobbySettingsBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(4, 9, 15, 0.58)',
  },
  lobbySettingsPanel: {
    width: '58%',
    maxWidth: 640,
    minWidth: 320,
    maxHeight: '94%',
    borderWidth: 1,
    borderColor: '#3f6f84',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  lobbySettingsHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  lobbySettingsTitle: { color: '#f2fffb', fontSize: 20, fontWeight: '900', fontFamily: 'serif' },
  lobbySettingsScroll: { minHeight: 0 },
  lobbySettingsScrollContent: { gap: 8, paddingBottom: 6 },
  lobbySettingCard: {
    borderWidth: 1,
    borderColor: '#39687a',
    borderRadius: 10,
    backgroundColor: 'rgba(10, 36, 49, 0.8)',
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 6,
  },
  lobbySettingTitle: { color: '#ecfff8', fontSize: 15, fontWeight: '900', fontFamily: 'serif' },
  lobbySettingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  lobbySettingRowCopy: { flex: 1, gap: 2 },
  lobbySettingRowTitle: { color: '#def6ff', fontSize: 12, fontWeight: '800' },
  lobbySettingRowSub: { color: '#9ebfce', fontSize: 10 },
  lobbySettingSwitch: {
    minWidth: 48,
    borderWidth: 1,
    borderColor: '#456a7a',
    borderRadius: 999,
    backgroundColor: '#1a3a48',
    paddingHorizontal: 12,
    paddingVertical: 5,
    alignItems: 'center',
  },
  lobbySettingSwitchOn: { borderColor: '#8dffe5', backgroundColor: '#1d5a4d' },
  lobbySettingSwitchText: { color: '#e1f6ff', fontSize: 10, fontWeight: '800' },
  lobbyRoomsPanel: {
    flex: 1.5,
    borderWidth: 1,
    borderColor: '#2d6178',
    borderRadius: 14,
    padding: 8,
    gap: 6,
    minHeight: 0,
  },
  lobbyRoomsHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  lobbyRoomsTitle: { color: '#e8fff8', fontSize: 15, fontWeight: '900', fontFamily: 'serif' },
  lobbyRoomGrid: { flex: 1, minHeight: 0, flexDirection: 'row', flexWrap: 'wrap', rowGap: 6, columnGap: 6, alignContent: 'space-between' },
  lobbyRoomGridCompact: { rowGap: 4, columnGap: 4 },
  lobbyRoomTouch: { width: '32.4%', height: '46.8%', minHeight: 0, borderRadius: 12 },
  lobbyRoomTouchCompact: { width: '32.4%', height: '45.2%' },
  lobbyRoomCard: { borderWidth: 1, borderColor: '#2f5f72', borderRadius: 12, paddingHorizontal: 7, paddingVertical: 6, gap: 4, flex: 1 },
  lobbyRoomCardCompact: { paddingHorizontal: 6, paddingVertical: 5, gap: 3 },
  lobbyRoomCardOn: {
    borderColor: '#79ffe0',
    shadowColor: '#5effd8',
    shadowOpacity: 0.32,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 0 },
    elevation: 5,
  },
  lobbyRoomLocked: { opacity: 0.65 },
  lobbyRoomCardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 6 },
  lobbyRoomTitle: { color: '#f3fffc', fontWeight: '900', fontSize: 15, fontFamily: 'serif', flexShrink: 1 },
  lobbyRoomTitleCompact: { fontSize: 13 },
  lobbyRoomSub: { color: '#a8ccdb', fontSize: 9 },
  lobbyRoomSubCompact: { fontSize: 8 },
  lobbyDoorChip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
    color: '#cef6ea',
    fontFamily: 'monospace',
    fontSize: 9,
    fontWeight: '800',
  },
  lobbyDoorChipOpen: { borderColor: '#2f866d', backgroundColor: 'rgba(19, 82, 65, 0.72)' },
  lobbyDoorChipLive: { borderColor: '#72ffd8', backgroundColor: 'rgba(21, 112, 90, 0.86)', color: '#e8fff7' },
  lobbyDoorChipLocked: { borderColor: '#4a6279', backgroundColor: 'rgba(36, 52, 67, 0.84)', color: '#afc5d9' },
  lobbyRoomMetaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  lobbyRoomMeta: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#2f5f70',
    backgroundColor: 'rgba(8, 26, 39, 0.82)',
    color: '#d7ecf7',
    fontFamily: 'monospace',
    fontSize: 8,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  lobbyRoomMetaCompact: { fontSize: 7, paddingHorizontal: 4 },
  lobbyRoomTail: { color: '#91ebc7', fontSize: 9, fontWeight: '700' },
  lobbyRoomTailCompact: { fontSize: 8 },
  lobbyRoomTailLocked: { color: '#b5c9d8' },
  lobbyControlPanel: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#2c6c6f',
    borderRadius: 14,
    padding: 10,
    gap: 8,
    minHeight: 0,
  },
  lobbyControlPanelCompact: { padding: 8, gap: 6 },
  lobbyControlContent: { flex: 1, minHeight: 0, gap: 8 },
  lobbyControlContentCompact: { gap: 5, justifyContent: 'space-between', paddingBottom: 8 },
  lobbyControlTop: { gap: 6 },
  lobbyControlTopCompact: { gap: 4, flexShrink: 1 },
  lobbyControlBottom: { gap: 6 },
  lobbyControlBottomCompact: { gap: 4, marginTop: 2, marginBottom: 6 },
  lobbyControlTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  lobbyControlTitleRowCompact: { gap: 6 },
  lobbyControlTitle: { color: '#f2fffa', fontSize: 20, fontWeight: '900', fontFamily: 'serif' },
  lobbyControlTitleCompact: { fontSize: 16 },
  lobbyControlSub: { color: '#b7d8cd', fontSize: 11, maxWidth: 250 },
  lobbyControlSubCompact: { fontSize: 10, maxWidth: 200 },
  lobbyModeRow: { flexDirection: 'row', gap: 8 },
  lobbyModeRowCompact: { gap: 6 },
  lobbyModeBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#3e6674',
    borderRadius: 8,
    backgroundColor: 'rgba(10, 33, 45, 0.82)',
    paddingVertical: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lobbyModeBtnCompact: { paddingVertical: 5 },
  lobbyModeBtnOn: {
    borderColor: '#86ffe3',
    backgroundColor: 'rgba(18, 72, 59, 0.82)',
  },
  lobbyModeBtnText: { color: '#c5dce9', fontSize: 11, fontWeight: '800' },
  lobbyModeBtnTextCompact: { fontSize: 10 },
  lobbyModeBtnTextOn: { color: '#ebfff7' },
  lobbyModeHint: { color: '#b8d8ce', fontSize: 10, lineHeight: 14 },
  lobbyModeHintCompact: { fontSize: 9, lineHeight: 12 },
  lobbyFocusList: {
    borderWidth: 1,
    borderColor: '#35696b',
    borderRadius: 10,
    backgroundColor: 'rgba(9, 38, 34, 0.72)',
    paddingHorizontal: 9,
    paddingVertical: 7,
    gap: 4,
  },
  lobbyFocusListCompact: { paddingHorizontal: 7, paddingVertical: 4, gap: 2 },
  lobbyFocusLine: { color: '#d9f8e9', fontSize: 11 },
  lobbyFocusLineCompact: { fontSize: 10 },
  lobbyControlMetaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  lobbyControlMetaGridCompact: { gap: 4 },
  lobbyControlMetaCard: {
    width: '48.5%',
    borderWidth: 1,
    borderColor: '#345f70',
    borderRadius: 8,
    backgroundColor: 'rgba(9, 30, 43, 0.78)',
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 2,
  },
  lobbyControlMetaCardCompact: { paddingHorizontal: 6, paddingVertical: 4, gap: 1 },
  lobbyControlMetaLabel: { color: '#9dbac8', fontSize: 9, fontFamily: 'monospace' },
  lobbyControlMetaLabelCompact: { fontSize: 8 },
  lobbyControlMetaValue: { color: '#f2fffb', fontSize: 12, fontWeight: '800' },
  lobbyControlMetaValueCompact: { fontSize: 10 },
  primaryGradCompact: { paddingVertical: 6 },
  primaryTextCompact: { fontSize: 10 },
  lobbyControlNote: { color: '#b8d8ce', fontSize: 10, lineHeight: 14 },

  tableShell: { borderRadius: 24, overflow: 'hidden', flex: 1, minHeight: 0, minWidth: 0 },
  tableRail: { borderRadius: 24, padding: 8, borderWidth: 1, borderColor: '#9a7441', flex: 1 },
  tableFelt: { position: 'relative', borderRadius: 20, overflow: 'hidden', flex: 1, minHeight: 0 },
  feltGlowA: { position: 'absolute', width: 250, height: 250, borderRadius: 999, backgroundColor: 'rgba(64, 185, 138, 0.10)', left: '18%', top: '16%' },
  feltGlowB: { position: 'absolute', width: 180, height: 180, borderRadius: 999, backgroundColor: 'rgba(122, 245, 194, 0.08)', right: '10%', bottom: '10%' },

  centerBoardWrap: {
    position: 'absolute',
    left: '23%',
    right: '23%',
    top: '30%',
    borderRadius: 16,
    paddingVertical: 6,
    alignItems: 'center',
    backgroundColor: 'rgba(8, 32, 29, 0.82)',
    borderWidth: 1,
    borderColor: '#2a6153',
    gap: 4,
    zIndex: 6,
  },
  centerLabel: { color: '#f6fffb', fontSize: 14, fontWeight: '900', fontFamily: 'monospace' },
  centerSub: { color: '#99d5c3', fontSize: 10, fontFamily: 'monospace' },
  chipPulse: { position: 'absolute', top: 10, right: 12 },
  chipPulseText: { color: '#f7d27d', fontSize: 16, fontWeight: '900' },
  boardRow: { flexDirection: 'row', gap: 4, alignItems: 'center' },

  seatCards: {
    position: 'absolute',
    flexDirection: 'row',
    gap: 4,
    zIndex: 30,
    elevation: 12,
  },
  seatCardsOffset: {
    marginLeft: 16,
    marginTop: 14,
  },
  seatBadge: {
    position: 'absolute',
    width: 86,
    marginLeft: -43,
    marginTop: -22,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#29554a',
    backgroundColor: 'rgba(8, 22, 22, 0.86)',
    alignItems: 'center',
    gap: 1,
    zIndex: 14,
  },
  seatBadgeOn: { borderColor: '#83ffe4' },
  seatBadgeBattle: { borderColor: '#f5d38a' },
  seatBadgeEmpty: { opacity: 0.44 },
  seatBadgeFolded: { opacity: 0.5 },
  avatarDot: { width: 7, height: 7, borderRadius: 999, backgroundColor: '#57ffc8' },
  seatPos: { color: '#ffe6b3', fontSize: 9, fontWeight: '800', fontFamily: 'monospace' },
  seatName: { color: '#f1fffb', fontSize: 10, fontWeight: '800' },
  seatStack: { color: '#8fd9bd', fontSize: 9, fontFamily: 'monospace' },
  seatActionText: { color: '#9ecad8', fontSize: 9, fontFamily: 'monospace' },

  tableCard: {
    width: 38,
    height: 54,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: '#a0adbc',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  tableCardCompact: {
    width: 30,
    height: 44,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#a0adbc',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  cardBack: { borderColor: '#364f7c' },
  cardBackStripe: { position: 'absolute', top: 0, bottom: 0, width: 9, backgroundColor: 'rgba(118, 158, 238, 0.25)' },
  cardBackText: { color: '#d5e6ff', fontWeight: '900', fontSize: 12 },
  cardFaceText: { color: '#0f1825', fontWeight: '900', fontSize: 15, fontFamily: 'serif' },
  cardFaceRed: { color: '#a91c2f' },

  row3: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  actionDock: {
    width: '31%',
    minWidth: 240,
    maxWidth: 320,
    flexGrow: 0,
    flexShrink: 0,
    borderWidth: 1,
    borderColor: '#245564',
    borderRadius: 12,
    backgroundColor: 'rgba(9, 29, 40, 0.88)',
    padding: 8,
    gap: 8,
    justifyContent: 'space-between',
  },
  actionDockTop: {
    flex: 1,
    minHeight: 0,
    gap: 8,
    overflow: 'hidden',
  },
  actionDockBottom: {
    gap: 8,
  },
  replacementPrompt: {
    borderWidth: 1,
    borderColor: '#3c6776',
    borderRadius: 9,
    backgroundColor: 'rgba(10, 39, 52, 0.76)',
    paddingHorizontal: 8,
    paddingVertical: 7,
    gap: 6,
  },
  actionSummaryCard: {
    flex: 1,
    minHeight: 0,
    borderWidth: 1,
    borderColor: '#316374',
    borderRadius: 10,
    backgroundColor: 'rgba(10, 38, 52, 0.72)',
    paddingHorizontal: 8,
    paddingVertical: 7,
    gap: 4,
    overflow: 'hidden',
  },
  actionSummaryScroll: {
    flex: 1,
    minHeight: 0,
  },
  actionSummaryScrollContent: {
    gap: 4,
    paddingBottom: 2,
  },
  actionSummaryTitle: {
    color: '#d7f4ff',
    fontSize: 11,
    fontWeight: '800',
  },
  actionSummaryLine: {
    color: '#b9dcec',
    fontSize: 10,
    fontFamily: 'monospace',
  },
  actionSummaryEmpty: {
    color: '#83b3c6',
    fontSize: 10,
    fontFamily: 'monospace',
  },
  panel: {
    borderWidth: 1,
    borderColor: '#245564',
    borderRadius: 12,
    backgroundColor: 'rgba(9, 29, 40, 0.88)',
    padding: 10,
    gap: 6,
  },
  panelBlue: {
    borderWidth: 1,
    borderColor: '#447086',
    borderRadius: 12,
    backgroundColor: 'rgba(14, 39, 52, 0.95)',
    padding: 10,
    gap: 6,
  },
  opsScrollContent: { gap: 12, paddingBottom: 16, paddingTop: 10 },
  opsHeroCard: {
    borderWidth: 1,
    borderColor: '#4f7f95',
    borderRadius: 14,
    padding: 14,
    gap: 8,
  },
  opsHeroTitle: { color: '#f0fbff', fontSize: 22, fontWeight: '900' },
  opsHeroSub: { color: '#bde4f2', fontSize: 12, fontWeight: '700' },
  opsHeroGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  opsHeroItem: {
    minWidth: 130,
    flexGrow: 1,
    borderWidth: 1,
    borderColor: '#5b8596',
    borderRadius: 10,
    backgroundColor: 'rgba(8, 30, 43, 0.6)',
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 2,
  },
  opsHeroLabel: { color: '#a8d0de', fontSize: 10, fontWeight: '700' },
  opsHeroValue: { color: '#ebfcff', fontSize: 18, fontWeight: '900', fontFamily: 'monospace' },
  opsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, alignItems: 'flex-start' },
  opsGridCard: { flexBasis: 520, flexGrow: 1, minWidth: 320 },
  coachStatsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  coachStatTile: {
    flexBasis: 200,
    flexGrow: 1,
    minWidth: 178,
    borderWidth: 1,
    borderColor: '#4e7384',
    borderRadius: 8,
    backgroundColor: '#173847',
    paddingHorizontal: 8,
    paddingVertical: 7,
    gap: 5,
  },
  coachStatHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  coachStatRate: {
    color: '#e7f7ff',
    fontSize: 12,
    fontWeight: '900',
    fontFamily: 'monospace',
  },
  coachStatMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 6,
  },
  coachStatCount: {
    color: '#9fc3d3',
    fontSize: 10,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  coachStatRange: {
    color: '#9fc3d3',
    fontSize: 10,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  coachStatBenchmark: {
    fontSize: 10,
    fontWeight: '800',
    fontFamily: 'monospace',
  },
  coachStatBenchmarkPending: { color: '#a2b2bc' },
  coachStatBenchmarkInRange: { color: '#8fe0bf' },
  coachStatBenchmarkHigh: { color: '#f3bb86' },
  coachStatBenchmarkLow: { color: '#88b5ff' },
  coachStatTier: {
    fontSize: 10,
    fontWeight: '800',
  },
  coachStatTierLow: { color: '#b7c2c9' },
  coachStatTierMid: { color: '#e3d08e' },
  coachStatTierHigh: { color: '#8fe0bf' },
  missionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  missionResetBtn: {
    borderWidth: 1,
    borderColor: '#4f7f92',
    borderRadius: 8,
    backgroundColor: '#194153',
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  missionResetText: { color: '#e1f5ff', fontSize: 10, fontWeight: '700' },
  missionCard: {
    borderWidth: 1,
    borderColor: '#4d6f7f',
    borderRadius: 8,
    backgroundColor: '#15303d',
    padding: 8,
    gap: 3,
  },
  missionCardDone: {
    borderColor: '#4fae8a',
    backgroundColor: '#183c34',
  },
  missionTitle: { color: '#eef8ff', fontWeight: '900', fontSize: 12 },
  bankruptcyOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(3, 8, 14, 0.76)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
    zIndex: 40,
  },
  bankruptcyScroll: { width: '100%' },
  bankruptcyScrollContent: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 12 },
  bankruptcyCard: {
    width: '100%',
    maxWidth: 680,
    maxHeight: '94%',
    borderWidth: 1,
    borderColor: '#925e40',
    borderRadius: 14,
    backgroundColor: 'rgba(31, 17, 12, 0.97)',
    padding: 14,
    gap: 8,
  },
  bankruptcyTitle: { color: '#ffe3c7', fontSize: 19, fontWeight: '900' },
  bankruptcyText: { color: '#fff2e1', fontSize: 12, lineHeight: 18 },
  bankruptcyHint: { color: '#f2c899', fontSize: 11, fontWeight: '700' },
  bankruptcyCoachHint: { color: '#f3d7b5', fontSize: 11, lineHeight: 16 },
  bankruptcyActionRow: { flexDirection: 'row', gap: 8, alignItems: 'stretch', flexWrap: 'wrap' },
  bankruptcyActionBtn: {
    flex: 1,
    minWidth: 220,
    borderWidth: 1,
    borderColor: '#7f5a45',
    borderRadius: 9,
    backgroundColor: 'rgba(49, 26, 17, 0.9)',
    paddingHorizontal: 9,
    paddingVertical: 8,
    gap: 2,
  },
  bankruptcyActionTitle: { color: '#fff0df', fontSize: 11, fontWeight: '900' },
  bankruptcyActionSub: { color: '#f1caa2', fontSize: 10, fontWeight: '700' },
  drawerRoot: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  drawerBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(4, 8, 14, 0.6)',
  },
  drawerBackdropTouch: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  drawerPanel: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    width: '76%',
    maxWidth: 1180,
    minWidth: 360,
    borderWidth: 1,
    borderColor: '#3f6675',
    borderTopLeftRadius: 14,
    borderBottomLeftRadius: 14,
    backgroundColor: 'rgba(8, 22, 32, 0.98)',
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 6,
    gap: 6,
  },
  opsDrawerPanel: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    width: '100%',
    borderWidth: 1,
    borderColor: '#3a6272',
    backgroundColor: 'rgba(8, 22, 32, 0.99)',
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 10,
    gap: 8,
  },
  missionDrawerPanel: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    width: '33%',
    maxWidth: 460,
    minWidth: 300,
    borderWidth: 1,
    borderColor: '#4d6f7f',
    borderTopLeftRadius: 14,
    borderBottomLeftRadius: 14,
    backgroundColor: 'rgba(8, 22, 32, 0.98)',
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 6,
    gap: 6,
  },
  drawerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  drawerScroll: { flex: 1 },
  drawerScrollContent: { gap: 8, paddingBottom: 10, paddingTop: 8 },

  raiseRow: { gap: 6 },
  raiseValue: { color: '#d9f4ff', fontWeight: '800', fontFamily: 'monospace', fontSize: 12 },
  raiseSliderTrack: {
    height: 30,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#4f7191',
    backgroundColor: '#112f42',
    overflow: 'hidden',
    justifyContent: 'center',
    position: 'relative',
  },
  raiseSliderTrackDisabled: { opacity: 0.4 },
  raiseSliderFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
  },
  raiseSliderThumb: {
    position: 'absolute',
    top: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#e9f7ff',
    backgroundColor: '#4fb2d6',
    transform: [{ translateX: -11 }],
  },
  raiseSliderThumbAllIn: {
    borderColor: '#ffe7b3',
    backgroundColor: '#d9ab4a',
  },
  raiseMetaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  raiseMetaText: { color: '#90b9cb', fontSize: 11, fontWeight: '700' },
  raiseMetaTextHot: { color: '#ffdca1' },
  nextEventBtn: {
    borderWidth: 1,
    borderColor: '#46a4cf',
    borderRadius: 9,
    backgroundColor: '#184a62',
    paddingVertical: 7,
    alignItems: 'center',
  },
  nextEventBtnText: { color: '#e7f7ff', fontWeight: '800', fontSize: 11 },

  actionDanger: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#974f57',
    backgroundColor: '#4e1f28',
    paddingVertical: 8,
    alignItems: 'center',
  },
  actionMain: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#47a3d3',
    backgroundColor: '#164966',
    paddingVertical: 8,
    alignItems: 'center',
  },
  actionGold: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#c89a42',
    backgroundColor: '#624716',
    paddingVertical: 8,
    alignItems: 'center',
  },
  actionText: { color: '#fff8e9', fontWeight: '900', fontSize: 12 },

  secondary: {
    flex: 1,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: '#336878',
    backgroundColor: '#123241',
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: { color: '#ddf4ff', fontWeight: '700', fontSize: 11, textAlign: 'center', paddingHorizontal: 4 },
  primary: { borderRadius: 10, overflow: 'hidden' },
  primaryGrad: { alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 10 },
  primaryText: { color: '#ecfff8', fontSize: 12, fontWeight: '900', textAlign: 'center', paddingHorizontal: 6 },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: '#2f6a79',
    borderRadius: 999,
    backgroundColor: '#143846',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  chipOn: { borderColor: '#f8d78f', backgroundColor: '#4c3a1f' },
  chipText: { color: '#d7efff', fontSize: 11, fontWeight: '700' },

  adviceCompareRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', flexWrap: 'wrap' },
  adviceCompareCol: { flex: 1, minWidth: 280 },
  adviceBox: { borderWidth: 1, borderColor: '#48748a', borderRadius: 8, backgroundColor: '#163a4a', padding: 8, gap: 3 },
  adviceTitle: { color: '#eef8ff', fontWeight: '900' },
  adviceMain: { color: '#d8efff', fontWeight: '800', fontSize: 12 },
  algoBox: { borderWidth: 1, borderColor: '#4d6f7f', borderRadius: 8, backgroundColor: '#15303d', padding: 8, gap: 2 },
  insightGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  insightCardWide: {
    flexBasis: 620,
    flexGrow: 1,
    minWidth: 320,
    borderWidth: 1,
    borderColor: '#4c7281',
    borderRadius: 10,
    backgroundColor: '#143340',
    padding: 8,
    gap: 6,
  },
  insightCard: {
    flexBasis: 320,
    flexGrow: 1,
    minWidth: 280,
    borderWidth: 1,
    borderColor: '#4b6d7d',
    borderRadius: 10,
    backgroundColor: '#14303c',
    padding: 8,
    gap: 6,
  },
  stackBarTrack: {
    height: 14,
    borderRadius: 999,
    overflow: 'hidden',
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#385362',
    backgroundColor: '#102532',
  },
  stackBarHero: { height: '100%', backgroundColor: '#50c8f0' },
  stackBarTie: { height: '100%', backgroundColor: '#e6c879' },
  stackBarVillain: { height: '100%', backgroundColor: '#7a879b' },
  stackLegendRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  stackLegendText: { color: '#b6d0db', fontSize: 10, fontWeight: '700' },
  meterRow: { gap: 4 },
  meterHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  meterTrack: {
    height: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#36505f',
    overflow: 'hidden',
    backgroundColor: '#0f2430',
  },
  meterFill: { height: '100%' },
  outsRow: {
    borderWidth: 1,
    borderColor: '#416173',
    borderRadius: 8,
    backgroundColor: '#173746',
    paddingHorizontal: 7,
    paddingVertical: 6,
    gap: 2,
  },
  outsRowTitle: { color: '#e2f5ff', fontSize: 11, fontWeight: '800' },
  rangeSampleWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 },
  rangeSamplePill: {
    borderWidth: 1,
    borderColor: '#4f7384',
    borderRadius: 999,
    backgroundColor: '#193847',
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexDirection: 'row',
    gap: 5,
  },
  rangeSampleText: { color: '#d9efff', fontSize: 11, fontWeight: '700' },
  rangeSampleTextMuted: { color: '#9dc3d4', fontSize: 10, fontWeight: '700' },

  noteCard: { borderWidth: 1, borderColor: '#3c6d55', borderRadius: 10, backgroundColor: 'rgba(18, 45, 32, 0.84)', padding: 10, gap: 3 },

  text: { color: '#eefcf6', fontWeight: '800' },
  textMuted: { color: '#c8e3ee', fontSize: 12 },
  textTiny: { color: '#c6dff1', fontSize: 11 },
  dim: { opacity: 0.45 },
});
