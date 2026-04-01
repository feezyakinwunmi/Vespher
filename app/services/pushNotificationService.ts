// app/services/pushNotificationService.ts
import { supabase } from '../lib/supabase';

interface NotificationPayload {
  userId: string;
  title: string;
  body: string;
  type: 'order' | 'delivery' | 'system' | 'alert' | 'verification';
  actionLink?: string;
  actionLabel?: string;
  metadata?: any;
}

interface PushPayload {
  title: string;
  body: string;
  data: any;
}

export class PushNotificationService {
  
  // Send to single user
  static async sendToUser(payload: NotificationPayload) {
    try {
      // 1. Get user's push token
      const { data: tokenData, error: tokenError } = await supabase
        .from('user_push_tokens')
        .select('push_token')
        .eq('user_id', payload.userId)
        .single();
      
      if (tokenError || !tokenData?.push_token) {
        console.log(`No push token for user: ${payload.userId}`);
      } else {
        // 2. Send push notification
        await this.sendPush({
          title: payload.title,
          body: payload.body,
          data: {
            type: payload.type,
            actionLink: payload.actionLink,
            userId: payload.userId,
            ...payload.metadata,
          },
        }, tokenData.push_token);
      }
      
      // 3. Save to in-app notifications
      await this.saveInAppNotification(payload);
      
    } catch (error) {
      console.error('Error sending notification:', error);
    }
  }
  
  // Send to multiple users
  static async sendToUsers(userIds: string[], payload: Omit<NotificationPayload, 'userId'>) {
    for (const userId of userIds) {
      await this.sendToUser({ ...payload, userId });
    }
  }
  
  // Send to all users of a specific role
  static async sendToRole(role: 'customer' | 'vendor' | 'rider' | 'admin', payload: Omit<NotificationPayload, 'userId'>) {
    try {
      const { data: users, error } = await supabase
        .from('users')
        .select('id')
        .eq('role', role);
      
      if (error) throw error;
      
      for (const user of users) {
        await this.sendToUser({ ...payload, userId: user.id });
      }
    } catch (error) {
      console.error(`Error sending to ${role}s:`, error);
    }
  }
  
  // Send push via Expo
  private static async sendPush(payload: PushPayload, pushToken: string) {
    try {
      const message = {
        to: pushToken,
        sound: 'default',
        title: payload.title,
        body: payload.body,
        data: payload.data,
      };
      
      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
      });
      
      console.log(`Push sent to: ${pushToken.substring(0, 10)}...`);
    } catch (error) {
      console.error('Error sending push:', error);
    }
  }
  
  // Save in-app notification
  private static async saveInAppNotification(payload: NotificationPayload) {
    try {
      const { error } = await supabase
        .from('notifications')
        .insert({
          user_id: payload.userId,
          type: payload.type,
          title: payload.title,
          message: payload.body,
          action_link: payload.actionLink,
          action_label: payload.actionLabel,
          metadata: payload.metadata,
          created_at: new Date().toISOString(),
        });
      
      if (error) throw error;
    } catch (error) {
      console.error('Error saving in-app notification:', error);
    }
  }
}