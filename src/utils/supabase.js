import { createClient } from '@supabase/supabase-js';

const DEFAULT_URL = 'https://zyyizjwlpzplqpfnaqtn.supabase.co';
const DEFAULT_KEY = 'sb_publishable_cVUUtTDcpnoHrXcSkjtREw_Xllo-mHl';

let cachedClient = null;
let lastUrl = '';
let lastKey = '';

/**
 * Get or create Supabase client instance
 * Automatically connects to the shop database across all devices
 */
export function getSupabaseClient(customUrl = null, customKey = null) {
  const url =
    customUrl ||
    import.meta.env?.VITE_SUPABASE_URL ||
    localStorage.getItem('paruay_supabase_url') ||
    DEFAULT_URL;

  const key =
    customKey ||
    import.meta.env?.VITE_SUPABASE_ANON_KEY ||
    localStorage.getItem('paruay_supabase_anon_key') ||
    DEFAULT_KEY;

  if (!url || !key) {
    return null;
  }

  if (cachedClient && lastUrl === url && lastKey === key) {
    return cachedClient;
  }

  try {
    cachedClient = createClient(url, key, {
      auth: { persistSession: false },
    });
    lastUrl = url;
    lastKey = key;
    return cachedClient;
  } catch (err) {
    console.error('Failed to initialize Supabase client:', err);
    return null;
  }
}

/**
 * Test Supabase connection
 */
export async function testSupabaseConnection(url, key) {
  try {
    const client = createClient(url, key, { auth: { persistSession: false } });
    const { data, error } = await client.from('products').select('id').limit(1);
    if (error && error.code !== 'PGRST116') {
      // Table might not exist yet or key invalid
      return { success: false, message: error.message };
    }
    return { success: true };
  } catch (err) {
    return { success: false, message: err.message };
  }
}
