/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Mise — F46 Fechamento Mensal Guiado & Trava de Período
 */

import React, { useState } from 'react';
import { Modal } from './Modal';
import { MonthlyClosingResult } from '../domain/governance-reports';
import { Lock, Unlock, CheckCircle2, AlertTriangle, Download, ShieldCheck } from 'lucide-react';
import { HowWeCalculatedButton } from './ExplanationModal';

interface MonthlyClosingModalProps {
  isOpen: boolean;
  onClose: () => void;
  closingData: MonthlyClosingResult;
  onLockPeriod: (monthYear: string) => void;
  onUnlockPeriod: (monthYear: string, reason: string) => void;
  onOpenExplanation: () => void;
}

export const MonthlyClosingModal: React.FC<MonthlyClosingModalProps> = ({
  isOpen,
  onClose,
  closingData,
  onLockPeriod,
  onUnlockPeriod,
  onOpenExplanation,
}) => {
  const { monthYear, isPeriodLocked, canLockPeriod, checklist, explanation } = closingData;
  const [unlockReason, setUnlockReason] = useState('');
  const [showUnlockPrompt, setShowUnlockPrompt] = useState(false);

  const handleDownloadAccountantPackage = () => {
    // Gera pacote do contador em JSON estruturado
    const packageData = {
      period: monthYear,
      status: isPeriodLocked ? 'LOCKED' : 'OPEN',
      checklist,
      generatedAt: new Date().toISOString(),
      note: 'Pacote auditado e reconciliado pelo motor determinístico Mise.',
    };
    const blob = new Blob([JSON.stringify(packageData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mise-pacote-contador-${monthYear}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`F46 · Fechamento Mensal Guiado (${monthYear})`}
      subtitle="Checklist determinístico de pendências e trava de período para integridade contábil."
    >
      <div className="space-y-5">
        {/* Status da Trava */}
        <div className={`p-4 rounded-xl border flex items-center justify-between gap-3 ${
          isPeriodLocked
            ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
            : canLockPeriod
            ? 'bg-amber-50 border-amber-200 text-amber-900'
            : 'bg-stone-50 border-stone-200 text-stone-900'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              isPeriodLocked ? 'bg-emerald-200 text-emerald-900' : 'bg-stone-200 text-stone-700'
            }`}>
              {isPeriodLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-wider">
                {isPeriodLocked ? 'Período Travado (Protegido)' : 'Período Aberto para Edições'}
              </div>
              <p className="text-[11px] opacity-80 mt-0.5">
                {isPeriodLocked
                  ? 'Nenhum lançamento retroativo pode ser alterado sem desbloqueio auditado.'
                  : 'Conclua o checklist abaixo para congelar o fechamento do mês.'}
              </p>
            </div>
          </div>

          <HowWeCalculatedButton onClick={onOpenExplanation} />
        </div>

        {/* Checklist */}
        <div className="space-y-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500">
            Checklist de Conformidade Contábil
          </span>
          <div className="space-y-2">
            {checklist.map((item) => (
              <div
                key={item.id}
                className={`p-3 rounded-xl border flex items-start gap-3 transition-colors ${
                  item.isReady
                    ? 'bg-white border-stone-200/80 text-stone-800'
                    : item.severity === 'BLOCKER'
                    ? 'bg-rose-50/70 border-rose-200 text-rose-900'
                    : 'bg-amber-50/70 border-amber-200 text-amber-900'
                }`}
              >
                <div className="mt-0.5">
                  {item.isReady ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <AlertTriangle className={`w-4 h-4 ${item.severity === 'BLOCKER' ? 'text-rose-600' : 'text-amber-600'}`} />
                  )}
                </div>
                <div className="flex-1 text-xs">
                  <div className="font-bold flex items-center gap-1.5">
                    <span>{item.title}</span>
                    {item.severity === 'BLOCKER' && !item.isReady && (
                      <span className="text-[10px] bg-rose-200 text-rose-900 font-bold px-1.5 py-0.2 rounded">
                        Bloqueante
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-stone-500 mt-0.5">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Form Desbloqueio se necessário */}
        {isPeriodLocked && showUnlockPrompt && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-2">
            <label className="block text-xs font-bold text-amber-900">
              Justificativa Obrigatória para Desbloqueio:
            </label>
            <input
              type="text"
              required
              value={unlockReason}
              onChange={(e) => setUnlockReason(e.target.value)}
              placeholder="Ex: Correção de nota fiscal atrasada enviada pelo fornecedor"
              className="w-full text-xs px-3 py-2 bg-white rounded-lg border border-amber-300 focus:outline-none"
            />
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowUnlockPrompt(false)}
                className="px-3 py-1.5 text-xs text-stone-600 hover:bg-stone-100 rounded-lg cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!unlockReason.trim()}
                onClick={() => {
                  onUnlockPeriod(monthYear, unlockReason);
                  setShowUnlockPrompt(false);
                }}
                className="px-3 py-1.5 text-xs font-bold bg-amber-700 hover:bg-amber-800 text-white rounded-lg cursor-pointer disabled:opacity-50"
              >
                Confirmar Desbloqueio c/ Auditoria
              </button>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-stone-100">
          <button
            type="button"
            onClick={handleDownloadAccountantPackage}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-lg cursor-pointer transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Baixar Pacote do Contador (JSON)</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 text-xs font-medium text-stone-600 hover:bg-stone-100 rounded-lg cursor-pointer"
            >
              Fechar
            </button>

            {isPeriodLocked ? (
              !showUnlockPrompt && (
                <button
                  type="button"
                  onClick={() => setShowUnlockPrompt(true)}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-amber-900 bg-amber-100 hover:bg-amber-200 rounded-lg cursor-pointer transition-colors"
                >
                  <Unlock className="w-3.5 h-3.5" />
                  <span>Destravar Período</span>
                </button>
              )
            ) : (
              <button
                type="button"
                disabled={!canLockPeriod}
                onClick={() => onLockPeriod(monthYear)}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-stone-900 hover:bg-stone-800 disabled:bg-stone-300 rounded-lg cursor-pointer transition-colors shadow-xs"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Travar Período</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};
