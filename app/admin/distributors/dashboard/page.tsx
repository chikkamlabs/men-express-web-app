'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Plus, Truck, RefreshCw } from 'lucide-react';
import { getCurrentSupabaseUser } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import AdminHeader from '@/components/admin/header';
import AdminSidebar from '@/components/admin/sidebar';
import AddDistributorModal from '@/components/admin/adddistributor';
import OpenDistributorModal from '@/components/admin/opendistributor';
import { Distributor, getDistributors } from '@/lib/distributorsStore';

export default function AdminDistributorsDashboardPage() {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Distributors data states
  const [distributors, setDistributors] = useState<Distributor[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedDistributor, setSelectedDistributor] = useState<Distributor | null>(null);

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

  // Load distributors asynchronously
  useEffect(() => {
    let ignore = false;
    if (isAuthorized) {
      getDistributors().then(({ data }) => {
        if (!ignore && data) {
          setDistributors(data);
          setDataLoading(false);
        }
      });
    }
    return () => {
      ignore = true;
    };
  }, [isAuthorized]);

  const refreshDistributors = async () => {
    setDataLoading(true);
    const { data } = await getDistributors();
    if (data) {
      setDistributors(data);
    }
    setDataLoading(false);
  };

  // Filtered distributors by distributor_id and name
  const filteredDistributors = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return distributors;
    return distributors.filter(
      (item) =>
        item.distributor_id.toLowerCase().includes(query) ||
        item.name.toLowerCase().includes(query)
    );
  }, [distributors, searchQuery]);

  // Handle new distributor created
  const handleDistributorCreated = (newDist: Distributor) => {
    setDistributors((prev) => {
      const exists = prev.some((d) => d.distributor_id === newDist.distributor_id);
      if (exists) {
        return prev.map((d) => (d.distributor_id === newDist.distributor_id ? newDist : d));
      }
      return [...prev, newDist];
    });
  };

  // Handle distributor updated
  const handleDistributorUpdated = (updatedDist: Distributor) => {
    setDistributors((prev) =>
      prev.map((d) =>
        d.distributor_id === updatedDist.distributor_id ? updatedDist : d
      )
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
            {/* Top Bar: Title & Stats & Add Distributor */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-zinc-200">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-zinc-100 rounded-lg text-black border border-zinc-200">
                  <Truck className="w-6 h-6 text-black" />
                </div>
                <div>
                  <h1 className="typo-page-title text-xl sm:text-2xl font-bold text-black tracking-tight">
                    Distributors
                  </h1>
                  <p className="typo-caption text-xs sm:text-sm text-zinc-500">
                    Manage wholesale suppliers, purchase balances, and distributor accounts
                  </p>
                </div>
              </div>

              {/* Total Distributors count & Add Distributor Button */}
              <div className="flex items-center gap-3">
                {/* Total Distributors Count display */}
                <div className="px-4 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-center">
                  <span className="block text-xs uppercase tracking-wider text-zinc-500 font-semibold">
                    Total Distributors
                  </span>
                  <span className="text-lg font-bold text-black font-mono">
                    {distributors.length}
                  </span>
                </div>

                {/* Add Distributor Button: Grey color, turns dark black on tap */}
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(true)}
                  className="ui-btn ui-btn-grey ui-btn-md px-4 py-2 font-medium flex items-center gap-2 shadow-xs cursor-pointer"
                >
                  <Plus className="w-4 h-4 text-white" />
                  <span>Add Distributor</span>
                </button>
              </div>
            </div>

            {/* Controls: Search Bar (distributor_id, name) */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by distributor_id or name..."
                  style={{ paddingLeft: '2.5rem' }}
                  className="ui-input pr-4 text-sm text-black border border-zinc-300 focus:border-black rounded-lg w-full bg-white"
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={refreshDistributors}
                  disabled={dataLoading}
                  className="ui-btn ui-btn-outline ui-btn-sm text-xs text-black border-zinc-300 hover:bg-zinc-100 flex items-center gap-1.5 cursor-pointer"
                  title="Refresh distributors"
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

            {/* List of Distributors: Table */}
            <div className="ui-table-container border border-zinc-200 rounded-lg overflow-hidden bg-white shadow-xs">
              <table className="ui-table w-full text-left border-collapse">
                <thead>
                  <tr className="bg-zinc-100 border-b border-zinc-200">
                    <th className="ui-table-th py-3 px-4 font-semibold text-xs text-zinc-600 uppercase tracking-wider">
                      distributor_id
                    </th>
                    <th className="ui-table-th py-3 px-4 font-semibold text-xs text-zinc-600 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="ui-table-th py-3 px-4 font-semibold text-xs text-zinc-600 uppercase tracking-wider">
                      Mobile
                    </th>
                    <th className="ui-table-th py-3 px-4 font-semibold text-xs text-zinc-600 uppercase tracking-wider">
                      Company
                    </th>
                    <th className="ui-table-th py-3 px-4 font-semibold text-xs text-zinc-600 uppercase tracking-wider">
                      Balance
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
                      <td colSpan={7} className="py-8 text-center text-sm text-zinc-500">
                        Loading distributors...
                      </td>
                    </tr>
                  ) : filteredDistributors.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center">
                        <Truck className="w-8 h-8 text-zinc-300 mx-auto mb-2" />
                        <p className="text-sm font-medium text-zinc-600">
                          {searchQuery
                            ? 'No distributors match your search.'
                            : 'No distributors created yet.'}
                        </p>
                        <p className="text-xs text-zinc-400 mt-1">
                          {searchQuery
                            ? 'Try searching by a different name or distributor_id.'
                            : 'Click "Add Distributor" above to create your first distributor.'}
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredDistributors.map((distributor) => (
                      <tr
                        key={distributor.distributor_id}
                        className="hover:bg-zinc-50 transition-colors"
                      >
                        {/* distributor_id */}
                        <td className="py-3 px-4 text-sm font-mono font-semibold text-black whitespace-nowrap">
                          {distributor.distributor_id}
                        </td>

                        {/* Name */}
                        <td className="py-3 px-4 text-sm text-black font-medium">
                          {distributor.name}
                        </td>

                        {/* Mobile */}
                        <td className="py-3 px-4 text-sm text-zinc-600 font-mono">
                          {distributor.mobile || '—'}
                        </td>

                        {/* Company */}
                        <td className="py-3 px-4 text-sm text-zinc-700">
                          {distributor.company || '—'}
                        </td>

                        {/* Balance */}
                        <td className="py-3 px-4 text-sm font-mono font-medium text-black">
                          {Number(distributor.balance || 0).toLocaleString('en-IN', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </td>

                        {/* Status */}
                        <td className="py-3 px-4 text-sm">
                          {distributor.status === 'active' ? (
                            <span className="ui-badge ui-badge-success text-xs font-medium">
                              Active
                            </span>
                          ) : (
                            <span className="ui-badge ui-badge-default text-xs font-medium">
                              Deactive
                            </span>
                          )}
                        </td>

                        {/* Open Button: Grey color, turns dark black on tap */}
                        <td className="py-3 px-4 text-sm text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => setSelectedDistributor(distributor)}
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
                  Showing {filteredDistributors.length} of {distributors.length}{' '}
                  distributors
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

      {/* Add Distributor Modal */}
      {isAddModalOpen && (
        <AddDistributorModal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          distributorsCount={distributors.length}
          existingDistributors={distributors}
          onDistributorCreated={handleDistributorCreated}
        />
      )}

      {/* Open Distributor Modal */}
      {selectedDistributor && (
        <OpenDistributorModal
          isOpen={Boolean(selectedDistributor)}
          distributor={selectedDistributor}
          onClose={() => setSelectedDistributor(null)}
          onDistributorUpdated={handleDistributorUpdated}
        />
      )}
    </div>
  );
}
