import { useEffect, useRef, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, Send, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type ChatMsg = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "How many views this week?",
  "Which funnel is performing best?",
  "How many leads did I get today?",
  "What's my conversion rate?",
];

const NevAIPage = () => {
  useDocumentTitle("Nev AI");
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [usage, setUsage] = useState<{ used: number; limit: number } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    const nextHistory = [...messages, { role: "user" as const, content: trimmed }];
    setMessages(nextHistory);
    setInput("");
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("nev-ai-query", {
        body: { message: trimmed, history: messages },
      });

      // Supabase wraps non-2xx in `error`, but the function still returns a body
      // with `reply` for 403/429. Try to read it.
      let reply: string | undefined;
      let usagePayload: { used: number; limit: number } | null = null;

      if (data && typeof data === "object") {
        reply = (data as any).reply;
        usagePayload = (data as any).usage ?? null;
      }
      if (!reply && error) {
        const ctx: any = (error as any).context;
        try {
          const body = ctx?.body
            ? typeof ctx.body === "string"
              ? JSON.parse(ctx.body)
              : ctx.body
            : null;
          if (body?.reply) reply = body.reply;
          if (body?.usage) usagePayload = body.usage;
        } catch {
          // ignore parse errors
        }
        // try response.json() if body wasn't preparsed
        if (!reply && ctx?.response && typeof ctx.response.json === "function") {
          try {
            const body = await ctx.response.json();
            if (body?.reply) reply = body.reply;
            if (body?.usage) usagePayload = body.usage;
          } catch {
            // ignore
          }
        }
      }

      if (!reply) reply = "Something went wrong, please try again.";
      setMessages((prev) => [...prev, { role: "assistant", content: reply! }]);
      if (usagePayload) setUsage(usagePayload);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Something went wrong, please try again." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <DashboardLayout>
      <div className="flex h-[calc(100vh-7rem)] flex-col gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
              <Sparkles size={18} className="text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-heading font-bold sm:text-2xl">Nev AI</h1>
              <p className="text-xs text-muted-foreground sm:text-sm">
                Ask anything about your analytics — views, leads, funnels, conversion.
              </p>
            </div>
          </div>
          <div className="page-header-accent" />
        </div>

        <div className="premium-card flex min-h-0 flex-1 flex-col overflow-hidden p-0">
          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-5 sm:px-6">
            {messages.length === 0 ? (
              <div className="mx-auto max-w-2xl">
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <Sparkles size={16} className="text-primary" />
                  </div>
                  <div className="rounded-2xl rounded-tl-sm bg-muted px-4 py-3 text-sm">
                    Hi! I’m Nev AI. Ask me about your views, leads, funnels, or conversion.
                    Try one of these to get started:
                  </div>
                </div>
                <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => sendMessage(s)}
                      disabled={loading}
                      className="rounded-xl border border-border bg-card px-3 py-2.5 text-left text-sm transition-colors hover:border-primary/50 hover:bg-primary/5 disabled:opacity-50"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mx-auto flex max-w-2xl flex-col gap-4">
                {messages.map((m, i) => (
                  <MessageBubble key={i} role={m.role} content={m.content} />
                ))}
                {loading && (
                  <div className="flex items-start gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                      <Sparkles size={16} className="text-primary" />
                    </div>
                    <div className="flex items-center gap-1 rounded-2xl rounded-tl-sm bg-muted px-4 py-3">
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:-0.3s]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:-0.15s]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/60" />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Composer */}
          <div className="border-t border-border bg-background/40 px-4 py-3 sm:px-6">
            <div className="mx-auto flex max-w-2xl items-end gap-2">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKey}
                placeholder="Ask Nev AI…"
                rows={1}
                disabled={loading}
                className="max-h-32 min-h-[44px] resize-none"
              />
              <Button
                onClick={() => sendMessage(input)}
                disabled={loading || !input.trim()}
                size="icon"
                className="h-11 w-11 shrink-0"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              </Button>
            </div>
            <div className="mx-auto mt-2 flex max-w-2xl items-center justify-between text-[11px] text-muted-foreground">
              <span>Enter to send · Shift+Enter for newline</span>
              {usage && (
                <span>
                  {usage.used}/{usage.limit} questions today
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

function MessageBubble({ role, content }: { role: "user" | "assistant"; content: string }) {
  const isUser = role === "user";
  return (
    <div className={cn("flex items-start gap-3", isUser && "flex-row-reverse")}>
      {!isUser && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
          <Sparkles size={16} className="text-primary" />
        </div>
      )}
      <div
        className={cn(
          "max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm",
          isUser
            ? "rounded-tr-sm bg-primary text-primary-foreground"
            : "rounded-tl-sm bg-muted text-foreground",
        )}
      >
        {content}
      </div>
    </div>
  );
}

export default NevAIPage;
