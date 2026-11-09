// app/screens/OnboardingScreen.tsx
import React, { useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, Dimensions, Animated, Image } from 'react-native';
import type { ImageSourcePropType } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { RootStackParamList } from '../navigation/types';
import { MEDICAL_DISCLAIMER } from '../config/legal';

const { width } = Dimensions.get('window');

type Nav = NativeStackNavigationProp<RootStackParamList>;
type IconName = React.ComponentProps<typeof Feather>['name'];

const GRADIENT: readonly [string, string] = ['#f97316', '#f43f5e'];

interface Slide {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  image?: ImageSourcePropType;
  points?: { icon: IconName; label: string }[];
  disclaimer?: boolean;
}

const slides: Slide[] = [
  {
    id: 'food',
    eyebrow: 'FOOD',
    title: 'Your favourite food, close by',
    description: 'Browse restaurants and local vendors around you, build your cart and pay by card or cash.',
    image: require('../assets/loginp.png'),
  },
  {
    id: 'health',
    eyebrow: 'HEALTH',
    title: 'Food that suits you',
    description: 'Tell us about your allergies, diet and health goals. We flag meals that may not suit you before you order.',
    points: [
      { icon: 'alert-triangle', label: 'Allergen warnings on dishes' },
      { icon: 'heart', label: 'Picks matched to your profile' },
      { icon: 'lock', label: 'Your health details stay private' },
    ],
  },
  {
    id: 'delivery',
    eyebrow: 'DELIVERY',
    title: 'Track it to your door',
    description: 'Vesphe riders carry numbered bags. Follow your order live, then confirm it with your delivery code.',
    image: require('../assets/logistic.png'),
  },
  {
    id: 'earn',
    eyebrow: 'GROW WITH US',
    title: 'Sell or ride with Vesphe',
    description: 'List your shop and reach new customers, or apply to deliver with a Vesphe bike and earn on every trip.',
    image: require('../assets/vendorp.png'),
  },
  {
    id: 'notice',
    eyebrow: 'BEFORE YOU START',
    title: 'A note about your health',
    description: '',
    disclaimer: true,
  },
];

export function OnboardingScreen() {
  const navigation = useNavigation<Nav>();
  // The Skip button is absolutely positioned, so it ignores the safe-area padding.
  const insets = useSafeAreaInsets();
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollX = useRef(new Animated.Value(0)).current;
  const slidesRef = useRef<FlatList>(null);
  const lastIndex = slides.length - 1;
  const isLast = currentIndex === lastIndex;

  const viewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems[0]) setCurrentIndex(viewableItems[0].index);
  }).current;

  const goTo = (index: number) => slidesRef.current?.scrollToIndex({ index, animated: true });

  const next = () => {
    if (isLast) navigation.navigate('RoleSelection');
    else goTo(currentIndex + 1);
  };

  const renderSlide = ({ item }: { item: Slide }) => (
    <View style={styles.slide}>
      {item.image ? (
        <Image source={item.image} style={styles.image} resizeMode="contain" />
      ) : (
        <LinearGradient colors={GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.iconBadge}>
          <Feather name={item.disclaimer ? 'shield' : 'heart'} size={44} color="#fff" />
        </LinearGradient>
      )}
      <Text style={styles.eyebrow}>{item.eyebrow}</Text>
      <Text style={styles.title}>{item.title}</Text>
      {item.description ? <Text style={styles.description}>{item.description}</Text> : null}
      {item.points && (
        <View style={styles.points}>
          {item.points.map(p => (
            <View key={p.label} style={styles.point}>
              <Feather name={p.icon} size={16} color="#f97316" />
              <Text style={styles.pointText}>{p.label}</Text>
            </View>
          ))}
        </View>
      )}
      {item.disclaimer && (
        <View style={styles.notice}>
          <Text style={styles.noticeText}>{MEDICAL_DISCLAIMER}</Text>
        </View>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Skip moves to the health notice, which everyone sees before signing up. */}
      {!isLast && (
        <TouchableOpacity onPress={() => goTo(lastIndex)} style={[styles.skipButton, { top: insets.top + 12 }]} activeOpacity={0.7}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      )}

      <FlatList
        data={slides}
        renderItem={renderSlide}
        horizontal
        showsHorizontalScrollIndicator={false}
        pagingEnabled
        bounces={false}
        keyExtractor={item => item.id}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], { useNativeDriver: false })}
        onViewableItemsChanged={viewableItemsChanged}
        ref={slidesRef}
        scrollEventThrottle={32}
        getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
      />

      <View style={styles.pagination}>
        {slides.map((s, i) => {
          const inputRange = [(i - 1) * width, i * width, (i + 1) * width];
          const dotWidth = scrollX.interpolate({ inputRange, outputRange: [8, 26, 8], extrapolate: 'clamp' });
          const opacity = scrollX.interpolate({ inputRange, outputRange: [0.3, 1, 0.3], extrapolate: 'clamp' });
          return <Animated.View key={s.id} style={[styles.dot, { width: dotWidth, opacity }]} />;
        })}
      </View>

      <TouchableOpacity onPress={next} style={styles.nextWrap} activeOpacity={0.8}>
        <LinearGradient colors={GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.nextButton}>
          <Text style={styles.nextText}>{isLast ? 'I understand, get started' : 'Next'}</Text>
          <Feather name={isLast ? 'check' : 'arrow-right'} size={20} color="#fff" />
        </LinearGradient>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => navigation.navigate('Login')} style={styles.loginWrap} activeOpacity={0.7}>
        <Text style={styles.loginText}>
          Already have an account? <Text style={styles.loginHighlight}>Sign In</Text>
        </Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  skipButton: { position: 'absolute', right: 20, zIndex: 10, padding: 10 },
  skipText: { color: '#9ca3af', fontSize: 16, fontWeight: '500' },
  slide: { width, flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  image: { width: 250, height: 250, marginBottom: 12 },
  iconBadge: { width: 110, height: 110, borderRadius: 32, justifyContent: 'center', alignItems: 'center', marginBottom: 28 },
  eyebrow: { color: '#f97316', fontSize: 12, fontWeight: '800', letterSpacing: 1.6, marginBottom: 10 },
  title: { fontSize: 28, fontWeight: '800', color: '#fff', marginBottom: 12, textAlign: 'center', lineHeight: 34 },
  description: { fontSize: 15.5, color: '#9ca3af', textAlign: 'center', lineHeight: 23 },
  points: { alignSelf: 'stretch', gap: 10, marginTop: 22 },
  point: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    backgroundColor: '#141414',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  pointText: { color: '#e5e5e5', fontSize: 14, flex: 1 },
  notice: {
    alignSelf: 'stretch',
    marginTop: 4,
    padding: 18,
    borderRadius: 16,
    backgroundColor: 'rgba(249,115,22,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(249,115,22,0.3)',
  },
  noticeText: { color: '#f5f5f5', fontSize: 15, lineHeight: 23, textAlign: 'center' },
  pagination: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, marginBottom: 24 },
  dot: { height: 8, borderRadius: 4, backgroundColor: '#f97316' },
  nextWrap: { marginHorizontal: 24, marginBottom: 14 },
  nextButton: { height: 56, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  nextText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  loginWrap: { alignItems: 'center', marginBottom: 18 },
  loginText: { color: '#9ca3af', fontSize: 15 },
  loginHighlight: { color: '#f97316', fontWeight: '600' },
});
