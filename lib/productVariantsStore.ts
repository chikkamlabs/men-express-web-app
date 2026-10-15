import { supabase } from './supabase';

export interface ProductVariant {
  id: string;
  product_id: string;
  product_color_id: string;
  size_id: string;
  barcode: string;
  mrp: number;
  s_p: number;
  p_p: number;
  quantity: number;
  status: 'active' | 'deactive';
  online_available: boolean;
  on_landing_page: boolean;
  created_at: string;
  updated_at?: string;
  size_value?: string;
  color_name?: string;
  color_code?: string;
}

export interface CreateProductVariantInput {
  product_id: string;
  product_color_id: string;
  size_id: string;
  barcode: string;
  mrp: number;
  s_p: number;
  p_p: number;
  quantity: number;
  status?: 'active' | 'deactive';
  online_available?: boolean;
  on_landing_page?: boolean;
}

export interface UpdateProductVariantInput {
  product_color_id: string;
  size_id: string;
  barcode: string;
  mrp: number;
  s_p: number;
  p_p: number;
  quantity: number;
  status: 'active' | 'deactive';
  online_available: boolean;
  on_landing_page: boolean;
}

const VARIANTS_CACHE_KEY = 'menexpress_product_variants_cache';

function getLocalVariantsCache(): ProductVariant[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(VARIANTS_CACHE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function setLocalVariantsCache(items: ProductVariant[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(VARIANTS_CACHE_KEY, JSON.stringify(items));
  } catch {
    // Ignore storage write errors
  }
}

/**
 * Fetch all product variants for a specific product
 */
export async function getProductVariants(
  productId: string
): Promise<{ data: ProductVariant[]; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('product_variants')
      .select(`
        *,
        size:size_id(id, value),
        product_color:product_color_id(
          id,
          color_id,
          color:color_id(id, name, code)
        )
      `)
      .eq('product_id', productId)
      .order('created_at', { ascending: true });

    if (error) {
      console.warn('Supabase product_variants fetch error, using local cache:', error.message);
      const local = getLocalVariantsCache().filter(
        (v) => v.product_id === productId
      );
      return { data: local, error: new Error(error.message) };
    }

    if (data) {
      const formatted: ProductVariant[] = (data as any[]).map((row) => ({
        id: row.id,
        product_id: row.product_id,
        product_color_id: row.product_color_id,
        size_id: row.size_id,
        barcode: row.barcode,
        mrp: Number(row.mrp),
        s_p: Number(row.s_p),
        p_p: Number(row.p_p),
        quantity: Number(row.quantity),
        status: (row.status as 'active' | 'deactive') || 'active',
        online_available: typeof row.online_available === 'boolean' ? row.online_available : true,
        on_landing_page: typeof row.on_landing_page === 'boolean' ? row.on_landing_page : false,
        created_at: row.created_at,
        updated_at: row.updated_at,
        size_value: row.size?.value,
        color_name: row.product_color?.color?.name,
        color_code: row.product_color?.color?.code,
      }));

      const local = getLocalVariantsCache().filter(
        (v) => v.product_id !== productId
      );
      setLocalVariantsCache([...local, ...formatted]);

      return { data: formatted, error: null };
    }

    return { data: [], error: null };
  } catch (err: unknown) {
    const local = getLocalVariantsCache().filter(
      (v) => v.product_id === productId
    );
    const errorMsg = err instanceof Error ? err.message : 'Unknown network error';
    return { data: local, error: new Error(errorMsg) };
  }
}

/**
 * Create a new product variant
 */
export async function createProductVariant(
  input: CreateProductVariantInput,
  extra?: { size_value?: string; color_name?: string; color_code?: string }
): Promise<{ data: ProductVariant | null; error: Error | null }> {
  const payload = {
    product_id: input.product_id,
    product_color_id: input.product_color_id,
    size_id: input.size_id,
    barcode: input.barcode.trim(),
    mrp: Number(input.mrp),
    s_p: Number(input.s_p),
    p_p: Number(input.p_p),
    quantity: Number(input.quantity) || 0,
    status: input.status || 'active',
    online_available: typeof input.online_available === 'boolean' ? input.online_available : true,
    on_landing_page: typeof input.on_landing_page === 'boolean' ? input.on_landing_page : false,
  };

  try {
    const { data, error } = await supabase
      .from('product_variants')
      .insert([payload])
      .select(`
        *,
        size:size_id(id, value),
        product_color:product_color_id(
          id,
          color_id,
          color:color_id(id, name, code)
        )
      `)
      .single();

    if (error) {
      console.error('Supabase product_variants insert error:', error.message);
      return { data: null, error: new Error(error.message) };
    }

    const row = data as any;
    const formatted: ProductVariant = {
      id: row.id,
      product_id: row.product_id,
      product_color_id: row.product_color_id,
      size_id: row.size_id,
      barcode: row.barcode,
      mrp: Number(row.mrp),
      s_p: Number(row.s_p),
      p_p: Number(row.p_p),
      quantity: Number(row.quantity),
      status: row.status,
      online_available: row.online_available,
      on_landing_page: row.on_landing_page,
      created_at: row.created_at,
      updated_at: row.updated_at,
      size_value: row.size?.value || extra?.size_value,
      color_name: row.product_color?.color?.name || extra?.color_name,
      color_code: row.product_color?.color?.code || extra?.color_code,
    };

    const local = getLocalVariantsCache();
    setLocalVariantsCache([...local.filter((v) => v.id !== formatted.id), formatted]);
    return { data: formatted, error: null };
  } catch (err: unknown) {
    const errorObj = err instanceof Error ? err : new Error(String(err));
    console.error('Failed to insert product variant:', errorObj.message);
    return { data: null, error: errorObj };
  }
}

/**
 * Update an existing product variant
 */
export async function updateProductVariant(
  variantId: string,
  input: UpdateProductVariantInput,
  extra?: { size_value?: string; color_name?: string; color_code?: string }
): Promise<{ data: ProductVariant | null; error: Error | null }> {
  const updatePayload = {
    product_color_id: input.product_color_id,
    size_id: input.size_id,
    barcode: input.barcode.trim(),
    mrp: Number(input.mrp),
    s_p: Number(input.s_p),
    p_p: Number(input.p_p),
    quantity: Number(input.quantity),
    status: input.status,
    online_available: input.online_available,
    on_landing_page: input.on_landing_page,
    updated_at: new Date().toISOString(),
  };

  try {
    const { data, error } = await supabase
      .from('product_variants')
      .update(updatePayload)
      .eq('id', variantId)
      .select(`
        *,
        size:size_id(id, value),
        product_color:product_color_id(
          id,
          color_id,
          color:color_id(id, name, code)
        )
      `)
      .single();

    if (error) {
      console.warn('Supabase product_variants update error, updating local cache:', error.message);
      const local = getLocalVariantsCache();
      const idx = local.findIndex((v) => v.id === variantId);
      if (idx !== -1) {
        local[idx] = {
          ...local[idx],
          ...updatePayload,
          size_value: extra?.size_value || local[idx].size_value,
          color_name: extra?.color_name || local[idx].color_name,
          color_code: extra?.color_code || local[idx].color_code,
        };
        setLocalVariantsCache(local);
        return { data: local[idx], error: null };
      }
      return { data: null, error: new Error(error.message) };
    }

    const row = data as any;
    const formatted: ProductVariant = {
      id: row.id,
      product_id: row.product_id,
      product_color_id: row.product_color_id,
      size_id: row.size_id,
      barcode: row.barcode,
      mrp: Number(row.mrp),
      s_p: Number(row.s_p),
      p_p: Number(row.p_p),
      quantity: Number(row.quantity),
      status: row.status,
      online_available: row.online_available,
      on_landing_page: row.on_landing_page,
      created_at: row.created_at,
      updated_at: row.updated_at,
      size_value: row.size?.value || extra?.size_value,
      color_name: row.product_color?.color?.name || extra?.color_name,
      color_code: row.product_color?.color?.code || extra?.color_code,
    };

    const local = getLocalVariantsCache();
    const idx = local.findIndex((v) => v.id === variantId);
    if (idx !== -1) {
      local[idx] = formatted;
    } else {
      local.push(formatted);
    }
    setLocalVariantsCache(local);

    return { data: formatted, error: null };
  } catch (err: unknown) {
    const local = getLocalVariantsCache();
    const idx = local.findIndex((v) => v.id === variantId);
    if (idx !== -1) {
      local[idx] = {
        ...local[idx],
        ...updatePayload,
        size_value: extra?.size_value || local[idx].size_value,
        color_name: extra?.color_name || local[idx].color_name,
        color_code: extra?.color_code || local[idx].color_code,
      };
      setLocalVariantsCache(local);
      return { data: local[idx], error: null };
    }
    const errorMsg = err instanceof Error ? err.message : 'Update failed';
    return { data: null, error: new Error(errorMsg) };
  }
}

/**
 * Delete a product variant
 */
export async function deleteProductVariant(
  variantId: string
): Promise<{ success: boolean; error: Error | null }> {
  try {
    const { error } = await supabase
      .from('product_variants')
      .delete()
      .eq('id', variantId);

    const local = getLocalVariantsCache();
    setLocalVariantsCache(local.filter((v) => v.id !== variantId));

    if (error) {
      return { success: false, error: new Error(error.message) };
    }
    return { success: true, error: null };
  } catch {
    const local = getLocalVariantsCache();
    setLocalVariantsCache(local.filter((v) => v.id !== variantId));
    return { success: true, error: null };
  }
}
