import { supabase } from './supabase';

export interface Customer {
  id: string;
  name: string;
  mobile: string;
  email: string | null;
  key: string;
  points: number;
  created_at: string;
  updated_at?: string;
}

export interface CreateCustomerInput {
  name: string;
  mobile: string;
  email?: string | null;
  key: string;
  points?: number;
}

export interface UpdateCustomerInput {
  name: string;
  mobile: string;
  email?: string | null;
  key: string;
  points: number;
}

const LOCAL_STORAGE_KEY = 'menexpress_customers_cache';

/**
 * Auto-generate a random 5-digit number as string
 */
export function generateCustomerKey(): string {
  return Math.floor(10000 + Math.random() * 90000).toString();
}

function getLocalCache(): Customer[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function setLocalCache(items: Customer[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Ignore storage write errors
  }
}

/**
 * Fetch all customers from Supabase with graceful cache fallback
 */
export async function getCustomers(): Promise<{
  data: Customer[];
  error: Error | null;
}> {
  try {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Supabase fetch error for customers, using local cache:', error.message);
      return { data: getLocalCache(), error: new Error(error.message) };
    }

    if (data) {
      setLocalCache(data as Customer[]);
      return { data: data as Customer[], error: null };
    }

    return { data: getLocalCache(), error: null };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown network error';
    return { data: getLocalCache(), error: new Error(errorMsg) };
  }
}

/**
 * Fetch total count of customers
 */
export async function getCustomerCount(): Promise<{
  count: number;
  error: Error | null;
}> {
  try {
    const { count, error } = await supabase
      .from('customers')
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
 * Insert a new customer into Supabase
 */
export async function createCustomer(
  input: CreateCustomerInput
): Promise<{ data: Customer | null; error: Error | null }> {
  const payload = {
    name: input.name.trim(),
    mobile: input.mobile.trim(),
    email: input.email?.trim() || null,
    key: input.key.trim() || generateCustomerKey(),
    points: typeof input.points === 'number' && !isNaN(input.points) ? Math.max(0, input.points) : 0,
  };

  try {
    const { data, error } = await supabase
      .from('customers')
      .insert([payload])
      .select()
      .single();

    if (error) {
      console.warn('Supabase insert failed for customer, saving to local cache fallback:', error.message);
      const local = getLocalCache();
      const newItem: Customer = {
        id:
          typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : `cust-${Date.now()}`,
        name: payload.name,
        mobile: payload.mobile,
        email: payload.email,
        key: payload.key,
        points: payload.points,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      const updatedList = [newItem, ...local];
      setLocalCache(updatedList);
      return { data: newItem, error: null };
    }

    const local = getLocalCache();
    const updatedList = [
      data as Customer,
      ...local.filter((c) => c.id !== data.id && c.mobile !== data.mobile),
    ];
    setLocalCache(updatedList);

    return { data: data as Customer, error: null };
  } catch (err: unknown) {
    const local = getLocalCache();
    const newItem: Customer = {
      id:
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `cust-${Date.now()}`,
      name: payload.name,
      mobile: payload.mobile,
      email: payload.email,
      key: payload.key,
      points: payload.points,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const updatedList = [newItem, ...local];
    setLocalCache(updatedList);
    return { data: newItem, error: null };
  }
}

/**
 * Update an existing customer
 */
export async function updateCustomer(
  id: string,
  input: UpdateCustomerInput
): Promise<{ data: Customer | null; error: Error | null }> {
  const updatePayload = {
    name: input.name.trim(),
    mobile: input.mobile.trim(),
    email: input.email ? input.email.trim() : null,
    key: input.key.trim(),
    points: typeof input.points === 'number' && !isNaN(input.points) ? Math.max(0, input.points) : 0,
    updated_at: new Date().toISOString(),
  };

  try {
    const { data, error } = await supabase
      .from('customers')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.warn('Supabase update failed for customer, updating local cache fallback:', error.message);
      const local = getLocalCache();
      const idx = local.findIndex((c) => c.id === id);
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
    const idx = local.findIndex((c) => c.id === id);
    if (idx !== -1) {
      local[idx] = data as Customer;
    } else {
      local.push(data as Customer);
    }
    setLocalCache(local);

    return { data: data as Customer, error: null };
  } catch (err: unknown) {
    const local = getLocalCache();
    const idx = local.findIndex((c) => c.id === id);
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
