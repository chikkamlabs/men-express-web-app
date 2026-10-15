'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { X, Loader2, Search, Check, ChevronDown } from 'lucide-react';
import {
  Product,
  calculateNextProdId,
  createProduct,
} from '@/lib/productsStore';
import { Category, getCategories } from '@/lib/categoriesStore';

interface AddProductProps {
  isOpen: boolean;
  onClose: () => void;
  productsCount: number;
  existingProducts: Product[];
  onProductCreated: (product: Product) => void;
}

export default function AddProductModal({
  isOpen,
  onClose,
  productsCount,
  existingProducts,
  onProductCreated,
}: AddProductProps) {
  const autoProdId = calculateNextProdId(productsCount, existingProducts);

  // Form states
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [categorySearch, setCategorySearch] = useState('');
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);

  const [name, setName] = useState('');
  const [fit, setFit] = useState('');
  const [collar, setCollar] = useState('');
  const [fabric, setFabric] = useState('');
  const [status, setStatus] = useState<boolean>(true);

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const dropdownRef = useRef<HTMLDivElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Load categories for search-and-select dropdown
  useEffect(() => {
    let ignore = false;
    if (isOpen) {
      getCategories().then(({ data }) => {
        if (!ignore && data) {
          setCategories(data);
          setCategoriesLoading(false);
        }
      });
    }
    return () => {
      ignore = true;
    };
  }, [isOpen]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsCategoryDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Filtered categories in dropdown
  const filteredCategories = useMemo(() => {
    const q = categorySearch.trim().toLowerCase();
    if (!q) return categories;
    return categories.filter(
      (c) =>
        c.name.toLowerCase().includes(q) || c.cat_id.toLowerCase().includes(q)
    );
  }, [categories, categorySearch]);

  const selectedCategory = useMemo(() => {
    return categories.find((c) => c.id === selectedCategoryId);
  }, [categories, selectedCategoryId]);

  if (!isOpen) return null;

  // Keyboard navigation: Enter key jumps to the next input field
  const handleKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const form = e.currentTarget.closest('form');
      if (!form) return;

      const focusable = Array.from(
        form.querySelectorAll<HTMLElement>(
          'input:not([disabled]):not([readonly]), select:not([disabled]), textarea:not([disabled]), button[type="submit"]'
        )
      );

      const index = focusable.indexOf(e.currentTarget);
      if (index > -1 && index + 1 < focusable.length) {
        focusable[index + 1].focus();
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCategoryId) {
      setErrorMessage('Please select a category.');
      return;
    }
    if (!name.trim()) {
      setErrorMessage('Product name is required.');
      return;
    }

    setLoading(true);
    setErrorMessage('');

    try {
      const { data, error } = await createProduct(
        {
          category_id: selectedCategoryId,
          prod_id: autoProdId,
          name: name.trim(),
          fit: fit.trim() || undefined,
          collar: collar.trim() || undefined,
          fabric: fabric.trim() || undefined,
          status,
        },
        selectedCategory?.name
      );

      if (error && !data) {
        setErrorMessage(error.message || 'Failed to create product.');
        setLoading(false);
        return;
      }

      if (data) {
        onProductCreated(data);
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
              Add Product
            </h2>
            <p className="typo-caption text-xs text-zinc-500">
              Press Enter to advance to the next field
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

            {/* prod_id: Auto-filled */}
            <div className="ui-form-group">
              <label className="ui-form-label font-semibold text-xs text-zinc-700 uppercase tracking-wide">
                Product ID (Auto-filled)
              </label>
              <input
                type="text"
                value={autoProdId}
                readOnly
                disabled
                className="ui-input bg-zinc-100 text-zinc-600 font-mono text-sm cursor-not-allowed border border-zinc-300"
              />
              <span className="ui-form-helper text-xs text-zinc-500 mt-1">
                Auto-assigned: prod_1001 + count of existing products
              </span>
            </div>

            {/* category_id: search and select from drop down */}
            <div className="ui-form-group" ref={dropdownRef}>
              <label className="ui-form-label font-semibold text-xs text-zinc-700 uppercase tracking-wide">
                Category <span className="text-red-600">*</span>
              </label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsCategoryDropdownOpen((prev) => !prev)}
                  onKeyDown={handleKeyDown}
                  className="ui-input flex items-center justify-between text-left text-sm text-black border border-zinc-300 focus:border-black rounded-lg cursor-pointer bg-white px-3"
                  disabled={loading || categoriesLoading}
                >
                  <span className={selectedCategory ? 'text-black font-medium' : 'text-zinc-400'}>
                    {selectedCategory
                      ? `${selectedCategory.name} (${selectedCategory.cat_id})`
                      : categoriesLoading
                      ? 'Loading categories...'
                      : 'Search and select category...'}
                  </span>
                  <ChevronDown className="w-4 h-4 text-zinc-500 flex-shrink-0" />
                </button>

                {isCategoryDropdownOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-zinc-300 rounded-lg shadow-lg z-50 max-h-56 overflow-hidden flex flex-col">
                    {/* Search inside dropdown */}
                    <div className="p-2 border-b border-zinc-200 bg-zinc-50">
                      <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400 pointer-events-none" />
                        <input
                          type="text"
                          value={categorySearch}
                          onChange={(e) => setCategorySearch(e.target.value)}
                          placeholder="Search categories..."
                          style={{ paddingLeft: '2rem' }}
                          className="ui-input text-xs py-1.5 h-8 pr-2 w-full border border-zinc-300 rounded bg-white text-black"
                          autoFocus
                        />
                      </div>
                    </div>

                    {/* Category list options */}
                    <div className="overflow-y-auto flex-1 divide-y divide-zinc-100 max-h-40">
                      {filteredCategories.length === 0 ? (
                        <div className="p-3 text-xs text-center text-zinc-500">
                          {categories.length === 0
                            ? 'No categories found in database.'
                            : 'No matching categories.'}
                        </div>
                      ) : (
                        filteredCategories.map((cat) => {
                          const isSelected = cat.id === selectedCategoryId;
                          return (
                            <button
                              key={cat.id}
                              type="button"
                              onClick={() => {
                                setSelectedCategoryId(cat.id);
                                setIsCategoryDropdownOpen(false);
                                setCategorySearch('');
                                nameInputRef.current?.focus();
                              }}
                              className={`w-full px-3 py-2 text-left text-xs flex items-center justify-between hover:bg-zinc-100 transition-colors cursor-pointer ${
                                isSelected ? 'bg-zinc-100 font-semibold text-black' : 'text-zinc-800'
                              }`}
                            >
                              <div>
                                <span className="font-medium">{cat.name}</span>
                                <span className="text-zinc-500 font-mono ml-2">
                                  ({cat.cat_id})
                                </span>
                              </div>
                              {isSelected && (
                                <Check className="w-3.5 h-3.5 text-black flex-shrink-0" />
                              )}
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Name */}
            <div className="ui-form-group">
              <label className="ui-form-label font-semibold text-xs text-zinc-700 uppercase tracking-wide">
                Product Name <span className="text-red-600">*</span>
              </label>
              <input
                ref={nameInputRef}
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="e.g. Oxford Formal Shirt"
                className="ui-input text-black border border-zinc-300 focus:border-black"
                disabled={loading}
              />
            </div>

            {/* Fit */}
            <div className="ui-form-group">
              <label className="ui-form-label font-semibold text-xs text-zinc-700 uppercase tracking-wide">
                Fit
              </label>
              <input
                type="text"
                value={fit}
                onChange={(e) => setFit(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="e.g. Slim, Regular, Relaxed"
                className="ui-input text-black border border-zinc-300 focus:border-black"
                disabled={loading}
              />
            </div>

            {/* Collar (or Color/Collar Style) */}
            <div className="ui-form-group">
              <label className="ui-form-label font-semibold text-xs text-zinc-700 uppercase tracking-wide">
                Collar / Color
              </label>
              <input
                type="text"
                value={collar}
                onChange={(e) => setCollar(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="e.g. Mandarin, Button Down, Spread, Navy Blue"
                className="ui-input text-black border border-zinc-300 focus:border-black"
                disabled={loading}
              />
            </div>

            {/* Fabric */}
            <div className="ui-form-group">
              <label className="ui-form-label font-semibold text-xs text-zinc-700 uppercase tracking-wide">
                Fabric
              </label>
              <input
                type="text"
                value={fabric}
                onChange={(e) => setFabric(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="e.g. 100% Cotton, Linen Blend, Twill"
                className="ui-input text-black border border-zinc-300 focus:border-black"
                disabled={loading}
              />
            </div>

            {/* Status (default True) */}
            <div className="ui-form-group">
              <label className="ui-form-label font-semibold text-xs text-zinc-700 uppercase tracking-wide">
                Status (Default True)
              </label>
              <select
                value={status ? 'true' : 'false'}
                onChange={(e) => setStatus(e.target.value === 'true')}
                onKeyDown={handleKeyDown}
                className="ui-select text-black border border-zinc-300 focus:border-black"
                disabled={loading}
              >
                <option value="true">Active (True - default)</option>
                <option value="false">Inactive (False)</option>
              </select>
            </div>
          </div>

          {/* Footer with grey button that turns dark black on tap */}
          <div className="ui-dialog-footer flex items-center justify-between gap-3 px-6 py-4 bg-zinc-50 border-t border-zinc-200">
            <span className="text-xs text-zinc-500 hidden sm:inline">
              Tip: Press Enter to move between inputs
            </span>
            <div className="flex items-center gap-3 ml-auto">
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
                    Creating...
                  </>
                ) : (
                  'Create'
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
