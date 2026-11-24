// screens/RoleSelectionScreen.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { clearRiderApplicationPending, markRiderApplicationPending } from '../utils/riderIntent';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import { RootStackParamList } from '../navigation/types';
import { fill } from '../theme/colors';
import { TC } from '../theme/palette';


type RoleSelectionScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'RoleSelection'
>;

type UserRole = 'customer' | 'vendor' | 'rider';

interface RoleOption {
  id: UserRole;
  title: string;
  description: string;
  icon: keyof typeof Feather.glyphMap;
  benefits: string[];
  colors: [string, string];
}

const roles: RoleOption[] = [
  {
    id: 'customer',
    title: 'Customer',
    description: 'Order food and groceries from your favorite vendors',
    icon: 'shopping-bag',
    benefits: [
      'Browse local vendors near you',
      'Fast delivery to your doorstep',
      'Offers from shops you like',
      'Track orders in real-time',
    ],
    colors: ['#f97316', '#f43f5e'],
  },
  {
    id: 'vendor',
    title: 'Vendor / Restaurant',
    description: 'Register your business and start receiving orders',
    icon: 'home',
    benefits: [
      'Reach thousands of customers',
      'Manage orders easily',
      'Track sales & earnings',
      'Grow your business',
    ],
    colors: ['#f97316', '#f43f5e'],
  },
  {
    id: 'rider',
    title: 'Rider',
    description: 'Deliver food and earn on your own schedule',
    icon: 'truck',
    benefits: [
      'Ride whenever you want',
      'Get paid for every delivery',
      'Withdraw to your bank anytime',
      'Apply in about 10 minutes',
    ],
    colors: ['#f97316', '#f43f5e'],
  },
];

export function RoleSelectionScreen() {
  const navigation = useNavigation<RoleSelectionScreenNavigationProp>();
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);


  const handleContinue = () => {
    if (selectedRole) {
      if (selectedRole === 'customer') {
        clearRiderApplicationPending();
        navigation.navigate('CustomerSignup');
      } else if (selectedRole === 'vendor') {
        navigation.navigate('VendorSignup');
      } else if (selectedRole === 'rider') {
        // Riders create a normal account first; the application opens right after signup.
        markRiderApplicationPending();
        navigation.navigate('CustomerSignup');
      }
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header with Back Button */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <Feather name="arrow-left" size={24} color={TC.text} />
          </TouchableOpacity>
          
          <View style={styles.logoContainer}>
           
              <Image
                source={require('../assets/logo.png')}
                style={{ width: 54, height: 50 }}
                resizeMode="contain"
              />
            
            <View>
              <Text style={styles.logoText}>veshpe</Text>
              <Text style={styles.logoSubtext}>Your food delivery platform</Text>
            </View>
          </View>
        </View>


<View 
            style={{alignItems:'center',justifyContent:'center',marginBottom:20}}
          > 
            <Image
              source={require('../assets/vendorp.png')}
              style={{ width: 400, height: 300 }}
              resizeMode="contain"
            />
          </View>



        {/* Title */}
        <View style={styles.titleContainer}>
          <Text style={styles.title}>How would you like to join?</Text>
          <Text style={styles.subtitle}>
            Select your role to get started with Vesphe
          </Text>
        </View>

        {/* Role Cards */}
        <View style={styles.rolesContainer}>
          {roles.map((role) => {
            const isSelected = selectedRole === role.id;

            return (
              <TouchableOpacity
                key={role.id}
                onPress={() => setSelectedRole(role.id)}
                activeOpacity={0.7}
                style={[
                  styles.roleCard,
                  isSelected && styles.roleCardSelected,
                ]}
              >
                <View style={styles.roleContent}>
                  <View style={[styles.roleIcon, { backgroundColor: fill(role.colors) }]}>
                    <Feather name={role.icon} size={28} color="#fff" />
                  </View>
                  
                  <View style={styles.roleInfo}>
                    <View style={styles.roleHeader}>
                      <Text style={styles.roleTitle}>{role.title}</Text>
                      {isSelected && (
                        <Feather name="check-circle" size={20} color="#f97316" />
                      )}
                    </View>
                    
                    <Text style={styles.roleDescription}>
                      {role.description}
                    </Text>
                    
                    <View style={styles.benefitsContainer}>
                      {role.benefits.slice(0, 2).map((benefit, idx) => (
                        <View key={idx} style={styles.benefitBadge}>
                          <Text style={styles.benefitText}>{benefit}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <TouchableOpacity
            onPress={handleContinue}
            disabled={!selectedRole}
            activeOpacity={0.8}
          >
            <View style={[styles.continueGradient, { backgroundColor: selectedRole ? '#ea580c' : '#ea580c' }]}>
              <Text style={styles.continueText}>
                Continue as {selectedRole ? roles.find(r => r.id === selectedRole)?.title : '...'}
              </Text>
              <Feather name="arrow-right" size={20} color={TC.text} />
            </View>
          </TouchableOpacity>

          <View style={styles.loginContainer}>
            <Text style={styles.loginText}>Already have an account? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Login')}>
              <Text style={styles.loginLink}>Sign in</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: TC.bg,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  header: {
    padding: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: TC.surface,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    marginBottom: 16,
  },
  logoContainer: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
  },
  logoGradient: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  logoText: {
    fontSize: 20,
    fontWeight: '600',
    color: TC.text,
  },
  logoSubtext: {
    fontSize: 12,
    color: TC.subtle,
  },
  titleContainer: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '600',
    color: TC.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: TC.subtle,
  },
  rolesContainer: {
    paddingHorizontal: 20,
    gap: 16,
  },
  roleCard: {
    backgroundColor: TC.surface,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: TC.hairline,
    overflow: 'hidden' as const,
  },
  roleCardSelected: {
    borderColor: '#f97316',
    backgroundColor: 'rgba(59,130,246,0.1)',
  },
  roleContent: {
    padding: 16,
    flexDirection: 'row' as const,
    gap: 16,
  },
  roleIcon: {
    width: 56,
    height: 56,
    borderRadius: 14,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  roleInfo: {
    flex: 1,
  },
  roleHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    marginBottom: 4,
  },
  roleTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: TC.text,
  },
  roleDescription: {
    fontSize: 14,
    color: TC.subtle,
    marginBottom: 12,
  },
  benefitsContainer: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: 8,
  },
  benefitBadge: {
    backgroundColor: TC.raised,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  benefitText: {
    fontSize: 11,
    color: TC.subtle,
  },
  footer: {
    padding: 20,
    paddingTop: 32,
  },
  continueGradient: {
    height: 56,
    borderRadius: 14,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
  },
  continueText: {
    color: TC.text,
    fontSize: 16,
    fontWeight: '600',
  },
  loginContainer: {
    flexDirection: 'row' as const,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    marginTop: 16,
  },
  loginText: {
    color: TC.subtle,
    fontSize: 14,
  },
  loginLink: {
    color: '#f97316',
    fontSize: 14,
    fontWeight: '600',
  },
});