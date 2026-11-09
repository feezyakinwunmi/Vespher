// app/screens/customer/PrivacyScreen.tsx
import { SUPPORT } from '../../config/support';
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
          <Text style={styles.lastUpdated}>Last Updated: November 2026</Text>

          <Text style={styles.subtitle}>Information we collect</Text>
          <Text style={styles.paragraph}>Account details (name, email, phone). Delivery addresses and your device location while you use the app. Order and payment records; card details are handled by Paystack and never stored by us. Messages you send in the app. Health details you choose to add, such as conditions, allergies, diets and goals. For vendors: business and bank details. For riders: identity documents, licence, guarantor and bank details, and live location while online or on a delivery.</Text>

          <Text style={styles.subtitle}>Health details</Text>
          <Text style={styles.paragraph}>Health details are optional and only stored after you agree. They are used only to personalise food suggestions and warn you about meals that may not suit you. They are private to your account, are not shown to vendors or riders, are not used for advertising and are never sold. You can edit or remove them in your Profile at any time. Vesphe does not provide medical advice, diagnosis or treatment.</Text>

          <Text style={styles.subtitle}>Location</Text>
          <Text style={styles.paragraph}>We use your location while the app is open to find nearby vendors and set delivery addresses. Riders share their location while the app is open and they are online or delivering, so customers and vendors can follow an order. We do not track location when the app is closed.</Text>

          <Text style={styles.subtitle}>How we use your information</Text>
          <Text style={styles.paragraph}>To process and deliver orders, take payments, verify riders and vendors, provide support, send order updates and keep the service secure.</Text>

          <Text style={styles.subtitle}>Who we share it with</Text>
          <Text style={styles.paragraph}>Vendors and riders receive what they need to fulfil your order, such as your name, phone number and delivery address. Our service providers process data for us: Supabase (hosting), Paystack (payments), Google (maps and sign-in), Apple (sign-in) and Expo (push notifications). We do not sell your personal data.</Text>

          <Text style={styles.subtitle}>Security and retention</Text>
          <Text style={styles.paragraph}>Data is encrypted in transit and at rest, and access is restricted. We keep your data while your account is active. Anonymised order records are kept for accounting and legal reasons after an account is deleted.</Text>

          <Text style={styles.subtitle}>Your rights and account deletion</Text>
          <Text style={styles.paragraph}>You can access, correct or delete your data, and withdraw consent, under the Nigeria Data Protection Act 2023. To delete your account, go to Profile and tap Delete account. This permanently removes your profile, addresses, health details, saved cards, bank details and rider documents.</Text>

          <Text style={styles.subtitle}>Children</Text>
          <Text style={styles.paragraph}>Vesphe is not intended for children under 18.</Text>

          <Text style={styles.subtitle}>Contact Us</Text>
          <Text style={styles.paragraph}>
            If you have questions about this Privacy Policy, please contact us at {SUPPORT.email}
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