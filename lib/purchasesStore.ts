import { supabase } from './supabase';

export interface PurchaseItem {
  id: string;
  purchase_id: string;
  product_id: string;
  product_variant_id: string;
  mrp: number;
  p_p: number;
  qty: number;
  created_at?: string;
  // Augmented details
  product_name?: string;
  product_prod_id?: string;
  variant_barcode?: string;
  variant_size?: string;
  variant_color?: string;
  subtotal?: number;
}

export interface Purchase {
  id: string;
  purchase_id: string;
  distributor_id: string;
  total_amount: number;
  invoice_number: string | null;
  date: string;
  created_at: string;
  updated_at?: string;
  // Joined distributor details
  distributor_name?: string;
  distributor_code?: string;
  distributor_company?: string | null;
  distributor_mobile?: string | null;
  distributor_email?: string | null;
  distributor_balance?: number;
  // Line items
  items?: PurchaseItem[];
}

export interface CreatePurchaseItemInput {
  product_id: string;
  product_variant_id: string;
  mrp: number;
  p_p: number;
  qty: number;
  product_name?: string;
  product_prod_id?: string;
  variant_barcode?: string;
  variant_size?: string;
  variant_color?: string;
}

export interface CreatePurchaseInput {
  purchase_id: string;
  distributor_id: string;
  invoice_number?: string | null;
  total_amount: number;
  date: string;
  items: CreatePurchaseItemInput[];
}

export interface PurchaseFilters {
  search?: string;
  distributorId?: string;
  fromDate?: string;
  toDate?: string;
}

const LOCAL_STORAGE_KEY = 'menexpress_purchases_cache';
const VARIANTS_CACHE_KEY = 'menexpress_product_variants_cache';

function getLocalCache(): Purchase[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function setLocalCache(items: Purchase[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Ignore storage write errors
  }
}

/**
 * Auto-generate next purchase_id (purchs_101 + 1 on every new entry)
 */
export function calculateNextPurchaseId(existingPurchases: (Purchase | { purchase_id: string })[] = []): string {
  const existingIds = new Set(existingPurchases.map((p) => p.purchase_id));

  // Find the maximum existing numeric suffix for purchs_XXX
  let maxNumber = 100;
  for (const p of existingPurchases) {
    const match = p.purchase_id.match(/^purchs_(\d+)$/i);
    if (match) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > maxNumber) {
        maxNumber = num;
      }
    }
  }

  let nextNum = maxNumber + 1;
  let candidateId = `purchs_${nextNum}`;

  while (existingIds.has(candidateId)) {
    nextNum++;
    candidateId = `purchs_${nextNum}`;
  }

  return candidateId;
}

/**
 * Fetch purchases from Supabase with optional filters
 */
export async function getPurchases(filters?: PurchaseFilters): Promise<{
  data: Purchase[];
  error: Error | null;
}> {
  try {
    let query = supabase
      .from('purchases')
      .select(`
        *,
        distributor:distributor_id(
          id,
          distributor_id,
          name,
          company,
          mobile,
          email,
          balance
        )
      `)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false });

    if (filters?.distributorId && filters.distributorId !== 'all') {
      query = query.eq('distributor_id', filters.distributorId);
    }

    if (filters?.fromDate) {
      query = query.gte('date', filters.fromDate);
    }

    if (filters?.toDate) {
      query = query.lte('date', filters.toDate);
    }

    const { data, error } = await query;

    if (error) {
      console.warn('Supabase purchases fetch error, using local cache:', error.message);
      let local = getLocalCache();

      if (filters?.distributorId && filters.distributorId !== 'all') {
        local = local.filter((p) => p.distributor_id === filters.distributorId);
      }
      if (filters?.fromDate) {
        local = local.filter((p) => p.date >= filters.fromDate!);
      }
      if (filters?.toDate) {
        local = local.filter((p) => p.date <= filters.toDate!);
      }
      if (filters?.search) {
        const q = filters.search.trim().toLowerCase();
        local = local.filter(
          (p) =>
            p.purchase_id.toLowerCase().includes(q) ||
            (p.invoice_number && p.invoice_number.toLowerCase().includes(q))
        );
      }

      return { data: local, error: new Error(error.message) };
    }

    if (data) {
      const formatted: Purchase[] = (data as any[]).map((row) => ({
        id: row.id,
        purchase_id: row.purchase_id,
        distributor_id: row.distributor_id,
        total_amount: Number(row.total_amount || 0),
        invoice_number: row.invoice_number || null,
        date: row.date,
        created_at: row.created_at,
        updated_at: row.updated_at,
        distributor_name: row.distributor?.name,
        distributor_code: row.distributor?.distributor_id,
        distributor_company: row.distributor?.company,
        distributor_mobile: row.distributor?.mobile,
        distributor_email: row.distributor?.email,
        distributor_balance: Number(row.distributor?.balance || 0),
      }));

      // Merge into local cache
      const cached = getLocalCache();
      const cachedMap = new Map(cached.map((c) => [c.id, c]));
      formatted.forEach((f) => cachedMap.set(f.id, { ...cachedMap.get(f.id), ...f }));
      setLocalCache(Array.from(cachedMap.values()));

      // Apply client-side search if provided
      let result = formatted;
      if (filters?.search) {
        const q = filters.search.trim().toLowerCase();
        result = result.filter(
          (p) =>
            p.purchase_id.toLowerCase().includes(q) ||
            (p.invoice_number && p.invoice_number.toLowerCase().includes(q))
        );
      }

      return { data: result, error: null };
    }

    return { data: [], error: null };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown network error';
    let local = getLocalCache();
    if (filters?.fromDate) local = local.filter((p) => p.date >= filters.fromDate!);
    if (filters?.toDate) local = local.filter((p) => p.date <= filters.toDate!);
    if (filters?.distributorId && filters.distributorId !== 'all') {
      local = local.filter((p) => p.distributor_id === filters.distributorId);
    }
    if (filters?.search) {
      const q = filters.search.trim().toLowerCase();
      local = local.filter(
        (p) =>
          p.purchase_id.toLowerCase().includes(q) ||
          (p.invoice_number && p.invoice_number.toLowerCase().includes(q))
      );
    }
    return { data: local, error: new Error(errorMsg) };
  }
}

/**
 * Fetch total count of purchases for selected filter dates
 */
export async function getPurchasesCount(fromDate?: string, toDate?: string, distributorId?: string): Promise<{
  count: number;
  error: Error | null;
}> {
  try {
    let query = supabase.from('purchases').select('*', { count: 'exact', head: true });

    if (fromDate) {
      query = query.gte('date', fromDate);
    }
    if (toDate) {
      query = query.lte('date', toDate);
    }
    if (distributorId && distributorId !== 'all') {
      query = query.eq('distributor_id', distributorId);
    }

    const { count, error } = await query;

    if (error || count === null) {
      let local = getLocalCache();
      if (fromDate) local = local.filter((p) => p.date >= fromDate);
      if (toDate) local = local.filter((p) => p.date <= toDate);
      if (distributorId && distributorId !== 'all') {
        local = local.filter((p) => p.distributor_id === distributorId);
      }
      return { count: local.length, error: error ? new Error(error.message) : null };
    }

    return { count, error: null };
  } catch {
    let local = getLocalCache();
    if (fromDate) local = local.filter((p) => p.date >= fromDate);
    if (toDate) local = local.filter((p) => p.date <= toDate);
    return { count: local.length, error: null };
  }
}

/**
 * Fetch complete purchase details including line items with product and variant details (Read-only)
 */
export async function getPurchaseDetails(purchaseIdOrNumber: string): Promise<{
  data: Purchase | null;
  error: Error | null;
}> {
  try {
    // 1. Fetch purchase header
    let query = supabase
      .from('purchases')
      .select(`
        *,
        distributor:distributor_id(
          id,
          distributor_id,
          name,
          company,
          mobile,
          email,
          balance
        )
      `);

    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      purchaseIdOrNumber
    );

    if (isUUID) {
      query = query.eq('id', purchaseIdOrNumber);
    } else {
      query = query.eq('purchase_id', purchaseIdOrNumber);
    }

    const { data: purchaseData, error: purchaseError } = await query.maybeSingle();

    if (purchaseError || !purchaseData) {
      // Check local cache
      const local = getLocalCache();
      const found = local.find(
        (p) => p.id === purchaseIdOrNumber || p.purchase_id === purchaseIdOrNumber
      );
      if (found) {
        return { data: found, error: null };
      }
      return {
        data: null,
        error: purchaseError ? new Error(purchaseError.message) : new Error('Purchase not found'),
      };
    }

    const row = purchaseData as any;
    const purchaseId = row.id;

    // 2. Fetch purchase_items joined with product and product_variant
    const { data: itemsData, error: itemsError } = await supabase
      .from('purchase_items')
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
      .eq('purchase_id', purchaseId)
      .order('created_at', { ascending: true });

    if (itemsError) {
      console.warn('Failed to load purchase items from Supabase:', itemsError.message);
    }

    const items: PurchaseItem[] = ((itemsData as any[]) || []).map((it) => ({
      id: it.id,
      purchase_id: it.purchase_id,
      product_id: it.product_id,
      product_variant_id: it.product_variant_id,
      mrp: Number(it.mrp || 0),
      p_p: Number(it.p_p || 0),
      qty: Number(it.qty || 0),
      created_at: it.created_at,
      product_name: it.product?.name || 'Unknown Product',
      product_prod_id: it.product?.prod_id || '',
      variant_barcode: it.product_variant?.barcode || '—',
      variant_size: it.product_variant?.size?.value || '—',
      variant_color: it.product_variant?.product_color?.color?.name || '—',
      subtotal: Number(it.p_p || 0) * Number(it.qty || 0),
    }));

    const result: Purchase = {
      id: row.id,
      purchase_id: row.purchase_id,
      distributor_id: row.distributor_id,
      total_amount: Number(row.total_amount || 0),
      invoice_number: row.invoice_number || null,
      date: row.date,
      created_at: row.created_at,
      updated_at: row.updated_at,
      distributor_name: row.distributor?.name,
      distributor_code: row.distributor?.distributor_id,
      distributor_company: row.distributor?.company,
      distributor_mobile: row.distributor?.mobile,
      distributor_email: row.distributor?.email,
      distributor_balance: Number(row.distributor?.balance || 0),
      items,
    };

    return { data: result, error: null };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to retrieve purchase details';
    return { data: null, error: new Error(errorMsg) };
  }
}

/**
 * Create a new purchase invoice, insert purchase items,
 * and update product_variants.quantity = product_variants.quantity + qty in Supabase
 */
export async function createPurchase(input: CreatePurchaseInput): Promise<{
  data: Purchase | null;
  error: Error | null;
}> {
  const purchasePayload = {
    purchase_id: input.purchase_id.trim(),
    distributor_id: input.distributor_id,
    invoice_number: input.invoice_number?.trim() || null,
    total_amount: Number(input.total_amount || 0),
    date: input.date || new Date().toISOString().split('T')[0],
  };

  try {
    // 1. Insert header into purchases table
    const { data: createdPurchase, error: purchaseErr } = await supabase
      .from('purchases')
      .insert([purchasePayload])
      .select(`
        *,
        distributor:distributor_id(
          id,
          distributor_id,
          name,
          company,
          mobile,
          email,
          balance
        )
      `)
      .single();

    if (purchaseErr) {
      console.warn('Supabase purchase insert failed, falling back to local cache:', purchaseErr.message);
      // Fallback local save
      const fallbackId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `mock-purch-${Date.now()}`;
      const fallbackItems: PurchaseItem[] = input.items.map((it) => ({
        id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `mock-item-${Date.now()}-${Math.random()}`,
        purchase_id: fallbackId,
        product_id: it.product_id,
        product_variant_id: it.product_variant_id,
        mrp: Number(it.mrp),
        p_p: Number(it.p_p),
        qty: Number(it.qty),
        product_name: it.product_name,
        product_prod_id: it.product_prod_id,
        variant_barcode: it.variant_barcode,
        variant_size: it.variant_size,
        variant_color: it.variant_color,
        subtotal: Number(it.p_p) * Number(it.qty),
      }));

      const newPurchase: Purchase = {
        id: fallbackId,
        purchase_id: purchasePayload.purchase_id,
        distributor_id: purchasePayload.distributor_id,
        total_amount: purchasePayload.total_amount,
        invoice_number: purchasePayload.invoice_number,
        date: purchasePayload.date,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        items: fallbackItems,
      };

      const localPurchases = getLocalCache();
      setLocalCache([newPurchase, ...localPurchases]);

      // Update local product variants cache quantities
      if (typeof window !== 'undefined') {
        try {
          const rawVar = localStorage.getItem(VARIANTS_CACHE_KEY);
          if (rawVar) {
            const variants = JSON.parse(rawVar);
            const updated = variants.map((v: any) => {
              const matchedItem = input.items.find((it) => it.product_variant_id === v.id);
              if (matchedItem) {
                return { ...v, quantity: Number(v.quantity || 0) + Number(matchedItem.qty) };
              }
              return v;
            });
            localStorage.setItem(VARIANTS_CACHE_KEY, JSON.stringify(updated));
          }
        } catch {
          // ignore
        }
      }

      return { data: newPurchase, error: null };
    }

    const purchaseRow = createdPurchase as any;
    const purchaseUuid = purchaseRow.id;

    // 2. Insert items into purchase_items table
    if (input.items && input.items.length > 0) {
      const itemsPayload = input.items.map((it) => ({
        purchase_id: purchaseUuid,
        product_id: it.product_id,
        product_variant_id: it.product_variant_id,
        mrp: Number(it.mrp),
        p_p: Number(it.p_p),
        qty: Number(it.qty),
      }));

      const { error: itemsErr } = await supabase
        .from('purchase_items')
        .insert(itemsPayload);

      if (itemsErr) {
        console.error('Error inserting purchase items:', itemsErr.message);
      }

      // 3. Update in supabase tables: Update product_variants.quantity = product_variants.quantity + qty
      for (const item of input.items) {
        try {
          // Fetch current variant quantity
          const { data: variantData } = await supabase
            .from('product_variants')
            .select('id, quantity, mrp, p_p')
            .eq('id', item.product_variant_id)
            .single();

          if (variantData) {
            const currentQty = Number(variantData.quantity || 0);
            const newQty = currentQty + Number(item.qty);

            // Update quantity, and update p_p / mrp if provided
            await supabase
              .from('product_variants')
              .update({
                quantity: newQty,
                p_p: Number(item.p_p),
                mrp: Number(item.mrp),
                updated_at: new Date().toISOString(),
              })
              .eq('id', item.product_variant_id);
          }
        } catch (variantUpdateErr) {
          console.error(`Failed to update quantity for variant ${item.product_variant_id}:`, variantUpdateErr);
        }
      }
    }

    // 4. Update local cache
    const formattedItems: PurchaseItem[] = input.items.map((it) => ({
      id: `${purchaseUuid}-${it.product_variant_id}`,
      purchase_id: purchaseUuid,
      product_id: it.product_id,
      product_variant_id: it.product_variant_id,
      mrp: Number(it.mrp),
      p_p: Number(it.p_p),
      qty: Number(it.qty),
      product_name: it.product_name,
      product_prod_id: it.product_prod_id,
      variant_barcode: it.variant_barcode,
      variant_size: it.variant_size,
      variant_color: it.variant_color,
      subtotal: Number(it.p_p) * Number(it.qty),
    }));

    const formattedPurchase: Purchase = {
      id: purchaseRow.id,
      purchase_id: purchaseRow.purchase_id,
      distributor_id: purchaseRow.distributor_id,
      total_amount: Number(purchaseRow.total_amount || 0),
      invoice_number: purchaseRow.invoice_number || null,
      date: purchaseRow.date,
      created_at: purchaseRow.created_at,
      updated_at: purchaseRow.updated_at,
      distributor_name: purchaseRow.distributor?.name,
      distributor_code: purchaseRow.distributor?.distributor_id,
      distributor_company: purchaseRow.distributor?.company,
      distributor_mobile: purchaseRow.distributor?.mobile,
      distributor_email: purchaseRow.distributor?.email,
      distributor_balance: Number(purchaseRow.distributor?.balance || 0),
      items: formattedItems,
    };

    const localList = getLocalCache();
    setLocalCache([formattedPurchase, ...localList.filter((p) => p.id !== formattedPurchase.id)]);

    return { data: formattedPurchase, error: null };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to create purchase';
    return { data: null, error: new Error(errorMsg) };
  }
}
