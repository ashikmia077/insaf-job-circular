import { createBrowserClient } from "@supabase/ssr";
import { getClientEnv } from "@/config/env.config";

/**
 * Creates a browser Supabase client scoped to public anon key and RLS rules.
 */
export function createSupabaseBrowserClient() {
  const env = getClientEnv();
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. Configure .env.local before initializing browser Supabase client."
    );
  }

  return createBrowserClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}
