'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ShoppingBag, IndianRupee, RefreshCw, ArrowRight } from 'lucide-react';
import { getCurrentSupabaseUser } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import AdminSidebar from '@/components/admin/sidebar';
import AdminHeader from '@/components/admin/header';
import {
  AdminDashboardStats,
  getAdminDashboardStats,
} from '@/lib/admindashboardStore';

export default function AdminDashboardPage() {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Dashboard stats
  const [stats, setStats] = useState<AdminDashboardStats>({
    todayOrdersCount: 0,
    totalOnlineSaleAmount: 0,
  });
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function checkAuth() {
      try {
        const { user, role } = await getCurrentSupabaseUser();
        if (!isMounted) return;

        if (user && role === 'admin') {
          setIsAuthorized(true);
          setLoading(false);
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
          setLoading(false);
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

  // Load stats from Supabase
  useEffect(() => {
    let ignore = false;
    if (isAuthorized) {
      getAdminDashboardStats().then(({ data }) => {
        if (ignore) return;
        if (data) {
          setStats(data);
        }
        setStatsLoading(false);
      });
    }
    return () => {
      ignore = true;
    };
  }, [isAuthorized]);

  const refreshStats = async () => {
    setStatsLoading(true);
    const { data } = await getAdminDashboardStats();
    if (data) {
      setStats(data);
    }
    setStatsLoading(false);
  };

  if (loading) {
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
      <AdminHeader
        onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
        isSidebarOpen={sidebarOpen}
      />

      {/* After the Header the sidebar and dashboard content start */}
      <div className="flex flex-1 min-h-[calc(100vh-4rem)] w-full max-w-full relative overflow-x-hidden">
        <AdminSidebar
          mobileOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        <main className="layout-content-wrapper flex-1 p-4 sm:p-6 md:p-8 w-full max-w-full overflow-x-hidden bg-white">
          <div className="max-w-6xl mx-auto space-y-6">
            {/* Top Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-zinc-200">
              <div>
                <h1 className="typo-page-title text-xl sm:text-2xl font-bold text-black tracking-tight">
                  Welcome Admin
                </h1>
                <p className="typo-caption text-xs sm:text-sm text-zinc-500">
                  Overview of today&apos;s online activity and overall store sales
                </p>
              </div>

              {/* Refresh button styled in grey, turns dark black on tap */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={refreshStats}
                  disabled={statsLoading}
                  className="ui-btn ui-btn-grey ui-btn-md px-4 py-2 font-medium flex items-center gap-2 cursor-pointer"
                  title="Refresh stats"
                >
                  <RefreshCw
                    className={`w-4 h-4 text-white ${
                      statsLoading ? 'animate-spin' : ''
                    }`}
                  />
                  <span>Refresh</span>
                </button>
              </div>
            </div>

            {/* Metrics Grid: Today orders & Total online sale */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* Card 1: Today orders */}
              <div className="ui-card p-6 bg-white border border-zinc-200 rounded-lg shadow-xs flex flex-col justify-between hover:border-zinc-300 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <span className="block text-xs uppercase tracking-wider text-zinc-500 font-semibold">
                      Today orders
                    </span>
                    <span className="text-3xl sm:text-4xl font-bold text-black font-mono">
                      {statsLoading ? '—' : stats.todayOrdersCount}
                    </span>
                  </div>
                  <div className="p-3 bg-zinc-100 border border-zinc-200 rounded-lg text-black">
                    <ShoppingBag className="w-6 h-6 text-black" />
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-zinc-100 flex items-center justify-between text-xs">
                  <span className="text-zinc-500">
                    Orders received today
                  </span>
                  <Link
                    href="/admin/onlineorders"
                    className="text-black font-medium hover:underline inline-flex items-center gap-1 cursor-pointer"
                  >
                    <span>View online orders</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>

              {/* Card 2: Total online sale */}
              <div className="ui-card p-6 bg-white border border-zinc-200 rounded-lg shadow-xs flex flex-col justify-between hover:border-zinc-300 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <span className="block text-xs uppercase tracking-wider text-zinc-500 font-semibold">
                      Total online sale
                    </span>
                    <span className="text-3xl sm:text-4xl font-bold text-black font-mono">
                      {statsLoading
                        ? '—'
                        : `₹${Number(stats.totalOnlineSaleAmount || 0).toLocaleString(
                            'en-IN',
                            {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            }
                          )}`}
                    </span>
                  </div>
                  <div className="p-3 bg-zinc-100 border border-zinc-200 rounded-lg text-black">
                    <IndianRupee className="w-6 h-6 text-black" />
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-zinc-100 flex items-center justify-between text-xs">
                  <span className="text-zinc-500">
                    Cumulative sales from online orders
                  </span>
                  <Link
                    href="/admin/onlineorders"
                    className="text-black font-medium hover:underline inline-flex items-center gap-1 cursor-pointer"
                  >
                    <span>Inspect sales</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
