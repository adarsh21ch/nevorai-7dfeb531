// PublicFunnel — placeholder. The full 1368-line viewer from nFlow will
// be ported in the next pass.
import { useParams } from "@/lib/router-compat";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import logoImg from "@/assets/nevorai-flow-logo.png";

const PublicFunnel = () => {
  const { slug } = useParams<{ slug: string }>();
  const { data: funnel, isLoading } = useQuery({
    queryKey: ["public-funnel", slug],
    queryFn: async () => {
      const { data } = await supabase.from("funnels").select("*").eq("slug", slug!).maybeSingle();
      return data;
    },
    enabled: !!slug,
  });

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" /></div>;
  }
  if (!funnel) {
    return <div className="min-h-screen flex items-center justify-center bg-background text-foreground"><p className="text-sm text-muted-foreground">Funnel not found.</p></div>;
  }
  return (
    <div className="min-h-screen bg-[#09090b] text-white flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="flex items-center justify-center gap-2"><img src={logoImg} alt="" className="h-7 w-7" /><span className="font-heading font-bold">nFlow</span></div>
        <h1 className="text-2xl font-heading font-bold">{funnel.title}</h1>
        {funnel.description && <p className="text-sm text-white/70">{funnel.description}</p>}
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6">
          <p className="text-sm text-white/60">The full public funnel viewer (video player, lead capture, payment, multi-step) is being ported in the next pass.</p>
        </div>
      </div>
    </div>
  );
};

export default PublicFunnel;
