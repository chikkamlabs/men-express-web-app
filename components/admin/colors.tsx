'use client';

import React, { useState, useMemo } from 'react';
import { X, Search, Plus, Loader2, Palette } from 'lucide-react';
import { ColorItem, createColor } from '@/lib/settingsStore';

interface ColorsModalProps {
  isOpen: boolean;
  onClose: () => void;
  colors: ColorItem[];
  onColorCreated: (newColor: ColorItem) => void;
}

const STANDARD_COLOR_PALETTE = [
  { name: 'Black', code: '#000000' },
  { name: 'White', code: '#FFFFFF' },
  { name: 'Navy Blue', code: '#0A192F' },
  { name: 'Royal Blue', code: '#2563EB' },
  { name: 'Sky Blue', code: '#38BDF8' },
  { name: 'Teal', code: '#0D9488' },
  { name: 'Dark Green', code: '#14532D' },
  { name: 'Olive Green', code: '#4D7C0F' },
  { name: 'Sage Green', code: '#84A98C' },
  { name: 'Khaki', code: '#C2B280' },
  { name: 'Beige', code: '#F5F5DC' },
  { name: 'Camel Tan', code: '#C19A6B' },
  { name: 'Brown', code: '#78350F' },
  { name: 'Maroon', code: '#881337' },
  { name: 'Crimson Red', code: '#DC2626' },
  { name: 'Orange', code: '#EA580C' },
  { name: 'Mustard Yellow', code: '#D97706' },
  { name: 'Peach', code: '#FDBA74' },
  { name: 'Pink', code: '#EC4899' },
  { name: 'Lavender', code: '#C084FC' },
  { name: 'Purple', code: '#7E22CE' },
  { name: 'Charcoal Grey', code: '#334155' },
  { name: 'Heather Grey', code: '#64748B' },
  { name: 'Light Grey', code: '#CBD5E1' },
];

export default function ColorsModal({
  isOpen,
  onClose,
  colors,
  onColorCreated,
}: ColorsModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [name, setName] = useState('');
  const [code, setCode] = useState('#000000');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const nameInputRef = React.useRef<HTMLInputElement | null>(null);

  // Filtered colors by name or color code
  const filteredColors = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return colors;
    return colors.filter(
      (c) =>
        c.name.toLowerCase().includes(query) ||
        c.code.toLowerCase().includes(query)
    );
  }, [colors, searchQuery]);

  if (!isOpen) return null;

  const handleSelectPaletteColor = (paletteColor: { name: string; code: string }) => {
    setCode(paletteColor.code.toUpperCase());
    setName(paletteColor.name);
    setErrorMessage('');
    // Automatically focus the name input so the user can verify/edit the color name
    setTimeout(() => {
      nameInputRef.current?.focus();
    }, 50);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMessage('Color name is required.');
      return;
    }
    if (!code.trim()) {
      setErrorMessage('Color code is required.');
      return;
    }

    setLoading(true);
    setErrorMessage('');

    try {
      const { data, error } = await createColor({
        name: name.trim(),
        code: code.trim(),
      });

      if (error && !data) {
        setErrorMessage(error.message || 'Failed to add color.');
        setLoading(false);
        return;
      }

      if (data) {
        onColorCreated(data);
        setName('');
        setCode('#000000');
      }
    } catch {
      setErrorMessage('An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ui-dialog-backdrop p-4" role="dialog" aria-modal="true">
      <div className="ui-dialog-panel w-full max-w-2xl bg-white rounded-lg shadow-xl border border-zinc-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="ui-dialog-header flex items-center justify-between border-b border-zinc-200 px-6 py-4 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-zinc-100 rounded border border-zinc-200">
              <Palette className="w-5 h-5 text-black" />
            </div>
            <div>
              <h2 className="typo-section-title text-base sm:text-lg font-bold text-black">
                Color Palette Settings
              </h2>
              <p className="typo-caption text-xs text-zinc-500">
                Total Colors: {colors.length}
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
          {/* Top Search Bar (name, color code) */}
          <div className="relative w-full">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search colors by name or hex code (e.g. Navy, #000080)..."
              style={{ paddingLeft: '2.5rem' }}
              className="ui-input pr-4 text-sm text-black border border-zinc-300 focus:border-black rounded-lg w-full bg-white"
            />
          </div>

          {/* Add Color Form (Standard Palette, name, color code, and Create button) */}
          <form
            onSubmit={handleCreate}
            className="p-4 bg-zinc-50 border border-zinc-200 rounded-lg space-y-3.5"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-700">
                Add New Color
              </span>
            </div>

            {errorMessage && (
              <div className="p-2.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded">
                {errorMessage}
              </div>
            )}

            {/* Standard Color Palette Box */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-zinc-700">
                  Standard Color Palette
                </label>
                <span className="text-[11px] text-zinc-500">
                  Tap any color to select it &amp; its Hex code
                </span>
              </div>
              <div className="grid grid-cols-6 sm:grid-cols-12 gap-1.5 p-2 bg-white border border-zinc-200 rounded-lg">
                {STANDARD_COLOR_PALETTE.map((item) => {
                  const isSelected = code.toUpperCase() === item.code.toUpperCase();
                  return (
                    <button
                      key={item.code}
                      type="button"
                      onClick={() => handleSelectPaletteColor(item)}
                      className={`group relative p-1 rounded-md border flex items-center justify-center transition-all cursor-pointer ${
                        isSelected
                          ? 'border-black ring-2 ring-black scale-105 shadow-xs'
                          : 'border-zinc-200 hover:border-zinc-400 hover:scale-105'
                      }`}
                      title={`${item.name} (${item.code})`}
                    >
                      <span
                        className="w-5 h-5 sm:w-6 sm:h-6 rounded border border-zinc-300 flex-shrink-0"
                        style={{ backgroundColor: item.code }}
                      />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Color Name, Color Code & Create Button */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end pt-1">
              {/* Name Input */}
              <div className="sm:col-span-5">
                <label className="block text-xs font-medium text-zinc-700 mb-1">
                  Color Name <span className="text-red-600">*</span>
                </label>
                <input
                  ref={nameInputRef}
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Crimson Red"
                  className="ui-input text-black border border-zinc-300 focus:border-black text-sm"
                  disabled={loading}
                />
              </div>

              {/* Color Code Input with Picker */}
              <div className="sm:col-span-4">
                <label className="block text-xs font-medium text-zinc-700 mb-1">
                  Color Code (Hex) <span className="text-red-600">*</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={code.startsWith('#') && code.length === 7 ? code : '#000000'}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    className="w-10 h-10 p-0.5 rounded border border-zinc-300 cursor-pointer bg-white flex-shrink-0"
                    title="Pick a color"
                  />
                  <input
                    type="text"
                    required
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="#RRGGBB"
                    className="ui-input font-mono text-sm text-black border border-zinc-300 focus:border-black uppercase flex-1"
                    disabled={loading}
                  />
                </div>
              </div>

              {/* Create Button: Grey color, turns dark black on tap */}
              <div className="sm:col-span-3">
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

          {/* Display all colors (name and color(find with code hex)) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-zinc-500 px-1">
              <span className="font-semibold uppercase tracking-wider text-zinc-600">
                Colors List ({filteredColors.length})
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
                    <th className="ui-table-th py-2.5 px-4 font-semibold text-xs text-zinc-600 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="ui-table-th py-2.5 px-4 font-semibold text-xs text-zinc-600 uppercase tracking-wider">
                      Color (Hex Code)
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {filteredColors.length === 0 ? (
                    <tr>
                      <td colSpan={2} className="py-8 text-center text-sm text-zinc-500">
                        {searchQuery
                          ? 'No colors match your search.'
                          : 'No colors added yet.'}
                      </td>
                    </tr>
                  ) : (
                    filteredColors.map((color) => (
                      <tr
                        key={color.id}
                        className="hover:bg-zinc-50 transition-colors"
                      >
                        {/* Name */}
                        <td className="py-2.5 px-4 text-sm font-medium text-black">
                          {color.name}
                        </td>

                        {/* Color (found with code hex) */}
                        <td className="py-2.5 px-4 text-sm">
                          <div className="flex items-center gap-3">
                            <span
                              className="w-6 h-6 rounded-md border border-zinc-300 shadow-xs flex-shrink-0"
                              style={{ backgroundColor: color.code }}
                              aria-hidden="true"
                            />
                            <span className="font-mono text-xs font-semibold text-black uppercase">
                              {color.code}
                            </span>
                          </div>
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
