'use client';

import React, { Suspense, useEffect, useState, useMemo, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Palette,
  Upload,
  Plus,
  Trash2,
  Loader2,
  Image as ImageIcon,
  AlertCircle,
  Shirt,
  Eye,
  EyeOff,
  Check,
  Star,
} from 'lucide-react';
import { getCurrentSupabaseUser } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import AdminHeader from '@/components/admin/header';
import AdminSidebar from '@/components/admin/sidebar';
import { Product } from '@/lib/productsStore';
import { ColorItem } from '@/lib/settingsStore';
import {
  ProductColor,
  ProductColorImage,
  getProductDetails,
  getMasterColors,
  getProductColors,
  addProductColor,
  deleteProductColor,
  getProductColorImages,
  uploadProductColorImage,
  deleteProductColorImage,
  updateProductColorImagesOrder,
} from '@/lib/productcolorsStore';

function ProductColorsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const productIdParam =
    searchParams.get('product_id') ||
    searchParams.get('id') ||
    searchParams.get('prod_id');

  const [isAuthorized, setIsAuthorized] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Product details
  const [product, setProduct] = useState<Product | null>(null);
  const [productLoading, setProductLoading] = useState(true);

  // Master colors & product colors
  const [masterColors, setMasterColors] = useState<ColorItem[]>([]);
  const [productColors, setProductColors] = useState<ProductColor[]>([]);
  const [selectedColorToAdd, setSelectedColorToAdd] = useState('');
  const [addingColorLoading, setAddingColorLoading] = useState(false);

  // Images state per color: loaded ONLY when user taps "View Images"
  const [loadedImagesByColor, setLoadedImagesByColor] = useState<{
    [colorId: string]: ProductColorImage[];
  }>({});
  const [expandedColorIds, setExpandedColorIds] = useState<{
    [colorId: string]: boolean;
  }>({});
  const [loadingImagesForColor, setLoadingImagesForColor] = useState<{
    [colorId: string]: boolean;
  }>({});
  const [uploadingColorId, setUploadingColorId] = useState<string | null>(null);

  // Display orders state per color: { [colorId]: { [imageId]: number } }
  const [selectedOrdersByColor, setSelectedOrdersByColor] = useState<{
    [colorId: string]: { [imageId: string]: number };
  }>({});
  const [savingOrderColorId, setSavingOrderColorId] = useState<string | null>(null);

  const [feedbackMessage, setFeedbackMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const fileInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});

  // Auth check
  useEffect(() => {
    let isMounted = true;

    async function checkAuth() {
      try {
        const { user, role } = await getCurrentSupabaseUser();
        if (!isMounted) return;

        if (user && role === 'admin') {
          setIsAuthorized(true);
          setAuthLoading(false);
        } else {
          router.replace('/login');
        }
      } catch {
        if (isMounted) {
          router.replace('/login');
        }
      }
    }

    checkAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return;
      if (event === 'SIGNED_OUT' || !session) {
        router.replace('/login');
      } else if (session?.user) {
        const { role } = await getCurrentSupabaseUser();
        if (role === 'admin') {
          setIsAuthorized(true);
          setAuthLoading(false);
        } else {
          router.replace('/login');
        }
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [router]);

  // Load product data & master colors & product colors (DO NOT load images automatically)
  useEffect(() => {
    let ignore = false;
    if (isAuthorized && productIdParam) {
      Promise.all([
        getProductDetails(productIdParam),
        getMasterColors(),
      ]).then(([prodRes, colorsRes]) => {
        if (ignore) return;

        if (prodRes.data) {
          setProduct(prodRes.data);
          const actualId = prodRes.data.id;

          getProductColors(actualId).then((pColorsRes) => {
            if (ignore) return;
            if (pColorsRes.data) setProductColors(pColorsRes.data);
            setProductLoading(false);
          });
        } else {
          setProductLoading(false);
        }

        if (colorsRes.data) {
          setMasterColors(colorsRes.data);
        }
      });
    } else if (isAuthorized && !productIdParam) {
      Promise.resolve().then(() => {
        if (!ignore) {
          setProductLoading(false);
        }
      });
    }

    return () => {
      ignore = true;
    };
  }, [isAuthorized, productIdParam]);

  // Available master colors to add (excluding already assigned)
  const availableColorsToAdd = useMemo(() => {
    const assignedColorIds = new Set(productColors.map((pc) => pc.color_id));
    return masterColors.filter((mc) => !assignedColorIds.has(mc.id));
  }, [masterColors, productColors]);

  // Handle adding a color to this product
  const handleAddColor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product || !selectedColorToAdd) return;

    setAddingColorLoading(true);
    setFeedbackMessage(null);

    const chosenColor = masterColors.find((c) => c.id === selectedColorToAdd);

    try {
      const { data, error } = await addProductColor(
        product.id,
        selectedColorToAdd,
        chosenColor
      );

      if (error && !data) {
        setFeedbackMessage({
          type: 'error',
          text: error.message || 'Failed to add color to product.',
        });
        setAddingColorLoading(false);
        return;
      }

      if (data) {
        setProductColors((prev) => [...prev, data]);
        setSelectedColorToAdd('');
        setFeedbackMessage({
          type: 'success',
          text: `Added color ${chosenColor?.name || ''} to ${product.name}!`,
        });
      }
    } catch {
      setFeedbackMessage({
        type: 'error',
        text: 'An unexpected error occurred.',
      });
    } finally {
      setAddingColorLoading(false);
    }
  };

  // Handle deleting a color from this product
  const handleDeleteProductColor = async (productColorId: string) => {
    if (!confirm('Are you sure you want to remove this color from the product?')) {
      return;
    }

    const { error } = await deleteProductColor(productColorId);
    if (!error) {
      setProductColors((prev) => prev.filter((pc) => pc.id !== productColorId));
      setLoadedImagesByColor((prev) => {
        const copy = { ...prev };
        delete copy[productColorId];
        return copy;
      });
    }
  };

  // User taps "View Images": Load images ONLY when tapped!
  const handleToggleViewImages = async (productColorId: string) => {
    const isCurrentlyExpanded = Boolean(expandedColorIds[productColorId]);

    // If currently expanded, just collapse
    if (isCurrentlyExpanded) {
      setExpandedColorIds((prev) => ({ ...prev, [productColorId]: false }));
      return;
    }

    // Expanding: set open
    setExpandedColorIds((prev) => ({ ...prev, [productColorId]: true }));

    // If images already fetched for this color, no need to re-fetch unless requested
    if (loadedImagesByColor[productColorId] !== undefined) {
      return;
    }

    // Fetch images on-demand for this specific color
    if (!product) return;
    setLoadingImagesForColor((prev) => ({ ...prev, [productColorId]: true }));

    try {
      const { data, error } = await getProductColorImages(
        product.id,
        productColorId
      );

      if (error) {
        setFeedbackMessage({
          type: 'error',
          text: `Failed to load images: ${error.message}`,
        });
      } else {
        const imgs = data || [];
        setLoadedImagesByColor((prev) => ({
          ...prev,
          [productColorId]: imgs,
        }));

        const orderMap: { [imageId: string]: number } = {};
        imgs.forEach((img, idx) => {
          orderMap[img.id] =
            typeof img.display_order === 'number' && img.display_order > 0
              ? img.display_order
              : idx + 1;
        });
        setSelectedOrdersByColor((prev) => ({
          ...prev,
          [productColorId]: orderMap,
        }));
      }
    } catch {
      setFeedbackMessage({
        type: 'error',
        text: 'Failed to load color images.',
      });
    } finally {
      setLoadingImagesForColor((prev) => ({ ...prev, [productColorId]: false }));
    }
  };

  // Upload images strictly to 'product_color_images_bucket'
  const handleImageFileChange = async (
    productColorId: string,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !product) return;

    setUploadingColorId(productColorId);
    setFeedbackMessage(null);

    const uploadPromises: Promise<any>[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      uploadPromises.push(
        uploadProductColorImage(product.id, productColorId, file)
      );
    }

    try {
      const results = await Promise.all(uploadPromises);
      const newImages: ProductColorImage[] = [];
      let hadError = false;
      let lastErrorMessage = '';

      for (const res of results) {
        if (res.data) {
          newImages.push(res.data);
        }
        if (res.error) {
          hadError = true;
          lastErrorMessage = res.error.message;
        }
      }

      if (newImages.length > 0) {
        const combined = [...(loadedImagesByColor[productColorId] || []), ...newImages];
        setLoadedImagesByColor((prev) => ({
          ...prev,
          [productColorId]: combined,
        }));

        setSelectedOrdersByColor((prev) => {
          const map = { ...(prev[productColorId] || {}) };
          combined.forEach((img, idx) => {
            if (!map[img.id]) {
              map[img.id] =
                typeof img.display_order === 'number' && img.display_order > 0
                  ? img.display_order
                  : idx + 1;
            }
          });
          return { ...prev, [productColorId]: map };
        });

        setFeedbackMessage({
          type: 'success',
          text: `Successfully uploaded ${newImages.length} image(s) to 'product_color_images_bucket' bucket!`,
        });
      }

      if (hadError) {
        setFeedbackMessage({
          type: 'error',
          text: `Storage Upload Error: ${lastErrorMessage}`,
        });
      }
    } catch (err: unknown) {
      const errorMsg =
        err instanceof Error ? err.message : 'Storage upload failed.';
      setFeedbackMessage({
        type: 'error',
        text: `Error: ${errorMsg}`,
      });
    } finally {
      setUploadingColorId(null);
      if (fileInputRefs.current[productColorId]) {
        fileInputRefs.current[productColorId]!.value = '';
      }
    }
  };

  // Change display order for an image
  const handleOrderChange = (colorId: string, imageId: string, newOrder: number) => {
    setSelectedOrdersByColor((prev) => ({
      ...prev,
      [colorId]: {
        ...(prev[colorId] || {}),
        [imageId]: newOrder,
      },
    }));
  };

  // Tap "Done" to save display order and set display_order = 1 as front_image
  const handleSaveDisplayOrder = async (colorId: string) => {
    const images = loadedImagesByColor[colorId] || [];
    if (images.length === 0) return;

    setSavingOrderColorId(colorId);
    setFeedbackMessage(null);

    const orderMap = selectedOrdersByColor[colorId] || {};
    const updates = images.map((img, idx) => ({
      id: img.id,
      display_order: orderMap[img.id] ?? (idx + 1),
    }));

    const { success, frontImageId, error } = await updateProductColorImagesOrder(
      colorId,
      updates
    );

    setSavingOrderColorId(null);

    if (!success || error) {
      setFeedbackMessage({
        type: 'error',
        text: error?.message || 'Failed to update image display order.',
      });
      return;
    }

    // Sort local images by display_order
    const updatedImages = images
      .map((img) => ({
        ...img,
        display_order: orderMap[img.id] ?? img.display_order,
      }))
      .sort((a, b) => (Number(a.display_order) || 0) - (Number(b.display_order) || 0));

    setLoadedImagesByColor((prev) => ({
      ...prev,
      [colorId]: updatedImages,
    }));

    // Update productColors front_image
    setProductColors((prev) =>
      prev.map((pc) =>
        pc.id === colorId ? { ...pc, front_image: frontImageId } : pc
      )
    );

    setFeedbackMessage({
      type: 'success',
      text: 'Display order updated! The image with display order 1 is now set as the front image.',
    });
  };

  // Delete image
  const handleDeleteImage = async (imageId: string, productColorId: string) => {
    if (!confirm('Are you sure you want to delete this image?')) return;

    const { success, error } = await deleteProductColorImage(imageId);
    if (success) {
      setLoadedImagesByColor((prev) => ({
        ...prev,
        [productColorId]: (prev[productColorId] || []).filter(
          (img) => img.id !== imageId
        ),
      }));

      setSelectedOrdersByColor((prev) => {
        const copy = { ...(prev[productColorId] || {}) };
        delete copy[imageId];
        return { ...prev, [productColorId]: copy };
      });
    } else if (error) {
      setFeedbackMessage({
        type: 'error',
        text: error.message,
      });
    }
  };

  if (authLoading) {
    return (
      <div className="layout-page-container layout-flex-center min-h-screen bg-white">
        <p className="typo-body text-zinc-600">Loading...</p>
      </div>
    );
  }

  if (!isAuthorized) {
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col bg-white w-full max-w-full overflow-x-hidden">
      <AdminHeader
        onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
        isSidebarOpen={sidebarOpen}
      />

      <div className="flex flex-1 min-h-[calc(100vh-4rem)] w-full max-w-full relative overflow-x-hidden">
        <AdminSidebar
          mobileOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        <main className="flex-1 p-4 sm:p-6 md:p-8 w-full max-w-full overflow-x-hidden bg-white">
          <div className="max-w-5xl mx-auto space-y-6">
            {/* Top Navigation */}
            <div className="flex items-center justify-between pb-4 border-b border-zinc-200">
              <Link
                href="/admin/products"
                className="inline-flex items-center gap-2 text-sm font-medium text-black hover:text-zinc-600 transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4 text-black" />
                <span>Back to Products</span>
              </Link>

              {product && (
                <span className="font-mono text-xs px-2.5 py-1 bg-zinc-100 border border-zinc-300 rounded font-semibold text-black">
                  {product.prod_id}
                </span>
              )}
            </div>

            {feedbackMessage && (
              <div
                className={`p-3 rounded-lg text-sm flex items-center justify-between ${
                  feedbackMessage.type === 'success'
                    ? 'bg-green-50 border border-green-200 text-green-800'
                    : 'bg-red-50 border border-red-200 text-red-800'
                }`}
              >
                <span>{feedbackMessage.text}</span>
                <button
                  type="button"
                  onClick={() => setFeedbackMessage(null)}
                  className="text-xs font-semibold underline cursor-pointer ml-4"
                >
                  Dismiss
                </button>
              </div>
            )}

            {/* Product Loading / Not Found State */}
            {productLoading ? (
              <div className="p-12 text-center text-zinc-500">
                <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-black" />
                <p className="text-sm">Loading product and colors...</p>
              </div>
            ) : !product ? (
              <div className="ui-card p-8 text-center space-y-4 border border-zinc-200 rounded-xl">
                <AlertCircle className="w-10 h-10 text-zinc-400 mx-auto" />
                <div>
                  <h3 className="text-base font-bold text-black">
                    Product Not Found
                  </h3>
                  <p className="text-xs text-zinc-500 mt-1">
                    No product found for the specified ID ({productIdParam || 'none'}).
                  </p>
                </div>
                <Link
                  href="/admin/products"
                  className="ui-btn ui-btn-grey ui-btn-md inline-flex items-center gap-2 cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4 text-white" />
                  <span>Return to Products List</span>
                </Link>
              </div>
            ) : (
              <>
                {/* Product Summary Banner */}
                <div className="ui-card p-5 sm:p-6 border border-zinc-200 rounded-xl bg-zinc-50 shadow-xs space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-white rounded-lg border border-zinc-200 shadow-xs">
                        <Shirt className="w-6 h-6 text-black" />
                      </div>
                      <div>
                        <h1 className="text-xl sm:text-2xl font-bold text-black tracking-tight">
                          {product.name}
                        </h1>
                        <p className="text-xs sm:text-sm text-zinc-500">
                          Category: {product.category_name || 'Standard'} • ID: {product.prod_id}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {product.status ? (
                        <span className="ui-badge ui-badge-success text-xs font-medium">
                          Active
                        </span>
                      ) : (
                        <span className="ui-badge ui-badge-default text-xs font-medium">
                          Inactive
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-zinc-200 text-xs">
                    <div>
                      <span className="text-zinc-500 block">Fit</span>
                      <span className="font-semibold text-black">
                        {product.fit || '—'}
                      </span>
                    </div>
                    <div>
                      <span className="text-zinc-500 block">Collar</span>
                      <span className="font-semibold text-black">
                        {product.collar || '—'}
                      </span>
                    </div>
                    <div>
                      <span className="text-zinc-500 block">Fabric</span>
                      <span className="font-semibold text-black">
                        {product.fabric || '—'}
                      </span>
                    </div>
                    <div>
                      <span className="text-zinc-500 block">Total Colors</span>
                      <span className="font-semibold text-black font-mono">
                        {productColors.length}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Section: Product Colors Management */}
                <div className="ui-card p-5 sm:p-6 border border-zinc-200 rounded-xl bg-white shadow-xs space-y-5">
                  <div className="pb-3 border-b border-zinc-100">
                    <h2 className="text-base sm:text-lg font-bold text-black flex items-center gap-2">
                      <Palette className="w-5 h-5 text-black" />
                      <span>Product Available Colors</span>
                    </h2>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      Specify in which colors this product is available. Stored in product_colors table.
                    </p>
                  </div>

                  {/* Add Color Form */}
                  <form
                    onSubmit={handleAddColor}
                    className="p-4 bg-zinc-50 border border-zinc-200 rounded-lg flex flex-col sm:flex-row items-stretch sm:items-end gap-3"
                  >
                    <div className="flex-1">
                      <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-700 mb-1.5">
                        Select Color from Master Palette
                      </label>
                      <select
                        value={selectedColorToAdd}
                        onChange={(e) => setSelectedColorToAdd(e.target.value)}
                        className="ui-select text-sm text-black border border-zinc-300 focus:border-black rounded-lg w-full bg-white cursor-pointer"
                        disabled={addingColorLoading}
                      >
                        <option value="">-- Choose a color to add --</option>
                        {availableColorsToAdd.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name} ({c.code})
                          </option>
                        ))}
                      </select>
                    </div>

                    <button
                      type="submit"
                      disabled={addingColorLoading || !selectedColorToAdd}
                      className="ui-btn ui-btn-grey ui-btn-md font-medium px-5 cursor-pointer shadow-xs flex items-center justify-center gap-1.5"
                    >
                      {addingColorLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <Plus className="w-4 h-4 text-white" />
                          <span>Add Color</span>
                        </>
                      )}
                    </button>
                  </form>

                  {/* Colors List & On-Demand Image Viewer */}
                  <div className="space-y-4 pt-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-zinc-600 block">
                      Configured Colors ({productColors.length})
                    </span>

                    {productColors.length === 0 ? (
                      <div className="p-8 border border-dashed border-zinc-300 rounded-lg text-center text-xs text-zinc-500">
                        No colors assigned to this product yet. Choose a color above and click &quot;Add Color&quot;.
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {productColors.map((pc) => {
                          const colorObj =
                            pc.color ||
                            masterColors.find((c) => c.id === pc.color_id);
                          const isExpanded = Boolean(expandedColorIds[pc.id]);
                          const isLoadingImages = Boolean(
                            loadingImagesForColor[pc.id]
                          );
                          const colorImages = loadedImagesByColor[pc.id] || [];
                          const isUploading = uploadingColorId === pc.id;

                          return (
                            <div
                              key={pc.id}
                              className="border border-zinc-200 rounded-xl overflow-hidden bg-white shadow-2xs"
                            >
                              {/* Color Card Header */}
                              <div className="p-4 bg-zinc-50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-zinc-200">
                                <div className="flex items-center gap-3">
                                  <span
                                    className="w-6 h-6 rounded-full border border-zinc-300 shadow-xs flex-shrink-0"
                                    style={{
                                      backgroundColor: colorObj?.code || '#ccc',
                                    }}
                                    aria-hidden="true"
                                  />
                                  <div>
                                    <h3 className="font-bold text-sm text-black">
                                      {colorObj?.name || 'Color'}
                                    </h3>
                                    <span className="text-xs font-mono text-zinc-500">
                                      Hex: {colorObj?.code || '—'}
                                    </span>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2">
                                  {/* View Images Button: loads and displays images ONLY on tap */}
                                  <button
                                    type="button"
                                    onClick={() => handleToggleViewImages(pc.id)}
                                    className="ui-btn ui-btn-grey ui-btn-sm px-3 py-1 font-medium text-xs cursor-pointer inline-flex items-center gap-1.5 shadow-2xs"
                                  >
                                    {isLoadingImages ? (
                                      <>
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                        <span>Loading Images...</span>
                                      </>
                                    ) : isExpanded ? (
                                      <>
                                        <EyeOff className="w-3.5 h-3.5 text-white" />
                                        <span>Hide Images</span>
                                      </>
                                    ) : (
                                      <>
                                        <Eye className="w-3.5 h-3.5 text-white" />
                                        <span>View Images</span>
                                      </>
                                    )}
                                  </button>

                                  {/* Remove color */}
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteProductColor(pc.id)}
                                    className="p-1.5 text-zinc-400 hover:text-red-600 hover:bg-zinc-200 rounded transition-colors cursor-pointer"
                                    title="Remove color"
                                    aria-label="Remove color"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>

                              {/* On-Demand Images Section (Only displayed if user tapped View Images) */}
                              {isExpanded && (
                                <div className="p-4 sm:p-5 bg-white space-y-4">
                                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-zinc-100">
                                    <div>
                                      <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-700">
                                        Images for {colorObj?.name || 'this color'}
                                      </h4>
                                      <p className="text-2xs text-zinc-500">
                                        Select display order (1 to {colorImages.length || 1}) and tap &quot;Done&quot;. Order 1 will be the Front Image.
                                      </p>
                                    </div>

                                    <div className="flex items-center gap-2">
                                      {/* Done Button: Saves display order & sets display_order = 1 as front_image */}
                                      {colorImages.length > 0 && (
                                        <button
                                          type="button"
                                          onClick={() => handleSaveDisplayOrder(pc.id)}
                                          disabled={savingOrderColorId === pc.id}
                                          className="ui-btn ui-btn-grey ui-btn-sm font-medium px-4 cursor-pointer inline-flex items-center gap-1.5 shadow-xs"
                                          title="Save display order and set Order 1 as front image"
                                        >
                                          {savingOrderColorId === pc.id ? (
                                            <>
                                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                              <span>Saving Order...</span>
                                            </>
                                          ) : (
                                            <>
                                              <Check className="w-3.5 h-3.5 text-white" />
                                              <span>Done</span>
                                            </>
                                          )}
                                        </button>
                                      )}

                                      <input
                                        type="file"
                                        accept="image/*"
                                        multiple
                                        ref={(el) => {
                                          fileInputRefs.current[pc.id] = el;
                                        }}
                                        onChange={(e) =>
                                          handleImageFileChange(pc.id, e)
                                        }
                                        className="hidden"
                                        id={`upload-file-${pc.id}`}
                                      />
                                      <label
                                        htmlFor={`upload-file-${pc.id}`}
                                        className={`ui-btn ui-btn-outline ui-btn-sm font-medium px-3 text-black border-zinc-300 hover:bg-zinc-100 cursor-pointer inline-flex items-center gap-1.5 shadow-2xs ${
                                          isUploading
                                            ? 'opacity-50 pointer-events-none'
                                            : ''
                                        }`}
                                      >
                                        {isUploading ? (
                                          <>
                                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                            <span>Uploading...</span>
                                          </>
                                        ) : (
                                          <>
                                            <Upload className="w-3.5 h-3.5 text-black" />
                                            <span>Upload</span>
                                          </>
                                        )}
                                      </label>
                                    </div>
                                  </div>

                                  {isLoadingImages ? (
                                    <div className="p-8 text-center text-xs text-zinc-500">
                                      <Loader2 className="w-5 h-5 animate-spin mx-auto mb-1 text-black" />
                                      Loading images from database...
                                    </div>
                                  ) : colorImages.length === 0 ? (
                                    <div className="p-6 border border-dashed border-zinc-300 rounded-lg text-center">
                                      <ImageIcon className="w-6 h-6 text-zinc-300 mx-auto mb-1.5" />
                                      <p className="text-xs text-zinc-500">
                                        No images uploaded for {colorObj?.name || 'this color'} yet.
                                      </p>
                                      <p className="text-2xs text-zinc-400 mt-0.5">
                                        Click &quot;Upload&quot; to upload to product_color_images_bucket.
                                      </p>
                                    </div>
                                  ) : (
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
                                      {colorImages.map((img, idx) => {
                                        const totalCount = colorImages.length;
                                        const currentOrder =
                                          selectedOrdersByColor[pc.id]?.[img.id] ??
                                          (typeof img.display_order === 'number' && img.display_order > 0
                                            ? img.display_order
                                            : idx + 1);
                                        const isFront = currentOrder === 1;

                                        return (
                                          <div
                                            key={img.id}
                                            className={`bg-white border rounded-lg overflow-hidden shadow-2xs flex flex-col transition-all ${
                                              isFront
                                                ? 'border-black ring-1 ring-black'
                                                : 'border-zinc-200'
                                            }`}
                                          >
                                            {/* Thumbnail Container */}
                                            <div className="group relative aspect-square w-full bg-zinc-100 flex items-center justify-center overflow-hidden">
                                              <Image
                                                src={img.image_url}
                                                alt={`${product.name} - ${colorObj?.name || ''}`}
                                                fill
                                                className="object-cover"
                                                sizes="(max-width: 768px) 50vw, 20vw"
                                                referrerPolicy="no-referrer"
                                              />

                                              {/* Badge in top left corner */}
                                              <div className="absolute top-1.5 left-1.5 z-10">
                                                {isFront ? (
                                                  <span className="bg-black text-white px-1.5 py-0.5 rounded text-[10px] font-bold shadow-xs flex items-center gap-1">
                                                    <Star className="w-2.5 h-2.5 fill-white text-white" />
                                                    Front (1)
                                                  </span>
                                                ) : (
                                                  <span className="bg-zinc-900/80 text-white px-1.5 py-0.5 rounded text-[10px] font-semibold">
                                                    #{currentOrder}
                                                  </span>
                                                )}
                                              </div>

                                              {/* Delete Overlay Button */}
                                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center p-2 z-20">
                                                <button
                                                  type="button"
                                                  onClick={() =>
                                                    handleDeleteImage(img.id, pc.id)
                                                  }
                                                  className="p-1.5 bg-red-600 hover:bg-red-700 text-white rounded-md shadow-xs transition-colors cursor-pointer"
                                                  title="Delete image"
                                                  aria-label="Delete image"
                                                >
                                                  <Trash2 className="w-4 h-4 text-white" />
                                                </button>
                                              </div>
                                            </div>

                                            {/* Display Order Selection */}
                                            <div className="p-2 bg-zinc-50 border-t border-zinc-200 flex items-center justify-between gap-1 text-xs">
                                              <label className="text-[11px] font-semibold text-zinc-600">
                                                Display Order:
                                              </label>
                                              <select
                                                value={currentOrder}
                                                onChange={(e) =>
                                                  handleOrderChange(pc.id, img.id, Number(e.target.value))
                                                }
                                                className="ui-select py-1 px-2 text-xs font-bold text-black border border-zinc-300 rounded bg-white focus:border-black cursor-pointer shadow-2xs"
                                              >
                                                {Array.from({ length: totalCount }, (_, i) => i + 1).map((num) => (
                                                  <option key={num} value={num}>
                                                    {num} {num === 1 ? '(Front)' : ''}
                                                  </option>
                                                ))}
                                              </select>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

export default function ProductColorsPage() {
  return (
    <Suspense
      fallback={
        <div className="layout-page-container layout-flex-center min-h-screen bg-white">
          <p className="typo-body text-zinc-600">Loading colors...</p>
        </div>
      }
    >
      <ProductColorsContent />
    </Suspense>
  );
}
