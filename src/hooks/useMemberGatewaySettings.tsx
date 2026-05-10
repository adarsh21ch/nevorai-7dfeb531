import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface MemberGatewaySettings {
  id: number;
  gateway_enabled: boolean;
  access_duration_type: "continuous" | "days" | "disabled";
  access_duration_days: number | null;
  notify_enabled: boolean;
  notify_in_app: boolean;
  notify_email: boolean;
  notify_whatsapp: boolean;
  notification_template: string;
  last_check_at: string | null;
  last_check_summary: any;
  updated_at: string;
}

export const useMemberGatewaySettings = () => {
  const qc = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ["member-gateway-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("member_gateway_settings" as any)
        .select("*")
        .eq("id", 1)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as MemberGatewaySettings | null;
    },
    staleTime: 30_000,
  });

  const update = async (patch: Partial<MemberGatewaySettings>) => {
    const { error } = await supabase
      .from("member_gateway_settings" as any)
      .update(patch as any)
      .eq("id", 1);
    if (error) {
      toast.error("Failed to save setting: " + error.message);
      return false;
    }
    toast.success("Settings updated");
    qc.invalidateQueries({ queryKey: ["member-gateway-settings"] });
    return true;
  };

  return { settings, isLoading, update };
};
