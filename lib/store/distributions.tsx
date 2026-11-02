import { supabase } from '@/lib/supabase';

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
 * Fetch single store distribution record with all line items
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
 * Updates the store_distribution status and accepted_at.
 * When status is changed to accepted and saved:
 * Updates store_products with distribution_items:
 * - If product and product_variant available: update with new quantity (quantity = quantity + qty)
 * - If new: insert it
 */
export async function updateStoreDistributionStatusAndInventory(
  distributionId: string,
  newStatus: DistributionStatus,
  acceptedByUserId?: string
): Promise<{ success: boolean; data: StoreDistribution | null; error: Error | null }> {
  try {
    // 1. Fetch distribution details and items
    const { data: dist, error: fetchErr } = await getStoreDistributionDetails(distributionId);
    if (fetchErr || !dist) {
      return { success: false, data: null, error: fetchErr || new Error('Distribution not found') };
    }

    if (dist.status === 'accepted') {
      return {
        success: false,
        data: dist,
        error: new Error('Distribution has already been accepted and cannot be modified.'),
      };
    }

    const nowIso = new Date().toISOString();
    const isAccepting = newStatus === 'accepted';

    // 2. Update store_distribution table in Supabase
    const updatePayload: Record<string, any> = {
      status: newStatus,
      updated_at: nowIso,
    };

    if (isAccepting) {
      updatePayload.accepted_at = nowIso;
      if (acceptedByUserId) {
        updatePayload.accepted_by = acceptedByUserId;
      }
    }

    const { error: updateDistErr } = await supabase
      .from('store_distribution')
      .update(updatePayload)
      .eq('id', dist.id);

    if (updateDistErr) {
      console.warn('Error updating store_distribution in Supabase:', updateDistErr.message);
    }

    // 3. If accepted, update store_products with distributions_items
    const items = dist.items || [];
    if (isAccepting && items.length > 0) {
      for (const item of items) {
        try {
          // Check if product and product_variant already available in store_products
          const { data: existingProduct, error: findErr } = await supabase
            .from('store_products')
            .select('id, quantity')
            .eq('store_id', dist.store_id)
            .eq('product_variant', item.product_variant_id)
            .maybeSingle();

          if (!findErr && existingProduct) {
            // Update with new quantity: store_products.quantity = store_products.quantity + qty
            const newQty = Number(existingProduct.quantity || 0) + Number(item.qty || 0);
            const { error: updErr } = await supabase
              .from('store_products')
              .update({
                quantity: newQty,
                updated_at: nowIso,
              })
              .eq('id', existingProduct.id);

            if (updErr) {
              console.warn('Error updating existing store_product:', updErr.message);
            }
          } else {
            // If new: insert it
            const { error: insErr } = await supabase.from('store_products').insert({
              store_id: dist.store_id,
              product_id: item.product_id,
              product_variant: item.product_variant_id,
              quantity: Number(item.qty || 0),
              barcode: item.barcode,
              created_at: nowIso,
              updated_at: nowIso,
            });

            if (insErr) {
              console.warn('Error inserting new store_product:', insErr.message);
            }
          }
        } catch (itemErr) {
          console.error('Error processing distribution item for inventory update:', itemErr);
        }
      }
    }

    // 4. Update local cache
    const updatedDist: StoreDistribution = {
      ...dist,
      status: newStatus,
      accepted_at: isAccepting ? nowIso : dist.accepted_at,
      accepted_by: isAccepting ? (acceptedByUserId || dist.accepted_by) : dist.accepted_by,
      updated_at: nowIso,
    };

    const localList = getLocalCache();
    const updatedList = localList.map((d) => (d.id === dist.id ? updatedDist : d));
    setLocalCache(updatedList);

    return { success: true, data: updatedDist, error: null };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to update distribution';
    return { success: false, data: null, error: new Error(errorMsg) };
  }
}
