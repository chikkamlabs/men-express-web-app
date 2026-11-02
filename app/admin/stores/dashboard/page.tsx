'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Plus, Store, RefreshCw, X } from 'lucide-react';
import { getCurrentSupabaseUser } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import AdminHeader from '@/components/admin/header';
import AdminSidebar from '@/components/admin/sidebar';
import AddStoreModal from '@/components/addstore';
import OpenStoreModal from '@/components/openstore';
import { StoreItem, getStores } from '@/lib/stores';

export default function AdminStoresDashboardPage() {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Stores data states
  const [stores, setStores] = useState<StoreItem[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedStore, setSelectedStore] = useState<StoreItem | null>(null);

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

  // Load stores from Supabase
  useEffect(() => {
    let ignore = false;
    if (isAuthorized) {
      getStores().then(({ data }) => {
        if (!ignore && data) {
          setStores(data);
          setDataLoading(false);
        }
      });
    }
    return () => {
      ignore = true;
    };
  }, [isAuthorized]);

  const handleRefresh = async () => {
    setDataLoading(true);
    const { data } = await getStores();
    if (data) {
      setStores(data);
    }
    setDataLoading(false);
  };

  // Search filter by store_id and Name
  const filteredStores = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return stores;
    return stores.filter(
      (item) =>
        item.store_id.toLowerCase().includes(q) ||
        item.name.toLowerCase().includes(q)
    );
  }, [stores, searchQuery]);

  // Handle new store created
  const handleStoreCreated = (newStore: StoreItem) => {
    setStores((prev) => {
      const exists = prev.some((s) => s.id === newStore.id || s.store_id === newStore.store_id);
      if (exists) {
        return prev.map((s) => (s.id === newStore.id ? newStore : s));
      }
      return [...prev, newStore];
    });
  };

  // Handle store updated
  const handleStoreUpdated = (updatedStore: StoreItem) => {
    setStores((prev) =>
      prev.map((s) => (s.id === updatedStore.id ? updatedStore : s))
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
            {/* Top Bar: Title & Total Stores Count & Add Store Button */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-zinc-200">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-zinc-100 rounded-lg text-black border border-zinc-200">
                  <Store className="w-6 h-6 text-black" />
                </div>
                <div>
                  <h1 className="typo-page-title text-xl sm:text-2xl font-bold text-black tracking-tight">
                    Stores
                  </h1>
                  <p className="typo-caption text-xs sm:text-sm text-zinc-500">
                    Manage physical store branches, addresses, contacts, and store login accounts
                  </p>
                </div>
              </div>

              {/* Total Stores Count & Add Store Button */}
              <div className="flex items-center gap-3">
                {/* Total Stores Count */}
                <div className="px-4 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-center">
                  <span className="block text-xs uppercase tracking-wider text-zinc-500 font-semibold">
                    Total Stores
                  </span>
                  <span className="text-lg font-bold text-black font-mono">
                    {stores.length}
                  </span>
                </div>

                {/* Add Store Button */}
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(true)}
                  className="ui-btn ui-btn-grey ui-btn-md px-4 py-2 font-medium flex items-center gap-2 shadow-xs cursor-pointer"
                >
                  <Plus className="w-4 h-4 text-white" />
                  <span>Add Store</span>
                </button>
              </div>
            </div>

            {/* Controls: Search Bar (store_id, Name) */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by store_id or Name..."
                  style={{ paddingLeft: '2.5rem' }}
                  className="ui-input pr-8 text-sm text-black border border-zinc-300 focus:border-black rounded-lg w-full bg-white"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-black cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleRefresh}
                  disabled={dataLoading}
                  className="ui-btn ui-btn-outline ui-btn-sm text-xs text-black border-zinc-300 hover:bg-zinc-100 flex items-center gap-1.5 cursor-pointer"
                  title="Refresh stores"
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

            {/* Display list of Stores (Store_id, Name, email, mobile, open) */}
            <div className="ui-table-container border border-zinc-200 rounded-lg overflow-hidden bg-white shadow-xs">
              <table className="ui-table w-full text-left border-collapse">
                <thead>
                  <tr className="bg-zinc-100 border-b border-zinc-200">
                    <th className="ui-table-th py-3 px-4 font-semibold text-xs text-zinc-600 uppercase tracking-wider">
                      Store_id
                    </th>
                    <th className="ui-table-th py-3 px-4 font-semibold text-xs text-zinc-600 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="ui-table-th py-3 px-4 font-semibold text-xs text-zinc-600 uppercase tracking-wider">
                      Email
                    </th>
                    <th className="ui-table-th py-3 px-4 font-semibold text-xs text-zinc-600 uppercase tracking-wider">
                      Mobile
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
                        Loading stores...
                      </td>
                    </tr>
                  ) : filteredStores.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center">
                        <Store className="w-8 h-8 text-zinc-300 mx-auto mb-2" />
                        <p className="text-sm font-medium text-zinc-600">
                          {searchQuery
                            ? 'No stores match your search.'
                            : 'No stores registered yet.'}
                        </p>
                        <p className="text-xs text-zinc-400 mt-1">
                          {searchQuery
                            ? 'Try searching by a different name or store_id.'
                            : 'Click "Add Store" above to register your first store.'}
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredStores.map((store) => (
                      <tr
                        key={store.id || store.store_id}
                        className="hover:bg-zinc-50 transition-colors"
                      >
                        {/* Store_id */}
                        <td className="py-3 px-4 text-sm font-mono font-bold text-black whitespace-nowrap">
                          {store.store_id}
                        </td>

                        {/* Name & Address */}
                        <td className="py-3 px-4 text-sm">
                          <div className="text-black font-medium">{store.name}</div>
                          {store.address && (
                            <div className="text-xs text-zinc-500 line-clamp-1 mt-0.5">
                              {store.address}
                            </div>
                          )}
                        </td>

                        {/* Email */}
                        <td className="py-3 px-4 text-sm text-zinc-700 font-mono">
                          {store.email || '—'}
                        </td>

                        {/* Mobile */}
                        <td className="py-3 px-4 text-sm text-zinc-700 font-mono">
                          {store.mobile || '—'}
                        </td>

                        {/* Open Button */}
                        <td className="py-3 px-4 text-sm text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => setSelectedStore(store)}
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

            {/* Results count indicator */}
            {!dataLoading && (
              <div className="flex items-center justify-between text-xs text-zinc-500 px-1">
                <span>
                  Showing {filteredStores.length} of {stores.length} stores
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

      {/* Add Store Modal */}
      {isAddModalOpen && (
        <AddStoreModal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          existingStores={stores}
          onStoreCreated={handleStoreCreated}
        />
      )}

      {/* Open Store Modal */}
      {selectedStore && (
        <OpenStoreModal
          isOpen={Boolean(selectedStore)}
          store={selectedStore}
          onClose={() => setSelectedStore(null)}
          onStoreUpdated={handleStoreUpdated}
        />
      )}
    </div>
  );
}
