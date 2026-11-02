'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Package,
  Store,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Phone,
  Mail,
  MapPin,
  Barcode,
  Save,
  Check,
} from 'lucide-react';
import { getCurrentSupabaseUser } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import StoreHeader from '@/components/store/header';
import StoreSidebar from '@/components/store/sidebar';
import {
  StoreDistribution,
  DistributionStatus,
  getStoreDistributionDetails,
  updateStoreDistributionStatusAndInventory,
} from '@/lib/store/distributions';

function OpenDistributionContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const distributionParam =
    searchParams.get('id') || searchParams.get('distribution_id') || '';

  const [isAuthorized, setIsAuthorized] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | undefined>(undefined);
  const [storeName, setStoreName] = useState('Store');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [distribution, setDistribution] = useState<StoreDistribution | null>(null);
  const [loading, setLoading] = useState(Boolean(distributionParam));
  const [error, setError] = useState<string | null>(
    distributionParam ? null : 'No store distribution ID provided in query.'
  );

  // Status edit state (only available if status === 'pending')
  const [selectedStatus, setSelectedStatus] = useState<DistributionStatus>('pending');
  const [saving, setSaving] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [saveErrorMsg, setSaveErrorMsg] = useState<string | null>(null);

  // Authentication check
  useEffect(() => {
    let isMounted = true;

    async function checkAuth() {
      try {
        const { user, role } = await getCurrentSupabaseUser();
        if (!isMounted) return;

        if (user && (role === 'store' || role === 'admin')) {
          setIsAuthorized(true);
          setCurrentUserId(user.id);

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

  // Load Distribution Details
  useEffect(() => {
    let ignore = false;
    if (isAuthorized && distributionParam) {
      getStoreDistributionDetails(distributionParam).then(
        ({ data, error: fetchErr }) => {
          if (ignore) return;
          if (fetchErr || !data) {
            setError(
              fetchErr?.message || 'Store distribution record could not be found.'
            );
            setLoading(false);
          } else {
            setDistribution(data);
            setSelectedStatus(data.status);
            setLoading(false);
          }
        }
      );
    }

    return () => {
      ignore = true;
    };
  }, [isAuthorized, distributionParam]);

  // Handle Save
  const handleSaveStatus = async () => {
    if (!distribution) return;
    if (distribution.status !== 'pending') {
      setSaveErrorMsg('Only distributions with pending status can be modified.');
      return;
    }

    setSaving(true);
    setSaveErrorMsg(null);
    setSaveSuccessMsg(null);

    try {
      const { success, data, error: updateErr } =
        await updateStoreDistributionStatusAndInventory(
          distribution.id,
          selectedStatus,
          currentUserId
        );

      if (!success || updateErr) {
        setSaveErrorMsg(updateErr?.message || 'Failed to update distribution status.');
      } else if (data) {
        setDistribution(data);
        setSelectedStatus(data.status);
        if (data.status === 'accepted') {
          setSaveSuccessMsg(
            'Distribution successfully accepted! Stock items have been updated in your store products inventory.'
          );
        } else {
          setSaveSuccessMsg('Distribution details saved successfully.');
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error during save';
      setSaveErrorMsg(msg);
    } finally {
      setSaving(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-50">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-black" />
          <p className="text-sm text-zinc-600">Verifying store access...</p>
        </div>
      </div>
    );
  }

  if (!isAuthorized) {
    return null;
  }

  const items = distribution?.items || [];
  const totalQty = items.reduce((sum, item) => sum + Number(item.qty || 0), 0);
  const isPending = distribution?.status === 'pending';

  return (
    <div className="min-h-screen flex flex-col bg-white w-full max-w-full overflow-x-hidden">
      {/* On top Header covers everything */}
      <StoreHeader
        storeName={storeName}
        isSidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
      />

      <div className="flex flex-1 min-h-[calc(100vh-4rem)] w-full max-w-full relative overflow-x-hidden">
        {/* After the Header the sidebar starts */}
        <StoreSidebar
          mobileOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        {/* Content Area */}
        <main className="flex-1 p-4 sm:p-6 md:p-8 w-full max-w-full overflow-x-hidden bg-zinc-50">
          <div className="max-w-6xl mx-auto space-y-6">
            {/* Top Navigation: Back to Distributions */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <Link
                href="/store/distributions"
                className="inline-flex items-center gap-2 text-sm text-zinc-600 hover:text-black font-medium transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Store Distributions</span>
              </Link>
            </div>

            {/* Loading State */}
            {loading && (
              <div className="bg-white border border-zinc-200 rounded-lg p-12 text-center shadow-xs">
                <Loader2 className="w-8 h-8 animate-spin text-black mx-auto mb-3" />
                <p className="text-sm font-medium text-zinc-700">
                  Loading distribution details...
                </p>
                <p className="text-xs text-zinc-400 mt-1">Please wait a moment.</p>
              </div>
            )}

            {/* Error State */}
            {!loading && error && (
              <div className="bg-white border border-red-200 rounded-lg p-8 text-center shadow-xs">
                <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-3">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-zinc-900 mb-1">
                  Unable to load distribution record
                </h3>
                <p className="text-sm text-red-600 mb-6">{error}</p>
                <Link
                  href="/store/distributions"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-black text-white text-xs font-semibold rounded-md hover:bg-zinc-800 transition-colors"
                >
                  Return to Store Distributions
                </Link>
              </div>
            )}

            {/* Save Alerts */}
            {saveSuccessMsg && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg flex items-start gap-3">
                <Check className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div className="flex-1 text-sm font-medium text-emerald-800">
                  {saveSuccessMsg}
                </div>
              </div>
            )}

            {saveErrorMsg && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                <div className="flex-1 text-sm font-medium text-red-800">
                  {saveErrorMsg}
                </div>
              </div>
            )}

            {/* Loaded Details */}
            {!loading && distribution && (
              <div className="space-y-6">
                {/* Distribution Header & Status Card */}
                <div className="bg-white border border-zinc-200 rounded-lg shadow-xs p-6">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-zinc-100">
                    <div className="space-y-1">
                      <div className="flex items-center gap-3">
                        <h1 className="text-xl md:text-2xl font-bold font-mono text-zinc-900 tracking-tight">
                          {distribution.distribution_id}
                        </h1>
                        {distribution.status === 'accepted' ? (
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Accepted</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                            <Clock className="w-3.5 h-3.5 text-amber-600" />
                            <span>Pending Acceptance</span>
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-zinc-500">
                        Store Stock Distribution Record
                      </p>
                    </div>

                    {/* Summary Metric Pills */}
                    <div className="flex items-center gap-3">
                      <div className="px-4 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-right">
                        <div className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">
                          Total Items
                        </div>
                        <div className="text-base font-bold text-zinc-900 font-mono">
                          {items.length} {items.length === 1 ? 'line' : 'lines'}
                        </div>
                      </div>
                      <div className="px-4 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-right">
                        <div className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">
                          Total Units
                        </div>
                        <div className="text-base font-bold text-zinc-900 font-mono">
                          {totalQty} pcs
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Metadata Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6">
                    {/* Destination Store Info */}
                    <div className="bg-zinc-50/70 border border-zinc-200/80 rounded-lg p-4 space-y-3">
                      <div className="flex items-center gap-2 text-xs font-bold text-zinc-700 uppercase tracking-wider">
                        <Store className="w-4 h-4 text-zinc-600" />
                        <span>Destination Store</span>
                      </div>

                      <div className="space-y-1.5 text-sm">
                        <div className="font-semibold text-zinc-900 text-base">
                          {distribution.store_name || 'Store'}
                        </div>
                        {distribution.store_code && (
                          <div className="text-xs text-zinc-500 font-mono">
                            Store Code: {distribution.store_code}
                          </div>
                        )}
                        {distribution.store_address && (
                          <div className="flex items-start gap-2 text-xs text-zinc-600 pt-1">
                            <MapPin className="w-3.5 h-3.5 text-zinc-400 mt-0.5 shrink-0" />
                            <span>{distribution.store_address}</span>
                          </div>
                        )}
                        {distribution.store_mobile && (
                          <div className="flex items-center gap-2 text-xs text-zinc-600">
                            <Phone className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                            <span>{distribution.store_mobile}</span>
                          </div>
                        )}
                        {distribution.store_email && (
                          <div className="flex items-center gap-2 text-xs text-zinc-600">
                            <Mail className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                            <span>{distribution.store_email}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Distribution Audit Timeline */}
                    <div className="bg-zinc-50/70 border border-zinc-200/80 rounded-lg p-4 space-y-3">
                      <div className="flex items-center gap-2 text-xs font-bold text-zinc-700 uppercase tracking-wider">
                        <Calendar className="w-4 h-4 text-zinc-600" />
                        <span>Distribution Details</span>
                      </div>

                      <div className="space-y-2 text-xs">
                        <div className="flex items-center justify-between py-1 border-b border-zinc-200/60">
                          <span className="text-zinc-500 font-medium">Distribution Date</span>
                          <span className="font-mono font-semibold text-zinc-900">
                            {distribution.date}
                          </span>
                        </div>

                        <div className="flex items-center justify-between py-1 border-b border-zinc-200/60">
                          <span className="text-zinc-500 font-medium">Current Status</span>
                          <span className="font-semibold capitalize text-zinc-900">
                            {distribution.status}
                          </span>
                        </div>

                        <div className="flex items-center justify-between py-1 border-b border-zinc-200/60">
                          <span className="text-zinc-500 font-medium">Accepted At</span>
                          <span className="font-mono text-zinc-900">
                            {distribution.accepted_at
                              ? new Date(distribution.accepted_at).toLocaleString('en-IN', {
                                  dateStyle: 'medium',
                                  timeStyle: 'short',
                                })
                              : 'Pending (Not yet accepted)'}
                          </span>
                        </div>

                        {distribution.created_at && (
                          <div className="flex items-center justify-between py-1">
                            <span className="text-zinc-500 font-medium">Created On</span>
                            <span className="font-mono text-zinc-700">
                              {new Date(distribution.created_at).toLocaleString('en-IN', {
                                dateStyle: 'medium',
                                timeStyle: 'short',
                              })}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Status Change & Save Section (allowed ONLY if status=pending) */}
                  <div className="mt-6 pt-6 border-t border-zinc-200">
                    <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-4 sm:p-5">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div>
                          <h3 className="text-sm font-bold text-black uppercase tracking-wide">
                            Distribution Acceptance Status
                          </h3>
                          <p className="text-xs text-zinc-500 mt-0.5">
                            {isPending
                              ? 'Change the status to Accepted to receive this inventory batch into your store products.'
                              : 'This distribution has already been accepted. Inventory has been updated.'}
                          </p>
                        </div>

                        {isPending ? (
                          <div className="flex items-center gap-3">
                            <label className="text-xs font-medium text-zinc-700 whitespace-nowrap">
                              Status:
                            </label>
                            <select
                              value={selectedStatus}
                              onChange={(e) =>
                                setSelectedStatus(e.target.value as DistributionStatus)
                              }
                              disabled={saving}
                              className="ui-select text-xs font-semibold text-black bg-white border border-zinc-300 rounded px-3 py-1.5 h-9 min-w-[140px] focus:outline-hidden focus:border-black cursor-pointer"
                            >
                              <option value="pending">Pending</option>
                              <option value="accepted">Accepted</option>
                            </select>

                            <button
                              type="button"
                              onClick={handleSaveStatus}
                              disabled={saving}
                              className="ui-btn ui-btn-grey ui-btn-md px-4 py-2 font-medium flex items-center gap-2 shadow-xs cursor-pointer inline-flex items-center text-xs text-white"
                            >
                              {saving ? (
                                <>
                                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                                  <span>Saving...</span>
                                </>
                              ) : (
                                <>
                                  <Save className="w-4 h-4 text-white" />
                                  <span>Save</span>
                                </>
                              )}
                            </button>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-emerald-100 text-emerald-800 text-xs font-semibold border border-emerald-200">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            <span>Accepted and Saved</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Distribution Items Table Card */}
                <div className="bg-white border border-zinc-200 rounded-lg shadow-xs overflow-hidden">
                  <div className="p-4 md:p-6 border-b border-zinc-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <h2 className="text-base font-bold text-zinc-900 flex items-center gap-2">
                        <Package className="w-4 h-4 text-zinc-700" />
                        <span>Distribution Items</span>
                      </h2>
                      <p className="text-xs text-zinc-500 mt-0.5">
                        Itemized inventory dispatched in this distribution
                      </p>
                    </div>

                    <span className="text-xs font-mono bg-zinc-100 text-zinc-700 px-2.5 py-1 rounded border border-zinc-200 self-start sm:self-auto">
                      {items.length} items • {totalQty} total units
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-zinc-50 border-b border-zinc-200 text-zinc-600 text-xs font-bold uppercase tracking-wider">
                          <th className="py-3 px-4 w-12 text-center">#</th>
                          <th className="py-3 px-4">Product Details</th>
                          <th className="py-3 px-4">Size &amp; Color</th>
                          <th className="py-3 px-4">Barcode</th>
                          <th className="py-3 px-4 text-right">Quantity</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-200 text-xs">
                        {items.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="py-8 text-center text-zinc-500">
                              No items found in this distribution.
                            </td>
                          </tr>
                        ) : (
                          items.map((item, index) => (
                            <tr key={item.id || index} className="hover:bg-zinc-50/70 transition-colors">
                              {/* Line Number */}
                              <td className="py-3 px-4 text-center font-mono text-zinc-400">
                                {index + 1}
                              </td>

                              {/* Product Details */}
                              <td className="py-3 px-4">
                                <div className="font-semibold text-zinc-900 text-sm">
                                  {item.product_name || 'Product'}
                                </div>
                                <div className="text-[11px] text-zinc-500 font-mono mt-0.5">
                                  {item.product_prod_id ? `ID: ${item.product_prod_id}` : `Ref: ${item.product_id}`}
                                </div>
                              </td>

                              {/* Size & Color */}
                              <td className="py-3 px-4">
                                <div className="flex items-center gap-2 flex-wrap">
                                  {item.variant_size && (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded bg-zinc-100 text-zinc-800 font-mono text-[11px] font-semibold border border-zinc-200">
                                      Size: {item.variant_size}
                                    </span>
                                  )}
                                  {item.variant_color && (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded bg-zinc-100 text-zinc-800 text-[11px] font-medium border border-zinc-200">
                                      Color: {item.variant_color}
                                    </span>
                                  )}
                                  {!item.variant_size && !item.variant_color && (
                                    <span className="text-zinc-400">—</span>
                                  )}
                                </div>
                              </td>

                              {/* Barcode */}
                              <td className="py-3 px-4 font-mono text-zinc-700">
                                <div className="flex items-center gap-1.5">
                                  <Barcode className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                                  <span>{item.barcode || '—'}</span>
                                </div>
                              </td>

                              {/* Quantity */}
                              <td className="py-3 px-4 text-right">
                                <span className="inline-block px-2.5 py-1 rounded bg-zinc-100 text-zinc-900 font-mono font-bold text-sm border border-zinc-200">
                                  {item.qty} pcs
                                </span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                      {items.length > 0 && (
                        <tfoot>
                          <tr className="bg-zinc-50/80 border-t-2 border-zinc-300 font-semibold text-xs text-zinc-900">
                            <td colSpan={4} className="py-3 px-4 text-right uppercase tracking-wider text-zinc-600 font-bold">
                              Total Quantity:
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-bold text-sm text-black">
                              {totalQty} pcs
                            </td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
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

export default function StoreOpenDistributionPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-zinc-50">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-black" />
            <p className="text-sm text-zinc-600">Loading distribution record...</p>
          </div>
        </div>
      }
    >
      <OpenDistributionContent />
    </Suspense>
  );
}
