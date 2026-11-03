/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Mise — F52 Relatório Mensal "Raio-X do Mês" (Sem IA / Regras Condicionais)
 */

import React from 'react';
import { Modal } from './Modal';
import { MonthlyXRayReport } from '../domain/governance-reports';
import { formatCentsToCurrency } from '../domain/units';
import { Printer, TrendingUp, TrendingDown, Target, ShieldCheck, CheckCircle2 } from 'lucide-react';

interface MonthlyXRayModalProps {
  isOpen: boolean;
  onClose: () => void;
  report: MonthlyXRayReport;
}

export const MonthlyXRayModal: React.FC<MonthlyXRayModalProps> = ({
  isOpen,
  onClose,
  report,
}) => {
  const {
    periodLabel,
    executiveSummary,
    topGains,
    topLosses,
    actionPlan,
    cmvDecompositionSummary,
    miseValueDelivered,
  } = report;

  const handlePrint = () => {
    window.print();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`F52 · Relatório Raio-X do Mês (${periodLabel})`}
      subtitle="Documento executivo consolidado com conciliação matemática estrita para o Dono e Contabilidade."
    >
      <div className="space-y-6 max-h-[75vh] overflow-y-auto pr-1 printable-report">
        {/* Resumo Executivo */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 bg-stone-50 rounded-xl border border-stone-200">
            <span className="text-[11px] text-stone-500 font-medium block">Faturamento Bruto</span>
            <div className="text-base font-bold font-mono text-stone-900 mt-0.5">
              {formatCentsToCurrency(executiveSummary.grossRevenueInCents)}
            </div>
          </div>
          <div className="p-3 bg-stone-50 rounded-xl border border-stone-200">
            <span className="text-[11px] text-stone-500 font-medium block">CMV Real</span>
            <div className="text-base font-bold font-mono text-stone-900 mt-0.5">
              {executiveSummary.cmvPercentage.toFixed(1)}%
            </div>
          </div>
          <div className="p-3 bg-stone-50 rounded-xl border border-stone-200">
            <span className="text-[11px] text-stone-500 font-medium block">Lucro Limpo no Bolso</span>
            <div className={`text-base font-bold font-mono mt-0.5 ${executiveSummary.netOperatingResultInCents >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
              {formatCentsToCurrency(executiveSummary.netOperatingResultInCents)}
            </div>
          </div>
          <div className="p-3 bg-stone-900 text-white rounded-xl">
            <span className="text-[11px] text-stone-400 font-medium block">Termômetro</span>
            <div className="text-base font-bold font-mono text-emerald-400 mt-0.5">
              {executiveSummary.thermometerScore}/100
            </div>
          </div>
        </div>

        {/* Top 3 Ganhos & Top 3 Perdas */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Ganhos */}
          <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-3">
            <div className="flex items-center gap-2 text-emerald-900 font-bold text-xs uppercase tracking-wider">
              <TrendingUp className="w-4 h-4 text-emerald-700" />
              <span>Top 3 Alavancas de Ganho</span>
            </div>
            <div className="space-y-2 text-xs">
              {topGains.map((gain, i) => (
                <div key={i} className="p-2.5 bg-white rounded-lg border border-emerald-100">
                  <div className="font-bold text-stone-900">{gain.title}</div>
                  <p className="text-[11px] text-stone-600 mt-0.5">{gain.description}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Perdas */}
          <div className="p-4 bg-rose-50/70 border border-rose-200 rounded-xl space-y-3">
            <div className="flex items-center gap-2 text-rose-900 font-bold text-xs uppercase tracking-wider">
              <TrendingDown className="w-4 h-4 text-rose-700" />
              <span>Top 3 Pontos de Atenção / Perdas</span>
            </div>
            <div className="space-y-2 text-xs">
              {topLosses.map((loss, i) => (
                <div key={i} className="p-2.5 bg-white rounded-lg border border-rose-100">
                  <div className="font-bold text-stone-900">{loss.title}</div>
                  <p className="text-[11px] text-stone-600 mt-0.5">{loss.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Decomposição do CMV F33 */}
        <div className="p-4 bg-stone-50 rounded-xl border border-stone-200 space-y-2 text-xs">
          <div className="font-bold text-stone-900 uppercase tracking-wider text-[11px]">
            Decomposição Analítica do CMV (F33)
          </div>
          <div className="grid grid-cols-3 gap-2 pt-1 font-mono">
            <div className="p-2 bg-white rounded-lg border border-stone-200">
              <span className="text-[10px] text-stone-500 block">Efeito Preço</span>
              <span className="font-bold text-stone-900">{formatCentsToCurrency(cmvDecompositionSummary.priceEffectInCents)}</span>
            </div>
            <div className="p-2 bg-white rounded-lg border border-stone-200">
              <span className="text-[10px] text-stone-500 block">Efeito Volume</span>
              <span className="font-bold text-stone-900">{formatCentsToCurrency(cmvDecompositionSummary.volumeEffectInCents)}</span>
            </div>
            <div className="p-2 bg-white rounded-lg border border-stone-200">
              <span className="text-[10px] text-stone-500 block">Efeito Uso/Mix</span>
              <span className="font-bold text-stone-900">{formatCentsToCurrency(cmvDecompositionSummary.usageMixEffectInCents)}</span>
            </div>
          </div>
        </div>

        {/* Plano de Ação (F49) */}
        <div className="p-4 bg-white rounded-xl border border-stone-200 space-y-3">
          <div className="flex items-center gap-2 text-stone-900 font-bold text-xs uppercase tracking-wider">
            <Target className="w-4 h-4 text-stone-700" />
            <span>Plano de Ação Imediato para o Dono (Fila Faça Hoje)</span>
          </div>
          <div className="space-y-2 text-xs">
            {actionPlan.length === 0 ? (
              <p className="text-stone-400">Nenhuma tarefa pendente na fila.</p>
            ) : (
              actionPlan.map((action) => (
                <div key={action.order} className="flex items-start gap-2.5 p-2.5 bg-stone-50 rounded-lg">
                  <span className="w-5 h-5 rounded-full bg-stone-900 text-white font-mono text-[10px] flex items-center justify-center shrink-0">
                    {action.order}
                  </span>
                  <div className="flex-1">
                    <p className="text-stone-800 font-medium">{action.actionText}</p>
                    <span className="text-[10px] font-mono font-bold text-emerald-700">
                      R$ em jogo: {formatCentsToCurrency(action.expectedSavingsInCents)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Resumo de Valor da Mise (F48) */}
        <div className="p-4 bg-stone-900 text-white rounded-xl flex items-center justify-between text-xs">
          <div>
            <div className="font-bold text-emerald-400">Retorno Comprovado pela Mise</div>
            <p className="text-stone-300 text-[11px] mt-0.5">
              Identificado: {formatCentsToCurrency(miseValueDelivered.identifiedInCents)} | Realizado: {formatCentsToCurrency(miseValueDelivered.realizedInCents)}
            </p>
          </div>
          <div className="text-right font-mono font-bold text-stone-200">
            {miseValueDelivered.hoursSaved}h economizadas
          </div>
        </div>

        {/* Botão de Exportação / Impressão */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-100">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-2 text-xs font-medium text-stone-700 hover:bg-stone-100 rounded-lg cursor-pointer"
          >
            Fechar
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-stone-900 hover:bg-stone-800 rounded-lg cursor-pointer shadow-xs"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Imprimir / Gerar PDF</span>
          </button>
        </div>
      </div>
    </Modal>
  );
};
