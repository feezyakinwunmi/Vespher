import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { Image } from 'react-native';

type SplashScreenNavigationProp = NativeStackNavigationProp<RootStackParamList>;

export function SplashScreen() {

  const navigation = useNavigation<SplashScreenNavigationProp>();

  useEffect(() => {
    const timer = setTimeout(() => {
navigation.navigate('Onboarding');
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <LinearGradient
      colors={['black', 'black']} 
      style={styles.container}
    >
      <View style={styles.content}>
        <View style={styles.logoContainer}>
          {/* add image as logo */}
          <Image
            source={require('../assets/logo.png')} // replace with your logo path
            style={styles.logo}
            resizeMode="contain"
          />
        </View>
        <Text style={styles.title}>vesphe</Text>
        <Text style={styles.subtitle}>Your favorite food, delivered fast</Text>
        <ActivityIndicator size="large" color="#fff" style={styles.loader} />
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    width: 100,
    height: 100,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  logo: {
    width: '100%',
    height: '100%',
  },
  logoText: {
    fontSize: 50,
    fontWeight: 'bold',
    color: '#fff',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 40,
  },
  loader: {
    marginTop: 20,
  },
});