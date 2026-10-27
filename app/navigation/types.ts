// navigation/types.ts
import type { NavigatorScreenParams } from '@react-navigation/native';
import type { Address } from '../types';

export type RootStackParamList = {
  // Auth
  Splash: undefined;
  Onboarding: undefined;
  Login: undefined;
  CustomerSignup: undefined;
  VendorSignup: undefined;
  RoleSelection: undefined;
  ForgotPassword: undefined;
  VendorAddresses: undefined;

  AddressPicker: {
    onSelectAddress?: (address: any) => void;
    initialLocation?: { latitude: number; longitude: number };
    selectedAddress?: any; // Add this
  };
  //common
  Messaging: { conversationId?: string } | undefined;
AnnouncementDetails: { announcementId: string };
  // Main Tabs
  CustomerTabs: NavigatorScreenParams<CustomerTabParamList> | undefined;
  VendorTabs: NavigatorScreenParams<VendorTabParamList> | undefined;

  
  // Customer Screens
  VendorDetails: { vendorId: string };
  OrderTracking: { orderId: string };
  Profile: undefined;
  Favorites: undefined;
  Notifications: undefined;
  Support: undefined;
  Privacy: undefined;
    AllVendorsMap: undefined
      MealPlanner: undefined;
  Pro: { tier?: 'pro' | 'pro_max' } | undefined;


  Addresses: { selectMode?: boolean; selectedAddress?: Address } | undefined;
  Cart: { selectedAddress?: Address; promoCode?: string } | undefined;
Rewards:undefined;



  // Vendor Screens
    History: undefined;
    VendorOrderDetails: { orderId: string };
    VendorAnalytics: undefined;
    CreatePromotion: undefined;
    Promotions:undefined;
  PromotionDetails: { promotionId: string };



    //admin screens
    AdminCode: undefined;
    Complaints: undefined;
    AdminTabs: NavigatorScreenParams<AdminTabParamList> | undefined;
    AdminOrderDetails: { orderId: string };
    AdminVendors: undefined;
    AdminWithdrawals: undefined;     
    AdminMenu: undefined;
    AdminCreateLogistic: undefined;
    AdminBusinessRequests: undefined;
AdminAllOrders: undefined;
  AdminUsers: undefined;
  AdminAnalytics: undefined;
  OutstandingPayments:undefined;
  AdminPromotions:undefined;
AdminAnnouncements:undefined;

};
export type AdminTabParamList = {
  Dashboard: undefined;
  Vendors: undefined;
  Withdrawals: undefined;
  Menu: undefined;
  Logistics: undefined;
  Settings: undefined;
};

// Cart and Profile are root-stack screens opened from the CustomerHeader.
export type CustomerTabParamList = {
  Home: undefined;
  Explore: { mealTimeFilter?: string } | undefined;
  Vendors: undefined;
  Orders: undefined;
};

export type VendorTabParamList = {
  Dashboard: undefined;
  Orders: { orderId?: string } | undefined;
  Menu: undefined;
  Earnings: undefined;
  Settings: undefined;
};
