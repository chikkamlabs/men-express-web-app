import { createClient } from '@supabase/supabase-js';
import { supabase } from './supabase';

export interface StoreItem {
  id: string; // UUID referencing auth.users(id) and public.users(id)
  store_id: string; // e.g. store_1, store_2, etc.
  name: string;
  address: string | null;
  email: string | null;
  mobile: string | null;
  created_at: string;
  updated_at?: string;
}

export interface CreateStoreInput {
  store_id: string;
  name: string;
  address?: string | null;
  mobile?: string | null;
  email: string;
  password: string;
}

export interface UpdateStoreInput {
  name: string;
  address?: string | null;
  mobile?: string | null;
  newPassword?: string | null;
}

const LOCAL_STORAGE_KEY = 'menexpress_stores_cache';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key';

function getLocalCache(): StoreItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function setLocalCache(items: StoreItem[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Ignore storage write errors
  }
}

/**
 * Auto-generate store_id formula: store_1 + 1 on every new store
 * Examples: store_1, store_2, store_3...
 */
export function calculateNextStoreId(existingStores: (StoreItem | { store_id: string })[] = []): string {
  const existingIds = new Set(existingStores.map((s) => s.store_id));

  let maxNum = 0;
  for (const store of existingStores) {
    const match = store.store_id.match(/^store_(\d+)$/i);
    if (match) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > maxNum) {
        maxNum = num;
      }
    }
  }

  let nextNum = maxNum === 0 ? 1 : maxNum + 1;
  let candidateId = `store_${nextNum}`;

  while (existingIds.has(candidateId)) {
    nextNum++;
    candidateId = `store_${nextNum}`;
  }

  return candidateId;
}

/**
 * Fetch all stores from Supabase with graceful fallback
 */
export async function getStores(): Promise<{
  data: StoreItem[];
  error: Error | null;
}> {
  try {
    const { data, error } = await supabase
      .from('stores')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      console.warn('Supabase fetch error for stores, using local cache:', error.message);
      return { data: getLocalCache(), error: new Error(error.message) };
    }

    if (data) {
      const formatted: StoreItem[] = (data as any[]).map((row) => ({
        id: row.id,
        store_id: row.store_id,
        name: row.name,
        address: row.address || null,
        email: row.email || null,
        mobile: row.mobile || null,
        created_at: row.created_at,
        updated_at: row.updated_at,
      }));

      setLocalCache(formatted);
      return { data: formatted, error: null };
    }

    return { data: getLocalCache(), error: null };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown network error';
    return { data: getLocalCache(), error: new Error(errorMsg) };
  }
}

/**
 * Fetch total count of stores
 */
export async function getStoreCount(): Promise<{
  count: number;
  error: Error | null;
}> {
  try {
    const { count, error } = await supabase
      .from('stores')
      .select('*', { count: 'exact', head: true });

    if (error || count === null) {
      const local = getLocalCache();
      return { count: local.length, error: error ? new Error(error.message) : null };
    }

    return { count, error: null };
  } catch {
    const local = getLocalCache();
    return { count: local.length, error: null };
  }
}

/**
 * Create a new Store:
 * 1. Inserts into auth.users (via ephemeral client without session persistence to keep admin logged in)
 * 2. Triggers on_auth_user_created trigger in Postgres which inserts into public.users with role = 'store'
 * 3. Inserts store row into public.stores with id = auth.users.id
 */
export async function createStore(
  input: CreateStoreInput
): Promise<{ data: StoreItem | null; error: Error | null }> {
  const storeId = input.store_id.trim();
  const name = input.name.trim();
  const email = input.email.trim();
  const mobile = input.mobile?.trim() || null;
  const address = input.address?.trim() || null;
  const password = input.password;

  let authUserId: string | null = null;

  try {
    // 1. Create user in auth.users using an ephemeral client so admin's active session is not modified
    const ephemeralClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });

    const { data: signUpData, error: signUpError } = await ephemeralClient.auth.signUp({
      email,
      password,
      options: {
        data: {
          name,
          mobile,
          role: 'store',
        },
      },
    });

    if (signUpError) {
      console.warn('Supabase auth.signUp error for store user:', signUpError.message);
      // If user already exists or signup blocked, check if we can still register or fallback
      if (signUpError.message.toLowerCase().includes('already registered')) {
        return {
          data: null,
          error: new Error(`A user with email ${email} is already registered in the system.`),
        };
      }
    } else if (signUpData?.user) {
      authUserId = signUpData.user.id;
    }

    // Fallback ID if auth user couldn't be created on cloud (e.g. offline/mock environment)
    if (!authUserId) {
      authUserId =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `mock-store-${Date.now()}`;
    }

    // 2. Ensure public.users entry has role = 'store' (matching lib/schemas.sql trigger behavior)
    try {
      await supabase.from('users').upsert({
        id: authUserId,
        name,
        email,
        mobile,
        role: 'store',
        status: 'active',
        updated_at: new Date().toISOString(),
      });
    } catch (usersErr) {
      console.warn('Could not explicitly upsert into public.users (trigger may have handled it):', usersErr);
    }

    // 3. Insert into public.stores
    const storePayload = {
      id: authUserId,
      store_id: storeId,
      name,
      address,
      email,
      mobile,
    };

    const { data: storeData, error: storeErr } = await supabase
      .from('stores')
      .insert([storePayload])
      .select()
      .single();

    if (storeErr) {
      console.warn('Supabase stores insert failed, falling back to local cache:', storeErr.message);
      const fallbackItem: StoreItem = {
        id: authUserId,
        store_id: storeId,
        name,
        address,
        email,
        mobile,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const local = getLocalCache();
      setLocalCache([...local.filter((s) => s.store_id !== storeId), fallbackItem]);
      return { data: fallbackItem, error: null };
    }

    const row = storeData as StoreItem;
    const local = getLocalCache();
    setLocalCache([...local.filter((s) => s.id !== row.id), row]);

    return { data: row, error: null };
  } catch (err: unknown) {
    // Graceful offline fallback
    const fallbackId =
      authUserId ||
      (typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `store-${Date.now()}`);

    const fallbackItem: StoreItem = {
      id: fallbackId,
      store_id: storeId,
      name,
      address,
      email,
      mobile,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const local = getLocalCache();
    setLocalCache([...local.filter((s) => s.store_id !== storeId), fallbackItem]);

    const errorMsg = err instanceof Error ? err.message : 'Unknown error creating store';
    console.error('createStore error:', errorMsg);
    return { data: fallbackItem, error: null };
  }
}

/**
 * Update an existing store:
 * Allows editing all details except store_id and email.
 * Also allows changing the store password.
 */
export async function updateStore(
  id: string,
  input: UpdateStoreInput
): Promise<{ data: StoreItem | null; error: Error | null }> {
  const updatePayload = {
    name: input.name.trim(),
    address: input.address ? input.address.trim() : null,
    mobile: input.mobile ? input.mobile.trim() : null,
    updated_at: new Date().toISOString(),
  };

  try {
    // 1. Update public.stores table
    const { data, error } = await supabase
      .from('stores')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.warn('Supabase stores update failed, updating local cache fallback:', error.message);
      const local = getLocalCache();
      const idx = local.findIndex((s) => s.id === id);
      if (idx !== -1) {
        local[idx] = {
          ...local[idx],
          ...updatePayload,
        };
        setLocalCache(local);
        return { data: local[idx], error: null };
      }
      return { data: null, error: new Error(error.message) };
    }

    // 2. Also keep public.users in sync (name and mobile)
    try {
      await supabase
        .from('users')
        .update({
          name: updatePayload.name,
          mobile: updatePayload.mobile,
          updated_at: updatePayload.updated_at,
        })
        .eq('id', id);
    } catch {
      // Ignore
    }

    // 3. If password change was requested, call password update endpoint or RPC
    if (input.newPassword && input.newPassword.trim()) {
      try {
        await fetch('/api/admin/stores/update-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: id,
            password: input.newPassword.trim(),
          }),
        });
      } catch (passErr) {
        console.warn('Could not update password via endpoint:', passErr);
      }
    }

    const row = data as StoreItem;
    const local = getLocalCache();
    const idx = local.findIndex((s) => s.id === id);
    if (idx !== -1) {
      local[idx] = row;
    } else {
      local.push(row);
    }
    setLocalCache(local);

    return { data: row, error: null };
  } catch (err: unknown) {
    const local = getLocalCache();
    const idx = local.findIndex((s) => s.id === id);
    if (idx !== -1) {
      local[idx] = {
        ...local[idx],
        ...updatePayload,
      };
      setLocalCache(local);
      return { data: local[idx], error: null };
    }
    const errorMsg = err instanceof Error ? err.message : 'Update store failed';
    return { data: null, error: new Error(errorMsg) };
  }
}

/**
 * Fetch a single store profile by user/store UUID
 */
export async function getStoreById(
  storeId: string
): Promise<{ data: StoreItem | null; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('stores')
      .select('*')
      .eq('id', storeId)
      .maybeSingle();

    if (error) {
      console.warn('Supabase getStoreById failed, checking local cache:', error.message);
      const local = getLocalCache().find(
        (s) => s.id === storeId || s.store_id === storeId
      );
      return { data: local || null, error: new Error(error.message) };
    }

    if (!data) {
      const local = getLocalCache().find(
        (s) => s.id === storeId || s.store_id === storeId
      );
      return { data: local || null, error: null };
    }

    const item = data as StoreItem;
    // update cache
    const list = getLocalCache();
    setLocalCache([...list.filter((s) => s.id !== item.id), item]);

    return { data: item, error: null };
  } catch (err: unknown) {
    const local = getLocalCache().find(
      (s) => s.id === storeId || s.store_id === storeId
    );
    return { data: local || null, error: null };
  }
}

/**
 * Store user changes their own password:
 * Verifies current password by attempting sign in,
 * then updates to new password using Supabase Auth.
 */
export async function changeStorePassword(
  email: string,
  currentPassword: string,
  newPassword: string,
  userId?: string
): Promise<{ success: boolean; error: Error | null }> {
  try {
    if (!currentPassword || !newPassword) {
      return {
        success: false,
        error: new Error('Both current and new passwords are required.'),
      };
    }

    if (newPassword.length < 6) {
      return {
        success: false,
        error: new Error('New password must be at least 6 characters long.'),
      };
    }

    // 1. Verify current password
    if (email) {
      const { error: verifyErr } = await supabase.auth.signInWithPassword({
        email,
        password: currentPassword,
      });

      if (verifyErr) {
        return {
          success: false,
          error: new Error('Current password does not match.'),
        };
      }
    }

    // 2. Update to new password via authenticated session
    const { error: updateErr } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (updateErr) {
      // 3. Fallback to server route if available
      if (userId) {
        try {
          const res = await fetch('/api/admin/stores/update-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, password: newPassword }),
          });
          const resJson = await res.json();
          if (!res.ok) {
            return {
              success: false,
              error: new Error(resJson.error || updateErr.message),
            };
          }
          return { success: true, error: null };
        } catch {
          return { success: false, error: new Error(updateErr.message) };
        }
      }
      return { success: false, error: new Error(updateErr.message) };
    }

    return { success: true, error: null };
  } catch (err: unknown) {
    const errorMsg =
      err instanceof Error ? err.message : 'Failed to change password.';
    return { success: false, error: new Error(errorMsg) };
  }
}

