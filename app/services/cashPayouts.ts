// app/services/cashPayouts.ts
// Cash orders are paid to the rider, so Vesphe transfers the vendor's share
// (orders.vendor_payout) manually. Admins record each transfer with a reference
// and receipt; vendors see the history. See 20261104000000_vendor_cash_payouts.sql.
import { supabase } from '../lib/supabase';

const BUCKET = 'payout-receipts';

export interface CashOwed {
  vendor_id: string;
  vendor_name: string;
  bank_name: string | null;
  account_number: string | null;
  account_name: string | null;
  owed: number;
  order_count: number;
  oldest_order_at: string | null;
}

export interface UnpaidCashOrder {
  id: string;
  order_number: string | null;
  vendor_payout: number;
  total: number;
  delivered_at: string | null;
  created_at: string;
}

export interface CashPayout {
  id: string;
  vendor_id: string;
  vendor_name?: string;
  amount: number;
  order_count: number;
  reference: string | null;
  receipt_path: string | null;
  receipt_url: string | null;
  note: string | null;
  paid_at: string;
}

const num = (v: unknown) => Number(v) || 0;

// --- Admin -----------------------------------------------------------------

export async function fetchCashOwed(): Promise<CashOwed[]> {
  const { data, error } = await supabase.rpc('admin_cash_owed');
  if (error) throw error;
  return (data || []).map((r: any) => ({ ...r, owed: num(r.owed), order_count: num(r.order_count) }));
}

export async function countVendorsOwedCash(): Promise<number> {
  try {
    return (await fetchCashOwed()).length;
  } catch {
    return 0;
  }
}

export async function fetchUnpaidCashOrders(vendorId: string): Promise<UnpaidCashOrder[]> {
  const { data, error } = await supabase
    .from('orders')
    .select('id, order_number, vendor_payout, total, delivered_at, created_at')
    .eq('vendor_id', vendorId)
    .eq('payment_method', 'cash')
    .eq('status', 'delivered')
    .is('cash_payout_id', null)
    .order('delivered_at', { ascending: true });
  if (error) throw error;
  return (data || []).map(o => ({ ...o, vendor_payout: num(o.vendor_payout), total: num(o.total) }));
}

// Uploads the receipt photo, then records the transfer for all unpaid cash orders.
export async function recordCashPayout(vendorId: string, reference: string, receiptUri: string, note?: string) {
  const bytes = await (await fetch(receiptUri)).arrayBuffer();
  if (!bytes.byteLength) throw new Error('That receipt image looks empty. Please pick it again.');
  const path = `${vendorId}/${Date.now()}.jpg`;
  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, bytes, { contentType: 'image/jpeg' });
  if (uploadError) throw uploadError;

  const { error } = await supabase.rpc('admin_record_cash_payout', {
    p_vendor_id: vendorId,
    p_reference: reference.trim(),
    p_receipt_path: path,
    p_note: note?.trim() || null,
  });
  if (error) {
    await supabase.storage.from(BUCKET).remove([path]);
    throw error;
  }
}

// --- Shared ----------------------------------------------------------------

async function withReceiptUrls(rows: any[]): Promise<CashPayout[]> {
  const paths = rows.map(r => r.receipt_path).filter(Boolean);
  const signed = new Map<string, string>();
  if (paths.length) {
    const { data } = await supabase.storage.from(BUCKET).createSignedUrls(paths, 60 * 60);
    (data || []).forEach(d => d.path && d.signedUrl && signed.set(d.path, d.signedUrl));
  }
  return rows.map(r => ({
    ...r,
    vendor_name: r.vendor?.name ?? r.vendor_name,
    amount: num(r.amount),
    receipt_url: r.receipt_path ? signed.get(r.receipt_path) || null : null,
  }));
}

// Admin: every payout. Vendor: their own (row-level security filters it).
export async function fetchCashPayouts(vendorId?: string): Promise<CashPayout[]> {
  let query = supabase
    .from('vendor_cash_payouts')
    .select('*, vendor:vendor_id (name)')
    .order('paid_at', { ascending: false })
    .limit(100);
  if (vendorId) query = query.eq('vendor_id', vendorId);
  const { data, error } = await query;
  if (error) throw error;
  return withReceiptUrls(data || []);
}

// Vendor: cash orders delivered but not yet paid out.
export async function fetchCashPending(vendorId: string): Promise<{ amount: number; count: number }> {
  const orders = await fetchUnpaidCashOrders(vendorId);
  return { amount: orders.reduce((s, o) => s + o.vendor_payout, 0), count: orders.length };
}
