// app/components/customer/CustomerHeader.tsx
import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Platform,
  Image,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../contexts/AuthContext';
import { useCart } from '../../contexts/CartContext';
import { BlurView } from 'expo-blur';
import { SafeAreaView } from 'react-native-safe-area-context';

interface CustomerHeaderProps {
  showSearch?: boolean;
  onSearchPress?: () => void;
  transparent?: boolean;
  title?: string;
  showBack?: boolean;
}

export function CustomerHeader({ 
  showSearch = true, 
  onSearchPress, 
  transparent = false,
  title,
  showBack = false,
}: CustomerHeaderProps) {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { getItemCount } = useCart();

  const cartItemCount = getItemCount?.() || 0;

  const getUserInitials = () => {
    if (!user?.name) return 'U';
    return user.name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const HeaderContent = () => (
    <View style={[styles.container, transparent ? styles.transparent : styles.solid]}>
      {/* Left Section - Location or Back */}
      <View style={styles.leftSection}>
        {showBack ? (
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.iconButton}
          >
            <Feather name="arrow-left" size={20} color="#fff" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={() => navigation.navigate('Locations' as never)}
            style={styles.locationButton}
          >
            <View style={styles.locationIcon}>
<Image
              source={require('../../assets/logo.png')}
              style={{ width: 53, height: 40 }}
            />
            

</View>
            <View style={styles.locationTextContainer}>
              <Text style={styles.locationLabel}>Deliver to</Text>
              <View style={styles.locationRow}>
                <Text style={styles.locationAddress} numberOfLines={1}>
                  Home
                </Text>
                <Feather name="chevron-down" size={14} color="#666" />
              </View>
            </View>
          </TouchableOpacity>
        )}
      </View>

    

      {/* Right Section - Actions */}
      <View style={styles.rightSection}>
        {/* Cart */}
        <TouchableOpacity
          onPress={() => navigation.navigate('Cart' as never)}
          style={styles.iconButton}
        >
          <Feather name="shopping-bag" size={20} color="#fff" />
          {cartItemCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {cartItemCount > 9 ? '9+' : cartItemCount}
              </Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Notifications */}
        <TouchableOpacity
          onPress={() => navigation.navigate('Notifications' as never)}
          style={styles.iconButton}
        >
          <Feather name="bell" size={20} color="#fff" />
          <View style={styles.notificationDot} />
        </TouchableOpacity>

        {/* Profile */}
        <TouchableOpacity
          onPress={() => navigation.navigate('Profile' as never)}
          style={styles.profileButton}
        >
          {user?.avatar_url ? (
            <Image
              source={{ uri: user.avatar_url }}
              style={styles.profileImage}
            />
          ) : (
            <LinearGradient
              colors={['#f97316', '#10b981']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.profileInitials}
            >
              <Text style={styles.initialsText}>{getUserInitials()}</Text>
            </LinearGradient>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );

  if (transparent) {
    return <HeaderContent />;
  }

  return (
    <SafeAreaView edges={['top']} style={{ backgroundColor: 'transparent' }}>
    <BlurView intensity={80} tint="dark" style={styles.blurContainer}>
      <HeaderContent />
    </BlurView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  blurContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
    height: Platform.OS === 'ios' ? 90 : 70,
  },
  transparent: {
    backgroundColor: 'transparent',
  },
  solid: {
    backgroundColor: '#0a0a0a',
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  locationIcon: {
    width: 72,
    height: 42,
    borderRadius: 16,
    backgroundColor: 'rgba(59,130,246,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  locationTextContainer: {
    marginLeft: 4,
  },
  locationLabel: {
    fontSize: 10,
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  locationAddress: {
    fontSize: 14,
    fontWeight: '500',
    color: '#fff',
    maxWidth: 120,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
    flex: 2,
  },
  searchButton: {
    flex: 2,
    height: 40,
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    marginTop: '20%',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchPlaceholder: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    justifyContent: 'flex-end',
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#f97316',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  notificationDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#f97316',
  },
  profileButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(59,130,246,0.3)',
  },
  profileImage: {
    width: '100%',
    height: '100%',
  },
  profileInitials: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  initialsText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});