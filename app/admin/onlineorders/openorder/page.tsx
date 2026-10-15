'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  ShoppingBag,
  MapPin,
  Package,
  CreditCard,
  CheckCircle,
  Loader2,
  AlertCircle,
  Download,
} from 'lucide-react';
import { getCurrentSupabaseUser } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import AdminHeader from '@/components/admin/header';
import AdminSidebar from '@/components/admin/sidebar';
import {
  OnlineOrder,
  OrderPaymentStatus,
  OrderFulfillmentStatus,
  getOnlineOrderDetails,
  updateOrderStatus,
} from '@/lib/onlineordersStore';
import { generateInvoice } from '@/lib/generateInvoice';

function OpenOrderContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderParam = searchParams.get('id') || searchParams.get('order_id') || '';

  const [isAuthorized, setIsAuthorized] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [order, setOrder] = useState<OnlineOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Editable statuses
  const [selectedPayment, setSelectedPayment] = useState<OrderPaymentStatus>('pending');
  const [selectedStatus, setSelectedStatus] = useState<OrderFulfillmentStatus>('pending');
  const [transactionDetails, setTransactionDetails] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

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

  // Load Order Details
  useEffect(() => {
    let ignore = false;
    if (isAuthorized && orderParam) {
      getOnlineOrderDetails(orderParam).then(({ data, error: fetchErr }) => {
        if (ignore) return;
        if (fetchErr || !data) {
          setError(fetchErr?.message || 'Order could not be found.');
          setLoading(false);
        } else {
          setOrder(data);
          setSelectedPayment(data.payment);
          setSelectedStatus(data.status);
          setTransactionDetails(data.transaction_details || '');
          setLoading(false);
        }
      });
    }
    return () => {
      ignore = true;
    };
  }, [isAuthorized, orderParam]);

  const handleStatusUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order) return;

    setIsSaving(true);
    setSaveSuccess(false);

    const { data, error: updateErr } = await updateOrderStatus(order.id, {
      payment: selectedPayment,
      status: selectedStatus,
      transaction_details: transactionDetails.trim() || null,
    });

    setIsSaving(false);

    if (updateErr && !data) {
      alert(`Error updating order: ${updateErr.message}`);
    } else if (data) {
      setOrder(data);
      setTransactionDetails(data.transaction_details || '');
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
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
                href="/admin/onlineorders"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-600 hover:text-black transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Online Orders</span>
              </Link>

              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-zinc-200">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-zinc-100 rounded-lg text-black border border-zinc-200">
                    <ShoppingBag className="w-6 h-6 text-black" />
                  </div>
                  <div>
                    <h1 className="typo-page-title text-xl sm:text-2xl font-bold text-black tracking-tight flex items-center gap-2">
                      <span>Order</span>
                      <span className="font-mono">{order?.order_id || orderParam}</span>
                    </h1>
                    <p className="typo-caption text-xs sm:text-sm text-zinc-500">
                      Placed on{' '}
                      {order?.created_at
                        ? new Date(order.created_at).toLocaleString('en-IN', {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })
                        : '—'}
                    </p>
                  </div>
                </div>

                {order && (
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="px-3 py-1.5 bg-zinc-100 border border-zinc-200 rounded-md text-xs font-mono">
                      <span className="text-zinc-500 mr-1.5">Payment:</span>
                      <strong className="text-black uppercase">{order.payment}</strong>
                    </div>
                    <div className="px-3 py-1.5 bg-zinc-100 border border-zinc-200 rounded-md text-xs font-mono">
                      <span className="text-zinc-500 mr-1.5">Fulfillment:</span>
                      <strong className="text-black uppercase">{order.status}</strong>
                    </div>
                    <button
                      type="button"
                      onClick={() => generateInvoice(order)}
                      className="ui-btn ui-btn-grey ui-btn-sm px-3.5 py-1.5 font-medium text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
                      title="Download Shipping Invoice (5 inch x 3 inch)"
                    >
                      <Download className="w-3.5 h-3.5 text-white" />
                      <span>Download Invoice</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {!orderParam ? (
              <div className="p-6 bg-red-50 border border-red-200 rounded-lg text-red-700 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-sm">No order specified</p>
                  <p className="text-xs mt-1">Please provide an order ID to view details.</p>
                  <Link
                    href="/admin/onlineorders"
                    className="inline-block mt-3 text-xs font-medium underline hover:text-red-900"
                  >
                    Return to orders list
                  </Link>
                </div>
              </div>
            ) : loading ? (
              <div className="p-12 text-center text-sm text-zinc-500 flex flex-col items-center justify-center gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-black" />
                <span>Loading order details...</span>
              </div>
            ) : error || !order ? (
              <div className="p-6 bg-red-50 border border-red-200 rounded-lg text-red-700 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-sm">Unable to load order</p>
                  <p className="text-xs mt-1">{error || 'Order record not found.'}</p>
                  <Link
                    href="/admin/onlineorders"
                    className="inline-block mt-3 text-xs font-medium underline hover:text-red-900"
                  >
                    Return to orders list
                  </Link>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Save Confirmation Banner */}
                {saveSuccess && (
                  <div className="p-3 bg-green-50 border border-green-200 text-green-800 rounded-lg text-sm flex items-center gap-2 animate-fade-in">
                    <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                    <span>Payment, fulfillment status, and transaction details updated successfully.</span>
                  </div>
                )}

                {/* Section 1 & 2: Order Details & Customer Shipping Address Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Order Details Card */}
                  <div className="ui-card p-6 bg-white border border-zinc-200 rounded-lg space-y-4">
                    <div className="flex items-center gap-2 pb-3 border-b border-zinc-200">
                      <CreditCard className="w-4 h-4 text-black" />
                      <h2 className="text-sm font-bold text-black uppercase tracking-wide">
                        Order & Payment Details
                      </h2>
                    </div>

                    <div className="grid grid-cols-2 gap-y-3 text-xs">
                      <div>
                        <span className="text-zinc-500 block">Order ID</span>
                        <span className="font-mono font-semibold text-black">
                          {order.order_id}
                        </span>
                      </div>
                      <div>
                        <span className="text-zinc-500 block">Customer Name</span>
                        <span className="font-medium text-black">
                          {order.customer_name || '—'}
                        </span>
                      </div>

                      <div>
                        <span className="text-zinc-500 block">Customer Mobile</span>
                        <span className="font-mono text-black">
                          {order.customer_mobile || '—'}
                        </span>
                      </div>
                      <div>
                        <span className="text-zinc-500 block">Customer Email</span>
                        <span className="text-black">
                          {order.customer_email || '—'}
                        </span>
                      </div>

                      <div>
                        <span className="text-zinc-500 block">Items Subtotal</span>
                        <span className="font-mono text-black">
                          ₹{Number(order.amount || 0).toLocaleString('en-IN', {
                            minimumFractionDigits: 2,
                          })}
                        </span>
                      </div>
                      <div>
                        <span className="text-zinc-500 block">Discount</span>
                        <span className="font-mono text-green-700 font-medium">
                          -₹{Number(order.discount || 0).toLocaleString('en-IN', {
                            minimumFractionDigits: 2,
                          })}
                        </span>
                      </div>

                      <div>
                        <span className="text-zinc-500 block">Delivery Charges</span>
                        <span className="font-mono text-black">
                          ₹{Number(order.delivery_charges || 0).toLocaleString('en-IN', {
                            minimumFractionDigits: 2,
                          })}
                        </span>
                      </div>
                      <div>
                        <span className="text-zinc-500 block">Final Amount</span>
                        <span className="font-mono text-sm font-bold text-black">
                          ₹{Number(order.payable_amount || 0).toLocaleString('en-IN', {
                            minimumFractionDigits: 2,
                          })}
                        </span>
                      </div>

                      <div>
                        <span className="text-zinc-500 block">Coupon Code</span>
                        <span className="font-mono text-black">
                          {order.coupon_code || 'None'}
                        </span>
                      </div>
                      <div>
                        <span className="text-zinc-500 block">Referral Code</span>
                        <span className="font-mono text-black">
                          {order.referral_code || 'None'}
                        </span>
                      </div>

                      <div className="col-span-2 pt-2 border-t border-zinc-100">
                        <span className="text-zinc-500 block">Transaction Details</span>
                        <span className="text-black font-mono text-xs">
                          {order.transaction_details || 'No transaction notes'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Customer Shipping Address Card */}
                  <div className="ui-card p-6 bg-white border border-zinc-200 rounded-lg space-y-4">
                    <div className="flex items-center gap-2 pb-3 border-b border-zinc-200">
                      <MapPin className="w-4 h-4 text-black" />
                      <h2 className="text-sm font-bold text-black uppercase tracking-wide">
                        Shipping Address (Customer Address)
                      </h2>
                    </div>

                    {order.customer_address ? (
                      <div className="space-y-2 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-black">
                            {order.customer_address.address_name || 'Delivery Destination'}
                          </span>
                          <span className="ui-badge ui-badge-default text-[10px]">
                            {order.customer_address.status || 'Active'}
                          </span>
                        </div>

                        <p className="text-zinc-800 text-sm leading-relaxed">
                          {order.customer_address.address}
                        </p>

                        {order.customer_address.land_mark && (
                          <p className="text-zinc-600">
                            <strong className="text-zinc-500 font-normal">Landmark: </strong>
                            {order.customer_address.land_mark}
                          </p>
                        )}

                        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-zinc-100">
                          <div>
                            <span className="text-zinc-500 block">City, State</span>
                            <span className="font-medium text-black">
                              {order.customer_address.city}, {order.customer_address.state}
                            </span>
                          </div>
                          <div>
                            <span className="text-zinc-500 block">Postal Code</span>
                            <span className="font-mono font-medium text-black">
                              {order.customer_address.postal_code}
                            </span>
                          </div>

                          {order.customer_address.mobile_alt && (
                            <div>
                              <span className="text-zinc-500 block">Alt Mobile</span>
                              <span className="font-mono text-black">
                                {order.customer_address.mobile_alt}
                              </span>
                            </div>
                          )}

                          {order.customer_address.email && (
                            <div>
                              <span className="text-zinc-500 block">Address Email</span>
                              <span className="text-black">
                                {order.customer_address.email}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="py-8 text-center text-xs text-zinc-500">
                        <MapPin className="w-6 h-6 text-zinc-300 mx-auto mb-1" />
                        <p>No dedicated customer_address record found for this customer.</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Section 3: Order Items Details */}
                <div className="ui-card p-6 bg-white border border-zinc-200 rounded-lg space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-zinc-200">
                    <div className="flex items-center gap-2">
                      <Package className="w-4 h-4 text-black" />
                      <h2 className="text-sm font-bold text-black uppercase tracking-wide">
                        Order Items Details
                      </h2>
                    </div>
                    <span className="text-xs text-zinc-500 font-mono">
                      {order.items?.length || 0} items
                    </span>
                  </div>

                  <div className="ui-table-container border border-zinc-200 rounded-lg overflow-hidden bg-white">
                    <table className="ui-table w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-zinc-100 border-b border-zinc-200">
                          <th className="ui-table-th py-2.5 px-3 font-semibold text-xs text-zinc-600 uppercase">
                            Item / Product
                          </th>
                          <th className="ui-table-th py-2.5 px-3 font-semibold text-xs text-zinc-600 uppercase">
                            SKU / Barcode
                          </th>
                          <th className="ui-table-th py-2.5 px-3 font-semibold text-xs text-zinc-600 uppercase">
                            Size
                          </th>
                          <th className="ui-table-th py-2.5 px-3 font-semibold text-xs text-zinc-600 uppercase">
                            Color
                          </th>
                          <th className="ui-table-th py-2.5 px-3 font-semibold text-xs text-zinc-600 uppercase text-center">
                            Qty
                          </th>
                          <th className="ui-table-th py-2.5 px-3 font-semibold text-xs text-zinc-600 uppercase text-right">
                            Price (₹)
                          </th>
                          <th className="ui-table-th py-2.5 px-3 font-semibold text-xs text-zinc-600 uppercase text-right">
                            Row Total (₹)
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-200">
                        {!order.items || order.items.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="py-6 text-center text-xs text-zinc-500">
                              No line items recorded for this order.
                            </td>
                          </tr>
                        ) : (
                          order.items.map((item, idx) => (
                            <tr key={item.id || idx} className="hover:bg-zinc-50">
                              <td className="py-3 px-3 text-sm text-black font-medium">
                                {item.product_name || 'Clothing Item'}
                              </td>
                              <td className="py-3 px-3 text-xs text-zinc-600 font-mono">
                                {item.variant_barcode || '—'}
                              </td>
                              <td className="py-3 px-3 text-xs text-black font-mono">
                                <span className="px-2 py-0.5 bg-zinc-100 rounded border border-zinc-200">
                                  {item.size || '—'}
                                </span>
                              </td>
                              <td className="py-3 px-3 text-xs text-zinc-700">
                                {item.color || '—'}
                              </td>
                              <td className="py-3 px-3 text-sm text-center font-mono font-semibold text-black">
                                {item.quantity}
                              </td>
                              <td className="py-3 px-3 text-sm text-right font-mono text-zinc-700">
                                ₹{Number(item.s_p || 0).toLocaleString('en-IN', {
                                  minimumFractionDigits: 2,
                                })}
                              </td>
                              <td className="py-3 px-3 text-sm text-right font-mono font-bold text-black">
                                ₹{Number(item.row_total || 0).toLocaleString('en-IN', {
                                  minimumFractionDigits: 2,
                                })}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Section 4: Change Payment Status & Fulfillment Status */}
                <form
                  onSubmit={handleStatusUpdate}
                  className="ui-card p-6 bg-zinc-50 border border-zinc-200 rounded-lg space-y-4"
                >
                  <div className="flex items-center justify-between pb-3 border-b border-zinc-200">
                    <h2 className="text-sm font-bold text-black uppercase tracking-wide">
                      Update Order Status
                    </h2>
                    <span className="text-xs text-zinc-500">
                      Payment and fulfillment statuses can be changed here
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Payment Status Dropdown */}
                    <div className="ui-form-group mb-0">
                      <label className="ui-form-label font-semibold text-xs text-zinc-700 uppercase tracking-wide mb-1 block">
                        Payment Status
                      </label>
                      <select
                        value={selectedPayment}
                        onChange={(e) =>
                          setSelectedPayment(e.target.value as OrderPaymentStatus)
                        }
                        className="ui-select text-black bg-white border border-zinc-300 focus:border-black font-medium"
                      >
                        <option value="pending">Pending</option>
                        <option value="submitted">Submitted</option>
                        <option value="verified">Verified</option>
                        <option value="rejected">Rejected</option>
                      </select>
                      <span className="ui-form-helper text-xs text-zinc-500 mt-1">
                        Current status: {order.payment}
                      </span>
                    </div>

                    {/* Fulfillment Status Dropdown */}
                    <div className="ui-form-group mb-0">
                      <label className="ui-form-label font-semibold text-xs text-zinc-700 uppercase tracking-wide mb-1 block">
                        Fulfillment Status
                      </label>
                      <select
                        value={selectedStatus}
                        onChange={(e) =>
                          setSelectedStatus(e.target.value as OrderFulfillmentStatus)
                        }
                        className="ui-select text-black bg-white border border-zinc-300 focus:border-black font-medium"
                      >
                        <option value="pending">Pending</option>
                        <option value="payment_success">Payment Success</option>
                        <option value="packed">Packed</option>
                        <option value="shipping">Shipping</option>
                        <option value="delivered">Delivered</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                      <span className="ui-form-helper text-xs text-zinc-500 mt-1">
                        Current status: {order.status}
                      </span>
                    </div>

                    {/* Editable Transaction Details */}
                    <div className="ui-form-group col-span-1 sm:col-span-2 mb-0">
                      <label className="ui-form-label font-semibold text-xs text-zinc-700 uppercase tracking-wide mb-1 block">
                        Transaction Details
                      </label>
                      <textarea
                        value={transactionDetails}
                        onChange={(e) => setTransactionDetails(e.target.value)}
                        rows={2}
                        placeholder="Enter transaction details, UPI reference, or transaction notes..."
                        className="ui-textarea text-black bg-white border border-zinc-300 focus:border-black font-mono text-xs w-full rounded-md"
                      />
                      <span className="ui-form-helper text-xs text-zinc-500 mt-1">
                        You can edit and update the payment transaction reference or transaction notes.
                      </span>
                    </div>
                  </div>

                  {/* Save Button: Grey color, turns dark black on tap */}
                  <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-200">
                    <Link
                      href="/admin/onlineorders"
                      className="ui-btn ui-btn-outline ui-btn-md text-black border-zinc-300 hover:bg-zinc-100 cursor-pointer text-xs"
                    >
                      Back to Orders
                    </Link>
                    <button
                      type="button"
                      onClick={() => generateInvoice(order)}
                      className="ui-btn ui-btn-outline ui-btn-md text-black border-zinc-300 hover:bg-zinc-100 cursor-pointer text-xs flex items-center gap-1.5"
                      title="Download Shipping Invoice (5 inch x 3 inch)"
                    >
                      <Download className="w-3.5 h-3.5 text-black" />
                      <span>Download Invoice</span>
                    </button>
                    <button
                      type="submit"
                      disabled={isSaving}
                      className="ui-btn ui-btn-grey ui-btn-md font-medium cursor-pointer flex items-center gap-2"
                    >
                      {isSaving ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin text-white" />
                          <span>Updating...</span>
                        </>
                      ) : (
                        <span>Save Status Changes</span>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

export default function AdminOpenOrderPage() {
  return (
    <Suspense
      fallback={
        <div className="layout-page-container layout-flex-center min-h-screen bg-white">
          <p className="typo-body text-zinc-600">Loading order...</p>
        </div>
      }
    >
      <OpenOrderContent />
    </Suspense>
  );
}
