import { supabase } from './supabase';

export interface ProductVariantOption {
  variant_id: string;
  barcode: string;
  size: string;
  color: string;
  color_code?: string;
  mrp: number;
  s_p: number;
  stock: number;
}

export interface BillProductSearchResult {
  product_id: string;
  prod_id: string;
  product_name: string;
  category_name?: string;
  variant_id: string;
  barcode: string;
  size: string;
  color: string;
  color_code?: string;
  mrp: number;
  s_p: number;
  stock: number;
  allVariants: ProductVariantOption[];
}

export interface SelectedBillItem {
  id: string; // unique client line id
  product_id: string;
  prod_id: string;
  product_name: string;
  variant_id: string;
  barcode: string;
  size: string;
  color: string;
  color_code?: string;
  mrp: number;
  s_p: number;
  quantity: number;
  row_total: number;
  allVariants: ProductVariantOption[];
}

export interface CustomerOption {
  id: string;
  name: string;
  mobile: string;
  points: number;
  email?: string | null;
}

export interface PaymentBreakdown {
  cash: number;
  upi: number;
  card: number;
}

export interface CreateBillInput {
  store_id: string;
  staff_id?: string | null;
  customer_id?: string | null;
  items: SelectedBillItem[];
  subtotal: number;
  discount: number;
  final_amount: number;
  status: 'draft' | 'success';
  payments: PaymentBreakdown;
}

export interface StoredBillRecord {
  id: string;
  bill_id: string;
  store_id: string;
  staff_id?: string | null;
  customer_id?: string | null;
  customer_name?: string;
  customer_mobile?: string;
  amount: number;
  discount: number;
  final_amount: number;
  status: 'draft' | 'success';
  date: string;
  created_at: string;
  items: SelectedBillItem[];
  payments: PaymentBreakdown;
}

const LOCAL_STORAGE_BILLS_KEY = 'menexpress_store_bills_pos_cache';
const LOCAL_STORAGE_CUSTOMERS_KEY = 'menexpress_pos_customers_cache';

/**
 * Generate unique bill_id formula: bill_(random 6 digits)
 * Example: bill_492018
 */
export function generateRandomBillId(): string {
  const digits = Math.floor(100000 + Math.random() * 900000);
  return `bill_${digits}`;
}

/**
 * Search store inventory for products and variants matching barcode, product_id, or name.
 */
export async function searchStoreInventory(
  queryText: string,
  storeId?: string
): Promise<BillProductSearchResult[]> {
  const q = queryText.trim().toLowerCase();
  if (!q) return [];

  try {
    // 1. Fetch store_products joined with product and variant details
    let query = supabase.from('store_products').select(`
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
    `);

    if (storeId && storeId !== 'all') {
      query = query.eq('store_id', storeId);
    }

    const { data, error } = await query;

    if (error || !data) {
      console.warn('Fallback: checking local cache or direct products table');
      return searchFallbackProducts(q);
    }

    const rows = data as any[];

    // Group variants by product
    const productVariantsMap = new Map<string, ProductVariantOption[]>();
    for (const row of rows) {
      const pid = row.product_id;
      const v = row.variant;
      if (!pid) continue;

      const opt: ProductVariantOption = {
        variant_id: row.product_variant,
        barcode: row.barcode || v?.barcode || '',
        size: v?.size?.value || '—',
        color: v?.product_color?.color?.name || '—',
        color_code: v?.product_color?.color?.code || undefined,
        mrp: Number(v?.mrp || 0),
        s_p: Number(v?.s_p || 0),
        stock: Number(row.quantity || 0),
      };

      if (!productVariantsMap.has(pid)) {
        productVariantsMap.set(pid, []);
      }
      productVariantsMap.get(pid)!.push(opt);
    }

    // Filter matching rows by barcode, product_name, or prod_id
    const results: BillProductSearchResult[] = [];
    const seenVariantKeys = new Set<string>();

    for (const row of rows) {
      const p = row.product;
      const v = row.variant;
      const barcode = String(row.barcode || v?.barcode || '').toLowerCase();
      const prodId = String(p?.prod_id || '').toLowerCase();
      const prodName = String(p?.name || '').toLowerCase();

      const isMatch =
        barcode === q ||
        barcode.includes(q) ||
        prodId === q ||
        prodId.includes(q) ||
        prodName.includes(q);

      if (isMatch) {
        const variantId = row.product_variant;
        const key = `${row.product_id}-${variantId}`;
        if (!seenVariantKeys.has(key)) {
          seenVariantKeys.add(key);

          const allVariants = productVariantsMap.get(row.product_id) || [];

          results.push({
            product_id: row.product_id,
            prod_id: p?.prod_id || 'prod_?',
            product_name: p?.name || 'Product',
            category_name: p?.category?.name || 'General',
            variant_id: variantId,
            barcode: row.barcode || v?.barcode || '',
            size: v?.size?.value || '—',
            color: v?.product_color?.color?.name || '—',
            color_code: v?.product_color?.color?.code || undefined,
            mrp: Number(v?.mrp || 0),
            s_p: Number(v?.s_p || 0),
            stock: Number(row.quantity || 0),
            allVariants,
          });
        }
      }
    }

    // If no direct store_products match, fallback to product_variants catalog
    if (results.length === 0) {
      return searchFallbackProducts(q);
    }

    return results;
  } catch (err) {
    console.warn('Error in searchStoreInventory:', err);
    return searchFallbackProducts(q);
  }
}

async function searchFallbackProducts(q: string): Promise<BillProductSearchResult[]> {
  try {
    const { data: variants } = await supabase
      .from('product_variants')
      .select(`
        id,
        barcode,
        mrp,
        s_p,
        quantity,
        product:product_id (
          id,
          prod_id,
          name,
          category:category_id (name)
        ),
        size:size_id (value),
        product_color:product_color_id (
          color:color_id (name, code)
        )
      `)
      .limit(30);

    if (!variants) return [];

    const matched: BillProductSearchResult[] = [];
    for (const v of variants as any[]) {
      const p = v.product;
      const barcode = String(v.barcode || '').toLowerCase();
      const prodId = String(p?.prod_id || '').toLowerCase();
      const name = String(p?.name || '').toLowerCase();

      if (barcode.includes(q) || prodId.includes(q) || name.includes(q)) {
        matched.push({
          product_id: p?.id || '',
          prod_id: p?.prod_id || 'prod_?',
          product_name: p?.name || 'Product',
          category_name: p?.category?.name || 'General',
          variant_id: v.id,
          barcode: v.barcode || '',
          size: v.size?.value || '—',
          color: v.product_color?.color?.name || '—',
          color_code: v.product_color?.color?.code || undefined,
          mrp: Number(v.mrp || 0),
          s_p: Number(v.s_p || 0),
          stock: Number(v.quantity || 0),
          allVariants: [
            {
              variant_id: v.id,
              barcode: v.barcode || '',
              size: v.size?.value || '—',
              color: v.product_color?.color?.name || '—',
              color_code: v.product_color?.color?.code || undefined,
              mrp: Number(v.mrp || 0),
              s_p: Number(v.s_p || 0),
              stock: Number(v.quantity || 0),
            },
          ],
        });
      }
    }
    return matched;
  } catch {
    return [];
  }
}

/**
 * Search customers by mobile or name
 */
export async function searchCustomers(queryText: string): Promise<CustomerOption[]> {
  const q = queryText.trim().toLowerCase();
  if (!q) return [];

  try {
    const { data, error } = await supabase
      .from('customers')
      .select('id, name, mobile, points, email')
      .or(`mobile.ilike.%${q}%,name.ilike.%${q}%`)
      .limit(10);

    if (error || !data) {
      const cached = getLocalCustomersCache();
      return cached.filter(
        (c) => c.mobile.toLowerCase().includes(q) || c.name.toLowerCase().includes(q)
      );
    }

    return (data as any[]).map((c) => ({
      id: c.id,
      name: c.name,
      mobile: c.mobile,
      points: Number(c.points || 0),
      email: c.email || null,
    }));
  } catch {
    const cached = getLocalCustomersCache();
    return cached.filter(
      (c) => c.mobile.toLowerCase().includes(q) || c.name.toLowerCase().includes(q)
    );
  }
}

/**
 * Quick add customer and return the newly created record
 */
export async function quickCreateCustomer(
  name: string,
  mobile: string,
  points: number = 0
): Promise<{ customer: CustomerOption | null; error: Error | null }> {
  const cleanName = name.trim() || 'Walk-in Customer';
  const cleanMobile = mobile.trim();

  if (!cleanMobile) {
    return { customer: null, error: new Error('Mobile number is required') };
  }

  try {
    const { data, error } = await supabase
      .from('customers')
      .insert({
        name: cleanName,
        mobile: cleanMobile,
        points: Number(points || 0),
      })
      .select('id, name, mobile, points, email')
      .single();

    if (error) {
      // If customer already exists with this mobile, fetch that record
      if (error.message.toLowerCase().includes('unique') || error.code === '23505') {
        const { data: existing } = await supabase
          .from('customers')
          .select('id, name, mobile, points, email')
          .eq('mobile', cleanMobile)
          .maybeSingle();

        if (existing) {
          const cust: CustomerOption = {
            id: existing.id,
            name: existing.name,
            mobile: existing.mobile,
            points: Number(existing.points || 0),
          };
          saveLocalCustomer(cust);
          return { customer: cust, error: null };
        }
      }

      console.warn('Supabase customer insert error, using local fallback:', error.message);
      const fallbackCust: CustomerOption = {
        id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `cust-${Date.now()}`,
        name: cleanName,
        mobile: cleanMobile,
        points: Number(points || 0),
      };
      saveLocalCustomer(fallbackCust);
      return { customer: fallbackCust, error: null };
    }

    const cust: CustomerOption = {
      id: data.id,
      name: data.name,
      mobile: data.mobile,
      points: Number(data.points || 0),
      email: data.email || null,
    };
    saveLocalCustomer(cust);
    return { customer: cust, error: null };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Error creating customer';
    const fallbackCust: CustomerOption = {
      id: `cust-${Date.now()}`,
      name: cleanName,
      mobile: cleanMobile,
      points: Number(points || 0),
    };
    saveLocalCustomer(fallbackCust);
    return { customer: fallbackCust, error: null };
  }
}

function getLocalCustomersCache(): CustomerOption[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_CUSTOMERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalCustomer(cust: CustomerOption) {
  if (typeof window === 'undefined') return;
  try {
    const list = getLocalCustomersCache();
    const updated = [cust, ...list.filter((c) => c.id !== cust.id && c.mobile !== cust.mobile)];
    localStorage.setItem(LOCAL_STORAGE_CUSTOMERS_KEY, JSON.stringify(updated));
  } catch {
    // Ignore
  }
}

/**
 * Main Save / Finalize Bill function:
 * Insertions:
 * 1. store_bills (with bill_id = bill_(random 6 digits), amount, discount, final_amount, status)
 * 2. bill_items (with bill_id, product_id, prod_variant, qty, s_p, mrp, row_total)
 * 3. bill_payments (with bill_id, payment_type = 'cash'|'upi'|'card', amount)
 * 4. If status='success', deduct quantities from store_products
 */
export async function saveStoreBill(input: CreateBillInput): Promise<{
  success: boolean;
  billId: string;
  billUuid?: string;
  error: Error | null;
}> {
  const generatedBillId = generateRandomBillId();
  const todayStr = new Date().toISOString().split('T')[0];

  try {
    const staffId = input.staff_id || null;

    // 2. Insert into store_bills
    const billPayload: Record<string, any> = {
      bill_id: generatedBillId,
      store_id: input.store_id,
      staff_id: staffId,
      customer_id: input.customer_id || null,
      amount: input.subtotal,
      discount: input.discount || 0,
      final_amount: input.final_amount,
      status: input.status, // 'draft' or 'success'
      date: todayStr,
    };

    if (staffId) {
      billPayload.staff_id = staffId;
    }

    const { data: billData, error: billErr } = await supabase
      .from('store_bills')
      .insert([billPayload])
      .select('id, bill_id')
      .single();

    if (billErr || !billData?.id) {
  console.error('STORE_BILLS INSERT FAILED:', billErr);

  return {
    success: false,
    billId: generatedBillId,
    error: new Error(
      billErr?.message || 'Bill was not created in the database.'
    ),
  };
}

const billUuid = billData.id;

    // 3. Insert line items into bill_items (includes product_id and prod_variant)
    if (input.items && input.items.length > 0) {
      const itemsPayload = input.items.map((it) => ({
        bill_id: billUuid,
        product_id: it.product_id || null,
        prod_variant: it.variant_id,
        qty: Number(it.quantity || 1),
        s_p: Number(it.s_p || 0),
        mrp: Number(it.mrp || it.s_p || 0),
        row_total: Number(it.row_total || 0),
      }));

      const { error: itemsErr } = await supabase
        .from('bill_items')
        .insert(itemsPayload);

      if (itemsErr) {
  console.error('BILL_ITEMS INSERT FAILED:', itemsErr);

  return {
    success: false,
    billId: generatedBillId,
    billUuid,
    error: new Error(
      `Failed to insert bill_items: ${itemsErr.message}`
    ),
  };
}
    }

    // 4. Insert into bill_payments (cash, upi, card)
    const paymentRows: { bill_id: string; payment_type: 'cash' | 'upi' | 'card'; amount: number }[] = [];
    if (input.payments.cash > 0) {
      paymentRows.push({
        bill_id: billUuid,
        payment_type: 'cash',
        amount: Number(input.payments.cash),
      });
    }
    if (input.payments.upi > 0) {
      paymentRows.push({
        bill_id: billUuid,
        payment_type: 'upi',
        amount: Number(input.payments.upi),
      });
    }
    if (input.payments.card > 0) {
      paymentRows.push({
        bill_id: billUuid,
        payment_type: 'card',
        amount: Number(input.payments.card),
      });
    }

    // If no explicit split was provided, allocate final_amount to cash by default
    if (paymentRows.length === 0 && input.final_amount > 0) {
      paymentRows.push({
        bill_id: billUuid,
        payment_type: 'cash',
        amount: Number(input.final_amount),
      });
    }

    if (paymentRows.length > 0) {
      const { error: payErr } = await supabase
        .from('bill_payments')
        .insert(paymentRows);

      if (payErr) {
  console.error('BILL_PAYMENTS INSERT FAILED:', payErr);

  return {
    success: false,
    billId: generatedBillId,
    billUuid,
    error: new Error(
      `Failed to insert bill_payments: ${payErr.message}`
    ),
  };
}
    }

    // 5. If status === 'success', deduct stock from store_products
    if (input.status === 'success' && input.store_id) {
      for (const item of input.items) {
        try {
          const { data: spItem } = await supabase
            .from('store_products')
            .select('id, quantity')
            .eq('store_id', input.store_id)
            .eq('product_variant', item.variant_id)
            .maybeSingle();

          if (spItem) {
            const currentQty = Number(spItem.quantity || 0);
            const updatedQty = Math.max(0, currentQty - Number(item.quantity || 1));
            await supabase
              .from('store_products')
              .update({
                quantity: updatedQty,
                updated_at: new Date().toISOString(),
              })
              .eq('id', spItem.id);
          }
        } catch (stockErr) {
          console.warn('Error deducting store_products inventory:', stockErr);
        }
      }

      // Reward points if customer linked (1 point per 100 spent)
      if (input.customer_id && input.final_amount >= 100) {
        try {
          const pointsToAdd = Math.floor(input.final_amount / 100);
          const { data: cust } = await supabase
            .from('customers')
            .select('points')
            .eq('id', input.customer_id)
            .maybeSingle();

          if (cust) {
            await supabase
              .from('customers')
              .update({
                points: Number(cust.points || 0) + pointsToAdd,
                updated_at: new Date().toISOString(),
              })
              .eq('id', input.customer_id);
          }
        } catch {
          // Ignore
        }
      }
    }

    // Save to local cache
    const storedRecord: StoredBillRecord = {
      id: billUuid,
      bill_id: generatedBillId,
      store_id: input.store_id,
      staff_id: staffId,
      customer_id: input.customer_id,
      amount: input.subtotal,
      discount: input.discount,
      final_amount: input.final_amount,
      status: input.status,
      date: todayStr,
      created_at: new Date().toISOString(),
      items: input.items,
      payments: input.payments,
    };
    saveLocalBill(storedRecord);

    return {
      success: true,
      billId: generatedBillId,
      billUuid,
      error: null,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to save store bill';
    return {
      success: false,
      billId: generatedBillId,
      error: new Error(errorMsg),
    };
  }
}

function saveLocalBill(record: StoredBillRecord) {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_BILLS_KEY);
    const list: StoredBillRecord[] = raw ? JSON.parse(raw) : [];
    localStorage.setItem(LOCAL_STORAGE_BILLS_KEY, JSON.stringify([record, ...list]));
  } catch {
    // Ignore
  }
}
