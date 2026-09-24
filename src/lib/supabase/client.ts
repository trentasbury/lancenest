import { createBrowserClient } from '@supabase/ssr';

/** Browser client — for client components that need realtime or uploads (later phases). */
export function createClient() {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}
