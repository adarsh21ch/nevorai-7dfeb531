import { Shield } from "lucide-react";

export const GuaranteeBanner = () => {
  return (
    <div className="max-w-3xl mx-auto my-12 rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/[0.06] via-background to-background p-6 sm:p-8">
      <div className="flex flex-col sm:flex-row gap-4 sm:gap-5 items-start">
        <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
          <Shield className="text-emerald-500" size={24} />
        </div>
        <div className="space-y-2 flex-1">
          <h3 className="text-base sm:text-lg font-heading font-bold text-foreground">
            7-Day Money-Back Guarantee
          </h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Try Nevorai Flow completely risk-free. If you're not happy within 7 days of your first
            payment — we'll refund every rupee. No questions asked.
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Just reach out on WhatsApp and we'll process your refund within 24 hours.
          </p>
        </div>
      </div>
    </div>
  );
};

export const GuaranteePill = () => (
  <div className="flex items-center justify-center gap-1.5 mb-2.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[11px] font-medium">
    <Shield size={11} className="shrink-0" />
    <span>7-day money-back guarantee</span>
  </div>
);
