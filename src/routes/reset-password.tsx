import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Logo } from "@/components/landing/Logo";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Lock, Eye, EyeOff, Loader2, AlertCircle } from "lucide-react";

export const Route = createFileRoute("/reset-password")({ component: ResetPasswordPage });

const schema = z.object({
  password: z.string().min(8, "At least 8 characters").regex(/[0-9]/, "Must contain a number"),
  confirm: z.string(),
}).refine((d) => d.password === d.confirm, { message: "Passwords do not match", path: ["confirm"] });

type FormValues = z.infer<typeof schema>;

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [invalid, setInvalid] = useState<string | null>(null);
  const [show, setShow] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    const init = async () => {
      const hash = typeof window !== "undefined" ? window.location.hash.substring(1) : "";
      const params = new URLSearchParams(hash);
      const access_token = params.get("access_token");
      const refresh_token = params.get("refresh_token");
      const type = params.get("type");

      if (!access_token || !refresh_token || type !== "recovery") {
        // Fallback: maybe Supabase already set the session (detectSessionInUrl)
        const { data } = await supabase.auth.getSession();
        if (data.session) { setReady(true); return; }
        setInvalid("Invalid or expired reset link. Please request a new one.");
        return;
      }

      const { error } = await supabase.auth.setSession({ access_token, refresh_token });
      if (error) { setInvalid("Invalid or expired reset link. Please request a new one."); return; }
      // Clean the hash so tokens don't linger
      window.history.replaceState(null, "", window.location.pathname);
      setReady(true);
    };
    init();
  }, []);

  const onSubmit = async (values: FormValues) => {
    setSubmitError(null);
    const { error } = await supabase.auth.updateUser({ password: values.password });
    if (error) { setSubmitError(error.message); return; }
    toast.success("Password updated successfully");
    setTimeout(() => navigate({ to: "/auth", replace: true }), 1500);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 gradient-bg-subtle">
      <div className="absolute inset-0 animate-grid opacity-30" />
      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <Link to="/" className="inline-block"><Logo size="lg" /></Link>
        </div>
        <div className="glass-card p-8">
          <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Lock className="text-primary" size={24} />
          </div>
          <h2 className="text-lg font-semibold mb-2 text-center">Set a new password</h2>
          <p className="text-sm text-muted-foreground mb-6 text-center">Choose a strong password (8+ characters, includes a number).</p>

          {invalid ? (
            <div className="space-y-4 text-center">
              <div className="flex items-center justify-center gap-2 text-destructive text-sm">
                <AlertCircle size={16} /> <span>{invalid}</span>
              </div>
              <Link to="/forgot-password"><Button variant="hero" className="w-full">Request a new link</Button></Link>
            </div>
          ) : !ready ? (
            <p className="text-center text-sm text-muted-foreground">Verifying reset link…</p>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <div className="relative">
                  <Input
                    type={show ? "text" : "password"}
                    placeholder="New password"
                    className="bg-muted border-border pr-10"
                    autoComplete="new-password"
                    {...register("password")}
                  />
                  <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" aria-label={show ? "Hide password" : "Show password"}>
                    {show ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {errors.password && <p className="text-xs text-destructive mt-1">{errors.password.message}</p>}
              </div>
              <div>
                <Input
                  type={show ? "text" : "password"}
                  placeholder="Confirm new password"
                  className="bg-muted border-border"
                  autoComplete="new-password"
                  {...register("confirm")}
                />
                {errors.confirm && <p className="text-xs text-destructive mt-1">{errors.confirm.message}</p>}
              </div>
              {submitError && <p className="text-sm text-destructive">{submitError}</p>}
              <Button variant="hero" type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? (<><Loader2 className="animate-spin" size={16} /> Updating…</>) : "Update Password"}
              </Button>
            </form>
          )}
          <Link to="/auth" className="block text-center text-sm text-primary hover:underline mt-4">Back to Login</Link>
        </div>
      </div>
    </div>
  );
}
