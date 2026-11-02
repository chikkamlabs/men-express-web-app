'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Search,
  Scan,
  User,
  Plus,
  Trash2,
  Printer,
  Save,
  FileText,
  Check,
  AlertCircle,
  X,
  CreditCard,
  Banknote,
  Smartphone,
  Layers,
  ChevronDown,
} from 'lucide-react';
import { getCurrentSupabaseUser } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import StoreHeader from '@/components/store/header';
import StoreSidebar from '@/components/store/sidebar';
import {
  BillProductSearchResult,
  SelectedBillItem,
  CustomerOption,
  PaymentBreakdown,
  searchStoreInventory,
  searchCustomers,
  quickCreateCustomer,
  saveStoreBill,
} from '@/lib/createbillStore';

export default function CreateBillPage() {
  const router = useRouter();

  // Auth & Store states
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [currentStoreId, setCurrentStoreId] = useState<string | undefined>(undefined);
  const [storeName, setStoreName] = useState('Store');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Search & Products states
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<BillProductSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchDropdownIndex, setSearchDropdownIndex] = useState(0);

  // Selected Bill Items
  const [selectedItems, setSelectedItems] = useState<SelectedBillItem[]>([]);

  // Customer Section States
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [customerResults, setCustomerResults] = useState<CustomerOption[]>([]);
  const [customerDropdownIndex, setCustomerDropdownIndex] = useState(0);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerOption | null>(null);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [quickName, setQuickName] = useState('');
  const [quickMobile, setQuickMobile] = useState('');
  const [quickPoints, setQuickPoints] = useState('0');
  const [quickError, setQuickError] = useState<string | null>(null);

  // Payments & Totals
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [payments, setPayments] = useState<PaymentBreakdown>({
    cash: 0,
    upi: 0,
    card: 0,
  });

  // Saving / Printing States
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [completedBill, setCompletedBill] = useState<{ billId: string; shouldPrint: boolean } | null>(null);

  // Input & Button Refs for smooth keyboard transitions
  const productSearchInputRef = useRef<HTMLInputElement>(null);
  const qtyInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});
  const spInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});
  const customerSearchInputRef = useRef<HTMLInputElement>(null);
  const discountInputRef = useRef<HTMLInputElement>(null);
  const cashInputRef = useRef<HTMLInputElement>(null);
  const upiInputRef = useRef<HTMLInputElement>(null);
  const cardInputRef = useRef<HTMLInputElement>(null);
  const savePrintBtnRef = useRef<HTMLButtonElement>(null);

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
              if (data?.name) resolvedName = data.name;
            } catch {
              // Ignore
            }
          }
          if (!resolvedName && user.email) {
            resolvedName = user.email.split('@')[0];
          }
          if (resolvedName) setStoreName(resolvedName);

          setAuthLoading(false);
        } else {
          router.replace('/login');
        }
      } catch {
        if (isMounted) router.replace('/login');
      }
    }

    checkAuth();
    return () => {
      isMounted = false;
    };
  }, [router]);

  // Initial focus on product search when page loads
  useEffect(() => {
    if (!authLoading && isAuthorized) {
      setTimeout(() => {
        productSearchInputRef.current?.focus();
      }, 150);
    }
  }, [authLoading, isAuthorized]);

  // Product Search Debounce
  useEffect(() => {
    let ignore = false;
    const trimmed = searchQuery.trim();
    if (!trimmed) return;

    const timer = setTimeout(async () => {
      setIsSearching(true);
      const results = await searchStoreInventory(trimmed, currentStoreId);
      if (!ignore) {
        setSearchResults(results);
        setSearchDropdownIndex(0);
        setIsSearching(false);
      }
    }, 200);

    return () => {
      ignore = true;
      clearTimeout(timer);
    };
  }, [searchQuery, currentStoreId]);

  // Customer Search Debounce
  useEffect(() => {
    let ignore = false;
    const trimmed = customerSearchQuery.trim();
    if (!trimmed || selectedCustomer) return;

    const timer = setTimeout(async () => {
      const res = await searchCustomers(trimmed);
      if (!ignore) {
        setCustomerResults(res);
        setCustomerDropdownIndex(0);
      }
    }, 200);

    return () => {
      ignore = true;
      clearTimeout(timer);
    };
  }, [customerSearchQuery, selectedCustomer]);

  // Calculations
  const subtotal = selectedItems.reduce((sum, item) => sum + Number(item.row_total || 0), 0);
  const totalAmount = Math.max(0, subtotal - Number(discountAmount || 0));

  // Add Product to selected list
  const handleSelectProduct = (product: BillProductSearchResult) => {
    const tempId = `line-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const newQty = 1;
    const newRowTotal = Number(product.s_p) * newQty;

    const newItem: SelectedBillItem = {
      id: tempId,
      product_id: product.product_id,
      prod_id: product.prod_id,
      product_name: product.product_name,
      variant_id: product.variant_id,
      barcode: product.barcode,
      size: product.size,
      color: product.color,
      color_code: product.color_code,
      mrp: product.mrp,
      s_p: product.s_p,
      quantity: newQty,
      row_total: newRowTotal,
      allVariants: product.allVariants,
    };

    setSelectedItems((prev) => [...prev, newItem]);
    setSearchQuery('');
    setSearchResults([]);

    // Immediately focus on quantity input of the newly added item
    setTimeout(() => {
      qtyInputRefs.current[tempId]?.focus();
      qtyInputRefs.current[tempId]?.select();
    }, 50);
  };

  // Change quantity for a line item
  const handleQtyChange = (id: string, qtyStr: string) => {
    const val = parseInt(qtyStr, 10);
    const qty = isNaN(val) || val < 1 ? 1 : val;

    setSelectedItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const rowTotal = item.s_p * qty;
          return { ...item, quantity: qty, row_total: rowTotal };
        }
        return item;
      })
    );
  };

  // Change selling price for a line item
  const handleSpChange = (id: string, spStr: string) => {
    const val = parseFloat(spStr);
    const sp = isNaN(val) || val < 0 ? 0 : val;

    setSelectedItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const rowTotal = sp * item.quantity;
          return { ...item, s_p: sp, row_total: rowTotal };
        }
        return item;
      })
    );
  };

  // Switch variant for a line item
  const handleVariantSwitch = (id: string, newVariantId: string) => {
    setSelectedItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const chosen = item.allVariants.find((v) => v.variant_id === newVariantId);
          if (chosen) {
            const newSp = chosen.s_p || item.s_p;
            return {
              ...item,
              variant_id: chosen.variant_id,
              barcode: chosen.barcode,
              size: chosen.size,
              color: chosen.color,
              color_code: chosen.color_code,
              mrp: chosen.mrp,
              s_p: newSp,
              row_total: newSp * item.quantity,
            };
          }
        }
        return item;
      })
    );
  };

  // Remove item
  const handleRemoveItem = (id: string) => {
    setSelectedItems((prev) => prev.filter((it) => it.id !== id));
  };

  // Keyboard navigation on Product Search input
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (searchResults.length === 0) {
      if (e.key === 'Enter' && selectedItems.length > 0) {
        e.preventDefault();
        customerSearchInputRef.current?.focus();
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSearchDropdownIndex((prev) => (prev + 1) % searchResults.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSearchDropdownIndex((prev) => (prev - 1 + searchResults.length) % searchResults.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (searchResults[searchDropdownIndex]) {
        handleSelectProduct(searchResults[searchDropdownIndex]);
      }
    } else if (e.key === 'Escape') {
      setSearchResults([]);
    }
  };

  // Table arrow navigation: Quantity & Selling Price
  const handleTableKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    rowIndex: number,
    field: 'qty' | 'sp'
  ) => {
    const totalRows = selectedItems.length;
    const currentId = selectedItems[rowIndex]?.id;

    if (field === 'qty') {
      if (e.key === 'Enter' || e.key === 'ArrowRight') {
        e.preventDefault();
        spInputRefs.current[currentId]?.focus();
        spInputRefs.current[currentId]?.select();
      } else if (e.key === 'ArrowUp' && rowIndex > 0) {
        e.preventDefault();
        const prevId = selectedItems[rowIndex - 1]?.id;
        qtyInputRefs.current[prevId]?.focus();
        qtyInputRefs.current[prevId]?.select();
      } else if (e.key === 'ArrowDown' && rowIndex < totalRows - 1) {
        e.preventDefault();
        const nextId = selectedItems[rowIndex + 1]?.id;
        qtyInputRefs.current[nextId]?.focus();
        qtyInputRefs.current[nextId]?.select();
      }
    } else if (field === 'sp') {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        qtyInputRefs.current[currentId]?.focus();
        qtyInputRefs.current[currentId]?.select();
      } else if (e.key === 'ArrowUp' && rowIndex > 0) {
        e.preventDefault();
        const prevId = selectedItems[rowIndex - 1]?.id;
        spInputRefs.current[prevId]?.focus();
        spInputRefs.current[prevId]?.select();
      } else if (e.key === 'ArrowDown' && rowIndex < totalRows - 1) {
        e.preventDefault();
        const nextId = selectedItems[rowIndex + 1]?.id;
        spInputRefs.current[nextId]?.focus();
        spInputRefs.current[nextId]?.select();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (rowIndex === totalRows - 1) {
          // If in last product selling price, Enter navigates to Customer Section (top right)
          customerSearchInputRef.current?.focus();
        } else {
          // Next item quantity
          const nextId = selectedItems[rowIndex + 1]?.id;
          qtyInputRefs.current[nextId]?.focus();
          qtyInputRefs.current[nextId]?.select();
        }
      }
    }
  };

  // Customer dropdown arrow & enter navigation
  const handleCustomerKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (customerResults.length === 0) {
      if (e.key === 'Enter') {
        e.preventDefault();
        // Move to payment section (discount input)
        discountInputRef.current?.focus();
        discountInputRef.current?.select();
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setCustomerDropdownIndex((prev) => (prev + 1) % customerResults.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setCustomerDropdownIndex((prev) => (prev - 1 + customerResults.length) % customerResults.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (customerResults[customerDropdownIndex]) {
        setSelectedCustomer(customerResults[customerDropdownIndex]);
        setCustomerSearchQuery('');
        setCustomerResults([]);
        // Move to payment discount input
        setTimeout(() => {
          discountInputRef.current?.focus();
          discountInputRef.current?.select();
        }, 50);
      }
    }
  };

  // Quick Add Customer Submission
  const handleQuickAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickMobile.trim()) {
      setQuickError('Please enter a valid mobile number');
      return;
    }

    const { customer, error } = await quickCreateCustomer(
      quickName,
      quickMobile,
      parseInt(quickPoints, 10) || 0
    );

    if (error || !customer) {
      setQuickError(error?.message || 'Could not add customer');
      return;
    }

    setSelectedCustomer(customer);
    setIsQuickAddOpen(false);
    setQuickName('');
    setQuickMobile('');
    setQuickPoints('0');
    setQuickError(null);

    // Auto-focus to payment section (discount input)
    setTimeout(() => {
      discountInputRef.current?.focus();
      discountInputRef.current?.select();
    }, 50);
  };

  // Discount input Enter key moves to Cash input
  const handleDiscountKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      cashInputRef.current?.focus();
      cashInputRef.current?.select();
    }
  };

  // Payment navigation (Cash -> UPI -> Card -> Save & Print)
  const handlePaymentKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    type: 'cash' | 'upi' | 'card'
  ) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (type === 'cash') upiInputRef.current?.focus();
      if (type === 'upi') cardInputRef.current?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (type === 'card') upiInputRef.current?.focus();
      if (type === 'upi') cashInputRef.current?.focus();
      if (type === 'cash') discountInputRef.current?.focus();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (type === 'cash') {
        upiInputRef.current?.focus();
        upiInputRef.current?.select();
      } else if (type === 'upi') {
        cardInputRef.current?.focus();
        cardInputRef.current?.select();
      } else if (type === 'card') {
        savePrintBtnRef.current?.focus();
      }
    }
  };

  // Save / Finalize Bill
  const handleSaveBill = async (status: 'draft' | 'success', shouldPrint: boolean = false) => {
    if (selectedItems.length === 0) {
      setStatusMessage({ type: 'error', text: 'Please add at least one product to the bill.' });
      return;
    }

    setIsSubmitting(true);
    setStatusMessage(null);

    const finalCash =
      payments.cash > 0
        ? payments.cash
        : payments.upi === 0 && payments.card === 0
        ? totalAmount
        : 0;

    const result = await saveStoreBill({
      store_id: currentStoreId || '',
      customer_id: selectedCustomer?.id || null,
      items: selectedItems,
      subtotal,
      discount: discountAmount,
      final_amount: totalAmount,
      status,
      payments: {
        cash: finalCash,
        upi: payments.upi,
        card: payments.card,
      },
    });

    setIsSubmitting(false);

    if (!result.success) {
      setStatusMessage({ type: 'error', text: result.error?.message || 'Failed to save bill' });
    } else {
      setStatusMessage({
        type: 'success',
        text: `Bill ${result.billId} ${status === 'draft' ? 'saved as draft' : 'completed successfully'}!`,
      });
      setCompletedBill({ billId: result.billId, shouldPrint });
      if (shouldPrint) {
        setTimeout(() => {
          window.print();
        }, 500);
      }
    }
  };

  // Reset for new bill
  const handleNewBill = () => {
    setSelectedItems([]);
    setSelectedCustomer(null);
    setDiscountAmount(0);
    setPayments({ cash: 0, upi: 0, card: 0 });
    setStatusMessage(null);
    setCompletedBill(null);
    productSearchInputRef.current?.focus();
  };

  if (authLoading) {
    return (
      <div className="layout-page-container layout-flex-center min-h-screen bg-white">
        <p className="typo-body text-zinc-600">Loading Billing POS...</p>
      </div>
    );
  }

  if (!isAuthorized) {
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col bg-white w-full max-w-full overflow-x-hidden">
      {/* On top Header covers everything */}
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
        <main className="flex-1 p-3 sm:p-5 md:p-6 w-full max-w-full overflow-x-hidden bg-zinc-50">
          <div className="max-w-7xl mx-auto space-y-4">
            {/* Header row with Back button and Title */}
            <div className="flex items-center justify-between pb-3 border-b border-zinc-200">
              <div className="flex items-center gap-3">
                <Link
                  href="/store/dashboard"
                  className="p-2 bg-white rounded-lg border border-zinc-200 text-black hover:bg-zinc-100 transition-colors cursor-pointer"
                  title="Back to Dashboard"
                >
                  <ArrowLeft className="w-4 h-4 text-black" />
                </Link>
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold text-black tracking-tight flex items-center gap-2">
                    <span>Create Bill</span>
                  </h1>
                  <p className="text-xs text-zinc-500">
                    Fast POS Billing with barcode scanning and arrow key navigation
                  </p>
                </div>
              </div>

              {completedBill && (
                <button
                  type="button"
                  onClick={handleNewBill}
                  className="ui-btn ui-btn-outline ui-btn-sm text-xs font-semibold px-3 py-1.5"
                >
                  + New Bill
                </button>
              )}
            </div>

            {/* Notification alert */}
            {statusMessage && (
              <div
                className={`p-3 rounded-lg border text-xs sm:text-sm flex items-center justify-between ${
                  statusMessage.type === 'success'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-red-50 border-red-200 text-red-800'
                }`}
              >
                <div className="flex items-center gap-2">
                  {statusMessage.type === 'success' ? (
                    <Check className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-red-600" />
                  )}
                  <span>{statusMessage.text}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setStatusMessage(null)}
                  className="text-zinc-500 hover:text-black cursor-pointer text-xs"
                >
                  Dismiss
                </button>
              </div>
            )}

            {/* Main POS Grid: Left column (Products & Table) + Right column (Customer, Payments, Actions) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
              {/* LEFT COLUMN: Search & Product Items Table (8 cols on lg) */}
              <div className="lg:col-span-8 space-y-4">
                {/* Search Bar / Barcode Input */}
                <div className="bg-white border border-zinc-200 rounded-xl p-3 sm:p-4 shadow-xs relative">
                  <label className="block text-xs font-semibold text-zinc-700 mb-1.5 flex items-center gap-1.5">
                    <Search className="w-3.5 h-3.5 text-zinc-500" />
                    <span>Scan Barcode or Search Product (Name, ID, Barcode)</span>
                  </label>

                  <div className="flex items-center gap-2 relative">
                    <div className="relative flex-1">
                      <input
                        ref={productSearchInputRef}
                        type="text"
                        value={searchQuery}
                        onChange={(e) => {
                          const val = e.target.value;
                          setSearchQuery(val);
                          if (!val.trim()) {
                            setSearchResults([]);
                            setIsSearching(false);
                          }
                        }}
                        onKeyDown={handleSearchKeyDown}
                        placeholder="Scan barcode or type product name/ID (Enter to select)..."
                        className="ui-input h-11 text-sm font-mono border-zinc-300 focus:border-black rounded-lg w-full bg-white pr-9"
                        autoComplete="off"
                      />
                      {searchQuery && (
                        <button
                          type="button"
                          onClick={() => {
                            setSearchQuery('');
                            setSearchResults([]);
                            productSearchInputRef.current?.focus();
                          }}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-black cursor-pointer"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => productSearchInputRef.current?.focus()}
                      className="ui-btn ui-btn-primary h-11 px-4 text-xs sm:text-sm font-semibold flex items-center gap-2 rounded-lg cursor-pointer"
                      title="Ready for barcode scanner"
                    >
                      <Scan className="w-4 h-4 text-white" />
                      <span>Scan</span>
                    </button>
                  </div>

                  {/* Dropdown results */}
                  {searchResults.length > 0 && (
                    <div className="absolute left-3 right-3 top-full mt-1.5 bg-white border border-zinc-300 rounded-xl shadow-xl z-40 max-h-72 overflow-y-auto divide-y divide-zinc-100">
                      {searchResults.map((prod, idx) => (
                        <button
                          key={`${prod.product_id}-${prod.variant_id}-${idx}`}
                          type="button"
                          onClick={() => handleSelectProduct(prod)}
                          className={`w-full text-left p-3 flex items-center justify-between text-xs transition-colors cursor-pointer ${
                            idx === searchDropdownIndex ? 'bg-zinc-100 text-black font-semibold' : 'hover:bg-zinc-50 text-zinc-800'
                          }`}
                        >
                          <div className="space-y-0.5">
                            <div className="font-semibold text-sm text-black">
                              {prod.product_name}
                            </div>
                            <div className="text-zinc-500 font-mono text-[11px] flex items-center gap-2">
                              <span>Code: {prod.prod_id}</span>
                              <span>•</span>
                              <span>Barcode: {prod.barcode || '—'}</span>
                              <span>•</span>
                              <span className="font-medium text-black">
                                Stock: {prod.stock} in store
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 text-[11px] text-zinc-600">
                              <span className="bg-zinc-200/80 px-1.5 py-0.5 rounded font-mono">
                                Size: {prod.size}
                              </span>
                              <span className="bg-zinc-200/80 px-1.5 py-0.5 rounded font-mono">
                                Color: {prod.color}
                              </span>
                            </div>
                          </div>

                          <div className="text-right flex-shrink-0 ml-3">
                            <div className="font-bold text-sm text-black font-mono">
                              ₹{prod.s_p.toFixed(2)}
                            </div>
                            {prod.mrp > prod.s_p && (
                              <div className="text-[11px] text-zinc-400 line-through font-mono">
                                MRP: ₹{prod.mrp.toFixed(2)}
                              </div>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Selected Products Table (S.NO, PRODUCT NAME, VARIANT, QUANTITY, SELLING PRICE, ROW TOTAL, ACTION) */}
                <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden shadow-xs">
                  <div className="p-3 bg-zinc-100/70 border-b border-zinc-200 flex items-center justify-between">
                    <span className="text-xs font-bold text-zinc-800 uppercase tracking-wide">
                      Bill Items ({selectedItems.length})
                    </span>
                    <span className="text-[11px] text-zinc-500 font-mono hidden sm:inline">
                      Use Arrow Keys (← ↑ → ↓) &amp; Enter to Navigate Table
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-zinc-100 text-zinc-700 font-bold uppercase tracking-wider text-[11px] border-b border-zinc-200">
                          <th className="py-2.5 px-3 w-10 text-center">S.No</th>
                          <th className="py-2.5 px-3">Product Name</th>
                          <th className="py-2.5 px-3">Variant</th>
                          <th className="py-2.5 px-3 w-24 text-center">Quantity</th>
                          <th className="py-2.5 px-3 w-28 text-right">Selling Price (₹)</th>
                          <th className="py-2.5 px-3 w-28 text-right">Row Total (₹)</th>
                          <th className="py-2.5 px-3 w-12 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-200">
                        {selectedItems.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="py-12 text-center text-zinc-400">
                              <Scan className="w-7 h-7 mx-auto mb-2 text-zinc-300" />
                              <p className="font-medium text-sm text-zinc-600">No products added to bill</p>
                              <p className="text-xs text-zinc-400 mt-0.5">
                                Scan barcode or search above to begin billing
                              </p>
                            </td>
                          </tr>
                        ) : (
                          selectedItems.map((item, index) => (
                            <tr key={item.id} className="hover:bg-zinc-50/80 transition-colors">
                              {/* S.No */}
                              <td className="py-3 px-3 text-center font-mono font-medium text-zinc-500">
                                {index + 1}
                              </td>

                              {/* Product Name */}
                              <td className="py-3 px-3">
                                <div className="font-bold text-black text-xs sm:text-sm">
                                  {item.product_name}
                                </div>
                                <div className="text-[11px] text-zinc-400 font-mono">
                                  {item.prod_id} • Barcode: {item.barcode || '—'}
                                </div>
                              </td>

                              {/* Variant (Allows changing variant option if multiple exist) */}
                              <td className="py-3 px-3">
                                {item.allVariants && item.allVariants.length > 1 ? (
                                  <div className="relative inline-block">
                                    <select
                                      value={item.variant_id}
                                      onChange={(e) => handleVariantSwitch(item.id, e.target.value)}
                                      className="text-xs font-semibold bg-white border border-zinc-300 rounded px-2 py-1 pr-6 focus:border-black focus:outline-hidden cursor-pointer"
                                    >
                                      {item.allVariants.map((v) => (
                                        <option key={v.variant_id} value={v.variant_id}>
                                          {v.size} / {v.color} (₹{v.s_p})
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded bg-zinc-100 border border-zinc-200 text-black">
                                    {item.size} / {item.color}
                                  </span>
                                )}
                              </td>

                              {/* Quantity Input (Navigable with Arrow keys & Enter) */}
                              <td className="py-3 px-3 text-center">
                                <input
                                  ref={(el) => {
                                    qtyInputRefs.current[item.id] = el;
                                  }}
                                  type="number"
                                  min="1"
                                  value={item.quantity}
                                  onChange={(e) => handleQtyChange(item.id, e.target.value)}
                                  onKeyDown={(e) => handleTableKeyDown(e, index, 'qty')}
                                  className="w-16 h-8 text-center font-bold text-xs font-mono border border-zinc-300 rounded focus:border-black focus:outline-hidden bg-white"
                                />
                              </td>

                              {/* Selling Price Input (Navigable with Arrow keys & Enter) */}
                              <td className="py-3 px-3 text-right">
                                <input
                                  ref={(el) => {
                                    spInputRefs.current[item.id] = el;
                                  }}
                                  type="number"
                                  step="any"
                                  value={item.s_p}
                                  onChange={(e) => handleSpChange(item.id, e.target.value)}
                                  onKeyDown={(e) => handleTableKeyDown(e, index, 'sp')}
                                  className="w-20 h-8 text-right font-bold text-xs font-mono border border-zinc-300 rounded focus:border-black focus:outline-hidden bg-white px-2"
                                />
                              </td>

                              {/* Row Total */}
                              <td className="py-3 px-3 text-right font-bold font-mono text-black text-xs sm:text-sm">
                                ₹{item.row_total.toFixed(2)}
                              </td>

                              {/* Action Delete */}
                              <td className="py-3 px-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveItem(item.id)}
                                  className="text-zinc-400 hover:text-red-600 transition-colors p-1 cursor-pointer"
                                  title="Remove item"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* RIGHT COLUMN: Customer Details, Payments & Totals, Action Buttons (4 cols on lg) */}
              <div className="lg:col-span-4 space-y-4">
                {/* 1. Customer Details Section (Top Right) */}
                <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-xs space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-zinc-100">
                    <div className="flex items-center gap-2 text-xs font-bold text-black uppercase tracking-wide">
                      <User className="w-4 h-4 text-zinc-600" />
                      <span>Customer Details</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setIsQuickAddOpen(true)}
                      className="ui-btn ui-btn-outline ui-btn-sm text-[11px] font-semibold px-2.5 py-1 rounded-md flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3 h-3 text-black" />
                      <span>Quick Add</span>
                    </button>
                  </div>

                  {selectedCustomer ? (
                    <div className="p-3 bg-zinc-50 border border-zinc-200 rounded-lg flex items-center justify-between">
                      <div className="space-y-0.5">
                        <div className="font-bold text-xs text-black">{selectedCustomer.name}</div>
                        <div className="text-[11px] text-zinc-500 font-mono">
                          {selectedCustomer.mobile} •{' '}
                          <span className="font-semibold text-emerald-700">
                            {selectedCustomer.points} pts
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedCustomer(null);
                          customerSearchInputRef.current?.focus();
                        }}
                        className="text-xs text-zinc-400 hover:text-black cursor-pointer underline ml-2"
                      >
                        Change
                      </button>
                    </div>
                  ) : (
                    <div className="relative">
                      <input
                        ref={customerSearchInputRef}
                        type="text"
                        value={customerSearchQuery}
                        onChange={(e) => {
                          const val = e.target.value;
                          setCustomerSearchQuery(val);
                          if (!val.trim()) {
                            setCustomerResults([]);
                          }
                        }}
                        onKeyDown={handleCustomerKeyDown}
                        placeholder="Search Name or Mobile (Enter to select)"
                        className="ui-input h-9 text-xs border-zinc-300 focus:border-black rounded-lg w-full bg-white"
                        autoComplete="off"
                      />

                      {customerResults.length > 0 && (
                        <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-zinc-300 rounded-lg shadow-lg z-30 max-h-48 overflow-y-auto divide-y divide-zinc-100">
                          {customerResults.map((cust, idx) => (
                            <button
                              key={cust.id}
                              type="button"
                              onClick={() => {
                                setSelectedCustomer(cust);
                                setCustomerSearchQuery('');
                                setCustomerResults([]);
                                discountInputRef.current?.focus();
                              }}
                              className={`w-full text-left p-2.5 text-xs flex items-center justify-between cursor-pointer ${
                                idx === customerDropdownIndex ? 'bg-zinc-100 font-semibold' : 'hover:bg-zinc-50'
                              }`}
                            >
                              <div>
                                <span className="font-semibold text-black block">{cust.name}</span>
                                <span className="text-[11px] text-zinc-500 font-mono">
                                  {cust.mobile}
                                </span>
                              </div>
                              <span className="font-mono text-emerald-700 text-xs font-semibold">
                                {cust.points} pts
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* 2. Payment & Totals Section (Middle Right) */}
                <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-xs space-y-3">
                  <h3 className="text-xs font-bold text-black uppercase tracking-wide border-b border-zinc-100 pb-2">
                    Payment &amp; Totals
                  </h3>

                  {/* Subtotal */}
                  <div className="flex items-center justify-between text-xs py-1">
                    <span className="text-zinc-600 font-medium">Subtotal</span>
                    <span className="font-mono font-bold text-sm text-black">
                      ₹{subtotal.toFixed(2)}
                    </span>
                  </div>

                  {/* Discount */}
                  <div className="flex items-center justify-between gap-3 text-xs py-1">
                    <label className="text-zinc-600 font-medium">Discount (₹)</label>
                    <input
                      ref={discountInputRef}
                      type="number"
                      min="0"
                      step="any"
                      value={discountAmount || ''}
                      onChange={(e) => setDiscountAmount(parseFloat(e.target.value) || 0)}
                      onKeyDown={handleDiscountKeyDown}
                      placeholder="0"
                      className="w-28 h-8 text-right font-mono font-bold text-xs border border-zinc-300 rounded focus:border-black focus:outline-hidden px-2 bg-white"
                    />
                  </div>

                  {/* Total Amount */}
                  <div className="pt-2 border-t border-zinc-200 flex items-center justify-between">
                    <span className="font-bold text-sm text-black">Total Amount</span>
                    <span className="font-black text-xl text-black font-mono">
                      ₹{totalAmount.toFixed(2)}
                    </span>
                  </div>

                  {/* Payment Breakdown (Bottom Right: Cash, UPI, Card) */}
                  <div className="pt-3 border-t border-zinc-200 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-zinc-700 uppercase tracking-wide text-[11px]">
                        Payment Amounts (₹)
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setPayments({
                            cash: totalAmount,
                            upi: 0,
                            card: 0,
                          })
                        }
                        className="text-[11px] text-zinc-600 hover:text-black underline cursor-pointer"
                      >
                        Set Full Cash
                      </button>
                    </div>

                    {/* Cash */}
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="flex items-center gap-1.5 text-zinc-700 font-medium">
                        <Banknote className="w-3.5 h-3.5 text-zinc-500" />
                        <span>Cash</span>
                      </span>
                      <input
                        ref={cashInputRef}
                        type="number"
                        min="0"
                        step="any"
                        value={
                          payments.cash > 0
                            ? payments.cash
                            : payments.upi === 0 && payments.card === 0 && totalAmount > 0
                            ? totalAmount
                            : ''
                        }
                        onChange={(e) =>
                          setPayments((prev) => ({ ...prev, cash: parseFloat(e.target.value) || 0 }))
                        }
                        onKeyDown={(e) => handlePaymentKeyDown(e, 'cash')}
                        placeholder="0.00"
                        className="w-32 h-8 text-right font-mono font-bold text-xs border border-zinc-300 rounded focus:border-black focus:outline-hidden px-2 bg-white"
                      />
                    </div>

                    {/* UPI */}
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="flex items-center gap-1.5 text-zinc-700 font-medium">
                        <Smartphone className="w-3.5 h-3.5 text-zinc-500" />
                        <span>UPI</span>
                      </span>
                      <input
                        ref={upiInputRef}
                        type="number"
                        min="0"
                        step="any"
                        value={payments.upi || ''}
                        onChange={(e) =>
                          setPayments((prev) => ({ ...prev, upi: parseFloat(e.target.value) || 0 }))
                        }
                        onKeyDown={(e) => handlePaymentKeyDown(e, 'upi')}
                        placeholder="0.00"
                        className="w-32 h-8 text-right font-mono font-bold text-xs border border-zinc-300 rounded focus:border-black focus:outline-hidden px-2 bg-white"
                      />
                    </div>

                    {/* Card / Credit */}
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="flex items-center gap-1.5 text-zinc-700 font-medium">
                        <CreditCard className="w-3.5 h-3.5 text-zinc-500" />
                        <span>Card / Credit</span>
                      </span>
                      <input
                        ref={cardInputRef}
                        type="number"
                        min="0"
                        step="any"
                        value={payments.card || ''}
                        onChange={(e) =>
                          setPayments((prev) => ({ ...prev, card: parseFloat(e.target.value) || 0 }))
                        }
                        onKeyDown={(e) => handlePaymentKeyDown(e, 'card')}
                        placeholder="0.00"
                        className="w-32 h-8 text-right font-mono font-bold text-xs border border-zinc-300 rounded focus:border-black focus:outline-hidden px-2 bg-white"
                      />
                    </div>
                  </div>

                  {/* Action Buttons: Save & Print, Save Only, Draft */}
                  <div className="pt-3 border-t border-zinc-200 space-y-2">
                    <button
                      ref={savePrintBtnRef}
                      type="button"
                      disabled={isSubmitting || selectedItems.length === 0}
                      onClick={() => handleSaveBill('success', true)}
                      className="ui-btn ui-btn-primary w-full h-11 text-xs sm:text-sm font-bold flex items-center justify-center gap-2 rounded-lg shadow-sm cursor-pointer disabled:opacity-50"
                    >
                      <Printer className="w-4 h-4 text-white" />
                      <span>Save &amp; Print</span>
                    </button>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        disabled={isSubmitting || selectedItems.length === 0}
                        onClick={() => handleSaveBill('success', false)}
                        className="ui-btn ui-btn-outline w-full h-9 text-xs font-semibold flex items-center justify-center gap-1.5 rounded-lg border-zinc-300 hover:bg-zinc-100 cursor-pointer disabled:opacity-50"
                      >
                        <Save className="w-3.5 h-3.5 text-black" />
                        <span>Save Only</span>
                      </button>

                      <button
                        type="button"
                        disabled={isSubmitting || selectedItems.length === 0}
                        onClick={() => handleSaveBill('draft', false)}
                        className="ui-btn ui-btn-outline w-full h-9 text-xs font-semibold flex items-center justify-center gap-1.5 rounded-lg border-zinc-300 hover:bg-zinc-100 cursor-pointer disabled:opacity-50"
                      >
                        <FileText className="w-3.5 h-3.5 text-zinc-600" />
                        <span>Draft</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* QUICK ADD CUSTOMER MODAL */}
      {isQuickAddOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-zinc-200 max-w-sm w-full p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-2">
              <h3 className="font-bold text-sm text-black">Quick Add Customer</h3>
              <button
                type="button"
                onClick={() => setIsQuickAddOpen(false)}
                className="text-zinc-400 hover:text-black cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {quickError && (
              <div className="p-2.5 bg-red-50 text-red-700 text-xs rounded border border-red-200">
                {quickError}
              </div>
            )}

            <form onSubmit={handleQuickAddCustomer} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1">
                  Mobile Number *
                </label>
                <input
                  type="tel"
                  value={quickMobile}
                  onChange={(e) => setQuickMobile(e.target.value)}
                  placeholder="e.g. 9876543210"
                  className="ui-input h-9 text-xs font-mono"
                  autoFocus
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1">
                  Customer Name
                </label>
                <input
                  type="text"
                  value={quickName}
                  onChange={(e) => setQuickName(e.target.value)}
                  placeholder="e.g. Rahul Sharma"
                  className="ui-input h-9 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1">
                  Initial Loyalty Points
                </label>
                <input
                  type="number"
                  min="0"
                  value={quickPoints}
                  onChange={(e) => setQuickPoints(e.target.value)}
                  className="ui-input h-9 text-xs font-mono"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsQuickAddOpen(false)}
                  className="ui-btn ui-btn-outline ui-btn-sm text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="ui-btn ui-btn-primary ui-btn-sm text-xs font-semibold"
                >
                  Save &amp; Select
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PRINT-READY POS RECEIPT (Triggered upon window.print() or completedBill) */}
      {completedBill && (
        <div className="hidden print:block fixed inset-0 bg-white p-6 z-50 text-black">
          <div className="max-w-xs mx-auto font-mono text-xs space-y-2 border-b border-black pb-3">
            <div className="text-center">
              <h2 className="font-bold text-base">MEN EXPRESS</h2>
              <p className="text-[11px]">{storeName}</p>
              <p className="text-[10px]">Tax Invoice / Cash Receipt</p>
            </div>
            <div className="border-t border-dashed border-zinc-400 pt-2 text-[10px] space-y-0.5">
              <div>Bill No: {completedBill.billId}</div>
              <div>Date: {new Date().toLocaleDateString()} {new Date().toLocaleTimeString()}</div>
              {selectedCustomer && (
                <div>Customer: {selectedCustomer.name} ({selectedCustomer.mobile})</div>
              )}
            </div>
            <div className="border-t border-dashed border-zinc-400 pt-2">
              <table className="w-full text-left text-[10px]">
                <thead>
                  <tr className="border-b border-zinc-400">
                    <th className="py-1">Item</th>
                    <th className="text-center py-1">Qty</th>
                    <th className="text-right py-1">Price</th>
                    <th className="text-right py-1">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedItems.map((it, i) => (
                    <tr key={i}>
                      <td className="py-0.5">{it.product_name} ({it.size})</td>
                      <td className="text-center">{it.quantity}</td>
                      <td className="text-right">₹{it.s_p}</td>
                      <td className="text-right">₹{it.row_total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="border-t border-dashed border-zinc-400 pt-2 text-[10px] space-y-0.5">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>₹{subtotal.toFixed(2)}</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between">
                  <span>Discount:</span>
                  <span>-₹{discountAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-xs pt-1 border-t border-black">
                <span>TOTAL:</span>
                <span>₹{totalAmount.toFixed(2)}</span>
              </div>
            </div>
            <div className="text-center pt-3 text-[10px] text-zinc-600">
              Thank you for shopping at Men Express!
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
