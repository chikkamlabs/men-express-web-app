'use client';

import React, { useState } from 'react';
import { X, Store, Lock, Eye, EyeOff, Loader2, AlertCircle } from 'lucide-react';
import { StoreItem, createStore, calculateNextStoreId } from '@/lib/stores';

interface AddStoreProps {
  isOpen: boolean;
  onClose: () => void;
  existingStores?: StoreItem[];
  onStoreCreated: (newStore: StoreItem) => void;
}

export default function AddStoreModal({
  isOpen,
  onClose,
  existingStores = [],
  onStoreCreated,
}: AddStoreProps) {
  // Auto-generate store_id formula: store_1 + 1 on every new store
  const [storeId] = useState(() => calculateNextStoreId(existingStores));
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!name.trim()) {
      setErrorMessage('Store name is required.');
      return;
    }

    if (!email.trim() || !email.includes('@')) {
      setErrorMessage('A valid email address is required for store login credentials.');
      return;
    }

    if (!password || password.length < 6) {
      setErrorMessage('Password must be at least 6 characters long.');
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await createStore({
        store_id: storeId,
        name: name.trim(),
        address: address.trim() || null,
        mobile: mobile.trim() || null,
        email: email.trim(),
        password,
      });

      if (error && !data) {
        setErrorMessage(error.message || 'Failed to create store.');
        setLoading(false);
        return;
      }

      if (data) {
        onStoreCreated(data);
        onClose();
      }
    } catch {
      setErrorMessage('An unexpected error occurred while creating store.');
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
              <h2 className="typo-section-title text-base sm:text-lg font-bold text-black">
                Add Store
              </h2>
              <p className="typo-caption text-xs text-zinc-500">
                Register a new retail branch and set up its store login account
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

            {/* store_id: Auto-generated (store_1 + 1 on every new store), disabled */}
            <div className="ui-form-group mb-0">
              <label className="ui-form-label font-semibold text-xs text-zinc-700 uppercase tracking-wide mb-1 flex items-center justify-between">
                <span>Store ID</span>
                <span className="text-[11px] font-normal text-zinc-400 flex items-center gap-1">
                  <Lock className="w-3 h-3 text-zinc-400" />
                  Auto-generated (Read-only)
                </span>
              </label>
              <input
                type="text"
                value={storeId}
                readOnly
                disabled
                className="ui-input text-xs font-mono font-bold text-black bg-zinc-100 border border-zinc-300 rounded-md w-full h-9 px-3 cursor-not-allowed select-none"
              />
              <span className="ui-form-helper text-[11px] text-zinc-500 mt-1 block">
                Auto-assigned sequentially (store_1 + 1). Not editable.
              </span>
            </div>

            {/* Store Name */}
            <div className="ui-form-group mb-0">
              <label className="ui-form-label font-semibold text-xs text-zinc-700 uppercase tracking-wide mb-1 block">
                Store Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Men Express - Downtown Outlet"
                required
                className="ui-input text-xs text-black bg-white border border-zinc-300 focus:border-black rounded-md w-full h-9 px-3"
              />
            </div>

            {/* Mobile */}
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

            {/* Address */}
            <div className="ui-form-group mb-0">
              <label className="ui-form-label font-semibold text-xs text-zinc-700 uppercase tracking-wide mb-1 block">
                Store Address
              </label>
              <textarea
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Physical location, street, landmark, city, pincode..."
                rows={2}
                className="ui-textarea text-xs text-black bg-white border border-zinc-300 focus:border-black rounded-md w-full p-2.5 resize-none"
              />
            </div>

            <div className="pt-2 border-t border-zinc-200">
              <p className="text-xs font-bold text-black uppercase tracking-wider mb-2">
                Store Login Account Credentials
              </p>
              <p className="text-[11px] text-zinc-500 mb-3">
                Used by store staff to sign in at /login. Created in auth.users and public.users with role = store.
              </p>

              <div className="space-y-3">
                {/* Email */}
                <div className="ui-form-group mb-0">
                  <label className="ui-form-label font-semibold text-xs text-zinc-700 uppercase tracking-wide mb-1 block">
                    Store Email (Login Username) *
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. downtown@menexpress.com"
                    required
                    className="ui-input text-xs text-black bg-white border border-zinc-300 focus:border-black rounded-md w-full h-9 px-3 font-mono"
                  />
                </div>

                {/* Password */}
                <div className="ui-form-group mb-0">
                  <label className="ui-form-label font-semibold text-xs text-zinc-700 uppercase tracking-wide mb-1 block">
                    Password *
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Minimum 6 characters"
                      required
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
                  <span>Creating Store...</span>
                </>
              ) : (
                <span>Add Store</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
