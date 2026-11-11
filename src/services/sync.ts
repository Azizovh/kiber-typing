import type { User } from '@supabase/supabase-js';
import { addProfiles, emptyProfile } from '../engine/profile';
import type { TestResult, TypingProfile } from '../engine/types';
import { useAuth } from '../store/auth';
import { MAX_RESULTS, mergeLessons, useData, type LessonProgress } from '../store/data';
import { supabase } from './supabase';

/** Shape of a row in the `results` table (see supabase/schema.sql). */
interface ResultRow {
  client_id: string;
  user_id: string;
  kind: string;
  category: string;
  mode: string;
  length: number;
  topic: string | null;
  strict: boolean;
  lesson_id: string | null;
  wpm: number;
  raw: number;
  accuracy: number;
  consistency: number;
  duration_ms: number;
  chars: TestResult['chars'];
  created_at: string;
}

const toRow = (r: TestResult, userId: string): ResultRow => ({
  client_id: r.id,
  user_id: userId,
  kind: r.config.kind,
  category: r.config.category,
  mode: r.config.mode,
  length: r.config.length,
  topic: r.config.topic,
  strict: r.config.strict,
  lesson_id: r.config.lessonId ?? null,
  wpm: r.wpm,
  raw: r.raw,
  accuracy: r.accuracy,
  consistency: r.consistency,
  duration_ms: r.durationMs,
  chars: r.chars,
  created_at: new Date(r.at).toISOString(),
});

const fromRow = (row: ResultRow): TestResult => ({
  id: row.client_id,
  at: new Date(row.created_at).getTime(),
  config: {
    kind: row.kind as TestResult['config']['kind'],
    category: row.category as TestResult['config']['category'],
    mode: row.mode as TestResult['config']['mode'],
    length: row.length,
    topic: row.topic,
    strict: row.strict,
    lessonId: row.lesson_id ?? undefined,
  },
  wpm: Number(row.wpm),
  raw: Number(row.raw),
  accuracy: Number(row.accuracy),
  consistency: Number(row.consistency),
  durationMs: row.duration_ms,
  chars: row.chars,
  missedChars: {},
  missedWords: [],
  synced: true,
});

function fail(context: string, error: { message: string } | null): boolean {
  if (!error) return false;
  console.warn(`[sync] ${context}: ${error.message}`);
  useAuth.getState().set({ syncError: `${context}: ${error.message}` });
  return true;
}

async function pushResults(userId: string): Promise<void> {
  if (!supabase) return;
  const pending = useData.getState().results.filter((r) => !r.synced);
  if (pending.length === 0) return;
  const { error } = await supabase
    .from('results')
    .upsert(pending.map((r) => toRow(r, userId)), { onConflict: 'user_id,client_id', ignoreDuplicates: true });
  if (fail('saving results', error)) return;
  useData.getState().markSynced(pending.map((r) => r.id));
}

async function pushState(userId: string): Promise<void> {
  if (!supabase) return;
  const { profile, lessons } = useData.getState();
  const { error } = await supabase.from('user_state').upsert({
    user_id: userId,
    profile,
    lessons,
    updated_at: new Date().toISOString(),
  });
  if (fail('saving progress', error)) return;
  useData.getState().replace({ dirty: false });
}

/** Called after every finished run. A no-op for guests. */
export async function syncAfterRun(): Promise<void> {
  const { user } = useAuth.getState();
  if (!supabase || !user) return;
  await pushResults(user.id);
  await pushState(user.id);
}

/**
 * Bring local and cloud data together after sign-in.
 * - Guest data is attached to the account (added on top of what the cloud has).
 * - Otherwise the cloud copy wins unless this browser has unsaved changes.
 */
async function hydrate(userId: string): Promise<void> {
  if (!supabase) return;
  const local = useData.getState();

  const [stateRes, resultsRes] = await Promise.all([
    supabase.from('user_state').select('profile, lessons').eq('user_id', userId).maybeSingle(),
    supabase
      .from('results')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(MAX_RESULTS),
  ]);
  if (fail('loading progress', stateRes.error) || fail('loading results', resultsRes.error)) return;

  const remoteProfile = (stateRes.data?.profile as TypingProfile | null) ?? emptyProfile();
  const remoteLessons = (stateRes.data?.lessons as Record<string, LessonProgress> | null) ?? {};
  const remoteResults = ((resultsRes.data ?? []) as ResultRow[]).map(fromRow);

  const sameOwner = local.ownerId === userId;
  const fromOtherAccount = local.ownerId !== null && !sameOwner;
  // Never mix another account's cached data into this one.
  const mine = fromOtherAccount
    ? { results: [], profile: emptyProfile(), lessons: {}, dirty: false }
    : local;

  let profile: TypingProfile;
  if (sameOwner) profile = mine.dirty ? mine.profile : remoteProfile;
  else profile = addProfiles(remoteProfile, mine.profile);

  const known = new Set(remoteResults.map((r) => r.id));
  const unsynced = mine.results.filter((r) => !r.synced && !known.has(r.id));
  const results = [...unsynced, ...remoteResults].sort((a, b) => b.at - a.at).slice(0, MAX_RESULTS);

  useData.getState().replace({
    ownerId: userId,
    profile,
    lessons: mergeLessons(remoteLessons, mine.lessons),
    results,
    dirty: mine.dirty || !sameOwner,
  });
  useAuth.getState().set({ syncError: null });
  await pushResults(userId);
  if (useData.getState().dirty) await pushState(userId);
}

async function onUser(user: User): Promise<void> {
  if (!supabase) return;
  const { data } = await supabase.from('profiles').select('username').eq('id', user.id).maybeSingle();
  const username =
    (data?.username as string | undefined) ??
    (user.user_metadata?.username as string | undefined) ??
    user.email?.split('@')[0] ??
    'user';
  useAuth.getState().set({
    status: 'user',
    user: { id: user.id, email: user.email ?? '', username },
  });
  await hydrate(user.id);
}

let started = false;

/** Wire up Supabase auth once, at app start. */
export function initAuth(): void {
  if (started) return;
  started = true;
  if (!supabase) {
    useAuth.getState().set({ status: 'disabled' });
    return;
  }
  let currentId: string | null = null;
  supabase.auth.onAuthStateChange((_event, session) => {
    const user = session?.user ?? null;
    if (!user) {
      currentId = null;
      useAuth.getState().set({ status: 'guest', user: null });
      return;
    }
    // Token refreshes fire this too; only hydrate when the person changes.
    if (user.id === currentId) return;
    currentId = user.id;
    // Supabase warns against awaiting its own client inside this callback.
    setTimeout(() => void onUser(user), 0);
  });
}

export async function isUsernameTaken(username: string): Promise<boolean> {
  if (!supabase) return false;
  const { data } = await supabase.from('profiles').select('id').ilike('username', username).limit(1);
  return (data?.length ?? 0) > 0;
}

export async function signUp(email: string, password: string, username: string) {
  if (!supabase) throw new Error('Cloud accounts are not configured.');
  if (await isUsernameTaken(username)) throw new Error('That username is already taken.');
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { username } },
  });
  if (error) throw new Error(error.message);
  // With email confirmation on, there is no session until the link is clicked.
  return { needsConfirmation: !data.session };
}

export async function signIn(email: string, password: string): Promise<void> {
  if (!supabase) throw new Error('Cloud accounts are not configured.');
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
}

export async function signOut(): Promise<void> {
  if (!supabase) return;
  await supabase.auth.signOut();
  // The next person at this browser starts clean.
  useData.getState().reset();
}

export interface LeaderboardRow {
  user_id: string;
  username: string;
  wpm: number;
  raw: number;
  accuracy: number;
  consistency: number;
  created_at: string;
}

export async function fetchLeaderboard(
  category: string,
  mode: string,
  length: number,
): Promise<LeaderboardRow[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('leaderboard')
    .select('user_id, username, wpm, raw, accuracy, consistency, created_at')
    .eq('category', category)
    .eq('mode', mode)
    .eq('length', length)
    .order('wpm', { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return (data ?? []) as LeaderboardRow[];
}
