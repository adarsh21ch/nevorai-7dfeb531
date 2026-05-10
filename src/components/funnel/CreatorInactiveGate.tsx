import { Pause } from "lucide-react";

interface Props {
  creatorName?: string | null;
}

export const CreatorInactiveGate = ({ creatorName }: Props) => {
  const name = creatorName?.trim() || "the host";
  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-[#09090b] text-white px-4 py-10">
      <div className="w-full max-w-md text-center space-y-6">
        <div className="w-16 h-16 mx-auto rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
          <Pause size={28} className="text-white/70" />
        </div>
        <div className="space-y-2">
          <h1 className="text-xl font-semibold leading-tight">This Video Is Temporarily Unavailable</h1>
          <p className="text-sm text-white/65 leading-relaxed">
            The content shared by <span className="text-white font-medium">{name}</span> is currently paused. Please reach out to them directly to get access.
          </p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-left">
          <p className="text-xs font-semibold text-white/80 mb-2">What you can do:</p>
          <ul className="space-y-1.5 text-sm text-white/70">
            <li className="flex gap-2"><span className="text-white/40">→</span> Contact {name} on WhatsApp or phone</li>
            <li className="flex gap-2"><span className="text-white/40">→</span> Ask them to resend the video link</li>
            <li className="flex gap-2"><span className="text-white/40">→</span> Check back later — it may be back soon</li>
          </ul>
        </div>
        <p className="text-[11px] text-white/40">If you need help, contact {name} directly.</p>
      </div>
    </div>
  );
};
