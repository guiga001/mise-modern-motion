/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Mise — F51 Componente de Qualidade dos Dados
 */

import React, { useState } from 'react';
import { ShieldCheck, AlertTriangle, ArrowRight, CheckCircle2 } from 'lucide-react';
import { DataQualityReport } from '../domain/insights-types';
import { ExplanationModal, HowWeCalculatedButton } from './ExplanationModal';

interface DataQualityCardProps {
  report: DataQualityReport;
  onNavigateTab: (tab: any) => void;
}

export const DataQualityCard: React.FC<DataQualityCardProps> = ({ report, onNavigateTab }) => {
  const [showExplanation, setShowExplanation] = useState(false);

  const tier = {
    ALTA: { color: 'text-emerald-700 bg-emerald-50 border-emerald-200', label: 'Confiabilidade Alta' },
    MEDIA: { color: 'text-amber-700 bg-amber-50 border-amber-200', label: 'Confiabilidade Média' },
    BAIXA: { color: 'text-rose-700 bg-rose-50 border-rose-200', label: 'Confiabilidade Baixa' },
  }[report.confidenceLevel];

  return (
    <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-xs">
      <div className="flex items-center justify-between pb-3 border-b border-stone-100">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-stone-600" />
          <span className="text-xs font-bold uppercase tracking-wider text-stone-600">
            F51 · Qualidade dos Dados
          </span>
          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${tier.color}`}>
            {tier.label}
          </span>
        </div>
        <HowWeCalculatedButton onClick={() => setShowExplanation(true)} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
        {/* Cobertura de Fichas */}
        <div className="p-3 bg-stone-50 rounded-xl border border-stone-200/60">
          <span className="text-[11px] text-stone-500 font-medium block">Fichas Técnicas</span>
          <div className="text-lg font-bold font-mono text-stone-900 mt-0.5 tabular-nums">
            {report.recipesCoveragePercentage}%
          </div>
          <span className="text-[10px] text-stone-500">das vendas com custo</span>
        </div>

        {/* Preços Atualizados */}
        <div className="p-3 bg-stone-50 rounded-xl border border-stone-200/60">
          <span className="text-[11px] text-stone-500 font-medium block">Custos Atualizados</span>
          <div className="text-lg font-bold font-mono text-stone-900 mt-0.5 tabular-nums">
            {report.ingredientPricesFreshnessPercentage}%
          </div>
          <span className="text-[10px] text-stone-500">nos últimos 30 dias</span>
        </div>

        {/* Regularidade Vendas */}
        <div className="p-3 bg-stone-50 rounded-xl border border-stone-200/60">
          <span className="text-[11px] text-stone-500 font-medium block">Histórico de Vendas</span>
          <div className="text-lg font-bold font-mono text-stone-900 mt-0.5 tabular-nums">
            {report.salesRegularityPercentage}%
          </div>
          <span className="text-[10px] text-stone-500">dias importados</span>
        </div>

        {/* Contagens Estoque */}
        <div className="p-3 bg-stone-50 rounded-xl border border-stone-200/60">
          <span className="text-[11px] text-stone-500 font-medium block">Contagens Físicas</span>
          <div className="text-lg font-bold font-mono text-stone-900 mt-0.5 tabular-nums">
            {report.stockCountsFreshnessPercentage}%
          </div>
          <span className="text-[10px] text-stone-500">insumos auditados</span>
        </div>
      </div>

      {report.recommendations.length > 0 && (
        <div className="mt-4 pt-3 border-t border-stone-100 space-y-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500 block">
            O que fazer para aumentar a confiabilidade:
          </span>
          <div className="space-y-1.5">
            {report.recommendations.map((rec, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-stone-700">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                <span>{rec}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {showExplanation && (
        <ExplanationModal
          isOpen={true}
          onClose={() => setShowExplanation(false)}
          title="Qualidade dos Dados (F51)"
          explanation={report.explanation}
        />
      )}
    </div>
  );
};
