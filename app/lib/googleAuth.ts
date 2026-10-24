// app/lib/googleAuth.ts
// Google sign-in through Supabase Auth. Opens Google in an in-app browser and returns
// to vesphe://auth-callback, then stores the Supabase session.
// Setup (one time): Supabase → Authentication → Providers → Google (enable, add the
// Google OAuth Web client ID + secret) and add "vesphe://auth-callback" to
// Authentication → URL Configuration → Redirect URLs (plus "exp://**" to test in
// Expo Go, where the return link is exp://<your-computer>/--/auth-callback).
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { supabase } from './supabase';

WebBrowser.maybeCompleteAuthSession();

// vesphe://auth-callback in builds, exp://.../--/auth-callback in Expo Go.
export const getAuthRedirectUrl = () => Linking.createURL('auth-callback');

export type GoogleSignInResult = 'success' | 'cancelled';

function readParams(url: string): Record<string, string> {
  const params: Record<string, string> = {};
  const parts = [url.split('?')[1]?.split('#')[0], url.split('#')[1]].filter(Boolean) as string[];
  for (const part of parts) {
    for (const pair of part.split('&')) {
      const [key, value] = pair.split('=');
      if (key) params[decodeURIComponent(key)] = decodeURIComponent(value || '');
    }
  }
  return params;
}

export async function signInWithGoogle(): Promise<GoogleSignInResult> {
  const redirectTo = getAuthRedirectUrl();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      skipBrowserRedirect: true,
      queryParams: { prompt: 'select_account' },
    },
  });
  if (error || !data?.url) throw error || new Error('Could not start Google sign-in');

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success') return 'cancelled';

  const params = readParams(result.url);
  if (params.error) throw new Error(params.error_description || params.error);

  if (params.code) {
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(params.code);
    if (exchangeError) throw exchangeError;
    return 'success';
  }

  if (params.access_token && params.refresh_token) {
    const { error: sessionError } = await supabase.auth.setSession({
      access_token: params.access_token,
      refresh_token: params.refresh_token,
    });
    if (sessionError) throw sessionError;
    return 'success';
  }

  throw new Error('Google sign-in did not return a session');
}
