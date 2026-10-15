'use client';

import React, { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { Customer, updateCustomer } from '@/lib/customersStore';

interface OpenCustomerProps {
  isOpen: boolean;
  customer: Customer;
  onClose: () => void;
  onCustomerUpdated: (customer: Customer) => void;
}

export default function OpenCustomerModal({
  isOpen,
  customer,
  onClose,
  onCustomerUpdated,
}: OpenCustomerProps) {
  const [name, setName] = useState(customer.name || '');
  const [mobile, setMobile] = useState(customer.mobile || '');
  const [email, setEmail] = useState(customer.email || '');
  const [key, setKey] = useState(customer.key || '');
  const [points, setPoints] = useState<number>(customer.points ?? 0);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMessage('Customer name cannot be empty.');
      return;
    }
    if (!mobile.trim()) {
      setErrorMessage('Mobile number cannot be empty.');
      return;
    }
    if (!key.trim()) {
      setErrorMessage('Customer key cannot be empty.');
      return;
    }

    setLoading(true);
    setErrorMessage('');

    try {
      const { data, error } = await updateCustomer(customer.id, {
        name: name.trim(),
        mobile: mobile.trim(),
        email: email.trim() || null,
        key: key.trim(),
        points: Math.max(0, Number(points) || 0),
      });

      if (error && !data) {
        setErrorMessage(error.message || 'Failed to update customer.');
        setLoading(false);
        return;
      }

      if (data) {
        onCustomerUpdated(data);
        onClose();
      }
    } catch {
      setErrorMessage('An unexpected error occurred while saving.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ui-dialog-backdrop p-4" role="dialog" aria-modal="true">
      <div className="ui-dialog-panel w-full max-w-lg bg-white rounded-lg shadow-xl border border-zinc-200 overflow-hidden">
        {/* Header */}
        <div className="ui-dialog-header flex items-center justify-between border-b border-zinc-200 px-6 py-4">
          <div>
            <h2 className="typo-section-title text-base sm:text-lg font-bold text-black">
              Customer Details
            </h2>
            <p className="typo-caption text-xs text-zinc-500">
              Mobile: {customer.mobile}
            </p>
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

        {/* Form Body - Allows editing everything */}
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
            {errorMessage && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded">
                {errorMessage}
              </div>
            )}

            {/* Name */}
            <div className="ui-form-group">
              <label className="ui-form-label font-semibold text-xs text-zinc-700 uppercase tracking-wide">
                Customer Name <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Customer Name"
                className="ui-input text-black border border-zinc-300 focus:border-black"
                disabled={loading}
              />
            </div>

            {/* Mobile */}
            <div className="ui-form-group">
              <label className="ui-form-label font-semibold text-xs text-zinc-700 uppercase tracking-wide">
                Mobile Number <span className="text-red-600">*</span>
              </label>
              <input
                type="tel"
                required
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                placeholder="Mobile number"
                className="ui-input text-black border border-zinc-300 focus:border-black font-mono"
                disabled={loading}
              />
            </div>

            {/* Email */}
            <div className="ui-form-group">
              <label className="ui-form-label font-semibold text-xs text-zinc-700 uppercase tracking-wide">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="customer@example.com"
                className="ui-input text-black border border-zinc-300 focus:border-black"
                disabled={loading}
              />
            </div>

            {/* Key */}
            <div className="ui-form-group">
              <label className="ui-form-label font-semibold text-xs text-zinc-700 uppercase tracking-wide">
                Customer Key <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                required
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="Customer key"
                className="ui-input text-black border border-zinc-300 focus:border-black font-mono"
                disabled={loading}
              />
              <span className="ui-form-helper text-xs text-zinc-500 mt-1">
                Unique identifier key for loyalty points and in-store verification.
              </span>
            </div>

            {/* Points */}
            <div className="ui-form-group">
              <label className="ui-form-label font-semibold text-xs text-zinc-700 uppercase tracking-wide">
                Points
              </label>
              <input
                type="number"
                min="0"
                value={points}
                onChange={(e) => setPoints(Math.max(0, parseInt(e.target.value, 10) || 0))}
                placeholder="0"
                className="ui-input text-black border border-zinc-300 focus:border-black font-mono"
                disabled={loading}
              />
            </div>
          </div>

          {/* Footer with grey button that turns dark black on tap */}
          <div className="ui-dialog-footer flex items-center justify-end gap-3 px-6 py-4 bg-zinc-50 border-t border-zinc-200">
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
              className="ui-btn ui-btn-grey ui-btn-md font-medium cursor-pointer"
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
