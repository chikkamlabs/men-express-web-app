'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Package,
  Store,
  Calendar,
  Search,
  Plus,
  Trash2,
  AlertCircle,
  Loader2,
  Lock,
  Check,
  Clock,
} from 'lucide-react';
import { getCurrentSupabaseUser } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import AdminHeader from '@/components/admin/header';
import AdminSidebar from '@/components/admin/sidebar';
import { StoreItem, getStores } from '@/lib/stores';
import { Product, getProducts } from '@/lib/productsStore';
import { ProductVariant, getProductVariants } from '@/lib/productVariantsStore';
import {
  createStoreDistribution,
  getUniqueDistributionId,
  CreateDistributionItemInput,
} from '@/lib/storedistributions';

export default function AdminAddStoreDistributionPage() {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Distribution Header States
  const [distributionId, setDistributionId] = useState('');
  const [idLoading, setIdLoading] = useState(true);
  const [distributionDate, setDistributionDate] = useState('');
  const [status] = useState<'pending' | 'accepted'>('pending');

  useEffect(() => {
  const today = new Date().toISOString().split('T')[0];
  setDistributionDate(today);
}, []);

  // Store Selection States
  const [stores, setStores] = useState<StoreItem[]>([]);
  const [selectedStore, setSelectedStore] = useState<StoreItem | null>(null);
  const [storeQuery, setStoreQuery] = useState('');
  const [isStoreDropdownOpen, setIsStoreDropdownOpen] = useState(false);

  // Product & Variant Selection States
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [productQuery, setProductQuery] = useState('');
  const [isProductDropdownOpen, setIsProductDropdownOpen] = useState(false);

  const [productVariants, setProductVariants] = useState<ProductVariant[]>([]);
  const [variantsLoading, setVariantsLoading] = useState(false);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);

  // Item input fields
  const [itemQty, setItemQty] = useState<number | string>('1');
  const [itemError, setItemError] = useState<string | null>(null);

  // Line items list
  const [items, setItems] = useState<CreateDistributionItemInput[]>([]);

  // Submission States
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Auth check
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

  // Initial Data: Generate distribution_id(distribution_(5 random numbers) unique), load stores, load products
  useEffect(() => {
    let ignore = false;
    if (isAuthorized) {
      // 1. Generate unique distribution_id
      getUniqueDistributionId().then((generatedId) => {
        if (!ignore) {
          setDistributionId(generatedId);
          setIdLoading(false);
        }
      });

      // 2. Fetch stores
      getStores().then(({ data }) => {
        if (!ignore && data) {
          setStores(data);
        }
      });

      // 3. Fetch products
      getProducts().then(({ data }) => {
        if (!ignore && data) {
          setProducts(data.filter((p) => p.status));
        }
      });
    }
    return () => {
      ignore = true;
    };
  }, [isAuthorized]);

  // Product Selection handler
  const handleSelectProduct = (p: Product) => {
    setSelectedProduct(p);
    setIsProductDropdownOpen(false);
    setSelectedVariant(null);
    setItemQty('1');
    setItemError(null);
    setVariantsLoading(true);

    getProductVariants(p.id).then(({ data }) => {
      const activeVariants = (data || []).filter((v) => v.status === 'active');
      setProductVariants(activeVariants);
      setVariantsLoading(false);
    });
  };

  const handleClearProduct = () => {
    setSelectedProduct(null);
    setProductQuery('');
    setProductVariants([]);
    setSelectedVariant(null);
    setItemQty('1');
    setItemError(null);
  };

  const handleSelectVariant = (variantId: string) => {
    const found = productVariants.find((v) => v.id === variantId) || null;
    setSelectedVariant(found);
    setItemError(null);
  };

  // Filtered Stores for search
  const filteredStores = useMemo(() => {
    const q = storeQuery.trim().toLowerCase();
    if (!q) return stores;
    return stores.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.store_id.toLowerCase().includes(q) ||
        (s.mobile && s.mobile.includes(q))
    );
  }, [stores, storeQuery]);

  // Filtered Products for search
  const filteredProducts = useMemo(() => {
    const q = productQuery.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.prod_id.toLowerCase().includes(q) ||
        (p.category_name && p.category_name.toLowerCase().includes(q))
    );
  }, [products, productQuery]);

  // Add Item to distribution
  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    setItemError(null);

    if (!selectedProduct) {
      setItemError('Please search and select a product first.');
      return;
    }
    if (!selectedVariant) {
      setItemError('Please select a product variant (size & color).');
      return;
    }

    const qtyNum = Number(itemQty);
    if (isNaN(qtyNum) || qtyNum <= 0 || !Number.isInteger(qtyNum)) {
      setItemError('Quantity must be an integer greater than 0.');
      return;
    }

    // Check if variant already added
    const existingIndex = items.findIndex(
      (it) => it.product_variant_id === selectedVariant.id
    );

    if (existingIndex !== -1) {
      const updated = [...items];
      updated[existingIndex] = {
        ...updated[existingIndex],
        qty: updated[existingIndex].qty + qtyNum,
      };
      setItems(updated);
    } else {
      const newItem: CreateDistributionItemInput = {
        product_id: selectedProduct.id,
        product_variant_id: selectedVariant.id,
        qty: qtyNum,
        barcode: selectedVariant.barcode,
        product_name: selectedProduct.name,
        product_prod_id: selectedProduct.prod_id,
        variant_size: selectedVariant.size_value,
        variant_color: selectedVariant.color_name,
      };
      setItems((prev) => [...prev, newItem]);
    }

    // Reset variant selector
    setSelectedVariant(null);
    setItemQty('1');
  };

  const handleRemoveItem = (variantId: string) => {
    setItems((prev) => prev.filter((it) => it.product_variant_id !== variantId));
  };

  // Submit Store Distribution
  const handleSubmitDistribution = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!distributionId.trim()) {
      setFormError('Distribution ID is missing.');
      return;
    }

    if (!selectedStore) {
      setFormError('Please search and select a target store.');
      return;
    }

    if (!distributionDate) {
      setFormError('Please choose a distribution date.');
      return;
    }

    if (items.length === 0) {
      setFormError('Please add at least one product item to dispatch.');
      return;
    }

    setIsSubmitting(true);

    const { data, error } = await createStoreDistribution({
      store_id: selectedStore.id,
      distribution_id: distributionId.trim(),
      date: distributionDate,
      status: 'pending',
      items,
    });

    setIsSubmitting(false);

    if (error || !data) {
      setFormError(error?.message || 'Failed to save store distribution.');
      return;
    }

    // Redirect to store distributions list
    router.push('/admin/storedistributions');
  };

  const totalQuantity = items.reduce((sum, it) => sum + Number(it.qty || 0), 0);

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
          <div className="max-w-4xl mx-auto space-y-6">
            {/* Back link & Title */}
            <div className="space-y-2">
              <Link
                href="/admin/storedistributions"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-600 hover:text-black transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Store Distributions</span>
              </Link>

              <div className="flex items-center gap-3 pb-4 border-b border-zinc-200">
                <div className="p-2.5 bg-zinc-100 rounded-lg text-black border border-zinc-200">
                  <Package className="w-6 h-6 text-black" />
                </div>
                <div>
                  <h1 className="typo-page-title text-xl sm:text-2xl font-bold text-black tracking-tight">
                    Add Store Distribution
                  </h1>
                  <p className="typo-caption text-xs sm:text-sm text-zinc-500">
                    Allocate and dispatch warehouse inventory stock to a physical retail store branch
                  </p>
                </div>
              </div>
            </div>

            {formError && (
              <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm flex items-start gap-2.5">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-xs">Cannot save distribution</p>
                  <p className="text-xs mt-0.5">{formError}</p>
                </div>
              </div>
            )}

            {/* FORM */}
            <form onSubmit={handleSubmitDistribution} className="space-y-6">
              {/* SECTION 1: Store Distribution Details */}
              <div className="ui-card p-5 sm:p-6 bg-white border border-zinc-200 rounded-lg space-y-4 shadow-xs">
                <div className="flex items-center justify-between pb-3 border-b border-zinc-200">
                  <div className="flex items-center gap-2">
                    <Store className="w-4 h-4 text-black" />
                    <h2 className="text-sm font-bold text-black uppercase tracking-wide">
                      1. Store Distribution Details
                    </h2>
                  </div>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                    <Clock className="w-3 h-3 text-amber-600" />
                    <span>Status: Pending</span>
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Distribution ID: Auto generated distribution_(5 random numbers) unique, read-only */}
                  <div className="ui-form-group mb-0">
                    <label className="ui-form-label font-semibold text-xs text-zinc-700 uppercase tracking-wide mb-1 flex items-center justify-between">
                      <span>Distribution ID</span>
                      <span className="text-[11px] font-normal text-zinc-500 flex items-center gap-1">
                        <Lock className="w-3 h-3 text-zinc-400" />
                        Auto-generated (Unique)
                      </span>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={distributionId}
                        readOnly
                        disabled
                        className="ui-input text-sm font-mono font-bold text-black bg-zinc-100 border border-zinc-300 rounded-md w-full px-3 py-2 cursor-not-allowed select-none"
                      />
                      {idLoading && (
                        <Loader2 className="w-4 h-4 animate-spin text-zinc-400 absolute right-3 top-1/2 -translate-y-1/2" />
                      )}
                    </div>
                    <span className="ui-form-helper text-[11px] text-zinc-500 mt-1 block">
                      Auto-generated format: distribution_(5 random numbers). Unique and non-editable.
                    </span>
                  </div>

                  {/* Distribution Date */}
                  <div className="ui-form-group mb-0">
                    <label className="ui-form-label font-semibold text-xs text-zinc-700 uppercase tracking-wide mb-1 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-zinc-500" />
                      <span>Dispatch Date *</span>
                    </label>
                    <input
                      type="date"
                      value={distributionDate}
                      onChange={(e) => setDistributionDate(e.target.value)}
                      required
                      className="ui-input text-sm text-black bg-white border border-zinc-300 focus:border-black rounded-md w-full px-3 py-2 font-mono"
                    />
                  </div>

                  {/* Target Store: Search & Select */}
                  <div className="ui-form-group sm:col-span-2 mb-0 relative">
                    <label className="ui-form-label font-semibold text-xs text-zinc-700 uppercase tracking-wide mb-1 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Store className="w-3.5 h-3.5 text-zinc-500" />
                        Target Store (Destination) *
                      </span>
                      {selectedStore && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedStore(null);
                            setStoreQuery('');
                          }}
                          className="text-[11px] text-zinc-500 hover:text-black underline cursor-pointer"
                        >
                          Change store
                        </button>
                      )}
                    </label>

                    {selectedStore ? (
                      <div className="p-3 bg-zinc-50 border border-zinc-300 rounded-md flex items-center justify-between">
                        <div>
                          <div className="font-semibold text-sm text-black flex items-center gap-2">
                            <span>{selectedStore.name}</span>
                            <span className="text-xs font-mono px-2 py-0.5 bg-zinc-200 rounded text-zinc-800">
                              {selectedStore.store_id}
                            </span>
                          </div>
                          <div className="text-xs text-zinc-500 mt-0.5 flex items-center gap-3">
                            {selectedStore.address && <span>{selectedStore.address}</span>}
                            {selectedStore.mobile && <span>Mobile: {selectedStore.mobile}</span>}
                          </div>
                        </div>
                        <Check className="w-5 h-5 text-black" />
                      </div>
                    ) : (
                      <div className="relative">
                        <div className="relative">
                          <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                          <input
                            type="text"
                            value={storeQuery}
                            onFocus={() => setIsStoreDropdownOpen(true)}
                            onChange={(e) => {
                              setStoreQuery(e.target.value);
                              setIsStoreDropdownOpen(true);
                            }}
                            placeholder="Search store by name or store_id..."
                            style={{ paddingLeft: '2.25rem' }}
                            className="ui-input text-xs text-black bg-white border border-zinc-300 focus:border-black rounded-md w-full h-10 pr-3"
                          />
                        </div>

                        {/* Store Dropdown */}
                        {isStoreDropdownOpen && (
                          <div className="absolute z-20 left-0 right-0 mt-1 max-h-52 overflow-y-auto bg-white border border-zinc-300 rounded-md shadow-lg divide-y divide-zinc-100">
                            {filteredStores.length === 0 ? (
                              <div className="p-3 text-xs text-zinc-500 text-center">
                                No stores found matching &quot;{storeQuery}&quot;.
                              </div>
                            ) : (
                              filteredStores.map((st) => (
                                <button
                                  key={st.id}
                                  type="button"
                                  onClick={() => {
                                    setSelectedStore(st);
                                    setIsStoreDropdownOpen(false);
                                  }}
                                  className="w-full text-left p-2.5 hover:bg-zinc-100 flex items-center justify-between cursor-pointer transition-colors"
                                >
                                  <div>
                                    <p className="text-xs font-semibold text-black">{st.name}</p>
                                    <p className="text-[11px] text-zinc-500 font-mono">
                                      {st.store_id} {st.address ? `• ${st.address}` : ''}
                                    </p>
                                  </div>
                                </button>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* SECTION 2: Add Items List */}
              <div className="ui-card p-5 sm:p-6 bg-white border border-zinc-200 rounded-lg space-y-4 shadow-xs">
                <div className="flex items-center justify-between pb-3 border-b border-zinc-200">
                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4 text-black" />
                    <h2 className="text-sm font-bold text-black uppercase tracking-wide">
                      2. Add Distribution Items
                    </h2>
                  </div>
                  <span className="text-xs text-zinc-500 font-mono">
                    {items.length} item{items.length === 1 ? '' : 's'} ({totalQuantity} units)
                  </span>
                </div>

                {/* Sub-form: product_id (search and select), product_variant_id (all variants), qty */}
                <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-lg space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Ask product_id (search and select) */}
                    <div className="relative">
                      <label className="block text-[11px] font-medium text-zinc-600 mb-1">
                        Select Product *
                      </label>
                      {selectedProduct ? (
                        <div className="p-2 bg-white border border-zinc-300 rounded-md flex items-center justify-between">
                          <div className="truncate">
                            <span className="font-semibold text-xs text-black block truncate">
                              {selectedProduct.name}
                            </span>
                            <span className="text-[10px] text-zinc-500 font-mono">
                              {selectedProduct.prod_id} {selectedProduct.category_name ? `• ${selectedProduct.category_name}` : ''}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={handleClearProduct}
                            className="text-[11px] text-zinc-500 hover:text-black underline ml-2 flex-shrink-0 cursor-pointer"
                          >
                            Change
                          </button>
                        </div>
                      ) : (
                        <div className="relative">
                          <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                          <input
                            type="text"
                            value={productQuery}
                            onFocus={() => setIsProductDropdownOpen(true)}
                            onChange={(e) => {
                              setProductQuery(e.target.value);
                              setIsProductDropdownOpen(true);
                            }}
                            placeholder="Search product by name or prod_id..."
                            style={{ paddingLeft: '2rem' }}
                            className="ui-input text-xs text-black bg-white border border-zinc-300 focus:border-black rounded-md w-full h-9 pr-3"
                          />

                          {isProductDropdownOpen && (
                            <div className="absolute z-20 left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-white border border-zinc-300 rounded-md shadow-lg divide-y divide-zinc-100">
                              {filteredProducts.length === 0 ? (
                                <div className="p-3 text-xs text-zinc-500 text-center">
                                  No product matches &quot;{productQuery}&quot;.
                                </div>
                              ) : (
                                filteredProducts.map((p) => (
                                  <button
                                    key={p.id}
                                    type="button"
                                    onClick={() => handleSelectProduct(p)}
                                    className="w-full text-left p-2 hover:bg-zinc-100 flex items-center justify-between cursor-pointer"
                                  >
                                    <div>
                                      <p className="text-xs font-semibold text-black">{p.name}</p>
                                      <p className="text-[10px] text-zinc-400 font-mono">
                                        {p.prod_id} {p.category_name ? `• ${p.category_name}` : ''}
                                      </p>
                                    </div>
                                  </button>
                                ))
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Ask product_variant_id (display all variants for selected product) */}
                    <div>
                      <label className="block text-[11px] font-medium text-zinc-600 mb-1">
                        Select Variant (Size &amp; Color) *
                      </label>
                      {!selectedProduct ? (
                        <div className="h-9 px-3 bg-zinc-100 border border-zinc-200 rounded-md text-xs text-zinc-400 flex items-center">
                          Choose a product first...
                        </div>
                      ) : variantsLoading ? (
                        <div className="h-9 px-3 bg-white border border-zinc-300 rounded-md text-xs text-zinc-500 flex items-center gap-2">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Loading variants...</span>
                        </div>
                      ) : productVariants.length === 0 ? (
                        <div className="h-9 px-3 bg-yellow-50 border border-yellow-200 rounded-md text-xs text-yellow-800 flex items-center">
                          No active variants created for this product yet.
                        </div>
                      ) : (
                        <select
                          value={selectedVariant?.id || ''}
                          onChange={(e) => handleSelectVariant(e.target.value)}
                          className="ui-select text-xs text-black bg-white border border-zinc-300 focus:border-black rounded-md w-full h-9"
                        >
                          <option value="">-- Choose Variant SKU --</option>
                          {productVariants.map((v) => (
                            <option key={v.id} value={v.id}>
                              Size: {v.size_value || '—'} | Color: {v.color_name || '—'} | Barcode: {v.barcode} (Warehouse stock: {v.quantity})
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>

                  {/* Ask qty and Add Item button */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-zinc-200">
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-medium text-zinc-600 mb-1">
                        Distribution Quantity (qty) *
                      </label>
                      <input
                        type="number"
                        step="1"
                        min="1"
                        value={itemQty}
                        onChange={(e) => setItemQty(e.target.value)}
                        placeholder="Quantity to dispatch..."
                        className="ui-input text-xs text-black bg-white border border-zinc-300 focus:border-black rounded-md w-full h-9 px-3 font-mono font-bold"
                      />
                    </div>

                    <div className="flex items-end">
                      <button
                        type="button"
                        onClick={handleAddItem}
                        disabled={!selectedProduct || !selectedVariant}
                        className="ui-btn ui-btn-grey ui-btn-md h-9 w-full text-xs font-medium cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed shadow-xs"
                      >
                        <Plus className="w-3.5 h-3.5 text-white" />
                        <span>Add Item</span>
                      </button>
                    </div>
                  </div>

                  {itemError && (
                    <p className="text-xs text-red-600 font-medium">{itemError}</p>
                  )}
                </div>

                {/* Table of added distribution items */}
                <div className="border border-zinc-200 rounded-md overflow-hidden bg-white">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-zinc-100 border-b border-zinc-200 text-zinc-600 uppercase font-semibold">
                        <th className="py-2.5 px-3">Product Name</th>
                        <th className="py-2.5 px-3">Product ID</th>
                        <th className="py-2.5 px-3">Barcode / SKU</th>
                        <th className="py-2.5 px-3">Size</th>
                        <th className="py-2.5 px-3">Color</th>
                        <th className="py-2.5 px-3 text-center">Dispatch Qty</th>
                        <th className="py-2.5 px-3 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200">
                      {items.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-zinc-400">
                            No items added yet. Select product and variant above and click &quot;Add Item&quot;.
                          </td>
                        </tr>
                      ) : (
                        items.map((it) => (
                          <tr key={it.product_variant_id} className="hover:bg-zinc-50">
                            <td className="py-2.5 px-3 font-medium text-black">
                              {it.product_name}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-zinc-500">
                              {it.product_prod_id || '—'}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-zinc-700">
                              {it.barcode || '—'}
                            </td>
                            <td className="py-2.5 px-3 font-mono">
                              <span className="px-1.5 py-0.5 bg-zinc-100 border border-zinc-200 rounded text-[11px]">
                                {it.variant_size || '—'}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-zinc-700">
                              {it.variant_color || '—'}
                            </td>
                            <td className="py-2.5 px-3 text-center font-mono font-bold text-black text-sm">
                              {it.qty}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(it.product_variant_id)}
                                className="text-zinc-400 hover:text-red-600 cursor-pointer p-1"
                                title="Remove item"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    {items.length > 0 && (
                      <tfoot>
                        <tr className="bg-zinc-50 font-bold border-t border-zinc-200 text-black">
                          <td colSpan={5} className="py-2.5 px-3 text-right uppercase text-[11px]">
                            Total Quantity:
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono text-sm">
                            {totalQuantity}
                          </td>
                          <td />
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>

              {/* SAVE BUTTON */}
              <div className="flex items-center justify-between p-4 bg-zinc-50 border border-zinc-200 rounded-lg">
                <Link
                  href="/admin/storedistributions"
                  className="ui-btn ui-btn-outline ui-btn-md text-xs text-black border-zinc-300 hover:bg-zinc-100 cursor-pointer"
                >
                  Cancel
                </Link>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className="block text-[11px] text-zinc-500 uppercase font-medium">
                      Total Items
                    </span>
                    <span className="text-base font-bold font-mono text-black">
                      {items.length} ({totalQuantity} units)
                    </span>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting || items.length === 0 || !selectedStore}
                    className="ui-btn ui-btn-grey ui-btn-md px-6 py-2.5 font-medium text-xs flex items-center gap-2 cursor-pointer shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-white" />
                        <span>Saving Distribution...</span>
                      </>
                    ) : (
                      <span>Save Distribution</span>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </main>
      </div>
    </div>
  );
}
