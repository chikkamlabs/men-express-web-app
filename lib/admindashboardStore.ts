import { supabase } from './supabase';

export interface AdminDashboardStats {
  todayOrdersCount: number;
  totalOnlineSaleAmount: number;
}

/**
 * Fetch Today's online orders count and Total online sale amount directly from Supabase
 */
export async function getAdminDashboardStats(): Promise<{
  data: AdminDashboardStats;
  error: Error | null;
}> {
  try {
    // 1. Calculate today's start date (00:00:00 local time)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStartIso = today.toISOString();

    // 2. Fetch today's orders count
    const { count: todayCount, error: countError } = await supabase
      .from('online_orders')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', todayStartIso);

    // 3. Fetch all online orders payable_amount to calculate total online sales
    const { data: salesData, error: salesError } = await supabase
      .from('online_orders')
      .select('payable_amount');

    if (countError || salesError) {
      const errorMsg =
        countError?.message || salesError?.message || 'Error fetching stats';
      return {
        data: {
          todayOrdersCount: todayCount ?? 0,
          totalOnlineSaleAmount: 0,
        },
        error: new Error(errorMsg),
      };
    }

    const totalSales = (salesData || []).reduce(
      (sum, row) => sum + (Number(row.payable_amount) || 0),
      0
    );

    return {
      data: {
        todayOrdersCount: todayCount ?? 0,
        totalOnlineSaleAmount: totalSales,
      },
      error: null,
    };
  } catch (err: unknown) {
    const errorMsg =
      err instanceof Error ? err.message : 'Unknown error fetching dashboard stats';
    return {
      data: {
        todayOrdersCount: 0,
        totalOnlineSaleAmount: 0,
      },
      error: new Error(errorMsg),
    };
  }
}
