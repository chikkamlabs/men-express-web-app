import { supabase } from '@/lib/supabase';

export interface StoreProductVariantDetail {
  store_product_id: string;
  variant_id: string;
  barcode: string;
  size: string;
  color: string;
  color_code?: string;
  mrp: number;
  s_p: number;
  quantity: number;
  status: string;
}

export interface UniqueStoreProduct {
  product_id: string; // Product UUID
  prod_id: string; // e.g. prod_1
  name: string;
  category_id: string;
  category_name?: string;
  fit?: string | null;
  collar?: string | null;
  fabric?: string | null;
  status: boolean;
  variantCount: number;
  totalQuantity: number;
  variants: StoreProductVariantDetail[];
}

export interface StoreProductFilters {
  search?: string; // Search by product_id (prod_id)
  categoryId?: string; // Filter by category
  storeId?: string; // Filter by store
}

const LOCAL_STORAGE_KEY = 'menexpress_store_products_cache';

interface CachedStoreProductRow {
  id: string;
  store_id: string;
  product_id: string;
  product_variant: string;
  quantity: number;
  barcode: string;
  created_at: string;
  updated_at?: string;
  product?: any;
  variant?: any;
}

function getLocalCache(): CachedStoreProductRow[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function setLocalCache(items: CachedStoreProductRow[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Ignore storage write errors
  }
}

/**
 * Fetch and aggregate Unique Store Products with variant counts and inventory
 */
export async function getStoreProducts(filters?: StoreProductFilters): Promise<{
  uniqueProducts: UniqueStoreProduct[];
  totalProductsCount: number;
  totalVariantsCount: number;
  error: Error | null;
}> {
  try {
    let query = supabase.from('store_products').select(`
      id,
      store_id,
      product_id,
      product_variant,
      quantity,
      barcode,
      created_at,
      updated_at,
      product:product_id (
        id,
        prod_id,
        name,
        category_id,
        fit,
        collar,
        fabric,
        status,
        category:category_id (
          id,
          name,
          cat_id
        )
      ),
      variant:product_variant (
        id,
        barcode,
        mrp,
        s_p,
        p_p,
        status,
        size:size_id (
          id,
          value
        ),
        product_color:product_color_id (
          id,
          color:color_id (
            id,
            name,
            code
          )
        )
      )
    `);

    if (filters?.storeId && filters.storeId !== 'all') {
      query = query.eq('store_id', filters.storeId);
    }

    const { data, error } = await query;

    if (error) {
      console.warn('Supabase store_products query error, using local cache:', error.message);
      const local = getLocalCache();
      return aggregateUniqueProducts(local, filters);
    }

    if (data) {
      const rows = data as any[];
      // Update local cache
      setLocalCache(rows);
      return aggregateUniqueProducts(rows, filters);
    }

    return {
      uniqueProducts: [],
      totalProductsCount: 0,
      totalVariantsCount: 0,
      error: null,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown network error';
    const local = getLocalCache();
    return aggregateUniqueProducts(local, filters, new Error(errorMsg));
  }
}

function aggregateUniqueProducts(
  rows: any[],
  filters?: StoreProductFilters,
  existingError: Error | null = null
): {
  uniqueProducts: UniqueStoreProduct[];
  totalProductsCount: number;
  totalVariantsCount: number;
  error: Error | null;
} {
  let filteredRows = rows;
  if (filters?.storeId && filters.storeId !== 'all') {
    filteredRows = filteredRows.filter((r) => r.store_id === filters.storeId);
  }

  // Group rows by product_id
  const productMap = new Map<string, UniqueStoreProduct>();

  for (const row of filteredRows) {
    const p = row.product;
    const v = row.variant;
    const productId = row.product_id || p?.id;

    if (!productId) continue;

    const variantDetail: StoreProductVariantDetail = {
      store_product_id: row.id,
      variant_id: row.product_variant || v?.id || '',
      barcode: row.barcode || v?.barcode || '',
      size: v?.size?.value || '—',
      color: v?.product_color?.color?.name || '—',
      color_code: v?.product_color?.color?.code || undefined,
      mrp: Number(v?.mrp || 0),
      s_p: Number(v?.s_p || 0),
      quantity: Number(row.quantity || 0),
      status: v?.status || 'active',
    };

    if (productMap.has(productId)) {
      const existing = productMap.get(productId)!;
      existing.variants.push(variantDetail);
      existing.variantCount += 1;
      existing.totalQuantity += variantDetail.quantity;
    } else {
      productMap.set(productId, {
        product_id: productId,
        prod_id: p?.prod_id || 'prod_?',
        name: p?.name || 'Product',
        category_id: p?.category_id || p?.category?.id || '',
        category_name: p?.category?.name || 'Uncategorized',
        fit: p?.fit || null,
        collar: p?.collar || null,
        fabric: p?.fabric || null,
        status: p?.status ?? true,
        variantCount: 1,
        totalQuantity: variantDetail.quantity,
        variants: [variantDetail],
      });
    }
  }

  let list = Array.from(productMap.values());

  // Filter by category
  if (filters?.categoryId && filters.categoryId !== 'all') {
    list = list.filter((item) => item.category_id === filters.categoryId);
  }

  // Search by product_id (prod_id or name)
  if (filters?.search && filters.search.trim()) {
    const q = filters.search.trim().toLowerCase();
    list = list.filter(
      (item) =>
        item.prod_id.toLowerCase().includes(q) ||
        item.name.toLowerCase().includes(q)
    );
  }

  // Calculate total products & total variants across the store
  const totalProductsCount = productMap.size;
  const totalVariantsCount = filteredRows.length;

  return {
    uniqueProducts: list,
    totalProductsCount,
    totalVariantsCount,
    error: existingError,
  };
}

/**
 * Fetch a single product's details and all its variants in this store's inventory
 */
export async function getStoreProductDetails(
  productIdOrProdId: string,
  storeId?: string
): Promise<{
  product: UniqueStoreProduct | null;
  error: Error | null;
}> {
  try {
    const { uniqueProducts, error } = await getStoreProducts({ storeId });
    if (error && uniqueProducts.length === 0) {
      return { product: null, error };
    }

    const found = uniqueProducts.find(
      (p) =>
        p.product_id === productIdOrProdId ||
        p.prod_id.toLowerCase() === productIdOrProdId.toLowerCase()
    );

    if (found) {
      return { product: found, error: null };
    }

    // Direct fallback lookup by product_id from products table + store_products
    let prodQuery = supabase
      .from('products')
      .select(`
        id,
        prod_id,
        name,
        category_id,
        fit,
        collar,
        fabric,
        status,
        category:category_id (id, name, cat_id)
      `);

    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      productIdOrProdId
    );

    if (isUUID) {
      prodQuery = prodQuery.eq('id', productIdOrProdId);
    } else {
      prodQuery = prodQuery.eq('prod_id', productIdOrProdId);
    }

    const { data: prodData, error: prodErr } = await prodQuery.maybeSingle();

    if (prodErr || !prodData) {
      return { product: null, error: prodErr ? new Error(prodErr.message) : new Error('Product not found') };
    }

    const p = prodData as any;

    // Fetch store_products for this product
    let spQuery = supabase
      .from('store_products')
      .select(`
        id,
        store_id,
        product_id,
        product_variant,
        quantity,
        barcode,
        variant:product_variant (
          id,
          barcode,
          mrp,
          s_p,
          p_p,
          status,
          size:size_id (id, value),
          product_color:product_color_id (
            id,
            color:color_id (id, name, code)
          )
        )
      `)
      .eq('product_id', p.id);

    if (storeId && storeId !== 'all') {
      spQuery = spQuery.eq('store_id', storeId);
    }

    const { data: spData } = await spQuery;
    const spRows = (spData as any[]) || [];

    const variants: StoreProductVariantDetail[] = spRows.map((r) => ({
      store_product_id: r.id,
      variant_id: r.product_variant,
      barcode: r.barcode || r.variant?.barcode || '',
      size: r.variant?.size?.value || '—',
      color: r.variant?.product_color?.color?.name || '—',
      color_code: r.variant?.product_color?.color?.code || undefined,
      mrp: Number(r.variant?.mrp || 0),
      s_p: Number(r.variant?.s_p || 0),
      quantity: Number(r.quantity || 0),
      status: r.variant?.status || 'active',
    }));

    const result: UniqueStoreProduct = {
      product_id: p.id,
      prod_id: p.prod_id,
      name: p.name,
      category_id: p.category_id,
      category_name: p.category?.name || 'Uncategorized',
      fit: p.fit || null,
      collar: p.collar || null,
      fabric: p.fabric || null,
      status: p.status ?? true,
      variantCount: variants.length,
      totalQuantity: variants.reduce((sum, v) => sum + v.quantity, 0),
      variants,
    };

    return { product: result, error: null };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Error fetching product details';
    return { product: null, error: new Error(errorMsg) };
  }
}
