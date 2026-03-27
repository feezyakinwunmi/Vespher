// app/contexts/CartContext.tsx
import React, { createContext, useContext, useReducer, useCallback } from 'react';
import { Alert } from 'react-native';
import type { CartItem, Product, SelectedOption } from '../types';

interface ComboGroup {
  id: string; // The promotion_id
  items: string[]; // Array of product IDs in this combo
  mainProductId: string;
  freeProductId: string;
}

// Update CartState interface
interface CartState {
  items: CartItem[];
  vendorId: string | null;
  comboGroups: ComboGroup[]; // Add this to track combo groups
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
  
  // Check if it's a promo item with max quantity limit
  const maxQuantity = (product as any).max_quantity || (product as any).promotion_max_quantity;
  const isComboMain = (product as any).is_combo_main === true;
  const comboId = (product as any).promotion_id;
  const isFreeItem = (product as any).is_free_item === true;
  
  if (state.vendorId === null || state.vendorId === product.vendorId) {
    const existingItemIndex = state.items.findIndex(
      item => item.product.id === product.id
    );

    if (existingItemIndex > -1) {
      const existingItem = state.items[existingItemIndex];
      const newQuantity = existingItem.quantity + quantity;
      
      // Check if adding would exceed max quantity for promo items
      if (maxQuantity && newQuantity > maxQuantity) {
        Alert.alert('Limit Reached', `You can only order ${maxQuantity} of this promotional item.`);
        return state;
      }
      
      const newItems = [...state.items];
      newItems[existingItemIndex].quantity = newQuantity;
      return { ...state, items: newItems };
    }

    // Check if adding new promo item would exceed max quantity
    if (maxQuantity && quantity > maxQuantity) {
      Alert.alert('Limit Reached', `You can only order ${maxQuantity} of this promotional item.`);
      return state;
    }

    // Handle combo group tracking
    let newComboGroups = [...state.comboGroups];
    
    // If adding a combo item (either main or free), track the group
    if (comboId && (isComboMain || isFreeItem)) {
      // Check if combo group already exists
      const existingGroup = newComboGroups.find(g => g.id === comboId);
      
      if (!existingGroup) {
        // Create new combo group
        newComboGroups.push({
          id: comboId,
          items: [product.id],
          mainProductId: isComboMain ? product.id : '',
          freeProductId: isFreeItem ? product.id : '',
        });
      } else {
        // Add to existing group if not already there
        if (!existingGroup.items.includes(product.id)) {
          existingGroup.items.push(product.id);
        }
        if (isComboMain && !existingGroup.mainProductId) {
          existingGroup.mainProductId = product.id;
        }
        if (isFreeItem && !existingGroup.freeProductId) {
          existingGroup.freeProductId = product.id;
        }
      }
    }

    return {
      vendorId: product.vendorId,
      items: [...state.items, { product, quantity, selectedOptions }],
      comboGroups: newComboGroups,
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

  // Check max quantity for promo items in new cart
  if (maxQuantity && quantity > maxQuantity) {
    Alert.alert('Limit Reached', `You can only order ${maxQuantity} of this promotional item.`);
    return state;
  }

  // For new cart with combo items, create combo group
  let newComboGroups: ComboGroup[] = [];
  if (comboId && (isComboMain || isFreeItem)) {
    newComboGroups = [{
      id: comboId,
      items: [product.id],
      mainProductId: isComboMain ? product.id : '',
      freeProductId: isFreeItem ? product.id : '',
    }];
  }

  return {
    vendorId: product.vendorId,
    items: [{ product, quantity, selectedOptions }],
    comboGroups: newComboGroups,
  };
}

  case 'REMOVE_ITEM': {
  const productId = action.payload;
  
  // Find if this item is part of a combo group
  const comboGroup = state.comboGroups.find(g => g.items.includes(productId));
  
  if (comboGroup) {
    // Remove ALL items in the combo group
    const itemsToRemove = comboGroup.items;
    const newItems = state.items.filter(item => !itemsToRemove.includes(item.product.id));
    const newComboGroups = state.comboGroups.filter(g => g.id !== comboGroup.id);
    
    return {
      ...state,
      items: newItems,
      vendorId: newItems.length === 0 ? null : state.vendorId,
      comboGroups: newComboGroups,
    };
  }
  
  // Normal item removal (non-combo)
  const newItems = state.items.filter(item => item.product.id !== productId);
  return {
    ...state,
    items: newItems,
    vendorId: newItems.length === 0 ? null : state.vendorId,
    comboGroups: state.comboGroups,
  };
}

  case 'UPDATE_QUANTITY': {
  const { productId, quantity } = action.payload;
  
  // Check if this item is part of a combo group
  const comboGroup = state.comboGroups.find(g => g.items.includes(productId));
  
  // If trying to remove (quantity <= 0) and it's part of a combo, remove the whole combo
  if (comboGroup && quantity <= 0) {
    const itemsToRemove = comboGroup.items;
    const newItems = state.items.filter(item => !itemsToRemove.includes(item.product.id));
    const newComboGroups = state.comboGroups.filter(g => g.id !== comboGroup.id);
    
    return {
      ...state,
      items: newItems,
      vendorId: newItems.length === 0 ? null : state.vendorId,
      comboGroups: newComboGroups,
    };
  }
  
  if (quantity <= 0) {
    const newItems = state.items.filter(item => item.product.id !== productId);
    return {
      ...state,
      items: newItems,
      vendorId: newItems.length === 0 ? null : state.vendorId,
      comboGroups: state.comboGroups,
    };
  }

  // Find the item to check if it's a promo item with max quantity
  const itemToUpdate = state.items.find(item => item.product.id === productId);
  const maxQuantity = itemToUpdate ? (itemToUpdate.product as any).max_quantity || (itemToUpdate.product as any).promotion_max_quantity : null;
  
  // Check if updating would exceed max quantity for promo items
  if (maxQuantity && quantity > maxQuantity) {
    Alert.alert('Limit Reached', `You can only order ${maxQuantity} of this promotional item.`);
    return state;
  }

  return {
    ...state,
    items: state.items.map(item =>
      item.product.id === productId ? { ...item, quantity } : item
    ),
    comboGroups: state.comboGroups,
  };
}

   case 'CLEAR_CART':
  return { items: [], vendorId: null, comboGroups: [] };

    case 'CLEAR_VENDOR':
      return { ...state, vendorId: null };

    default:
      return state;
  }
}

export function CartProvider({ children }: { children: React.ReactNode }) {
const [state, dispatch] = useReducer(cartReducer, { 
  items: [], 
  vendorId: null,
  comboGroups: [] 
});
// Update the addItem function to accept promotion details
const addItem = useCallback((product: Product, quantity: number, selectedOptions?: SelectedOption[]) => {
  // Validate promo item quantity before adding
  const maxQuantity = (product as any).max_quantity || (product as any).promotion_max_quantity;
  if (maxQuantity && quantity > maxQuantity) {
    Alert.alert('Limit Reached', `You can only order ${maxQuantity} of this promotional item.`);
    return;
  }
  
  // Add promotion details to the product if it's a promo
  const itemWithPromo = {
    ...product,
    promotion_id: (product as any).promotion_id,
    is_promotion: (product as any).is_promotion || false,
    is_free_item: (product as any).is_free_item || false,
    is_combo_main: (product as any).is_combo_main || false,
    combo_details: (product as any).combo_details,
    promotion_price: (product as any).promotion_price,
  };
  
  dispatch({ type: 'ADD_ITEM', payload: { product: itemWithPromo, quantity, selectedOptions } });
}, []);

  const removeItem = useCallback((productId: string) => {
    dispatch({ type: 'REMOVE_ITEM', payload: productId });
  }, []);

  const updateQuantity = useCallback((productId: string, quantity: number) => {
    if (quantity < 0) return;
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