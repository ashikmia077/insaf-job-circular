import { createClient } from "@supabase/supabase-js";
import { getServerEnv } from "@/config/env.config";

/**
 * SERVER-ONLY Privileged Supabase Client.
 * Uses SUPABASE_SERVICE_ROLE_KEY strictly for verified background worker callbacks
 * and immutable administrative audit logging. Never import in client code.
 */
export function createSupabaseServiceClient() {
  const env = getServerEnv();
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY for privileged server operation."
    );
  }

  return createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );
}
