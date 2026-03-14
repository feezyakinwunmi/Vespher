// app/components/vendor/MenuItemCard.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import type { MenuItem } from '../../hooks/vendor/useVendorMenu';

interface MenuItemCardProps {
  item: MenuItem;
  onEdit: () => void;
  onDelete: () => void;
  onToggleAvailability: () => void;
  onUpdateQuantity: (quantity: number) => void;
}

export function MenuItemCard({
  item,
  onEdit,
  onDelete,
  onToggleAvailability,
  onUpdateQuantity,
}: MenuItemCardProps) {
  const [showActions, setShowActions] = useState(false);
  const [showQuantityModal, setShowQuantityModal] = useState(false);
  const [quantity, setQuantity] = useState(item.quantity_available?.toString() || '0');
  const [imageError, setImageError] = useState(false);

  const getStatusColor = () => {
    if (item.approval_status === 'pending') return '#f59e0b';
    if (item.approval_status === 'rejected') return '#ef4444';
    if (!item.is_available) return '#666';
    return '#10b981';
  };

  const getStatusText = () => {
    if (item.approval_status === 'pending') return 'Pending Approval';
    if (item.approval_status === 'rejected') return 'Rejected';
    if (!item.is_available) return 'Unavailable';
    return 'Approved';
  };

  const handleQuantityUpdate = () => {
    const numQuantity = parseInt(quantity);
    if (isNaN(numQuantity) || numQuantity < 0) {
      Alert.alert('Error', 'Please enter a valid quantity');
      return;
    }
    onUpdateQuantity(numQuantity);
    setShowQuantityModal(false);
  };

  return (
    <>
      <View style={styles.card}>
        {/* Image */}
        <View style={styles.imageContainer}>
          {item.image_url && !imageError ? (
            <Image
              source={{ uri: item.image_url }}
              style={styles.image}
              onError={() => setImageError(true)}
            />
          ) : (
            <LinearGradient
              colors={['#f97316', '#f43f5e']}
              style={styles.imagePlaceholder}
            >
              <Feather name="image" size={24} color="#fff" />
            </LinearGradient>
          )}
        </View>

        {/* Content */}
        <View style={styles.content}>
          <View style={styles.header}>
            <View style={styles.titleContainer}>
              <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
              <View style={styles.badgeContainer}>
                <View style={[styles.statusBadge, { backgroundColor: `${getStatusColor()}20` }]}>
                  <Text style={[styles.statusText, { color: getStatusColor() }]}>
                    {getStatusText()}
                  </Text>
                </View>
                {item.is_popular && (
                  <View style={[styles.popularBadge]}>
                    <Feather name="star" size={10} color="#f59e0b" />
                    <Text style={styles.popularText}>Popular</Text>
                  </View>
                )}
              </View>
            </View>

            {/* Actions Menu */}
            <TouchableOpacity
              onPress={() => setShowActions(!showActions)}
              style={styles.menuButton}
            >
              <Feather name="more-vertical" size={20} color="#666" />
            </TouchableOpacity>
          </View>

          <Text style={styles.description} numberOfLines={2}>
            {item.description || 'No description'}
          </Text>

          {/* Price and Quantity */}
          <View style={styles.details}>
            <View style={styles.priceContainer}>
              <Text style={styles.price}>₦{item.price.toLocaleString()}</Text>
              {item.original_price && (
                <Text style={styles.originalPrice}>
                  ₦{item.original_price.toLocaleString()}
                </Text>
              )}
            </View>
            
            <TouchableOpacity
              onPress={() => setShowQuantityModal(true)}
              style={styles.quantityBadge}
            >
              <Feather name="package" size={12} color="#f97316" />
              <Text style={styles.quantityText}>
                Qty: {item.quantity_available ?? '∞'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Preparation Time */}
          {item.preparation_time && (
            <View style={styles.prepTime}>
              <Feather name="clock" size={12} color="#666" />
              <Text style={styles.prepTimeText}>{item.preparation_time}</Text>
            </View>
          )}
        </View>

        {/* Actions Dropdown */}
        {showActions && (
          <>
            <TouchableOpacity
              style={styles.overlay}
              onPress={() => setShowActions(false)}
              activeOpacity={1}
            />
            <View style={styles.actionsMenu}>
              <TouchableOpacity
                onPress={() => {
                  setShowActions(false);
                  onToggleAvailability();
                }}
                style={styles.actionItem}
              >
                <Feather
                  name={item.is_available ? 'eye-off' : 'eye'}
                  size={16}
                  color={item.is_available ? '#ef4444' : '#10b981'}
                />
                <Text style={styles.actionText}>
                  {item.is_available ? 'Mark Unavailable' : 'Mark Available'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  setShowActions(false);
                  onEdit();
                }}
                style={styles.actionItem}
              >
                <Feather name="edit-2" size={16} color="#f97316" />
                <Text style={styles.actionText}>Edit Item</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  setShowActions(false);
                  onDelete();
                }}
                style={[styles.actionItem, styles.deleteAction]}
              >
                <Feather name="trash-2" size={16} color="#ef4444" />
                <Text style={[styles.actionText, styles.deleteText]}>Delete Item</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>

      {/* Quantity Update Modal */}
      <Modal
        visible={showQuantityModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowQuantityModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Update Quantity</Text>
            <Text style={styles.modalSubtitle}>
              Set available quantity (0 = out of stock, leave empty for unlimited)
            </Text>

            <TextInput
              style={styles.quantityInput}
              value={quantity}
              onChangeText={setQuantity}
              keyboardType="numeric"
              placeholder="Enter quantity"
              placeholderTextColor="#666"
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                onPress={() => setShowQuantityModal(false)}
                style={[styles.modalButton, styles.cancelButton]}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleQuantityUpdate}
                style={[styles.modalButton, styles.saveButton]}
              >
                <LinearGradient
                  colors={['#f97316', '#f43f5e']}
                  style={styles.saveButtonGradient}
                >
                  <Text style={styles.saveButtonText}>Update</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    position: 'relative',
  },
  imageContainer: {
    width: 80,
    height: 80,
    borderRadius: 8,
    overflow: 'hidden',
    marginRight: 12,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  titleContainer: {
    flex: 1,
    marginRight: 8,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  badgeContainer: {
    flexDirection: 'row',
    gap: 4,
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  statusText: {
    fontSize: 9,
    fontWeight: '500',
  },
  popularBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245,158,11,0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    gap: 2,
  },
  popularText: {
    fontSize: 9,
    color: '#f59e0b',
  },
  menuButton: {
    padding: 4,
  },
  description: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
    lineHeight: 16,
  },
  details: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  price: {
    fontSize: 15,
    fontWeight: '700',
    color: '#f97316',
  },
  originalPrice: {
    fontSize: 11,
    color: '#666',
    textDecorationLine: 'line-through',
  },
  quantityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  quantityText: {
    fontSize: 11,
    color: '#f97316',
  },
  prepTime: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  prepTimeText: {
    fontSize: 10,
    color: '#666',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
  },
  actionsMenu: {
    position: 'absolute',
    top: 40,
    right: 10,
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    padding: 4,
    minWidth: 180,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 1000,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 8,
    borderRadius: 4,
  },
  actionText: {
    fontSize: 13,
    color: '#fff',
  },
  deleteAction: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  deleteText: {
    color: '#ef4444',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '80%',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#666',
    marginBottom: 16,
  },
  quantityInput: {
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    padding: 12,
    color: '#fff',
    fontSize: 16,
    marginBottom: 20,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    height: 44,
    borderRadius: 8,
    overflow: 'hidden',
  },
  cancelButton: {
    backgroundColor: '#2a2a2a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 14,
    fontWeight: '500',
  },
  saveButton: {
    overflow: 'hidden',
  },
  saveButtonGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});