// components/customer/LockInHintBanner.tsx
import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useHealth } from '../../contexts/HealthContext';

interface Props {
  onPress: () => void;
}

export function LockInHintBanner({ onPress }: Props) {
  const { healthProfile, hasAnyCondition } = useHealth();
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Pulse animation on the lock icon to draw attention
  useEffect(() => {
    if (!hasAnyCondition) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.2, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [hasAnyCondition]);

  // If locked in and has conditions, show active state
  if (healthProfile.isLocked && hasAnyCondition) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={styles.container}>
        <LinearGradient
          colors={['rgba(16,185,129,0.15)', 'rgba(16,185,129,0.05)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.gradient}
        >
          <View style={[styles.iconBg, { backgroundColor: 'rgba(16,185,129,0.2)' }]}>
            <Feather name="lock" size={16} color="#10b981" />
          </View>
          <View style={styles.textGroup}>
            <Text style={[styles.title, { color: '#10b981' }]}>Lock-In Active 🔒</Text>
            <Text style={styles.subtitle}>
              {healthProfile.conditions.length} condition{healthProfile.conditions.length > 1 ? 's' : ''} monitored · Tap to manage
            </Text>
          </View>
          <View style={[styles.activeDot, { backgroundColor: '#10b981' }]} />
        </LinearGradient>
      </TouchableOpacity>
    );
  }

  // Has conditions but not locked
  if (hasAnyCondition && !healthProfile.isLocked) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={styles.container}>
        <LinearGradient
          colors={['rgba(245,158,11,0.15)', 'rgba(245,158,11,0.05)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.gradient}
        >
          <Animated.View style={[styles.iconBg, { backgroundColor: 'rgba(245,158,11,0.2)', transform: [{ scale: pulseAnim }] }]}>
            <Feather name="unlock" size={16} color="#f59e0b" />
          </Animated.View>
          <View style={styles.textGroup}>
            <Text style={[styles.title, { color: '#f59e0b' }]}>Health profile set — Lock-In off</Text>
            <Text style={styles.subtitle}>Tap to enable health warnings while ordering</Text>
          </View>
          <Feather name="chevron-right" size={16} color="#f59e0b" />
        </LinearGradient>
      </TouchableOpacity>
    );
  }

  // No conditions set yet — encourage setup
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={styles.container}>
      <LinearGradient
        colors={['rgba(249,115,22,0.12)', 'rgba(249,115,22,0.04)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.gradient}
      >
        <Animated.View style={[styles.iconBg, { transform: [{ scale: pulseAnim }] }]}>
          <Feather name="shield" size={16} color="#f97316" />
        </Animated.View>
        <View style={styles.textGroup}>
          <Text style={styles.title}>Set your Health Lock-In 🔒</Text>
          <Text style={styles.subtitle}>Get warnings for foods that don't suit your health</Text>
        </View>
        <Feather name="chevron-right" size={16} color="#f97316" />
      </LinearGradient>
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
    fontWeight: '700',
    color: '#f97316',
  },
  subtitle: {
    fontSize: 11,
    color: '#666',
    lineHeight: 15,
  },
  activeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});