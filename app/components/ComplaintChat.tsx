// app/components/ComplaintChat.tsx
// Conversation with Vesphe support about one complaint (the same thread admins
// answer from the web dashboard).
import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Modal,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { ModalSafeArea } from './ModalSafeArea';

export interface ComplaintSummary {
  id: string;
  user_id: string;
  title: string;
  description: string;
  status: 'pending' | 'resolved' | 'rejected';
  created_at: string;
}

interface Message {
  id: string;
  sender_id: string;
  sender_role: string;
  body: string;
  created_at: string;
}

export function ComplaintChat({ complaint, onClose }: { complaint: ComplaintSummary | null; onClose: () => void }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList<Message>>(null);
  const complaintId = complaint?.id;

  useEffect(() => {
    if (!complaintId) return;
    let active = true;
    setLoading(true);
    supabase
      .from('complaint_messages')
      .select('id, sender_id, sender_role, body, created_at')
      .eq('complaint_id', complaintId)
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        if (!active) return;
        setMessages((data as Message[]) || []);
        setLoading(false);
      });

    const channel = supabase
      .channel(`complaint-${complaintId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'complaint_messages', filter: `complaint_id=eq.${complaintId}` },
        payload => {
          const m = payload.new as Message;
          setMessages(prev => (prev.some(p => p.id === m.id) ? prev : [...prev, m]));
        }
      )
      .subscribe();
    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [complaintId]);

  if (!complaint) return null;

  const canReply = complaint.status === 'pending';
  const thread: Message[] = [
    { id: 'opening', sender_id: complaint.user_id, sender_role: 'customer', body: complaint.description, created_at: complaint.created_at },
    ...messages,
  ];

  const send = async () => {
    const body = text.trim();
    if (!body || !user) return;
    setSending(true);
    const { data, error } = await supabase
      .from('complaint_messages')
      .insert({ complaint_id: complaint.id, sender_id: user.id, body })
      .select('id, sender_id, sender_role, body, created_at')
      .single();
    setSending(false);
    if (error) {
      Toast.show({ type: 'error', text1: 'Message not sent', text2: error.message, position: 'bottom' });
      return;
    }
    setText('');
    setMessages(prev => (prev.some(p => p.id === data.id) ? prev : [...prev, data as Message]));
  };

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <ModalSafeArea style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.headerButton} accessibilityLabel="Back">
            <Feather name="arrow-left" size={22} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle} numberOfLines={1}>{complaint.title}</Text>
            <Text style={styles.headerSub}>Vesphe support</Text>
          </View>
        </View>

        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {loading ? (
            <ActivityIndicator style={{ marginTop: 40 }} color="#f97316" />
          ) : (
            <FlatList
              ref={listRef}
              data={thread}
              keyExtractor={m => m.id}
              contentContainerStyle={styles.list}
              onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
              renderItem={({ item }) => {
                const mine = item.sender_id === user?.id;
                return (
                  <View style={[styles.bubbleRow, mine ? styles.right : styles.left]}>
                    <View style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
                      {!mine && <Text style={styles.sender}>{item.sender_role === 'admin' ? 'Vesphe support' : 'User'}</Text>}
                      <Text style={styles.body}>{item.body}</Text>
                      <Text style={[styles.time, mine && { color: 'rgba(255,255,255,0.7)' }]}>
                        {new Date(item.created_at).toLocaleString()}
                      </Text>
                    </View>
                  </View>
                );
              }}
            />
          )}

          {canReply ? (
            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                value={text}
                onChangeText={setText}
                placeholder="Write a message…"
                placeholderTextColor="#666"
                multiline
                maxLength={4000}
              />
              <TouchableOpacity
                style={[styles.sendButton, (!text.trim() || sending) && { opacity: 0.5 }]}
                onPress={send}
                disabled={!text.trim() || sending}
                accessibilityLabel="Send"
              >
                {sending ? <ActivityIndicator color="#fff" size="small" /> : <Feather name="send" size={18} color="#fff" />}
              </TouchableOpacity>
            </View>
          ) : (
            <Text style={styles.closed}>
              This complaint is {complaint.status === 'resolved' ? 'resolved' : 'closed'}. Open a new one if you still need help.
            </Text>
          )}
        </KeyboardAvoidingView>
      </ModalSafeArea>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1f1f1f',
  },
  headerButton: { padding: 6 },
  headerTitle: { color: '#fff', fontSize: 16, fontWeight: '600' },
  headerSub: { color: '#888', fontSize: 12 },
  list: { padding: 16, gap: 10 },
  bubbleRow: { flexDirection: 'row' },
  left: { justifyContent: 'flex-start' },
  right: { justifyContent: 'flex-end' },
  bubble: { maxWidth: '82%', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10 },
  mine: { backgroundColor: '#f97316', borderBottomRightRadius: 4 },
  theirs: { backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#2a2a2a', borderBottomLeftRadius: 4 },
  sender: { color: '#f97316', fontSize: 11, fontWeight: '600', marginBottom: 2 },
  body: { color: '#fff', fontSize: 14, lineHeight: 20 },
  time: { color: '#777', fontSize: 10, marginTop: 4 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#1f1f1f',
  },
  input: {
    flex: 1,
    maxHeight: 120,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    color: '#fff',
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f97316',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closed: { color: '#888', textAlign: 'center', padding: 16, fontSize: 13 },
});
