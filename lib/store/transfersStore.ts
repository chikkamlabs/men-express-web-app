import { supabase } from '@/lib/supabase';

export interface StoreTransferItem {
  id: string;
  store_transfer_id: string;
  product_id?: string | null;
  product_variant_id: string;
  qty: number;
  accepted_qty: number;
  created_at?: string;
  // Augmented details
  product_name?: string;
  prod_id?: string;
  category_name?: string;
  fit?: string | null;
  fabric?: string | null;
  barcode?: string;
  size?: string;
  color?: string;
  color_code?: string;
  mrp?: number;
  s_p?: number;
}

export interface StoreTransfer {
  id: string;
  transfer_id: string;
  from_store_id: string;
  to_store_id: string;
  date: string;
  status: 'pending' | 'accepted' | 'rejected';
  notes: string | null;
  staff_id: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  created_at: string;
  updated_at?: string;
  // Joined store & staff details
  from_store?: {
    id: string;
    name: string;
    store_id: string;
    address?: string | null;
    mobile?: string | null;
  } | null;
  to_store?: {
    id: string;
    name: string;
    store_id: string;
    address?: string | null;
    mobile?: string | null;
  } | null;
  staff?: {
    id: string;
    name: string;
    mobile?: string | null;
  } | null;
  items?: StoreTransferItem[];
  // Relative to current store
  direction?: 'in' | 'out';
}

export interface StoreTransferFilters {
  storeId: string;
  direction?: 'all' | 'in' | 'out';
  fromDate?: string;
  toDate?: string;
  searchTransferId?: string;
}

export interface StoreTransfersResult {
  transfers: StoreTransfer[];
  inCount: number;
  outCount: number;
  totalCount: number;
  error: Error | null;
}

export interface AvailableStoreProductItem {
  store_product_id: string;
  store_id: string;
  product_id: string;
  product_variant_id: string;
  available_qty: number;
  barcode: string;
  product_name: string;
  prod_id: string;
  category_name: string;
  fit?: string | null;
  fabric?: string | null;
  size: string;
  color: string;
  color_code?: string;
  mrp: number;
  s_p: number;
}

const LOCAL_STORAGE_KEY = 'menexpress_store_transfers_cache';

function getLocalCache(): StoreTransfer[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalCache(transfers: StoreTransfer[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(transfers));
  } catch {
    // Ignore storage write error
  }
}

/**
 * Auto-generate transfer_id formula: transfer_(5 random digit number)
 * Example: transfer_74921
 */
export function generateRandomTransferId(): string {
  const digits = Math.floor(10000 + Math.random() * 90000);
  return `transfer_${digits}`;
}

/**
 * Fetch staff members for a store
 */
export async function getStoreStaffMembers(
  storeId: string
): Promise<{ id: string; name: string; mobile?: string | null }[]> {
  try {
    const { data } = await supabase
      .from('staff')
      .select('id, name, mobile')
      .eq('store_id', storeId)
      .eq('status', 'active');
    return (data || []) as any[];
  } catch {
    return [];
  }
}

/**
 * Fetch destination stores excluding current store
 */
export async function getDestinationStores(
  currentStoreId: string
): Promise<{ id: string; name: string; store_id: string }[]> {
  try {
    const { data } = await supabase
      .from('stores')
      .select('id, name, store_id')
      .neq('id', currentStoreId);
    return (data || []) as any[];
  } catch {
    return [];
  }
}

/**
 * Fetch list of available inventory in the current store with quantity > 0
 */
export async function getAvailableStoreInventory(
  storeId: string
): Promise<{ items: AvailableStoreProductItem[]; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('store_products')
      .select(`
        id,
        store_id,
        product_id,
        product_variant,
        quantity,
        barcode,
        product:product_id (
          id,
          prod_id,
          name,
          fit,
          fabric,
          category:category_id (name)
        ),
        variant:product_variant (
          id,
          barcode,
          mrp,
          s_p,
          size:size_id (value),
          product_color:product_color_id (
            color:color_id (name, code)
          )
        )
      `)
      .eq('store_id', storeId)
      .gt('quantity', 0)
      .order('quantity', { ascending: false });

    if (error) {
      console.warn('Error fetching available store products:', error);
      return { items: [], error: new Error(error.message) };
    }

    const items: AvailableStoreProductItem[] = (data || []).map((row: any) => {
      const p = Array.isArray(row.product) ? row.product[0] : row.product;
      const v = Array.isArray(row.variant) ? row.variant[0] : row.variant;
      const cat = p?.category ? (Array.isArray(p.category) ? p.category[0] : p.category) : null;
      const sz = v?.size ? (Array.isArray(v.size) ? v.size[0] : v.size) : null;
      const pc = v?.product_color ? (Array.isArray(v.product_color) ? v.product_color[0] : v.product_color) : null;
      const clr = pc?.color ? (Array.isArray(pc.color) ? pc.color[0] : pc.color) : null;

      return {
        store_product_id: row.id,
        store_id: row.store_id,
        product_id: row.product_id,
        product_variant_id: row.product_variant,
        available_qty: Number(row.quantity || 0),
        barcode: row.barcode || v?.barcode || '',
        product_name: p?.name || 'Product',
        prod_id: p?.prod_id || '',
        category_name: cat?.name || 'General',
        fit: p?.fit,
        fabric: p?.fabric,
        size: sz?.value || '—',
        color: clr?.name || '—',
        color_code: clr?.code,
        mrp: Number(v?.mrp || 0),
        s_p: Number(v?.s_p || 0),
      };
    });

    return { items, error: null };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Error fetching inventory';
    return { items: [], error: new Error(errorMsg) };
  }
}

/**
 * Fetch Store Transfers:
 * - Either from_store_id = storeId OR to_store_id = storeId
 * - Filtered by dates (date >= fromDate AND date <= toDate)
 * - Filtered by direction (all, in, out)
 * - Filtered by search transfer_id
 * - Calculates In and Out counts as per the filtered dates
 */
export async function getStoreTransfers(
  options: StoreTransferFilters
): Promise<StoreTransfersResult> {
  const { storeId, direction = 'all', fromDate, toDate, searchTransferId } = options;

  try {
    let query = supabase
      .from('store_transfers')
      .select(`
        id,
        transfer_id,
        from_store_id,
        to_store_id,
        date,
        status,
        notes,
        staff_id,
        resolved_at,
        resolved_by,
        created_at,
        updated_at,
        from_store:from_store_id (
          id,
          name,
          store_id,
          address,
          mobile
        ),
        to_store:to_store_id (
          id,
          name,
          store_id,
          address,
          mobile
        ),
        staff:staff_id (
          id,
          name,
          mobile
        )
      `)
      .or(`from_store_id.eq.${storeId},to_store_id.eq.${storeId}`)
      .order('created_at', { ascending: false });

    if (fromDate) {
      query = query.gte('date', fromDate);
    }
    if (toDate) {
      query = query.lte('date', toDate);
    }
    if (searchTransferId && searchTransferId.trim()) {
      query = query.ilike('transfer_id', `%${searchTransferId.trim()}%`);
    }

    const { data, error } = await query;

    if (error) {
      console.warn('getStoreTransfers error, fallback to cache:', error);
      return getFilteredLocalTransfers(options);
    }

    const allRecords: StoreTransfer[] = (data || []).map((row: any) => {
      const fromStore = Array.isArray(row.from_store) ? row.from_store[0] : row.from_store;
      const toStore = Array.isArray(row.to_store) ? row.to_store[0] : row.to_store;
      const staffObj = Array.isArray(row.staff) ? row.staff[0] : row.staff;
      const isOut = row.from_store_id === storeId;

      return {
        id: row.id,
        transfer_id: row.transfer_id,
        from_store_id: row.from_store_id,
        to_store_id: row.to_store_id,
        date: row.date || (row.created_at ? row.created_at.split('T')[0] : ''),
        status: (row.status as 'pending' | 'accepted' | 'rejected') || 'pending',
        notes: row.notes,
        staff_id: row.staff_id,
        resolved_at: row.resolved_at,
        resolved_by: row.resolved_by,
        created_at: row.created_at,
        updated_at: row.updated_at,
        from_store: fromStore || null,
        to_store: toStore || null,
        staff: staffObj || null,
        direction: isOut ? 'out' : 'in',
      };
    });

    // Counts as per filtered dates:
    // Out: from_store is this store
    // In: to_store is this store
    const outCount = allRecords.filter((t) => t.from_store_id === storeId).length;
    const inCount = allRecords.filter((t) => t.to_store_id === storeId).length;
    const totalCount = allRecords.length;

    // Apply direction filter to the displayed list
    let displayedTransfers = allRecords;
    if (direction === 'out') {
      displayedTransfers = allRecords.filter((t) => t.from_store_id === storeId);
    } else if (direction === 'in') {
      displayedTransfers = allRecords.filter((t) => t.to_store_id === storeId);
    }

    return {
      transfers: displayedTransfers,
      inCount,
      outCount,
      totalCount,
      error: null,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Error fetching transfers';
    return getFilteredLocalTransfers(options, new Error(errorMsg));
  }
}

function getFilteredLocalTransfers(
  options: StoreTransferFilters,
  err: Error | null = null
): StoreTransfersResult {
  const cached = getLocalCache();
  const { storeId, direction = 'all', fromDate, toDate, searchTransferId } = options;

  let relevant = cached.filter(
    (t) => t.from_store_id === storeId || t.to_store_id === storeId
  );

  if (fromDate) {
    relevant = relevant.filter((t) => (t.date || '').localeCompare(fromDate) >= 0);
  }
  if (toDate) {
    relevant = relevant.filter((t) => (t.date || '').localeCompare(toDate) <= 0);
  }
  if (searchTransferId && searchTransferId.trim()) {
    const q = searchTransferId.trim().toLowerCase();
    relevant = relevant.filter((t) =>
      String(t.transfer_id || '').toLowerCase().includes(q)
    );
  }

  const outCount = relevant.filter((t) => t.from_store_id === storeId).length;
  const inCount = relevant.filter((t) => t.to_store_id === storeId).length;
  const totalCount = relevant.length;

  let displayed = relevant.map((t) => ({
    ...t,
    direction: (t.from_store_id === storeId ? 'out' : 'in') as 'out' | 'in',
  }));

  if (direction === 'out') {
    displayed = displayed.filter((t) => t.from_store_id === storeId);
  } else if (direction === 'in') {
    displayed = displayed.filter((t) => t.to_store_id === storeId);
  }

  return {
    transfers: displayed,
    inCount,
    outCount,
    totalCount,
    error: err,
  };
}

/**
 * Fetch a single Store Transfer by UUID or transfer_id with full items
 */
export async function getStoreTransferById(
  idOrTransferId: string,
  currentStoreId?: string
): Promise<{ transfer: StoreTransfer | null; error: Error | null }> {
  if (!idOrTransferId) {
    return { transfer: null, error: new Error('Transfer ID is required') };
  }

  try {
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        idOrTransferId
      );

    let query = supabase.from('store_transfers').select(`
      id,
      transfer_id,
      from_store_id,
      to_store_id,
      date,
      status,
      notes,
      staff_id,
      resolved_at,
      resolved_by,
      created_at,
      updated_at,
      from_store:from_store_id (
        id,
        name,
        store_id,
        address,
        mobile
      ),
      to_store:to_store_id (
        id,
        name,
        store_id,
        address,
        mobile
      ),
      staff:staff_id (
        id,
        name,
        mobile
      )
    `);

    if (isUuid) {
      query = query.eq('id', idOrTransferId);
    } else {
      query = query.eq('transfer_id', idOrTransferId);
    }

    const { data: transferData, error: transferError } = await query.maybeSingle();

    if (transferError || !transferData) {
      console.warn('Transfer not found in Supabase, trying cache:', transferError);
      return getTransferFromLocalCache(idOrTransferId, currentStoreId);
    }

    const transferUuid = transferData.id;

    // Fetch line items including product and variant details
    const { data: itemsData, error: itemsError } = await supabase
      .from('store_transfer_items')
      .select(`
        id,
        store_transfer_id,
        product_id,
        product_variant_id,
        qty,
        accepted_qty,
        created_at,
        product:product_id (
          id,
          prod_id,
          name,
          fit,
          fabric,
          category:category_id (name)
        ),
        variant:product_variant_id (
          id,
          barcode,
          mrp,
          s_p,
          size:size_id (value),
          product_color:product_color_id (
            color:color_id (name, code)
          )
        )
      `)
      .eq('store_transfer_id', transferUuid);

    if (itemsError) {
      console.warn('Error fetching transfer items:', itemsError);
    }

    const formattedItems: StoreTransferItem[] = (itemsData || []).map((it: any) => {
      const p = Array.isArray(it.product) ? it.product[0] : it.product;
      const v = Array.isArray(it.variant) ? it.variant[0] : it.variant;
      const cat = p?.category ? (Array.isArray(p.category) ? p.category[0] : p.category) : null;
      const sz = v?.size ? (Array.isArray(v.size) ? v.size[0] : v.size) : null;
      const pc = v?.product_color ? (Array.isArray(v.product_color) ? v.product_color[0] : v.product_color) : null;
      const clr = pc?.color ? (Array.isArray(pc.color) ? pc.color[0] : pc.color) : null;

      return {
        id: it.id,
        store_transfer_id: it.store_transfer_id,
        product_id: it.product_id,
        product_variant_id: it.product_variant_id,
        qty: Number(it.qty || 1),
        accepted_qty: Number(it.accepted_qty || 0),
        created_at: it.created_at,
        product_name: p?.name || 'Product',
        prod_id: p?.prod_id || '',
        category_name: cat?.name || 'General',
        fit: p?.fit,
        fabric: p?.fabric,
        barcode: v?.barcode || '',
        size: sz?.value || '—',
        color: clr?.name || '—',
        color_code: clr?.code,
        mrp: Number(v?.mrp || 0),
        s_p: Number(v?.s_p || 0),
      };
    });

    const rawT = transferData as any;
    const fromStore = Array.isArray(rawT.from_store) ? rawT.from_store[0] : rawT.from_store;
    const toStore = Array.isArray(rawT.to_store) ? rawT.to_store[0] : rawT.to_store;
    const staffObj = Array.isArray(rawT.staff) ? rawT.staff[0] : rawT.staff;

    const fullTransfer: StoreTransfer = {
      id: rawT.id,
      transfer_id: rawT.transfer_id,
      from_store_id: rawT.from_store_id,
      to_store_id: rawT.to_store_id,
      date: rawT.date || (rawT.created_at ? rawT.created_at.split('T')[0] : ''),
      status: (rawT.status as 'pending' | 'accepted' | 'rejected') || 'pending',
      notes: rawT.notes,
      staff_id: rawT.staff_id,
      resolved_at: rawT.resolved_at,
      resolved_by: rawT.resolved_by,
      created_at: rawT.created_at,
      updated_at: rawT.updated_at,
      from_store: fromStore || null,
      to_store: toStore || null,
      staff: staffObj || null,
      items: formattedItems,
      direction: currentStoreId
        ? (rawT.from_store_id === currentStoreId ? 'out' : 'in')
        : undefined,
    };

    return { transfer: fullTransfer, error: null };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Error fetching transfer';
    return getTransferFromLocalCache(idOrTransferId, currentStoreId, new Error(errorMsg));
  }
}

function getTransferFromLocalCache(
  idOrTransferId: string,
  currentStoreId?: string,
  err: Error | null = null
): { transfer: StoreTransfer | null; error: Error | null } {
  const cached = getLocalCache();
  const found = cached.find(
    (t) => t.id === idOrTransferId || t.transfer_id === idOrTransferId
  );
  if (!found) {
    return { transfer: null, error: err || new Error('Transfer not found') };
  }

  const direction = currentStoreId
    ? (found.from_store_id === currentStoreId ? 'out' : 'in')
    : undefined;

  return { transfer: { ...found, direction }, error: null };
}

export interface CreateStoreTransferInput {
  from_store_id: string;
  to_store_id: string;
  transfer_id?: string;
  date: string;
  notes?: string | null;
  staff_id?: string | null;
  items: {
    product_id: string;
    product_variant_id: string;
    qty: number;
    barcode?: string;
    product_name?: string;
    prod_id?: string;
    size?: string;
    color?: string;
  }[];
}

/**
 * Create a new Store Transfer:
 * 1. Checks that from_store != to_store
 * 2. Checks each item qty <= available store_products stock
 * 3. Inserts into store_transfers (status: 'pending')
 * 4. Inserts into store_transfer_items (with product_id, product_variant_id, qty)
 * 5. Deducts quantity from from_store's store_products inventory
 */
export async function createStoreTransfer(
  input: CreateStoreTransferInput
): Promise<{ success: boolean; transferId: string; error: Error | null }> {
  const autoTransferId = input.transfer_id || generateRandomTransferId();

  if (input.from_store_id === input.to_store_id) {
    return {
      success: false,
      transferId: autoTransferId,
      error: new Error('Destination store must be different from sending store.'),
    };
  }

  if (!input.items || input.items.length === 0) {
    return {
      success: false,
      transferId: autoTransferId,
      error: new Error('Please add at least one product to transfer.'),
    };
  }

  try {
    // 1. Verify available quantity for each item
    for (const item of input.items) {
      const { data: spItem } = await supabase
        .from('store_products')
        .select('id, quantity')
        .eq('store_id', input.from_store_id)
        .eq('product_variant', item.product_variant_id)
        .maybeSingle();

      const availableQty = Number(spItem?.quantity || 0);
      if (item.qty > availableQty) {
        return {
          success: false,
          transferId: autoTransferId,
          error: new Error(
            `Insufficient stock for ${item.product_name || 'item'}. Available: ${availableQty}, Requested: ${item.qty}`
          ),
        };
      }
    }

    // 2. Insert into store_transfers
    const transferPayload: Record<string, any> = {
      transfer_id: autoTransferId,
      from_store_id: input.from_store_id,
      to_store_id: input.to_store_id,
      date: input.date || new Date().toISOString().split('T')[0],
      status: 'pending',
      notes: input.notes?.trim() || null,
      staff_id: input.staff_id || null,
    };

    const { data: transferData, error: transferErr } = await supabase
      .from('store_transfers')
      .insert([transferPayload])
      .select('id, transfer_id')
      .single();

    if (transferErr || !transferData?.id) {
      console.error('STORE_TRANSFERS INSERT FAILED:', transferErr);
      return {
        success: false,
        transferId: autoTransferId,
        error: new Error(transferErr?.message || 'Failed to create transfer record.'),
      };
    }

    const transferUuid = transferData.id;

    // 3. Insert items into store_transfer_items
    const itemsPayload = input.items.map((it) => ({
      store_transfer_id: transferUuid,
      product_id: it.product_id,
      product_variant_id: it.product_variant_id,
      qty: Number(it.qty),
      accepted_qty: 0,
    }));

    const { error: itemsErr } = await supabase
      .from('store_transfer_items')
      .insert(itemsPayload);

    if (itemsErr) {
      console.error('STORE_TRANSFER_ITEMS INSERT FAILED:', itemsErr);
      return {
        success: false,
        transferId: autoTransferId,
        error: new Error(`Failed to insert transfer items: ${itemsErr.message}`),
      };
    }

    // 4. Deduct transferred stock from origin store_products
    for (const item of input.items) {
      try {
        const { data: spItem } = await supabase
          .from('store_products')
          .select('id, quantity')
          .eq('store_id', input.from_store_id)
          .eq('product_variant', item.product_variant_id)
          .maybeSingle();

        if (spItem) {
          const currentQty = Number(spItem.quantity || 0);
          const newQty = Math.max(0, currentQty - Number(item.qty));
          await supabase
            .from('store_products')
            .update({ quantity: newQty, updated_at: new Date().toISOString() })
            .eq('id', spItem.id);
        }
      } catch (deductErr) {
        console.warn('Error deducting transfer stock:', deductErr);
      }
    }

    // Also update local cache for smooth fallback
    const cachedList = getLocalCache();
    const newRecord: StoreTransfer = {
      id: transferUuid,
      transfer_id: autoTransferId,
      from_store_id: input.from_store_id,
      to_store_id: input.to_store_id,
      date: input.date,
      status: 'pending',
      notes: input.notes || null,
      staff_id: input.staff_id || null,
      resolved_at: null,
      resolved_by: null,
      created_at: new Date().toISOString(),
      items: input.items.map((it, idx) => ({
        id: `item-${idx}`,
        store_transfer_id: transferUuid,
        product_id: it.product_id,
        product_variant_id: it.product_variant_id,
        qty: it.qty,
        accepted_qty: 0,
        product_name: it.product_name,
        prod_id: it.prod_id,
        size: it.size,
        color: it.color,
        barcode: it.barcode,
      })),
    };
    saveLocalCache([newRecord, ...cachedList]);

    return {
      success: true,
      transferId: autoTransferId,
      error: null,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Error creating transfer';
    return {
      success: false,
      transferId: autoTransferId,
      error: new Error(errorMsg),
    };
  }
}

/**
 * Update an existing pending transfer (If from_store is this store, allow updating until status is pending)
 */
export async function updateStoreTransfer(
  transferUuid: string,
  currentStoreId: string,
  input: {
    to_store_id: string;
    notes?: string | null;
    staff_id?: string | null;
    date?: string;
    items: {
      product_id: string;
      product_variant_id: string;
      qty: number;
      barcode?: string;
      product_name?: string;
      prod_id?: string;
      size?: string;
      color?: string;
    }[];
  }
): Promise<{ success: boolean; error: Error | null }> {
  try {
    // 1. Fetch current transfer to verify ownership and pending status
    const { data: existing, error: fetchErr } = await supabase
      .from('store_transfers')
      .select('id, from_store_id, to_store_id, status')
      .eq('id', transferUuid)
      .single();

    if (fetchErr || !existing) {
      return { success: false, error: new Error('Transfer record not found') };
    }

    if (existing.from_store_id !== currentStoreId) {
      return {
        success: false,
        error: new Error('Only the origin store can edit this transfer.'),
      };
    }

    if (existing.status !== 'pending') {
      return {
        success: false,
        error: new Error(`Cannot edit transfer with status "${existing.status}".`),
      };
    }

    // 2. Fetch existing items to restore origin store inventory before applying new items
    const { data: oldItems } = await supabase
      .from('store_transfer_items')
      .select('product_variant_id, qty')
      .eq('store_transfer_id', transferUuid);

    if (oldItems && oldItems.length > 0) {
      for (const oldIt of oldItems) {
        const { data: spItem } = await supabase
          .from('store_products')
          .select('id, quantity')
          .eq('store_id', currentStoreId)
          .eq('product_variant', oldIt.product_variant_id)
          .maybeSingle();

        if (spItem) {
          await supabase
            .from('store_products')
            .update({
              quantity: Number(spItem.quantity || 0) + Number(oldIt.qty || 0),
              updated_at: new Date().toISOString(),
            })
            .eq('id', spItem.id);
        }
      }
    }

    // 3. Verify stock for new items and delete old line items
    for (const item of input.items) {
      const { data: spItem } = await supabase
        .from('store_products')
        .select('id, quantity')
        .eq('store_id', currentStoreId)
        .eq('product_variant', item.product_variant_id)
        .maybeSingle();

      const available = Number(spItem?.quantity || 0);
      if (item.qty > available) {
        return {
          success: false,
          error: new Error(
            `Insufficient stock for ${item.product_name || 'item'}. Available: ${available}, Requested: ${item.qty}`
          ),
        };
      }
    }

    // Delete old items
    await supabase
      .from('store_transfer_items')
      .delete()
      .eq('store_transfer_id', transferUuid);

    // Insert new items
    const itemsPayload = input.items.map((it) => ({
      store_transfer_id: transferUuid,
      product_id: it.product_id,
      product_variant_id: it.product_variant_id,
      qty: Number(it.qty),
      accepted_qty: 0,
    }));

    await supabase.from('store_transfer_items').insert(itemsPayload);

    // Deduct stock for new items
    for (const item of input.items) {
      const { data: spItem } = await supabase
        .from('store_products')
        .select('id, quantity')
        .eq('store_id', currentStoreId)
        .eq('product_variant', item.product_variant_id)
        .maybeSingle();

      if (spItem) {
        const updatedQty = Math.max(0, Number(spItem.quantity || 0) - Number(item.qty));
        await supabase
          .from('store_products')
          .update({
            quantity: updatedQty,
            updated_at: new Date().toISOString(),
          })
          .eq('id', spItem.id);
      }
    }

    // 4. Update store_transfers header
    const updatePayload: Record<string, any> = {
      to_store_id: input.to_store_id,
      notes: input.notes?.trim() || null,
      staff_id: input.staff_id || null,
      updated_at: new Date().toISOString(),
    };
    if (input.date) {
      updatePayload.date = input.date;
    }

    const { error: updateErr } = await supabase
      .from('store_transfers')
      .update(updatePayload)
      .eq('id', transferUuid);

    if (updateErr) {
      return { success: false, error: new Error(updateErr.message) };
    }

    return { success: true, error: null };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Error updating transfer';
    return { success: false, error: new Error(errorMsg) };
  }
}

/**
 * Resolve transfer status (Allow to change the status only if to_store is this store)
 * - 'accepted': Adds stock to destination store's store_products, sets accepted_qty = qty
 * - 'rejected': Returns stock back to origin store's store_products
 */
export async function resolveStoreTransfer(
  transferUuid: string,
  newStatus: 'accepted' | 'rejected',
  currentStoreId: string
): Promise<{ success: boolean; error: Error | null }> {
  try {
    const { data: transfer, error: transferErr } = await supabase
      .from('store_transfers')
      .select(`
        id,
        transfer_id,
        from_store_id,
        to_store_id,
        status
      `)
      .eq('id', transferUuid)
      .single();

    if (transferErr || !transfer) {
      return { success: false, error: new Error('Transfer record not found.') };
    }

    if (transfer.to_store_id !== currentStoreId) {
      return {
        success: false,
        error: new Error('Only the receiving store can accept or reject this transfer.'),
      };
    }

    if (transfer.status !== 'pending') {
      return {
        success: false,
        error: new Error(`Transfer has already been ${transfer.status}.`),
      };
    }

    // Fetch line items
    const { data: items, error: itemsErr } = await supabase
      .from('store_transfer_items')
      .select(`
        id,
        product_id,
        product_variant_id,
        qty,
        variant:product_variant_id (
          barcode
        )
      `)
      .eq('store_transfer_id', transferUuid);

    if (itemsErr) {
      return { success: false, error: new Error(itemsErr.message) };
    }

    const nowIso = new Date().toISOString();

    if (newStatus === 'accepted') {
      // 1. Add stock to receiving store (to_store_id)
      for (const item of items || []) {
        const variantBarcode = (item.variant as any)?.barcode || '';
        const { data: existingSp } = await supabase
          .from('store_products')
          .select('id, quantity')
          .eq('store_id', transfer.to_store_id)
          .eq('product_variant', item.product_variant_id)
          .maybeSingle();

        if (existingSp) {
          await supabase
            .from('store_products')
            .update({
              quantity: Number(existingSp.quantity || 0) + Number(item.qty || 0),
              updated_at: nowIso,
            })
            .eq('id', existingSp.id);
        } else {
          await supabase.from('store_products').insert([
            {
              store_id: transfer.to_store_id,
              product_id: item.product_id,
              product_variant: item.product_variant_id,
              quantity: Number(item.qty || 0),
              barcode: variantBarcode,
            },
          ]);
        }

        // Set accepted_qty in store_transfer_items
        await supabase
          .from('store_transfer_items')
          .update({ accepted_qty: item.qty })
          .eq('id', item.id);
      }

      // Mark transfer as accepted
      await supabase
        .from('store_transfers')
        .update({
          status: 'accepted',
          resolved_at: nowIso,
          updated_at: nowIso,
        })
        .eq('id', transferUuid);
    } else if (newStatus === 'rejected') {
      // Return stock back to origin store (from_store_id)
      for (const item of items || []) {
        const { data: originSp } = await supabase
          .from('store_products')
          .select('id, quantity')
          .eq('store_id', transfer.from_store_id)
          .eq('product_variant', item.product_variant_id)
          .maybeSingle();

        if (originSp) {
          await supabase
            .from('store_products')
            .update({
              quantity: Number(originSp.quantity || 0) + Number(item.qty || 0),
              updated_at: nowIso,
            })
            .eq('id', originSp.id);
        }
      }

      // Mark transfer as rejected
      await supabase
        .from('store_transfers')
        .update({
          status: 'rejected',
          resolved_at: nowIso,
          updated_at: nowIso,
        })
        .eq('id', transferUuid);
    }

    return { success: true, error: null };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Error resolving transfer';
    return { success: false, error: new Error(errorMsg) };
  }
}
