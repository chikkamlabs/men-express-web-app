'use client';

import React, { useState } from 'react';
import { X, Calendar, CheckCircle2, Clock, XCircle, Loader2, AlertCircle } from 'lucide-react';
import { Staff, StaffAttendanceStatus, addStaffAttendance } from '@/lib/staffStore';

interface AddStaffAttendanceModalProps {
  isOpen: boolean;
  staff: Staff;
  onClose: () => void;
  onAttendanceAdded?: () => void;
}

export default function AddStaffAttendanceModal({
  isOpen,
  staff,
  onClose,
  onAttendanceAdded,
}: AddStaffAttendanceModalProps) {
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [attendance, setAttendance] = useState<StaffAttendanceStatus>('full');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!date.trim()) {
      setErrorMessage('Please select an attendance date.');
      return;
    }

    setIsSubmitting(true);
    const { data, error } = await addStaffAttendance({
      staff_id: staff.id,
      date: date.trim(),
      attendance,
      notes: notes.trim() || null,
    });
    setIsSubmitting(false);

    if (error || !data) {
      setErrorMessage(
        error?.message ||
          `Attendance for ${staff.name} on ${date} already exists or could not be saved.`
      );
      return;
    }

    // Successfully added
    if (onAttendanceAdded) {
      onAttendanceAdded();
    }
    onClose();
  };

  return (
    <div className="ui-dialog-backdrop p-4 fixed inset-0 bg-black/50 z-50 flex items-center justify-center backdrop-blur-xs" role="dialog" aria-modal="true">
      <div className="ui-dialog-panel w-full max-w-md bg-white rounded-lg shadow-xl border border-zinc-200 overflow-hidden">
        {/* Header */}
        <div className="ui-dialog-header flex items-center justify-between border-b border-zinc-200 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-zinc-100 rounded-lg text-black border border-zinc-200">
              <Calendar className="w-5 h-5 text-black" />
            </div>
            <div>
              <h2 className="typo-section-title text-base sm:text-lg font-bold text-black">
                Add Attendance
              </h2>
              <p className="typo-caption text-xs text-zinc-500">
                {staff.name} {staff.mobile ? `(${staff.mobile})` : ''}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
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
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded flex items-start gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Date: Default today, No duplicate dates for single staff */}
            <div className="ui-form-group mb-0">
              <label className="ui-form-label font-semibold text-xs text-zinc-700 uppercase tracking-wide mb-1 flex items-center justify-between">
                <span>Date *</span>
                <span className="text-[11px] font-normal text-zinc-400">
                  No duplicate dates allowed
                </span>
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => {
                  setDate(e.target.value);
                  setErrorMessage('');
                }}
                required
                className="ui-input text-xs text-black bg-white border border-zinc-300 focus:border-black rounded-md w-full h-9 px-3 font-mono"
              />
              <span className="ui-form-helper text-[11px] text-zinc-500 mt-1 block">
                Defaults to today&apos;s date. Single entry per staff member per day.
              </span>
            </div>

            {/* Attendance Status */}
            <div className="ui-form-group mb-0">
              <label className="ui-form-label font-semibold text-xs text-zinc-700 uppercase tracking-wide mb-2 block">
                Attendance Status *
              </label>

              <div className="grid grid-cols-3 gap-2">
                {/* Present (full) */}
                <button
                  type="button"
                  onClick={() => setAttendance('full')}
                  className={`p-2.5 rounded-lg border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-1 ${
                    attendance === 'full'
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-900 font-semibold ring-1 ring-emerald-600'
                      : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50'
                  }`}
                >
                  <CheckCircle2 className={`w-4 h-4 ${attendance === 'full' ? 'text-emerald-600' : 'text-zinc-400'}`} />
                  <span className="text-xs">Present</span>
                </button>

                {/* Half Present (half) */}
                <button
                  type="button"
                  onClick={() => setAttendance('half')}
                  className={`p-2.5 rounded-lg border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-1 ${
                    attendance === 'half'
                      ? 'border-amber-600 bg-amber-50 text-amber-900 font-semibold ring-1 ring-amber-600'
                      : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50'
                  }`}
                >
                  <Clock className={`w-4 h-4 ${attendance === 'half' ? 'text-amber-600' : 'text-zinc-400'}`} />
                  <span className="text-xs">Half Day</span>
                </button>

                {/* Absent (absent) */}
                <button
                  type="button"
                  onClick={() => setAttendance('absent')}
                  className={`p-2.5 rounded-lg border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-1 ${
                    attendance === 'absent'
                      ? 'border-rose-600 bg-rose-50 text-rose-900 font-semibold ring-1 ring-rose-600'
                      : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50'
                  }`}
                >
                  <XCircle className={`w-4 h-4 ${attendance === 'absent' ? 'text-rose-600' : 'text-zinc-400'}`} />
                  <span className="text-xs">Absent</span>
                </button>
              </div>
            </div>

            {/* Notes */}
            <div className="ui-form-group mb-0">
              <label className="ui-form-label font-semibold text-xs text-zinc-700 uppercase tracking-wide mb-1 block">
                Notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional attendance remarks or reasons..."
                rows={2}
                className="ui-textarea text-xs text-black bg-white border border-zinc-300 focus:border-black rounded-md w-full p-2.5 resize-none"
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="ui-dialog-footer border-t border-zinc-200 px-6 py-4 flex items-center justify-end gap-3 bg-zinc-50">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="ui-btn ui-btn-outline ui-btn-md text-xs text-black border-zinc-300 hover:bg-zinc-100 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="ui-btn ui-btn-grey ui-btn-md px-5 py-2 text-xs font-medium cursor-pointer flex items-center gap-1.5 shadow-xs"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>Save Attendance</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
