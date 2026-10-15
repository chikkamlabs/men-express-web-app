'use client';

import React, { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { Staff, updateStaff } from '@/lib/staffStore';

interface OpenStaffProps {
  isOpen: boolean;
  staff: Staff;
  onClose: () => void;
  onStaffUpdated: (staff: Staff) => void;
}

export default function OpenStaffModal({
  isOpen,
  staff,
  onClose,
  onStaffUpdated,
}: OpenStaffProps) {
  const [name, setName] = useState(staff.name || '');
  const [mobile, setMobile] = useState(staff.mobile || '');
  const [email, setEmail] = useState(staff.email || '');
  const [salary, setSalary] = useState<string>(
    staff.salary !== undefined ? String(staff.salary) : '0'
  );
  const [status, setStatus] = useState<'active' | 'deactive'>(
    staff.status || 'active'
  );
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMessage('Staff member name cannot be empty.');
      return;
    }

    setLoading(true);
    setErrorMessage('');

    try {
      const parsedSalary = parseFloat(salary) || 0;
      const { data, error } = await updateStaff(staff.id, {
        name: name.trim(),
        mobile: mobile.trim() || '',
        email: email.trim() || null,
        salary: parsedSalary,
        status,
      });

      if (error && !data) {
        setErrorMessage(error.message || 'Failed to update staff member.');
        setLoading(false);
        return;
      }

      if (data) {
        onStaffUpdated(data);
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
              Staff Details
            </h2>
            <p className="typo-caption text-xs text-zinc-500">
              {staff.name}
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
                Staff Name <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Staff Name"
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
                placeholder="Mobile number"
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
                placeholder="Email address"
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
