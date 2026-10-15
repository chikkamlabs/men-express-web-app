'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search, Plus, Shirt, RefreshCw, Filter, Palette, Layers } from 'lucide-react';
import { getCurrentSupabaseUser } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import AdminHeader from '@/components/admin/header';
import AdminSidebar from '@/components/admin/sidebar';
import AddProductModal from '@/components/admin/addproduct';
import OpenProductModal from '@/components/admin/openproduct';
import { Product, getProducts } from '@/lib/productsStore';
import { Category, getCategories } from '@/lib/categoriesStore';

export default function AdminProductsDashboardPage() {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Products data states
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  // Filters & search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

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

  // Load products and categories asynchronously
  useEffect(() => {
    let ignore = false;
    if (isAuthorized) {
      Promise.all([getProducts(), getCategories()]).then(
        ([productsRes, categoriesRes]) => {
          if (!ignore) {
            if (productsRes.data) setProducts(productsRes.data);
            if (categoriesRes.data) setCategories(categoriesRes.data);
            setDataLoading(false);
          }
        }
      );
    }
    return () => {
      ignore = true;
    };
  }, [isAuthorized]);

  const refreshProducts = async () => {
    setDataLoading(true);
    const { data } = await getProducts();
    if (data) {
      setProducts(data);
    }
    setDataLoading(false);
  };

  // Filtered products: category filter + search by prod_id and name
  const filteredProducts = useMemo(() => {
    let list = products;

    // Filter by category
    if (selectedCategoryFilter !== 'all') {
      list = list.filter((p) => p.category_id === selectedCategoryFilter);
    }

    // Search bar (prod_id, name)
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (p) =>
          p.prod_id.toLowerCase().includes(q) ||
          p.name.toLowerCase().includes(q)
      );
    }

    return list;
  }, [products, selectedCategoryFilter, searchQuery]);

  // Handle product created
  const handleProductCreated = (newProd: Product) => {
    setProducts((prev) => {
      const exists = prev.some((p) => p.prod_id === newProd.prod_id);
      if (exists) {
        return prev.map((p) => (p.prod_id === newProd.prod_id ? newProd : p));
      }
      return [...prev, newProd];
    });
  };

  // Handle product updated
  const handleProductUpdated = (updatedProd: Product) => {
    setProducts((prev) =>
      prev.map((p) => (p.prod_id === updatedProd.prod_id ? updatedProd : p))
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

        {/* Dashboard Content */}
        <main className="flex-1 p-4 sm:p-6 md:p-8 w-full max-w-full overflow-x-hidden bg-white">
          <div className="max-w-6xl mx-auto space-y-6">
            {/* Top Bar: Title & Total Products & Add Product */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-zinc-200">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-zinc-100 rounded-lg text-black border border-zinc-200">
                  <Shirt className="w-6 h-6 text-black" />
                </div>
                <div>
                  <h1 className="typo-page-title text-xl sm:text-2xl font-bold text-black tracking-tight">
                    Products
                  </h1>
                  <p className="typo-caption text-xs sm:text-sm text-zinc-500">
                    Manage base apparel catalog, fits, collar styles, and fabrics
                  </p>
                </div>
              </div>

              {/* Total products count & Add Product Button */}
              <div className="flex items-center gap-3">
                {/* Total products count display */}
                <div className="px-4 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-center">
                  <span className="block text-xs uppercase tracking-wider text-zinc-500 font-semibold">
                    Total products
                  </span>
                  <span className="text-lg font-bold text-black font-mono">
                    {products.length}
                  </span>
                </div>

                {/* Add Product Button: Grey color, turns dark black on tap */}
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(true)}
                  className="ui-btn ui-btn-grey ui-btn-md px-4 py-2 font-medium flex items-center gap-2 shadow-xs cursor-pointer"
                >
                  <Plus className="w-4 h-4 text-white" />
                  <span>Add Product</span>
                </button>
              </div>
            </div>

            {/* Filters: Category search & select + Search bar (prod_id, name) */}
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1">
                {/* Search bar (prod_id, name) with non-overlapping padding */}
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by prod_id or name..."
                    style={{ paddingLeft: '2.5rem' }}
                    className="ui-input pr-4 text-sm text-black border border-zinc-300 focus:border-black rounded-lg w-full bg-white"
                  />
                </div>

                {/* Filters: Category Search & Select */}
                <div className="flex items-center gap-2 sm:w-64">
                  <Filter className="w-4 h-4 text-zinc-500 flex-shrink-0" />
                  <select
                    value={selectedCategoryFilter}
                    onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                    className="ui-select text-xs sm:text-sm text-black border border-zinc-300 focus:border-black rounded-lg w-full bg-white cursor-pointer"
                  >
                    <option value="all">All Categories</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name} ({cat.cat_id})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={refreshProducts}
                  disabled={dataLoading}
                  className="ui-btn ui-btn-outline ui-btn-sm text-xs text-black border-zinc-300 hover:bg-zinc-100 flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                  title="Refresh products"
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

            {/* Display products table: (prod_id, name, category, fit, collar, fabric, status, open button) */}
            <div className="ui-table-container border border-zinc-200 rounded-lg overflow-hidden bg-white shadow-xs">
              <div className="overflow-x-auto">
                <table className="ui-table w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-zinc-100 border-b border-zinc-200">
                      <th className="ui-table-th py-3 px-4 font-semibold text-xs text-zinc-600 uppercase tracking-wider">
                        prod_id
                      </th>
                      <th className="ui-table-th py-3 px-4 font-semibold text-xs text-zinc-600 uppercase tracking-wider">
                        Name
                      </th>
                      <th className="ui-table-th py-3 px-4 font-semibold text-xs text-zinc-600 uppercase tracking-wider">
                        Category
                      </th>
                      <th className="ui-table-th py-3 px-4 font-semibold text-xs text-zinc-600 uppercase tracking-wider">
                        Fit
                      </th>
                      <th className="ui-table-th py-3 px-4 font-semibold text-xs text-zinc-600 uppercase tracking-wider">
                        Collar
                      </th>
                      <th className="ui-table-th py-3 px-4 font-semibold text-xs text-zinc-600 uppercase tracking-wider">
                        Fabric
                      </th>
                      <th className="ui-table-th py-3 px-4 font-semibold text-xs text-zinc-600 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="ui-table-th py-3 px-4 font-semibold text-xs text-zinc-600 uppercase tracking-wider text-right">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200">
                    {dataLoading ? (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-sm text-zinc-500">
                          Loading products...
                        </td>
                      </tr>
                    ) : filteredProducts.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center">
                          <Shirt className="w-8 h-8 text-zinc-300 mx-auto mb-2" />
                          <p className="text-sm font-medium text-zinc-600">
                            {searchQuery || selectedCategoryFilter !== 'all'
                              ? 'No products match your filters.'
                              : 'No products created yet.'}
                          </p>
                          <p className="text-xs text-zinc-400 mt-1">
                            {searchQuery || selectedCategoryFilter !== 'all'
                              ? 'Try clearing search or changing category filter.'
                              : 'Click "Add Product" above to create your first apparel item.'}
                          </p>
                        </td>
                      </tr>
                    ) : (
                      filteredProducts.map((product) => (
                        <tr
                          key={product.prod_id}
                          className="hover:bg-zinc-50 transition-colors"
                        >
                          {/* prod_id */}
                          <td className="py-3 px-4 text-sm font-mono font-semibold text-black whitespace-nowrap">
                            {product.prod_id}
                          </td>

                          {/* Name */}
                          <td className="py-3 px-4 text-sm text-black font-medium">
                            {product.name}
                          </td>

                          {/* Category */}
                          <td className="py-3 px-4 text-sm text-zinc-700">
                            <span className="inline-flex items-center px-2 py-0.5 bg-zinc-100 border border-zinc-200 rounded text-xs font-medium">
                              {product.category_name ||
                                categories.find((c) => c.id === product.category_id)?.name ||
                                '—'}
                            </span>
                          </td>

                          {/* Fit */}
                          <td className="py-3 px-4 text-sm text-zinc-600">
                            {product.fit || '—'}
                          </td>

                          {/* Collar */}
                          <td className="py-3 px-4 text-sm text-zinc-600">
                            {product.collar || '—'}
                          </td>

                          {/* Fabric */}
                          <td className="py-3 px-4 text-sm text-zinc-600">
                            {product.fabric || '—'}
                          </td>

                          {/* Status */}
                          <td className="py-3 px-4 text-sm">
                            {product.status ? (
                              <span className="ui-badge ui-badge-success text-xs font-medium">
                                Active
                              </span>
                            ) : (
                              <span className="ui-badge ui-badge-default text-xs font-medium">
                                Inactive
                              </span>
                            )}
                          </td>

                          {/* Actions: Colors Button + Variants Button + Open Button */}
                          <td className="py-3 px-4 text-sm text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              <Link
                                href={`/admin/products/colors?product_id=${product.id}`}
                                className="ui-btn ui-btn-grey ui-btn-sm px-2.5 py-1 font-medium text-xs cursor-pointer inline-flex items-center gap-1 shadow-2xs"
                                title="Manage product colors & images"
                              >
                                <Palette className="w-3.5 h-3.5 text-white" />
                                <span>Colors</span>
                              </Link>
                              <Link
                                href={`/admin/products/productvariants?product_id=${product.id}`}
                                className="ui-btn ui-btn-grey ui-btn-sm px-2.5 py-1 font-medium text-xs cursor-pointer inline-flex items-center gap-1 shadow-2xs"
                                title="Manage product variants"
                              >
                                <Layers className="w-3.5 h-3.5 text-white" />
                                <span>Variants</span>
                              </Link>
                              <button
                                type="button"
                                onClick={() => setSelectedProduct(product)}
                                className="ui-btn ui-btn-outline ui-btn-sm px-2.5 py-1 font-medium text-xs cursor-pointer inline-flex items-center gap-1 border-zinc-300 text-black hover:bg-zinc-100"
                              >
                                <span>Open</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Results count text & clear filters */}
            {!dataLoading && (
              <div className="flex items-center justify-between text-xs text-zinc-500 px-1">
                <span>
                  Showing {filteredProducts.length} of {products.length} products
                </span>
                {(searchQuery || selectedCategoryFilter !== 'all') && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedCategoryFilter('all');
                    }}
                    className="text-black underline hover:text-zinc-700 cursor-pointer"
                  >
                    Clear filters
                  </button>
                )}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Add Product Modal */}
      {isAddModalOpen && (
        <AddProductModal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          productsCount={products.length}
          existingProducts={products}
          onProductCreated={handleProductCreated}
        />
      )}

      {/* Open Product Modal */}
      {selectedProduct && (
        <OpenProductModal
          isOpen={Boolean(selectedProduct)}
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
          onProductUpdated={handleProductUpdated}
        />
      )}
    </div>
  );
}
