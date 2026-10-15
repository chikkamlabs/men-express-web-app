'use client';

import React, { useState } from 'react';
import { X, Loader2, RotateCw } from 'lucide-react';
import {
  Customer,
  createCustomer,
  generateCustomerKey,
} from '@/lib/customersStore';

interface AddCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCustomerCreated: (customer: Customer) => void;
}

export default function AddCustomerModal({
  isOpen,
  onClose,
  onCustomerCreated,
}: AddCustomerModalProps) {
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [key, setKey] = useState(() => generateCustomerKey());
  const [points, setPoints] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  if (!isOpen) return null;

  const handleClose = () => {
    setName('');
    setMobile('');
    setKey(generateCustomerKey());
    setPoints(0);
    setErrorMessage('');
    onClose();
  };

  const handleRegenerateKey = () => {
    setKey(generateCustomerKey());
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMessage('Customer name is required.');
      return;
    }
    if (!mobile.trim()) {
      setErrorMessage('Mobile number is required.');
      return;
    }
    if (!key.trim()) {
      setErrorMessage('Customer key is required.');
      return;
    }

    setLoading(true);
    setErrorMessage('');

    try {
      const { data, error } = await createCustomer({
        name: name.trim(),
        mobile: mobile.trim(),
        key: key.trim(),
        points: Number(points) || 0,
      });

      if (error && !data) {
        setErrorMessage(error.message || 'Failed to create customer.');
        setLoading(false);
        return;
      }

      if (data) {
        onCustomerCreated(data);
        handleClose();
      }
    } catch {
      setErrorMessage('An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ui-dialog-backdrop p-4" role="dialog" aria-modal="true">
      <div className="ui-dialog-panel w-full max-w-lg bg-white rounded-lg shadow-xl border border-zinc-200 overflow-hidden">
        {/* Header */}
        <div className="ui-dialog-header flex items-center justify-between border-b border-zinc-200 px-6 py-4">
          <h2 className="typo-section-title text-base sm:text-lg font-bold text-black">
            Add Customer
          </h2>
          <button
            type="button"
            onClick={handleClose}
            disabled={loading}
            className="ui-btn ui-btn-ghost ui-btn-sm p-1 text-black hover:bg-zinc-100 rounded cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5 text-black" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4">
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
                placeholder="e.g. John Doe"
                className="ui-input text-black border border-zinc-300 focus:border-black"
                disabled={loading}
              />
            </div>

            {/* Mobile */}
            <div className="ui-form-group">
              <label className="ui-form-label font-semibold text-xs text-zinc-700 uppercase tracking-wide">
                Mobile <span className="text-red-600">*</span>
              </label>
              <input
                type="tel"
                required
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                placeholder="e.g. 9876543210"
                className="ui-input text-black border border-zinc-300 focus:border-black font-mono"
                disabled={loading}
              />
            </div>

            {/* Key: Auto-generated 5-digit number */}
            <div className="ui-form-group">
              <div className="flex items-center justify-between">
                <label className="ui-form-label font-semibold text-xs text-zinc-700 uppercase tracking-wide">
                  Customer Key (5 Digits) <span className="text-red-600">*</span>
                </label>
                <button
                  type="button"
                  onClick={handleRegenerateKey}
                  className="text-xs text-zinc-600 hover:text-black flex items-center gap-1 cursor-pointer"
                  title="Generate another 5-digit key"
                >
                  <RotateCw className="w-3 h-3" />
                  <span>Generate new</span>
                </button>
              </div>
              <input
                type="text"
                required
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="5-digit customer key"
                className="ui-input text-black border border-zinc-300 focus:border-black font-mono tracking-widest font-semibold"
                disabled={loading}
              />
              <span className="ui-form-helper text-xs text-zinc-500 mt-1">
                Auto-generated 5-digit unique key.
              </span>
            </div>

            {/* Points */}
            <div className="ui-form-group">
              <label className="ui-form-label font-semibold text-xs text-zinc-700 uppercase tracking-wide">
                Loyalty Points
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
              onClick={handleClose}
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
                  Creating...
                </>
              ) : (
                'Create'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
