'use client';

import React, { useState, useMemo } from 'react';
import { X, Search, Plus, Loader2, Ruler } from 'lucide-react';
import { SizeItem, createSize } from '@/lib/settingsStore';

interface SizesModalProps {
  isOpen: boolean;
  onClose: () => void;
  sizes: SizeItem[];
  onSizeCreated: (newSize: SizeItem) => void;
}

export default function SizesModal({
  isOpen,
  onClose,
  sizes,
  onSizeCreated,
}: SizesModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sizeValue, setSizeValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Filtered sizes by value
  const filteredSizes = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return sizes;
    return sizes.filter((s) => s.value.toLowerCase().includes(query));
  }, [sizes, searchQuery]);

  if (!isOpen) return null;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sizeValue.trim()) {
      setErrorMessage('Size value is required.');
      return;
    }

    setLoading(true);
    setErrorMessage('');

    try {
      const { data, error } = await createSize({
        value: sizeValue.trim().toUpperCase(),
      });

      if (error && !data) {
        setErrorMessage(error.message || 'Failed to add size.');
        setLoading(false);
        return;
      }

      if (data) {
        onSizeCreated(data);
        setSizeValue('');
      }
    } catch {
      setErrorMessage('An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ui-dialog-backdrop p-4" role="dialog" aria-modal="true">
      <div className="ui-dialog-panel w-full max-w-xl bg-white rounded-lg shadow-xl border border-zinc-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="ui-dialog-header flex items-center justify-between border-b border-zinc-200 px-6 py-4 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-zinc-100 rounded border border-zinc-200">
              <Ruler className="w-5 h-5 text-black" />
            </div>
            <div>
              <h2 className="typo-section-title text-base sm:text-lg font-bold text-black">
                Size Options Settings
              </h2>
              <p className="typo-caption text-xs text-zinc-500">
                Total Sizes: {sizes.length}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ui-btn ui-btn-ghost ui-btn-sm p-1 text-black hover:bg-zinc-100 rounded cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5 text-black" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* Top Search Bar (value) */}
          <div className="relative w-full">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by size value (e.g. S, XL, 38)..."
              style={{ paddingLeft: '2.5rem' }}
              className="ui-input pr-4 text-sm text-black border border-zinc-300 focus:border-black rounded-lg w-full bg-white"
            />
          </div>

          {/* Add Size Form (size value and Create button) */}
          <form
            onSubmit={handleCreate}
            className="p-4 bg-zinc-50 border border-zinc-200 rounded-lg space-y-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-700">
                Add New Size
              </span>
            </div>

            {errorMessage && (
              <div className="p-2.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded">
                {errorMessage}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
              {/* Size Value Input */}
              <div className="sm:col-span-8">
                <label className="block text-xs font-medium text-zinc-700 mb-1">
                  Size Value <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={sizeValue}
                  onChange={(e) => setSizeValue(e.target.value)}
                  placeholder="e.g. S, M, L, XL, XXL, 38, 40"
                  className="ui-input text-black border border-zinc-300 focus:border-black text-sm uppercase"
                  disabled={loading}
                />
              </div>

              {/* Create Button: Grey color, turns dark black on tap */}
              <div className="sm:col-span-4">
                <button
                  type="submit"
                  disabled={loading}
                  className="ui-btn ui-btn-grey ui-btn-md w-full font-medium flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Plus className="w-4 h-4 text-white" />
                      <span>Create</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>

          {/* Display all sizes (s.no and size value) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-zinc-500 px-1">
              <span className="font-semibold uppercase tracking-wider text-zinc-600">
                Sizes List ({filteredSizes.length})
              </span>
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="text-black underline cursor-pointer"
                >
                  Clear search
                </button>
              )}
            </div>

            <div className="ui-table-container border border-zinc-200 rounded-lg overflow-hidden bg-white max-h-72 overflow-y-auto">
              <table className="ui-table w-full text-left border-collapse">
                <thead>
                  <tr className="bg-zinc-100 border-b border-zinc-200 sticky top-0 z-10">
                    <th className="ui-table-th py-2.5 px-4 font-semibold text-xs text-zinc-600 uppercase tracking-wider w-24">
                      s.no
                    </th>
                    <th className="ui-table-th py-2.5 px-4 font-semibold text-xs text-zinc-600 uppercase tracking-wider">
                      Size Value
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {filteredSizes.length === 0 ? (
                    <tr>
                      <td colSpan={2} className="py-8 text-center text-sm text-zinc-500">
                        {searchQuery
                          ? 'No sizes match your search.'
                          : 'No sizes added yet.'}
                      </td>
                    </tr>
                  ) : (
                    filteredSizes.map((size, index) => (
                      <tr
                        key={size.id}
                        className="hover:bg-zinc-50 transition-colors"
                      >
                        {/* s.no */}
                        <td className="py-2.5 px-4 text-sm font-mono text-zinc-500">
                          {index + 1}
                        </td>

                        {/* Size Value */}
                        <td className="py-2.5 px-4 text-sm font-semibold text-black">
                          <span className="inline-flex items-center px-2.5 py-1 bg-zinc-100 border border-zinc-300 rounded font-mono text-xs">
                            {size.value}
                          </span>
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
        <div className="ui-dialog-footer flex items-center justify-end px-6 py-3 bg-zinc-50 border-t border-zinc-200 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="ui-btn ui-btn-outline ui-btn-md text-black border-zinc-300 hover:bg-zinc-100 cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
