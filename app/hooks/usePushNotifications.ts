// app/hooks/usePushNotifications.ts
import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import {navigate} from '../navigation/RootNavigation';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
    priority: Notifications.AndroidNotificationPriority.MAX,
  }),
});

export function usePushNotifications() {
  const { user } = useAuth();
  const notificationListener = useRef<Notifications.Subscription | null>(null);
  const responseListener = useRef<Notifications.Subscription | null>(null);

  const savePushToken = async (userId: string, token: string) => {
    try {
      const { data: existingToken } = await supabase
        .from('user_push_tokens')
        .select('user_id')
        .eq('push_token', token)
        .maybeSingle();

      if (existingToken) {
        const { error: updateError } = await supabase
          .from('user_push_tokens')
          .update({ 
            user_id: userId, 
            updated_at: new Date().toISOString() 
          })
          .eq('push_token', token);

        if (updateError) {
          console.error('Error updating token:', updateError);
        } else {
          console.log('✅ Token reassigned to user:', userId);
        }
      } else {
        const { error: insertError } = await supabase
          .from('user_push_tokens')
          .insert({
            user_id: userId,
            push_token: token,
            device_type: Platform.OS,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });

        if (insertError) {
          console.error('Error inserting token:', insertError);
        } else {
          console.log('✅ New token saved for user:', userId);
        }
      }
    } catch (error) {
      console.error('Error in savePushToken:', error);
    }
  };

  useEffect(() => {
    if (!user?.id) return;

    const setupPushNotifications = async () => {
      if (!Device.isDevice) {
        console.log('Must use physical device for push notifications');
        return;
      }

      try {
        const { status } = await Notifications.requestPermissionsAsync();
        if (status !== 'granted') {
          console.log('Push notification permission denied');
          return;
        }

        const projectId = Constants.expoConfig?.extra?.eas?.projectId;
        const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
        const token = tokenData.data;

        console.log('📱 Expo Push Token:', token);

        if (Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync('default', {
            name: 'Main Notifications',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#f97316',
            sound: 'default',
            lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
          });

          await Notifications.setNotificationChannelAsync('orders', {
            name: 'Orders & Deliveries',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#f97316',
          });

          await Notifications.setNotificationChannelAsync('payments', {
            name: 'Payments & Payouts',
            importance: Notifications.AndroidImportance.HIGH,
            lightColor: '#10b981',
          });

          await Notifications.setNotificationChannelAsync('alerts', {
            name: 'Alerts',
            importance: Notifications.AndroidImportance.MAX,
            lightColor: '#ef4444',
          });
        }

        await savePushToken(user.id, token);

      } catch (error) {
        console.error('❌ Push notification setup error:', error);
      }
    };

    setupPushNotifications();

    notificationListener.current = Notifications.addNotificationReceivedListener((notification) => {
      console.log('🔔 Foreground notification received:', notification);
    });
// In the response listener, add a small delay
responseListener.current = Notifications.addNotificationResponseReceivedListener(async (response) => {
  const data = response.notification.request.content.data;
  console.log('👆 Notification tapped - Data:', data);

  // Small delay to ensure navigation is ready
  await new Promise(resolve => setTimeout(resolve, 300));

  if (data?.announcement_id) {
    navigate('AnnouncementDetails', { announcementId: data.announcement_id });
  } 
  else if (data?.orderId) {
    navigate('OrderTracking', { orderId: data.orderId });
  }
  else if (data?.product_id) {
    navigate('VendorMenu');
  }
  else if (data?.conversation_id) {
    navigate('Messaging');
  }
  else if (data?.screen === 'VendorOrders') {
    navigate('VendorOrders', { orderId: data.orderId });
  }
  else if (data?.screen === 'Orders') {
    navigate('Orders');
  }
  else if (data?.screen) {
    // @ts-ignore
    navigate(data.screen, data);
  }
  else {
    navigate('Notifications');
  }
});

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, [user?.id]);

  return null;
}