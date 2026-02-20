import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import * as Speech from 'expo-speech';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, DimensionValue, Easing, GestureResponderEvent, LayoutChangeEvent, Platform, SafeAreaView, ScrollView, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';

import { BottomTabBar } from '../../components/navigation/BottomTabBar';
import { trainingZones } from '../../data/zones';
import { analyzeCurrentSpot, applyHeroAction, createNewHand } from '../../engine/game';
import { accumulateHeroStats, statRatePercent } from '../../engine/heroStats';
import type { HeroStatsSnapshot } from '../../engine/heroStats';
import { buildSpotInsight } from '../../engine/insights';
import { buildLocalCoachSummary, requestCoachVoiceAdvice } from '../../engine/qwenCoach';
import { applyDecisionResult, applyHandResult, getTopLeak, initialProgress, winRate } from '../../engine/progression';
import type { RootTab, RootTabItem } from '../../navigation/rootTabs';
import { LearnScreen } from '../../screens/LearnScreen';
import { ProfileScreen } from '../../screens/ProfileScreen';
import { ReviewScreen } from '../../screens/ReviewScreen';
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
} from '../../storage/localDb';
import type { HandRecordDetail, HandRecordSummary, LocalProfile } from '../../storage/localDb';
import { ActionType, AiProfile, HandState, ProgressState, Street, TablePosition } from '../../types/poker';

import * as Play from './index';
import { usePlayDecisionActions } from './hooks/usePlayDecisionActions';
import { usePlayEffects } from './hooks/usePlayEffects';
import { useReplayFromReview } from './hooks/useReplayFromReview';
import { useReviewRecords } from './hooks/useReviewRecords';
import { usePlayTableActions } from './hooks/usePlayTableActions';
import { LobbyView } from './views/LobbyView';
import { RootTabView } from './views/RootTabView';
import { TableView } from './views/TableView';

const {
  ACTION_FEED_LIMIT, APP_SNAPSHOT_SCHEMA_VERSION, BANKRUPTCY_RETURN_DELAY_MS, BIG_BLIND_SIZE, HERO_SEAT, LOAN_BB,
  LOAN_REPAY_RATE, NAV_COLLAPSED_WIDTH, NAV_DRAWER_WIDTH, NAV_IOS_LANDSCAPE_SAFE_LEFT, PRACTICE_XP_MULTIPLIER,
  SFX_VARIANTS, STARTING_BB, STARTING_STACK, SUBSIDY_BB, Advice, CardView, CoachStatTile, EMPTY_SPOT_INSIGHT,
  PercentMeter, actionDisplayText, actionSfxKey, addXp, appLanguageLabels, appLanguages, applyXpMultiplier,
  applyZoneMissionUpdates, bbToChips, buildHandBankrollForMode, buildSeatVisualMap, careerXpMultiplier, chipsToBb,
  clamp, cloneProgressState, createEmptySfxMap, createHeroTurnSpotKey, createZoneTrainingState, eventDelayMs,
  extractBankrollFromHand, initialSeatsForApp, initialZoneTrainingState, l, localDateKey, makeSeats,
  mergeZoneTrainingWithRecordedStats, mission, missionDetail, missionTitle, heroLeakLabel, nextEventId,
  normalizeAppLanguage, normalizeProgressSnapshot, normalizeStackValue, normalizeTrainingMode, normalizeZoneIndex,
  oppLeakKeys, oppLeakLabel, pickAi, positionRelativeToButton, readWebEntryConfig, resolveLobbyZoneStats,
  resolveXpMultiplier, restoreSeatsFromRecordedHand, restoreSeatsFromSnapshot, restoreZoneTrainingById, rt,
  seatLayout, seatName, serializeSeatsForSnapshot, shortName, streetBoardCount, styles, syncZoneTrainingState, t,
  tableOrder, unlockedZone, unlockedZoneByXp, winRateFromCounts, zoneFocus, zoneMissionsCompleted, zoneName,
  zoneSubtitle, zoneUnlockHint, coachStatsSummary,
} = Play;

type Phase = Play.Phase;
type OppLeakGuess = Play.OppLeakGuess;
type SfxKey = Play.SfxKey;
type TableEventKind = Play.TableEventKind;
type TrainingMode = Play.TrainingMode;
type AppLanguage = Play.AppLanguage;
type Seat = Play.Seat;
type SeatVisual = Play.SeatVisual;
type ZoneTrainingState = Play.ZoneTrainingState;
type TableEvent = Play.TableEvent;
type PersistedAppSnapshot = Play.PersistedAppSnapshot;

export default function PlayApp() {
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
  const [voiceDrawerOpen, setVoiceDrawerOpen] = useState(false);
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
  const voiceTranslateX = useRef(new Animated.Value(760)).current;
  const voiceBackdropOpacity = useRef(new Animated.Value(0)).current;
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
  const aiVoiceBroadcastText = aiVoiceBusy
    ? l(appLanguage, 'AI 語音助手分析中...', 'AI 语音助手分析中...', 'AI voice assistant is analyzing...')
    : aiVoiceLastAdvice
      ? l(appLanguage, `AI 語音助手：${rt(aiVoiceLastAdvice, appLanguage, 'Voice suggestion available.')}`, `AI 语音助手：${rt(aiVoiceLastAdvice, appLanguage, 'Voice suggestion available.')}`, `AI voice assistant: ${rt(aiVoiceLastAdvice, appLanguage, 'Voice suggestion available.')}`)
      : l(appLanguage, 'AI 語音助手待命中（輪到你時自動播報）', 'AI 语音助手待命中（轮到你时自动播报）', 'AI voice assistant standing by (auto on your turn)');
  const heroTurnSpotKey = useMemo(() => createHeroTurnSpotKey(hand), [hand]);

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
    setVoiceDrawerOpen(false);
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

  const { loadReviewRecords, handleReviewSelect } = useReviewRecords({
    activeProfile,
    localDbReady,
    reviewSelectedId,
    setReviewLoading,
    setReviewRecords,
    setReviewSelectedDetail,
    setReviewSelectedId,
  });

  usePlayEffects({
    activeProfile,
    aiVoiceAssistEnabled,
    analysis,
    analysisOpen,
    appLanguage,
    hand,
    heroTurnSpotKey,
    isHeroTurn,
    localDbReady,
    recentActionLines,
    snapshotSaveTimerRef,
    soundsRef,
    spotInsight,
    autoPlayTimerRef,
    bankruptcyCountdownTimerRef,
    bankruptcyReturnTimerRef,
    aiCoachAbortRef,
    aiCoachAudioTempUrisRef,
    aiCoachSpotRef,
    aiCoachVoiceSoundRef,
    setActionFeed,
    setActiveProfile,
    setAiVoiceAssistEnabled,
    setAiVoiceBusy,
    setAiVoiceLastAdvice,
    setAnalysisOpen,
    setAppLanguage,
    setAutoPlayEvents,
    setBattleSeatId,
    setButtonSeatId,
    setDisplayedBoardCount,
    setEventQueue,
    setEventSeed,
    setHand,
    setHandRecordCount,
    setLeakGuess,
    setLocalDbReady,
    setLobbySettingsOpen,
    setLobbyZone,
    setMissionOpen,
    setNote,
    setOpsOpen,
    setPhase,
    setPoliteMode,
    setProgress,
    setRaiseAmount,
    setSeatVisual,
    setSeats,
    setSelectedSeatId,
    setSfxEnabled,
    setSfxLoadError,
    setSfxReady,
    setTableFeed,
    setTrainingMode,
    setVoiceDrawerOpen,
    setZoneIndex,
    setZoneTrainingById,
  });

  useEffect(() => setRaiseAmount((v) => clamp(v, minRaise, raiseCap)), [minRaise, raiseCap]);

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
    setVoiceDrawerOpen(false);
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
    Animated.parallel([
      Animated.timing(voiceTranslateX, {
        toValue: voiceDrawerOpen ? 0 : 760,
        duration: voiceDrawerOpen ? 230 : 190,
        easing: voiceDrawerOpen ? Easing.out(Easing.cubic) : Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(voiceBackdropOpacity, {
        toValue: voiceDrawerOpen ? 1 : 0,
        duration: voiceDrawerOpen ? 230 : 190,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    ]).start();
  }, [voiceBackdropOpacity, voiceDrawerOpen, voiceTranslateX]);

  const engineLabel =
    analysis.gto.source === 'preflop_cfr'
      ? l(appLanguage, '本地 Preflop HU-CFR', '本地 Preflop HU-CFR', 'Local Preflop HU-CFR')
      : analysis.gto.source === 'postflop_cfr'
        ? l(appLanguage, '本地 Postflop 抽象 CFR', '本地 Postflop 抽象 CFR', 'Local Postflop Abstract CFR')
        : l(appLanguage, '啟發式', '启发式', 'Heuristic');

  const {
    addPendingReplacementPlayers,
    applyCareerBankruptcyRescue,
    applyTableEvent,
    buildHandOpeningEvents,
    buildTransitionEvents,
    continueInPracticeMode,
    enqueueTableEvents,
    enterTable,
    handleRaiseSliderGesture,
    handleRaiseSliderLayout,
    handleSeatTap,
    handleTableScreenLayout,
    resetZoneTrainingState,
    runNextEvent,
    skipPendingReplacementPlayers,
    stackText,
    startHand,
  } = usePlayTableActions({
    appLanguage,
    autoPlayEvents,
    autoPlayTimerRef,
    battleSeatId,
    buttonSeatId,
    canRaise,
    chipPulse,
    closeBankruptcyOverlay,
    eventQueue,
    eventSeed,
    hand,
    minRaise,
    progress,
    raiseAmount,
    raiseCap,
    raiseRange,
    raiseSliderWidth,
    seats,
    selectedSeatId,
    sfxEnabled,
    sfxReady,
    soundsRef,
    seatPulse,
    trainingMode,
    unlockedIdx,
    unlockedZoneName,
    zone,
    zoneBankroll,
    zoneIndex,
    zoneTrainingById,
    setActionFeed,
    setActiveSeatAnimId,
    setBattleSeatId,
    setButtonSeatId,
    setDisplayedBoardCount,
    setEventQueue,
    setEventSeed,
    setHand,
    setLeakGuess,
    setLobbyZone,
    setNote,
    setPendingReplacementSeatIds,
    setPhase,
    setRaiseAmount,
    setRaiseSliderWidth,
    setSeatVisual,
    setSeats,
    setSelectedSeatId,
    setTableFeed,
    setTableViewportWidth,
    setTrainingMode,
    setZoneIndex,
    setZoneTrainingById,
  });

  const { handleReplayFromReview } = useReplayFromReview({
    activeProfile,
    appLanguage,
    buildHandOpeningEvents,
    closeTransientPanels,
    enqueueTableEvents,
    localDbReady,
    reviewSelectedDetail,
    zoneIndex,
    setActionFeed,
    setAutoPlayEvents,
    setBattleSeatId,
    setButtonSeatId,
    setDisplayedBoardCount,
    setEventQueue,
    setHand,
    setLeakGuess,
    setLobbyZone,
    setNote,
    setPendingReplacementSeatIds,
    setPhase,
    setRaiseAmount,
    setReviewLoading,
    setReviewSelectedDetail,
    setReviewSelectedId,
    setRootTab,
    setSeatVisual,
    setSeats,
    setSelectedSeatId,
    setTableFeed,
    setZoneIndex,
  });

  const { doAction, verifyLeak } = usePlayDecisionActions({
    activeProfile,
    activeXpFactor,
    appLanguage,
    battleSeatId,
    hasPendingEvent,
    hand,
    heroAllIn,
    leakGuess,
    localDbReady,
    phase,
    politeMode,
    progress,
    raiseAmount,
    seats,
    selectedSeat,
    selectedSeatId,
    trainingMode,
    zone,
    zoneIndex,
    zoneTrainingById,
    applyTableEvent,
    buildTransitionEvents,
    enqueueTableEvents,
    setBattleSeatId,
    setHand,
    setHandRecordCount,
    setNote,
    setPendingReplacementSeatIds,
    setProgress,
    setSeatVisual,
    setSeats,
    setSelectedSeatId,
    setZoneTrainingById,
  });

  if (rootTab !== 'play') {
    return (
      <RootTabView
        activeProfile={activeProfile}
        aiVoiceAssistEnabled={aiVoiceAssistEnabled}
        appLanguage={appLanguage}
        currentZoneFocus={zoneFocus(zone, appLanguage)}
        handRecordCount={handRecordCount}
        navCollapsedOffset={navCollapsedOffset}
        navDrawerOpen={navDrawerOpen}
        navExpandedOffset={navExpandedOffset}
        navSafeInsetLeft={navSafeInsetLeft}
        politeMode={politeMode}
        progress={progress}
        reviewLoading={reviewLoading}
        reviewRecords={reviewRecords}
        reviewSelectedDetail={reviewSelectedDetail}
        reviewSelectedId={reviewSelectedId}
        rootTab={rootTab}
        rootTabItems={rootTabItems}
        sfxEnabled={sfxEnabled}
        topLeak={topLeak}
        zoneDisplayName={zoneDisplayName}
        handleResumePlay={handleResumePlay}
        handleRootTabChange={handleRootTabChange}
        handleReplayFromReview={handleReplayFromReview}
        handleReviewSelect={handleReviewSelect}
        loadReviewRecords={loadReviewRecords}
        setAiVoiceAssistEnabled={setAiVoiceAssistEnabled}
        setAppLanguage={setAppLanguage}
        setNavDrawerOpen={setNavDrawerOpen}
        setNote={setNote}
        setPoliteMode={setPoliteMode}
        setSfxEnabled={setSfxEnabled}
      />
    );
  }

  if (phase === 'lobby') {
    return (
      <LobbyView
        activeProfile={activeProfile}
        aiVoiceAssistEnabled={aiVoiceAssistEnabled}
        appLanguage={appLanguage}
        appLanguageLabel={appLanguageLabel}
        compactLobby={compactLobby}
        lobbyArchetypes={lobbyArchetypes}
        lobbyAvgSkill={lobbyAvgSkill}
        lobbySettingsOpen={lobbySettingsOpen}
        lobbyUnlockHint={lobbyUnlockHint}
        lobbyZone={lobbyZone}
        lobbyZoneBb={lobbyZoneBb}
        lobbyZoneFocus={lobbyZoneFocus}
        lobbyZoneLocked={lobbyZoneLocked}
        lobbyZoneMissionDone={lobbyZoneMissionDone}
        lobbyZoneName={lobbyZoneName}
        lobbyZoneProfitBb={lobbyZoneProfitBb}
        lobbyZoneRecord={lobbyZoneRecord}
        lobbyZoneState={lobbyZoneState}
        lobbyZoneStats={lobbyZoneStats}
        lobbyZoneSub={lobbyZoneSub}
        lobbyZoneWinRate={lobbyZoneWinRate}
        navCollapsedOffset={navCollapsedOffset}
        navDrawerOpen={navDrawerOpen}
        navExpandedOffset={navExpandedOffset}
        navSafeInsetLeft={navSafeInsetLeft}
        note={note}
        politeMode={politeMode}
        progress={progress}
        rootTab={rootTab}
        rootTabItems={rootTabItems}
        seats={seats}
        sfxEnabled={sfxEnabled}
        trainingMode={trainingMode}
        unlockedIdx={unlockedIdx}
        unlockedZoneName={unlockedZoneName}
        zoneCareerXpFactor={zoneCareerXpFactor}
        zoneTrainingById={zoneTrainingById}
        enterTable={enterTable}
        handleRootTabChange={handleRootTabChange}
        setAiVoiceAssistEnabled={setAiVoiceAssistEnabled}
        setAppLanguage={setAppLanguage}
        setLobbySettingsOpen={setLobbySettingsOpen}
        setLobbyZone={setLobbyZone}
        setNavDrawerOpen={setNavDrawerOpen}
        setNote={setNote}
        setPoliteMode={setPoliteMode}
        setSfxEnabled={setSfxEnabled}
        setTrainingMode={setTrainingMode}
      />
    );
  }

  return (
    <TableView
      activeProfile={activeProfile}
      activeSeatAnimId={activeSeatAnimId}
      activeXpFactor={activeXpFactor}
      aiVoiceAssistEnabled={aiVoiceAssistEnabled}
      aiVoiceBroadcastText={aiVoiceBroadcastText}
      analysis={analysis}
      analysisDrawerWidth={analysisDrawerWidth}
      analysisOpen={analysisOpen}
      appLanguage={appLanguage}
      autoPlayEvents={autoPlayEvents}
      battleSeat={battleSeat}
      battleSeatId={battleSeatId}
      bankruptcyCountdown={bankruptcyCountdown}
      bankruptcyPromptOpen={bankruptcyPromptOpen}
      bankruptcyPromptText={bankruptcyPromptText}
      callOrCheck={callOrCheck}
      canClaimSubsidyToday={canClaimSubsidyToday}
      canHeroActNow={canHeroActNow}
      canRaise={canRaise}
      chipPulse={chipPulse}
      completedMissionCount={completedMissionCount}
      drawerBackdropOpacity={drawerBackdropOpacity}
      drawerTranslateX={drawerTranslateX}
      engineLabel={engineLabel}
      eventQueue={eventQueue}
      hand={hand}
      handRecordCount={handRecordCount}
      hasPendingEvent={hasPendingEvent}
      headerHeroBb={headerHeroBb}
      headerHeroStack={headerHeroStack}
      heroEquityEdge={heroEquityEdge}
      holes={holes}
      isAllInRaise={isAllInRaise}
      leakGuess={leakGuess}
      minRaise={minRaise}
      missionBackdropOpacity={missionBackdropOpacity}
      missionOpen={missionOpen}
      missionTranslateX={missionTranslateX}
      navCollapsedOffset={navCollapsedOffset}
      navDrawerOpen={navDrawerOpen}
      navExpandedOffset={navExpandedOffset}
      navSafeInsetLeft={navSafeInsetLeft}
      note={note}
      opsBackdropOpacity={opsBackdropOpacity}
      opsOpen={opsOpen}
      opsTranslateX={opsTranslateX}
      pendingReplacementSeatIds={pendingReplacementSeatIds}
      politeMode={politeMode}
      progress={progress}
      raiseAmount={raiseAmount}
      raiseCap={raiseCap}
      raiseSliderPercent={raiseSliderPercent}
      recentActionLines={recentActionLines}
      rootTab={rootTab}
      rootTabItems={rootTabItems}
      seatPulse={seatPulse}
      seatVisual={seatVisual}
      seats={seats}
      selectedSeat={selectedSeat}
      selectedSeatDisplayPos={selectedSeatDisplayPos}
      selectedSeatId={selectedSeatId}
      sfxEnabled={sfxEnabled}
      sfxLoadError={sfxLoadError}
      sfxReady={sfxReady}
      soundsRef={soundsRef}
      spotInsight={spotInsight}
      tableFeed={tableFeed}
      topLeak={topLeak}
      trainingMode={trainingMode}
      visibleBoard={visibleBoard}
      voiceBackdropOpacity={voiceBackdropOpacity}
      voiceDrawerOpen={voiceDrawerOpen}
      voiceTranslateX={voiceTranslateX}
      zoneCareerXpFactor={zoneCareerXpFactor}
      zoneDisplayName={zoneDisplayName}
      zoneHeroBb={zoneHeroBb}
      zoneHeroStack={zoneHeroStack}
      zoneLoanDebtBb={zoneLoanDebtBb}
      zoneProfitBb={zoneProfitBb}
      zoneStatsCoachNote={zoneStatsCoachNote}
      zoneTrainingState={zoneTrainingState}
      zoneVpipPfrGap={zoneVpipPfrGap}
      applyCareerBankruptcyRescue={applyCareerBankruptcyRescue}
      continueInPracticeMode={continueInPracticeMode}
      doAction={doAction}
      handleRaiseSliderGesture={handleRaiseSliderGesture}
      handleRaiseSliderLayout={handleRaiseSliderLayout}
      handleRootTabChange={handleRootTabChange}
      handleSeatTap={handleSeatTap}
      handleTableScreenLayout={handleTableScreenLayout}
      resetZoneTrainingState={resetZoneTrainingState}
      returnToLobbyAfterBankruptcy={returnToLobbyAfterBankruptcy}
      runNextEvent={runNextEvent}
      setAiVoiceAssistEnabled={setAiVoiceAssistEnabled}
      setAnalysisOpen={setAnalysisOpen}
      setAutoPlayEvents={setAutoPlayEvents}
      setLeakGuess={setLeakGuess}
      setMissionOpen={setMissionOpen}
      setNavDrawerOpen={setNavDrawerOpen}
      setNote={setNote}
      setOpsOpen={setOpsOpen}
      setPhase={setPhase}
      setPoliteMode={setPoliteMode}
      setSfxEnabled={setSfxEnabled}
      setVoiceDrawerOpen={setVoiceDrawerOpen}
      stackText={stackText}
      startHand={startHand}
      verifyLeak={verifyLeak}
    />
  );
}
