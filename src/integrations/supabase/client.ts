import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

// Publishable keys — safe to ship in client bundle
const FALLBACK_URL = "https://dnyjlmtiliqkpxwsgqyn.supabase.co";
const FALLBACK_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRueWpsbXRpbGlxa3B4d3NncXluIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgzODc0ODEsImV4cCI6MjA5Mzk2MzQ4MX0.AJYsio7U-MiDiAGL-wlEzoLrN3mdh0dosHZqMvylzyw";

const SUPABASE_URL =
  (import.meta.env?.VITE_SUPABASE_URL as string | undefined) ||
  (typeof process !== "undefined" ? process.env?.SUPABASE_URL : undefined) ||
  FALLBACK_URL;

const SUPABASE_PUBLISHABLE_KEY =
  (import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ||
  (typeof process !== "undefined" ? process.env?.SUPABASE_PUBLISHABLE_KEY : undefined) ||
  FALLBACK_KEY;

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: typeof window !== "undefined" ? window.localStorage : undefined,
  },
});
