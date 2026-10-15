'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Plus, FolderTree, RefreshCw } from 'lucide-react';
import { getCurrentSupabaseUser } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import AdminHeader from '@/components/admin/header';
import AdminSidebar from '@/components/admin/sidebar';
import AddCategoryModal from '@/components/admin/addcategory';
import OpenCategoryModal from '@/components/admin/opencategory';
import { Category, getCategories } from '@/lib/categoriesStore';

export default function AdminCategoriesDashboardPage() {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Categories data states
  const [categories, setCategories] = useState<Category[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);

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

  // Load categories asynchronously
  useEffect(() => {
    let ignore = false;
    if (isAuthorized) {
      getCategories().then(({ data }) => {
        if (!ignore && data) {
          setCategories(data);
          setDataLoading(false);
        }
      });
    }
    return () => {
      ignore = true;
    };
  }, [isAuthorized]);

  const refreshCategories = async () => {
    setDataLoading(true);
    const { data } = await getCategories();
    if (data) {
      setCategories(data);
    }
    setDataLoading(false);
  };

  // Filtered categories by cat_id and name
  const filteredCategories = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return categories;
    return categories.filter(
      (item) =>
        item.cat_id.toLowerCase().includes(query) ||
        item.name.toLowerCase().includes(query)
    );
  }, [categories, searchQuery]);

  // Handle new category created
  const handleCategoryCreated = (newCat: Category) => {
    setCategories((prev) => {
      const exists = prev.some((c) => c.cat_id === newCat.cat_id);
      if (exists) {
        return prev.map((c) => (c.cat_id === newCat.cat_id ? newCat : c));
      }
      return [...prev, newCat];
    });
  };

  // Handle category updated
  const handleCategoryUpdated = (updatedCat: Category) => {
    setCategories((prev) =>
      prev.map((c) => (c.cat_id === updatedCat.cat_id ? updatedCat : c))
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
            {/* Top Bar: Title & Stats & Add Category */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-zinc-200">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-zinc-100 rounded-lg text-black border border-zinc-200">
                  <FolderTree className="w-6 h-6 text-black" />
                </div>
                <div>
                  <h1 className="typo-page-title text-xl sm:text-2xl font-bold text-black tracking-tight">
                    Categories
                  </h1>
                  <p className="typo-caption text-xs sm:text-sm text-zinc-500">
                    Manage store clothing categories and catalog classifications
                  </p>
                </div>
              </div>

              {/* Total categories count & Add Category Button */}
              <div className="flex items-center gap-3">
                {/* Total Categories Count display */}
                <div className="px-4 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-center">
                  <span className="block text-xs uppercase tracking-wider text-zinc-500 font-semibold">
                    Total categories
                  </span>
                  <span className="text-lg font-bold text-black font-mono">
                    {categories.length}
                  </span>
                </div>

                {/* Add Category Button: Grey color, turns dark black on tap */}
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(true)}
                  className="ui-btn ui-btn-grey ui-btn-md px-4 py-2 font-medium flex items-center gap-2 shadow-xs cursor-pointer"
                >
                  <Plus className="w-4 h-4 text-white" />
                  <span>Add Category</span>
                </button>
              </div>
            </div>

            {/* Controls: Search Bar (cat_id, name) */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by cat_id or name..."
                  style={{ paddingLeft: '2.5rem' }}
                  className="ui-input pr-4 text-sm text-black border border-zinc-300 focus:border-black rounded-lg w-full bg-white"
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={refreshCategories}
                  disabled={dataLoading}
                  className="ui-btn ui-btn-outline ui-btn-sm text-xs text-black border-zinc-300 hover:bg-zinc-100 flex items-center gap-1.5 cursor-pointer"
                  title="Refresh categories"
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

            {/* List of categories: Table */}
            <div className="ui-table-container border border-zinc-200 rounded-lg overflow-hidden bg-white shadow-xs">
              <table className="ui-table w-full text-left border-collapse">
                <thead>
                  <tr className="bg-zinc-100 border-b border-zinc-200">
                    <th className="ui-table-th py-3 px-4 font-semibold text-xs text-zinc-600 uppercase tracking-wider">
                      cat_id
                    </th>
                    <th className="ui-table-th py-3 px-4 font-semibold text-xs text-zinc-600 uppercase tracking-wider">
                      Name
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
                      <td colSpan={4} className="py-8 text-center text-sm text-zinc-500">
                        Loading categories...
                      </td>
                    </tr>
                  ) : filteredCategories.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-12 text-center">
                        <FolderTree className="w-8 h-8 text-zinc-300 mx-auto mb-2" />
                        <p className="text-sm font-medium text-zinc-600">
                          {searchQuery
                            ? 'No categories match your search.'
                            : 'No categories created yet.'}
                        </p>
                        <p className="text-xs text-zinc-400 mt-1">
                          {searchQuery
                            ? 'Try searching by a different name or cat_id.'
                            : 'Click "Add Category" above to create your first category.'}
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredCategories.map((category) => (
                      <tr
                        key={category.cat_id}
                        className="hover:bg-zinc-50 transition-colors"
                      >
                        {/* cat_id */}
                        <td className="py-3 px-4 text-sm font-mono font-semibold text-black">
                          {category.cat_id}
                        </td>

                        {/* Name */}
                        <td className="py-3 px-4 text-sm text-black font-medium">
                          <div>
                            <span>{category.name}</span>
                            {category.description && (
                              <p className="text-xs text-zinc-500 truncate max-w-xs mt-0.5">
                                {category.description}
                              </p>
                            )}
                          </div>
                        </td>

                        {/* Status */}
                        <td className="py-3 px-4 text-sm">
                          {category.status ? (
                            <span className="ui-badge ui-badge-success text-xs font-medium">
                              Active
                            </span>
                          ) : (
                            <span className="ui-badge ui-badge-default text-xs font-medium">
                              Inactive
                            </span>
                          )}
                        </td>

                        {/* Open Button: Grey color, turns dark black on tap */}
                        <td className="py-3 px-4 text-sm text-right">
                          <button
                            type="button"
                            onClick={() => setSelectedCategory(category)}
                            className="ui-btn ui-btn-grey ui-btn-sm px-3 py-1 font-medium text-xs cursor-pointer inline-flex items-center gap-1.5"
                          >
                            <span>Open</span>
                          </button>
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
                  Showing {filteredCategories.length} of {categories.length}{' '}
                  categories
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

      {/* Add Category Modal */}
      {isAddModalOpen && (
        <AddCategoryModal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          categoriesCount={categories.length}
          existingCategories={categories}
          onCategoryCreated={handleCategoryCreated}
        />
      )}

      {/* Open Category Modal */}
      {selectedCategory && (
        <OpenCategoryModal
          isOpen={Boolean(selectedCategory)}
          category={selectedCategory}
          onClose={() => setSelectedCategory(null)}
          onCategoryUpdated={handleCategoryUpdated}
        />
      )}
    </div>
  );
}
