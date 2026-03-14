// app/screens/NotificationsScreen.tsx
import React, { useState } from 'react';
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
import { useNotifications } from '../hooks/useNotifications';
import { useAuth } from '../contexts/AuthContext';
import { RootStackParamList } from '../navigation/types';
import { formatDistanceToNow } from 'date-fns';

type NotificationsScreenNavigationProp = NativeStackNavigationProp<RootStackParamList>;

// Define proper icon names that exist in Feather
const notificationIcons = {
  order: 'package' as const,
  payout: 'dollar-sign' as const,
  system: 'info' as const,
  alert: 'alert-circle' as const
};

const notificationColors = {
  order: '#f97316',
  payout: '#10b981',
  system: '#6b7280',
  alert: '#ef4444'
};

const notificationBgColors = {
  order: 'rgba(59,130,246,0.1)',
  payout: 'rgba(16,185,129,0.1)',
  system: 'rgba(107,114,128,0.1)',
  alert: 'rgba(239,68,68,0.1)'
};

export function NotificationsScreen() {
  const navigation = useNavigation<NotificationsScreenNavigationProp>();
  const { user } = useAuth();
  const { 
    notifications, 
    unreadCount, 
    isLoading, 
    refresh,
    markAsRead, 
    markAllAsRead, 
    deleteNotification 
  } = useNotifications();
  
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [refreshing, setRefreshing] = useState(false);

  const filteredNotifications = filter === 'all' 
    ? notifications 
    : notifications.filter(n => !n.read);

  const handleNotificationClick = async (notification: any) => {
    if (!notification.read) {
      await markAsRead(notification.id);
    }
    
    if (notification.action_link) {
      // Navigate based on the action link
      if (notification.action_link.startsWith('/order/')) {
        const orderId = notification.action_link.split('/').pop();
        navigation.navigate('OrderTracking', { orderId });
      } else if (notification.action_link === '/orders') {
        navigation.navigate('Orders');
      } else if (notification.action_link === '/vendor/orders') {
        // For vendor, you'd navigate to vendor orders
        // navigation.navigate('VendorOrders');
      }
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  const handleMarkAllAsRead = () => {
    markAllAsRead();
  };

  if (isLoading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#f97316" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Feather name="arrow-left" size={24} color="#fff" />
          </TouchableOpacity>
          <View>
            <Text style={styles.headerTitle}>Notifications</Text>
            <Text style={styles.headerSubtitle}>
              {unreadCount} unread {unreadCount === 1 ? 'notification' : 'notifications'}
            </Text>
          </View>
        </View>
        
        {unreadCount > 0 && (
          <TouchableOpacity onPress={handleMarkAllAsRead} style={styles.markAllButton}>
            <Feather name="check-circle" size={18} color="#f97316" />
            <Text style={styles.markAllText}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Filter Tabs */}
      <View style={styles.tabContainer}>
        <View style={styles.tabBar}>
          <TouchableOpacity
            onPress={() => setFilter('all')}
            style={[
              styles.tab,
              filter === 'all' && styles.activeTab,
            ]}
          >
            <Text style={[
              styles.tabText,
              filter === 'all' && styles.activeTabText,
            ]}>
              All
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setFilter('unread')}
            style={[
              styles.tab,
              filter === 'unread' && styles.activeTab,
            ]}
          >
            <Text style={[
              styles.tabText,
              filter === 'unread' && styles.activeTabText,
            ]}>
              Unread
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Notifications List */}
      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#f97316" />
        }
      >
        {filteredNotifications.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconContainer}>
              <Feather name="bell" size={40} color="#666" />
            </View>
            <Text style={styles.emptyTitle}>All caught up!</Text>
            <Text style={styles.emptyText}>
              No {filter === 'unread' ? 'unread ' : ''}notifications
            </Text>
          </View>
        ) : (
          <View style={styles.notificationsList}>
            {filteredNotifications.map((notification) => {
              const IconName = notificationIcons[notification.type as keyof typeof notificationIcons] || 'bell';
              const timeAgo = formatDistanceToNow(new Date(notification.created_at), { addSuffix: true });
              
              return (
                <TouchableOpacity
                  key={notification.id}
                  onPress={() => handleNotificationClick(notification)}
                  style={[
                    styles.notificationCard,
                    !notification.read && styles.notificationCardUnread,
                  ]}
                >
                  <View style={styles.notificationContent}>
                    {/* Icon */}
                    <View style={[
                      styles.notificationIcon,
                      { backgroundColor: notificationBgColors[notification.type as keyof typeof notificationBgColors] || 'rgba(107,114,128,0.1)' }
                    ]}>
                      <Feather 
                        name={IconName} 
                        size={20} 
                        color={notificationColors[notification.type as keyof typeof notificationColors] || '#6b7280'} 
                      />
                    </View>

                    {/* Content */}
                    <View style={styles.notificationInfo}>
                      <View style={styles.notificationHeader}>
                        <Text style={styles.notificationTitle} numberOfLines={1}>
                          {notification.title}
                        </Text>
                        <Text style={styles.notificationTime}>{timeAgo}</Text>
                      </View>
                      
                      <Text style={styles.notificationMessage} numberOfLines={2}>
                        {notification.message}
                      </Text>

                      {/* Action Button */}
                      {notification.action_label && (
                        <View style={styles.notificationAction}>
                          <Text style={styles.notificationActionText}>
                            {notification.action_label}
                          </Text>
                          <Feather name="chevron-right" size={14} color="#f97316" />
                        </View>
                      )}
                    </View>

                    {/* Unread Dot */}
                    {!notification.read && (
                      <View style={styles.unreadDot} />
                    )}

                    {/* Delete Button */}
                    <TouchableOpacity
                      onPress={() => deleteNotification(notification.id)}
                      style={styles.deleteButton}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Feather name="x" size={16} color="#666" />
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              );
            })}
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
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    justifyContent: 'center',
    alignItems: 'center',
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
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
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
  headerSubtitle: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  markAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: 'rgba(59,130,246,0.1)',
    borderRadius: 16,
  },
  markAllText: {
    fontSize: 12,
    color: '#f97316',
  },
  tabContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
  },
  activeTab: {
    backgroundColor: '#f97316',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#666',
  },
  activeTabText: {
    color: '#fff',
  },
  content: {
    flex: 1,
  },
  notificationsList: {
    padding: 16,
    gap: 12,
  },
  notificationCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  notificationCardUnread: {
    borderColor: '#f97316',
    backgroundColor: 'rgba(59,130,246,0.05)',
  },
  notificationContent: {
    flexDirection: 'row',
    gap: 12,
    position: 'relative',
  },
  notificationIcon: {
    width: 44,
    height: 44,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationInfo: {
    flex: 1,
  },
  notificationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
    paddingRight: 20,
  },
  notificationTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    flex: 1,
  },
  notificationTime: {
    fontSize: 11,
    color: '#666',
  },
  notificationMessage: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
  },
  notificationAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
  },
  notificationActionText: {
    fontSize: 12,
    color: '#f97316',
    fontWeight: '500',
  },
  unreadDot: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#f97316',
  },
  deleteButton: {
    position: 'absolute',
    top: 0,
    right: 0,
    padding: 4,
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
  },
  bottomPadding: {
    height: 20,
  },
});