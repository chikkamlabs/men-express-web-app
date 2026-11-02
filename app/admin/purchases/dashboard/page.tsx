'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Search,
  Plus,
  ShoppingCart,
  RefreshCw,
  Calendar,
  Building2,
  ExternalLink,
  Filter,
  X,
} from 'lucide-react';
import { getCurrentSupabaseUser } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import AdminHeader from '@/components/admin/header';
import AdminSidebar from '@/components/admin/sidebar';
import { Purchase, getPurchases } from '@/lib/purchasesStore';
import { Distributor, getDistributors } from '@/lib/distributorsStore';


export default function AdminPurchasesDashboardPage() {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Filter States
  const [fromDate, setFromDate] = useState('');
const [toDate, setToDate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDistributorId, setSelectedDistributorId] = useState<string>('all');
  const [distributorSearchText, setDistributorSearchText] = useState('');
  const [isDistributorDropdownOpen, setIsDistributorDropdownOpen] = useState(false);

  // Data States
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [distributors, setDistributors] = useState<Distributor[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
  const today = new Date();
  const toDateStr = today.toISOString().split('T')[0];

  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  const fromDateStr = oneWeekAgo.toISOString().split('T')[0];

  setFromDate(fromDateStr);
  setToDate(toDateStr);
}, []);

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

  // Load Distributors for filter
  useEffect(() => {
    let ignore = false;
    if (isAuthorized) {
      getDistributors().then(({ data }) => {
        if (!ignore && data) {
          setDistributors(data);
        }
      });
    }
    return () => {
      ignore = true;
    };
  }, [isAuthorized]);

  // Load Purchases matching filters
  useEffect(() => {
    let ignore = false;
    if (isAuthorized && fromDate && toDate) {
      getPurchases({
        fromDate,
        toDate,
        distributorId: selectedDistributorId !== 'all' ? selectedDistributorId : undefined,
      }).then(({ data }) => {
        if (!ignore && data) {
          setPurchases(data);
          setDataLoading(false);
        }
      });
    }
    return () => {
      ignore = true;
    };
  }, [isAuthorized, fromDate, toDate, selectedDistributorId]);

  const handleRefresh = async () => {
    setDataLoading(true);
    const { data } = await getPurchases({
      fromDate,
      toDate,
      distributorId: selectedDistributorId !== 'all' ? selectedDistributorId : undefined,
    });
    if (data) {
      setPurchases(data);
    }
    setDataLoading(false);
  };

  // Filtered Distributors for search within the distributor dropdown
  const filteredDistributorsList = useMemo(() => {
    if (!distributorSearchText.trim()) return distributors;
    const q = distributorSearchText.toLowerCase();
    return distributors.filter(
      (d) =>
        d.name.toLowerCase().includes(q) ||
        d.distributor_id.toLowerCase().includes(q) ||
        (d.company && d.company.toLowerCase().includes(q))
    );
  }, [distributors, distributorSearchText]);

  // Filtered Purchases by search bar (purchase_id, invoice_number)
  const filteredPurchases = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return purchases;
    return purchases.filter(
      (p) =>
        p.purchase_id.toLowerCase().includes(query) ||
        (p.invoice_number && p.invoice_number.toLowerCase().includes(query))
    );
  }, [purchases, searchQuery]);

  const selectedDistributorName = useMemo(() => {
    if (selectedDistributorId === 'all') return 'All Distributors';
    const found = distributors.find((d) => d.id === selectedDistributorId);
    return found ? `${found.name} (${found.distributor_id})` : 'Selected Distributor';
  }, [selectedDistributorId, distributors]);

  const resetFilters = () => {
  const today = new Date();
  const toDateStr = today.toISOString().split('T')[0];

  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  const fromDateStr = oneWeekAgo.toISOString().split('T')[0];

  setFromDate(fromDateStr);
  setToDate(toDateStr);
  setSelectedDistributorId('all');
  setSearchQuery('');
  setDistributorSearchText('');
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
            {/* Top Bar: Title & Total Purchases count & Add Purchase Button */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-zinc-200">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-zinc-100 rounded-lg text-black border border-zinc-200">
                  <ShoppingCart className="w-6 h-6 text-black" />
                </div>
                <div>
                  <h1 className="typo-page-title text-xl sm:text-2xl font-bold text-black tracking-tight">
                    Purchases
                  </h1>
                  <p className="typo-caption text-xs sm:text-sm text-zinc-500">
                    Track distributor purchase orders, invoices, and incoming inventory stock
                  </p>
                </div>
              </div>

              {/* Stats & CTA: Total Purchases (count as per filter dates) & Add Purchase button */}
              <div className="flex items-center gap-3">
                {/* Total Purchases Count as per filter dates */}
                <div className="px-4 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-center">
                  <span className="block text-xs uppercase tracking-wider text-zinc-500 font-semibold">
                    Total Purchases
                  </span>
                  <span className="text-lg font-bold text-black font-mono">
                    {purchases.length}
                  </span>
                </div>

                {/* Add Purchase Button */}
                <Link
                  href="/admin/purchases/addpurchase"
                  className="ui-btn ui-btn-grey ui-btn-md px-4 py-2 font-medium flex items-center gap-2 shadow-xs cursor-pointer inline-flex items-center"
                >
                  <Plus className="w-4 h-4 text-white" />
                  <span>Add Purchase</span>
                </Link>
              </div>
            </div>

            {/* Controls Bar: Search (purchase_id, invoice_number) & Filters (Distributor, From Date, To Date) */}
            <div className="space-y-3 p-4 bg-zinc-50 border border-zinc-200 rounded-lg">
              <div className="flex items-center gap-2 pb-2 border-b border-zinc-200 text-xs font-semibold text-zinc-700 uppercase tracking-wide">
                <Filter className="w-3.5 h-3.5 text-zinc-500" />
                <span>Filters & Search</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* Search Bar (purchase_id, invoice_number) */}
                <div className="relative">
                  <label className="block text-[11px] font-medium text-zinc-500 mb-1">
                    Search Purchase ID / Invoice
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="e.g. purchs_101 or INV-001..."
                      style={{ paddingLeft: '2.25rem' }}
                      className="ui-input pr-8 text-xs text-black border border-zinc-300 focus:border-black rounded-md w-full bg-white h-9"
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

                {/* Distributor Search and Select Filter */}
                <div className="relative">
                  <label className="block text-[11px] font-medium text-zinc-500 mb-1">
                    Distributor
                  </label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setIsDistributorDropdownOpen((prev) => !prev)}
                      className="w-full h-9 px-3 text-left text-xs bg-white border border-zinc-300 rounded-md text-black flex items-center justify-between focus:outline-hidden focus:border-black"
                    >
                      <span className="truncate">{selectedDistributorName}</span>
                      <Building2 className="w-3.5 h-3.5 text-zinc-400 flex-shrink-0 ml-1" />
                    </button>

                    {isDistributorDropdownOpen && (
                      <div className="absolute z-30 left-0 right-0 mt-1 bg-white border border-zinc-300 rounded-md shadow-lg p-2 space-y-2">
                        {/* Search input inside distributor dropdown */}
                        <div className="relative">
                          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
                          <input
                            type="text"
                            value={distributorSearchText}
                            onChange={(e) => setDistributorSearchText(e.target.value)}
                            placeholder="Search distributor..."
                            style={{ paddingLeft: '1.75rem' }}
                            className="w-full text-xs py-1.5 pr-2 border border-zinc-200 rounded focus:border-black focus:outline-hidden bg-white text-black"
                            autoFocus
                          />
                        </div>

                        <div className="max-h-48 overflow-y-auto space-y-0.5 divide-y divide-zinc-100">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedDistributorId('all');
                              setIsDistributorDropdownOpen(false);
                            }}
                            className={`w-full text-left px-2 py-1.5 text-xs rounded hover:bg-zinc-100 ${
                              selectedDistributorId === 'all'
                                ? 'bg-zinc-100 font-semibold text-black'
                                : 'text-zinc-700'
                            }`}
                          >
                            All Distributors
                          </button>
                          {filteredDistributorsList.length === 0 ? (
                            <div className="px-2 py-2 text-xs text-zinc-400 text-center">
                              No distributor found
                            </div>
                          ) : (
                            filteredDistributorsList.map((dist) => (
                              <button
                                key={dist.id}
                                type="button"
                                onClick={() => {
                                  setSelectedDistributorId(dist.id);
                                  setIsDistributorDropdownOpen(false);
                                }}
                                className={`w-full text-left px-2 py-1.5 text-xs rounded hover:bg-zinc-100 flex flex-col ${
                                  selectedDistributorId === dist.id
                                    ? 'bg-zinc-100 font-semibold text-black'
                                    : 'text-zinc-700'
                                }`}
                              >
                                <span className="font-medium text-black">{dist.name}</span>
                                <span className="text-[10px] text-zinc-400 font-mono">
                                  {dist.distributor_id} {dist.company ? `• ${dist.company}` : ''}
                                </span>
                              </button>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* From Date Filter (default last 1 week) */}
                <div>
                  <label className="block text-[11px] font-medium text-zinc-500 mb-1">
                    From Date
                  </label>
                  <div className="relative">
                    <input
                      type="date"
                      value={fromDate}
                      onChange={(e) => setFromDate(e.target.value)}
                      className="ui-input text-xs text-black border border-zinc-300 focus:border-black rounded-md w-full bg-white h-9 px-3"
                    />
                  </div>
                </div>

                {/* To Date Filter (default today) */}
                <div>
                  <label className="block text-[11px] font-medium text-zinc-500 mb-1">
                    To Date
                  </label>
                  <div className="relative">
                    <input
                      type="date"
                      value={toDate}
                      onChange={(e) => setToDate(e.target.value)}
                      className="ui-input text-xs text-black border border-zinc-300 focus:border-black rounded-md w-full bg-white h-9 px-3"
                    />
                  </div>
                </div>
              </div>

              {/* Action Buttons: Refresh & Clear Filters */}
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
                    title="Refresh purchases list"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 text-black ${dataLoading ? 'animate-spin' : ''}`} />
                    <span>Refresh</span>
                  </button>
                </div>
              </div>
            </div>

            {/* List of Purchases in Selected Dates Range: Table */}
            <div className="ui-table-container border border-zinc-200 rounded-lg overflow-hidden bg-white shadow-xs">
              <table className="ui-table w-full text-left border-collapse">
                <thead>
                  <tr className="bg-zinc-100 border-b border-zinc-200">
                    <th className="ui-table-th py-3 px-4 font-semibold text-xs text-zinc-600 uppercase tracking-wider">
                      Purchase ID
                    </th>
                    <th className="ui-table-th py-3 px-4 font-semibold text-xs text-zinc-600 uppercase tracking-wider">
                      Distributor Details
                    </th>
                    <th className="ui-table-th py-3 px-4 font-semibold text-xs text-zinc-600 uppercase tracking-wider">
                      Invoice Number
                    </th>
                    <th className="ui-table-th py-3 px-4 font-semibold text-xs text-zinc-600 uppercase tracking-wider">
                      Total Amount
                    </th>
                    <th className="ui-table-th py-3 px-4 font-semibold text-xs text-zinc-600 uppercase tracking-wider">
                      Date
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
                        <span>Loading purchases...</span>
                      </td>
                    </tr>
                  ) : filteredPurchases.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center">
                        <ShoppingCart className="w-8 h-8 text-zinc-300 mx-auto mb-2" />
                        <p className="text-sm font-medium text-zinc-600">
                          {searchQuery || selectedDistributorId !== 'all'
                            ? 'No purchases match your selected filters.'
                            : 'No purchases found in this date range.'}
                        </p>
                        <p className="text-xs text-zinc-400 mt-1">
                          Click &quot;Add Purchase&quot; above to record a new supplier invoice.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredPurchases.map((purchase) => (
                      <tr key={purchase.id} className="hover:bg-zinc-50 transition-colors">
                        {/* purchase_id */}
                        <td className="py-3 px-4 text-sm font-mono font-bold text-black whitespace-nowrap">
                          {purchase.purchase_id}
                        </td>

                        {/* Distributor Details */}
                        <td className="py-3 px-4 text-sm">
                          <div className="font-medium text-black">
                            {purchase.distributor_name || '—'}
                          </div>
                          <div className="text-xs text-zinc-500 font-mono flex items-center gap-1.5">
                            <span>{purchase.distributor_code || ''}</span>
                            {purchase.distributor_company && (
                              <span>• {purchase.distributor_company}</span>
                            )}
                            {purchase.distributor_mobile && (
                              <span>• {purchase.distributor_mobile}</span>
                            )}
                          </div>
                        </td>

                        {/* invoice_number */}
                        <td className="py-3 px-4 text-sm font-mono text-zinc-800">
                          {purchase.invoice_number || '—'}
                        </td>

                        {/* total_amount */}
                        <td className="py-3 px-4 text-sm font-mono font-semibold text-black whitespace-nowrap">
                          ₹
                          {Number(purchase.total_amount || 0).toLocaleString('en-IN', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </td>

                        {/* date */}
                        <td className="py-3 px-4 text-sm font-mono text-zinc-600 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-zinc-400" />
                            <span>{purchase.date}</span>
                          </div>
                        </td>

                        {/* Open Button: links to app/admin/purchases/openpurchase/page.tsx */}
                        <td className="py-3 px-4 text-sm text-right whitespace-nowrap">
                          <Link
                            href={`/admin/purchases/openpurchase?id=${encodeURIComponent(
                              purchase.id
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
                  Showing {filteredPurchases.length} of {purchases.length} purchases in date range
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
