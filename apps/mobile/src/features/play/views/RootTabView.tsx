import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useMemo, useState } from 'react';
import { SafeAreaView, Text, TouchableOpacity, View } from 'react-native';

import { BottomTabBar } from '../../../components/navigation/BottomTabBar';
import type { RootTab, RootTabItem } from '../../../navigation/rootTabs';
import { LearnScreen } from '../../../screens/LearnScreen';
import { ProfileScreen } from '../../../screens/ProfileScreen';
import { ReviewScreen } from '../../../screens/ReviewScreen';
import type { HandRecordDetail, HandRecordSummary, LocalProfile } from '../../../storage/localDb';
import type { ProgressState } from '../../../types/poker';

import { fetchCoachConversionBlockers, type MobileCoachConversionBlockersResponse } from '../services/coachConversionBlockersApi';
import * as Play from '../index';

const {
  NAV_COLLAPSED_WIDTH,
  NAV_DRAWER_WIDTH,
  appLanguageLabels,
  appLanguages,
  heroLeakLabel,
  l,
  mission,
  styles,
  t,
} = Play;

type AppLanguage = Play.AppLanguage;

type RootTabViewProps = {
  activeProfile: LocalProfile | null;
  aiVoiceAssistEnabled: boolean;
  appLanguage: AppLanguage;
  currentZoneFocus: string[];
  handRecordCount: number;
  navCollapsedOffset: number;
  navDrawerOpen: boolean;
  navExpandedOffset: number;
  navSafeInsetLeft: number;
  politeMode: boolean;
  progress: ProgressState;
  reviewLoading: boolean;
  reviewRecords: HandRecordSummary[];
  reviewSelectedDetail: HandRecordDetail | null;
  reviewSelectedId: number | null;
  rootTab: RootTab;
  rootTabItems: RootTabItem[];
  sfxEnabled: boolean;
  topLeak: keyof ProgressState['leaks'];
  zoneDisplayName: string;
  handleResumePlay: () => void;
  handleRootTabChange: (tab: RootTab) => void;
  handleReplayFromReview: (recordId: number) => Promise<void>;
  handleReviewSelect: (recordId: number) => Promise<void>;
  loadReviewRecords: (preferredRecordId?: number | null) => Promise<void>;
  setAiVoiceAssistEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  setAppLanguage: React.Dispatch<React.SetStateAction<AppLanguage>>;
  setNavDrawerOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setNote: React.Dispatch<React.SetStateAction<string>>;
  setPoliteMode: React.Dispatch<React.SetStateAction<boolean>>;
  setSfxEnabled: React.Dispatch<React.SetStateAction<boolean>>;
};

export function RootTabView(props: RootTabViewProps) {
  const {
    activeProfile,
    aiVoiceAssistEnabled,
    appLanguage,
    currentZoneFocus,
    handRecordCount,
    navCollapsedOffset,
    navDrawerOpen,
    navExpandedOffset,
    navSafeInsetLeft,
    politeMode,
    progress,
    reviewLoading,
    reviewRecords,
    reviewSelectedDetail,
    reviewSelectedId,
    rootTab,
    rootTabItems,
    sfxEnabled,
    topLeak,
    zoneDisplayName,
    handleResumePlay,
    handleRootTabChange,
    handleReplayFromReview,
    handleReviewSelect,
    loadReviewRecords,
    setAiVoiceAssistEnabled,
    setAppLanguage,
    setNavDrawerOpen,
    setNote,
    setPoliteMode,
    setSfxEnabled,
  } = props;

  const mobileCoachConversionBlockersEnabled = process.env.EXPO_PUBLIC_MOBILE_COACH_CONVERSION_BLOCKERS_V1 === '1';
  const [conversionBlockersLoading, setConversionBlockersLoading] = useState(false);
  const [conversionBlockersError, setConversionBlockersError] = useState('');
  const [conversionBlockersData, setConversionBlockersData] = useState<MobileCoachConversionBlockersResponse | null>(null);

  const refreshConversionBlockers = useMemo(() => async () => {
    if (!mobileCoachConversionBlockersEnabled) return;
    setConversionBlockersLoading(true);
    setConversionBlockersError('');
    try {
      const data = await fetchCoachConversionBlockers(30);
      setConversionBlockersData(data);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to load conversion blockers';
      setConversionBlockersError(msg);
    } finally {
      setConversionBlockersLoading(false);
    }
  }, [mobileCoachConversionBlockersEnabled]);

  useEffect(() => {
    if (rootTab !== 'profile' || !mobileCoachConversionBlockersEnabled) {
      return;
    }
    void refreshConversionBlockers();
  }, [mobileCoachConversionBlockersEnabled, refreshConversionBlockers, rootTab]);

  const coachConversionBlockersPanel = mobileCoachConversionBlockersEnabled ? (
    <View style={{ borderWidth: 1, borderColor: '#3a6273', borderRadius: 12, backgroundColor: 'rgba(10, 30, 41, 0.9)', padding: 10, gap: 6 }}>
      <Text style={{ color: '#e6f7ff', fontSize: 15, fontWeight: '900' }}>{l(appLanguage, 'Coach 轉化阻塞 (Mobile)', 'Coach 转化阻塞 (Mobile)', 'Coach Conversion Blockers (Mobile)')}</Text>
      {conversionBlockersLoading ? (
        <Text style={{ color: '#b8d6e3', fontSize: 12, lineHeight: 17 }}>{l(appLanguage, '讀取中...', '读取中...', 'Loading...')}</Text>
      ) : conversionBlockersError ? (
        <Text style={{ color: '#b8d6e3', fontSize: 12, lineHeight: 17 }}>{conversionBlockersError}</Text>
      ) : conversionBlockersData ? (
        <>
          <Text style={{ color: '#b8d6e3', fontSize: 12, lineHeight: 17 }}>{l(appLanguage, `Attach: ${conversionBlockersData.attachRatePct}% · Completion: ${conversionBlockersData.completionRatePct}%`, `Attach: ${conversionBlockersData.attachRatePct}% · Completion: ${conversionBlockersData.completionRatePct}%`, `Attach: ${conversionBlockersData.attachRatePct}% · Completion: ${conversionBlockersData.completionRatePct}%`)}</Text>
          <Text style={{ color: '#b8d6e3', fontSize: 12, lineHeight: 17 }}>{l(appLanguage, `最大阻塞: ${conversionBlockersData.biggestBlockerStage}`, `最大阻塞: ${conversionBlockersData.biggestBlockerStage}`, `Top blocker: ${conversionBlockersData.biggestBlockerStage}`)}</Text>
          {(conversionBlockersData.items || []).slice(0, 3).map((item) => (
            <Text key={item.stageKey} style={{ color: '#b8d6e3', fontSize: 12, lineHeight: 17 }}>{`• ${item.stageLabel}: ${item.dropoffPct}%`}</Text>
          ))}
        </>
      ) : (
        <Text style={{ color: '#b8d6e3', fontSize: 12, lineHeight: 17 }}>{l(appLanguage, '暫無資料', '暂无数据', 'No data yet')}</Text>
      )}
      <TouchableOpacity
        onPress={() => { void refreshConversionBlockers(); }}
        style={{ marginTop: 6, borderWidth: 1, borderColor: '#7fffe1', borderRadius: 8, backgroundColor: '#1f5c54', paddingHorizontal: 10, paddingVertical: 6, alignSelf: 'flex-start' }}
      >
        <Text style={{ color: '#f4fffe', fontSize: 12, fontWeight: '800' }}>{l(appLanguage, '手動刷新', '手动刷新', 'Refresh')}</Text>
      </TouchableOpacity>
    </View>
  ) : null;

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
                zoneFocus={currentZoneFocus}
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
                extensionPanel={coachConversionBlockersPanel}
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

  return null;
}
