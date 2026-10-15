import { supabase } from './supabase';

export interface Product {
  id: string;
  category_id: string;
  prod_id: string;
  name: string;
  fit: string | null;
  collar: string | null;
  fabric: string | null;
  status: boolean;
  landing_page?: boolean;
  created_at: string;
  updated_at?: string;
  category_name?: string;
}

export interface CreateProductInput {
  category_id: string;
  prod_id: string;
  name: string;
  fit?: string;
  collar?: string;
  fabric?: string;
  status?: boolean;
  landing_page?: boolean;
}

export interface UpdateProductInput {
  category_id: string;
  name: string;
  fit?: string;
  collar?: string;
  fabric?: string;
  status: boolean;
  landing_page?: boolean;
}

const LOCAL_STORAGE_KEY = 'menexpress_products_cache';

function getLocalCache(): Product[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function setLocalCache(items: Product[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Ignore storage write errors
  }
}

/**
 * Calculate the auto-filled prod_id using the formula:
 * prod_id = prod_1001 + length of products on every new entry
 */
export function calculateNextProdId(
  count: number,
  existingProducts: Product[] = []
): string {
  const targetNum = 1001 + count;
  let candidateId = `prod_${targetNum}`;

  const existingIds = new Set(existingProducts.map((p) => p.prod_id));
  if (!existingIds.has(candidateId)) {
    return candidateId;
  }

  // If candidate already exists, increment to avoid collisions
  let counter = targetNum;
  while (existingIds.has(`prod_${counter}`)) {
    counter++;
  }
  return `prod_${counter}`;
}

/**
 * Fetch all products from Supabase joined with categories
 */
export async function getProducts(): Promise<{
  data: Product[];
  error: Error | null;
}> {
  try {
    const { data, error } = await supabase
      .from('products')
      .select('*, categories:category_id(id, name, cat_id)')
      .order('created_at', { ascending: true });

    if (error) {
      console.warn('Supabase products fetch error, using local cache:', error.message);
      return { data: getLocalCache(), error: new Error(error.message) };
    }

    if (data) {
      const formatted: Product[] = (data as any[]).map((row) => ({
        id: row.id,
        category_id: row.category_id,
        prod_id: row.prod_id,
        name: row.name,
        fit: row.fit || null,
        collar: row.collar || null,
        fabric: row.fabric || null,
        status: typeof row.status === 'boolean' ? row.status : true,
        landing_page: typeof row.landing_page === 'boolean' ? row.landing_page : false,
        created_at: row.created_at,
        updated_at: row.updated_at,
        category_name: row.categories?.name || undefined,
      }));

      setLocalCache(formatted);
      return { data: formatted, error: null };
    }

    return { data: [], error: null };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown network error';
    return { data: getLocalCache(), error: new Error(errorMsg) };
  }
}

/**
 * Fetch total count of products
 */
export async function getProductCount(): Promise<{
  count: number;
  error: Error | null;
}> {
  try {
    const { count, error } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true });

    if (error || count === null) {
      const local = getLocalCache();
      return { count: local.length, error: error ? new Error(error.message) : null };
    }

    return { count, error: null };
  } catch {
    const local = getLocalCache();
    return { count: local.length, error: null };
  }
}

/**
 * Insert a new product into Supabase
 */
export async function createProduct(
  input: CreateProductInput,
  categoryName?: string
): Promise<{ data: Product | null; error: Error | null }> {
  const payload = {
    category_id: input.category_id,
    prod_id: input.prod_id.trim(),
    name: input.name.trim(),
    fit: input.fit?.trim() || null,
    collar: input.collar?.trim() || null,
    fabric: input.fabric?.trim() || null,
    status: typeof input.status === 'boolean' ? input.status : true,
  };

  try {
    const { data, error } = await supabase
      .from('products')
      .insert([payload])
      .select('*, categories:category_id(id, name, cat_id)')
      .single();

    if (error) {
      console.warn('Supabase product insert failed, saving to local cache fallback:', error.message);
      const local = getLocalCache();
      const newItem: Product = {
        id:
          typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : `mock-prod-${Date.now()}`,
        category_id: payload.category_id,
        prod_id: payload.prod_id,
        name: payload.name,
        fit: payload.fit,
        collar: payload.collar,
        fabric: payload.fabric,
        status: payload.status,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        category_name: categoryName,
      };
      const updatedList = [...local, newItem];
      setLocalCache(updatedList);
      return { data: newItem, error: null };
    }

    const row = data as any;
    const formatted: Product = {
      id: row.id,
      category_id: row.category_id,
      prod_id: row.prod_id,
      name: row.name,
      fit: row.fit,
      collar: row.collar,
      fabric: row.fabric,
      status: row.status,
      created_at: row.created_at,
      updated_at: row.updated_at,
      category_name: row.categories?.name || categoryName,
    };

    const local = getLocalCache();
    const updatedList = [
      ...local.filter((p) => p.prod_id !== formatted.prod_id),
      formatted,
    ];
    setLocalCache(updatedList);

    return { data: formatted, error: null };
  } catch (err: unknown) {
    const local = getLocalCache();
    const newItem: Product = {
      id:
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `mock-prod-${Date.now()}`,
      category_id: payload.category_id,
      prod_id: payload.prod_id,
      name: payload.name,
      fit: payload.fit,
      collar: payload.collar,
      fabric: payload.fabric,
      status: payload.status,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      category_name: categoryName,
    };
    const updatedList = [...local, newItem];
    setLocalCache(updatedList);
    return { data: newItem, error: null };
  }
}

/**
 * Update an existing product by prod_id. Note: prod_id is immutable.
 */
export async function updateProduct(
  prod_id: string,
  input: UpdateProductInput,
  categoryName?: string
): Promise<{ data: Product | null; error: Error | null }> {
  const updatePayload = {
    category_id: input.category_id,
    name: input.name.trim(),
    fit: input.fit?.trim() || null,
    collar: input.collar?.trim() || null,
    fabric: input.fabric?.trim() || null,
    status: input.status,
    landing_page: typeof input.landing_page === 'boolean' ? input.landing_page : false,
    updated_at: new Date().toISOString(),
  };

  try {
    const { data, error } = await supabase
      .from('products')
      .update(updatePayload)
      .eq('prod_id', prod_id)
      .select('*, categories:category_id(id, name, cat_id)')
      .single();

    if (error) {
      console.warn('Supabase product update failed, updating local cache fallback:', error.message);
      const local = getLocalCache();
      const idx = local.findIndex((p) => p.prod_id === prod_id);
      if (idx !== -1) {
        local[idx] = {
          ...local[idx],
          ...updatePayload,
          category_name: categoryName || local[idx].category_name,
        };
        setLocalCache(local);
        return { data: local[idx], error: null };
      }
      return { data: null, error: new Error(error.message) };
    }

    const row = data as any;
    const formatted: Product = {
      id: row.id,
      category_id: row.category_id,
      prod_id: row.prod_id,
      name: row.name,
      fit: row.fit,
      collar: row.collar,
      fabric: row.fabric,
      status: row.status,
      landing_page: typeof row.landing_page === 'boolean' ? row.landing_page : false,
      created_at: row.created_at,
      updated_at: row.updated_at,
      category_name: row.categories?.name || categoryName,
    };

    const local = getLocalCache();
    const idx = local.findIndex((p) => p.prod_id === prod_id);
    if (idx !== -1) {
      local[idx] = formatted;
    } else {
      local.push(formatted);
    }
    setLocalCache(local);

    return { data: formatted, error: null };
  } catch (err: unknown) {
    const local = getLocalCache();
    const idx = local.findIndex((p) => p.prod_id === prod_id);
    if (idx !== -1) {
      local[idx] = {
        ...local[idx],
        ...updatePayload,
        category_name: categoryName || local[idx].category_name,
      };
      setLocalCache(local);
      return { data: local[idx], error: null };
    }
    const errorMsg = err instanceof Error ? err.message : 'Update failed';
    return { data: null, error: new Error(errorMsg) };
  }
}
