import { Button } from "@/components/ui/button";
import { MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  /** Public URL to share. */
  url: string;
  /** Optional message prefix. A sensible default is used if omitted. */
  message?: string;
  /** Optional pre-filled phone number (digits only, with country code). When omitted, opens the contact picker. */
  phone?: string;
  variant?: "default" | "outline" | "ghost" | "secondary" | "link";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
  /** When true, render only the WhatsApp icon. */
  iconOnly?: boolean;
  label?: string;
}

const DEFAULT_MESSAGE = "Watch this short video here:";

/**
 * One-tap WhatsApp share. Network marketers and affiliate marketers send
 * smart links through WhatsApp — this is the primary share surface.
 */
export const WhatsAppShareButton = ({
  url,
  message = DEFAULT_MESSAGE,
  phone,
  variant = "default",
  size = "default",
  className,
  iconOnly = false,
  label = "Share on WhatsApp",
}: Props) => {
  const text = encodeURIComponent(`${message} ${url}`.trim());
  const target = phone
    ? `https://wa.me/${String(phone).replace(/\D/g, "")}?text=${text}`
    : `https://wa.me/?text=${text}`;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(target, "_blank", "noopener,noreferrer");
  };

  return (
    <Button
      type="button"
      onClick={handleClick}
      variant={variant}
      size={iconOnly ? "icon" : size}
      title={label}
      aria-label={label}
      className={cn(
        // WhatsApp brand green is intentional — universally recognized share affordance.
        variant === "default" && "bg-[#25d366] text-white hover:bg-[#1ebe57]",
        className,
      )}
    >
      <MessageCircle size={iconOnly ? 16 : 18} />
      {!iconOnly && <span>{label}</span>}
    </Button>
  );
};
