'use client';

import React, { useState, useEffect } from 'react';
import { X, Loader2 } from 'lucide-react';
import { SizeItem, getSizes } from '@/lib/settingsStore';
import { ProductColor } from '@/lib/productcolorsStore';
import { ProductVariant, updateProductVariant } from '@/lib/productVariantsStore';

interface OpenProductVariantProps {
  isOpen: boolean;
  variant: ProductVariant;
  productColors: ProductColor[];
  onClose: () => void;
  onVariantUpdated: (variant: ProductVariant) => void;
}

export default function OpenProductVariantModal({
  isOpen,
  variant,
  productColors,
  onClose,
  onVariantUpdated,
}: OpenProductVariantProps) {
  const [sizes, setSizes] = useState<SizeItem[]>([]);
  const [sizesLoading, setSizesLoading] = useState(true);

  // Form states initialized from variant
  const [sizeId, setSizeId] = useState(variant.size_id || '');
  const [barcode, setBarcode] = useState(variant.barcode || '');
  const [mrp, setMrp] = useState(String(variant.mrp ?? ''));
  const [sp, setSp] = useState(String(variant.s_p ?? ''));
  const [pp, setPp] = useState(String(variant.p_p ?? ''));
  const [quantity, setQuantity] = useState(String(variant.quantity ?? '0'));
  const [status, setStatus] = useState<'active' | 'deactive'>(
    variant.status || 'active'
  );
  const [onlineAvailable, setOnlineAvailable] = useState(
    typeof variant.online_available === 'boolean' ? variant.online_available : true
  );
  const [onLandingPage, setOnLandingPage] = useState(
    typeof variant.on_landing_page === 'boolean' ? variant.on_landing_page : false
  );
  const [selectedProductColorId, setSelectedProductColorId] = useState(
    variant.product_color_id || ''
  );

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Fetch sizes
  useEffect(() => {
    let ignore = false;
    if (isOpen) {
      getSizes().then(({ data }) => {
        if (!ignore && data) {
          setSizes(data);
          setSizesLoading(false);
        }
      });
    }
    return () => {
      ignore = true;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sizeId) {
      setErrorMessage('Please select a size.');
      return;
    }
    if (!barcode.trim()) {
      setErrorMessage('Barcode cannot be empty.');
      return;
    }
    if (!selectedProductColorId) {
      setErrorMessage('Please select a color for this variant.');
      return;
    }

    const mrpNum = parseFloat(mrp);
    const spNum = parseFloat(sp);
    const ppNum = parseFloat(pp);
    const qtyNum = parseInt(quantity, 10);

    if (isNaN(mrpNum) || mrpNum < 0) {
      setErrorMessage('Please enter a valid MRP (>= 0).');
      return;
    }
    if (isNaN(spNum) || spNum < 0 || spNum > mrpNum) {
      setErrorMessage('Selling price (SP) must be between 0 and MRP.');
      return;
    }
    if (isNaN(ppNum) || ppNum < 0) {
      setErrorMessage('Please enter a valid Purchase Price (PP >= 0).');
      return;
    }

    setLoading(true);
    setErrorMessage('');

    const chosenSize = sizes.find((s) => s.id === sizeId);
    const chosenColor = productColors.find(
      (pc) => pc.id === selectedProductColorId
    );

    try {
      const { data, error } = await updateProductVariant(
        variant.id,
        {
          product_color_id: selectedProductColorId,
          size_id: sizeId,
          barcode: barcode.trim(),
          mrp: mrpNum,
          s_p: spNum,
          p_p: ppNum,
          quantity: isNaN(qtyNum) ? 0 : qtyNum,
          status,
          online_available: onlineAvailable,
          on_landing_page: onLandingPage,
        },
        {
          size_value: chosenSize?.value || variant.size_value,
          color_name: chosenColor?.color?.name || variant.color_name,
          color_code: chosenColor?.color?.code || variant.color_code,
        }
      );

      if (error && !data) {
        setErrorMessage(error.message || 'Failed to update variant.');
        setLoading(false);
        return;
      }

      if (data) {
        onVariantUpdated(data);
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
              Variant Details
            </h2>
            <p className="typo-caption text-xs text-zinc-500 font-mono">
              Barcode: {variant.barcode}
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
          <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
            {errorMessage && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded">
                {errorMessage}
              </div>
            )}

            {/* Editable Color Selection */}
            <div className="ui-form-group">
              <label className="ui-form-label font-semibold text-xs text-zinc-700 uppercase tracking-wide block mb-1">
                Variant Color <span className="text-red-600">*</span>
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {productColors.map((pc) => {
                  const isSelected = selectedProductColorId === pc.id;
                  const colorName = pc.color?.name || 'Color';
                  const colorCode = pc.color?.code || '#000000';

                  return (
                    <button
                      key={pc.id}
                      type="button"
                      onClick={() => setSelectedProductColorId(pc.id)}
                      className={`p-2.5 rounded-lg border text-left flex items-center gap-2 transition-all cursor-pointer ${
                        isSelected
                          ? 'border-black bg-zinc-100 ring-1 ring-black'
                          : 'border-zinc-200 bg-white hover:bg-zinc-50'
                      }`}
                    >
                      <span
                        className="w-4 h-4 rounded-full border border-zinc-300 flex-shrink-0"
                        style={{ backgroundColor: colorCode }}
                        aria-hidden="true"
                      />
                      <div className="truncate">
                        <span className="text-xs font-semibold text-black block truncate">
                          {colorName}
                        </span>
                        <span className="text-2xs font-mono text-zinc-500 block truncate">
                          {colorCode}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Editable Size */}
            <div className="ui-form-group">
              <label className="ui-form-label font-semibold text-xs text-zinc-700 uppercase tracking-wide">
                Size <span className="text-red-600">*</span>
              </label>
              <select
                value={sizeId}
                onChange={(e) => setSizeId(e.target.value)}
                className="ui-select text-black border border-zinc-300 focus:border-black"
                disabled={loading || sizesLoading}
                required
              >
                {sizes.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.value}
                  </option>
                ))}
              </select>
            </div>

            {/* Editable Barcode */}
            <div className="ui-form-group">
              <label className="ui-form-label font-semibold text-xs text-zinc-700 uppercase tracking-wide">
                Barcode <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                required
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                placeholder="Barcode"
                className="ui-input font-mono text-black border border-zinc-300 focus:border-black"
                disabled={loading}
              />
            </div>

            {/* Pricing Grid: MRP, SP, PP */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="ui-form-group">
                <label className="ui-form-label font-semibold text-xs text-zinc-700 uppercase tracking-wide">
                  MRP <span className="text-red-600">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={mrp}
                  onChange={(e) => setMrp(e.target.value)}
                  className="ui-input font-mono text-black border border-zinc-300 focus:border-black"
                  disabled={loading}
                />
              </div>

              <div className="ui-form-group">
                <label className="ui-form-label font-semibold text-xs text-zinc-700 uppercase tracking-wide">
                  SP (Selling) <span className="text-red-600">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={sp}
                  onChange={(e) => setSp(e.target.value)}
                  className="ui-input font-mono text-black border border-zinc-300 focus:border-black"
                  disabled={loading}
                />
              </div>

              <div className="ui-form-group">
                <label className="ui-form-label font-semibold text-xs text-zinc-700 uppercase tracking-wide">
                  PP (Purchase) <span className="text-red-600">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={pp}
                  onChange={(e) => setPp(e.target.value)}
                  className="ui-input font-mono text-black border border-zinc-300 focus:border-black"
                  disabled={loading}
                />
              </div>
            </div>

            {/* Quantity */}
            <div className="ui-form-group">
              <label className="ui-form-label font-semibold text-xs text-zinc-700 uppercase tracking-wide">
                Quantity in Stock
              </label>
              <input
                type="number"
                min="0"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="ui-input font-mono text-black border border-zinc-300 focus:border-black"
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

            {/* Toggles */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <label className="flex items-center gap-2 p-3 bg-zinc-50 border border-zinc-200 rounded-lg cursor-pointer">
                <input
                  type="checkbox"
                  checked={onlineAvailable}
                  onChange={(e) => setOnlineAvailable(e.target.checked)}
                  className="w-4 h-4 rounded border-zinc-300 text-black focus:ring-black cursor-pointer"
                  disabled={loading}
                />
                <span className="text-xs font-medium text-black">
                  Online Available (Toggle)
                </span>
              </label>

              <label className="flex items-center gap-2 p-3 bg-zinc-50 border border-zinc-200 rounded-lg cursor-pointer">
                <input
                  type="checkbox"
                  checked={onLandingPage}
                  onChange={(e) => setOnLandingPage(e.target.checked)}
                  className="w-4 h-4 rounded border-zinc-300 text-black focus:ring-black cursor-pointer"
                  disabled={loading}
                />
                <span className="text-xs font-medium text-black">
                  On Landing Page (Toggle)
                </span>
              </label>
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
              className="ui-btn ui-btn-grey ui-btn-md font-medium cursor-pointer shadow-xs"
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
