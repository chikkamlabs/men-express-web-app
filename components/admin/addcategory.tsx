'use client';

import React, { useState, useRef } from 'react';
import { X, Loader2, Upload, ImageIcon, Trash2 } from 'lucide-react';
import Image from 'next/image';
import {
  Category,
  calculateNextCatId,
  createCategory,
  uploadCategoryImage,
} from '@/lib/categoriesStore';

interface AddCategoryProps {
  isOpen: boolean;
  onClose: () => void;
  categoriesCount: number;
  existingCategories: Category[];
  onCategoryCreated: (category: Category) => void;
}

export default function AddCategoryModal({
  isOpen,
  onClose,
  categoriesCount,
  existingCategories,
  onCategoryCreated,
}: AddCategoryProps) {
  const autoCatId = calculateNextCatId(categoriesCount, existingCategories);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<boolean>(true);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setErrorMessage('Please select a valid image file (PNG, JPG, WEBP, etc.).');
        return;
      }
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setErrorMessage('');
    }
  };

  const handleRemoveImage = () => {
    setSelectedFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMessage('Category name is required.');
      return;
    }

    setLoading(true);
    setErrorMessage('');

    try {
      let imageUrl: string | null = null;

      // 1. If an image is selected, upload to Supabase storage bucket category_images_bucket
      if (selectedFile) {
        const { publicUrl, error: uploadError } = await uploadCategoryImage(
          autoCatId,
          selectedFile
        );

        if (uploadError || !publicUrl) {
          setErrorMessage(
            uploadError?.message || 'Failed to upload category image to bucket category_images_bucket.'
          );
          setLoading(false);
          return;
        }
        imageUrl = publicUrl;
      }

      // 2. Create category with cat_id, name, description, status, and image_url
      const { data, error } = await createCategory({
        cat_id: autoCatId,
        name: name.trim(),
        description: description.trim(),
        status,
        image_url: imageUrl,
      });

      if (error && !data) {
        setErrorMessage(error.message || 'Failed to create category.');
        setLoading(false);
        return;
      }

      if (data) {
        onCategoryCreated(data);
        onClose();
      }
    } catch {
      setErrorMessage('An unexpected error occurred while creating category.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ui-dialog-backdrop p-4" role="dialog" aria-modal="true">
      <div className="ui-dialog-panel w-full max-w-lg bg-white rounded-lg shadow-xl border border-zinc-200 overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="ui-dialog-header flex items-center justify-between border-b border-zinc-200 px-6 py-4 flex-shrink-0">
          <h2 className="typo-section-title text-base sm:text-lg font-bold text-black">
            Add Category
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
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-6 space-y-4 overflow-y-auto flex-1">
            {errorMessage && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded">
                {errorMessage}
              </div>
            )}

            {/* cat_id: Auto-filled */}
            <div className="ui-form-group">
              <label className="ui-form-label font-semibold text-xs text-zinc-700 uppercase tracking-wide">
                Category ID (Auto-filled)
              </label>
              <input
                type="text"
                value={autoCatId}
                readOnly
                disabled
                className="ui-input bg-zinc-100 text-zinc-600 font-mono text-sm cursor-not-allowed border border-zinc-300"
              />
              <span className="ui-form-helper text-xs text-zinc-500 mt-1">
                Auto-assigned: cat_101 + count of existing categories
              </span>
            </div>

            {/* Name */}
            <div className="ui-form-group">
              <label className="ui-form-label font-semibold text-xs text-zinc-700 uppercase tracking-wide">
                Name <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Shirts, T-Shirts, Trousers"
                className="ui-input text-black border border-zinc-300 focus:border-black"
                disabled={loading}
              />
            </div>

            {/* Category Image upload */}
            <div className="ui-form-group">
              <label className="ui-form-label font-semibold text-xs text-zinc-700 uppercase tracking-wide">
                Category Image
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
                disabled={loading}
              />

              {previewUrl ? (
                <div className="flex items-center gap-4 p-3 border border-zinc-200 rounded-lg bg-zinc-50">
                  <div className="relative w-16 h-16 rounded border border-zinc-300 overflow-hidden bg-white shrink-0">
                    <Image
                      src={previewUrl}
                      alt="Category Preview"
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-black truncate">
                      {selectedFile?.name}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {selectedFile ? `${(selectedFile.size / 1024).toFixed(1)} KB` : ''}
                    </p>
                    <span className="inline-block text-[10px] text-zinc-500 mt-0.5">
                      Will upload to category_images_bucket
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={loading}
                      className="ui-btn ui-btn-outline ui-btn-xs text-xs px-2 py-1 text-black border-zinc-300 hover:bg-zinc-100"
                    >
                      Change
                    </button>
                    <button
                      type="button"
                      onClick={handleRemoveImage}
                      disabled={loading}
                      className="p-1 text-red-600 hover:bg-red-50 rounded cursor-pointer"
                      title="Remove image"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-zinc-300 hover:border-black rounded-lg p-4 text-center cursor-pointer transition-colors bg-zinc-50/50 hover:bg-zinc-50"
                >
                  <div className="flex flex-col items-center justify-center gap-1.5">
                    <div className="p-2 bg-white rounded-full border border-zinc-200 text-zinc-600">
                      <ImageIcon className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-medium text-black">
                      Click to choose category image
                    </span>
                    <span className="text-[11px] text-zinc-500">
                      PNG, JPG, WEBP up to 5MB (stored in category_images_bucket)
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Description */}
            <div className="ui-form-group">
              <label className="ui-form-label font-semibold text-xs text-zinc-700 uppercase tracking-wide">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="Brief category description..."
                className="ui-textarea text-black border border-zinc-300 focus:border-black"
                disabled={loading}
              />
            </div>

            {/* Status (default True) */}
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
          </div>

          {/* Footer with grey button that turns dark black on tap */}
          <div className="ui-dialog-footer flex items-center justify-end gap-3 px-6 py-4 bg-zinc-50 border-t border-zinc-200 flex-shrink-0">
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
              className="ui-btn ui-btn-grey ui-btn-md font-medium cursor-pointer"
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
        </form>
      </div>
    </div>
  );
}
