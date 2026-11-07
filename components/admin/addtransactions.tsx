'use client';

import React, { useState, useRef } from 'react';
import {
  X,
  Loader2,
  Lock,
  ArrowDownCircle,
  AlertCircle,
  UploadCloud,
  Image as ImageIcon,
  Trash2,
  RefreshCw,
} from 'lucide-react';
import {
  Distributor,
  DistributorTransaction,
  PaymentMethod,
  generateRandomTransactionId,
  recordDistributorTransaction,
  uploadPaymentProofImage,
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

  // Proof Image states
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreviewUrl, setProofPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const resetFormAndClose = () => {
    if (proofPreviewUrl) {
      URL.revokeObjectURL(proofPreviewUrl);
    }
    setProofFile(null);
    setProofPreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    setTransId(generateRandomTransactionId());
    setAmount('');
    setNotes('');
    setPaymentType('cash');
    setErrorMessage('');
    onClose();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMessage('Please select a valid image file (JPEG, PNG, WebP, etc.).');
      return;
    }

    if (proofPreviewUrl) {
      URL.revokeObjectURL(proofPreviewUrl);
    }

    setProofFile(file);
    setProofPreviewUrl(URL.createObjectURL(file));
    setErrorMessage('');
  };

  const handleRemoveProof = () => {
    if (proofPreviewUrl) {
      URL.revokeObjectURL(proofPreviewUrl);
    }
    setProofFile(null);
    setProofPreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
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
      let uploadedProofUrl: string | null = null;
      if (proofFile) {
        const { publicUrl, error: uploadErr } = await uploadPaymentProofImage(
          proofFile,
          transId.trim()
        );
        if (uploadErr) {
          setErrorMessage(
            uploadErr.message || 'Failed to upload proof image to payment_trans_proofs bucket.'
          );
          setLoading(false);
          return;
        }
        uploadedProofUrl = publicUrl;
      }

      const { data, newBalance, error } = await recordDistributorTransaction({
        distributor_id: distributor.id,
        trans_type: transType, // only subtract
        type: paymentType,
        trans_id: transId.trim(),
        amount: amountNum,
        notes: notes.trim() || undefined,
        proof_url: uploadedProofUrl,
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
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      onClick={resetFormAndClose}
    >
      <div
        className="w-full max-w-lg bg-white rounded-xl shadow-2xl border border-zinc-200 overflow-hidden flex flex-col max-h-[88vh] my-auto animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header - Fixed */}
        <div className="flex items-center justify-between border-b border-zinc-200 px-5 sm:px-6 py-3.5 bg-zinc-50 flex-shrink-0">
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
            className="ui-btn ui-btn-ghost ui-btn-sm p-1.5 text-zinc-500 hover:text-black hover:bg-zinc-200 rounded-md cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Container */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          {/* Scrollable Form Body */}
          <div className="flex-1 min-h-0 overflow-y-auto px-5 sm:px-6 py-4 space-y-4">
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

          {/* Payment Proof Image */}
          <div className="ui-form-group">
            <label className="ui-form-label font-medium text-xs text-zinc-700 uppercase tracking-wide flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <ImageIcon className="w-3.5 h-3.5 text-zinc-500" />
                Payment Proof Image (Receipt / Cheque / Screenshot)
              </span>
              {proofFile && (
                <span className="text-[11px] font-normal text-emerald-600">
                  Ready to upload on save
                </span>
              )}
            </label>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />

            {!proofPreviewUrl ? (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full border-2 border-dashed border-zinc-300 hover:border-black rounded-lg p-3.5 flex flex-col items-center justify-center gap-1 bg-zinc-50 hover:bg-zinc-100 transition-colors cursor-pointer text-center group"
              >
                <UploadCloud className="w-5 h-5 text-zinc-400 group-hover:text-black transition-colors" />
                <span className="text-xs font-semibold text-zinc-700 group-hover:text-black">
                  Click to attach payment proof image
                </span>
                <span className="text-[11px] text-zinc-400">
                  PNG, JPG, WebP &bull; Uploads to payment_trans_proofs bucket
                </span>
              </button>
            ) : (
              <div className="p-3 bg-zinc-50 border border-zinc-200 rounded-lg flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="relative w-12 h-12 rounded-md overflow-hidden bg-zinc-200 border border-zinc-300 flex-shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={proofPreviewUrl}
                      alt="Proof preview"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-black truncate">
                      {proofFile?.name || 'Selected proof image'}
                    </p>
                    <p className="text-[11px] text-zinc-500 font-mono">
                      {proofFile ? `${(proofFile.size / 1024).toFixed(1)} KB` : ''}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="ui-btn ui-btn-outline ui-btn-sm text-xs px-2.5 py-1 text-zinc-700 hover:text-black border-zinc-300 hover:bg-zinc-100 cursor-pointer flex items-center gap-1"
                    title="Change image"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Change</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleRemoveProof}
                    className="ui-btn ui-btn-outline ui-btn-sm text-xs px-2 py-1 text-red-600 hover:text-red-700 border-red-200 hover:bg-red-50 cursor-pointer"
                    title="Remove image"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Fixed Footer Actions */}
        <div className="flex items-center justify-end gap-3 px-5 sm:px-6 py-3.5 border-t border-zinc-200 bg-zinc-50 flex-shrink-0">
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
