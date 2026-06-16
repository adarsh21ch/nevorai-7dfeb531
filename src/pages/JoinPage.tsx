import { useEffect, useState } from "react";
import { useParams, useNavigate } from "@/lib/router-compat";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, CheckCircle2, AlertCircle, Users } from "lucide-react";
import { Logo } from "@/components/landing/Logo";

type Status = "loading" | "need_auth" | "connecting" | "connected" | "error";

export default function JoinPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [status, setStatus] = useState<Status>("loading");
  const [uplineName, setUplineName] = useState<string>("");
  const [error, setError] = useState<string>("");

  // Resolve upline display name from the public profile view.
  useEffect(() => {
    if (!token) return;
    (async () => {
      const { data } = await (supabase as any)
        .from("profiles")
        .select("full_name, email")
        .eq("connect_token", token)
        .maybeSingle();
      if (data) setUplineName(data.full_name || data.email || "your upline");
      else setError("This connect link is invalid or has expired.");
    })();
  }, [token]);

  // Decide what to do once auth state resolves.
  useEffect(() => {
    if (authLoading) return;
    if (!token) return;
    if (!user) {
      // Stash intent and send to auth; come back here after sign-in.
      try { sessionStorage.setItem("nev_join_token", token); } catch {}
      setStatus("need_auth");
      return;
    }
    void doConnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user, token]);

  const doConnect = async () => {
    setStatus("connecting");
    const { error: rpcError } = await supabase.rpc("connect_to_upline", {
      p_token: token,
      p_source: "connect_link",
    });
    if (rpcError) {
      setError(rpcError.message || "Could not connect.");
      setStatus("error");
      return;
    }
    try { sessionStorage.removeItem("nev_join_token"); } catch {}
    setStatus("connected");
    setTimeout(() => navigate("/dashboard"), 1500);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-3 items-center text-center">
          <Logo />
          <CardTitle className="flex items-center justify-center gap-2 text-xl">
            <Users className="h-5 w-5 text-primary" />
            Join {uplineName ? uplineName + "'s" : "your upline's"} team
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          {status === "loading" && (
            <p className="flex items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Checking link…
            </p>
          )}

          {status === "need_auth" && (
            <>
              <p className="text-muted-foreground">
                Sign in (or create a free account) to connect with{" "}
                <span className="font-medium text-foreground">{uplineName}</span> and
                automatically receive all their funnel share links.
              </p>
              <div className="flex flex-col gap-2">
                <Button
                  className="w-full"
                  onClick={() => navigate(`/auth?redirect=/join/${token}`)}
                >
                  Sign in to continue
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => navigate(`/auth?mode=signup&redirect=/join/${token}`)}
                >
                  Create a free account
                </Button>
              </div>
            </>
          )}

          {status === "connecting" && (
            <p className="flex items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Connecting you to {uplineName}…
            </p>
          )}

          {status === "connected" && (
            <div className="space-y-2">
              <CheckCircle2 className="h-10 w-10 text-primary mx-auto" />
              <p className="font-medium">You're connected to {uplineName}!</p>
              <p className="text-sm text-muted-foreground">
                Personal share links for every funnel have been generated. Redirecting…
              </p>
            </div>
          )}

          {status === "error" && (
            <div className="space-y-2">
              <AlertCircle className="h-10 w-10 text-destructive mx-auto" />
              <p className="text-sm text-destructive">{error || "Something went wrong."}</p>
              <Button variant="outline" onClick={() => navigate("/dashboard")}>
                Go to dashboard
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
