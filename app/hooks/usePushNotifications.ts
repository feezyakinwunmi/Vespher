// app/hooks/usePushNotifications.ts
import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { setCurrentPushToken } from '../services/pushTokenRegistry';
import { navigate, openOrder, openOrders, openAppLink } from '../navigation/RootNavigation';

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

  const savePushToken = async (token: string) => {
    const { error } = await supabase.rpc('register_push_token', { p_token: token, p_device: Platform.OS });
    if (error) console.error('Error saving push token:', error);
  };

  useEffect(() => {
    if (!user?.id) return;

    const setupPushNotifications = async () => {
      if (!Device.isDevice) {
        console.log('Must use physical device for push notifications');
        return;
      }
      // Expo Go can't receive remote push notifications; use a development build to test them.
      if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) {
        console.log('Push notifications are disabled in Expo Go');
        return;
      }

      try {
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

        const { status } = await Notifications.requestPermissionsAsync();
        if (status !== 'granted') {
          console.log('Push notification permission denied');
          return;
        }

        const projectId = Constants.expoConfig?.extra?.eas?.projectId;
        const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
        const token = tokenData.data;

        console.log('📱 Expo Push Token:', token);

        setCurrentPushToken(token);
        await savePushToken(token);

      } catch (error) {
        console.error('❌ Push notification setup error:', error);
      }
    };

    setupPushNotifications();

    notificationListener.current = Notifications.addNotificationReceivedListener((notification) => {
      console.log('🔔 Foreground notification received:', notification);
    });
    // Taps on a push notification. Payload values are untrusted, so only known
    // destinations are opened and they are resolved for the user's role.
    const handleResponse = async (response: Notifications.NotificationResponse) => {
      const data = (response.notification.request.content.data || {}) as Record<string, unknown>;
      const str = (v: unknown) => (typeof v === 'string' && v.length > 0 ? v : undefined);
      const role = user?.role;

      // Small delay to ensure navigation is ready
      await new Promise(resolve => setTimeout(resolve, 300));

      const announcementId = str(data.announcement_id);
      const orderId = str(data.orderId) || str(data.order_id);

      if (announcementId) {
        navigate('AnnouncementDetails', { announcementId });
      } else if (orderId) {
        openOrder(role, orderId);
      } else if (str(data.complaint_id) && (role === 'customer' || role === 'vendor')) {
        navigate('Complaints');
      } else if (str(data.conversation_id)) {
        navigate('Messaging', { conversationId: str(data.conversation_id) });
      } else if (data.product_id && role === 'vendor') {
        navigate('VendorTabs', { screen: 'Menu' });
      } else if (data.screen === 'VendorOrders' || data.screen === 'Orders') {
        openOrders(role);
      } else if (!openAppLink(role, str(data.action_link))) {
        navigate('Notifications');
      }
    };

    responseListener.current = Notifications.addNotificationResponseReceivedListener(handleResponse);

    // The app was opened from a killed state by tapping a notification.
    Notifications.getLastNotificationResponseAsync().then(response => {
      if (response) {
        handleResponse(response);
        Notifications.clearLastNotificationResponseAsync?.();
      }
    });

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, [user?.id]);

  return null;
}