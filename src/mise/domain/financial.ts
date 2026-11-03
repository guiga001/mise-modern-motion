/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Mise — Motor Financeiro, DRE Gerencial, Fluxo de Caixa e Ponto de Equilíbrio
 * Invariante: 100% dos cálculos em centavos inteiros (BigInt/integer cents).
 */

import { CashFlowDay, DREReport, PayableEntry, ReceivableEntry, SalesImport, StockMovement } from './types';

/**
 * Calcula a DRE Gerencial (Demonstração do Resultado do Exercício) do período.
 * Pode ser calculada para uma loja específica ou consolidada.
 */
export function calculateDRE(
  periodLabel: string,
  storeId: string, // storeId específico ou 'CONSOLIDATED'
  salesImports: SalesImport[],
  stockMovements: StockMovement[],
  payables: PayableEntry[],
  laborCostInCents: number = 0,
  receivables: ReceivableEntry[] = []
): DREReport {
  // Filtrar dados por loja (se não for consolidado)
  const isMatchStore = (itemStoreId: string) => storeId === 'CONSOLIDATED' || itemStoreId === storeId;

  // 1. Receita Bruta e Deduções (Taxas e Descontos)
  let grossRevenueInCents = 0;
  let taxesAndDeductionsInCents = 0;

  for (const sale of salesImports.filter(s => isMatchStore(s.storeId))) {
    grossRevenueInCents += sale.totalGrossInCents;
    taxesAndDeductionsInCents += Math.max(0, sale.totalGrossInCents - sale.totalNetInCents);
  }

  // Entradas avulsas manuais
  for (const rec of receivables.filter(r => isMatchStore(r.storeId) && r.status === 'RECEIVED')) {
    grossRevenueInCents += rec.amountInCents;
  }

  const netRevenueInCents = Math.max(0, grossRevenueInCents - taxesAndDeductionsInCents);

  // 2. CMV Real (Custo dos insumos consumidos em vendas e perdas)
  let cmvInCents = 0;
  for (const mov of stockMovements.filter(m => isMatchStore(m.storeId))) {
    if (mov.type === 'SALES_CONSUMPTION' || mov.type === 'WASTE') {
      cmvInCents += Math.abs(mov.totalCostInCents);
    }
  }

  const grossProfitInCents = netRevenueInCents - cmvInCents;
  const cmvPercentage = netRevenueInCents > 0 ? Math.round((cmvInCents / netRevenueInCents) * 1000) / 10 : 0;
  const grossMarginPercentage = netRevenueInCents > 0 ? Math.round((grossProfitInCents / netRevenueInCents) * 1000) / 10 : 0;

  // 3. Despesas Operacionais e Custos Fixos (contas pagas ou provisionadas do período)
  let rentAndUtilitiesInCents = 0;
  let otherExpensesInCents = 0;

  for (const bill of payables.filter(p => isMatchStore(p.storeId) && p.status !== 'CANCELLED')) {
    if (bill.category === 'ALUGUEL' || bill.category === 'ENERGIA_AGUA') {
      rentAndUtilitiesInCents += bill.amountInCents;
    } else if (bill.category === 'FOLHA_MÃO_DE_OBRA') {
      // Já somado ou especificado
    } else if (bill.category !== 'FORNECEDOR') {
      // Outras despesas fixas (não fornecedor de insumos)
      otherExpensesInCents += bill.amountInCents;
    }
  }

  const operatingExpensesInCents = laborCostInCents + rentAndUtilitiesInCents + otherExpensesInCents;
  const netOperatingResultInCents = grossProfitInCents - operatingExpensesInCents;
  const netMarginPercentage = netRevenueInCents > 0 ? Math.round((netOperatingResultInCents / netRevenueInCents) * 1000) / 10 : 0;

  return {
    periodLabel,
    storeId,
    grossRevenueInCents,
    taxesAndDeductionsInCents,
    netRevenueInCents,
    cmvInCents,
    cmvPercentage,
    grossProfitInCents,
    grossMarginPercentage,
    operatingExpensesInCents,
    laborCostInCents,
    rentAndUtilitiesInCents,
    otherExpensesInCents,
    netOperatingResultInCents,
    netMarginPercentage,
  };
}

/**
 * Calcula o Ponto de Equilíbrio Operacional (Break-even point) em Reais.
 * Mostra o faturamento mínimo necessário para cobrir todos os custos e despesas sem prejuízo.
 */
export function calculateBreakEven(
  totalFixedExpensesInCents: number,
  grossMarginPercentage: number
): { breakEvenRevenueInCents: number; safetyMarginPercentage: number; currentProgressPercentage: number } {
  if (grossMarginPercentage <= 0) {
    return { breakEvenRevenueInCents: 0, safetyMarginPercentage: 0, currentProgressPercentage: 0 };
  }

  const marginDecimal = grossMarginPercentage / 100;
  const breakEvenRevenueInCents = Math.round(totalFixedExpensesInCents / marginDecimal);

  return {
    breakEvenRevenueInCents,
    safetyMarginPercentage: 0,
    currentProgressPercentage: 0,
  };
}

/**
 * Projeta o Fluxo de Caixa Diário por Vencimento para os próximos N dias.
 */
export function calculateDailyCashFlowProjection(
  storeId: string,
  initialBalanceInCents: number,
  payables: PayableEntry[],
  receivables: ReceivableEntry[],
  daysCount: number = 30
): CashFlowDay[] {
  const isMatchStore = (sId: string) => storeId === 'CONSOLIDATED' || sId === storeId;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const flow: CashFlowDay[] = [];
  let rollingBalance = initialBalanceInCents;

  for (let i = 0; i < daysCount; i++) {
    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() + i);
    const dateStr = targetDate.toISOString().split('T')[0];

    // Entradas do dia
    const dayInflows = receivables
      .filter(r => isMatchStore(r.storeId) && r.status !== 'CANCELLED' && r.dueDate === dateStr)
      .reduce((sum, r) => sum + r.amountInCents, 0);

    // Saídas do dia
    const dayOutflows = payables
      .filter(p => isMatchStore(p.storeId) && p.status !== 'CANCELLED' && p.dueDate === dateStr)
      .reduce((sum, p) => sum + p.amountInCents, 0);

    const net = dayInflows - dayOutflows;
    rollingBalance += net;

    flow.push({
      date: dateStr,
      inflowsInCents: dayInflows,
      outflowsInCents: dayOutflows,
      netInCents: net,
      projectedBalanceInCents: rollingBalance,
    });
  }

  return flow;
}
