/**
 * Server-side sanitization for Deno edge functions.
 *
 * Mirrors src/lib/sanitize.ts. No DOM in Deno — uses regex stripping which is
 * sufficient for plain-text fields. For rich text, sanitize on the client with
 * DOMPurify before sending.
 */

const HTML_TAG_RE = /<[^>]*>/g;
const SCRIPT_RE = /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi;
const STYLE_RE = /<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi;

export const sanitizeText = (input: unknown): string => {
  if (input == null) return "";
  let str = String(input);
  str = str.replace(SCRIPT_RE, "").replace(STYLE_RE, "");
  str = str.replace(HTML_TAG_RE, "");
  str = str
    .replace(/javascript:/gi, "")
    .replace(/data:text\/html/gi, "")
    .replace(/on\w+\s*=/gi, "");
  return str.trim();
};

export const sanitizeFilename = (name: string): string => {
  if (!name) return "file";
  let clean = name.replace(/[^a-zA-Z0-9._-]/g, "_");
  clean = clean.replace(/\.{2,}/g, ".").replace(/^\.+/, "");
  if (clean.length > 100) {
    const lastDot = clean.lastIndexOf(".");
    if (lastDot > 0 && lastDot > clean.length - 10) {
      const ext = clean.slice(lastDot);
      clean = clean.slice(0, 100 - ext.length) + ext;
    } else {
      clean = clean.slice(0, 100);
    }
  }
  return clean || "file";
};

export const isValidEmail = (e: string): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e ?? "").trim());

export const isValidPhone = (p: string): boolean => {
  const cleaned = String(p ?? "").replace(/[\s\-()]/g, "");
  return /^\+?\d{10,15}$/.test(cleaned);
};

export const normalizePhone = (p: string): string =>
  String(p ?? "").replace(/[\s\-()]/g, "").trim();

export const sanitizeFields = <T extends Record<string, unknown>>(
  obj: T,
  fields: (keyof T)[],
): T => {
  const out = { ...obj };
  for (const f of fields) {
    if (out[f] != null) {
      // @ts-ignore — runtime cast
      out[f] = sanitizeText(out[f]);
    }
  }
  return out;
};
