// @ts-nocheck
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Mise — Actionable Empty State Component
 */

import React from 'react';
import { LucideIcon } from 'lucide-react';
import { motion } from 'motion/react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="relative overflow-hidden flex flex-col items-center justify-center px-8 py-14 text-center rounded-2xl border border-dashed border-stone-200 bg-white max-w-xl mx-auto my-8"
    >
      <div className="absolute inset-0 bg-dot-grid mask-radial opacity-70 pointer-events-none" />
      <div className="relative w-12 h-12 rounded-2xl bg-white ring-1 ring-stone-200 shadow-sm flex items-center justify-center text-stone-900 mb-5">
        <Icon className="w-5 h-5 stroke-[1.6]" />
      </div>
      <h3 className="relative text-base font-semibold text-stone-950 mb-1.5">{title}</h3>
      <p className="relative text-sm text-stone-500 max-w-sm mb-7 leading-relaxed">{description}</p>

      <div className="relative flex flex-wrap items-center justify-center gap-2">
        {actionLabel && onAction && (
          <button
            type="button"
            onClick={onAction}
            className="inline-flex items-center justify-center h-9 px-4 text-sm font-medium text-white bg-stone-950 hover:bg-stone-800 rounded-full shadow-sm cursor-pointer"
          >
            {actionLabel}
          </button>
        )}
        {secondaryActionLabel && onSecondaryAction && (
          <button
            type="button"
            onClick={onSecondaryAction}
            className="inline-flex items-center justify-center h-9 px-4 text-sm font-medium text-stone-700 ring-1 ring-stone-200 hover:bg-stone-50 rounded-full cursor-pointer"
          >
            {secondaryActionLabel}
          </button>
        )}
      </div>
    </motion.div>
  );
};
