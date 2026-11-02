'use client';

import React, { useEffect, useState } from 'react';
import { X, Calendar, CheckCircle2, Clock, XCircle, RefreshCw, AlertCircle } from 'lucide-react';
import { Staff, StaffAttendance, getStaffAttendance } from '@/lib/staffStore';

interface StaffAttendancesProps {
  isOpen: boolean;
  staff: Staff;
  onClose: () => void;
  onOpenAddAttendance?: () => void;
}

export default function StaffAttendancesModal({
  isOpen,
  staff,
  onClose,
  onOpenAddAttendance,
}: StaffAttendancesProps) {
  const [attendances, setAttendances] = useState<StaffAttendance[]>([]);
  const [summary, setSummary] = useState({ present: 0, half: 0, absent: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  // Current Month calculation
  const currentMonthDate = new Date();
  const currentMonthName = currentMonthDate.toLocaleString('default', {
    month: 'long',
    year: 'numeric',
  });

  const loadAttendance = async () => {
    setLoading(true);
    setErrorMessage('');
    const { data, summary: sum, error } = await getStaffAttendance(staff.id);
    if (error && (!data || data.length === 0)) {
      setErrorMessage(error.message || 'Failed to load attendance records.');
    } else {
      setAttendances(data || []);
      setSummary(sum);
    }
    setLoading(false);
  };

  useEffect(() => {
    let ignore = false;
    if (isOpen && staff) {
      getStaffAttendance(staff.id).then(({ data, summary: sum, error }) => {
        if (!ignore) {
          if (error && (!data || data.length === 0)) {
            setErrorMessage(error.message || 'Failed to load attendance records.');
          } else {
            setAttendances(data || []);
            setSummary(sum);
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

  return (
    <div className="ui-dialog-backdrop p-4 fixed inset-0 bg-black/50 z-50 flex items-center justify-center backdrop-blur-xs" role="dialog" aria-modal="true">
      <div className="ui-dialog-panel w-full max-w-2xl bg-white rounded-lg shadow-xl border border-zinc-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="ui-dialog-header flex items-center justify-between border-b border-zinc-200 px-6 py-4 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-zinc-100 rounded-lg text-black border border-zinc-200">
              <Calendar className="w-5 h-5 text-black" />
            </div>
            <div>
              <h2 className="typo-section-title text-base sm:text-lg font-bold text-black flex items-center gap-2">
                <span>Staff Attendances</span>
                <span className="text-xs px-2 py-0.5 bg-zinc-100 rounded border border-zinc-200 font-mono text-zinc-700">
                  {currentMonthName}
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
              onClick={loadAttendance}
              disabled={loading}
              className="ui-btn ui-btn-ghost ui-btn-sm p-1.5 text-zinc-600 hover:text-black hover:bg-zinc-100 rounded cursor-pointer"
              title="Refresh attendance"
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
          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* This Month Attendance Summary Cards */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-black uppercase tracking-wider">
                This Month Summary ({currentMonthName})
              </span>
              <span className="text-xs text-zinc-500 font-mono">
                {summary.total} days logged
              </span>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {/* Days Present Card */}
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-center">
                <div className="flex items-center justify-center gap-1.5 text-emerald-800 text-xs font-semibold uppercase mb-1">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Present</span>
                </div>
                <span className="text-2xl font-bold font-mono text-emerald-900 block">
                  {summary.present}
                </span>
                <span className="text-[11px] text-emerald-700 mt-0.5 block">
                  Full days
                </span>
              </div>

              {/* Days Half Present Card */}
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-center">
                <div className="flex items-center justify-center gap-1.5 text-amber-800 text-xs font-semibold uppercase mb-1">
                  <Clock className="w-4 h-4 text-amber-600" />
                  <span>Half Present</span>
                </div>
                <span className="text-2xl font-bold font-mono text-amber-900 block">
                  {summary.half}
                </span>
                <span className="text-[11px] text-amber-700 mt-0.5 block">
                  Half days
                </span>
              </div>

              {/* Days Absent Card */}
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg text-center">
                <div className="flex items-center justify-center gap-1.5 text-rose-800 text-xs font-semibold uppercase mb-1">
                  <XCircle className="w-4 h-4 text-rose-600" />
                  <span>Absent</span>
                </div>
                <span className="text-2xl font-bold font-mono text-rose-900 block">
                  {summary.absent}
                </span>
                <span className="text-[11px] text-rose-700 mt-0.5 block">
                  Days absent
                </span>
              </div>
            </div>
          </div>

          {/* List of Attendance Records for this month */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-black uppercase tracking-wider">
                Daily Attendance Log
              </span>
              {onOpenAddAttendance && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenAddAttendance();
                  }}
                  className="text-xs text-black underline hover:text-zinc-700 cursor-pointer font-medium"
                >
                  + Add Daily Attendance
                </button>
              )}
            </div>

            <div className="border border-zinc-200 rounded-lg overflow-hidden bg-white">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-zinc-100 border-b border-zinc-200 text-zinc-600 uppercase font-semibold">
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {loading ? (
                    <tr>
                      <td colSpan={3} className="py-8 text-center text-zinc-400">
                        <RefreshCw className="w-4 h-4 animate-spin mx-auto mb-1 text-zinc-400" />
                        <span>Loading attendances...</span>
                      </td>
                    </tr>
                  ) : attendances.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="py-8 text-center text-zinc-400">
                        No attendance records logged for {currentMonthName} yet.
                      </td>
                    </tr>
                  ) : (
                    attendances.map((record) => (
                      <tr key={record.id} className="hover:bg-zinc-50 transition-colors">
                        <td className="py-2.5 px-3 font-mono font-medium text-black whitespace-nowrap">
                          {record.date}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          {record.attendance === 'full' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>Present</span>
                            </span>
                          )}
                          {record.attendance === 'half' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                              <Clock className="w-3 h-3 text-amber-600" />
                              <span>Half Present</span>
                            </span>
                          )}
                          {record.attendance === 'absent' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-100 text-rose-800 border border-rose-200">
                              <XCircle className="w-3 h-3 text-rose-600" />
                              <span>Absent</span>
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-zinc-600">
                          {record.notes || <span className="text-zinc-300 font-mono">—</span>}
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
            Attendance records for {currentMonthName}
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
