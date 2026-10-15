'use client';

import React, { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { Staff, createStaff } from '@/lib/staffStore';

interface AddStaffModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStaffCreated: (staff: Staff) => void;
}

export default function AddStaffModal({
  isOpen,
  onClose,
  onStaffCreated,
}: AddStaffModalProps) {
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [salary, setSalary] = useState<string>('');
  const [status, setStatus] = useState<'active' | 'deactive'>('active');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMessage('Staff member name is required.');
      return;
    }

    setLoading(true);
    setErrorMessage('');

    try {
      const parsedSalary = parseFloat(salary) || 0;
      const { data, error } = await createStaff({
        name: name.trim(),
        mobile: mobile.trim(),
        email: email.trim() || undefined,
        salary: parsedSalary,
        status,
      });

      if (error && !data) {
        setErrorMessage(error.message || 'Failed to create staff member.');
        setLoading(false);
        return;
      }

      if (data) {
        onStaffCreated(data);
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
            Add Staff Member
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

            {/* Name */}
            <div className="ui-form-group">
              <label className="ui-form-label font-semibold text-xs text-zinc-700 uppercase tracking-wide">
                Staff Name <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Alex Johnson"
                className="ui-input text-black border border-zinc-300 focus:border-black"
                disabled={loading}
              />
            </div>

            {/* Mobile */}
            <div className="ui-form-group">
              <label className="ui-form-label font-semibold text-xs text-zinc-700 uppercase tracking-wide">
                Mobile Number
              </label>
              <input
                type="tel"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                placeholder="e.g. 9876543210"
                className="ui-input text-black border border-zinc-300 focus:border-black font-mono"
                disabled={loading}
              />
            </div>

            {/* Email */}
            <div className="ui-form-group">
              <label className="ui-form-label font-semibold text-xs text-zinc-700 uppercase tracking-wide">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. staff@menexpress.com"
                className="ui-input text-black border border-zinc-300 focus:border-black"
                disabled={loading}
              />
            </div>

            {/* Salary */}
            <div className="ui-form-group">
              <label className="ui-form-label font-semibold text-xs text-zinc-700 uppercase tracking-wide">
                Salary (₹)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={salary}
                onChange={(e) => setSalary(e.target.value)}
                placeholder="e.g. 25000"
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
