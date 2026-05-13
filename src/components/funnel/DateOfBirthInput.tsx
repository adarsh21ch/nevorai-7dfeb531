import { useEffect, useRef, useState } from "react";

interface Props {
  value: string;
  onChange: (val: string) => void;
  required?: boolean;
  hasError?: boolean;
  size?: "md" | "lg";
}

const isValidDate = (d: number, m: number, y: number) => {
  if (!d || !m || !y) return false;
  if (y < 1900 || y > new Date().getFullYear()) return false;
  if (m < 1 || m > 12) return false;
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d && dt.getTime() <= Date.now();
};

const pad = (n: string, len: number) => n.padStart(len, "0");

export const DateOfBirthInput = ({ value, onChange, required, hasError, size = "md" }: Props) => {
  const parseValue = (v: string) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v || "");
    if (!m) return { d: "", mo: "", y: "" };
    return { d: m[3], mo: m[2], y: m[1] };
  };

  const [parts, setParts] = useState(parseValue(value));
  const dRef = useRef<HTMLInputElement>(null);
  const mRef = useRef<HTMLInputElement>(null);
  const yRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const next = parseValue(value);
    if (next.d !== parts.d || next.mo !== parts.mo || next.y !== parts.y) setParts(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const emit = (next: { d: string; mo: string; y: string }) => {
    const dn = parseInt(next.d, 10), mn = parseInt(next.mo, 10), yn = parseInt(next.y, 10);
    if (next.d.length === 2 && next.mo.length === 2 && next.y.length === 4 && isValidDate(dn, mn, yn)) {
      onChange(`${pad(next.y, 4)}-${pad(next.mo, 2)}-${pad(next.d, 2)}`);
    } else if (value) onChange("");
  };

  const handleChange = (key: "d" | "mo" | "y", raw: string) => {
    const cleaned = raw.replace(/\D/g, "");
    const max = key === "y" ? 4 : 2;
    const trimmed = cleaned.slice(0, max);
    const next = { ...parts, [key]: trimmed };
    setParts(next); emit(next);
    if (trimmed.length === max) {
      if (key === "d") mRef.current?.focus();
      else if (key === "mo") yRef.current?.focus();
    }
  };

  const handleBlur = (key: "d" | "mo") => {
    const v = parts[key];
    if (v.length === 1 && v !== "0") {
      const padded = pad(v, 2);
      const next = { ...parts, [key]: padded };
      setParts(next);
      emit(next);
    }
  };

  const handleKeyDown = (key: "d" | "mo" | "y", e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && (e.target as HTMLInputElement).value === "") {
      if (key === "mo") dRef.current?.focus();
      else if (key === "y") mRef.current?.focus();
    }
  };

  const heightCls = size === "lg" ? "h-12" : "h-10";
  const baseCls = `bg-input text-foreground placeholder:text-muted-foreground text-center ${heightCls} ${hasError ? "border-destructive" : "border-border"} border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/60 transition`;

  return (
    <div className="flex items-center gap-2 w-full">
      <input ref={dRef} type="text" inputMode="numeric" pattern="[0-9]*" autoComplete="bday-day" placeholder="DD" aria-label="Day" maxLength={2} value={parts.d} onChange={(e) => handleChange("d", e.target.value)} onKeyDown={(e) => handleKeyDown("d", e)} required={required} className={`${baseCls} flex-1 min-w-0`} />
      <span className="text-muted-foreground select-none">/</span>
      <input ref={mRef} type="text" inputMode="numeric" pattern="[0-9]*" autoComplete="bday-month" placeholder="MM" aria-label="Month" maxLength={2} value={parts.mo} onChange={(e) => handleChange("mo", e.target.value)} onKeyDown={(e) => handleKeyDown("mo", e)} required={required} className={`${baseCls} flex-1 min-w-0`} />
      <span className="text-muted-foreground select-none">/</span>
      <input ref={yRef} type="text" inputMode="numeric" pattern="[0-9]*" autoComplete="bday-year" placeholder="YYYY" aria-label="Year" maxLength={4} value={parts.y} onChange={(e) => handleChange("y", e.target.value)} onKeyDown={(e) => handleKeyDown("y", e)} required={required} className={`${baseCls} flex-[1.4] min-w-0`} />
    </div>
  );
};
