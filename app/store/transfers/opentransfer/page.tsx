'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowLeftRight,
  Building2,
  Calendar,
  User,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Package,
  Layers,
  Save,
  Trash2,
  Plus,
  ArrowUpRight,
  ArrowDownLeft,
  Edit3,
} from 'lucide-react';
import { getCurrentSupabaseUser } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import StoreHeader from '@/components/store/header';
import StoreSidebar from '@/components/store/sidebar';
import {
  StoreTransfer,
  StoreTransferItem,
  AvailableStoreProductItem,
  getStoreTransferById,
  updateStoreTransfer,
  resolveStoreTransfer,
  getAvailableStoreInventory,
  getDestinationStores,
  getStoreStaffMembers,
} from '@/lib/store/transfersStore';

function OpenTransferContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const transferIdParam = searchParams.get('id') || searchParams.get('transfer_id') || '';

  const [isAuthorized, setIsAuthorized] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [currentStoreId, setCurrentStoreId] = useState<string | undefined>(undefined);
  const [storeName, setStoreName] = useState('Store');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [transfer, setTransfer] = useState<StoreTransfer | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Editable state (used when from_store is this store and status is pending)
  const [isEditing, setIsEditing] = useState(false);
  const [editToStoreId, setEditToStoreId] = useState<string>('');
  const [editDate, setEditDate] = useState<string>('');
  const [editStaffId, setEditStaffId] = useState<string>('');
  const [editNotes, setEditNotes] = useState<string>('');
  const [editItems, setEditItems] = useState<
    {
      product_id: string;
      product_variant_id: string;
      qty: number;
      available_qty: number;
      product_name: string;
      prod_id: string;
      size: string;
      color: string;
      barcode: string;
    }[]
  >([]);

  // Other stores & staff for edit mode
  const [otherStores, setOtherStores] = useState<{ id: string; name: string; store_id: string }[]>([]);
  const [staffList, setStaffList] = useState<{ id: string; name: string; mobile?: string | null }[]>([]);
  const [storeInventory, setStoreInventory] = useState<AvailableStoreProductItem[]>([]);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Item adding state in edit mode
  const [selectedInvVariantId, setSelectedInvVariantId] = useState<string>('');
  const [selectedAddQty, setSelectedAddQty] = useState<number>(1);
  const [itemAddError, setItemAddError] = useState<string | null>(null);

  // Action loading states
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

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
  }, [router]);

  // Fetch Transfer details inside useEffect
  useEffect(() => {
    let ignore = false;

    async function load() {
      if (!transferIdParam) {
        setErrorMsg('No transfer ID provided in URL.');
        setLoading(false);
        return;
      }

      const { transfer: data, error } = await getStoreTransferById(
        transferIdParam,
        currentStoreId
      );

      if (!ignore) {
        if (error || !data) {
          setErrorMsg(error?.message || 'Transfer record not found.');
        } else {
          setTransfer(data);
          setEditToStoreId(data.to_store_id);
          setEditDate(data.date);
          setEditStaffId(data.staff_id || '');
          setEditNotes(data.notes || '');

          const initialEditItems = (data.items || []).map((it) => ({
            product_id: it.product_id || '',
            product_variant_id: it.product_variant_id,
            qty: it.qty,
            available_qty: it.qty + 999,
            product_name: it.product_name || 'Product',
            prod_id: it.prod_id || '',
            size: it.size || '—',
            color: it.color || '—',
            barcode: it.barcode || '',
          }));
          setEditItems(initialEditItems);
        }
        setLoading(false);
      }
    }

    if (isAuthorized && currentStoreId) {
      load();
    }

    return () => {
      ignore = true;
    };
  }, [isAuthorized, currentStoreId, transferIdParam, refreshTrigger]);

  // Load supporting lists if origin store can edit
  useEffect(() => {
    if (!isAuthorized || !currentStoreId || !transfer) return;

    if (transfer.from_store_id === currentStoreId && transfer.status === 'pending') {
      getDestinationStores(currentStoreId).then((stores) => {
        if (stores) {
          setOtherStores(stores);
        }
      });
      getStoreStaffMembers(currentStoreId).then((data) => {
        if (data) {
          setStaffList(data);
        }
      });
      getAvailableStoreInventory(currentStoreId).then(({ items }) => {
        setStoreInventory(items);
      });
    }
  }, [isAuthorized, currentStoreId, transfer]);

  // Helper flags
  const isFromStore = transfer?.from_store_id === currentStoreId;
  const isToStore = transfer?.to_store_id === currentStoreId;
  const isPending = transfer?.status === 'pending';

  // Handler for Accept / Reject (Allowed only if to_store is this store)
  const handleResolve = async (action: 'accepted' | 'rejected') => {
    if (!transfer) return;
    setActionError(null);
    setActionSuccess(null);
    setActionLoading(true);

    const result = await resolveStoreTransfer(
      transfer.id,
      action,
      currentStoreId!
    );

    if (!result.success || result.error) {
      setActionError(result.error?.message || `Failed to ${action} transfer.`);
      setActionLoading(false);
      return;
    }

    setActionSuccess(
      action === 'accepted'
        ? 'Stock transfer accepted! Quantities added to your store inventory.'
        : 'Stock transfer rejected! Quantities returned to origin store.'
    );
    setActionLoading(false);
    // Reload updated transfer
    setRefreshTrigger((v) => v + 1);
  };

  // Handler for Save Changes (Allowed only if from_store is this store and status is pending)
  const handleSaveEdit = async () => {
    if (!transfer) return;
    setActionError(null);
    setActionSuccess(null);

    if (!editToStoreId) {
      setActionError('Please select a destination store.');
      return;
    }

    if (editItems.length === 0) {
      setActionError('Transfer must contain at least one product item.');
      return;
    }

    setActionLoading(true);

    const result = await updateStoreTransfer(transfer.id, currentStoreId!, {
      to_store_id: editToStoreId,
      notes: editNotes.trim() || null,
      staff_id: editStaffId || null,
      date: editDate,
      items: editItems.map((it) => ({
        product_id: it.product_id,
        product_variant_id: it.product_variant_id,
        qty: it.qty,
        barcode: it.barcode,
        product_name: it.product_name,
        prod_id: it.prod_id,
        size: it.size,
        color: it.color,
      })),
    });

    if (!result.success || result.error) {
      setActionError(result.error?.message || 'Failed to update transfer.');
      setActionLoading(false);
      return;
    }

    setActionSuccess('Transfer changes saved successfully!');
    setActionLoading(false);
    setIsEditing(false);
    setRefreshTrigger((v) => v + 1);
  };

  // Add Item in Edit Mode
  const handleAddEditItem = () => {
    setItemAddError(null);
    const inv = storeInventory.find((i) => i.product_variant_id === selectedInvVariantId);
    if (!inv) {
      setItemAddError('Please select a product from store inventory.');
      return;
    }
    if (selectedAddQty <= 0) {
      setItemAddError('Quantity must be greater than zero.');
      return;
    }
    if (selectedAddQty > inv.available_qty) {
      setItemAddError(`Quantity exceeds available stock (${inv.available_qty} pcs).`);
      return;
    }

    setEditItems((prev) => [
      ...prev,
      {
        product_id: inv.product_id,
        product_variant_id: inv.product_variant_id,
        qty: selectedAddQty,
        available_qty: inv.available_qty,
        product_name: inv.product_name,
        prod_id: inv.prod_id,
        size: inv.size,
        color: inv.color,
        barcode: inv.barcode,
      },
    ]);
    setSelectedInvVariantId('');
    setSelectedAddQty(1);
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
        <main className="flex-1 p-4 sm:p-6 md:p-8 w-full max-w-full overflow-x-hidden bg-zinc-50 pb-24">
          <div className="max-w-4xl mx-auto space-y-6">
            {/* Top Navigation & Action Controls Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-zinc-200">
              <div className="flex items-center gap-3">
                <Link
                  href="/store/transfers/dashboard"
                  className="p-2 bg-white rounded-lg border border-zinc-200 hover:bg-zinc-100 text-zinc-700 hover:text-black cursor-pointer shadow-xs transition-colors"
                  title="Back to Transfers"
                >
                  <ArrowLeft className="w-5 h-5" />
                </Link>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-xl sm:text-2xl font-bold text-black tracking-tight font-mono">
                      {transfer?.transfer_id || 'Store Transfer'}
                    </h1>
                    {transfer && (
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          transfer.status === 'accepted'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : transfer.status === 'rejected'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        {transfer.status === 'accepted' ? (
                          <>
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>Accepted</span>
                          </>
                        ) : transfer.status === 'rejected' ? (
                          <>
                            <XCircle className="w-3 h-3 text-rose-600" />
                            <span>Rejected</span>
                          </>
                        ) : (
                          <>
                            <Clock className="w-3 h-3 text-amber-600" />
                            <span>Pending</span>
                          </>
                        )}
                      </span>
                    )}
                  </div>
                  <p className="typo-caption text-xs text-zinc-500 mt-0.5">
                    {isFromStore
                      ? 'Outbound Transfer (Origin Store)'
                      : isToStore
                      ? 'Inbound Transfer (Destination Store)'
                      : 'Inter-store transfer details'}
                  </p>
                </div>
              </div>

              {/* Action Buttons based on permissions */}
              <div className="flex flex-wrap items-center gap-2">
                {/* 1. If to_store is this store and status is pending: Allow to change status */}
                {isToStore && isPending && (
                  <>
                    <button
                      type="button"
                      onClick={() => handleResolve('accepted')}
                      disabled={actionLoading}
                      className="ui-btn ui-btn-primary ui-btn-sm px-4 py-2 flex items-center gap-1.5 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer shadow-xs disabled:opacity-50"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{actionLoading ? 'Processing...' : 'Accept Transfer'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleResolve('rejected')}
                      disabled={actionLoading}
                      className="ui-btn ui-btn-outline ui-btn-sm px-4 py-2 flex items-center gap-1.5 text-xs font-bold rounded-lg border-rose-300 text-rose-700 hover:bg-rose-50 cursor-pointer shadow-xs disabled:opacity-50"
                    >
                      <XCircle className="w-4 h-4" />
                      <span>{actionLoading ? 'Processing...' : 'Reject Transfer'}</span>
                    </button>
                  </>
                )}

                {/* 2. If from_store is this store and status is pending: Allow to change everything and save */}
                {isFromStore && isPending && (
                  <>
                    {!isEditing ? (
                      <button
                        type="button"
                        onClick={() => setIsEditing(true)}
                        className="ui-btn ui-btn-outline ui-btn-sm px-4 py-2 flex items-center gap-1.5 text-xs font-bold rounded-lg border-zinc-300 bg-white hover:bg-zinc-100 text-black cursor-pointer shadow-xs"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Edit Transfer</span>
                      </button>
                    ) : (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setIsEditing(false);
                            setRefreshTrigger((v) => v + 1);
                          }}
                          className="ui-btn ui-btn-ghost ui-btn-sm text-xs font-semibold text-zinc-600 hover:text-black"
                        >
                          Cancel Edit
                        </button>
                        <button
                          type="button"
                          onClick={handleSaveEdit}
                          disabled={actionLoading}
                          className="ui-btn ui-btn-primary ui-btn-sm px-4 py-2 flex items-center gap-1.5 text-xs font-bold rounded-lg shadow-xs cursor-pointer"
                        >
                          <Save className="w-3.5 h-3.5" />
                          <span>{actionLoading ? 'Saving...' : 'Save Changes'}</span>
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Success and Error messages */}
            {actionSuccess && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2.5 text-xs text-emerald-800 font-medium">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>{actionSuccess}</span>
              </div>
            )}
            {actionError && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2.5 text-xs text-red-800 font-medium">
                <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                <span>{actionError}</span>
              </div>
            )}

            {loading ? (
              <div className="py-24 text-center">
                <ArrowLeftRight className="w-8 h-8 animate-pulse text-zinc-400 mx-auto mb-3" />
                <p className="text-sm font-medium text-zinc-600">
                  Loading transfer details...
                </p>
              </div>
            ) : errorMsg || !transfer ? (
              <div className="p-8 bg-white border border-zinc-200 rounded-xl text-center shadow-xs">
                <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-3" />
                <h2 className="text-base font-bold text-black mb-1">
                  Transfer Not Found
                </h2>
                <p className="text-xs text-zinc-500 mb-6">
                  {errorMsg || 'The requested transfer record could not be loaded.'}
                </p>
                <Link
                  href="/store/transfers/dashboard"
                  className="ui-btn ui-btn-primary ui-btn-sm px-4 py-2 inline-flex items-center gap-1.5 text-xs font-semibold"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Return to Transfers List</span>
                </Link>
              </div>
            ) : (
              <div className="space-y-6">
                {/* 1. Transfer Header Details Card */}
                <div className="bg-white border border-zinc-200 rounded-xl p-5 shadow-xs space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-zinc-200">
                    <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-700">
                      Transfer Information {isEditing && <span className="text-blue-600">(Editing Mode)</span>}
                    </h2>
                    <span className="text-xs font-mono text-zinc-400">
                      Created: {transfer.created_at ? new Date(transfer.created_at).toLocaleDateString() : '—'}
                    </span>
                  </div>

                  {!isEditing ? (
                    /* Read-Only Header Information */
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      {/* From Store */}
                      <div className="p-3 rounded-lg bg-zinc-50 border border-zinc-200">
                        <span className="block text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
                          From Store (Origin)
                        </span>
                        <div className="mt-1 font-bold text-sm text-black">
                          {transfer.from_store?.name || 'Origin Store'}
                        </div>
                        {transfer.from_store?.store_id && (
                          <div className="text-[11px] font-mono text-zinc-500">
                            Code: {transfer.from_store.store_id}
                          </div>
                        )}
                        {isFromStore && (
                          <span className="inline-block mt-1 text-[10px] font-bold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                            Your Store (Sent)
                          </span>
                        )}
                      </div>

                      {/* To Store */}
                      <div className="p-3 rounded-lg bg-zinc-50 border border-zinc-200">
                        <span className="block text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
                          To Store (Destination)
                        </span>
                        <div className="mt-1 font-bold text-sm text-black">
                          {transfer.to_store?.name || 'Destination Store'}
                        </div>
                        {transfer.to_store?.store_id && (
                          <div className="text-[11px] font-mono text-zinc-500">
                            Code: {transfer.to_store.store_id}
                          </div>
                        )}
                        {isToStore && (
                          <span className="inline-block mt-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                            Your Store (Receiving)
                          </span>
                        )}
                      </div>

                      {/* Date & Staff */}
                      <div className="p-3 rounded-lg bg-zinc-50 border border-zinc-200">
                        <span className="block text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
                          Transfer Date
                        </span>
                        <div className="mt-1 font-bold text-sm text-black flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-zinc-400" />
                          <span>{transfer.date || '—'}</span>
                        </div>
                        <div className="mt-1 text-xs text-zinc-600">
                          Staff: {transfer.staff?.name || 'Direct'}
                        </div>
                      </div>

                      {/* Notes / Resolution */}
                      <div className="p-3 rounded-lg bg-zinc-50 border border-zinc-200">
                        <span className="block text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
                          Status &amp; Notes
                        </span>
                        <div className="mt-1 font-bold text-sm text-black uppercase">
                          {transfer.status}
                        </div>
                        <p className="text-xs text-zinc-500 mt-1 italic line-clamp-2">
                          {transfer.notes || 'No remarks provided.'}
                        </p>
                        {transfer.resolved_at && (
                          <div className="text-[10px] text-zinc-400 mt-1 font-mono">
                            Resolved: {new Date(transfer.resolved_at).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    /* Editable Form Fields (Allowed when from_store is this store and status is pending) */
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      {/* From Store (Static) */}
                      <div>
                        <label className="block text-[11px] font-medium text-zinc-500 mb-1">
                          From Store
                        </label>
                        <input
                          type="text"
                          value={storeName}
                          disabled
                          className="ui-input text-xs text-zinc-700 bg-zinc-100 border border-zinc-300 rounded-md w-full h-9"
                        />
                      </div>

                      {/* Destination Store Dropdown */}
                      <div>
                        <label className="block text-[11px] font-medium text-zinc-500 mb-1">
                          To Store (Destination)
                        </label>
                        <select
                          value={editToStoreId}
                          onChange={(e) => setEditToStoreId(e.target.value)}
                          className="ui-input text-xs text-black border border-zinc-300 focus:border-black rounded-md w-full bg-white h-9"
                        >
                          {otherStores.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name} ({s.store_id})
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Transfer Date */}
                      <div>
                        <label className="block text-[11px] font-medium text-zinc-500 mb-1">
                          Transfer Date
                        </label>
                        <input
                          type="date"
                          value={editDate}
                          onChange={(e) => setEditDate(e.target.value)}
                          className="ui-input text-xs text-black border border-zinc-300 focus:border-black rounded-md w-full bg-white h-9 font-mono"
                        />
                      </div>

                      {/* Staff */}
                      <div>
                        <label className="block text-[11px] font-medium text-zinc-500 mb-1">
                          Staff In-Charge
                        </label>
                        <select
                          value={editStaffId}
                          onChange={(e) => setEditStaffId(e.target.value)}
                          className="ui-input text-xs text-black border border-zinc-300 focus:border-black rounded-md w-full bg-white h-9"
                        >
                          <option value="">No Staff Assigned</option>
                          {staffList.map((st) => (
                            <option key={st.id} value={st.id}>
                              {st.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Notes */}
                      <div className="sm:col-span-2 lg:col-span-4">
                        <label className="block text-[11px] font-medium text-zinc-500 mb-1">
                          Notes / Remarks
                        </label>
                        <input
                          type="text"
                          value={editNotes}
                          onChange={(e) => setEditNotes(e.target.value)}
                          className="ui-input text-xs text-black border border-zinc-300 focus:border-black rounded-md w-full bg-white h-9"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Edit Mode: Add new item to transfer if editing */}
                {isEditing && (
                  <div className="bg-white border border-zinc-200 rounded-xl p-5 shadow-xs space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-700">
                      Add Product Variant from Store Inventory
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                      <div className="sm:col-span-8">
                        <select
                          value={selectedInvVariantId}
                          onChange={(e) => {
                            setSelectedInvVariantId(e.target.value);
                            setItemAddError(null);
                          }}
                          className="ui-input text-xs text-black border border-zinc-300 rounded-md w-full bg-white h-9"
                        >
                          <option value="">-- Choose available variant --</option>
                          {storeInventory.map((inv) => (
                            <option
                              key={inv.product_variant_id}
                              value={inv.product_variant_id}
                            >
                              {inv.product_name} ({inv.prod_id}) • Size: {inv.size} • Color: {inv.color} [Avail: {inv.available_qty}]
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="sm:col-span-2">
                        <input
                          type="number"
                          min="1"
                          value={selectedAddQty}
                          onChange={(e) =>
                            setSelectedAddQty(Math.max(1, parseInt(e.target.value) || 1))
                          }
                          className="ui-input text-xs font-mono font-bold text-center border border-zinc-300 rounded-md w-full bg-white h-9"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <button
                          type="button"
                          onClick={handleAddEditItem}
                          disabled={!selectedInvVariantId}
                          className="ui-btn ui-btn-primary ui-btn-md w-full h-9 text-xs font-bold"
                        >
                          Add Item
                        </button>
                      </div>
                    </div>
                    {itemAddError && (
                      <p className="text-xs text-red-600 font-medium">{itemAddError}</p>
                    )}
                  </div>
                )}

                {/* 2. Store Transfer Items Table */}
                <div className="bg-white border border-zinc-200 rounded-xl shadow-xs overflow-hidden">
                  <div className="px-5 py-3.5 bg-zinc-100 border-b border-zinc-200 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Layers className="w-4 h-4 text-zinc-600" />
                      <h2 className="text-sm font-bold text-black uppercase tracking-wide">
                        Transfer Line Items (
                        {isEditing ? editItems.length : transfer.items?.length || 0})
                      </h2>
                    </div>
                    <span className="text-xs text-zinc-500 font-mono font-semibold">
                      Total Units:{' '}
                      {isEditing
                        ? editItems.reduce((s, it) => s + (it.qty || 1), 0)
                        : (transfer.items || []).reduce((s, it) => s + (it.qty || 1), 0)}{' '}
                      pcs
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-zinc-50 text-zinc-600 text-xs uppercase tracking-wider border-b border-zinc-200">
                          <th className="py-2.5 px-4 font-semibold w-12 text-center">#</th>
                          <th className="py-2.5 px-4 font-semibold">Product &amp; Variant</th>
                          <th className="py-2.5 px-4 font-semibold font-mono text-center w-28">
                            Sent Qty
                          </th>
                          {transfer.status === 'accepted' && (
                            <th className="py-2.5 px-4 font-semibold font-mono text-center w-28">
                              Accepted Qty
                            </th>
                          )}
                          {isEditing && (
                            <th className="py-2.5 px-4 font-semibold text-right w-16">
                              Action
                            </th>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-200 text-sm">
                        {isEditing
                          ? editItems.map((item, index) => (
                              <tr
                                key={item.product_variant_id}
                                className="hover:bg-zinc-50/75"
                              >
                                <td className="py-3 px-4 text-center text-xs text-zinc-400 font-mono">
                                  {index + 1}
                                </td>
                                <td className="py-3 px-4">
                                  <div className="font-semibold text-black">
                                    {item.product_name}
                                  </div>
                                  <div className="flex flex-wrap items-center gap-2 mt-0.5 text-xs text-zinc-500">
                                    <span className="font-mono bg-zinc-100 px-1.5 py-0.5 rounded text-[11px] text-zinc-700">
                                      {item.prod_id}
                                    </span>
                                    {item.barcode && (
                                      <span className="font-mono text-zinc-400 text-[11px]">
                                        BC: {item.barcode}
                                      </span>
                                    )}
                                    <span className="inline-block bg-zinc-100 border border-zinc-200 px-1.5 py-0.5 rounded text-[11px] font-semibold text-black">
                                      Size: {item.size}
                                    </span>
                                    <span className="text-[11px]">{item.color}</span>
                                  </div>
                                </td>
                                <td className="py-3 px-4 text-center">
                                  <input
                                    type="number"
                                    min="1"
                                    value={item.qty}
                                    onChange={(e) => {
                                      const val = Math.max(1, parseInt(e.target.value) || 1);
                                      setEditItems((prev) =>
                                        prev.map((it, i) =>
                                          i === index ? { ...it, qty: val } : it
                                        )
                                      );
                                    }}
                                    className="w-20 text-center font-mono font-bold text-xs py-1 px-2 border border-zinc-300 rounded mx-auto bg-white text-black"
                                  />
                                </td>
                                <td className="py-3 px-4 text-right">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setEditItems((prev) =>
                                        prev.filter((_, i) => i !== index)
                                      )
                                    }
                                    className="text-zinc-400 hover:text-red-600 p-1 cursor-pointer"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </td>
                              </tr>
                            ))
                          : (transfer.items || []).map((item, index) => (
                              <tr key={item.id} className="hover:bg-zinc-50/75">
                                <td className="py-3 px-4 text-center text-xs text-zinc-400 font-mono">
                                  {index + 1}
                                </td>
                                <td className="py-3 px-4">
                                  <div className="font-semibold text-black">
                                    {item.product_name || 'Product'}
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
                                <td className="py-3 px-4 text-center font-mono font-bold text-black">
                                  {item.qty} pcs
                                </td>
                                {transfer.status === 'accepted' && (
                                  <td className="py-3 px-4 text-center font-mono font-bold text-emerald-700">
                                    {item.accepted_qty || item.qty} pcs
                                  </td>
                                )}
                              </tr>
                            ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Edit Mode Save Button bar */}
                {isEditing && (
                  <div className="flex items-center justify-end gap-3 pt-3">
                    <button
                      type="button"
                      onClick={() => {
                        setIsEditing(false);
                        setRefreshTrigger((v) => v + 1);
                      }}
                      className="ui-btn ui-btn-outline ui-btn-md px-4 py-2 text-xs font-semibold"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveEdit}
                      disabled={actionLoading}
                      className="ui-btn ui-btn-primary ui-btn-md px-6 py-2.5 text-xs font-bold flex items-center gap-2"
                    >
                      <Save className="w-4 h-4" />
                      <span>{actionLoading ? 'Saving...' : 'Save Transfer Changes'}</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

export default function StoreOpenTransferPage() {
  return (
    <Suspense
      fallback={
        <div className="layout-page-container layout-flex-center min-h-screen bg-white">
          <p className="typo-body text-zinc-600">Loading transfer...</p>
        </div>
      }
    >
      <OpenTransferContent />
    </Suspense>
  );
}
