import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import type { User, Session } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";




// (proactive route preload removed — defaultPreload: "intent" handles this on hover/focus.)


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
  whatsapp_verified: boolean | null;

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
  const queryClient = useQueryClient();
  const router = useRouter();

  // After login: warm only critical header queries. Heavy bulk prefetches of
  // funnels/videos/landing-pages/live-sessions/leads were removed — they
  // shipped megabytes per session (esp. video_assets with base64 thumbnails)
  // and routes load their own data on demand. Route JS chunks are now
  // preloaded on hover/focus via the router's defaultPreload: "intent".
  useEffect(() => {
    const uid = user?.id;
    if (!uid) return;

    const sb = supabase as any;
    const prefetch = (key: any[], queryFn: () => Promise<any>, staleTime = 60_000) =>
      queryClient.prefetchQuery({ queryKey: key, queryFn, staleTime }).catch(() => {});

    prefetch(["dashboard-summary", uid], async () => {
      const { data } = await sb.rpc("dashboard_summary", { p_user_id: uid });
      return data ?? { funnels: [], total_leads: 0, active_live_session: null };
    });
    prefetch(["unread-notifications", uid], async () => {
      const { count } = await sb.from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", uid).eq("is_read", false);
      return count ?? 0;
    }, 5 * 60_000);
  }, [user?.id, queryClient]);
  void router;


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
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, phone },
        emailRedirectTo: typeof window !== "undefined" ? window.location.origin : undefined,
      },
    });
    // Fire Meta Pixel Lead + CompleteRegistration at the exact moment of
    // signup success — not on dashboard mount (that race-conditions with
    // the lazy chunk + Strict Mode and fires for returning users too).
    if (!error && data?.user) {
      const { trackLead, trackCompleteRegistration } = await import("@/lib/pixel");
      void trackLead(data.user.id, {
        email,
        phone,
        content_name: "Free Signup",
        content_category: "authentication",
      });
      void trackCompleteRegistration(data.user.id, { email, phone });

      // Welcome email via Resend — fire and forget.
      const { sendWelcomeEmail } = await import("@/lib/email");
      void sendWelcomeEmail(email, fullName || "there");
    }
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
    // Clear local state INSTANTLY so the UI never feels frozen.
    setUser(null);
    setSession(null);
    setProfile(null);
    // Drop cached protected queries so a back-nav can't restore them.
    try { queryClient.clear(); } catch {}
    // Local-scope signOut clears localStorage tokens with no network call —
    // returns in milliseconds even on slow/offline networks.
    try {
      await supabase.auth.signOut({ scope: "local" });
    } catch {
      // Best-effort; local state is already cleared.
    }
    // Fire the global server-side revoke in the background (don't await).
    // If the network is slow or offline, the user is already logged out locally.
    void supabase.auth.signOut({ scope: "global" }).catch(() => {});
  }, [queryClient]);

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
