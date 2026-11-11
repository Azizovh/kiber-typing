import { create } from 'zustand';

export interface AuthUser {
  id: string;
  email: string;
  username: string;
}

/**
 * disabled — no Supabase keys configured, the app is local-only
 * loading  — checking for an existing session
 * guest    — cloud available, nobody signed in
 * user     — signed in
 */
export type AuthStatus = 'disabled' | 'loading' | 'guest' | 'user';

interface AuthStore {
  status: AuthStatus;
  user: AuthUser | null;
  /** Last cloud-sync problem, shown on the account page. */
  syncError: string | null;
  set: (patch: Partial<Omit<AuthStore, 'set'>>) => void;
}

export const useAuth = create<AuthStore>()((set) => ({
  status: 'loading',
  user: null,
  syncError: null,
  set: (patch) => set(patch),
}));
