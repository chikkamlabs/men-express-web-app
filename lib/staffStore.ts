import { supabase } from './supabase';

export interface Staff {
  id: string;
  name: string;
  mobile: string | null;
  email: string | null;
  salary: number;
  store_id?: string | null;
  status: 'active' | 'deactive';
  created_at: string;
  updated_at?: string;
}

export interface CreateStaffInput {
  name: string;
  mobile: string;
  email?: string;
  salary: number;
  status: 'active' | 'deactive';
  store_id?: string;
}

export interface UpdateStaffInput {
  name: string;
  mobile: string;
  email?: string | null;
  salary: number;
  status: 'active' | 'deactive';
}

const LOCAL_STORAGE_KEY = 'menexpress_staff_cache';

function getLocalCache(): Staff[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function setLocalCache(items: Staff[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Ignore storage write errors
  }
}

/**
 * Fetch all staff from Supabase with graceful fallback
 */
export async function getStaffs(): Promise<{
  data: Staff[];
  error: Error | null;
}> {
  try {
    const { data, error } = await supabase
      .from('staff')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Supabase fetch error for staff, using local cache:', error.message);
      return { data: getLocalCache(), error: new Error(error.message) };
    }

    if (data) {
      setLocalCache(data as Staff[]);
      return { data: data as Staff[], error: null };
    }

    return { data: getLocalCache(), error: null };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown network error';
    return { data: getLocalCache(), error: new Error(errorMsg) };
  }
}

export const getStaffList = getStaffs;

/**
 * Fetch total count of staff
 */
export async function getStaffCount(): Promise<{
  count: number;
  error: Error | null;
}> {
  try {
    const { count, error } = await supabase
      .from('staff')
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
 * Insert a new staff member into Supabase
 */
export async function createStaff(
  input: CreateStaffInput
): Promise<{ data: Staff | null; error: Error | null }> {
  // If store_id not passed, try to fetch the first available store id
  let targetStoreId = input.store_id || null;
  if (!targetStoreId) {
    try {
      const { data: storeData } = await supabase.from('stores').select('id').limit(1).maybeSingle();
      if (storeData?.id) {
        targetStoreId = storeData.id;
      }
    } catch {
      // Ignore
    }
  }

  const payload: Record<string, unknown> = {
    name: input.name.trim(),
    mobile: input.mobile.trim() || null,
    email: input.email?.trim() || null,
    salary: typeof input.salary === 'number' && !isNaN(input.salary) ? Math.max(0, input.salary) : 0,
    status: input.status || 'active',
  };

  if (targetStoreId) {
    payload.store_id = targetStoreId;
  }

  try {
    const { data, error } = await supabase
      .from('staff')
      .insert([payload])
      .select()
      .single();

    if (error) {
      console.warn('Supabase insert failed for staff, saving to local cache fallback:', error.message);
      const local = getLocalCache();
      const newItem: Staff = {
        id:
          typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : `staff-${Date.now()}`,
        name: String(payload.name),
        mobile: payload.mobile as string | null,
        email: payload.email as string | null,
        salary: Number(payload.salary),
        store_id: targetStoreId,
        status: payload.status as 'active' | 'deactive',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      const updatedList = [newItem, ...local];
      setLocalCache(updatedList);
      return { data: newItem, error: null };
    }

    const local = getLocalCache();
    const updatedList = [
      data as Staff,
      ...local.filter((s) => s.id !== data.id),
    ];
    setLocalCache(updatedList);

    return { data: data as Staff, error: null };
  } catch (err: unknown) {
    const local = getLocalCache();
    const newItem: Staff = {
      id:
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `staff-${Date.now()}`,
      name: String(payload.name),
      mobile: payload.mobile as string | null,
      email: payload.email as string | null,
      salary: Number(payload.salary),
      store_id: targetStoreId,
      status: payload.status as 'active' | 'deactive',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const updatedList = [newItem, ...local];
    setLocalCache(updatedList);
    return { data: newItem, error: null };
  }
}

/**
 * Update an existing staff member
 */
export async function updateStaff(
  id: string,
  input: UpdateStaffInput
): Promise<{ data: Staff | null; error: Error | null }> {
  const updatePayload = {
    name: input.name.trim(),
    mobile: input.mobile.trim() || null,
    email: input.email ? input.email.trim() : null,
    salary: typeof input.salary === 'number' && !isNaN(input.salary) ? Math.max(0, input.salary) : 0,
    status: input.status,
    updated_at: new Date().toISOString(),
  };

  try {
    const { data, error } = await supabase
      .from('staff')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.warn('Supabase update failed for staff, updating local cache fallback:', error.message);
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

    const local = getLocalCache();
    const idx = local.findIndex((s) => s.id === id);
    if (idx !== -1) {
      local[idx] = data as Staff;
    } else {
      local.push(data as Staff);
    }
    setLocalCache(local);

    return { data: data as Staff, error: null };
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
    const errorMsg = err instanceof Error ? err.message : 'Update failed';
    return { data: null, error: new Error(errorMsg) };
  }
}
