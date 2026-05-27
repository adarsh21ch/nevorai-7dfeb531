import * as React from "react";
import PhoneInput, {
  isValidPhoneNumber as _isValid,
  getCountryCallingCode,
  type Country,
} from "react-phone-number-input";
import "react-phone-number-input/style.css";
import { cn } from "@/lib/utils";

export type NPhoneInputProps = {
  value: string | undefined;
  onChange: (value: string | undefined) => void;
  placeholder?: string;
  className?: string;
  defaultCountry?: Country;
  disabled?: boolean;
  autoFocus?: boolean;
  id?: string;
  "aria-invalid"?: boolean;
};

/**
 * International phone input. Default country: India.
 *
 * Visual layout:
 *   [ 🇮🇳 +91 ▾ ] [ phone digits ]
 *
 * The small left box is the country picker — it shows the flag, the calling
 * code (e.g. "+91"), and is clickable to switch country. The right box is
 * just the local number digits (national formatting). The committed `value`
 * is always full E.164 (e.g. "+919876543210" or "+12025551234") or undefined.
 */
export const NPhoneInput = React.forwardRef<HTMLInputElement, NPhoneInputProps>(
  ({ value, onChange, placeholder, className, defaultCountry = "IN" as Country, ...rest }, ref) => {
    const [country, setCountry] = React.useState<Country | undefined>(defaultCountry);

    // Keep our local country state in sync if the value's country changes
    // (e.g. user pastes a different country's number).
    const handleCountryChange = (c?: Country) => {
      setCountry(c || defaultCountry);
    };

    const callingCode = React.useMemo(() => {
      try {
        return country ? `+${getCountryCallingCode(country)}` : "";
      } catch {
        return "";
      }
    }, [country]);

    // Expose calling code to CSS via a custom property so .PhoneInputCountry
    // can render it via ::after. Using a CSS var keeps styling self-contained.
    const rootStyle = {
      ["--n-phone-cc" as any]: `"${callingCode}"`,
    } as React.CSSProperties;

    return (
      <div className="n-phone-input-root" style={rootStyle}>
        <PhoneInput
          international={false}
          country={country}
          onCountryChange={handleCountryChange}
          countryCallingCodeEditable={false}
          addInternationalOption={false}
          value={value || undefined}
          onChange={onChange}
          placeholder={placeholder || "Phone number"}
          numberInputProps={{
            ref: ref as any,
            className: cn("n-phone-number-input", className),
            ...rest,
          }}
        />
      </div>
    );
  },
);
NPhoneInput.displayName = "NPhoneInput";

export const isValidPhoneNumber = (v: string | undefined | null): boolean => {
  if (!v) return false;
  try {
    return _isValid(v);
  } catch {
    return false;
  }
};

/**
 * Normalize a possibly-legacy stored value into an E.164 string suitable for
 * react-phone-number-input. Legacy 10-digit Indian numbers are upgraded to
 * +91XXXXXXXXXX. Returns undefined for empty/unrenderable input.
 */
export const toDisplayE164 = (raw: string | null | undefined): string | undefined => {
  if (!raw) return undefined;
  const s = String(raw).trim();
  if (!s) return undefined;
  if (s.startsWith("+")) return s;
  const digits = s.replace(/\D/g, "");
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
  if (digits.length >= 11) return `+${digits}`;
  return `+91${digits}`;
};
