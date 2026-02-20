import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

type AppLanguage = 'zh-TW' | 'zh-CN' | 'en-US';
type LanguageOption = { key: AppLanguage; label: string };

type ProfileScreenProps = {
  language: AppLanguage;
  profileName: string;
  appName: string;
  xp: number;
  handsPlayed: number;
  handsWon: number;
  recordsCount: number;
  currentZoneName: string;
  topLeakLabel: string;
  topLeakMission: string;
  onResumePlay: () => void;
  onOpenAccountCenter: () => void;
  subscriptionPlanName: string;
  subscriptionStatusText: string;
  subscriptionRenewalText: string;
  onManageSubscription: () => void;
  availableLanguages: LanguageOption[];
  sfxEnabled: boolean;
  aiVoiceAssistEnabled: boolean;
  politeMode: boolean;
  onChangeLanguage: (language: AppLanguage) => void;
  onToggleSfx: () => void;
  onToggleAiVoiceAssist: () => void;
  onTogglePoliteMode: () => void;
};

function l(language: AppLanguage, zhTw: string, zhCn: string, en: string): string {
  if (language === 'zh-CN') return zhCn;
  if (language === 'en-US') return en;
  return zhTw;
}

function winRate(handsPlayed: number, handsWon: number): number {
  if (handsPlayed <= 0) return 0;
  return Math.round((handsWon / handsPlayed) * 1000) / 10;
}

function toggleLabel(language: AppLanguage, enabled: boolean): string {
  if (enabled) return l(language, '開啟', '开启', 'On');
  return l(language, '關閉', '关闭', 'Off');
}

export function ProfileScreen({
  language,
  profileName,
  appName,
  xp,
  handsPlayed,
  handsWon,
  recordsCount,
  currentZoneName,
  topLeakLabel,
  topLeakMission,
  onResumePlay,
  onOpenAccountCenter,
  subscriptionPlanName,
  subscriptionStatusText,
  subscriptionRenewalText,
  onManageSubscription,
  availableLanguages,
  sfxEnabled,
  aiVoiceAssistEnabled,
  politeMode,
  onChangeLanguage,
  onToggleSfx,
  onToggleAiVoiceAssist,
  onTogglePoliteMode,
}: ProfileScreenProps) {
  const wr = winRate(handsPlayed, handsWon);

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.heroCard}>
        <Text style={styles.heroTag}>{l(language, '我的檔案', '我的档案', 'My Profile')}</Text>
        <Text style={styles.heroName}>{profileName}</Text>
        <Text style={styles.heroSub}>{l(language, `當前區域：${currentZoneName}`, `当前区域：${currentZoneName}`, `Current zone: ${currentZoneName}`)}</Text>
        <Pressable onPress={onResumePlay} style={({ pressed }) => [styles.resumeBtn, pressed && styles.pressed]}>
          <Text style={styles.resumeText}>{l(language, '繼續實戰', '继续实战', 'Continue Playing')}</Text>
        </Pressable>
      </View>

      <View style={styles.grid}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>XP</Text>
          <Text style={styles.statValue}>{xp}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>{l(language, '對局手數', '对局手数', 'Hands Played')}</Text>
          <Text style={styles.statValue}>{handsPlayed}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>{l(language, '勝率', '胜率', 'Win Rate')}</Text>
          <Text style={styles.statValue}>{wr}%</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>{l(language, '已記錄手牌', '已记录手牌', 'Recorded Hands')}</Text>
          <Text style={styles.statValue}>{recordsCount}</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{l(language, '當前主要破綻', '当前主要破绽', 'Current Top Leak')}</Text>
        <Text style={styles.leakLabel}>{topLeakLabel}</Text>
        <Text style={styles.cardHint}>{topLeakMission}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{l(language, '建議節奏', '建议节奏', 'Suggested Rhythm')}</Text>
        <Text style={styles.cardHint}>1. {l(language, '先打 20 手，累積當日樣本', '先打 20 手，累积当日样本', 'Play 20 hands to build daily sample')}</Text>
        <Text style={styles.cardHint}>2. {l(language, '復盤 3 手最大損失局', '复盘 3 手最大损失局', 'Review top 3 losing hands')}</Text>
        <Text style={styles.cardHint}>3. {l(language, '回到學習頁修正單一漏洞', '回到学习页修正单一漏洞', 'Return to Learn and fix one leak at a time')}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{l(language, '帳號管理', '账号管理', 'Account Management')}</Text>
        <Text style={styles.cardHint}>{l(language, '每個 App 獨立帳號與身份配置', '每个 App 独立账号与身份配置', 'Per-app account and identity management')}</Text>
        <View style={styles.accountMetaRow}>
          <Text style={styles.accountMetaLabel}>{l(language, '應用', '应用', 'App')}</Text>
          <Text style={styles.accountMetaValue}>{appName}</Text>
        </View>
        <View style={styles.accountMetaRow}>
          <Text style={styles.accountMetaLabel}>{l(language, '目前帳號', '当前账号', 'Current Account')}</Text>
          <Text style={styles.accountMetaValue}>{profileName}</Text>
        </View>
        <Pressable onPress={onOpenAccountCenter} style={({ pressed }) => [styles.actionBtn, pressed && styles.pressed]}>
          <Text style={styles.actionBtnText}>{l(language, '進入帳號中心', '进入账号中心', 'Open Account Center')}</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{l(language, '帳號訂閱', '账号订阅', 'Subscription')}</Text>
        <Text style={styles.subscriptionPlan}>{subscriptionPlanName}</Text>
        <View style={styles.accountMetaRow}>
          <Text style={styles.accountMetaLabel}>{l(language, '狀態', '状态', 'Status')}</Text>
          <Text style={styles.accountMetaValue}>{subscriptionStatusText}</Text>
        </View>
        <View style={styles.accountMetaRow}>
          <Text style={styles.accountMetaLabel}>{l(language, '續期資訊', '续期信息', 'Renewal')}</Text>
          <Text style={styles.accountMetaValue}>{subscriptionRenewalText}</Text>
        </View>
        <Pressable onPress={onManageSubscription} style={({ pressed }) => [styles.actionBtn, styles.actionBtnAlt, pressed && styles.pressed]}>
          <Text style={styles.actionBtnText}>{l(language, '管理訂閱', '管理订阅', 'Manage Subscription')}</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{l(language, '通用設定', '通用设置', 'General Settings')}</Text>

        <View style={styles.settingRow}>
          <View style={styles.settingCopy}>
            <Text style={styles.settingTitle}>{l(language, '音效', '音效', 'Sound Effects')}</Text>
            <Text style={styles.settingSub}>{l(language, '進桌後播放牌桌音效', '进桌后播放牌桌音效', 'Play table sound effects in game')}</Text>
          </View>
          <Pressable onPress={onToggleSfx} style={({ pressed }) => [styles.switchBtn, sfxEnabled && styles.switchBtnOn, pressed && styles.pressed]}>
            <Text style={styles.switchBtnText}>{toggleLabel(language, sfxEnabled)}</Text>
          </Pressable>
        </View>

        <View style={styles.settingRow}>
          <View style={styles.settingCopy}>
            <Text style={styles.settingTitle}>{l(language, 'AI 語音建議', 'AI 语音建议', 'AI Voice Tips')}</Text>
            <Text style={styles.settingSub}>{l(language, '輪到你時自動語音提示', '轮到你时自动语音提示', 'Auto voice tips on your turn')}</Text>
          </View>
          <Pressable onPress={onToggleAiVoiceAssist} style={({ pressed }) => [styles.switchBtn, aiVoiceAssistEnabled && styles.switchBtnOn, pressed && styles.pressed]}>
            <Text style={styles.switchBtnText}>{toggleLabel(language, aiVoiceAssistEnabled)}</Text>
          </Pressable>
        </View>

        <View style={styles.settingRow}>
          <View style={styles.settingCopy}>
            <Text style={styles.settingTitle}>{l(language, '禮貌模式', '礼貌模式', 'Polite Mode')}</Text>
            <Text style={styles.settingSub}>{l(language, '使用較保守的建議語氣', '使用较保守的建议语气', 'Use a more conservative coaching tone')}</Text>
          </View>
          <Pressable onPress={onTogglePoliteMode} style={({ pressed }) => [styles.switchBtn, politeMode && styles.switchBtnOn, pressed && styles.pressed]}>
            <Text style={styles.switchBtnText}>{toggleLabel(language, politeMode)}</Text>
          </Pressable>
        </View>

        <Text style={styles.settingLangTitle}>{l(language, '語言', '语言', 'Language')}</Text>
        <View style={styles.chips}>
          {availableLanguages.map((option) => {
            const active = option.key === language;
            return (
              <Pressable
                key={option.key}
                onPress={() => onChangeLanguage(option.key)}
                style={({ pressed }) => [
                  styles.chip,
                  active && styles.chipOn,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.chipText, active && styles.chipTextOn]}>{option.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 18,
    gap: 10,
  },
  heroCard: {
    borderWidth: 1,
    borderColor: '#4c8090',
    borderRadius: 14,
    backgroundColor: 'rgba(14, 44, 56, 0.93)',
    padding: 13,
    gap: 6,
  },
  heroTag: {
    color: '#9ef8e5',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  heroName: {
    color: '#effffa',
    fontSize: 22,
    fontWeight: '900',
  },
  heroSub: {
    color: '#c3e5f0',
    fontSize: 12,
  },
  resumeBtn: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#7affda',
    borderRadius: 10,
    backgroundColor: '#185c4b',
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  resumeText: {
    color: '#f1fff9',
    fontSize: 12,
    fontWeight: '800',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statCard: {
    flexBasis: 170,
    flexGrow: 1,
    borderWidth: 1,
    borderColor: '#365d6d',
    borderRadius: 11,
    backgroundColor: 'rgba(10, 31, 42, 0.9)',
    paddingHorizontal: 10,
    paddingVertical: 9,
    gap: 3,
  },
  statLabel: {
    color: '#9dc2d2',
    fontSize: 11,
    fontWeight: '700',
  },
  statValue: {
    color: '#edfcff',
    fontSize: 20,
    fontWeight: '900',
    fontFamily: 'monospace',
  },
  card: {
    borderWidth: 1,
    borderColor: '#3a6273',
    borderRadius: 12,
    backgroundColor: 'rgba(10, 30, 41, 0.9)',
    padding: 10,
    gap: 6,
  },
  cardTitle: {
    color: '#e6f7ff',
    fontSize: 15,
    fontWeight: '900',
  },
  leakLabel: {
    color: '#f5e8b1',
    fontSize: 17,
    fontWeight: '900',
  },
  cardHint: {
    color: '#b8d6e3',
    fontSize: 12,
    lineHeight: 17,
  },
  accountMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  accountMetaLabel: {
    color: '#9cc2d0',
    fontSize: 11,
    fontWeight: '700',
  },
  accountMetaValue: {
    color: '#eefbff',
    fontSize: 12,
    fontWeight: '800',
  },
  actionBtn: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#85ffe0',
    borderRadius: 10,
    backgroundColor: '#1f5c54',
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginTop: 2,
  },
  actionBtnAlt: {
    borderColor: '#9bc8ff',
    backgroundColor: '#254f7a',
  },
  actionBtnText: {
    color: '#f4fffe',
    fontSize: 12,
    fontWeight: '800',
  },
  subscriptionPlan: {
    color: '#f6ecb9',
    fontSize: 18,
    fontWeight: '900',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    borderWidth: 1,
    borderColor: '#345969',
    borderRadius: 10,
    backgroundColor: '#123243',
    paddingHorizontal: 9,
    paddingVertical: 8,
  },
  settingCopy: {
    flex: 1,
    gap: 2,
  },
  settingTitle: {
    color: '#edfaff',
    fontSize: 12,
    fontWeight: '800',
  },
  settingSub: {
    color: '#99bccd',
    fontSize: 11,
    lineHeight: 16,
  },
  switchBtn: {
    minWidth: 68,
    borderWidth: 1,
    borderColor: '#45697a',
    borderRadius: 8,
    backgroundColor: '#1f3e4f',
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  switchBtnOn: {
    borderColor: '#7fffe1',
    backgroundColor: '#225f55',
  },
  switchBtnText: {
    color: '#effcff',
    fontSize: 11,
    fontWeight: '900',
  },
  settingLangTitle: {
    color: '#eaf8ff',
    fontSize: 13,
    fontWeight: '900',
    marginTop: 3,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  chip: {
    borderWidth: 1,
    borderColor: '#3f6777',
    borderRadius: 999,
    backgroundColor: '#163445',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  chipOn: {
    borderColor: '#8dffe1',
    backgroundColor: '#1d5a50',
  },
  chipText: {
    color: '#c8deea',
    fontSize: 11,
    fontWeight: '700',
  },
  chipTextOn: {
    color: '#f4fffb',
    fontWeight: '900',
  },
  pressed: {
    opacity: 0.88,
  },
});
