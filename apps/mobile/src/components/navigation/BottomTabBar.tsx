import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import type { RootTab, RootTabItem } from '../../navigation/rootTabs';

type BottomTabBarProps = {
  activeTab: RootTab;
  items: RootTabItem[];
  onTabChange: (next: RootTab) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  drawerWidth?: number;
  collapsedWidth?: number;
  safeInsetLeft?: number;
};

export function BottomTabBar({
  activeTab,
  items,
  onTabChange,
  open,
  onOpenChange,
  drawerWidth = 156,
  collapsedWidth = 44,
  safeInsetLeft = 0,
}: BottomTabBarProps) {
  const progress = useRef(new Animated.Value(open ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: open ? 1 : 0,
      duration: 220,
      useNativeDriver: false,
    }).start();
  }, [open, progress]);

  const collapsedPanelWidth = collapsedWidth + safeInsetLeft;
  const expandedPanelWidth = drawerWidth + safeInsetLeft;

  const panelWidth = useMemo(
    () =>
      progress.interpolate({
        inputRange: [0, 1],
        outputRange: [collapsedPanelWidth, expandedPanelWidth],
      }),
    [collapsedPanelWidth, expandedPanelWidth, progress],
  );

  return (
    <View pointerEvents="box-none" style={styles.shell}>
      <Animated.View
        style={[
          styles.drawer,
          {
            width: panelWidth,
            paddingLeft: safeInsetLeft + 6,
          },
        ]}
      >
        <View style={styles.headRow}>
          <Pressable
            accessibilityRole="button"
            onPress={() => onOpenChange(!open)}
            style={({ pressed }) => [
              styles.expandBtn,
              open && styles.expandBtnOn,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.expandBtnText}>{open ? '‹' : '›'}</Text>
          </Pressable>
          {open ? <Text style={styles.brand}>PG</Text> : null}
        </View>

        <View style={styles.list}>
          {items.map((item) => {
            const active = item.key === activeTab;
            return (
              <Pressable
                key={item.key}
                accessibilityRole="button"
                onPress={() => onTabChange(item.key)}
                style={({ pressed }) => [
                  styles.tab,
                  open ? styles.tabOpen : styles.tabClosed,
                  active && styles.tabActive,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.icon, active && styles.iconActive]}>{item.icon}</Text>
                {open ? <Text style={[styles.label, active && styles.labelActive]}>{item.label}</Text> : null}
              </Pressable>
            );
          })}
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 40,
  },
  drawer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    borderWidth: 1,
    borderColor: '#68d9ff',
    borderTopRightRadius: 14,
    borderBottomRightRadius: 14,
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
    borderLeftWidth: 0,
    backgroundColor: 'rgba(9, 36, 54, 0.96)',
    paddingRight: 6,
    paddingVertical: 8,
    gap: 6,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 1 },
    elevation: 8,
  },
  headRow: {
    minHeight: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  expandBtn: {
    width: 24,
    height: 24,
    borderWidth: 1,
    borderColor: '#70dcfb',
    borderRadius: 7,
    backgroundColor: 'rgba(13, 50, 66, 0.95)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  expandBtnOn: {
    borderColor: '#96ffe8',
    backgroundColor: 'rgba(19, 84, 73, 0.95)',
  },
  expandBtnText: {
    color: '#e7f9ff',
    fontSize: 16,
    fontWeight: '900',
    lineHeight: 16,
  },
  brand: {
    color: '#e4f7ff',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  list: {
    flex: 1,
    gap: 6,
  },
  tab: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#35647a',
    borderRadius: 9,
    backgroundColor: 'rgba(21, 55, 79, 0.96)',
  },
  tabClosed: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 0,
    paddingVertical: 4,
    gap: 0,
  },
  tabOpen: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 6,
  },
  tabActive: {
    borderColor: '#89ffe6',
    backgroundColor: 'rgba(24, 92, 89, 0.98)',
  },
  icon: {
    fontSize: 15,
  },
  iconActive: {
    transform: [{ scale: 1.08 }],
  },
  label: {
    color: '#d8edf7',
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'left',
  },
  labelActive: {
    color: '#f2fffb',
    fontWeight: '900',
  },
  pressed: {
    opacity: 0.88,
  },
});
