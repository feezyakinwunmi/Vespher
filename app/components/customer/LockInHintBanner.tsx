// components/customer/LockInHintBanner.tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useHealth } from '../../contexts/HealthContext';
import { TC } from '../../theme/palette';

interface Props {
  onPress: () => void;
}

export function LockInHintBanner({ onPress }: Props) {
  const { healthProfile, hasAnyCondition } = useHealth();
  // Already locked in: nothing to prompt, keep Home uncluttered (managed from Profile).
  if (healthProfile.isLocked && hasAnyCondition) {
    return null;
  }

  // Has conditions but not locked
  if (hasAnyCondition && !healthProfile.isLocked) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={styles.container}>
        <View style={[styles.gradient, { backgroundColor: 'rgba(245,158,11,0.15)' }]}>
          <View style={[styles.iconBg, { backgroundColor: 'rgba(245,158,11,0.2)' }]}>
            <Feather name="unlock" size={16} color="#f59e0b" />
          </View>
          <View style={styles.textGroup}>
            <Text style={[styles.title, { color: '#f59e0b' }]}>Health profile set — Lock-In off</Text>
            <Text style={styles.subtitle}>Tap to enable health warnings while ordering</Text>
          </View>
          <Feather name="chevron-right" size={16} color="#f59e0b" />
        </View>
      </TouchableOpacity>
    );
  }

  // No conditions set yet — encourage setup
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={styles.container}>
      <View style={[styles.gradient, { backgroundColor: 'rgba(249,115,22,0.12)' }]}>
        <View style={styles.iconBg}>
          <Feather name="shield" size={16} color="#f97316" />
        </View>
        <View style={styles.textGroup}>
          <Text style={styles.title}>Set your Health Lock-In</Text>
          <Text style={styles.subtitle}>Get warnings for foods that don't suit your health</Text>
        </View>
        <Feather name="chevron-right" size={16} color="#f97316" />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 14,
    overflow: 'hidden',
  },
  gradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(249,115,22,0.2)',
    borderRadius: 14,
  },
  iconBg: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(249,115,22,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  textGroup: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 13,
    fontWeight: '600',
    color: '#f97316',
  },
  subtitle: {
    fontSize: 11,
    color: TC.muted,
    lineHeight: 15,
  },
  activeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});