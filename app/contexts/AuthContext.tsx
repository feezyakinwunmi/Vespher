// app/contexts/AuthContext.tsx
import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { unregisterPushToken } from '../services/pushTokenRegistry';
import { Session, User } from '@supabase/supabase-js';
import { Alert, AppState } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';

type UserRole = 'customer' | 'vendor' | 'admin' | 'rider' | 'business';

interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatar_url?: string;
  phone?: string;
  is_suspended: boolean;      // ← always present (default false)
}

interface AuthContextType {
  user: AuthUser | null;
  session: Session | null;
  // True only while the initial session is restored on app start.
  isLoading: boolean;
  // True while a sign-in / sign-out request is in flight (for button spinners).
  isAuthenticating: boolean;
  isReady: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<boolean>;
  updatePassword: (newPassword: string) => Promise<boolean>;
  // While a password-recovery OTP session is active the user must not be routed
  // into the app until they have set a new password.
  beginPasswordRecovery: () => void;
  endPasswordRecovery: () => void;
  // True right after a first-time Google sign-up, so the app can open Profile setup.
  isNewUser: boolean;
  clearNewUser: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

SplashScreen.preventAutoHideAsync();

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const mounted = useRef(true);
  const recoveryInProgress = useRef(false);
  const [isNewUser, setIsNewUser] = useState(false);

  // First Google or Apple sign-in: the auth user exists but has no profile row yet.
  // These are for customers; vendors register with business details.
  const createProfileForOAuthUser = async (authUser: User): Promise<boolean> => {
    const providers: string[] = authUser.app_metadata?.providers
      || (authUser.app_metadata?.provider ? [authUser.app_metadata.provider] : []);
    if (!providers.includes('google') && !providers.includes('apple')) return false;

    const meta = authUser.user_metadata || {};
    const email = authUser.email || '';
    const name = String(meta.full_name || meta.name || email.split('@')[0] || 'Vesphe user').slice(0, 80);

    const { error } = await supabase.from('users').insert({
      id: authUser.id,
      email,
      name,
      phone: null,
      avatar_url: meta.avatar_url || meta.picture || null,
      role: 'customer',
      created_at: new Date().toISOString(),
    });
    if (error && error.code !== '23505') {
      console.error('Error creating Google profile:', error);
      return false;
    }

    const prefix = name.replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 6) || 'USER';
    await supabase.from('customer_rewards').insert({
      customer_id: authUser.id,
      total_orders: 0,
      free_delivery_earned: 0,
      free_delivery_used: 0,
      referral_code: `VSP-${prefix}-${Math.floor(100 + Math.random() * 900)}`,
      referral_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    setIsNewUser(true);
    return true;
  };

  const fetchUserProfile = async (authUser: User, allowCreate = true) => {
    const userId = authUser.id;
    try {
      const { data: userData, error } = await supabase
        .from('users')
        .select('id, email, name, role, avatar_url, phone, is_suspended')
        .eq('id', userId)
        .maybeSingle();

      if (error) throw error;

      if (!userData) {
        if (allowCreate && await createProfileForOAuthUser(authUser)) {
          await fetchUserProfile(authUser, false);
        }
        return;
      }

      if (mounted.current && userData) {
        setUser({
          id: userData.id,
          email: userData.email,
          name: userData.name,
          role: userData.role,
          avatar_url: userData.avatar_url,
          phone: userData.phone,
          is_suspended: userData.is_suspended ?? false,
        });
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
    }
  };

  useEffect(() => {
    let isActive = true;
    mounted.current = true;

    const initAuth = async () => {
      try {
        const { data: { session: currentSession }, error } = await supabase.auth.getSession();
        if (error) throw error;

        if (isActive) {
          setSession(currentSession);
          if (currentSession?.user) {
            await fetchUserProfile(currentSession.user);
          }
        }
      } catch (err) {
        console.error('Auth initialization error:', err);
      } finally {
        if (isActive) {
          setIsLoading(false);
          setIsReady(true);
          await SplashScreen.hideAsync();
        }
      }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (!isActive) return;

      setSession(newSession);

      if (event === 'SIGNED_IN' && newSession?.user) {
        if (recoveryInProgress.current) return;
        await fetchUserProfile(newSession.user);
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
      }
    });

    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        supabase.auth.startAutoRefresh();
        // Picks up changes made elsewhere, e.g. an approved rider application or a suspension.
        supabase.auth.getSession().then(({ data }) => {
          if (data.session?.user && !recoveryInProgress.current) fetchUserProfile(data.session.user, false);
        });
      } else {
        supabase.auth.stopAutoRefresh();
      }
    });

    return () => {
      isActive = false;
      mounted.current = false;
      subscription.unsubscribe();
      appStateSubscription.remove();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    setIsAuthenticating(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;
      // Suspension and role routing are handled in the navigator.
    } catch (err: any) {
      throw err;
    } finally {
      setIsAuthenticating(false);
    }
  };

  const signOut = async () => {
    setIsAuthenticating(true);
    try {
      await unregisterPushToken();
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setUser(null);
      setSession(null);
    } catch (err: any) {
      Alert.alert('Sign Out Failed', err.message || 'Failed to sign out');
    } finally {
      setIsAuthenticating(false);
    }
  };

  const refreshProfile = async () => {
    const { data: { session: currentSession } } = await supabase.auth.getSession();
    if (currentSession?.user) {
      await fetchUserProfile(currentSession.user);
    }
  };

  const updatePassword = async (newPassword: string) => {
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      Alert.alert('Success', 'Password updated successfully');
      return true;
    } catch (error: any) {
      console.error('Password update error:', error);
      Alert.alert('Error', error.message || 'Failed to update password');
      return false;
    }
  };

  // Always reports success so the screen cannot be used to discover which emails
  // have accounts.
  const requestPasswordReset = async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
      if (error) console.error('Reset request error:', error);
    } catch (error) {
      console.error('Reset request error:', error);
    }
    return true;
  };

  const beginPasswordRecovery = () => {
    recoveryInProgress.current = true;
  };

  const endPasswordRecovery = () => {
    recoveryInProgress.current = false;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        isLoading,
        isAuthenticating,
        isReady,
        signIn,
        signOut,
        refreshProfile,
        requestPasswordReset,
        updatePassword,
        beginPasswordRecovery,
        endPasswordRecovery,
        isNewUser,
        clearNewUser: () => setIsNewUser(false),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
