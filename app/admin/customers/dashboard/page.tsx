'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Plus, Users, RefreshCw } from 'lucide-react';
import { getCurrentSupabaseUser } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import AdminHeader from '@/components/admin/header';
import AdminSidebar from '@/components/admin/sidebar';
import AddCustomerModal from '@/components/admin/addcustomer';
import OpenCustomerModal from '@/components/admin/opencustomer';
import { Customer, getCustomers } from '@/lib/customersStore';

export default function AdminCustomersDashboardPage() {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Customer data states
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [searchMobile, setSearchMobile] = useState('');

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

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

  // Load customers
  useEffect(() => {
    let ignore = false;
    if (isAuthorized) {
      getCustomers().then(({ data }) => {
        if (!ignore && data) {
          setCustomers(data);
          setDataLoading(false);
        }
      });
    }
    return () => {
      ignore = true;
    };
  }, [isAuthorized]);

  const refreshCustomers = async () => {
    setDataLoading(true);
    const { data } = await getCustomers();
    if (data) {
      setCustomers(data);
    }
    setDataLoading(false);
  };

  // Filtered by mobile search bar
  const filteredCustomers = useMemo(() => {
    const query = searchMobile.trim().toLowerCase();
    if (!query) return customers;
    return customers.filter((item) =>
      item.mobile.toLowerCase().includes(query)
    );
  }, [customers, searchMobile]);

  const handleCustomerCreated = (newCust: Customer) => {
    setCustomers((prev) => {
      const exists = prev.some((c) => c.id === newCust.id || c.mobile === newCust.mobile);
      if (exists) {
        return prev.map((c) =>
          c.id === newCust.id || c.mobile === newCust.mobile ? newCust : c
        );
      }
      return [newCust, ...prev];
    });
  };

  const handleCustomerUpdated = (updatedCust: Customer) => {
    setCustomers((prev) =>
      prev.map((c) => (c.id === updatedCust.id ? updatedCust : c))
    );
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
      {/* Admin Header */}
      <AdminHeader
        onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
        isSidebarOpen={sidebarOpen}
      />

      <div className="flex flex-1 min-h-[calc(100vh-4rem)] w-full max-w-full relative overflow-x-hidden">
        {/* Admin Sidebar */}
        <AdminSidebar
          mobileOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        {/* Dashboard Content */}
        <main className="flex-1 p-4 sm:p-6 md:p-8 w-full max-w-full overflow-x-hidden bg-white">
          <div className="max-w-6xl mx-auto space-y-6">
            {/* Top Bar: Title & Total Count & Add Customer Button */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-zinc-200">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-zinc-100 rounded-lg text-black border border-zinc-200">
                  <Users className="w-6 h-6 text-black" />
                </div>
                <div>
                  <h1 className="typo-page-title text-xl sm:text-2xl font-bold text-black tracking-tight">
                    Customers
                  </h1>
                  <p className="typo-caption text-xs sm:text-sm text-zinc-500">
                    Manage store customer profiles, mobile records, and loyalty reward points
                  </p>
                </div>
              </div>

              {/* Total Customers Count & Add Customer Button */}
              <div className="flex items-center gap-3">
                {/* Total Customers Count */}
                <div className="px-4 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-center">
                  <span className="block text-xs uppercase tracking-wider text-zinc-500 font-semibold">
                    Total customers
                  </span>
                  <span className="text-lg font-bold text-black font-mono">
                    {customers.length}
                  </span>
                </div>

                {/* Add Customer Button: Grey color, turns dark black on tap */}
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(true)}
                  className="ui-btn ui-btn-grey ui-btn-md px-4 py-2 font-medium flex items-center gap-2 shadow-xs cursor-pointer"
                >
                  <Plus className="w-4 h-4 text-white" />
                  <span>Add Customer</span>
                </button>
              </div>
            </div>

            {/* Controls: Search Bar (mobile) */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
                <input
                  type="text"
                  value={searchMobile}
                  onChange={(e) => setSearchMobile(e.target.value)}
                  placeholder="Search customer by mobile..."
                  style={{ paddingLeft: '2.5rem' }}
                  className="ui-input pr-4 text-sm text-black border border-zinc-300 focus:border-black rounded-lg w-full bg-white font-mono"
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={refreshCustomers}
                  disabled={dataLoading}
                  className="ui-btn ui-btn-outline ui-btn-sm text-xs text-black border-zinc-300 hover:bg-zinc-100 flex items-center gap-1.5 cursor-pointer"
                  title="Refresh customers"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 text-black ${
                      dataLoading ? 'animate-spin' : ''
                    }`}
                  />
                  <span>Refresh</span>
                </button>
              </div>
            </div>

            {/* Display all the customers (name, mobile, points, open button) */}
            <div className="ui-table-container border border-zinc-200 rounded-lg overflow-hidden bg-white shadow-xs">
              <table className="ui-table w-full text-left border-collapse">
                <thead>
                  <tr className="bg-zinc-100 border-b border-zinc-200">
                    <th className="ui-table-th py-3 px-4 font-semibold text-xs text-zinc-600 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="ui-table-th py-3 px-4 font-semibold text-xs text-zinc-600 uppercase tracking-wider">
                      Mobile
                    </th>
                    <th className="ui-table-th py-3 px-4 font-semibold text-xs text-zinc-600 uppercase tracking-wider">
                      Points
                    </th>
                    <th className="ui-table-th py-3 px-4 font-semibold text-xs text-zinc-600 uppercase tracking-wider text-right">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {dataLoading ? (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-sm text-zinc-500">
                        Loading customers...
                      </td>
                    </tr>
                  ) : filteredCustomers.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-12 text-center">
                        <Users className="w-8 h-8 text-zinc-300 mx-auto mb-2" />
                        <p className="text-sm font-medium text-zinc-600">
                          {searchMobile
                            ? 'No customers match the mobile search.'
                            : 'No customers added yet.'}
                        </p>
                        <p className="text-xs text-zinc-400 mt-1">
                          {searchMobile
                            ? 'Please check the mobile number and try again.'
                            : 'Click "Add Customer" above to register your first customer.'}
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredCustomers.map((customer) => (
                      <tr
                        key={customer.id}
                        className="hover:bg-zinc-50 transition-colors"
                      >
                        {/* Name */}
                        <td className="py-3 px-4 text-sm text-black font-medium">
                          {customer.name}
                        </td>

                        {/* Mobile */}
                        <td className="py-3 px-4 text-sm text-zinc-700 font-mono">
                          {customer.mobile}
                        </td>

                        {/* Points */}
                        <td className="py-3 px-4 text-sm font-mono font-medium text-black">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-zinc-100 text-black border border-zinc-200">
                            {customer.points ?? 0} pts
                          </span>
                        </td>

                        {/* Open Button: Grey color, turns dark black on tap */}
                        <td className="py-3 px-4 text-sm text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => setSelectedCustomer(customer)}
                            className="ui-btn ui-btn-grey ui-btn-sm px-3 py-1 font-medium text-xs cursor-pointer inline-flex items-center gap-1.5"
                          >
                            <span>Open</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Results count indicator */}
            {!dataLoading && (
              <div className="flex items-center justify-between text-xs text-zinc-500 px-1">
                <span>
                  Showing {filteredCustomers.length} of {customers.length}{' '}
                  customers
                </span>
                {searchMobile && (
                  <button
                    type="button"
                    onClick={() => setSearchMobile('')}
                    className="text-black underline hover:text-zinc-700 cursor-pointer"
                  >
                    Clear search
                  </button>
                )}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Add Customer Modal */}
      {isAddModalOpen && (
        <AddCustomerModal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          onCustomerCreated={handleCustomerCreated}
        />
      )}

      {/* Open Customer Modal */}
      {selectedCustomer && (
        <OpenCustomerModal
          isOpen={Boolean(selectedCustomer)}
          customer={selectedCustomer}
          onClose={() => setSelectedCustomer(null)}
          onCustomerUpdated={handleCustomerUpdated}
        />
      )}
    </div>
  );
}
