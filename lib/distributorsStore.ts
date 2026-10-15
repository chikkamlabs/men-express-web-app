import { supabase } from './supabase';

export interface Distributor {
  id: string;
  distributor_id: string;
  name: string;
  mobile: string | null;
  email: string | null;
  company: string | null;
  balance: number;
  status: 'active' | 'deactive';
  created_at: string;
  updated_at?: string;
}

export interface CreateDistributorInput {
  distributor_id: string;
  name: string;
  mobile?: string;
  company?: string;
  status?: 'active' | 'deactive';
}

export interface UpdateDistributorInput {
  name: string;
  mobile?: string;
  email?: string;
  company?: string;
  balance?: number;
  status: 'active' | 'deactive';
}

const LOCAL_STORAGE_KEY = 'menexpress_distributors_cache';

function getLocalCache(): Distributor[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function setLocalCache(items: Distributor[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Ignore storage write errors
  }
}

/**
 * Calculate the auto-filled distributor_id using the formula:
 * distributor_id = distributor_101 + length of distributors on every new entry
 */
export function calculateNextDistributorId(
  count: number,
  existingDistributors: Distributor[] = []
): string {
  const targetNum = 101 + count;
  let candidateId = `distributor_${targetNum}`;

  const existingIds = new Set(existingDistributors.map((d) => d.distributor_id));
  if (!existingIds.has(candidateId)) {
    return candidateId;
  }

  // If candidate already exists, increment to avoid collisions
  let counter = targetNum;
  while (existingIds.has(`distributor_${counter}`)) {
    counter++;
  }
  return `distributor_${counter}`;
}

/**
 * Fetch all distributors from Supabase with graceful fallback
 */
export async function getDistributors(): Promise<{
  data: Distributor[];
  error: Error | null;
}> {
  try {
    const { data, error } = await supabase
      .from('distributors')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      console.warn('Supabase fetch error, using local cache:', error.message);
      return { data: getLocalCache(), error: new Error(error.message) };
    }

    if (data) {
      setLocalCache(data as Distributor[]);
      return { data: data as Distributor[], error: null };
    }

    return { data: getLocalCache(), error: null };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown network error';
    return { data: getLocalCache(), error: new Error(errorMsg) };
  }
}

/**
 * Fetch total count of distributors
 */
export async function getDistributorCount(): Promise<{
  count: number;
  error: Error | null;
}> {
  try {
    const { count, error } = await supabase
      .from('distributors')
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
 * Insert a new distributor into Supabase
 */
export async function createDistributor(
  input: CreateDistributorInput
): Promise<{ data: Distributor | null; error: Error | null }> {
  const payload = {
    distributor_id: input.distributor_id.trim(),
    name: input.name.trim(),
    mobile: input.mobile?.trim() || null,
    company: input.company?.trim() || null,
    balance: 0.0,
    status: input.status || 'active',
  };

  try {
    const { data, error } = await supabase
      .from('distributors')
      .insert([payload])
      .select()
      .single();

    if (error) {
      console.warn('Supabase insert failed, saving to local cache fallback:', error.message);
      const local = getLocalCache();
      const newItem: Distributor = {
        id:
          typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : `mock-dist-${Date.now()}`,
        distributor_id: payload.distributor_id,
        name: payload.name,
        mobile: payload.mobile,
        email: null,
        company: payload.company,
        balance: payload.balance,
        status: payload.status as 'active' | 'deactive',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      const updatedList = [...local, newItem];
      setLocalCache(updatedList);
      return { data: newItem, error: null };
    }

    const local = getLocalCache();
    const updatedList = [
      ...local.filter((d) => d.distributor_id !== data.distributor_id),
      data as Distributor,
    ];
    setLocalCache(updatedList);

    return { data: data as Distributor, error: null };
  } catch (err: unknown) {
    const local = getLocalCache();
    const newItem: Distributor = {
      id:
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `mock-dist-${Date.now()}`,
      distributor_id: payload.distributor_id,
      name: payload.name,
      mobile: payload.mobile,
      email: null,
      company: payload.company,
      balance: payload.balance,
      status: payload.status as 'active' | 'deactive',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const updatedList = [...local, newItem];
    setLocalCache(updatedList);
    return { data: newItem, error: null };
  }
}

/**
 * Update an existing distributor by distributor_id. Note: distributor_id is immutable.
 */
export async function updateDistributor(
  distributor_id: string,
  input: UpdateDistributorInput
): Promise<{ data: Distributor | null; error: Error | null }> {
  const updatePayload = {
    name: input.name.trim(),
    mobile: input.mobile?.trim() || null,
    email: input.email?.trim() || null,
    company: input.company?.trim() || null,
    balance: typeof input.balance === 'number' ? input.balance : 0.0,
    status: input.status,
    updated_at: new Date().toISOString(),
  };

  try {
    const { data, error } = await supabase
      .from('distributors')
      .update(updatePayload)
      .eq('distributor_id', distributor_id)
      .select()
      .single();

    if (error) {
      console.warn('Supabase update failed, updating local cache fallback:', error.message);
      const local = getLocalCache();
      const idx = local.findIndex((d) => d.distributor_id === distributor_id);
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
    const idx = local.findIndex((d) => d.distributor_id === distributor_id);
    if (idx !== -1) {
      local[idx] = data as Distributor;
    } else {
      local.push(data as Distributor);
    }
    setLocalCache(local);

    return { data: data as Distributor, error: null };
  } catch (err: unknown) {
    const local = getLocalCache();
    const idx = local.findIndex((d) => d.distributor_id === distributor_id);
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
