// app/screens/customer/SupportScreen.tsx
import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Linking,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';

type SupportScreenNavigationProp = NativeStackNavigationProp<RootStackParamList>;

const faqs = [
  {
    question: 'How do I place an order?',
    answer: 'Browse vendors, select items, add to cart, and checkout. You can pay with cash, card, or bank transfer.',
  },
  {
    question: 'What are the delivery fees?',
    answer: 'Delivery fees vary by vendor and distance. Most vendors in Epe charge between ₦300-₦600.',
  },
  {
    question: 'How long does delivery take?',
    answer: 'Delivery time depends on the vendor and your location. Most orders are delivered within 20-45 minutes.',
  },
  {
    question: 'Can I schedule an order for later?',
    answer: 'Yes! During checkout, you can select a preferred delivery time.',
  },
  {
    question: 'What if my order is wrong or missing items?',
    answer: 'Contact the vendor directly through the app or call our support line for assistance.',
  },
];

const contactOptions = [
  { 
    icon: 'phone' as const, 
    label: 'Call Us', 
    value: '+234 800 123 4567', 
    action: () => Linking.openURL('tel:+2348001234567') 
  },
  { 
    icon: 'mail' as const, 
    label: 'Email Us', 
    value: 'support@vespher.com', 
    action: () => Linking.openURL('mailto:support@vespher.com') 
  },
  { 
    icon: 'message-circle' as const, 
    label: 'WhatsApp', 
    value: '+234 800 123 4567', 
    action: () => Linking.openURL('https://wa.me/2348001234567') 
  },
];

export function SupportScreen() {
  const navigation = useNavigation<SupportScreenNavigationProp>();

  const handleContactPress = (action: () => void) => {
    try {
      action();
    } catch (error) {
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Help & Support</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Contact Options */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contact Us</Text>
          <View style={styles.contactList}>
            {contactOptions.map((option, index) => (
              <TouchableOpacity
                key={index}
                onPress={() => handleContactPress(option.action)}
                style={styles.contactCard}
              >
                <View style={styles.contactIconContainer}>
                  <Feather name={option.icon} size={20} color="#f97316" />
                </View>
                <View style={styles.contactInfo}>
                  <Text style={styles.contactLabel}>{option.label}</Text>
                  <Text style={styles.contactValue}>{option.value}</Text>
                </View>
                <Feather name="chevron-right" size={18} color="#666" />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Quick Links */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Links</Text>
          <View style={styles.quickLinksList}>
            <TouchableOpacity style={styles.quickLinkCard}>
              <Feather name="file-text" size={18} color="#666" />
              <Text style={styles.quickLinkText}>Terms of Service</Text>
              <Feather name="chevron-right" size={18} color="#666" style={styles.quickLinkArrow} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickLinkCard}>
              <Feather name="shield" size={18} color="#666" />
              <Text style={styles.quickLinkText}>Privacy Policy</Text>
              <Feather name="chevron-right" size={18} color="#666" style={styles.quickLinkArrow} />
            </TouchableOpacity>
          </View>
        </View>

        {/* FAQs */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>
          <View style={styles.faqList}>
            {faqs.map((faq, idx) => (
              <View key={idx} style={styles.faqCard}>
                <View style={styles.faqHeader}>
                  <Feather name="help-circle" size={18} color="#f97316" />
                  <Text style={styles.faqQuestion}>{faq.question}</Text>
                </View>
                <Text style={styles.faqAnswer}>{faq.answer}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Version */}
        <View style={styles.versionContainer}>
          <Text style={styles.versionText}>Vespher v1.0.0</Text>
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
    padding: 16,
    paddingBottom: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
  },
  contactList: {
    gap: 8,
  },
  contactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 12,
    gap: 12,
  },
  contactIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: 'rgba(59,130,246,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  contactInfo: {
    flex: 1,
  },
  contactLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#fff',
    marginBottom: 2,
  },
  contactValue: {
    fontSize: 12,
    color: '#666',
  },
  quickLinksList: {
    gap: 8,
  },
  quickLinkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 12,
    gap: 12,
  },
  quickLinkText: {
    flex: 1,
    fontSize: 14,
    color: '#fff',
  },
  quickLinkArrow: {
    marginLeft: 'auto',
  },
  faqList: {
    gap: 8,
  },
  faqCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 12,
  },
  faqHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  faqQuestion: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: '#fff',
  },
  faqAnswer: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
    paddingLeft: 26,
  },
  versionContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  versionText: {
    fontSize: 12,
    color: '#666',
  },
  bottomPadding: {
    height: 20,
  },
});