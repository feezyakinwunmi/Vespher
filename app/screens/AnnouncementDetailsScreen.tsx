// app/screens/common/AnnouncementDetailsScreen.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { LinearGradient } from 'expo-linear-gradient';

export function AnnouncementDetailsScreen({ navigation, route }: any) {
  const { announcementId } = route.params || {};
  const [announcement, setAnnouncement] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    if (announcementId) {
      fetchAnnouncement();
    }
  }, [announcementId]);

  const fetchAnnouncement = async () => {
    try {
      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .eq('id', announcementId)
        .single();

      if (error) throw error;
      setAnnouncement(data);
    } catch (error) {
      console.error('Error fetching announcement:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#f97316" />
      </View>
    );
  }

  if (!announcement) {
    return (
      <View style={styles.errorContainer}>
        <Feather name="alert-circle" size={48} color="#ef4444" />
        <Text style={styles.errorText}>Announcement not found</Text>
      </View>
    );
  }

  // Get user role to determine navigation
  const getUserRole = () => {
    // You can get this from your auth context
    // For now, we'll check based on current screen
    return 'customer'; // Replace with actual role from auth
  };

  const handleActionPress = () => {
    const userRole = getUserRole();
    const link = announcement.action_link;
    
    if (!link) return;
    
    // Customer navigation
    if (link === '/home') navigation.navigate('Home');
    else if (link === '/orders') navigation.navigate('Orders');
    else if (link === '/promotions') navigation.navigate('Promotions');
    else if (link === '/vendor/menu') navigation.navigate('VendorMenu');
    else if (link === '/vendor/orders') navigation.navigate('VendorOrders');
    else if (link === '/deliveries') navigation.navigate('AvailableDeliveries');
    else if (link === '/earnings') navigation.navigate('Earnings');
    else if (link === '/requests') navigation.navigate('Requests');
    else if (link.startsWith('/order/')) {
      const orderId = link.split('/').pop();
      navigation.navigate('OrderTracking', { orderId });
    }
    else {
      // Default fallback
      navigation.goBack();
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Announcement</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Image with error handling */}
        {announcement.image_url && (
          <View style={styles.imageContainer}>
            <Image 
              source={{ uri: announcement.image_url }} 
              style={styles.image}
              onError={() => setImageError(true)}
              resizeMode="cover"
            />
            {imageError && (
              <View style={styles.imageFallback}>
                <Feather name="image" size={32} color="#666" />
                <Text style={styles.imageFallbackText}>Image not available</Text>
              </View>
            )}
          </View>
        )}
        
        <Text style={styles.title}>{announcement.title}</Text>
        
        <Text style={styles.message}>{announcement.message}</Text>
        
        {/* Action Button */}
        {announcement.action_link && announcement.action_link !== '/home' && (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleActionPress}
          >
            <LinearGradient
              colors={['#f97316', '#f43f5e']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.actionButtonGradient}
            >
              <Text style={styles.actionButtonText}>
                {announcement.action_label || 'View Details'}
              </Text>
              <Feather name="arrow-right" size={16} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
        )}
        
        {/* Footer info */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Posted on {new Date(announcement.created_at).toLocaleDateString()}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0a0a0a',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0a0a0a',
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
  content: {
    flex: 1,
    padding: 16,
  },
  imageContainer: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    marginBottom: 20,
    overflow: 'hidden',
    backgroundColor: '#1a1a1a',
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imageFallback: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
  },
  imageFallbackText: {
    color: '#666',
    marginTop: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 12,
  },
  message: {
    fontSize: 16,
    color: '#ccc',
    lineHeight: 24,
    marginBottom: 20,
  },
  actionButton: {
    borderRadius: 8,
    overflow: 'hidden',
    marginTop: 10,
    marginBottom: 20,
  },
  actionButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  footer: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 40,
  },
  footerText: {
    fontSize: 11,
    color: '#666',
  },
});