import { createBrowserClient } from "@supabase/ssr";
import { supabaseAnonKey, supabaseUrl } from "./env";

export function createBrowserSupabase() {
  return createBrowserClient(supabaseUrl(), supabaseAnonKey());
}
