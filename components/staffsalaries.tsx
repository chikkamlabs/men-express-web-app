'use client';

import React, { useEffect, useState } from 'react';
import { X, DollarSign, Plus, Calendar, FileText, Loader2, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Staff, StaffSalary, getStaffSalaries, addStaffSalary } from '@/lib/staffStore';

interface StaffSalariesProps {
  isOpen: boolean;
  staff: Staff;
  onClose: () => void;
}

export default function StaffSalariesModal({
  isOpen,
  staff,
  onClose,
}: StaffSalariesProps) {
  const [salaries, setSalaries] = useState<StaffSalary[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');

  // Add Salary Form states
  const [amount, setAmount] = useState<number | string>(staff.salary || '');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const loadSalaries = async () => {
    setLoading(true);
    setFetchError('');
    const { data, error } = await getStaffSalaries(staff.id);
    if (error && (!data || data.length === 0)) {
      setFetchError(error.message || 'Failed to fetch salaries.');
    } else {
      setSalaries(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    let ignore = false;
    if (isOpen && staff) {
      getStaffSalaries(staff.id).then(({ data, error }) => {
        if (!ignore) {
          if (error && (!data || data.length === 0)) {
            setFetchError(error.message || 'Failed to fetch salaries.');
          } else {
            setSalaries(data || []);
          }
          setLoading(false);
        }
      });
    }
    return () => {
      ignore = true;
    };
  }, [isOpen, staff]);

  if (!isOpen) return null;

  const handleAddSalary = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setSuccessMessage('');

    const parsedAmount = parseFloat(String(amount));
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setFormError('Please enter a valid salary amount greater than 0.');
      return;
    }

    if (!date.trim()) {
      setFormError('Please select a payment date.');
      return;
    }

    setIsSubmitting(true);
    const { data, error } = await addStaffSalary({
      staff_id: staff.id,
      amount: parsedAmount,
      date: date.trim(),
      notes: notes.trim() || null,
    });
    setIsSubmitting(false);

    if (error || !data) {
      setFormError(error?.message || 'Failed to record salary disbursement.');
      return;
    }

    // Success: prepend to list and reset fields
    setSalaries((prev) => [data, ...prev]);
    setSuccessMessage(`Recorded salary of ₹${parsedAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })} successfully.`);
    setNotes('');
    setTimeout(() => setSuccessMessage(''), 4000);
  };

  const totalDisbursed = salaries.reduce((acc, s) => acc + Number(s.amount || 0), 0);

  return (
    <div className="ui-dialog-backdrop p-4 fixed inset-0 bg-black/50 z-50 flex items-center justify-center backdrop-blur-xs" role="dialog" aria-modal="true">
      <div className="ui-dialog-panel w-full max-w-3xl bg-white rounded-lg shadow-xl border border-zinc-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="ui-dialog-header flex items-center justify-between border-b border-zinc-200 px-6 py-4 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-zinc-100 rounded-lg text-black border border-zinc-200">
              <DollarSign className="w-5 h-5 text-black" />
            </div>
            <div>
              <h2 className="typo-section-title text-base sm:text-lg font-bold text-black flex items-center gap-2">
                <span>Staff Salaries</span>
                <span className="text-xs px-2 py-0.5 bg-zinc-100 rounded border border-zinc-200 font-mono text-zinc-700">
                  Base: ₹{Number(staff.salary || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </h2>
              <p className="typo-caption text-xs text-zinc-500">
                {staff.name} {staff.mobile ? `(${staff.mobile})` : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={loadSalaries}
              disabled={loading}
              className="ui-btn ui-btn-ghost ui-btn-sm p-1.5 text-zinc-600 hover:text-black hover:bg-zinc-100 rounded cursor-pointer"
              title="Refresh salaries"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="ui-btn ui-btn-ghost ui-btn-sm p-1 text-black hover:bg-zinc-100 rounded cursor-pointer"
              aria-label="Close dialog"
            >
              <X className="w-5 h-5 text-black" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {fetchError && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{fetchError}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded flex items-center gap-2 animate-fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Form: Add Salary (amount, date, notes) */}
          <form onSubmit={handleAddSalary} className="p-4 bg-zinc-50 border border-zinc-200 rounded-lg space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-200">
              <span className="text-xs font-bold text-black uppercase tracking-wider flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5 text-black" />
                <span>Add Salary Disbursement</span>
              </span>
              <span className="text-[11px] text-zinc-500">
                Record new salary payment
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Amount */}
              <div>
                <label className="block text-[11px] font-semibold text-zinc-700 uppercase tracking-wide mb-1">
                  Amount (₹) *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono text-zinc-400">
                    ₹
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="e.g. 15000"
                    required
                    style={{ paddingLeft: '1.75rem' }}
                    className="ui-input text-xs text-black bg-white border border-zinc-300 focus:border-black rounded-md w-full h-9 pr-3 font-mono font-semibold"
                  />
                </div>
              </div>

              {/* Date */}
              <div>
                <label className="block text-[11px] font-semibold text-zinc-700 uppercase tracking-wide mb-1 flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-zinc-400" />
                  <span>Disbursement Date *</span>
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                  className="ui-input text-xs text-black bg-white border border-zinc-300 focus:border-black rounded-md w-full h-9 px-3 font-mono"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-[11px] font-semibold text-zinc-700 uppercase tracking-wide mb-1 flex items-center gap-1">
                  <FileText className="w-3 h-3 text-zinc-400" />
                  <span>Notes / Reference</span>
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Month salary via UPI / cash..."
                  className="ui-input text-xs text-black bg-white border border-zinc-300 focus:border-black rounded-md w-full h-9 px-3"
                />
              </div>
            </div>

            {formError && (
              <p className="text-xs text-red-600 font-medium">{formError}</p>
            )}

            <div className="flex items-center justify-end pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="ui-btn ui-btn-grey ui-btn-sm px-4 py-1.5 text-xs font-medium cursor-pointer flex items-center gap-1.5 shadow-xs"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                    <span>Recording...</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-3.5 h-3.5 text-white" />
                    <span>Save Salary</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* List of staff_salaries */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-black uppercase tracking-wider">
                Salary Disbursement History ({salaries.length})
              </span>
              <div className="text-xs font-mono">
                <span className="text-zinc-500 mr-1.5">Total Disbursed:</span>
                <strong className="text-black">
                  ₹{totalDisbursed.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </strong>
              </div>
            </div>

            <div className="border border-zinc-200 rounded-lg overflow-hidden bg-white">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-zinc-100 border-b border-zinc-200 text-zinc-600 uppercase font-semibold">
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Amount (₹)</th>
                    <th className="py-2.5 px-3">Notes</th>
                    <th className="py-2.5 px-3 text-right">Recorded At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {loading ? (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-zinc-400">
                        <RefreshCw className="w-4 h-4 animate-spin mx-auto mb-1 text-zinc-400" />
                        <span>Loading salary records...</span>
                      </td>
                    </tr>
                  ) : salaries.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-zinc-400">
                        No salary disbursements recorded for this staff member yet.
                      </td>
                    </tr>
                  ) : (
                    salaries.map((s) => (
                      <tr key={s.id} className="hover:bg-zinc-50 transition-colors">
                        <td className="py-2.5 px-3 font-mono font-medium text-black whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-zinc-400" />
                            <span>{s.date}</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold text-black whitespace-nowrap">
                          ₹{Number(s.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="py-2.5 px-3 text-zinc-700">
                          {s.notes || <span className="text-zinc-300 font-mono">—</span>}
                        </td>
                        <td className="py-2.5 px-3 text-right text-zinc-500 font-mono text-[11px] whitespace-nowrap">
                          {s.created_at
                            ? new Date(s.created_at).toLocaleDateString('en-IN', {
                                dateStyle: 'short',
                              })
                            : '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-zinc-200 px-6 py-3.5 bg-zinc-50 flex items-center justify-between flex-shrink-0">
          <span className="text-xs text-zinc-500">
            {staff.name}&apos;s salary records
          </span>
          <button
            type="button"
            onClick={onClose}
            className="ui-btn ui-btn-outline ui-btn-sm px-4 py-1.5 text-xs text-black border-zinc-300 hover:bg-zinc-100 cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
