import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

const url = import.meta.env.VITE_SUPABASE_URL;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!url || !publishableKey) {
  throw new Error(
    "Variables Supabase manquantes : renseigner VITE_SUPABASE_URL et VITE_SUPABASE_PUBLISHABLE_KEY dans .env",
  );
}

// TanStack Start rend aussi côté serveur : localStorage n'existe qu'au navigateur.
// On ne persiste la session que dans le navigateur pour éviter les erreurs SSR.
const isBrowser = typeof window !== "undefined";

export const supabase = createClient<Database>(url, publishableKey, {
  auth: {
    persistSession: isBrowser,
    autoRefreshToken: isBrowser,
    detectSessionInUrl: isBrowser,
  },
});
