'use client';

import React, { useState } from 'react';
import { X, Loader2, Ticket } from 'lucide-react';
import { CouponCode, updateCoupon } from '@/lib/couponsStore';

interface OpenCouponModalProps {
  isOpen: boolean;
  coupon: CouponCode;
  onClose: () => void;
  onCouponUpdated: (coupon: CouponCode) => void;
}

export default function OpenCouponModal({
  isOpen,
  coupon,
  onClose,
  onCouponUpdated,
}: OpenCouponModalProps) {
  const [code, setCode] = useState(coupon.code || '');
  const [discount, setDiscount] = useState<string>(coupon.discount?.toString() || '0');
  const [sentence, setSentence] = useState(coupon.sentence || '');
  const [threshold, setThreshold] = useState<string>(coupon.threshold?.toString() || '0');
  const [usage, setUsage] = useState<string>(coupon.usage?.toString() || '0');
  const [validUpto, setValidUpto] = useState(coupon.valid_upto || '');
  const [status, setStatus] = useState<boolean>(
    typeof coupon.status === 'boolean' ? coupon.status : true
  );
  const [isPublic, setIsPublic] = useState<boolean>(
    typeof coupon.is_public === 'boolean' ? coupon.is_public : false
  );

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) {
      setErrorMessage('Coupon code cannot be empty.');
      return;
    }
    if (!discount.trim() || isNaN(Number(discount)) || Number(discount) < 0) {
      setErrorMessage('A valid discount amount or value is required.');
      return;
    }

    setLoading(true);
    setErrorMessage('');

    try {
      const { data, error } = await updateCoupon(coupon.id, {
        code: code.trim().toUpperCase(),
        discount: Number(discount),
        sentence: sentence.trim() || null,
        threshold: Number(threshold) || 0,
        usage: Number(usage) || 0,
        valid_upto: validUpto || null,
        status,
        is_public: isPublic,
      });

      if (error && !data) {
        setErrorMessage(error.message || 'Failed to update coupon code.');
        setLoading(false);
        return;
      }

      if (data) {
        onCouponUpdated(data);
        onClose();
      }
    } catch {
      setErrorMessage('An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ui-dialog-backdrop p-4" role="dialog" aria-modal="true">
      <div className="ui-dialog-panel w-full max-w-lg bg-white rounded-lg shadow-xl border border-zinc-200 overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="ui-dialog-header flex items-center justify-between border-b border-zinc-200 px-6 py-4 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-zinc-100 rounded border border-zinc-200 text-black">
              <Ticket className="w-5 h-5" />
            </div>
            <div>
              <h2 className="typo-section-title text-base sm:text-lg font-bold text-black">
                Coupon Details
              </h2>
              <p className="typo-caption text-xs text-zinc-500 font-mono">
                Code: {coupon.code}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="ui-btn ui-btn-ghost ui-btn-sm p-1 text-black hover:bg-zinc-100 rounded cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5 text-black" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-6 space-y-4 overflow-y-auto flex-1">
            {errorMessage && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded">
                {errorMessage}
              </div>
            )}

            {/* Code */}
            <div className="ui-form-group">
              <label className="ui-form-label font-semibold text-xs text-zinc-700 uppercase tracking-wide">
                Coupon Code <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                required
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="e.g. FESTIVE20, FLAT100"
                className="ui-input text-black font-mono uppercase border border-zinc-300 focus:border-black"
                disabled={loading}
              />
            </div>

            {/* Discount & Threshold row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="ui-form-group">
                <label className="ui-form-label font-semibold text-xs text-zinc-700 uppercase tracking-wide">
                  Discount Amount (₹) <span className="text-red-600">*</span>
                </label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  required
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                  placeholder="e.g. 50 or 100"
                  className="ui-input text-black font-mono border border-zinc-300 focus:border-black"
                  disabled={loading}
                />
              </div>

              <div className="ui-form-group">
                <label className="ui-form-label font-semibold text-xs text-zinc-700 uppercase tracking-wide">
                  Min Threshold (₹)
                </label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={threshold}
                  onChange={(e) => setThreshold(e.target.value)}
                  placeholder="e.g. 500"
                  className="ui-input text-black font-mono border border-zinc-300 focus:border-black"
                  disabled={loading}
                />
              </div>
            </div>

            {/* Promo Sentence */}
            <div className="ui-form-group">
              <label className="ui-form-label font-semibold text-xs text-zinc-700 uppercase tracking-wide">
                Promotional Sentence / Description
              </label>
              <input
                type="text"
                value={sentence}
                onChange={(e) => setSentence(e.target.value)}
                placeholder="e.g. Get flat ₹100 off on orders above ₹499"
                className="ui-input text-black border border-zinc-300 focus:border-black"
                disabled={loading}
              />
            </div>

            {/* Valid Upto & Usage Count */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="ui-form-group">
                <label className="ui-form-label font-semibold text-xs text-zinc-700 uppercase tracking-wide">
                  Valid Upto (Date)
                </label>
                <input
                  type="date"
                  value={validUpto}
                  onChange={(e) => setValidUpto(e.target.value)}
                  className="ui-input text-black border border-zinc-300 focus:border-black"
                  disabled={loading}
                />
              </div>

              <div className="ui-form-group">
                <label className="ui-form-label font-semibold text-xs text-zinc-700 uppercase tracking-wide">
                  Usage Count
                </label>
                <input
                  type="number"
                  min="0"
                  value={usage}
                  onChange={(e) => setUsage(e.target.value)}
                  className="ui-input text-black font-mono border border-zinc-300 focus:border-black"
                  disabled={loading}
                />
              </div>
            </div>

            {/* Status & Is Public row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="ui-form-group">
                <label className="ui-form-label font-semibold text-xs text-zinc-700 uppercase tracking-wide">
                  Status
                </label>
                <select
                  value={status ? 'true' : 'false'}
                  onChange={(e) => setStatus(e.target.value === 'true')}
                  className="ui-select text-black border border-zinc-300 focus:border-black"
                  disabled={loading}
                >
                  <option value="true">Active (True)</option>
                  <option value="false">Inactive (False)</option>
                </select>
              </div>

              <div className="ui-form-group">
                <label className="ui-form-label font-semibold text-xs text-zinc-700 uppercase tracking-wide">
                  Is Public
                </label>
                <select
                  value={isPublic ? 'true' : 'false'}
                  onChange={(e) => setIsPublic(e.target.value === 'true')}
                  className="ui-select text-black border border-zinc-300 focus:border-black"
                  disabled={loading}
                >
                  <option value="false">No (Private / Exclusive)</option>
                  <option value="true">Yes (Public Banner / Storefront)</option>
                </select>
              </div>
            </div>

            {/* Created at / ID info */}
            <div className="pt-2 border-t border-zinc-100 flex items-center justify-between text-[11px] text-zinc-400">
              <span>Created: {new Date(coupon.created_at).toLocaleDateString()}</span>
              <span className="font-mono">ID: {coupon.id.slice(0, 8)}...</span>
            </div>
          </div>

          {/* Footer */}
          <div className="ui-dialog-footer flex items-center justify-end gap-3 px-6 py-4 bg-zinc-50 border-t border-zinc-200 flex-shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="ui-btn ui-btn-outline ui-btn-md text-black border-zinc-300 hover:bg-zinc-100 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="ui-btn ui-btn-grey ui-btn-md font-medium cursor-pointer shadow-xs"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
