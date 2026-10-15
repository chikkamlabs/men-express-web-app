'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Search,
  ShoppingBag,
  RefreshCw,
  Filter,
  Calendar,
  X,
} from 'lucide-react';
import { getCurrentSupabaseUser } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import AdminHeader from '@/components/admin/header';
import AdminSidebar from '@/components/admin/sidebar';
import {
  OnlineOrder,
  OrderPaymentStatus,
  OrderFulfillmentStatus,
  getOnlineOrders,
} from '@/lib/onlineordersStore';

function getTodayString(): string {
  const d = new Date();
  return d.toISOString().split('T')[0];
}

export default function AdminOnlineOrdersDashboardPage() {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Orders data
  const [orders, setOrders] = useState<OnlineOrder[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  // Filters state (default Dates: from and to default today)
  const todayStr = useMemo(() => getTodayString(), []);
  const [fromDate, setFromDate] = useState<string>(todayStr);
  const [toDate, setToDate] = useState<string>(todayStr);
  const [filterPayment, setFilterPayment] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchOrderId, setSearchOrderId] = useState<string>('');

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

  // Load orders
  useEffect(() => {
    let ignore = false;
    if (isAuthorized) {
      getOnlineOrders().then(({ data }) => {
        if (!ignore && data) {
          setOrders(data);
          setDataLoading(false);
        }
      });
    }
    return () => {
      ignore = true;
    };
  }, [isAuthorized]);

  const refreshOrders = async () => {
    setDataLoading(true);
    const { data } = await getOnlineOrders();
    if (data) {
      setOrders(data);
    }
    setDataLoading(false);
  };

  // Filtered orders calculation
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      // 1. Search by order_id
      if (searchOrderId.trim()) {
        const query = searchOrderId.trim().toLowerCase();
        if (!order.order_id.toLowerCase().includes(query)) {
          return false;
        }
      }

      // 2. Filter by Dates (from to)
      const orderDateStr = order.created_at ? order.created_at.split('T')[0] : '';
      if (fromDate && orderDateStr < fromDate) {
        return false;
      }
      if (toDate && orderDateStr > toDate) {
        return false;
      }

      // 3. Filter by Payment Status
      if (filterPayment !== 'all' && order.payment !== filterPayment) {
        return false;
      }

      // 4. Filter by Fulfillment Status
      if (filterStatus !== 'all' && order.status !== filterStatus) {
        return false;
      }

      return true;
    });
  }, [orders, searchOrderId, fromDate, toDate, filterPayment, filterStatus]);

  const resetFilters = () => {
    setFromDate(todayStr);
    setToDate(todayStr);
    setFilterPayment('all');
    setFilterStatus('all');
    setSearchOrderId('');
  };

  const hasActiveFilters =
    fromDate !== todayStr ||
    toDate !== todayStr ||
    filterPayment !== 'all' ||
    filterStatus !== 'all' ||
    searchOrderId.trim() !== '';

  const getPaymentBadge = (status: OrderPaymentStatus) => {
    switch (status) {
      case 'verified':
        return <span className="ui-badge ui-badge-success text-xs">Verified</span>;
      case 'submitted':
        return <span className="ui-badge ui-badge-info text-xs">Submitted</span>;
      case 'rejected':
        return <span className="ui-badge ui-badge-danger text-xs">Rejected</span>;
      case 'pending':
      default:
        return <span className="ui-badge ui-badge-warning text-xs">Pending</span>;
    }
  };

  const getFulfillmentBadge = (status: OrderFulfillmentStatus) => {
    switch (status) {
      case 'delivered':
        return <span className="ui-badge ui-badge-success text-xs">Delivered</span>;
      case 'shipping':
        return <span className="ui-badge ui-badge-info text-xs">Shipping</span>;
      case 'packed':
        return <span className="ui-badge ui-badge-default text-xs">Packed</span>;
      case 'payment_success':
        return <span className="ui-badge ui-badge-success text-xs">Paid</span>;
      case 'cancelled':
        return <span className="ui-badge ui-badge-danger text-xs">Cancelled</span>;
      case 'pending':
      default:
        return <span className="ui-badge ui-badge-warning text-xs">Pending</span>;
    }
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
            {/* Top Bar: Title & Total Orders count */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-zinc-200">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-zinc-100 rounded-lg text-black border border-zinc-200">
                  <ShoppingBag className="w-6 h-6 text-black" />
                </div>
                <div>
                  <h1 className="typo-page-title text-xl sm:text-2xl font-bold text-black tracking-tight">
                    Online Orders
                  </h1>
                  <p className="typo-caption text-xs sm:text-sm text-zinc-500">
                    Track web customer orders, shipping status, payments, and invoices
                  </p>
                </div>
              </div>

              {/* Total Orders Count */}
              <div className="flex items-center gap-3">
                <div className="px-4 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-center">
                  <span className="block text-xs uppercase tracking-wider text-zinc-500 font-semibold">
                    Total orders
                  </span>
                  <span className="text-lg font-bold text-black font-mono">
                    {orders.length}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={refreshOrders}
                  disabled={dataLoading}
                  className="ui-btn ui-btn-outline ui-btn-md text-xs text-black border-zinc-300 hover:bg-zinc-100 flex items-center gap-1.5 cursor-pointer"
                  title="Refresh orders"
                >
                  <RefreshCw
                    className={`w-4 h-4 text-black ${
                      dataLoading ? 'animate-spin' : ''
                    }`}
                  />
                  <span>Refresh</span>
                </button>
              </div>
            </div>

            {/* Filters Section (Dates from-to default today, payment_status, status) & Search Bar (order_id) */}
            <div className="bg-zinc-50 p-4 rounded-lg border border-zinc-200 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-zinc-200">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-700">
                  <Filter className="w-3.5 h-3.5 text-black" />
                  <span>Filters & Search</span>
                </div>
                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="text-xs text-zinc-600 hover:text-black flex items-center gap-1 cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                    <span>Reset Filters</span>
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                {/* Search Bar (order_id) */}
                <div className="relative">
                  <label className="block text-xs font-medium text-zinc-600 mb-1">
                    Order ID
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400 pointer-events-none" />
                    <input
                      type="text"
                      value={searchOrderId}
                      onChange={(e) => setSearchOrderId(e.target.value)}
                      placeholder="Search order_id..."
                      style={{ paddingLeft: '2.2rem' }}
                      className="ui-input text-xs text-black border border-zinc-300 focus:border-black rounded-lg w-full bg-white font-mono"
                    />
                  </div>
                </div>

                {/* Date From (default today) */}
                <div>
                  <label className="block text-xs font-medium text-zinc-600 mb-1 flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-zinc-500" />
                    <span>From Date</span>
                  </label>
                  <input
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    className="ui-input text-xs text-black border border-zinc-300 focus:border-black rounded-lg w-full bg-white font-mono"
                  />
                </div>

                {/* Date To (default today) */}
                <div>
                  <label className="block text-xs font-medium text-zinc-600 mb-1 flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-zinc-500" />
                    <span>To Date</span>
                  </label>
                  <input
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    className="ui-input text-xs text-black border border-zinc-300 focus:border-black rounded-lg w-full bg-white font-mono"
                  />
                </div>

                {/* Payment Status Filter */}
                <div>
                  <label className="block text-xs font-medium text-zinc-600 mb-1">
                    Payment Status
                  </label>
                  <select
                    value={filterPayment}
                    onChange={(e) => setFilterPayment(e.target.value)}
                    className="ui-select text-xs text-black border border-zinc-300 focus:border-black rounded-lg w-full bg-white"
                  >
                    <option value="all">All Payments</option>
                    <option value="pending">Pending</option>
                    <option value="submitted">Submitted</option>
                    <option value="verified">Verified</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>

                {/* Fulfillment Status Filter */}
                <div>
                  <label className="block text-xs font-medium text-zinc-600 mb-1">
                    Fulfillment Status
                  </label>
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="ui-select text-xs text-black border border-zinc-300 focus:border-black rounded-lg w-full bg-white"
                  >
                    <option value="all">All Statuses</option>
                    <option value="pending">Pending</option>
                    <option value="payment_success">Payment Success</option>
                    <option value="packed">Packed</option>
                    <option value="shipping">Shipping</option>
                    <option value="delivered">Delivered</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Display the orders: Order_id, customer name & mobile, Final amount, payment, status, open button */}
            <div className="ui-table-container border border-zinc-200 rounded-lg overflow-hidden bg-white shadow-xs">
              <table className="ui-table w-full text-left border-collapse">
                <thead>
                  <tr className="bg-zinc-100 border-b border-zinc-200">
                    <th className="ui-table-th py-3 px-4 font-semibold text-xs text-zinc-600 uppercase tracking-wider">
                      Order ID
                    </th>
                    <th className="ui-table-th py-3 px-4 font-semibold text-xs text-zinc-600 uppercase tracking-wider">
                      Customer Name & Mobile
                    </th>
                    <th className="ui-table-th py-3 px-4 font-semibold text-xs text-zinc-600 uppercase tracking-wider">
                      Final Amount
                    </th>
                    <th className="ui-table-th py-3 px-4 font-semibold text-xs text-zinc-600 uppercase tracking-wider">
                      Payment
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
                      <td colSpan={6} className="py-8 text-center text-sm text-zinc-500">
                        Loading online orders...
                      </td>
                    </tr>
                  ) : filteredOrders.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center">
                        <ShoppingBag className="w-8 h-8 text-zinc-300 mx-auto mb-2" />
                        <p className="text-sm font-medium text-zinc-600">
                          No orders match the selected filters.
                        </p>
                        <p className="text-xs text-zinc-400 mt-1">
                          Try adjusting the dates, payment status, or clear the search criteria.
                        </p>
                        {hasActiveFilters && (
                          <button
                            type="button"
                            onClick={resetFilters}
                            className="mt-3 ui-btn ui-btn-outline ui-btn-sm text-xs cursor-pointer"
                          >
                            Reset filters to today
                          </button>
                        )}
                      </td>
                    </tr>
                  ) : (
                    filteredOrders.map((order) => (
                      <tr
                        key={order.id}
                        className="hover:bg-zinc-50 transition-colors"
                      >
                        {/* Order_id */}
                        <td className="py-3 px-4 text-sm font-mono font-semibold text-black whitespace-nowrap">
                          {order.order_id}
                        </td>

                        {/* Customer name & mobile */}
                        <td className="py-3 px-4 text-sm text-black">
                          <div className="font-medium text-black">
                            {order.customer_name || 'Customer'}
                          </div>
                          <div className="text-xs text-zinc-500 font-mono">
                            {order.customer_mobile || '—'}
                          </div>
                        </td>

                        {/* payable_amount display as Final amount */}
                        <td className="py-3 px-4 text-sm font-mono font-semibold text-black whitespace-nowrap">
                          ₹{Number(order.payable_amount || 0).toLocaleString('en-IN', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </td>

                        {/* Payment */}
                        <td className="py-3 px-4 text-sm whitespace-nowrap">
                          {getPaymentBadge(order.payment)}
                        </td>

                        {/* Status */}
                        <td className="py-3 px-4 text-sm whitespace-nowrap">
                          {getFulfillmentBadge(order.status)}
                        </td>

                        {/* Open Button: Grey color, turns dark black on tap */}
                        <td className="py-3 px-4 text-sm text-right whitespace-nowrap">
                          <Link
                            href={`/admin/onlineorders/openorder?id=${order.id}`}
                            className="ui-btn ui-btn-grey ui-btn-sm px-3 py-1 font-medium text-xs cursor-pointer inline-flex items-center gap-1.5"
                          >
                            <span>Open</span>
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
                  Showing {filteredOrders.length} of {orders.length} orders
                </span>
                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="text-black underline hover:text-zinc-700 cursor-pointer"
                  >
                    Clear all filters
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
