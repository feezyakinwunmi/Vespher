// app/screens/OnboardingScreen.tsx
import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Dimensions,
  Animated,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { RootStackParamList } from '../navigation/types';
import { Image } from 'react-native';

const { width } = Dimensions.get('window');

type OnboardingScreenNavigationProp = NativeStackNavigationProp<RootStackParamList>;

const ORANGE_GRADIENT: readonly [string, string] = ['#f97316', '#f43f5e'] as const;

const slides = [
  {
    id: '1',
    icon: 'shopping-bag',
    // use image
    image: require('../assets/logo.png'), // replace with your image path

    title: 'Order Food',
    description: 'Browse from 50+ local vendors and restaurants in Epe',
    colors: ORANGE_GRADIENT,
  },
  {
    id: '2',
    icon: 'truck',
    image: require('../assets/logistic.png'), // replace with your image path  
    title: 'Fast Delivery',
    description: 'Get your food delivered to your doorstep in 30-45 minutes',
    colors: ORANGE_GRADIENT,
  },
  {
    id: '3',
    icon: 'credit-card',
    image: require('../assets/box.png'), // replace with your image path
    title: 'Secure Payment',
    description: 'Pay with cash, card, or bank transfer - your choice',
    colors: ORANGE_GRADIENT,
  },
];

export function OnboardingScreen() {
  const navigation = useNavigation<OnboardingScreenNavigationProp>();
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollX = useRef(new Animated.Value(0)).current;
  const slidesRef = useRef<FlatList>(null);


  const viewableItemsChanged = useRef(({ viewableItems }: any) => {
    setCurrentIndex(viewableItems[0].index);
  }).current;

  const scrollTo = () => {
    
    if (currentIndex < slides.length - 1) {
      slidesRef.current?.scrollToIndex({ 
        index: currentIndex + 1,
        animated: true 
      });
    } else {
      try {
        navigation.navigate('RoleSelection');
      } catch (error) {
        console.error('Navigation error:', error);
        Alert.alert('Error', 'Could not navigate');
      }
    }
  };

  const skip = () => {
    try {
      navigation.navigate('RoleSelection');
    } catch (error) {
      console.error('Navigation error:', error);
      Alert.alert('Error', 'Could not navigate');
    }
  };

  const renderSlide = ({ item }: { item: typeof slides[0] }) => {
    return (
      <View style={styles.slide}>
      
          <Image
            source={item.image}
            style={{ width: 300, height: 300 }}
            resizeMode="contain"
          />
        <Text style={styles.slideTitle}>{item.title}</Text>
        <Text style={styles.slideDescription}>{item.description}</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Skip Button */}
      {currentIndex < slides.length - 1 && (
        <TouchableOpacity 
          onPress={skip} 
          style={styles.skipButton}
          activeOpacity={0.7}
        >
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      )}

      {/* Slides */}
      <FlatList
        data={slides}
        renderItem={renderSlide}
        horizontal
        showsHorizontalScrollIndicator={false}
        pagingEnabled
        bounces={false}
        keyExtractor={(item) => item.id}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: false }
        )}
        onViewableItemsChanged={viewableItemsChanged}
        ref={slidesRef}
        scrollEventThrottle={32}
        getItemLayout={(_, index) => ({
          length: width,
          offset: width * index,
          index,
        })}
      />

      {/* Pagination Dots */}
      <View style={styles.paginationContainer}>
        {slides.map((_, i) => {
          const inputRange = [(i - 1) * width, i * width, (i + 1) * width];
          const dotWidth = scrollX.interpolate({
            inputRange,
            outputRange: [10, 30, 10],
            extrapolate: 'clamp',
          });
          const opacity = scrollX.interpolate({
            inputRange,
            outputRange: [0.3, 1, 0.3],
            extrapolate: 'clamp',
          });

          return (
            <Animated.View
              key={i}
              style={[
                styles.dot,
                { width: dotWidth, opacity },
                i === currentIndex && styles.activeDot,
              ]}
            />
          );
        })}
      </View>

      {/* Next/Get Started Button */}
      <TouchableOpacity 
        onPress={scrollTo} 
        style={styles.nextButtonContainer}
        activeOpacity={0.7}
      >
        <LinearGradient
          colors={ORANGE_GRADIENT}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.nextButton}
        >
          <Text style={styles.nextButtonText}>
            {currentIndex === slides.length - 1 ? 'Get Started' : 'Next'}
          </Text>
          <Feather 
            name={currentIndex === slides.length - 1 ? 'check' : 'arrow-right'} 
            size={20} 
            color="#fff" 
          />
        </LinearGradient>
      </TouchableOpacity>

      {currentIndex === slides.length - 1 && (
        <TouchableOpacity 
          onPress={() => {
            navigation.navigate('Login');
          }} 
          style={styles.loginContainer}
          activeOpacity={0.7}
        >
          <Text style={styles.loginText}>
            Already have an account?{' '}
            <Text style={styles.loginHighlight}>Sign In</Text>
          </Text>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  skipButton: {
    position: 'absolute',
    top: 20,
    right: 20,
    zIndex: 10,
    padding: 10,
  },
  skipText: {
    color: '#9ca3af',
    fontSize: 16,
    fontWeight: '500',
  },
  slide: {
    width,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 40,
    shadowColor: '#f97316',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  slideTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
    textAlign: 'center',
  },
  slideDescription: {
    fontSize: 16,
    color: '#9ca3af',
    textAlign: 'center',
    paddingHorizontal: 20,
    lineHeight: 24,
  },
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 30,
  },
  dot: {
    height: 10,
    borderRadius: 5,
    backgroundColor: '#9ca3af',
    marginHorizontal: 4,
  },
  activeDot: {
    backgroundColor: '#f97316',
  },
  nextButtonContainer: {
    marginHorizontal: 24,
    marginBottom: 16,
  },
  nextButton: {
    height: 56,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  nextButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  loginContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  loginText: {
    color: '#9ca3af',
    fontSize: 16,
  },
  loginHighlight: {
    color: '#f97316',
    fontWeight: '600',
  },
});