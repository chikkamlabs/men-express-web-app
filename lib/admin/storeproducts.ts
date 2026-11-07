import { supabase } from '@/lib/supabase';
import { StoreItem } from '@/lib/stores';

export interface StoreVariantItem {
  id: string; // store_product row id
  variant_id: string;
  barcode: string;
  size_value: string;
  color_name: string;
  color_code?: string;
  quantity: number;
  mrp?: number;
  s_p?: number;
}

export interface StoreProductItem {
  product_id: string; // UUID of product
  prod_id: string; // prod_id e.g. prod_1001
  name: string; // Product name
  category_id?: string;
  category_name?: string;
  no_of_variants: number; // Number of variants in store_products
  total_quantity: number; // Sum of quantities
  online_available: boolean; // boolean
  variants: StoreVariantItem[];
}

export interface StoreCategoryItem {
  id: string;
  name: string;
  cat_id?: string;
}

/**
 * Fetch a store by UUID id or string store_id
 */
export async function getStoreByIdOrStoreId(
  idOrStoreId: string
): Promise<{ data: StoreItem | null; error: Error | null }> {
  try {
    // 1. Try finding by UUID id
    let { data, error } = await supabase
      .from('stores')
      .select('*')
      .eq('id', idOrStoreId)
      .maybeSingle();

    // 2. If not found, try finding by store_id string
    if (!data) {
      const secondTry = await supabase
        .from('stores')
        .select('*')
        .eq('store_id', idOrStoreId)
        .maybeSingle();

      if (secondTry.data) {
        data = secondTry.data;
        error = null;
      }
    }

    if (error && !data) {
      return { data: null, error: new Error(error.message) };
    }

    return { data: data as StoreItem | null, error: null };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to fetch store';
    return { data: null, error: new Error(errorMsg) };
  }
}

/**
 * Fetch all categories for filter dropdown
 */
export async function getStoreCategories(): Promise<{
  data: StoreCategoryItem[];
  error: Error | null;
}> {
  try {
    const { data, error } = await supabase
      .from('categories')
      .select('id, name, cat_id')
      .order('name', { ascending: true });

    if (error) {
      return { data: [], error: new Error(error.message) };
    }

    return { data: (data || []) as StoreCategoryItem[], error: null };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to fetch categories';
    return { data: [], error: new Error(errorMsg) };
  }
}

/**
 * Fetch all store products for a store from store_products table,
 * and aggregate by product to display with product_id, Name, No of variants, online_available.
 */
export async function getStoreProducts(storeId: string): Promise<{
  data: StoreProductItem[];
  totalProductsCount: number;
  error: Error | null;
}> {
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
        created_at,
        updated_at,
        product:product_id (
          id,
          prod_id,
          name,
          category_id,
          online_available,
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
      `)
      .eq('store_id', storeId)
      .order('created_at', { ascending: false });

    let rows: any[] = [];

    if (error) {
      console.warn('Supabase store_products nested fetch error, attempting fallback query:', error.message);
      // Fallback query: 1. Get raw store_products
      const rawRes = await supabase
        .from('store_products')
        .select('id, store_id, product_id, product_variant, quantity, barcode')
        .eq('store_id', storeId);

      if (rawRes.error) {
        return { data: [], totalProductsCount: 0, error: new Error(rawRes.error.message) };
      }

      const rawItems = rawRes.data || [];
      if (rawItems.length === 0) {
        return { data: [], totalProductsCount: 0, error: null };
      }

      const productIds = Array.from(new Set(rawItems.map((r) => r.product_id).filter(Boolean)));
      const variantIds = Array.from(new Set(rawItems.map((r) => r.product_variant).filter(Boolean)));

      // 2. Fetch products
      const [prodsRes, variantsRes] = await Promise.all([
        supabase
          .from('products')
          .select('id, prod_id, name, category_id, online_available, category:category_id(id, name, cat_id)')
          .in('id', productIds),
        supabase
          .from('product_variants')
          .select('id, barcode, mrp, s_p, size:size_id(id, value), product_color:product_color_id(id, color:color_id(id, name, code))')
          .in('id', variantIds),
      ]);

      const prodsMap = new Map((prodsRes.data || []).map((p: any) => [p.id, p]));
      const varsMap = new Map((variantsRes.data || []).map((v: any) => [v.id, v]));

      rows = rawItems.map((r) => ({
        ...r,
        product: prodsMap.get(r.product_id),
        variant: varsMap.get(r.product_variant),
      }));
    } else {
      rows = (data || []) as any[];
    }

    // Aggregate by product_id
    const productMap = new Map<string, StoreProductItem>();

    for (const row of rows) {
      const prod = row.product;
      const v = row.variant;

      if (!prod) continue;

      const pId = prod.id;
      if (!productMap.has(pId)) {
        productMap.set(pId, {
          product_id: prod.id,
          prod_id: prod.prod_id || '—',
          name: prod.name || 'Unnamed Product',
          category_id: prod.category_id,
          category_name: prod.category?.name || 'Uncategorized',
          no_of_variants: 0,
          total_quantity: 0,
          online_available:
            typeof prod.online_available === 'boolean' ? prod.online_available : false,
          variants: [],
        });
      }

      const currentProduct = productMap.get(pId)!;

      const colorName = v?.product_color?.color?.name || 'Standard';
      const colorCode = v?.product_color?.color?.code || '#000000';
      const sizeValue = v?.size?.value || '—';
      const barcodeValue = row.barcode || v?.barcode || '—';
      const qty = Number(row.quantity) || 0;

      currentProduct.variants.push({
        id: row.id,
        variant_id: row.product_variant || v?.id || '',
        barcode: barcodeValue,
        size_value: sizeValue,
        color_name: colorName,
        color_code: colorCode,
        quantity: qty,
        mrp: v?.mrp ? Number(v.mrp) : undefined,
        s_p: v?.s_p ? Number(v.s_p) : undefined,
      });

      currentProduct.no_of_variants = currentProduct.variants.length;
      currentProduct.total_quantity += qty;
    }

    const productsList = Array.from(productMap.values());

    return {
      data: productsList,
      totalProductsCount: productsList.length,
      error: null,
    };
  } catch (err: unknown) {
    const errorMsg =
      err instanceof Error ? err.message : 'Unknown error fetching store products';
    return { data: [], totalProductsCount: 0, error: new Error(errorMsg) };
  }
}
