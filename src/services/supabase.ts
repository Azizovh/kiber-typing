import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * The client wants the bare project URL (https://xxxx.supabase.co). The
 * dashboard also shows the REST endpoint (…/rest/v1/), which is easy to copy
 * by mistake and makes every request fail — so keep only the origin.
 */
function projectUrl(raw: string | undefined): string | undefined {
  const value = raw?.trim();
  if (!value) return undefined;
  try {
    return new URL(value).origin;
  } catch {
    console.warn('[supabase] VITE_SUPABASE_URL is not a valid URL — running in local mode.');
    return undefined;
  }
}

const url = projectUrl(import.meta.env.VITE_SUPABASE_URL as string | undefined);
const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim();

/** null when the project has no Supabase keys — the app then runs local-only. */
export const supabase: SupabaseClient | null = url && anonKey ? createClient(url, anonKey) : null;

export const cloudEnabled = supabase !== null;
