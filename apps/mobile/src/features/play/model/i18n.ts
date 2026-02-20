import { leakLabels } from '../../../data/zones';
import type { HeroLeak, TrainingZone } from '../../../types/poker';

import type { AppLanguage, OppLeakGuess } from './types';

export const heroLeakLabelsByLanguage: Record<AppLanguage, Record<HeroLeak, string>> = {
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
export const oppLeakLabelsByLanguage: Record<AppLanguage, Record<OppLeakGuess, string>> = {
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
export const appLanguages: AppLanguage[] = ['zh-TW', 'zh-CN', 'en-US'];
export const appLanguageLabels: Record<AppLanguage, string> = {
  'zh-TW': '繁體中文',
  'zh-CN': '简体中文',
  'en-US': 'English',
};
export const uiTranslations: Record<AppLanguage, Record<string, string>> = {
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
export const zoneTranslations: Record<AppLanguage, Record<string, { name: string; subtitle: string; recommendedFocus: string[] }>> = {
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
export const missionTitleTranslations: Record<string, { 'zh-CN': string; 'en-US': string }> = {
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
export const missionDetailTranslations: Record<string, { 'zh-CN': string; 'en-US': string }> = {
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
export type UiTranslationKey = keyof typeof uiTranslations['zh-TW'];

export function t(language: AppLanguage, key: UiTranslationKey, vars?: Record<string, string | number>): string {
  const template = uiTranslations[language]?.[key] ?? uiTranslations['zh-TW'][key] ?? key;
  if (!vars) {
    return template;
  }
  return template.replace(/\{(\w+)\}/g, (_, token) => {
    const value = vars[token];
    return value === undefined || value === null ? '' : String(value);
  });
}

export function l(language: AppLanguage, zhTW: string, zhCN: string, enUS: string): string {
  if (language === 'zh-CN') return zhCN;
  if (language === 'en-US') return enUS;
  return zhTW;
}

export function containsCjk(text: string): boolean {
  return /[\u3400-\u9fff]/.test(text);
}

export const zhTwToCnCharMap: Record<string, string> = {
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

export function toSimplified(text: string): string {
  let next = text;
  Object.entries(zhTwToCnCharMap).forEach(([from, to]) => {
    next = next.split(from).join(to);
  });
  return next;
}

export function rt(text: string, language: AppLanguage, enFallback?: string): string {
  if (language === 'zh-TW') return text;
  if (language === 'zh-CN') return toSimplified(text);
  if (!containsCjk(text)) return text;
  return enFallback ?? 'Localized summary pending.';
}

export function localizedZone(zone: TrainingZone, language: AppLanguage): { name: string; subtitle: string; recommendedFocus: string[] } {
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

export function zoneName(zone: TrainingZone, language: AppLanguage): string {
  return localizedZone(zone, language).name;
}

export function zoneSubtitle(zone: TrainingZone, language: AppLanguage): string {
  return localizedZone(zone, language).subtitle;
}

export function zoneFocus(zone: TrainingZone, language: AppLanguage): string[] {
  return localizedZone(zone, language).recommendedFocus;
}

export function oppLeakLabel(leak: OppLeakGuess, language: AppLanguage): string {
  return oppLeakLabelsByLanguage[language]?.[leak] ?? oppLeakLabelsByLanguage['zh-TW'][leak];
}

export function heroLeakLabel(leak: HeroLeak, language: AppLanguage): string {
  return heroLeakLabelsByLanguage[language]?.[leak] ?? heroLeakLabelsByLanguage['zh-TW'][leak];
}

export function missionTitle(title: string, language: AppLanguage): string {
  if (language === 'zh-TW') return title;
  return missionTitleTranslations[title]?.[language] ?? title;
}

export function missionDetail(detail: string, language: AppLanguage): string {
  if (language === 'zh-TW') return detail;
  return missionDetailTranslations[detail]?.[language] ?? detail;
}
