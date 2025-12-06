import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://qsheibkwltavsyxjgxpx.supabase.co";
const supabaseKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFzaGVpYmt3bHRhdnN5eGpneHB4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM2MDQ3ODYsImV4cCI6MjA3OTE4MDc4Nn0.n81H3J_RXTOqmgci4h-SCowfueQeCKm9MRANigK0EhI";

export const supabase = createClient(supabaseUrl, supabaseKey);
