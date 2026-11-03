/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Mise — F50 Termômetro do Negócio (Score de Saúde 0 a 100)
 */

import React from 'react';
import { Gauge, ShieldCheck, AlertCircle, FileText, Lock, ChevronRight } from 'lucide-react';
import { BusinessThermometerResult } from '../domain/governance-reports';
import { HowWeCalculatedButton } from './ExplanationModal';

interface ThermometerCardProps {
  thermometer: BusinessThermometerResult;
  onOpenXRay: () => void;
  onOpenClosing: () => void;
  onOpenExplanation: () => void;
}

export const ThermometerCard: React.FC<ThermometerCardProps> = ({
  thermometer,
  onOpenXRay,
  onOpenClosing,
  onOpenExplanation,
}) => {
  const { overallScore, healthStatus, pillars, explanation } = thermometer;

  const statusColor =
    healthStatus === 'EXCELLENT'
      ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
      : healthStatus === 'HEALTHY'
      ? 'text-emerald-700 bg-emerald-50/80 border-emerald-200'
      : healthStatus === 'ATTENTION'
      ? 'text-amber-700 bg-amber-50 border-amber-200'
      : 'text-rose-700 bg-rose-50 border-rose-200';

  const statusLabel =
    healthStatus === 'EXCELLENT'
      ? 'Excelente'
      : healthStatus === 'HEALTHY'
      ? 'Saudável'
      : healthStatus === 'ATTENTION'
      ? 'Atenção Operacional'
      : 'Risco Imediato';

  return (
    <div className="bg-white rounded-xl border border-stone-200/80 p-5 shadow-2xs space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-stone-100">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-stone-900 text-white flex items-center justify-center">
            <Gauge className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-stone-900 uppercase tracking-wider">
                F50 · Termômetro do Negócio
              </span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${statusColor}`}>
                {statusLabel}
              </span>
            </div>
            <p className="text-xs text-stone-500 mt-0.5">
              Score ponderado transparente baseado em CMV, caixa, margem, giro e desperdício.
            </p>
          </div>
        </div>

        <HowWeCalculatedButton onClick={onOpenExplanation} />
      </div>

      {/* Main Score Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
        <div className="md:col-span-1 p-4 bg-stone-900 text-white rounded-xl text-center space-y-1">
          <span className="text-[11px] text-stone-400 font-semibold uppercase tracking-wider">
            Score Geral de Saúde
          </span>
          <div className="text-4xl font-extrabold font-mono tracking-tight text-emerald-400">
            {overallScore}<span className="text-lg text-stone-400 font-normal">/100</span>
          </div>
          <p className="text-[11px] text-stone-300">
            {healthStatus === 'EXCELLENT' || healthStatus === 'HEALTHY'
              ? 'Negócio operando em zona de lucro protegido.'
              : 'Há gargalos reduzindo a margem do proprietário.'}
          </p>
        </div>

        {/* Pilares */}
        <div className="md:col-span-2 space-y-2">
          {pillars.map((pillar) => (
            <div key={pillar.key} className="space-y-0.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-stone-700 font-medium">{pillar.name}</span>
                <span className="font-mono text-stone-900 font-bold">
                  {pillar.score}/100 <span className="text-[10px] font-normal text-stone-400">({pillar.currentValueFormatted})</span>
                </span>
              </div>
              <div className="w-full bg-stone-100 h-1.5 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    pillar.score >= 80 ? 'bg-emerald-600' : pillar.score >= 60 ? 'bg-amber-500' : 'bg-rose-600'
                  }`}
                  style={{ width: `${pillar.score}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Actions for Wave 2: F52 & F46 */}
      <div className="pt-2 border-t border-stone-100 flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs text-stone-500">
          Relatórios e governança do proprietário:
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenXRay}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>F52 Raio-X do Mês</span>
          </button>
          <button
            onClick={onOpenClosing}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-stone-900 hover:bg-stone-800 text-white rounded-lg text-xs font-bold cursor-pointer transition-colors shadow-2xs"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>F46 Fechamento Mensal</span>
          </button>
        </div>
      </div>
    </div>
  );
};
