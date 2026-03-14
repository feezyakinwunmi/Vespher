// app/types/index.ts

export type AdminTab = 'dashboard' | 'vendors' | 'withdrawals' | 'menu' | 'users' | 'settings';

// In your types file or at the top of useAdmin.ts
export interface DashboardStats {
  totalUsers: number;
  totalVendors: number;
  totalRiders: number;
  totalOrders: number;
  totalRevenue: number;
  platformFees: number;
  pendingVendors: number;
  pendingWithdrawals: number;
  pendingMenu: number; 
  recentOrders: any[];
}

export interface RecentOrder {
  id: string;
  order_number: string;
  total: number;
  status: string;
  created_at: string;
  vendor: { name: string } | null;
  customer: { name: string } | null;
}

export interface PendingVendor {
  id: string;
  name: string;
  description: string;
  address: string;
  phone: string;
  email: string;
  category: string;
  image_url: string;
  created_at: string;
  owner: {
    name: string;
    email: string;
    phone: string;
  } | null;
}

// Types for Supabase real-time payloads
interface RealtimePayload<T> {
  new: T;
  old: T;
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
}

interface OrderRecord {
  id: string;
  rider_id: string | null;
  status: string;
  // Add other order fields as needed
}

interface UserRecord {
  id: string;
  role: string;
  is_available: boolean;
  is_suspended: boolean;
  current_latitude?: string | number;
  current_longitude?: string | number;
  // Add other user fields as needed
}
export interface WithdrawalRequest {
  id: string;
  user_id: string;
  user_type: 'vendor' | 'rider';
  amount: number;
  bank_name: string;
  account_number: string;
  account_name: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  reference: string;
  created_at: string;
  processed_at?: string;
  notes?: string;
  user?: {
    name: string;
    email: string;
    role: string;
  };
}

export interface PlatformSettings {
  platform_fee_percentage: number;
  delivery_fee_per_km: number;
  min_delivery_fee: number;
  max_delivery_fee: number;
}

// Vendor Types
export interface Vendor {
  id: string;
  name: string;
  description: string;
  category: string;
  logo: string;
  image: string;
  coverImage: string;
  rating: number;
  reviewCount: number;
  deliveryTime: string;
  deliveryFee: number;
  minOrder: number;
  isOpen: boolean;
  is_approved?: boolean;
  address: string;
  phone: string;
  email?: string;
  products: Product[];
  owner_id?: string;
  created_at?: string;
  latitude?: number;      // Add this
  longitude?: number; 
}
// Product Types
export interface Product {
  id: string;
  vendorId: string;
  name: string;
  description: string;
  price: number;
  originalPrice?: number;
  image: string;
  image_url?: string; // For Supabase compatibility
  category: string;
  isAvailable: boolean;
  is_available?: boolean; // For Supabase compatibility
  isPopular?: boolean;
  is_popular?: boolean; // For Supabase compatibility
  preparationTime?: number; // Changed from string to number
  preparation_time?: number; // For Supabase compatibility
  options?: ProductOption[];
  
  created_at?: string;
  orders?: number; // For menu stats
}

export interface ProductOption {
  id: string;
  name: string;
  choices: OptionChoice[];
}

export interface OptionChoice {
  id: string;
  name: string;
  price: number;
}

// Cart Types
export interface CartItem {
  product: Product;
  quantity: number;
  selectedOptions?: SelectedOption[];
  special_instructions?: string; // Add for order items
}

export interface SelectedOption {
  optionId: string;
  choiceId: string;
  name?: string; // Denormalized for order history
  price?: number; // Denormalized for order history
}
export interface OrderItemDB {
  id: string;
  order_id: string;
  product_id: string;
  vendor_id: string;
  name: string;
  quantity: number;
  price: number;
  original_price?: number;
  options?: any;
  special_instructions?: string;
  subtotal: number;
  created_at: string;
  product?: Product; // When joined
}
// Order Types - Updated to match database schema
export interface Order {
  id: string;
  order_number?: string;
  customer_id: string;
  vendor_id: string;
  rider_id?: string;
  
  // Items can be either array of CartItem or OrderItemDB
  items: any[];
  
  status: OrderStatus;
  subtotal: number;
  delivery_fee: number;
  service_fee?: number;
  discount: number;
  total: number;
  
  payment_method: PaymentMethod;
  payment_status?: string;
  payment_reference?: string;
  
  delivery_address: any;
  delivery_instructions?: string;
  estimated_delivery_time?: string;
  actual_delivery_time?: string;
  
  customer_name?: string;
  customer_phone?: string;
  customer_email?: string;
  
  notes?: string;
  special_instructions?: string;
  rejection_reason?: string;
  
  created_at: string;
  updated_at?: string;
  accepted_at?: string;
  prepared_at?: string;
  picked_up_at?: string;
  delivered_at?: string;
  
  // Joined fields
  customer?: any;
  vendor?: any;
  rider?: any;
  
  // For backward compatibility
  customerId?: string;
  vendorId?: string;
  createdAt?: string;
  deliveryFee?: number;
  paymentMethod?: PaymentMethod;
  deliveryAddress?: any;
  estimatedDelivery?: string;
}

// Order Item Types - New for detailed order items
export interface OrderItem {
  product_id: string;
  productId?: string; // camelCase for compatibility
  name: string;
  quantity: number;
  price: number;
  original_price?: number;
  originalPrice?: number; // camelCase for compatibility
  options?: OrderItemOption[];
  special_instructions?: string;
  subtotal?: number; // Calculated: quantity * price
}

export interface OrderItemWithProduct extends OrderItem {
  product: Product;
}

export interface OrderItemOption {
  name: string;
  choice: string;
  price_adjustment?: number;
}

// Order Status
export type OrderStatus = 
  | 'pending'
  | 'confirmed'
  | 'preparing'
  | 'ready'
  | 'picked_up'
  | 'in_transit'
  | 'delivered'
  | 'cancelled'
  | 'scheduled'; 
;

// Payment Method
export type PaymentMethod = 'cash' | 'card' | 'transfer' | 'wallet';

// Address Types - Updated for DB compatibility
// app/types/index.ts

// Update the Address interface to include coordinates
export interface Address {
  id: string;
  user_id?: string;
  userId?: string;
  label: string;
  street: string;
  area: string;
  landmark?: string;
  phone: string;
  is_default?: boolean;
  isDefault?: boolean;
  latitude?: number;      // Add this
  longitude?: number;     // Add this
  created_at?: string;
    isCurrentLocation?: boolean; // Add this to identify current location

}
// Rider Types - Updated
export interface Rider {
  id: string;
  user_id?: string; // Link to users table
  name: string;
  phone: string;
  email?: string;
  vehicle_type: string;
  vehicleType?: string; // For compatibility
  vehicle_number: string;
  vehicleNumber?: string; // For compatibility
  license_number?: string;
  rating: number;
  review_count?: number;
  image: string;
  avatar_url?: string; // For DB
  is_available?: boolean;
  total_deliveries?: number;
  created_at?: string;
}

// User Types - Updated for DB compatibility
export interface User {
  id: string;
  name: string;
  email?: string;
  phone: string;
  avatar?: string;
  avatar_url?: string; // For DB
  addresses: Address[];
  favorites: string[];
  role: 'customer' | 'vendor' | 'admin' | 'rider' | 'business';
  created_at?: string;
  updated_at?: string;
}

// Category Types
export interface Category {
  id: string;
  name: string;
  icon: string;
  image: string;
  image_url?: string; // For DB
  vendor_count?: number;
}

// Notification Types - Updated
export interface Notification {
  id: string;
  user_id?: string; // For DB
  userId?: string; // For compatibility
  title: string;
  message: string;
  type: 'order' | 'promo' | 'system' | 'alert';
  read: boolean;
  is_read?: boolean; // For DB
  data?: Record<string, any>; // Additional data
  created_at: string;
  createdAt?: string; // For compatibility
}

// Vendor Dashboard Stats
export interface VendorStats {
  today_sales: number;
  today_orders: number;
  total_orders: number;
  total_revenue: number;
  average_rating: number;
  review_count: number;
  average_prep_time: number;
  popular_items: Array<{
    id: string;
    name: string;
    count: number;
  }>;
}

// Order Analytics
export interface OrderAnalytics {
  daily: Array<{
    date: string;
    orders: number;
    revenue: number;
  }>;
  status_breakdown: Record<OrderStatus, number>;
  peak_hours: Array<{
    hour: number;
    order_count: number;
  }>;
}
// Add this at the end of your types file
// Update this type to include the new tabs
export type DashboardTab = 'overview' | 'orders' | 'menu' | 'earnings' | 'settings' | 'analytics' | 'history'| 'promos';
// Helper type for converting between camelCase and snake_case
export type ToCamelCase<T> = {
  [K in keyof T as K extends string ? 
    K extends `${infer T}_${infer U}` ? 
      `${T}${Capitalize<U>}` : K
    : K]: T[K];
};

export type ToSnakeCase<T> = {
  [K in keyof T as K extends string ?
    K extends `${infer T}${infer U}` ?
      U extends Uncapitalize<U> ?
        `${Uncapitalize<T>}_${Uncapitalize<U>}` :
        K
      : K
    : K]: T[K];
};