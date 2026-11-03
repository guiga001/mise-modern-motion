/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Mise — Modal and Confirmation Dialog Components
 */

import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { motion } from 'motion/react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  maxWidth = 'lg',
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const maxWidthClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '3xl': 'max-w-3xl',
  }[maxWidth];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6 bg-stone-950/40 backdrop-blur-md"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 380, damping: 32 }}
        onClick={(e) => e.stopPropagation()}
        className={`relative w-full ${maxWidthClasses} bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl ring-1 ring-stone-950/5 max-h-[90vh] flex flex-col overflow-hidden`}
      >
        <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-4">
          <div>
            <h3 className="text-[15px] font-semibold text-stone-950 tracking-tight">{title}</h3>
            {subtitle && <p className="text-xs text-stone-500 mt-1">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 -mr-2 rounded-full flex items-center justify-center text-stone-400 hover:text-stone-900 hover:bg-stone-100 cursor-pointer"
            aria-label="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="h-px bg-stone-100" />
        <div className="p-6 overflow-y-auto">{children}</div>
      </motion.div>
    </motion.div>
  );
};

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  isDestructive?: boolean;
  requireReason?: boolean;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirmar Ação',
  isDestructive = false,
  requireReason = false,
}) => {
  const [reason, setReason] = React.useState('');
  const [error, setError] = React.useState('');

  const handleConfirm = () => {
    if (requireReason && !reason.trim()) {
      setError('Por favor, informe a justificativa para auditoria.');
      return;
    }
    onConfirm(reason);
    setReason('');
    setError('');
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} maxWidth="md">
      <div className="space-y-5">
        <p className="text-sm text-stone-600 leading-relaxed">{description}</p>

        {requireReason && (
          <div>
            <label className="block text-xs font-medium text-stone-700 mb-1.5">
              Justificativa (Registrada no AuditLog) *
            </label>
            <textarea
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                if (error) setError('');
              }}
              rows={2}
              placeholder="Ex: Quebra acidental no pré-preparo / Correção de contagem física..."
              className="w-full text-sm rounded-xl border border-stone-200 bg-stone-50/60 p-3 focus:bg-white focus:border-stone-400"
            />
            {error && <p className="text-xs text-rose-600 mt-1.5">{error}</p>}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-4 text-sm font-medium text-stone-700 hover:bg-stone-100 rounded-full cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className={`h-9 px-4 text-sm font-medium text-white rounded-full cursor-pointer shadow-sm ${
              isDestructive ? 'bg-rose-600 hover:bg-rose-700' : 'bg-stone-950 hover:bg-stone-800'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
};
