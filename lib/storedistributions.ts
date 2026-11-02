import { supabase } from './supabase';

export type DistributionStatus = 'pending' | 'accepted';

export interface DistributionItem {
  id: string;
  s_distribution_id: string;
  product_id: string;
  product_variant_id: string;
  qty: number;
  barcode: string;
  created_at?: string;
  // Augmented details
  product_name?: string;
  product_prod_id?: string;
  variant_size?: string;
  variant_color?: string;
}

export interface StoreDistribution {
  id: string;
  store_id: string;
  distribution_id: string;
  date: string;
  status: DistributionStatus;
  accepted_at: string | null;
  accepted_by: string | null;
  created_at: string;
  updated_at?: string;
  // Joined store details
  store_name?: string;
  store_code?: string;
  store_address?: string | null;
  store_mobile?: string | null;
  store_email?: string | null;
  // Items list
  items?: DistributionItem[];
}

export interface CreateDistributionItemInput {
  product_id: string;
  product_variant_id: string;
  qty: number;
  barcode: string;
  product_name?: string;
  product_prod_id?: string;
  variant_size?: string;
  variant_color?: string;
}

export interface CreateStoreDistributionInput {
  store_id: string;
  distribution_id: string;
  date: string;
  status?: DistributionStatus;
  items: CreateDistributionItemInput[];
}

export interface StoreDistributionFilters {
  search?: string;
  storeId?: string;
  fromDate?: string;
  toDate?: string;
}

const LOCAL_STORAGE_KEY = 'menexpress_store_distributions_cache';

function getLocalCache(): StoreDistribution[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function setLocalCache(items: StoreDistribution[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Ignore storage write errors
  }
}

/**
 * Generate auto distribution_id: distribution_(5 random numbers) unique
 * Example: distribution_58392
 */
export function generateRandomDistributionId(existingIds: Set<string> = new Set()): string {
  let candidate = '';
  let attempts = 0;
  do {
    const random5Digits = Math.floor(10000 + Math.random() * 90000);
    candidate = `distribution_${random5Digits}`;
    attempts++;
  } while (existingIds.has(candidate) && attempts < 100);

  return candidate;
}

/**
 * Generate a unique distribution_id by verifying against database records and local cache
 */
export async function getUniqueDistributionId(): Promise<string> {
  const local = getLocalCache();
  const existingSet = new Set(local.map((d) => d.distribution_id));

  // Try generating candidate
  let candidate = generateRandomDistributionId(existingSet);

  try {
    // Check against Supabase
    const { data } = await supabase
      .from('store_distribution')
      .select('distribution_id')
      .eq('distribution_id', candidate)
      .maybeSingle();

    if (data?.distribution_id) {
      existingSet.add(data.distribution_id);
      candidate = generateRandomDistributionId(existingSet);
    }
  } catch {
    // Fallback to local candidate
  }

  return candidate;
}

/**
 * Fetch list of Store Distributions with optional filters:
 * - Search by distribution_id
 * - Filter by Store
 * - From Date to To Date (default last one week)
 */
export async function getStoreDistributions(filters?: StoreDistributionFilters): Promise<{
  data: StoreDistribution[];
  error: Error | null;
}> {
  try {
    let query = supabase
      .from('store_distribution')
      .select(`
        *,
        store:store_id(
          id,
          store_id,
          name,
          address,
          mobile,
          email
        )
      `)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false });

    if (filters?.storeId && filters.storeId !== 'all') {
      query = query.eq('store_id', filters.storeId);
    }

    if (filters?.fromDate) {
      query = query.gte('date', filters.fromDate);
    }

    if (filters?.toDate) {
      query = query.lte('date', filters.toDate);
    }

    const { data, error } = await query;

    if (error) {
      console.warn('Supabase store_distribution fetch error, using local cache:', error.message);
      let local = getLocalCache();

      if (filters?.storeId && filters.storeId !== 'all') {
        local = local.filter((d) => d.store_id === filters.storeId);
      }
      if (filters?.fromDate) {
        local = local.filter((d) => d.date >= filters.fromDate!);
      }
      if (filters?.toDate) {
        local = local.filter((d) => d.date <= filters.toDate!);
      }
      if (filters?.search) {
        const q = filters.search.trim().toLowerCase();
        local = local.filter((d) => d.distribution_id.toLowerCase().includes(q));
      }

      return { data: local, error: new Error(error.message) };
    }

    if (data) {
      const formatted: StoreDistribution[] = (data as any[]).map((row) => ({
        id: row.id,
        store_id: row.store_id,
        distribution_id: row.distribution_id,
        date: row.date,
        status: (row.status as DistributionStatus) || 'pending',
        accepted_at: row.accepted_at || null,
        accepted_by: row.accepted_by || null,
        created_at: row.created_at,
        updated_at: row.updated_at,
        store_name: row.store?.name,
        store_code: row.store?.store_id,
        store_address: row.store?.address,
        store_mobile: row.store?.mobile,
        store_email: row.store?.email,
      }));

      // Merge into local cache
      const cached = getLocalCache();
      const cachedMap = new Map(cached.map((c) => [c.id, c]));
      formatted.forEach((f) => cachedMap.set(f.id, { ...cachedMap.get(f.id), ...f }));
      setLocalCache(Array.from(cachedMap.values()));

      let result = formatted;
      if (filters?.search) {
        const q = filters.search.trim().toLowerCase();
        result = result.filter((d) => d.distribution_id.toLowerCase().includes(q));
      }

      return { data: result, error: null };
    }

    return { data: [], error: null };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown network error';
    let local = getLocalCache();
    if (filters?.storeId && filters.storeId !== 'all') {
      local = local.filter((d) => d.store_id === filters.storeId);
    }
    if (filters?.fromDate) {
      local = local.filter((d) => d.date >= filters.fromDate!);
    }
    if (filters?.toDate) {
      local = local.filter((d) => d.date <= filters.toDate!);
    }
    if (filters?.search) {
      const q = filters.search.trim().toLowerCase();
      local = local.filter((d) => d.distribution_id.toLowerCase().includes(q));
    }
    return { data: local, error: new Error(errorMsg) };
  }
}

/**
 * Total Store Distributions Count as per filtered dates & store
 */
export async function getStoreDistributionsCount(
  fromDate?: string,
  toDate?: string,
  storeId?: string
): Promise<{ count: number; error: Error | null }> {
  try {
    let query = supabase.from('store_distribution').select('*', { count: 'exact', head: true });

    if (fromDate) {
      query = query.gte('date', fromDate);
    }
    if (toDate) {
      query = query.lte('date', toDate);
    }
    if (storeId && storeId !== 'all') {
      query = query.eq('store_id', storeId);
    }

    const { count, error } = await query;

    if (error || count === null) {
      let local = getLocalCache();
      if (fromDate) local = local.filter((d) => d.date >= fromDate);
      if (toDate) local = local.filter((d) => d.date <= toDate);
      if (storeId && storeId !== 'all') local = local.filter((d) => d.store_id === storeId);
      return { count: local.length, error: error ? new Error(error.message) : null };
    }

    return { count, error: null };
  } catch {
    let local = getLocalCache();
    if (fromDate) local = local.filter((d) => d.date >= fromDate);
    if (toDate) local = local.filter((d) => d.date <= toDate);
    return { count: local.length, error: null };
  }
}

/**
 * Fetch single store distribution record with all line items (Read-only)
 */
export async function getStoreDistributionDetails(idOrDistributionId: string): Promise<{
  data: StoreDistribution | null;
  error: Error | null;
}> {
  try {
    let query = supabase
      .from('store_distribution')
      .select(`
        *,
        store:store_id(
          id,
          store_id,
          name,
          address,
          mobile,
          email
        )
      `);

    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      idOrDistributionId
    );

    if (isUUID) {
      query = query.eq('id', idOrDistributionId);
    } else {
      query = query.eq('distribution_id', idOrDistributionId);
    }

    const { data: distData, error: distError } = await query.maybeSingle();

    if (distError || !distData) {
      const local = getLocalCache();
      const found = local.find(
        (d) => d.id === idOrDistributionId || d.distribution_id === idOrDistributionId
      );
      if (found) {
        return { data: found, error: null };
      }
      return {
        data: null,
        error: distError ? new Error(distError.message) : new Error('Distribution record not found'),
      };
    }

    const row = distData as any;
    const distributionUuid = row.id;

    // Fetch line items from distribution_items with products and product_variants
    const { data: itemsData, error: itemsError } = await supabase
      .from('distribution_items')
      .select(`
        *,
        product:product_id(id, prod_id, name),
        product_variant:product_variant_id(
          id,
          barcode,
          size:size_id(value),
          product_color:product_color_id(
            color:color_id(name, code)
          )
        )
      `)
      .eq('s_distribution_id', distributionUuid)
      .order('created_at', { ascending: true });

    if (itemsError) {
      console.warn('Failed to load distribution items from Supabase:', itemsError.message);
    }

    const items: DistributionItem[] = ((itemsData as any[]) || []).map((it) => ({
      id: it.id,
      s_distribution_id: it.s_distribution_id,
      product_id: it.product_id,
      product_variant_id: it.product_variant_id,
      qty: Number(it.qty || 0),
      barcode: it.barcode || it.product_variant?.barcode || '',
      created_at: it.created_at,
      product_name: it.product?.name || 'Unknown Product',
      product_prod_id: it.product?.prod_id || '',
      variant_size: it.product_variant?.size?.value || '—',
      variant_color: it.product_variant?.product_color?.color?.name || '—',
    }));

    const result: StoreDistribution = {
      id: row.id,
      store_id: row.store_id,
      distribution_id: row.distribution_id,
      date: row.date,
      status: row.status as DistributionStatus,
      accepted_at: row.accepted_at || null,
      accepted_by: row.accepted_by || null,
      created_at: row.created_at,
      updated_at: row.updated_at,
      store_name: row.store?.name,
      store_code: row.store?.store_id,
      store_address: row.store?.address,
      store_mobile: row.store?.mobile,
      store_email: row.store?.email,
      items,
    };

    return { data: result, error: null };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to retrieve distribution details';
    return { data: null, error: new Error(errorMsg) };
  }
}

/**
 * Create a new store distribution and insert line items with product_id & product_variant_id
 */
export async function createStoreDistribution(
  input: CreateStoreDistributionInput
): Promise<{ data: StoreDistribution | null; error: Error | null }> {
  const distPayload = {
    store_id: input.store_id,
    distribution_id: input.distribution_id.trim(),
    date: input.date || new Date().toISOString().split('T')[0],
    status: input.status || 'pending',
  };

  try {
    // 1. Insert header into store_distribution table
    const { data: createdDist, error: distErr } = await supabase
      .from('store_distribution')
      .insert([distPayload])
      .select(`
        *,
        store:store_id(
          id,
          store_id,
          name,
          address,
          mobile,
          email
        )
      `)
      .single();

    if (distErr) {
      console.warn('Supabase store_distribution insert failed, using fallback:', distErr.message);
      const fallbackId =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `dist-${Date.now()}`;

      const fallbackItems: DistributionItem[] = input.items.map((it) => ({
        id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `item-${Date.now()}-${Math.random()}`,
        s_distribution_id: fallbackId,
        product_id: it.product_id,
        product_variant_id: it.product_variant_id,
        qty: Number(it.qty),
        barcode: it.barcode,
        product_name: it.product_name,
        product_prod_id: it.product_prod_id,
        variant_size: it.variant_size,
        variant_color: it.variant_color,
      }));

      const newDist: StoreDistribution = {
        id: fallbackId,
        store_id: distPayload.store_id,
        distribution_id: distPayload.distribution_id,
        date: distPayload.date,
        status: distPayload.status as DistributionStatus,
        accepted_at: null,
        accepted_by: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        items: fallbackItems,
      };

      const localList = getLocalCache();
      setLocalCache([newDist, ...localList]);
      return { data: newDist, error: null };
    }

    const distRow = createdDist as any;
    const distributionUuid = distRow.id;

    // 2. Insert items into distribution_items table (including product_id)
    if (input.items && input.items.length > 0) {
      const itemsPayload = input.items.map((it) => ({
        s_distribution_id: distributionUuid,
        product_id: it.product_id,
        product_variant_id: it.product_variant_id,
        qty: Number(it.qty),
        barcode: it.barcode,
      }));

      const { error: itemsErr } = await supabase
        .from('distribution_items')
        .insert(itemsPayload);

      if (itemsErr) {
        console.error('Error inserting distribution items:', itemsErr.message);
      }
    }

    const formattedItems: DistributionItem[] = input.items.map((it) => ({
      id: `${distributionUuid}-${it.product_variant_id}`,
      s_distribution_id: distributionUuid,
      product_id: it.product_id,
      product_variant_id: it.product_variant_id,
      qty: Number(it.qty),
      barcode: it.barcode,
      product_name: it.product_name,
      product_prod_id: it.product_prod_id,
      variant_size: it.variant_size,
      variant_color: it.variant_color,
    }));

    const formattedDist: StoreDistribution = {
      id: distRow.id,
      store_id: distRow.store_id,
      distribution_id: distRow.distribution_id,
      date: distRow.date,
      status: distRow.status as DistributionStatus,
      accepted_at: distRow.accepted_at || null,
      accepted_by: distRow.accepted_by || null,
      created_at: distRow.created_at,
      updated_at: distRow.updated_at,
      store_name: distRow.store?.name,
      store_code: distRow.store?.store_id,
      store_address: distRow.store?.address,
      store_mobile: distRow.store?.mobile,
      store_email: distRow.store?.email,
      items: formattedItems,
    };

    const localList = getLocalCache();
    setLocalCache([formattedDist, ...localList.filter((d) => d.id !== formattedDist.id)]);

    return { data: formattedDist, error: null };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to create store distribution';
    return { data: null, error: new Error(errorMsg) };
  }
}
