import { supabase } from './supabase';
import { ColorItem, getColors } from './settingsStore';
import { Product } from './productsStore';

export interface ProductColor {
  id: string;
  product_id: string;
  color_id: string;
  front_image?: string | null;
  status: boolean;
  created_at: string;
  updated_at?: string;
  color?: ColorItem;
}

export interface ProductColorImage {
  id: string;
  product_id: string;
  product_color_id: string;
  image_url: string;
  display_order?: number;
  created_at: string;
}

const PRODUCT_COLORS_CACHE_KEY = 'menexpress_product_colors_cache';
const PRODUCT_IMAGES_CACHE_KEY = 'menexpress_product_images_cache';

function getLocalProductColorsCache(): ProductColor[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(PRODUCT_COLORS_CACHE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function setLocalProductColorsCache(items: ProductColor[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(PRODUCT_COLORS_CACHE_KEY, JSON.stringify(items));
  } catch {
    // Ignore storage write errors
  }
}

function getLocalImagesCache(): ProductColorImage[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(PRODUCT_IMAGES_CACHE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function setLocalImagesCache(items: ProductColorImage[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(PRODUCT_IMAGES_CACHE_KEY, JSON.stringify(items));
  } catch {
    // Ignore storage write errors
  }
}

/**
 * Fetch a single product by UUID or prod_id
 */
export async function getProductDetails(
  idOrProdId: string
): Promise<{ data: Product | null; error: Error | null }> {
  try {
    let query = supabase
      .from('products')
      .select('*, categories:category_id(id, name, cat_id)')
      .eq('id', idOrProdId);

    let { data, error } = await query.maybeSingle();

    if (!data) {
      const prodIdQuery = await supabase
        .from('products')
        .select('*, categories:category_id(id, name, cat_id)')
        .eq('prod_id', idOrProdId)
        .maybeSingle();

      if (prodIdQuery.data) {
        data = prodIdQuery.data;
        error = null;
      }
    }

    if (error && !data) {
      if (typeof window !== 'undefined') {
        const cachedProducts = localStorage.getItem('menexpress_products_cache');
        if (cachedProducts) {
          const list: Product[] = JSON.parse(cachedProducts);
          const found = list.find(
            (p) => p.id === idOrProdId || p.prod_id === idOrProdId
          );
          if (found) return { data: found, error: null };
        }
      }
      return { data: null, error: new Error(error.message) };
    }

    if (data) {
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
        category_name: row.categories?.name,
      };
      return { data: formatted, error: null };
    }

    return { data: null, error: null };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to fetch product';
    return { data: null, error: new Error(errorMsg) };
  }
}

/**
 * Get all available master colors from the colors table
 */
export async function getMasterColors(): Promise<{
  data: ColorItem[];
  error: Error | null;
}> {
  return getColors();
}

/**
 * Fetch all assigned colors for a specific product
 */
export async function getProductColors(
  productId: string
): Promise<{ data: ProductColor[]; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('product_colors')
      .select('*, color:color_id(id, name, code)')
      .eq('product_id', productId)
      .order('created_at', { ascending: true });

    if (error) {
      console.warn('Supabase product_colors fetch error, using local cache:', error.message);
      const local = getLocalProductColorsCache().filter(
        (pc) => pc.product_id === productId
      );
      return { data: local, error: new Error(error.message) };
    }

    if (data) {
      const formatted: ProductColor[] = (data as any[]).map((row) => ({
        id: row.id,
        product_id: row.product_id,
        color_id: row.color_id,
        status: row.status,
        created_at: row.created_at,
        updated_at: row.updated_at,
        color: row.color,
      }));

      const local = getLocalProductColorsCache().filter(
        (pc) => pc.product_id !== productId
      );
      setLocalProductColorsCache([...local, ...formatted]);

      return { data: formatted, error: null };
    }

    return { data: [], error: null };
  } catch (err: unknown) {
    const local = getLocalProductColorsCache().filter(
      (pc) => pc.product_id === productId
    );
    const errorMsg = err instanceof Error ? err.message : 'Unknown network error';
    return { data: local, error: new Error(errorMsg) };
  }
}

/**
 * Add a color to a product and store in product_colors table
 */
export async function addProductColor(
  productId: string,
  colorId: string,
  colorObj?: ColorItem
): Promise<{ data: ProductColor | null; error: Error | null }> {
  const payload = {
    product_id: productId,
    color_id: colorId,
    status: true,
  };

  try {
    const { data, error } = await supabase
      .from('product_colors')
      .insert([payload])
      .select('*, color:color_id(id, name, code)')
      .single();

    if (error) {
      console.warn('Supabase product_colors insert failed, saving to local cache:', error.message);
      const local = getLocalProductColorsCache();
      const newItem: ProductColor = {
        id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `pc-${Date.now()}`,
        product_id: productId,
        color_id: colorId,
        status: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        color: colorObj,
      };
      setLocalProductColorsCache([...local, newItem]);
      return { data: newItem, error: null };
    }

    const row = data as any;
    const formatted: ProductColor = {
      id: row.id,
      product_id: row.product_id,
      color_id: row.color_id,
      status: row.status,
      created_at: row.created_at,
      updated_at: row.updated_at,
      color: row.color || colorObj,
    };

    const local = getLocalProductColorsCache();
    setLocalProductColorsCache([
      ...local.filter((pc) => pc.id !== formatted.id),
      formatted,
    ]);

    return { data: formatted, error: null };
  } catch (err: unknown) {
    const local = getLocalProductColorsCache();
    const newItem: ProductColor = {
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `pc-${Date.now()}`,
      product_id: productId,
      color_id: colorId,
      status: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      color: colorObj,
    };
    setLocalProductColorsCache([...local, newItem]);
    return { data: newItem, error: null };
  }
}

/**
 * Delete a product color
 */
export async function deleteProductColor(
  productColorId: string
): Promise<{ success: boolean; error: Error | null }> {
  try {
    const { error } = await supabase
      .from('product_colors')
      .delete()
      .eq('id', productColorId);

    const local = getLocalProductColorsCache();
    setLocalProductColorsCache(local.filter((pc) => pc.id !== productColorId));

    if (error) {
      return { success: true, error: new Error(error.message) };
    }
    return { success: true, error: null };
  } catch {
    const local = getLocalProductColorsCache();
    setLocalProductColorsCache(local.filter((pc) => pc.id !== productColorId));
    return { success: true, error: null };
  }
}

/**
 * Fetch images for a product color from product_color_images table
 */
export async function getProductColorImages(
  productId: string,
  productColorId?: string
): Promise<{ data: ProductColorImage[]; error: Error | null }> {
  try {
    let query = supabase
      .from('product_color_images')
      .select('*')
      .eq('product_id', productId)
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (productColorId) {
      query = query.eq('product_color_id', productColorId);
    }

    const { data, error } = await query;

    if (error) {
      console.warn('Supabase product_color_images fetch error, using local cache:', error.message);
      let local = getLocalImagesCache().filter((img) => img.product_id === productId);
      if (productColorId) {
        local = local.filter((img) => img.product_color_id === productColorId);
      }
      return { data: local, error: new Error(error.message) };
    }

    if (data) {
      const formatted = data as ProductColorImage[];
      const local = getLocalImagesCache().filter(
        (img) => img.product_id !== productId
      );
      setLocalImagesCache([...local, ...formatted]);
      return { data: formatted, error: null };
    }

    return { data: [], error: null };
  } catch (err: unknown) {
    let local = getLocalImagesCache().filter((img) => img.product_id === productId);
    if (productColorId) {
      local = local.filter((img) => img.product_color_id === productColorId);
    }
    const errorMsg = err instanceof Error ? err.message : 'Unknown network error';
    return { data: local, error: new Error(errorMsg) };
  }
}

/**
 * STRICT UPLOAD: Store images very strictly ONLY on supabase storage bucket
 * "product_color_images_bucket" and store that url in the product_color_images table.
 * If it fails, raise an error message.
 */
export async function uploadProductColorImage(
  productId: string,
  productColorId: string,
  file: File
): Promise<{ data: ProductColorImage | null; error: Error | null }> {
  const fileExt = file.name.split('.').pop() || 'jpg';
  const cleanFileName = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${fileExt}`;
  const storagePath = `${productId}/${productColorId}/${cleanFileName}`;

  // 1. Upload strictly to 'product_color_images_bucket' bucket
  const { error: uploadError } = await supabase.storage
    .from('product_color_images_bucket')
    .upload(storagePath, file, {
      cacheControl: '3600',
      upsert: true,
    });

  if (uploadError) {
    const errorMsg = `Failed to upload image to bucket 'product_color_images_bucket': ${uploadError.message}`;
    console.error(errorMsg);
    return { data: null, error: new Error(errorMsg) };
  }

  // 2. Get public URL from supabase storage
  const { data: urlData } = supabase.storage
    .from('product_color_images_bucket')
    .getPublicUrl(storagePath);

  if (!urlData?.publicUrl) {
    const errorMsg = `Failed to get public URL for uploaded file in 'product_color_images_bucket'.`;
    return { data: null, error: new Error(errorMsg) };
  }

  const imageUrl = urlData.publicUrl;

  // 3. Store that URL strictly in product_color_images table
  const payload = {
    product_id: productId,
    product_color_id: productColorId,
    image_url: imageUrl,
  };

  const { data, error: dbError } = await supabase
    .from('product_color_images')
    .insert([payload])
    .select()
    .single();

  if (dbError) {
    const errorMsg = `Image uploaded to bucket, but failed to insert into product_color_images table: ${dbError.message}`;
    console.error(errorMsg);
    return { data: null, error: new Error(errorMsg) };
  }

  const newItem = data as ProductColorImage;
  const local = getLocalImagesCache();
  setLocalImagesCache([...local, newItem]);
  return { data: newItem, error: null };
}

/**
 * Delete image from product_color_images table and storage
 */
export async function deleteProductColorImage(
  imageId: string
): Promise<{ success: boolean; error: Error | null }> {
  try {
    const { error } = await supabase
      .from('product_color_images')
      .delete()
      .eq('id', imageId);

    const local = getLocalImagesCache();
    setLocalImagesCache(local.filter((img) => img.id !== imageId));

    if (error) {
      return { success: false, error: new Error(error.message) };
    }
    return { success: true, error: null };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Delete image failed';
    return { success: false, error: new Error(errorMsg) };
  }
}

/**
 * Update display order for all images of a product color and set front_image on product_colors.
 * The image with display_order = 1 will be set as product_colors.front_image.
 */
export async function updateProductColorImagesOrder(
  productColorId: string,
  imageOrders: { id: string; display_order: number }[]
): Promise<{ success: boolean; frontImageId: string | null; error: Error | null }> {
  try {
    // 1. Update display_order for each image in product_color_images
    for (const item of imageOrders) {
      const { error: imgError } = await supabase
        .from('product_color_images')
        .update({ display_order: item.display_order })
        .eq('id', item.id);

      if (imgError) {
        return {
          success: false,
          frontImageId: null,
          error: new Error(`Failed to update display order: ${imgError.message}`),
        };
      }
    }

    // 2. Identify image with display_order === 1
    const frontItem = imageOrders.find((item) => Number(item.display_order) === 1);
    const frontImageId = frontItem ? frontItem.id : null;

    // 3. Update product_colors.front_image
    if (frontImageId !== null) {
      const { error: pcError } = await supabase
        .from('product_colors')
        .update({
          front_image: frontImageId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', productColorId);

      if (pcError) {
        console.warn('Failed to update product_colors front_image:', pcError.message);
      }
    }

    // 4. Update local cache for images
    const cachedImages = getLocalImagesCache();
    const orderMap = new Map(imageOrders.map((io) => [io.id, Number(io.display_order)]));
    const updatedImages = cachedImages.map((img) => {
      if (orderMap.has(img.id)) {
        return { ...img, display_order: orderMap.get(img.id)! };
      }
      return img;
    });
    setLocalImagesCache(updatedImages);

    // 5. Update local cache for product colors
    const cachedColors = getLocalProductColorsCache();
    const updatedColors = cachedColors.map((pc) => {
      if (pc.id === productColorId && frontImageId) {
        return { ...pc, front_image: frontImageId };
      }
      return pc;
    });
    setLocalProductColorsCache(updatedColors);

    return { success: true, frontImageId, error: null };
  } catch (err: unknown) {
    const errorMsg =
      err instanceof Error ? err.message : 'Failed to update image order';
    return { success: false, frontImageId: null, error: new Error(errorMsg) };
  }
}

