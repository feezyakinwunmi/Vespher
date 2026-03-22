// app/screens/vendor/VendorSettingsScreen.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Image,
  TextInput,
  Switch,
  Modal,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../contexts/AuthContext';
import { BusinessHours, useVendorProfile, VendorProfile } from '../../hooks/vendor/useVendorProfile';
import { PromoCodeManager } from '../../components/vendor/PromoCodeManager';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../../lib/supabase';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import Toast from 'react-native-toast-message';
import { verifyBankAccount } from '../../utils/flutterwave';

type VendorScreenNavigationProp = NativeStackNavigationProp<RootStackParamList>;
type SettingsTab = 'profile' | 'business' | 'bank' | 'preferences' | 'promos' | 'support' ; // ✅ Added 'payouts'
type NotificationKey = keyof VendorProfile['notifications'];

// ✅ Updated banks with Flutterwave codes
const banks = [
  { label: 'GTBank', value: 'gtb', code: '058' },
  { label: 'First Bank', value: 'first', code: '011' },
  { label: 'UBA', value: 'uba', code: '033' },
  { label: 'Zenith Bank', value: 'zenith', code: '057' },
  { label: 'Access Bank', value: 'access', code: '044' },
  { label: 'Kuda Bank', value: 'kuda', code: '090267' },
  { label: 'OPay', value: 'opay', code: '100052' },
  { label: 'PalmPay', value: 'palmpay', code: '100033' },
  { label: 'Fidelity Bank', value: 'fidelity', code: '070' },
  { label: 'Union Bank', value: 'union', code: '032' },
  { label: 'Sterling Bank', value: 'sterling', code: '232' },
  { label: 'Wema Bank', value: 'wema', code: '035' },
];

type DayKey = keyof BusinessHours;

const businessCategories = [
  { value: 'restaurant', label: 'Restaurant' },
  { value: 'fastfood', label: 'Fast Food' },
  { value: 'local', label: 'Local Cuisine' },
  { value: 'seafood', label: 'Seafood' },
  { value: 'groceries', label: 'Groceries' },
  { value: 'pharmacy', label: 'Pharmacy' },
];

const days: { key: DayKey; label: string }[] = [
  { key: 'mon', label: 'Monday' },
  { key: 'tue', label: 'Tuesday' },
  { key: 'wed', label: 'Wednesday' },
  { key: 'thu', label: 'Thursday' },
  { key: 'fri', label: 'Friday' },
  { key: 'sat', label: 'Saturday' },
  { key: 'sun', label: 'Sunday' },
];

const notificationItems: { key: NotificationKey; label: string }[] = [
  { key: 'newOrders', label: 'New Order Alerts' },
  { key: 'orderUpdates', label: 'Order Status Updates' },
  { key: 'payments', label: 'Payment Notifications' },
];

// Terms & Conditions Page (keep as is)
function TermsConditionsScreen({ onClose }: { onClose: () => void }) {
  // ... (keep your existing code)
  return (
    <Modal animationType="slide" transparent={false} onRequestClose={onClose}>
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose} style={styles.modalCloseButton}>
            <Feather name="x" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Terms & Conditions</Text>
          <View style={{ width: 40 }} />
        </View>
        
        <ScrollView style={styles.modalContent}>
          <Text style={styles.modalSectionTitle}>1. Acceptance of Terms</Text>
          <Text style={styles.modalText}>
            By accessing and using Vespher as a vendor, you agree to be bound by these Terms and Conditions. 
            If you do not agree with any part of these terms, you may not use our platform.
          </Text>

          <Text style={styles.modalSectionTitle}>2. Vendor Responsibilities</Text>
          <Text style={styles.modalText}>
            • Maintain accurate menu items and pricing{"\n"}
            • Process orders in a timely manner{"\n"}
            • Ensure food quality and safety standards{"\n"}
            • Provide accurate business information{"\n"}
            • Respond to customer inquiries promptly
          </Text>

          <Text style={styles.modalSectionTitle}>3. Commission and Fees</Text>
          <Text style={styles.modalText}>
            Vespher charges a commission on each order processed through our platform. The current commission 
            rate is displayed in your dashboard. This rate may be subject to change with prior notice.
          </Text>

          <Text style={styles.modalSectionTitle}>4. Payment Terms</Text>
          <Text style={styles.modalText}>
            Vendor payouts are processed on  weekdays . Payments are made to the bank account information 
            provided in your settings. You are responsible for ensuring your bank details are accurate.
          </Text>

          <Text style={styles.modalSectionTitle}>5. Cancellation and Refunds</Text>
          <Text style={styles.modalText}>
            Vendors may cancel orders only in exceptional circumstances. Refunds are handled according to 
            Vespher's refund policy. Repeated cancellations may affect your vendor standing.
          </Text>

          <Text style={styles.modalSectionTitle}>6. Platform Usage</Text>
          <Text style={styles.modalText}>
            You agree not to misuse the platform, attempt to circumvent commission fees, or engage in any 
            fraudulent activities. Vespher reserves the right to suspend accounts violating these terms.
          </Text>

          <Text style={styles.modalSectionTitle}>7. Limitation of Liability</Text>
          <Text style={styles.modalText}>
            Vespher is not liable for any indirect, incidental, or consequential damages arising from your 
            use of the platform. Our total liability is limited to the commissions earned from your account.
          </Text>

          <Text style={styles.modalSectionTitle}>8. Modifications</Text>
          <Text style={styles.modalText}>
            Vespher reserves the right to modify these terms at any time. Continued use of the platform 
            constitutes acceptance of modified terms.
          </Text>

          <Text style={styles.modalLastUpdated}>Last Updated: March 15, 2026</Text>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// Privacy Policy Page (keep as is)
function PrivacyPolicyScreen({ onClose }: { onClose: () => void }) {
  // ... (keep your existing code)
  return (
    <Modal animationType="slide" transparent={false} onRequestClose={onClose}>
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose} style={styles.modalCloseButton}>
            <Feather name="x" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Privacy Policy</Text>
          <View style={{ width: 40 }} />
        </View>
        
        <ScrollView style={styles.modalContent}>
          <Text style={styles.modalSectionTitle}>Information We Collect</Text>
          <Text style={styles.modalText}>
            • Business information (name, address, contact details){"\n"}
            • Bank account details for payouts{"\n"}
            • Menu and pricing information{"\n"}
            • Order history and performance data{"\n"}
            • Communications with customers
          </Text>

          <Text style={styles.modalSectionTitle}>How We Use Your Information</Text>
          <Text style={styles.modalText}>
            • Process orders and payments{"\n"}
            • Communicate about orders and platform updates{"\n"}
            • Improve our services and vendor experience{"\n"}
            • Comply with legal obligations{"\n"}
            • Prevent fraud and ensure platform security
          </Text>

          <Text style={styles.modalSectionTitle}>Data Sharing</Text>
          <Text style={styles.modalText}>
            We share your information with:
            • Customers (business name, menu, contact for order purposes){"\n"}
            • Payment processors for transaction handling{"\n"}
            • Delivery partners for order fulfillment{"\n"}
            • Legal authorities when required by law
          </Text>

          <Text style={styles.modalSectionTitle}>Data Security</Text>
          <Text style={styles.modalText}>
            We implement industry-standard security measures to protect your data. However, no method of 
            transmission over the internet is 100% secure. You are responsible for maintaining the 
            confidentiality of your account credentials.
          </Text>

          <Text style={styles.modalSectionTitle}>Your Rights</Text>
          <Text style={styles.modalText}>
            You have the right to:
            • Access your personal data{"\n"}
            • Correct inaccurate data{"\n"}
            • Request data deletion{"\n"}
            • Opt out of marketing communications
          </Text>

          <Text style={styles.modalLastUpdated}>Last Updated: March 15, 2026</Text>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// Help & Support Page (keep as is)
function HelpSupportScreen({ onClose }: { onClose: () => void }) {
  const handleCall = () => {
    Linking.openURL('tel:09161460898');
  };

  const handleWhatsApp = () => {
    Linking.openURL('https://wa.me/2349161460898');
  };

  const handleEmail = () => {
    Linking.openURL('mailto:info.phantomire@gmail.com');
  };

  return (
    <Modal animationType="slide" transparent={false} onRequestClose={onClose}>
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose} style={styles.modalCloseButton}>
            <Feather name="x" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Help & Support</Text>
          <View style={{ width: 40 }} />
        </View>
        
        <ScrollView style={styles.modalContent}>
          <Text style={styles.modalSectionTitle}>Contact Us</Text>
          
          <TouchableOpacity style={styles.contactOption} onPress={handleCall}>
            <View style={styles.contactIconContainer}>
              <Feather name="phone" size={24} color="#f97316" />
            </View>
            <View style={styles.contactInfo}>
              <Text style={styles.contactLabel}>Call Us</Text>
              <Text style={styles.contactValue}>09161460898</Text>
              <Text style={styles.contactNote}>Mon-Fri, 9am - 6pm</Text>
            </View>
            <Feather name="chevron-right" size={20} color="#666" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.contactOption} onPress={handleWhatsApp}>
            <View style={styles.contactIconContainer}>
              <Feather name="message-circle" size={24} color="#25D366" />
            </View>
            <View style={styles.contactInfo}>
              <Text style={styles.contactLabel}>WhatsApp</Text>
              <Text style={styles.contactValue}>09161460898</Text>
              <Text style={styles.contactNote}>Instant messaging support</Text>
            </View>
            <Feather name="chevron-right" size={20} color="#666" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.contactOption} onPress={handleEmail}>
            <View style={styles.contactIconContainer}>
              <Feather name="mail" size={24} color="#f97316" />
            </View>
            <View style={styles.contactInfo}>
              <Text style={styles.contactLabel}>Email</Text>
              <Text style={styles.contactValue}>info.phantomire@gmail.com</Text>
              <Text style={styles.contactNote}>24hr response time</Text>
            </View>
            <Feather name="chevron-right" size={20} color="#666" />
          </TouchableOpacity>

          <View style={styles.divider} />

          <Text style={styles.modalSectionTitle}>Frequently Asked Questions</Text>
          
          <View style={styles.faqItem}>
            <Text style={styles.faqQuestion}>How do I update my menu?</Text>
            <Text style={styles.faqAnswer}>
              Go to your dashboard and click on "Menu" to add, edit, or remove items. Changes are reflected immediately.
            </Text>
          </View>

          

          <View style={styles.faqItem}>
            <Text style={styles.faqQuestion}>How do I handle customer complaints?</Text>
            <Text style={styles.faqAnswer}>
              You can message customers directly through the order details page. For unresolved issues, contact our support team.
            </Text>
          </View>

          <View style={styles.faqItem}>
            <Text style={styles.faqQuestion}>What is the commission rate?</Text>
            <Text style={styles.faqAnswer}>
              The current commission rate is 10% of the order subtotal. This rate is applied to each order.
            </Text>
          </View>

          <View style={styles.faqItem}>
            <Text style={styles.faqQuestion}>Can I temporarily close my business?</Text>
            <Text style={styles.faqAnswer}>
              Yes, you can update your business hours or temporarily mark your business as closed in Settings.
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// Q&A Page (keep as is)
function QAScreen({ onClose }: { onClose: () => void }) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const faqs = [
    {
      question: "How do I start receiving orders?",
      answer: "Once your account is approved, ensure your menu is complete, your business hours are set correctly, and you're open for business. Orders will start appearing in your dashboard automatically."
    },
    {
      question: "What happens when I receive a new order?",
      answer: "You'll receive a notification and the order will appear in your Orders tab. You have a limited time to accept the order before it's automatically cancelled."
    },
    {
      question: "How do I update my menu prices?",
      answer: "Go to the Menu section from your dashboard. Click on any item to edit its price, description, or availability. Changes take effect immediately."
    },
    {
      question: "Why was my order cancelled?",
      answer: "Orders may be cancelled if not accepted within the time limit, if payment fails, or if you're unable to fulfill the order. You'll be notified of the reason."
    },
    {
      question: "How do withdrawal requests work?",
      answer: "You can request withdrawals from your earnings once you have a minimum balance. Requests are processed within 1-3 business days to your registered bank account."
    },
    {
      question: "Can I offer my own promotions?",
      answer: "Yes! You can create promo codes in the Promos section. You can set percentage or fixed discounts, minimum order amounts, and usage limits."
    },
    {
      question: "How do delivery fees work?",
      answer: "Delivery fees are calculated based on distance. You don't pay delivery fees as a vendor - they're handled by the customer and rider."
    },
    {
      question: "What if a customer reports an issue with their order?",
      answer: "Contact the customer through the app to resolve the issue. For refunds or disputes, our support team will guide you through the process."
    },
    {
      question: "How do I change my bank details?",
      answer: "Go to Settings → Bank tab to update your account information. Changes will be verified before the next payout."
    },
    {
      question: "Is there a penalty for cancelling orders?",
      answer: "Frequent order cancellations may affect your vendor rating and could lead to account suspension. Only cancel in genuine emergencies."
    }
  ];

  return (
    <Modal animationType="slide" transparent={false} onRequestClose={onClose}>
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose} style={styles.modalCloseButton}>
            <Feather name="x" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Frequently Asked Questions</Text>
          <View style={{ width: 40 }} />
        </View>
        
        <ScrollView style={styles.modalContent}>
          {faqs.map((faq, index) => (
            <View key={index} style={styles.faqContainer}>
              <TouchableOpacity
                style={styles.faqHeader}
                onPress={() => setExpandedIndex(expandedIndex === index ? null : index)}
              >
                <Text style={styles.faqHeaderQuestion}>{faq.question}</Text>
                <Feather
                  name={expandedIndex === index ? "chevron-up" : "chevron-down"}
                  size={20}
                  color="#f97316"
                />
              </TouchableOpacity>
              
              {expandedIndex === index && (
                <View style={styles.faqBody}>
                  <Text style={styles.faqBodyAnswer}>{faq.answer}</Text>
                </View>
              )}
            </View>
          ))}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// ✅ NEW: Payouts Tab Component
// function PayoutsTab({ profile }: { profile: VendorProfile }) {
//   const [isVerifying, setIsVerifying] = useState(false);
//   const [platformSettings, setPlatformSettings] = useState<any>(null);

//   useEffect(() => {
//     fetchPlatformSettings();
//   }, []);

//   const fetchPlatformSettings = async () => {
//     try {
//       const { data, error } = await supabase
//         .from('platform_settings')
//         .select('*')
//         .order('id', { ascending: false })
//         .limit(1)
//         .single();

//       if (error) throw error;
//       setPlatformSettings(data);
//     } catch (error) {
//       console.error('Error fetching platform settings:', error);
//     }
//   };

//   const getBankLabel = (bankValue: string) => {
//     const bank = banks.find(b => b.value === bankValue);
//     return bank?.label || bankValue;
//   };

// const handleRetrySubaccount = async () => {
//   setIsVerifying(true);
//   try {
//     const selectedBank = banks.find(b => b.value === profile.bankName);
//     if (!selectedBank?.code) {
//       throw new Error('Bank not found');
//     }

//     // First verify the account
//     const verification = await verifyBankAccount(
//       profile.accountNumber || '',
//       selectedBank.code
//     );

//     if (verification.status !== 'success' || !verification.data) {
//       throw new Error('Bank account verification failed');
//     }

//     // Create subaccount
//     const platformFee = platformSettings ? parseFloat(platformSettings.platform_fee_percentage) : 10;
    
//     const result = await createVendorSubaccount({
//       accountBank: selectedBank.code,
//       accountNumber: profile.accountNumber || '',
//       businessName: profile.businessName,
//       businessEmail: profile.email,
//       businessMobile: profile.phone,
//       splitPercentage: platformFee,
//     });

//     if (result.status === 'success' && result.data) {
//       // Update vendor with subaccount ID
//       const { error } = await supabase
//         .from('vendors')
//         .update({ 
//           flutterwave_subaccount_id: result.data.subaccount_id,
//           account_name: result.data.account_name
//         })
//         .eq('id', profile.id);

//       if (error) throw error;

//       Alert.alert('Success', 'Payment setup completed successfully!');
      
//       // ✅ Refresh the profile to show updated subaccount
//       // You'll need to add a refresh function from useVendorProfile
//       // For now, we can reload the page
//       // window.location.reload(); // Or use a refresh callback
//     } else {
//       throw new Error(result.message);
//     }
//   } catch (error: any) {
//     Alert.alert('Error', error.message || 'Failed to setup payment');
//   } finally {
//     setIsVerifying(false);
//   }
// };

//   return (
//     <View style={styles.tabContent}>
//       {/* Payment Status Card */}
//       <View style={styles.paymentStatusCard}>
//         <View style={styles.paymentStatusHeader}>
//           <Feather 
//             name={profile.flutterwave_subaccount_id ? "check-circle" : "alert-circle"} 
//             size={24} 
//             color={profile.flutterwave_subaccount_id ? "#10b981" : "#f59e0b"} 
//           />
//           <View style={styles.paymentStatusInfo}>
//             <Text style={styles.paymentStatusTitle}>
//               {profile.flutterwave_subaccount_id ? 'Payment Active' : 'Payment Setup Required'}
//             </Text>
//             <Text style={styles.paymentStatusSubtitle}>
//               {profile.flutterwave_subaccount_id 
//                 ? 'Your account is ready to receive payments' 
//                 : 'Complete payment setup to start receiving payouts'}
//             </Text>
//           </View>
//         </View>

//         {profile.flutterwave_subaccount_id && (
//           <View style={styles.subaccountInfo}>
//             <Text style={styles.subaccountLabel}>Subaccount ID:</Text>
//             <Text style={styles.subaccountValue} numberOfLines={1}>
//               {profile.flutterwave_subaccount_id}
//             </Text>
//           </View>
//         )}
//       </View>

//       {/* Bank Details Card */}
//       <View style={styles.paymentDetailsCard}>
//         <Text style={styles.paymentDetailsTitle}>Bank Account Details</Text>
        
//         <View style={styles.paymentDetailRow}>
//           <Text style={styles.paymentDetailLabel}>Bank Name:</Text>
//           <Text style={styles.paymentDetailValue}>
//             {getBankLabel(profile.bankName) || 'Not set'}
//           </Text>
//         </View>

//         <View style={styles.paymentDetailRow}>
//           <Text style={styles.paymentDetailLabel}>Account Number:</Text>
//           <Text style={styles.paymentDetailValue}>
//             {profile.accountNumber ? `****${profile.accountNumber.slice(-4)}` : 'Not set'}
//           </Text>
//         </View>

//         <View style={styles.paymentDetailRow}>
//           <Text style={styles.paymentDetailLabel}>Account Name:</Text>
//           <Text style={styles.paymentDetailValue}>
//             {profile.accountName || 'Not set'}
//           </Text>
//         </View>
//       </View>

//       {/* Platform Fee Card */}
//       <View style={styles.paymentDetailsCard}>
//         <Text style={styles.paymentDetailsTitle}>Commission & Fees</Text>
        
//         <View style={styles.paymentDetailRow}>
//           <Text style={styles.paymentDetailLabel}>Platform Commission:</Text>
//           <Text style={styles.paymentDetailValueHighlight}>
//             {platformSettings?.platform_fee_percentage || 10}%
//           </Text>
//         </View>

//         <View style={styles.paymentDetailRow}>
//           <Text style={styles.paymentDetailLabel}>Payment Processor:</Text>
//           <Text style={styles.paymentDetailValue}>Flutterwave</Text>
//         </View>

//         <View style={styles.paymentNote}>
//           <Feather name="info" size={14} color="#f97316" />
//           <Text style={styles.paymentNoteText}>
//             Commission is deducted from each order's subtotal before payout
//           </Text>
//         </View>
//       </View>

//       {/* Retry Button (if no subaccount) */}
//       {!profile.flutterwave_subaccount_id && profile.bankName && profile.accountNumber && (
//         <TouchableOpacity
//           style={styles.retryButton}
//           onPress={handleRetrySubaccount}
//           disabled={isVerifying}
//         >
//           <LinearGradient
//             colors={['#f97316', '#f43f5e']}
//             style={styles.retryButtonGradient}
//           >
//             {isVerifying ? (
//               <ActivityIndicator color="#fff" />
//             ) : (
//               <>
//                 <Feather name="refresh-cw" size={18} color="#fff" />
//                 <Text style={styles.retryButtonText}>Complete Payment Setup</Text>
//               </>
//             )}
//           </LinearGradient>
//         </TouchableOpacity>
//       )}

//       {/* Info Box */}
//       <View style={styles.paymentInfoBox}>
//         <Feather name="info" size={16} color="#666" />
//         <Text style={styles.paymentInfoText}>
//           Payouts are processed weekly. Make sure your bank details are correct to avoid payment delays.
//         </Text>
//       </View>
//     </View>
//   );
// }

export function VendorSettingsScreen() {
  const navigation = useNavigation<VendorScreenNavigationProp>();
  const { signOut } = useAuth();
  const { profile, isLoading, updateProfile } = useVendorProfile();
  
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<any>({});
  const [isUploading, setIsUploading] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  
  // Modal states
  const [showTerms, setShowTerms] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showQA, setShowQA] = useState(false);
  
  // ✅ Bank verification state
  const [isVerifyingBank, setIsVerifyingBank] = useState(false);
  const [bankVerified, setBankVerified] = useState(false);
  const [verificationError, setVerificationError] = useState('');
  
  const showToast = (message: string) => {
    Toast.show({
      type: 'success',
      text1: message,
      position: 'bottom',
      visibilityTime: 2000,
    });
  };

  const handleLogout = async () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            await signOut();
          },
        },
      ]
    );
  };

  // ✅ Bank verification function
 const handleVerifyBank = async () => {
  if (!formData.accountNumber || !formData.bankName) {
    setVerificationError('Please select bank and enter account number');
    return;
  }

  setIsVerifyingBank(true);
  setVerificationError('');

  try {
    const selectedBank = banks.find(b => b.value === formData.bankName);
    if (!selectedBank?.code) {
      throw new Error('Invalid bank selection');
    }

    const result = await verifyBankAccount(
      formData.accountNumber,
      selectedBank.code
    );

    if (result.status === 'success' && result.data) {
      setFormData((prev: any) => ({ 
        ...prev, 
        accountName: result.data?.account_name || '',
        bankCode: selectedBank.code, // ✅ Save bank code too
      }));
      setBankVerified(true);
      showToast(`Account verified: ${result.data.account_name}`);
    } else {
      throw new Error(result.message);
    }
  } catch (error: any) {
    console.error('Verification error:', error);
    setVerificationError(error.message || 'Invalid account details');
    setBankVerified(false);
  } finally {
    setIsVerifyingBank(false);
  }
};

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#f97316" />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.errorContainer}>
        <Feather name="alert-circle" size={48} color="#ef4444" />
        <Text style={styles.errorText}>Failed to load profile</Text>
      </View>
    );
  }

  const tabs = [
    { id: 'profile', label: 'Profile', icon: 'user' },
    { id: 'business', label: 'Business', icon: 'home' },
    { id: 'bank', label: 'Bank', icon: 'credit-card' },
    // { id: 'payouts', label: 'Payouts', icon: 'dollar-sign' }, // ✅ Added Payouts tab
    { id: 'preferences', label: 'Settings', icon: 'clock' },
    { id: 'promos', label: 'Promos', icon: 'tag' },
    { id: 'support', label: 'Help', icon: 'help-circle' },
  ];

  const handleEdit = () => {
    setFormData({
      ...profile,
      businessHours: { ...profile.businessHours }
    });
    setBankVerified(false);
    setVerificationError('');
    setIsEditing(true);
  };

 const handleSave = async () => {
  try {

      const profileData: Partial<VendorProfile> = {
      name: formData.name,
      phone: formData.phone,
      businessName: formData.businessName,
      businessCategory: formData.businessCategory,
      businessAddress: formData.businessAddress,
      businessDescription: formData.businessDescription,
      businessLogo: formData.businessLogo,
      businessCover: formData.businessCover,
      avatar_url: formData.avatar_url,
      notifications: formData.notifications,
      businessHours: formData.businessHours,
      // Bank fields that exist in VendorProfile
      bankName: formData.bankName,
      accountNumber: formData.accountNumber,
      accountName: formData.accountName,
    };
    // Update profile with new data
    await updateProfile(  profileData );
    
    setIsEditing(false);
    showToast('Profile updated successfully');
    
  } catch (error) {
    console.error('Error saving:', error);
    showToast('Failed to update profile');
  }
};

  const handleCancel = () => {
    setIsEditing(false);
    setFormData({});
    setBankVerified(false);
    setVerificationError('');
  };

  const pickImage = async (type: 'avatar' | 'logo' | 'cover') => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: type === 'cover' ? [16, 9] : [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setIsUploading(true);
      try {
        const file = result.assets[0];
        const fileName = `${type}-${Date.now()}.jpg`;
        const filePath = `vendors/${profile.id}/${fileName}`;

        const response = await fetch(file.uri);
        const blob = await response.blob();

        const { error: uploadError } = await supabase.storage
          .from(`vendor-${type}s`)
          .upload(filePath, blob, {
            cacheControl: '3600',
            upsert: true,
          });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from(`vendor-${type}s`)
          .getPublicUrl(filePath);

        if (type === 'avatar') {
          setFormData({ ...formData, avatar_url: publicUrl });
        } else if (type === 'logo') {
          setFormData({ ...formData, businessLogo: publicUrl });
        } else {
          setFormData({ ...formData, businessCover: publicUrl });
        }

        showToast('Image uploaded successfully');
      } catch (error) {
        console.error('Error uploading image:', error);
        showToast('Failed to upload image');
      } finally {
        setIsUploading(false);
      }
    }
  };

  const renderSupportTab = () => (
    <View style={styles.tabContent}>
      <TouchableOpacity style={styles.supportOption} onPress={() => setShowQA(true)}>
        <View style={styles.supportIconContainer}>
          <Feather name="help-circle" size={24} color="#f97316" />
        </View>
        <View style={styles.supportInfo}>
          <Text style={styles.supportTitle}>Frequently Asked Questions</Text>
          <Text style={styles.supportSubtitle}>Find answers to common questions</Text>
        </View>
        <Feather name="chevron-right" size={20} color="#666" />
      </TouchableOpacity>

      <TouchableOpacity style={styles.supportOption} onPress={() => setShowHelp(true)}>
        <View style={styles.supportIconContainer}>
          <Feather name="headphones" size={24} color="#f97316" />
        </View>
        <View style={styles.supportInfo}>
          <Text style={styles.supportTitle}>Help & Support</Text>
          <Text style={styles.supportSubtitle}>Contact our support team</Text>
        </View>
        <Feather name="chevron-right" size={20} color="#666" />
      </TouchableOpacity>

      <TouchableOpacity style={styles.supportOption} onPress={() => setShowTerms(true)}>
        <View style={styles.supportIconContainer}>
          <Feather name="file-text" size={24} color="#f97316" />
        </View>
        <View style={styles.supportInfo}>
          <Text style={styles.supportTitle}>Terms & Conditions</Text>
          <Text style={styles.supportSubtitle}>Read our terms of service</Text>
        </View>
        <Feather name="chevron-right" size={20} color="#666" />
      </TouchableOpacity>

      <TouchableOpacity style={styles.supportOption} onPress={() => setShowPrivacy(true)}>
        <View style={styles.supportIconContainer}>
          <Feather name="lock" size={24} color="#f97316" />
        </View>
        <View style={styles.supportInfo}>
          <Text style={styles.supportTitle}>Privacy Policy</Text>
          <Text style={styles.supportSubtitle}>How we handle your data</Text>
        </View>
        <Feather name="chevron-right" size={20} color="#666" />
      </TouchableOpacity>
    </View>
  );

  const renderProfileTab = () => (
    <View style={styles.tabContent}>
      <View style={styles.avatarContainer}>
        <View style={styles.avatar}>
          {formData.avatar_url || profile.avatar_url ? (
            <Image 
              source={{ uri: formData.avatar_url || profile.avatar_url }} 
              style={styles.avatarImage}
            />
          ) : (
            <LinearGradient
              colors={['#f97316', '#f43f5e']}
              style={styles.avatarPlaceholder}
            >
              <Text style={styles.avatarText}>
                {profile.name?.charAt(0).toUpperCase()}
              </Text>
            </LinearGradient>
          )}
        </View>
        {isEditing && (
          <TouchableOpacity
            onPress={() => pickImage('avatar')}
            style={styles.avatarEditButton}
            disabled={isUploading}
          >
            <Feather name="camera" size={16} color="#fff" />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Full Name</Text>
        {isEditing ? (
          <TextInput
            style={styles.input}
            value={formData.name || ''}
            onChangeText={(text) => setFormData({ ...formData, name: text })}
            placeholder="Your name"
            placeholderTextColor="#666"
          />
        ) : (
          <Text style={styles.value}>{profile.name}</Text>
        )}
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Email</Text>
        <Text style={styles.value}>{profile.email}</Text>
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Phone Number</Text>
        {isEditing ? (
          <TextInput
            style={styles.input}
            value={formData.phone || ''}
            onChangeText={(text) => setFormData({ ...formData, phone: text })}
            placeholder="Phone number"
            placeholderTextColor="#666"
            keyboardType="phone-pad"
          />
        ) : (
          <Text style={styles.value}>{profile.phone || 'Not provided'}</Text>
        )}
      </View>

      <View style={styles.settingsCard}>
        <TouchableOpacity
          onPress={() => navigation.navigate('VendorAddresses')}
          style={styles.menuItem}
        >
          <View style={styles.menuItemLeft}>
            <Feather name="map-pin" size={20} color="#f97316" />
            <View>
              <Text style={styles.menuItemTitle}>Business Addresses</Text>
              <Text style={styles.menuItemSubtitle}>Manage your pickup and delivery locations</Text>
            </View>
          </View>
          <Feather name="chevron-right" size={20} color="#666" />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderBusinessTab = () => (
    <View style={styles.tabContent}>
      {/* Logo Upload */}
      <View style={styles.formGroup}>
        <Text style={styles.label}>Business Logo</Text>
        <View style={styles.logoContainer}>
          <View style={styles.logo}>
            {formData.businessLogo || profile.businessLogo ? (
              <Image 
                source={{ uri: formData.businessLogo || profile.businessLogo }} 
                style={styles.logoImage}
              />
            ) : (
              <View style={styles.logoPlaceholder}>
                <Feather name="image" size={24} color="#666" />
              </View>
            )}
          </View>
          {isEditing && (
            <TouchableOpacity
              onPress={() => pickImage('logo')}
              style={styles.uploadButton}
              disabled={isUploading}
            >
              <Text style={styles.uploadButtonText}>
                {isUploading ? 'Uploading...' : 'Upload Logo'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Cover Image */}
      <View style={styles.formGroup}>
        <Text style={styles.label}>Cover Image</Text>
        <View style={styles.coverContainer}>
          {formData.businessCover || profile.businessCover ? (
            <Image 
              source={{ uri: formData.businessCover || profile.businessCover }} 
              style={styles.coverImage}
            />
          ) : (
            <View style={styles.coverPlaceholder}>
              <Feather name="image" size={32} color="#666" />
            </View>
          )}
          {isEditing && (
            <TouchableOpacity
              onPress={() => pickImage('cover')}
              style={styles.coverEditButton}
              disabled={isUploading}
            >
              <Text style={styles.coverEditText}>
                {isUploading ? 'Uploading...' : 'Change Cover'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Business Details */}
      <View style={styles.formGroup}>
        <Text style={styles.label}>Business Name</Text>
        {isEditing ? (
          <TextInput
            style={styles.input}
            value={formData.businessName || ''}
            onChangeText={(text) => setFormData({ ...formData, businessName: text })}
            placeholder="Business name"
            placeholderTextColor="#666"
          />
        ) : (
          <Text style={styles.value}>{profile.businessName}</Text>
        )}
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Category</Text>
        {isEditing ? (
          <View style={styles.pickerContainer}>
            {businessCategories.map((cat) => (
              <TouchableOpacity
                key={cat.value}
                onPress={() => setFormData({ ...formData, businessCategory: cat.value })}
                style={[
                  styles.categoryChip,
                  formData.businessCategory === cat.value && styles.categoryChipSelected,
                ]}
              >
                <Text style={[
                  styles.categoryChipText,
                  formData.businessCategory === cat.value && styles.categoryChipTextSelected,
                ]}>
                  {cat.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <Text style={styles.value}>
            {businessCategories.find(c => c.value === profile.businessCategory)?.label || profile.businessCategory || 'Not set'}
          </Text>
        )}
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Business Address</Text>
        {isEditing ? (
          <TextInput
            style={styles.input}
            value={formData.businessAddress || ''}
            onChangeText={(text) => setFormData({ ...formData, businessAddress: text })}
            placeholder="Business address"
            placeholderTextColor="#666"
            multiline
          />
        ) : (
          <Text style={styles.value}>{profile.businessAddress}</Text>
        )}
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Description</Text>
        {isEditing ? (
          <TextInput
            style={[styles.input, styles.textArea]}
            value={formData.businessDescription || ''}
            onChangeText={(text) => setFormData({ ...formData, businessDescription: text })}
            placeholder="Describe your business..."
            placeholderTextColor="#666"
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        ) : (
          <Text style={styles.value}>{profile.businessDescription || 'No description'}</Text>
        )}
      </View>
    </View>
  );

  const renderBankTab = () => (
    <View style={styles.tabContent}>
      <View style={styles.formGroup}>
        <Text style={styles.label}>Bank Name</Text>
        {isEditing ? (
          <>
            <View style={styles.pickerContainer}>
              {banks.map((bank) => (
                <TouchableOpacity
                  key={bank.value}
                  onPress={() => {
                    setFormData({ ...formData, bankName: bank.value });
                    setBankVerified(false);
                  }}
                  style={[
                    styles.bankChip,
                    formData.bankName === bank.value && styles.bankChipSelected,
                  ]}
                >
                  <Text style={[
                    styles.bankChipText,
                    formData.bankName === bank.value && styles.bankChipTextSelected,
                  ]}>
                    {bank.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {verificationError ? (
              <Text style={styles.verificationError}>{verificationError}</Text>
            ) : null}
          </>
        ) : (
          <Text style={styles.value}>
            {banks.find(b => b.value === profile.bankName)?.label || profile.bankName || 'Not set'}
          </Text>
        )}
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Account Number</Text>
        {isEditing ? (
          <View style={styles.verificationRow}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              value={formData.accountNumber || ''}
              onChangeText={(text) => {
                setFormData({ ...formData, accountNumber: text });
                setBankVerified(false);
              }}
              placeholder="10-digit account number"
              placeholderTextColor="#666"
              keyboardType="numeric"
              maxLength={10}
            />
            <TouchableOpacity
              onPress={handleVerifyBank}
              disabled={!formData.accountNumber || !formData.bankName || isVerifyingBank || bankVerified}
              style={[
                styles.verifyButton,
                bankVerified && styles.verifyButtonSuccess
              ]}
            >
              {isVerifyingBank ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : bankVerified ? (
                <Feather name="check" size={20} color="#fff" />
              ) : (
                <Text style={styles.verifyButtonText}>Verify</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <Text style={styles.value}>
            {profile.accountNumber ? `****${profile.accountNumber.slice(-4)}` : 'Not set'}
          </Text>
        )}
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Account Name</Text>
        {isEditing ? (
          <TextInput
            style={[styles.input, bankVerified && styles.verifiedInput]}
            value={formData.accountName || ''}
            onChangeText={(text) => setFormData({ ...formData, accountName: text })}
            placeholder="Account name"
            placeholderTextColor="#666"
            editable={!bankVerified}
          />
        ) : (
          <Text style={styles.value}>{profile.accountName || 'Not set'}</Text>
        )}
      </View>

      {bankVerified && (
        <View style={styles.verificationSuccess}>
          <Feather name="check-circle" size={16} color="#10b981" />
          <Text style={styles.verificationSuccessText}>Account verified successfully</Text>
        </View>
      )}

      <View style={styles.paymentNote}>
        <Feather name="info" size={14} color="#f97316" />
        <Text style={styles.paymentNoteText}>
          Your bank details will be verified before they can be used for payouts
        </Text>
      </View>
    </View>
  );

  const renderPreferencesTab = () => (
    <View style={styles.tabContent}>
      <View style={styles.settingsCard}>
        <Text style={styles.settingsCardTitle}>Notifications</Text>
        
        {notificationItems.map((item) => (
          <View key={item.key} style={styles.notificationRow}>
            <Text style={styles.notificationLabel}>{item.label}</Text>
            {isEditing ? (
              <Switch
                value={formData.notifications?.[item.key] ?? true}
                onValueChange={(value) =>
                  setFormData({
                    ...formData,
                    notifications: { ...formData.notifications, [item.key]: value }
                  })
                }
                trackColor={{ false: '#2a2a2a', true: '#f97316' }}
                thumbColor="#fff"
              />
            ) : (
              <View style={[
                styles.notificationIndicator,
                profile.notifications?.[item.key] && styles.notificationActive
              ]}>
                <Feather 
                  name={profile.notifications?.[item.key] ? 'check' : 'x'} 
                  size={14} 
                  color={profile.notifications?.[item.key] ? '#10b981' : '#666'} 
                />
              </View>
            )}
          </View>
        ))}
      </View>

      <View style={styles.settingsCard}>
        <Text style={styles.settingsCardTitle}>Business Hours</Text>
        
        {days.map(({ key, label }) => (
          <View key={key} style={styles.hoursRow}>
            <Text style={styles.hoursLabel}>{label}</Text>
            {isEditing ? (
              <TextInput
                style={styles.hoursInput}
                value={formData.businessHours?.[key] || 'Closed'}
                onChangeText={(text) => 
                  setFormData({
                    ...formData,
                    businessHours: { ...formData.businessHours, [key]: text }
                  })
                }
                placeholder="9:00-21:00"
                placeholderTextColor="#666"
              />
            ) : (
              <Text style={styles.hoursValue}>
                {profile.businessHours?.[key] || 'Closed'}
              </Text>
            )}
          </View>
        ))}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Modals */}
      {showTerms && <TermsConditionsScreen onClose={() => setShowTerms(false)} />}
      {showPrivacy && <PrivacyPolicyScreen onClose={() => setShowPrivacy(false)} />}
      {showHelp && <HelpSupportScreen onClose={() => setShowHelp(false)} />}
      {showQA && <QAScreen onClose={() => setShowQA(false)} />}

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={styles.headerRight} />
      </View>

      {/* Mobile Menu Toggle */}
      <TouchableOpacity
        style={styles.mobileMenuToggle}
        onPress={() => setShowMobileMenu(!showMobileMenu)}
      >
        <Text style={styles.mobileMenuText}>
          {tabs.find(t => t.id === activeTab)?.label || 'Menu'}
        </Text>
        <Feather name={showMobileMenu ? 'chevron-up' : 'chevron-down'} size={20} color="#f97316" />
      </TouchableOpacity>

      {/* Mobile Menu */}
      {showMobileMenu && (
        <View style={styles.mobileMenu}>
          {tabs.map((tab) => (
            <TouchableOpacity
              key={tab.id}
              onPress={() => {
                setActiveTab(tab.id as SettingsTab);
                setShowMobileMenu(false);
              }}
              style={[
                styles.mobileMenuItem,
                activeTab === tab.id && styles.mobileMenuItemActive,
              ]}
            >
              <Feather 
                name={tab.icon as any} 
                size={18} 
                color={activeTab === tab.id ? '#fff' : '#666'} 
              />
              <Text style={[
                styles.mobileMenuItemText,
                activeTab === tab.id && styles.mobileMenuItemTextActive,
              ]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Desktop Tabs (hidden on mobile) */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.desktopTabs}
        contentContainerStyle={styles.desktopTabsContent}
      >
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.id}
            onPress={() => setActiveTab(tab.id as SettingsTab)}
            style={[
              styles.desktopTab,
              activeTab === tab.id && styles.desktopTabActive,
            ]}
          >
            <Feather 
              name={tab.icon as any} 
              size={16} 
              color={activeTab === tab.id ? '#fff' : '#666'} 
            />
            <Text style={[
              styles.desktopTabText,
              activeTab === tab.id && styles.desktopTabTextActive,
            ]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>


{/* Action Buttons - Only show for editable tabs */}
{activeTab !== 'support' && activeTab !== 'promos' && (
  <View style={styles.actionButtons}>
    {isEditing ? (
      <>
        <TouchableOpacity
          onPress={handleCancel}
          style={[styles.actionButton, styles.cancelButton]}
        >
          <Feather name="x" size={18} color="#ef4444" />
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handleSave}
          style={[styles.actionButton, styles.saveButton]}
        >
          <LinearGradient
            colors={['#f97316', '#f43f5e']}
            style={styles.saveButtonGradient}
          >
            <Feather name="save" size={18} color="#fff" />
            <Text style={styles.saveButtonText}>Save Changes</Text>
          </LinearGradient>
        </TouchableOpacity>
      </>
    ) : (
      <TouchableOpacity
        onPress={handleEdit}
        style={[styles.actionButton, styles.editButton]}
      >
        <Feather name="edit-2" size={18} color="#f97316" />
        <Text style={styles.editButtonText}>Edit Profile</Text>
      </TouchableOpacity>
    )}
  </View>
)}
     

      {/* Content */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.contentCard}>
          {activeTab === 'profile' && renderProfileTab()}
          {activeTab === 'business' && renderBusinessTab()}
          {activeTab === 'bank' && renderBankTab()}
          {activeTab === 'preferences' && renderPreferencesTab()}
          {activeTab === 'promos' && <PromoCodeManager />}
          {activeTab === 'support' && renderSupportTab()}
        </View>

        {/* Logout Button */}
        <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
          <Feather name="log-out" size={20} color="#ef4444" />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

// ✅ Add new styles for payment features
const styles = StyleSheet.create({
  // ... (keep all your existing styles)
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    paddingTop: 40,
    paddingBottom: 80,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 16,
    marginTop: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  headerRight: {
    width: 40,
  },
  mobileMenuToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1a1a1a',
    margin: 16,
    marginBottom: 8,
    padding: 16,
    borderRadius: 12,
  },
  mobileMenuText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#fff',
  },
  mobileMenu: {
    backgroundColor: '#1a1a1a',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    padding: 8,
  },
  mobileMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    gap: 12,
  },
  mobileMenuItemActive: {
    backgroundColor: '#f97316',
  },
  mobileMenuItemText: {
    fontSize: 14,
    color: '#666',
  },
  mobileMenuItemTextActive: {
    color: '#fff',
  },
  desktopTabs: {
    maxHeight: 60,
    display: 'none', // Hide on mobile, show on web
  },
  desktopTabsContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  desktopTab: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 8,
  },
  desktopTabActive: {
    backgroundColor: '#f97316',
  },
  desktopTabText: {
    fontSize: 13,
    color: '#666',
  },
  desktopTabTextActive: {
    color: '#fff',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 16,
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 8,
  },
  editButton: {
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  editButtonText: {
    color: '#f97316',
    fontSize: 14,
    fontWeight: '500',
  },
  cancelButton: {
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  cancelButtonText: {
    color: '#ef4444',
    fontSize: 14,
    fontWeight: '500',
  },
  saveButton: {
    overflow: 'hidden',
  },
  saveButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  contentCard: {
    backgroundColor: '#1a1a1a',
    margin: 16,
    marginTop: 0,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  tabContent: {
    gap: 20,
  },
  avatarContainer: {
    alignItems: 'center',
    position: 'relative',
    marginBottom: 20,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#fff',
  },
  avatarEditButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f97316',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#1a1a1a',
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    color: '#666',
    marginBottom: 6,
  },
  value: {
    fontSize: 15,
    color: '#fff',
  },
  input: {
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    padding: 12,
    color: '#fff',
    fontSize: 14,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  logo: {
    width: 80,
    height: 80,
    borderRadius: 8,
    overflow: 'hidden',
  },
  logoImage: {
    width: '100%',
    height: '100%',
  },
  logoPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#2a2a2a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#2a2a2a',
    padding: 16,
    borderRadius: 8,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  menuItemTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: '#fff',
    marginBottom: 2,
  },
  menuItemSubtitle: {
    fontSize: 11,
    color: '#666',
  },
  uploadButton: {
    flex: 1,
    backgroundColor: '#2a2a2a',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  uploadButtonText: {
    color: '#f97316',
    fontSize: 13,
    fontWeight: '500',
  },
  coverContainer: {
    height: 120,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  coverPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#2a2a2a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  coverEditButton: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  coverEditText: {
    color: '#fff',
    fontSize: 12,
  },
  pickerContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#2a2a2a',
    borderRadius: 20,
  },
  categoryChipSelected: {
    backgroundColor: '#f97316',
  },
  categoryChipText: {
    fontSize: 12,
    color: '#666',
  },
  categoryChipTextSelected: {
    color: '#fff',
  },
  bankChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#2a2a2a',
    borderRadius: 20,
  },
  bankChipSelected: {
    backgroundColor: '#f97316',
  },
  bankChipText: {
    fontSize: 12,
    color: '#666',
  },
  bankChipTextSelected: {
    color: '#fff',
  },
  settingsCard: {
    backgroundColor: '#2a2a2a',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  settingsCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 16,
  },
  hoursRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  hoursLabel: {
    fontSize: 13,
    color: '#666',
  },
  hoursValue: {
    fontSize: 13,
    color: '#fff',
  },
  hoursInput: {
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    color: '#fff',
    fontSize: 13,
    width: 120,
    textAlign: 'right',
  },
  notificationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  notificationLabel: {
    fontSize: 13,
    color: '#666',
  },
  notificationIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationActive: {
    backgroundColor: 'rgba(16,185,129,0.1)',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(239,68,68,0.1)',
    margin: 16,
    marginTop: 0,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.2)',
  },
  logoutText: {
    color: '#ef4444',
    fontSize: 15,
    fontWeight: '600',
  },
  // Support tab styles
  supportOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
    padding: 16,
    borderRadius: 8,
    marginTop: 30,
  },
  supportIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(249,115,22,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  supportInfo: {
    flex: 1,
  },
  supportTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: '#fff',
    marginBottom: 2,
  },
  supportSubtitle: {
    fontSize: 12,
    color: '#666',
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    paddingTop: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  modalCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  modalSectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#f97316',
    marginTop: 20,
    marginBottom: 10,
  },
  modalText: {
    fontSize: 14,
    color: '#ccc',
    lineHeight: 22,
    marginBottom: 15,
  },
  modalLastUpdated: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
    marginTop: 30,
    marginBottom: 20,
    textAlign: 'center',
  },
  // Contact options
  contactOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  contactIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(249,115,22,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  contactInfo: {
    flex: 1,
  },
  contactLabel: {
    fontSize: 14,
    color: '#999',
    marginBottom: 2,
  },
  contactValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 2,
  },
  contactNote: {
    fontSize: 12,
    color: '#666',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginVertical: 20,
  },
  faqItem: {
    marginBottom: 16,
  },
  faqQuestion: {
    fontSize: 15,
    fontWeight: '600',
    color: '#f97316',
    marginBottom: 4,
  },
  faqAnswer: {
    fontSize: 14,
    color: '#ccc',
    lineHeight: 20,
  },
  // FAQ accordion styles
  faqContainer: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    overflow: 'hidden',
  },
  faqHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  faqHeaderQuestion: {
    fontSize: 15,
    fontWeight: '500',
    color: '#fff',
    flex: 1,
    marginRight: 10,
  },
  faqBody: {
    padding: 16,
    paddingTop: 0,
    backgroundColor: '#0a0a0a',
  },
  faqBodyAnswer: {
    fontSize: 14,
    color: '#ccc',
    lineHeight: 20,
  },
  // ✅ New payment styles
  verificationRow: {
    flexDirection: 'row',
    gap: 8,
  },
  verifyButton: {
    width: 80,
    height: 48,
    backgroundColor: '#f97316',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  verifyButtonSuccess: {
    backgroundColor: '#10b981',
  },
  verifyButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  verificationError: {
    color: '#ef4444',
    fontSize: 12,
    marginTop: 4,
  },
  verificationSuccess: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  verificationSuccessText: {
    color: '#10b981',
    fontSize: 12,
  },
  verifiedInput: {
    backgroundColor: '#1a2a1a',
    borderColor: '#10b981',
  },
  paymentNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(249,115,22,0.1)',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  paymentNoteText: {
    fontSize: 12,
    color: '#f97316',
    flex: 1,
  },
  paymentStatusCard: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  paymentStatusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  paymentStatusInfo: {
    flex: 1,
  },
  paymentStatusTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 2,
  },
  paymentStatusSubtitle: {
    fontSize: 12,
    color: '#666',
  },
  subaccountInfo: {
    backgroundColor: '#1a1a1a',
    padding: 12,
    borderRadius: 8,
  },
  subaccountLabel: {
    fontSize: 11,
    color: '#666',
    marginBottom: 2,
  },
  subaccountValue: {
    fontSize: 12,
    color: '#fff',
    fontFamily: 'monospace',
  },
  paymentDetailsCard: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  paymentDetailsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#f97316',
    marginBottom: 12,
  },
  paymentDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  paymentDetailLabel: {
    fontSize: 12,
    color: '#666',
  },
  paymentDetailValue: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '500',
  },
  paymentDetailValueHighlight: {
    fontSize: 12,
    color: '#f97316',
    fontWeight: '600',
  },
  paymentInfoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#2a2a2a',
    padding: 12,
    borderRadius: 8,
  },
  paymentInfoText: {
    fontSize: 11,
    color: '#666',
    flex: 1,
  },
  retryButton: {
    height: 48,
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 16,
  },
  retryButtonGradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});