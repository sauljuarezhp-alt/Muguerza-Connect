import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
const fallbackUrl = 'http://localhost:54321';
const fallbackAnonKey = 'missing-local-env-anon-key';

export const isSupabaseConfigured = Boolean(url && anonKey && !anonKey.startsWith('PEGAR_'));

if (!isSupabaseConfigured) {
  // eslint-disable-next-line no-console
  console.warn('[Supabase] Falta configurar VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY en .env.local');
}

export const supabase = createClient(url || fallbackUrl, anonKey || fallbackAnonKey);
