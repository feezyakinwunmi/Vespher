// app/screens/vendor/VendorMenuScreen.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useVendorMenu } from '../../hooks/vendor/useVendorMenu';
import { MenuItemCard } from '../../components/vendor/MenuItemCard';
import { MenuItemForm } from '../../components/vendor/MenuItemForm';
import { TAB_BAR_SPACE } from '../../navigation/tabBarOptions';
import { TC } from '../../theme/palette';

export function VendorMenuScreen() {
  const navigation = useNavigation();
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'out_of_stock'>('all');
  const { vendorId } = useVendorMenu();

  const { 
    items, 
    isLoading, 
    refreshMenu,
    pendingCount,
    addMenuItem,
    updateMenuItem,
    deleteMenuItem,
    toggleAvailability,
    updateQuantity,
  } = useVendorMenu();

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshMenu();
    setRefreshing(false);
  };

  const handleAddItem = () => {
    setEditingItem(null);
    setShowForm(true);
  };

  const handleEditItem = (item: any) => {
    console.log('✏️ Editing item:', {
      id: item.id,
      name: item.name,
      image_url: item.image_url
    });
    setEditingItem(item);
    setShowForm(true);
  };

  const handleDeleteItem = (id: string) => {
    Alert.alert(
      'Delete item',
      'Are you sure you want to delete this menu item?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteMenuItem(id),
        },
      ]
    );
  };

  const handleToggleAvailability = (id: string, currentStatus: boolean) => {
    toggleAvailability(id, currentStatus);
  };

  const handleUpdateQuantity = (id: string, quantity: number) => {
    updateQuantity(id, quantity);
  };

  const handleFormSubmit = async (data: any) => {
    if (editingItem) {
      await updateMenuItem(editingItem.id, data);
    } else {
      await addMenuItem(data);
    }
    setShowForm(false);
    setEditingItem(null);
  };

  // Calculate counts for filters
  const approvedCount = items.filter(i => i.approval_status === 'approved').length;
  const outOfStockCount = items.filter(i => 
    i.track_stock && (i.stock_quantity || i.quantity_available || 0) <= 0
  ).length;

  const filteredItems = items.filter(item => {
    if (filter === 'all') return true;
    if (filter === 'pending') return item.approval_status === 'pending';
    if (filter === 'approved') return item.approval_status === 'approved';
    if (filter === 'out_of_stock') {
      return item.track_stock && (item.stock_quantity || item.quantity_available || 0) <= 0;
    }
    return true;
  });

  if (isLoading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#f97316" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color={TC.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Menu management</Text>
        <TouchableOpacity onPress={handleAddItem} style={styles.addButton}>
          <Feather name="plus" size={24} color="#f97316" />
        </TouchableOpacity>
      </View>

      {/* Stats Summary */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{items.length}</Text>
          <Text style={styles.statLabel}>Total items</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statNumber, { color: '#f59e0b' }]}>{pendingCount}</Text>
          <Text style={styles.statLabel}>Pending</Text>
        </View>
        <View style={[styles.statCard, outOfStockCount > 0 && { backgroundColor: '#ef444420' }]}>
          <Text style={[styles.statNumber, { color: outOfStockCount > 0 ? '#ef4444' : TC.muted }]}>
            {outOfStockCount}
          </Text>
          <Text style={styles.statLabel}>Out of stock</Text>
        </View>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.filterTabs}>
            <TouchableOpacity
              onPress={() => setFilter('all')}
              style={[styles.filterTab, filter === 'all' && styles.activeFilterTab]}
            >
              <Text style={[styles.filterText, filter === 'all' && styles.activeFilterText]}>
                All ({items.length})
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              onPress={() => setFilter('pending')}
              style={[styles.filterTab, filter === 'pending' && styles.activeFilterTab]}
            >
              <Text style={[styles.filterText, filter === 'pending' && styles.activeFilterText]}>
                Pending ({pendingCount})
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              onPress={() => setFilter('approved')}
              style={[styles.filterTab, filter === 'approved' && styles.activeFilterTab]}
            >
              <Text style={[styles.filterText, filter === 'approved' && styles.activeFilterText]}>
                Approved ({approvedCount})
              </Text>
            </TouchableOpacity>
            
            {/* NEW: Out of Stock Filter Tab */}
            <TouchableOpacity
              onPress={() => setFilter('out_of_stock')}
              style={[
                styles.filterTab, 
                filter === 'out_of_stock' && styles.activeFilterTab,
                outOfStockCount > 0 && styles.outOfStockTab
              ]}
            >
              <Feather 
                name="alert-triangle" 
                size={12} 
                color={filter === 'out_of_stock' ? '#fff' : outOfStockCount > 0 ? '#ef4444' : TC.muted} 
              />
              <Text style={[
                styles.filterText, 
                filter === 'out_of_stock' && styles.activeFilterText,
                outOfStockCount > 0 && !(filter === 'out_of_stock') && { color: '#ef4444' }
              ]}>
                Out of Stock ({outOfStockCount})
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>

      {/* Menu Items List */}
      <ScrollView contentContainerStyle={{ paddingBottom: TAB_BAR_SPACE }}
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#f97316" />
        }
      >
        {filteredItems.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconContainer}>
              <Feather name="coffee" size={40} color={TC.muted} />
            </View>
            <Text style={styles.emptyTitle}>No menu items</Text>
            <Text style={styles.emptyText}>
              {filter === 'pending' 
                ? 'No items pending approval' 
                : filter === 'approved'
                ? 'No approved items yet'
                : filter === 'out_of_stock'
                ? 'No out of stock items'
                : 'Add your first menu item to get started'}
            </Text>
            <TouchableOpacity onPress={handleAddItem} style={styles.emptyButton}>
              <View style={[styles.emptyButtonGradient, { backgroundColor: '#ea580c' }]}>
                <Text style={styles.emptyButtonText}>Add menu item</Text>
              </View>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.itemsList}>
            {filteredItems.map((item) => (
              <MenuItemCard
                key={item.id}
                item={item}
                onEdit={() => handleEditItem(item)}
                onDelete={() => handleDeleteItem(item.id)}
                onToggleAvailability={() => handleToggleAvailability(item.id, item.is_available)}
                onUpdateQuantity={(quantity) => handleUpdateQuantity(item.id, quantity)}
              />
            ))}
          </View>
        )}
        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* Menu Item Form Modal */}
      <Modal
        visible={showForm}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowForm(false)}
      >
        <MenuItemForm
          onClose={() => {
            setShowForm(false);
            setEditingItem(null);
          }}
          onSubmit={handleFormSubmit}
          initialData={editingItem}
          vendorId={vendorId}
        />
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: TC.bg,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: TC.bg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: TC.hairline,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: TC.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: TC.text,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: TC.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statsContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: TC.surface,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '600',
    color: TC.text,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 11,
    color: TC.muted,
  },
  filterContainer: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  filterTabs: {
    flexDirection: 'row',
    gap: 8,
  },
  filterTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: TC.surface,
    borderRadius: 20,
    marginRight: 8,
    gap: 6,
  },
  activeFilterTab: {
    backgroundColor: '#ea580c',
  },
  outOfStockTab: {
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  filterText: {
    fontSize: 13,
    color: TC.muted,
  },
  activeFilterText: {
    color: '#fff',
  },
  content: {
    flex: 1,
  },
  itemsList: {
    padding: 16,
    gap: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: TC.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: TC.text,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: TC.muted,
    textAlign: 'center',
    marginBottom: 20,
  },
  emptyButton: {
    width: '100%',
    height: 48,
    borderRadius: 12,
    overflow: 'hidden',
  },
  emptyButtonGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  bottomPadding: {
    height: 20,
  },
});