// app/screens/MessagingScreen.tsx
// One-to-one chat between customers, vendors, riders and Vesphe Support:
// conversation list with unread counts, live messages, photos, read receipts.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Modal,
  Image,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard';
import Toast from 'react-native-toast-message';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { RootStackParamList } from '../navigation/types';
import { navigate } from '../navigation/RootNavigation';
import { blockUser, fetchBlockedIds, unblockUser } from '../services/blocks';

const BUCKET = 'chat-media';
const ORANGE = '#f97316';

interface Person {
  id: string;
  name: string;
  role: string;
  avatar_url: string | null;
  subtitle?: string | null;
}

interface Conversation {
  id: string;
  other: Person;
  last_message: string;
  last_message_time: string;
  unread: number;
}

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  image_path: string | null;
  read: boolean | null;
  read_at: string | null;
  created_at: string;
  pending?: boolean; // optimistic, not yet saved
  localUri?: string; // photo preview while uploading
}

type ListItem = { kind: 'day'; id: string; label: string } | { kind: 'msg'; id: string; msg: Message };

const ROLE_LABEL: Record<string, string> = {
  admin: 'Support',
  vendor: 'Vendor',
  rider: 'Rider',
  customer: 'Customer',
  business: 'Business',
};

const toast = (text1: string, type: 'success' | 'error' = 'success') =>
  Toast.show({ type, text1, position: 'bottom', visibilityTime: 2000 });

// "14:05", "Yesterday", "Mon", "12 Oct"
function listTime(iso?: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const days = Math.floor((new Date(now.toDateString()).getTime() - new Date(d.toDateString()).getTime()) / 86400000);
  if (days === 0) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (days === 1) return 'Yesterday';
  if (days < 7) return d.toLocaleDateString([], { weekday: 'short' });
  return d.toLocaleDateString([], { day: 'numeric', month: 'short' });
}

function dayLabel(iso: string) {
  const d = new Date(iso);
  const days = Math.floor((new Date(new Date().toDateString()).getTime() - new Date(d.toDateString()).getTime()) / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return d.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' });
}

function Avatar({ person, size = 44 }: { person: Person; size?: number }) {
  const initials = (person.name || '?')
    .split(' ')
    .map(w => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  if (person.role === 'admin') {
    return (
      <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: 'rgba(249,115,22,0.18)' }]}>
        <Feather name="headphones" size={size * 0.45} color={ORANGE} />
      </View>
    );
  }
  if (person.avatar_url) {
    return <Image source={{ uri: person.avatar_url }} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: '#222' }} />;
  }
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[styles.avatarText, { fontSize: size * 0.36 }]}>{initials}</Text>
    </View>
  );
}

export function MessagingScreen() {
  const { user } = useAuth();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RootStackParamList, 'Messaging'>>();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState<Conversation | null>(null);
  const [showNew, setShowNew] = useState(false);
  const openRef = useRef<Conversation | null>(null);
  openRef.current = open;

  const loadConversations = useCallback(async () => {
    if (!user?.id) return [];
    const { data: convs, error } = await supabase
      .from('conversations')
      .select('id, participants, last_message, last_message_time')
      .contains('participants', [user.id])
      .order('last_message_time', { ascending: false });
    if (error) {
      console.error('Error loading conversations:', error);
      setLoading(false);
      return [];
    }
    const otherIds = [...new Set((convs || []).map(c => (c.participants as string[]).find(p => p !== user.id)).filter(Boolean))] as string[];
    const [{ data: people }, { data: unreadRows }, blocked] = await Promise.all([
      otherIds.length ? supabase.rpc('conversation_people', { p_ids: otherIds }) : Promise.resolve({ data: [] as Person[] }),
      supabase.from('messages').select('conversation_id').eq('read', false).neq('sender_id', user.id),
      fetchBlockedIds(user.id),
    ]);
    const unread = new Map<string, number>();
    (unreadRows || []).forEach((r: { conversation_id: string }) => unread.set(r.conversation_id, (unread.get(r.conversation_id) || 0) + 1));
    const list: Conversation[] = (convs || [])
      .map(c => {
        const otherId = (c.participants as string[]).find(p => p !== user.id) || '';
        const other = ((people as Person[]) || []).find(p => p.id === otherId) || { id: otherId, name: 'User', role: 'customer', avatar_url: null };
        return {
          id: c.id,
          other,
          last_message: c.last_message || '',
          last_message_time: c.last_message_time,
          unread: openRef.current?.id === c.id ? 0 : unread.get(c.id) || 0,
        };
      })
      // Hide empty conversations someone opened but never wrote in.
      .filter(c => (c.last_message || openRef.current?.id === c.id) && !blocked.has(c.other.id));
    setConversations(list);
    setLoading(false);
    return list;
  }, [user?.id]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Live: any new message in my conversations refreshes the list (RLS limits the feed to mine).
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`conversations-${user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => loadConversations())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, loadConversations]);

  // Opened from a push notification: Messaging { conversationId }
  const linkedId = route.params?.conversationId;
  useEffect(() => {
    if (!linkedId || loading) return;
    const match = conversations.find(c => c.id === linkedId);
    if (match) setOpen(match);
    (navigation as any).setParams({ conversationId: undefined });
  }, [linkedId, loading, conversations, navigation]);

  const startChat = async (person: Person) => {
    const { data, error } = await supabase.rpc('start_conversation', { p_other: person.id });
    if (error) {
      toast(error.message || 'Could not start chat', 'error');
      return;
    }
    setShowNew(false);
    const conv: Conversation = { id: data as string, other: person, last_message: '', last_message_time: new Date().toISOString(), unread: 0 };
    setOpen(conv);
  };

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? conversations.filter(c => c.other.name.toLowerCase().includes(q) || c.last_message.toLowerCase().includes(q)) : conversations;
  }, [conversations, search]);

  if (open) {
    return (
      <ChatThread
        conversation={open}
        onBack={() => {
          setOpen(null);
          loadConversations();
        }}
      />
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconButton} accessibilityLabel="Back">
          <Feather name="arrow-left" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Messages</Text>
          <Text style={styles.headerSub}>Chat with vendors, riders and Vesphe Support</Text>
        </View>
        <TouchableOpacity onPress={() => setShowNew(true)} style={styles.newButton} accessibilityLabel="New chat">
          <Feather name="edit" size={18} color={ORANGE} />
        </TouchableOpacity>
      </View>

      <View style={styles.searchBox}>
        <Feather name="search" size={16} color="#666" />
        <TextInput style={styles.searchInput} value={search} onChangeText={setSearch} placeholder="Search chats" placeholderTextColor="#666" />
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={ORANGE} />
      ) : (
        <FlatList
          data={visible}
          keyExtractor={c => c.id}
          contentContainerStyle={visible.length ? undefined : { flex: 1 }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Feather name="message-circle" size={48} color="#444" />
              <Text style={styles.emptyTitle}>{search ? 'No chats match' : 'No messages yet'}</Text>
              <Text style={styles.emptyText}>Tap the pencil to message a vendor, your rider or Vesphe Support.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.convRow} onPress={() => setOpen(item)} activeOpacity={0.7}>
              <Avatar person={item.other} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <View style={styles.rowBetween}>
                  <Text style={[styles.convName, item.unread > 0 && { fontWeight: '700' }]} numberOfLines={1}>
                    {item.other.name}
                  </Text>
                  <Text style={[styles.convTime, item.unread > 0 && { color: ORANGE }]}>{listTime(item.last_message_time)}</Text>
                </View>
                <View style={styles.rowBetween}>
                  <Text style={[styles.convPreview, item.unread > 0 && { color: '#ddd' }]} numberOfLines={1}>
                    <Text style={styles.roleTag}>{ROLE_LABEL[item.other.role] || item.other.role} · </Text>
                    {item.last_message}
                  </Text>
                  {item.unread > 0 && (
                    <View style={styles.unreadBadge}>
                      <Text style={styles.unreadText}>{item.unread > 99 ? '99+' : item.unread}</Text>
                    </View>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          )}
        />
      )}

      <NewChatModal visible={showNew} onClose={() => setShowNew(false)} onPick={startChat} />
    </SafeAreaView>
  );
}

function NewChatModal({ visible, onClose, onPick }: { visible: boolean; onClose: () => void; onPick: (p: Person) => void }) {
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    setQuery('');
    supabase.rpc('chat_directory').then(({ data, error }) => {
      if (error) toast(error.message, 'error');
      const list = ((data as Person[]) || []).sort((a, b) => {
        const rank = (p: Person) => (p.role === 'admin' ? 0 : p.role === 'rider' ? 1 : 2);
        return rank(a) - rank(b) || a.name.localeCompare(b.name);
      });
      // One Support entry is enough even with several admins.
      const seenSupport = { done: false };
      setPeople(list.filter(p => (p.role === 'admin' && p.name === 'Vesphe Support' ? !seenSupport.done && (seenSupport.done = true) : true)));
      setLoading(false);
    });
  }, [visible]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? people.filter(p => p.name.toLowerCase().includes(q) || (p.subtitle || '').toLowerCase().includes(q)) : people;
  }, [people, query]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.sheetOverlay}>
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>New message</Text>
            <TouchableOpacity onPress={onClose} accessibilityLabel="Close">
              <Feather name="x" size={22} color="#fff" />
            </TouchableOpacity>
          </View>
          <View style={[styles.searchBox, { marginHorizontal: 0 }]}>
            <Feather name="search" size={16} color="#666" />
            <TextInput style={styles.searchInput} value={query} onChangeText={setQuery} placeholder="Search" placeholderTextColor="#666" autoFocus />
          </View>
          {loading ? (
            <ActivityIndicator style={{ marginTop: 30 }} color={ORANGE} />
          ) : (
            <FlatList
              data={shown}
              keyExtractor={p => p.id}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={<Text style={[styles.emptyText, { marginTop: 30 }]}>No one to message yet.</Text>}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.personRow} onPress={() => onPick(item)}>
                  <Avatar person={item} size={40} />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.convName}>{item.name}</Text>
                    {!!item.subtitle && <Text style={styles.convPreview} numberOfLines={1}>{item.subtitle}</Text>}
                  </View>
                  <Text style={styles.rolePill}>{ROLE_LABEL[item.role] || item.role}</Text>
                </TouchableOpacity>
              )}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

function ChatThread({ conversation, onBack }: { conversation: Conversation; onBack: () => void }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [viewer, setViewer] = useState<string | null>(null);
  const other = conversation.other;

  const markRead = useCallback(() => {
    supabase.rpc('mark_conversation_read', { p_conversation_id: conversation.id }).then(() => undefined);
  }, [conversation.id]);

  // Signed links for photos (the bucket is private to the two people in the chat).
  const resolvePhotos = useCallback(async (list: Message[]) => {
    const paths = list.map(m => m.image_path).filter((p): p is string => !!p);
    const missing = paths.filter(p => !photoUrls[p]);
    if (!missing.length) return;
    const { data } = await supabase.storage.from(BUCKET).createSignedUrls(missing, 60 * 60 * 24);
    const next: Record<string, string> = {};
    (data || []).forEach(d => {
      if (d.signedUrl && d.path) next[d.path] = d.signedUrl;
    });
    setPhotoUrls(prev => ({ ...prev, ...next }));
  }, [photoUrls]);

  useEffect(() => {
    let active = true;
    supabase
      .from('messages')
      .select('id, conversation_id, sender_id, content, image_path, read, read_at, created_at')
      .eq('conversation_id', conversation.id)
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        if (!active) return;
        const list = (data as Message[]) || [];
        setMessages(list);
        setLoading(false);
        resolvePhotos(list);
        markRead();
      });

    const channel = supabase
      .channel(`chat-${conversation.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversation.id}` }, payload => {
        const m = payload.new as Message;
        setMessages(prev => {
          if (prev.some(p => p.id === m.id)) return prev;
          // Replace my optimistic copy if this is it.
          const pendingIdx = prev.findIndex(p => p.pending && p.sender_id === m.sender_id && p.content === m.content && !!p.localUri === !!m.image_path);
          if (pendingIdx >= 0) {
            const copy = [...prev];
            copy[pendingIdx] = m;
            return copy;
          }
          return [...prev, m];
        });
        if (m.image_path) resolvePhotos([m]);
        if (m.sender_id !== user?.id) markRead();
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversation.id}` }, payload => {
        const m = payload.new as Message;
        setMessages(prev => prev.map(p => (p.id === m.id ? { ...p, read: m.read, read_at: m.read_at } : p)));
      })
      .subscribe();
    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversation.id]);

  const send = async (content: string, image?: { base64: string; uri: string; mime: string }) => {
    if (!user?.id) return;
    const tempId = `temp-${Date.now()}`;
    setMessages(prev => [
      ...prev,
      {
        id: tempId,
        conversation_id: conversation.id,
        sender_id: user.id,
        content,
        image_path: null,
        read: false,
        read_at: null,
        created_at: new Date().toISOString(),
        pending: true,
        localUri: image?.uri,
      },
    ]);

    try {
      let imagePath: string | null = null;
      if (image) {
        const ext = image.mime === 'image/png' ? 'png' : 'jpg';
        imagePath = `${conversation.id}/${user.id}-${Date.now()}.${ext}`;
        const binary = atob(image.base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const { error: uploadError } = await supabase.storage.from(BUCKET).upload(imagePath, bytes, { contentType: image.mime });
        if (uploadError) throw uploadError;
        setPhotoUrls(prev => ({ ...prev, [imagePath as string]: image.uri }));
      }
      const { data, error } = await supabase
        .from('messages')
        .insert({ conversation_id: conversation.id, sender_id: user.id, content, image_path: imagePath })
        .select('id, conversation_id, sender_id, content, image_path, read, read_at, created_at')
        .single();
      if (error) throw error;
      setMessages(prev => (prev.some(p => p.id === data.id) ? prev.filter(p => p.id !== tempId) : prev.map(p => (p.id === tempId ? (data as Message) : p))));
    } catch (error: any) {
      console.error('Send failed:', error);
      setMessages(prev => prev.filter(p => p.id !== tempId));
      toast(image ? 'Photo not sent' : 'Message not sent', 'error');
      if (!image) setText(content);
    }
  };

  const sendText = () => {
    const content = text.trim();
    if (!content) return;
    setText('');
    send(content);
  };


  const openSafetyMenu = async () => {
    if (!user) return;
    const isBlocked = (await fetchBlockedIds(user.id)).has(other.id);
    Alert.alert(other.name, undefined, [
      { text: 'Report a problem', onPress: () => navigate('Complaints') },
      isBlocked
        ? { text: 'Unblock', onPress: () => unblockUser(user.id, other.id).catch(() => undefined) }
        : {
            text: 'Block',
            style: 'destructive',
            onPress: () => blockUser(user.id, other.id).then(onBack).catch(() => Alert.alert('Could not block', 'Please try again.')),
          },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const pickPhoto = async (source: 'camera' | 'library') => {
    const permission =
      source === 'camera' ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      toast(source === 'camera' ? 'Camera permission is needed' : 'Photo access is needed', 'error');
      return;
    }
    const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.6, base64: true, exif: false };
    const result = source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
    if (result.canceled || !result.assets?.[0]?.base64) return;
    const asset = result.assets[0];
    const caption = text.trim();
    setText('');
    send(caption, { base64: asset.base64 as string, uri: asset.uri, mime: asset.mimeType === 'image/png' ? 'image/png' : 'image/jpeg' });
  };

  const attach = () =>
    Alert.alert('Send a photo', undefined, [
      { text: 'Take photo', onPress: () => pickPhoto('camera') },
      { text: 'Choose from gallery', onPress: () => pickPhoto('library') },
      { text: 'Cancel', style: 'cancel' },
    ]);

  // Newest first for the inverted list, with a date label above each day's first message.
  const items = useMemo<ListItem[]>(() => {
    const out: ListItem[] = [];
    messages.forEach((m, i) => {
      const prev = messages[i - 1];
      if (!prev || new Date(prev.created_at).toDateString() !== new Date(m.created_at).toDateString()) {
        out.push({ kind: 'day', id: `day-${m.id}`, label: dayLabel(m.created_at) });
      }
      out.push({ kind: 'msg', id: m.id, msg: m });
    });
    return out.reverse();
  }, [messages]);

  const renderItem = ({ item }: { item: ListItem }) => {
    if (item.kind === 'day') {
      return (
        <View style={styles.dayRow}>
          <Text style={styles.dayText}>{item.label}</Text>
        </View>
      );
    }
    const m = item.msg;
    const mine = m.sender_id === user?.id;
    const photo = m.localUri || (m.image_path ? photoUrls[m.image_path] : undefined);
    return (
      <View style={[styles.msgRow, mine ? styles.mineRow : styles.theirRow]}>
        <Pressable
          onLongPress={() => {
            if (!m.content) return;
            Clipboard.setStringAsync(m.content);
            toast('Copied');
          }}
          style={[styles.bubble, mine ? styles.mineBubble : styles.theirBubble, !!m.image_path || m.localUri ? styles.photoBubble : null]}
        >
          {(m.image_path || m.localUri) && (
            <TouchableOpacity activeOpacity={0.85} onPress={() => photo && setViewer(photo)} disabled={!photo}>
              {photo ? (
                <Image source={{ uri: photo }} style={styles.photo} />
              ) : (
                <View style={[styles.photo, styles.photoLoading]}>
                  <ActivityIndicator color="#fff" />
                </View>
              )}
              {m.pending && (
                <View style={styles.uploading}>
                  <ActivityIndicator color="#fff" />
                </View>
              )}
            </TouchableOpacity>
          )}
          {!!m.content && <Text style={[styles.msgText, (m.image_path || m.localUri) && { paddingHorizontal: 8, paddingTop: 6 }]}>{m.content}</Text>}
          <View style={[styles.metaRow, (m.image_path || m.localUri) && { paddingHorizontal: 8 }]}>
            <Text style={[styles.msgTime, mine && { color: 'rgba(255,255,255,0.75)' }]}>
              {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
            {mine && (
              <Feather
                name={m.pending ? 'clock' : m.read ? 'check-circle' : 'check'}
                size={12}
                color={m.read ? '#fff' : 'rgba(255,255,255,0.7)'}
                style={{ marginLeft: 4 }}
              />
            )}
          </View>
        </Pressable>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.iconButton} accessibilityLabel="Back">
          <Feather name="arrow-left" size={22} color="#fff" />
        </TouchableOpacity>
        <Avatar person={other} size={38} />
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={styles.threadName} numberOfLines={1}>{other.name}</Text>
          <Text style={styles.headerSub}>{other.role === 'admin' ? 'Usually replies within a few hours' : ROLE_LABEL[other.role] || other.role}</Text>
        </View>
        {other.role !== 'admin' && (
          <TouchableOpacity onPress={openSafetyMenu} style={styles.iconButton} accessibilityLabel="Report or block">
            <Feather name="flag" size={20} color="#fff" />
          </TouchableOpacity>
        )}
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 0}>
        {loading ? (
          <ActivityIndicator style={{ marginTop: 40 }} color={ORANGE} />
        ) : messages.length === 0 ? (
          <View style={styles.empty}>
            <Avatar person={other} size={64} />
            <Text style={styles.emptyTitle}>Say hello to {other.name}</Text>
            <Text style={styles.emptyText}>Messages and photos you send appear here.</Text>
          </View>
        ) : (
          <FlatList
            inverted
            data={items}
            keyExtractor={i => i.id}
            renderItem={renderItem}
            contentContainerStyle={styles.thread}
            keyboardShouldPersistTaps="handled"
          />
        )}

        <View style={styles.composer}>
          <TouchableOpacity onPress={attach} style={styles.attachButton} accessibilityLabel="Send a photo">
            <Feather name="image" size={20} color="#bbb" />
          </TouchableOpacity>
          <TextInput
            style={styles.input}
            value={text}
            onChangeText={setText}
            placeholder="Message"
            placeholderTextColor="#666"
            multiline
            maxLength={4000}
          />
          <TouchableOpacity
            onPress={sendText}
            disabled={!text.trim()}
            style={[styles.sendButton, !text.trim() && { opacity: 0.4 }]}
            accessibilityLabel="Send"
          >
            <Feather name="send" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      <Modal visible={!!viewer} transparent animationType="fade" onRequestClose={() => setViewer(null)}>
        <Pressable style={styles.viewer} onPress={() => setViewer(null)}>
          {viewer && <Image source={{ uri: viewer }} style={styles.viewerImage} resizeMode="contain" />}
          <TouchableOpacity style={styles.viewerClose} onPress={() => setViewer(null)} accessibilityLabel="Close photo">
            <Feather name="x" size={26} color="#fff" />
          </TouchableOpacity>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
    gap: 6,
  },
  iconButton: { padding: 6 },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: '700' },
  headerSub: { color: '#888', fontSize: 12, marginTop: 1 },
  threadName: { color: '#fff', fontSize: 16, fontWeight: '600' },
  newButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(249,115,22,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#161616',
    borderRadius: 12,
    marginHorizontal: 16,
    marginVertical: 10,
    paddingHorizontal: 12,
  },
  searchInput: { flex: 1, color: '#fff', paddingVertical: 10, fontSize: 14 },
  convRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  convName: { color: '#fff', fontSize: 15, fontWeight: '600', flexShrink: 1 },
  convTime: { color: '#777', fontSize: 12 },
  convPreview: { color: '#888', fontSize: 13, marginTop: 3, flexShrink: 1 },
  roleTag: { color: ORANGE, fontSize: 12 },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: ORANGE,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    marginTop: 3,
  },
  unreadText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  avatar: { backgroundColor: '#262626', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontWeight: '700' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, gap: 8 },
  emptyTitle: { color: '#fff', fontSize: 17, fontWeight: '600', marginTop: 8, textAlign: 'center' },
  emptyText: { color: '#888', fontSize: 13, textAlign: 'center', lineHeight: 19 },
  sheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#111', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16, maxHeight: '85%', minHeight: '60%' },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  sheetTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  personRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  rolePill: {
    color: ORANGE,
    fontSize: 11,
    fontWeight: '600',
    backgroundColor: 'rgba(249,115,22,0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    overflow: 'hidden',
  },
  thread: { paddingHorizontal: 12, paddingVertical: 10 },
  dayRow: { alignItems: 'center', marginVertical: 10 },
  dayText: { color: '#999', fontSize: 11, backgroundColor: '#161616', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, overflow: 'hidden' },
  msgRow: { flexDirection: 'row', marginVertical: 2 },
  mineRow: { justifyContent: 'flex-end' },
  theirRow: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '80%', borderRadius: 18, paddingHorizontal: 12, paddingVertical: 8 },
  mineBubble: { backgroundColor: ORANGE, borderBottomRightRadius: 4 },
  theirBubble: { backgroundColor: '#1c1c1c', borderBottomLeftRadius: 4 },
  photoBubble: { padding: 4 },
  photo: { width: 220, height: 220, borderRadius: 14, backgroundColor: '#222' },
  photoLoading: { alignItems: 'center', justifyContent: 'center' },
  uploading: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
  msgText: { color: '#fff', fontSize: 15, lineHeight: 21 },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 2, paddingBottom: 2 },
  msgTime: { color: '#888', fontSize: 10 },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#1a1a1a',
    gap: 8,
  },
  attachButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: '#161616' },
  input: {
    flex: 1,
    maxHeight: 120,
    backgroundColor: '#161616',
    color: '#fff',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 15,
  },
  sendButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center' },
  viewer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', alignItems: 'center', justifyContent: 'center' },
  viewerImage: { width: '100%', height: '80%' },
  viewerClose: { position: 'absolute', top: 50, right: 20, padding: 8 },
});
