// @ts-nocheck
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { Animated, ScrollView, SafeAreaView, Text, TouchableOpacity, View } from 'react-native';

import { BottomTabBar } from '../../../components/navigation/BottomTabBar';
import { winRate } from '../../../engine/progression';

import * as Play from '../index';
import type { TableViewProps } from './tableViewTypes';

const {
  LOAN_BB,
  LOAN_REPAY_RATE,
  NAV_COLLAPSED_WIDTH,
  NAV_DRAWER_WIDTH,
  PRACTICE_XP_MULTIPLIER,
  SUBSIDY_BB,
  Advice,
  CardView,
  CoachStatTile,
  PercentMeter,
  heroLeakLabel,
  l,
  mission,
  missionDetail,
  missionTitle,
  oppLeakKeys,
  oppLeakLabel,
  positionRelativeToButton,
  rt,
  seatLayout,
  seatName,
  shortName,
  styles,
  t,
} = Play;

export function TableView(props: TableViewProps) {
  const {
    activeProfile,
    activeSeatAnimId,
    activeXpFactor,
    aiVoiceAssistEnabled,
    aiVoiceBroadcastText,
    analysis,
    analysisDrawerWidth,
    analysisOpen,
    appLanguage,
    autoPlayEvents,
    battleSeat,
    battleSeatId,
    bankruptcyCountdown,
    bankruptcyPromptOpen,
    bankruptcyPromptText,
    callOrCheck,
    canClaimSubsidyToday,
    canHeroActNow,
    canRaise,
    chipPulse,
    completedMissionCount,
    drawerBackdropOpacity,
    drawerTranslateX,
    engineLabel,
    eventQueue,
    hand,
    handRecordCount,
    hasPendingEvent,
    headerHeroBb,
    headerHeroStack,
    heroEquityEdge,
    holes,
    isAllInRaise,
    leakGuess,
    minRaise,
    missionBackdropOpacity,
    missionOpen,
    missionTranslateX,
    navCollapsedOffset,
    navDrawerOpen,
    navExpandedOffset,
    navSafeInsetLeft,
    note,
    opsBackdropOpacity,
    opsOpen,
    opsTranslateX,
    pendingReplacementSeatIds,
    politeMode,
    progress,
    raiseAmount,
    raiseCap,
    raiseSliderPercent,
    recentActionLines,
    rootTab,
    rootTabItems,
    seatPulse,
    seatVisual,
    seats,
    selectedSeat,
    selectedSeatDisplayPos,
    selectedSeatId,
    sfxEnabled,
    sfxLoadError,
    sfxReady,
    soundsRef,
    spotInsight,
    tableFeed,
    topLeak,
    trainingMode,
    visibleBoard,
    voiceBackdropOpacity,
    voiceDrawerOpen,
    voiceTranslateX,
    zoneCareerXpFactor,
    zoneDisplayName,
    zoneHeroBb,
    zoneHeroStack,
    zoneLoanDebtBb,
    zoneProfitBb,
    zoneStatsCoachNote,
    zoneTrainingState,
    zoneVpipPfrGap,
    applyCareerBankruptcyRescue,
    continueInPracticeMode,
    doAction,
    handleRaiseSliderGesture,
    handleRaiseSliderLayout,
    handleRootTabChange,
    handleSeatTap,
    handleTableScreenLayout,
    resetZoneTrainingState,
    returnToLobbyAfterBankruptcy,
    runNextEvent,
    setAiVoiceAssistEnabled,
    setAnalysisOpen,
    setAutoPlayEvents,
    setLeakGuess,
    setMissionOpen,
    setNavDrawerOpen,
    setNote,
    setOpsOpen,
    setPhase,
    setPoliteMode,
    setSfxEnabled,
    setVoiceDrawerOpen,
    stackText,
    startHand,
    verifyLeak,
  } = props;
  const zoneHeroStats = zoneTrainingState.heroStats;

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
              setVoiceDrawerOpen(false);
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
              setVoiceDrawerOpen(false);
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
              setVoiceDrawerOpen(false);
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
              setVoiceDrawerOpen(false);
              setMissionOpen((v) => !v);
            }}
          >
            <Text style={styles.iconEmoji}>📘</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => {
              setOpsOpen(false);
              setAnalysisOpen(false);
              setMissionOpen(false);
              setVoiceDrawerOpen((v) => !v);
            }}
          >
            <Text style={styles.iconEmoji}>⚙️</Text>
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
          <View style={styles.analysisVoiceCard}>
            <Text style={styles.text}>{l(appLanguage, 'AI 語音播報', 'AI 语音播报', 'AI Voice Broadcast')}</Text>
            <Text style={styles.textTiny}>
              {aiVoiceAssistEnabled
                ? aiVoiceBroadcastText
                : l(appLanguage, 'AI 語音助手已關閉', 'AI 语音助手已关闭', 'AI voice assistant is off')}
            </Text>
          </View>
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

    <View pointerEvents={voiceDrawerOpen ? 'auto' : 'none'} style={styles.drawerRoot}>
      <Animated.View style={[styles.drawerBackdrop, { opacity: voiceBackdropOpacity }]}>
        <TouchableOpacity style={styles.drawerBackdropTouch} activeOpacity={1} onPress={() => setVoiceDrawerOpen(false)} />
      </Animated.View>

      <Animated.View style={[styles.voiceDrawerPanel, { transform: [{ translateX: voiceTranslateX }] }]}>
        <View style={styles.drawerHeader}>
          <Text style={styles.text}>{l(appLanguage, '桌上設定', '桌上设置', 'Table Settings')}</Text>
          <TouchableOpacity style={styles.iconBtn} onPress={() => setVoiceDrawerOpen(false)}>
            <Text style={styles.iconBtnText}>{t(appLanguage, 'close')}</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.drawerScroll} contentContainerStyle={styles.drawerScrollContent} showsVerticalScrollIndicator>
          <View style={styles.voiceDrawerCard}>
            <View style={styles.voiceDrawerToggleRow}>
              <View style={styles.voiceDrawerToggleCopy}>
                <Text style={styles.lobbySettingRowTitle}>{t(appLanguage, 'settings_sfx_title')}</Text>
                <Text style={styles.lobbySettingRowSub}>
                  {sfxLoadError
                    ? l(appLanguage, '音效資源錯誤', '音效资源错误', 'SFX resource error')
                    : sfxReady
                      ? t(appLanguage, 'settings_sfx_sub')
                      : l(appLanguage, '音效載入中', '音效载入中', 'SFX loading')}
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.lobbySettingSwitch, sfxEnabled && styles.lobbySettingSwitchOn]}
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
                <Text style={styles.lobbySettingSwitchText}>{sfxEnabled ? t(appLanguage, 'toggle_on') : t(appLanguage, 'toggle_off')}</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.voiceDrawerToggleRow}>
              <View style={styles.voiceDrawerToggleCopy}>
                <Text style={styles.lobbySettingRowTitle}>{t(appLanguage, 'settings_ai_voice_title')}</Text>
                <Text style={styles.lobbySettingRowSub}>{t(appLanguage, 'settings_ai_voice_sub')}</Text>
              </View>
              <TouchableOpacity
                style={[styles.lobbySettingSwitch, aiVoiceAssistEnabled && styles.lobbySettingSwitchOn]}
                onPress={() => {
                  const next = !aiVoiceAssistEnabled;
                  setAiVoiceAssistEnabled(next);
                  if (!next) {
                    setNote(l(appLanguage, 'AI 輔助打牌語音已關閉。', 'AI 辅助打牌语音已关闭。', 'AI voice gameplay assist is off.'));
                  } else {
                    setNote(l(appLanguage, 'AI 輔助打牌語音已開啟，輪到你時會自動播報最佳建議。', 'AI 辅助打牌语音已开启，轮到你时会自动播报最佳建议。', 'AI voice gameplay assist is on. It will auto-speak on your turn.'));
                  }
                }}
              >
                <Text style={styles.lobbySettingSwitchText}>{aiVoiceAssistEnabled ? t(appLanguage, 'toggle_on') : t(appLanguage, 'toggle_off')}</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.voiceDrawerToggleRow}>
              <View style={styles.voiceDrawerToggleCopy}>
                <Text style={styles.lobbySettingRowTitle}>{t(appLanguage, 'settings_polite_title')}</Text>
                <Text style={styles.lobbySettingRowSub}>{t(appLanguage, 'settings_polite_sub')}</Text>
              </View>
              <TouchableOpacity
                style={[styles.lobbySettingSwitch, politeMode && styles.lobbySettingSwitchOn]}
                onPress={() => setPoliteMode((v) => !v)}
              >
                <Text style={styles.lobbySettingSwitchText}>{politeMode ? t(appLanguage, 'toggle_on') : t(appLanguage, 'toggle_off')}</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.voiceDrawerAdviceBox}>
              <Text style={styles.voiceDrawerAdviceLabel}>{l(appLanguage, '當前 AI 語音播報', '当前 AI 语音播报', 'Current AI voice tip')}</Text>
              <Text style={styles.textTiny}>
                {aiVoiceAssistEnabled
                  ? aiVoiceBroadcastText
                  : l(appLanguage, 'AI 語音助手已關閉', 'AI 语音助手已关闭', 'AI voice assistant is off')}
              </Text>
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
        items={rootTabItems.slice(1)}
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
