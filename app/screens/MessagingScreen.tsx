// app/screens/common/SimpleMessagingScreen.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Modal
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import Toast from 'react-native-toast-message';

interface Conversation {
  id: string;
  participant_id: string;
  participant_name: string;
  participant_role: string;
  last_message: string;
  last_message_time: string;
}

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
}
type UserRole = 'customer' | 'vendor' | 'rider' | 'business' | 'admin';
export function MessagingScreen() {
  const { user } = useAuth();
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<any[]>([]);
  const [showUserSelector, setShowUserSelector] = useState(false);
  const [vendorId, setVendorId] = useState<string | null>(null);
const [searchQuery, setSearchQuery] = useState('');
const [filteredUsers, setFilteredUsers] = useState<any[]>([]);
  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    Toast.show({ type, text1: msg, position: 'bottom', visibilityTime: 2000 });
  };

  // Get vendor ID
  useEffect(() => {
    const getVendorId = async () => {
      if (!user?.id) return;
      const { data } = await supabase
        .from('vendors')
        .select('id')
        .eq('owner_id', user.id)
        .maybeSingle();
      if (data) setVendorId(data.id);
    };
    getVendorId();
  }, [user?.id]);


  useEffect(() => {
  const fetchUserRole = async () => {
    if (!user?.id) return;
    
    const { data, error } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();
    
    console.log('🔍 User role from database:', data);
    console.log('🔍 Error:', error);
    
    if (!error && data) {
      setUserRole(data.role as UserRole);
      console.log('✅ User role set to:', data.role);
    }
  };
  
  fetchUserRole();
}, [user?.id]);

  // Fetch conversations
const fetchConversations = async () => {
  if (!user?.id) return;
  try {
    console.log('=== FETCHING CONVERSATIONS ===');
    
    const { data: convs, error } = await supabase
      .from('conversations')
      .select('*')
      .contains('participants', [user.id])
      .order('last_message_time', { ascending: false });

    if (error) throw error;
    
    console.log('Raw conversations from DB:', convs);

    const enriched = await Promise.all(
      (convs || []).map(async (conv) => {
        const otherId = conv.participants.find((id: string) => id !== user.id);
        const { data: otherUser } = await supabase
          .from('users')
          .select('id, name, role')
          .eq('id', otherId)
          .single();

        let displayName = otherUser?.name || 'User';
        if (otherUser?.role === 'vendor') {
          const { data: vendor } = await supabase
            .from('vendors')
            .select('name')
            .eq('owner_id', otherId)
            .maybeSingle();
          if (vendor) displayName = vendor.name;
        }

        console.log(`Conversation ${conv.id}: last_message = "${conv.last_message}"`);
        
        return {
          id: conv.id,
          participant_id: otherId,
          participant_name: displayName,
          participant_role: otherUser?.role || 'user',
          last_message: conv.last_message || 'No messages yet',
          last_message_time: conv.last_message_time,
        };
      })
    );

    console.log('Enriched conversations:', enriched);
    setConversations(enriched);
  } catch (error) {
    console.error('Error fetching conversations:', error);
  } finally {
    setLoading(false);
  }
};

 const fetchMessages = async (conversationId: string) => {
  try {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    
    setMessages(data || []);
    
    // Mark messages as read
    if (data && data.length > 0) {
      const unreadMessages = data.filter(m => !m.read && m.sender_id !== user?.id);
      
      if (unreadMessages.length > 0) {
        for (const msg of unreadMessages) {
          await supabase
            .from('messages')
            .update({ read: true })
            .eq('id', msg.id);
        }
        
        await fetchConversations();
        
      
      }
    }
  } catch (error) {
    console.error('Error fetching messages:', error);
  }
};
  // Send a message
// Replace your sendMessage function with this:

const sendMessage = async () => {
  if (!newMessage.trim() || !selectedConversation) return;

  setSending(true);
  try {
    const messageText = newMessage.trim();
    const now = new Date().toISOString();
    const convId = selectedConversation.id;
    
    console.log('=== SENDING MESSAGE ===');
    console.log('Conversation ID from state:', convId);
    console.log('Full selectedConversation:', selectedConversation);
    
    // Insert the message
    const { error: msgError } = await supabase
      .from('messages')
      .insert({
        conversation_id: convId,
        sender_id: user?.id,
        sender_name: user?.name || 'Vendor',
        sender_role: 'vendor',
        content: messageText,
        type: 'inquiry',
        read: false,
      });

    if (msgError) {
      console.error('Insert error:', msgError);
      throw msgError;
    }

    console.log('Message inserted');

    // Update the conversation using the same ID
    const { error: convError } = await supabase
      .from('conversations')
      .update({ 
        last_message: messageText,
        last_message_time: now 
      })
      .eq('id', convId);

    if (convError) {
      console.error('Update error:', convError);
    } else {
      console.log('Conversation updated successfully');
    }
    
    // Verify the update
    const { data: check } = await supabase
      .from('conversations')
      .select('id, last_message, last_message_time')
      .eq('id', convId)
      .single();
      
    console.log('After update - DB value:', check);
    
    setNewMessage('');
    await fetchMessages(convId);
    await fetchConversations();
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    setSending(false);
  }
};

const createConversation = async (targetUserId: string, targetName: string) => {
    if (!user?.id) return;

    try {
      // Check if conversation exists
      const { data: existing } = await supabase
        .from('conversations')
        .select('*')
        .contains('participants', [user.id, targetUserId]);

      if (existing && existing.length > 0) {
        const conv = existing[0];
        const otherId = conv.participants.find((id: string) => id !== user.id);
        const { data: otherUser } = await supabase
          .from('users')
          .select('name, role')
          .eq('id', otherId)
          .single();

        let displayName = otherUser?.name || 'User';
        if (otherUser?.role === 'vendor') {
          const { data: vendor } = await supabase
            .from('vendors')
            .select('name')
            .eq('owner_id', otherId)
            .maybeSingle();
          if (vendor) displayName = vendor.name;
        }

        setSelectedConversation({
          id: conv.id,
          participant_id: otherId,
          participant_name: displayName,
          participant_role: otherUser?.role || 'user',
          last_message: conv.last_message || '',
          last_message_time: conv.last_message_time,
        });
        await fetchMessages(conv.id);
        setShowUserSelector(false);
        return;
      }

      // Create new conversation
      const { data: newConv, error } = await supabase
        .from('conversations')
        .insert({
          participants: [user.id, targetUserId],
          last_message: '',
          last_message_time: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;

      setSelectedConversation({
        id: newConv.id,
        participant_id: targetUserId,
        participant_name: targetName,
        participant_role: 'user',
        last_message: '',
        last_message_time: new Date().toISOString(),
      });
      setMessages([]);
      setShowUserSelector(false);
      await fetchConversations();
    } catch (error) {
      console.error('Error creating conversation:', error);
      showToast('Failed to start conversation', 'error');
    }
  };

  // Fetch available users to message
const fetchAvailableUsers = async () => {
  console.log('📞 fetchAvailableUsers called');
  console.log('👤 Current userRole:', userRole);
  
  if (!userRole) {
    console.log('⚠️ userRole not set yet, waiting...');
    return;
  }
  
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, name, role')
      .neq('id', user?.id);

    if (error) throw error;

    console.log('📋 All users from DB:', data?.map(u => ({ name: u.name, role: u.role })));

    // Filter based on user role
    let filteredUsers = data || [];
    
    if (userRole === 'customer') {
      filteredUsers = filteredUsers.filter(u => 
        u.role === 'vendor' || u.role === 'rider' || u.role === 'admin'
      );
    } else if (userRole === 'vendor') {
      filteredUsers = filteredUsers.filter(u => 
        u.role === 'customer' || u.role === 'rider' || u.role === 'admin'
      );
    } else if (userRole === 'business') {
      filteredUsers = filteredUsers.filter(u => {
        const allowed = u.role === 'rider' || u.role === 'admin';
        return allowed;
      });
      
      console.log('After filter count:', filteredUsers.length);
    } else if (userRole === 'rider') {
      filteredUsers = filteredUsers.filter(u => 
        u.role === 'vendor' || u.role === 'customer' || u.role === 'business' || u.role === 'admin'
      );
    }

    console.log('📋 Filtered users after role filter:', filteredUsers.map(u => ({ name: u.name, role: u.role })));

    // Enhance with vendor names
    const enhanced = await Promise.all(
      filteredUsers.map(async (u) => {
        let displayName = u.name;
        if (u.role === 'vendor') {
          const { data: vendor } = await supabase
            .from('vendors')
            .select('name')
            .eq('owner_id', u.id)
            .maybeSingle();
          if (vendor) displayName = vendor.name;
        }
        return { ...u, displayName };
      })
    );

    setAvailableUsers(enhanced);
    console.log('✅ Final available users count:', enhanced.length);
    console.log('✅ Final available users:', enhanced.map(u => ({ name: u.displayName, role: u.role })));
    
  } catch (error) {
    console.error('Error fetching users:', error);
  }
};

// Add search filter function
const filterUsers = (query: string) => {
  setSearchQuery(query);
  if (query.trim() === '') {
    setFilteredUsers(availableUsers);
  } else {
    const filtered = availableUsers.filter(user =>
      user.displayName.toLowerCase().includes(query.toLowerCase()) ||
      user.role.toLowerCase().includes(query.toLowerCase())
    );
    setFilteredUsers(filtered);
  }
};

  useEffect(() => {
    fetchConversations();
  }, [user?.id]);

  const renderMessage = ({ item }: { item: Message }) => {
    const isMine = item.sender_id === user?.id;
    return (
      <View style={[styles.messageRow, isMine ? styles.myRow : styles.otherRow]}>
        <View style={[styles.messageBubble, isMine ? styles.myBubble : styles.otherBubble]}>
          <Text style={styles.messageText}>{item.content}</Text>
          <Text style={styles.messageTime}>
            {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
      </View>
    );
  };

  if (loading && conversations.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#f97316" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        {selectedConversation ? (
          <>
            <TouchableOpacity onPress={() => setSelectedConversation(null)} style={styles.backButton}>
              <Feather name="arrow-left" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{selectedConversation.participant_name}</Text>
            <View style={{ width: 40 }} />
          </>
        ) : (
          <>
          <View>
            <Text style={styles.headerTitle}>Chat </Text>
            <Text style={styles.headerph}>Send Message or drop complain in one click</Text>
            </View>
            <TouchableOpacity
              onPress={() => {
                fetchAvailableUsers();
                setShowUserSelector(true);
              }}
              style={styles.newButton}
            >
              <Feather name="plus" size={24} color="#f97316" />
            </TouchableOpacity>
          </>
        )}
      </View>

      {selectedConversation ? (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.chatContainer}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
          <FlatList
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={renderMessage}
            contentContainerStyle={styles.messagesList}
            onContentSizeChange={() => {
              // Auto scroll to bottom
            }}
          />
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              value={newMessage}
              onChangeText={setNewMessage}
              placeholder="Type a message..."
              placeholderTextColor="#666"
              multiline
            />
            <TouchableOpacity
              onPress={sendMessage}
              disabled={sending || !newMessage.trim()}
              style={[styles.sendButton, (!newMessage.trim() || sending) && styles.sendButtonDisabled]}
            >
              <Feather name="send" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      ) : (
        <ScrollView style={styles.conversationList}>
          {conversations.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Feather name="message-circle" size={48} color="#666" />
              <Text style={styles.emptyTitle}>No Messages</Text>
              <Text style={styles.emptyText}>Tap + to start a conversation</Text>
            </View>
          ) : (
            conversations.map((conv) => (
              <TouchableOpacity
                key={conv.id}
                style={styles.conversationItem}
                onPress={() => {
                  setSelectedConversation(conv);
                  fetchMessages(conv.id);
                }}
              >
                <View style={styles.avatar}>
                  <Feather name="user" size={20} color="#f97316" />
                </View>
                <View style={styles.conversationInfo}>
                  <Text style={styles.conversationName}>{conv.participant_name}</Text>
                  <Text style={styles.lastMessage} numberOfLines={1}>
                    {conv.last_message}
                  </Text>
                </View>
                <Text style={styles.timeText}>
                  {new Date(conv.last_message_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      )}

{showUserSelector && (
  <Modal
    visible={showUserSelector}
    transparent={true}
    animationType="slide"
    onRequestClose={() => setShowUserSelector(false)}
  >
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.modalContainer}
    >
      <View style={styles.modalOverlay}>
        <TouchableOpacity 
          style={styles.modalBackdrop} 
          activeOpacity={1} 
          onPress={() => setShowUserSelector(false)} 
        />
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>New Message</Text>
            <TouchableOpacity onPress={() => setShowUserSelector(false)}>
              <Feather name="x" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
          
          {/* Search Input */}
          <View style={styles.searchContainer}>
            <Feather name="search" size={18} color="#666" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by name or role..."
              placeholderTextColor="#666"
              value={searchQuery}
              onChangeText={filterUsers}
              autoFocus={true}
            />
            {searchQuery !== '' && (
              <TouchableOpacity onPress={() => filterUsers('')}>
                <Feather name="x" size={18} color="#666" />
              </TouchableOpacity>
            )}
          </View>
          
          <ScrollView 
            style={styles.userList}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {filteredUsers.length === 0 ? (
              <View style={styles.noUsersContainer}>
                <Feather name="users" size={32} color="#666" />
                <Text style={styles.noUsersText}>No users found</Text>
              </View>
            ) : (
              filteredUsers.map((userItem) => (
                <TouchableOpacity
                  key={userItem.id}
                  style={styles.userItem}
                  onPress={() => createConversation(userItem.id, userItem.displayName)}
                >
                  <View style={styles.userAvatar}>
                    <Feather name="user" size={20} color="#f97316" />
                  </View>
                  <View>
                    <Text style={styles.userName}>{userItem.displayName}</Text>
                    <Text style={styles.userRole}>{userItem.role}</Text>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        </View>
      </View>
    </KeyboardAvoidingView>
  </Modal>
)}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  searchContainer: {
  flexDirection: 'row',
  alignItems: 'center',
  backgroundColor: '#0a0a0a',
  marginHorizontal: 16,
  marginBottom: 12,
  paddingHorizontal: 12,
  borderRadius: 10,
  borderWidth: 1,
  borderColor: 'rgba(255,255,255,0.05)',
},
searchIcon: {
  marginRight: 8,
},
searchInput: {
  flex: 1,
  height: 44,
  color: '#fff',
  fontSize: 14,
},
noUsersContainer: {
  alignItems: 'center',
  padding: 40,
},
noUsersText: {
  color: '#666',
  fontSize: 14,
  marginTop: 12,
},
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0a0a0a' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#1a1a1a', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#fff' },
  headerph:{fontSize: 12, fontWeight: '600', color: '#fff'},
  newButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#1a1a1a', justifyContent: 'center', alignItems: 'center' },
  chatContainer: { flex: 1 },
  messagesList: { padding: 16, flexGrow: 1 },
  messageRow: { marginBottom: 12 },
  myRow: { alignItems: 'flex-end' },
  otherRow: { alignItems: 'flex-start' },
  messageBubble: { maxWidth: '80%', padding: 12, borderRadius: 16 },
  myBubble: { backgroundColor: '#f97316', borderBottomRightRadius: 4 },
  otherBubble: { backgroundColor: '#1a1a1a', borderBottomLeftRadius: 4 },
  messageText: { fontSize: 14, color: '#fff' },
  messageTime: { fontSize: 10, color: 'rgba(255,255,255,0.5)', marginTop: 4, alignSelf: 'flex-end' },
  inputContainer: { flexDirection: 'row', padding: 16, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)', gap: 8 },
  input: { flex: 1, backgroundColor: '#1a1a1a', borderRadius: 24, paddingHorizontal: 16, paddingVertical: 10, color: '#fff', fontSize: 14, maxHeight: 100 },
  sendButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#f97316', justifyContent: 'center', alignItems: 'center' },
  sendButtonDisabled: { opacity: 0.5 },
  conversationList: { flex: 1 },
  conversationItem: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#1a1a1a', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  conversationInfo: { flex: 1 },
  conversationName: { fontSize: 15, fontWeight: '500', color: '#fff', marginBottom: 4 },
  lastMessage: { fontSize: 12, color: '#666' },
  timeText: { fontSize: 11, color: '#666' },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, marginTop: 100 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: '#fff', marginTop: 16, marginBottom: 8 },
  emptyText: { fontSize: 13, color: '#666', textAlign: 'center' },
  modalOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#1a1a1a', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  modalTitle: { fontSize: 18, fontWeight: '600', color: '#fff' },
  userList: { padding: 16 },
  userItem: { flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: '#0a0a0a', borderRadius: 12, marginBottom: 8, gap: 12 },
  userAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#1a1a1a', justifyContent: 'center', alignItems: 'center' },
  userName: { fontSize: 15, fontWeight: '500', color: '#fff' },
  userRole: { fontSize: 11, color: '#f97316' },






  modalContainer: {
  flex: 1,
},

modalBackdrop: {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
},

});