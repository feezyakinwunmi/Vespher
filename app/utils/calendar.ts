// app/utils/calendar.ts
import * as Calendar from 'expo-calendar';
import { Alert, Platform } from 'react-native';
import { Linking } from 'react-native';


export async function addOrderToCalendar(order: any) {
  try {
    // Request permissions based on platform
    const { status } = await Calendar.requestCalendarPermissionsAsync();
    
    if (status !== 'granted') {
      // For iOS, we might need to explain how to enable in settings
      if (Platform.OS === 'ios') {
        Alert.alert(
          'Calendar Access Needed',
          'Please enable calendar access in your iPhone settings to add events.',
          [
            { text: 'OK' },
            { 
              text: 'Open Settings', 
              onPress: () => {
                // This will open the app settings page
                if (Platform.OS === 'ios') {
                  Linking.openURL('app-settings:');
                }
              }
            }
          ]
        );
      } else {
        Alert.alert('Permission needed', 'Please grant calendar access to add events');
      }
      return false;
    }

    // Get available calendars
    const calendars = await Calendar.getCalendarsAsync();
    
    // Find a writable calendar
    let defaultCalendar = null;
    
    if (Platform.OS === 'ios') {
      // On iOS, find a calendar that allows modifications
      defaultCalendar = calendars.find(cal => 
        cal.allowsModifications && 
        cal.source?.name === 'Default' || 
        cal.title === 'Calendar'
      );
    } else {
      // On Android, find a calendar the user owns
      defaultCalendar = calendars.find(cal => 
        cal.accessLevel === 'owner' || 
        cal.isPrimary
      );
    }

    // If no calendar found, create one (Android) or use first available
    if (!defaultCalendar && calendars.length > 0) {
      defaultCalendar = calendars[0];
    }

    if (!defaultCalendar) {
      if (Platform.OS === 'android') {
        // On Android, we can create a new calendar
        const calendarId = await Calendar.createCalendarAsync({
          title: 'Vespher Orders',
          color: '#f97316',
          entityType: Calendar.EntityTypes.EVENT,
          sourceId: calendars[0]?.source?.id,
          source: calendars[0]?.source,
          name: 'VespherOrders',
          accessLevel: Calendar.CalendarAccessLevel.OWNER,
          ownerAccount: 'personal',
        });
        defaultCalendar = { id: calendarId };
      } else {
        Alert.alert('Error', 'No writable calendar found');
        return false;
      }
    }

    // Prepare event details
    const isScheduled = order.is_scheduled;
    const scheduledDate = order.scheduled_datetime ? new Date(order.scheduled_datetime) : new Date(order.created_at);
    
    // Calculate end time (estimate 1 hour for preparation + delivery)
    const endDate = new Date(scheduledDate);
    endDate.setHours(endDate.getHours() + 2);

    // Format items for notes
    const itemsList = order.items?.map((item: any) => 
      `• ${item.quantity}x ${item.name} - ₦${(item.price * item.quantity).toLocaleString()}`
    ).join('\n');

    // Create event
    const eventId = await Calendar.createEventAsync(defaultCalendar.id, {
      title: `Order #${order.order_number || order.id.slice(0, 8)} - ${order.customer_name || 'Customer'}`,
      startDate: scheduledDate,
      endDate: endDate,
      location: order.delivery_address?.street || 'Delivery address',
      notes: `
Order Details:
${itemsList}

Total: ₦${order.total?.toLocaleString()}
Payment: ${order.payment_method}
Status: ${order.status}

${isScheduled ? 'Scheduled Order' : 'Order placed on: ' + new Date(order.created_at).toLocaleDateString()}
      `,
      timeZone: 'Africa/Lagos',
    });

    Alert.alert('Success', 'Order added to your calendar');
    return true;

  } catch (error: unknown) {
  console.error('Error adding to calendar:', error);
  
  // More helpful error message
  let errorMessage = 'Failed to add to calendar';
  
  if (error instanceof Error) {
    errorMessage = error.message;
    if (errorMessage?.includes('REMINDERS')) {
      errorMessage = 'Calendar access denied. Please enable in settings.';
    }
  } else if (typeof error === 'string') {
    errorMessage = error;
  }
  
  Alert.alert('Error', errorMessage);
  return false;
}
}