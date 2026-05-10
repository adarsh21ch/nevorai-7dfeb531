import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

/**
 * Returns the user's Nevorai Member status. A "Member" is a user who has been
 * verified via the Nevorai bridge as having an active Pro subscription on
 * the calling Nevorai app — they get Individual plan access for free.
 */
export const useNevoraiMember = () => {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["nevorai-member", user?.id],
    queryFn: async () => {
      if (!user) return { isMember: false, notified: true };
      const { data: p } = await supabase
        .from("profiles")
        .select(
          "nevorai_member, nevorai_member_active, nevorai_member_notified, member_welcome_shown, nevorai_member_granted_at, nevorai_member_expires_at, nevorai_member_status",
        )
        .eq("id", user.id)
        .maybeSingle();
      return {
        isMember: !!(p?.nevorai_member && p?.nevorai_member_active),
        notified: !!p?.nevorai_member_notified || !!p?.member_welcome_shown,
        grantedAt: p?.nevorai_member_granted_at || null,
        expiresAt: (p as any)?.nevorai_member_expires_at || null,
        status: (p as any)?.nevorai_member_status || "inactive",
      };
    },
    enabled: !!user,
    staleTime: 30000,
  });

  const markWelcomeShown = async () => {
    if (!user) return;
    try {
      await supabase.functions.invoke("mark-member-notified", { body: {} });
    } catch (e) {
      console.error("mark-member-notified failed", e);
    }
  };

  return {
    isMember: data?.isMember ?? false,
    welcomeShown: data?.notified ?? true,
    notified: data?.notified ?? true,
    grantedAt: data?.grantedAt ?? null,
    expiresAt: data?.expiresAt ?? null,
    status: data?.status ?? "inactive",
    isLoading,
    markWelcomeShown,
  };
};
