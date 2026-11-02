import { supabase } from './supabase';

export interface CustomerSummary {
  id: string;
  name: string;
  mobile: string;
  points?: number;
  email?: string | null;
}

export interface StaffSummary {
  id: string;
  name: string;
  mobile?: string;
}

export interface StoreSummary {
  id: string;
  name: string;
  store_id?: string;
  address?: string | null;
  mobile?: string | null;
  email?: string | null;
}

export interface BillItemDetail {
  id: string;
  bill_id: string;
  product_id?: string | null;
  prod_variant: string;
  qty: number;
  s_p: number;
  mrp: number;
  row_total: number;
  created_at?: string;
  product_name?: string;
  prod_id?: string;
  category_name?: string;
  size?: string;
  color?: string;
  color_code?: string;
  barcode?: string;
}

export interface BillPaymentDetail {
  id: string;
  bill_id: string;
  payment_type: 'cash' | 'upi' | 'card' | 'other' | 'bill';
  amount: number;
  created_at?: string;
}

export interface StoreBill {
  id: string;
  bill_id: string;
  store_id: string;
  staff_id?: string | null;
  customer_id?: string | null;
  amount: number; // subtotal
  discount: number;
  final_amount: number;
  status: 'draft' | 'success';
  date: string;
  created_at: string;
  updated_at?: string;
  customer?: CustomerSummary | null;
  staff?: StaffSummary | null;
  store?: StoreSummary | null;
}

export interface FullBillDetail extends StoreBill {
  items: BillItemDetail[];
  payments: BillPaymentDetail[];
}

export interface StoreBillsFilterOptions {
  storeId?: string;
  fromDate?: string;
  toDate?: string;
  searchBillId?: string;
}

export interface PaymentBreakdownSplit {
  cash: number;
  upi: number;
  card: number;
  total: number;
}

export interface StoreBillsResult {
  bills: StoreBill[];
  totalBills: number;
  totalSale: number;
  paymentSplit: PaymentBreakdownSplit;
  error: Error | null;
}

const LOCAL_STORAGE_BILLS_KEY = 'menexpress_store_bills_pos_cache';

function getLocalCachedBills(): any[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_BILLS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Fetch bills for a store within a date range and optional bill_id search.
 * Computes:
 * - Total Store Bills (Count as per the Filtered Dates)
 * - Total sale (Calculate as per the Filtered Dates)
 * - Payment breakdown (Cash, UPI, Card)
 */
export async function getStoreBills(
  options: StoreBillsFilterOptions
): Promise<StoreBillsResult> {
  const { storeId, fromDate, toDate, searchBillId } = options;

  try {
    let query = supabase
      .from('store_bills')
      .select(`
        id,
        bill_id,
        store_id,
        staff_id,
        customer_id,
        amount,
        discount,
        final_amount,
        status,
        date,
        created_at,
        updated_at,
        customer:customer_id (
          id,
          name,
          mobile,
          points,
          email
        ),
        staff:staff_id (
          id,
          name,
          mobile
        ),
        store:store_id (
          id,
          name,
          store_id
        ),
        payments:bill_payments (
          payment_type,
          amount
        )
      `)
      .order('created_at', { ascending: false });

    if (storeId && storeId !== 'all') {
      query = query.eq('store_id', storeId);
    }

    if (fromDate) {
      query = query.gte('date', fromDate);
    }

    if (toDate) {
      query = query.lte('date', toDate);
    }

    if (searchBillId && searchBillId.trim()) {
      query = query.ilike('bill_id', `%${searchBillId.trim()}%`);
    }

    const { data, error } = await query;

    if (error) {
      console.warn('getStoreBills error, fallback to cache:', error);
      return getFilteredLocalBills(options);
    }

    const bills: StoreBill[] = (data || []).map((row: any) => {
      const customer = Array.isArray(row.customer) ? row.customer[0] : row.customer;
      const staff = Array.isArray(row.staff) ? row.staff[0] : row.staff;
      const store = Array.isArray(row.store) ? row.store[0] : row.store;
      return {
        id: row.id,
        bill_id: row.bill_id,
        store_id: row.store_id,
        staff_id: row.staff_id,
        customer_id: row.customer_id,
        amount: Number(row.amount || 0),
        discount: Number(row.discount || 0),
        final_amount: Number(row.final_amount || 0),
        status: (row.status as 'draft' | 'success') || 'draft',
        date: row.date || (row.created_at ? row.created_at.split('T')[0] : ''),
        created_at: row.created_at,
        updated_at: row.updated_at,
        customer: (customer as CustomerSummary) || null,
        staff: (staff as StaffSummary) || null,
        store: (store as StoreSummary) || null,
      };
    });

    // If database returned 0 bills, check if local cache has any matching records
    if (bills.length === 0) {
      const cached = getFilteredLocalBills(options);
      if (cached.bills.length > 0) {
        return cached;
      }
    }

    const totalBills = bills.length;
    const totalSale = bills.reduce((sum, b) => sum + (b.final_amount || 0), 0);

    // Calculate payment mode breakdown
    let cashSale = 0;
    let upiSale = 0;
    let cardSale = 0;

    for (const row of data || []) {
      const pmts = row.payments;
      if (Array.isArray(pmts) && pmts.length > 0) {
        for (const p of pmts) {
          const amt = Number(p.amount || 0);
          if (p.payment_type === 'cash') cashSale += amt;
          else if (p.payment_type === 'upi') upiSale += amt;
          else if (p.payment_type === 'card') cardSale += amt;
          else cashSale += amt;
        }
      } else {
        // allocate final_amount to cash by default if no separate payment rows
        cashSale += Number(row.final_amount || 0);
      }
    }

    return {
      bills,
      totalBills,
      totalSale,
      paymentSplit: {
        cash: cashSale,
        upi: upiSale,
        card: cardSale,
        total: totalSale,
      },
      error: null,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Error fetching bills';
    console.error('getStoreBills exception:', err);
    return getFilteredLocalBills(options, new Error(errorMsg));
  }
}

function getFilteredLocalBills(
  options: StoreBillsFilterOptions,
  error: Error | null = null
): StoreBillsResult {
  const cachedList = getLocalCachedBills();
  const { storeId, fromDate, toDate, searchBillId } = options;

  let filtered = cachedList;

  if (storeId && storeId !== 'all') {
    filtered = filtered.filter((b) => !b.store_id || b.store_id === storeId);
  }

  if (fromDate) {
    filtered = filtered.filter((b) => (b.date || '').localeCompare(fromDate) >= 0);
  }

  if (toDate) {
    filtered = filtered.filter((b) => (b.date || '').localeCompare(toDate) <= 0);
  }

  if (searchBillId && searchBillId.trim()) {
    const q = searchBillId.trim().toLowerCase();
    filtered = filtered.filter((b) =>
      String(b.bill_id || '').toLowerCase().includes(q)
    );
  }

  const bills: StoreBill[] = filtered.map((b) => ({
    id: b.id || b.bill_id,
    bill_id: b.bill_id,
    store_id: b.store_id,
    staff_id: b.staff_id,
    customer_id: b.customer_id,
    amount: Number(b.amount || 0),
    discount: Number(b.discount || 0),
    final_amount: Number(b.final_amount || 0),
    status: b.status || 'success',
    date: b.date || new Date().toISOString().split('T')[0],
    created_at: b.created_at || new Date().toISOString(),
    customer: b.customer_id
      ? {
          id: b.customer_id,
          name: b.customer_name || 'Customer',
          mobile: b.customer_mobile || '',
        }
      : null,
  }));

  const totalBills = bills.length;
  const totalSale = bills.reduce((sum, b) => sum + (b.final_amount || 0), 0);

  let cashSale = 0;
  let upiSale = 0;
  let cardSale = 0;

  for (const b of filtered) {
    if (b.payments) {
      cashSale += Number(b.payments.cash || 0);
      upiSale += Number(b.payments.upi || 0);
      cardSale += Number(b.payments.card || 0);
    } else {
      cashSale += Number(b.final_amount || 0);
    }
  }

  return {
    bills,
    totalBills,
    totalSale,
    paymentSplit: {
      cash: cashSale,
      upi: upiSale,
      card: cardSale,
      total: totalSale,
    },
    error,
  };
}

/**
 * Fetch a single bill with full details: items, payments, customer, staff, store.
 * Supports finding by Supabase UUID id OR string bill_id (e.g. 'bill_123456').
 */
export async function getBillById(
  idOrBillId: string
): Promise<{ bill: FullBillDetail | null; error: Error | null }> {
  if (!idOrBillId) {
    return { bill: null, error: new Error('Bill ID is required') };
  }

  try {
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        idOrBillId
      );

    let query = supabase.from('store_bills').select(`
      id,
      bill_id,
      store_id,
      staff_id,
      customer_id,
      amount,
      discount,
      final_amount,
      status,
      date,
      created_at,
      updated_at,
      customer:customer_id (
        id,
        name,
        mobile,
        points,
        email
      ),
      staff:staff_id (
        id,
        name,
        mobile
      ),
      store:store_id (
        id,
        name,
        store_id,
        address,
        mobile,
        email
      )
    `);

    if (isUuid) {
      query = query.eq('id', idOrBillId);
    } else {
      query = query.eq('bill_id', idOrBillId);
    }

    const { data: billData, error: billError } = await query.maybeSingle();

    if (billError || !billData) {
      console.warn('Bill not found in Supabase, trying local cache:', billError);
      return getBillFromLocalCache(idOrBillId);
    }

    const billUuid = billData.id;

    // Fetch Bill Items with product and variant joins
    const { data: itemsData, error: itemsError } = await supabase
      .from('bill_items')
      .select(`
        id,
        bill_id,
        product_id,
        prod_variant,
        qty,
        s_p,
        mrp,
        row_total,
        created_at,
        product:product_id (
          id,
          prod_id,
          name,
          category:category_id (name)
        ),
        variant:prod_variant (
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
      .eq('bill_id', billUuid);

    if (itemsError) {
      console.warn('Error fetching bill_items:', itemsError);
    }

    // Fetch Bill Payments
    const { data: paymentsData, error: paymentsError } = await supabase
      .from('bill_payments')
      .select(`
        id,
        bill_id,
        payment_type,
        amount,
        created_at
      `)
      .eq('bill_id', billUuid);

    if (paymentsError) {
      console.warn('Error fetching bill_payments:', paymentsError);
    }

    const formattedItems: BillItemDetail[] = (itemsData || []).map((it: any) => ({
      id: it.id,
      bill_id: it.bill_id,
      product_id: it.product_id,
      prod_variant: it.prod_variant,
      qty: Number(it.qty || 1),
      s_p: Number(it.s_p || 0),
      mrp: Number(it.mrp || it.s_p || 0),
      row_total: Number(it.row_total || 0),
      created_at: it.created_at,
      product_name: it.product?.name || 'Product',
      prod_id: it.product?.prod_id || '',
      category_name: it.product?.category?.name || 'General',
      size: it.variant?.size?.value || '—',
      color: it.variant?.product_color?.color?.name || '—',
      color_code: it.variant?.product_color?.color?.code || undefined,
      barcode: it.variant?.barcode || '',
    }));

    const formattedPayments: BillPaymentDetail[] = (paymentsData || []).map(
      (p: any) => ({
        id: p.id,
        bill_id: p.bill_id,
        payment_type: p.payment_type || 'cash',
        amount: Number(p.amount || 0),
        created_at: p.created_at,
      })
    );

    const rawBill = billData as any;
    const customer = Array.isArray(rawBill.customer) ? rawBill.customer[0] : rawBill.customer;
    const staff = Array.isArray(rawBill.staff) ? rawBill.staff[0] : rawBill.staff;
    const store = Array.isArray(rawBill.store) ? rawBill.store[0] : rawBill.store;

    const fullBill: FullBillDetail = {
      id: rawBill.id,
      bill_id: rawBill.bill_id,
      store_id: rawBill.store_id,
      staff_id: rawBill.staff_id,
      customer_id: rawBill.customer_id,
      amount: Number(rawBill.amount || 0),
      discount: Number(rawBill.discount || 0),
      final_amount: Number(rawBill.final_amount || 0),
      status: (rawBill.status as 'draft' | 'success') || 'draft',
      date: rawBill.date || (rawBill.created_at ? rawBill.created_at.split('T')[0] : ''),
      created_at: rawBill.created_at,
      updated_at: rawBill.updated_at,
      customer: (customer as CustomerSummary) || null,
      staff: (staff as StaffSummary) || null,
      store: (store as StoreSummary) || null,
      items: formattedItems,
      payments: formattedPayments,
    };

    return { bill: fullBill, error: null };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Error fetching bill detail';
    console.error('getBillById exception:', err);
    return getBillFromLocalCache(idOrBillId, new Error(errorMsg));
  }
}

function getBillFromLocalCache(
  idOrBillId: string,
  err: Error | null = null
): { bill: FullBillDetail | null; error: Error | null } {
  const cachedList = getLocalCachedBills();
  const found = cachedList.find(
    (b) => b.id === idOrBillId || b.bill_id === idOrBillId
  );

  if (!found) {
    return { bill: null, error: err || new Error('Bill not found') };
  }

  const items: BillItemDetail[] = (found.items || []).map((it: any, idx: number) => ({
    id: it.id || `item-${idx}`,
    bill_id: found.id || found.bill_id,
    product_id: it.product_id || null,
    prod_variant: it.variant_id || it.prod_variant,
    qty: Number(it.quantity || it.qty || 1),
    s_p: Number(it.s_p || 0),
    mrp: Number(it.mrp || it.s_p || 0),
    row_total: Number(it.row_total || (it.s_p * (it.quantity || 1))),
    product_name: it.product_name || 'Product',
    prod_id: it.prod_id || '',
    size: it.size || '—',
    color: it.color || '—',
    color_code: it.color_code,
    barcode: it.barcode || '',
  }));

  const payments: BillPaymentDetail[] = [];
  if (found.payments) {
    if (found.payments.cash > 0) {
      payments.push({
        id: 'pay-cash',
        bill_id: found.id || found.bill_id,
        payment_type: 'cash',
        amount: Number(found.payments.cash),
      });
    }
    if (found.payments.upi > 0) {
      payments.push({
        id: 'pay-upi',
        bill_id: found.id || found.bill_id,
        payment_type: 'upi',
        amount: Number(found.payments.upi),
      });
    }
    if (found.payments.card > 0) {
      payments.push({
        id: 'pay-card',
        bill_id: found.id || found.bill_id,
        payment_type: 'card',
        amount: Number(found.payments.card),
      });
    }
  }

  const billDetail: FullBillDetail = {
    id: found.id || found.bill_id,
    bill_id: found.bill_id,
    store_id: found.store_id || '',
    staff_id: found.staff_id || null,
    customer_id: found.customer_id || null,
    amount: Number(found.amount || 0),
    discount: Number(found.discount || 0),
    final_amount: Number(found.final_amount || 0),
    status: found.status || 'success',
    date: found.date || new Date().toISOString().split('T')[0],
    created_at: found.created_at || new Date().toISOString(),
    customer: found.customer_id
      ? {
          id: found.customer_id,
          name: found.customer_name || 'Customer',
          mobile: found.customer_mobile || '',
        }
      : null,
    items,
    payments,
  };

  return { bill: billDetail, error: null };
}
