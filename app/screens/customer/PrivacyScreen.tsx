// app/screens/customer/PrivacyScreen.tsx
import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';

type PrivacyScreenNavigationProp = NativeStackNavigationProp<RootStackParamList>;

export function PrivacyScreen() {
  const navigation = useNavigation<PrivacyScreenNavigationProp>();

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Privacy Policy</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.lastUpdated}>Last Updated: March 2024</Text>
          
          <Text style={styles.paragraph}>
            Your privacy is important to us. This Privacy Policy explains how we collect, use, and protect your personal information when you use Vespher.
          </Text>

          <Text style={styles.subtitle}>Information We Collect</Text>
          <Text style={styles.paragraph}>
            • Account information (name, email, phone number){'\n'}
            • Delivery addresses{'\n'}
            • Order history{'\n'}
            • Payment information (processed securely by our payment partners){'\n'}
            • Device information and location data
          </Text>

          <Text style={styles.subtitle}>How We Use Your Information</Text>
          <Text style={styles.paragraph}>
            • To process and deliver your orders{'\n'}
            • To communicate about your orders{'\n'}
            • To improve our services{'\n'}
            • To send you promotional offers (with your consent){'\n'}
            • To prevent fraud and ensure security
          </Text>

          <Text style={styles.subtitle}>Information Sharing</Text>
          <Text style={styles.paragraph}>
            We share your information with:
          </Text>
          <Text style={styles.paragraph}>
            • Vendors and riders to fulfill your orders{'\n'}
            • Payment processors to handle transactions{'\n'}
            • Service providers who assist in our operations
          </Text>

          <Text style={styles.subtitle}>Data Security</Text>
          <Text style={styles.paragraph}>
            We implement appropriate security measures to protect your personal information. However, no method of transmission over the internet is 100% secure.
          </Text>

          <Text style={styles.subtitle}>Your Rights</Text>
          <Text style={styles.paragraph}>
            You have the right to:
          </Text>
          <Text style={styles.paragraph}>
            • Access your personal data{'\n'}
            • Correct inaccurate data{'\n'}
            • Request deletion of your data{'\n'}
            • Opt-out of marketing communications
          </Text>

          <Text style={styles.subtitle}>Contact Us</Text>
          <Text style={styles.paragraph}>
            If you have questions about this Privacy Policy, please contact us at privacy@vespher.com
          </Text>
        </View>
        <View style={styles.bottomPadding} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
        paddingBottom:60,

  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  content: {
    flex: 1,
  },
  section: {
    padding: 20,
  },
  lastUpdated: {
    fontSize: 12,
    color: '#666',
    marginBottom: 20,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginTop: 20,
    marginBottom: 8,
  },
  paragraph: {
    fontSize: 14,
    color: '#666',
    lineHeight: 22,
    marginBottom: 10,
  },
  bottomPadding: {
    height: 30,
  },
});