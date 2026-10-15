'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { X, Loader2, Search, Check, ChevronDown } from 'lucide-react';
import { Product, updateProduct } from '@/lib/productsStore';
import { Category, getCategories } from '@/lib/categoriesStore';

interface OpenProductProps {
  isOpen: boolean;
  product: Product;
  onClose: () => void;
  onProductUpdated: (product: Product) => void;
}

export default function OpenProductModal({
  isOpen,
  product,
  onClose,
  onProductUpdated,
}: OpenProductProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [selectedCategoryId, setSelectedCategoryId] = useState(product.category_id || '');
  const [categorySearch, setCategorySearch] = useState('');
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);

  const [name, setName] = useState(product.name || '');
  const [fit, setFit] = useState(product.fit || '');
  const [collar, setCollar] = useState(product.collar || '');
  const [fabric, setFabric] = useState(product.fabric || '');
  const [status, setStatus] = useState<boolean>(
    typeof product.status === 'boolean' ? product.status : true
  );
  const [landingPage, setLandingPage] = useState<boolean>(
    typeof product.landing_page === 'boolean' ? product.landing_page : false
  );

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCategoryId) {
      setErrorMessage('Please select a category.');
      return;
    }
    if (!name.trim()) {
      setErrorMessage('Product name cannot be empty.');
      return;
    }

    setLoading(true);
    setErrorMessage('');

    try {
      const { data, error } = await updateProduct(
        product.prod_id,
        {
          category_id: selectedCategoryId,
          name: name.trim(),
          fit: fit.trim() || undefined,
          collar: collar.trim() || undefined,
          fabric: fabric.trim() || undefined,
          status,
          landing_page: landingPage,
        },
        selectedCategory?.name
      );

      if (error && !data) {
        setErrorMessage(error.message || 'Failed to update product.');
        setLoading(false);
        return;
      }

      if (data) {
        onProductUpdated(data);
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
              Product Details
            </h2>
            <p className="typo-caption text-xs text-zinc-500">
              ID: {product.prod_id}
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

            {/* Display prod_id (Read-only / Immutable) */}
            <div className="ui-form-group">
              <label className="ui-form-label font-semibold text-xs text-zinc-700 uppercase tracking-wide">
                Product ID (Immutable)
              </label>
              <input
                type="text"
                value={product.prod_id}
                readOnly
                disabled
                className="ui-input bg-zinc-100 text-zinc-600 font-mono text-sm cursor-not-allowed border border-zinc-300"
              />
              <span className="ui-form-helper text-xs text-zinc-500 mt-1">
                Product ID cannot be edited.
              </span>
            </div>

            {/* Editable Category */}
            <div className="ui-form-group" ref={dropdownRef}>
              <label className="ui-form-label font-semibold text-xs text-zinc-700 uppercase tracking-wide">
                Category <span className="text-red-600">*</span>
              </label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsCategoryDropdownOpen((prev) => !prev)}
                  className="ui-input flex items-center justify-between text-left text-sm text-black border border-zinc-300 focus:border-black rounded-lg cursor-pointer bg-white px-3"
                  disabled={loading || categoriesLoading}
                >
                  <span className={selectedCategory ? 'text-black font-medium' : 'text-zinc-500'}>
                    {selectedCategory
                      ? `${selectedCategory.name} (${selectedCategory.cat_id})`
                      : product.category_name || 'Select Category...'}
                  </span>
                  <ChevronDown className="w-4 h-4 text-zinc-500 flex-shrink-0" />
                </button>

                {isCategoryDropdownOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-zinc-300 rounded-lg shadow-lg z-50 max-h-56 overflow-hidden flex flex-col">
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

                    <div className="overflow-y-auto flex-1 divide-y divide-zinc-100 max-h-40">
                      {filteredCategories.map((cat) => {
                        const isSelected = cat.id === selectedCategoryId;
                        return (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() => {
                              setSelectedCategoryId(cat.id);
                              setIsCategoryDropdownOpen(false);
                              setCategorySearch('');
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
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Editable Name */}
            <div className="ui-form-group">
              <label className="ui-form-label font-semibold text-xs text-zinc-700 uppercase tracking-wide">
                Product Name <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Product Name"
                className="ui-input text-black border border-zinc-300 focus:border-black"
                disabled={loading}
              />
            </div>

            {/* Editable Fit */}
            <div className="ui-form-group">
              <label className="ui-form-label font-semibold text-xs text-zinc-700 uppercase tracking-wide">
                Fit
              </label>
              <input
                type="text"
                value={fit}
                onChange={(e) => setFit(e.target.value)}
                placeholder="e.g. Slim, Regular, Relaxed"
                className="ui-input text-black border border-zinc-300 focus:border-black"
                disabled={loading}
              />
            </div>

            {/* Editable Collar */}
            <div className="ui-form-group">
              <label className="ui-form-label font-semibold text-xs text-zinc-700 uppercase tracking-wide">
                Collar
              </label>
              <input
                type="text"
                value={collar}
                onChange={(e) => setCollar(e.target.value)}
                placeholder="e.g. Mandarin, Button Down, Spread"
                className="ui-input text-black border border-zinc-300 focus:border-black"
                disabled={loading}
              />
            </div>

            {/* Editable Fabric */}
            <div className="ui-form-group">
              <label className="ui-form-label font-semibold text-xs text-zinc-700 uppercase tracking-wide">
                Fabric
              </label>
              <input
                type="text"
                value={fabric}
                onChange={(e) => setFabric(e.target.value)}
                placeholder="e.g. 100% Cotton, Linen"
                className="ui-input text-black border border-zinc-300 focus:border-black"
                disabled={loading}
              />
            </div>

            {/* Editable Status */}
            <div className="ui-form-group">
              <label className="ui-form-label font-semibold text-xs text-zinc-700 uppercase tracking-wide">
                Status
              </label>
              <select
                value={status ? 'true' : 'false'}
                onChange={(e) => setStatus(e.target.value === 'true')}
                className="ui-select text-black border border-zinc-300 focus:border-black"
                disabled={loading}
              >
                <option value="true">Active (True)</option>
                <option value="false">Inactive (False)</option>
              </select>
            </div>

            {/* Editable Landing Page (true / false) */}
            <div className="ui-form-group">
              <label className="ui-form-label font-semibold text-xs text-zinc-700 uppercase tracking-wide">
                Landing Page
              </label>
              <select
                value={landingPage ? 'true' : 'false'}
                onChange={(e) => setLandingPage(e.target.value === 'true')}
                className="ui-select text-black border border-zinc-300 focus:border-black"
                disabled={loading}
              >
                <option value="false">No (False)</option>
                <option value="true">Yes (True)</option>
              </select>
              <span className="ui-form-helper text-xs text-zinc-500 mt-1">
                Display this product on the public landing page showcase
              </span>
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
