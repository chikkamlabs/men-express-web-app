'use client';

import React, { Suspense, useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Plus,
  Loader2,
  AlertCircle,
  Shirt,
  Layers,
  Palette,
  ExternalLink,
} from 'lucide-react';
import { getCurrentSupabaseUser } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import AdminHeader from '@/components/admin/header';
import AdminSidebar from '@/components/admin/sidebar';
import { Product } from '@/lib/productsStore';
import { ProductColor, getProductDetails, getProductColors } from '@/lib/productcolorsStore';
import {
  ProductVariant,
  getProductVariants,
} from '@/lib/productVariantsStore';
import AddProductVariantModal from '@/components/admin/addproductvariant';
import OpenProductVariantModal from '@/components/admin/openproductvariant';

function ProductVariantsDashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const productIdParam =
    searchParams.get('product_id') ||
    searchParams.get('id') ||
    searchParams.get('prod_id');

  const [isAuthorized, setIsAuthorized] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Product & variants data
  const [product, setProduct] = useState<Product | null>(null);
  const [productLoading, setProductLoading] = useState(true);
  const [productColors, setProductColors] = useState<ProductColor[]>([]);
  const [variants, setVariants] = useState<ProductVariant[]>([]);

  // Modals state
  const [isAddVariantOpen, setIsAddVariantOpen] = useState(false);
  const [selectedVariantToOpen, setSelectedVariantToOpen] = useState<ProductVariant | null>(null);

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

  // Load product, available colors, and variants
  useEffect(() => {
    let ignore = false;
    if (isAuthorized && productIdParam) {
      getProductDetails(productIdParam).then((prodRes) => {
        if (ignore) return;
        if (prodRes.data) {
          setProduct(prodRes.data);
          const actualId = prodRes.data.id;

          Promise.all([
            getProductColors(actualId),
            getProductVariants(actualId),
          ]).then(([colorsRes, variantsRes]) => {
            if (ignore) return;
            if (colorsRes.data) setProductColors(colorsRes.data);
            if (variantsRes.data) setVariants(variantsRes.data);
            setProductLoading(false);
          });
        } else {
          setProductLoading(false);
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

  // Group variants by product_color_id
  const variantsGroupedByColor = useMemo(() => {
    const map = new Map<string, { color: ProductColor | null; variants: ProductVariant[] }>();

    // Initialize with all assigned product colors
    for (const pc of productColors) {
      map.set(pc.id, { color: pc, variants: [] });
    }

    // Populate variants
    for (const v of variants) {
      if (map.has(v.product_color_id)) {
        map.get(v.product_color_id)!.variants.push(v);
      } else {
        // In case variant color was not in list
        map.set(v.product_color_id, {
          color: null,
          variants: [v],
        });
      }
    }

    return Array.from(map.entries());
  }, [productColors, variants]);

  const handleVariantCreated = (newVariant: ProductVariant | ProductVariant[]) => {
    if (Array.isArray(newVariant)) {
      setVariants((prev) => [...prev, ...newVariant]);
    } else {
      setVariants((prev) => [...prev, newVariant]);
    }
  };

  const handleVariantUpdated = (updatedVariant: ProductVariant) => {
    setVariants((prev) =>
      prev.map((v) => (v.id === updatedVariant.id ? updatedVariant : v))
    );
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
          <div className="max-w-6xl mx-auto space-y-6">
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
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs px-2.5 py-1 bg-zinc-100 border border-zinc-300 rounded font-semibold text-black">
                    {product.prod_id}
                  </span>
                  <Link
                    href={`/admin/products/colors?product_id=${product.id}`}
                    className="ui-btn ui-btn-outline ui-btn-sm text-xs text-black border-zinc-300 hover:bg-zinc-100 flex items-center gap-1.5 cursor-pointer"
                  >
                    <Palette className="w-3.5 h-3.5 text-black" />
                    <span>Manage Colors</span>
                  </Link>
                </div>
              )}
            </div>

            {/* Product Loading / Not Found */}
            {productLoading ? (
              <div className="p-12 text-center text-zinc-500">
                <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-black" />
                <p className="text-sm">Loading product variants and colors...</p>
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
                {/* Product Summary Header */}
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

                    <div className="flex items-center gap-3">
                      {product.status ? (
                        <span className="ui-badge ui-badge-success text-xs font-medium">
                          Active
                        </span>
                      ) : (
                        <span className="ui-badge ui-badge-default text-xs font-medium">
                          Inactive
                        </span>
                      )}

                      {/* Add Variant Button */}
                      <button
                        type="button"
                        onClick={() => setIsAddVariantOpen(true)}
                        className="ui-btn ui-btn-grey ui-btn-md px-4 py-2 font-medium flex items-center gap-2 shadow-xs cursor-pointer"
                      >
                        <Plus className="w-4 h-4 text-white" />
                        <span>Add Variant</span>
                      </button>
                    </div>
                  </div>

                  {/* Attributes list */}
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
                      <span className="text-zinc-500 block">Total Variants</span>
                      <span className="font-semibold text-black font-mono">
                        {variants.length}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 1. Display Product Colors Available: Just colors not images */}
                <div className="ui-card p-5 border border-zinc-200 rounded-xl bg-white shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-bold text-black uppercase tracking-wider flex items-center gap-2">
                      <Palette className="w-4 h-4 text-black" />
                      <span>Available Colors for this Product (Just Colors)</span>
                    </h2>
                    <span className="text-xs text-zinc-500 font-mono">
                      {productColors.length} color(s) configured
                    </span>
                  </div>

                  {productColors.length === 0 ? (
                    <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-xs text-yellow-800 flex items-center justify-between gap-3">
                      <span>
                        This product has no colors added yet. Colors must be assigned to create variants.
                      </span>
                      <Link
                        href={`/admin/products/colors?product_id=${product.id}`}
                        className="font-bold underline whitespace-nowrap cursor-pointer"
                      >
                        Add Colors First →
                      </Link>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      {productColors.map((pc) => {
                        const colorName = pc.color?.name || 'Color';
                        const colorCode = pc.color?.code || '#000000';

                        return (
                          <div
                            key={pc.id}
                            className="inline-flex items-center gap-2 px-3 py-1.5 bg-zinc-50 border border-zinc-200 rounded-lg text-xs font-medium text-black shadow-2xs"
                          >
                            <span
                              className="w-3.5 h-3.5 rounded-full border border-zinc-300 flex-shrink-0"
                              style={{ backgroundColor: colorCode }}
                              aria-hidden="true"
                            />
                            <span>{colorName}</span>
                            <span className="font-mono text-zinc-400 text-2xs">
                              ({colorCode})
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* 2. Display all the variants under those colors */}
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-base sm:text-lg font-bold text-black flex items-center gap-2">
                        <Layers className="w-5 h-5 text-black" />
                        <span>Product Variants by Color</span>
                      </h2>
                      <p className="text-xs text-zinc-500 mt-0.5">
                        Sellable SKUs with pricing, stock quantity, and size options under each colorway.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setIsAddVariantOpen(true)}
                      disabled={productColors.length === 0}
                      className="ui-btn ui-btn-grey ui-btn-sm px-3 py-1.5 font-medium flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
                    >
                      <Plus className="w-3.5 h-3.5 text-white" />
                      <span>Add Variant</span>
                    </button>
                  </div>

                  {variants.length === 0 ? (
                    <div className="ui-card p-12 text-center border border-zinc-200 rounded-xl bg-white space-y-3">
                      <Layers className="w-8 h-8 text-zinc-300 mx-auto" />
                      <p className="text-sm font-medium text-zinc-700">
                        No variants created for this product yet.
                      </p>
                      <p className="text-xs text-zinc-400 max-w-sm mx-auto">
                        Add sizes and barcodes under available colors by clicking &quot;Add Variant&quot;.
                      </p>
                      {productColors.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setIsAddVariantOpen(true)}
                          className="ui-btn ui-btn-grey ui-btn-md inline-flex items-center gap-2 cursor-pointer shadow-xs"
                        >
                          <Plus className="w-4 h-4 text-white" />
                          <span>Add First Variant</span>
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {variantsGroupedByColor.map(([colorId, { color, variants: colorVariants }]) => {
                        const colorName = color?.color?.name || 'Assigned Color';
                        const colorCode = color?.color?.code || '#000000';

                        return (
                          <div
                            key={colorId}
                            className="ui-card border border-zinc-200 rounded-xl bg-white overflow-hidden shadow-xs"
                          >
                            {/* Color Group Header */}
                            <div className="p-4 bg-zinc-50 border-b border-zinc-200 flex items-center justify-between">
                              <div className="flex items-center gap-2.5">
                                <span
                                  className="w-4 h-4 rounded-full border border-zinc-300 shadow-xs flex-shrink-0"
                                  style={{ backgroundColor: colorCode }}
                                  aria-hidden="true"
                                />
                                <h3 className="font-bold text-sm text-black">
                                  {colorName}
                                </h3>
                                <span className="text-xs font-mono text-zinc-500">
                                  ({colorCode})
                                </span>
                              </div>

                              <span className="text-xs font-semibold px-2.5 py-0.5 bg-zinc-200/80 rounded-full text-zinc-800">
                                {colorVariants.length} Variant(s)
                              </span>
                            </div>

                            {/* Variants Table for this color */}
                            {colorVariants.length === 0 ? (
                              <div className="p-6 text-center text-xs text-zinc-400">
                                No variants configured under this color yet. Click &quot;Add Variant&quot; to add one.
                              </div>
                            ) : (
                              <div className="overflow-x-auto">
                                <table className="ui-table w-full text-left border-collapse">
                                  <thead>
                                    <tr className="bg-zinc-100/60 border-b border-zinc-200">
                                      <th className="ui-table-th py-2.5 px-4 font-semibold text-xs text-zinc-600 uppercase tracking-wider">
                                        Size
                                      </th>
                                      <th className="ui-table-th py-2.5 px-4 font-semibold text-xs text-zinc-600 uppercase tracking-wider">
                                        Barcode
                                      </th>
                                      <th className="ui-table-th py-2.5 px-4 font-semibold text-xs text-zinc-600 uppercase tracking-wider">
                                        MRP
                                      </th>
                                      <th className="ui-table-th py-2.5 px-4 font-semibold text-xs text-zinc-600 uppercase tracking-wider">
                                        SP
                                      </th>
                                      <th className="ui-table-th py-2.5 px-4 font-semibold text-xs text-zinc-600 uppercase tracking-wider">
                                        PP
                                      </th>
                                      <th className="ui-table-th py-2.5 px-4 font-semibold text-xs text-zinc-600 uppercase tracking-wider">
                                        Qty
                                      </th>
                                      <th className="ui-table-th py-2.5 px-4 font-semibold text-xs text-zinc-600 uppercase tracking-wider">
                                        Online / Landing
                                      </th>
                                      <th className="ui-table-th py-2.5 px-4 font-semibold text-xs text-zinc-600 uppercase tracking-wider">
                                        Status
                                      </th>
                                      <th className="ui-table-th py-2.5 px-4 font-semibold text-xs text-zinc-600 uppercase tracking-wider text-right">
                                        Action
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-zinc-200">
                                    {colorVariants.map((variant) => (
                                      <tr
                                        key={variant.id}
                                        className="hover:bg-zinc-50 transition-colors"
                                      >
                                        {/* Size */}
                                        <td className="py-2.5 px-4 text-xs font-bold text-black">
                                          <span className="inline-flex items-center px-2 py-0.5 bg-zinc-100 border border-zinc-300 rounded font-mono">
                                            {variant.size_value || '—'}
                                          </span>
                                        </td>

                                        {/* Barcode */}
                                        <td className="py-2.5 px-4 text-xs font-mono font-medium text-zinc-800">
                                          {variant.barcode}
                                        </td>

                                        {/* MRP */}
                                        <td className="py-2.5 px-4 text-xs font-mono font-medium text-black">
                                          ₹{variant.mrp.toFixed(2)}
                                        </td>

                                        {/* SP */}
                                        <td className="py-2.5 px-4 text-xs font-mono font-bold text-green-700">
                                          ₹{variant.s_p.toFixed(2)}
                                        </td>

                                        {/* PP */}
                                        <td className="py-2.5 px-4 text-xs font-mono text-zinc-600">
                                          ₹{variant.p_p.toFixed(2)}
                                        </td>

                                        {/* Quantity */}
                                        <td className="py-2.5 px-4 text-xs font-mono font-semibold text-black">
                                          {variant.quantity}
                                        </td>

                                        {/* Online / Landing */}
                                        <td className="py-2.5 px-4 text-xs">
                                          <div className="flex items-center gap-1.5 flex-wrap">
                                            {variant.online_available && (
                                              <span className="text-2xs px-1.5 py-0.5 bg-blue-50 border border-blue-200 text-blue-700 rounded font-medium">
                                                Online
                                              </span>
                                            )}
                                            {variant.on_landing_page && (
                                              <span className="text-2xs px-1.5 py-0.5 bg-purple-50 border border-purple-200 text-purple-700 rounded font-medium">
                                                Landing
                                              </span>
                                            )}
                                          </div>
                                        </td>

                                        {/* Status */}
                                        <td className="py-2.5 px-4 text-xs">
                                          {variant.status === 'active' ? (
                                            <span className="ui-badge ui-badge-success text-2xs">
                                              Active
                                            </span>
                                          ) : (
                                            <span className="ui-badge ui-badge-default text-2xs">
                                              Deactive
                                            </span>
                                          )}
                                        </td>

                                        {/* Allow to open the variant Button (Open) */}
                                        <td className="py-2.5 px-4 text-xs text-right whitespace-nowrap">
                                          <button
                                            type="button"
                                            onClick={() => setSelectedVariantToOpen(variant)}
                                            className="ui-btn ui-btn-grey ui-btn-sm px-2.5 py-1 font-medium text-xs cursor-pointer inline-flex items-center gap-1 shadow-2xs"
                                          >
                                            <ExternalLink className="w-3 h-3 text-white" />
                                            <span>Open</span>
                                          </button>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </main>
      </div>

      {/* Add Product Variant Modal */}
      {isAddVariantOpen && product && (
        <AddProductVariantModal
          isOpen={isAddVariantOpen}
          onClose={() => setIsAddVariantOpen(false)}
          productId={product.id}
          productColors={productColors}
          existingVariants={variants}
          onVariantCreated={handleVariantCreated}
        />
      )}

      {/* Open Product Variant Modal */}
      {selectedVariantToOpen && (
        <OpenProductVariantModal
          isOpen={Boolean(selectedVariantToOpen)}
          variant={selectedVariantToOpen}
          productColors={productColors}
          onClose={() => setSelectedVariantToOpen(null)}
          onVariantUpdated={handleVariantUpdated}
        />
      )}
    </div>
  );
}

export default function ProductVariantsDashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="layout-page-container layout-flex-center min-h-screen bg-white">
          <p className="typo-body text-zinc-600">Loading product variants...</p>
        </div>
      }
    >
      <ProductVariantsDashboardContent />
    </Suspense>
  );
}
