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
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { useVendorMenu } from '../../hooks/vendor/useVendorMenu';
import { MenuItemCard } from '../../components/vendor/MenuItemCard';
import { MenuItemForm } from '../../components/vendor/MenuItemForm';

export function VendorMenuScreen() {
  const navigation = useNavigation();
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved'>('all');

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
    setEditingItem(item);
    setShowForm(true);
  };

  const handleDeleteItem = (id: string) => {
    Alert.alert(
      'Delete Item',
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

  const filteredItems = items.filter(item => {
    if (filter === 'all') return true;
    if (filter === 'pending') return item.approval_status === 'pending';
    if (filter === 'approved') return item.approval_status === 'approved';
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
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Menu Management</Text>
        <TouchableOpacity onPress={handleAddItem} style={styles.addButton}>
          <Feather name="plus" size={24} color="#f97316" />
        </TouchableOpacity>
      </View>

      {/* Stats Summary */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{items.length}</Text>
          <Text style={styles.statLabel}>Total Items</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statNumber, { color: '#f59e0b' }]}>{pendingCount}</Text>
          <Text style={styles.statLabel}>Pending</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statNumber, { color: '#10b981' }]}>
            {items.filter(i => i.quantity_available === 0).length}
          </Text>
          <Text style={styles.statLabel}>Out of Stock</Text>
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
                Approved ({items.filter(i => i.approval_status === 'approved').length})
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>

      {/* Menu Items List */}
      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#f97316" />
        }
      >
        {filteredItems.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconContainer}>
              <Feather name="coffee" size={40} color="#666" />
            </View>
            <Text style={styles.emptyTitle}>No menu items</Text>
            <Text style={styles.emptyText}>
              {filter === 'pending' 
                ? 'No items pending approval' 
                : filter === 'approved'
                ? 'No approved items yet'
                : 'Add your first menu item to get started'}
            </Text>
            <TouchableOpacity onPress={handleAddItem} style={styles.emptyButton}>
              <LinearGradient
                colors={['#f97316', '#f43f5e']}
                style={styles.emptyButtonGradient}
              >
                <Text style={styles.emptyButtonText}>Add Menu Item</Text>
              </LinearGradient>
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
        />
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0a0a0a',
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
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1a1a1a',
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
    backgroundColor: '#1a1a1a',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 11,
    color: '#666',
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
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    marginRight: 8,
  },
  activeFilterTab: {
    backgroundColor: '#f97316',
  },
  filterText: {
    fontSize: 13,
    color: '#666',
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
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#666',
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