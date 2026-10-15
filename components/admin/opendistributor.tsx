'use client';

import React, { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { Distributor, updateDistributor } from '@/lib/distributorsStore';

interface OpenDistributorProps {
  isOpen: boolean;
  distributor: Distributor;
  onClose: () => void;
  onDistributorUpdated: (distributor: Distributor) => void;
}

export default function OpenDistributorModal({
  isOpen,
  distributor,
  onClose,
  onDistributorUpdated,
}: OpenDistributorProps) {
  const [name, setName] = useState(distributor.name || '');
  const [mobile, setMobile] = useState(distributor.mobile || '');
  const [email, setEmail] = useState(distributor.email || '');
  const [company, setCompany] = useState(distributor.company || '');
  const [balance, setBalance] = useState<string>(
    distributor.balance !== undefined ? String(distributor.balance) : '0'
  );
  const [status, setStatus] = useState<'active' | 'deactive'>(
    distributor.status || 'active'
  );
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMessage('Distributor name cannot be empty.');
      return;
    }

    setLoading(true);
    setErrorMessage('');

    try {
      const parsedBalance = parseFloat(balance) || 0;
      const { data, error } = await updateDistributor(distributor.distributor_id, {
        name: name.trim(),
        mobile: mobile.trim() || undefined,
        email: email.trim() || undefined,
        company: company.trim() || undefined,
        balance: parsedBalance,
        status,
      });

      if (error && !data) {
        setErrorMessage(error.message || 'Failed to update distributor.');
        setLoading(false);
        return;
      }

      if (data) {
        onDistributorUpdated(data);
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
      <div className="ui-dialog-panel w-full max-w-lg bg-white rounded-lg shadow-xl border border-zinc-200 overflow-hidden">
        {/* Header */}
        <div className="ui-dialog-header flex items-center justify-between border-b border-zinc-200 px-6 py-4">
          <div>
            <h2 className="typo-section-title text-base sm:text-lg font-bold text-black">
              Distributor Details
            </h2>
            <p className="typo-caption text-xs text-zinc-500">
              ID: {distributor.distributor_id}
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

        {/* Form Body */}
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
            {errorMessage && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded">
                {errorMessage}
              </div>
            )}

            {/* Display distributor_id (Read-only / Immutable) */}
            <div className="ui-form-group">
              <label className="ui-form-label font-semibold text-xs text-zinc-700 uppercase tracking-wide">
                Distributor ID (Immutable)
              </label>
              <input
                type="text"
                value={distributor.distributor_id}
                readOnly
                disabled
                className="ui-input bg-zinc-100 text-zinc-600 font-mono text-sm cursor-not-allowed border border-zinc-300"
              />
              <span className="ui-form-helper text-xs text-zinc-500 mt-1">
                Distributor ID cannot be edited.
              </span>
            </div>

            {/* Name */}
            <div className="ui-form-group">
              <label className="ui-form-label font-semibold text-xs text-zinc-700 uppercase tracking-wide">
                Name <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Distributor Name"
                className="ui-input text-black border border-zinc-300 focus:border-black"
                disabled={loading}
              />
            </div>

            {/* Mobile */}
            <div className="ui-form-group">
              <label className="ui-form-label font-semibold text-xs text-zinc-700 uppercase tracking-wide">
                Mobile
              </label>
              <input
                type="tel"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                placeholder="Mobile number"
                className="ui-input text-black border border-zinc-300 focus:border-black"
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
                placeholder="Email address"
                className="ui-input text-black border border-zinc-300 focus:border-black"
                disabled={loading}
              />
            </div>

            {/* Company */}
            <div className="ui-form-group">
              <label className="ui-form-label font-semibold text-xs text-zinc-700 uppercase tracking-wide">
                Company
              </label>
              <input
                type="text"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="Company name"
                className="ui-input text-black border border-zinc-300 focus:border-black"
                disabled={loading}
              />
            </div>

            {/* Balance */}
            <div className="ui-form-group">
              <label className="ui-form-label font-semibold text-xs text-zinc-700 uppercase tracking-wide">
                Balance
              </label>
              <input
                type="number"
                step="0.01"
                value={balance}
                onChange={(e) => setBalance(e.target.value)}
                placeholder="0.00"
                className="ui-input text-black border border-zinc-300 focus:border-black font-mono"
                disabled={loading}
              />
            </div>

            {/* Status */}
            <div className="ui-form-group">
              <label className="ui-form-label font-semibold text-xs text-zinc-700 uppercase tracking-wide">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as 'active' | 'deactive')}
                className="ui-select text-black border border-zinc-300 focus:border-black"
                disabled={loading}
              >
                <option value="active">Active</option>
                <option value="deactive">Deactive</option>
              </select>
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
