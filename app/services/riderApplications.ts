// app/services/riderApplications.ts
// Rider applications: anyone with an account applies, an admin approves or
// rejects with admin_review_rider_application(). Approval turns the account
// into a rider (see 20261101000000_rider_applications.sql).
import { supabase } from '../lib/supabase';

export type ApplicationStatus = 'pending' | 'approved' | 'rejected';

export const VEHICLE_TYPES = [
  { value: 'motorcycle', label: 'Motorcycle', icon: 'zap' },
  { value: 'bicycle', label: 'Bicycle', icon: 'wind' },
  { value: 'car', label: 'Car', icon: 'truck' },
  { value: 'tricycle', label: 'Tricycle (Keke)', icon: 'triangle' },
  { value: 'van', label: 'Van', icon: 'package' },
] as const;

export const OWNERSHIP_TYPES = [
  { value: 'personal', label: 'I own it' },
  { value: 'rented', label: 'Rented / hire purchase' },
  { value: 'company', label: 'Company / someone else' },
] as const;

export const ID_TYPES = [
  { value: 'nin', label: 'NIN slip / card' },
  { value: 'voters_card', label: "Voter's card" },
  { value: 'passport', label: 'International passport' },
  { value: 'drivers_license', label: "Driver's licence" },
] as const;

export interface RiderApplication {
  id: string;
  user_id: string;
  status: ApplicationStatus;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  date_of_birth: string | null;
  address: string | null;
  city: string | null;
  selfie_url: string | null;
  vehicle_type: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_year: number | null;
  vehicle_color: string | null;
  vehicle_number: string | null;
  vehicle_ownership: string | null;
  vehicle_owner_name: string | null;
  vehicle_owner_phone: string | null;
  vehicle_photo_url: string | null;
  vehicle_papers_url: string | null;
  license_number: string | null;
  license_expiry: string | null;
  license_photo_url: string | null;
  id_type: string | null;
  id_number: string | null;
  id_card_url: string | null;
  guarantor_name: string | null;
  guarantor_phone: string | null;
  guarantor_relationship: string | null;
  guarantor_address: string | null;
  bank_name: string | null;
  bank_code: string | null;
  account_number: string | null;
  account_name: string | null;
  rejection_reason: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export type ApplicationInput = Omit<
  RiderApplication,
  'id' | 'user_id' | 'status' | 'rejection_reason' | 'reviewed_at' | 'created_at'
>;

const BUCKET = 'rider-documents';

export const labelFor = (list: readonly { value: string; label: string }[], value?: string | null) =>
  list.find(i => i.value === value)?.label || value || '—';

// Uploads a picked image and returns its URL. Files live under the applicant's id.
export async function uploadApplicationPhoto(userId: string, localUri: string, name: string): Promise<string> {
  const bytes = await (await fetch(localUri)).arrayBuffer();
  if (!bytes.byteLength) throw new Error('That photo looks empty. Please pick it again.');
  const path = `${userId}/${name}-${Date.now()}.jpg`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, { contentType: 'image/jpeg', upsert: true });
  if (error) throw error;
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

const DOC_FIELDS = ['selfie_url', 'vehicle_photo_url', 'vehicle_papers_url', 'license_photo_url', 'id_card_url'] as const;

const DOC_PATH = new RegExp(`/storage/v1/object/(?:public|sign|authenticated)/${BUCKET}/([^?]+)`);
const docPath = (url: string | null) => {
  const m = url?.match(DOC_PATH);
  return m ? decodeURIComponent(m[1]) : null;
};

// Saved links are "public" storage URLs, which don't open when the bucket is
// private. Swap them for short-lived signed links in one request (works either way).
export async function withSignedDocuments(apps: RiderApplication[]): Promise<RiderApplication[]> {
  const paths = [...new Set(apps.flatMap(a => DOC_FIELDS.map(f => docPath(a[f]))).filter((p): p is string => !!p))];
  if (!paths.length) return apps;
  const { data } = await supabase.storage.from(BUCKET).createSignedUrls(paths, 60 * 60);
  const signed = new Map((data || []).filter(d => d.signedUrl).map(d => [d.path, d.signedUrl]));
  return apps.map(a => {
    const copy = { ...a };
    DOC_FIELDS.forEach(f => {
      const p = docPath(a[f]);
      if (p && signed.get(p)) copy[f] = signed.get(p)!;
    });
    return copy;
  });
}

export async function fetchMyLatestApplication(userId: string): Promise<RiderApplication | null> {
  const { data, error } = await supabase
    .from('rider_applications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function submitApplication(userId: string, input: ApplicationInput) {
  const { error } = await supabase.from('rider_applications').insert({ ...input, user_id: userId, status: 'pending' });
  if (error) {
    if (error.code === '23505') throw new Error('You already have an application under review.');
    throw error;
  }
}

// --- Admin -----------------------------------------------------------------

export async function fetchApplications(status: ApplicationStatus | 'all'): Promise<RiderApplication[]> {
  let query = supabase.from('rider_applications').select('*').order('created_at', { ascending: false }).limit(200);
  if (status !== 'all') query = query.eq('status', status);
  const { data, error } = await query;
  if (error) throw error;
  return withSignedDocuments(data || []);
}

export async function countPendingApplications(): Promise<number> {
  const { count } = await supabase
    .from('rider_applications')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending');
  return count || 0;
}

export async function reviewApplication(applicationId: string, approve: boolean, reason?: string) {
  const { error } = await supabase.rpc('admin_review_rider_application', {
    p_application_id: applicationId,
    p_approve: approve,
    p_reason: reason || null,
  });
  if (error) throw error;
}
