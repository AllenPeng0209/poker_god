// @ts-nocheck
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import * as Speech from 'expo-speech';
import React, { useCallback, useEffect } from 'react';

import { trainingZones } from '../../../data/zones';
import { analyzeCurrentSpot, createNewHand } from '../../../engine/game';
import { buildSpotInsight } from '../../../engine/insights';
import { buildLocalCoachSummary, requestCoachVoiceAdvice } from '../../../engine/qwenCoach';
import {
  countRecordedHands,
  ensureDefaultProfile,
  initializeLocalDb,
  listRecordedZoneHandStats,
  loadProfileSnapshot,
} from '../../../storage/localDb';
import type { LocalProfile } from '../../../storage/localDb';
import type { HandState, ProgressState } from '../../../types/poker';

import * as Play from '../index';

type AppLanguage = Play.AppLanguage;
type OppLeakGuess = Play.OppLeakGuess;
type Phase = Play.Phase;
type SfxKey = Play.SfxKey;
type Seat = Play.Seat;
type SeatVisual = Play.SeatVisual;
type TrainingMode = Play.TrainingMode;
type ZoneTrainingState = Play.ZoneTrainingState;

type SetState<T> = React.Dispatch<React.SetStateAction<T>>;

const {
  APP_SNAPSHOT_SCHEMA_VERSION,
  SFX_VARIANTS,
  STARTING_STACK,
  HERO_SEAT,
  buildSeatVisualMap,
  createEmptySfxMap,
  l,
  mergeZoneTrainingWithRecordedStats,
  normalizeAppLanguage,
  normalizeProgressSnapshot,
  normalizeTrainingMode,
  normalizeZoneIndex,
  restoreSeatsFromSnapshot,
  restoreZoneTrainingById,
  rt,
  syncZoneTrainingState,
} = Play;

export type UsePlayEffectsParams = {
  activeProfile: LocalProfile | null;
  aiVoiceAssistEnabled: boolean;
  analysis: ReturnType<typeof analyzeCurrentSpot>;
  analysisOpen: boolean;
  appLanguage: AppLanguage;
  hand: HandState;
  heroTurnSpotKey: string;
  isHeroTurn: boolean;
  localDbReady: boolean;
  recentActionLines: string[];
  snapshotSaveTimerRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>;
  soundsRef: React.MutableRefObject<Record<SfxKey, Audio.Sound[]>>;
  spotInsight: ReturnType<typeof buildSpotInsight>;
  autoPlayTimerRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>;
  bankruptcyCountdownTimerRef: React.MutableRefObject<ReturnType<typeof setInterval> | null>;
  bankruptcyReturnTimerRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>;
  aiCoachAbortRef: React.MutableRefObject<AbortController | null>;
  aiCoachAudioTempUrisRef: React.MutableRefObject<string[]>;
  aiCoachSpotRef: React.MutableRefObject<string>;
  aiCoachVoiceSoundRef: React.MutableRefObject<Audio.Sound | null>;
  setActionFeed: SetState<string[]>;
  setActiveProfile: SetState<LocalProfile | null>;
  setAiVoiceAssistEnabled: SetState<boolean>;
  setAiVoiceBusy: SetState<boolean>;
  setAiVoiceLastAdvice: SetState<string>;
  setAnalysisOpen: SetState<boolean>;
  setAppLanguage: SetState<AppLanguage>;
  setAutoPlayEvents: SetState<boolean>;
  setBattleSeatId: SetState<string | null>;
  setButtonSeatId: SetState<string>;
  setDisplayedBoardCount: SetState<number>;
  setEventQueue: SetState<Play.TableEvent[]>;
  setEventSeed: SetState<number>;
  setHand: SetState<HandState>;
  setHandRecordCount: SetState<number>;
  setLeakGuess: SetState<OppLeakGuess | null>;
  setLocalDbReady: SetState<boolean>;
  setLobbySettingsOpen: SetState<boolean>;
  setLobbyZone: SetState<number>;
  setMissionOpen: SetState<boolean>;
  setNote: SetState<string>;
  setOpsOpen: SetState<boolean>;
  setPhase: SetState<Phase>;
  setPoliteMode: SetState<boolean>;
  setProgress: SetState<ProgressState>;
  setRaiseAmount: SetState<number>;
  setSeatVisual: SetState<Record<string, SeatVisual>>;
  setSeats: SetState<Seat[]>;
  setSelectedSeatId: SetState<string>;
  setSfxEnabled: SetState<boolean>;
  setSfxLoadError: SetState<boolean>;
  setSfxReady: SetState<boolean>;
  setTableFeed: SetState<string[]>;
  setTrainingMode: SetState<TrainingMode>;
  setVoiceDrawerOpen: SetState<boolean>;
  setZoneIndex: SetState<number>;
  setZoneTrainingById: SetState<Record<string, ZoneTrainingState>>;
};

export function usePlayEffects(params: UsePlayEffectsParams) {
  const {
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
  } = params;

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
        setVoiceDrawerOpen(false);
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
}