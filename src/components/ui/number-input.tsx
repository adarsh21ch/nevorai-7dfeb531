import { forwardRef, InputHTMLAttributes, useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "value" | "type" | "min" | "max" | "step"> & {
  value: number | "" | null | undefined;
  onValueChange: (n: number | "") => void;
  min?: number;
  max?: number;
  step?: number;
  /** Visual prefix inside the field, e.g. "₹". */
  prefix?: string;
  /** Visual suffix inside the field, e.g. "days". */
  suffix?: string;
  /** Allow decimals (default false → integer). */
  decimal?: boolean;
};

/**
 * Numeric input that:
 * - strips non-numeric chars (no `e`, `+`, `-` unless decimal)
 * - clamps to min/max on blur
 * - shows mobile numeric keypad
 * - supports prefix/suffix slots
 */
export const NumberInput = forwardRef<HTMLInputElement, Props>(
  ({ value, onValueChange, min, max, step = 1, prefix, suffix, decimal = false, className, ...rest }, ref) => {
    const [text, setText] = useState(value === "" || value == null ? "" : String(value));

    useEffect(() => {
      const incoming = value === "" || value == null ? "" : String(value);
      if (incoming !== text) setText(incoming);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value]);

    const sanitize = (raw: string) => {
      const allowed = decimal ? /[^\d.]/g : /[^\d]/g;
      return raw.replace(allowed, "");
    };

    const handleBlur = () => {
      if (text === "") { onValueChange(""); return; }
      let n = decimal ? parseFloat(text) : parseInt(text, 10);
      if (Number.isNaN(n)) { onValueChange(""); setText(""); return; }
      if (typeof min === "number" && n < min) n = min;
      if (typeof max === "number" && n > max) n = max;
      setText(String(n));
      onValueChange(n);
    };

    return (
      <div className={cn("relative flex items-center", className)}>
        {prefix && (
          <span className="pointer-events-none absolute left-2.5 text-xs text-muted-foreground">{prefix}</span>
        )}
        <Input
          ref={ref}
          type="text"
          inputMode={decimal ? "decimal" : "numeric"}
          pattern={decimal ? "[0-9.]*" : "[0-9]*"}
          value={text}
          onChange={(e) => {
            const cleaned = sanitize(e.target.value);
            setText(cleaned);
            if (cleaned === "") onValueChange("");
            else {
              const n = decimal ? parseFloat(cleaned) : parseInt(cleaned, 10);
              if (!Number.isNaN(n)) onValueChange(n);
            }
          }}
          onBlur={handleBlur}
          step={step}
          className={cn(prefix && "pl-6", suffix && "pr-12")}
          {...rest}
        />
        {suffix && (
          <span className="pointer-events-none absolute right-2.5 text-xs text-muted-foreground">{suffix}</span>
        )}
      </div>
    );
  },
);
NumberInput.displayName = "NumberInput";
