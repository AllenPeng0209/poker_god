import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Text, View } from 'react-native';

import { cardToDisplay } from '../../../engine/cards';
import { statRatePercent } from '../../../engine/heroStats';
import type { RatioStat } from '../../../engine/heroStats';
import type { ActionAdvice, Card } from '../../../types/poker';

import { styles } from '../styles';
import { COACH_STAT_BENCHMARKS } from '../model/constants';
import { l, rt } from '../model/i18n';
import {
  actionLabel,
  clamp,
  coachBenchmarkRangeLabel,
  coachBenchmarkVerdict,
  sampleTier,
  sampleTierLabel,
} from '../model/logic';
import type { AppLanguage, CoachStatKey } from '../model/types';

export function CardView({ card, hidden, compact }: { card?: Card; hidden?: boolean; compact?: boolean }) {
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

export function Advice({ title, advice, language }: { title: string; advice: ActionAdvice; language: AppLanguage }) {
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

export function PercentMeter({ label, value, accent }: { label: string; value: number; accent: string }) {
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

export function CoachStatTile(
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
