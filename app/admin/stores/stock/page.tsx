'use client';

import React, { Suspense, useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  Search,
  Filter,
  Package,
  Layers,
  Store,
  RefreshCw,
  X,
  CheckCircle2,
  XCircle,
  Eye,
} from 'lucide-react';
import { getCurrentSupabaseUser } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import AdminHeader from '@/components/admin/header';
import AdminSidebar from '@/components/admin/sidebar';
import ProductVariantsSection from '@/components/admin/productvariantsSection';
import { StoreItem } from '@/lib/stores';
import {
  StoreProductItem,
  StoreCategoryItem,
  getStoreByIdOrStoreId,
  getStoreCategories,
  getStoreProducts,
} from '@/lib/admin/storeproducts';

function StoreStockContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const storeIdParam = searchParams.get('store_id') || searchParams.get('id');

  const [isAuthorized, setIsAuthorized] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Store data
  const [store, setStore] = useState<StoreItem | null>(null);
  const [categories, setCategories] = useState<StoreCategoryItem[]>([]);
  const [products, setProducts] = useState<StoreProductItem[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  // Filters
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchProductId, setSearchProductId] = useState<string>('');

  // Modal state
  const [selectedProduct, setSelectedProduct] = useState<StoreProductItem | null>(null);

  // Authentication check
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

  // Load store details, categories, and store products
  useEffect(() => {
    let ignore = false;

    async function loadData() {
      if (!isAuthorized) return;

      if (!storeIdParam) {
        setErrorMsg('No store ID provided.');
        setDataLoading(false);
        return;
      }

      setDataLoading(true);
      setErrorMsg('');

      try {
        // 1. Fetch store
        const storeRes = await getStoreByIdOrStoreId(storeIdParam);
        if (ignore) return;

        if (storeRes.error || !storeRes.data) {
          setErrorMsg(storeRes.error?.message || 'Store not found.');
          setDataLoading(false);
          return;
        }

        setStore(storeRes.data);

        // 2. Fetch categories and store products in parallel
        const [catsRes, prodsRes] = await Promise.all([
          getStoreCategories(),
          getStoreProducts(storeRes.data.id),
        ]);

        if (ignore) return;

        if (catsRes.data) {
          setCategories(catsRes.data);
        }

        if (prodsRes.data) {
          setProducts(prodsRes.data);
        }
      } catch (err: unknown) {
        if (!ignore) {
          const msg = err instanceof Error ? err.message : 'Failed to load store stock';
          setErrorMsg(msg);
        }
      } finally {
        if (!ignore) {
          setDataLoading(false);
        }
      }
    }

    loadData();

    return () => {
      ignore = true;
    };
  }, [isAuthorized, storeIdParam]);

  // Refresh handler
  const handleRefresh = async () => {
    if (!store) return;
    setDataLoading(true);
    const [catsRes, prodsRes] = await Promise.all([
      getStoreCategories(),
      getStoreProducts(store.id),
    ]);
    if (catsRes.data) setCategories(catsRes.data);
    if (prodsRes.data) setProducts(prodsRes.data);
    setDataLoading(false);
  };

  // Filter products by Category and search bar (product_id)
  const filteredProducts = useMemo(() => {
    return products.filter((prod) => {
      // Filter by category
      if (selectedCategory !== 'all') {
        if (prod.category_id !== selectedCategory) {
          return false;
        }
      }

      // Filter by search bar (product_id)
      if (searchProductId.trim()) {
        const query = searchProductId.trim().toLowerCase();
        const matchesProdId = prod.prod_id?.toLowerCase().includes(query);
        const matchesUuid = prod.product_id?.toLowerCase().includes(query);
        if (!matchesProdId && !matchesUuid) {
          return false;
        }
      }

      return true;
    });
  }, [products, selectedCategory, searchProductId]);

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
      {/* Admin Header */}
      <AdminHeader
        onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
        isSidebarOpen={sidebarOpen}
      />

      <div className="flex flex-1 min-h-[calc(100vh-4rem)] w-full max-w-full relative overflow-x-hidden">
        {/* Admin Sidebar */}
        <AdminSidebar
          mobileOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        {/* Stock Page Content */}
        <main className="flex-1 p-4 sm:p-6 md:p-8 w-full max-w-full overflow-x-hidden bg-white">
          <div className="max-w-6xl mx-auto space-y-6">
            {/* Back to Stores navigation */}
            <div>
              <Link
                href="/admin/stores"
                className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium text-zinc-600 hover:text-black transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Stores</span>
              </Link>
            </div>

            {/* Header: Store name & Total products count */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-zinc-200">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-zinc-100 rounded-lg text-black border border-zinc-200">
                  <Package className="w-6 h-6 text-black" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="typo-page-title text-xl sm:text-2xl font-bold text-black tracking-tight">
                      {store ? `${store.name} Stock` : 'Store Stock'}
                    </h1>
                    {store?.store_id && (
                      <span className="px-2 py-0.5 text-xs font-mono font-bold bg-zinc-100 border border-zinc-300 text-black rounded">
                        {store.store_id}
                      </span>
                    )}
                  </div>
                  <p className="typo-caption text-xs sm:text-sm text-zinc-500">
                    Inventory list and variant breakdown currently available in this store
                  </p>
                </div>
              </div>

              {/* Total products (count) */}
              <div className="flex items-center gap-3">
                <div className="px-4 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-center min-w-[120px]">
                  <span className="block text-xs uppercase tracking-wider text-zinc-500 font-semibold">
                    Total Products
                  </span>
                  <span className="text-xl font-bold text-black font-mono">
                    {products.length}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleRefresh}
                  disabled={dataLoading}
                  className="ui-btn ui-btn-outline ui-btn-sm text-xs text-black border-zinc-300 hover:bg-zinc-100 flex items-center gap-1.5 cursor-pointer"
                  title="Refresh stock"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 text-black ${
                      dataLoading ? 'animate-spin' : ''
                    }`}
                  />
                  <span>Refresh</span>
                </button>
              </div>
            </div>

            {/* Error Message if any */}
            {errorMsg && (
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg text-sm text-rose-700">
                {errorMsg}
              </div>
            )}

            {/* Controls: Filter (by category) & Search bar (product_id) */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              {/* Search bar (product_id) */}
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
                <input
                  type="text"
                  value={searchProductId}
                  onChange={(e) => setSearchProductId(e.target.value)}
                  placeholder="Search by product_id (e.g. prod_1001)..."
                  style={{ paddingLeft: '2.5rem' }}
                  className="ui-input pr-8 text-sm text-black border border-zinc-300 focus:border-black rounded-lg w-full bg-white"
                />
                {searchProductId && (
                  <button
                    type="button"
                    onClick={() => setSearchProductId('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-black cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Filter (by category) */}
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 bg-zinc-50 border border-zinc-300 rounded-lg px-3 py-1.5">
                  <Filter className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                  <span className="text-xs font-medium text-zinc-600 whitespace-nowrap">
                    Category:
                  </span>
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="bg-transparent text-xs font-semibold text-black focus:outline-none cursor-pointer pr-1"
                  >
                    <option value="all">All Categories</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Products Table (product_id, Name, No of variants, online_available) */}
            <div className="ui-table-container border border-zinc-200 rounded-lg overflow-hidden bg-white shadow-xs">
              <table className="ui-table w-full text-left border-collapse">
                <thead>
                  <tr className="bg-zinc-100 border-b border-zinc-200">
                    <th className="ui-table-th py-3 px-4 font-semibold text-xs text-zinc-600 uppercase tracking-wider">
                      Product ID
                    </th>
                    <th className="ui-table-th py-3 px-4 font-semibold text-xs text-zinc-600 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="ui-table-th py-3 px-4 font-semibold text-xs text-zinc-600 uppercase tracking-wider text-center">
                      No of Variants
                    </th>
                    <th className="ui-table-th py-3 px-4 font-semibold text-xs text-zinc-600 uppercase tracking-wider text-center">
                      Online Available
                    </th>
                    <th className="ui-table-th py-3 px-4 font-semibold text-xs text-zinc-600 uppercase tracking-wider text-right">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {dataLoading ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-sm text-zinc-500">
                        Loading store inventory...
                      </td>
                    </tr>
                  ) : filteredProducts.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center">
                        <Package className="w-8 h-8 text-zinc-300 mx-auto mb-2" />
                        <p className="text-sm font-medium text-zinc-600">
                          {searchProductId || selectedCategory !== 'all'
                            ? 'No products match your filters.'
                            : 'No products available in this store inventory yet.'}
                        </p>
                        <p className="text-xs text-zinc-400 mt-1">
                          {searchProductId || selectedCategory !== 'all'
                            ? 'Try clearing the search or category filter.'
                            : 'Stock distributions to this store will automatically list products here.'}
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredProducts.map((prod) => (
                      <tr
                        key={prod.product_id}
                        onClick={() => setSelectedProduct(prod)}
                        className="hover:bg-zinc-50 transition-colors cursor-pointer group"
                      >
                        {/* Product_id */}
                        <td className="py-3 px-4 text-sm font-mono font-bold text-black whitespace-nowrap">
                          {prod.prod_id}
                        </td>

                        {/* Name */}
                        <td className="py-3 px-4 text-sm font-medium text-black">
                          <div className="group-hover:text-black font-medium">
                            {prod.name}
                          </div>
                          {prod.category_name && (
                            <div className="text-xs text-zinc-400 font-normal">
                              {prod.category_name}
                            </div>
                          )}
                        </td>

                        {/* No of variants */}
                        <td className="py-3 px-4 text-sm text-center">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-zinc-100 text-zinc-800 font-mono">
                            <Layers className="w-3 h-3 text-zinc-500" />
                            {prod.no_of_variants}
                          </span>
                        </td>

                        {/* Online available */}
                        <td className="py-3 px-4 text-sm text-center">
                          {prod.online_available ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              Yes
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-zinc-100 text-zinc-500 border border-zinc-200">
                              <XCircle className="w-3 h-3 text-zinc-400" />
                              No
                            </span>
                          )}
                        </td>

                        {/* Action: View Variants */}
                        <td className="py-3 px-4 text-sm text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedProduct(prod);
                            }}
                            className="ui-btn ui-btn-outline ui-btn-sm px-3 py-1 font-medium text-xs cursor-pointer inline-flex items-center gap-1 border-zinc-300 hover:bg-zinc-100 text-black"
                          >
                            <Eye className="w-3.5 h-3.5 text-zinc-600" />
                            <span>View Variants</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Showing count indicator */}
            {!dataLoading && (
              <div className="flex items-center justify-between text-xs text-zinc-500 px-1">
                <span>
                  Showing {filteredProducts.length} of {products.length} products
                </span>
                {(searchProductId || selectedCategory !== 'all') && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchProductId('');
                      setSelectedCategory('all');
                    }}
                    className="text-black underline hover:text-zinc-700 cursor-pointer"
                  >
                    Reset filters
                  </button>
                )}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Product Variants Section Modal */}
      {selectedProduct && (
        <ProductVariantsSection
          isOpen={Boolean(selectedProduct)}
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
        />
      )}
    </div>
  );
}

export default function AdminStoreStockPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-white">
          <p className="text-zinc-500 text-sm">Loading stock details...</p>
        </div>
      }
    >
      <StoreStockContent />
    </Suspense>
  );
}
