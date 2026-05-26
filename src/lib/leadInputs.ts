/**
 * Shared input normalization + validation for public lead-capture forms.
 * Keeps phone/email/name handling identical across landing, funnel, live, etc.
 */
import { isValidPhoneNumber as _isValidIntl } from "react-phone-number-input";


/** Strip non-digits, drop leading +91 / 91 / 0, cap at 10. */
export function normalizePhone(raw: string): string {
  let d = (raw || "").replace(/\D+/g, "");
  if (d.length > 10 && d.startsWith("91")) d = d.slice(2);
  while (d.length > 10 && d.startsWith("0")) d = d.slice(1);
  if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  return d.slice(0, 10);
}

/** Trim + collapse internal whitespace runs. */
export function trimSmart(v: string): string {
  return (v || "").replace(/\s+/g, " ").trim();
}

export function validatePhone(v: string): string | null {
  const raw = (v || "").trim();
  if (!raw) return "Phone number is required";
  // International (E.164) — validate with libphonenumber
  if (raw.startsWith("+")) {
    try {
      return _isValidIntl(raw) ? null : "Enter a valid phone number";
    } catch {
      const d = raw.replace(/\D/g, "");
      return d.length >= 8 && d.length <= 15 ? null : "Enter a valid phone number";
    }
  }
  // Legacy Indian 10-digit
  const d = normalizePhone(raw);
  if (!d) return "Phone number is required";
  if (d.length !== 10) return "Enter a valid 10-digit phone number";
  if (!/^[6-9]/.test(d)) return "Enter a valid Indian mobile number";
  return null;
}
  // Legacy Indian 10-digit
  const d = normalizePhone(raw);
  if (!d) return "Phone number is required";
  if (d.length !== 10) return "Enter a valid 10-digit phone number";
  if (!/^[6-9]/.test(d)) return "Enter a valid Indian mobile number";
  return null;
}

export function validateEmail(v: string): string | null {
  const t = (v || "").trim();
  if (!t) return "Email is required";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)) return "Enter a valid email address";
  return null;
}

export function validateRequired(v: string, label = "This field"): string | null {
  if (!trimSmart(v || "")) return `${label} is required`;
  return null;
}

/** Common input prop bundles. */
export const phoneInputProps = {
  type: "tel" as const,
  inputMode: "numeric" as const,
  autoComplete: "tel" as const,
  maxLength: 14,
  pattern: "[0-9]*",
};

export const emailInputProps = {
  type: "email" as const,
  inputMode: "email" as const,
  autoComplete: "email" as const,
  autoCapitalize: "none" as const,
  autoCorrect: "off" as const,
  spellCheck: false,
};

export const nameInputProps = {
  autoCapitalize: "words" as const,
  autoComplete: "name" as const,
  spellCheck: false,
};

export const cityInputProps = {
  autoCapitalize: "words" as const,
  autoComplete: "address-level2" as const,
  spellCheck: false,
};

/** Scroll first errored field into view. Pass a record of refs keyed by field name. */
export function scrollToFirstError(
  errors: Record<string, string | null | undefined>,
  refs: Record<string, HTMLElement | null | undefined>,
  order?: string[]
) {
  const keys = order ?? Object.keys(errors);
  for (const k of keys) {
    if (errors[k]) {
      const el = refs[k];
      if (el && typeof el.scrollIntoView === "function") {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        if (typeof (el as HTMLInputElement).focus === "function") {
          try { (el as HTMLInputElement).focus({ preventScroll: true }); } catch {}
        }
      }
      return;
    }
  }
}
