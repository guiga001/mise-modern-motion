/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Mise — F48, F49: Central de Valor e Fila "Faça Hoje"
 */

import { ValueEvent, DailyTask, DomainExplanation } from './insights-types';
import { formatCentsToCurrency } from './units';

export interface ValueSummary {
  totalIdentifiedInCents: number;
  totalRealizedInCents: number;
  totalMinutesSaved: number;
  totalHoursSaved: number;
  events: ValueEvent[];
  explanation: DomainExplanation<number>;
}

/**
 * F48: Central de Valor "A Mise te trouxe R$ X"
 * Consolida ganhos com separação rígida entre IDENTIFICADO e REALIZADO.
 */
export function summarizeValueBrought(events: ValueEvent[]): ValueSummary {
  let identified = 0;
  let realized = 0;
  let minutes = 0;

  for (const ev of events) {
    if (ev.type === 'IDENTIFICADO') {
      identified += ev.amountInCents;
    } else if (ev.type === 'REALIZADO') {
      realized += ev.amountInCents;
    }
    minutes += ev.minutesSaved || 0;
  }

  const hours = Number((minutes / 60).toFixed(1));

  const explanation: DomainExplanation<number> = {
    valor: realized,
    unidade: 'centavos',
    formula: 'ValorRealizado = Σ EvidênciasConfirmadas; Horas = Σ (MinutosReferência × Eventos) / 60',
    entradas: {
      totalEventos: events.length,
      identificadoCentavos: identified,
      realizadoCentavos: realized,
      minutosEconomizados: minutes,
    },
    passos: [
      `1. Oportunidades identificadas nos dados: ${formatCentsToCurrency(identified)}.`,
      `2. Retorno real comprovado por ações executadas: ${formatCentsToCurrency(realized)}.`,
      `3. Tempo operacional economizado por processos automatizados: ${hours} horas (${minutes} minutos).`,
    ],
    suficienciaDeDados: {
      suficiente: true,
      percentualConfiabilidade: 100,
    },
    confianca: 'ALTA',
  };

  return {
    totalIdentifiedInCents: identified,
    totalRealizedInCents: realized,
    totalMinutesSaved: minutes,
    totalHoursSaved: hours,
    events,
    explanation,
  };
}

/**
 * F49: Fila "Faça Hoje"
 * Ordena tarefas e ações do gestor estritamente pelo valor financeiro em jogo (R$).
 */
export function prioritizeDailyTasks(tasks: DailyTask[]): DailyTask[] {
  return [...tasks].sort((a, b) => {
    // 1. Não completadas antes de completadas
    if (a.completed !== b.completed) {
      return a.completed ? 1 : -1;
    }
    // 2. Maior valor monetário em jogo primeiro
    if (b.amountInPlayInCents !== a.amountInPlayInCents) {
      return b.amountInPlayInCents - a.amountInPlayInCents;
    }
    // 3. Menor prazo de urgência (dias)
    return (a.urgencyDays ?? 999) - (b.urgencyDays ?? 999);
  });
}
