'use client';

import React, { useState, useEffect } from 'react';
import { X, Loader2, Plus, AlertCircle, Check } from 'lucide-react';
import { SizeItem, getSizes } from '@/lib/settingsStore';
import { ProductColor } from '@/lib/productcolorsStore';
import { ProductVariant, createProductVariant } from '@/lib/productVariantsStore';

interface AddProductVariantProps {
  isOpen: boolean;
  onClose: () => void;
  productId: string;
  productColors: ProductColor[];
  existingVariants?: ProductVariant[];
  onVariantCreated: (variant: ProductVariant | ProductVariant[]) => void;
}

export default function AddProductVariantModal({
  isOpen,
  onClose,
  productId,
  productColors,
  existingVariants = [],
  onVariantCreated,
}: AddProductVariantProps) {
  const [sizes, setSizes] = useState<SizeItem[]>([]);
  const [sizesLoading, setSizesLoading] = useState(true);

  // Form states
  const [sizeId, setSizeId] = useState('');
  // Per-color pricing and quantity
const [colorPricing, setColorPricing] = useState<
  Record<
    string,
    {
      mrp: string;
      sp: string;
      pp: string;
      quantity: string;
    }
  >
>({});
  const [onlineAvailable, setOnlineAvailable] = useState(true);
  const [onLandingPage, setOnLandingPage] = useState(false);

  // Multi-color selection state
  const [selectedProductColorIds, setSelectedProductColorIds] = useState<string[]>(
    () => (productColors.length > 0 ? [productColors[0].id] : [])
  );

  // Per-color barcodes map { [productColorId]: barcodeString }
  const [colorBarcodes, setColorBarcodes] = useState<Record<string, string>>({});

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Fetch sizes from sizes table
  useEffect(() => {
    let ignore = false;
    if (isOpen) {
      getSizes().then(({ data }) => {
        if (!ignore && data) {
          setSizes(data);
          setSizeId((prev) => prev || (data.length > 0 ? data[0].id : ''));
          setSizesLoading(false);
        }
      });
    }
    return () => {
      ignore = true;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  // Toggle single color in multi-selection
  const handleToggleColor = (colorId: string) => {
    setSelectedProductColorIds((prev) => {
      if (prev.includes(colorId)) {
        return prev.filter((id) => id !== colorId);
      } else {
        return [...prev, colorId];
      }
    });
  };

  // Helper: check if a color is already added for this size
  const isColorAlreadyAssignedForSize = (colorId: string, targetSizeId: string) => {
    if (!targetSizeId) return false;
    return existingVariants.some(
      (v) => v.product_color_id === colorId && v.size_id === targetSizeId
    );
  };

  // Select all available colors that are not already assigned for the selected size
  const handleSelectAllColors = () => {
    const validColors = productColors
      .filter((pc) => !isColorAlreadyAssignedForSize(pc.id, sizeId))
      .map((pc) => pc.id);
    setSelectedProductColorIds(validColors);
  };

  // Deselect all colors
  const handleDeselectAllColors = () => {
    setSelectedProductColorIds([]);
  };

  // Update barcode for a specific color
  const handleBarcodeChange = (colorId: string, val: string) => {
    setColorBarcodes((prev) => ({
      ...prev,
      [colorId]: val,
    }));
  };

  const handleColorPricingChange = (
  colorId: string,
  field: 'mrp' | 'sp' | 'pp' | 'quantity',
  value: string
) => {
  setColorPricing((prev) => ({
    ...prev,
    [colorId]: {
      mrp: prev[colorId]?.mrp || '',
      sp: prev[colorId]?.sp || '',
      pp: prev[colorId]?.pp || '',
      quantity: prev[colorId]?.quantity ?? '0',
      [field]: value,
    },
  }));
};

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sizeId) {
      setErrorMessage('Please select a size.');
      return;
    }

    if (selectedProductColorIds.length === 0) {
      setErrorMessage('Please select at least one color for this variant.');
      return;
    }

    // 1. Prevent duplicate (color, size) violations (database constraint: uq_product_variant_color_size)
    const existingDuplicates: string[] = [];
    for (const colorId of selectedProductColorIds) {
      if (isColorAlreadyAssignedForSize(colorId, sizeId)) {
        const pc = productColors.find((c) => c.id === colorId);
        existingDuplicates.push(pc?.color?.name || 'Color');
      }
    }

    if (existingDuplicates.length > 0) {
      const chosenSizeObj = sizes.find((s) => s.id === sizeId);
      setErrorMessage(
        `Variant already exists for size "${chosenSizeObj?.value || 'selected'}" in color(s): ${existingDuplicates.join(', ')}. Please unselect these color(s) or select a different size.`
      );
      return;
    }

    // 2. Check that every selected color has a non-empty barcode
    for (const colorId of selectedProductColorIds) {
      const code = (colorBarcodes[colorId] || '').trim();
      if (!code) {
        const cObj = productColors.find((pc) => pc.id === colorId);
        setErrorMessage(`Please enter a barcode for ${cObj?.color?.name || 'the selected color'}.`);
        return;
      }
    }

    // 3. Check duplicate barcodes among selected colors
    const enteredCodes = selectedProductColorIds.map((id) => (colorBarcodes[id] || '').trim());
    const uniqueCodes = new Set(enteredCodes);
    if (uniqueCodes.size !== enteredCodes.length) {
      setErrorMessage('Barcodes must be unique for each color variant.');
      return;
    }

    // 4. Check if any entered barcode already exists in current variants
    for (const code of enteredCodes) {
      const existingMatch = existingVariants.find(
        (v) => v.barcode.trim().toLowerCase() === code.toLowerCase()
      );
      if (existingMatch) {
        setErrorMessage(
          `Barcode "${code}" is already in use by another variant. Each variant must have a unique barcode.`
        );
        return;
      }
    }

    // Validate pricing and quantity separately for every selected color
const pricingByColor: Record<
  string,
  { mrp: number; sp: number; pp: number; quantity: number }
> = {};

for (const colorId of selectedProductColorIds) {
  const pricing = colorPricing[colorId];

  const mrpNum = Number(pricing?.mrp);
  const spNum = Number(pricing?.sp);
  const ppNum = Number(pricing?.pp);
  const qtyNum = Number(pricing?.quantity);

  const colorName =
    productColors.find((pc) => pc.id === colorId)?.color?.name || 'Color';

  if (
    !pricing?.mrp?.trim() ||
    !Number.isFinite(mrpNum) ||
    mrpNum < 0
  ) {
    setErrorMessage(`Enter a valid MRP for ${colorName}.`);
    return;
  }

  if (
    !pricing?.sp?.trim() ||
    !Number.isFinite(spNum) ||
    spNum < 0 ||
    spNum > mrpNum
  ) {
    setErrorMessage(`SP for ${colorName} must be between 0 and its MRP.`);
    return;
  }

  if (
    !pricing?.pp?.trim() ||
    !Number.isFinite(ppNum) ||
    ppNum < 0
  ) {
    setErrorMessage(`Enter a valid PP for ${colorName}.`);
    return;
  }

  if (
    pricing?.quantity === undefined ||
    pricing.quantity.trim() === '' ||
    !Number.isInteger(qtyNum) ||
    qtyNum < 0
  ) {
    setErrorMessage(`Enter a valid stock quantity for ${colorName}.`);
    return;
  }

  pricingByColor[colorId] = {
    mrp: mrpNum,
    sp: spNum,
    pp: ppNum,
    quantity: qtyNum,
  };
}


    setLoading(true);
    setErrorMessage('');

    const chosenSize = sizes.find((s) => s.id === sizeId);

    try {
      const createdList: ProductVariant[] = [];
      const errorList: string[] = [];

      // Sequentially insert each selected color into product_variants table in Supabase
      for (const colorId of selectedProductColorIds) {
        const chosenColor = productColors.find((pc) => pc.id === colorId);
        const thisBarcode = (colorBarcodes[colorId] || '').trim();
        const thisPricing = pricingByColor[colorId];

        const { data, error } = await createProductVariant(
          {
            product_id: productId,
            product_color_id: colorId,
            size_id: sizeId,
            barcode: thisBarcode,
            mrp: thisPricing.mrp,
            s_p: thisPricing.sp,
            p_p: thisPricing.pp,
            quantity: thisPricing.quantity,
            online_available: onlineAvailable,
            on_landing_page: onLandingPage,
            status: 'active',
          },
          {
            size_value: chosenSize?.value,
            color_name: chosenColor?.color?.name,
            color_code: chosenColor?.color?.code,
          }
        );

        if (error || !data) {
          const errMsg = error?.message || 'Failed';
          const isConstraintErr =
            errMsg.includes('uq_product_variant_color_size') ||
            errMsg.includes('duplicate key');
          errorList.push(
            `${chosenColor?.color?.name || 'Color'}: ${
              isConstraintErr
                ? 'Variant already exists for this color and size combination'
                : errMsg
            }`
          );
        } else {
          createdList.push(data);
        }
      }

      if (createdList.length > 0) {
        onVariantCreated(createdList);
      }

      if (errorList.length > 0) {
        setErrorMessage(
          `Created ${createdList.length} of ${selectedProductColorIds.length} variant(s). Errors: ${errorList.join('; ')}`
        );
      } else {
        onClose();
      }
    } catch {
      setErrorMessage('An unexpected error occurred while creating variants.');
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
            Add Product Variant
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
          <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
            {errorMessage && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded">
                {errorMessage}
              </div>
            )}

            {productColors.length === 0 && (
              <div className="p-3 bg-yellow-50 border border-yellow-200 text-yellow-800 text-xs rounded flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>
                  This product has no colors assigned yet. Please add colors under the Colors tab first.
                </span>
              </div>
            )}

            {/* 1. Size ID (fetch from sizes table) */}
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
                {sizes.length === 0 ? (
                  <option value="">No sizes found in database</option>
                ) : (
                  sizes.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.value}
                    </option>
                  ))
                )}
              </select>
            </div>

            {/* Pricing Grid: MRP, SP, PP */}
            


            {/* Toggles: Online Available & On Landing Page */}
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

            {/* Multiple Colors Selection: Ask which colors are available for this variant */}
            <div className="ui-form-group pt-2">
              <div className="flex items-center justify-between mb-1">
                <label className="ui-form-label font-semibold text-xs text-zinc-700 uppercase tracking-wide">
                  Select Colors for this Variant <span className="text-red-600">*</span>
                </label>
                {productColors.length > 1 && (
                  <div className="flex items-center gap-2 text-2xs">
                    <button
                      type="button"
                      onClick={handleSelectAllColors}
                      className="text-black font-semibold hover:underline cursor-pointer"
                    >
                      Select All
                    </button>
                    <span className="text-zinc-300">|</span>
                    <button
                      type="button"
                      onClick={handleDeselectAllColors}
                      className="text-zinc-500 hover:text-black cursor-pointer"
                    >
                      Clear
                    </button>
                  </div>
                )}
              </div>

              <span className="text-2xs text-zinc-500 block mb-2">
                Select one or multiple colors available for this SKU ({selectedProductColorIds.length} selected):
              </span>

              {productColors.length === 0 ? (
                <div className="p-3 bg-zinc-50 border border-zinc-200 text-xs text-zinc-500 rounded text-center">
                  No colors added to this product yet.
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {productColors.map((pc) => {
                    const alreadyExists = isColorAlreadyAssignedForSize(pc.id, sizeId);
                    const isSelected = selectedProductColorIds.includes(pc.id);
                    const colorName = pc.color?.name || 'Color';
                    const colorCode = pc.color?.code || '#000000';

                    return (
                      <button
                        key={pc.id}
                        type="button"
                        onClick={() => {
                          if (!alreadyExists) {
                            handleToggleColor(pc.id);
                          }
                        }}
                        disabled={alreadyExists}
                        className={`p-2.5 rounded-lg border text-left flex items-center justify-between gap-2 transition-all cursor-pointer ${
                          alreadyExists
                            ? 'opacity-40 bg-zinc-100 border-zinc-200 cursor-not-allowed'
                            : isSelected
                            ? 'border-black bg-zinc-100 ring-2 ring-black font-semibold'
                            : 'border-zinc-200 bg-white hover:bg-zinc-50'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <span
                            className="w-4 h-4 rounded-full border border-zinc-300 flex-shrink-0"
                            style={{ backgroundColor: colorCode }}
                            aria-hidden="true"
                          />
                          <div className="truncate">
                            <span className="text-xs text-black block truncate">
                              {colorName}
                            </span>
                            <span className="text-2xs font-mono text-zinc-500 block truncate">
                              {alreadyExists ? 'Already added' : colorCode}
                            </span>
                          </div>
                        </div>

                        {isSelected && !alreadyExists && (
                          <div className="w-4 h-4 rounded bg-black text-white flex items-center justify-center flex-shrink-0">
                            <Check className="w-3 h-3 text-white" />
                          </div>
                        )}
                        {alreadyExists && (
                          <span className="text-3xs bg-zinc-200 text-zinc-600 px-1 py-0.5 rounded font-mono">
                            Added
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Barcode input for selected color(s) */}
              {selectedProductColorIds.length > 0 && (
                <div className="mt-4 pt-3 border-t border-zinc-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="ui-form-label font-semibold text-xs text-zinc-700 uppercase tracking-wide">
                      {selectedProductColorIds.length > 1
                        ? `Barcodes for Selected Colors (${selectedProductColorIds.length})`
                        : 'Barcode for Selected Color'}{' '}
                      <span className="text-red-600">*</span>
                    </label>
                  </div>
                  <p className="text-2xs text-zinc-500">
                    {selectedProductColorIds.length > 1
                      ? 'Please enter the specific barcode for each selected color variant:'
                      : 'Enter the barcode for this variant:'}
                  </p>

                  <div className="space-y-2.5">
                    {selectedProductColorIds.map((colorId) => {
                      const pc = productColors.find((c) => c.id === colorId);
                      const colorName = pc?.color?.name || 'Selected Color';
                      const colorCode = pc?.color?.code || '#000000';
                      const currentVal = colorBarcodes[colorId] || '';

                      return (
  <div
    key={colorId}
    className="p-4 bg-zinc-50 border border-zinc-200 rounded-lg space-y-3"
  >
    {/* Color Header */}
    <div className="flex items-center gap-2 border-b border-zinc-200 pb-2">
      <span
        className="w-4 h-4 rounded-full border border-zinc-300 flex-shrink-0"
        style={{ backgroundColor: colorCode }}
        aria-hidden="true"
      />
      <span className="text-sm font-bold text-black">
        {colorName}
      </span>
    </div>

    {/* Barcode */}
    <div>
      <label className="text-xs font-semibold text-zinc-700 block mb-1">
        Barcode *
      </label>
      <input
        type="text"
        required
        value={currentVal}
        onChange={(e) =>
          handleBarcodeChange(colorId, e.target.value)
        }
        placeholder={`Barcode for ${colorName}`}
        className="ui-input font-mono text-xs text-black border border-zinc-300 focus:border-black w-full bg-white"
        disabled={loading}
      />
    </div>

    {/* Per Color Pricing */}
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <div>
        <label className="text-xs font-semibold text-zinc-700 block mb-1">
          MRP (₹) *
        </label>
        <input
          type="number"
          min="0"
          step="0.01"
          required
          value={colorPricing[colorId]?.mrp || ''}
          onChange={(e) =>
            handleColorPricingChange(colorId, 'mrp', e.target.value)
          }
          placeholder="999.00"
          className="ui-input font-mono text-black text-xs border border-zinc-300 focus:border-black w-full bg-white"
          disabled={loading}
        />
      </div>

      <div>
        <label className="text-xs font-semibold text-zinc-700 block mb-1">
          SP (₹) *
        </label>
        <input
          type="number"
          min="0"
          step="0.01"
          required
          value={colorPricing[colorId]?.sp || ''}
          onChange={(e) =>
            handleColorPricingChange(colorId, 'sp', e.target.value)
          }
          placeholder="799.00"
          className="ui-input font-mono text-black text-xs border border-zinc-300 focus:border-black w-full bg-white"
          disabled={loading}
        />
      </div>

      <div>
        <label className="text-xs font-semibold text-zinc-700 block mb-1">
          PP (₹) *
        </label>
        <input
          type="number"
          min="0"
          step="0.01"
          required
          value={colorPricing[colorId]?.pp || ''}
          onChange={(e) =>
            handleColorPricingChange(colorId, 'pp', e.target.value)
          }
          placeholder="450.00"
          className="ui-input font-mono text-black text-xs border border-zinc-300 focus:border-black w-full bg-white"
          disabled={loading}
        />
      </div>
    </div>

    {/* Per Color Quantity */}
    <div>
      <label className="text-xs font-semibold text-zinc-700 block mb-1">
        Initial Stock Quantity *
      </label>
      <input
        type="number"
        min="0"
        step="1"
        required
        value={colorPricing[colorId]?.quantity ?? '0'}
        onChange={(e) =>
          handleColorPricingChange(colorId, 'quantity', e.target.value)
        }
        placeholder="0"
        className="ui-input font-mono text-black text-xs border border-zinc-300 focus:border-black w-full bg-white"
        disabled={loading}
      />
    </div>
  </div>
);
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer with grey button that turns dark black on tap */}
          <div className="ui-dialog-footer flex items-center justify-between gap-3 px-6 py-4 bg-zinc-50 border-t border-zinc-200">
            <div className="text-xs text-zinc-600 font-medium">
              {selectedProductColorIds.length > 0 && (
                <span>
                  Creating {selectedProductColorIds.length} variant{selectedProductColorIds.length > 1 ? 's' : ''}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
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
                disabled={loading || productColors.length === 0 || selectedProductColorIds.length === 0}
                className="ui-btn ui-btn-grey ui-btn-md font-medium cursor-pointer shadow-xs flex items-center gap-1.5"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 text-white" />
                    <span>
                      {selectedProductColorIds.length > 1
                        ? `Create (${selectedProductColorIds.length}) Variants`
                        : 'Create Variant'}
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
