// app/contexts/CartContext.tsx
import React, { createContext, useContext, useReducer, useCallback } from 'react';
import { Alert } from 'react-native';
import type { CartItem, Product, SelectedOption } from '../types';

interface CartState {
  items: CartItem[];
  vendorId: string | null;
}

type CartAction =
  | { type: 'ADD_ITEM'; payload: { product: Product; quantity: number; selectedOptions?: SelectedOption[] } }
  | { type: 'REMOVE_ITEM'; payload: string }
  | { type: 'UPDATE_QUANTITY'; payload: { productId: string; quantity: number } }
  | { type: 'CLEAR_CART' }
  | { type: 'CLEAR_VENDOR' };

interface CartContextType {
  items: CartItem[];
  vendorId: string | null;
  addItem: (product: Product, quantity: number, selectedOptions?: SelectedOption[]) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  clearVendor: () => void;
  getItemCount: () => number;
  getSubtotal: () => number;
  getTotal: (deliveryFee: number, discount?: number) => number;
  canAddFromVendor: (vendorId: string) => boolean;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'ADD_ITEM': {
      const { product, quantity, selectedOptions } = action.payload;
      
      if (state.vendorId === null || state.vendorId === product.vendorId) {
        const existingItemIndex = state.items.findIndex(
          item => item.product.id === product.id
        );

        if (existingItemIndex > -1) {
          const newItems = [...state.items];
          newItems[existingItemIndex].quantity += quantity;
          return { ...state, items: newItems };
        }

        return {
          vendorId: product.vendorId,
          items: [...state.items, { product, quantity, selectedOptions }],
        };
      }

      // Different vendor - show alert and replace cart
      Alert.alert(
        'Replace Cart Items?',
        'Adding items from a different vendor will clear your current cart.',
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Replace',
            onPress: () => {
              // This will be handled by the dispatch
            },
            style: 'destructive',
          },
        ]
      );

      return {
        vendorId: product.vendorId,
        items: [{ product, quantity, selectedOptions }],
      };
    }

    case 'REMOVE_ITEM': {
      const newItems = state.items.filter(item => item.product.id !== action.payload);
      return {
        ...state,
        items: newItems,
        vendorId: newItems.length === 0 ? null : state.vendorId,
      };
    }

    case 'UPDATE_QUANTITY': {
      const { productId, quantity } = action.payload;
      if (quantity <= 0) {
        const newItems = state.items.filter(item => item.product.id !== productId);
        return {
          ...state,
          items: newItems,
          vendorId: newItems.length === 0 ? null : state.vendorId,
        };
      }

      return {
        ...state,
        items: state.items.map(item =>
          item.product.id === productId ? { ...item, quantity } : item
        ),
      };
    }

    case 'CLEAR_CART':
      return { items: [], vendorId: null };

    case 'CLEAR_VENDOR':
      return { ...state, vendorId: null };

    default:
      return state;
  }
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(cartReducer, { items: [], vendorId: null });

  const addItem = useCallback((product: Product, quantity: number, selectedOptions?: SelectedOption[]) => {
    dispatch({ type: 'ADD_ITEM', payload: { product, quantity, selectedOptions } });
  }, []);

  const removeItem = useCallback((productId: string) => {
    dispatch({ type: 'REMOVE_ITEM', payload: productId });
  }, []);

  const updateQuantity = useCallback((productId: string, quantity: number) => {
    dispatch({ type: 'UPDATE_QUANTITY', payload: { productId, quantity } });
  }, []);

  const clearCart = useCallback(() => {
    dispatch({ type: 'CLEAR_CART' });
  }, []);

  const clearVendor = useCallback(() => {
    dispatch({ type: 'CLEAR_VENDOR' });
  }, []);

  const getItemCount = useCallback(() => {
    return state.items.reduce((total, item) => total + item.quantity, 0);
  }, [state.items]);

  const getSubtotal = useCallback(() => {
    return state.items.reduce((total, item) => {
      const itemPrice = item.product.price;
      return total + itemPrice * item.quantity;
    }, 0);
  }, [state.items]);

  const getTotal = useCallback((deliveryFee: number, discount: number = 0) => {
    return getSubtotal() + deliveryFee - discount;
  }, [getSubtotal]);

  const canAddFromVendor = useCallback((vendorId: string) => {
    return state.vendorId === null || state.vendorId === vendorId;
  }, [state.vendorId]);

  return (
    <CartContext.Provider
      value={{
        items: state.items,
        vendorId: state.vendorId,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        clearVendor,
        getItemCount,
        getSubtotal,
        getTotal,
        canAddFromVendor,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}