import { createBrowserClient } from "@supabase/ssr";

// Clés publiques Gaya (sûres côté navigateur — le RLS protège les données)
const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://paarrpznofrchqsxglob.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "sb_publishable_-dyH8rBZZKUri3jcRxkOUg_6Oe0AQsm";

export function createClient() {
  return createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}
