// navigation/types.ts
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
  Messaging:undefined;
  Conversation: { conversationId: string; vendorId?: string; customerId?: string };
AnnouncementDetails: { announcementId: string };
  // Main Tabs
  CustomerTabs: undefined;
  VendorTabs: undefined;

  
  // Customer Screens
  Home: undefined;
  Explore: undefined;
  Vendors: undefined;
  VendorDetails: { vendorId: string };
  Orders: undefined;
  OrderTracking: { orderId: string };
  Profile: undefined;
  AddAddress: undefined;
  EditAddress: { address: Address };
  Favorites: undefined;
  Notifications: undefined;
  Support: undefined;
  Privacy: undefined;
    AllVendorsMap: undefined

    TestWebView: undefined;
  Search: undefined;
  Addresses: { selectMode?: boolean; selectedAddress?: Address } | undefined;
  Cart: { selectedAddress?: Address } | undefined;
Rewards:undefined;



  // Vendor Screens
    Dashboard: undefined;
    VendorOrders: { orderId?: string };
    VendorMenu: undefined;
    History: undefined;
    Earnings: undefined;
    Settings: undefined;
    VendorOrderDetails: { orderId: string };
    VendorAnalytics: undefined;
    CreatePromotion: undefined;
    Promotions:undefined;
  PromotionDetails: { promotionId: string };
  VendorDashboard: undefined;
  vendorAddresses: undefined;
    VendorSettings: undefined;



    //admin screens
    AdminTabs: undefined;
    AdminDashboard: undefined;
    AdminOrderDetails: { orderId: string };
    AdminVendors: undefined;
    AdminWithdrawals: undefined;     
    AdminMenu: undefined;
    AdminLogistics: undefined;
    AdminCreateLogistic: undefined;
    AdminSettings: undefined;
    AdminBusinessRequests: undefined;
AdminAllOrders: undefined;
  AdminBusinessRequestDetails: { requestId: string };
  AdminUsers: undefined;
  AdminAnalytics: undefined;
  OutstandingPayments:undefined;
  AdminPromotions:undefined;
AdminAnnouncements:undefined;

};
export type AdminTabParamList = {
  AdminDashboard: undefined;
  AdminVendors: undefined;
  AdminWithdrawals: undefined;
  AdminMenu: undefined;
  AdminUsers: undefined;
  AdminSettings: undefined;
  AdminLogistics: undefined;
  AdminCreateLogistic: undefined;
  AdminOrderDetails: { orderId: string };
  AdminBusinessRequests: undefined;
AdminAnnouncements:undefined;

};

export type CustomerTabParamList = {
  Home: undefined;
  Explore: undefined;
  Vendors: undefined;
  Orders: undefined;
  Cart: undefined;
  Profile: undefined;
  TestWebView: undefined;
  AllVendorsMap: undefined;
  Rewards:undefined;
};

export type VendorTabParamList = {
  Dashboard: undefined;
  Orders: undefined;
  Menu: undefined;
  History: undefined;
  Earnings: undefined;
  Settings: undefined;
   VendorTabs: undefined;
  VendorOrders: { orderId?: string }; 
  VendorMenu: undefined;
  VendorHistory: undefined;
  VendorEarnings: undefined;
  VendorAnalytics: undefined;
  vendorAddresses: undefined;
    VendorDashboard: undefined;
  VendorSettings: undefined;

};