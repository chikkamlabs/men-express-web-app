'use client';

import React, { useState } from 'react';
import { X, Receipt, ExternalLink, Download, Loader2, ImageOff } from 'lucide-react';
import { DistributorTransaction } from '@/lib/distributorsStore';

interface TransactionProofProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: DistributorTransaction | null;
}

export default function TransactionProofModal({
  isOpen,
  onClose,
  transaction,
}: TransactionProofProps) {
  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError] = useState(false);

  if (!isOpen || !transaction || !transaction.proof_url) return null;

  const proofUrl = transaction.proof_url;
  const transId = transaction.trans_id || 'Transaction';

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-y-auto animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-white rounded-xl shadow-2xl border border-zinc-200 overflow-hidden flex flex-col max-h-[90vh] my-auto animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-zinc-200 px-5 sm:px-6 py-4 bg-zinc-50 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-black text-white rounded-lg flex-shrink-0">
              <Receipt className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-black tracking-tight flex items-center gap-2">
                <span>Payment Proof</span>
                <span className="font-mono text-xs px-2 py-0.5 bg-zinc-200 text-zinc-800 rounded font-semibold">
                  {transId}
                </span>
              </h2>
              <p className="text-xs text-zinc-500 mt-0.5">
                Amount: ₹{Number(transaction.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })} &bull; Type: {transaction.type || 'payment'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={proofUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="ui-btn ui-btn-outline ui-btn-sm p-2 text-zinc-600 hover:text-black border-zinc-300 hover:bg-zinc-100 rounded-md cursor-pointer"
              title="Open full size in new tab"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
            <button
              type="button"
              onClick={onClose}
              className="ui-btn ui-btn-ghost ui-btn-sm p-1.5 text-zinc-500 hover:text-black hover:bg-zinc-200 rounded-md cursor-pointer"
              aria-label="Close dialog"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Responsive Image Display Container */}
        <div className="p-4 sm:p-6 bg-zinc-100/60 overflow-y-auto flex-1 flex items-center justify-center min-h-[260px] relative">
          {imageLoading && !imageError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-100/80 z-10 gap-2">
              <Loader2 className="w-8 h-8 animate-spin text-zinc-600" />
              <span className="text-xs text-zinc-500 font-medium">Loading proof image...</span>
            </div>
          )}

          {imageError ? (
            <div className="p-8 text-center flex flex-col items-center justify-center gap-2">
              <ImageOff className="w-10 h-10 text-zinc-400" />
              <p className="text-sm font-semibold text-zinc-700">Unable to load proof image</p>
              <p className="text-xs text-zinc-500 max-w-sm">
                The image could not be loaded or the storage URL might have expired.
              </p>
              <a
                href={proofUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 text-xs font-semibold text-black underline"
              >
                Try opening direct link
              </a>
            </div>
          ) : (
            <div className="w-full flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={proofUrl}
                alt={`Proof for ${transId}`}
                onLoad={() => setImageLoading(false)}
                onError={() => {
                  setImageLoading(false);
                  setImageError(true);
                }}
                className="max-h-[65vh] w-auto max-w-full object-contain rounded-lg shadow-sm border border-zinc-200 bg-white"
              />
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-3 border-t border-zinc-200 bg-zinc-50 flex-shrink-0 text-xs">
          <div className="text-zinc-500 truncate mr-3">
            {transaction.notes ? (
              <span className="truncate block font-normal">
                Notes: <strong className="text-black font-medium">{transaction.notes}</strong>
              </span>
            ) : (
              <span>Verified receipt stored in payment_trans_proofs</span>
            )}
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <a
              href={proofUrl}
              download={`proof_${transId}.jpg`}
              target="_blank"
              rel="noopener noreferrer"
              className="ui-btn ui-btn-outline ui-btn-sm text-xs px-3 py-1.5 text-zinc-700 hover:text-black border-zinc-300 hover:bg-zinc-100 rounded-md cursor-pointer inline-flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download</span>
            </a>
            <button
              type="button"
              onClick={onClose}
              className="ui-btn ui-btn-primary ui-btn-sm text-xs px-4 py-1.5 cursor-pointer font-semibold bg-black text-white hover:bg-zinc-800 rounded-md"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
