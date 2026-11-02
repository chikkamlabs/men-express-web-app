'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeftRight,
  Search,
  Calendar,
  RefreshCw,
  ExternalLink,
  Filter,
  X,
  Plus,
  ArrowUpRight,
  ArrowDownLeft,
  Clock,
  CheckCircle2,
  XCircle,
  Building2,
} from 'lucide-react';
import { getCurrentSupabaseUser } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import StoreHeader from '@/components/store/header';
import StoreSidebar from '@/components/store/sidebar';
import {
  StoreTransfer,
  getStoreTransfers,
} from '@/lib/store/transfersStore';

export default function StoreTransfersDashboardPage() {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [currentStoreId, setCurrentStoreId] = useState<string | undefined>(undefined);
  const [storeName, setStoreName] = useState('Store');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Helper for date formatting
  const getDefaultDates = () => {
    const now = new Date();
    const past7 = new Date();
    past7.setDate(now.getDate() - 7);
    const formatDate = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const dt = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${dt}`;
    };
    return {
      from: formatDate(past7),
      to: formatDate(now),
    };
  };

  // Filters & Search (default last one week as requested)
  // Filters & Search (default last one week as requested)
const [fromDate, setFromDate] = useState<string>('');
const [toDate, setToDate] = useState<string>('');
const [directionFilter, setDirectionFilter] = useState<'all' | 'in' | 'out'>('all');
const [searchTransferId, setSearchTransferId] = useState<string>('');

useEffect(() => {
  const defaults = getDefaultDates();
  setFromDate(defaults.from);
  setToDate(defaults.to);
}, []);

  // Data states
  const [transfers, setTransfers] = useState<StoreTransfer[]>([]);
  const [inCount, setInCount] = useState<number>(0);
  const [outCount, setOutCount] = useState<number>(0);
  const [totalCount, setTotalCount] = useState<number>(0);
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

  // Load transfers whenever filters change
  useEffect(() => {
    let ignore = false;
    if (isAuthorized && currentStoreId && fromDate && toDate) {
      async function loadData() {
        const result = await getStoreTransfers({
          storeId: currentStoreId!,
          direction: directionFilter,
          fromDate: fromDate || undefined,
          toDate: toDate || undefined,
          searchTransferId: searchTransferId.trim() || undefined,
        });

        if (!ignore) {
          setTransfers(result.transfers);
          setInCount(result.inCount);
          setOutCount(result.outCount);
          setTotalCount(result.totalCount);
          setDataLoading(false);
        }
      }

      loadData();
    }
    return () => {
      ignore = true;
    };
  }, [isAuthorized, currentStoreId, directionFilter, fromDate, toDate, searchTransferId]);

  const handleRefresh = async () => {
    if (!currentStoreId) return;
    setDataLoading(true);
    const result = await getStoreTransfers({
      storeId: currentStoreId,
      direction: directionFilter,
      fromDate: fromDate || undefined,
      toDate: toDate || undefined,
      searchTransferId: searchTransferId.trim() || undefined,
    });
    setTransfers(result.transfers);
    setInCount(result.inCount);
    setOutCount(result.outCount);
    setTotalCount(result.totalCount);
    setDataLoading(false);
  };

  const handleResetFilters = () => {
  const defaults = getDefaultDates();
  setFromDate(defaults.from);
  setToDate(defaults.to);
  setDirectionFilter('all');
  setSearchTransferId('');
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
        {/* Sidebar */}
        <StoreSidebar
          mobileOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        {/* Content Area */}
        <main className="flex-1 p-4 sm:p-6 md:p-8 w-full max-w-full overflow-x-hidden bg-zinc-50">
          <div className="max-w-6xl mx-auto space-y-6">
            {/* Top Bar: Title & Total Store Transfers Metrics (Out & In Count as per Filtered Dates) */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-zinc-200">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-white rounded-lg text-black border border-zinc-200 shadow-xs">
                  <ArrowLeftRight className="w-6 h-6 text-black" />
                </div>
                <div>
                  <h1 className="typo-page-title text-xl sm:text-2xl font-bold text-black tracking-tight">
                    Store Transfers
                  </h1>
                  <p className="typo-caption text-xs sm:text-sm text-zinc-500">
                    Inter-store stock transfers (Inbound &amp; Outbound)
                  </p>
                </div>
              </div>

              {/* Action & Metric Counts */}
              <div className="flex flex-wrap items-center gap-3">
                {/* Total Store Transfers */}
                <div className="px-3.5 py-2 bg-white border border-zinc-200 rounded-lg text-center shadow-xs min-w-[110px]">
                  <span className="block text-[11px] uppercase tracking-wider text-zinc-500 font-semibold">
                    Total Transfers
                  </span>
                  <span className="text-lg font-bold text-black font-mono">
                    {totalCount}
                  </span>
                </div>

                {/* Out Count: from_store is this store */}
                <div className="px-3.5 py-2 bg-white border border-zinc-200 rounded-lg text-center shadow-xs min-w-[110px]">
                  <span className="block text-[11px] uppercase tracking-wider text-rose-600 font-semibold flex items-center justify-center gap-1">
                    <ArrowUpRight className="w-3 h-3" />
                    <span>Out (Sent)</span>
                  </span>
                  <span className="text-lg font-bold text-black font-mono">
                    {outCount}
                  </span>
                </div>

                {/* In Count: to_store is this store */}
                <div className="px-3.5 py-2 bg-white border border-zinc-200 rounded-lg text-center shadow-xs min-w-[110px]">
                  <span className="block text-[11px] uppercase tracking-wider text-emerald-600 font-semibold flex items-center justify-center gap-1">
                    <ArrowDownLeft className="w-3 h-3" />
                    <span>In (Received)</span>
                  </span>
                  <span className="text-lg font-bold text-black font-mono">
                    {inCount}
                  </span>
                </div>

                {/* Add Store Transfer CTA button */}
                <Link
                  href="/store/transfers/addtransfer"
                  className="ui-btn ui-btn-primary ui-btn-md px-4 py-2 flex items-center gap-2 font-bold text-xs sm:text-sm rounded-lg shadow-xs cursor-pointer ml-auto sm:ml-0"
                >
                  <Plus className="w-4 h-4 text-white" />
                  <span>Add Store Transfer</span>
                </Link>
              </div>
            </div>

            {/* Controls: Search bar(transfer_id) & Filters(In or Out, from date to date default last one week) */}
            <div className="space-y-3 p-4 bg-white border border-zinc-200 rounded-lg shadow-xs">
              <div className="flex items-center justify-between pb-2 border-b border-zinc-200 text-xs font-semibold text-zinc-700 uppercase tracking-wide">
                <div className="flex items-center gap-2">
                  <Filter className="w-3.5 h-3.5 text-zinc-500" />
                  <span>Filters &amp; Search</span>
                </div>
                {/* Direction segmented switch: All / In / Out */}
                <div className="inline-flex rounded-md p-0.5 bg-zinc-100 border border-zinc-200">
                  <button
                    type="button"
                    onClick={() => setDirectionFilter('all')}
                    className={`px-3 py-1 text-xs font-semibold rounded ${
                      directionFilter === 'all'
                        ? 'bg-white text-black shadow-xs'
                        : 'text-zinc-600 hover:text-black'
                    } cursor-pointer transition-colors`}
                  >
                    All ({totalCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setDirectionFilter('out')}
                    className={`px-3 py-1 text-xs font-semibold rounded flex items-center gap-1 ${
                      directionFilter === 'out'
                        ? 'bg-white text-rose-700 shadow-xs'
                        : 'text-zinc-600 hover:text-black'
                    } cursor-pointer transition-colors`}
                  >
                    <ArrowUpRight className="w-3 h-3 text-rose-500" />
                    <span>Out ({outCount})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDirectionFilter('in')}
                    className={`px-3 py-1 text-xs font-semibold rounded flex items-center gap-1 ${
                      directionFilter === 'in'
                        ? 'bg-white text-emerald-700 shadow-xs'
                        : 'text-zinc-600 hover:text-black'
                    } cursor-pointer transition-colors`}
                  >
                    <ArrowDownLeft className="w-3 h-3 text-emerald-500" />
                    <span>In ({inCount})</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* Search Bar(transfer_id) */}
                <div className="relative">
                  <label className="block text-[11px] font-medium text-zinc-500 mb-1">
                    Search Transfer ID
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
                    <input
                      type="text"
                      value={searchTransferId}
                      onChange={(e) => setSearchTransferId(e.target.value)}
                      placeholder="e.g. transfer_49201..."
                      style={{ paddingLeft: '2.25rem' }}
                      className="ui-input pr-8 text-xs text-black border border-zinc-300 focus:border-black rounded-md w-full bg-white h-9 font-mono"
                    />
                    {searchTransferId && (
                      <button
                        type="button"
                        onClick={() => setSearchTransferId('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-black cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Filter: From Date (default last one week) */}
                <div>
                  <label className="block text-[11px] font-medium text-zinc-500 mb-1">
                    From Date
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
                    <input
                      type="date"
                      value={fromDate}
                      onChange={(e) => setFromDate(e.target.value)}
                      style={{ paddingLeft: '2.25rem' }}
                      className="ui-input text-xs text-black border border-zinc-300 focus:border-black rounded-md w-full bg-white h-9 font-mono"
                    />
                  </div>
                </div>

                {/* Filter: To Date (default today) */}
                <div>
                  <label className="block text-[11px] font-medium text-zinc-500 mb-1">
                    To Date
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
                    <input
                      type="date"
                      value={toDate}
                      onChange={(e) => setToDate(e.target.value)}
                      style={{ paddingLeft: '2.25rem' }}
                      className="ui-input text-xs text-black border border-zinc-300 focus:border-black rounded-md w-full bg-white h-9 font-mono"
                    />
                  </div>
                </div>

                {/* Reset & Refresh */}
                <div className="flex items-end justify-between sm:justify-start gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleResetFilters}
                    className="text-xs text-zinc-600 hover:text-black underline cursor-pointer py-2"
                  >
                    Reset filters
                  </button>
                  <button
                    type="button"
                    onClick={handleRefresh}
                    disabled={dataLoading}
                    className="ui-btn ui-btn-outline ui-btn-sm text-xs text-black border-zinc-300 hover:bg-zinc-100 flex items-center gap-1.5 cursor-pointer h-9 px-3"
                    title="Refresh transfers"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 text-black ${dataLoading ? 'animate-spin' : ''}`} />
                    <span>Refresh</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Display list of Store Transfers: transfer_id, from & to (either one this store), date & status, open */}
            <div className="ui-table-container border border-zinc-200 rounded-lg overflow-hidden bg-white shadow-xs">
              <table className="ui-table w-full text-left border-collapse">
                <thead>
                  <tr className="bg-zinc-100 border-b border-zinc-200">
                    <th className="ui-table-th py-3 px-4 font-semibold text-xs text-zinc-600 uppercase tracking-wider">
                      Transfer ID
                    </th>
                    <th className="ui-table-th py-3 px-4 font-semibold text-xs text-zinc-600 uppercase tracking-wider">
                      Direction
                    </th>
                    <th className="ui-table-th py-3 px-4 font-semibold text-xs text-zinc-600 uppercase tracking-wider">
                      From &amp; To Stores
                    </th>
                    <th className="ui-table-th py-3 px-4 font-semibold text-xs text-zinc-600 uppercase tracking-wider">
                      Transfer Date
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
                      <td colSpan={6} className="py-12 text-center text-sm text-zinc-500">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-zinc-400" />
                        <span>Loading store transfers...</span>
                      </td>
                    </tr>
                  ) : transfers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center">
                        <ArrowLeftRight className="w-9 h-9 text-zinc-300 mx-auto mb-2" />
                        <p className="text-sm font-semibold text-zinc-700">
                          {searchTransferId
                            ? `No transfers found matching "${searchTransferId}".`
                            : 'No transfers found for the selected date range and filter.'}
                        </p>
                        <p className="text-xs text-zinc-400 mt-1">
                          You can initiate an outbound stock transfer to another outlet.
                        </p>
                        <div className="mt-4">
                          <Link
                            href="/store/transfers/addtransfer"
                            className="ui-btn ui-btn-primary ui-btn-sm px-4 py-1.5 inline-flex items-center gap-1.5 text-xs font-bold"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Add Store Transfer</span>
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    transfers.map((t) => {
                      const isOut = t.from_store_id === currentStoreId;

                      return (
                        <tr key={t.id} className="hover:bg-zinc-50 transition-colors">
                          {/* transfer_id */}
                          <td className="py-3 px-4 text-sm font-mono font-bold text-black whitespace-nowrap">
                            <span className="bg-zinc-100 px-2 py-0.5 rounded border border-zinc-200">
                              {t.transfer_id}
                            </span>
                          </td>

                          {/* Direction */}
                          <td className="py-3 px-4 text-sm whitespace-nowrap">
                            {isOut ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                                <ArrowUpRight className="w-3 h-3 text-rose-600" />
                                <span>Out (Outgoing)</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <ArrowDownLeft className="w-3 h-3 text-emerald-600" />
                                <span>In (Incoming)</span>
                              </span>
                            )}
                          </td>

                          {/* From & To Stores */}
                          <td className="py-3 px-4 text-sm">
                            <div className="flex items-center gap-1.5 text-xs">
                              <span
                                className={`font-semibold ${
                                  isOut ? 'text-black underline font-bold' : 'text-zinc-700'
                                }`}
                              >
                                {t.from_store?.name || (isOut ? storeName : 'Origin Store')}
                              </span>
                              <span className="text-zinc-400">➔</span>
                              <span
                                className={`font-semibold ${
                                  !isOut ? 'text-black underline font-bold' : 'text-zinc-700'
                                }`}
                              >
                                {t.to_store?.name || (!isOut ? storeName : 'Destination Store')}
                              </span>
                            </div>
                            {t.staff?.name && (
                              <div className="text-[11px] text-zinc-400 mt-0.5">
                                Staff: {t.staff.name}
                              </div>
                            )}
                          </td>

                          {/* date */}
                          <td className="py-3 px-4 text-sm text-zinc-700 whitespace-nowrap">
                            <div className="flex items-center gap-1.5 text-xs text-zinc-700">
                              <Clock className="w-3.5 h-3.5 text-zinc-400 flex-shrink-0" />
                              <span>{t.date || '—'}</span>
                            </div>
                          </td>

                          {/* status */}
                          <td className="py-3 px-4 text-sm whitespace-nowrap">
                            {t.status === 'accepted' ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                <span>Accepted</span>
                              </span>
                            ) : t.status === 'rejected' ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                                <XCircle className="w-3 h-3 text-rose-600" />
                                <span>Rejected</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                                <Clock className="w-3 h-3 text-amber-600" />
                                <span>Pending</span>
                              </span>
                            )}
                          </td>

                          {/* open -> app/store/transfers/opentransfer/page.tsx */}
                          <td className="py-3 px-4 text-sm text-right whitespace-nowrap">
                            <Link
                              href={`/store/transfers/opentransfer?id=${encodeURIComponent(
                                t.id
                              )}`}
                              className="ui-btn ui-btn-grey ui-btn-sm px-3 py-1 font-medium text-xs cursor-pointer inline-flex items-center gap-1.5"
                            >
                              <span>Open</span>
                              <ExternalLink className="w-3 h-3 text-white" />
                            </Link>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Results count text & active date range summary */}
            {!dataLoading && (
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between text-xs text-zinc-500 px-1 gap-2">
                <span>
                  Showing {transfers.length} transfers ({directionFilter.toUpperCase()}) between {fromDate} and {toDate}
                </span>
                <span className="font-mono text-zinc-700">
                  Out: {outCount} • In: {inCount}
                </span>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
