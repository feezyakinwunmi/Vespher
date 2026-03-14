













// app/contexts/AuthContext.tsx
import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Session } from '@supabase/supabase-js';
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
  isLoading: boolean;
  isReady: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<boolean>;
  updatePassword: (newPassword: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

SplashScreen.preventAutoHideAsync();

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isReady, setIsReady] = useState(false);
  const mounted = useRef(true);

  const fetchUserProfile = async (userId: string) => {
    try {
      const { data: userData, error } = await supabase
        .from('users')
        .select('id, email, name, role, avatar_url, phone, is_suspended')
        .eq('id', userId)
        .single();

      if (error) throw error;

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
        // NO signOut() here anymore
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
            await fetchUserProfile(currentSession.user.id);
          }
          setIsLoading(false);
          setIsReady(true);
          await SplashScreen.hideAsync();
        }
      } catch (err) {
        console.error('Auth initialization error:', err);
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

      console.log('Auth event:', event);
      setSession(newSession);

      if (event === 'SIGNED_IN' && newSession?.user) {
        await fetchUserProfile(newSession.user.id);
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
      }
    });

    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        supabase.auth.startAutoRefresh();
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
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      // No extra check here — suspension is handled in navigator
    } catch (err: any) {
      Alert.alert('Sign In Failed', err.message || 'Failed to sign in');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setUser(null);
      setSession(null);
    } catch (err: any) {
      Alert.alert('Sign Out Failed', err.message || 'Failed to sign out');
    } finally {
      setIsLoading(false);
    }
  };

  const updatePassword = async (newPassword: string) => {
    try {
      setIsLoading(true);
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      Alert.alert('Success', 'Password updated successfully');
      return true;
    } catch (error: any) {
      console.error('Password update error:', error);
      Alert.alert('Error', error.message || 'Failed to update password');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const requestPasswordReset = async (email: string) => {
    try {
      setIsLoading(true);
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('email')
        .eq('email', email)
        .single();

      if (userError || !user) {
        Alert.alert('Error', 'No account found with this email');
        return false;
      }

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: 'vespher://reset-password',
      });

      if (error) throw error;
      return true;
    } catch (error: any) {
      console.error('Reset request error:', error);
      Alert.alert('Error', error.message || 'Failed to send reset email');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        isLoading,
        isReady,
        signIn,
        signOut,
        requestPasswordReset,
        updatePassword,
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