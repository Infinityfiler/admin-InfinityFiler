import { createClient } from "@supabase/supabase-js";
import { runMigrations } from "./migrate";

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseServiceKey);

export const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey);

export async function initializeDatabase() {
  await runMigrations();
}
