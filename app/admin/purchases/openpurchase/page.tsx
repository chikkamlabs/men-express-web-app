'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  ShoppingCart,
  Building2,
  Calendar,
  FileText,
  Package,
  AlertCircle,
  Loader2,
  Phone,
  Mail,
  Wallet,
} from 'lucide-react';
import { getCurrentSupabaseUser } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import AdminHeader from '@/components/admin/header';
import AdminSidebar from '@/components/admin/sidebar';
import { Purchase, getPurchaseDetails } from '@/lib/purchasesStore';

function OpenPurchaseContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const purchaseParam = searchParams.get('id') || searchParams.get('purchase_id') || '';

  const [isAuthorized, setIsAuthorized] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [purchase, setPurchase] = useState<Purchase | null>(null);
  const [loading, setLoading] = useState(Boolean(purchaseParam));
  const [error, setError] = useState<string | null>(
    purchaseParam ? null : 'No purchase ID provided in query.'
  );

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

  // Load Purchase Details
  useEffect(() => {
    let ignore = false;
    if (isAuthorized && purchaseParam) {
      getPurchaseDetails(purchaseParam).then(({ data, error: fetchErr }) => {
        if (ignore) return;
        if (fetchErr || !data) {
          setError(fetchErr?.message || 'Purchase record could not be found.');
          setLoading(false);
        } else {
          setPurchase(data);
          setLoading(false);
        }
      });
    }
    return () => {
      ignore = true;
    };
  }, [isAuthorized, purchaseParam]);

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
          <div className="max-w-5xl mx-auto space-y-6">
            {/* Back link & Title */}
            <div className="space-y-2">
              <Link
                href="/admin/purchases"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-600 hover:text-black transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Purchases</span>
              </Link>

              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-zinc-200">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-zinc-100 rounded-lg text-black border border-zinc-200">
                    <ShoppingCart className="w-6 h-6 text-black" />
                  </div>
                  <div>
                    <h1 className="typo-page-title text-xl sm:text-2xl font-bold text-black tracking-tight flex items-center gap-2">
                      <span>Purchase</span>
                      <span className="font-mono">{purchase?.purchase_id || purchaseParam}</span>
                    </h1>
                    <p className="typo-caption text-xs sm:text-sm text-zinc-500">
                      View full supplier invoice and purchased items details (Read-only)
                    </p>
                  </div>
                </div>

                {purchase && (
                  <div className="flex items-center gap-3">
                    <div className="px-3.5 py-1.5 bg-zinc-50 border border-zinc-200 rounded-md text-right">
                      <span className="block text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">
                        Total Amount
                      </span>
                      <span className="text-base font-bold text-black font-mono">
                        ₹
                        {Number(purchase.total_amount || 0).toLocaleString('en-IN', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {!purchaseParam ? (
              <div className="p-6 bg-red-50 border border-red-200 rounded-lg text-red-700 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-sm">No purchase specified</p>
                  <p className="text-xs mt-1">Please provide a valid purchase ID or reference.</p>
                  <Link
                    href="/admin/purchases"
                    className="inline-block mt-3 text-xs font-medium underline hover:text-red-900"
                  >
                    Return to purchases list
                  </Link>
                </div>
              </div>
            ) : loading ? (
              <div className="p-12 text-center text-sm text-zinc-500 flex flex-col items-center justify-center gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-black" />
                <span>Loading purchase details...</span>
              </div>
            ) : error || !purchase ? (
              <div className="p-6 bg-red-50 border border-red-200 rounded-lg text-red-700 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-sm">Unable to load purchase</p>
                  <p className="text-xs mt-1">{error || 'Purchase record not found.'}</p>
                  <Link
                    href="/admin/purchases"
                    className="inline-block mt-3 text-xs font-medium underline hover:text-red-900"
                  >
                    Return to purchases list
                  </Link>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Section 1: Purchase and Distributor Overview (Read-only) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Purchase Invoice Information Card */}
                  <div className="ui-card p-6 bg-white border border-zinc-200 rounded-lg space-y-4 shadow-xs">
                    <div className="flex items-center gap-2 pb-3 border-b border-zinc-200">
                      <FileText className="w-4 h-4 text-black" />
                      <h2 className="text-sm font-bold text-black uppercase tracking-wide">
                        Purchase Information
                      </h2>
                    </div>

                    <div className="grid grid-cols-2 gap-y-3 text-xs">
                      <div>
                        <span className="text-zinc-500 block">Purchase ID</span>
                        <span className="font-mono font-bold text-black text-sm">
                          {purchase.purchase_id}
                        </span>
                      </div>
                      <div>
                        <span className="text-zinc-500 block">Invoice Number</span>
                        <span className="font-mono text-black font-semibold">
                          {purchase.invoice_number || '—'}
                        </span>
                      </div>

                      <div>
                        <span className="text-zinc-500 block">Purchase Date</span>
                        <span className="font-mono text-black flex items-center gap-1.5 mt-0.5">
                          <Calendar className="w-3.5 h-3.5 text-zinc-400" />
                          <span>{purchase.date}</span>
                        </span>
                      </div>
                      <div>
                        <span className="text-zinc-500 block">Total Amount</span>
                        <span className="font-mono text-sm font-bold text-black">
                          ₹
                          {Number(purchase.total_amount || 0).toLocaleString('en-IN', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </span>
                      </div>

                      <div className="col-span-2 pt-2 border-t border-zinc-100">
                        <span className="text-zinc-500 block text-[11px]">System Timestamp</span>
                        <span className="text-zinc-700 text-xs">
                          Recorded on{' '}
                          {purchase.created_at
                            ? new Date(purchase.created_at).toLocaleString('en-IN', {
                                dateStyle: 'medium',
                                timeStyle: 'short',
                              })
                            : '—'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Distributor Details Card */}
                  <div className="ui-card p-6 bg-white border border-zinc-200 rounded-lg space-y-4 shadow-xs">
                    <div className="flex items-center gap-2 pb-3 border-b border-zinc-200">
                      <Building2 className="w-4 h-4 text-black" />
                      <h2 className="text-sm font-bold text-black uppercase tracking-wide">
                        Distributor (Supplier) Details
                      </h2>
                    </div>

                    <div className="space-y-3 text-xs">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-bold text-black">
                            {purchase.distributor_name || '—'}
                          </p>
                          <p className="text-xs font-mono text-zinc-500">
                            {purchase.distributor_code || ''}
                            {purchase.distributor_company ? ` • ${purchase.distributor_company}` : ''}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-y-2 pt-2 border-t border-zinc-100">
                        <div>
                          <span className="text-zinc-500 block text-[11px] flex items-center gap-1">
                            <Phone className="w-3 h-3 text-zinc-400" /> Mobile
                          </span>
                          <span className="font-mono text-black font-medium">
                            {purchase.distributor_mobile || '—'}
                          </span>
                        </div>
                        <div>
                          <span className="text-zinc-500 block text-[11px] flex items-center gap-1">
                            <Mail className="w-3 h-3 text-zinc-400" /> Email
                          </span>
                          <span className="text-black">
                            {purchase.distributor_email || '—'}
                          </span>
                        </div>

                        <div className="col-span-2 pt-1">
                          <span className="text-zinc-500 block text-[11px] flex items-center gap-1">
                            <Wallet className="w-3 h-3 text-zinc-400" /> Outstanding Balance
                          </span>
                          <span className="font-mono text-black font-semibold text-xs">
                            ₹
                            {Number(purchase.distributor_balance || 0).toLocaleString('en-IN', {
                              minimumFractionDigits: 2,
                            })}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section 2: Purchase Line Items Table (Read-only) */}
                <div className="ui-card p-6 bg-white border border-zinc-200 rounded-lg space-y-4 shadow-xs">
                  <div className="flex items-center justify-between pb-3 border-b border-zinc-200">
                    <div className="flex items-center gap-2">
                      <Package className="w-4 h-4 text-black" />
                      <h2 className="text-sm font-bold text-black uppercase tracking-wide">
                        Purchased Items Details ({purchase.items?.length || 0})
                      </h2>
                    </div>
                    <span className="text-xs text-zinc-500 font-mono">
                      Read-only record
                    </span>
                  </div>

                  <div className="ui-table-container border border-zinc-200 rounded-lg overflow-hidden bg-white">
                    <table className="ui-table w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-zinc-100 border-b border-zinc-200 font-semibold text-zinc-600 uppercase">
                          <th className="py-2.5 px-3">Product Name</th>
                          <th className="py-2.5 px-3">Product ID</th>
                          <th className="py-2.5 px-3">Barcode / SKU</th>
                          <th className="py-2.5 px-3">Size</th>
                          <th className="py-2.5 px-3">Color</th>
                          <th className="py-2.5 px-3 text-right">MRP (₹)</th>
                          <th className="py-2.5 px-3 text-right">P_P (₹)</th>
                          <th className="py-2.5 px-3 text-center">Qty</th>
                          <th className="py-2.5 px-3 text-right">Subtotal (₹)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-200">
                        {!purchase.items || purchase.items.length === 0 ? (
                          <tr>
                            <td colSpan={9} className="py-8 text-center text-zinc-400">
                              No line items recorded for this purchase invoice.
                            </td>
                          </tr>
                        ) : (
                          purchase.items.map((item, idx) => {
                            const subtotal = Number(item.p_p || 0) * Number(item.qty || 0);
                            return (
                              <tr key={item.id || idx} className="hover:bg-zinc-50">
                                <td className="py-3 px-3 font-medium text-black">
                                  {item.product_name || 'Clothing Product'}
                                </td>
                                <td className="py-3 px-3 font-mono text-zinc-500">
                                  {item.product_prod_id || '—'}
                                </td>
                                <td className="py-3 px-3 font-mono text-zinc-700">
                                  {item.variant_barcode || '—'}
                                </td>
                                <td className="py-3 px-3 font-mono">
                                  <span className="px-2 py-0.5 bg-zinc-100 border border-zinc-200 rounded">
                                    {item.variant_size || '—'}
                                  </span>
                                </td>
                                <td className="py-3 px-3 text-zinc-700">
                                  {item.variant_color || '—'}
                                </td>
                                <td className="py-3 px-3 text-right font-mono text-zinc-600">
                                  ₹{Number(item.mrp || 0).toLocaleString('en-IN', {
                                    minimumFractionDigits: 2,
                                  })}
                                </td>
                                <td className="py-3 px-3 text-right font-mono font-semibold text-black">
                                  ₹{Number(item.p_p || 0).toLocaleString('en-IN', {
                                    minimumFractionDigits: 2,
                                  })}
                                </td>
                                <td className="py-3 px-3 text-center font-mono font-bold text-black">
                                  {item.qty}
                                </td>
                                <td className="py-3 px-3 text-right font-mono font-bold text-black">
                                  ₹{subtotal.toLocaleString('en-IN', {
                                    minimumFractionDigits: 2,
                                  })}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                      {purchase.items && purchase.items.length > 0 && (
                        <tfoot>
                          <tr className="bg-zinc-50 font-bold border-t border-zinc-200 text-black">
                            <td colSpan={7} className="py-3 px-3 text-right uppercase text-[11px]">
                              Total Items: {purchase.items.length} | Total Units:
                            </td>
                            <td className="py-3 px-3 text-center font-mono">
                              {purchase.items.reduce((acc, it) => acc + Number(it.qty || 0), 0)}
                            </td>
                            <td className="py-3 px-3 text-right font-mono text-sm">
                              ₹
                              {purchase.items
                                .reduce((acc, it) => acc + Number(it.p_p || 0) * Number(it.qty || 0), 0)
                                .toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                </div>

                {/* Footer Controls: Back button only, strictly no edit option */}
                <div className="flex items-center justify-between pt-2">
                  <Link
                    href="/admin/purchases"
                    className="ui-btn ui-btn-outline ui-btn-md text-xs text-black border-zinc-300 hover:bg-zinc-100 cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back to Purchases</span>
                  </Link>

                  <span className="text-xs text-zinc-400 italic">
                    Historical purchase records are preserved for inventory accounting and audit integrity.
                  </span>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

export default function AdminOpenPurchasePage() {
  return (
    <Suspense
      fallback={
        <div className="layout-page-container layout-flex-center min-h-screen bg-white">
          <p className="typo-body text-zinc-600">Loading purchase record...</p>
        </div>
      }
    >
      <OpenPurchaseContent />
    </Suspense>
  );
}
