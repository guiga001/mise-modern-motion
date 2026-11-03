/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Mise — Modal "Como Calculamos" (Explicação Estruturada e Auditável)
 */

import React from 'react';
import { HelpCircle, CheckCircle, AlertTriangle, XCircle, Calculator, ChevronRight } from 'lucide-react';
import { DomainExplanation } from '../domain/insights-types';
import { Modal } from './Modal';

interface ExplanationModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  explanation: DomainExplanation<any>;
}

export const ExplanationModal: React.FC<ExplanationModalProps> = ({
  isOpen,
  onClose,
  title,
  explanation,
}) => {
  const { formula, entradas, passos, suficienciaDeDados, confianca } = explanation;

  const confidenceBadge = {
    ALTA: { bg: 'bg-emerald-50 text-emerald-800 border-emerald-200', icon: CheckCircle, label: 'Confiabilidade Alta' },
    MEDIA: { bg: 'bg-amber-50 text-amber-800 border-amber-200', icon: AlertTriangle, label: 'Confiabilidade Média' },
    BAIXA: { bg: 'bg-orange-50 text-orange-800 border-orange-200', icon: AlertTriangle, label: 'Confiabilidade Baixa' },
    INSUFICIENTE: { bg: 'bg-rose-50 text-rose-800 border-rose-200', icon: XCircle, label: 'Dados Insuficientes' },
  }[confianca];

  const Icon = confidenceBadge.icon;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Como calculamos: ${title}`} maxWidth="xl">
      <div className="space-y-5">
        {/* Banner de Confiabilidade e Suficiência */}
        <div className={`p-3.5 rounded-xl border flex items-start gap-3 ${confidenceBadge.bg}`}>
          <Icon className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider">{confidenceBadge.label}</span>
              <span className="text-xs font-mono font-medium">{suficienciaDeDados.percentualConfiabilidade}% dos dados disponíveis</span>
            </div>
            {!suficienciaDeDados.suficiente && (
              <p className="text-xs mt-1.5 font-medium leading-relaxed">
                {suficienciaDeDados.faltam}
              </p>
            )}
          </div>
        </div>

        {/* Fórmula Matemática Exata */}
        {formula && (
          <div>
            <span className="text-xs font-bold text-stone-500 uppercase tracking-wider block mb-1.5">
              Fórmula Matemática Aplicada
            </span>
            <div className="p-3 bg-stone-100/80 rounded-lg border border-stone-200/80 font-mono text-xs text-stone-800 overflow-x-auto">
              <code>{formula}</code>
            </div>
          </div>
        )}

        {/* Passo a Passo do Raciocínio Numérico */}
        <div>
          <span className="text-xs font-bold text-stone-500 uppercase tracking-wider block mb-2">
            Passo a Passo Numérico
          </span>
          <div className="space-y-2">
            {passos.map((passo, idx) => (
              <div key={idx} className="flex items-start gap-2.5 text-xs text-stone-700 leading-relaxed bg-stone-50 p-2.5 rounded-lg border border-stone-200/60">
                <ChevronRight className="w-4 h-4 text-stone-400 shrink-0 mt-0.5" />
                <span>{passo}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Dados de Entrada Auditados */}
        {entradas && Object.keys(entradas).length > 0 && (
          <div>
            <span className="text-xs font-bold text-stone-500 uppercase tracking-wider block mb-2">
              Dados de Entrada Utilizados
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {Object.entries(entradas).map(([key, val]) => (
                <div key={key} className="p-2.5 bg-white rounded-lg border border-stone-200 flex flex-col justify-between">
                  <span className="text-stone-500 font-medium capitalize">
                    {key.replace(/([A-Z])/g, ' $1').toLowerCase()}
                  </span>
                  <span className="font-mono font-semibold text-stone-900 mt-0.5">
                    {typeof val === 'number' ? val.toLocaleString('pt-BR') : String(val)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="pt-3 border-t border-stone-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white text-xs font-medium rounded-lg cursor-pointer transition-colors"
          >
            Entendido
          </button>
        </div>
      </div>
    </Modal>
  );
};

export const HowWeCalculatedButton: React.FC<{
  onClick: () => void;
  className?: string;
  label?: string;
}> = ({ onClick, className = '', label = 'Como calculamos' }) => (
  <button
    type="button"
    onClick={onClick}
    className={`inline-flex items-center gap-1.5 text-xs font-medium text-stone-600 hover:text-stone-900 hover:underline cursor-pointer transition-colors ${className}`}
  >
    <HelpCircle className="w-3.5 h-3.5 text-stone-400" />
    <span>{label}</span>
  </button>
);
