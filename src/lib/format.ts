/**
 * Display formatting helpers for currency, counts, and dates.
 * Keep purely presentational — never use the output for math.
 */

/** Indian Rupee with grouping. e.g. 1299 -> "₹1,299" */
export function formatINR(n: number | null | undefined, opts?: { decimals?: number }): string {
  if (n == null || Number.isNaN(Number(n))) return "₹0";
  const decimals = opts?.decimals ?? 0;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(Number(n));
}

/** Compact counts. 1234 -> "1.2K", 1500000 -> "1.5M" */
export function formatCompact(n: number | null | undefined): string {
  if (n == null || Number.isNaN(Number(n))) return "0";
  const v = Number(n);
  if (Math.abs(v) < 1000) return String(v);
  return new Intl.NumberFormat("en-IN", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(v);
}

/** Plain integer with thousands grouping (Indian style). */
export function formatInt(n: number | null | undefined): string {
  if (n == null || Number.isNaN(Number(n))) return "0";
  return new Intl.NumberFormat("en-IN").format(Math.round(Number(n)));
}

/** View counts with Indian K/L notation. */
export function formatViewCount(n: number | null | undefined): string {
  const v = Number(n ?? 0);
  if (!Number.isFinite(v) || v < 1000) return `${Math.max(0, Math.floor(v))}`;
  if (v < 100000) return `${(v / 1000).toFixed(1)}K`;
  return `${(v / 100000).toFixed(1)}L`;
}

/** Duration mm:ss or h:mm:ss */
export function formatDuration(seconds: number | null | undefined): string {
  const t = Math.max(0, Math.floor(Number(seconds ?? 0)));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  return h > 0
    ? `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`
    : `${m}:${s.toString().padStart(2, "0")}`;
}

/** Relative time like "2d ago". */
export function formatRelativeDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  if (diff < 2592000) return `${Math.floor(diff / 604800)}w ago`;
  return d.toLocaleDateString();
}
