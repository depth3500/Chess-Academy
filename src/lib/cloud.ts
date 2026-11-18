import { createClient } from '@supabase/supabase-js';
import { del, get, set } from 'idb-keyval';
import { useSyncExternalStore } from 'react';
import { Entry, KEYS, Rec, reconcile } from './sync';

const URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
/** Accounts are optional: without these two build-time values the app simply keeps everything in the browser. */
export const cloudEnabled = !!(URL && ANON);
export const supabase = cloudEnabled ? createClient(URL!, ANON!) : null;

export type Client = {
  auth: { getSession(): Promise<{ data: { session: { user: { id: string } } | null } }> };
  from(table: string): {
    select(cols: string): PromiseLike<{ data: { key: string; value: unknown; updated_at: string }[] | null; error: { message: string } | null }>;
    upsert(rows: unknown[]): PromiseLike<{ error: { message: string } | null }>;
  };
};

async function readLocal(): Promise<Rec> {
  const meta: Record<string, number> = (await get('meta')) ?? {};
  const out: Rec = {};
  for (const k of KEYS) { const v = await get(k); if (v !== undefined) out[k] = { value: v, at: meta[k] ?? 0 }; }
  return out;
}

/** One full sync round for the signed-in user. Returns false when nobody is signed in. */
export async function syncWith(client: Client): Promise<boolean> {
  const uid = (await client.auth.getSession()).data.session?.user.id;
  if (!uid) return false;
  let pulled: string[] = [];
  // A different account on this browser must never inherit the previous account's data.
  const prev: string | undefined = await get('cloud-uid');
  if (prev && prev !== uid) { await Promise.all([...KEYS.map(k => del(k)), del('meta')]); pulled = [...KEYS]; }
  await set('cloud-uid', uid);

  const { data, error } = await client.from('user_data').select('key,value,updated_at');
  if (error) throw new Error(error.message);
  const remote: Rec = {};
  for (const r of data ?? []) remote[r.key] = { value: r.value, at: Date.parse(r.updated_at) };

  const { pull, push } = reconcile(await readLocal(), remote);
  const meta: Record<string, number> = (await get('meta')) ?? {};
  for (const [k, e] of Object.entries(pull) as [string, Entry][]) { await set(k, e.value); meta[k] = e.at; }
  await set('meta', meta);
  pulled = [...new Set([...pulled, ...Object.keys(pull)])];
  if (pulled.length && typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('cloud-pulled', { detail: pulled }));

  const rows = Object.entries(push).map(([key, e]) => ({ user_id: uid, key, value: e.value, updated_at: new Date(e.at).toISOString() }));
  if (rows.length) { const up = await client.from('user_data').upsert(rows); if (up.error) throw new Error(up.error.message); }
  return true;
}

// ---- UI state (signed-in user, last sync time, errors) ----
type State = { user: { id: string; email?: string } | null; last: number; error: string; syncing: boolean };
let state: State = { user: null, last: 0, error: '', syncing: false };
const subs = new Set<() => void>();
const patch = (p: Partial<State>) => { state = { ...state, ...p }; subs.forEach(f => f()); };
export const useCloud = () => useSyncExternalStore(f => { subs.add(f); return () => { subs.delete(f); }; }, () => state);

export async function syncAll() {
  if (!supabase || state.syncing) return;
  patch({ syncing: true });
  try { if (await syncWith(supabase as unknown as Client)) patch({ last: Date.now(), error: '' }); }
  catch (e) { patch({ error: e instanceof Error ? e.message : 'Sync failed' }); }
  finally { patch({ syncing: false }); }
}

let timer: ReturnType<typeof setTimeout> | undefined;
/** Called after every local save: pushes changes to the cloud a moment later (if signed in). */
export function scheduleSync() {
  if (!supabase) return;
  clearTimeout(timer);
  timer = setTimeout(() => { void syncAll(); }, 2500);
}

export function initCloud() {
  if (!supabase) return;
  supabase.auth.onAuthStateChange((_e, session) => {
    patch({ user: session?.user ? { id: session.user.id, email: session.user.email } : null });
    if (session) setTimeout(() => { void syncAll(); }, 0); // not inside the callback: the auth client is not re-entrant
  });
  setInterval(() => { if (!document.hidden) void syncAll(); }, 60000);
}

const msg = (e: { message: string } | null) => e?.message ?? '';
export async function signIn(email: string, password: string) { return msg((await supabase!.auth.signInWithPassword({ email, password })).error); }
export async function signUp(email: string, password: string) {
  const { data, error } = await supabase!.auth.signUp({ email, password });
  return error ? error.message : data.session ? '' : 'Check your email to confirm your account, then sign in.';
}
export async function signOut() { await supabase!.auth.signOut(); }
