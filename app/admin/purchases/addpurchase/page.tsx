'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  ShoppingCart,
  Building2,
  Calendar,
  FileText,
  Search,
  Plus,
  Trash2,
  AlertCircle,
  Loader2,
  Lock,
  Check,
  Package,
} from 'lucide-react';
import { getCurrentSupabaseUser } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import AdminHeader from '@/components/admin/header';
import AdminSidebar from '@/components/admin/sidebar';
import {
  Distributor,
  getDistributors,
  recordPurchaseDistributorTransaction,
} from '@/lib/distributorsStore';
import { Product, getProducts } from '@/lib/productsStore';
import { ProductVariant, getProductVariants } from '@/lib/productVariantsStore';
import {
  createPurchase,
  calculateNextPurchaseId,
  getPurchases,
  CreatePurchaseItemInput,
} from '@/lib/purchasesStore';
import AddProductModal from '@/components/admin/addproduct';
import AddProductVariantModal from '@/components/admin/addproductvariant';
import AddDistributorModal from '@/components/admin/adddistributor';
import AddTransactionsModal from '@/components/admin/addtransactions';
import { ProductColor, getProductColors } from '@/lib/productcolorsStore';

export default function AdminAddPurchasePage() {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Form States - Purchase Header
  const [purchaseId, setPurchaseId] = useState('');
  const [idLoading, setIdLoading] = useState(true);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [manualAmount, setManualAmount] = useState('');
  const [purchaseDate, setPurchaseDate] = useState('');

  useEffect(() => {
  const today = new Date().toISOString().split('T')[0];
  setPurchaseDate(today);
}, []);

  // Distributor Selection States
  const [distributors, setDistributors] = useState<Distributor[]>([]);
  const [selectedDistributor, setSelectedDistributor] = useState<Distributor | null>(null);
  const [distributorQuery, setDistributorQuery] = useState('');
  const [isDistributorDropdownOpen, setIsDistributorDropdownOpen] = useState(false);
  const [isAddDistributorModalOpen, setIsAddDistributorModalOpen] = useState(false);

  // Post-purchase Transaction Modal States
  const [isAddTransactionModalOpen, setIsAddTransactionModalOpen] = useState(false);
  const [transactionDistributor, setTransactionDistributor] = useState<Distributor | null>(null);

  // Product & Variant Selection States
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [productQuery, setProductQuery] = useState('');
  const [isProductDropdownOpen, setIsProductDropdownOpen] = useState(false);

  const [productVariants, setProductVariants] = useState<ProductVariant[]>([]);
  const [variantsLoading, setVariantsLoading] = useState(false);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);

  // Modals for adding product and variant on-the-fly
  const [isAddProductModalOpen, setIsAddProductModalOpen] = useState(false);
  const [isAddVariantModalOpen, setIsAddVariantModalOpen] = useState(false);
  const [selectedProductColors, setSelectedProductColors] = useState<ProductColor[]>([]);

  // Item input fields
  const [itemMrp, setItemMrp] = useState<number | string>('');
  const [itemPp, setItemPp] = useState<number | string>('');
  const [itemQty, setItemQty] = useState<number | string>('1');
  const [itemError, setItemError] = useState<string | null>(null);

  // Purchase Items List
  const [items, setItems] = useState<CreatePurchaseItemInput[]>([]);

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

  // Load Initial Data: Generate purchase_id (purchs_101 + 1), load Distributors, load Products
  useEffect(() => {
    let ignore = false;
    if (isAuthorized) {
      // 1. Generate purchase_id
      getPurchases().then(({ data }) => {
        if (!ignore) {
          const nextId = calculateNextPurchaseId(data || []);
          setPurchaseId(nextId);
          setIdLoading(false);
        }
      });

      // 2. Fetch distributors
      getDistributors().then(({ data }) => {
        if (!ignore && data) {
          setDistributors(data.filter((d) => d.status === 'active'));
        }
      });

      // 3. Fetch products
      getProducts().then(({ data }) => {
        if (!ignore && data) {
          setProducts(data);
        }
      });
    }
    return () => {
      ignore = true;
    };
  }, [isAuthorized]);

  // Handle selecting a product: loads variants directly without effect
  const handleSelectProduct = (p: Product) => {
    setSelectedProduct(p);
    setIsProductDropdownOpen(false);
    setSelectedVariant(null);
    setItemMrp('');
    setItemPp('');
    setItemQty('1');
    setItemError(null);
    setVariantsLoading(true);

    getProductVariants(p.id).then(({ data }) => {
      const activeVariants = (data || []).filter((v) => v.status === 'active');
      setProductVariants(activeVariants);
      setVariantsLoading(false);
    });

    getProductColors(p.id).then(({ data }) => {
      setSelectedProductColors(data || []);
    });
  };

  const handleClearProduct = () => {
    setSelectedProduct(null);
    setProductQuery('');
    setProductVariants([]);
    setSelectedProductColors([]);
    setSelectedVariant(null);
    setItemMrp('');
    setItemPp('');
    setItemQty('1');
    setItemError(null);
  };

  const handleDistributorCreated = (newDist: Distributor) => {
    setDistributors((prev) => [newDist, ...prev]);
    setSelectedDistributor(newDist);
    setDistributorQuery('');
    setIsDistributorDropdownOpen(false);
    setIsAddDistributorModalOpen(false);
  };

  const handleProductCreated = (newProd: Product) => {
    setProducts((prev) => [newProd, ...prev]);
    handleSelectProduct(newProd);
    setIsAddProductModalOpen(false);
  };

  const handleOpenAddVariantModal = () => {
    if (!selectedProduct) return;
    getProductColors(selectedProduct.id).then(({ data }) => {
      setSelectedProductColors(data || []);
      setIsAddVariantModalOpen(true);
    });
  };

  const handleVariantCreatedFromModal = (created: ProductVariant | ProductVariant[]) => {
    const createdList = Array.isArray(created) ? created : [created];
    if (createdList.length === 0) return;

    // Update productVariants state
    setProductVariants((prev) => {
      const existingIds = new Set(prev.map((v) => v.id));
      const toAdd = createdList.filter((v) => !existingIds.has(v.id));
      return [...prev, ...toAdd];
    });

    if (createdList.length === 1) {
      const single = createdList[0];
      // Auto select that product for purchase product_variant and fill mrp and other details to the purchase item
      setSelectedVariant(single);
      if (single.mrp !== undefined && single.mrp !== null) {
        setItemMrp(single.mrp);
      }
      if (single.p_p !== undefined && single.p_p !== null) {
        setItemPp(single.p_p);
      }
      if (
        single.quantity !== undefined &&
        single.quantity !== null &&
        Number(single.quantity) > 0
      ) {
        setItemQty(single.quantity);
      } else {
        setItemQty('1');
      }
      setItemError(null);
    } else {
      // If they select multiple product_variants. create multiple rows in the purchase items as well.
      const newPurchaseRows: CreatePurchaseItemInput[] = createdList.map((v) => ({
        product_id: selectedProduct!.id,
        product_variant_id: v.id,
        mrp: Number(v.mrp) || 0,
        p_p: Number(v.p_p) || 0,
        qty: Number(v.quantity) > 0 ? Number(v.quantity) : 1,
        product_name: selectedProduct!.name,
        product_prod_id: selectedProduct!.prod_id,
        variant_barcode: v.barcode,
        variant_size: v.size_value,
        variant_color: v.color_name,
      }));

      setItems((prev) => {
        const updated = [...prev];
        for (const newRow of newPurchaseRows) {
          const idx = updated.findIndex(
            (it) => it.product_variant_id === newRow.product_variant_id
          );
          if (idx !== -1) {
            updated[idx] = {
              ...updated[idx],
              qty: updated[idx].qty + newRow.qty,
              mrp: newRow.mrp,
              p_p: newRow.p_p,
            };
          } else {
            updated.push(newRow);
          }
        }
        return updated;
      });

      // Clear the single item entry form
      setSelectedVariant(null);
      setItemMrp('');
      setItemPp('');
      setItemQty('1');
      setItemError(null);
    }

    setIsAddVariantModalOpen(false);
  };

  // Handle selecting a variant: populates mrp and p_p directly
  const handleSelectVariant = (variantId: string) => {
    const found = productVariants.find((v) => v.id === variantId) || null;
    setSelectedVariant(found);
    if (found) {
      if (found.mrp) setItemMrp(found.mrp);
      if (found.p_p) setItemPp(found.p_p);
      setItemError(null);
    }
  };

  // Calculate sum of items
  const itemsTotal = useMemo(() => {
    return items.reduce((sum, it) => sum + Number(it.p_p) * Number(it.qty), 0);
  }, [items]);

  // Derived effective total amount: manual override if typed, otherwise sum of items
  const isAmountManuallyEdited = manualAmount !== '';
  const effectiveTotalAmount = isAmountManuallyEdited
    ? manualAmount
    : itemsTotal > 0
    ? itemsTotal.toString()
    : '';

  // Filtered Distributors for search
  const filteredDistributors = useMemo(() => {
    const q = distributorQuery.trim().toLowerCase();
    if (!q) return distributors;
    return distributors.filter(
      (d) =>
        d.name.toLowerCase().includes(q) ||
        d.distributor_id.toLowerCase().includes(q) ||
        (d.company && d.company.toLowerCase().includes(q)) ||
        (d.mobile && d.mobile.includes(q))
    );
  }, [distributors, distributorQuery]);

  // Filtered Products for search
  const filteredProducts = useMemo(() => {
  // Only show active products in the purchase dropdown.
  const activeProducts = products.filter((p) => p.status);

  const q = productQuery.trim().toLowerCase();

  if (!q) return activeProducts;

  return activeProducts.filter(
    (p) =>
      p.name.toLowerCase().includes(q) ||
      p.prod_id.toLowerCase().includes(q) ||
      (p.category_name &&
        p.category_name.toLowerCase().includes(q))
  );
}, [products, productQuery]);

  // Add Item to Purchase Items list
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

    const mrpNum = Number(itemMrp);
    const ppNum = Number(itemPp);
    const qtyNum = Number(itemQty);

    if (isNaN(mrpNum) || mrpNum < 0) {
      setItemError('Please enter a valid MRP (>= 0).');
      return;
    }
    if (isNaN(ppNum) || ppNum < 0) {
      setItemError('Please enter a valid purchase price p_p (>= 0).');
      return;
    }
    if (isNaN(qtyNum) || qtyNum <= 0 || !Number.isInteger(qtyNum)) {
      setItemError('Quantity must be an integer greater than 0.');
      return;
    }

    // Check if variant already added to this purchase
    const existingIndex = items.findIndex(
      (it) => it.product_variant_id === selectedVariant.id
    );

    if (existingIndex !== -1) {
      // Update quantity of existing line item
      const updated = [...items];
      updated[existingIndex] = {
        ...updated[existingIndex],
        qty: updated[existingIndex].qty + qtyNum,
        mrp: mrpNum,
        p_p: ppNum,
      };
      setItems(updated);
    } else {
      const newItem: CreatePurchaseItemInput = {
        product_id: selectedProduct.id,
        product_variant_id: selectedVariant.id,
        mrp: mrpNum,
        p_p: ppNum,
        qty: qtyNum,
        product_name: selectedProduct.name,
        product_prod_id: selectedProduct.prod_id,
        variant_barcode: selectedVariant.barcode,
        variant_size: selectedVariant.size_value,
        variant_color: selectedVariant.color_name,
      };
      setItems((prev) => [...prev, newItem]);
    }

    // Reset item form fields
    setSelectedVariant(null);
    setItemMrp('');
    setItemPp('');
    setItemQty('1');
  };

  // Remove item from purchase list
  const handleRemoveItem = (variantId: string) => {
    setItems((prev) => prev.filter((it) => it.product_variant_id !== variantId));
  };

  // Submit complete purchase
  const handleSubmitPurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!purchaseId.trim()) {
      setFormError('Purchase ID is missing.');
      return;
    }

    if (!selectedDistributor) {
      setFormError('Please search and select a distributor.');
      return;
    }

    if (!purchaseDate) {
      setFormError('Please choose a purchase date.');
      return;
    }

    if (items.length === 0) {
      setFormError('Please add at least one purchase item before saving.');
      return;
    }

    const finalAmount =
      effectiveTotalAmount !== '' && !isNaN(Number(effectiveTotalAmount))
        ? Number(effectiveTotalAmount)
        : itemsTotal;

    if (finalAmount < 0) {
      setFormError('Total amount cannot be negative.');
      return;
    }

    setIsSubmitting(true);

    const { data, error } = await createPurchase({
      purchase_id: purchaseId.trim(),
      distributor_id: selectedDistributor.id,
      invoice_number: invoiceNumber.trim() || null,
      total_amount: finalAmount,
      date: purchaseDate,
      items,
    });

    if (error || !data) {
      setIsSubmitting(false);
      setFormError(error?.message || 'Failed to save purchase. Please try again.');
      return;
    }

    // Insert into distributor_transactions with distributor_trans_type(add), type(bill),
    // trans_id(purchaseId), amount(purchase amount), balance(distributors.balance + purchase amount),
    // notes(purchase details) and update distributors.balance
    const purchaseNotes = invoiceNumber.trim()
      ? `Purchase Invoice: ${invoiceNumber.trim()} • ${items.length} item(s)`
      : `Purchase: ${purchaseId.trim()} • ${items.length} item(s)`;

    const { newBalance } = await recordPurchaseDistributorTransaction({
      distributor_id: selectedDistributor.id,
      purchase_id: purchaseId.trim(),
      amount: finalAmount,
      notes: purchaseNotes,
    });

    setIsSubmitting(false);

    // After all the actions until now:
    // Automatically open components/admin/addtransactions.tsx for that distributor to allow recording a debit transaction
    setTransactionDistributor({
      ...selectedDistributor,
      balance:
        typeof newBalance === 'number'
          ? newBalance
          : Number(selectedDistributor.balance || 0) + finalAmount,
    });
    setIsAddTransactionModalOpen(true);
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
                href="/admin/purchases"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-600 hover:text-black transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Purchases</span>
              </Link>

              <div className="flex items-center gap-3 pb-4 border-b border-zinc-200">
                <div className="p-2.5 bg-zinc-100 rounded-lg text-black border border-zinc-200">
                  <ShoppingCart className="w-6 h-6 text-black" />
                </div>
                <div>
                  <h1 className="typo-page-title text-xl sm:text-2xl font-bold text-black tracking-tight">
                    Add Purchase
                  </h1>
                  <p className="typo-caption text-xs sm:text-sm text-zinc-500">
                    Record a new supplier stock purchase invoice and update inventory quantities
                  </p>
                </div>
              </div>
            </div>

            {formError && (
              <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm flex items-start gap-2.5">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-xs">Cannot save purchase</p>
                  <p className="text-xs mt-0.5">{formError}</p>
                </div>
              </div>
            )}

            {/* FORM */}
            <form onSubmit={handleSubmitPurchase} className="space-y-6">
              {/* SECTION 1: Purchase Header Details */}
              <div className="ui-card p-5 sm:p-6 bg-white border border-zinc-200 rounded-lg space-y-4 shadow-xs">
                <div className="flex items-center gap-2 pb-3 border-b border-zinc-200">
                  <FileText className="w-4 h-4 text-black" />
                  <h2 className="text-sm font-bold text-black uppercase tracking-wide">
                    1. Purchase &amp; Invoice Details
                  </h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Purchase ID: Auto-generated (purchs_101 + 1), NOT allowed to edit */}
                  <div className="ui-form-group mb-0">
                    <label className="ui-form-label font-semibold text-xs text-zinc-700 uppercase tracking-wide mb-1 flex items-center justify-between">
                      <span>Purchase ID</span>
                      <span className="text-[11px] font-normal text-zinc-500 flex items-center gap-1">
                        <Lock className="w-3 h-3 text-zinc-400" />
                        Auto-generated (Read-only)
                      </span>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={purchaseId}
                        readOnly
                        disabled
                        className="ui-input text-sm font-mono font-bold text-black bg-zinc-100 border border-zinc-300 rounded-md w-full px-3 py-2 cursor-not-allowed select-none"
                      />
                      {idLoading && (
                        <Loader2 className="w-4 h-4 animate-spin text-zinc-400 absolute right-3 top-1/2 -translate-y-1/2" />
                      )}
                    </div>
                    <span className="ui-form-helper text-[11px] text-zinc-500 mt-1 block">
                      Auto-increments sequentially from purchs_101. Editing is disabled.
                    </span>
                  </div>

                  {/* Purchase Date */}
                  <div className="ui-form-group mb-0">
                    <label className="ui-form-label font-semibold text-xs text-zinc-700 uppercase tracking-wide mb-1 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-zinc-500" />
                      <span>Purchase Date *</span>
                    </label>
                    <input
                      type="date"
                      value={purchaseDate}
                      onChange={(e) => setPurchaseDate(e.target.value)}
                      required
                      className="ui-input text-sm text-black bg-white border border-zinc-300 focus:border-black rounded-md w-full px-3 py-2 font-mono"
                    />
                  </div>

                  {/* Distributor: Search & Select */}
                  <div className="ui-form-group sm:col-span-2 mb-0 relative">
                    <label className="ui-form-label font-semibold text-xs text-zinc-700 uppercase tracking-wide mb-1 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-zinc-500" />
                        Distributor (Supplier) *
                      </span>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => setIsAddDistributorModalOpen(true)}
                          className="text-[11px] font-semibold text-black hover:underline inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Add new Distributor</span>
                        </button>
                        {selectedDistributor && (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedDistributor(null);
                              setDistributorQuery('');
                            }}
                            className="text-[11px] text-zinc-500 hover:text-black underline cursor-pointer"
                          >
                            Change distributor
                          </button>
                        )}
                      </div>
                    </label>

                    {selectedDistributor ? (
                      <div className="p-3 bg-zinc-50 border border-zinc-300 rounded-md flex items-center justify-between">
                        <div>
                          <div className="font-semibold text-sm text-black flex items-center gap-2">
                            <span>{selectedDistributor.name}</span>
                            <span className="text-xs font-mono px-2 py-0.5 bg-zinc-200 rounded text-zinc-800">
                              {selectedDistributor.distributor_id}
                            </span>
                          </div>
                          <div className="text-xs text-zinc-500 mt-0.5 flex items-center gap-3">
                            {selectedDistributor.company && <span>Company: {selectedDistributor.company}</span>}
                            {selectedDistributor.mobile && <span>Mobile: {selectedDistributor.mobile}</span>}
                            <span>Balance: ₹{Number(selectedDistributor.balance || 0).toFixed(2)}</span>
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
                            value={distributorQuery}
                            onFocus={() => setIsDistributorDropdownOpen(true)}
                            onChange={(e) => {
                              setDistributorQuery(e.target.value);
                              setIsDistributorDropdownOpen(true);
                            }}
                            placeholder="Type to search distributor by name, ID, or company..."
                            style={{ paddingLeft: '2.25rem' }}
                            className="ui-input text-xs text-black bg-white border border-zinc-300 focus:border-black rounded-md w-full h-10 pr-3"
                          />
                        </div>

                        {/* Distributor Dropdown */}
                        {isDistributorDropdownOpen && (
                          <div className="absolute z-20 left-0 right-0 mt-1 max-h-56 overflow-y-auto bg-white border border-zinc-300 rounded-md shadow-lg divide-y divide-zinc-100">
                            {filteredDistributors.length === 0 ? (
                              <div className="p-3 text-xs text-zinc-500 text-center">
                                No active distributors found matching &quot;{distributorQuery}&quot;.
                              </div>
                            ) : (
                              filteredDistributors.map((dist) => (
                                <button
                                  key={dist.id}
                                  type="button"
                                  onClick={() => {
                                    setSelectedDistributor(dist);
                                    setIsDistributorDropdownOpen(false);
                                  }}
                                  className="w-full text-left p-2.5 hover:bg-zinc-100 flex items-center justify-between cursor-pointer transition-colors"
                                >
                                  <div>
                                    <p className="text-xs font-semibold text-black">{dist.name}</p>
                                    <p className="text-[11px] text-zinc-500 font-mono">
                                      {dist.distributor_id} {dist.company ? `• ${dist.company}` : ''}
                                    </p>
                                  </div>
                                  <span className="text-xs font-mono text-zinc-600">
                                    ₹{Number(dist.balance || 0).toFixed(2)}
                                  </span>
                                </button>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Invoice Number */}
                  <div className="ui-form-group mb-0">
                    <label className="ui-form-label font-semibold text-xs text-zinc-700 uppercase tracking-wide mb-1 block">
                      Invoice Number
                    </label>
                    <input
                      type="text"
                      value={invoiceNumber}
                      onChange={(e) => setInvoiceNumber(e.target.value)}
                      placeholder="e.g. INV-98234"
                      className="ui-input text-sm text-black bg-white border border-zinc-300 focus:border-black rounded-md w-full px-3 py-2 font-mono"
                    />
                    <span className="ui-form-helper text-[11px] text-zinc-500 mt-1 block">
                      Distributor&apos;s printed bill or invoice reference
                    </span>
                  </div>

                  {/* Total Amount */}
                  <div className="ui-form-group mb-0">
                    <label className="ui-form-label font-semibold text-xs text-zinc-700 uppercase tracking-wide mb-1 flex items-center justify-between">
                      <span>Total Amount (₹) *</span>
                      {itemsTotal > 0 && isAmountManuallyEdited && (
                        <button
                          type="button"
                          onClick={() => setManualAmount('')}
                          className="text-[11px] text-zinc-500 hover:text-black underline cursor-pointer"
                        >
                          Reset to items sum (₹{itemsTotal.toFixed(2)})
                        </button>
                      )}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={effectiveTotalAmount}
                      onChange={(e) => setManualAmount(e.target.value)}
                      placeholder="0.00"
                      required
                      className="ui-input text-sm text-black bg-white border border-zinc-300 focus:border-black rounded-md w-full px-3 py-2 font-mono font-bold"
                    />
                    <span className="ui-form-helper text-[11px] text-zinc-500 mt-1 block">
                      Auto-computes from added items (p_p × qty). You can also edit manually.
                    </span>
                  </div>
                </div>
              </div>

              {/* SECTION 2: Add Purchase Items */}
              <div className="ui-card p-5 sm:p-6 bg-white border border-zinc-200 rounded-lg space-y-4 shadow-xs">
                <div className="flex items-center justify-between pb-3 border-b border-zinc-200">
                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4 text-black" />
                    <h2 className="text-sm font-bold text-black uppercase tracking-wide">
                      2. Add Purchase Items
                    </h2>
                  </div>
                  <span className="text-xs text-zinc-500 font-mono">
                    {items.length} item{items.length === 1 ? '' : 's'} added
                  </span>
                </div>

                {/* Sub-form to select Product, Variant, mrp, p_p, qty */}
                <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-lg space-y-3">
                  <p className="text-xs font-semibold text-black uppercase tracking-wider">
                    Select Product &amp; Variant SKU
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Step 2a: Search and Select Product */}
                    <div className="relative">
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-[11px] font-medium text-zinc-600">
                          Select Product *
                        </label>
                        <button
                          type="button"
                          onClick={() => setIsAddProductModalOpen(true)}
                          className="text-[11px] font-semibold text-black hover:underline inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Add new product</span>
                        </button>
                      </div>
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
                            placeholder="Search product name or prod_id..."
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

                    {/* Step 2b: Ask Product Variant (for selected product_id) */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-[11px] font-medium text-zinc-600">
                          Select Variant (Size &amp; Color) *
                        </label>
                        {selectedProduct && (
                          <button
                            type="button"
                            onClick={handleOpenAddVariantModal}
                            className="text-[11px] font-semibold text-black hover:underline inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Plus className="w-3 h-3" />
                            <span>Add new variant</span>
                          </button>
                        )}
                      </div>
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
                        <div className="h-9 px-3 bg-yellow-50 border border-yellow-200 rounded-md text-xs text-yellow-800 flex items-center justify-between">
                          <span>No active variants created for this product yet.</span>
                          <button
                            type="button"
                            onClick={handleOpenAddVariantModal}
                            className="font-bold underline text-black cursor-pointer text-xs ml-2 flex-shrink-0"
                          >
                            + Add new variant
                          </button>
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
                              Size: {v.size_value || '—'} | Color: {v.color_name || '—'} | Barcode: {v.barcode} (Current stock: {v.quantity})
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>

                  {/* Step 2c: Ask MRP, P_P, QTY */}
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2 border-t border-zinc-200">
                    <div>
                      <label className="block text-[11px] font-medium text-zinc-600 mb-1">
                        MRP (₹) *
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={itemMrp}
                        onChange={(e) => setItemMrp(e.target.value)}
                        placeholder="e.g. 999.00"
                        className="ui-input text-xs text-black bg-white border border-zinc-300 focus:border-black rounded-md w-full h-9 px-2.5 font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-zinc-600 mb-1">
                        Purchase Price (p_p) (₹) *
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={itemPp}
                        onChange={(e) => setItemPp(e.target.value)}
                        placeholder="e.g. 450.00"
                        className="ui-input text-xs text-black bg-white border border-zinc-300 focus:border-black rounded-md w-full h-9 px-2.5 font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-zinc-600 mb-1">
                        Quantity (qty) *
                      </label>
                      <input
                        type="number"
                        step="1"
                        min="1"
                        value={itemQty}
                        onChange={(e) => setItemQty(e.target.value)}
                        placeholder="1"
                        className="ui-input text-xs text-black bg-white border border-zinc-300 focus:border-black rounded-md w-full h-9 px-2.5 font-mono"
                      />
                    </div>

                    <div className="flex items-end">
                      <button
                        type="button"
                        onClick={handleAddItem}
                        disabled={!selectedProduct || !selectedVariant}
                        className="ui-btn ui-btn-grey ui-btn-md h-9 w-full text-xs font-medium cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
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

                {/* Table of added purchase items */}
                <div className="border border-zinc-200 rounded-md overflow-hidden bg-white">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-zinc-100 border-b border-zinc-200 text-zinc-600 uppercase font-semibold">
                        <th className="py-2.5 px-3">Product Name</th>
                        <th className="py-2.5 px-3">Barcode / SKU</th>
                        <th className="py-2.5 px-3">Size</th>
                        <th className="py-2.5 px-3">Color</th>
                        <th className="py-2.5 px-3 text-right">MRP (₹)</th>
                        <th className="py-2.5 px-3 text-right">P_P (₹)</th>
                        <th className="py-2.5 px-3 text-center">Qty</th>
                        <th className="py-2.5 px-3 text-right">Subtotal (₹)</th>
                        <th className="py-2.5 px-3 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200">
                      {items.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="py-8 text-center text-zinc-400">
                            No items added yet. Select a product and variant above and click &quot;Add Item&quot;.
                          </td>
                        </tr>
                      ) : (
                        items.map((it) => {
                          const subtotal = Number(it.p_p) * Number(it.qty);
                          return (
                            <tr key={it.product_variant_id} className="hover:bg-zinc-50">
                              <td className="py-2.5 px-3 font-medium text-black">
                                {it.product_name}
                                <span className="block text-[10px] text-zinc-400 font-mono">
                                  {it.product_prod_id}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 font-mono text-zinc-600">
                                {it.variant_barcode || '—'}
                              </td>
                              <td className="py-2.5 px-3 font-mono">
                                <span className="px-1.5 py-0.5 bg-zinc-100 border border-zinc-200 rounded text-[11px]">
                                  {it.variant_size || '—'}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-zinc-700">
                                {it.variant_color || '—'}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono text-zinc-600">
                                ₹{Number(it.mrp).toFixed(2)}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono text-black font-semibold">
                                ₹{Number(it.p_p).toFixed(2)}
                              </td>
                              <td className="py-2.5 px-3 text-center font-mono font-bold text-black">
                                {it.qty}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-black">
                                ₹{subtotal.toFixed(2)}
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
                          );
                        })
                      )}
                    </tbody>
                    {items.length > 0 && (
                      <tfoot>
                        <tr className="bg-zinc-50 font-bold border-t border-zinc-200 text-black">
                          <td colSpan={6} className="py-2.5 px-3 text-right uppercase text-[11px]">
                            Items Total:
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono">
                            {items.reduce((acc, it) => acc + Number(it.qty), 0)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-sm">
                            ₹{itemsTotal.toFixed(2)}
                          </td>
                          <td />
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>

              {/* SAVE BUTTON & SUBMISSION */}
              <div className="flex items-center justify-between p-4 bg-zinc-50 border border-zinc-200 rounded-lg">
                <Link
                  href="/admin/purchases"
                  className="ui-btn ui-btn-outline ui-btn-md text-xs text-black border-zinc-300 hover:bg-zinc-100 cursor-pointer"
                >
                  Cancel
                </Link>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className="block text-[11px] text-zinc-500 uppercase font-medium">
                      Total Invoice Amount
                    </span>
                    <span className="text-base font-bold font-mono text-black">
                      ₹
                      {Number(
                        effectiveTotalAmount !== '' && !isNaN(Number(effectiveTotalAmount))
                          ? effectiveTotalAmount
                          : itemsTotal
                      ).toFixed(2)}
                    </span>
                  </div>

                  {/* Save button */}
                  <button
                    type="submit"
                    disabled={isSubmitting || items.length === 0 || !selectedDistributor}
                    className="ui-btn ui-btn-grey ui-btn-md px-6 py-2.5 font-medium text-xs flex items-center gap-2 cursor-pointer shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-white" />
                        <span>Saving Purchase...</span>
                      </>
                    ) : (
                      <>
                        <span>Save Purchase</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </main>
      </div>

      {/* Add Product Modal */}
      {isAddProductModalOpen && (
        <AddProductModal
          isOpen={isAddProductModalOpen}
          onClose={() => setIsAddProductModalOpen(false)}
          productsCount={products.length}
          existingProducts={products}
          onProductCreated={handleProductCreated}
        />
      )}

      {/* Add Product Variant Modal */}
      {isAddVariantModalOpen && selectedProduct && (
        <AddProductVariantModal
          isOpen={isAddVariantModalOpen}
          onClose={() => setIsAddVariantModalOpen(false)}
          productId={selectedProduct.id}
          productColors={selectedProductColors}
          existingVariants={productVariants}
          onVariantCreated={handleVariantCreatedFromModal}
          onProductColorCreated={(newPC) =>
            setSelectedProductColors((prev) => {
              if (prev.some((c) => c.id === newPC.id)) return prev;
              return [...prev, newPC];
            })
          }
        />
      )}

      {/* Add Distributor Modal */}
      {isAddDistributorModalOpen && (
        <AddDistributorModal
          isOpen={isAddDistributorModalOpen}
          onClose={() => setIsAddDistributorModalOpen(false)}
          distributorsCount={distributors.length}
          existingDistributors={distributors}
          onDistributorCreated={handleDistributorCreated}
        />
      )}

      {/* Add Transaction Modal after Save Purchase */}
      {isAddTransactionModalOpen && transactionDistributor && (
        <AddTransactionsModal
          isOpen={isAddTransactionModalOpen}
          distributor={transactionDistributor}
          onClose={() => {
            setIsAddTransactionModalOpen(false);
            router.push('/admin/purchases');
          }}
          onTransactionAdded={() => {
            setIsAddTransactionModalOpen(false);
            router.push('/admin/purchases');
          }}
        />
      )}
    </div>
  );
}
