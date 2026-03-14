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
    TestWebView: undefined;
  Search: undefined;
  Addresses: { selectMode?: boolean; selectedAddress?: Address } | undefined;
  Cart: { selectedAddress?: Address } | undefined;




  // Vendor Screens
    Dashboard: undefined;
    VendorOrders: { orderId?: string };
    VendorMenu: undefined;
    History: undefined;
    Earnings: undefined;
    Settings: undefined;
    VendorOrderDetails: { orderId: string };
    VendorAnalytics: undefined;


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

};

export type CustomerTabParamList = {
  Home: undefined;
  Explore: undefined;
  Vendors: undefined;
  Orders: undefined;
  Cart: undefined;
  Profile: undefined;
  TestWebView: undefined;
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
  VendorSettings: undefined;
  VendorAnalytics: undefined;
  vendorAddresses: undefined;

};