// app/hooks/usePushNotifications.ts
import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Platform } from 'react-native';

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
        console.log('Push token:', token);
        
        // Set up Android channel
        if (Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync('default', {
            name: 'Default',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#f97316',
          });
        }
        
        // Save to database
        await supabase
          .from('user_push_tokens')
          .upsert({
            user_id: user.id,
            push_token: token,
            device_type: Platform.OS,
            updated_at: new Date().toISOString(),
          });
          
        console.log('Push token saved successfully');
        
      } catch (error) {
        console.error('Push notification error:', error);
      }
    };
    
    setupPushNotifications();
    
    // Add notification listeners - these return subscription objects
    const notificationSubscription = Notifications.addNotificationReceivedListener(notification => {
      console.log('Notification received:', notification);
    });
    
    const responseSubscription = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('Notification tapped:', response.notification.request.content.data);
    });
    
    // ✅ Correct cleanup - subscriptions have a .remove() method
    return () => {
      notificationSubscription.remove();
      responseSubscription.remove();
    };
    
  }, [user?.id]);
}