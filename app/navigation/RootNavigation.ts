// app/navigation/RootNavigation.ts
import { createNavigationContainerRef } from '@react-navigation/native';
import { RootStackParamList } from './types';

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

// Add a queue for navigation actions while container is not ready
let pendingNavigation: { name: keyof RootStackParamList; params?: any } | null = null;

export function navigate<RouteName extends keyof RootStackParamList>(
  name: RouteName,
  params?: RootStackParamList[RouteName]
) {
  if (navigationRef.isReady()) {
    // @ts-ignore
    navigationRef.navigate(name, params);
    pendingNavigation = null;
  } else {
    pendingNavigation = { name, params };
    // Try again after a short delay
    setTimeout(() => {
      if (navigationRef.isReady() && pendingNavigation) {
        // @ts-ignore
        navigationRef.navigate(pendingNavigation.name, pendingNavigation.params);
        pendingNavigation = null;
      }
    }, 500);
  }
}

// Call this when navigation is ready (optional)
export function onNavigationReady() {
  if (pendingNavigation && navigationRef.isReady()) {
    // @ts-ignore
    navigationRef.navigate(pendingNavigation.name, pendingNavigation.params);
    pendingNavigation = null;
  }
}

// ---------------------------------------------------------------------------
// Role-aware destinations. Notifications, announcements and push payloads are
// shared by every role, so links must resolve to screens that exist for the
// signed-in user's navigator.
// ---------------------------------------------------------------------------

export type AppRole = string | null | undefined;

export function openOrder(role: AppRole, orderId: string) {
  if (role === 'vendor') navigate('VendorOrderDetails', { orderId });
  else if (role === 'rider') navigate('RiderDelivery', { orderId });
  else if (role === 'admin') navigate('AdminOrderDetails', { orderId });
  else navigate('OrderTracking', { orderId });
}

export function openHome(role: AppRole) {
  if (role === 'vendor') navigate('VendorTabs', { screen: 'Dashboard' });
  else if (role === 'rider') navigate('RiderTabs', { screen: 'Home' });
  else if (role === 'admin') navigate('AdminTabs');
  else navigate('CustomerTabs', { screen: 'Home' });
}

export function openOrders(role: AppRole) {
  if (role === 'vendor') navigate('VendorTabs', { screen: 'Orders' });
  else if (role === 'rider') navigate('RiderTabs', { screen: 'Jobs' });
  else if (role === 'admin') navigate('AdminAllOrders');
  else navigate('CustomerTabs', { screen: 'Orders' });
}

// Resolves an action link such as "/orders" or "/order/<id>". Returns false when
// the link has no destination for this role.
export function openAppLink(role: AppRole, link?: string | null): boolean {
  if (!link) return false;

  if (link.startsWith('/order/')) {
    const orderId = link.split('/').pop();
    if (!orderId) return false;
    openOrder(role, orderId);
    return true;
  }

  switch (link) {
    case '/home':
      openHome(role);
      return true;
    case '/orders':
      openOrders(role);
      return true;
    case '/vendors':
      if (role !== 'customer') return false;
      navigate('CustomerTabs', { screen: 'Vendors' });
      return true;
    case '/complaints':
      if (role !== 'customer' && role !== 'vendor' && role !== 'rider') return false;
      navigate('Complaints');
      return true;
    case '/rewards':
      if (role !== 'customer') return false;
      navigate('Rewards');
      return true;
    case '/vendor/orders':
      if (role !== 'vendor') return false;
      navigate('VendorTabs', { screen: 'Orders' });
      return true;
    case '/vendor/menu':
      if (role !== 'vendor') return false;
      navigate('VendorTabs', { screen: 'Menu' });
      return true;
    case '/earnings':
      if (role === 'rider') {
        navigate('RiderTabs', { screen: 'Earnings' });
        return true;
      }
      if (role !== 'vendor') return false;
      navigate('VendorTabs', { screen: 'Earnings' });
      return true;
    case '/promotions':
      if (role !== 'vendor') return false;
      navigate('Promotions');
      return true;
    default:
      return false;
  }
}
