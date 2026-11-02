'use client';

import React, { useState } from 'react';
import { X, Store, Lock, KeyRound, Eye, EyeOff, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { StoreItem, updateStore } from '@/lib/stores';

interface OpenStoreProps {
  isOpen: boolean;
  store: StoreItem;
  onClose: () => void;
  onStoreUpdated: (updatedStore: StoreItem) => void;
}

export default function OpenStoreModal({
  isOpen,
  store,
  onClose,
  onStoreUpdated,
}: OpenStoreProps) {
  // Store details: store_id and email are locked (not editable)
  const [name, setName] = useState(store.name || '');
  const [address, setAddress] = useState(store.address || '');
  const [mobile, setMobile] = useState(store.mobile || '');

  // Password change state
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!name.trim()) {
      setErrorMessage('Store name cannot be empty.');
      return;
    }

    if (newPassword && newPassword.length < 6) {
      setErrorMessage('New password must be at least 6 characters long.');
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await updateStore(store.id, {
        name: name.trim(),
        address: address.trim() || null,
        mobile: mobile.trim() || null,
        newPassword: newPassword.trim() || null,
      });

      if (error && !data) {
        setErrorMessage(error.message || 'Failed to update store details.');
        setLoading(false);
        return;
      }

      if (data) {
        onStoreUpdated(data);
        setSuccessMessage('Store details updated successfully.');
        setNewPassword('');
        setTimeout(() => {
          onClose();
        }, 1000);
      }
    } catch {
      setErrorMessage('An unexpected error occurred while saving.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="ui-dialog-backdrop p-4 fixed inset-0 bg-black/50 z-50 flex items-center justify-center backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
    >
      <div className="ui-dialog-panel w-full max-w-lg bg-white rounded-lg shadow-xl border border-zinc-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="ui-dialog-header flex items-center justify-between border-b border-zinc-200 px-6 py-4 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-zinc-100 rounded-lg text-black border border-zinc-200">
              <Store className="w-5 h-5 text-black" />
            </div>
            <div>
              <h2 className="typo-section-title text-base sm:text-lg font-bold text-black flex items-center gap-2">
                <span>Store Details</span>
                <span className="font-mono text-xs px-2 py-0.5 bg-zinc-100 rounded border border-zinc-200">
                  {store.store_id}
                </span>
              </h2>
              <p className="typo-caption text-xs text-zinc-500">
                View or edit store parameters and update store credentials
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
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded flex items-start gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            {successMessage && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>{successMessage}</span>
              </div>
            )}

            {/* store_id (Read-only, Cannot be edited) */}
            <div className="ui-form-group mb-0">
              <label className="ui-form-label font-semibold text-xs text-zinc-700 uppercase tracking-wide mb-1 flex items-center justify-between">
                <span>Store ID</span>
                <span className="text-[11px] font-normal text-zinc-400 flex items-center gap-1">
                  <Lock className="w-3 h-3 text-zinc-400" />
                  Non-editable
                </span>
              </label>
              <input
                type="text"
                value={store.store_id}
                readOnly
                disabled
                className="ui-input text-xs font-mono font-bold text-black bg-zinc-100 border border-zinc-300 rounded-md w-full h-9 px-3 cursor-not-allowed select-none"
              />
            </div>

            {/* Email (Read-only, Cannot be edited) */}
            <div className="ui-form-group mb-0">
              <label className="ui-form-label font-semibold text-xs text-zinc-700 uppercase tracking-wide mb-1 flex items-center justify-between">
                <span>Store Email (Username)</span>
                <span className="text-[11px] font-normal text-zinc-400 flex items-center gap-1">
                  <Lock className="w-3 h-3 text-zinc-400" />
                  Non-editable
                </span>
              </label>
              <input
                type="email"
                value={store.email || ''}
                readOnly
                disabled
                className="ui-input text-xs font-mono text-zinc-600 bg-zinc-100 border border-zinc-300 rounded-md w-full h-9 px-3 cursor-not-allowed select-none"
              />
            </div>

            {/* Store Name (Editable) */}
            <div className="ui-form-group mb-0">
              <label className="ui-form-label font-semibold text-xs text-zinc-700 uppercase tracking-wide mb-1 block">
                Store Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="ui-input text-xs text-black bg-white border border-zinc-300 focus:border-black rounded-md w-full h-9 px-3"
              />
            </div>

            {/* Mobile (Editable) */}
            <div className="ui-form-group mb-0">
              <label className="ui-form-label font-semibold text-xs text-zinc-700 uppercase tracking-wide mb-1 block">
                Mobile Number
              </label>
              <input
                type="tel"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                placeholder="e.g. 9876543210"
                className="ui-input text-xs text-black bg-white border border-zinc-300 focus:border-black rounded-md w-full h-9 px-3 font-mono"
              />
            </div>

            {/* Address (Editable) */}
            <div className="ui-form-group mb-0">
              <label className="ui-form-label font-semibold text-xs text-zinc-700 uppercase tracking-wide mb-1 block">
                Store Address
              </label>
              <textarea
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Location, street, landmark, city..."
                rows={2}
                className="ui-textarea text-xs text-black bg-white border border-zinc-300 focus:border-black rounded-md w-full p-2.5 resize-none"
              />
            </div>

            {/* Change Store Password Section */}
            <div className="pt-3 border-t border-zinc-200">
              <div className="flex items-center gap-2 mb-1.5">
                <KeyRound className="w-3.5 h-3.5 text-black" />
                <label className="ui-form-label font-bold text-xs text-black uppercase tracking-wider block mb-0">
                  Change Store Password
                </label>
              </div>
              <p className="text-[11px] text-zinc-500 mb-2">
                Enter a new password below to reset the store&apos;s login credentials. Leave blank if you don&apos;t want to change it.
              </p>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password (optional)"
                  minLength={6}
                  className="ui-input text-xs text-black bg-white border border-zinc-300 focus:border-black rounded-md w-full h-9 px-3 pr-9 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-black cursor-pointer p-0.5"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="w-3.5 h-3.5" />
                  ) : (
                    <Eye className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="ui-dialog-footer border-t border-zinc-200 px-6 py-4 flex items-center justify-end gap-3 bg-zinc-50 flex-shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="ui-btn ui-btn-outline ui-btn-md text-xs text-black border-zinc-300 hover:bg-zinc-100 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="ui-btn ui-btn-grey ui-btn-md px-5 py-2 text-xs font-medium cursor-pointer flex items-center gap-1.5 shadow-xs"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>Save Changes</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
