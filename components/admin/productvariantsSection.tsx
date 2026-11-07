'use client';

import React from 'react';
import { X, Layers, Barcode, Palette, Ruler, PackageCheck } from 'lucide-react';
import { StoreProductItem } from '@/lib/admin/storeproducts';

interface ProductVariantsSectionProps {
  isOpen: boolean;
  product: StoreProductItem | null;
  onClose: () => void;
}

export default function ProductVariantsSection({
  isOpen,
  product,
  onClose,
}: ProductVariantsSectionProps) {
  if (!isOpen || !product) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl border border-zinc-200 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header: Display product name */}
        <div className="flex items-start justify-between p-5 border-b border-zinc-200 bg-zinc-50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-black text-white rounded-lg">
              <Layers className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-black tracking-tight">
                  {product.name}
                </h2>
                {product.prod_id && (
                  <span className="px-2 py-0.5 text-xs font-mono font-semibold bg-zinc-200 text-zinc-800 rounded">
                    {product.prod_id}
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-500 mt-0.5">
                {product.category_name || 'Category'} &bull; {product.variants.length} variant
                {product.variants.length === 1 ? '' : 's'} available in store
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-black rounded-lg hover:bg-zinc-200 transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Variants Table: color, size, quantity, barcode */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          <div className="ui-table-container border border-zinc-200 rounded-lg overflow-hidden bg-white shadow-xs">
            <table className="ui-table w-full text-left border-collapse">
              <thead>
                <tr className="bg-zinc-100 border-b border-zinc-200">
                  <th className="py-2.5 px-4 font-semibold text-xs text-zinc-600 uppercase tracking-wider">
                    <span className="flex items-center gap-1.5">
                      <Palette className="w-3.5 h-3.5 text-zinc-500" />
                      Color
                    </span>
                  </th>
                  <th className="py-2.5 px-4 font-semibold text-xs text-zinc-600 uppercase tracking-wider">
                    <span className="flex items-center gap-1.5">
                      <Ruler className="w-3.5 h-3.5 text-zinc-500" />
                      Size
                    </span>
                  </th>
                  <th className="py-2.5 px-4 font-semibold text-xs text-zinc-600 uppercase tracking-wider">
                    <span className="flex items-center gap-1.5">
                      <PackageCheck className="w-3.5 h-3.5 text-zinc-500" />
                      Quantity
                    </span>
                  </th>
                  <th className="py-2.5 px-4 font-semibold text-xs text-zinc-600 uppercase tracking-wider">
                    <span className="flex items-center gap-1.5">
                      <Barcode className="w-3.5 h-3.5 text-zinc-500" />
                      Barcode
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {product.variants.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-sm text-zinc-500">
                      No variants found for this product in this store.
                    </td>
                  </tr>
                ) : (
                  product.variants.map((v) => (
                    <tr key={v.id || v.barcode} className="hover:bg-zinc-50 transition-colors">
                      {/* Color */}
                      <td className="py-3 px-4 text-sm text-black">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-3.5 h-3.5 rounded-full border border-zinc-300 shadow-2xs shrink-0"
                            style={{ backgroundColor: v.color_code || '#000000' }}
                            title={v.color_name}
                          />
                          <span className="font-medium">{v.color_name || 'Standard'}</span>
                        </div>
                      </td>

                      {/* Size */}
                      <td className="py-3 px-4 text-sm font-semibold text-zinc-900">
                        <span className="inline-block px-2 py-0.5 bg-zinc-100 border border-zinc-200 rounded text-xs">
                          {v.size_value || '—'}
                        </span>
                      </td>

                      {/* Quantity */}
                      <td className="py-3 px-4 text-sm font-bold font-mono">
                        <span
                          className={
                            v.quantity > 0
                              ? 'text-emerald-700 font-bold'
                              : 'text-rose-600 font-bold'
                          }
                        >
                          {v.quantity}
                        </span>
                      </td>

                      {/* Barcode */}
                      <td className="py-3 px-4 text-sm font-mono text-zinc-700">
                        {v.barcode || '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between p-4 border-t border-zinc-200 bg-zinc-50">
          <div className="text-xs text-zinc-500">
            Total In-Store Stock:{' '}
            <span className="font-bold font-mono text-black">
              {product.total_quantity}
            </span>
          </div>
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
