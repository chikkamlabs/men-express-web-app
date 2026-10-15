import { supabase } from './supabase';

export type OrderPaymentStatus = 'pending' | 'submitted' | 'verified' | 'rejected';

export type OrderFulfillmentStatus =
  | 'pending'
  | 'payment_success'
  | 'packed'
  | 'shipping'
  | 'delivered'
  | 'cancelled';

export interface CustomerAddress {
  id: string;
  address_name: string | null;
  customer_id: string;
  postal_code: string;
  state: string;
  city: string;
  address: string;
  land_mark: string | null;
  status: string;
  mobile_alt: string | null;
  email: string | null;
  created_at?: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  prod_id: string;
  quantity: number;
  s_p: number;
  row_total: number;
  product_name?: string;
  variant_barcode?: string;
  size?: string;
  color?: string;
}

export interface OnlineOrder {
  id: string;
  order_id: string;
  customer_id: string;
  amount: number;
  discount: number;
  delivery_charges: number;
  payable_amount: number; // Final amount
  coupon_code: string | null;
  referral_code: string | null;
  payment: OrderPaymentStatus;
  transaction_details: string | null;
  status: OrderFulfillmentStatus;
  created_at: string;
  updated_at?: string;
  customer_name?: string;
  customer_mobile?: string;
  customer_email?: string | null;
  customer_address?: CustomerAddress | null;
  items?: OrderItem[];
}

export interface UpdateOrderStatusInput {
  payment?: OrderPaymentStatus;
  status?: OrderFulfillmentStatus;
  transaction_details?: string | null;
}

/**
 * Fetch all online orders directly from Supabase
 */
export async function getOnlineOrders(): Promise<{
  data: OnlineOrder[];
  error: Error | null;
}> {
  try {
    const { data, error } = await supabase
      .from('online_orders')
      .select(`
        *,
        customer:customers (
          id,
          name,
          mobile,
          email
        )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      return { data: [], error: new Error(error.message) };
    }

    if (data && data.length > 0) {
      const mapped: OnlineOrder[] = data.map((order: any) => ({
        id: order.id,
        order_id: order.order_id,
        customer_id: order.customer_id,
        amount: Number(order.amount) || 0,
        discount: Number(order.discount) || 0,
        delivery_charges: Number(order.delivery_charges) || 0,
        payable_amount: Number(order.payable_amount) || 0,
        coupon_code: order.coupon_code || null,
        referral_code: order.referral_code || null,
        payment: order.payment,
        transaction_details: order.transaction_details || null,
        status: order.status,
        created_at: order.created_at,
        updated_at: order.updated_at,
        customer_name: order.customer?.name || 'Customer',
        customer_mobile: order.customer?.mobile || '—',
        customer_email: order.customer?.email || null,
      }));

      return { data: mapped, error: null };
    }

    return { data: [], error: null };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown network error';
    return { data: [], error: new Error(errorMsg) };
  }
}

/**
 * Fetch a single online order by id or order_id including address & line items directly from Supabase
 */
export async function getOnlineOrderDetails(
  idOrOrderId: string
): Promise<{ data: OnlineOrder | null; error: Error | null }> {
  try {
    const { data: order, error } = await supabase
      .from('online_orders')
      .select(`
        *,
        customer:customers (
          id,
          name,
          mobile,
          email
        )
      `)
      .or(`id.eq.${idOrOrderId},order_id.eq.${idOrOrderId}`)
      .maybeSingle();

    if (error || !order) {
      return {
        data: null,
        error: error ? new Error(error.message) : new Error('Order not found'),
      };
    }

    // Fetch customer address
    let address: CustomerAddress | null = null;
    if (order.customer_id) {
      const { data: addrData } = await supabase
        .from('customer_address')
        .select('*')
        .eq('customer_id', order.customer_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (addrData) {
        address = addrData as CustomerAddress;
      }
    }

    // Fetch order items with variant info
    let items: OrderItem[] = [];
    const { data: itemsData } = await supabase
      .from('order_items')
      .select(`
        *,
        variant:product_variants (
          id,
          barcode,
          product:products (
            name
          ),
          color:product_colors (
            color:colors (
              name
            )
          ),
          size:sizes (
            value
          )
        )
      `)
      .eq('order_id', order.id);

    if (itemsData && itemsData.length > 0) {
      items = itemsData.map((item: any) => ({
        id: item.id,
        order_id: item.order_id,
        prod_id: item.prod_id,
        quantity: item.quantity,
        s_p: Number(item.s_p),
        row_total: Number(item.row_total),
        product_name: item.variant?.product?.name || 'Product Variant',
        variant_barcode: item.variant?.barcode || '—',
        size: item.variant?.size?.value || 'Standard',
        color: item.variant?.color?.color?.name || 'Default',
      }));
    }

    const completeOrder: OnlineOrder = {
      id: order.id,
      order_id: order.order_id,
      customer_id: order.customer_id,
      amount: Number(order.amount) || 0,
      discount: Number(order.discount) || 0,
      delivery_charges: Number(order.delivery_charges) || 0,
      payable_amount: Number(order.payable_amount) || 0,
      coupon_code: order.coupon_code || null,
      referral_code: order.referral_code || null,
      payment: order.payment,
      transaction_details: order.transaction_details || null,
      status: order.status,
      created_at: order.created_at,
      updated_at: order.updated_at,
      customer_name: order.customer?.name || 'Customer',
      customer_mobile: order.customer?.mobile || '—',
      customer_email: order.customer?.email || null,
      customer_address: address,
      items,
    };

    return { data: completeOrder, error: null };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Error fetching order';
    return { data: null, error: new Error(errorMsg) };
  }
}

/**
 * Update order payment and/or fulfillment status in Supabase
 */
export async function updateOrderStatus(
  id: string,
  input: UpdateOrderStatusInput
): Promise<{ data: OnlineOrder | null; error: Error | null }> {
  const updatePayload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (input.payment) updatePayload.payment = input.payment;
  if (input.status) updatePayload.status = input.status;
  if (input.transaction_details !== undefined) {
    updatePayload.transaction_details = input.transaction_details;
  }

  try {
    const { data, error } = await supabase
      .from('online_orders')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    // Refresh and return complete order details
    return getOnlineOrderDetails(id);
  } catch (err: unknown) {
    const errorMsg =
      err instanceof Error ? err.message : 'Failed to update order status';
    return { data: null, error: new Error(errorMsg) };
  }
}
