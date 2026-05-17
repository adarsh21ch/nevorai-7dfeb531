import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import type { User, Session } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface Profile {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  avatar_url: string | null;
  bio: string | null;
  company: string | null;
  team_size: string | null;
  city: string | null;
  instagram_url: string | null;
  whatsapp_number: string | null;
  onboarding_completed: boolean | null;
  onboarding_data: any;
  kyc_status: string | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signUp: (email: string, password: string, fullName: string, phone: string) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async (userId: string) => {
    const { data } = await supabase.from("profiles").select("*").eq("id", userId).single();
    setProfile((data as Profile | null) ?? null);
    return (data as Profile | null) ?? null;
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user) await fetchProfile(user.id);
  }, [user, fetchProfile]);

  useEffect(() => {
    let isMounted = true;
    let lastUserId: string | null = null;

    const applySession = (nextSession: Session | null) => {
      if (!isMounted) return;
      setSession((prev) => (prev?.access_token === nextSession?.access_token ? prev : nextSession));
      setUser((prev) => (prev?.id === nextSession?.user?.id ? prev : nextSession?.user ?? null));

      const nextUserId = nextSession?.user?.id ?? null;
      // Only refetch profile when the user id actually changes — token refresh
      // events keep the same user and shouldn't trigger a profile reload.
      if (nextUserId && nextUserId !== lastUserId) {
        void fetchProfile(nextUserId);
      } else if (!nextUserId && lastUserId) {
        setProfile(null);
      }
      lastUserId = nextUserId;

      setLoading(false);
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      applySession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      applySession(session);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  const signUp = useCallback(async (email: string, password: string, fullName: string, phone: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, phone },
        emailRedirectTo: typeof window !== "undefined" ? window.location.origin : undefined,
      },
    });
    return { error };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (!error) {
      setSession(data.session ?? null);
      setUser(data.user ?? null);
      setLoading(false);

      if (data.user?.id) {
        void fetchProfile(data.user.id);
      } else {
        setProfile(null);
      }
    }

    return { error };
  }, [fetchProfile]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
  }, []);

  // Memoize context value so consumers don't re-render every time AuthProvider
  // re-renders for unrelated reasons. Identity changes only when one of the
  // five tracked values changes.
  const value = useMemo<AuthContextType>(
    () => ({ user, session, profile, loading, signUp, signIn, signOut, refreshProfile }),
    [user, session, profile, loading, signUp, signIn, signOut, refreshProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

const noopAuth: AuthContextType = {
  user: null,
  session: null,
  profile: null,
  loading: true,
  signUp: async () => ({ error: new Error("Auth not ready") }),
  signIn: async () => ({ error: new Error("Auth not ready") }),
  signOut: async () => {},
  refreshProfile: async () => {},
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  // During SSR or before the provider mounts, return safe defaults instead of
  // throwing so public/marketing components can render without an auth shell.
  return ctx ?? noopAuth;
};
