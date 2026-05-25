import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Search, Send, User, Bot } from "lucide-react";
import { toast } from "sonner";

interface ConversationSummary {
  phone_number: string;
  last_message: string;
  last_direction: string;
  last_status: string;
  last_at: string;
  total_messages: number;
  name: string | null;
  is_lead: boolean;
  is_known_user: boolean;
  bot_paused: boolean;
}

interface ConversationMessage {
  id: string;
  phone_number: string;
  direction: "inbound" | "outbound";
  message_body: string | null;
  status: string;
  reply_method: string | null;
  ai_model: string | null;
  created_at: string;
}

function toConversationMessage(row: any): ConversationMessage {
  return {
    id: String(row?.id ?? ""),
    phone_number: String(row?.phone_number ?? ""),
    direction: row?.direction === "outbound" ? "outbound" : "inbound",
    message_body: typeof row?.message_body === "string" ? row.message_body : null,
    status: String(row?.status ?? ""),
    reply_method: typeof row?.reply_method === "string" ? row.reply_method : null,
    ai_model: typeof row?.ai_model === "string" ? row.ai_model : null,
    created_at: String(row?.created_at ?? ""),
  };
}

const REPLY_METHOD_STYLES: Record<string, string> = {
  rule_based: "bg-blue-500/10 text-blue-600 border-blue-500/30",
  ai: "bg-purple-500/10 text-purple-600 border-purple-500/30",
  personalized: "bg-green-500/10 text-green-600 border-green-500/30",
  verification: "bg-amber-500/10 text-amber-600 border-amber-500/30",
  manual: "bg-pink-500/10 text-pink-600 border-pink-500/30",
  template: "bg-indigo-500/10 text-indigo-600 border-indigo-500/30",
  none: "bg-muted text-muted-foreground",
};

export function WhatsAppConversationsTab() {
  const qc = useQueryClient();
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);

  // Load conversation summaries (one row per phone)
  const { data: summaries, isLoading } = useQuery({
    queryKey: ["whatsapp_conversation_summaries"],
    queryFn: async (): Promise<ConversationSummary[]> => {
      const { data: convos } = await supabase
        .from("whatsapp_conversations" as any)
        .select("phone_number, direction, message_body, status, created_at")
        .order("created_at", { ascending: false })
        .limit(1000);

      if (!convos) return [];

      // Group by phone, take first (latest) entry per phone
      const byPhone = new Map<string, ConversationSummary>();
      for (const row of convos as any[]) {
        const phone = row.phone_number as string;
        if (!byPhone.has(phone)) {
          byPhone.set(phone, {
            phone_number: phone,
            last_message: row.message_body || "(no text)",
            last_direction: row.direction,
            last_status: row.status,
            last_at: row.created_at,
            total_messages: 0,
            name: null,
            is_lead: false,
            is_known_user: false,
            bot_paused: false,
          });
        }
        byPhone.get(phone)!.total_messages += 1;
      }

      const phones = [...byPhone.keys()];
      if (phones.length === 0) return [];

      // Look up names from leads and profiles
      const [{ data: leads }, { data: profiles }, { data: pauses }] = await Promise.all([
        supabase
          .from("whatsapp_leads" as any)
          .select("phone_number, name")
          .in("phone_number", phones),
        supabase
          .from("profiles")
          .select("full_name, phone, whatsapp_number")
          .or(phones.map((p) => `phone.eq.${p},whatsapp_number.eq.${p},phone.eq.${p.replace(/^91/, "")},whatsapp_number.eq.${p.replace(/^91/, "")}`).join(",")),
        supabase
          .from("whatsapp_bot_pauses" as any)
          .select("phone_number")
          .in("phone_number", phones),
      ]);

      const leadByPhone = new Map((leads || []).map((l: any) => [l.phone_number, l.name]));
      const pausedSet = new Set((pauses || []).map((p: any) => p.phone_number));
      const profileMap = new Map<string, string>();
      for (const p of (profiles || []) as any[]) {
        if (p.phone) profileMap.set(String(p.phone).replace(/\D/g, ""), p.full_name);
        if (p.whatsapp_number) profileMap.set(String(p.whatsapp_number).replace(/\D/g, ""), p.full_name);
      }

      for (const phone of phones) {
        const s = byPhone.get(phone)!;
        s.is_lead = leadByPhone.has(phone);
        s.bot_paused = pausedSet.has(phone);
        const matchProfile =
          profileMap.get(phone) ||
          profileMap.get(phone.replace(/^91/, "")) ||
          null;
        if (matchProfile) {
          s.name = matchProfile;
          s.is_known_user = true;
        } else if (leadByPhone.has(phone)) {
          s.name = (leadByPhone.get(phone) as string | null) || null;
        }
      }

      return [...byPhone.values()].sort((a, b) =>
        a.last_at > b.last_at ? -1 : 1,
      );
    },
  });

  // Load messages for selected phone
  const { data: messages } = useQuery({
    queryKey: ["whatsapp_conversation_messages", selectedPhone],
    queryFn: async (): Promise<ConversationMessage[]> => {
      if (!selectedPhone) return [];
      const { data } = await supabase
        .from("whatsapp_conversations" as any)
        .select("*")
        .eq("phone_number", selectedPhone)
        .order("created_at", { ascending: true })
        .limit(500);

      const rows = Array.isArray(data) ? data : [];
      return rows.map(toConversationMessage);
    },
    enabled: !!selectedPhone,
  });

  const filtered = (summaries || []).filter((s) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      s.phone_number.includes(q) ||
      (s.name || "").toLowerCase().includes(q) ||
      (s.last_message || "").toLowerCase().includes(q)
    );
  });

  const selectedSummary = summaries?.find((s) => s.phone_number === selectedPhone);

  const handleSendManual = async () => {
    if (!selectedPhone || !replyText.trim()) return;
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-send-text", {
        body: { to: selectedPhone, message: replyText.trim() },
      });
      if (error) throw new Error(error.message);
      toast.success("Message sent");
      setReplyText("");
      qc.invalidateQueries({ queryKey: ["whatsapp_conversation_messages", selectedPhone] });
      qc.invalidateQueries({ queryKey: ["whatsapp_conversation_summaries"] });
    } catch (e) {
      toast.error((e as Error).message || "Failed to send");
    } finally {
      setSending(false);
    }
  };

  const handleTogglePause = async (paused: boolean) => {
    if (!selectedPhone) return;
    try {
      if (paused) {
        await supabase
          .from("whatsapp_bot_pauses" as any)
          .insert({ phone_number: selectedPhone });
        toast.success("Bot paused — you're now in control");
      } else {
        await supabase
          .from("whatsapp_bot_pauses" as any)
          .delete()
          .eq("phone_number", selectedPhone);
        toast.success("Bot resumed");
      }
      qc.invalidateQueries({ queryKey: ["whatsapp_conversation_summaries"] });
    } catch (e) {
      toast.error("Failed to update pause state");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!summaries || summaries.length === 0) {
    return (
      <Card>
        <CardContent className="py-16 text-center text-sm text-muted-foreground">
          No WhatsApp conversations yet. Send a message to your business number and it will appear here.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4 h-[70vh]">
      {/* Left: conversation list */}
      <Card className="flex flex-col overflow-hidden">
        <div className="p-3 border-b">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search phone, name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-9"
            />
          </div>
        </div>
        <ScrollArea className="flex-1">
          <div className="divide-y">
            {filtered.map((s) => (
              <button
                key={s.phone_number}
                onClick={() => setSelectedPhone(s.phone_number)}
                className={`w-full text-left p-3 hover:bg-muted/50 transition ${
                  selectedPhone === s.phone_number ? "bg-muted" : ""
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="font-medium text-sm truncate">
                      {s.name || `+${s.phone_number}`}
                    </span>
                    {s.is_known_user && (
                      <Badge variant="outline" className="h-5 text-[10px] border-green-500/30 text-green-600 bg-green-500/10 shrink-0">
                        User
                      </Badge>
                    )}
                    {s.is_lead && !s.is_known_user && (
                      <Badge variant="outline" className="h-5 text-[10px] border-amber-500/30 text-amber-600 bg-amber-500/10 shrink-0">
                        Lead
                      </Badge>
                    )}
                    {s.bot_paused && (
                      <Badge variant="outline" className="h-5 text-[10px] border-pink-500/30 text-pink-600 bg-pink-500/10 shrink-0">
                        Paused
                      </Badge>
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {new Date(s.last_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                  </span>
                </div>
                {s.name && (
                  <div className="text-[10px] text-muted-foreground mb-0.5">+{s.phone_number}</div>
                )}
                <div className="text-xs text-muted-foreground truncate">
                  {s.last_direction === "outbound" ? "↓ " : ""}{s.last_message}
                </div>
                <div className="text-[10px] text-muted-foreground mt-1">{s.total_messages} messages</div>
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="p-6 text-center text-sm text-muted-foreground">No matches</div>
            )}
          </div>
        </ScrollArea>
      </Card>

      {/* Right: chat view */}
      <Card className="flex flex-col overflow-hidden">
        {!selectedPhone ? (
          <CardContent className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
            Select a conversation from the left
          </CardContent>
        ) : (
          <>
            <div className="p-3 border-b flex items-center justify-between">
              <div className="min-w-0">
                <div className="font-medium text-sm truncate">
                  {selectedSummary?.name || `+${selectedPhone}`}
                </div>
                <div className="text-xs text-muted-foreground">+{selectedPhone}</div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Bot</span>
                <Switch
                  checked={!selectedSummary?.bot_paused}
                  onCheckedChange={(checked) => handleTogglePause(!checked)}
                />
              </div>
            </div>

            <ScrollArea className="flex-1 p-4">
              <div className="space-y-3">
                {(messages || []).map((m) => (
                  <div
                    key={m.id}
                    className={`flex ${m.direction === "outbound" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[75%] rounded-lg px-3 py-2 ${
                        m.direction === "outbound"
                          ? "bg-primary/10 border border-primary/20"
                          : "bg-muted"
                      }`}
                    >
                      <div className="flex items-center gap-1 mb-1">
                        {m.direction === "outbound" ? (
                          <Bot className="h-3 w-3 text-muted-foreground" />
                        ) : (
                          <User className="h-3 w-3 text-muted-foreground" />
                        )}
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(m.created_at).toLocaleString("en-IN", {
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                        {m.direction === "outbound" && m.reply_method && (
                          <Badge
                            variant="outline"
                            className={`h-4 px-1 text-[9px] ml-1 ${REPLY_METHOD_STYLES[m.reply_method] || ""}`}
                          >
                            {m.reply_method}
                          </Badge>
                        )}
                      </div>
                      <div className="text-sm whitespace-pre-wrap">
                        {m.message_body || (
                          <span className="text-muted-foreground italic">(no text — {m.status})</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            <div className="p-3 border-t">
              <div className="flex gap-2">
                <Textarea
                  placeholder="Type a manual reply..."
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  rows={2}
                  className="resize-none"
                />
                <Button
                  onClick={handleSendManual}
                  disabled={sending || !replyText.trim()}
                  className="self-end"
                >
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">
                Manual messages bypass the bot but are still logged.
              </p>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
