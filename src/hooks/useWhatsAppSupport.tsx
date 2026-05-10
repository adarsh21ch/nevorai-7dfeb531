import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useWhatsAppSupport = () => {
  const { data } = useQuery({
    queryKey: ["support-settings"],
    queryFn: async () => {
      const { data } = await supabase
        .from("platform_settings")
        .select("key, value")
        .in("key", ["support_whatsapp", "support_message_template"]);
      const map: Record<string, string> = {};
      data?.forEach((s) => { map[s.key] = s.value || ""; });
      return map;
    },
    staleTime: 300000,
  });

  const openSupport = (context?: string) => {
    const phone = data?.support_whatsapp?.replace(/[^0-9]/g, "") || "";
    const template = context || data?.support_message_template || "Hi, I need help with my account.";
    if (phone) {
      window.open(`https://wa.me/${phone}?text=${encodeURIComponent(template)}`, "_blank");
    }
  };

  return { supportPhone: data?.support_whatsapp, openSupport };
};
