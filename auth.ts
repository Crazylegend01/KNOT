import { createClient } from "./supabase";

export async function signUp(email: string, password: string) {
  return createClient().auth.signUp({ email, password, options: { emailRedirectTo: `${window.location.origin}/auth/callback` } });
}
export async function signIn(email: string, password: string) { return createClient().auth.signInWithPassword({ email, password }); }
export async function signOut() { return createClient().auth.signOut(); }
