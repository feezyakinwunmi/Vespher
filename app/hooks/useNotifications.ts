// app/hooks/useNotifications.ts
import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { RealtimeChannel } from '@supabase/supabase-js';
import { Alert } from 'react-native';

export interface Notification {
  id: string;
  type: 'order' | 'payout' | 'system' | 'alert';
  title: string;
  message: string;
  data?: any;
  read: boolean;
  action_link?: string;
  action_label?: string;
  created_at: string;
}

export function useNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const subscriptionRef = useRef<RealtimeChannel | null>(null);
  const fetchedRef = useRef(false);
  const retryCountRef = useRef(0);

  const fetchNotifications = async () => {
    if (!user) return;

    try {
      setIsLoading(true);
      setError(null);
      
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      setNotifications(data || []);
      setUnreadCount(data?.filter(n => !n.read).length || 0);
      fetchedRef.current = true;
      retryCountRef.current = 0;
    } catch (err: any) {
      console.error('Error fetching notifications:', err);
      setError(err.message);
      
      // Retry up to 3 times with exponential backoff
      if (retryCountRef.current < 3) {
        retryCountRef.current++;
        const delay = Math.pow(2, retryCountRef.current) * 1000;
        setTimeout(fetchNotifications, delay);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const markAsRead = async (notificationId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notificationId)
        .eq('user_id', user.id);

      if (error) throw error;

      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err: any) {
      console.error('Error marking notification as read:', err);
      Alert.alert('Error', 'Failed to mark notification as read');
    }
  };

  const markAllAsRead = async () => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', user.id)
        .eq('read', false);

      if (error) throw error;

      setNotifications(prev =>
        prev.map(n => ({ ...n, read: true }))
      );
      setUnreadCount(0);
    } catch (err: any) {
      console.error('Error marking all as read:', err);
      Alert.alert('Error', 'Failed to mark all as read');
    }
  };

  const deleteNotification = async (notificationId: string) => {
    if (!user) return;

    Alert.alert(
      'Delete Notification',
      'Are you sure you want to delete this notification?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('notifications')
                .delete()
                .eq('id', notificationId)
                .eq('user_id', user.id);

              if (error) throw error;

              setNotifications(prev => prev.filter(n => n.id !== notificationId));
              setUnreadCount(prev => {
                const wasUnread = notifications.find(n => n.id === notificationId)?.read === false;
                return wasUnread ? prev - 1 : prev;
              });
            } catch (err: any) {
              console.error('Error deleting notification:', err);
              Alert.alert('Error', 'Failed to delete notification');
            }
          },
        },
      ]
    );
  };

  useEffect(() => {
    fetchedRef.current = false;
    if (user) {
      fetchNotifications();
    } else {
      setNotifications([]);
      setUnreadCount(0);
      setIsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user) return;

    // Clean up previous subscription
    if (subscriptionRef.current) {
      subscriptionRef.current.unsubscribe();
    }

    // Add a delay before setting up subscription to avoid rate limits
    const setupTimer = setTimeout(() => {
      try {
        subscriptionRef.current = supabase
          .channel(`notifications-${user.id}`)
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'notifications',
              filter: `user_id=eq.${user.id}`,
            },
            (payload) => {
              const newNotification = payload.new as Notification;
              setNotifications(prev => [newNotification, ...prev]);
              setUnreadCount(prev => prev + 1);
            }
          )
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'notifications',
              filter: `user_id=eq.${user.id}`,
            },
            (payload) => {
              const updatedNotification = payload.new as Notification;
              setNotifications(prev => {
                const oldNotification = prev.find(n => n.id === updatedNotification.id);
                const wasUnread = oldNotification && !oldNotification.read;
                const isNowRead = updatedNotification.read;
                
                if (wasUnread && isNowRead) {
                  setUnreadCount(count => count - 1);
                }
                
                return prev.map(n => n.id === updatedNotification.id ? updatedNotification : n);
              });
            }
          )
          .on(
            'postgres_changes',
            {
              event: 'DELETE',
              schema: 'public',
              table: 'notifications',
              filter: `user_id=eq.${user.id}`,
            },
            (payload) => {
              const deletedId = payload.old.id;
              setNotifications(prev => {
                const deleted = prev.find(n => n.id === deletedId);
                if (deleted && !deleted.read) {
                  setUnreadCount(count => count - 1);
                }
                return prev.filter(n => n.id !== deletedId);
              });
            }
          )
          .subscribe();
      } catch (err) {
        console.error('Error setting up notification subscription:', err);
      }
    }, 2000); // Delay subscription by 2 seconds

    return () => {
      clearTimeout(setupTimer);
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
        subscriptionRef.current = null;
      }
    };
  }, [user?.id]);

  return {
    notifications,
    unreadCount,
    isLoading,
    error,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    refresh: fetchNotifications,
  };
}