'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Search,
  Shirt,
  RefreshCw,
  FolderTree,
  ExternalLink,
  Filter,
  X,
  Layers,
  Boxes,
} from 'lucide-react';
import { getCurrentSupabaseUser } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import StoreHeader from '@/components/store/header';
import StoreSidebar from '@/components/store/sidebar';
import {
  UniqueStoreProduct,
  getStoreProducts,
} from '@/lib/store/products';
import { Category, getCategories } from '@/lib/categoriesStore';

export default function StoreProductsDashboardPage() {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [currentStoreId, setCurrentStoreId] = useState<string | undefined>(undefined);
  const [storeName, setStoreName] = useState('Store');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [categorySearchText, setCategorySearchText] = useState('');
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);

  // Data States
  const [uniqueProducts, setUniqueProducts] = useState<UniqueStoreProduct[]>([]);
  const [totalProductsCount, setTotalProductsCount] = useState<number>(0);
  const [totalVariantsCount, setTotalVariantsCount] = useState<number>(0);
  const [categories, setCategories] = useState<Category[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

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

  // Load Categories for filter
  useEffect(() => {
    let ignore = false;
    if (isAuthorized) {
      getCategories().then(({ data }) => {
        if (!ignore && data) {
          setCategories(data);
        }
      });
    }
    return () => {
      ignore = true;
    };
  }, [isAuthorized]);

  // Load Products
  useEffect(() => {
    let ignore = false;
    if (isAuthorized) {
      async function loadData() {
        const {
          uniqueProducts: prods,
          totalProductsCount: totProds,
          totalVariantsCount: totVars,
        } = await getStoreProducts({
          storeId: currentStoreId,
          categoryId: selectedCategoryId !== 'all' ? selectedCategoryId : undefined,
          search: searchQuery,
        });

        if (!ignore) {
          setUniqueProducts(prods);
          setTotalProductsCount(totProds);
          setTotalVariantsCount(totVars);
          setDataLoading(false);
        }
      }

      loadData();
    }
    return () => {
      ignore = true;
    };
  }, [isAuthorized, currentStoreId, selectedCategoryId, searchQuery]);

  const handleRefresh = async () => {
    setDataLoading(true);
    const {
      uniqueProducts: prods,
      totalProductsCount: totProds,
      totalVariantsCount: totVars,
    } = await getStoreProducts({
      storeId: currentStoreId,
      categoryId: selectedCategoryId !== 'all' ? selectedCategoryId : undefined,
      search: searchQuery,
    });
    setUniqueProducts(prods);
    setTotalProductsCount(totProds);
    setTotalVariantsCount(totVars);
    setDataLoading(false);
  };

  // Filtered categories for dropdown search
  const filteredCategoriesList = useMemo(() => {
    if (!categorySearchText.trim()) return categories;
    const q = categorySearchText.toLowerCase();
    return categories.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.cat_id.toLowerCase().includes(q)
    );
  }, [categories, categorySearchText]);

  const selectedCategoryLabel = useMemo(() => {
    if (selectedCategoryId === 'all') return 'All Categories';
    const found = categories.find((c) => c.id === selectedCategoryId);
    return found ? `${found.name} (${found.cat_id})` : 'Selected Category';
  }, [selectedCategoryId, categories]);

  const resetFilters = () => {
    setSelectedCategoryId('all');
    setSearchQuery('');
    setCategorySearchText('');
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
            {/* Top Bar: Title & Counts (Total Products & Total Product Variants) */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-zinc-200">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-white rounded-lg text-black border border-zinc-200 shadow-xs">
                  <Shirt className="w-6 h-6 text-black" />
                </div>
                <div>
                  <h1 className="typo-page-title text-xl sm:text-2xl font-bold text-black tracking-tight">
                    Store Products
                  </h1>
                  <p className="typo-caption text-xs sm:text-sm text-zinc-500">
                    View active catalog and physical stock in your store inventory
                  </p>
                </div>
              </div>

              {/* Metric Counts: Total Products (Count), Total product variants (Count) */}
              <div className="flex items-center gap-3">
                <div className="px-4 py-2 bg-white border border-zinc-200 rounded-lg text-center shadow-xs">
                  <span className="block text-[11px] uppercase tracking-wider text-zinc-500 font-semibold">
                    Total Products
                  </span>
                  <span className="text-lg font-bold text-black font-mono">
                    {totalProductsCount}
                  </span>
                </div>

                <div className="px-4 py-2 bg-white border border-zinc-200 rounded-lg text-center shadow-xs">
                  <span className="block text-[11px] uppercase tracking-wider text-zinc-500 font-semibold">
                    Total Product Variants
                  </span>
                  <span className="text-lg font-bold text-black font-mono">
                    {totalVariantsCount}
                  </span>
                </div>
              </div>
            </div>

            {/* Controls: Search Bar(product_id) & Filters(Categories search and select) */}
            <div className="space-y-3 p-4 bg-white border border-zinc-200 rounded-lg shadow-xs">
              <div className="flex items-center gap-2 pb-2 border-b border-zinc-200 text-xs font-semibold text-zinc-700 uppercase tracking-wide">
                <Filter className="w-3.5 h-3.5 text-zinc-500" />
                <span>Filters &amp; Search</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {/* Search Bar(product_id) */}
                <div className="relative">
                  <label className="block text-[11px] font-medium text-zinc-500 mb-1">
                    Search Product ID / Name
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="e.g. prod_1, Cotton Shirt..."
                      style={{ paddingLeft: '2.25rem' }}
                      className="ui-input pr-8 text-xs text-black border border-zinc-300 focus:border-black rounded-md w-full bg-white h-9 font-mono"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-black cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Filters(Categories search and select) */}
                <div className="relative">
                  <label className="block text-[11px] font-medium text-zinc-500 mb-1">
                    Filter by Category
                  </label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setIsCategoryDropdownOpen((prev) => !prev)}
                      className="w-full h-9 px-3 text-left text-xs bg-white border border-zinc-300 rounded-md text-black flex items-center justify-between focus:outline-hidden focus:border-black cursor-pointer"
                    >
                      <span className="truncate">{selectedCategoryLabel}</span>
                      <FolderTree className="w-3.5 h-3.5 text-zinc-400 flex-shrink-0 ml-1" />
                    </button>

                    {isCategoryDropdownOpen && (
                      <div className="absolute z-30 left-0 right-0 mt-1 bg-white border border-zinc-300 rounded-md shadow-lg p-2 space-y-2">
                        <div className="relative">
                          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
                          <input
                            type="text"
                            value={categorySearchText}
                            onChange={(e) => setCategorySearchText(e.target.value)}
                            placeholder="Search category..."
                            style={{ paddingLeft: '1.75rem' }}
                            className="w-full text-xs py-1.5 pr-2 border border-zinc-200 rounded focus:border-black focus:outline-hidden bg-white text-black"
                            autoFocus
                          />
                        </div>

                        <div className="max-h-48 overflow-y-auto space-y-0.5 divide-y divide-zinc-100">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedCategoryId('all');
                              setIsCategoryDropdownOpen(false);
                            }}
                            className={`w-full text-left px-2 py-1.5 text-xs rounded hover:bg-zinc-100 cursor-pointer ${
                              selectedCategoryId === 'all'
                                ? 'bg-zinc-100 font-semibold text-black'
                                : 'text-zinc-700'
                            }`}
                          >
                            All Categories
                          </button>
                          {filteredCategoriesList.length === 0 ? (
                            <div className="px-2 py-2 text-xs text-zinc-400 text-center">
                              No categories found
                            </div>
                          ) : (
                            filteredCategoriesList.map((cat) => (
                              <button
                                key={cat.id}
                                type="button"
                                onClick={() => {
                                  setSelectedCategoryId(cat.id);
                                  setIsCategoryDropdownOpen(false);
                                }}
                                className={`w-full text-left px-2 py-1.5 text-xs rounded hover:bg-zinc-100 flex items-center justify-between cursor-pointer ${
                                  selectedCategoryId === cat.id
                                    ? 'bg-zinc-100 font-semibold text-black'
                                    : 'text-zinc-700'
                                }`}
                              >
                                <span className="font-medium text-black">{cat.name}</span>
                                <span className="text-[10px] text-zinc-400 font-mono">
                                  {cat.cat_id}
                                </span>
                              </button>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Reset & Refresh */}
                <div className="flex items-end justify-between sm:justify-start gap-2 pt-1">
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="text-xs text-zinc-600 hover:text-black underline cursor-pointer py-2"
                  >
                    Reset filters
                  </button>
                  <button
                    type="button"
                    onClick={handleRefresh}
                    disabled={dataLoading}
                    className="ui-btn ui-btn-outline ui-btn-sm text-xs text-black border-zinc-300 hover:bg-zinc-100 flex items-center gap-1.5 cursor-pointer h-9 px-3"
                    title="Refresh products list"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 text-black ${dataLoading ? 'animate-spin' : ''}`} />
                    <span>Refresh</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Display list of Products(Here First show only Unique products: product_id, variants, open) */}
            <div className="ui-table-container border border-zinc-200 rounded-lg overflow-hidden bg-white shadow-xs">
              <table className="ui-table w-full text-left border-collapse">
                <thead>
                  <tr className="bg-zinc-100 border-b border-zinc-200">
                    <th className="ui-table-th py-3 px-4 font-semibold text-xs text-zinc-600 uppercase tracking-wider">
                      Product ID
                    </th>
                    <th className="ui-table-th py-3 px-4 font-semibold text-xs text-zinc-600 uppercase tracking-wider">
                      Product Name
                    </th>
                    <th className="ui-table-th py-3 px-4 font-semibold text-xs text-zinc-600 uppercase tracking-wider">
                      Category
                    </th>
                    <th className="ui-table-th py-3 px-4 font-semibold text-xs text-zinc-600 uppercase tracking-wider">
                      Variants in Store
                    </th>
                    <th className="ui-table-th py-3 px-4 font-semibold text-xs text-zinc-600 uppercase tracking-wider">
                      Total Units
                    </th>
                    <th className="ui-table-th py-3 px-4 font-semibold text-xs text-zinc-600 uppercase tracking-wider text-right">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {dataLoading ? (
                    <tr>
                      <td colSpan={6} className="py-10 text-center text-sm text-zinc-500">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-zinc-400" />
                        <span>Loading store products...</span>
                      </td>
                    </tr>
                  ) : uniqueProducts.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center">
                        <Shirt className="w-8 h-8 text-zinc-300 mx-auto mb-2" />
                        <p className="text-sm font-medium text-zinc-600">
                          {searchQuery || selectedCategoryId !== 'all'
                            ? 'No products match your selected search or category filter.'
                            : 'No products currently in your store inventory.'}
                        </p>
                        <p className="text-xs text-zinc-400 mt-1">
                          When you accept store distributions, items will appear here.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    uniqueProducts.map((p) => (
                      <tr key={p.product_id} className="hover:bg-zinc-50 transition-colors">
                        {/* product_id */}
                        <td className="py-3 px-4 text-sm font-mono font-bold text-black whitespace-nowrap">
                          {p.prod_id}
                        </td>

                        {/* Product Name */}
                        <td className="py-3 px-4 text-sm">
                          <div className="font-semibold text-black">
                            {p.name}
                          </div>
                          {(p.fit || p.fabric) && (
                            <div className="text-xs text-zinc-400">
                              {[p.fit, p.fabric].filter(Boolean).join(' • ')}
                            </div>
                          )}
                        </td>

                        {/* Category */}
                        <td className="py-3 px-4 text-sm text-zinc-700 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-medium bg-zinc-100 text-zinc-800 border border-zinc-200">
                            {p.category_name || 'General'}
                          </span>
                        </td>

                        {/* Variants in Store */}
                        <td className="py-3 px-4 text-sm whitespace-nowrap">
                          <div className="flex items-center gap-1.5 font-medium text-zinc-800">
                            <Layers className="w-4 h-4 text-zinc-400" />
                            <span>{p.variantCount} {p.variantCount === 1 ? 'Variant' : 'Variants'}</span>
                          </div>
                        </td>

                        {/* Total Units */}
                        <td className="py-3 px-4 text-sm font-mono whitespace-nowrap font-semibold text-black">
                          <div className="flex items-center gap-1.5">
                            <Boxes className="w-3.5 h-3.5 text-zinc-400" />
                            <span>{p.totalQuantity} pcs</span>
                          </div>
                        </td>

                        {/* Open Button: navigates to app/store/openproduct/page.tsx */}
                        <td className="py-3 px-4 text-sm text-right whitespace-nowrap">
                          <Link
                            href={`/store/openproduct?id=${encodeURIComponent(
                              p.product_id
                            )}`}
                            className="ui-btn ui-btn-grey ui-btn-sm px-3 py-1 font-medium text-xs cursor-pointer inline-flex items-center gap-1.5"
                          >
                            <span>Open</span>
                            <ExternalLink className="w-3 h-3 text-white" />
                          </Link>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Results count text */}
            {!dataLoading && (
              <div className="flex items-center justify-between text-xs text-zinc-500 px-1">
                <span>
                  Showing {uniqueProducts.length} unique products ({totalVariantsCount} total variants)
                </span>
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="text-black underline hover:text-zinc-700 cursor-pointer"
                  >
                    Clear search
                  </button>
                )}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
