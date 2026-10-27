// supabase/functions/_shared/http.ts
// Shared helpers for edge functions: CORS, JSON responses, caller auth and Paystack calls.
// @ts-ignore - Deno remote import
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

declare const Deno: { env: { get(key: string): string | undefined } };

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export interface Caller {
  userId: string;
  email: string | null;
  role: string;
  isSuspended: boolean;
  // Service-role client: bypasses RLS, so every query must be scoped explicitly.
  admin: SupabaseClient;
}

function requireEnv(key: string): string {
  const value = Deno.env.get(key);
  if (!value) throw new HttpError(500, `Server misconfigured: ${key} missing`);
  return value;
}

export function serviceClient(): SupabaseClient {
  return createClient(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// Resolves the signed-in user from the Authorization header. Never trust ids sent in the body.
export async function getCaller(req: Request): Promise<Caller> {
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) throw new HttpError(401, 'Not authenticated');

  const admin = serviceClient();
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user) throw new HttpError(401, 'Invalid or expired session');

  const { data: profile } = await admin
    .from('users')
    .select('role, is_suspended')
    .eq('id', data.user.id)
    .maybeSingle();

  if (!profile) throw new HttpError(403, 'User profile not found');
  if (profile.is_suspended) throw new HttpError(403, 'Account suspended');

  return {
    userId: data.user.id,
    email: data.user.email ?? null,
    role: profile.role,
    isSuspended: !!profile.is_suspended,
    admin,
  };
}

export async function paystack(path: string, init: { method?: string; body?: unknown } = {}) {
  const res = await fetch(`https://api.paystack.co${path}`, {
    method: init.method || 'GET',
    headers: {
      Authorization: `Bearer ${requireEnv('PAYSTACK_SECRET_KEY')}`,
      'Content-Type': 'application/json',
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  const data = await res.json().catch(() => ({ status: false, message: 'Invalid response from Paystack' }));
  return { ok: res.ok && data?.status !== false, status: res.status, data };
}

// Wraps a handler with CORS preflight, method check and uniform error responses.
export function handler(fn: (req: Request) => Promise<Response>) {
  return async (req: Request): Promise<Response> => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
    if (req.method !== 'POST') return json({ status: false, message: 'Method not allowed' }, 405);
    try {
      return await fn(req);
    } catch (err) {
      if (err instanceof HttpError) return json({ status: false, message: err.message }, err.status);
      console.error('Unhandled function error:', err);
      return json({ status: false, message: 'Internal server error' }, 500);
    }
  };
}

export async function readJson<T = Record<string, unknown>>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new HttpError(400, 'Invalid JSON body');
  }
}
