import * as React from "react";
import { cn } from "@/lib/utils";
import { INDIAN_STATES } from "@/lib/indianStates";

export type StateSelectProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
  disabled?: boolean;
  id?: string;
  "aria-invalid"?: boolean;
};

/**
 * Universal state-picker. Renders a native <select> so it inherits inline
 * `style` (bg/border/color) the same way our themed <Input> does, which lets
 * funnel/landing forms with custom theme tokens drop it in without rework.
 *
 * Value is the state name as a plain string (e.g. "Maharashtra"). Empty value
 * means "not selected".
 */
export const StateSelect = React.forwardRef<HTMLSelectElement, StateSelectProps>(
  ({ value, onChange, placeholder = "Select State", className, style, disabled, id, ...rest }, ref) => {
    return (
      <select
        ref={ref}
        id={id}
        disabled={disabled}
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "flex h-12 w-full rounded-xl border bg-transparent px-3 py-1 text-sm shadow-sm transition-colors",
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        style={style}
        aria-invalid={rest["aria-invalid"]}
      >
        <option value="" disabled>
          {placeholder}
        </option>
        {INDIAN_STATES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
    );
  },
);
StateSelect.displayName = "StateSelect";
