import { createContext, useContext, useState, ReactNode } from "react";

export type Currency = "INR" | "USD";
export type Gateway = "razorpay";

interface CurrencyCtx {
  currency: Currency;
  gateway: Gateway;
  symbol: string;
  setCurrency: (c: Currency) => void;
  isAutoDetected: boolean;
}

const Ctx = createContext<CurrencyCtx | null>(null);
const STORAGE_KEY = "nflow_currency_pref";

function detectFromTimezone(): Currency {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    if (tz.includes("Kolkata") || tz.includes("Calcutta") || tz.startsWith("Asia/Kol")) {
      return "INR";
    }
    // Anything else -> USD
    return "USD";
  } catch {
    return "INR";
  }
}

export const CurrencyProvider = ({ children }: { children: ReactNode }) => {
  // International payments temporarily disabled — force INR/Razorpay everywhere.
  const [currency, setCurrencyState] = useState<Currency>("INR");
  const [isAutoDetected] = useState(false);

  const setCurrency = (_c: Currency) => {
    // No-op while international payments are disabled.
    setCurrencyState("INR");
  };

  const value: CurrencyCtx = {
    currency,
    gateway: "razorpay",
    symbol: currency === "INR" ? "₹" : "$",
    setCurrency,
    isAutoDetected,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};

export function useCurrency(): CurrencyCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useCurrency must be used inside CurrencyProvider");
  return v;
}

export function formatPrice(amount: number, currency: Currency): string {
  if (currency === "USD") {
    return `$${amount.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  }
  return `₹${amount.toLocaleString("en-IN")}`;
}
