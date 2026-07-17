// Authentication helpers built on Supabase Auth (email + password).

import { getSupabase } from "./supabase.js";

export async function getSession() {
  const sb = getSupabase();
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  return data.session ?? null;
}

export function onAuthChange(callback) {
  const sb = getSupabase();
  if (!sb) return () => {};
  const { data } = sb.auth.onAuthStateChange((_event, session) => {
    callback(session);
  });
  return () => data.subscription.unsubscribe();
}

export async function signUp({ email, password, displayName }) {
  const sb = getSupabase();
  const { data, error } = await sb.auth.signUp({
    email,
    password,
    options: { data: { display_name: displayName || email.split("@")[0] } },
  });
  if (error) throw error;
  return data;
}

export async function signIn({ email, password }) {
  const sb = getSupabase();
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const sb = getSupabase();
  await sb.auth.signOut();
}

// Fetch the profile row; fall back to auth metadata if the row is missing
// (e.g. when the DB trigger has not been installed yet).
export async function getProfile(user) {
  const sb = getSupabase();
  const { data } = await sb
    .from("profiles")
    .select("id, display_name")
    .eq("id", user.id)
    .maybeSingle();

  const displayName =
    data?.display_name ||
    user.user_metadata?.display_name ||
    user.email?.split("@")[0] ||
    "Пользователь";

  return { id: user.id, displayName };
}
