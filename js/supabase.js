// Supabase client bootstrap.
//
// Resolves credentials in this order:
//   1. localStorage (entered via the in-browser setup screen)
//   2. js/config.js (committed defaults)
// and lazily creates a single shared client.

// Supabase SDK is loaded as a global by js/vendor/supabase.umd.js (see index.html).
import { SUPABASE_URL as CFG_URL, SUPABASE_ANON_KEY as CFG_KEY } from "./config.js";

const createClient = window.supabase.createClient;

const LS_URL = "toduo.supabaseUrl";
const LS_KEY = "toduo.supabaseAnonKey";

export function getCredentials() {
  const url = (localStorage.getItem(LS_URL) || CFG_URL || "").trim();
  const key = (localStorage.getItem(LS_KEY) || CFG_KEY || "").trim();
  return { url, key };
}

export function hasCredentials() {
  const { url, key } = getCredentials();
  return Boolean(url && key);
}

export function saveCredentials(url, key) {
  localStorage.setItem(LS_URL, url.trim());
  localStorage.setItem(LS_KEY, key.trim());
}

export function clearCredentials() {
  localStorage.removeItem(LS_URL);
  localStorage.removeItem(LS_KEY);
}

let client = null;

export function getSupabase() {
  if (!hasCredentials()) return null;
  if (!client) {
    const { url, key } = getCredentials();
    client = createClient(url, key, {
      auth: { persistSession: true, autoRefreshToken: true },
    });
  }
  return client;
}
