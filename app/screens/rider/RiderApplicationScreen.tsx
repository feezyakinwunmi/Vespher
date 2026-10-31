// app/screens/rider/RiderApplicationScreen.tsx
// "Become a rider": shows the status of the latest application, or walks the
// applicant through a step-by-step form. Approval happens in the admin app/web.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Image,
  Alert,
  Modal,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useNavigation } from '@react-navigation/native';
import { format } from 'date-fns';
import Toast from 'react-native-toast-message';
import { useAuth } from '../../contexts/AuthContext';
import { BANKS, Bank } from '../../constants/banks';
import { verifyBankAccount } from '../../utils/paystack';
import { supportLinks } from '../../config/support';
import {
  RiderApplication,
  VEHICLE_TYPES,
  OWNERSHIP_TYPES,
  ID_TYPES,
  labelFor,
  fetchMyLatestApplication,
  submitApplication,
  uploadApplicationPhoto,
  RIDERS_BRING_OWN_VEHICLE,
} from '../../services/riderApplications';
import { getRiderShares } from '../../services/riderOrders';
import { R } from '../../components/rider/ui';
import { ModalSafeArea } from '../../components/ModalSafeArea';

type IconName = React.ComponentProps<typeof Feather>['name'];

const ALL_STEPS = ['You', 'Vehicle', 'Licence & ID', 'Guarantor', 'Bank', 'Review'] as const;
type StepKey = (typeof ALL_STEPS)[number];
// No Vehicle step while riders use company bikes.
const STEPS: StepKey[] = RIDERS_BRING_OWN_VEHICLE ? [...ALL_STEPS] : ALL_STEPS.filter(s => s !== 'Vehicle');

interface Form {
  full_name: string;
  phone: string;
  date_of_birth: Date | null;
  address: string;
  city: string;
  selfie: string | null;
  vehicle_type: string;
  vehicle_make: string;
  vehicle_model: string;
  vehicle_year: string;
  vehicle_color: string;
  vehicle_number: string;
  vehicle_ownership: string;
  vehicle_owner_name: string;
  vehicle_owner_phone: string;
  vehicle_photo: string | null;
  vehicle_papers: string | null;
  license_number: string;
  license_expiry: Date | null;
  license_photo: string | null;
  id_type: string;
  id_number: string;
  id_photo: string | null;
  guarantor_name: string;
  guarantor_phone: string;
  guarantor_relationship: string;
  guarantor_address: string;
  bank: Bank | null;
  account_number: string;
  account_name: string;
}

const emptyForm = (name = '', phone = ''): Form => ({
  full_name: name,
  phone,
  date_of_birth: null,
  address: '',
  city: '',
  selfie: null,
  vehicle_type: '',
  vehicle_make: '',
  vehicle_model: '',
  vehicle_year: '',
  vehicle_color: '',
  vehicle_number: '',
  vehicle_ownership: '',
  vehicle_owner_name: '',
  vehicle_owner_phone: '',
  vehicle_photo: null,
  vehicle_papers: null,
  license_number: '',
  license_expiry: null,
  license_photo: null,
  id_type: '',
  id_number: '',
  id_photo: null,
  guarantor_name: '',
  guarantor_phone: '',
  guarantor_relationship: '',
  guarantor_address: '',
  bank: null,
  account_number: '',
  account_name: '',
});

// Re-applying after a rejection starts from the previous answers (photos are re-taken).
const formFromApplication = (a: RiderApplication): Form => ({
  ...emptyForm(a.full_name || '', a.phone || ''),
  date_of_birth: a.date_of_birth ? new Date(a.date_of_birth) : null,
  address: a.address || '',
  city: a.city || '',
  vehicle_type: a.vehicle_type || '',
  vehicle_make: a.vehicle_make || '',
  vehicle_model: a.vehicle_model || '',
  vehicle_year: a.vehicle_year ? String(a.vehicle_year) : '',
  vehicle_color: a.vehicle_color || '',
  vehicle_number: a.vehicle_number || '',
  vehicle_ownership: a.vehicle_ownership || '',
  vehicle_owner_name: a.vehicle_owner_name || '',
  vehicle_owner_phone: a.vehicle_owner_phone || '',
  license_number: a.license_number || '',
  license_expiry: a.license_expiry ? new Date(a.license_expiry) : null,
  id_type: a.id_type || '',
  id_number: a.id_number || '',
  guarantor_name: a.guarantor_name || '',
  guarantor_phone: a.guarantor_phone || '',
  guarantor_relationship: a.guarantor_relationship || '',
  guarantor_address: a.guarantor_address || '',
  bank: BANKS.find(b => b.code === a.bank_code || b.label === a.bank_name) || null,
  account_number: a.account_number || '',
  account_name: a.account_name || '',
});

const ageFrom = (d: Date) => {
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  if (now < new Date(now.getFullYear(), d.getMonth(), d.getDate())) age--;
  return age;
};

export function RiderApplicationScreen() {
  const navigation = useNavigation();
  const { user, refreshProfile } = useAuth();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [latest, setLatest] = useState<RiderApplication | null>(null);
  const [applying, setApplying] = useState(false);
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<Form>(emptyForm(user?.name, user?.phone));
  const [error, setError] = useState<string | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [bankPicker, setBankPicker] = useState(false);
  const [bankSearch, setBankSearch] = useState('');
  const [datePicker, setDatePicker] = useState<'dob' | 'expiry' | null>(null);

  const load = useCallback(async () => {
    if (!user?.id) return;
    try {
      const app = await fetchMyLatestApplication(user.id);
      setLatest(app);
      // Approved while the app was open: reload the profile so the rider screens open.
      if (app?.status === 'approved') await refreshProfile();
    } catch (e) {
      console.error('Error loading application:', e);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const set = <K extends keyof Form>(key: K, value: Form[K]) => {
    setForm(f => ({ ...f, [key]: value }));
    setError(null);
  };

  const key = STEPS[step];
  const goTo = (k: StepKey) => setStep(Math.max(0, STEPS.indexOf(k)));
  const isBicycle = RIDERS_BRING_OWN_VEHICLE && form.vehicle_type === 'bicycle';
  const needsOwner = RIDERS_BRING_OWN_VEHICLE && !!form.vehicle_ownership && form.vehicle_ownership !== 'personal';

  // What riders on company bikes earn, from Admin → Settings.
  const [companyShare, setCompanyShare] = useState<number | null>(null);
  useEffect(() => {
    getRiderShares().then(s => setCompanyShare(s.company)).catch(() => {});
  }, []);

  // Resolve the account name once there's a bank and 10 digits.
  useEffect(() => {
    if (!form.bank || form.account_number.length !== 10) return;
    let cancelled = false;
    setVerifying(true);
    setForm(f => ({ ...f, account_name: '' }));
    verifyBankAccount(form.account_number, form.bank.code).then(res => {
      if (cancelled) return;
      setVerifying(false);
      if (res.status === 'success' && res.data) setForm(f => ({ ...f, account_name: res.data!.account_name }));
      else setError(res.message || 'Could not verify this account');
    });
    return () => {
      cancelled = true;
    };
  }, [form.bank, form.account_number]);

  const validate = (): string | null => {
    const f = form;
    const phoneOk = (p: string) => p.replace(/\D/g, '').length >= 10;
    switch (key) {
      case 'You':
        if (f.full_name.trim().split(/\s+/).length < 2) return 'Enter your full name (first and last name).';
        if (!phoneOk(f.phone)) return 'Enter a valid phone number.';
        if (!f.date_of_birth) return 'Add your date of birth.';
        if (ageFrom(f.date_of_birth) < 18) return 'You must be at least 18 to ride with Vesphe.';
        if (!f.address.trim() || !f.city.trim()) return 'Add your home address and city.';
        if (!f.selfie) return 'Take a clear selfie so customers can recognise you.';
        return null;
      case 'Vehicle':
        if (!f.vehicle_type) return 'Choose your vehicle type.';
        if (!isBicycle) {
          if (!f.vehicle_make.trim() || !f.vehicle_model.trim()) return 'Add the vehicle make and model.';
          const year = parseInt(f.vehicle_year, 10);
          if (!year || year < 1980 || year > new Date().getFullYear() + 1) return 'Enter a valid vehicle year.';
          if (!f.vehicle_number.trim()) return 'Add the plate number.';
        }
        if (!f.vehicle_color.trim()) return 'Add the vehicle colour.';
        if (!f.vehicle_ownership) return 'Tell us who owns the vehicle.';
        if (needsOwner && (!f.vehicle_owner_name.trim() || !phoneOk(f.vehicle_owner_phone))) return "Add the owner's name and phone number.";
        if (!f.vehicle_photo) return 'Add a photo of the vehicle with the plate number visible.';
        if (!isBicycle && !f.vehicle_papers) return 'Add a photo of the vehicle papers (registration or proof of ownership).';
        return null;
      case 'Licence & ID':
        if (!isBicycle) {
          if (!f.license_number.trim()) return "Add your driver's licence number.";
          if (!f.license_expiry) return 'Add the licence expiry date.';
          if (f.license_expiry < new Date()) return 'Your licence has expired. Renew it before applying.';
          if (!f.license_photo) return 'Add a photo of your licence.';
        }
        if (!f.id_type || !f.id_number.trim()) return 'Choose an ID type and enter its number.';
        if (!f.id_photo) return 'Add a photo of your ID.';
        return null;
      case 'Guarantor':
        if (!f.guarantor_name.trim() || !phoneOk(f.guarantor_phone)) return "Add your guarantor's name and phone number.";
        if (f.guarantor_phone.replace(/\D/g, '').slice(-10) === f.phone.replace(/\D/g, '').slice(-10)) return 'Your guarantor needs a different phone number from yours.';
        if (!f.guarantor_relationship.trim() || !f.guarantor_address.trim()) return "Add how you know them and their address.";
        return null;
      case 'Bank':
        if (!f.bank || f.account_number.length !== 10) return 'Choose your bank and enter your 10-digit account number.';
        if (!f.account_name) return 'Wait for your account to be verified.';
        return null;
      default:
        return agreed ? null : 'Please confirm the details are correct.';
    }
  };

  const next = () => {
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    if (step < STEPS.length - 1) setStep(step + 1);
    else submit();
  };

  const back = () => {
    setError(null);
    if (step > 0) setStep(step - 1);
    else if (applying && latest) setApplying(false);
    else navigation.goBack();
  };

  const submit = async () => {
    if (!user?.id) return;
    setSubmitting(true);
    try {
      const up = async (uri: string | null, name: string) => {
        if (!uri) return null;
        setProgress(`Uploading ${name.replace(/-/g, ' ')}…`);
        return uploadApplicationPhoto(user.id, uri, name);
      };
      const selfie_url = await up(form.selfie, 'selfie');
      const vehicle_photo_url = await up(form.vehicle_photo, 'vehicle');
      const vehicle_papers_url = await up(form.vehicle_papers, 'vehicle-papers');
      const license_photo_url = await up(form.license_photo, 'licence');
      const id_card_url = await up(form.id_photo, 'id');

      setProgress('Sending application…');
      await submitApplication(user.id, {
        full_name: form.full_name.trim(),
        phone: form.phone.trim(),
        email: user.email,
        date_of_birth: form.date_of_birth ? format(form.date_of_birth, 'yyyy-MM-dd') : null,
        address: form.address.trim(),
        city: form.city.trim(),
        selfie_url,
        vehicle_type: RIDERS_BRING_OWN_VEHICLE ? form.vehicle_type : 'motorcycle',
        vehicle_make: form.vehicle_make.trim() || null,
        vehicle_model: form.vehicle_model.trim() || null,
        vehicle_year: parseInt(form.vehicle_year, 10) || null,
        vehicle_color: form.vehicle_color.trim() || null,
        vehicle_number: form.vehicle_number.trim().toUpperCase() || null,
        vehicle_ownership: RIDERS_BRING_OWN_VEHICLE ? form.vehicle_ownership : 'company',
        vehicle_owner_name: needsOwner ? form.vehicle_owner_name.trim() : null,
        vehicle_owner_phone: needsOwner ? form.vehicle_owner_phone.trim() : null,
        vehicle_photo_url,
        vehicle_papers_url,
        license_number: form.license_number.trim() || null,
        license_expiry: form.license_expiry ? format(form.license_expiry, 'yyyy-MM-dd') : null,
        license_photo_url,
        id_type: form.id_type,
        id_number: form.id_number.trim(),
        id_card_url,
        guarantor_name: form.guarantor_name.trim(),
        guarantor_phone: form.guarantor_phone.trim(),
        guarantor_relationship: form.guarantor_relationship.trim(),
        guarantor_address: form.guarantor_address.trim(),
        bank_name: form.bank?.label || null,
        bank_code: form.bank?.code || null,
        account_number: form.account_number,
        account_name: form.account_name,
      });
      Toast.show({ type: 'success', text1: 'Application sent', text2: "We'll notify you once it's reviewed." });
      setApplying(false);
      setStep(0);
      await load();
    } catch (e: any) {
      setError(e?.message || 'Could not send your application. Please try again.');
    } finally {
      setSubmitting(false);
      setProgress('');
    }
  };

  const startApplying = () => {
    setForm(latest?.status === 'rejected' ? formFromApplication(latest) : emptyForm(user?.name, user?.phone));
    setStep(0);
    setAgreed(false);
    setError(null);
    setApplying(true);
  };

  const filteredBanks = useMemo(() => BANKS.filter(b => b.label.toLowerCase().includes(bankSearch.toLowerCase())), [bankSearch]);

  // -------------------------------------------------------------------------

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={R.orange} />
      </View>
    );
  }

  // Status / intro
  if (!applying) {
    const status = latest?.status;
    return (
      <SafeAreaView style={styles.container}>
        <Header title="Ride with Vesphe" onBack={() => navigation.goBack()} />
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={R.orange} />}
        >
          {status === 'pending' ? (
            <StatusCard
              icon="clock"
              color={R.amber}
              title="Application under review"
              body={`We received your application on ${format(new Date(latest!.created_at), 'd MMM yyyy')}. Reviews usually take 1–3 working days. We'll notify you as soon as it's done. Pull down to check for updates.`}
            />
          ) : status === 'approved' ? (
            <StatusCard icon="check-circle" color={R.green} title="You're approved!" body="Opening your rider dashboard…" />
          ) : (
            <>
              {status === 'rejected' && (
                <StatusCard
                  icon="x-circle"
                  color={R.red}
                  title="Application not approved"
                  body={latest?.rejection_reason ? `Reason: ${latest.rejection_reason}` : 'Contact support to find out why, then apply again.'}
                />
              )}
              <LinearGradient colors={['#f97316', '#f43f5e']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
                <Feather name="truck" size={30} color="#fff" />
                <Text style={styles.heroTitle}>Earn delivering food in your city</Text>
                <Text style={styles.heroBody}>Choose when you ride, get paid for every delivery, and withdraw to your bank anytime.</Text>
              </LinearGradient>

              {!RIDERS_BRING_OWN_VEHICLE && (
                <View style={[styles.card, styles.bikeCard]}>
                  <View style={styles.bikeIcon}>
                    <Feather name="zap" size={18} color={R.orange} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.bikeTitle}>We provide the motorcycle</Text>
                    <Text style={styles.bikeBody}>
                      You ride a Vesphe bike, so you don't need your own vehicle.
                      {companyShare !== null ? ` You earn ${companyShare}% of the delivery fee on every order.` : ''}
                    </Text>
                  </View>
                </View>
              )}

              <Text style={styles.group}>What you'll need</Text>
              <View style={styles.card}>
                {[
                  ['user', 'A clear selfie and a valid ID (NIN, voter\'s card, passport or licence)'],
                  ...(RIDERS_BRING_OWN_VEHICLE
                    ? [['truck', 'Your vehicle details, a photo of it and its papers'], ['credit-card', "A driver's licence (not needed for bicycles)"]]
                    : [['credit-card', 'A valid motorcycle riding licence']]),
                  ['users', 'A guarantor who can vouch for you'],
                  ['briefcase', 'A Nigerian bank account in your name'],
                ].map(([icon, text]) => (
                  <View key={text} style={styles.needRow}>
                    <Feather name={icon as IconName} size={16} color={R.orange} />
                    <Text style={styles.needText}>{text}</Text>
                  </View>
                ))}
              </View>
              <Text style={styles.small}>It takes about 10 minutes. You must be 18 or older.</Text>
            </>
          )}

          {status === 'pending' && (
            <TouchableOpacity style={styles.linkRow} onPress={() => Linking.openURL(supportLinks.whatsapp)}>
              <Feather name="message-circle" size={16} color={R.orange} />
              <Text style={styles.linkText}>Questions? Chat with support on WhatsApp</Text>
            </TouchableOpacity>
          )}
        </ScrollView>

        {status !== 'pending' && status !== 'approved' && (
          <Footer label={status === 'rejected' ? 'Apply again' : 'Start application'} onPress={startApplying} />
        )}
      </SafeAreaView>
    );
  }

  // Form
  return (
    <SafeAreaView style={styles.container}>
      <Header title={STEPS[step]} subtitle={`Step ${step + 1} of ${STEPS.length}`} onBack={back} />
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${((step + 1) / STEPS.length) * 100}%` }]} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {key === 'You' && (
            <>
              <PhotoField label="Selfie" hint="Face the camera in good light, no sunglasses or cap." value={form.selfie} onChange={v => set('selfie', v)} camera="front" round />
              <Input label="Full name" value={form.full_name} onChangeText={v => set('full_name', v)} placeholder="As it appears on your ID" autoCapitalize="words" />
              <Input label="Phone number" value={form.phone} onChangeText={v => set('phone', v)} placeholder="0801 234 5678" keyboardType="phone-pad" />
              <DateField label="Date of birth" value={form.date_of_birth} onPress={() => setDatePicker('dob')} />
              <Input label="Home address" value={form.address} onChangeText={v => set('address', v)} placeholder="House number, street, area" multiline />
              <Input label="City" value={form.city} onChangeText={v => set('city', v)} placeholder="e.g. Lagos" autoCapitalize="words" />
            </>
          )}

          {key === 'Vehicle' && (
            <>
              <Label text="Vehicle type" />
              <View style={styles.chips}>
                {VEHICLE_TYPES.map(v => (
                  <Chip key={v.value} label={v.label} icon={v.icon as IconName} active={form.vehicle_type === v.value} onPress={() => set('vehicle_type', v.value)} />
                ))}
              </View>
              {!!form.vehicle_type && (
                <>
                  <View style={styles.row2}>
                    <Input style={{ flex: 1 }} label={isBicycle ? 'Brand (optional)' : 'Make'} value={form.vehicle_make} onChangeText={v => set('vehicle_make', v)} placeholder={isBicycle ? 'e.g. Phoenix' : 'e.g. Bajaj, Toyota'} autoCapitalize="words" />
                    <Input style={{ flex: 1 }} label={isBicycle ? 'Model (optional)' : 'Model'} value={form.vehicle_model} onChangeText={v => set('vehicle_model', v)} placeholder={isBicycle ? '' : 'e.g. Boxer, Corolla'} autoCapitalize="words" />
                  </View>
                  <View style={styles.row2}>
                    <Input style={{ flex: 1 }} label={isBicycle ? 'Year (optional)' : 'Year'} value={form.vehicle_year} onChangeText={v => set('vehicle_year', v.replace(/\D/g, '').slice(0, 4))} placeholder="2019" keyboardType="number-pad" />
                    <Input style={{ flex: 1 }} label="Colour" value={form.vehicle_color} onChangeText={v => set('vehicle_color', v)} placeholder="e.g. Red" autoCapitalize="words" />
                  </View>
                  {!isBicycle && (
                    <Input label="Plate number" value={form.vehicle_number} onChangeText={v => set('vehicle_number', v.toUpperCase())} placeholder="e.g. LSR 123 AB" autoCapitalize="characters" />
                  )}
                  <Label text="Who owns the vehicle?" />
                  <View style={styles.chips}>
                    {OWNERSHIP_TYPES.map(o => (
                      <Chip key={o.value} label={o.label} active={form.vehicle_ownership === o.value} onPress={() => set('vehicle_ownership', o.value)} />
                    ))}
                  </View>
                  {needsOwner && (
                    <View style={styles.row2}>
                      <Input style={{ flex: 1 }} label="Owner's name" value={form.vehicle_owner_name} onChangeText={v => set('vehicle_owner_name', v)} autoCapitalize="words" />
                      <Input style={{ flex: 1 }} label="Owner's phone" value={form.vehicle_owner_phone} onChangeText={v => set('vehicle_owner_phone', v)} keyboardType="phone-pad" />
                    </View>
                  )}
                  <PhotoField label="Vehicle photo" hint={isBicycle ? 'A clear photo of your bicycle.' : 'Side view with the plate number clearly visible.'} value={form.vehicle_photo} onChange={v => set('vehicle_photo', v)} />
                  {!isBicycle && (
                    <PhotoField label="Vehicle papers" hint="Vehicle licence, registration or proof of ownership." value={form.vehicle_papers} onChange={v => set('vehicle_papers', v)} />
                  )}
                </>
              )}
            </>
          )}

          {key === 'Licence & ID' && (
            <>
              {!RIDERS_BRING_OWN_VEHICLE && (
                <View style={styles.note}>
                  <Feather name="info" size={15} color={R.blue} />
                  <Text style={styles.noteText}>You'll ride a Vesphe motorcycle, so you need a valid licence to ride one.</Text>
                </View>
              )}
              {isBicycle ? (
                <View style={styles.note}>
                  <Feather name="info" size={15} color={R.blue} />
                  <Text style={styles.noteText}>Bicycle riders don't need a driver's licence. Just add a valid ID.</Text>
                </View>
              ) : (
                <>
                  <Input label="Driver's licence number" value={form.license_number} onChangeText={v => set('license_number', v.toUpperCase())} autoCapitalize="characters" />
                  <DateField label="Licence expiry date" value={form.license_expiry} onPress={() => setDatePicker('expiry')} />
                  <PhotoField label="Driver's licence" hint="Front of the licence, all text readable." value={form.license_photo} onChange={v => set('license_photo', v)} />
                </>
              )}
              <Label text="ID type" />
              <View style={styles.chips}>
                {ID_TYPES.map(t => (
                  <Chip key={t.value} label={t.label} active={form.id_type === t.value} onPress={() => set('id_type', t.value)} />
                ))}
              </View>
              <Input label="ID number" value={form.id_number} onChangeText={v => set('id_number', v)} autoCapitalize="characters" />
              <PhotoField label="ID photo" hint="The whole card in frame, no glare." value={form.id_photo} onChange={v => set('id_photo', v)} />
            </>
          )}

          {key === 'Guarantor' && (
            <>
              <View style={styles.note}>
                <Feather name="info" size={15} color={R.blue} />
                <Text style={styles.noteText}>A guarantor is an adult who knows you well (not a fellow applicant). We may call them to confirm.</Text>
              </View>
              <Input label="Guarantor's full name" value={form.guarantor_name} onChangeText={v => set('guarantor_name', v)} autoCapitalize="words" />
              <Input label="Guarantor's phone" value={form.guarantor_phone} onChangeText={v => set('guarantor_phone', v)} keyboardType="phone-pad" />
              <Input label="How do you know them?" value={form.guarantor_relationship} onChangeText={v => set('guarantor_relationship', v)} placeholder="e.g. Uncle, employer, pastor" />
              <Input label="Guarantor's address" value={form.guarantor_address} onChangeText={v => set('guarantor_address', v)} multiline />
            </>
          )}

          {key === 'Bank' && (
            <>
              <Text style={styles.small}>Your earnings are paid into this account. It must be in your name.</Text>
              <Label text="Bank" />
              <TouchableOpacity style={styles.input} onPress={() => setBankPicker(true)}>
                <Text style={[styles.inputText, !form.bank && { color: R.faint }]}>{form.bank?.label || 'Select bank'}</Text>
                <Feather name="chevron-down" size={18} color={R.muted} />
              </TouchableOpacity>
              <Input label="Account number" value={form.account_number} onChangeText={v => set('account_number', v.replace(/\D/g, '').slice(0, 10))} keyboardType="number-pad" placeholder="10 digits" />
              <View style={styles.resolved}>
                {verifying ? (
                  <><ActivityIndicator size="small" color={R.orange} /><Text style={styles.resolvedText}>Checking account…</Text></>
                ) : form.account_name ? (
                  <><Feather name="check-circle" size={15} color={R.green} /><Text style={[styles.resolvedText, { color: R.green }]}>{form.account_name}</Text></>
                ) : null}
              </View>
            </>
          )}

          {key === 'Review' && (
            <>
              <ReviewBlock title="You" onEdit={() => goTo('You')} rows={[
                ['Name', form.full_name],
                ['Phone', form.phone],
                ['Date of birth', form.date_of_birth ? format(form.date_of_birth, 'd MMM yyyy') : ''],
                ['Address', `${form.address}, ${form.city}`],
              ]} />
              {RIDERS_BRING_OWN_VEHICLE && (
                <ReviewBlock title="Vehicle" onEdit={() => goTo('Vehicle')} rows={[
                  ['Type', labelFor(VEHICLE_TYPES, form.vehicle_type)],
                  ['Make & model', [form.vehicle_make, form.vehicle_model].filter(Boolean).join(' ') || '—'],
                  ['Year / colour', [form.vehicle_year, form.vehicle_color].filter(Boolean).join(' · ')],
                  ['Plate', form.vehicle_number || '—'],
                  ['Ownership', labelFor(OWNERSHIP_TYPES, form.vehicle_ownership) + (needsOwner ? ` (${form.vehicle_owner_name})` : '')],
                ]} />
              )}
              <ReviewBlock title="Licence & ID" onEdit={() => goTo('Licence & ID')} rows={[
                ['Licence', isBicycle ? 'Not needed' : `${form.license_number} · expires ${form.license_expiry ? format(form.license_expiry, 'd MMM yyyy') : ''}`],
                ['ID', `${labelFor(ID_TYPES, form.id_type)} · ${form.id_number}`],
              ]} />
              <ReviewBlock title="Guarantor" onEdit={() => goTo('Guarantor')} rows={[
                ['Name', `${form.guarantor_name} (${form.guarantor_relationship})`],
                ['Phone', form.guarantor_phone],
              ]} />
              <ReviewBlock title="Bank" onEdit={() => goTo('Bank')} rows={[
                ['Account', `${form.account_name} · ${form.bank?.label} · ${form.account_number}`],
              ]} />
              <TouchableOpacity style={styles.agree} onPress={() => { setAgreed(!agreed); setError(null); }}>
                <View style={[styles.checkbox, agreed && styles.checkboxOn]}>
                  {agreed && <Feather name="check" size={14} color="#fff" />}
                </View>
                <Text style={styles.agreeText}>I confirm these details are true and belong to me, and I agree to Vesphe's rider terms.</Text>
              </TouchableOpacity>
            </>
          )}

          {error ? (
            <View style={styles.error}>
              <Feather name="alert-circle" size={16} color={R.red} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}
        </ScrollView>

        <Footer label={step === STEPS.length - 1 ? 'Submit application' : 'Continue'} onPress={next} busy={submitting} busyText={progress} />
      </KeyboardAvoidingView>

      {datePicker && (
        <DateTimePicker
          value={(datePicker === 'dob' ? form.date_of_birth : form.license_expiry) || (datePicker === 'dob' ? new Date(2000, 0, 1) : new Date())}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          maximumDate={datePicker === 'dob' ? new Date() : undefined}
          minimumDate={datePicker === 'expiry' ? new Date() : undefined}
          onChange={(event, date) => {
            if (Platform.OS !== 'ios') setDatePicker(null);
            if (event.type === 'set' && date) set(datePicker === 'dob' ? 'date_of_birth' : 'license_expiry', date);
          }}
        />
      )}
      {datePicker && Platform.OS === 'ios' && (
        <TouchableOpacity style={styles.iosDone} onPress={() => setDatePicker(null)}>
          <Text style={styles.linkText}>Done</Text>
        </TouchableOpacity>
      )}

      <Modal visible={bankPicker} animationType="slide" onRequestClose={() => setBankPicker(false)}>
        <ModalSafeArea style={styles.container}>
          <Header title="Select bank" onBack={() => setBankPicker(false)} />
          <View style={{ paddingHorizontal: 16 }}>
            <View style={styles.input}>
              <Feather name="search" size={16} color={R.muted} />
              <TextInput style={[styles.inputText, { flex: 1, marginLeft: 8 }]} placeholder="Search banks" placeholderTextColor={R.faint} value={bankSearch} onChangeText={setBankSearch} autoFocus />
            </View>
          </View>
          <FlatList
            data={filteredBanks}
            keyExtractor={b => b.value}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ padding: 16 }}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.bankOption} onPress={() => { set('bank', item); setBankPicker(false); setBankSearch(''); }}>
                <Text style={styles.inputText}>{item.label}</Text>
                {form.bank?.value === item.value && <Feather name="check" size={18} color={R.orange} />}
              </TouchableOpacity>
            )}
          />
        </ModalSafeArea>
      </Modal>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------

function Header({ title, subtitle, onBack }: { title: string; subtitle?: string; onBack: () => void }) {
  return (
    <View style={styles.header}>
      <TouchableOpacity style={styles.back} onPress={onBack}>
        <Feather name="arrow-left" size={20} color={R.text} />
      </TouchableOpacity>
      <View style={{ flex: 1 }}>
        <Text style={styles.headerTitle}>{title}</Text>
        {subtitle ? <Text style={styles.headerSub}>{subtitle}</Text> : null}
      </View>
    </View>
  );
}

function Footer({ label, onPress, busy, busyText }: { label: string; onPress: () => void; busy?: boolean; busyText?: string }) {
  return (
    <View style={styles.footer}>
      <TouchableOpacity onPress={onPress} disabled={busy} activeOpacity={0.85}>
        <LinearGradient colors={R.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.footerBtn}>
          {busy ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <ActivityIndicator color="#fff" />
              {busyText ? <Text style={styles.footerText}>{busyText}</Text> : null}
            </View>
          ) : (
            <Text style={styles.footerText}>{label}</Text>
          )}
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

function StatusCard({ icon, color, title, body }: { icon: IconName; color: string; title: string; body: string }) {
  return (
    <View style={[styles.statusCard, { borderColor: color + '55', backgroundColor: color + '12' }]}>
      <Feather name={icon} size={26} color={color} />
      <Text style={[styles.statusTitle, { color }]}>{title}</Text>
      <Text style={styles.statusBody}>{body}</Text>
    </View>
  );
}

const Label = ({ text }: { text: string }) => <Text style={styles.label}>{text}</Text>;

function Input({ label, style, ...props }: React.ComponentProps<typeof TextInput> & { label: string }) {
  return (
    <View style={[{ marginBottom: 14 }, style]}>
      <Label text={label} />
      <TextInput
        {...props}
        style={[styles.input, styles.inputText, props.multiline && { height: 72, paddingTop: 12, textAlignVertical: 'top' }]}
        placeholderTextColor={R.faint}
      />
    </View>
  );
}

function DateField({ label, value, onPress }: { label: string; value: Date | null; onPress: () => void }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Label text={label} />
      <TouchableOpacity style={styles.input} onPress={onPress}>
        <Text style={[styles.inputText, !value && { color: R.faint }]}>{value ? format(value, 'd MMMM yyyy') : 'Select date'}</Text>
        <Feather name="calendar" size={17} color={R.muted} />
      </TouchableOpacity>
    </View>
  );
}

function Chip({ label, icon, active, onPress }: { label: string; icon?: IconName; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.chip, active && styles.chipOn]} onPress={onPress}>
      {icon && <Feather name={icon} size={14} color={active ? '#fff' : R.muted} />}
      <Text style={[styles.chipText, active && { color: '#fff' }]}>{label}</Text>
    </TouchableOpacity>
  );
}

function PhotoField({ label, hint, value, onChange, camera, round }: { label: string; hint: string; value: string | null; onChange: (uri: string) => void; camera?: 'front' | 'back'; round?: boolean }) {
  const pick = async (source: 'camera' | 'library') => {
    const perm = source === 'camera' ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', source === 'camera' ? 'Allow camera access to take this photo.' : 'Allow photo access to choose this photo.');
      return;
    }
    const options: ImagePicker.ImagePickerOptions = {
      mediaTypes: ['images'],
      quality: 0.6,
      allowsEditing: !!round,
      aspect: round ? [1, 1] : undefined,
      cameraType: camera === 'front' ? ImagePicker.CameraType.front : ImagePicker.CameraType.back,
    };
    const result = source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
    if (!result.canceled && result.assets?.[0]?.uri) onChange(result.assets[0].uri);
  };

  const choose = () => {
    // Selfies must be live photos.
    if (camera === 'front') return pick('camera');
    Alert.alert(label, undefined, [
      { text: 'Take photo', onPress: () => pick('camera') },
      { text: 'Choose from gallery', onPress: () => pick('library') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  return (
    <View style={{ marginBottom: 16 }}>
      <Label text={label} />
      <TouchableOpacity style={[styles.photo, round && styles.photoRound, value && { borderStyle: 'solid' }]} onPress={choose} activeOpacity={0.8}>
        {value ? (
          <Image source={{ uri: value }} style={[StyleSheet.absoluteFill, { borderRadius: round ? 60 : 14 }]} />
        ) : (
          <>
            <Feather name={camera === 'front' ? 'camera' : 'image'} size={22} color={R.orange} />
            <Text style={styles.photoText}>{camera === 'front' ? 'Take selfie' : 'Add photo'}</Text>
          </>
        )}
      </TouchableOpacity>
      <Text style={[styles.small, round && { textAlign: 'center' }]}>{value ? 'Tap to retake. ' : ''}{hint}</Text>
    </View>
  );
}

function ReviewBlock({ title, rows, onEdit }: { title: string; rows: [string, string][]; onEdit: () => void }) {
  return (
    <View style={[styles.card, { marginBottom: 12 }]}>
      <View style={styles.reviewHead}>
        <Text style={styles.reviewTitle}>{title}</Text>
        <TouchableOpacity onPress={onEdit} hitSlop={8}><Text style={styles.linkText}>Edit</Text></TouchableOpacity>
      </View>
      {rows.map(([k, v]) => (
        <View key={k} style={styles.reviewRow}>
          <Text style={styles.reviewKey}>{k}</Text>
          <Text style={styles.reviewValue}>{v || '—'}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: R.bg },
  center: { justifyContent: 'center', alignItems: 'center' },
  content: { padding: 16, paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10 },
  back: { width: 40, height: 40, borderRadius: 20, backgroundColor: R.card, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { color: R.text, fontSize: 18, fontWeight: '800' },
  headerSub: { color: R.muted, fontSize: 12, marginTop: 1 },
  progressTrack: { height: 3, backgroundColor: R.card, marginHorizontal: 16, borderRadius: 2 },
  progressFill: { height: 3, backgroundColor: R.orange, borderRadius: 2 },

  hero: { borderRadius: 22, padding: 22, marginBottom: 6 },
  heroTitle: { color: '#fff', fontSize: 22, fontWeight: '800', marginTop: 12 },
  heroBody: { color: 'rgba(255,255,255,0.9)', fontSize: 14, marginTop: 6, lineHeight: 20 },
  group: { color: R.muted, fontSize: 12, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase', marginTop: 20, marginBottom: 8 },
  card: { backgroundColor: R.card, borderRadius: 18, borderWidth: 1, borderColor: R.border, padding: 16 },
  bikeCard: { flexDirection: 'row', gap: 12, marginTop: 12, borderColor: 'rgba(249,115,22,0.3)' },
  bikeIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(249,115,22,0.12)', justifyContent: 'center', alignItems: 'center' },
  bikeTitle: { color: R.text, fontSize: 15, fontWeight: '700' },
  bikeBody: { color: '#d4d4d4', fontSize: 13, marginTop: 3, lineHeight: 19 },
  needRow: { flexDirection: 'row', gap: 12, paddingVertical: 8, alignItems: 'flex-start' },
  needText: { color: '#e5e5e5', fontSize: 14, flex: 1, lineHeight: 20 },
  small: { color: R.muted, fontSize: 12.5, marginTop: 8, lineHeight: 18 },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 18, justifyContent: 'center' },
  linkText: { color: R.orange, fontSize: 14, fontWeight: '600' },

  statusCard: { borderRadius: 18, borderWidth: 1, padding: 18, alignItems: 'center', marginBottom: 16 },
  statusTitle: { fontSize: 18, fontWeight: '800', marginTop: 10, textAlign: 'center' },
  statusBody: { color: '#d4d4d4', fontSize: 13.5, marginTop: 6, textAlign: 'center', lineHeight: 20 },

  label: { color: R.muted, fontSize: 13, fontWeight: '600', marginBottom: 8 },
  input: {
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: R.card,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  inputText: { color: R.text, fontSize: 15 },
  row2: { flexDirection: 'row', gap: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: R.card,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  chipOn: { backgroundColor: R.orange, borderColor: R.orange },
  chipText: { color: R.text, fontSize: 13, fontWeight: '600' },
  photo: {
    height: 150,
    borderRadius: 14,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#333',
    backgroundColor: R.card,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  photoRound: { width: 120, height: 120, borderRadius: 60, alignSelf: 'center' },
  photoText: { color: R.orange, fontSize: 13, fontWeight: '600', marginTop: 6 },
  note: { flexDirection: 'row', gap: 10, padding: 12, borderRadius: 12, backgroundColor: 'rgba(59,130,246,0.1)', marginBottom: 16 },
  noteText: { color: '#cfe0ff', fontSize: 13, flex: 1, lineHeight: 19 },
  resolved: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: -4 },
  resolvedText: { color: R.faint, fontSize: 13 },
  reviewHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  reviewTitle: { color: R.text, fontSize: 15, fontWeight: '700' },
  reviewRow: { flexDirection: 'row', paddingVertical: 5, gap: 12 },
  reviewKey: { color: R.muted, fontSize: 13, width: 100 },
  reviewValue: { color: R.text, fontSize: 13, flex: 1 },
  agree: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', marginTop: 8 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: '#444', justifyContent: 'center', alignItems: 'center', marginTop: 1 },
  checkboxOn: { backgroundColor: R.orange, borderColor: R.orange },
  agreeText: { color: '#d4d4d4', fontSize: 13, flex: 1, lineHeight: 19 },
  error: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', padding: 12, borderRadius: 12, backgroundColor: 'rgba(239,68,68,0.1)', marginTop: 12 },
  errorText: { color: '#fca5a5', fontSize: 13, flex: 1, lineHeight: 19 },
  footer: { padding: 16, borderTopWidth: 1, borderTopColor: R.border },
  footerBtn: { height: 54, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  footerText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  iosDone: { alignItems: 'flex-end', paddingHorizontal: 20, paddingVertical: 10, backgroundColor: R.card },
  bankOption: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: R.border },
});
