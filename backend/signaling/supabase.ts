import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { secret } from "encore.dev/config";

// Secrets must be loaded within a service.
const supabaseURL = secret("SupabaseURL");
const supabaseServiceRoleKey = secret("SupabaseServiceRoleKey");

// Create an admin client using the Service Role Key.
// This bypasses RLS for server-side mutations while keeping client reads secured by RLS.
export const supabaseAdmin: SupabaseClient = createClient(supabaseURL(), supabaseServiceRoleKey(), {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

export default supabaseAdmin;
