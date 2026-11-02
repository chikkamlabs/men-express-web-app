'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Shirt,
  Layers,
  FolderTree,
  Barcode,
  Boxes,
  Lock,
  AlertCircle,
  Loader2,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { getCurrentSupabaseUser } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import StoreHeader from '@/components/store/header';
import StoreSidebar from '@/components/store/sidebar';
import {
  UniqueStoreProduct,
  getStoreProductDetails,
} from '@/lib/store/products';

function OpenProductContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const productParam =
    searchParams.get('id') || searchParams.get('product_id') || '';

  const [isAuthorized, setIsAuthorized] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [currentStoreId, setCurrentStoreId] = useState<string | undefined>(undefined);
  const [storeName, setStoreName] = useState('Store');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [product, setProduct] = useState<UniqueStoreProduct | null>(null);
  const [loading, setLoading] = useState(Boolean(productParam));
  const [error, setError] = useState<string | null>(
    productParam ? null : 'No product ID provided in query.'
  );

  // Authentication check
  useEffect(() => {
    let isMounted = true;

    async function checkAuth() {
      try {
        const { user, role } = await getCurrentSupabaseUser();
        if (!isMounted) return;

        if (user && (role === 'store' || role === 'admin')) {
          setIsAuthorized(true);
          setCurrentStoreId(user.id);

          // Resolve store name
          let resolvedName = user.user_metadata?.name || '';
          if (!resolvedName) {
            try {
              const { data } = await supabase
                .from('stores')
                .select('name')
                .eq('id', user.id)
                .maybeSingle();
              if (data?.name) {
                resolvedName = data.name;
              }
            } catch {
              // Ignore lookup errors
            }
          }
          if (!resolvedName && user.email) {
            resolvedName = user.email.split('@')[0];
          }
          if (resolvedName) {
            setStoreName(resolvedName);
          }

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
        if (role === 'store' || role === 'admin') {
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

  // Load Product Details
  useEffect(() => {
    let ignore = false;
    if (isAuthorized && productParam) {
      getStoreProductDetails(productParam, currentStoreId).then(
        ({ product: prodData, error: fetchErr }) => {
          if (ignore) return;
          if (fetchErr || !prodData) {
            setError(fetchErr?.message || 'Product record could not be found.');
            setLoading(false);
          } else {
            setProduct(prodData);
            setLoading(false);
          }
        }
      );
    }

    return () => {
      ignore = true;
    };
  }, [isAuthorized, productParam, currentStoreId]);

  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-50">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-black" />
          <p className="text-sm text-zinc-600">Verifying store access...</p>
        </div>
      </div>
    );
  }

  if (!isAuthorized) {
    return null;
  }

  const variants = product?.variants || [];
  const totalStock = product?.totalQuantity || 0;

  return (
    <div className="min-h-screen flex flex-col bg-white w-full max-w-full overflow-x-hidden">
      {/* On top Header covers everything */}
      <StoreHeader
        storeName={storeName}
        isSidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
      />

      <div className="flex flex-1 min-h-[calc(100vh-4rem)] w-full max-w-full relative overflow-x-hidden">
        {/* After the Header the sidebar starts */}
        <StoreSidebar
          mobileOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        {/* Content Area */}
        <main className="flex-1 p-4 sm:p-6 md:p-8 w-full max-w-full overflow-x-hidden bg-zinc-50">
          <div className="max-w-6xl mx-auto space-y-6">
            {/* Top Navigation & Read-Only Badge */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <Link
                href="/store/products"
                className="inline-flex items-center gap-2 text-sm text-zinc-600 hover:text-black font-medium transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Store Products</span>
              </Link>

              <div className="inline-flex items-center gap-2 px-3 py-1 bg-zinc-200/80 text-zinc-800 rounded-md text-xs font-medium border border-zinc-300 w-fit">
                <Lock className="w-3.5 h-3.5 text-zinc-600" />
                <span>Read-Only Mode</span>
              </div>
            </div>

            {/* Loading State */}
            {loading && (
              <div className="bg-white border border-zinc-200 rounded-lg p-12 text-center shadow-xs">
                <Loader2 className="w-8 h-8 animate-spin text-black mx-auto mb-3" />
                <p className="text-sm font-medium text-zinc-700">
                  Loading product details and store variants...
                </p>
                <p className="text-xs text-zinc-400 mt-1">Please wait a moment.</p>
              </div>
            )}

            {/* Error State */}
            {!loading && error && (
              <div className="bg-white border border-red-200 rounded-lg p-8 text-center shadow-xs">
                <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-3">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-zinc-900 mb-1">
                  Unable to load product record
                </h3>
                <p className="text-sm text-red-600 mb-6">{error}</p>
                <Link
                  href="/store/products"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-black text-white text-xs font-semibold rounded-md hover:bg-zinc-800 transition-colors"
                >
                  Return to Store Products
                </Link>
              </div>
            )}

            {/* Loaded Details */}
            {!loading && product && (
              <div className="space-y-6">
                {/* Product Header Card */}
                <div className="bg-white border border-zinc-200 rounded-lg shadow-xs p-6">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-zinc-100">
                    <div className="space-y-1">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-zinc-100 rounded-lg text-black border border-zinc-200">
                          <Shirt className="w-5 h-5 text-black" />
                        </div>
                        <div>
                          <h1 className="text-xl md:text-2xl font-bold text-zinc-900 tracking-tight">
                            {product.name}
                          </h1>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="font-mono text-xs font-bold text-black bg-zinc-100 px-2 py-0.5 rounded border border-zinc-200">
                              {product.prod_id}
                            </span>
                            <span className="text-xs text-zinc-400">•</span>
                            <span className="text-xs text-zinc-600">
                              {product.category_name || 'General Category'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Summary Metric Pills */}
                    <div className="flex items-center gap-3">
                      <div className="px-4 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-right">
                        <div className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">
                          Variants in Store
                        </div>
                        <div className="text-base font-bold text-zinc-900 font-mono">
                          {variants.length} {variants.length === 1 ? 'variant' : 'variants'}
                        </div>
                      </div>
                      <div className="px-4 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-right">
                        <div className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">
                          Total Store Stock
                        </div>
                        <div className="text-base font-bold text-zinc-900 font-mono">
                          {totalStock} pcs
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Product Specification Attributes Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-6">
                    {/* Category */}
                    <div className="p-3 bg-zinc-50 border border-zinc-200/80 rounded-lg">
                      <span className="block text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
                        Category
                      </span>
                      <span className="text-sm font-medium text-black mt-1 block">
                        {product.category_name || '—'}
                      </span>
                    </div>

                    {/* Fit */}
                    <div className="p-3 bg-zinc-50 border border-zinc-200/80 rounded-lg">
                      <span className="block text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
                        Fit
                      </span>
                      <span className="text-sm font-medium text-black mt-1 block">
                        {product.fit || 'Standard'}
                      </span>
                    </div>

                    {/* Collar */}
                    <div className="p-3 bg-zinc-50 border border-zinc-200/80 rounded-lg">
                      <span className="block text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
                        Collar
                      </span>
                      <span className="text-sm font-medium text-black mt-1 block">
                        {product.collar || 'Regular'}
                      </span>
                    </div>

                    {/* Fabric */}
                    <div className="p-3 bg-zinc-50 border border-zinc-200/80 rounded-lg">
                      <span className="block text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
                        Fabric
                      </span>
                      <span className="text-sm font-medium text-black mt-1 block">
                        {product.fabric || 'Cotton Blend'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Below: Product Variants for that product in this store_products */}
                <div className="bg-white border border-zinc-200 rounded-lg shadow-xs overflow-hidden">
                  <div className="p-4 md:p-6 border-b border-zinc-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <h2 className="text-base font-bold text-zinc-900 flex items-center gap-2">
                        <Layers className="w-4 h-4 text-zinc-700" />
                        <span>Product Variants in Store Inventory</span>
                      </h2>
                      <p className="text-xs text-zinc-500 mt-0.5">
                        Stock quantities and barcodes for this store outlet (read-only)
                      </p>
                    </div>

                    <span className="text-xs font-mono bg-zinc-100 text-zinc-700 px-2.5 py-1 rounded border border-zinc-200 self-start sm:self-auto">
                      {variants.length} Variants • {totalStock} Total Units
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-zinc-50 border-b border-zinc-200 text-zinc-600 text-xs font-bold uppercase tracking-wider">
                          <th className="py-3 px-4 w-12 text-center">#</th>
                          <th className="py-3 px-4">Barcode</th>
                          <th className="py-3 px-4">Size</th>
                          <th className="py-3 px-4">Color</th>
                          <th className="py-3 px-4 text-right">MRP</th>
                          <th className="py-3 px-4 text-right">Selling Price</th>
                          <th className="py-3 px-4 text-right">Store Quantity</th>
                          <th className="py-3 px-4 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-200 text-xs">
                        {variants.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="py-8 text-center text-zinc-500">
                              No variants currently stocked in this store.
                            </td>
                          </tr>
                        ) : (
                          variants.map((v, index) => (
                            <tr key={v.store_product_id || index} className="hover:bg-zinc-50/70 transition-colors">
                              {/* # */}
                              <td className="py-3 px-4 text-center font-mono text-zinc-400">
                                {index + 1}
                              </td>

                              {/* Barcode */}
                              <td className="py-3 px-4 font-mono font-medium text-black">
                                <div className="flex items-center gap-1.5">
                                  <Barcode className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                                  <span>{v.barcode || '—'}</span>
                                </div>
                              </td>

                              {/* Size */}
                              <td className="py-3 px-4">
                                <span className="inline-flex items-center px-2 py-0.5 rounded bg-zinc-100 text-zinc-900 font-mono text-xs font-bold border border-zinc-200">
                                  {v.size}
                                </span>
                              </td>

                              {/* Color */}
                              <td className="py-3 px-4">
                                <div className="flex items-center gap-2">
                                  {v.color_code && (
                                    <span
                                      className="w-3.5 h-3.5 rounded-full border border-zinc-300 shrink-0"
                                      style={{ backgroundColor: v.color_code }}
                                      title={v.color}
                                    />
                                  )}
                                  <span className="font-medium text-zinc-800">{v.color}</span>
                                </div>
                              </td>

                              {/* MRP */}
                              <td className="py-3 px-4 text-right font-mono text-zinc-500">
                                ₹{v.mrp.toFixed(2)}
                              </td>

                              {/* Selling Price */}
                              <td className="py-3 px-4 text-right font-mono font-semibold text-black">
                                ₹{v.s_p.toFixed(2)}
                              </td>

                              {/* Store Quantity */}
                              <td className="py-3 px-4 text-right">
                                <span
                                  className={`inline-block px-2.5 py-1 rounded font-mono font-bold text-xs border ${
                                    v.quantity > 0
                                      ? 'bg-zinc-100 text-black border-zinc-300'
                                      : 'bg-red-50 text-red-700 border-red-200'
                                  }`}
                                >
                                  {v.quantity} pcs
                                </span>
                              </td>

                              {/* Status */}
                              <td className="py-3 px-4 text-center">
                                {v.status === 'active' ? (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                    <span>Active</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-zinc-400">
                                    <XCircle className="w-3 h-3 text-zinc-400" />
                                    <span>Inactive</span>
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                      {variants.length > 0 && (
                        <tfoot>
                          <tr className="bg-zinc-50/80 border-t-2 border-zinc-300 font-semibold text-xs text-zinc-900">
                            <td colSpan={6} className="py-3 px-4 text-right uppercase tracking-wider text-zinc-600 font-bold">
                              Total Store Inventory:
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-bold text-sm text-black">
                              {totalStock} pcs
                            </td>
                            <td />
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                </div>

                {/* Bottom Read-Only notice */}
                <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-4 flex items-center justify-between text-xs text-zinc-500">
                  <div className="flex items-center gap-2">
                    <Lock className="w-4 h-4 text-zinc-400 shrink-0" />
                    <span>
                      Product specifications and variant pricing are managed centrally by the administrator. Store inventory quantities are updated automatically when accepting distributions.
                    </span>
                  </div>
                  <Link
                    href="/store/products"
                    className="font-medium text-black hover:underline shrink-0 ml-4 cursor-pointer"
                  >
                    Close &amp; Return
                  </Link>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

export default function StoreOpenProductPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-zinc-50">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-black" />
            <p className="text-sm text-zinc-600">Loading product record...</p>
          </div>
        </div>
      }
    >
      <OpenProductContent />
    </Suspense>
  );
}
