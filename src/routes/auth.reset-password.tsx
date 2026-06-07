import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Logo } from "@/components/landing/Logo";
import { requestPasswordReset } from "@/lib/auth.functions";
import { toast } from "sonner";
import { Lock } from "lucide-react";

export const Route = createFileRoute("/auth/reset-password")({ component: ResetPassword });

function ResetPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/update-password`,
    });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    setSent(true);
    toast.success("Password reset email sent!");
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 gradient-bg-subtle">
      <div className="absolute inset-0 animate-grid opacity-30" />
      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <Link to="/" className="inline-block"><Logo size="lg" /></Link>
        </div>
        <div className="glass-card p-8">
          {sent ? (
            <div className="text-center space-y-4">
              <div className="w-14 h-14 rounded-xl bg-success/10 flex items-center justify-center mx-auto">
                <Lock className="text-success" size={24} />
              </div>
              <h2 className="text-lg font-semibold">Check your email</h2>
              <p className="text-sm text-muted-foreground">We've sent a reset link to <strong>{email}</strong></p>
              <Link to="/auth"><Button variant="outline" className="w-full">Back to Login</Button></Link>
            </div>
          ) : (
            <>
              <h2 className="text-lg font-semibold mb-2">Reset your password</h2>
              <p className="text-sm text-muted-foreground mb-6">Enter your email and we'll send you a reset link.</p>
              <form onSubmit={handleReset} className="space-y-4">
                <Input type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className="bg-muted border-border" required />
                <Button variant="hero" className="w-full" disabled={loading}>{loading ? "Sending..." : "Send Reset Link"}</Button>
              </form>
              <Link to="/auth" className="block text-center text-sm text-primary hover:underline mt-4">Back to Login</Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
