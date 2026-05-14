import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Link2, Check, Info } from "lucide-react";
import { toast } from "sonner";

interface Props {
  videoId: string;
  className?: string;
  size?: "sm" | "default" | "lg" | "icon";
}

export const CopyNflowLinkButton = ({ videoId, className = "" }: Props) => {
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    const url = `${window.location.origin}/video/${videoId}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      toast.success("Link copied");
      setTimeout(() => setCopied(false), 1800);
    });
  };

  return (
    <div className={`inline-flex items-center gap-1 ${className}`}>
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={handleCopy}
        className="h-9 w-9"
        title="Copy Nevorai video link"
        aria-label="Copy Nevorai video link"
      >
        {copied ? <Check size={16} className="text-primary" /> : <Link2 size={16} />}
      </Button>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-muted-foreground"
            title="What is this?"
            aria-label="What is this link for?"
          >
            <Info size={15} />
          </Button>
        </PopoverTrigger>
        <PopoverContent side="top" align="end" className="w-64 text-xs leading-relaxed">
          Copy this link to use this video in your own funnel. Open Nevorai → Videos → <span className="font-medium">Add via Nevorai Link</span>, then paste it.
        </PopoverContent>
      </Popover>
    </div>
  );
};
