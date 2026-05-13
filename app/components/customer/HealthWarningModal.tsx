// components/customer/HealthWarningModal.tsx
import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Animated,
  ScrollView,
  Dimensions,
  FlatList,
  Image,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafetyVerdict, HealthCheckResult } from '../../hooks/customer/useHealthCheck';
import { HEALTH_CONDITIONS } from '../../contexts/HealthContext';

const { height, width } = Dimensions.get('window');

interface SuggestedProduct {
  id: string;
  name: string;
  image: string;
  price: number;
  vendorName: string;
  onPress: () => void;
  reason?: string;
}

interface Props {
  visible: boolean;
  productName: string;
  checkResult: HealthCheckResult | null;
  onOrderAnyway: () => void;
  onGoBack: () => void;
  suggestions?: SuggestedProduct[];
}

const VERDICT_CONFIG: Record<SafetyVerdict, {
  color: string;
  bgColor: string;
  icon: string;
  label: string;
  gradientColors: [string, string];
}> = {
  caution: {
    color: '#f59e0b',
    bgColor: 'rgba(245,158,11,0.12)',
    icon: 'alert-triangle',
    label: 'Heads Up',
    gradientColors: ['#f59e0b', '#d97706'],
  },
  avoid: {
    color: '#ef4444',
    bgColor: 'rgba(239,68,68,0.12)',
    icon: 'alert-octagon',
    label: 'Health Warning',
    gradientColors: ['#ef4444', '#dc2626'],
  },
  safe: {
    color: '#10b981',
    bgColor: 'rgba(16,185,129,0.12)',
    icon: 'check-circle',
    label: 'All Clear',
    gradientColors: ['#10b981', '#059669'],
  },
};

export function HealthWarningModal({ 
  visible, 
  productName, 
  checkResult, 
  onOrderAnyway, 
  onGoBack,
  suggestions = [] 
}: Props) {
  const slideAnim = useRef(new Animated.Value(height)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 65,
          friction: 11,
          useNativeDriver: true,
        }),
        Animated.timing(overlayAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: height,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(overlayAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  if (!checkResult) return null;

  const verdict = checkResult.verdict;
  const config = VERDICT_CONFIG[verdict];

  // Get triggered condition metadata
  const triggeredConditions = checkResult.conditions
    .map(id => HEALTH_CONDITIONS.find(c => c.id === id))
    .filter(Boolean);

  const renderSuggestionItem = ({ item }: { item: SuggestedProduct }) => (
    <TouchableOpacity 
      style={styles.suggestionProductCard} 
      onPress={item.onPress}
      activeOpacity={0.8}
    >
      <Image 
        source={{ uri: item.image || 'https://via.placeholder.com/80' }} 
        style={styles.suggestionProductImage} 
      />
      <View style={styles.suggestionProductInfo}>
        <Text style={styles.suggestionProductName} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.suggestionProductVendor} numberOfLines={1}>{item.vendorName}</Text>
        <Text style={styles.suggestionProductPrice}>₦{item.price.toLocaleString()}</Text>
        {item.reason && (
          <View style={styles.suggestionReasonBadge}>
            <Feather name="thumbs-up" size={10} color="#10b981" />
            <Text style={styles.suggestionReasonText}>{item.reason}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <Modal transparent visible={visible} animationType="none" statusBarTranslucent>
      <Animated.View style={[styles.overlay, { opacity: overlayAnim }]}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onGoBack} />
      </Animated.View>

      <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>
        <View style={styles.handleBar} />

        <LinearGradient
          colors={config.gradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.headerGradient}
        >
          <View style={styles.headerContent}>
            <View style={styles.iconCircle}>
              <Feather name={config.icon as any} size={32} color="#fff" />
            </View>
            <View style={styles.headerText}>
              <Text style={styles.verdictLabel}>🔒 Lock-In Alert — {config.label}</Text>
              <Text style={styles.productNameHeader} numberOfLines={2}>{productName}</Text>
            </View>
          </View>
        </LinearGradient>

        <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
          <View style={[styles.reasonCard, { backgroundColor: config.bgColor, borderColor: config.color }]}>
            <Text style={[styles.reasonText, { color: config.color }]}>{checkResult.reason}</Text>
          </View>

          {triggeredConditions.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Your active conditions affected:</Text>
              <View style={styles.conditionsList}>
                {triggeredConditions.map(cond => (
                  <View key={cond!.id} style={[styles.conditionChip, { borderColor: cond!.color }]}>
                    <Text style={styles.conditionIcon}>{cond!.icon}</Text>
                    <Text style={[styles.conditionLabel, { color: cond!.color }]}>{cond!.label}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {checkResult.effects.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Potential effects:</Text>
              {checkResult.effects.map((effect, i) => (
                <View key={i} style={styles.effectRow}>
                  <View style={[styles.effectDot, { backgroundColor: config.color }]} />
                  <Text style={styles.effectText}>{effect}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Horizontal Suggestions Section */}
          {suggestions.length > 0 && (
            <View style={styles.suggestionsSection}>
              <View style={styles.suggestionsHeader}>
                <Feather name="heart" size={16} color="#10b981" />
                <Text style={styles.suggestionsTitle}>Better for you</Text>
                <Text style={styles.suggestionsSubtitle}>Try these instead</Text>
              </View>
              
              <FlatList
                horizontal
                showsHorizontalScrollIndicator={false}
                data={suggestions}
                keyExtractor={(item) => item.id}
                renderItem={renderSuggestionItem}
                contentContainerStyle={styles.suggestionsList}
                snapToInterval={140}
                decelerationRate="fast"
              />
            </View>
          )}

          <Text style={styles.disclaimer}>
            Based on your Lock-In health preferences
          </Text>
        </ScrollView>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.goBackButton} onPress={onGoBack}>
            <Feather name="arrow-left" size={18} color="#fff" />
            <Text style={styles.goBackText}>Go Back</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.orderAnywayButton, { borderColor: config.color }]}
            onPress={onOrderAnyway}
          >
            <Text style={[styles.orderAnywayText, { color: config.color }]}>Order Anyway</Text>
            <Feather name="chevron-right" size={16} color={config.color} />
          </TouchableOpacity>
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#111',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: height * 0.85,
    overflow: 'hidden',
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#333',
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 4,
  },
  headerGradient: {
    marginHorizontal: 16,
    marginVertical: 12,
    borderRadius: 16,
    padding: 16,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerText: {
    flex: 1,
    gap: 4,
  },
  verdictLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.85)',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  productNameHeader: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  body: {
    paddingHorizontal: 16,
    flexGrow: 0,
  },
  reasonCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 16,
  },
  reasonText: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 22,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  conditionsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  conditionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#1a1a1a',
  },
  conditionIcon: {
    fontSize: 14,
  },
  conditionLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  effectRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 8,
  },
  effectDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 6,
  },
  effectText: {
    flex: 1,
    fontSize: 14,
    color: '#ccc',
    lineHeight: 20,
  },
  suggestionsSection: {
    marginTop: 8,
    marginBottom: 8,
  },
  suggestionsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  suggestionsTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#10b981',
  },
  suggestionsSubtitle: {
    fontSize: 12,
    color: '#666',
  },
  suggestionsList: {
    paddingRight: 16,
    gap: 12,
  },
  suggestionProductCard: {
    width: 130,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    marginRight: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.2)',
  },
  suggestionProductImage: {
    width: '100%',
    height: 100,
    resizeMode: 'cover',
  },
  suggestionProductInfo: {
    padding: 10,
  },
  suggestionProductName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 2,
  },
  suggestionProductVendor: {
    fontSize: 10,
    color: '#888',
    marginBottom: 4,
  },
  suggestionProductPrice: {
    fontSize: 12,
    fontWeight: '700',
    color: '#f97316',
  },
  suggestionReasonBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16,185,129,0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    marginTop: 6,
    alignSelf: 'flex-start',
  },
  suggestionReasonText: {
    fontSize: 8,
    color: '#10b981',
  },
  disclaimer: {
    fontSize: 11,
    color: '#444',
    textAlign: 'center',
    marginVertical: 12,
    lineHeight: 16,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderTopColor: '#1a1a1a',
  },
  goBackButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#f97316',
    borderRadius: 14,
    paddingVertical: 14,
  },
  goBackText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  orderAnywayButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderRadius: 14,
    paddingVertical: 14,
    backgroundColor: 'transparent',
  },
  orderAnywayText: {
    fontSize: 14,
    fontWeight: '600',
  },
});