import { supabase } from './supabase';

export interface ColorItem {
  id: string;
  name: string;
  code: string;
  created_at: string;
}

export interface SizeItem {
  id: string;
  value: string;
  created_at: string;
}

export interface CreateColorInput {
  name: string;
  code: string;
}

export interface CreateSizeInput {
  value: string;
}

const COLORS_CACHE_KEY = 'menexpress_colors_cache';
const SIZES_CACHE_KEY = 'menexpress_sizes_cache';

function getColorsLocalCache(): ColorItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(COLORS_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ColorItem[];
    // Filter out any legacy dummy data
    return Array.isArray(parsed) ? parsed.filter((c) => !c.id.startsWith('c-')) : [];
  } catch {
    return [];
  }
}

function setColorsLocalCache(items: ColorItem[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(COLORS_CACHE_KEY, JSON.stringify(items));
  } catch {
    // Ignore storage write errors
  }
}

function getSizesLocalCache(): SizeItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(SIZES_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SizeItem[];
    // Filter out any legacy dummy data
    return Array.isArray(parsed) ? parsed.filter((s) => !s.id.startsWith('s-')) : [];
  } catch {
    return [];
  }
}

function setSizesLocalCache(items: SizeItem[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SIZES_CACHE_KEY, JSON.stringify(items));
  } catch {
    // Ignore storage write errors
  }
}

/**
 * Fetch all colors from Supabase with fallback
 */
export async function getColors(): Promise<{
  data: ColorItem[];
  error: Error | null;
}> {
  try {
    const { data, error } = await supabase
      .from('colors')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      console.warn('Supabase colors fetch error, using local cache:', error.message);
      return { data: getColorsLocalCache(), error: new Error(error.message) };
    }

    if (data) {
      setColorsLocalCache(data as ColorItem[]);
      return { data: data as ColorItem[], error: null };
    }

    return { data: [], error: null };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown network error';
    return { data: getColorsLocalCache(), error: new Error(errorMsg) };
  }
}

/**
 * Insert a new color into Supabase
 */
export async function createColor(
  input: CreateColorInput
): Promise<{ data: ColorItem | null; error: Error | null }> {
  let hexCode = input.code.trim();
  if (!hexCode.startsWith('#')) {
    hexCode = `#${hexCode}`;
  }

  const payload = {
    name: input.name.trim(),
    code: hexCode,
  };

  try {
    const { data, error } = await supabase
      .from('colors')
      .insert([payload])
      .select()
      .single();

    if (error) {
      console.warn('Supabase color insert failed, using local cache:', error.message);
      const local = getColorsLocalCache();
      const newItem: ColorItem = {
        id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `color-${Date.now()}`,
        name: payload.name,
        code: payload.code,
        created_at: new Date().toISOString(),
      };
      const updatedList = [...local, newItem];
      setColorsLocalCache(updatedList);
      return { data: newItem, error: null };
    }

    const local = getColorsLocalCache();
    const updatedList = [...local.filter((c) => c.id !== data.id), data as ColorItem];
    setColorsLocalCache(updatedList);

    return { data: data as ColorItem, error: null };
  } catch (err: unknown) {
    const local = getColorsLocalCache();
    const newItem: ColorItem = {
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `color-${Date.now()}`,
      name: payload.name,
      code: payload.code,
      created_at: new Date().toISOString(),
    };
    const updatedList = [...local, newItem];
    setColorsLocalCache(updatedList);
    return { data: newItem, error: null };
  }
}

/**
 * Fetch all sizes from Supabase with fallback
 */
export async function getSizes(): Promise<{
  data: SizeItem[];
  error: Error | null;
}> {
  try {
    const { data, error } = await supabase
      .from('sizes')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      console.warn('Supabase sizes fetch error, using local cache:', error.message);
      return { data: getSizesLocalCache(), error: new Error(error.message) };
    }

    if (data) {
      setSizesLocalCache(data as SizeItem[]);
      return { data: data as SizeItem[], error: null };
    }

    return { data: [], error: null };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown network error';
    return { data: getSizesLocalCache(), error: new Error(errorMsg) };
  }
}

/**
 * Insert a new size into Supabase
 */
export async function createSize(
  input: CreateSizeInput
): Promise<{ data: SizeItem | null; error: Error | null }> {
  const payload = {
    value: input.value.trim(),
  };

  try {
    const { data, error } = await supabase
      .from('sizes')
      .insert([payload])
      .select()
      .single();

    if (error) {
      console.warn('Supabase size insert failed, using local cache:', error.message);
      const local = getSizesLocalCache();
      const newItem: SizeItem = {
        id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `size-${Date.now()}`,
        value: payload.value,
        created_at: new Date().toISOString(),
      };
      const updatedList = [...local, newItem];
      setSizesLocalCache(updatedList);
      return { data: newItem, error: null };
    }

    const local = getSizesLocalCache();
    const updatedList = [...local.filter((s) => s.id !== data.id), data as SizeItem];
    setSizesLocalCache(updatedList);

    return { data: data as SizeItem, error: null };
  } catch (err: unknown) {
    const local = getSizesLocalCache();
    const newItem: SizeItem = {
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `size-${Date.now()}`,
      value: payload.value,
      created_at: new Date().toISOString(),
    };
    const updatedList = [...local, newItem];
    setSizesLocalCache(updatedList);
    return { data: newItem, error: null };
  }
}
