'use client';

import React, { useState, useRef } from 'react';
import { X, Loader2, Upload, ImageIcon, Trash2, RefreshCw } from 'lucide-react';
import Image from 'next/image';
import {
  Category,
  updateCategory,
  uploadCategoryImage,
} from '@/lib/categoriesStore';

interface OpenCategoryProps {
  isOpen: boolean;
  category: Category;
  onClose: () => void;
  onCategoryUpdated: (category: Category) => void;
}

export default function OpenCategoryModal({
  isOpen,
  category,
  onClose,
  onCategoryUpdated,
}: OpenCategoryProps) {
  const [name, setName] = useState(category.name || '');
  const [description, setDescription] = useState(category.description || '');
  const [status, setStatus] = useState<boolean>(
    typeof category.status === 'boolean' ? category.status : true
  );

  // Image states: current stored URL vs newly picked file
  const currentImageUrl = category.image_url || category.image || null;
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isImageRemoved, setIsImageRemoved] = useState(false);

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
      setIsImageRemoved(false);
      setErrorMessage('');
    }
  };

  const handleClearNewSelection = () => {
    setSelectedFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveExistingImage = () => {
    handleClearNewSelection();
    setIsImageRemoved(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMessage('Category name cannot be empty.');
      return;
    }

    setLoading(true);
    setErrorMessage('');

    try {
      let finalImageUrl: string | null | undefined = undefined;

      // 1. If user picked a new file, upload to category_images_bucket
      if (selectedFile) {
        const { publicUrl, error: uploadError } = await uploadCategoryImage(
          category.cat_id,
          selectedFile
        );

        if (uploadError || !publicUrl) {
          setErrorMessage(
            uploadError?.message ||
              'Failed to upload new category image to bucket category_images_bucket.'
          );
          setLoading(false);
          return;
        }
        finalImageUrl = publicUrl;
      } else if (isImageRemoved) {
        finalImageUrl = null;
      }

      // 2. Call updateCategory
      const updateData: {
        name: string;
        description: string;
        status: boolean;
        image_url?: string | null;
      } = {
        name: name.trim(),
        description: description.trim(),
        status,
      };

      if (finalImageUrl !== undefined) {
        updateData.image_url = finalImageUrl;
      }

      const { data, error } = await updateCategory(category.cat_id, updateData);

      if (error && !data) {
        setErrorMessage(error.message || 'Failed to update category.');
        setLoading(false);
        return;
      }

      if (data) {
        onCategoryUpdated(data);
        onClose();
      }
    } catch {
      setErrorMessage('An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  // Determine active display image: newly picked preview, or current stored URL, or null
  const displayImageUrl = previewUrl || (!isImageRemoved ? currentImageUrl : null);

  return (
    <div className="ui-dialog-backdrop p-4" role="dialog" aria-modal="true">
      <div className="ui-dialog-panel w-full max-w-lg bg-white rounded-lg shadow-xl border border-zinc-200 overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="ui-dialog-header flex items-center justify-between border-b border-zinc-200 px-6 py-4 flex-shrink-0">
          <div>
            <h2 className="typo-section-title text-base sm:text-lg font-bold text-black">
              Category Details
            </h2>
            <p className="typo-caption text-xs text-zinc-500">
              ID: {category.cat_id}
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
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-6 space-y-4 overflow-y-auto flex-1">
            {errorMessage && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded">
                {errorMessage}
              </div>
            )}

            {/* Display cat_id (Read-only / Immutable) */}
            <div className="ui-form-group">
              <label className="ui-form-label font-semibold text-xs text-zinc-700 uppercase tracking-wide">
                Category ID (Immutable)
              </label>
              <input
                type="text"
                value={category.cat_id}
                readOnly
                disabled
                className="ui-input bg-zinc-100 text-zinc-600 font-mono text-sm cursor-not-allowed border border-zinc-300"
              />
              <span className="ui-form-helper text-xs text-zinc-500 mt-1">
                Category ID cannot be edited.
              </span>
            </div>

            {/* Category Image Display & Change Control */}
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

              {displayImageUrl ? (
                <div className="flex items-center gap-4 p-3 border border-zinc-200 rounded-lg bg-zinc-50">
                  <div className="relative w-20 h-20 rounded border border-zinc-300 overflow-hidden bg-white shrink-0">
                    <Image
                      src={displayImageUrl}
                      alt={category.name || 'Category'}
                      fill
                      className="object-cover"
                      unoptimized
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-black truncate">
                      {selectedFile ? selectedFile.name : 'Current Image'}
                    </p>
                    <p className="text-[11px] text-zinc-500 mt-0.5">
                      {selectedFile
                        ? `New image ready to upload (${(selectedFile.size / 1024).toFixed(1)} KB)`
                        : 'Stored in category_images_bucket'}
                    </p>
                    {selectedFile && (
                      <span className="inline-block px-1.5 py-0.5 mt-1 bg-amber-100 text-amber-800 text-[10px] rounded font-medium">
                        Unsaved changes
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col sm:flex-row items-center gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={loading}
                      className="ui-btn ui-btn-outline ui-btn-xs text-xs px-2.5 py-1 text-black border-zinc-300 hover:bg-zinc-100 cursor-pointer flex items-center gap-1"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Change</span>
                    </button>
                    <button
                      type="button"
                      onClick={selectedFile ? handleClearNewSelection : handleRemoveExistingImage}
                      disabled={loading}
                      className="p-1.5 text-red-600 hover:bg-red-50 rounded cursor-pointer"
                      title={selectedFile ? 'Revert change' : 'Remove image'}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-zinc-300 hover:border-black rounded-lg p-5 text-center cursor-pointer transition-colors bg-zinc-50/50 hover:bg-zinc-50"
                >
                  <div className="flex flex-col items-center justify-center gap-1.5">
                    <div className="p-2.5 bg-white rounded-full border border-zinc-200 text-zinc-500">
                      <ImageIcon className="w-6 h-6" />
                    </div>
                    <span className="text-xs font-semibold text-black">
                      No Category Image Uploaded
                    </span>
                    <span className="text-[11px] text-zinc-500">
                      Click to choose and upload category image to category_images_bucket
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Editable Name */}
            <div className="ui-form-group">
              <label className="ui-form-label font-semibold text-xs text-zinc-700 uppercase tracking-wide">
                Name <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Category Name"
                className="ui-input text-black border border-zinc-300 focus:border-black"
                disabled={loading}
              />
            </div>

            {/* Editable Description */}
            <div className="ui-form-group">
              <label className="ui-form-label font-semibold text-xs text-zinc-700 uppercase tracking-wide">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="Category Description..."
                className="ui-textarea text-black border border-zinc-300 focus:border-black"
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
