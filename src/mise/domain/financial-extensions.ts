/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Mise — F36, F37, F47: Financiamento (Price/SAC/TIR), Reagendador de Pagamentos e Contas Recorrentes
 */

import { PayableEntry } from './types';
import {
  DomainExplanation,
  LoanFinancingSimulationResult,
  LoanInstallment,
  FlexiblePayablesRescheduleResult,
  RescheduledPayableItem,
  RecurringScheduleResult,
  RecurringScheduleEntry,
} from './insights-types';
import { formatCentsToCurrency } from './units';

/**
 * F36: Simulador de Financiamento e Parcelamento
 * Modela tabelas Price e SAC com cálculo exato do CET (TIR) via método da bisseção determinístico.
 */
export function simulateLoanFinancing(
  financedAmountInCents: number,
  nominalMonthlyRatePercentage: number,
  totalMonths: number,
  system: 'PRICE' | 'SAC' = 'PRICE',
  upfrontFeesInCents = 0
): LoanFinancingSimulationResult {
  if (financedAmountInCents <= 0 || totalMonths <= 0) {
    throw new Error('Valor financiado e prazo em meses devem ser estritamente maiores que zero.');
  }

  const i = nominalMonthlyRatePercentage / 100;
  const installments: LoanInstallment[] = [];
  let remainingBalance = financedAmountInCents;
  let totalPaid = 0;
  let totalInterest = 0;

  if (system === 'PRICE') {
    const factor = i > 0
      ? (i / (1 - Math.pow(1 + i, -totalMonths)))
      : 1 / totalMonths;
    const fixedPmt = Math.round(financedAmountInCents * factor);

    for (let m = 1; m <= totalMonths; m++) {
      const interest = Math.round(remainingBalance * i);
      let amort = fixedPmt - interest;
      if (m === totalMonths || amort > remainingBalance) {
        amort = remainingBalance;
      }
      const actualPmt = amort + interest;
      remainingBalance = Math.max(0, remainingBalance - amort);

      totalPaid += actualPmt;
      totalInterest += interest;

      installments.push({
        month: m,
        paymentInCents: actualPmt,
        interestInCents: interest,
        amortizationInCents: amort,
        balanceInCents: remainingBalance,
      });
    }
  } else {
    // SAC
    const fixedAmort = Math.round(financedAmountInCents / totalMonths);

    for (let m = 1; m <= totalMonths; m++) {
      const interest = Math.round(remainingBalance * i);
      const amort = m === totalMonths ? remainingBalance : Math.min(fixedAmort, remainingBalance);
      const pmt = amort + interest;
      remainingBalance = Math.max(0, remainingBalance - amort);

      totalPaid += pmt;
      totalInterest += interest;

      installments.push({
        month: m,
        paymentInCents: pmt,
        interestInCents: interest,
        amortizationInCents: amort,
        balanceInCents: remainingBalance,
      });
    }
  }

  // Cálculo da TIR (CET mensal) via bisseção determinística
  // Fluxo de caixa: t=0 recebe +(financedAmount - upfrontFees); t=1..n paga -PMT_t
  const netDisbursed = financedAmountInCents - upfrontFeesInCents;

  function npv(r: number): number {
    let sum = -netDisbursed;
    for (let t = 0; t < installments.length; t++) {
      sum += installments[t].paymentInCents / Math.pow(1 + r, t + 1);
    }
    return sum;
  }

  let low = 0.0;
  let high = 1.0; // até 100% ao mês
  let cetMonthly = i;

  if (upfrontFeesInCents > 0 || system === 'SAC') {
    for (let iter = 0; iter < 60; iter++) {
      const mid = (low + high) / 2;
      const val = npv(mid);
      if (Math.abs(val) < 0.5) {
        cetMonthly = mid;
        break;
      }
      if (val > 0) {
        low = mid;
      } else {
        high = mid;
      }
      cetMonthly = mid;
    }
  }

  const cetMonthlyPerc = Number((cetMonthly * 100).toFixed(4));
  const cetAnnualPerc = Number(((Math.pow(1 + cetMonthly, 12) - 1) * 100).toFixed(2));

  const explanation: DomainExplanation<number> = {
    valor: totalInterest,
    unidade: 'centavos',
    formula: system === 'PRICE'
      ? 'PMT = ⌈PV × i / (1 - (1+i)^-n)⌉; CET por TIR via Bisseção'
      : 'A = ⌈PV / n⌉; PMT_t = A + J_t; CET por TIR via Bisseção',
    entradas: {
      sistemaAmortizacao: system,
      valorFinanciadoCentavos: financedAmountInCents,
      taxaNominalMensal: `${nominalMonthlyRatePercentage}%`,
      prazoMeses: totalMonths,
      tarifasAberturaCentavos: upfrontFeesInCents,
      totalJurosCentavos: totalInterest,
      cetMensal: `${cetMonthlyPerc}% a.m.`,
      cetAnual: `${cetAnnualPerc}% a.a.`,
    },
    passos: [
      `1. Simulação amortizada em ${totalMonths} parcelas no sistema ${system}.`,
      `2. Total pago ao final do contrato: ${formatCentsToCurrency(totalPaid)}, sendo ${formatCentsToCurrency(totalInterest)} em juros.`,
      `3. Custo Efetivo Total (CET): ${cetMonthlyPerc}% ao mês (${cetAnnualPerc}% ao ano) calculado por TIR determinística.`,
    ],
    suficienciaDeDados: {
      suficiente: true,
      percentualConfiabilidade: 100,
    },
    confianca: 'ALTA',
  };

  return {
    system,
    financedAmountInCents,
    nominalMonthlyRatePercentage,
    totalMonths,
    upfrontFeesInCents,
    installments,
    totalPaidInCents: totalPaid,
    totalInterestInCents: totalInterest,
    effectiveMonthlyRateCetPercentage: cetMonthlyPerc,
    effectiveAnnualRateCetPercentage: cetAnnualPerc,
    explanation,
  };
}

/**
 * F37: Reagendador de Pagamentos Flexíveis
 * Move contas flexíveis dentro da janela autorizada para mitigar saldos diários negativos.
 */
export function rescheduleFlexiblePayables(
  initialCashBalanceInCents: number,
  dailyInflowsByDate: Record<string, number>, // YYYY-MM-DD -> receita
  payables: (PayableEntry & {
    isFlexible?: boolean;
    minAllowedDate?: string;
    maxAllowedDate?: string;
  })[],
  horizonDays = 30,
  startDate = new Date()
): FlexiblePayablesRescheduleResult {
  // Gerar dias do horizonte
  const dates: string[] = [];
  for (let i = 0; i < horizonDays; i++) {
    const d = new Date(startDate.getTime());
    d.setUTCDate(d.getUTCDate() + i);
    dates.push(d.toISOString().split('T')[0]);
  }

  // Simular fluxo base
  function simulateCashTrajectory(
    payablesList: typeof payables
  ): { lowestBalance: number; negativeDaysCount: number; dailyBalances: Record<string, number> } {
    let currentBalance = initialCashBalanceInCents;
    let lowest = currentBalance;
    let negCount = 0;
    const dailyBalances: Record<string, number> = {};

    const payablesByDate: Record<string, number> = {};
    for (const p of payablesList) {
      payablesByDate[p.dueDate] = (payablesByDate[p.dueDate] || 0) + p.amountInCents;
    }

    for (const dt of dates) {
      const inflow = dailyInflowsByDate[dt] || 0;
      const outflow = payablesByDate[dt] || 0;
      currentBalance = currentBalance + inflow - outflow;
      dailyBalances[dt] = currentBalance;

      if (currentBalance < lowest) lowest = currentBalance;
      if (currentBalance < 0) negCount++;
    }

    return { lowestBalance: lowest, negativeDaysCount: negCount, dailyBalances };
  }

  const baseSim = simulateCashTrajectory(payables);

  const items: RescheduledPayableItem[] = [];
  const modifiedPayables = payables.map((p) => ({ ...p }));

  // Ordenar despesas flexíveis por valor decrescente
  const flexibleIndices = modifiedPayables
    .map((p, idx) => ({ p, idx }))
    .filter(({ p }) => p.isFlexible && p.minAllowedDate && p.maxAllowedDate);

  flexibleIndices.sort((a, b) => b.p.amountInCents - a.p.amountInCents);

  for (const { p, idx } of flexibleIndices) {
    const originalDate = p.dueDate;
    const minD = p.minAllowedDate!;
    const maxD = p.maxAllowedDate!;

    let bestDate = originalDate;
    let bestSim = simulateCashTrajectory(modifiedPayables);

    // Testar deslocamento para datas na janela onde o saldo melhore
    for (const candidateDate of dates) {
      if (candidateDate < minD || candidateDate > maxD || candidateDate === originalDate) continue;

      modifiedPayables[idx].dueDate = candidateDate;
      const sim = simulateCashTrajectory(modifiedPayables);

      // Critério: reduz dias negativos OU melhora o menor saldo sem piorar dias negativos
      const isBetter = sim.negativeDaysCount < bestSim.negativeDaysCount ||
        (sim.negativeDaysCount === bestSim.negativeDaysCount && sim.lowestBalance > bestSim.lowestBalance);

      if (isBetter) {
        bestSim = sim;
        bestDate = candidateDate;
      }
    }

    // Fixar melhor data encontrada
    modifiedPayables[idx].dueDate = bestDate;

    items.push({
      payableId: p.id,
      supplierName: p.supplierName || p.description,
      amountInCents: p.amountInCents,
      originalDueDate: originalDate,
      suggestedDueDate: bestDate,
      minAllowedDate: minD,
      maxAllowedDate: maxD,
      status: bestDate !== originalDate ? 'REAGENDADO' : 'MANTIDO',
    });
  }

  const finalSim = simulateCashTrajectory(modifiedPayables);
  const deficitAvoided = Math.max(0, finalSim.lowestBalance - baseSim.lowestBalance);

  const explanation: DomainExplanation<number> = {
    valor: deficitAvoided,
    unidade: 'centavos',
    formula: 'Reagendamento guloso em [Data_mín, Data_máx] minimizando dias com saldo projetado < 0',
    entradas: {
      contasFlexiveisAnalisadas: flexibleIndices.length,
      contasReagendadas: items.filter((i) => i.status === 'REAGENDADO').length,
      diasNegativosAntes: baseSim.negativeDaysCount,
      diasNegativosDepois: finalSim.negativeDaysCount,
      menorSaldoAntesCentavos: baseSim.lowestBalance,
      menorSaldoDepoisCentavos: finalSim.lowestBalance,
    },
    passos: [
      `1. O fluxo de caixa original previa ${baseSim.negativeDaysCount} dias no vermelho com saldo mínimo de ${formatCentsToCurrency(baseSim.lowestBalance)}.`,
      `2. Foram reagendadas ${items.filter((i) => i.status === 'REAGENDADO').length} despesas flexíveis dentro dos limites autorizados pelos fornecedores.`,
      `3. O saldo negativo foi reduzido para ${finalSim.negativeDaysCount} dias, protegendo ${formatCentsToCurrency(deficitAvoided)} de liquidez.`,
    ],
    suficienciaDeDados: {
      suficiente: true,
      percentualConfiabilidade: 100,
    },
    confianca: 'ALTA',
  };

  return {
    items,
    daysWithNegativeBalanceBefore: baseSim.negativeDaysCount,
    daysWithNegativeBalanceAfter: finalSim.negativeDaysCount,
    lowestBalanceBeforeInCents: baseSim.lowestBalance,
    lowestBalanceAfterInCents: finalSim.lowestBalance,
    cashDeficitAvoidedInCents: deficitAvoided,
    explanation,
  };
}

/**
 * F47: Contas Recorrentes com Reajuste e Ajuste de Mês Curto
 * Garante que vencimentos no dia 29, 30 ou 31 caiam no último dia efetivo de meses curtos
 * e aplica percentual de reajuste contratual.
 */
export function generateRecurringScheduleWithIndex(
  templates: {
    id: string;
    description: string;
    baseAmountInCents: number;
    dueDayOfMonth: number; // 1 a 31
    contractAdjustmentPercentage?: number; // ex: 4.5%
    startYear: number;
    startMonth: number; // 1 a 12
    totalMonths: number;
  }[]
): RecurringScheduleResult {
  const entries: RecurringScheduleEntry[] = [];
  let totalAmount = 0;

  function getMaxDaysInMonth(year: number, month: number): number {
    // Regra do calendário gregoriano determinístico
    if (month === 2) {
      const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
      return isLeap ? 29 : 28;
    }
    if ([4, 6, 9, 11].includes(month)) return 30;
    return 31;
  }

  for (const t of templates) {
    const adjRate = t.contractAdjustmentPercentage || 0;
    const adjustedAmount = Math.floor(t.baseAmountInCents * (1 + adjRate / 100));

    let curYear = t.startYear;
    let curMonth = t.startMonth;

    for (let m = 0; m < t.totalMonths; m++) {
      const maxDays = getMaxDaysInMonth(curYear, curMonth);
      const effectiveDay = Math.min(t.dueDayOfMonth, maxDays);
      const isShortMonthAdjusted = effectiveDay < t.dueDayOfMonth;

      const dateStr = `${curYear}-${String(curMonth).padStart(2, '0')}-${String(effectiveDay).padStart(2, '0')}`;

      entries.push({
        sourceId: t.id,
        description: t.description,
        originalDueDay: t.dueDayOfMonth,
        competenceYear: curYear,
        competenceMonth: curMonth,
        effectiveDueDate: dateStr,
        adjustedAmountInCents: adjustedAmount,
        isShortMonthAdjusted,
      });

      totalAmount += adjustedAmount;

      curMonth++;
      if (curMonth > 12) {
        curMonth = 1;
        curYear++;
      }
    }
  }

  const explanation: DomainExplanation<number> = {
    valor: totalAmount,
    unidade: 'centavos',
    formula: 'Dia_efetivo = min(Dia_contratual, Dias_no_mês); Valor = ⌊V_base × (1 + Reajuste%)⌋',
    entradas: {
      modelosRecorrentes: templates.length,
      lancamentosProjetados: entries.length,
      ajustesMesCurto: entries.filter((e) => e.isShortMonthAdjusted).length,
    },
    passos: [
      `1. Projetados ${entries.length} vencimentos futuros com valor corrigido por índice contratual.`,
      `2. ${entries.filter((e) => e.isShortMonthAdjusted).length} vencimentos em dias 29/30/31 foram ajustados para o último dia de meses curtos sem pular competência.`,
      `3. Montante total recorrente programado: ${formatCentsToCurrency(totalAmount)}.`,
    ],
    suficienciaDeDados: {
      suficiente: templates.length > 0,
      faltam: templates.length === 0 ? 'Nenhum contrato recorrente cadastrado.' : undefined,
      percentualConfiabilidade: templates.length > 0 ? 100 : 0,
    },
    confianca: templates.length > 0 ? 'ALTA' : 'INSUFICIENTE',
  };

  return {
    entries,
    totalAmountInCents: totalAmount,
    explanation,
  };
}
