'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Receipt,
  User,
  Store,
  Clock,
  Printer,
  CreditCard,
  Banknote,
  Smartphone,
  CheckCircle2,
  AlertCircle,
  Tag,
  Layers,
  Sparkles,
} from 'lucide-react';
import { getCurrentSupabaseUser } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import StoreHeader from '@/components/store/header';
import StoreSidebar from '@/components/store/sidebar';
import { FullBillDetail, getBillById } from '@/lib/billsStore';

function OpenBillContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const billIdentifier = searchParams.get('id') || searchParams.get('bill_id') || '';

  const [isAuthorized, setIsAuthorized] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [storeName, setStoreName] = useState('Store');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [bill, setBill] = useState<FullBillDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Authentication check
  useEffect(() => {
    let isMounted = true;

    async function checkAuth() {
      try {
        const { user, role } = await getCurrentSupabaseUser();
        if (!isMounted) return;

        if (user && (role === 'store' || role === 'admin')) {
          setIsAuthorized(true);

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
  }, [router]);

  // Fetch bill details
  useEffect(() => {
    let isMounted = true;

    async function loadBill() {
      if (!billIdentifier) {
        setErrorMsg('No bill ID provided.');
        setLoading(false);
        return;
      }

      setLoading(true);
      setErrorMsg(null);

      const { bill: data, error } = await getBillById(billIdentifier);
      if (!isMounted) return;

      if (error || !data) {
        setErrorMsg(error?.message || 'Bill not found.');
      } else {
        setBill(data);
      }
      setLoading(false);
    }

    if (isAuthorized) {
      loadBill();
    }

    return () => {
      isMounted = false;
    };
  }, [isAuthorized, billIdentifier]);

  // Format date and time
  const formatDateTime = (dateStr?: string, createdAtStr?: string) => {
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

  const handlePrint = () => {
    window.print();
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
      {/* On top Header */}
      <div className="print:hidden">
        <StoreHeader
          storeName={storeName}
          isSidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
        />
      </div>

      <div className="flex flex-1 min-h-[calc(100vh-4rem)] w-full max-w-full relative overflow-x-hidden">
        {/* Sidebar */}
        <div className="print:hidden">
          <StoreSidebar
            mobileOpen={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
          />
        </div>

        {/* Content Area */}
        <main className="flex-1 p-4 sm:p-6 md:p-8 w-full max-w-full overflow-x-hidden bg-zinc-50 print:bg-white print:p-0">
          <div className="max-w-5xl mx-auto space-y-6">
            {/* Top Navigation & Actions Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-zinc-200 print:hidden">
              <div className="flex items-center gap-3">
                <Link
                  href="/store/bills"
                  className="p-2 bg-white rounded-lg border border-zinc-200 hover:bg-zinc-100 text-zinc-700 hover:text-black cursor-pointer shadow-xs transition-colors"
                  title="Back to Bills"
                >
                  <ArrowLeft className="w-5 h-5" />
                </Link>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-xl sm:text-2xl font-bold text-black tracking-tight font-mono">
                      {bill?.bill_id || 'Bill Details'}
                    </h1>
                    {bill && (
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          bill.status === 'success'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        {bill.status === 'success' ? (
                          <>
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>Success</span>
                          </>
                        ) : (
                          <>
                            <AlertCircle className="w-3 h-3 text-amber-600" />
                            <span>Draft</span>
                          </>
                        )}
                      </span>
                    )}
                  </div>
                  <p className="typo-caption text-xs text-zinc-500 mt-0.5">
                    Read-only bill view • Locked from editing
                  </p>
                </div>
              </div>

              {/* Print Receipt Action */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrint}
                  disabled={!bill}
                  className="ui-btn ui-btn-outline ui-btn-md px-4 py-2 flex items-center gap-2 text-xs sm:text-sm font-semibold rounded-lg bg-white border border-zinc-300 hover:bg-zinc-100 text-black cursor-pointer shadow-xs"
                >
                  <Printer className="w-4 h-4 text-black" />
                  <span>Print Receipt</span>
                </button>
              </div>
            </div>

            {loading ? (
              <div className="py-24 text-center">
                <Receipt className="w-8 h-8 animate-pulse text-zinc-400 mx-auto mb-3" />
                <p className="text-sm font-medium text-zinc-600">
                  Loading bill details...
                </p>
              </div>
            ) : errorMsg || !bill ? (
              <div className="p-8 bg-white border border-zinc-200 rounded-xl text-center shadow-xs">
                <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-3" />
                <h2 className="text-base font-bold text-black mb-1">
                  Bill Not Found
                </h2>
                <p className="text-xs text-zinc-500 mb-6">
                  {errorMsg || 'The requested bill record could not be loaded.'}
                </p>
                <Link
                  href="/store/bills"
                  className="ui-btn ui-btn-primary ui-btn-sm px-4 py-2 inline-flex items-center gap-1.5 text-xs font-semibold"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Return to Bills List</span>
                </Link>
              </div>
            ) : (
              <div className="space-y-6">
                {/* 1. Bill Header Details Card (Store, Staff, Date, Customer) */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Store & Timing Info */}
                  <div className="p-4 bg-white border border-zinc-200 rounded-xl shadow-xs space-y-2.5">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase text-zinc-500 tracking-wider">
                      <Store className="w-4 h-4 text-zinc-500" />
                      <span>Store Information</span>
                    </div>
                    <div className="space-y-1">
                      <div className="text-sm font-bold text-black">
                        {bill.store?.name || storeName || 'Men Express Outlet'}
                      </div>
                      {bill.store?.store_id && (
                        <div className="text-xs font-mono text-zinc-500">
                          Store Code: {bill.store.store_id}
                        </div>
                      )}
                      <div className="flex items-center gap-1.5 text-xs text-zinc-600 pt-1">
                        <Clock className="w-3.5 h-3.5 text-zinc-400" />
                        <span>{formatDateTime(bill.date, bill.created_at)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Staff Info */}
                  <div className="p-4 bg-white border border-zinc-200 rounded-xl shadow-xs space-y-2.5">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase text-zinc-500 tracking-wider">
                      <User className="w-4 h-4 text-zinc-500" />
                      <span>Billed By Staff</span>
                    </div>
                    <div className="space-y-1">
                      <div className="text-sm font-semibold text-black">
                        {bill.staff?.name ? bill.staff.name : 'Direct Store Counter'}
                      </div>
                      {bill.staff?.mobile && (
                        <div className="text-xs font-mono text-zinc-500">
                          Mobile: {bill.staff.mobile}
                        </div>
                      )}
                      {!bill.staff?.name && (
                        <div className="text-xs text-zinc-400 italic">
                          No specific staff linked
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Customer Info */}
                  <div className="p-4 bg-white border border-zinc-200 rounded-xl shadow-xs space-y-2.5">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase text-zinc-500 tracking-wider">
                      <Tag className="w-4 h-4 text-zinc-500" />
                      <span>Customer Details</span>
                    </div>
                    {bill.customer ? (
                      <div className="space-y-1">
                        <div className="text-sm font-bold text-black">
                          {bill.customer.name}
                        </div>
                        <div className="text-xs font-mono text-zinc-600">
                          {bill.customer.mobile}
                        </div>
                        {typeof bill.customer.points === 'number' && (
                          <div className="text-xs text-emerald-600 font-semibold flex items-center gap-1 pt-0.5">
                            <Sparkles className="w-3 h-3 text-emerald-600" />
                            <span>{bill.customer.points} Loyalty Points</span>
                          </div>
                        )}
                        {bill.customer.email && (
                          <div className="text-xs text-zinc-400">
                            {bill.customer.email}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-xs text-zinc-400 italic pt-1">
                        Walk-in Customer (Not registered)
                      </div>
                    )}
                  </div>
                </div>

                {/* 2. Items Table (Read-Only) */}
                <div className="bg-white border border-zinc-200 rounded-xl shadow-xs overflow-hidden">
                  <div className="px-5 py-3.5 bg-zinc-100 border-b border-zinc-200 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Layers className="w-4 h-4 text-zinc-600" />
                      <h2 className="text-sm font-bold text-black uppercase tracking-wide">
                        Bill Items ({bill.items.length})
                      </h2>
                    </div>
                    <span className="text-xs text-zinc-500">
                      Total Units:{' '}
                      {bill.items.reduce((sum, it) => sum + (it.qty || 1), 0)} pcs
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-zinc-50 text-zinc-600 text-xs uppercase tracking-wider border-b border-zinc-200">
                          <th className="py-2.5 px-4 font-semibold w-12 text-center">
                            #
                          </th>
                          <th className="py-2.5 px-4 font-semibold">
                            Product &amp; Variant
                          </th>
                          <th className="py-2.5 px-4 font-semibold font-mono text-right">
                            MRP
                          </th>
                          <th className="py-2.5 px-4 font-semibold font-mono text-right">
                            Selling Price
                          </th>
                          <th className="py-2.5 px-4 font-semibold font-mono text-center">
                            Qty
                          </th>
                          <th className="py-2.5 px-4 font-semibold font-mono text-right">
                            Total
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-200 text-sm">
                        {bill.items.map((item, index) => (
                          <tr
                            key={item.id || index}
                            className="hover:bg-zinc-50/75 transition-colors"
                          >
                            <td className="py-3 px-4 text-center text-xs text-zinc-400 font-mono">
                              {index + 1}
                            </td>
                            <td className="py-3 px-4">
                              <div className="font-semibold text-black">
                                {item.product_name || 'Apparel Item'}
                              </div>
                              <div className="flex flex-wrap items-center gap-2 mt-0.5 text-xs text-zinc-500">
                                {item.prod_id && (
                                  <span className="font-mono bg-zinc-100 px-1.5 py-0.5 rounded text-[11px] text-zinc-700">
                                    {item.prod_id}
                                  </span>
                                )}
                                {item.barcode && (
                                  <span className="font-mono text-zinc-400 text-[11px]">
                                    BC: {item.barcode}
                                  </span>
                                )}
                                {item.size && item.size !== '—' && (
                                  <span className="inline-block bg-zinc-100 border border-zinc-200 px-1.5 py-0.5 rounded text-[11px] font-semibold text-black">
                                    Size: {item.size}
                                  </span>
                                )}
                                {item.color && item.color !== '—' && (
                                  <span className="inline-flex items-center gap-1 text-[11px]">
                                    {item.color_code && (
                                      <span
                                        className="w-2.5 h-2.5 rounded-full border border-zinc-300"
                                        style={{ backgroundColor: item.color_code }}
                                      />
                                    )}
                                    <span>{item.color}</span>
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-3 px-4 text-right font-mono text-xs text-zinc-400">
                              ₹{item.mrp.toFixed(2)}
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-medium text-black">
                              ₹{item.s_p.toFixed(2)}
                            </td>
                            <td className="py-3 px-4 text-center font-mono font-bold text-black">
                              {item.qty}
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-bold text-black">
                              ₹{item.row_total.toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 3. Payments & Total Summary Section */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Left: Payments Breakdown (Read-Only) */}
                  <div className="bg-white border border-zinc-200 rounded-xl p-5 shadow-xs space-y-4">
                    <div className="flex items-center gap-2 pb-2 border-b border-zinc-200">
                      <CreditCard className="w-4 h-4 text-zinc-600" />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-700">
                        Payment Breakdown
                      </h3>
                    </div>

                    {bill.payments.length === 0 ? (
                      <p className="text-xs text-zinc-400 italic">
                        No split payment records recorded.
                      </p>
                    ) : (
                      <div className="space-y-2.5">
                        {bill.payments.map((p, idx) => (
                          <div
                            key={p.id || idx}
                            className="flex items-center justify-between p-3 rounded-lg bg-zinc-50 border border-zinc-200 text-xs sm:text-sm"
                          >
                            <div className="flex items-center gap-2.5">
                              {p.payment_type === 'cash' ? (
                                <Banknote className="w-4 h-4 text-emerald-600" />
                              ) : p.payment_type === 'upi' ? (
                                <Smartphone className="w-4 h-4 text-indigo-600" />
                              ) : (
                                <CreditCard className="w-4 h-4 text-blue-600" />
                              )}
                              <span className="font-semibold uppercase tracking-wider text-black">
                                {p.payment_type}
                              </span>
                            </div>
                            <span className="font-mono font-bold text-black text-sm">
                              ₹{p.amount.toFixed(2)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="pt-2 border-t border-zinc-100 flex items-center justify-between text-xs text-zinc-500">
                      <span>Total Paid by Modes</span>
                      <span className="font-mono font-semibold text-black">
                        ₹
                        {bill.payments
                          .reduce((s, p) => s + (p.amount || 0), 0)
                          .toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {/* Right: Financial Summary (Read-Only) */}
                  <div className="bg-white border border-zinc-200 rounded-xl p-5 shadow-xs space-y-3">
                    <div className="pb-2 border-b border-zinc-200">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-700">
                        Bill Summary
                      </h3>
                    </div>

                    <div className="space-y-2 text-xs sm:text-sm">
                      <div className="flex justify-between text-zinc-600">
                        <span>Items Subtotal</span>
                        <span className="font-mono font-medium text-black">
                          ₹{bill.amount.toFixed(2)}
                        </span>
                      </div>

                      <div className="flex justify-between text-zinc-600">
                        <span>Discount Applied</span>
                        <span className="font-mono font-medium text-emerald-600">
                          - ₹{bill.discount.toFixed(2)}
                        </span>
                      </div>

                      <div className="pt-3 border-t border-zinc-200 flex justify-between items-baseline">
                        <span className="text-sm font-bold text-black uppercase tracking-wide">
                          Final Amount
                        </span>
                        <span className="text-xl sm:text-2xl font-black font-mono text-black">
                          ₹{bill.final_amount.toFixed(2)}
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 pt-4 border-t border-zinc-100 text-[11px] text-zinc-400 flex items-center justify-between">
                      <span>Status: {bill.status.toUpperCase()}</span>
                      <span className="font-mono">ID: {bill.id}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

export default function StoreOpenBillPage() {
  return (
    <Suspense
      fallback={
        <div className="layout-page-container layout-flex-center min-h-screen bg-white">
          <p className="typo-body text-zinc-600">Loading bill...</p>
        </div>
      }
    >
      <OpenBillContent />
    </Suspense>
  );
}
