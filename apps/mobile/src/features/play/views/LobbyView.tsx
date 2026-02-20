// @ts-nocheck
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { SafeAreaView, ScrollView, Text, TouchableOpacity, View } from 'react-native';

import { BottomTabBar } from '../../../components/navigation/BottomTabBar';
import { trainingZones } from '../../../data/zones';
import type { RootTab, RootTabItem } from '../../../navigation/rootTabs';

import * as Play from '../index';

const {
  BIG_BLIND_SIZE,
  HERO_SEAT,
  NAV_COLLAPSED_WIDTH,
  NAV_DRAWER_WIDTH,
  PRACTICE_XP_MULTIPLIER,
  STARTING_STACK,
  appLanguageLabels,
  appLanguages,
  l,
  styles,
  syncZoneTrainingState,
  t,
  zoneName,
  zoneSubtitle,
  zoneUnlockHint,
} = Play;

type AppLanguage = Play.AppLanguage;
type TrainingMode = Play.TrainingMode;
type ZoneTrainingState = Play.ZoneTrainingState;

type LobbyZoneStats = {
  handsPlayed: number;
  handsWon: number;
  handsTied: number;
};

type LobbyViewProps = {
  activeProfile: { displayName: string } | null;
  aiVoiceAssistEnabled: boolean;
  appLanguage: AppLanguage;
  appLanguageLabel: string;
  compactLobby: boolean;
  lobbyArchetypes: string;
  lobbyAvgSkill: number;
  lobbySettingsOpen: boolean;
  lobbyUnlockHint: string;
  lobbyZone: number;
  lobbyZoneBb: number;
  lobbyZoneFocus: string[];
  lobbyZoneLocked: boolean;
  lobbyZoneMissionDone: number;
  lobbyZoneName: string;
  lobbyZoneProfitBb: number;
  lobbyZoneRecord: string;
  lobbyZoneState: ZoneTrainingState;
  lobbyZoneStats: LobbyZoneStats;
  lobbyZoneSub: string;
  lobbyZoneWinRate: number;
  navCollapsedOffset: number;
  navDrawerOpen: boolean;
  navExpandedOffset: number;
  navSafeInsetLeft: number;
  note: string;
  politeMode: boolean;
  progress: { xp: number; handsPlayed: number };
  rootTab: RootTab;
  rootTabItems: RootTabItem[];
  seats: Play.Seat[];
  sfxEnabled: boolean;
  trainingMode: TrainingMode;
  unlockedIdx: number;
  unlockedZoneName: string;
  zoneCareerXpFactor: number;
  zoneTrainingById: Record<string, ZoneTrainingState>;
  enterTable: (zoneIndex: number) => void;
  handleRootTabChange: (tab: RootTab) => void;
  setAiVoiceAssistEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  setAppLanguage: React.Dispatch<React.SetStateAction<AppLanguage>>;
  setLobbySettingsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setLobbyZone: React.Dispatch<React.SetStateAction<number>>;
  setNavDrawerOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setNote: React.Dispatch<React.SetStateAction<string>>;
  setPoliteMode: React.Dispatch<React.SetStateAction<boolean>>;
  setSfxEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  setTrainingMode: React.Dispatch<React.SetStateAction<TrainingMode>>;
};

export function LobbyView(props: LobbyViewProps) {
  const {
    activeProfile,
    aiVoiceAssistEnabled,
    appLanguage,
    appLanguageLabel,
    compactLobby,
    lobbyArchetypes,
    lobbyAvgSkill,
    lobbySettingsOpen,
    lobbyUnlockHint,
    lobbyZone,
    lobbyZoneBb,
    lobbyZoneFocus,
    lobbyZoneLocked,
    lobbyZoneMissionDone,
    lobbyZoneName,
    lobbyZoneProfitBb,
    lobbyZoneRecord,
    lobbyZoneState,
    lobbyZoneStats,
    lobbyZoneSub,
    lobbyZoneWinRate,
    navCollapsedOffset,
    navDrawerOpen,
    navExpandedOffset,
    navSafeInsetLeft,
    note,
    politeMode,
    progress,
    rootTab,
    rootTabItems,
    seats,
    sfxEnabled,
    trainingMode,
    unlockedIdx,
    unlockedZoneName,
    zoneCareerXpFactor,
    zoneTrainingById,
    enterTable,
    handleRootTabChange,
    setAiVoiceAssistEnabled,
    setAppLanguage,
    setLobbySettingsOpen,
    setLobbyZone,
    setNavDrawerOpen,
    setNote,
    setPoliteMode,
    setSfxEnabled,
    setTrainingMode,
  } = props;

  const onEnterTable = () => enterTable(lobbyZone);

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
                  <Text key={`${lobbyZone}-focus-${focus}`} style={[styles.lobbyFocusLine, compactLobby && styles.lobbyFocusLineCompact]} numberOfLines={1}>
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
