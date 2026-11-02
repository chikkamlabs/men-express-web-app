import { supabase } from './supabase';

export interface CouponCode {
  id: string;
  code: string;
  discount: number;
  sentence: string | null;
  usage: number;
  threshold: number;
  valid_upto: string | null;
  status: boolean;
  is_public: boolean;
  created_at: string;
  updated_at?: string;
}

export interface CreateCouponInput {
  code: string;
  discount: number;
  sentence?: string | null;
  usage?: number;
  threshold?: number;
  valid_upto?: string | null;
  status?: boolean;
  is_public?: boolean;
}

export interface UpdateCouponInput {
  code?: string;
  discount?: number;
  sentence?: string | null;
  usage?: number;
  threshold?: number;
  valid_upto?: string | null;
  status?: boolean;
  is_public?: boolean;
}

const LOCAL_STORAGE_KEY = 'menexpress_coupons_cache';

function getLocalCache(): CouponCode[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function setLocalCache(items: CouponCode[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Ignore storage write errors
  }
}

/**
 * Fetch all coupon codes from Supabase
 */
export async function getCoupons(): Promise<{ data: CouponCode[]; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('coupon_codes')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Supabase fetch coupons error, using local cache:', error.message);
      return { data: getLocalCache(), error: new Error(error.message) };
    }

    if (data) {
      const mapped: CouponCode[] = (data as any[]).map((row) => ({
        id: row.id,
        code: row.code,
        discount: Number(row.discount) || 0,
        sentence: row.sentence || null,
        usage: Number(row.usage) || 0,
        threshold: Number(row.threshold) || 0,
        valid_upto: row.valid_upto || null,
        status: typeof row.status === 'boolean' ? row.status : true,
        is_public: typeof row.is_public === 'boolean' ? row.is_public : false,
        created_at: row.created_at,
        updated_at: row.updated_at,
      }));
      setLocalCache(mapped);
      return { data: mapped, error: null };
    }

    return { data: getLocalCache(), error: null };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown network error';
    return { data: getLocalCache(), error: new Error(errorMsg) };
  }
}

/**
 * Get count of active coupons (where status = true)
 */
export async function getActiveCouponCount(): Promise<{ count: number; error: Error | null }> {
  try {
    const { count, error } = await supabase
      .from('coupon_codes')
      .select('*', { count: 'exact', head: true })
      .eq('status', true);

    if (error || count === null) {
      const local = getLocalCache();
      const activeCount = local.filter((c) => c.status).length;
      return { count: activeCount, error: error ? new Error(error.message) : null };
    }

    return { count, error: null };
  } catch {
    const local = getLocalCache();
    return { count: local.filter((c) => c.status).length, error: null };
  }
}

/**
 * Insert a new coupon into Supabase
 */
export async function createCoupon(
  input: CreateCouponInput
): Promise<{ data: CouponCode | null; error: Error | null }> {
  const payload = {
    code: input.code.trim().toUpperCase(),
    discount: Number(input.discount) || 0,
    sentence: input.sentence?.trim() || null,
    usage: Number(input.usage) || 0,
    threshold: Number(input.threshold) || 0,
    valid_upto: input.valid_upto || null,
    status: typeof input.status === 'boolean' ? input.status : true,
    is_public: typeof input.is_public === 'boolean' ? input.is_public : false,
  };

  try {
    const { data, error } = await supabase
      .from('coupon_codes')
      .insert([payload])
      .select()
      .single();

    if (error) {
      console.warn('Supabase create coupon failed, saving to local cache fallback:', error.message);
      const local = getLocalCache();
      const newItem: CouponCode = {
        id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `mock-${Date.now()}`,
        ...payload,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      setLocalCache([newItem, ...local]);
      return { data: newItem, error: null };
    }

    const created = data as CouponCode;
    const local = getLocalCache();
    setLocalCache([created, ...local.filter((c) => c.id !== created.id)]);
    return { data: created, error: null };
  } catch (err: unknown) {
    const local = getLocalCache();
    const newItem: CouponCode = {
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `mock-${Date.now()}`,
      ...payload,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setLocalCache([newItem, ...local]);
    return { data: newItem, error: null };
  }
}

/**
 * Update an existing coupon by id
 */
export async function updateCoupon(
  id: string,
  input: UpdateCouponInput
): Promise<{ data: CouponCode | null; error: Error | null }> {
  const updatePayload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (input.code !== undefined) updatePayload.code = input.code.trim().toUpperCase();
  if (input.discount !== undefined) updatePayload.discount = Number(input.discount) || 0;
  if (input.sentence !== undefined) updatePayload.sentence = input.sentence?.trim() || null;
  if (input.usage !== undefined) updatePayload.usage = Number(input.usage) || 0;
  if (input.threshold !== undefined) updatePayload.threshold = Number(input.threshold) || 0;
  if (input.valid_upto !== undefined) updatePayload.valid_upto = input.valid_upto || null;
  if (input.status !== undefined) updatePayload.status = input.status;
  if (input.is_public !== undefined) updatePayload.is_public = input.is_public;

  try {
    const { data, error } = await supabase
      .from('coupon_codes')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.warn('Supabase update coupon failed, updating local fallback:', error.message);
      const local = getLocalCache();
      const idx = local.findIndex((c) => c.id === id);
      if (idx !== -1) {
        local[idx] = {
          ...local[idx],
          ...updatePayload,
        } as CouponCode;
        setLocalCache(local);
        return { data: local[idx], error: null };
      }
      return { data: null, error: new Error(error.message) };
    }

    const updated = data as CouponCode;
    const local = getLocalCache();
    const idx = local.findIndex((c) => c.id === id);
    if (idx !== -1) {
      local[idx] = updated;
    } else {
      local.unshift(updated);
    }
    setLocalCache(local);
    return { data: updated, error: null };
  } catch (err: unknown) {
    const local = getLocalCache();
    const idx = local.findIndex((c) => c.id === id);
    if (idx !== -1) {
      local[idx] = {
        ...local[idx],
        ...updatePayload,
      } as CouponCode;
      setLocalCache(local);
      return { data: local[idx], error: null };
    }
    const errorMsg = err instanceof Error ? err.message : 'Update failed';
    return { data: null, error: new Error(errorMsg) };
  }
}
