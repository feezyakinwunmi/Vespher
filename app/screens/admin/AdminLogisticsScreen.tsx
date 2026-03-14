// app/screens/admin/AdminLogisticsScreen.tsx
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Modal,
  Alert,
  Image,
  Dimensions,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import Toast from 'react-native-toast-message';
import { WebView } from 'react-native-webview';
type AdminLogisticsScreenNavigationProp = NativeStackNavigationProp<RootStackParamList>;

const { width, height } = Dimensions.get('window');

type RiderStatus = 'all' | 'available' | 'busy' | 'suspended';

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
}

interface UserRecord {
  id: string;
  role: string;
  is_available: boolean;
  is_suspended: boolean;
  current_latitude?: string | number;
  current_longitude?: string | number;
  name?: string;
  email?: string;
  phone?: string;
  avatar_url?: string;
  vehicle_type?: string;
  vehicle_number?: string;
  license_number?: string;
  rating?: number;
  last_location_update?: string;
  created_at?: string;
}

interface Rider {
  is_busy: any;
  id: string;
  name: string;
  email: string;
  phone: string;
  avatar_url?: string;
  role: 'rider';
  vehicle_type: string;
  vehicle_number: string;
  license_number?: string;
  is_available: boolean;
  is_suspended: boolean;
  total_deliveries: number;
  rating: number;
  current_latitude?: number;
  current_longitude?: number;
  last_location_update?: string;
  created_at: string;
  active_order_count?: number;
  delivery_status?: 'available' | 'busy' | 'suspended';
}

export function AdminLogisticsScreen() {
  const navigation = useNavigation<AdminLogisticsScreenNavigationProp>();
const mapRef = useRef<any>(null);  
  const [riders, setRiders] = useState<Rider[]>([]);
  const [filteredRiders, setFilteredRiders] = useState<Rider[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<RiderStatus>('all');
  const [vehicleFilter, setVehicleFilter] = useState<string>('all');
  const [showMap, setShowMap] = useState(false);
  const [selectedRider, setSelectedRider] = useState<Rider | null>(null);
  const [showActionsModal, setShowActionsModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
   const showToast = (message: string) => {
    Toast.show({
      type: 'success',
      text1: message,
      position: 'bottom',
      visibilityTime: 2000,
    });
  };
  const [confirmAction, setConfirmAction] = useState<{
    type: 'suspend' | 'unsuspend' | 'delete';
    rider: Rider;
  } | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapRegion, setMapRegion] = useState({
    latitude: 6.5244,
    longitude: 3.3792,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  });

  const vehicleTypes = ['all', 'motorcycle', 'bicycle', 'car', 'van', 'truck'];

  useEffect(() => {
    fetchRiders();
    subscribeToRiderLocations();
  }, []);

  useEffect(() => {
    filterRiders();
  }, [riders, searchQuery, statusFilter, vehicleFilter]);

  useEffect(() => {
    if (showMap && mapReady && filteredRiders.length > 0) {
      const ridersWithLocation = filteredRiders.filter(
        r => r.current_latitude && r.current_longitude && !r.is_suspended
      );
      if (ridersWithLocation.length > 0) {
        setTimeout(() => fitMapToRiders(ridersWithLocation), 500);
      }
    }
  }, [showMap, mapReady, filteredRiders]);

  const fetchRiders = async () => {
    try {
      setIsLoading(true);
      
      const { data: ridersData, error: ridersError } = await supabase
        .from('users')
        .select('*')
        .eq('role', 'rider')
        .order('created_at', { ascending: false });

      if (ridersError) throw ridersError;

      if (!ridersData || ridersData.length === 0) {
        setRiders([]);
        return;
      }

      const riderIds = ridersData.map(r => r.id);

      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select('rider_id, status')
        .in('rider_id', riderIds);

      if (ordersError) throw ordersError;

      const riderStats = new Map();
      
      ordersData?.forEach(order => {
        if (!riderStats.has(order.rider_id)) {
          riderStats.set(order.rider_id, {
            total_deliveries: 0,
            active_orders: 0,
          });
        }
        
        const stats = riderStats.get(order.rider_id);
        stats.total_deliveries += 1;
        
        if (order.status !== 'delivered' && order.status !== 'cancelled') {
          stats.active_orders += 1;
        }
      });

      const ridersWithStats = ridersData.map(rider => {
        const stats = riderStats.get(rider.id) || { total_deliveries: 0, active_orders: 0 };
        const isBusy = stats.active_orders > 0;
        
        return {
          ...rider,
          current_latitude: rider.current_latitude ? Number(rider.current_latitude) : undefined,
          current_longitude: rider.current_longitude ? Number(rider.current_longitude) : undefined,
          total_deliveries: stats.total_deliveries,
          is_available: rider.is_available && !isBusy && !rider.is_suspended,
          active_order_count: stats.active_orders,
        };
      });

      setRiders(ridersWithStats);

    } catch (error) {
      console.error('Error fetching riders:', error);
      showToast('Failed to load riders');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  const subscribeToRiderLocations = () => {
    const locationSubscription = supabase
      .channel('rider-locations')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'users',
          filter: 'role=eq.rider',
        },
        async (payload: any) => {
          if (!payload.new?.id) return;
          
          const { data: activeOrders } = await supabase
            .from('orders')
            .select('id, status')
            .eq('rider_id', payload.new.id)
            .not('status', 'in', '("delivered","cancelled")');

          const hasActiveOrders = activeOrders && activeOrders.length > 0;

          setRiders(currentRiders => 
            currentRiders.map(rider => 
              rider.id === payload.new.id 
                ? { 
                    ...rider, 
                    ...payload.new,
                    current_latitude: payload.new.current_latitude ? Number(payload.new.current_latitude) : undefined,
                    current_longitude: payload.new.current_longitude ? Number(payload.new.current_longitude) : undefined,
                    is_available: payload.new.is_available && !hasActiveOrders && !payload.new.is_suspended,
                    active_order_count: activeOrders?.length || 0,
                  }
                : rider
            )
          );
        }
      )
      .subscribe();

    const orderSubscription = supabase
      .channel('rider-orders')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
        },
        async (payload: any) => {
          const riderId = payload.new?.rider_id || payload.old?.rider_id;
          
          if (!riderId) return;
          
          const { data: orders } = await supabase
            .from('orders')
            .select('id, status')
            .eq('rider_id', riderId);

          const activeOrders = orders?.filter(o => 
            o.status !== 'delivered' && o.status !== 'cancelled'
          ) || [];

          const totalDeliveries = orders?.length || 0;

          setRiders(currentRiders => 
            currentRiders.map(rider => 
              rider.id === riderId
                ? {
                    ...rider,
                    total_deliveries: totalDeliveries,
                    active_order_count: activeOrders.length,
                    is_available: rider.is_available && activeOrders.length === 0 && !rider.is_suspended,
                  }
                : rider
            )
          );
        }
      )
      .subscribe();

    return () => {
      locationSubscription.unsubscribe();
      orderSubscription.unsubscribe();
    };
  };

  const fitMapToRiders = (ridersToFit: Rider[]) => {

    const coordinates = ridersToFit
      .filter(r => r.current_latitude && r.current_longitude)
      .map(r => ({
        latitude: r.current_latitude!,
        longitude: r.current_longitude!,
      }));

    
  };



  const filterRiders = () => {
    let filtered = [...riders];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(r => 
        r.name?.toLowerCase().includes(query) ||
        r.email?.toLowerCase().includes(query) ||
        r.phone?.toLowerCase().includes(query) ||
        r.vehicle_number?.toLowerCase().includes(query)
      );
    }

    if (statusFilter !== 'all') {
      if (statusFilter === 'available') {
        filtered = filtered.filter(r => r.is_available && !r.is_suspended);
      } else if (statusFilter === 'busy') {
        filtered = filtered.filter(r => !r.is_available && !r.is_suspended);
      } else if (statusFilter === 'suspended') {
        filtered = filtered.filter(r => r.is_suspended);
      }
    }

    if (vehicleFilter !== 'all') {
      filtered = filtered.filter(r => r.vehicle_type === vehicleFilter);
    }

    setFilteredRiders(filtered);
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchRiders();
  };

  const handleAction = (rider: Rider, actionType: 'suspend' | 'unsuspend' | 'delete') => {
    setSelectedRider(rider);
    setConfirmAction({ type: actionType, rider });
    setShowActionsModal(false);
    setShowConfirmModal(true);
  };

  const executeAction = async () => {
    if (!confirmAction) return;

    const { type, rider } = confirmAction;

    try {
      if (type === 'delete') {
        const { error } = await supabase
          .from('users')
          .delete()
          .eq('id', rider.id);

        if (error) throw error;
        showToast( 'Rider deleted successfully');
      } else {
        const { error } = await supabase
          .from('users')
          .update({ is_suspended: type === 'suspend' })
          .eq('id', rider.id);

        if (error) throw error;
        showToast( `Rider ${type === 'suspend' ? 'suspended' : 'unsuspended'} successfully`);
      }

      fetchRiders();
    } catch (error) {
      console.error('Error:', error);
      showToast(`Failed to ${type} rider`);
    } finally {
      setShowConfirmModal(false);
      setConfirmAction(null);
      setSelectedRider(null);
    }
  };

  const getStatusColor = (rider: Rider) => {
    if (rider.is_suspended) return '#ef4444';
    if (!rider.is_available || (rider.active_order_count && rider.active_order_count > 0)) return '#f59e0b';
    return '#10b981';
  };

  const getStatusText = (rider: Rider) => {
    if (rider.is_suspended) return 'Suspended';
    if (!rider.is_available || (rider.active_order_count && rider.active_order_count > 0)) {
      return `Busy (${rider.active_order_count || 1} order${rider.active_order_count !== 1 ? 's' : ''})`;
    }
    return 'Available';
  };

  const getMarkerIcon = (type: string): keyof typeof Feather.glyphMap => {
    switch (type?.toLowerCase()) {
      case 'motorcycle':
      case 'bicycle':
      case 'scooter':
        return 'truck';
      case 'car':
      case 'van':
      case 'truck':
        return 'package';
      default:
        return 'map-pin';
    }
  };

  if (isLoading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#f97316" />
        <Text style={styles.loadingText}>Loading logistics...</Text>
      </View>
    );
  }

  // Calculate stats for display
  const availableRiders = riders.filter(r => r.is_available && !r.is_suspended && (!r.active_order_count || r.active_order_count === 0)).length;
  const busyRiders = riders.filter(r => !r.is_suspended && (!r.is_available || (r.active_order_count && r.active_order_count > 0))).length;
  const suspendedRiders = riders.filter(r => r.is_suspended).length;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Logistics Management</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity 
            onPress={() => navigation.navigate('AdminCreateLogistic')} 
            style={styles.createButton}
          >
            <Feather name="user-plus" size={20} color="#f97316" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowMap(!showMap)} style={styles.mapToggle}>
            <Feather name={showMap ? 'list' : 'map'} size={20} color="#f97316" />
          </TouchableOpacity>
          <TouchableOpacity onPress={fetchRiders} style={styles.refreshButton}>
            <Feather name="refresh-cw" size={20} color="#f97316" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Stats Cards */}
      <View style={styles.statsContainer}>
        <LinearGradient
          colors={['#f97316', '#f43f5e']}
          style={styles.statCard}
        >
          <Text style={styles.statLabel}>Total Riders</Text>
          <Text style={styles.statValue}>{riders.length}</Text>
        </LinearGradient>

        <View style={styles.statRow}>
          <View style={styles.statCardSecondary}>
            <Feather name="truck" size={20} color="#10b981" />
            <Text style={styles.statNumber}>{availableRiders}</Text>
            <Text style={styles.statLabelSmall}>Available</Text>
          </View>

          <View style={styles.statCardSecondary}>
            <Feather name="clock" size={20} color="#f59e0b" />
            <Text style={styles.statNumber}>{busyRiders}</Text>
            <Text style={styles.statLabelSmall}>Busy</Text>
          </View>

          <View style={styles.statCardSecondary}>
            <Feather name="alert-circle" size={20} color="#ef4444" />
            <Text style={styles.statNumber}>{suspendedRiders}</Text>
            <Text style={styles.statLabelSmall}>Suspended</Text>
          </View>
        </View>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Feather name="search" size={18} color="#666" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search by name, email, phone, vehicle..."
          placeholderTextColor="#666"
        />
        {searchQuery ? (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Feather name="x" size={18} color="#666" />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Filter Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterTabs}>
        <View style={styles.filterContent}>
          {/* Status Filters */}
          <TouchableOpacity
            onPress={() => setStatusFilter('all')}
            style={[
              styles.filterChip,
              statusFilter === 'all' && styles.filterChipActive,
            ]}
          >
            <Text style={[
              styles.filterChipText,
              statusFilter === 'all' && styles.filterChipTextActive,
            ]}>All</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setStatusFilter('available')}
            style={[
              styles.filterChip,
              statusFilter === 'available' && styles.filterChipActive,
            ]}
          >
            <View style={[styles.statusDot, { backgroundColor: '#10b981' }]} />
            <Text style={[
              styles.filterChipText,
              statusFilter === 'available' && styles.filterChipTextActive,
            ]}>Available</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setStatusFilter('busy')}
            style={[
              styles.filterChip,
              statusFilter === 'busy' && styles.filterChipActive,
            ]}
          >
            <View style={[styles.statusDot, { backgroundColor: '#f59e0b' }]} />
            <Text style={[
              styles.filterChipText,
              statusFilter === 'busy' && styles.filterChipTextActive,
            ]}>Busy</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setStatusFilter('suspended')}
            style={[
              styles.filterChip,
              statusFilter === 'suspended' && styles.filterChipActive,
            ]}
          >
            <View style={[styles.statusDot, { backgroundColor: '#ef4444' }]} />
            <Text style={[
              styles.filterChipText,
              statusFilter === 'suspended' && styles.filterChipTextActive,
            ]}>Suspended</Text>
          </TouchableOpacity>

          <View style={styles.filterDivider} />

          {/* Vehicle Filters */}
          {vehicleTypes.map(type => (
            <TouchableOpacity
              key={type}
              onPress={() => setVehicleFilter(type)}
              style={[
                styles.filterChip,
                vehicleFilter === type && styles.filterChipActive,
              ]}
            >
              <Feather 
                name={type === 'all' ? 'grid' : 'package'} 
                size={12} 
                color={vehicleFilter === type ? '#f97316' : '#666'} 
              />
              <Text style={[
                styles.filterChipText,
                vehicleFilter === type && styles.filterChipTextActive,
              ]}>
                {type === 'all' ? 'All' : type.charAt(0).toUpperCase() + type.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* Results Count */}
      <View style={styles.resultsContainer}>
        <Text style={styles.resultsText}>
          Showing {filteredRiders.length} of {riders.length} riders
        </Text>
      </View>

      {/* Map View */}
      {showMap ? (
        <View style={styles.mapContainer}>
  <WebView
  ref={mapRef}
  originWhitelist={['*']}
  style={styles.map}
  source={{
    html: `
<!DOCTYPE html>
<html>
<head>

<meta name="viewport" content="width=device-width, initial-scale=1.0">

<link rel="stylesheet"
href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>

<style>
html,body{margin:0;padding:0}
#map{height:100vh;width:100vw}
</style>

</head>

<body>

<div id="map"></div>

<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>

<script>

// rider icons based on status

var availableIcon = new L.Icon({
  iconUrl: 'https://maps.google.com/mapfiles/ms/icons/green-dot.png',
  iconSize: [40,40],
  iconAnchor: [20,40]
});

var busyIcon = new L.Icon({
  iconUrl: 'https://maps.google.com/mapfiles/ms/icons/orange-dot.png',
  iconSize: [40,40],
  iconAnchor: [20,40]
});

var suspendedIcon = new L.Icon({
  iconUrl: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png',
  iconSize: [40,40],
  iconAnchor: [20,40]
});

var map = L.map('map').setView([6.5244,3.3792],12);

L.tileLayer(
'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
{ attribution:'© OpenStreetMap' }
).addTo(map);

var riders = ${JSON.stringify(
  filteredRiders
    .filter(r => r.current_latitude && r.current_longitude && !r.is_suspended)
.map(r => ({
  id: r.id,
  name: r.name,
  lat: r.current_latitude,
  lng: r.current_longitude,
  vehicle: r.vehicle_type,
  deliveries: r.total_deliveries,
  rating: r.rating,
  phone: r.phone,
  suspended: r.is_suspended,
  busy: r.is_busy
}))
)};

var bounds = [];

riders.forEach(function(r){

var icon;

if(r.suspended){
  icon = suspendedIcon;
}
else if(r.busy){
  icon = busyIcon;
}
else{
  icon = availableIcon;
}

var marker = L.marker(
  [r.lat,r.lng],
  {icon: icon}
).addTo(map);



var status = r.suspended
  ? "Suspended"
  : r.busy
  ? "Busy"
  : "Available";

marker.bindPopup(
"<b>"+r.name+"</b><br>"+
"Status: "+status+"<br>"+
"Vehicle: "+(r.vehicle || "N/A")+"<br>"+
"Deliveries: "+r.deliveries+"<br>"+
"Rating: "+(r.rating || 0)
);



marker.bindPopup(
"<b>"+r.name+"</b><br>"+
"Vehicle: "+(r.vehicle || "N/A")+"<br>"+
"Deliveries: "+r.deliveries+"<br>"+
"Rating: "+(r.rating || 0)
);

bounds.push([r.lat,r.lng]);

});

if(bounds.length>0){
map.fitBounds(bounds);
}

</script>

</body>
</html>
`
  }}
/>

         

          {/* Map Legend */}
          <View style={styles.mapLegend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#10b981' }]} />
              <Text style={styles.legendText}>Available</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#f59e0b' }]} />
              <Text style={styles.legendText}>Busy</Text>
            </View>
          </View>

          {/* Map Status */}
          <View style={styles.mapStatus}>
            <Text style={styles.mapStatusText}>
              {filteredRiders.filter(r => r.current_latitude && r.current_longitude && !r.is_suspended).length} active riders on map
            </Text>
          </View>

          {/* No Location Overlay */}
          {filteredRiders.filter(r => r.current_latitude && r.current_longitude && !r.is_suspended).length === 0 && (
            <View style={styles.noLocationOverlay}>
              <View style={styles.noLocationCard}>
                <Feather name="map-pin" size={40} color="#f97316" />
                <Text style={styles.noLocationTitle}>No Rider Locations</Text>
                <Text style={styles.noLocationText}>
                  Riders need to share their location to appear on the map.
                </Text>
                <TouchableOpacity 
                  style={styles.refreshLocationButton}
                  onPress={fetchRiders}
                >
                  <Feather name="refresh-cw" size={16} color="#fff" />
                  <Text style={styles.refreshLocationText}>Refresh</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      ) : (
        /* List View */
        <ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#f97316" />
          }
        >
          {filteredRiders.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Feather name="truck" size={48} color="#666" />
              <Text style={styles.emptyTitle}>No riders found</Text>
              <Text style={styles.emptyText}>Try adjusting your filters</Text>
            </View>
          ) : (
            filteredRiders.map((rider) => (
              <TouchableOpacity
                key={rider.id}
                style={styles.riderCard}
                onPress={() => {
                  setSelectedRider(rider);
                  setShowActionsModal(true);
                }}
              >
                <View style={styles.cardHeader}>
                  <View style={styles.userInfo}>
                    <View style={styles.avatarContainer}>
                      {rider.avatar_url ? (
                        <Image source={{ uri: rider.avatar_url }} style={styles.avatar} />
                      ) : (
                        <LinearGradient
                          colors={['#f97316', '#f43f5e']}
                          style={styles.avatarPlaceholder}
                        >
                          <Text style={styles.avatarText}>
                            {rider.name?.charAt(0).toUpperCase() || '?'}
                          </Text>
                        </LinearGradient>
                      )}
                    </View>
                    <View style={styles.userInfoText}>
                      <Text style={styles.userName}>{rider.name}</Text>
                      <Text style={styles.userEmail}>{rider.email}</Text>
                    </View>
                  </View>

                  <View style={[
                    styles.statusBadge,
                    { backgroundColor: getStatusColor(rider) + '20' }
                  ]}>
                    <View style={[styles.statusDot, { backgroundColor: getStatusColor(rider) }]} />
                    <Text style={[styles.statusText, { color: getStatusColor(rider) }]}>
                      {getStatusText(rider)}
                    </Text>
                  </View>
                </View>

                <View style={styles.riderDetails}>
                  <View style={styles.detailRow}>
                    <Feather name="phone" size={14} color="#666" />
                    <Text style={styles.detailText}>{rider.phone || 'No phone'}</Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Feather name="package" size={14} color="#666" />
                    <Text style={styles.detailText}>
                      {rider.vehicle_type ? rider.vehicle_type.charAt(0).toUpperCase() + rider.vehicle_type.slice(1) : 'N/A'} • {rider.vehicle_number || 'N/A'}
                    </Text>
                  </View>

                  {rider.license_number && (
                    <View style={styles.detailRow}>
                      <Feather name="file-text" size={14} color="#666" />
                      <Text style={styles.detailText}>License: {rider.license_number}</Text>
                    </View>
                  )}

                  <View style={styles.statsRow}>
                    <View style={styles.statItem}>
                      <Feather name="package" size={14} color="#f97316" />
                      <Text style={styles.statItemText}>{rider.total_deliveries || 0} deliveries</Text>
                    </View>
                    <View style={styles.statItem}>
                      <Feather name="star" size={14} color="#fbbf24" />
                      <Text style={styles.statItemText}>{rider.rating?.toFixed(1) || '0.0'}</Text>
                    </View>
                  </View>

                  {rider.current_latitude && rider.current_longitude && (
                    <TouchableOpacity 
                      style={styles.locationRow}
                      onPress={() => {
                        setShowMap(true);
                      }}
                    >
                      <Feather name="map-pin" size={12} color="#10b981" />
                      <Text style={styles.locationText}>View on map</Text>
                      {rider.last_location_update && (
                        <Text style={styles.locationTime}>
                          • {new Date(rider.last_location_update).toLocaleTimeString()}
                        </Text>
                      )}
                    </TouchableOpacity>
                  )}
                </View>

                <View style={styles.cardFooter}>
                  <Text style={styles.joinDate}>
                    Joined: {rider.created_at ? new Date(rider.created_at).toLocaleDateString() : 'N/A'}
                  </Text>
                </View>
              </TouchableOpacity>
            ))
          )}
          <View style={styles.bottomPadding} />
        </ScrollView>
      )}

      {/* Actions Modal */}
      <Modal
        visible={showActionsModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowActionsModal(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowActionsModal(false)}
        >
          <View style={styles.actionsModal}>
            {selectedRider && (
              <>
                {!selectedRider.is_suspended ? (
                  <TouchableOpacity
                    style={styles.actionItem}
                    onPress={() => handleAction(selectedRider, 'suspend')}
                  >
                    <Feather name="pause-circle" size={18} color="#f59e0b" />
                    <Text style={styles.actionText}>Suspend Rider</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={styles.actionItem}
                    onPress={() => handleAction(selectedRider, 'unsuspend')}
                  >
                    <Feather name="play-circle" size={18} color="#10b981" />
                    <Text style={styles.actionText}>Unsuspend Rider</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={[styles.actionItem, styles.actionItemDelete]}
                  onPress={() => handleAction(selectedRider, 'delete')}
                >
                  <Feather name="trash-2" size={18} color="#ef4444" />
                  <Text style={[styles.actionText, styles.actionTextDelete]}>Delete Rider</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Confirmation Modal */}
      <Modal
        visible={showConfirmModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowConfirmModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.confirmModal}>
            <View style={styles.confirmIcon}>
              <Feather name="alert-triangle" size={40} color="#f97316" />
            </View>
            
            <Text style={styles.confirmTitle}>Confirm Action</Text>
            <Text style={styles.confirmMessage}>
              {confirmAction?.type === 'suspend' && `Are you sure you want to suspend ${confirmAction.rider.name}?`}
              {confirmAction?.type === 'unsuspend' && `Are you sure you want to unsuspend ${confirmAction.rider.name}?`}
              {confirmAction?.type === 'delete' && `Are you sure you want to delete ${confirmAction.rider.name}? This action cannot be undone.`}
            </Text>

            <View style={styles.confirmActions}>
              <TouchableOpacity
                style={[styles.confirmButton, styles.cancelButton]}
                onPress={() => {
                  setShowConfirmModal(false);
                  setConfirmAction(null);
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.confirmButton,
                  confirmAction?.type === 'suspend' ? styles.suspendConfirmButton :
                  confirmAction?.type === 'unsuspend' ? styles.unsuspendConfirmButton :
                  styles.deleteConfirmButton
                ]}
                onPress={executeAction}
              >
                <Text style={styles.confirmButtonText}>
                  {confirmAction?.type === 'suspend' ? 'Suspend' :
                   confirmAction?.type === 'unsuspend' ? 'Unsuspend' : 'Delete'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
        paddingBottom:90,

  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#666',
    marginTop: 12,
    fontSize: 14,
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
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  createButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapToggle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  refreshButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statsContainer: {
    padding: 16,
  },
  statCard: {
    width: '100%',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  statRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statCardSecondary: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  statLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
  },
  statNumber: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginTop: 4,
    marginBottom: 2,
  },
  statLabelSmall: {
    fontSize: 10,
    color: '#666',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    height: 44,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
  },
  filterTabs: {
    maxHeight: 50,
    marginBottom: 12,
  },
  filterContent: {
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    gap: 4,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  filterChipActive: {
    backgroundColor: 'rgba(249,115,22,0.1)',
    borderColor: '#f97316',
  },
  filterChipText: {
    fontSize: 12,
    color: '#666',
  },
  filterChipTextActive: {
    color: '#f97316',
  },
  filterDivider: {
    width: 1,
    height: 20,
    backgroundColor: '#2a2a2a',
    marginHorizontal: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  resultsContainer: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  resultsText: {
    fontSize: 12,
    color: '#666',
  },
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  map: {
    flex: 1,
  },
  markerContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  calloutContainer: {
    width: 240,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  calloutHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  calloutAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 8,
  },
  calloutAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  calloutAvatarText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  calloutInfo: {
    flex: 1,
  },
  calloutName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 2,
  },
  calloutVehicle: {
    fontSize: 11,
    color: '#f97316',
  },
  calloutDetails: {
    gap: 4,
    marginBottom: 8,
  },
  calloutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  calloutText: {
    fontSize: 11,
    color: '#666',
  },
  calloutFooter: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
    paddingTop: 8,
    alignItems: 'center',
  },
  calloutAction: {
    fontSize: 10,
    color: '#f97316',
  },
  mapControls: {
    position: 'absolute',
    top: 16,
    right: 16,
  },
  mapControlButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  mapLegend: {
    position: 'absolute',
    bottom: 80,
    right: 16,
    backgroundColor: '#1a1a1a',
    padding: 12,
    borderRadius: 8,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontSize: 11,
    color: '#fff',
  },
  mapStatus: {
    position: 'absolute',
    bottom: 20,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 8,
    borderRadius: 8,
  },
  mapStatusText: {
    color: '#fff',
    fontSize: 12,
    textAlign: 'center',
  },
  noLocationOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  noLocationCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    width: '90%',
    maxWidth: 320,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  noLocationTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginTop: 12,
    marginBottom: 8,
  },
  noLocationText: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
    marginBottom: 16,
  },
  refreshLocationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f97316',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 8,
  },
  refreshLocationText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#fff',
  },
  content: {
    flex: 1,
  },
  riderCard: {
    backgroundColor: '#1a1a1a',
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  userInfoText: {
    flex: 1,
  },
  avatarContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  avatarPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  userName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 2,
  },
  userEmail: {
    fontSize: 11,
    color: '#666',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
  },
  riderDetails: {
    marginBottom: 12,
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailText: {
    fontSize: 13,
    color: '#666',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 4,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statItemText: {
    fontSize: 12,
    color: '#f97316',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  locationText: {
    fontSize: 11,
    color: '#10b981',
    textDecorationLine: 'underline',
  },
  locationTime: {
    fontSize: 9,
    color: '#666',
  },
  cardFooter: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  joinDate: {
    fontSize: 10,
    color: '#666',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginTop: 16,
    marginBottom: 4,
  },
  emptyText: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
  },
  bottomPadding: {
    height: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionsModal: {
    width: '80%',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 8,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  actionItemDelete: {
    borderBottomWidth: 0,
  },
  actionText: {
    fontSize: 14,
    color: '#fff',
  },
  actionTextDelete: {
    color: '#ef4444',
  },
  confirmModal: {
    width: '80%',
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
  },
  confirmIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(249,115,22,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  confirmTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  confirmMessage: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  confirmActions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  confirmButton: {
    flex: 1,
    height: 44,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#2a2a2a',
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 14,
    fontWeight: '500',
  },
  suspendConfirmButton: {
    backgroundColor: '#f59e0b',
  },
  unsuspendConfirmButton: {
    backgroundColor: '#10b981',
  },
  deleteConfirmButton: {
    backgroundColor: '#ef4444',
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});