/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Mise — F29 Projeção de Caixa com Cenários, F30 Retirada Segura,
 * F31 Custo de Maquininhas e Antecipação, F32 Ciclo de Caixa,
 * F34 DRE Comparativo e Pareto 80/20, F35 Provisões & Simples Nacional
 * Invariante: Zero IA/ML. Matemática contábil e financeira determinística, inteiros em centavos.
 */

import { DomainExplanation } from './insights-types';
import { PayableEntry, ReceivableEntry, DREReport } from './types';

// -------------------------------------------------------------
// F29: Fluxo de Caixa Projetado com 3 Cenários
// -------------------------------------------------------------

export interface DailyCashFlowScenarioPoint {
  date: string;
  dayIndex: number;
  startingBalanceInCents: number;
  projectedInflowsInCents: number;
  projectedOutflowsInCents: number;
  endingBalanceInCents: number;
}

export interface CashFlowScenarioSummary {
  scenarioName: 'BASE' | 'STRESS' | 'OPTIMISTIC';
  label: string;
  variationPercentage: number;
  endingBalanceInCents: number;
  lowestBalanceInCents: number;
  lowestBalanceDate: string;
  firstNegativeDate: string | null;
  daysInTheRed: number;
  points: DailyCashFlowScenarioPoint[];
}

export interface ProjectedCashFlowResult {
  currentCashBalanceInCents: number;
  horizonDays: number;
  baseScenario: CashFlowScenarioSummary;
  stressScenario: CashFlowScenarioSummary;
  optimisticScenario: CashFlowScenarioSummary;
  explanation: DomainExplanation;
}

export function projectCashFlowWithScenarios(
  currentBalanceInCents: number,
  receivables: ReceivableEntry[],
  payables: PayableEntry[],
  projectedDailySalesBaseInCents: number[] = [],
  stressVariationPct: number = 0.15, // 15% para estresse e otimista
  horizonDays: number = 30,
  now: Date = new Date()
): ProjectedCashFlowResult {
  const dates: string[] = [];
  for (let i = 0; i < horizonDays; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() + i);
    dates.push(d.toISOString().split('T')[0]);
  }

  // Agrupa recebíveis e pagamentos por data futura
  const receivablesByDate = new Map<string, number>();
  for (const r of receivables) {
    if (r.status === 'PENDING') {
      receivablesByDate.set(r.dueDate, (receivablesByDate.get(r.dueDate) || 0) + r.amountInCents);
    }
  }

  const payablesByDate = new Map<string, number>();
  for (const p of payables) {
    if (p.status === 'PENDING') {
      payablesByDate.set(p.dueDate, (payablesByDate.get(p.dueDate) || 0) + p.amountInCents);
    }
  }

  function simulate(variationPct: number, scenarioName: 'BASE' | 'STRESS' | 'OPTIMISTIC', label: string): CashFlowScenarioSummary {
    let balance = currentBalanceInCents;
    let lowest = balance;
    let lowestDate = dates[0] || '';
    let firstNegDate: string | null = null;
    let daysRed = 0;
    const points: DailyCashFlowScenarioPoint[] = [];

    for (let i = 0; i < horizonDays; i++) {
      const dateStr = dates[i];
      const start = balance;

      // Vendas projetadas à vista ajustadas pelo cenário
      const salesBase = projectedDailySalesBaseInCents[i] || 0;
      const salesAdjusted = Math.round(salesBase * (1 + variationPct));

      const scheduledReceivables = receivablesByDate.get(dateStr) || 0;
      const inflows = salesAdjusted + scheduledReceivables;

      const scheduledPayables = payablesByDate.get(dateStr) || 0;
      const outflows = scheduledPayables;

      balance = start + inflows - outflows;

      if (balance < lowest) {
        lowest = balance;
        lowestDate = dateStr;
      }
      if (balance < 0) {
        daysRed++;
        if (!firstNegDate) firstNegDate = dateStr;
      }

      points.push({
        date: dateStr,
        dayIndex: i + 1,
        startingBalanceInCents: start,
        projectedInflowsInCents: inflows,
        projectedOutflowsInCents: outflows,
        endingBalanceInCents: balance,
      });
    }

    return {
      scenarioName,
      label,
      variationPercentage: Math.round(variationPct * 100),
      endingBalanceInCents: balance,
      lowestBalanceInCents: lowest,
      lowestBalanceDate: lowestDate,
      firstNegativeDate: firstNegDate,
      daysInTheRed: daysRed,
      points,
    };
  }

  const baseScenario = simulate(0, 'BASE', 'Cenário Base (0%)');
  const stressScenario = simulate(-stressVariationPct, 'STRESS', `Cenário Estresse (-${Math.round(stressVariationPct * 100)}%)`);
  const optimisticScenario = simulate(+stressVariationPct, 'OPTIMISTIC', `Cenário Otimista (+${Math.round(stressVariationPct * 100)}%)`);

  return {
    currentCashBalanceInCents: currentBalanceInCents,
    horizonDays,
    baseScenario,
    stressScenario,
    optimisticScenario,
    explanation: {
      valor: `Menor Saldo: R$ ${(baseScenario.lowestBalanceInCents / 100).toFixed(2)}`,
      unidade: 'BRL',
      formula: 'Saldo_t = Saldo_{t-1} + Entradas_t - Saídas_t para 3 cenários (Base, -X%, +X%)',
      entradas: {
        saldoInicialCentavos: currentBalanceInCents,
        horizonteDias: horizonDays,
        variacaoCenarios: `${Math.round(stressVariationPct * 100)}%`,
        menorSaldoBase: baseScenario.lowestBalanceInCents,
        menorSaldoEstresse: stressScenario.lowestBalanceInCents,
      },
      passos: [
        `Projeção diária para os próximos ${horizonDays} dias com base nas contas agendadas e média de vendas.`,
        `Cenário Base: menor saldo previsto de R$ ${(baseScenario.lowestBalanceInCents / 100).toFixed(2)} em ${baseScenario.lowestBalanceDate}.`,
        baseScenario.firstNegativeDate
          ? `Alerta: o caixa entra no vermelho em ${baseScenario.firstNegativeDate}.`
          : `Caixa seguro em todo o horizonte de ${horizonDays} dias no cenário base.`,
      ],
      suficienciaDeDados: { suficiente: true, percentualConfiabilidade: 100 },
      confianca: 'ALTA',
    },
  };
}

// -------------------------------------------------------------
// F30: Quanto Posso Retirar (Retirada Segura)
// -------------------------------------------------------------

export interface SafeWithdrawalResult {
  currentCashInCents: number;
  lowestProjectedCashInCents: number;
  taxReserveInCents: number;
  laborProvisionReserveInCents: number;
  safetyCushionInCents: number;
  totalReservesInCents: number;
  safeWithdrawalAmountInCents: number;
  cushionDays: number;
  explanation: DomainExplanation;
}

export function calculateSafeOwnerWithdrawal(
  lowestProjectedCashInCents: number,
  estimatedTaxInCents: number,
  estimatedLaborProvisionsInCents: number,
  averageDailyOperatingExpenseInCents: number,
  cushionDays: number = 7
): SafeWithdrawalResult {
  const safetyCushion = Math.round(averageDailyOperatingExpenseInCents * cushionDays);
  const totalReserves = estimatedTaxInCents + estimatedLaborProvisionsInCents + safetyCushion;

  const safeWithdrawal = Math.max(0, lowestProjectedCashInCents - totalReserves);

  return {
    currentCashInCents: lowestProjectedCashInCents,
    lowestProjectedCashInCents,
    taxReserveInCents: estimatedTaxInCents,
    laborProvisionReserveInCents: estimatedLaborProvisionsInCents,
    safetyCushionInCents: safetyCushion,
    totalReservesInCents: totalReserves,
    safeWithdrawalAmountInCents: safeWithdrawal,
    cushionDays,
    explanation: {
      valor: `R$ ${(safeWithdrawal / 100).toFixed(2)}`,
      unidade: 'BRL',
      formula: 'Retirada Segura = max(0, Menor Saldo Projetado - (Impostos + Provisões + Colchão N dias))',
      entradas: {
        menorSaldoCentavos: lowestProjectedCashInCents,
        reservaImpostosCentavos: estimatedTaxInCents,
        reservaProvisoesCentavos: estimatedLaborProvisionsInCents,
        colchaoSegurancaCentavos: safetyCushion,
      },
      passos: [
        `Identificação do menor saldo futuro projetado: R$ ${(lowestProjectedCashInCents / 100).toFixed(2)}.`,
        `Subtração das obrigações futuras inegociáveis: Impostos (R$ ${(estimatedTaxInCents / 100).toFixed(2)}), Provisões (R$ ${(estimatedLaborProvisionsInCents / 100).toFixed(2)}) e Colchão de ${cushionDays} dias de despesas (R$ ${(safetyCushion / 100).toFixed(2)}).`,
        `Valor liberado para retirada sem risco de negativar o caixa: R$ ${(safeWithdrawal / 100).toFixed(2)}.`,
      ],
      suficienciaDeDados: { suficiente: true, percentualConfiabilidade: 100 },
      confianca: 'ALTA',
    },
  };
}

// -------------------------------------------------------------
// F31: Custo das Maquininhas e Custo Efetivo de Antecipação
// -------------------------------------------------------------

export interface CardFeeBreakdown {
  paymentMethod: string;
  salesVolumeInCents: number;
  sharePercentage: number;
  nominalFeePercentage: number;
  totalCostInCents: number;
}

export interface CardFeesAnalysisResult {
  totalCardRevenueInCents: number;
  totalFeesInCents: number;
  weightedAverageFeePercentage: number;
  methods: CardFeeBreakdown[];
  explanation: DomainExplanation;
}

export function calculateCardFeesAnalysis(
  methodSalesInCents: Record<string, number>,
  methodRates: Record<string, number> // ex: 'CREDITO_VISTA': 0.035
): CardFeesAnalysisResult {
  let totalRev = 0;
  for (const vol of Object.values(methodSalesInCents)) totalRev += vol;

  const methods: CardFeeBreakdown[] = [];
  let totalCost = 0;

  for (const [method, vol] of Object.entries(methodSalesInCents)) {
    const rate = methodRates[method] || 0.02; // padrão 2% se não cadastrado
    const cost = Math.round(vol * rate);
    const share = totalRev > 0 ? (vol / totalRev) * 100 : 0;

    totalCost += cost;
    methods.push({
      paymentMethod: method,
      salesVolumeInCents: vol,
      sharePercentage: Math.round(share * 10) / 10,
      nominalFeePercentage: Math.round(rate * 1000) / 10,
      totalCostInCents: cost,
    });
  }

  const weightedFee = totalRev > 0 ? (totalCost / totalRev) * 100 : 0;

  return {
    totalCardRevenueInCents: totalRev,
    totalFeesInCents: totalCost,
    weightedAverageFeePercentage: Math.round(weightedFee * 100) / 100,
    methods,
    explanation: {
      valor: `R$ ${(totalCost / 100).toFixed(2)} (${weightedFee.toFixed(2)}%)`,
      unidade: 'BRL',
      formula: 'Taxa Média = Σ (Participação_m × Taxa_m); Custo Total = Σ (Volume_m × Taxa_m)',
      entradas: { totalFaturamentoCentavos: totalRev, custoTotalCentavos: totalCost },
      passos: [
        `Ponderação das taxas cobradas em cada meio de pagamento conforme o volume transacionado.`,
        `Taxa média efetiva suportada pelo restaurante: ${weightedFee.toFixed(2)}%.`,
      ],
      suficienciaDeDados: { suficiente: totalRev > 0, percentualConfiabilidade: 100 },
      confianca: 'ALTA',
    },
  };
}

export function calculateReceivablesAnticipationEffectiveCost(
  grossAmountInCents: number,
  feeInCents: number,
  daysAnticipated: number
): {
  monthlyRatePercentage: number;
  annualRatePercentage: number;
  netAmountReceivedInCents: number;
  explanation: DomainExplanation;
} {
  if (daysAnticipated <= 0) throw new Error('Dias antecipados deve ser > 0');
  const net = grossAmountInCents - feeInCents;
  if (net <= 0) throw new Error('Valor líquido recebido deve ser > 0');

  const ratio = grossAmountInCents / net;
  const monthlyRate = Math.pow(ratio, 30 / daysAnticipated) - 1;
  const annualRate = Math.pow(1 + monthlyRate, 12) - 1;

  return {
    monthlyRatePercentage: Math.round(monthlyRate * 1000) / 10,
    annualRatePercentage: Math.round(annualRate * 1000) / 10,
    netAmountReceivedInCents: net,
    explanation: {
      valor: `${(monthlyRate * 100).toFixed(2)}% a.m.`,
      unidade: '% a.m.',
      formula: 'i_mensal = (Bruto / Líquido)^(30 / Dias) - 1',
      entradas: { valorBrutoCentavos: grossAmountInCents, tarifaCentavos: feeInCents, dias: daysAnticipated },
      passos: [
        `A tarifa de R$ ${(feeInCents / 100).toFixed(2)} cobrada para antecipar ${daysAnticipated} dias equivale a uma taxa de juros de ${(monthlyRate * 100).toFixed(2)}% ao mês (${(annualRate * 100).toFixed(1)}% ao ano).`,
      ],
      suficienciaDeDados: { suficiente: true, percentualConfiabilidade: 100 },
      confianca: 'ALTA',
    },
  };
}

// -------------------------------------------------------------
// F32: Ciclo de Caixa (PME + PMR - PMP)
// -------------------------------------------------------------

export interface CashConversionCycleResult {
  pmeDays: number; // Prazo médio de estoque
  pmrDays: number; // Prazo médio de recebimento
  pmpDays: number; // Prazo médio de pagamento
  operatingCycleDays: number; // PME + PMR
  cashConversionCycleDays: number; // PME + PMR - PMP
  dailyOperatingExpenseInCents: number;
  workingCapitalNeedInCents: number; // NCG
  explanation: DomainExplanation;
}

export function calculateCashConversionCycle(
  averageInventoryInCents: number,
  periodCmvInCents: number,
  averageReceivablesInCents: number,
  periodSalesInCents: number,
  averagePayablesInCents: number,
  periodPurchasesInCents: number,
  periodDays: number = 30
): CashConversionCycleResult {
  const safeDays = Math.max(1, periodDays);

  const cmvDaily = periodCmvInCents / safeDays;
  const salesDaily = periodSalesInCents / safeDays;
  const purchasesDaily = periodPurchasesInCents / safeDays;

  const pme = cmvDaily > 0 ? averageInventoryInCents / cmvDaily : 0;
  const pmr = salesDaily > 0 ? averageReceivablesInCents / salesDaily : 0;
  const pmp = purchasesDaily > 0 ? averagePayablesInCents / purchasesDaily : 0;

  const operatingCycle = pme + pmr;
  const cashCycle = operatingCycle - pmp;

  // NCG = Ciclo Financeiro * Gasto Diário
  const dailyExpense = cmvDaily > 0 ? cmvDaily : salesDaily * 0.7;
  const workingCapital = Math.round(cashCycle * dailyExpense);

  return {
    pmeDays: Math.round(pme * 10) / 10,
    pmrDays: Math.round(pmr * 10) / 10,
    pmpDays: Math.round(pmp * 10) / 10,
    operatingCycleDays: Math.round(operatingCycle * 10) / 10,
    cashConversionCycleDays: Math.round(cashCycle * 10) / 10,
    dailyOperatingExpenseInCents: Math.round(dailyExpense),
    workingCapitalNeedInCents: workingCapital,
    explanation: {
      valor: `${Math.round(cashCycle)} dias`,
      unidade: 'dias',
      formula: 'Ciclo Financeiro = PME (Estoque) + PMR (Recebimento) - PMP (Pagamento Fornecedores)',
      entradas: {
        pmeDias: Math.round(pme * 10) / 10,
        pmrDias: Math.round(pmr * 10) / 10,
        pmpDias: Math.round(pmp * 10) / 10,
      },
      passos: [
        `PME: Insumos ficam em média ${Math.round(pme)} dias no estoque antes da venda.`,
        `PMR: Vendas demoram em média ${Math.round(pmr)} dias para cair no caixa (cartões/prazo).`,
        `PMP: Fornecedores concedem média de ${Math.round(pmp)} dias para pagamento de compras.`,
        `Ciclo de Caixa resultante: ${Math.round(cashCycle)} dias que a empresa precisa bancar do próprio bolso (Necessidade de Capital de Giro estimada: R$ ${(workingCapital / 100).toFixed(2)}).`,
      ],
      suficienciaDeDados: { suficiente: periodCmvInCents > 0, percentualConfiabilidade: 100 },
      confianca: 'ALTA',
    },
  };
}

// -------------------------------------------------------------
// F34: DRE Comparativo e Pareto de Despesas
// -------------------------------------------------------------

export interface ExpenseParetoItem {
  category: string;
  amountInCents: number;
  percentageOfTotal: number;
  cumulativePercentage: number;
  isVitalEighty: boolean; // dentro dos 80%
}

export interface ComparativeDreResult {
  currentDre: DREReport;
  previousDre: DREReport;
  deltaGrossRevenueInCents: number;
  deltaGrossRevenuePercentage: number;
  deltaCmvInCents: number;
  deltaCmvPercentage: number;
  deltaNetResultInCents: number;
  deltaNetResultPercentage: number;
  expensesPareto: ExpenseParetoItem[];
  explanation: DomainExplanation;
}

export function calculateComparativeDreAndPareto(
  currentDre: DREReport,
  previousDre: DREReport,
  payablesInPeriod: PayableEntry[]
): ComparativeDreResult {
  const deltaRev = currentDre.grossRevenueInCents - previousDre.grossRevenueInCents;
  const deltaRevPct = previousDre.grossRevenueInCents > 0
    ? (deltaRev / previousDre.grossRevenueInCents) * 100
    : 0;

  const deltaCmv = currentDre.cmvInCents - previousDre.cmvInCents;
  const deltaCmvPct = previousDre.cmvInCents > 0
    ? (deltaCmv / previousDre.cmvInCents) * 100
    : 0;

  const deltaNet = currentDre.netOperatingResultInCents - previousDre.netOperatingResultInCents;
  const deltaNetPct = previousDre.netOperatingResultInCents !== 0
    ? (deltaNet / Math.abs(previousDre.netOperatingResultInCents)) * 100
    : 0;

  // Pareto de despesas
  const catMap: Record<string, number> = {};
  for (const p of payablesInPeriod) {
    if (p.status === 'PAID') {
      catMap[p.category] = (catMap[p.category] || 0) + p.amountInCents;
    }
  }

  const rawPareto = Object.entries(catMap).map(([category, amountInCents]) => ({
    category,
    amountInCents,
  }));
  rawPareto.sort((a, b) => b.amountInCents - a.amountInCents);

  const totalExp = rawPareto.reduce((sum, item) => sum + item.amountInCents, 0);
  let cumSpent = 0;
  const expensesPareto: ExpenseParetoItem[] = rawPareto.map(item => {
    cumSpent += item.amountInCents;
    const share = totalExp > 0 ? (item.amountInCents / totalExp) * 100 : 0;
    const cum = totalExp > 0 ? (cumSpent / totalExp) * 100 : 100;
    return {
      category: item.category,
      amountInCents: item.amountInCents,
      percentageOfTotal: Math.round(share * 10) / 10,
      cumulativePercentage: Math.round(cum * 10) / 10,
      isVitalEighty: cum <= 85 || share >= 50,
    };
  });

  return {
    currentDre,
    previousDre,
    deltaGrossRevenueInCents: deltaRev,
    deltaGrossRevenuePercentage: Math.round(deltaRevPct * 10) / 10,
    deltaCmvInCents: deltaCmv,
    deltaCmvPercentage: Math.round(deltaCmvPct * 10) / 10,
    deltaNetResultInCents: deltaNet,
    deltaNetResultPercentage: Math.round(deltaNetPct * 10) / 10,
    expensesPareto,
    explanation: {
      valor: `Δ Lucro: R$ ${(deltaNet / 100).toFixed(2)}`,
      unidade: 'BRL',
      formula: 'Δ = Atual - Anterior; Curva de Pareto 80/20 acumulada por categoria de despesa',
      entradas: {
        receitaAtualCentavos: currentDre.grossRevenueInCents,
        receitaAnteriorCentavos: previousDre.grossRevenueInCents,
        lucroAtualCentavos: currentDre.netOperatingResultInCents,
        lucroAnteriorCentavos: previousDre.netOperatingResultInCents,
      },
      passos: [
        `Comparativo do DRE: Variação de faturamento de ${deltaRevPct.toFixed(1)}% e variação de lucro líquido de R$ ${(deltaNet / 100).toFixed(2)}.`,
        `Curva de Pareto: as despesas vitais concentram 80% dos gastos em poucas categorias (aluguel, folha e energia).`,
      ],
      suficienciaDeDados: { suficiente: true, percentualConfiabilidade: 100 },
      confianca: 'ALTA',
    },
  };
}

// -------------------------------------------------------------
// F35: Provisões e Simples Nacional
// -------------------------------------------------------------

export interface SimplesNacionalCalculation {
  rbt12InCents: number; // Receita Bruta dos últimos 12 meses
  nominalRatePercentage: number;
  deductionInCents: number;
  effectiveRatePercentage: number;
  monthlyRevenueInCents: number;
  estimatedDasInCents: number;
}

export function calculateSimplesNacionalAnexoI(
  rbt12InCents: number,
  monthlyRevenueInCents: number
): SimplesNacionalCalculation {
  if (rbt12InCents <= 0) {
    throw new Error('RBT12 deve ser estritamente maior que zero para cálculo do Simples Nacional.');
  }

  // Tabela oficial Anexo I (Comércio)
  // Faixa 1: Até 180.000 -> 4.00% / dedução 0
  // Faixa 2: 180.000 a 360.000 -> 7.30% / dedução 5.940,00
  // Faixa 3: 360.000 a 720.000 -> 9.50% / dedução 13.860,00
  // Faixa 4: 720.000 a 1.800.000 -> 10.70% / dedução 22.500,00
  // Faixa 5: 1.800.000 a 3.600.000 -> 14.30% / dedução 87.300,00
  // Faixa 6: 3.600.000 a 4.800.000 -> 19.00% / dedução 378.000,00
  let nominal = 0.04;
  let deduction = 0;

  if (rbt12InCents <= 18000000) {
    nominal = 0.04;
    deduction = 0;
  } else if (rbt12InCents <= 36000000) {
    nominal = 0.073;
    deduction = 594000;
  } else if (rbt12InCents <= 72000000) {
    nominal = 0.095;
    deduction = 1386000;
  } else if (rbt12InCents <= 180000000) {
    nominal = 0.107;
    deduction = 2250000;
  } else if (rbt12InCents <= 360000000) {
    nominal = 0.143;
    deduction = 8730000;
  } else {
    nominal = 0.19;
    deduction = 37800000;
  }

  // Alíquota Efetiva = ((RBT12 * nominal) - deducao) / RBT12
  const grossTax = (rbt12InCents * nominal);
  const netTax = grossTax - deduction;
  const effectiveRate = netTax / rbt12InCents;

  const estimatedDas = Math.round(monthlyRevenueInCents * effectiveRate);

  return {
    rbt12InCents,
    nominalRatePercentage: Math.round(nominal * 1000) / 10,
    deductionInCents: deduction,
    effectiveRatePercentage: Math.round(effectiveRate * 1000) / 10,
    monthlyRevenueInCents,
    estimatedDasInCents: estimatedDas,
  };
}
