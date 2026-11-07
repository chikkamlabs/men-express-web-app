'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Receipt,
  Truck,
  Plus,
  Loader2,
  AlertCircle,
  Phone,
  Building2,
  Calendar,
  ArrowUpRight,
  ArrowDownLeft,
  RefreshCw,
  Wallet,
} from 'lucide-react';
import { getCurrentSupabaseUser } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import AdminHeader from '@/components/admin/header';
import AdminSidebar from '@/components/admin/sidebar';
import {
  Distributor,
  DistributorTransaction,
  getDistributorById,
  getDistributorTransactions,
} from '@/lib/distributorsStore';
import AddTransactionsModal from '@/components/admin/addtransactions';
import TransactionProofModal from '@/components/admin/transactionproff';

function DistributorTransactionsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const distributorParam =
    searchParams.get('id') || searchParams.get('distributor_id') || '';

  const [isAuthorized, setIsAuthorized] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [distributor, setDistributor] = useState<Distributor | null>(null);
  const [transactions, setTransactions] = useState<DistributorTransaction[]>([]);
  const [loading, setLoading] = useState(Boolean(distributorParam));
  const [error, setError] = useState<string | null>(
    distributorParam ? null : 'No distributor ID provided.'
  );

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedProofTx, setSelectedProofTx] = useState<DistributorTransaction | null>(null);

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

  // Load Distributor and its Transactions
  useEffect(() => {
    let ignore = false;

    if (isAuthorized && distributorParam) {
      Promise.all([
        getDistributorById(distributorParam),
        getDistributorTransactions(distributorParam),
      ]).then(([distRes, transRes]) => {
        if (ignore) return;
        if (distRes.error || !distRes.data) {
          setError(distRes.error?.message || 'Distributor could not be found.');
          setLoading(false);
        } else {
          setDistributor(distRes.data);
          setTransactions(transRes.data || []);
          setLoading(false);
        }
      });
    }

    return () => {
      ignore = true;
    };
  }, [isAuthorized, distributorParam]);

  // When a transaction is added via the modal
  const handleTransactionAdded = (
    newTransaction: DistributorTransaction,
    newBalance: number
  ) => {
    setTransactions((prev) => [newTransaction, ...prev]);
    setDistributor((prev) => (prev ? { ...prev, balance: newBalance } : prev));
  };

  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-50">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-black" />
          <p className="text-sm text-zinc-600">Verifying administrator access...</p>
        </div>
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
          <div className="max-w-6xl mx-auto space-y-6">
            {/* Back link & Top bar */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-zinc-200">
              <div className="space-y-1">
                <Link
                  href="/admin/distributors"
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-600 hover:text-black transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to Distributors</span>
                </Link>
                <div className="flex items-center gap-3 pt-1">
                  <div className="p-2.5 bg-zinc-100 rounded-lg text-black border border-zinc-200">
                    <Receipt className="w-6 h-6 text-black" />
                  </div>
                  <div>
                    <h1 className="typo-page-title text-xl sm:text-2xl font-bold text-black tracking-tight">
                      Distributor Transactions
                    </h1>
                    <p className="typo-caption text-xs sm:text-sm text-zinc-500">
                      View supplier ledger, purchases, payouts, and balance updates
                    </p>
                  </div>
                </div>
              </div>

              {distributor && (
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(true)}
                  className="ui-btn ui-btn-primary ui-btn-md px-4 py-2 font-medium text-xs sm:text-sm cursor-pointer inline-flex items-center gap-2 bg-black text-white hover:bg-zinc-800 rounded-md self-start sm:self-auto"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Transaction</span>
                </button>
              )}
            </div>

            {/* Error Message */}
            {!loading && error && (
              <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm flex items-start gap-2.5">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-xs">Cannot load transactions</p>
                  <p className="text-xs mt-0.5">{error}</p>
                  <Link
                    href="/admin/distributors"
                    className="text-xs underline font-semibold text-black mt-2 inline-block"
                  >
                    Return to Distributors
                  </Link>
                </div>
              </div>
            )}

            {/* Loading Indicator */}
            {loading && (
              <div className="p-12 text-center text-zinc-500">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-zinc-400" />
                <p className="text-sm font-medium">Loading distributor and transactions...</p>
              </div>
            )}

            {/* Distributor Info Card */}
            {!loading && distributor && (
              <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-zinc-900">{distributor.name}</h2>
                    <span className="font-mono text-xs px-2 py-0.5 bg-zinc-200 text-zinc-800 rounded font-semibold">
                      {distributor.distributor_id}
                    </span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded font-medium ${
                        distributor.status === 'active'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-zinc-200 text-zinc-600'
                      }`}
                    >
                      {distributor.status}
                    </span>
                  </div>

                  <div className="flex items-center gap-4 text-xs text-zinc-600 pt-1 flex-wrap">
                    {distributor.company && (
                      <span className="flex items-center gap-1">
                        <Building2 className="w-3.5 h-3.5 text-zinc-400" />
                        <span>{distributor.company}</span>
                      </span>
                    )}
                    {distributor.mobile && (
                      <span className="flex items-center gap-1 font-mono">
                        <Phone className="w-3.5 h-3.5 text-zinc-400" />
                        <span>{distributor.mobile}</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Current Balance Card */}
                <div className="px-5 py-3 bg-white border border-zinc-200 rounded-lg flex items-center gap-4 text-right">
                  <div className="p-2.5 rounded-lg bg-zinc-100 text-zinc-700">
                    <Wallet className="w-6 h-6 text-black" />
                  </div>
                  <div>
                    <div className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">
                      Current Ledger Balance
                    </div>
                    <div className="text-xl sm:text-2xl font-bold font-mono text-zinc-900">
                      ₹
                      {Number(distributor.balance || 0).toLocaleString('en-IN', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Distributor Transactions Table */}
            {!loading && distributor && (
              <div className="ui-card bg-white border border-zinc-200 rounded-lg shadow-xs overflow-hidden">
                <div className="p-4 sm:p-5 border-b border-zinc-200 flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-sm text-zinc-900 flex items-center gap-2">
                      <Receipt className="w-4 h-4 text-zinc-600" />
                      <span>Ledger Transactions</span>
                    </h3>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      Chronological history of additions (bills/purchases) and subtractions (payments)
                    </p>
                  </div>
                  <span className="text-xs font-mono bg-zinc-100 px-2 py-1 rounded text-zinc-600 border border-zinc-200">
                    {transactions.length} record{transactions.length === 1 ? '' : 's'}
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-zinc-50 border-b border-zinc-200 text-zinc-600 text-xs font-bold uppercase tracking-wider">
                        <th className="py-3 px-4">Trans ID &amp; Date</th>
                        <th className="py-3 px-4">Trans Type</th>
                        <th className="py-3 px-4">Payment Type</th>
                        <th className="py-3 px-4">Amount</th>
                        <th className="py-3 px-4">Balance</th>
                        <th className="py-3 px-4 text-center">Proof</th>
                        <th className="py-3 px-4">Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200 text-xs">
                      {transactions.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-12 text-center text-zinc-500">
                            <Receipt className="w-8 h-8 text-zinc-300 mx-auto mb-2" />
                            <p className="font-medium text-sm text-zinc-700">No transactions recorded yet.</p>
                            <p className="text-xs text-zinc-400 mt-1">
                              Tap &quot;Add Transaction&quot; above to log payments or deduct from balance.
                            </p>
                          </td>
                        </tr>
                      ) : (
                        transactions.map((tx) => (
                          <tr key={tx.id} className="hover:bg-zinc-50/70 transition-colors">
                            {/* Trans ID & Date */}
                            <td className="py-3 px-4">
                              <div className="font-mono font-bold text-black text-xs">
                                {tx.trans_id || '—'}
                              </div>
                              <div className="text-[11px] text-zinc-500 font-mono mt-0.5 flex items-center gap-1">
                                <Calendar className="w-3 h-3 text-zinc-400" />
                                <span>
                                  {new Date(tx.created_at).toLocaleString('en-IN', {
                                    dateStyle: 'medium',
                                    timeStyle: 'short',
                                  })}
                                </span>
                              </div>
                            </td>

                            {/* Trans Type (add vs subtract) */}
                            <td className="py-3 px-4 whitespace-nowrap">
                              {tx.trans_type === 'add' ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                  <ArrowUpRight className="w-3.5 h-3.5 text-emerald-600" />
                                  <span>Add (+)</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-semibold bg-red-100 text-red-800 border border-red-200">
                                  <ArrowDownLeft className="w-3.5 h-3.5 text-red-600" />
                                  <span>Subtract (-)</span>
                                </span>
                              )}
                            </td>

                            {/* Payment Type */}
                            <td className="py-3 px-4 uppercase whitespace-nowrap">
                              <span className="inline-block px-2 py-0.5 font-mono text-[11px] font-semibold rounded bg-zinc-100 text-zinc-800 border border-zinc-200">
                                {tx.type || 'cash'}
                              </span>
                            </td>

                            {/* Amount */}
                            <td className="py-3 px-4 whitespace-nowrap font-mono font-bold text-sm">
                              <span className={tx.trans_type === 'add' ? 'text-emerald-700' : 'text-red-700'}>
                                {tx.trans_type === 'add' ? '+' : '-'}₹
                                {Number(tx.amount || 0).toLocaleString('en-IN', {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                              </span>
                            </td>

                            {/* Balance */}
                            <td className="py-3 px-4 whitespace-nowrap font-mono font-semibold text-black text-xs">
                              ₹
                              {Number(tx.balance || 0).toLocaleString('en-IN', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </td>

                            {/* Proof Column: Just Show Receipt icon if tap open components/admin/transactionproff.tsx */}
                            <td className="py-3 px-4 text-center whitespace-nowrap">
                              {tx.proof_url ? (
                                <button
                                  type="button"
                                  onClick={() => setSelectedProofTx(tx)}
                                  className="inline-flex items-center justify-center p-1.5 rounded-md text-zinc-700 hover:text-black hover:bg-zinc-100 border border-zinc-200 transition-colors cursor-pointer shadow-2xs group"
                                  title="View Proof Image"
                                >
                                  <Receipt className="w-4 h-4 text-zinc-600 group-hover:text-black" />
                                </button>
                              ) : (
                                <span className="text-zinc-300 font-mono text-xs">—</span>
                              )}
                            </td>

                            {/* Notes */}
                            <td className="py-3 px-4 text-zinc-600 max-w-xs truncate">
                              {tx.notes || <span className="text-zinc-400 italic">No notes</span>}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Add Transaction Modal */}
      {isAddModalOpen && distributor && (
        <AddTransactionsModal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          distributor={distributor}
          onTransactionAdded={handleTransactionAdded}
        />
      )}

      {/* Proof Image Modal */}
      {selectedProofTx && (
        <TransactionProofModal
          isOpen={Boolean(selectedProofTx)}
          onClose={() => setSelectedProofTx(null)}
          transaction={selectedProofTx}
        />
      )}
    </div>
  );
}

export default function AdminDistributorTransactionsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-zinc-50">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-black" />
            <p className="text-sm text-zinc-600">Loading transactions ledger...</p>
          </div>
        </div>
      }
    >
      <DistributorTransactionsContent />
    </Suspense>
  );
}
