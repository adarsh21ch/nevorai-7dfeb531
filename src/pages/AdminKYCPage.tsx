import { AdminLayout } from "@/components/layout/AdminLayout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useState } from "react";
import { Shield, Check, X, Eye, EyeOff, MapPin, FileText, CreditCard } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { maskPan, maskAadhaar } from "@/lib/mask";

const AdminKYCPage = () => {
  const queryClient = useQueryClient();
  const [selectedKyc, setSelectedKyc] = useState<any>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [docPreviewUrl, setDocPreviewUrl] = useState<string | null>(null);
  const [revealId, setRevealId] = useState(false);

  const { data: submissions = [], isLoading } = useQuery({
    queryKey: ["admin-kyc-all"],
    queryFn: async () => {
      const { data } = await supabase.from("user_kyc_submissions").select("*").order("submitted_at", { ascending: false });
      return data || [];
    },
  });

  const reviewMutation = useMutation({
    mutationFn: async ({ id, action }: { id: string; userId: string; action: "approved" | "rejected" }) => {
      // Single atomic RPC: updates submission AND flips profiles.is_verified
      // (only admins can run it; checks role server-side).
      const { error } = await (supabase as any).rpc("admin_review_kyc", {
        _submission_id: id,
        _action: action,
        _reason: action === "rejected" ? rejectionReason : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-kyc-all"] });
      toast.success("KYC review saved");
      setSelectedKyc(null);
      setDocPreviewUrl(null);
      setRejectionReason("");
    },
    onError: (e: any) => toast.error(e?.message || "Failed to save review"),
  });

  const getDocUrl = async (path: string) => {
    if (!path) return null;
    const { data } = await supabase.storage.from("kyc-documents").createSignedUrl(path, 300);
    return data?.signedUrl || null;
  };

  const openReview = async (kyc: any) => {
    setSelectedKyc(kyc);
    setRejectionReason("");
    setRevealId(false); // always start masked
    if (kyc.doc_image_url) {
      const url = await getDocUrl(kyc.doc_image_url);
      setDocPreviewUrl(url);
    } else {
      setDocPreviewUrl(null);
    }
  };

  const pending = submissions.filter((s) => s.status === "pending");
  const reviewed = submissions.filter((s) => s.status !== "pending");
  const DocIcon = (type: string) => type === "pan" ? CreditCard : FileText;

  return (
    <AdminLayout>
      <div className="w-full min-w-0 space-y-4">
        <div>
          <h1 className="text-lg font-heading font-bold sm:text-2xl">Creator Verification</h1>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">Review and approve creator identity submissions.</p>
        </div>

        {pending.length === 0 && !isLoading ? (
          <div className="glass-card p-10 text-center">
            <Shield size={36} className="mx-auto mb-3 text-muted-foreground" />
            <h3 className="mb-1 text-sm font-heading font-semibold">No pending submissions</h3>
            <p className="text-xs text-muted-foreground">All caught up!</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            <h2 className="text-xs font-medium text-muted-foreground">Pending ({pending.length})</h2>
            {pending.map((kyc) => {
              const Icon = DocIcon(kyc.doc_type || "");
              return (
                <div key={kyc.id} className="glass-card p-3 space-y-2.5 sm:flex sm:items-center sm:justify-between sm:gap-4 sm:space-y-0 sm:p-4">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                      <Icon size={15} className="text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{kyc.full_name}</p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[10px] text-muted-foreground sm:text-xs">
                        {kyc.city && (
                          <span className="inline-flex items-center gap-0.5">
                            <MapPin size={9} />
                            {kyc.city}
                          </span>
                        )}
                        <span>{kyc.doc_type === "pan" ? "PAN" : kyc.doc_type === "aadhaar" ? "Aadhaar" : "Doc"}</span>
                        <span>{new Date(kyc.submitted_at!).toLocaleDateString("en-IN")}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex w-full gap-2 sm:w-auto">
                    <Button size="sm" variant="outline" className="h-9 flex-1 text-xs sm:flex-none" onClick={() => openReview(kyc)}>
                      <Eye size={13} /> Review
                    </Button>
                    <Button
                      size="sm"
                      variant="default"
                      className="h-9 flex-1 bg-primary text-primary-foreground hover:bg-primary/90 sm:flex-none"
                      onClick={() => reviewMutation.mutate({ id: kyc.id, userId: kyc.user_id, action: "approved" })}
                    >
                      <Check size={13} /> Approve
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {reviewed.length > 0 && (
          <div className="space-y-2.5">
            <h2 className="text-xs font-medium text-muted-foreground">Reviewed ({reviewed.length})</h2>
            {reviewed.map((kyc) => (
              <div key={kyc.id} className="glass-card flex flex-col gap-2.5 p-3 opacity-70 sm:flex-row sm:items-center sm:justify-between sm:p-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{kyc.full_name}</p>
                  <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] sm:text-xs ${kyc.status === "approved" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
                    {kyc.status === "approved" ? "Verified" : "Rejected"}
                  </span>
                </div>
                <Button size="sm" variant="ghost" className="h-9 self-start sm:self-auto" onClick={() => openReview(kyc)}>
                  <Eye size={13} /> View
                </Button>
              </div>
            ))}
          </div>
        )}

        <Dialog
          open={!!selectedKyc}
          onOpenChange={(open) => {
            if (!open) {
              setSelectedKyc(null);
              setDocPreviewUrl(null);
            }
          }}
        >
          <DialogContent className="max-h-[85vh] w-[calc(100vw-2rem)] max-w-lg overflow-y-auto border-border bg-card">
            <DialogHeader>
              <DialogTitle className="font-heading text-sm sm:text-base">Verification Details</DialogTitle>
            </DialogHeader>
            {selectedKyc && (() => {
              const rawId = selectedKyc.pan_number || selectedKyc.aadhar_number || "";
              const maskedId = !rawId
                ? "—"
                : selectedKyc.doc_type === "pan"
                  ? maskPan(rawId)
                  : maskAadhaar(rawId);
              return (
              <div className="space-y-3 text-sm">
                <div className="divide-y divide-border rounded-lg border border-border">
                  {[
                    { label: "Full Name", value: selectedKyc.full_name },
                    { label: "Location", value: [selectedKyc.city, selectedKyc.state].filter(Boolean).join(", ") || "—" },
                    { label: "Document", value: selectedKyc.doc_type === "pan" ? "PAN Card" : selectedKyc.doc_type === "aadhaar" ? "Aadhaar Card" : "—" },
                  ].map((row) => (
                    <div key={row.label} className="flex items-start justify-between gap-3 px-3 py-2.5">
                      <span className="text-[11px] text-muted-foreground">{row.label}</span>
                      <span className="max-w-[60%] break-words text-right text-xs font-medium">{row.value}</span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between gap-3 px-3 py-2.5">
                    <span className="text-[11px] text-muted-foreground">Number</span>
                    <div className="flex items-center gap-2">
                      <span className="break-all text-right text-xs font-medium font-mono">
                        {revealId ? rawId || "—" : maskedId}
                      </span>
                      {rawId && (
                        <button
                          type="button"
                          onClick={() => setRevealId((r) => !r)}
                          className="text-muted-foreground hover:text-foreground"
                          aria-label={revealId ? "Hide number" : "Reveal number"}
                        >
                          {revealId ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {docPreviewUrl && (
                  <div>
                    <p className="mb-1.5 text-[11px] text-muted-foreground">Uploaded Document</p>
                    <a href={docPreviewUrl} target="_blank" rel="noopener noreferrer">
                      <img src={docPreviewUrl} alt="ID Document" className="max-h-56 w-full rounded-lg border border-border bg-muted object-contain" />
                    </a>
                  </div>
                )}

                {selectedKyc.status === "pending" && (
                  <div className="space-y-3 border-t border-border pt-3">
                    <Textarea
                      placeholder="Rejection reason (required if rejecting)"
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      className="border-border bg-muted text-sm"
                    />
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Button
                        className="h-10 flex-1 bg-primary text-primary-foreground hover:bg-primary/90 text-sm"
                        onClick={() => reviewMutation.mutate({ id: selectedKyc.id, userId: selectedKyc.user_id, action: "approved" })}
                      >
                        <Check size={14} /> Approve
                      </Button>
                      <Button
                        variant="destructive"
                        className="h-10 flex-1 text-sm"
                        disabled={!rejectionReason.trim()}
                        onClick={() => reviewMutation.mutate({ id: selectedKyc.id, userId: selectedKyc.user_id, action: "rejected" })}
                      >
                        <X size={14} /> Reject
                      </Button>
                    </div>
                  </div>
                )}

                {selectedKyc.rejection_reason && selectedKyc.status === "rejected" && (
                  <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3">
                    <p className="text-[11px] text-muted-foreground">Rejection Reason</p>
                    <p className="mt-1 text-xs break-words">{selectedKyc.rejection_reason}</p>
                  </div>
                )}
              </div>
              );
            })()}
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
};

export default AdminKYCPage;
