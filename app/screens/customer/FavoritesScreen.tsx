// app/screens/customer/FavoritesScreen.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../../contexts/AuthContext';
import { useFavorites } from '../../hooks/customer/useFavorites';
import { useVendors } from '../../hooks/customer/useVendors';
import { VendorCard } from '../../components/customer/VendorCard';
import { RootStackParamList } from '../../navigation/types';

type FavoritesScreenNavigationProp = NativeStackNavigationProp<RootStackParamList>;

export function FavoritesScreen() {
  const navigation = useNavigation<FavoritesScreenNavigationProp>();
  const { user } = useAuth();
  const { favoriteIds, isLoading: favLoading, refreshFavorites } = useFavorites();
  const { vendors, isLoading: vendorsLoading, refresh: refreshVendors } = useVendors();
  const [favoriteVendors, setFavoriteVendors] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (vendors.length > 0 && favoriteIds.length > 0) {
      const filtered = vendors.filter(v => favoriteIds.includes(v.id));
      setFavoriteVendors(filtered);
    } else {
      setFavoriteVendors([]);
    }
  }, [vendors, favoriteIds]);

  const isLoading = favLoading || vendorsLoading;

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refreshFavorites(), refreshVendors()]);
    setRefreshing(false);
  };

  const handleVendorPress = (vendorId: string) => {
    navigation.navigate('VendorDetails', { vendorId });
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Favorites</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#f97316" />
        }
      >
        {isLoading && !refreshing ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#f97316" />
          </View>
        ) : !user ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconContainer}>
              <Feather name="heart" size={40} color="#666" />
            </View>
            <Text style={styles.emptyTitle}>Login to view favorites</Text>
            <Text style={styles.emptyText}>
              Sign in to see your saved vendors
            </Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('Login')}
              style={styles.signInButton}
            >
              <LinearGradient
                colors={['#f97316', '#f43f5e']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.signInGradient}
              >
                <Text style={styles.signInText}>Sign In</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        ) : favoriteVendors.length > 0 ? (
          <View style={styles.vendorsGrid}>
            {favoriteVendors.map(vendor => (
              <VendorCard
                key={vendor.id}
                vendor={vendor}
                onPress={() => handleVendorPress(vendor.id)}
              />
            ))}
          </View>
        ) : (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconContainer}>
              <Feather name="heart" size={40} color="#666" />
            </View>
            <Text style={styles.emptyTitle}>No favorites yet</Text>
            <Text style={styles.emptyText}>
              Save your favorite vendors for quick access
            </Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('Vendors')}
              style={styles.browseButton}
            >
              <Text style={styles.browseButtonText}>Browse Vendors</Text>
            </TouchableOpacity>
          </View>
        )}
        <View style={styles.bottomPadding} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
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
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  vendorsGrid: {
    padding: 16,
    gap: 16,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  signInButton: {
    width: '100%',
    height: 48,
    borderRadius: 12,
    overflow: 'hidden',
  },
  signInGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  signInText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  browseButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
  },
  browseButtonText: {
    color: '#f97316',
    fontSize: 14,
    fontWeight: '500',
  },
  bottomPadding: {
    height: 20,
  },
});