import { supabase } from './supabase';

export interface Category {
  id: string;
  cat_id: string;
  name: string;
  description: string | null;
  status: boolean;
  image?: string | null;
  image_url?: string | null;
  created_at: string;
  updated_at?: string;
}

export interface CreateCategoryInput {
  cat_id: string;
  name: string;
  description?: string;
  status?: boolean;
  image_url?: string | null;
}

export interface UpdateCategoryInput {
  name: string;
  description?: string;
  status: boolean;
  image_url?: string | null;
}

const LOCAL_STORAGE_KEY = 'menexpress_categories_cache';

function getLocalCache(): Category[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function setLocalCache(items: Category[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Ignore storage write errors
  }
}

/**
 * Calculate the auto-filled cat_id using the formula:
 * cat_id = cat_101 + length of categories on every new entry
 */
export function calculateNextCatId(count: number, existingCategories: Category[] = []): string {
  const targetNum = 101 + count;
  let candidateId = `cat_${targetNum}`;

  const existingIds = new Set(existingCategories.map((c) => c.cat_id));
  if (!existingIds.has(candidateId)) {
    return candidateId;
  }

  // If candidate already exists, increment to avoid collisions
  let counter = targetNum;
  while (existingIds.has(`cat_${counter}`)) {
    counter++;
  }
  return `cat_${counter}`;
}

/**
 * Fetch all categories from Supabase with graceful fallback
 */
export async function getCategories(): Promise<{ data: Category[]; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      console.warn('Supabase fetch error, using local cache:', error.message);
      return { data: getLocalCache(), error: new Error(error.message) };
    }

    if (data) {
      setLocalCache(data as Category[]);
      return { data: data as Category[], error: null };
    }

    return { data: getLocalCache(), error: null };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown network error';
    return { data: getLocalCache(), error: new Error(errorMsg) };
  }
}

/**
 * Fetch total count of categories
 */
export async function getCategoryCount(): Promise<{ count: number; error: Error | null }> {
  try {
    const { count, error } = await supabase
      .from('categories')
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
 * Insert a new category into Supabase
 */
/**
 * Upload category image to Supabase storage bucket 'category_images_bucket'
 * and return the public URL.
 */
export async function uploadCategoryImage(
  catId: string,
  file: File
): Promise<{ publicUrl: string | null; error: Error | null }> {
  try {
    const fileExt = file.name.split('.').pop() || 'jpg';
    const cleanFileName = `${catId}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${fileExt}`;
    const storagePath = `${cleanFileName}`;

    const { error: uploadError } = await supabase.storage
      .from('category_images_bucket')
      .upload(storagePath, file, {
        cacheControl: '3600',
        upsert: true,
      });

    if (uploadError) {
      const errorMsg = `Failed to upload image to bucket 'category_images_bucket': ${uploadError.message}`;
      console.error(errorMsg);
      return { publicUrl: null, error: new Error(errorMsg) };
    }

    const { data: urlData } = supabase.storage
      .from('category_images_bucket')
      .getPublicUrl(storagePath);

    if (!urlData?.publicUrl) {
      const errorMsg = `Failed to get public URL for uploaded file in 'category_images_bucket'.`;
      return { publicUrl: null, error: new Error(errorMsg) };
    }

    return { publicUrl: urlData.publicUrl, error: null };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Upload failed';
    return { publicUrl: null, error: new Error(errorMsg) };
  }
}

/**
 * Insert a new category into Supabase
 */
export async function createCategory(
  input: CreateCategoryInput
): Promise<{ data: Category | null; error: Error | null }> {
  const payload = {
    cat_id: input.cat_id.trim(),
    name: input.name.trim(),
    description: input.description?.trim() || null,
    status: typeof input.status === 'boolean' ? input.status : true,
    image_url: input.image_url || null,
  };

  try {
    const { data, error } = await supabase
      .from('categories')
      .insert([payload])
      .select()
      .single();

    if (error) {
      console.warn('Supabase insert failed, saving to local cache fallback:', error.message);
      // Fallback local save
      const local = getLocalCache();
      const newItem: Category = {
        id: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `mock-${Date.now()}`,
        cat_id: payload.cat_id,
        name: payload.name,
        description: payload.description,
        status: payload.status,
        image_url: payload.image_url,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      const updatedList = [...local, newItem];
      setLocalCache(updatedList);
      return { data: newItem, error: null };
    }

    // Update local cache
    const local = getLocalCache();
    const updatedList = [...local.filter((c) => c.cat_id !== data.cat_id), data as Category];
    setLocalCache(updatedList);

    return { data: data as Category, error: null };
  } catch (err: unknown) {
    // Fallback if network or placeholder url
    const local = getLocalCache();
    const newItem: Category = {
      id: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `mock-${Date.now()}`,
      cat_id: payload.cat_id,
      name: payload.name,
      description: payload.description,
      status: payload.status,
      image_url: payload.image_url,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const updatedList = [...local, newItem];
    setLocalCache(updatedList);
    return { data: newItem, error: null };
  }
}

/**
 * Update an existing category by cat_id. Note: cat_id is immutable.
 */
export async function updateCategory(
  cat_id: string,
  input: UpdateCategoryInput
): Promise<{ data: Category | null; error: Error | null }> {
  const updatePayload: Record<string, unknown> = {
    name: input.name.trim(),
    description: input.description?.trim() || null,
    status: input.status,
    updated_at: new Date().toISOString(),
  };

  if (input.image_url !== undefined) {
    updatePayload.image_url = input.image_url;
  }

  try {
    const { data, error } = await supabase
      .from('categories')
      .update(updatePayload)
      .eq('cat_id', cat_id)
      .select()
      .single();

    if (error) {
      console.warn('Supabase update failed, updating local cache fallback:', error.message);
      const local = getLocalCache();
      const idx = local.findIndex((c) => c.cat_id === cat_id);
      if (idx !== -1) {
        local[idx] = {
          ...local[idx],
          ...updatePayload,
        } as Category;
        setLocalCache(local);
        return { data: local[idx], error: null };
      }
      return { data: null, error: new Error(error.message) };
    }

    const local = getLocalCache();
    const idx = local.findIndex((c) => c.cat_id === cat_id);
    if (idx !== -1) {
      local[idx] = data as Category;
    } else {
      local.push(data as Category);
    }
    setLocalCache(local);

    return { data: data as Category, error: null };
  } catch (err: unknown) {
    const local = getLocalCache();
    const idx = local.findIndex((c) => c.cat_id === cat_id);
    if (idx !== -1) {
      local[idx] = {
        ...local[idx],
        ...updatePayload,
      } as Category;
      setLocalCache(local);
      return { data: local[idx], error: null };
    }
    const errorMsg = err instanceof Error ? err.message : 'Update failed';
    return { data: null, error: new Error(errorMsg) };
  }
}
