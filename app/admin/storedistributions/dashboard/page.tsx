'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Search,
  Plus,
  Package,
  RefreshCw,
  Calendar,
  Store,
  ExternalLink,
  Filter,
  X,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { getCurrentSupabaseUser } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import AdminHeader from '@/components/admin/header';
import AdminSidebar from '@/components/admin/sidebar';
import { StoreDistribution, getStoreDistributions } from '@/lib/storedistributions';
import { StoreItem, getStores } from '@/lib/stores';



export default function AdminStoreDistributionsDashboardPage() {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Filters
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStoreId, setSelectedStoreId] = useState<string>('all');
  const [storeSearchText, setStoreSearchText] = useState('');
  const [isStoreDropdownOpen, setIsStoreDropdownOpen] = useState(false);

  // Data States
  const [distributions, setDistributions] = useState<StoreDistribution[]>([]);
  const [stores, setStores] = useState<StoreItem[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

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

  // Load Stores for filter
  useEffect(() => {
    let ignore = false;
    if (isAuthorized) {
      getStores().then(({ data }) => {
        if (!ignore && data) {
          setStores(data);
        }
      });
    }
    return () => {
      ignore = true;
    };
  }, [isAuthorized]);

  // Load Store Distributions matching filters
  useEffect(() => {
    let ignore = false;
    if (isAuthorized && fromDate && toDate) {
      getStoreDistributions({
        fromDate,
        toDate,
        storeId: selectedStoreId !== 'all' ? selectedStoreId : undefined,
      }).then(({ data }) => {
        if (!ignore && data) {
          setDistributions(data);
          setDataLoading(false);
        }
      });
    }
    return () => {
      ignore = true;
    };
  }, [isAuthorized, fromDate, toDate, selectedStoreId]);


  // Initialize default date filters after component mounts
useEffect(() => {
  const today = new Date();
  const toDateStr = today.toISOString().split('T')[0];

  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  const fromDateStr = oneWeekAgo.toISOString().split('T')[0];

  setFromDate(fromDateStr);
  setToDate(toDateStr);
}, []);

  const handleRefresh = async () => {
    setDataLoading(true);
    const { data } = await getStoreDistributions({
      fromDate,
      toDate,
      storeId: selectedStoreId !== 'all' ? selectedStoreId : undefined,
    });
    if (data) {
      setDistributions(data);
    }
    setDataLoading(false);
  };

  // Filtered Stores for dropdown search
  const filteredStoresList = useMemo(() => {
    if (!storeSearchText.trim()) return stores;
    const q = storeSearchText.toLowerCase();
    return stores.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.store_id.toLowerCase().includes(q)
    );
  }, [stores, storeSearchText]);

  // Filtered Distributions by search bar (distribution_id)
  const filteredDistributions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return distributions;
    return distributions.filter((d) => d.distribution_id.toLowerCase().includes(q));
  }, [distributions, searchQuery]);

  const selectedStoreName = useMemo(() => {
    if (selectedStoreId === 'all') return 'All Stores';
    const found = stores.find((s) => s.id === selectedStoreId);
    return found ? `${found.name} (${found.store_id})` : 'Selected Store';
  }, [selectedStoreId, stores]);

  const resetFilters = () => {
  const today = new Date();
  const toDateStr = today.toISOString().split('T')[0];

  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  const fromDateStr = oneWeekAgo.toISOString().split('T')[0];

  setFromDate(fromDateStr);
  setToDate(toDateStr);
  setSelectedStoreId('all');
  setSearchQuery('');
  setStoreSearchText('');
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
      {/* Header */}
      <AdminHeader
        onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
        isSidebarOpen={sidebarOpen}
      />

      <div className="flex flex-1 min-h-[calc(100vh-4rem)] w-full max-w-full relative overflow-x-hidden">
        {/* Sidebar */}
        <AdminSidebar
          mobileOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        {/* Content */}
        <main className="flex-1 p-4 sm:p-6 md:p-8 w-full max-w-full overflow-x-hidden bg-white">
          <div className="max-w-6xl mx-auto space-y-6">
            {/* Top Bar: Title & Total Count & Add Button */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-zinc-200">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-zinc-100 rounded-lg text-black border border-zinc-200">
                  <Package className="w-6 h-6 text-black" />
                </div>
                <div>
                  <h1 className="typo-page-title text-xl sm:text-2xl font-bold text-black tracking-tight">
                    Store Distributions
                  </h1>
                  <p className="typo-caption text-xs sm:text-sm text-zinc-500">
                    Track stock allocations and distribution dispatches to store outlets
                  </p>
                </div>
              </div>

              {/* Stats & CTA: Total Store Distributions (Count as per Filtered Dates) & Add Button */}
              <div className="flex items-center gap-3">
                <div className="px-4 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-center">
                  <span className="block text-xs uppercase tracking-wider text-zinc-500 font-semibold">
                    Total Store Distributions
                  </span>
                  <span className="text-lg font-bold text-black font-mono">
                    {distributions.length}
                  </span>
                </div>

                <Link
                  href="/admin/addstoredistribution"
                  className="ui-btn ui-btn-grey ui-btn-md px-4 py-2 font-medium flex items-center gap-2 shadow-xs cursor-pointer inline-flex items-center"
                >
                  <Plus className="w-4 h-4 text-white" />
                  <span>Add Store Distribution</span>
                </Link>
              </div>
            </div>

            {/* Controls: Search Bar (distribution_id) & Filters (Store, From Date, To Date) */}
            <div className="space-y-3 p-4 bg-zinc-50 border border-zinc-200 rounded-lg">
              <div className="flex items-center gap-2 pb-2 border-b border-zinc-200 text-xs font-semibold text-zinc-700 uppercase tracking-wide">
                <Filter className="w-3.5 h-3.5 text-zinc-500" />
                <span>Filters &amp; Search</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* Search Bar (distribution_id) */}
                <div className="relative">
                  <label className="block text-[11px] font-medium text-zinc-500 mb-1">
                    Search Distribution ID
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="e.g. distribution_12345..."
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

                {/* Filter by Store (search & select) */}
                <div className="relative">
                  <label className="block text-[11px] font-medium text-zinc-500 mb-1">
                    Filter by Store
                  </label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setIsStoreDropdownOpen((prev) => !prev)}
                      className="w-full h-9 px-3 text-left text-xs bg-white border border-zinc-300 rounded-md text-black flex items-center justify-between focus:outline-hidden focus:border-black"
                    >
                      <span className="truncate">{selectedStoreName}</span>
                      <Store className="w-3.5 h-3.5 text-zinc-400 flex-shrink-0 ml-1" />
                    </button>

                    {isStoreDropdownOpen && (
                      <div className="absolute z-30 left-0 right-0 mt-1 bg-white border border-zinc-300 rounded-md shadow-lg p-2 space-y-2">
                        <div className="relative">
                          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
                          <input
                            type="text"
                            value={storeSearchText}
                            onChange={(e) => setStoreSearchText(e.target.value)}
                            placeholder="Search store..."
                            style={{ paddingLeft: '1.75rem' }}
                            className="w-full text-xs py-1.5 pr-2 border border-zinc-200 rounded focus:border-black focus:outline-hidden bg-white text-black"
                            autoFocus
                          />
                        </div>

                        <div className="max-h-48 overflow-y-auto space-y-0.5 divide-y divide-zinc-100">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedStoreId('all');
                              setIsStoreDropdownOpen(false);
                            }}
                            className={`w-full text-left px-2 py-1.5 text-xs rounded hover:bg-zinc-100 ${
                              selectedStoreId === 'all'
                                ? 'bg-zinc-100 font-semibold text-black'
                                : 'text-zinc-700'
                            }`}
                          >
                            All Stores
                          </button>
                          {filteredStoresList.length === 0 ? (
                            <div className="px-2 py-2 text-xs text-zinc-400 text-center">
                              No stores found
                            </div>
                          ) : (
                            filteredStoresList.map((st) => (
                              <button
                                key={st.id}
                                type="button"
                                onClick={() => {
                                  setSelectedStoreId(st.id);
                                  setIsStoreDropdownOpen(false);
                                }}
                                className={`w-full text-left px-2 py-1.5 text-xs rounded hover:bg-zinc-100 flex flex-col ${
                                  selectedStoreId === st.id
                                    ? 'bg-zinc-100 font-semibold text-black'
                                    : 'text-zinc-700'
                                }`}
                              >
                                <span className="font-medium text-black">{st.name}</span>
                                <span className="text-[10px] text-zinc-400 font-mono">
                                  {st.store_id} {st.mobile ? `• ${st.mobile}` : ''}
                                </span>
                              </button>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* From Date (default last one week) */}
                <div>
                  <label className="block text-[11px] font-medium text-zinc-500 mb-1">
                    From Date
                  </label>
                  <input
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    className="ui-input text-xs text-black border border-zinc-300 focus:border-black rounded-md w-full bg-white h-9 px-3"
                  />
                </div>

                {/* To Date (default today) */}
                <div>
                  <label className="block text-[11px] font-medium text-zinc-500 mb-1">
                    To Date
                  </label>
                  <input
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    className="ui-input text-xs text-black border border-zinc-300 focus:border-black rounded-md w-full bg-white h-9 px-3"
                  />
                </div>
              </div>

              {/* Action row */}
              <div className="flex items-center justify-between pt-2 text-xs">
                <span className="text-zinc-500">
                  Date range: <strong className="text-black font-mono">{fromDate || 'Start'}</strong> to{' '}
                  <strong className="text-black font-mono">{toDate || 'End'}</strong>
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="text-xs text-zinc-600 hover:text-black underline cursor-pointer"
                  >
                    Reset defaults
                  </button>
                  <button
                    type="button"
                    onClick={handleRefresh}
                    disabled={dataLoading}
                    className="ui-btn ui-btn-outline ui-btn-sm text-xs text-black border-zinc-300 hover:bg-zinc-100 flex items-center gap-1.5 cursor-pointer h-8 px-2.5"
                    title="Refresh distributions list"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 text-black ${dataLoading ? 'animate-spin' : ''}`} />
                    <span>Refresh</span>
                  </button>
                </div>
              </div>
            </div>

            {/* List of Store Distributions Table (distribution_id, date, status, accepted_at, open) */}
            <div className="ui-table-container border border-zinc-200 rounded-lg overflow-hidden bg-white shadow-xs">
              <table className="ui-table w-full text-left border-collapse">
                <thead>
                  <tr className="bg-zinc-100 border-b border-zinc-200">
                    <th className="ui-table-th py-3 px-4 font-semibold text-xs text-zinc-600 uppercase tracking-wider">
                      Distribution ID
                    </th>
                    <th className="ui-table-th py-3 px-4 font-semibold text-xs text-zinc-600 uppercase tracking-wider">
                      Target Store
                    </th>
                    <th className="ui-table-th py-3 px-4 font-semibold text-xs text-zinc-600 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="ui-table-th py-3 px-4 font-semibold text-xs text-zinc-600 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="ui-table-th py-3 px-4 font-semibold text-xs text-zinc-600 uppercase tracking-wider">
                      Accepted At
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
                        <span>Loading distributions...</span>
                      </td>
                    </tr>
                  ) : filteredDistributions.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center">
                        <Package className="w-8 h-8 text-zinc-300 mx-auto mb-2" />
                        <p className="text-sm font-medium text-zinc-600">
                          {searchQuery || selectedStoreId !== 'all'
                            ? 'No distributions match your selected filters.'
                            : 'No store distributions found in this date range.'}
                        </p>
                        <p className="text-xs text-zinc-400 mt-1">
                          Click &quot;Add Store Distribution&quot; above to dispatch stock to a store outlet.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredDistributions.map((dist) => (
                      <tr key={dist.id} className="hover:bg-zinc-50 transition-colors">
                        {/* distribution_id */}
                        <td className="py-3 px-4 text-sm font-mono font-bold text-black whitespace-nowrap">
                          {dist.distribution_id}
                        </td>

                        {/* Target Store */}
                        <td className="py-3 px-4 text-sm">
                          <div className="font-medium text-black">
                            {dist.store_name || '—'}
                          </div>
                          <div className="text-xs text-zinc-500 font-mono">
                            {dist.store_code || ''} {dist.store_address ? `• ${dist.store_address}` : ''}
                          </div>
                        </td>

                        {/* date */}
                        <td className="py-3 px-4 text-sm font-mono text-zinc-700 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-zinc-400" />
                            <span>{dist.date}</span>
                          </div>
                        </td>

                        {/* status */}
                        <td className="py-3 px-4 text-sm whitespace-nowrap">
                          {dist.status === 'accepted' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Accepted</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                              <Clock className="w-3.5 h-3.5 text-amber-600" />
                              <span>Pending</span>
                            </span>
                          )}
                        </td>

                        {/* accepted_at */}
                        <td className="py-3 px-4 text-sm font-mono text-zinc-600 whitespace-nowrap">
                          {dist.accepted_at
                            ? new Date(dist.accepted_at).toLocaleString('en-IN', {
                                dateStyle: 'short',
                                timeStyle: 'short',
                              })
                            : '—'}
                        </td>

                        {/* Open Button: links to app/admin/openstoredistribution/page.tsx */}
                        <td className="py-3 px-4 text-sm text-right whitespace-nowrap">
                          <Link
                            href={`/admin/openstoredistribution?id=${encodeURIComponent(
                              dist.id
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
                  Showing {filteredDistributions.length} of {distributions.length} distributions in date range
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
