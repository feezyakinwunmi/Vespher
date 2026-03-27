// app/screens/common/ComplaintsScreen.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import Toast from 'react-native-toast-message';

interface Complaint {
  id: string;
  user_id: string;
  user_name: string;
  user_role: string;
  order_id?: string;
  vendor_id?: string;
  title: string;
  description: string;
  status: 'pending' | 'resolved' | 'rejected';
  admin_response?: string;
  created_at: string;
  resolved_at?: string;
}

export function ComplaintsScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [orderId, setOrderId] = useState('');
  const [vendorId, setVendorId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [userRole, setUserRole] = useState<string>('');
  const [vendorOrders, setVendorOrders] = useState<any[]>([]);
  const [selectedTab, setSelectedTab] = useState<'my' | 'all'>('my');

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    Toast.show({
      type: type,
      text1: message,
      position: 'bottom',
      visibilityTime: 2000,
    });
  };

  useEffect(() => {
    fetchUserRole();
    fetchComplaints();
  }, [user?.id]);

  const fetchUserRole = async () => {
    if (!user?.id) return;
    
    try {
      const { data, error } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single();
      
      if (!error && data) {
        setUserRole(data.role);
        
        // If vendor, fetch their orders for complaint reference
        if (data.role === 'vendor') {
          const { data: vendorData } = await supabase
            .from('vendors')
            .select('id')
            .eq('owner_id', user.id)
            .single();
          
          if (vendorData) {
            setVendorId(vendorData.id);
            
            const { data: orders } = await supabase
              .from('orders')
              .select('id, order_number, customer_name, total')
              .eq('vendor_id', vendorData.id)
              .order('created_at', { ascending: false })
              .limit(10);
            
            setVendorOrders(orders || []);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching user role:', error);
    }
  };

  const fetchComplaints = async () => {
    if (!user?.id) return;
    
    try {
      setLoading(true);
      
      let query = supabase
        .from('complaints')
        .select('*')
        .order('created_at', { ascending: false });
      
      // If user is vendor, show complaints about their orders
      if (userRole === 'vendor' && vendorId) {
        query = query.eq('vendor_id', vendorId);
      } else if (userRole === 'customer') {
        // Customer sees their own complaints
        query = query.eq('user_id', user.id);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      setComplaints(data || []);
      
    } catch (error) {
      console.error('Error fetching complaints:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      showToast('Please enter a title', 'error');
      return;
    }
    
    if (!description.trim()) {
      showToast('Please describe your complaint', 'error');
      return;
    }
    
    setSubmitting(true);
    
    try {
      const complaintData: any = {
        user_id: user?.id,
        user_name: user?.name || 'User',
        user_role: userRole,
        title: title.trim(),
        description: description.trim(),
        status: 'pending',
      };
      
      if (orderId) {
        complaintData.order_id = orderId;
      }
      
      if (vendorId) {
        complaintData.vendor_id = vendorId;
      }
      
      const { error } = await supabase
        .from('complaints')
        .insert(complaintData);
      
      if (error) throw error;
      
      showToast('Complaint submitted successfully');
      setShowForm(false);
      setTitle('');
      setDescription('');
      setOrderId('');
      fetchComplaints();
      
    } catch (error) {
      console.error('Error submitting complaint:', error);
      showToast('Failed to submit complaint', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return '#f59e0b';
      case 'resolved':
        return '#10b981';
      case 'rejected':
        return '#ef4444';
      default:
        return '#666';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending':
        return 'Pending';
      case 'resolved':
        return 'Resolved';
      case 'rejected':
        return 'Rejected';
      default:
        return status;
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#f97316" />
        <Text style={styles.loadingText}>Loading complaints...</Text>
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
        <Text style={styles.headerTitle}>Support & Complaints</Text>
        <TouchableOpacity onPress={() => setShowForm(true)} style={styles.newButton}>
          <Feather name="plus" size={24} color="#f97316" />
        </TouchableOpacity>
      </View>

      {/* Info Card */}
      <View style={styles.infoCard}>
        <Feather name="info" size={16} color="#f97316" />
        <Text style={styles.infoText}>
          Have an issue with an order? Submit a complaint and we'll get back to you within 24 hours.
        </Text>
      </View>

      {/* Complaints List */}
      {complaints.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Feather name="message-circle" size={48} color="#666" />
          <Text style={styles.emptyTitle}>No Complaints Yet</Text>
          <Text style={styles.emptyText}>
            Have an issue? Tap the + button to submit a complaint.
          </Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          {complaints.map((complaint) => (
            <View key={complaint.id} style={styles.complaintCard}>
              <View style={styles.complaintHeader}>
                <Text style={styles.complaintTitle}>{complaint.title}</Text>
                <View style={[styles.statusBadge, { backgroundColor: `${getStatusColor(complaint.status)}20` }]}>
                  <Text style={[styles.statusText, { color: getStatusColor(complaint.status) }]}>
                    {getStatusText(complaint.status)}
                  </Text>
                </View>
              </View>
              
              <Text style={styles.complaintDescription}>{complaint.description}</Text>
              
              {complaint.order_id && (
                <Text style={styles.orderInfo}>Order: #{complaint.order_id.slice(0, 8)}</Text>
              )}
              
              <Text style={styles.complaintDate}>
                {new Date(complaint.created_at).toLocaleString()}
              </Text>
              
              {complaint.admin_response && (
                <View style={styles.responseBox}>
                  <Text style={styles.responseLabel}>Admin Response:</Text>
                  <Text style={styles.responseText}>{complaint.admin_response}</Text>
                </View>
              )}
            </View>
          ))}
        </ScrollView>
      )}

      {/* New Complaint Modal */}
      <Modal
        visible={showForm}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowForm(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Submit Complaint</Text>
              <TouchableOpacity onPress={() => setShowForm(false)}>
                <Feather name="x" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.modalBody}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Title *</Text>
                <TextInput
                  style={styles.input}
                  value={title}
                  onChangeText={setTitle}
                  placeholder="Brief summary of your issue"
                  placeholderTextColor="#666"
                />
              </View>
              
              {userRole === 'vendor' && vendorOrders.length > 0 && (
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Related Order (Optional)</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={styles.orderChips}>
                      {vendorOrders.map((order) => (
                        <TouchableOpacity
                          key={order.id}
                          onPress={() => setOrderId(order.id)}
                          style={[
                            styles.orderChip,
                            orderId === order.id && styles.orderChipSelected,
                          ]}
                        >
                          <Text style={[
                            styles.orderChipText,
                            orderId === order.id && styles.orderChipTextSelected,
                          ]}>
                            #{order.order_number || order.id.slice(0, 8)}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>
                </View>
              )}
              
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Description *</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={description}
                  onChangeText={setDescription}
                  placeholder="Please provide details about your issue..."
                  placeholderTextColor="#666"
                  multiline
                  numberOfLines={5}
                  textAlignVertical="top"
                />
              </View>
            </ScrollView>
            
            <View style={styles.modalFooter}>
              <TouchableOpacity
                onPress={handleSubmit}
                disabled={submitting}
                style={styles.submitButton}
              >
                <LinearGradient
                  colors={['#f97316', '#f43f5e']}
                  style={styles.submitGradient}
                >
                  {submitting ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.submitText}>Submit Complaint</Text>
                  )}
                </LinearGradient>
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
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0a0a0a',
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
  newButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(249,115,22,0.1)',
    margin: 16,
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    color: '#f97316',
    lineHeight: 18,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
  },
  complaintCard: {
    backgroundColor: '#1a1a1a',
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  complaintHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  complaintTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '500',
  },
  complaintDescription: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
    marginBottom: 8,
  },
  orderInfo: {
    fontSize: 11,
    color: '#f97316',
    marginBottom: 8,
  },
  complaintDate: {
    fontSize: 10,
    color: '#666',
  },
  responseBox: {
    marginTop: 12,
    padding: 10,
    backgroundColor: 'rgba(16,185,129,0.1)',
    borderRadius: 8,
  },
  responseLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#10b981',
    marginBottom: 4,
  },
  responseText: {
    fontSize: 12,
    color: '#fff',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  modalBody: {
    flex: 1,
    padding: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    color: '#fff',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#0a0a0a',
    borderRadius: 8,
    padding: 12,
    color: '#fff',
    fontSize: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  orderChips: {
    flexDirection: 'row',
    gap: 8,
  },
  orderChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#0a0a0a',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  orderChipSelected: {
    backgroundColor: '#f97316',
    borderColor: '#f97316',
  },
  orderChipText: {
    fontSize: 12,
    color: '#666',
  },
  orderChipTextSelected: {
    color: '#fff',
  },
  modalFooter: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  submitButton: {
    height: 48,
    borderRadius: 8,
    overflow: 'hidden',
  },
  submitGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});