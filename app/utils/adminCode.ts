// app/utils/adminCode.ts
// Admins sign in with their password and then a 6-digit code emailed to them.
// Same rule as public.admin_code_verified() in the database and the web dashboard:
// the session's sign-in methods (JWT "amr" claim) include a one-time code from
// the last 12 hours.
import type { Session } from '@supabase/supabase-js';

const CODE_METHODS = ['otp', 'magiclink', 'totp'];
const CODE_VALID_SECONDS = 12 * 3600;

export function sessionHasRecentCode(session: Session | null): boolean {
  if (!session?.access_token) return false;
  try {
    const payload = session.access_token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = payload.padEnd(payload.length + ((4 - (payload.length % 4)) % 4), '=');
    const claims = JSON.parse(atob(padded));
    const now = Date.now() / 1000;
    return (claims.amr || []).some(
      (m: { method?: string; timestamp?: number }) =>
        CODE_METHODS.includes(m.method || '') && (m.timestamp || 0) > now - CODE_VALID_SECONDS
    );
  } catch {
    return false;
  }
}
