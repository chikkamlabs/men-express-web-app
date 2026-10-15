import { supabase } from './supabase';
import type { User } from '@supabase/supabase-js';

export type UserRole = 'admin' | 'store';

export interface AppUserProfile {
  id: string;
  email: string;
  role: UserRole;
  name?: string;
  status?: string;
}

const ROLE_STORAGE_KEY = 'sb_user_role';
const USER_ID_STORAGE_KEY = 'sb_user_id';

/**
 * Resolve the user's role by checking public.users table or auth metadata in Supabase.
 */
export async function fetchUserRole(user: User): Promise<UserRole> {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    if (!error && data?.role) {
      const normalized = String(data.role).toLowerCase().trim();
      if (normalized === 'admin') return 'admin';
      if (normalized === 'store') return 'store';
    }
  } catch (err) {
    console.error('Error querying users table for role:', err);
  }

  // Check user_metadata or app_metadata
  const metaRole = String(
    user.user_metadata?.role || user.app_metadata?.role || ''
  ).toLowerCase().trim();

  if (metaRole === 'admin') return 'admin';
  if (metaRole === 'store') return 'store';

  // Fallback check by email keyword if explicit role is omitted
  if (user.email && user.email.toLowerCase().includes('admin')) {
    return 'admin';
  }

  return 'store';
}

/**
 * Sign in using Supabase Auth with real credentials.
 */
export async function signInWithSupabase(
  email: string,
  pass: string
): Promise<{ user: User; role: UserRole }> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: pass,
  });

  if (error || !data.user) {
    throw new Error(error?.message || 'Authentication failed');
  }

  const role = await fetchUserRole(data.user);

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(ROLE_STORAGE_KEY, role);
      localStorage.setItem(USER_ID_STORAGE_KEY, data.user.id);
    } catch {
      // Ignore localStorage write failures
    }
  }

  return {
    user: data.user,
    role,
  };
}

/**
 * Sign out of Supabase and clear local auth cache.
 */
export async function signOutSupabase(): Promise<void> {
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem(ROLE_STORAGE_KEY);
      localStorage.removeItem(USER_ID_STORAGE_KEY);
    } catch {
      // Ignore
    }
  }
  await supabase.auth.signOut();
}

/**
 * Get current authenticated Supabase user and their assigned role.
 */
export async function getCurrentSupabaseUser(): Promise<{
  user: User | null;
  role: UserRole | null;
}> {
  // 1. Check existing session first (fastest)
  const { data: sessionData } = await supabase.auth.getSession();
  const sessionUser = sessionData?.session?.user;

  if (sessionUser) {
    // Check cached role first
    if (typeof window !== 'undefined') {
      const storedRole = localStorage.getItem(ROLE_STORAGE_KEY);
      const storedId = localStorage.getItem(USER_ID_STORAGE_KEY);
      if (storedId === sessionUser.id && (storedRole === 'admin' || storedRole === 'store')) {
        // Asynchronously update role in background
        fetchUserRole(sessionUser).then((freshRole) => {
          if (typeof window !== 'undefined') {
            localStorage.setItem(ROLE_STORAGE_KEY, freshRole);
          }
        });
        return { user: sessionUser, role: storedRole as UserRole };
      }
    }

    const freshRole = await fetchUserRole(sessionUser);
    if (typeof window !== 'undefined') {
      localStorage.setItem(ROLE_STORAGE_KEY, freshRole);
      localStorage.setItem(USER_ID_STORAGE_KEY, sessionUser.id);
    }
    return { user: sessionUser, role: freshRole };
  }

  // 2. Try getUser in case session is being resolved
  const { data: userData } = await supabase.auth.getUser();
  if (userData?.user) {
    const role = await fetchUserRole(userData.user);
    if (typeof window !== 'undefined') {
      localStorage.setItem(ROLE_STORAGE_KEY, role);
      localStorage.setItem(USER_ID_STORAGE_KEY, userData.user.id);
    }
    return { user: userData.user, role };
  }

  // Not authenticated
  if (typeof window !== 'undefined') {
    localStorage.removeItem(ROLE_STORAGE_KEY);
    localStorage.removeItem(USER_ID_STORAGE_KEY);
  }
  return { user: null, role: null };
}
