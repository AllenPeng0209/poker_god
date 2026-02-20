import React, { useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { courseModules, trackAccent } from '../features/learn/data';
import type { AppLanguage, CourseModule } from '../features/learn/types';
import { l, lc } from '../features/learn/types';

type LearnView = 'home' | 'module';

type LearnScreenProps = {
  language: AppLanguage;
  zoneName: string;
  zoneFocus: string[];
  onResumePlay: () => void;
};

const headingFont = Platform.select({
  ios: 'AvenirNext-Heavy',
  android: 'serif',
  default: undefined,
});

const bodyFont = Platform.select({
  ios: 'AvenirNext-Medium',
  android: 'sans-serif-medium',
  default: undefined,
});

const monoFont = Platform.select({
  ios: 'Menlo',
  android: 'monospace',
  default: undefined,
});

function keyBullets(module: CourseModule, language: AppLanguage): string[] {
  return module.conceptLessons.flatMap((lesson) =>
    lesson.bullets.slice(0, 2).map((bullet) => lc(language, bullet)),
  );
}

export function LearnScreen({ language, zoneName, zoneFocus: _zoneFocus, onResumePlay }: LearnScreenProps) {
  const [view, setView] = useState<LearnView>('home');
  const [armedModuleId, setArmedModuleId] = useState<string | null>(null);
  const [activeModuleId, setActiveModuleId] = useState<string | null>(null);

  const activeModule = useMemo(
    () => (activeModuleId ? courseModules.find((item) => item.id === activeModuleId) ?? null : null),
    [activeModuleId],
  );

  const leftModules = useMemo(() => courseModules.slice(0, 6), []);
  const rightModules = useMemo(() => courseModules.slice(6, 12), []);

  function openModuleBySecondTap(moduleId: string): void {
    if (armedModuleId === moduleId) {
      setView('module');
      setArmedModuleId(null);
      setActiveModuleId(moduleId);
      return;
    }
    setArmedModuleId(moduleId);
  }

  if (view === 'module' && activeModule) {
    const moduleBullets = keyBullets(activeModule, language);
    return (
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.detailCard, { borderColor: trackAccent[activeModule.track] }]}>
          <Text style={styles.sectionLabel}>{l(language, '课程', '课程', 'Course')}</Text>
          <Text style={styles.detailTitle}>{lc(language, activeModule.title)}</Text>
        </View>

        <View style={styles.detailCard}>
          <Text style={styles.sectionLabel}>{l(language, '课程目标', '课程目标', 'Course Objective')}</Text>
          <Text style={styles.detailText}>{lc(language, activeModule.coachCore)}</Text>
          <Text style={styles.detailSubText}>
            {l(language, '验收：', '验收：', 'Acceptance: ')}
            {lc(language, activeModule.passRule)}
          </Text>
        </View>

        <View style={styles.detailCard}>
          <Text style={styles.sectionLabel}>{l(language, '课程说明', '课程说明', 'Course Explanation')}</Text>
          <Text style={styles.detailText}>{lc(language, activeModule.summary)}</Text>

          <Text style={styles.blockTitle}>{l(language, '文字讲解', '文字讲解', 'Text Explanation')}</Text>
          {moduleBullets.map((item, idx) => (
            <View key={`${activeModule.id}-concept-${idx}`} style={styles.listRow}>
              <Text style={styles.listDot}>{idx + 1}</Text>
              <Text style={styles.listText}>{item}</Text>
            </View>
          ))}

          <Text style={styles.blockTitle}>{l(language, '视频学习', '视频学习', 'Video Learning')}</Text>
          {activeModule.videoLessons.map((video, idx) => (
            <View key={`${activeModule.id}-video-${idx}`} style={styles.videoRow}>
              <Text style={styles.videoTitle}>{lc(language, video.title)}</Text>
              <Text style={styles.videoDesc}>
                {l(language, '目标：', '目标：', 'Goal: ')}
                {lc(language, video.objective)}
              </Text>
            </View>
          ))}

          <Text style={styles.blockTitle}>{l(language, '打牌案例', '打牌案例', 'Play Cases')}</Text>
          {activeModule.handCases.map((handCase, idx) => (
            <View key={`${activeModule.id}-case-${idx}`} style={styles.caseRow}>
              <Text style={styles.caseTitle}>
                {idx + 1}. {lc(language, handCase.title)}
              </Text>
              <Text style={styles.caseText}>
                {l(language, '场景：', '场景：', 'Setup: ')}
                {lc(language, handCase.setup)}
              </Text>
              <Text style={styles.caseText}>
                {l(language, '目标：', '目标：', 'Objective: ')}
                {lc(language, handCase.objective)}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.bottomActions}>
          <Pressable
            onPress={() => {
              setView('home');
              setActiveModuleId(null);
            }}
            style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}
          >
            <Text style={styles.secondaryBtnText}>{l(language, '返回课程列表', '返回课程列表', 'Back to Courses')}</Text>
          </Pressable>
          <Pressable onPress={onResumePlay} style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}>
            <Text style={styles.primaryBtnText}>{l(language, '回到牌桌', '回到牌桌', 'Back to Play')}</Text>
          </Pressable>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={styles.homeHeaderTitle}>{l(language, '课程列表', '课程列表', 'Courses')}</Text>
      <Text style={styles.homeHeaderSub}>
        {l(
          language,
          `当前区域：${zoneName}。点击一次选中课程，第二次进入课程。`,
          `当前区域：${zoneName}。点击一次选中课程，第二次进入课程。`,
          `Current zone: ${zoneName}. Tap once to select, tap again to open.`,
        )}
      </Text>

      <View style={styles.twoColumnGrid}>
        <View style={styles.gridColumn}>
          {leftModules.map((module) => {
            const armed = armedModuleId === module.id;
            return (
              <Pressable
                key={module.id}
                onPress={() => openModuleBySecondTap(module.id)}
                style={({ pressed }) => [
                  styles.courseCard,
                  { borderColor: armed ? trackAccent[module.track] : '#3e5e70' },
                  armed && styles.courseCardArmed,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.cardSectionLabel}>{l(language, '课程', '课程', 'Course')}</Text>
                <Text style={styles.cardCourseTitle}>{lc(language, module.title)}</Text>

                <Text style={styles.cardSectionLabel}>{l(language, '课程目标', '课程目标', 'Course Objective')}</Text>
                <Text style={styles.cardBodyText} numberOfLines={3}>
                  {lc(language, module.coachCore)}
                </Text>

                <Text style={styles.cardSectionLabel}>{l(language, '说明', '说明', 'Explanation')}</Text>
                <Text style={styles.cardBodyText} numberOfLines={3}>
                  {lc(language, module.summary)}
                </Text>

                <Text style={styles.tapHint}>
                  {armed
                    ? l(language, '再次点击进入课程', '再次点击进入课程', 'Tap again to enter')
                    : l(language, '点击选中课程', '点击选中课程', 'Tap to select')}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.gridColumn}>
          {rightModules.map((module) => {
            const armed = armedModuleId === module.id;
            return (
              <Pressable
                key={module.id}
                onPress={() => openModuleBySecondTap(module.id)}
                style={({ pressed }) => [
                  styles.courseCard,
                  { borderColor: armed ? trackAccent[module.track] : '#3e5e70' },
                  armed && styles.courseCardArmed,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.cardSectionLabel}>{l(language, '课程', '课程', 'Course')}</Text>
                <Text style={styles.cardCourseTitle}>{lc(language, module.title)}</Text>

                <Text style={styles.cardSectionLabel}>{l(language, '课程目标', '课程目标', 'Course Objective')}</Text>
                <Text style={styles.cardBodyText} numberOfLines={3}>
                  {lc(language, module.coachCore)}
                </Text>

                <Text style={styles.cardSectionLabel}>{l(language, '说明', '说明', 'Explanation')}</Text>
                <Text style={styles.cardBodyText} numberOfLines={3}>
                  {lc(language, module.summary)}
                </Text>

                <Text style={styles.tapHint}>
                  {armed
                    ? l(language, '再次点击进入课程', '再次点击进入课程', 'Tap again to enter')
                    : l(language, '点击选中课程', '点击选中课程', 'Tap to select')}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 24,
    gap: 10,
  },
  homeHeaderTitle: {
    color: '#f0fbff',
    fontSize: 22,
    lineHeight: 26,
    fontWeight: '900',
    fontFamily: headingFont,
  },
  homeHeaderSub: {
    color: '#b9d6e2',
    fontSize: 12,
    lineHeight: 17,
    fontFamily: bodyFont,
  },
  twoColumnGrid: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  gridColumn: {
    flex: 1,
    gap: 10,
  },
  courseCard: {
    borderWidth: 1,
    borderRadius: 12,
    backgroundColor: 'rgba(13, 34, 48, 0.92)',
    paddingHorizontal: 10,
    paddingVertical: 9,
    minHeight: 190,
    gap: 4,
  },
  courseCardArmed: {
    backgroundColor: 'rgba(19, 53, 67, 0.96)',
  },
  cardSectionLabel: {
    color: '#9ec4d5',
    fontSize: 10,
    fontWeight: '700',
    fontFamily: bodyFont,
  },
  cardCourseTitle: {
    color: '#edfaff',
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '900',
    fontFamily: headingFont,
  },
  cardBodyText: {
    color: '#d7eaf2',
    fontSize: 12,
    lineHeight: 17,
    fontFamily: bodyFont,
  },
  tapHint: {
    marginTop: 2,
    color: '#f3e6bf',
    fontSize: 11,
    fontFamily: bodyFont,
  },
  detailCard: {
    borderWidth: 1,
    borderColor: '#436174',
    borderRadius: 12,
    backgroundColor: 'rgba(11, 29, 41, 0.92)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  sectionLabel: {
    color: '#9ec4d5',
    fontSize: 11,
    fontWeight: '700',
    fontFamily: bodyFont,
  },
  detailTitle: {
    color: '#f2fbff',
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '900',
    fontFamily: headingFont,
  },
  detailText: {
    color: '#dbeef5',
    fontSize: 13,
    lineHeight: 19,
    fontFamily: bodyFont,
  },
  detailSubText: {
    color: '#f4e6c0',
    fontSize: 12,
    lineHeight: 17,
    fontFamily: bodyFont,
  },
  blockTitle: {
    marginTop: 4,
    color: '#f4e6bf',
    fontSize: 12,
    fontWeight: '800',
    fontFamily: bodyFont,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  listDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: '#78c8d8',
    color: '#d8f0f8',
    fontSize: 10,
    fontWeight: '900',
    textAlign: 'center',
    textAlignVertical: 'center',
    lineHeight: Platform.OS === 'android' ? 18 : 16,
    fontFamily: monoFont,
    overflow: 'hidden',
  },
  listText: {
    flex: 1,
    color: '#dcecf3',
    fontSize: 12,
    lineHeight: 18,
    fontFamily: bodyFont,
  },
  videoRow: {
    borderWidth: 1,
    borderColor: '#445f72',
    borderRadius: 10,
    backgroundColor: 'rgba(16, 40, 55, 0.88)',
    paddingHorizontal: 8,
    paddingVertical: 7,
    gap: 4,
  },
  videoTitle: {
    color: '#ecf8ff',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
    fontFamily: bodyFont,
  },
  videoDesc: {
    color: '#d0e4ed',
    fontSize: 11,
    lineHeight: 16,
    fontFamily: bodyFont,
  },
  caseRow: {
    borderWidth: 1,
    borderColor: '#445f72',
    borderRadius: 10,
    backgroundColor: 'rgba(16, 40, 55, 0.88)',
    paddingHorizontal: 8,
    paddingVertical: 7,
    gap: 4,
  },
  caseTitle: {
    color: '#edf9ff',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
    fontFamily: bodyFont,
  },
  caseText: {
    color: '#d0e4ed',
    fontSize: 11,
    lineHeight: 16,
    fontFamily: bodyFont,
  },
  bottomActions: {
    flexDirection: 'row',
    gap: 8,
  },
  primaryBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#8be7f5',
    backgroundColor: 'rgba(14, 72, 76, 0.96)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    color: '#f3fffe',
    fontSize: 12,
    fontWeight: '800',
    fontFamily: bodyFont,
  },
  secondaryBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#4f7484',
    backgroundColor: 'rgba(17, 41, 54, 0.95)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: {
    color: '#d4e9f2',
    fontSize: 12,
    fontWeight: '700',
    fontFamily: bodyFont,
  },
  pressed: {
    opacity: 0.85,
  },
});
