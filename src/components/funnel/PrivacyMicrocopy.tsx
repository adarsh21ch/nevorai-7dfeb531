import { ShieldCheck } from "lucide-react";

interface Props {
  /** Override the muted color from outside if the surrounding card uses a custom palette. */
  color?: string;
  className?: string;
}

/**
 * One-liner shown under public lead-form submit buttons.
 * Reduces submit hesitation and signals data hygiene.
 */
export const PrivacyMicrocopy = ({ color, className }: Props) => (
  <p
    className={`mt-3 flex items-center justify-center gap-1.5 text-[11px] leading-snug ${className || ""}`}
    style={color ? { color } : undefined}
  >
    <ShieldCheck size={11} className="shrink-0" />
    <span>We'll never share your details. Unsubscribe anytime.</span>
  </p>
);
