/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Mise — F48 Central de Valor e F49 Fila "Faça Hoje"
 */

import React, { useState } from 'react';
import {
  TrendingUp,
  CheckCircle2,
  Clock,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import { DailyTask, ValueEvent, DomainExplanation } from '../domain/insights-types';
import { formatCentsToCurrency } from '../domain/units';
import { ExplanationModal, HowWeCalculatedButton } from './ExplanationModal';

interface ValueCenterCardProps {
  tasks: DailyTask[];
  events: ValueEvent[];
  onCompleteTask: (task: DailyTask) => void;
  onNavigateTab: (tab: any, payload?: any) => void;
}

export const ValueCenterCard: React.FC<ValueCenterCardProps> = ({
  tasks,
  events,
  onCompleteTask,
  onNavigateTab,
}) => {
  const [selectedExplanation, setSelectedExplanation] = useState<{
    title: string;
    explanation: DomainExplanation<any>;
  } | null>(null);

  // Somar identificado, realizado e minutos
  let identified = 0;
  let realized = 0;
  let minutes = 0;

  for (const ev of events) {
    if (ev.type === 'IDENTIFICADO') identified += ev.amountInCents;
    if (ev.type === 'REALIZADO') realized += ev.amountInCents;
    minutes += ev.minutesSaved || 0;
  }
  const hours = Number((minutes / 60).toFixed(1));

  const explanationValor: DomainExplanation<number> = {
    valor: realized,
    unidade: 'centavos',
    formula: 'ValorRealizado = Σ EvidênciasConfirmadas; Horas = Σ Minutos / 60',
    entradas: { eventosRegistrados: events.length, identificadoCentavos: identified, realizadoCentavos: realized },
    passos: [
      `1. Oportunidades teóricas identificadas nos dados: ${formatCentsToCurrency(identified)}.`,
      `2. Ganhos financeiros concretizados com evidência nos dados: ${formatCentsToCurrency(realized)}.`,
      `3. Horas economizadas por tarefas automatizadas: ${hours}h (${minutes} min).`,
    ],
    suficienciaDeDados: { suficiente: true, percentualConfiabilidade: 100 },
    confianca: 'ALTA',
  };

  const pendingTasks = tasks.filter((t) => !t.completed);

  return (
    <div className="space-y-6">
      {/* Central de Valor F48 */}
      <div className="bg-stone-900 text-white rounded-2xl p-6 shadow-sm border border-stone-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-stone-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-stone-400">
                F48 · Central de Valor da Mise
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-medium">
                <ShieldCheck className="w-3 h-3" /> Auditável
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold mt-1 text-white">
              O que o Mise gerou para o seu negócio
            </h2>
          </div>
          <HowWeCalculatedButton
            onClick={() => setSelectedExplanation({ title: 'Central de Valor', explanation: explanationValor })}
            className="text-stone-300 hover:text-white"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-5">
          {/* Identificado */}
          <div className="bg-stone-800/60 p-4 rounded-xl border border-stone-700/60">
            <span className="text-xs font-medium text-stone-400 block mb-1">
              Oportunidades Identificadas (Mês)
            </span>
            <div className="text-2xl font-bold tabular-nums text-amber-400">
              {formatCentsToCurrency(identified)}
            </div>
            <p className="text-[11px] text-stone-400 mt-1">
              Potencial em reajustes de preço, compras e redução de perdas.
            </p>
          </div>

          {/* Realizado */}
          <div className="bg-stone-800/60 p-4 rounded-xl border border-stone-700/60">
            <span className="text-xs font-medium text-stone-400 block mb-1">
              Ganhos Reais Concretizados
            </span>
            <div className="text-2xl font-bold tabular-nums text-emerald-400">
              {formatCentsToCurrency(realized)}
            </div>
            <p className="text-[11px] text-stone-400 mt-1">
              Confirmado por compras abaixo da mediana e perdas evitadas.
            </p>
          </div>

          {/* Horas Economizadas */}
          <div className="bg-stone-800/60 p-4 rounded-xl border border-stone-700/60">
            <span className="text-xs font-medium text-stone-400 block mb-1">
              Tempo do Dono Poupado
            </span>
            <div className="text-2xl font-bold tabular-nums text-sky-400 flex items-baseline gap-1.5">
              <span>{hours}h</span>
              <span className="text-sm font-normal text-stone-400">({minutes} min)</span>
            </div>
            <p className="text-[11px] text-stone-400 mt-1">
              Importação rápida, baixa automática de fichas e conferência de XML.
            </p>
          </div>
        </div>
      </div>

      {/* Fila Faça Hoje F49 */}
      <div className="bg-white rounded-2xl p-6 shadow-xs border border-stone-200">
        <div className="flex items-center justify-between pb-4 border-b border-stone-100">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">
                F49 · Fila de Ação do Dono
              </span>
              <span className="text-xs bg-stone-100 text-stone-700 font-bold px-2 py-0.5 rounded-full">
                {pendingTasks.length} pendentes
              </span>
            </div>
            <h3 className="text-lg font-bold text-stone-900 mt-0.5">
              Faça Hoje (Ordenado por R$ em jogo)
            </h3>
          </div>
          <p className="text-xs text-stone-500 hidden sm:block">
            Priorize o que mais impacta o caixa da sua loja
          </p>
        </div>

        {pendingTasks.length === 0 ? (
          <div className="py-10 text-center">
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2 opacity-80" />
            <p className="text-sm font-semibold text-stone-800">Tudo em dia por aqui!</p>
            <p className="text-xs text-stone-500 mt-0.5">
              Nenhuma oportunidade crítica ou risco de ruptura pendente no momento.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-stone-100 mt-2">
            {pendingTasks.map((task) => (
              <div
                key={task.id}
                className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-stone-50/60 transition-colors rounded-xl px-2 -mx-2"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200/60 tabular-nums">
                      {formatCentsToCurrency(task.amountInPlayInCents)} em jogo
                    </span>
                    {task.urgencyDays !== undefined && (
                      <span className="text-[11px] text-amber-700 font-medium">
                        · vence em {task.urgencyDays} {task.urgencyDays === 1 ? 'dia' : 'dias'}
                      </span>
                    )}
                  </div>
                  <h4 className="text-sm font-semibold text-stone-900">{task.title}</h4>
                  <p className="text-xs text-stone-600 leading-relaxed">{task.description}</p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <HowWeCalculatedButton
                    onClick={() => setSelectedExplanation({ title: task.title, explanation: task.explanation })}
                  />
                  <button
                    onClick={() => onNavigateTab(task.actionTab, task.actionPayload)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-stone-900 hover:bg-stone-800 text-white text-xs font-medium rounded-lg transition-colors cursor-pointer"
                  >
                    <span>{task.actionLabel}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => onCompleteTask(task)}
                    title="Marcar como concluído"
                    className="p-1.5 text-stone-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal de Explicação se selecionado */}
      {selectedExplanation && (
        <ExplanationModal
          isOpen={true}
          onClose={() => setSelectedExplanation(null)}
          title={selectedExplanation.title}
          explanation={selectedExplanation.explanation}
        />
      )}
    </div>
  );
};
