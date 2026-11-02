'use client';

import React, { useState, useEffect } from 'react';
import { X, Loader2, Lock, ArrowDownCircle, AlertCircle } from 'lucide-react';
import {
  Distributor,
  DistributorTransaction,
  PaymentMethod,
  generateRandomTransactionId,
  recordDistributorTransaction,
} from '@/lib/distributorsStore';

interface AddTransactionsProps {
  isOpen: boolean;
  onClose: () => void;
  distributor: Distributor;
  onTransactionAdded: (transaction: DistributorTransaction, newBalance: number) => void;
}

const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'upi', label: 'UPI' },
  { value: 'card', label: 'Card' },
  { value: 'bill', label: 'Bill' },
  { value: 'other', label: 'Other' },
];

export default function AddTransactionsModal({
  isOpen,
  onClose,
  distributor,
  onTransactionAdded,
}: AddTransactionsProps) {
  const [transId, setTransId] = useState(() => generateRandomTransactionId());
  const [transType] = useState<'subtract'>('subtract'); // strictly only subtract
  const [paymentType, setPaymentType] = useState<PaymentMethod>('cash');
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const resetFormAndClose = () => {
    setTransId(generateRandomTransactionId());
    setAmount('');
    setNotes('');
    setPaymentType('cash');
    setErrorMessage('');
    onClose();
  };

  if (!isOpen) return null;

  const currentBalance = Number(distributor.balance || 0);
  const amountNum = Number(amount);
  const projectedBalance = !isNaN(amountNum) && amountNum > 0
    ? currentBalance - amountNum
    : currentBalance;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!transId.trim()) {
      setErrorMessage('Transaction ID is missing.');
      return;
    }

    if (!amount || isNaN(amountNum) || amountNum <= 0) {
      setErrorMessage('Please enter a valid transaction amount greater than 0.');
      return;
    }

    setLoading(true);

    try {
      const { data, newBalance, error } = await recordDistributorTransaction({
        distributor_id: distributor.id,
        trans_type: transType, // only subtract
        type: paymentType,
        trans_id: transId.trim(),
        amount: amountNum,
        notes: notes.trim() || undefined,
      });

      if (error || !data) {
        setErrorMessage(error?.message || 'Failed to save transaction.');
        setLoading(false);
        return;
      }

      onTransactionAdded(data, newBalance);
      resetFormAndClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'An unexpected error occurred.';
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ui-dialog-backdrop p-4 fixed inset-0 z-50 bg-black/50 flex items-center justify-center" role="dialog" aria-modal="true">
      <div className="ui-dialog-panel w-full max-w-lg bg-white rounded-lg shadow-xl border border-zinc-200 overflow-hidden">
        {/* Header */}
        <div className="ui-dialog-header flex items-center justify-between border-b border-zinc-200 px-6 py-4">
          <div>
            <h2 className="typo-section-title text-base sm:text-lg font-bold text-black flex items-center gap-2">
              <ArrowDownCircle className="w-5 h-5 text-red-600" />
              <span>Add Transaction</span>
            </h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              Debit / payout transaction for distributor ledger
            </p>
          </div>
          <button
            type="button"
            onClick={resetFormAndClose}
            disabled={loading}
            className="ui-btn ui-btn-ghost ui-btn-sm p-1 text-black hover:bg-zinc-100 rounded cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Auto-selected Distributor (Read-Only) */}
          <div className="ui-form-group">
            <label className="ui-form-label font-medium text-xs text-zinc-700 uppercase tracking-wide flex items-center justify-between">
              <span>Distributor</span>
              <span className="text-[11px] font-normal text-zinc-500 flex items-center gap-1">
                <Lock className="w-3 h-3 text-zinc-400" />
                Auto-selected
              </span>
            </label>
            <div className="p-2.5 bg-zinc-50 border border-zinc-200 rounded-md flex items-center justify-between text-xs">
              <div>
                <span className="font-bold text-black">{distributor.name}</span>
                <span className="ml-2 font-mono text-zinc-500">({distributor.distributor_id})</span>
                {distributor.company && (
                  <span className="text-zinc-500 block text-[11px]">{distributor.company}</span>
                )}
              </div>
              <div className="text-right">
                <span className="text-[10px] uppercase text-zinc-500 block font-semibold">Current Balance</span>
                <span className="font-mono font-bold text-black text-xs">
                  ₹{currentBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>

          {/* Transaction ID & Transaction Type */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Auto-generated Transaction ID: trans(5 random numbers) */}
            <div className="ui-form-group">
              <label className="ui-form-label font-medium text-xs text-zinc-700 uppercase tracking-wide flex items-center justify-between">
                <span>Transaction ID</span>
                <span className="text-[11px] font-normal text-zinc-500 flex items-center gap-1">
                  <Lock className="w-3 h-3 text-zinc-400" />
                  Auto-generated
                </span>
              </label>
              <input
                type="text"
                value={transId}
                readOnly
                disabled
                className="ui-input text-xs font-mono font-bold text-black bg-zinc-100 border border-zinc-300 rounded-md w-full px-3 py-2 cursor-not-allowed select-none"
              />
              <span className="ui-form-helper text-[11px] text-zinc-400 mt-1 block">
                Format: trans(5 random numbers)
              </span>
            </div>

            {/* trans_type: only subtract */}
            <div className="ui-form-group">
              <label className="ui-form-label font-medium text-xs text-zinc-700 uppercase tracking-wide flex items-center justify-between">
                <span>Transaction Type</span>
                <span className="text-[11px] font-normal text-zinc-500 flex items-center gap-1">
                  <Lock className="w-3 h-3 text-zinc-400" />
                  Locked
                </span>
              </label>
              <div className="ui-input text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded-md w-full px-3 py-2 flex items-center justify-between select-none">
                <span>Subtract (Debit / Payment)</span>
                <span className="font-mono text-xs bg-red-100 px-2 py-0.5 rounded text-red-800">
                  subtract
                </span>
              </div>
              <span className="ui-form-helper text-[11px] text-zinc-400 mt-1 block">
                Transactions here strictly subtract from balance.
              </span>
            </div>
          </div>

          {/* Payment Method / Type & Amount */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Payment Method / Type */}
            <div className="ui-form-group">
              <label className="ui-form-label font-medium text-xs text-zinc-700 uppercase tracking-wide">
                Payment Type <span className="text-red-500">*</span>
              </label>
              <select
                value={paymentType}
                onChange={(e) => setPaymentType(e.target.value as PaymentMethod)}
                className="ui-input text-xs text-black bg-white border border-zinc-300 focus:border-black rounded-md w-full px-3 py-2"
              >
                {PAYMENT_METHODS.map((method) => (
                  <option key={method.value} value={method.value}>
                    {method.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Amount */}
            <div className="ui-form-group">
              <label className="ui-form-label font-medium text-xs text-zinc-700 uppercase tracking-wide">
                Amount (₹) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                className="ui-input text-xs font-mono font-semibold text-black bg-white border border-zinc-300 focus:border-black rounded-md w-full px-3 py-2"
                autoFocus
              />
            </div>
          </div>

          {/* Balance Preview info */}
          {amountNum > 0 && !isNaN(amountNum) && (
            <div className="p-3 bg-zinc-50 border border-zinc-200 rounded-md flex items-center justify-between text-xs">
              <span className="text-zinc-600 font-medium">New Balance after subtraction:</span>
              <span className="font-mono font-bold text-black text-sm">
                ₹{projectedBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>
          )}

          {/* Notes */}
          <div className="ui-form-group">
            <label className="ui-form-label font-medium text-xs text-zinc-700 uppercase tracking-wide">
              Notes
            </label>
            <textarea
              rows={2}
              placeholder="e.g. Bank transfer reference, cheque number, receipt notes..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="ui-input text-xs text-black bg-white border border-zinc-300 focus:border-black rounded-md w-full p-3 resize-none"
            />
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-200">
            <button
              type="button"
              onClick={resetFormAndClose}
              disabled={loading}
              className="ui-btn ui-btn-outline ui-btn-sm text-xs px-4 py-2 cursor-pointer font-medium text-zinc-700 hover:bg-zinc-100 rounded-md"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="ui-btn ui-btn-primary ui-btn-sm text-xs px-5 py-2 cursor-pointer font-semibold bg-black text-white hover:bg-zinc-800 rounded-md flex items-center gap-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin text-white" />}
              <span>Save</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
