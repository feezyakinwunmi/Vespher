// app/hooks/usePushNotifications.ts
import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Platform } from 'react-native';

// ✅ Fix: Add all required properties for NotificationBehavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,     // iOS only
    shouldShowList: true,  
  }),
});

export function usePushNotifications() {
  const { user } = useAuth();

  useEffect(() => {
    const setupPushNotifications = async () => {
      if (!user?.id) return;
      
      try {
        // Request permission
        const { status } = await Notifications.requestPermissionsAsync();
        if (status !== 'granted') {
          console.log('Push notification permission denied');
          return;
        }
        
        // Get token
        const tokenData = await Notifications.getExpoPushTokenAsync();
        const token = tokenData.data;
        console.log('📱 Push token:', token);
        
        // Set up notification channels for Android
        if (Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync('default', {
            name: 'Default',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#f97316',
          });
          
          await Notifications.setNotificationChannelAsync('orders', {
            name: 'Orders',
            importance: Notifications.AndroidImportance.HIGH,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#f97316',
          });
          
          await Notifications.setNotificationChannelAsync('payments', {
            name: 'Payments',
            importance: Notifications.AndroidImportance.HIGH,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#10b981',
          });
          
          await Notifications.setNotificationChannelAsync('alerts', {
            name: 'Alerts',
            importance: Notifications.AndroidImportance.HIGH,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#ef4444',
          });
        }
        
        // Save token to database
        await supabase
          .from('user_push_tokens')
          .upsert({
            user_id: user.id,
            push_token: token,
            device_type: Platform.OS,
            updated_at: new Date().toISOString(),
          });
          
        console.log('✅ Push token saved successfully for', Platform.OS);
        
      } catch (error) {
        console.error('Push notification error:', error);
      }
    };
    
    setupPushNotifications();
    
    // Add notification listeners
    const notificationSubscription = Notifications.addNotificationReceivedListener(notification => {
      console.log('🔔 Notification received:', notification);
    });
    
    // ✅ Fix: Check if data exists before accessing
    const responseSubscription = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data;
      if (data) {
        console.log('👆 Notification tapped:', data);
        // Handle navigation based on data
        if (data.actionLink) {
          // Navigate to appropriate screen
        }
      }
    });
    
    return () => {
      notificationSubscription.remove();
      responseSubscription.remove();
    };
    
  }, [user?.id]);
}