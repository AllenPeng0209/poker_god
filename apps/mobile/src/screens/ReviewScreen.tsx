import React, { useMemo } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import type { HandRecordDetail, HandRecordSummary } from '../storage/localDb';

type AppLanguage = 'zh-TW' | 'zh-CN' | 'en-US';

type ReviewScreenProps = {
  language: AppLanguage;
  loading: boolean;
  records: HandRecordSummary[];
  selectedRecordId: number | null;
  detail: HandRecordDetail | null;
  onSelectRecord: (recordId: number) => void;
  onRefresh: () => void;
  onReplayHand: (recordId: number) => void;
  onResumePlay: () => void;
};

function l(language: AppLanguage, zhTw: string, zhCn: string, en: string): string {
  if (language === 'zh-CN') return zhCn;
  if (language === 'en-US') return en;
  return zhTw;
}

function winnerLabel(winner: HandRecordSummary['winner'], language: AppLanguage): string {
  if (winner === 'hero') return l(language, 'Hero 勝', 'Hero 胜', 'Hero Win');
  if (winner === 'villain') return l(language, '對手勝', '对手胜', 'Villain Win');
  if (winner === 'tie') return l(language, '平手', '平手', 'Tie');
  return l(language, '未結算', '未结算', 'Unsettled');
}

function formatTimestamp(value: string, language: AppLanguage): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString(language === 'en-US' ? 'en-US' : 'zh-TW', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function actionShortLabel(action: string, language: AppLanguage): string {
  if (action === 'fold') return l(language, '棄牌', '弃牌', 'Fold');
  if (action === 'check') return l(language, '過牌', '过牌', 'Check');
  if (action === 'call') return l(language, '跟注', '跟注', 'Call');
  if (action === 'raise') return l(language, '加注', '加注', 'Raise');
  return action;
}

function recordProfit(summary: HandRecordSummary): number {
  return summary.heroStackEnd - summary.heroStackStart;
}

export function ReviewScreen({
  language,
  loading,
  records,
  selectedRecordId,
  detail,
  onSelectRecord,
  onRefresh,
  onReplayHand,
  onResumePlay,
}: ReviewScreenProps) {
  const { width } = useWindowDimensions();
  const compact = width < 940;
  const selectedSummary = useMemo(
    () => records.find((item) => item.id === selectedRecordId) ?? null,
    [records, selectedRecordId],
  );
  const replayRecordId = selectedSummary?.id ?? detail?.id ?? null;

  return (
    <View style={styles.root}>
      <View style={styles.headerCard}>
        <View style={styles.headerCopy}>
          <Text style={styles.headerTag}>{l(language, '復盤中心', '复盘中心', 'Review Center')}</Text>
          <Text style={styles.headerTitle}>{l(language, '手牌紀錄與檢討', '手牌记录与检讨', 'Hand Records & Reflection')}</Text>
          <Text style={styles.headerSub}>
            {l(
              language,
              '每手都會自動記錄。先看列表，再點進單手時間線做檢討。',
              '每手都会自动记录。先看列表，再点进单手时间线做检讨。',
              'Every hand is auto-recorded. Start from the list, then inspect each hand timeline.',
            )}
          </Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable onPress={onRefresh} style={({ pressed }) => [styles.headerBtn, pressed && styles.pressed]}>
            <Text style={styles.headerBtnText}>{loading ? l(language, '載入中', '载入中', 'Loading') : l(language, '刷新', '刷新', 'Refresh')}</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              if (replayRecordId !== null) {
                onReplayHand(replayRecordId);
              }
            }}
            disabled={replayRecordId === null}
            style={({ pressed }) => [
              styles.headerBtn,
              styles.headerBtnPrimary,
              replayRecordId === null && styles.headerBtnDisabled,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.headerBtnText}>{l(language, '回桌回放', '回桌回放', 'Replay on Table')}</Text>
          </Pressable>
          <Pressable onPress={onResumePlay} style={({ pressed }) => [styles.headerBtn, pressed && styles.pressed]}>
            <Text style={styles.headerBtnText}>{l(language, '回到實戰', '回到实战', 'Back to Play')}</Text>
          </Pressable>
        </View>
      </View>

      <View style={[styles.body, compact && styles.bodyStack]}>
        <View style={[styles.listPanel, compact && styles.listPanelStack]}>
          <Text style={styles.panelTitle}>{l(language, '最近手牌', '最近手牌', 'Recent Hands')}</Text>
          {records.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyText}>{loading ? l(language, '正在讀取牌局紀錄...', '正在读取牌局记录...', 'Loading hand records...') : l(language, '目前尚無紀錄，先到實戰打幾手。', '目前尚无记录，先到实战打几手。', 'No records yet. Play a few hands first.')}</Text>
            </View>
          ) : (
            <FlatList
              data={records}
              keyExtractor={(item) => `${item.id}`}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator
              renderItem={({ item }) => {
                const selected = item.id === selectedRecordId;
                const profit = recordProfit(item);
                return (
                  <Pressable
                    onPress={() => onSelectRecord(item.id)}
                    style={({ pressed }) => [
                      styles.item,
                      selected && styles.itemSelected,
                      pressed && styles.pressed,
                    ]}
                  >
                    <View style={styles.itemTop}>
                      <Text style={styles.itemTitle}>#{item.id} · {winnerLabel(item.winner, language)}</Text>
                      <Text style={styles.itemTime}>{formatTimestamp(item.createdAt, language)}</Text>
                    </View>
                    <View style={styles.itemMetaRow}>
                      <Text style={styles.itemMeta}>{item.zoneId}</Text>
                      <Text style={[styles.itemMeta, profit >= 0 ? styles.profitUp : styles.profitDown]}>
                        {profit >= 0 ? '+' : ''}{profit}
                      </Text>
                      <Text style={styles.itemMeta}>Pot {item.potEnd}</Text>
                    </View>
                    {item.resultText ? <Text style={styles.itemNote} numberOfLines={2}>{item.resultText}</Text> : null}
                  </Pressable>
                );
              }}
            />
          )}
        </View>

        <View style={[styles.detailPanel, compact && styles.detailPanelStack]}>
          <Text style={styles.panelTitle}>{l(language, '單手詳情', '单手详情', 'Hand Detail')}</Text>
          {!detail || !selectedSummary ? (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyText}>{l(language, '從左側選一手，查看完整行動與檢討。', '从左侧选一手，查看完整行动与检讨。', 'Select a hand to view complete action flow and review.')}</Text>
            </View>
          ) : (
            <ScrollView style={styles.detailScroll} contentContainerStyle={styles.detailContent} showsVerticalScrollIndicator>
              <View style={styles.detailHeaderCard}>
                <Text style={styles.detailHeaderTitle}>{winnerLabel(detail.winner, language)} · #{detail.id}</Text>
                <Text style={styles.detailHeaderMeta}>{formatTimestamp(detail.createdAt, language)} · {detail.zoneId}</Text>
                <Text style={styles.detailHeaderMeta}>{l(language, 'Hero 籌碼', 'Hero 筹码', 'Hero Stack')} {detail.heroStackStart} {'->'} {detail.heroStackEnd}</Text>
                <Text style={styles.detailHeaderMeta}>{l(language, '對手籌碼', '对手筹码', 'Villain Stack')} {detail.villainStackStart} {'->'} {detail.villainStackEnd}</Text>
                <Text style={styles.detailHeaderMeta}>Pot {detail.potEnd}</Text>
              </View>

              <View style={styles.detailCard}>
                <Text style={styles.detailTitle}>{l(language, '行動時間線', '行动时间线', 'Action Timeline')}</Text>
                {detail.actionHistory.length > 0 ? (
                  detail.actionHistory.map((log, idx) => (
                    <View key={`${detail.id}-action-${idx}`} style={styles.timelineRow}>
                      <Text style={styles.timelineStreet}>{String(log.street).toUpperCase()}</Text>
                      <Text style={styles.timelineMain}>
                        {(log.actorName || log.actorId || log.actor).toString()} · {actionShortLabel(log.action, language)}
                        {Number(log.amount) > 0 ? ` ${Number(log.amount)}` : ''}
                        {log.allIn ? ' · All-in' : ''}
                      </Text>
                    </View>
                  ))
                ) : (
                  <Text style={styles.emptyText}>{l(language, '此手沒有可用行動記錄。', '此手没有可用行动记录。', 'No action history available for this hand.')}</Text>
                )}
              </View>

              <View style={styles.detailCard}>
                <Text style={styles.detailTitle}>{l(language, '決策檢討', '决策检讨', 'Decision Review')}</Text>
                {detail.decisionRecords.length > 0 ? (
                  detail.decisionRecords.map((decision, idx) => (
                    <View key={`${detail.id}-decision-${idx}`} style={styles.decisionRow}>
                      <Text style={styles.decisionMain}>{String(decision.street).toUpperCase()} · {actionShortLabel(decision.chosen, language)}</Text>
                      <Text style={[styles.decisionBadge, decision.isBest ? styles.decisionGood : styles.decisionFix]}>
                        {decision.isBest ? l(language, '最佳', '最佳', 'Best') : l(language, '可優化', '可优化', 'Improve')}
                      </Text>
                    </View>
                  ))
                ) : (
                  <Text style={styles.emptyText}>{l(language, '暫無決策評估資料。', '暂无决策评估资料。', 'No decision evaluation data available.')}</Text>
                )}
              </View>
            </ScrollView>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 12,
    gap: 10,
  },
  headerCard: {
    borderWidth: 1,
    borderColor: '#4d8191',
    borderRadius: 14,
    backgroundColor: 'rgba(15, 45, 55, 0.94)',
    padding: 12,
    gap: 10,
  },
  headerCopy: {
    gap: 4,
  },
  headerTag: {
    color: '#9df8e2',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  headerTitle: {
    color: '#f0fffb',
    fontSize: 22,
    fontWeight: '900',
  },
  headerSub: {
    color: '#c1e0ea',
    fontSize: 12,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  headerBtn: {
    borderWidth: 1,
    borderColor: '#39636f',
    borderRadius: 10,
    backgroundColor: '#173847',
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  headerBtnPrimary: {
    borderColor: '#88ffde',
    backgroundColor: '#1a5a4a',
  },
  headerBtnDisabled: {
    opacity: 0.45,
  },
  headerBtnText: {
    color: '#e6f8ff',
    fontSize: 12,
    fontWeight: '800',
  },
  body: {
    flex: 1,
    minHeight: 0,
    flexDirection: 'row',
    gap: 10,
  },
  bodyStack: {
    flexDirection: 'column',
  },
  listPanel: {
    width: '38%',
    minWidth: 250,
    borderWidth: 1,
    borderColor: '#355b6a',
    borderRadius: 12,
    backgroundColor: 'rgba(9, 29, 41, 0.9)',
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 8,
  },
  listPanelStack: {
    width: '100%',
    minWidth: 0,
    maxHeight: 300,
  },
  detailPanel: {
    flex: 1,
    minWidth: 0,
    borderWidth: 1,
    borderColor: '#355b6a',
    borderRadius: 12,
    backgroundColor: 'rgba(9, 29, 41, 0.9)',
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 8,
  },
  detailPanelStack: {
    minHeight: 280,
  },
  panelTitle: {
    color: '#e6f7ff',
    fontSize: 15,
    fontWeight: '900',
  },
  listContent: {
    gap: 7,
    paddingBottom: 10,
  },
  item: {
    borderWidth: 1,
    borderColor: '#365b6a',
    borderRadius: 10,
    backgroundColor: '#143241',
    paddingHorizontal: 9,
    paddingVertical: 8,
    gap: 5,
  },
  itemSelected: {
    borderColor: '#7dffd8',
    backgroundColor: '#1d4748',
  },
  itemTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  itemTitle: {
    color: '#e7f7ff',
    fontSize: 12,
    fontWeight: '800',
  },
  itemTime: {
    color: '#9cc3d3',
    fontSize: 10,
    fontFamily: 'monospace',
  },
  itemMetaRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  itemMeta: {
    color: '#c1ddea',
    fontSize: 10,
    fontWeight: '700',
  },
  itemNote: {
    color: '#9ebdcb',
    fontSize: 10,
    lineHeight: 14,
  },
  profitUp: {
    color: '#8cf6bb',
  },
  profitDown: {
    color: '#ff9d9d',
  },
  detailScroll: {
    flex: 1,
    minHeight: 0,
  },
  detailContent: {
    gap: 8,
    paddingBottom: 10,
  },
  detailHeaderCard: {
    borderWidth: 1,
    borderColor: '#486f7d',
    borderRadius: 10,
    backgroundColor: '#183e4e',
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 2,
  },
  detailHeaderTitle: {
    color: '#f1fff9',
    fontSize: 14,
    fontWeight: '900',
  },
  detailHeaderMeta: {
    color: '#b8d8e4',
    fontSize: 11,
    fontWeight: '700',
  },
  detailCard: {
    borderWidth: 1,
    borderColor: '#486f7d',
    borderRadius: 10,
    backgroundColor: '#153847',
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 7,
  },
  detailTitle: {
    color: '#e9f8ff',
    fontSize: 13,
    fontWeight: '900',
  },
  timelineRow: {
    borderRadius: 8,
    backgroundColor: '#193f50',
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 1,
  },
  timelineStreet: {
    color: '#85bdcd',
    fontSize: 10,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  timelineMain: {
    color: '#d8edf7',
    fontSize: 12,
    fontWeight: '700',
  },
  decisionRow: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3a6071',
    backgroundColor: '#173b4a',
    paddingHorizontal: 8,
    paddingVertical: 7,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  decisionMain: {
    color: '#e0f2fa',
    fontSize: 12,
    fontWeight: '700',
  },
  decisionBadge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    fontSize: 10,
    fontWeight: '800',
    overflow: 'hidden',
  },
  decisionGood: {
    color: '#c8ffe8',
    borderColor: '#77d9af',
    backgroundColor: '#1f5242',
  },
  decisionFix: {
    color: '#ffe4c2',
    borderColor: '#c79b5b',
    backgroundColor: '#4d361d',
  },
  emptyWrap: {
    borderWidth: 1,
    borderColor: '#3a6071',
    borderRadius: 10,
    backgroundColor: '#153443',
    paddingHorizontal: 10,
    paddingVertical: 12,
  },
  emptyText: {
    color: '#b4d0dd',
    fontSize: 12,
    lineHeight: 17,
  },
  pressed: {
    opacity: 0.86,
  },
});
