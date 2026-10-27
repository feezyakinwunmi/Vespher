// app/voice/VoiceAssistantContext.tsx
// Hands-free ordering: listen → send to the voice-assistant edge function → speak the
// reply → carry out cart/checkout actions → listen again, until the customer is done.
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, Animated, Easing, Linking, ScrollView, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Speech from 'expo-speech';
import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';
import { useLocation } from '../contexts/LocationContext';
import { usePaystackCheckout } from '../contexts/PaystackCheckoutContext';
import { supabase } from '../lib/supabase';
import { functionErrorMessage } from '../utils/paystack';
import { navigate, openOrder } from '../navigation/RootNavigation';
import { buildVoiceCheckout, cancelUnpaid, loadSavedCards, placeVoiceOrder, addressLabel, type VoiceCheckout } from '../services/voiceOrder';
import type { Product } from '../types';
import { speechRecognition } from './native';

type Phase = 'idle' | 'listening' | 'thinking' | 'speaking' | 'error';

interface Turn {
  who: 'you' | 'vesphe';
  text: string;
}

interface VoiceValue {
  // Voice can run on this phone (installed app, not Expo Go) for a customer.
  available: boolean;
  // Show voice entry points (mic button) to this user.
  visible: boolean;
  isOpen: boolean;
  open: () => void;
  close: () => void;
}

const VoiceContext = createContext<VoiceValue>({ available: false, visible: false, isOpen: false, open: () => {}, close: () => {} });
export const useVoiceAssistant = () => useContext(VoiceContext);

const MAX_SILENT_TRIES = 2;
const ORANGE = '#f97316';

// Words that help the recogniser with local dish names.
const CONTEXT_WORDS = ['Vesphe', 'jollof', 'egusi', 'efo riro', 'moi moi', 'suya', 'puff-puff', 'amala', 'eba', 'pounded yam', 'ofada', 'pepper soup', 'shawarma', 'dodo', 'akara', 'naira'];

let preferredVoice: string | undefined;
async function pickVoice() {
  if (preferredVoice !== undefined) return preferredVoice;
  try {
    const voices = await Speech.getAvailableVoicesAsync();
    const byLang = (lang: string) => voices.find(v => v.language?.toLowerCase().replace('_', '-') === lang);
    preferredVoice = (byLang('en-ng') || byLang('en-gb') || byLang('en-us'))?.identifier || '';
  } catch {
    preferredVoice = '';
  }
  return preferredVoice;
}

export function VoiceAssistantProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const cart = useCart();
  const { calculateDeliveryToVendor } = useLocation();
  const { pay } = usePaystackCheckout();
  const sr = speechRecognition();
  const available = !!sr && user?.role === 'customer';
  const visible = user?.role === 'customer';

  const [isOpen, setIsOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>('idle');
  const [partial, setPartial] = useState('');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [errorText, setErrorText] = useState('');
  const [trialLeft, setTrialLeft] = useState<number | null>(null);

  // Live values for async callbacks.
  const cartRef = useRef(cart);
  cartRef.current = cart;
  const openRef = useRef(false);
  const history = useRef<any[]>([]);
  const checkoutRef = useRef<VoiceCheckout | null>(null);
  const silentTries = useRef(0);
  const heard = useRef('');
  const endAfterSpeaking = useRef(false);
  const contextExtras = useRef<{ address: string | null; cards: { id: string; brand: string | null; last4: string }[] }>({ address: null, cards: [] });

  const addTurn = (who: Turn['who'], text: string) => setTurns(prev => [...prev.slice(-12), { who, text }]);

  // ---------------------------------------------------------------- speaking
  const speak = useCallback(async (text: string) => {
    if (!text || !openRef.current) return;
    setPhase('speaking');
    addTurn('vesphe', text);
    const voice = await pickVoice();
    await new Promise<void>(resolve => {
      Speech.speak(text, {
        voice: voice || undefined,
        language: voice ? undefined : 'en-GB',
        rate: 1.0,
        onDone: () => resolve(),
        onStopped: () => resolve(),
        onError: () => resolve(),
      });
    });
  }, []);

  // ---------------------------------------------------------------- listening
  const listen = useCallback(async () => {
    if (!sr || !openRef.current) return;
    heard.current = '';
    setPartial('');
    setPhase('listening');
    try {
      sr.ExpoSpeechRecognitionModule.start({
        lang: 'en-NG',
        interimResults: true,
        continuous: false,
        contextualStrings: CONTEXT_WORDS,
        addsPunctuation: false,
      });
    } catch (e) {
      console.error('Speech start failed', e);
      setPhase('error');
      setErrorText("I couldn't start the microphone.");
    }
  }, [sr]);

  const close = useCallback(() => {
    openRef.current = false;
    setIsOpen(false);
    setPhase('idle');
    Speech.stop();
    try {
      sr?.ExpoSpeechRecognitionModule.abort();
    } catch {
      // not listening
    }
  }, [sr]);

  // ---------------------------------------------------------------- actions run on the phone
  const runAction = useCallback(async (name: string, input: any): Promise<string> => {
    const c = cartRef.current;
    switch (name) {
      case 'add_to_cart': {
        const { data: p } = await supabase
          .from('products')
          .select('id, vendor_id, name, description, price, original_price, image_url, category, is_available, ingredients, allergens, health_tags, meal_times, preparation_time, vendor:vendor_id(name, is_open)')
          .eq('id', String(input?.dish_id || ''))
          .eq('is_available', true)
          .maybeSingle();
        if (!p) return 'Error: that dish is not available.';
        if (c.vendorId && c.items.length && c.vendorId !== p.vendor_id) {
          return `Error: the cart has dishes from another vendor. Ask the customer if you should clear the cart first.`;
        }
        const quantity = Math.max(1, Math.min(20, Number(input?.quantity) || 1));
        const product: Product = {
          id: p.id,
          vendorId: p.vendor_id,
          name: p.name,
          description: p.description || '',
          price: p.price,
          originalPrice: p.original_price || undefined,
          image: p.image_url || '',
          image_url: p.image_url || undefined,
          category: p.category || 'Other',
          isAvailable: true,
          ingredients: p.ingredients || [],
          allergens: p.allergens || [],
          health_tags: p.health_tags || [],
          meal_times: p.meal_times || [],
        };
        await c.addItem(product, quantity);
        await new Promise(r => setTimeout(r, 80)); // let the cart state settle
        return `Added ${quantity} x ${p.name} (${p.price} naira each). Cart subtotal is now ${cartRef.current.getSubtotal()} naira.`;
      }
      case 'remove_from_cart': {
        const id = String(input?.dish_id || '');
        const item = c.items.find(i => i.product.id === id);
        if (!item) return 'Error: that dish is not in the cart.';
        const q = Number(input?.quantity);
        if (q > 0) c.updateQuantity(id, q);
        else c.removeItem(id);
        await new Promise(r => setTimeout(r, 80));
        return q > 0 ? `${item.product.name} set to ${q}.` : `Removed ${item.product.name}.`;
      }
      case 'clear_cart':
        c.clearCart();
        await new Promise(r => setTimeout(r, 80));
        return 'Cart cleared.';
      case 'get_checkout_summary': {
        if (!user?.id) return 'Error: not signed in.';
        const co = await buildVoiceCheckout(user.id, c.items, c.vendorId, calculateDeliveryToVendor);
        checkoutRef.current = co;
        return JSON.stringify({
          ready: co.ok,
          problems: co.problems,
          vendor: co.vendor?.name,
          items: c.items.map(i => `${i.quantity} x ${i.product.name}`),
          subtotal_naira: co.subtotal,
          delivery_fee_naira: co.deliveryFee,
          discount_naira: co.discount,
          discount_reason: co.discount ? (co.freeDelivery ? 'first order: 10% off and free delivery' : 'first order: 10% off') : null,
          total_naira: co.total,
          deliver_to: co.addressLabel,
          cash_on_delivery_allowed: co.cashAllowed,
          saved_cards: co.cards.map(card => ({ id: card.id, label: `${card.brand || 'card'} ending ${card.last4}` })),
          note: co.cards.length ? undefined : 'No saved card. For card payment the customer must pay once in the app and tick "save this card".',
        });
      }
      case 'place_order': {
        if (!user?.id) return 'Error: not signed in.';
        if (input?.customer_confirmed !== true) return 'Error: ask the customer to confirm the order first.';
        // Re-check against the current cart; the summary they confirmed must still match.
        const co = await buildVoiceCheckout(user.id, c.items, c.vendorId, calculateDeliveryToVendor);
        if (checkoutRef.current && checkoutRef.current.total !== co.total) {
          checkoutRef.current = co;
          return `Error: the total changed to ${co.total} naira. Read the new total and ask again.`;
        }
        const payment = input?.payment === 'saved_card' ? 'saved_card' : 'cash';
        const items = [...c.items];
        const result = await placeVoiceOrder(user.id, items, co, payment, input?.card_id, input?.note_for_vendor);
        if (result.status === 'failed') return `Error: ${result.message}`;
        if (result.status === 'needs_checkout') {
          await speak("Your bank wants you to confirm this payment. I've opened the payment page for you.");
          const paid = await pay('order', result.orderId, {});
          if (paid.status !== 'paid' && paid.status !== 'pending') {
            await cancelUnpaid(result.orderId, 'Payment not completed');
            return 'Error: the customer did not complete the card payment, so the order was cancelled.';
          }
        }
        c.clearCart();
        checkoutRef.current = null;
        endAfterSpeaking.current = true;
        setTimeout(() => openOrder('customer', result.orderId), 400);
        return `Order placed${'orderNumber' in result && result.orderNumber ? ` (number ${result.orderNumber})` : ''}. ${payment === 'cash' ? 'Pay cash on delivery.' : 'Paid by card.'} The vendor has been notified.`;
      }
      case 'end_conversation':
        endAfterSpeaking.current = true;
        return 'Ending.';
      default:
        return `Error: unknown action ${name}`;
    }
  }, [user?.id, calculateDeliveryToVendor, pay, speak]);

  // Free voice orders used up (or monthly limit): explain and offer Pro Max.
  const showUpsell = useCallback((message: string, code?: string) => {
    Alert.alert(
      code === 'monthly_limit' ? 'Voice limit reached' : 'Vesphe Pro Max',
      message,
      code === 'pro_max_required'
        ? [
            { text: 'Not now', style: 'cancel' },
            { text: 'See Pro Max', onPress: () => navigate('Pro', { tier: 'pro_max' }) },
          ]
        : [{ text: 'OK' }]
    );
  }, []);

  // ---------------------------------------------------------------- one round trip
  const send = useCallback(async (userContent: any) => {
    if (!openRef.current) return;
    setPhase('thinking');
    // Consecutive user turns are merged (the API expects alternating turns).
    const last = history.current[history.current.length - 1];
    if (last?.role === 'user') {
      const prev = Array.isArray(last.content) ? last.content : [{ type: 'text', text: last.content }];
      const next = Array.isArray(userContent) ? userContent : [{ type: 'text', text: userContent }];
      last.content = [...prev, ...next];
    } else {
      history.current.push({ role: 'user', content: userContent });
    }

    const c = cartRef.current;
    const { data, error } = await supabase.functions.invoke('voice-assistant', {
      body: {
        messages: history.current,
        context: {
          cart: c.items.map(i => ({ dish_id: i.product.id, name: i.product.name, quantity: i.quantity, price: i.product.price })),
          address: contextExtras.current.address,
          saved_cards: contextExtras.current.cards,
        },
      },
    });
    if (!openRef.current) return;
    if (error || !data?.messages) {
      let code: string | undefined;
      try {
        code = (await (error as any)?.context?.clone?.().json?.())?.code;
      } catch {
        // not JSON
      }
      const message = error ? await functionErrorMessage(error, 'Voice ordering is unavailable right now') : 'Voice ordering is unavailable right now';
      if (code === 'pro_max_required' || code === 'monthly_limit') {
        await speak(message);
        close();
        showUpsell(message, code);
        return;
      }
      history.current = [];
      setPhase('error');
      setErrorText(message);
      await speak(message);
      return;
    }

    history.current = data.messages;
    if (data.say) await speak(data.say);
    if (!openRef.current) return;

    const actions: { id: string; name: string; input: any }[] = data.actions || [];
    if (actions.length) {
      const results = [...(data.results || [])];
      for (const action of actions) {
        const content = await runAction(action.name, action.input);
        results.push({ type: 'tool_result', tool_use_id: action.id, content });
      }
      if (endAfterSpeaking.current && actions.every(a => a.name === 'end_conversation')) {
        close();
        return;
      }
      await send(results);
      return;
    }

    if (endAfterSpeaking.current) {
      close();
      return;
    }
    listen();
  }, [speak, runAction, listen, close, showUpsell]);

  // ---------------------------------------------------------------- speech events
  useEffect(() => {
    if (!sr) return;
    const subs = [
      sr.ExpoSpeechRecognitionModule.addListener('result', (e: any) => {
        const text = e.results?.[0]?.transcript || '';
        setPartial(text);
        if (e.isFinal) heard.current = text;
      }),
      sr.ExpoSpeechRecognitionModule.addListener('end', () => {
        if (!openRef.current) return;
        const text = heard.current.trim();
        if (text) {
          silentTries.current = 0;
          addTurn('you', text);
          setPartial('');
          send(text);
        } else if (++silentTries.current > MAX_SILENT_TRIES) {
          speak("I'll be here when you need me. Just say Hey Vesphe.").then(close);
        } else {
          speak('Sorry, I didn’t catch that. What would you like?').then(listen);
        }
      }),
      sr.ExpoSpeechRecognitionModule.addListener('error', (e: any) => {
        if (e.error === 'aborted' || e.error === 'no-speech') return; // "end" follows
        if (e.error === 'not-allowed') {
          setPhase('error');
          setErrorText('Microphone permission is off. Turn it on in Settings to order by voice.');
        }
      }),
    ];
    return () => subs.forEach(s => s.remove());
  }, [sr, send, speak, listen, close]);

  // ---------------------------------------------------------------- open
  const open = useCallback(async () => {
    if (openRef.current || user?.role !== 'customer') return;
    if (!sr) {
      Alert.alert(
        'Voice ordering',
        Platform.OS === 'ios'
          ? 'Voice ordering needs the Vesphe app from the App Store or TestFlight. It does not work inside Expo Go.'
          : 'Voice ordering needs the Vesphe app from Google Play or a test build. It does not work inside Expo Go.'
      );
      return;
    }
    // Pro Max, or free trial orders left?
    const { data: access } = await supabase.rpc('voice_access');
    if (access && !access.allowed) {
      showUpsell(
        access.reason === 'monthly_limit'
          ? "You've used this month's voice ordering. It resets on the 1st, and you can still order by tapping."
          : access.reason === 'disabled'
          ? 'Voice ordering is turned off right now.'
          : `You've used your free voice orders. Vesphe Pro Max lets you keep ordering hands-free from ₦${Number(access.pro_max_monthly_price || 0).toLocaleString()} a month.`,
        access.reason === 'trial_used' ? 'pro_max_required' : access.reason
      );
      return;
    }
    setTrialLeft(access && !access.pro_max ? Number(access.trial_orders_left) : null);
    const perm = await sr.ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!perm.granted) {
      setIsOpen(true);
      setPhase('error');
      setErrorText('Vesphe needs the microphone to take your order by voice. Allow it in Settings.');
      return;
    }
    openRef.current = true;
    history.current = [];
    checkoutRef.current = null;
    silentTries.current = 0;
    endAfterSpeaking.current = false;
    setTurns([]);
    setErrorText('');
    setIsOpen(true);

    // Context the assistant can mention without extra round trips.
    const [{ data: addr }, cards] = await Promise.all([
      supabase.from('addresses').select('*').eq('user_id', user.id).order('is_default', { ascending: false }).limit(1),
      loadSavedCards(),
    ]);
    contextExtras.current = { address: addressLabel(addr?.[0]), cards };

    const firstName = (user.name || '').split(' ')[0];
    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
    await speak(`${greeting}${firstName ? ` ${firstName}` : ''}! What would you like to eat today?`);
    listen();
  }, [sr, user, speak, listen, showUpsell]);

  // vesphe://voice (Siri / Google shortcut, notification, link) opens voice ordering.
  useEffect(() => {
    if (!available) return;
    const handle = (url: string | null | undefined) => {
      if (url && /^vesphe:\/\/+voice/i.test(url)) open();
    };
    Linking.getInitialURL().then(handle);
    const sub = Linking.addEventListener('url', e => handle(e.url));
    return () => sub.remove();
  }, [available, open]);

  const tapOrb = () => {
    if (phase === 'speaking') {
      Speech.stop();
      listen();
    } else if (phase === 'listening') {
      sr?.ExpoSpeechRecognitionModule.stop();
    } else if (phase === 'error' || phase === 'idle') {
      setErrorText('');
      if (!openRef.current) open();
      else listen();
    }
  };

  return (
    <VoiceContext.Provider value={{ available, visible, isOpen, open, close }}>
      {children}
      <Modal visible={isOpen} animationType="fade" transparent onRequestClose={close}>
        <View style={styles.overlay}>
          <SafeAreaView style={styles.sheet}>
            <View style={styles.topRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={styles.brand}>Vesphe voice</Text>
                {trialLeft !== null && (
                  <Text style={styles.trialBadge}>Free trial · {trialLeft} order{trialLeft === 1 ? '' : 's'} left</Text>
                )}
              </View>
              <TouchableOpacity onPress={close} style={styles.closeBtn} accessibilityLabel="Close voice ordering">
                <Feather name="x" size={22} color="#fff" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.transcript} contentContainerStyle={{ paddingBottom: 12 }}>
              {turns.map((t, i) => (
                <Text key={i} style={t.who === 'you' ? styles.youText : styles.vespheText}>
                  {t.who === 'you' ? 'You: ' : ''}
                  {t.text}
                </Text>
              ))}
              {!!partial && <Text style={[styles.youText, { opacity: 0.6 }]}>You: {partial}</Text>}
            </ScrollView>

            <Orb phase={phase} onPress={tapOrb} />
            <Text style={styles.status}>
              {phase === 'listening' ? 'Listening…' : phase === 'thinking' ? 'Thinking…' : phase === 'speaking' ? 'Tap to interrupt' : phase === 'error' ? errorText || 'Something went wrong' : 'Tap to talk'}
            </Text>
            <Text style={styles.hint}>Try “What’s good for lunch?” or “Order two jollof rice”</Text>
          </SafeAreaView>
        </View>
      </Modal>
    </VoiceContext.Provider>
  );
}

function Orb({ phase, onPress }: { phase: Phase; onPress: () => void }) {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (phase === 'listening' || phase === 'speaking' || phase === 'thinking') {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1, duration: phase === 'thinking' ? 500 : 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 0, duration: phase === 'thinking' ? 500 : 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        ])
      );
      loop.start();
      return () => loop.stop();
    }
    pulse.setValue(0);
  }, [phase, pulse]);

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, phase === 'listening' ? 1.25 : 1.12] });
  const icon = phase === 'listening' ? 'mic' : phase === 'thinking' ? 'more-horizontal' : phase === 'speaking' ? 'volume-2' : phase === 'error' ? 'refresh-cw' : 'mic';
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={styles.orbWrap} accessibilityLabel="Voice button">
      <Animated.View style={[styles.orbGlow, { transform: [{ scale }] }]} />
      <View style={[styles.orb, phase === 'error' && { backgroundColor: '#444' }]}>
        <Feather name={icon} size={38} color="#fff" />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)' },
  sheet: { flex: 1, alignItems: 'center', paddingHorizontal: 24, paddingBottom: 40 },
  topRow: { flexDirection: 'row', alignSelf: 'stretch', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 },
  brand: { color: ORANGE, fontSize: 16, fontWeight: '700' },
  closeBtn: { padding: 6 },
  trialBadge: { color: '#fff', fontSize: 11, backgroundColor: 'rgba(124,58,237,0.6)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, overflow: 'hidden' },
  transcript: { alignSelf: 'stretch', flex: 1, marginTop: 8 },
  vespheText: { color: '#fff', fontSize: 20, lineHeight: 28, marginBottom: 14, fontWeight: '500' },
  youText: { color: '#9ca3af', fontSize: 16, lineHeight: 22, marginBottom: 14 },
  orbWrap: { width: 160, height: 160, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  orbGlow: { position: 'absolute', width: 150, height: 150, borderRadius: 75, backgroundColor: 'rgba(249,115,22,0.25)' },
  orb: { width: 108, height: 108, borderRadius: 54, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center' },
  status: { color: '#fff', fontSize: 15, marginTop: 14, textAlign: 'center' },
  hint: { color: '#6b7280', fontSize: 12, marginTop: 6, textAlign: 'center' },
});
