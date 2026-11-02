'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowLeftRight,
  Plus,
  Trash2,
  Search,
  Building2,
  Calendar,
  User,
  Save,
  AlertCircle,
  CheckCircle2,
  Package,
  Layers,
  RotateCcw,
} from 'lucide-react';
import { getCurrentSupabaseUser } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import StoreHeader from '@/components/store/header';
import StoreSidebar from '@/components/store/sidebar';
import {
  AvailableStoreProductItem,
  generateRandomTransferId,
  getAvailableStoreInventory,
  createStoreTransfer,
  getDestinationStores,
  getStoreStaffMembers,
} from '@/lib/store/transfersStore';

interface TransferItemDraft {
  product_id: string;
  product_variant_id: string;
  qty: number;
  available_qty: number;
  barcode: string;
  product_name: string;
  prod_id: string;
  size: string;
  color: string;
  color_code?: string;
  category_name?: string;
}

export default function AddStoreTransferPage() {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [currentStoreId, setCurrentStoreId] = useState<string | undefined>(undefined);
  const [storeName, setStoreName] = useState('Store');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Form Fields
  const [transferId, setTransferId] = useState<string>('');
  const [destinationStoreId, setDestinationStoreId] = useState<string>('');
  const [staffId, setStaffId] = useState<string>('');
  const [transferDate, setTransferDate] = useState<string>('');

useEffect(() => {
  const today = new Date().toISOString().split('T')[0];
  setTransferDate(today);
}, []);
  const [notes, setNotes] = useState<string>('');

  // Destination stores & staff list
  const [otherStores, setOtherStores] = useState<{ id: string; name: string; store_id: string }[]>([]);
  const [staffList, setStaffList] = useState<{ id: string; name: string; mobile?: string | null }[]>([]);

  // Inventory available in this store
  const [storeInventory, setStoreInventory] = useState<AvailableStoreProductItem[]>([]);
  const [inventoryLoading, setInventoryLoading] = useState(true);

  // Transfer Items draft list
  const [items, setItems] = useState<TransferItemDraft[]>([]);

  // Add Item Selector State
  const [selectedInventoryId, setSelectedInventoryId] = useState<string>('');
  const [selectedQty, setSelectedQty] = useState<number>(1);
  const [itemSearchText, setItemSearchText] = useState<string>('');
  const [itemError, setItemError] = useState<string | null>(null);

  // Submit states
  const [saving, setSaving] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);

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
          setTransferId(generateRandomTransferId());

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

  // Load stores, staff, and current store's inventory
  useEffect(() => {
    let isMounted = true;

    async function loadFormPrerequisites() {
      if (!currentStoreId) return;

      // 1. Fetch other stores (exclude this store)
      try {
        const stores = await getDestinationStores(currentStoreId);
        if (isMounted && stores) {
          setOtherStores(stores);
          if (stores.length > 0) {
            setDestinationStoreId((prev) => prev || stores[0].id);
          }
        }
      } catch (err) {
        console.warn('Error loading stores:', err);
      }

      // 2. Fetch staff for this store
      try {
        const staffData = await getStoreStaffMembers(currentStoreId);
        if (isMounted && staffData) {
          setStaffList(staffData);
        }
      } catch (err) {
        console.warn('Error loading staff:', err);
      }

      // 3. Fetch available store inventory (own store products with quantity > 0)
      setInventoryLoading(true);
      const { items: invItems } = await getAvailableStoreInventory(currentStoreId);
      if (isMounted) {
        setStoreInventory(invItems);
        setInventoryLoading(false);
      }
    }

    if (isAuthorized && currentStoreId) {
      loadFormPrerequisites();
    }

    return () => {
      isMounted = false;
    };
  }, [isAuthorized, currentStoreId]);

  // Filtered available inventory for selection dropdown
  const filteredInventoryOptions = storeInventory.filter((inv) => {
    // Exclude already added variants from the selection dropdown
    const alreadyAdded = items.some(
      (it) => it.product_variant_id === inv.product_variant_id
    );
    if (alreadyAdded) return false;

    if (!itemSearchText.trim()) return true;
    const q = itemSearchText.toLowerCase();
    return (
      inv.product_name.toLowerCase().includes(q) ||
      inv.prod_id.toLowerCase().includes(q) ||
      inv.barcode.toLowerCase().includes(q) ||
      inv.size.toLowerCase().includes(q) ||
      inv.color.toLowerCase().includes(q)
    );
  });

  const selectedInventoryItem = storeInventory.find(
    (inv) => inv.product_variant_id === selectedInventoryId
  );

  const handleAddItem = () => {
    setItemError(null);
    if (!selectedInventoryId || !selectedInventoryItem) {
      setItemError('Please select a product from store inventory.');
      return;
    }

    if (!selectedQty || selectedQty <= 0) {
      setItemError('Quantity must be at least 1.');
      return;
    }

    if (selectedQty > selectedInventoryItem.available_qty) {
      setItemError(
        `Quantity cannot exceed available stock (${selectedInventoryItem.available_qty} pcs).`
      );
      return;
    }

    const newItem: TransferItemDraft = {
      product_id: selectedInventoryItem.product_id,
      product_variant_id: selectedInventoryItem.product_variant_id,
      qty: selectedQty,
      available_qty: selectedInventoryItem.available_qty,
      barcode: selectedInventoryItem.barcode,
      product_name: selectedInventoryItem.product_name,
      prod_id: selectedInventoryItem.prod_id,
      size: selectedInventoryItem.size,
      color: selectedInventoryItem.color,
      color_code: selectedInventoryItem.color_code,
      category_name: selectedInventoryItem.category_name,
    };

    setItems((prev) => [...prev, newItem]);
    setSelectedInventoryId('');
    setSelectedQty(1);
    setItemSearchText('');
  };

  const handleRemoveItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpdateItemQty = (index: number, newQty: number) => {
    setItems((prev) =>
      prev.map((it, i) => {
        if (i !== index) return it;
        const validQty = Math.max(1, Math.min(newQty, it.available_qty));
        return { ...it, qty: validQty };
      })
    );
  };

  const handleSaveTransfer = async () => {
    setPageError(null);

    if (!destinationStoreId) {
      setPageError('Please select a destination store.');
      return;
    }

    if (destinationStoreId === currentStoreId) {
      setPageError('Destination store must be different from current store.');
      return;
    }

    if (items.length === 0) {
      setPageError('Please add at least one item to transfer.');
      return;
    }

    // Verify all item quantities <= available stock
    for (const it of items) {
      if (it.qty <= 0) {
        setPageError(`Quantity for "${it.product_name}" must be greater than 0.`);
        return;
      }
      if (it.qty > it.available_qty) {
        setPageError(
          `Quantity for "${it.product_name}" (${it.qty}) exceeds available stock (${it.available_qty}).`
        );
        return;
      }
    }

    setSaving(true);

    const result = await createStoreTransfer({
      from_store_id: currentStoreId!,
      to_store_id: destinationStoreId,
      transfer_id: transferId,
      date: transferDate,
      notes: notes.trim() || null,
      staff_id: staffId || null,
      items: items.map((it) => ({
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
      setPageError(result.error?.message || 'Failed to save store transfer.');
      setSaving(false);
      return;
    }

    // Success! Redirect to transfers dashboard
    router.push('/store/transfers/dashboard');
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
        <main className="flex-1 p-4 sm:p-6 md:p-8 w-full max-w-full overflow-x-hidden bg-zinc-50 pb-20">
          <div className="max-w-4xl mx-auto space-y-6">
            {/* Navigation Header */}
            <div className="flex items-center justify-between pb-4 border-b border-zinc-200">
              <div className="flex items-center gap-3">
                <Link
                  href="/store/transfers/dashboard"
                  className="p-2 bg-white rounded-lg border border-zinc-200 hover:bg-zinc-100 text-zinc-700 hover:text-black cursor-pointer shadow-xs transition-colors"
                  title="Back to Transfers"
                >
                  <ArrowLeft className="w-5 h-5" />
                </Link>
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold text-black tracking-tight">
                    Add Store Transfer
                  </h1>
                  <p className="typo-caption text-xs text-zinc-500 mt-0.5">
                    Initiate an outbound stock transfer to another store outlet
                  </p>
                </div>
              </div>

              {/* Status Indicator */}
              <div className="px-3 py-1 bg-amber-50 border border-amber-200 rounded-full text-xs font-semibold text-amber-700">
                Status: Pending
              </div>
            </div>

            {/* Error banner if any */}
            {pageError && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-xs text-red-700">
                <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1 font-medium">{pageError}</div>
              </div>
            )}

            {/* Section 1: Transfer Header Details */}
            <div className="bg-white border border-zinc-200 rounded-xl p-5 shadow-xs space-y-4">
              <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-700 pb-2 border-b border-zinc-200">
                Transfer Details
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Transfer ID (Auto-generated formula: transfer_(5 random digit num)) */}
                <div>
                  <label className="block text-[11px] font-medium text-zinc-500 mb-1">
                    Transfer ID (Auto-Generated)
                  </label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={transferId}
                      readOnly
                      className="ui-input text-xs font-mono font-bold text-black bg-zinc-100 border border-zinc-300 rounded-md w-full h-9 cursor-not-allowed"
                    />
                    <button
                      type="button"
                      onClick={() => setTransferId(generateRandomTransferId())}
                      className="p-2 bg-zinc-100 hover:bg-zinc-200 border border-zinc-200 rounded-md text-zinc-600 cursor-pointer h-9 flex items-center justify-center"
                      title="Re-generate Transfer ID"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* From Store (Will be this store, no edit option) */}
                <div>
                  <label className="block text-[11px] font-medium text-zinc-500 mb-1">
                    From Store (Origin)
                  </label>
                  <input
                    type="text"
                    value={`${storeName} (Current Store)`}
                    disabled
                    className="ui-input text-xs font-semibold text-zinc-800 bg-zinc-100 border border-zinc-300 rounded-md w-full h-9 cursor-not-allowed"
                  />
                </div>

                {/* To Store (Destination Outlet Selection) */}
                <div>
                  <label className="block text-[11px] font-medium text-zinc-500 mb-1">
                    To Store (Destination) <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={destinationStoreId}
                    onChange={(e) => setDestinationStoreId(e.target.value)}
                    className="ui-input text-xs text-black border border-zinc-300 focus:border-black rounded-md w-full bg-white h-9"
                  >
                    {otherStores.length === 0 ? (
                      <option value="">No other stores found</option>
                    ) : (
                      otherStores.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.store_id})
                        </option>
                      ))
                    )}
                  </select>
                </div>

                {/* Transfer Date */}
                <div>
                  <label className="block text-[11px] font-medium text-zinc-500 mb-1">
                    Transfer Date
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
                    <input
                      type="date"
                      value={transferDate}
                      onChange={(e) => setTransferDate(e.target.value)}
                      style={{ paddingLeft: '2.25rem' }}
                      className="ui-input text-xs text-black border border-zinc-300 focus:border-black rounded-md w-full bg-white h-9 font-mono"
                    />
                  </div>
                </div>

                {/* Staff In-Charge (Optional) */}
                <div>
                  <label className="block text-[11px] font-medium text-zinc-500 mb-1">
                    Handled By Staff (Optional)
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
                    <select
                      value={staffId}
                      onChange={(e) => setStaffId(e.target.value)}
                      style={{ paddingLeft: '2.25rem' }}
                      className="ui-input text-xs text-black border border-zinc-300 focus:border-black rounded-md w-full bg-white h-9"
                    >
                      <option value="">Select Staff (Optional)</option>
                      {staffList.map((st) => (
                        <option key={st.id} value={st.id}>
                          {st.name} {st.mobile ? `(${st.mobile})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Notes */}
                <div className="sm:col-span-2 lg:col-span-1">
                  <label className="block text-[11px] font-medium text-zinc-500 mb-1">
                    Notes / Remarks
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g. Rush stock replenishment..."
                    className="ui-input text-xs text-black border border-zinc-300 focus:border-black rounded-md w-full bg-white h-9"
                  />
                </div>
              </div>
            </div>

            {/* Section 2: Add Products from Own Store Inventory */}
            <div className="bg-white border border-zinc-200 rounded-xl p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-zinc-200">
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-zinc-600" />
                  <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-700">
                    Add Items From Current Store Products
                  </h2>
                </div>
                <span className="text-[11px] text-zinc-500">
                  {storeInventory.length} products in current stock
                </span>
              </div>

              {inventoryLoading ? (
                <p className="text-xs text-zinc-500 py-3">Loading store inventory...</p>
              ) : storeInventory.length === 0 ? (
                <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-lg text-center text-xs text-zinc-500">
                  No stock currently available in your store inventory to transfer.
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                    {/* Product Selection */}
                    <div className="sm:col-span-7 lg:col-span-8">
                      <label className="block text-[11px] font-medium text-zinc-500 mb-1">
                        Select Product &amp; Variant from Store Stock
                      </label>
                      <select
                        value={selectedInventoryId}
                        onChange={(e) => {
                          setSelectedInventoryId(e.target.value);
                          setItemError(null);
                          setSelectedQty(1);
                        }}
                        className="ui-input text-xs text-black border border-zinc-300 focus:border-black rounded-md w-full bg-white h-9"
                      >
                        <option value="">-- Choose available product variant --</option>
                        {filteredInventoryOptions.map((inv) => (
                          <option
                            key={inv.product_variant_id}
                            value={inv.product_variant_id}
                          >
                            {inv.product_name} ({inv.prod_id}) • Size: {inv.size} • Color: {inv.color} [Avail: {inv.available_qty} pcs]
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Quantity (<= available quantity) */}
                    <div className="sm:col-span-3 lg:col-span-2">
                      <label className="block text-[11px] font-medium text-zinc-500 mb-1">
                        Quantity {selectedInventoryItem ? `(Max ${selectedInventoryItem.available_qty})` : ''}
                      </label>
                      <input
                        type="number"
                        min="1"
                        max={selectedInventoryItem ? selectedInventoryItem.available_qty : 9999}
                        value={selectedQty}
                        onChange={(e) => setSelectedQty(Math.max(1, parseInt(e.target.value) || 1))}
                        disabled={!selectedInventoryItem}
                        className="ui-input text-xs font-mono font-bold text-black border border-zinc-300 focus:border-black rounded-md w-full bg-white h-9"
                      />
                    </div>

                    {/* Add Item Button */}
                    <div className="sm:col-span-2 flex items-end">
                      <button
                        type="button"
                        onClick={handleAddItem}
                        disabled={!selectedInventoryItem}
                        className="ui-btn ui-btn-primary ui-btn-md w-full h-9 flex items-center justify-center gap-1.5 text-xs font-semibold cursor-pointer disabled:opacity-50"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add</span>
                      </button>
                    </div>
                  </div>

                  {itemError && (
                    <p className="text-xs text-red-600 font-medium">{itemError}</p>
                  )}
                </div>
              )}
            </div>

            {/* Section 3: Selected Transfer Items Table */}
            <div className="bg-white border border-zinc-200 rounded-xl shadow-xs overflow-hidden">
              <div className="px-5 py-3.5 bg-zinc-100 border-b border-zinc-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-zinc-600" />
                  <h2 className="text-xs font-bold uppercase tracking-wider text-black">
                    Selected Transfer Items ({items.length})
                  </h2>
                </div>
                <span className="text-xs text-zinc-600 font-mono font-semibold">
                  Total Units: {items.reduce((s, it) => s + (it.qty || 1), 0)} pcs
                </span>
              </div>

              {items.length === 0 ? (
                <div className="py-12 text-center">
                  <Package className="w-8 h-8 text-zinc-300 mx-auto mb-2" />
                  <p className="text-xs font-medium text-zinc-500">
                    No items added yet. Select products from above to include in transfer.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-zinc-50 text-zinc-600 text-xs uppercase tracking-wider border-b border-zinc-200">
                        <th className="py-2.5 px-4 font-semibold w-12 text-center">#</th>
                        <th className="py-2.5 px-4 font-semibold">Product &amp; Variant</th>
                        <th className="py-2.5 px-4 font-semibold font-mono text-center">Available Stock</th>
                        <th className="py-2.5 px-4 font-semibold font-mono text-center w-32">Transfer Qty</th>
                        <th className="py-2.5 px-4 font-semibold text-right w-16">Remove</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200 text-sm">
                      {items.map((item, index) => (
                        <tr key={item.product_variant_id} className="hover:bg-zinc-50/75">
                          <td className="py-3 px-4 text-center text-xs text-zinc-400 font-mono">
                            {index + 1}
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-semibold text-black text-xs sm:text-sm">
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
                              <span className="inline-flex items-center gap-1 text-[11px]">
                                {item.color_code && (
                                  <span
                                    className="w-2.5 h-2.5 rounded-full border border-zinc-300"
                                    style={{ backgroundColor: item.color_code }}
                                  />
                                )}
                                <span>{item.color}</span>
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-center font-mono text-xs font-semibold text-zinc-600">
                            {item.available_qty} pcs
                          </td>
                          <td className="py-3 px-4 text-center">
                            <input
                              type="number"
                              min="1"
                              max={item.available_qty}
                              value={item.qty}
                              onChange={(e) =>
                                handleUpdateItemQty(index, parseInt(e.target.value) || 1)
                              }
                              className="w-20 text-center font-mono font-bold text-xs py-1 px-2 border border-zinc-300 rounded focus:border-black focus:outline-hidden mx-auto bg-white text-black"
                            />
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(index)}
                              className="text-zinc-400 hover:text-red-600 p-1 cursor-pointer"
                              title="Remove item"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Bottom Actions Bar */}
            <div className="flex items-center justify-between pt-4 border-t border-zinc-200">
              <Link
                href="/store/transfers/dashboard"
                className="ui-btn ui-btn-outline ui-btn-md px-4 py-2 text-xs font-semibold text-zinc-700 border-zinc-300 hover:bg-zinc-100"
              >
                Cancel
              </Link>

              <button
                type="button"
                onClick={handleSaveTransfer}
                disabled={saving || items.length === 0}
                className="ui-btn ui-btn-primary ui-btn-md px-6 py-2.5 flex items-center gap-2 text-xs sm:text-sm font-bold rounded-lg shadow-sm cursor-pointer disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{saving ? 'Saving Transfer...' : 'Save & Initiate Transfer'}</span>
              </button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
