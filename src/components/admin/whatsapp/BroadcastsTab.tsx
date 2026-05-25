import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Loader2, Plus, Megaphone } from "lucide-react";
import { toast } from "sonner";
import { supabase, supabaseProjectUrl, supabasePublishableKey } from "@/integrations/supabase/client";

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  message_body: z.string().min(1, "Message is required"),
  status: z.enum(["active", "paused", "converted", "all"]),
  send_mode: z.enum(["now", "later"]),
  scheduled_at: z.string().optional(),
}).refine((d) => d.send_mode === "now" || (d.scheduled_at && d.scheduled_at.length > 0), {
  message: "Pick a date/time",
  path: ["scheduled_at"],
});

type FormValues = z.infer<typeof schema>;

interface Broadcast {
  id: string;
  name: string;
  message_body?: string | null;
  status: string;
  scheduled_at: string | null;
  sent_count?: number | null;
  failed_count?: number | null;
  created_at: string;
}

async function authHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token || supabasePublishableKey;
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
    apikey: supabasePublishableKey,
  };
}

export function BroadcastsTab() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [open, setOpen] = useState(false);

  const { data: broadcasts, isLoading } = useQuery({
    queryKey: ["whatsapp-broadcasts", statusFilter],
    queryFn: async (): Promise<Broadcast[]> => {
      const headers = await authHeaders();
      const qs = statusFilter !== "all" ? `?status=${statusFilter}` : "";
      const res = await fetch(`/api/admin/whatsapp-broadcasts${qs}`, { headers });
      if (!res.ok) throw new Error("Failed to load broadcasts");
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", message_body: "", status: "all", send_mode: "now", scheduled_at: "" },
  });

  const sendMode = form.watch("send_mode");
  const submitting = form.formState.isSubmitting;

  const onSubmit = async (values: FormValues) => {
    try {
      const headers = await authHeaders();
      const payload = {
        name: values.name,
        message_body: values.message_body,
        target_filter: { status: values.status },
        scheduled_at: values.send_mode === "later" && values.scheduled_at
          ? new Date(values.scheduled_at).toISOString()
          : null,
      };
      const res = await fetch("/api/admin/whatsapp-broadcasts", {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to create broadcast");
      }
      const created = await res.json();
      const broadcastId = Array.isArray(created) ? created[0]?.id : created?.id;

      if (values.send_mode === "now" && broadcastId) {
        const { data: { session } } = await supabase.auth.getSession();
        const userId = session?.user?.id;
        const sendRes = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL || supabaseProjectUrl}/functions/v1/whatsapp-broadcast-send`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              apikey: supabasePublishableKey,
              Authorization: `Bearer ${session?.access_token || supabasePublishableKey}`,
            },
            body: JSON.stringify({ broadcast_id: broadcastId, user_id: userId }),
          },
        );
        if (!sendRes.ok) {
          const err = await sendRes.json().catch(() => ({}));
          toast.error(err.error || "Created, but failed to start sending");
        }
      }

      toast.success("Broadcast created");
      qc.invalidateQueries({ queryKey: ["whatsapp-broadcasts"] });
      form.reset();
      setOpen(false);
    } catch (e) {
      toast.error((e as Error).message || "Failed");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-medium">Broadcasts</h3>
          <p className="text-sm text-muted-foreground">
            One-time messages to a filtered audience.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="scheduled">Scheduled</SelectItem>
              <SelectItem value="sending">Sending</SelectItem>
              <SelectItem value="sent">Sent</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4 mr-2" /> Create Broadcast
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      ) : (broadcasts || []).length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center space-y-3">
            <Megaphone className="h-10 w-10 mx-auto text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No broadcasts yet.</p>
            <Button size="sm" onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4 mr-2" /> Create your first broadcast
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden md:table-cell">Scheduled</TableHead>
                  <TableHead className="hidden md:table-cell">Sent / Failed</TableHead>
                  <TableHead className="hidden lg:table-cell">Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(broadcasts || []).map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="font-medium">{b.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">{b.status}</Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-xs">
                      {b.scheduled_at ? new Date(b.scheduled_at).toLocaleString() : "—"}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-xs">
                      {b.sent_count ?? 0} / <span className="text-red-500">{b.failed_count ?? 0}</span>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-xs">
                      {new Date(b.created_at).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) form.reset(); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Broadcast</DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="name">Broadcast name</Label>
              <Input id="name" {...form.register("name")} placeholder="June launch broadcast" />
              {form.formState.errors.name && (
                <p className="text-xs text-red-500">{form.formState.errors.name.message}</p>
              )}
            </div>

            <div className="space-y-1">
              <Label htmlFor="message_body">Message</Label>
              <Textarea
                id="message_body"
                rows={5}
                placeholder="Type message... use {{name}} for personalization"
                {...form.register("message_body")}
              />
              {form.formState.errors.message_body && (
                <p className="text-xs text-red-500">{form.formState.errors.message_body.message}</p>
              )}
            </div>

            <div className="space-y-1">
              <Label>Target audience (status)</Label>
              <Select
                value={form.watch("status")}
                onValueChange={(v) => form.setValue("status", v as FormValues["status"])}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="paused">Paused</SelectItem>
                  <SelectItem value="converted">Converted</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Schedule</Label>
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    value="now"
                    checked={sendMode === "now"}
                    onChange={() => form.setValue("send_mode", "now")}
                  />
                  Send now
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    value="later"
                    checked={sendMode === "later"}
                    onChange={() => form.setValue("send_mode", "later")}
                  />
                  Schedule for later
                </label>
                {sendMode === "later" && (
                  <>
                    <Input type="datetime-local" {...form.register("scheduled_at")} />
                    {form.formState.errors.scheduled_at && (
                      <p className="text-xs text-red-500">{form.formState.errors.scheduled_at.message}</p>
                    )}
                  </>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
