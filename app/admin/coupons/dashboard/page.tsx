'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Plus, Ticket, RefreshCw, Calendar, Tag, CheckCircle2, XCircle, Globe, Lock } from 'lucide-react';
import { getCurrentSupabaseUser } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import AdminHeader from '@/components/admin/header';
import AdminSidebar from '@/components/admin/sidebar';
import AddCouponModal from '@/components/admin/addcoupon';
import OpenCouponModal from '@/components/admin/opencoupon';
import { CouponCode, getCoupons } from '@/lib/couponsStore';

export default function AdminCouponsDashboardPage() {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Coupons data states
  const [coupons, setCoupons] = useState<CouponCode[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [publicFilter, setPublicFilter] = useState<'all' | 'public' | 'private'>('all');

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedCoupon, setSelectedCoupon] = useState<CouponCode | null>(null);

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

  // Load coupons asynchronously
  useEffect(() => {
    let ignore = false;
    if (isAuthorized) {
      getCoupons().then(({ data }) => {
        if (!ignore && data) {
          setCoupons(data);
          setDataLoading(false);
        }
      });
    }
    return () => {
      ignore = true;
    };
  }, [isAuthorized]);

  const refreshCoupons = async () => {
    setDataLoading(true);
    const { data } = await getCoupons();
    if (data) {
      setCoupons(data);
    }
    setDataLoading(false);
  };

  // Active coupons count (status = true)
  const activeCouponsCount = useMemo(() => {
    return coupons.filter((c) => c.status === true).length;
  }, [coupons]);

  // Filtered coupons by search code, status, and is_public
  const filteredCoupons = useMemo(() => {
    return coupons.filter((item) => {
      // Search filter by code
      const query = searchQuery.trim().toLowerCase();
      if (query && !item.code.toLowerCase().includes(query)) {
        return false;
      }

      // Status filter
      if (statusFilter === 'active' && !item.status) return false;
      if (statusFilter === 'inactive' && item.status) return false;

      // Public filter
      if (publicFilter === 'public' && !item.is_public) return false;
      if (publicFilter === 'private' && item.is_public) return false;

      return true;
    });
  }, [coupons, searchQuery, statusFilter, publicFilter]);

  // Handle new coupon created
  const handleCouponCreated = (newCoupon: CouponCode) => {
    setCoupons((prev) => {
      const exists = prev.some((c) => c.id === newCoupon.id || c.code === newCoupon.code);
      if (exists) {
        return prev.map((c) => (c.id === newCoupon.id ? newCoupon : c));
      }
      return [newCoupon, ...prev];
    });
  };

  // Handle coupon updated
  const handleCouponUpdated = (updatedCoupon: CouponCode) => {
    setCoupons((prev) =>
      prev.map((c) => (c.id === updatedCoupon.id ? updatedCoupon : c))
    );
    if (selectedCoupon?.id === updatedCoupon.id) {
      setSelectedCoupon(updatedCoupon);
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
            {/* Top Bar: Title & Stats & Add Coupon */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-zinc-200">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-zinc-100 rounded-lg text-black border border-zinc-200">
                  <Ticket className="w-6 h-6 text-black" />
                </div>
                <div>
                  <h1 className="typo-page-title text-xl sm:text-2xl font-bold text-black tracking-tight">
                    Coupons
                  </h1>
                  <p className="typo-caption text-xs sm:text-sm text-zinc-500">
                    Manage promotional coupon codes, discounts, thresholds, and validity
                  </p>
                </div>
              </div>

              {/* Total coupons count & Add Coupon Button */}
              <div className="flex items-center gap-3">
                {/* Total Coupons Count (status = true) */}
                <div className="px-4 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-center">
                  <span className="block text-xs uppercase tracking-wider text-zinc-500 font-semibold">
                    Total Coupons
                  </span>
                  <span className="text-lg font-bold text-black font-mono">
                    {activeCouponsCount}
                  </span>
                </div>

                {/* Add Coupon Button */}
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(true)}
                  className="ui-btn ui-btn-grey ui-btn-md px-4 py-2 font-medium flex items-center gap-2 shadow-xs cursor-pointer"
                >
                  <Plus className="w-4 h-4 text-white" />
                  <span>Add Coupon</span>
                </button>
              </div>
            </div>

            {/* Controls: Search Bar & Filters */}
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
              {/* Search by code */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                  type="text"
                  placeholder="Search by coupon code..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="ui-input pl-9 pr-4 py-2 text-sm w-full border border-zinc-200 rounded-md focus:border-black transition-colors"
                />
              </div>

              {/* Filter Controls */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Status Filter */}
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
                  className="ui-select px-3 py-2 text-sm border border-zinc-200 rounded-md bg-white text-zinc-800 font-medium focus:border-black cursor-pointer"
                >
                  <option value="all">Status: All</option>
                  <option value="active">Active only</option>
                  <option value="inactive">Inactive only</option>
                </select>

                {/* Is Public Filter */}
                <select
                  value={publicFilter}
                  onChange={(e) => setPublicFilter(e.target.value as 'all' | 'public' | 'private')}
                  className="ui-select px-3 py-2 text-sm border border-zinc-200 rounded-md bg-white text-zinc-800 font-medium focus:border-black cursor-pointer"
                >
                  <option value="all">Visibility: All</option>
                  <option value="public">Public only</option>
                  <option value="private">Private only</option>
                </select>

                {/* Refresh Button */}
                <button
                  type="button"
                  onClick={refreshCoupons}
                  disabled={dataLoading}
                  className="p-2 border border-zinc-200 rounded-md hover:bg-zinc-100 text-zinc-600 transition-colors"
                  title="Refresh coupons"
                >
                  <RefreshCw className={`w-4 h-4 ${dataLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {/* Coupons List Table */}
            <div className="border border-zinc-200 rounded-lg overflow-hidden bg-white shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-200 bg-zinc-50 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                      <th className="py-3 px-4">Code</th>
                      <th className="py-3 px-4">Discount</th>
                      <th className="py-3 px-4">Threshold</th>
                      <th className="py-3 px-4">Usage</th>
                      <th className="py-3 px-4">Valid Upto</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Visibility</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 text-sm">
                    {dataLoading ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-zinc-500">
                          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-zinc-400" />
                          <span>Loading coupon codes...</span>
                        </td>
                      </tr>
                    ) : filteredCoupons.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-zinc-500">
                          <Tag className="w-8 h-8 text-zinc-300 mx-auto mb-2" />
                          <p className="font-medium text-zinc-700">No coupons found</p>
                          <p className="text-xs text-zinc-400 mt-1">
                            {searchQuery || statusFilter !== 'all' || publicFilter !== 'all'
                              ? 'Try adjusting your search or filter settings.'
                              : 'Click "Add Coupon" to create your first coupon code.'}
                          </p>
                        </td>
                      </tr>
                    ) : (
                      filteredCoupons.map((coupon) => {
                        const isExpired = coupon.valid_upto && new Date(coupon.valid_upto) < new Date(new Date().setHours(0, 0, 0, 0));

                        return (
                          <tr
                            key={coupon.id}
                            className="hover:bg-zinc-50 transition-colors group cursor-default"
                          >
                            {/* Code */}
                            <td className="py-3.5 px-4">
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold text-black tracking-wider bg-zinc-100 px-2.5 py-1 rounded border border-zinc-200 text-sm">
                                  {coupon.code}
                                </span>
                              </div>
                              {coupon.sentence && (
                                <p className="text-xs text-zinc-500 mt-1 truncate max-w-xs" title={coupon.sentence}>
                                  {coupon.sentence}
                                </p>
                              )}
                            </td>

                            {/* Discount */}
                            <td className="py-3.5 px-4 font-semibold text-zinc-900">
                              ₹{coupon.discount.toLocaleString('en-IN')}
                            </td>

                            {/* Threshold */}
                            <td className="py-3.5 px-4 text-zinc-600">
                              {coupon.threshold > 0 ? `₹${coupon.threshold.toLocaleString('en-IN')}` : 'None'}
                            </td>

                            {/* Usage */}
                            <td className="py-3.5 px-4">
                              <span className="font-mono font-medium text-zinc-700 bg-zinc-100 px-2 py-0.5 rounded text-xs">
                                {coupon.usage}
                              </span>
                            </td>

                            {/* Valid Upto */}
                            <td className="py-3.5 px-4">
                              {coupon.valid_upto ? (
                                <div className="flex items-center gap-1.5 text-xs text-zinc-700">
                                  <Calendar className="w-3.5 h-3.5 text-zinc-400" />
                                  <span className={isExpired ? 'text-red-600 font-medium' : ''}>
                                    {coupon.valid_upto}
                                    {isExpired && ' (Expired)'}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-xs text-zinc-400">No expiry</span>
                              )}
                            </td>

                            {/* Status */}
                            <td className="py-3.5 px-4">
                              {coupon.status ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  <CheckCircle2 className="w-3 h-3" />
                                  Active
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-zinc-100 text-zinc-600 border border-zinc-200">
                                  <XCircle className="w-3 h-3" />
                                  Inactive
                                </span>
                              )}
                            </td>

                            {/* Is Public */}
                            <td className="py-3.5 px-4">
                              {coupon.is_public ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                                  <Globe className="w-3 h-3" />
                                  Public
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-zinc-100 text-zinc-600 border border-zinc-200">
                                  <Lock className="w-3 h-3" />
                                  Private
                                </span>
                              )}
                            </td>

                            {/* Open Action */}
                            <td className="py-3.5 px-4 text-right">
                              <button
                                type="button"
                                onClick={() => setSelectedCoupon(coupon)}
                                className="ui-btn ui-btn-outline ui-btn-sm text-xs font-medium px-3 py-1.5 border border-zinc-300 rounded hover:border-black hover:bg-black hover:text-white transition-colors cursor-pointer"
                              >
                                Open
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Table Footer */}
              <div className="py-3 px-4 border-t border-zinc-200 bg-zinc-50 flex items-center justify-between text-xs text-zinc-500">
                <span>
                  Showing {filteredCoupons.length} of {coupons.length} coupon{coupons.length === 1 ? '' : 's'}
                </span>
                <span>Active: {activeCouponsCount}</span>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Add Coupon Overscreen Modal */}
      <AddCouponModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onCouponCreated={handleCouponCreated}
      />

      {/* Open/Edit Coupon Overscreen Modal */}
      {selectedCoupon && (
        <OpenCouponModal
          key={selectedCoupon.id}
          isOpen={!!selectedCoupon}
          coupon={selectedCoupon}
          onClose={() => setSelectedCoupon(null)}
          onCouponUpdated={handleCouponUpdated}
        />
      )}
    </div>
  );
}
