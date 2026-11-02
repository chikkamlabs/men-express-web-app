'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Receipt,
  Search,
  Calendar,
  RefreshCw,
  ExternalLink,
  IndianRupee,
  Filter,
  X,
  Plus,
  User,
  Clock,
  CheckCircle2,
  AlertCircle,
  Banknote,
  Smartphone,
  CreditCard,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { getCurrentSupabaseUser } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import StoreHeader from '@/components/store/header';
import StoreSidebar from '@/components/store/sidebar';
import {
  StoreBill,
  PaymentBreakdownSplit,
  getStoreBills,
} from '@/lib/billsStore';

export default function StoreBillsDashboardPage() {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [currentStoreId, setCurrentStoreId] = useState<string | undefined>(undefined);
  const [storeName, setStoreName] = useState('Store');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Helper for today's date formatted as YYYY-MM-DD
  const getTodayStr = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Filters & Search (Default today as requested)
  const [fromDate, setFromDate] = useState<string>('');
const [toDate, setToDate] = useState<string>('');
const [searchBillId, setSearchBillId] = useState<string>('');

useEffect(() => {
  const today = getTodayStr();
  setFromDate(today);
  setToDate(today);
}, []);

  // Data States
  const [bills, setBills] = useState<StoreBill[]>([]);
  const [totalBillsCount, setTotalBillsCount] = useState<number>(0);
  const [totalSaleAmount, setTotalSaleAmount] = useState<number>(0);
  const [paymentSplit, setPaymentSplit] = useState<PaymentBreakdownSplit>({
    cash: 0,
    upi: 0,
    card: 0,
    total: 0,
  });
  const [showSaleBreakdown, setShowSaleBreakdown] = useState<boolean>(false);
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

  // Load Bills whenever filters change
  useEffect(() => {
    let ignore = false;
    if (isAuthorized && fromDate && toDate) {
      async function loadData() {
        const result = await getStoreBills({
          storeId: currentStoreId,
          fromDate: fromDate || undefined,
          toDate: toDate || undefined,
          searchBillId: searchBillId.trim() || undefined,
        });

        if (!ignore) {
          setBills(result.bills);
          setTotalBillsCount(result.totalBills);
          setTotalSaleAmount(result.totalSale);
          if (result.paymentSplit) {
            setPaymentSplit(result.paymentSplit);
          }
          setDataLoading(false);
        }
      }

      loadData();
    }
    return () => {
      ignore = true;
    };
  }, [isAuthorized, currentStoreId, fromDate, toDate, searchBillId]);

  const handleRefresh = async () => {
    setDataLoading(true);
    const result = await getStoreBills({
      storeId: currentStoreId,
      fromDate: fromDate || undefined,
      toDate: toDate || undefined,
      searchBillId: searchBillId.trim() || undefined,
    });
    setBills(result.bills);
    setTotalBillsCount(result.totalBills);
    setTotalSaleAmount(result.totalSale);
    if (result.paymentSplit) {
      setPaymentSplit(result.paymentSplit);
    }
    setDataLoading(false);
  };

  const handleResetFilters = () => {
    const today = getTodayStr();
    setFromDate(today);
    setToDate(today);
    setSearchBillId('');
  };

  // Quick preset filters
  const applyPreset = (preset: 'today' | 'yesterday' | 'last7' | 'thisMonth') => {
    const now = new Date();
    const formatDate = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const dt = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${dt}`;
    };

    if (preset === 'today') {
      const today = formatDate(now);
      setFromDate(today);
      setToDate(today);
    } else if (preset === 'yesterday') {
      const yest = new Date(now);
      yest.setDate(now.getDate() - 1);
      const yestStr = formatDate(yest);
      setFromDate(yestStr);
      setToDate(yestStr);
    } else if (preset === 'last7') {
      const past7 = new Date(now);
      past7.setDate(now.getDate() - 6);
      setFromDate(formatDate(past7));
      setToDate(formatDate(now));
    } else if (preset === 'thisMonth') {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      setFromDate(formatDate(startOfMonth));
      setToDate(formatDate(now));
    }
  };

  // Format date and time
  const formatDateTime = (dateStr: string, createdAtStr?: string) => {
    if (createdAtStr) {
      try {
        const d = new Date(createdAtStr);
        return d.toLocaleString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        });
      } catch {
        // Fallback
      }
    }
    return dateStr || '—';
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
            {/* Top Bar: Title & Summary Metrics (Total Store Bills & Total Sale) */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-zinc-200">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-white rounded-lg text-black border border-zinc-200 shadow-xs">
                  <Receipt className="w-6 h-6 text-black" />
                </div>
                <div>
                  <h1 className="typo-page-title text-xl sm:text-2xl font-bold text-black tracking-tight">
                    Store Bills
                  </h1>
                  <p className="typo-caption text-xs sm:text-sm text-zinc-500">
                    Track all POS customer invoices and sales history
                  </p>
                </div>
              </div>

              {/* Action & Metric Counts */}
              <div className="flex flex-wrap items-center gap-3">
                {/* Total Store Bills (Count as per Filtered Dates) */}
                <div className="px-4 py-2 bg-white border border-zinc-200 rounded-lg text-center shadow-xs min-w-[120px]">
                  <span className="block text-[11px] uppercase tracking-wider text-zinc-500 font-semibold">
                    Total Store Bills
                  </span>
                  <span className="text-lg font-bold text-black font-mono">
                    {totalBillsCount}
                  </span>
                </div>

                {/* Total Sale (Calculate as per Filtered Dates) - Tap to Open small section */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowSaleBreakdown((prev) => !prev)}
                    className={`px-4 py-2 bg-white border rounded-lg text-center shadow-xs min-w-[150px] cursor-pointer transition-all text-left ${
                      showSaleBreakdown
                        ? 'border-black ring-2 ring-black/5'
                        : 'border-zinc-200 hover:border-zinc-400'
                    }`}
                    title="Tap to view payment mode breakdown"
                  >
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="block text-[11px] uppercase tracking-wider text-zinc-500 font-semibold">
                        Total Sale
                      </span>
                      {showSaleBreakdown ? (
                        <ChevronUp className="w-3.5 h-3.5 text-black" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
                      )}
                    </div>
                    <div className="text-lg font-bold text-black font-mono flex items-center gap-0.5 mt-0.5">
                      <IndianRupee className="w-4 h-4 text-zinc-600 inline" />
                      <span>
                        {totalSaleAmount.toLocaleString('en-IN', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                    <span className="text-[10px] text-zinc-400 font-medium block">
                      Tap for breakdown ▾
                    </span>
                  </button>

                  {/* Small section opened on tap: (In cash, Upi, Card = Total sale) */}
                  {showSaleBreakdown && (
                    <div className="absolute right-0 mt-2 w-72 bg-white border border-zinc-300 rounded-xl shadow-xl p-4 z-40 space-y-3">
                      <div className="flex items-center justify-between pb-2 border-b border-zinc-200">
                        <span className="text-xs font-bold uppercase tracking-wider text-black">
                          Payment Breakdown
                        </span>
                        <button
                          type="button"
                          onClick={() => setShowSaleBreakdown(false)}
                          className="text-zinc-400 hover:text-black p-0.5 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="space-y-2 text-xs">
                        {/* In cash */}
                        <div className="flex items-center justify-between p-2 rounded-lg bg-zinc-50 border border-zinc-100">
                          <div className="flex items-center gap-2">
                            <Banknote className="w-4 h-4 text-emerald-600" />
                            <span className="font-semibold text-zinc-700">In Cash</span>
                          </div>
                          <span className="font-mono font-bold text-black">
                            ₹
                            {paymentSplit.cash.toLocaleString('en-IN', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </span>
                        </div>

                        {/* Upi */}
                        <div className="flex items-center justify-between p-2 rounded-lg bg-zinc-50 border border-zinc-100">
                          <div className="flex items-center gap-2">
                            <Smartphone className="w-4 h-4 text-indigo-600" />
                            <span className="font-semibold text-zinc-700">UPI</span>
                          </div>
                          <span className="font-mono font-bold text-black">
                            ₹
                            {paymentSplit.upi.toLocaleString('en-IN', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </span>
                        </div>

                        {/* Card */}
                        <div className="flex items-center justify-between p-2 rounded-lg bg-zinc-50 border border-zinc-100">
                          <div className="flex items-center gap-2">
                            <CreditCard className="w-4 h-4 text-blue-600" />
                            <span className="font-semibold text-zinc-700">Card</span>
                          </div>
                          <span className="font-mono font-bold text-black">
                            ₹
                            {paymentSplit.card.toLocaleString('en-IN', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </span>
                        </div>
                      </div>

                      {/* = Total sale */}
                      <div className="pt-2 border-t border-zinc-200 flex items-center justify-between text-xs font-bold text-black">
                        <span className="uppercase tracking-wider">= Total Sale</span>
                        <span className="font-mono text-sm text-black">
                          ₹
                          {totalSaleAmount.toLocaleString('en-IN', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Create New Bill CTA */}
                <Link
                  href="/store/createbill"
                  className="ui-btn ui-btn-primary ui-btn-md px-4 py-2 flex items-center gap-2 font-bold text-xs sm:text-sm rounded-lg shadow-xs cursor-pointer ml-auto sm:ml-0"
                >
                  <Plus className="w-4 h-4 text-white" />
                  <span>Create Bill</span>
                </Link>
              </div>
            </div>

            {/* Controls: Search bar(bill_id) & Filters(from date to date default today) */}
            <div className="space-y-3 p-4 bg-white border border-zinc-200 rounded-lg shadow-xs">
              <div className="flex items-center justify-between pb-2 border-b border-zinc-200 text-xs font-semibold text-zinc-700 uppercase tracking-wide">
                <div className="flex items-center gap-2">
                  <Filter className="w-3.5 h-3.5 text-zinc-500" />
                  <span>Filters &amp; Search</span>
                </div>
                {/* Date presets */}
                <div className="flex items-center gap-1.5 normal-case font-normal">
                  <button
                    type="button"
                    onClick={() => applyPreset('today')}
                    className="px-2 py-0.5 text-[11px] rounded bg-zinc-100 hover:bg-zinc-200 text-zinc-700 cursor-pointer"
                  >
                    Today
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset('yesterday')}
                    className="px-2 py-0.5 text-[11px] rounded bg-zinc-100 hover:bg-zinc-200 text-zinc-700 cursor-pointer"
                  >
                    Yesterday
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset('last7')}
                    className="px-2 py-0.5 text-[11px] rounded bg-zinc-100 hover:bg-zinc-200 text-zinc-700 cursor-pointer hidden md:inline-block"
                  >
                    Last 7 Days
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset('thisMonth')}
                    className="px-2 py-0.5 text-[11px] rounded bg-zinc-100 hover:bg-zinc-200 text-zinc-700 cursor-pointer hidden lg:inline-block"
                  >
                    This Month
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* Search Bar(bill_id) */}
                <div className="relative">
                  <label className="block text-[11px] font-medium text-zinc-500 mb-1">
                    Search Bill ID
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
                    <input
                      type="text"
                      value={searchBillId}
                      onChange={(e) => setSearchBillId(e.target.value)}
                      placeholder="e.g. bill_492018..."
                      style={{ paddingLeft: '2.25rem' }}
                      className="ui-input pr-8 text-xs text-black border border-zinc-300 focus:border-black rounded-md w-full bg-white h-9 font-mono"
                    />
                    {searchBillId && (
                      <button
                        type="button"
                        onClick={() => setSearchBillId('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-black cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Filter: From Date (default today) */}
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
                    title="Refresh bills list"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 text-black ${dataLoading ? 'animate-spin' : ''}`} />
                    <span>Refresh</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Display list of Bills: bill_id & date & time, Final Amount, customer details, status, open */}
            <div className="ui-table-container border border-zinc-200 rounded-lg overflow-hidden bg-white shadow-xs">
              <table className="ui-table w-full text-left border-collapse">
                <thead>
                  <tr className="bg-zinc-100 border-b border-zinc-200">
                    <th className="ui-table-th py-3 px-4 font-semibold text-xs text-zinc-600 uppercase tracking-wider">
                      Bill ID
                    </th>
                    <th className="ui-table-th py-3 px-4 font-semibold text-xs text-zinc-600 uppercase tracking-wider">
                      Date &amp; Time
                    </th>
                    <th className="ui-table-th py-3 px-4 font-semibold text-xs text-zinc-600 uppercase tracking-wider">
                      Customer Details
                    </th>
                    <th className="ui-table-th py-3 px-4 font-semibold text-xs text-zinc-600 uppercase tracking-wider">
                      Final Amount
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
                        <span>Loading store bills...</span>
                      </td>
                    </tr>
                  ) : bills.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center">
                        <Receipt className="w-9 h-9 text-zinc-300 mx-auto mb-2" />
                        <p className="text-sm font-semibold text-zinc-700">
                          {searchBillId
                            ? `No bills found matching "${searchBillId}".`
                            : 'No bills recorded for the selected date range.'}
                        </p>
                        <p className="text-xs text-zinc-400 mt-1">
                          Create a new bill from the POS terminal to start tracking store sales.
                        </p>
                        <div className="mt-4">
                          <Link
                            href="/store/createbill"
                            className="ui-btn ui-btn-primary ui-btn-sm px-4 py-1.5 inline-flex items-center gap-1.5 text-xs font-bold"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Create Bill Now</span>
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    bills.map((b) => (
                      <tr key={b.id} className="hover:bg-zinc-50 transition-colors">
                        {/* bill_id */}
                        <td className="py-3 px-4 text-sm font-mono font-bold text-black whitespace-nowrap">
                          <span className="bg-zinc-100 px-2 py-0.5 rounded border border-zinc-200">
                            {b.bill_id}
                          </span>
                        </td>

                        {/* date & time */}
                        <td className="py-3 px-4 text-sm text-zinc-700 whitespace-nowrap">
                          <div className="flex items-center gap-1.5 text-xs text-zinc-700">
                            <Clock className="w-3.5 h-3.5 text-zinc-400 flex-shrink-0" />
                            <span>{formatDateTime(b.date, b.created_at)}</span>
                          </div>
                        </td>

                        {/* customer details */}
                        <td className="py-3 px-4 text-sm">
                          {b.customer ? (
                            <div>
                              <div className="font-semibold text-black flex items-center gap-1 text-xs sm:text-sm">
                                <User className="w-3.5 h-3.5 text-zinc-400" />
                                <span>{b.customer.name}</span>
                              </div>
                              <div className="text-xs text-zinc-500 font-mono">
                                {b.customer.mobile}
                                {typeof b.customer.points === 'number' && (
                                  <span className="ml-1.5 text-[10px] text-zinc-400">
                                    • {b.customer.points} pts
                                  </span>
                                )}
                              </div>
                            </div>
                          ) : (
                            <span className="text-xs text-zinc-400 italic">
                              Walk-in Customer
                            </span>
                          )}
                        </td>

                        {/* Final Amount */}
                        <td className="py-3 px-4 text-sm font-mono font-bold text-black whitespace-nowrap">
                          <span>
                            ₹{b.final_amount.toLocaleString('en-IN', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </span>
                          {b.discount > 0 && (
                            <span className="block text-[10px] font-normal text-emerald-600">
                              (Discount ₹{b.discount.toFixed(2)})
                            </span>
                          )}
                        </td>

                        {/* status */}
                        <td className="py-3 px-4 text-sm whitespace-nowrap">
                          {b.status === 'success' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>Success</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                              <AlertCircle className="w-3 h-3 text-amber-600" />
                              <span>Draft</span>
                            </span>
                          )}
                        </td>

                        {/* open: app/store/bills/openbill/page.tsx */}
                        <td className="py-3 px-4 text-sm text-right whitespace-nowrap">
                          <Link
                            href={`/store/bills/openbill?id=${encodeURIComponent(
                              b.id
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

            {/* Results count text & active date range summary */}
            {!dataLoading && (
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between text-xs text-zinc-500 px-1 gap-2">
                <span>
                  Showing {bills.length} bills from {fromDate} to {toDate}
                </span>
                <span className="font-mono text-zinc-700">
                  Total Value: ₹{totalSaleAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
