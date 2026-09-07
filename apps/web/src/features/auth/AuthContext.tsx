import type { Session } from '@supabase/supabase-js';
import { createContext, useEffect, useState, type ReactNode } from 'react';
import { fetchMe } from '../../services/meService';
import { supabase } from '../../services/supabaseClient';
import type { Profile } from '../../types/auth';

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

export interface AuthState {
  status: AuthStatus;
  session: Session | null;
  /** Role/client scope from the API (GET /me) — null while it hasn't loaded yet. */
  profile: Profile | null;
  /** Set when a Supabase session exists but loading the API profile failed. */
  profileError: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  async function loadProfile() {
    try {
      setProfileError(null);
      setProfile(await fetchMe());
    } catch (err) {
      setProfile(null);
      setProfileError(err instanceof Error ? err.message : 'Failed to load your profile');
    }
  }

  useEffect(() => {
    let cancelled = false;

    supabase.auth.getSession().then(async ({ data }) => {
      if (cancelled) return;
      setSession(data.session);
      if (data.session) await loadProfile();
      setStatus(data.session ? 'authenticated' : 'unauthenticated');
    });

    // Keeps state in sync with sign-in/sign-out from any tab, and with
    // supabase-js's own background token refresh.
    const { data: subscription } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      if (cancelled) return;
      setSession(nextSession);
      if (nextSession) {
        await loadProfile();
        setStatus('authenticated');
      } else {
        setProfile(null);
        setStatus('unauthenticated');
      }
    });

    return () => {
      cancelled = true;
      subscription.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function login(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    // onAuthStateChange picks up the resulting session and loads the profile.
  }

  async function logout() {
    await supabase.auth.signOut();
  }

  return (
    <AuthContext.Provider value={{ status, session, profile, profileError, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
