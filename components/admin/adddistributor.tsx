'use client';

import React, { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import {
  Distributor,
  calculateNextDistributorId,
  createDistributor,
} from '@/lib/distributorsStore';

interface AddDistributorProps {
  isOpen: boolean;
  onClose: () => void;
  distributorsCount: number;
  existingDistributors: Distributor[];
  onDistributorCreated: (distributor: Distributor) => void;
}

export default function AddDistributorModal({
  isOpen,
  onClose,
  distributorsCount,
  existingDistributors,
  onDistributorCreated,
}: AddDistributorProps) {
  const autoDistributorId = calculateNextDistributorId(
    distributorsCount,
    existingDistributors
  );

  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [company, setCompany] = useState('');
  const [status, setStatus] = useState<'active' | 'deactive'>('active');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMessage('Distributor name is required.');
      return;
    }

    setLoading(true);
    setErrorMessage('');

    try {
      const { data, error } = await createDistributor({
        distributor_id: autoDistributorId,
        name: name.trim(),
        mobile: mobile.trim() || undefined,
        company: company.trim() || undefined,
        status,
      });

      if (error && !data) {
        setErrorMessage(error.message || 'Failed to create distributor.');
        setLoading(false);
        return;
      }

      if (data) {
        onDistributorCreated(data);
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
          <h2 className="typo-section-title text-base sm:text-lg font-bold text-black">
            Add Distributor
          </h2>
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
          <div className="p-6 space-y-4">
            {errorMessage && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded">
                {errorMessage}
              </div>
            )}

            {/* distributor_id: Auto-filled */}
            <div className="ui-form-group">
              <label className="ui-form-label font-semibold text-xs text-zinc-700 uppercase tracking-wide">
                Distributor ID (Auto-filled)
              </label>
              <input
                type="text"
                value={autoDistributorId}
                readOnly
                disabled
                className="ui-input bg-zinc-100 text-zinc-600 font-mono text-sm cursor-not-allowed border border-zinc-300"
              />
              <span className="ui-form-helper text-xs text-zinc-500 mt-1">
                Auto-assigned: distributor_101 + count of existing distributors
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
                placeholder="e.g. Acme Textiles, John Doe"
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
                placeholder="e.g. +91 9876543210"
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
                placeholder="e.g. Global Garments Ltd."
                className="ui-input text-black border border-zinc-300 focus:border-black"
                disabled={loading}
              />
            </div>

            {/* Status (default = active) */}
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
                <option value="active">Active (default)</option>
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
