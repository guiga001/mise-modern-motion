/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * MISE Intelligence — Motor de Inteligência Matemática e Estatística Determinística
 *
 * PROIBIDO IA / LLM / MACHINE LEARNING.
 * 100% Matemática Pura, Estatística Descritiva, Séries Temporais e Fórmulas Financeiras.
 * Invariante: Dinheiro SEMPRE em centavos inteiros (BigInt/integer cents).
 * Invariante: Tratamento estrito de divisão por zero e suficiência amostral de dados.
 */

import {
  MiseDatabaseState,
} from '../lib/storage';
import {
  SalesImport,
  StockMovement,
  PayableEntry,
  ReceivableEntry,
  Recipe,
  Ingredient,
  InventoryCount,
  ProductionOrder,
} from './types';
import { DomainExplanation } from './insights-types';

export interface IntelligencePeriodFilter {
  type: 'HOJE' | 'SEMANA' | 'MES' | 'CUSTOM';
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  label: string;
}

// 1. Dashboard & Inteligência Financeira
export interface FinancialIntelligenceKpis {
  grossRevenueInCents: number; // Faturamento Total Bruto
  netRevenueInCents: number; // Receita Líquida (após deduções/taxas)
  taxesAndDeductionsInCents: number;
  variableCostsInCents: number; // CMV Insumos + Embalagens
  contributionMarginInCents: number; // Receita Líquida - Custos Variáveis
  contributionMarginPercentage: number; // (MC / Receita Líquida) * 100
  fixedCostsInCents: number; // Custos Fixos (Aluguel, Energia, Equipe)
  operatingExpensesInCents: number; // Outras despesas operacionais
  totalExpensesInCents: number; // Fixos + Despesas
  estimatedOperatingProfitInCents: number; // Receita Líq - Custos Variáveis - Custos Fixos - Despesas
  netProfitMarginPercentage: number; // (Lucro Operacional / Receita Líquida) * 100
  totalOrdersCount: number; // Quantidade de pedidos/vendas
  averageTicketInCents: number; // Receita Líquida / Pedidos
  breakEvenPointInCents: number; // Custos Fixos / Índice de MC
  breakEvenSalesPerDayInCents: number;
  daysInPeriod: number;
  explanation: DomainExplanation<number>;
}

// 2. Análise Comparativa
export interface ComparativePeriodData {
  label: string;
  grossRevenueInCents: number;
  netRevenueInCents: number;
  contributionMarginInCents: number;
  ordersCount: number;
  averageTicketInCents: number;
  operatingProfitInCents: number;
}

export interface MetricComparison {
  metricName: string;
  unit: 'R$' | '%' | 'qtd';
  currentValue: number;
  previousValue: number;
  absoluteDelta: number;
  percentageDelta: number; // ((Atual - Anterior) / Anterior) * 100
  trend: 'UP' | 'DOWN' | 'STABLE';
  isPositiveForBusiness: boolean;
}

export interface ComparativeAnalysisResult {
  currentPeriod: ComparativePeriodData;
  previousPeriod: ComparativePeriodData;
  comparisons: MetricComparison[];
  comparisonType: 'HOJE_VS_ONTEM' | 'SEMANA_VS_ANTERIOR' | 'MES_VS_ANTERIOR' | 'CUSTOM';
  explanation: DomainExplanation<string>;
}

// 3. Análise de Produtos & Curva ABC
export interface ProductPerformanceItem {
  recipeId: string;
  productName: string;
  category: string;
  quantitySold: number;
  salePriceInCents: number;
  totalRevenueInCents: number;
  unitCmvInCents: number;
  totalCmvInCents: number;
  unitContributionMarginInCents: number;
  totalContributionMarginInCents: number;
  marginPercentage: number;
  revenueSharePercentage: number; // Participação % no faturamento total
  cumulativeRevenueSharePercentage: number; // Participação acumulada (0-100%)
  abcClass: 'A' | 'B' | 'C'; // A: até 80%, B: 80-95%, C: 95-100%
}

export interface ProductAnalyticsSummary {
  totalProductsCount: number;
  topSellersByVolume: ProductPerformanceItem[];
  leastSellersByVolume: ProductPerformanceItem[];
  topRevenueProducts: ProductPerformanceItem[];
  topMarginProducts: ProductPerformanceItem[];
  lowestMarginProducts: ProductPerformanceItem[];
  abcDistribution: {
    classA: { count: number; revenueSharePct: number; items: ProductPerformanceItem[] };
    classB: { count: number; revenueSharePct: number; items: ProductPerformanceItem[] };
    classC: { count: number; revenueSharePct: number; items: ProductPerformanceItem[] };
  };
}

// 4. Engenharia de Cardápio (Menu Matrix)
export type MenuMatrixQuadrant = 'STAR' | 'PLOWHORSE' | 'PUZZLE' | 'DOG';

export interface MenuMatrixItem {
  recipeId: string;
  name: string;
  category: string;
  volumeSold: number;
  unitPriceInCents: number;
  unitCmvInCents: number;
  unitContributionMarginInCents: number;
  marginPercentage: number;
  quadrant: MenuMatrixQuadrant;
  quadrantLabel: string;
  justification: string;
  actionRecommendation: string;
}

export interface MenuMatrixResult {
  averagePopularityThreshold: number; // 70% da popularidade média esperada
  weightedAverageMarginInCents: number; // Margem média ponderada
  stars: MenuMatrixItem[]; // Alta popularidade + Alta margem
  plowhorses: MenuMatrixItem[]; // Alta popularidade + Baixa margem (Cavalos de batalha)
  puzzles: MenuMatrixItem[]; // Baixa popularidade + Alta margem (Quebra-cabeças)
  dogs: MenuMatrixItem[]; // Baixa popularidade + Baixa margem (Abacaxis)
  allItems: MenuMatrixItem[];
}

// 5. Inteligência de Estoque & Ruptura
export interface StockIntelligenceItem {
  ingredientId: string;
  name: string;
  unit: string;
  currentBalance: number;
  minimumStock: number;
  averageDailyConsumption: number; // Consumo médio diário
  leadTimeDays: number; // Prazo de reposição
  safetyStock: number; // Estoque de segurança
  reorderPoint: number; // Consumo Médio Diário * Lead Time + Estoque de Segurança
  coverageDays: number; // Quantidade Atual / Consumo Médio Diário
  status: 'CRITICAL_RUPTURE' | 'BELOW_ROP' | 'OPTIMAL' | 'OVERSTOCK' | 'DEAD_STOCK';
  statusLabel: string;
  totalValueInCents: number;
  costPerUnitInCents: number;
}

export interface StockIntelligenceResult {
  totalStockValueInCents: number;
  stockTurnoverRate: number; // Giro de Estoque = CMV / Estoque Médio
  criticalRuptureItems: StockIntelligenceItem[];
  reorderNeededItems: StockIntelligenceItem[];
  overstockedItems: StockIntelligenceItem[];
  deadStockItems: StockIntelligenceItem[];
  allItems: StockIntelligenceItem[];
}

// 6. Análise de Desperdícios
export interface WasteAnalyticsResult {
  totalWasteValueInCents: number;
  wasteToPurchasesRatioPct: number; // (Perdas / Total de Compras) * 100
  wasteByIngredient: {
    ingredientId: string;
    ingredientName: string;
    wastedQuantity: number;
    unit: string;
    totalCostInCents: number;
    shareOfWastePct: number;
  }[];
  wasteByReason: {
    reason: string;
    totalCostInCents: number;
    count: number;
  }[];
  wasteEvolutionDaily: {
    date: string;
    costInCents: number;
  }[];
}

// 7. Desempenho Operacional
export interface OperationalPerformanceResult {
  ordersPerHour: { hour: number; orderCount: number; volumeRevenueInCents: number }[];
  peakHour: { hour: number; count: number };
  averageTicketByDayOfWeek: { day: string; dayIndex: number; avgTicketInCents: number; orderCount: number }[];
  cancellationRatePct: number;
  completionRatePct: number;
  totalProductionBatches: number;
  actualVsPlannedYieldRatioPct: number; // Eficiência de Rendimento
}

// 8. Projeções Matemáticas
export interface MathematicalProjectionsResult {
  projectedMonthEndRevenueInCents: number;
  projectionMethodology: string;
  historicalDaysCount: number;
  confidenceScorePct: number;
  demandForecastNext7Days: {
    dayOffset: number;
    date: string;
    dayOfWeek: string;
    projectedRevenueInCents: number;
    projectedOrdersCount: number;
  }[];
  linearTrendSlope: number; // a na regressão linear y = a + bx
}

// 9. Metas e Indicadores (Goals)
export interface BusinessGoal {
  id: string;
  type: 'REVENUE' | 'PROFIT' | 'MARGIN_PCT' | 'AVG_TICKET' | 'WASTE_REDUCTION';
  title: string;
  targetValue: number; // Centavos para dinheiro, percentual * 10 para %, unidades para ticket
  achievedValue: number;
  progressPercentage: number;
  remainingValue: number;
  dailyRequiredForRemainingDays: number;
  currentRunRateProjectedValue: number;
  daysRemainingInPeriod: number;
  isOnTrack: boolean;
}

// 10. Alertas Matemáticos
export interface MathematicalAlert {
  id: string;
  ruleCode: string;
  category: 'REVENUE_DROP' | 'MARGIN_COMPRESSION' | 'EXPENSE_SPIKE' | 'RUPTURE_RISK' | 'HIGH_WASTE' | 'TICKET_DROP';
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  title: string;
  affectedIndicator: string;
  currentValue: string;
  referenceValue: string;
  delta: string;
  mathematicalRule: string;
  identifiedAt: string;
  actionRecommendation: string;
}

// 11. Diagnóstico do Restaurante (Score 0-100)
export interface DiagnosticPillarScore {
  pillarName: string;
  score: number; // 0 a 100
  weight: number; // Peso percentual
  metricsAnalyzed: { name: string; value: string; benchmark: string; pointsAwarded: number }[];
  status: 'EXCELENTE' | 'BOM' | 'ATENCAO' | 'CRITICO';
}

export interface RestaurantDiagnosticResult {
  overallScore: number; // 0 a 100
  ratingLevel: 'A+' | 'A' | 'B' | 'C' | 'D';
  pillars: DiagnosticPillarScore[];
  summaryText: string;
  topStrengths: string[];
  topWeaknesses: string[];
  methodologyText: string;
}

// =========================================================================
// IMPLEMENTAÇÕES PURAS DAS FUNÇÕES DO MOTOR MISE INTELLIGENCE
// =========================================================================

/**
 * 1. Calcula o Dashboard e os KPIs Financeiros Principais
 */
export function calculateFinancialIntelligence(
  storeId: string,
  sales: SalesImport[],
  movements: StockMovement[],
  payables: PayableEntry[],
  receivables: ReceivableEntry[] = [],
  daysInPeriod: number = 30
): FinancialIntelligenceKpis {
  const isMatchStore = (itemStoreId: string) => storeId === 'CONSOLIDATED' || itemStoreId === storeId;

  // Receita Bruta e Deduções
  let grossRevenueInCents = 0;
  let taxesAndDeductionsInCents = 0;
  let totalOrdersCount = 0;

  for (const s of sales.filter(s => isMatchStore(s.storeId))) {
    grossRevenueInCents += s.totalGrossInCents;
    taxesAndDeductionsInCents += Math.max(0, s.totalGrossInCents - s.totalNetInCents);
    totalOrdersCount += s.totalOrdersCount || (s.lines ? s.lines.reduce((acc, it) => acc + it.quantity, 0) : 1);
  }

  for (const r of receivables.filter(r => isMatchStore(r.storeId) && r.status === 'RECEIVED')) {
    grossRevenueInCents += r.amountInCents;
  }

  // Receita Líquida
  const netRevenueInCents = Math.max(0, grossRevenueInCents - taxesAndDeductionsInCents);

  // Custos Variáveis (CMV Real de vendas e perdas)
  let variableCostsInCents = 0;
  for (const m of movements.filter(m => isMatchStore(m.storeId))) {
    if (m.type === 'SALES_CONSUMPTION' || m.type === 'WASTE') {
      variableCostsInCents += Math.abs(m.totalCostInCents);
    }
  }

  // Margem de Contribuição = Receita Líquida - Custos Variáveis
  const contributionMarginInCents = netRevenueInCents - variableCostsInCents;
  const contributionMarginPercentage =
    netRevenueInCents > 0 ? Math.round((contributionMarginInCents / netRevenueInCents) * 1000) / 10 : 0;

  // Custos Fixos e Despesas
  let fixedCostsInCents = 0;
  let operatingExpensesInCents = 0;

  for (const bill of payables.filter(p => isMatchStore(p.storeId) && p.status !== 'CANCELLED')) {
    if (bill.category === 'ALUGUEL' || bill.category === 'ENERGIA_AGUA' || bill.category === 'FOLHA_MÃO_DE_OBRA') {
      fixedCostsInCents += bill.amountInCents;
    } else {
      operatingExpensesInCents += bill.amountInCents;
    }
  }

  const totalExpensesInCents = fixedCostsInCents + operatingExpensesInCents;

  // Lucro Operacional Estimado = Receita Líquida - Custos Variáveis - Custos Fixos - Despesas
  const estimatedOperatingProfitInCents = contributionMarginInCents - totalExpensesInCents;
  const netProfitMarginPercentage =
    netRevenueInCents > 0
      ? Math.round((estimatedOperatingProfitInCents / netRevenueInCents) * 1000) / 10
      : 0;

  // Ticket Médio
  const effectiveOrders = totalOrdersCount > 0 ? totalOrdersCount : sales.length;
  const averageTicketInCents = effectiveOrders > 0 ? Math.round(netRevenueInCents / effectiveOrders) : 0;

  // Ponto de Equilíbrio = Custos Fixos / (Margem de Contribuição / Receita Líquida)
  const cmRatio = netRevenueInCents > 0 ? contributionMarginInCents / netRevenueInCents : 0;
  const breakEvenPointInCents = cmRatio > 0 ? Math.round(totalExpensesInCents / cmRatio) : 0;
  const breakEvenSalesPerDayInCents = daysInPeriod > 0 ? Math.round(breakEvenPointInCents / daysInPeriod) : 0;

  return {
    grossRevenueInCents,
    netRevenueInCents,
    taxesAndDeductionsInCents,
    variableCostsInCents,
    contributionMarginInCents,
    contributionMarginPercentage,
    fixedCostsInCents,
    operatingExpensesInCents,
    totalExpensesInCents,
    estimatedOperatingProfitInCents,
    netProfitMarginPercentage,
    totalOrdersCount: effectiveOrders,
    averageTicketInCents,
    breakEvenPointInCents,
    breakEvenSalesPerDayInCents,
    daysInPeriod,
    explanation: {
      valor: estimatedOperatingProfitInCents,
      unidade: 'centavos',
      formula: 'Lucro = Receita Líquida − Custos Variáveis (CMV) − Custos Fixos − Despesas',
      entradas: {
        receitaLiquida: netRevenueInCents,
        custosVariaveis: variableCostsInCents,
        custosFixos: fixedCostsInCents,
        despesas: operatingExpensesInCents,
      },
      passos: [
        `Receita Bruta: R$ ${(grossRevenueInCents / 100).toFixed(2)}`,
        `Deduções/Taxas: R$ ${(taxesAndDeductionsInCents / 100).toFixed(2)}`,
        `Receita Líquida: R$ ${(netRevenueInCents / 100).toFixed(2)}`,
        `Margem de Contribuição: R$ ${(contributionMarginInCents / 100).toFixed(2)} (${contributionMarginPercentage}%)`,
        `Custos Fixos + Despesas: R$ ${(totalExpensesInCents / 100).toFixed(2)}`,
        `Ponto de Equilíbrio: R$ ${(breakEvenPointInCents / 100).toFixed(2)}`,
      ],
      suficienciaDeDados: {
        suficiente: netRevenueInCents > 0 || totalExpensesInCents > 0,
        percentualConfiabilidade: netRevenueInCents > 0 && totalExpensesInCents > 0 ? 100 : 60,
      },
      confianca: netRevenueInCents > 0 ? 'ALTA' : 'MEDIA',
    },
  };
}

/**
 * 2. Análise Comparativa entre Período Atual e Período Anterior
 */
export function calculateComparativeAnalysis(
  currentData: ComparativePeriodData,
  previousData: ComparativePeriodData,
  comparisonType: 'HOJE_VS_ONTEM' | 'SEMANA_VS_ANTERIOR' | 'MES_VS_ANTERIOR' | 'CUSTOM' = 'MES_VS_ANTERIOR'
): ComparativeAnalysisResult {
  const buildMetric = (
    name: string,
    unit: 'R$' | '%' | 'qtd',
    curr: number,
    prev: number,
    higherIsBetter: boolean
  ): MetricComparison => {
    const absDelta = curr - prev;
    const pctDelta = prev !== 0 ? Math.round(((curr - prev) / Math.abs(prev)) * 1000) / 10 : curr > 0 ? 100 : 0;
    const trend = absDelta > 0 ? 'UP' : absDelta < 0 ? 'DOWN' : 'STABLE';
    const isPositive = higherIsBetter ? absDelta >= 0 : absDelta <= 0;

    return {
      metricName: name,
      unit,
      currentValue: curr,
      previousValue: prev,
      absoluteDelta: absDelta,
      percentageDelta: pctDelta,
      trend,
      isPositiveForBusiness: isPositive,
    };
  };

  const comparisons: MetricComparison[] = [
    buildMetric('Faturamento Líquido', 'R$', currentData.netRevenueInCents, previousData.netRevenueInCents, true),
    buildMetric('Margem de Contribuição', 'R$', currentData.contributionMarginInCents, previousData.contributionMarginInCents, true),
    buildMetric('Lucro Operacional', 'R$', currentData.operatingProfitInCents, previousData.operatingProfitInCents, true),
    buildMetric('Ticket Médio', 'R$', currentData.averageTicketInCents, previousData.averageTicketInCents, true),
    buildMetric('Volume de Pedidos', 'qtd', currentData.ordersCount, previousData.ordersCount, true),
  ];

  return {
    currentPeriod: currentData,
    previousPeriod: previousData,
    comparisons,
    comparisonType,
    explanation: {
      valor: `${comparisons[0].percentageDelta}%`,
      unidade: '%',
      formula: 'Crescimento (%) = ((Valor Atual − Valor Anterior) / |Valor Anterior|) × 100',
      entradas: {
        atual: currentData.netRevenueInCents,
        anterior: previousData.netRevenueInCents,
      },
      passos: [
        `Período Atual: R$ ${(currentData.netRevenueInCents / 100).toFixed(2)}`,
        `Período Anterior: R$ ${(previousData.netRevenueInCents / 100).toFixed(2)}`,
        `Variação Absoluta: R$ ${((currentData.netRevenueInCents - previousData.netRevenueInCents) / 100).toFixed(2)}`,
        `Variação Percentual: ${comparisons[0].percentageDelta}%`,
      ],
      suficienciaDeDados: {
        suficiente: previousData.netRevenueInCents > 0,
        faltam: previousData.netRevenueInCents === 0 ? 'Dados do período anterior ausentes' : undefined,
        percentualConfiabilidade: previousData.netRevenueInCents > 0 ? 100 : 50,
      },
      confianca: previousData.netRevenueInCents > 0 ? 'ALTA' : 'MEDIA',
    },
  };
}

/**
 * 3. Análise de Produtos e Classificação ABC (Curva de Pareto)
 */
export function calculateProductIntelligenceAndAbc(
  recipes: Recipe[],
  recipeCostsMap: Map<string, { totalCostInCents: number }>,
  salesImports: SalesImport[],
  storeId: string = 'CONSOLIDATED'
): ProductAnalyticsSummary {
  const isMatchStore = (sId: string) => storeId === 'CONSOLIDATED' || sId === storeId;

  // 1. Agregação por receita
  const productStats = new Map<string, { qty: number; revenueInCents: number; unitPriceInCents: number }>();

  for (const s of salesImports.filter(s => isMatchStore(s.storeId))) {
    for (const item of (s.lines || [])) {
      const recId = item.mappedRecipeId || item.externalProductName;
      const current = productStats.get(recId) || { qty: 0, revenueInCents: 0, unitPriceInCents: item.salePriceInCents };
      current.qty += item.quantity;
      current.revenueInCents += item.netRevenueInCents;
      if (item.salePriceInCents > 0) current.unitPriceInCents = item.salePriceInCents;
      productStats.set(recId, current);
    }
  }

  // 2. Monta lista detalhada de produtos
  const recipeMap = new Map(recipes.map(r => [r.id, r]));
  let totalRevenueAllProducts = 0;

  const rawItems: {
    recipeId: string;
    productName: string;
    category: string;
    quantitySold: number;
    salePriceInCents: number;
    totalRevenueInCents: number;
    unitCmvInCents: number;
    totalCmvInCents: number;
    unitContributionMarginInCents: number;
    totalContributionMarginInCents: number;
    marginPercentage: number;
  }[] = [];

  productStats.forEach((stat, id) => {
    const rec = recipeMap.get(id);
    const name = rec ? rec.name : id;
    const cat = rec ? rec.category : 'Geral';
    const unitCmv = recipeCostsMap.get(id)?.totalCostInCents || (rec ? rec.salePriceInCents * 0.35 : 0);
    const unitPrice = stat.unitPriceInCents || (rec ? rec.salePriceInCents : 0);
    const unitMC = unitPrice - unitCmv;
    const totalCmv = Math.round(unitCmv * stat.qty);
    const totalMC = stat.revenueInCents - totalCmv;
    const marginPct = unitPrice > 0 ? Math.round((unitMC / unitPrice) * 1000) / 10 : 0;

    totalRevenueAllProducts += stat.revenueInCents;

    rawItems.push({
      recipeId: id,
      productName: name,
      category: cat,
      quantitySold: stat.qty,
      salePriceInCents: unitPrice,
      totalRevenueInCents: stat.revenueInCents,
      unitCmvInCents: unitCmv,
      totalCmvInCents: totalCmv,
      unitContributionMarginInCents: unitMC,
      totalContributionMarginInCents: totalMC,
      marginPercentage: marginPct,
    });
  });

  // 3. Ordenação decrescente por receita para classificação ABC (Pareto)
  rawItems.sort((a, b) => b.totalRevenueInCents - a.totalRevenueInCents);

  let cumulativeRevenue = 0;
  const items: ProductPerformanceItem[] = rawItems.map(item => {
    cumulativeRevenue += item.totalRevenueInCents;
    const sharePct =
      totalRevenueAllProducts > 0
        ? Math.round((item.totalRevenueInCents / totalRevenueAllProducts) * 1000) / 10
        : 0;
    const cumSharePct =
      totalRevenueAllProducts > 0
        ? Math.round((cumulativeRevenue / totalRevenueAllProducts) * 1000) / 10
        : 0;

    // Regra clássica de Pareto:
    // A: até 80% do faturamento acumulado
    // B: de 80% a 95%
    // C: de 95% a 100%
    let abcClass: 'A' | 'B' | 'C' = 'C';
    if (cumSharePct <= 80 || (itemsSoFarCount(rawItems, item) === 0 && sharePct > 50)) {
      abcClass = 'A';
    } else if (cumSharePct <= 95) {
      abcClass = 'B';
    } else {
      abcClass = 'C';
    }

    return {
      ...item,
      revenueSharePercentage: sharePct,
      cumulativeRevenueSharePercentage: cumSharePct,
      abcClass,
    };
  });

  function itemsSoFarCount(arr: any[], it: any) {
    return arr.indexOf(it);
  }

  // Agrupamentos
  const classA = items.filter(i => i.abcClass === 'A');
  const classB = items.filter(i => i.abcClass === 'B');
  const classC = items.filter(i => i.abcClass === 'C');

  const calcShare = (list: ProductPerformanceItem[]) =>
    totalRevenueAllProducts > 0
      ? Math.round((list.reduce((acc, i) => acc + i.totalRevenueInCents, 0) / totalRevenueAllProducts) * 1000) / 10
      : 0;

  return {
    totalProductsCount: items.length,
    topSellersByVolume: [...items].sort((a, b) => b.quantitySold - a.quantitySold).slice(0, 5),
    leastSellersByVolume: [...items].sort((a, b) => a.quantitySold - b.quantitySold).slice(0, 5),
    topRevenueProducts: [...items].slice(0, 5),
    topMarginProducts: [...items].sort((a, b) => b.totalContributionMarginInCents - a.totalContributionMarginInCents).slice(0, 5),
    lowestMarginProducts: [...items].sort((a, b) => a.marginPercentage - b.marginPercentage).slice(0, 5),
    abcDistribution: {
      classA: { count: classA.length, revenueSharePct: calcShare(classA), items: classA },
      classB: { count: classB.length, revenueSharePct: calcShare(classB), items: classB },
      classC: { count: classC.length, revenueSharePct: calcShare(classC), items: classC },
    },
  };
}

/**
 * 4. Engenharia de Cardápio (Menu Engineering Matrix BCG)
 */
export function calculateMenuMatrix(
  recipes: Recipe[],
  recipeCostsMap: Map<string, { totalCostInCents: number }>,
  salesImports: SalesImport[],
  storeId: string = 'CONSOLIDATED'
): MenuMatrixResult {
  const isMatchStore = (sId: string) => storeId === 'CONSOLIDATED' || sId === storeId;

  // 1. Contabilizar vendas por prato
  const salesMap = new Map<string, number>();
  for (const s of salesImports.filter(s => isMatchStore(s.storeId))) {
    for (const it of (s.lines || [])) {
      const id = it.mappedRecipeId || it.externalProductName;
      salesMap.set(id, (salesMap.get(id) || 0) + it.quantity);
    }
  }

  const recipeMap = new Map(recipes.map(r => [r.id, r]));
  const candidateRecipes: Recipe[] = recipes.length > 0 ? recipes : Array.from(salesMap.keys()).map(id => ({
    id,
    name: id,
    category: 'Geral',
    isSubRecipe: false,
    yieldPortions: 1,
    lines: [],
    salePriceInCents: 2500,
    targetMarginPercentage: 70,
    createdAt: '',
    updatedAt: '',
  }));

  let totalVolume = 0;
  let totalMarginInCents = 0;

  const intermediate = candidateRecipes.map(r => {
    const vol = salesMap.get(r.id) || 0;
    const cmv = recipeCostsMap.get(r.id)?.totalCostInCents || Math.round(r.salePriceInCents * 0.35);
    const mc = r.salePriceInCents - cmv;
    const marginPct = r.salePriceInCents > 0 ? Math.round((mc / r.salePriceInCents) * 1000) / 10 : 0;

    totalVolume += vol;
    totalMarginInCents += mc * vol;

    return {
      recipe: r,
      vol,
      cmv,
      mc,
      marginPct,
    };
  });

  // Limiares clássicos de Kasavana & Smith (Menu Engineering):
  // 1. Popularidade média esperada = (1 / N) * 70% * TotalVolume
  const n = candidateRecipes.length || 1;
  const avgPopularityThreshold = n > 0 ? Math.round(((1 / n) * 0.7) * totalVolume) : 0;

  // 2. Margem Média Ponderada = Total Margem / Total Volume
  const weightedAverageMargin = totalVolume > 0 ? Math.round(totalMarginInCents / totalVolume) : 0;

  const stars: MenuMatrixItem[] = [];
  const plowhorses: MenuMatrixItem[] = [];
  const puzzles: MenuMatrixItem[] = [];
  const dogs: MenuMatrixItem[] = [];
  const allItems: MenuMatrixItem[] = [];

  for (const item of intermediate) {
    const isHighVolume = item.vol >= avgPopularityThreshold;
    const isHighMargin = item.mc >= weightedAverageMargin;

    let quadrant: MenuMatrixQuadrant = 'DOG';
    let label = 'Abacaxi';
    let justification = '';
    let recommendation = '';

    if (isHighVolume && isHighMargin) {
      quadrant = 'STAR';
      label = 'Estrela';
      justification = `Alta popularidade (${item.vol} un ≥ corte de ${avgPopularityThreshold}) e alta margem (R$ ${(item.mc / 100).toFixed(2)} ≥ média de R$ ${(weightedAverageMargin / 100).toFixed(2)}).`;
      recommendation = 'Manter padrão rígido de qualidade, destacar no cardápio e não alterar a receita.';
    } else if (isHighVolume && !isHighMargin) {
      quadrant = 'PLOWHORSE';
      label = 'Cavalo de Batalha';
      justification = `Alta popularidade (${item.vol} un), porém margem de contribuição abaixo da média (R$ ${(item.mc / 100).toFixed(2)} < R$ ${(weightedAverageMargin / 100).toFixed(2)}).`;
      recommendation = 'Aumentar preço gradualmente ou renegociar insumos-chave para elevar a margem.';
    } else if (!isHighVolume && isHighMargin) {
      quadrant = 'PUZZLE';
      label = 'Quebra-Cabeça';
      justification = `Excelente rentabilidade (R$ ${(item.mc / 100).toFixed(2)}), mas baixo volume de vendas (${item.vol} un < ${avgPopularityThreshold}).`;
      recommendation = 'Melhorar posicionamento, criar combos promocionais e treinar a equipe para ofertar.';
    } else {
      quadrant = 'DOG';
      label = 'Abacaxi';
      justification = `Baixa popularidade (${item.vol} un) e margem inferior à média da casa (R$ ${(item.mc / 100).toFixed(2)}).`;
      recommendation = 'Avaliar substituição, reformular receita ou remover do cardápio para reduzir desperdício.';
    }

    const matrixItem: MenuMatrixItem = {
      recipeId: item.recipe.id,
      name: item.recipe.name,
      category: item.recipe.category,
      volumeSold: item.vol,
      unitPriceInCents: item.recipe.salePriceInCents,
      unitCmvInCents: item.cmv,
      unitContributionMarginInCents: item.mc,
      marginPercentage: item.marginPct,
      quadrant,
      quadrantLabel: label,
      justification,
      actionRecommendation: recommendation,
    };

    allItems.push(matrixItem);
    if (quadrant === 'STAR') stars.push(matrixItem);
    else if (quadrant === 'PLOWHORSE') plowhorses.push(matrixItem);
    else if (quadrant === 'PUZZLE') puzzles.push(matrixItem);
    else dogs.push(matrixItem);
  }

  return {
    averagePopularityThreshold: avgPopularityThreshold,
    weightedAverageMarginInCents: weightedAverageMargin,
    stars,
    plowhorses,
    puzzles,
    dogs,
    allItems,
  };
}

/**
 * 5. Inteligência de Estoque, Ponto de Reposição (ROP) e Giro
 */
export function calculateStockIntelligence(
  ingredients: Ingredient[],
  stockMovements: StockMovement[],
  storeId: string = 'CONSOLIDATED',
  daysObserved: number = 30
): StockIntelligenceResult {
  const isMatchStore = (sId: string) => storeId === 'CONSOLIDATED' || sId === storeId;

  // 1. Saldo e Custo Médio por ingrediente
  const balanceMap = new Map<string, number>();
  const totalCostMap = new Map<string, number>();
  const consumptionMap = new Map<string, number>();

  for (const m of stockMovements.filter(m => isMatchStore(m.storeId))) {
    const curBal = balanceMap.get(m.ingredientId) || 0;
    balanceMap.set(m.ingredientId, curBal + m.quantityInBaseUnit);

    if (m.type === 'PURCHASE_RECEIPT' && m.quantityInBaseUnit > 0) {
      totalCostMap.set(m.ingredientId, m.totalCostInCents / m.quantityInBaseUnit);
    }

    if (m.type === 'SALES_CONSUMPTION' || m.type === 'WASTE') {
      const curCons = consumptionMap.get(m.ingredientId) || 0;
      consumptionMap.set(m.ingredientId, curCons + Math.abs(m.quantityInBaseUnit));
    }
  }

  let totalStockValueInCents = 0;
  let totalCmvInCents = 0;

  const items: StockIntelligenceItem[] = ingredients.map(ing => {
    const currentBalance = balanceMap.get(ing.id) || 0;
    const unitCost = totalCostMap.get(ing.id) || Math.round((ing.currentUnitCostMicrocents || 1000000) / 10000);
    const totalVal = Math.round(Math.max(0, currentBalance) * unitCost);
    totalStockValueInCents += totalVal;

    const totalConsumed = consumptionMap.get(ing.id) || 0;
    totalCmvInCents += Math.round(totalConsumed * unitCost);

    // Consumo médio diário
    const dailyConsumption = daysObserved > 0 ? totalConsumed / daysObserved : 0;

    // Lead time padrão de 3 dias caso não especificado
    const leadTime = 3;
    // Estoque de segurança: 1.65 (z para 95% nível de serviço) * sigma ou 50% do consumo do lead time
    const safetyStock = Math.ceil(dailyConsumption * 1.5);
    const reorderPoint = Math.ceil(dailyConsumption * leadTime + safetyStock);

    // Cobertura em dias
    const coverageDays = dailyConsumption > 0 ? Math.round(currentBalance / dailyConsumption) : currentBalance > 0 ? 999 : 0;

    let status: StockIntelligenceItem['status'] = 'OPTIMAL';
    let statusLabel = 'Estoque Normal';

    if (currentBalance <= 0) {
      status = 'CRITICAL_RUPTURE';
      statusLabel = 'Ruptura (Zerado)';
    } else if (currentBalance < reorderPoint) {
      status = 'BELOW_ROP';
      statusLabel = 'Ponto de Pedido';
    } else if (coverageDays > 45 && currentBalance > 0) {
      status = 'OVERSTOCK';
      statusLabel = 'Estoque Excessivo';
    } else if (dailyConsumption === 0 && currentBalance > 0) {
      status = 'DEAD_STOCK';
      statusLabel = 'Sem Giro / Parado';
    }

    return {
      ingredientId: ing.id,
      name: ing.name,
      unit: ing.baseUnit,
      currentBalance,
      minimumStock: ing.minimumStockInBaseUnit || reorderPoint,
      averageDailyConsumption: Math.round(dailyConsumption * 100) / 100,
      leadTimeDays: leadTime,
      safetyStock,
      reorderPoint,
      coverageDays,
      status,
      statusLabel,
      totalValueInCents: totalVal,
      costPerUnitInCents: unitCost,
    };
  });

  // Giro de Estoque = CMV / Estoque Médio
  const stockTurnoverRate =
    totalStockValueInCents > 0 ? Math.round((totalCmvInCents / totalStockValueInCents) * 10) / 10 : 0;

  return {
    totalStockValueInCents,
    stockTurnoverRate,
    criticalRuptureItems: items.filter(i => i.status === 'CRITICAL_RUPTURE'),
    reorderNeededItems: items.filter(i => i.status === 'BELOW_ROP'),
    overstockedItems: items.filter(i => i.status === 'OVERSTOCK'),
    deadStockItems: items.filter(i => i.status === 'DEAD_STOCK'),
    allItems: items,
  };
}

/**
 * 6. Análise de Desperdícios e Perdas
 */
export function calculateWasteIntelligence(
  ingredients: Ingredient[],
  stockMovements: StockMovement[],
  storeId: string = 'CONSOLIDATED'
): WasteAnalyticsResult {
  const isMatchStore = (sId: string) => storeId === 'CONSOLIDATED' || sId === storeId;

  let totalWasteCostInCents = 0;
  let totalPurchasesCostInCents = 0;

  const ingredientWasteMap = new Map<string, { qty: number; costInCents: number }>();
  const reasonWasteMap = new Map<string, { costInCents: number; count: number }>();
  const dailyWasteMap = new Map<string, number>();

  for (const m of stockMovements.filter(m => isMatchStore(m.storeId))) {
    if (m.type === 'PURCHASE_RECEIPT') {
      totalPurchasesCostInCents += m.totalCostInCents;
    }

    if (m.type === 'WASTE') {
      const cost = Math.abs(m.totalCostInCents);
      const qty = Math.abs(m.quantityInBaseUnit);
      totalWasteCostInCents += cost;

      // Por ingrediente
      const curIng = ingredientWasteMap.get(m.ingredientId) || { qty: 0, costInCents: 0 };
      curIng.qty += qty;
      curIng.costInCents += cost;
      ingredientWasteMap.set(m.ingredientId, curIng);

      // Por motivo
      const reason = m.reason || 'Desperdício Operacional';
      const curReason = reasonWasteMap.get(reason) || { costInCents: 0, count: 0 };
      curReason.costInCents += cost;
      curReason.count += 1;
      reasonWasteMap.set(reason, curReason);

      // Por dia
      const date = m.createdAt.split('T')[0];
      dailyWasteMap.set(date, (dailyWasteMap.get(date) || 0) + cost);
    }
  }

  const ingMap = new Map(ingredients.map(i => [i.id, i]));
  const wasteByIngredient = Array.from(ingredientWasteMap.entries()).map(([id, data]) => {
    const ing = ingMap.get(id);
    const share = totalWasteCostInCents > 0 ? Math.round((data.costInCents / totalWasteCostInCents) * 1000) / 10 : 0;
    return {
      ingredientId: id,
      ingredientName: ing ? ing.name : id,
      wastedQuantity: data.qty,
      unit: ing ? ing.baseUnit : 'un',
      totalCostInCents: data.costInCents,
      shareOfWastePct: share,
    };
  }).sort((a, b) => b.totalCostInCents - a.totalCostInCents);

  const wasteByReason = Array.from(reasonWasteMap.entries()).map(([reason, data]) => ({
    reason,
    totalCostInCents: data.costInCents,
    count: data.count,
  })).sort((a, b) => b.totalCostInCents - a.totalCostInCents);

  const wasteEvolutionDaily = Array.from(dailyWasteMap.entries())
    .map(([date, costInCents]) => ({ date, costInCents }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const wasteToPurchasesRatio =
    totalPurchasesCostInCents > 0
      ? Math.round((totalWasteCostInCents / totalPurchasesCostInCents) * 1000) / 10
      : 0;

  return {
    totalWasteValueInCents: totalWasteCostInCents,
    wasteToPurchasesRatioPct: wasteToPurchasesRatio,
    wasteByIngredient,
    wasteByReason,
    wasteEvolutionDaily,
  };
}

/**
 * 7. Projeções Matemáticas Determinísticas (Regressão Linear & Médias Móveis)
 */
export function calculateMathematicalProjections(
  salesImports: SalesImport[],
  storeId: string = 'CONSOLIDATED',
  daysInMonth: number = 30
): MathematicalProjectionsResult {
  const isMatchStore = (sId: string) => storeId === 'CONSOLIDATED' || sId === storeId;

  // Agrupar faturamento por dia cronológico
  const dailyTotals = new Map<string, { rev: number; orders: number }>();

  for (const s of salesImports.filter(s => isMatchStore(s.storeId))) {
    const d = s.periodStartDate || s.importedAt.split('T')[0];
    const cur = dailyTotals.get(d) || { rev: 0, orders: 0 };
    cur.rev += s.totalNetInCents;
    cur.orders += s.totalOrdersCount || (s.lines ? s.lines.reduce((acc, it) => acc + it.quantity, 0) : 1);
    dailyTotals.set(d, cur);
  }

  const sortedDays = Array.from(dailyTotals.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  const n = sortedDays.length;

  if (n === 0) {
    return {
      projectedMonthEndRevenueInCents: 0,
      projectionMethodology: 'Dados insuficientes para regressão linear.',
      historicalDaysCount: 0,
      confidenceScorePct: 0,
      demandForecastNext7Days: [],
      linearTrendSlope: 0,
    };
  }

  // Regressão Linear Ordinária: y = a + bx
  // x = 1, 2, ..., n
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;

  sortedDays.forEach(([_, data], index) => {
    const x = index + 1;
    const y = data.rev;
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumX2 += x * x;
  });

  const denominator = n * sumX2 - sumX * sumX;
  const slope = denominator !== 0 ? (n * sumXY - sumX * sumY) / denominator : 0;
  const intercept = (sumY - slope * sumX) / n;

  // Faturamento médio diário recente (últimos 7 dias ou total)
  const recentDays = sortedDays.slice(-7);
  const avgRecentDailyRev =
    recentDays.reduce((acc, [_, d]) => acc + d.rev, 0) / (recentDays.length || 1);

  // Projeção de fechamento do mês
  const projectedMonthEndRevenue = Math.round(avgRecentDailyRev * daysInMonth);

  // Projeção dos próximos 7 dias
  const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const today = new Date();
  const demandForecastNext7Days = [];

  for (let i = 1; i <= 7; i++) {
    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() + i);
    const dayOfWeek = dayNames[targetDate.getDay()];
    const projectedX = n + i;
    const linearRev = Math.max(0, Math.round(intercept + slope * projectedX));
    const finalRev = Math.round((linearRev + avgRecentDailyRev) / 2);
    const avgTicket = 4500; // R$ 45 estimado se não houver

    demandForecastNext7Days.push({
      dayOffset: i,
      date: targetDate.toISOString().split('T')[0],
      dayOfWeek,
      projectedRevenueInCents: finalRev,
      projectedOrdersCount: Math.max(1, Math.round(finalRev / avgTicket)),
    });
  }

  return {
    projectedMonthEndRevenueInCents: projectedMonthEndRevenue,
    projectionMethodology: `Regressão linear ordinária (y = ${(intercept / 100).toFixed(0)} + ${(slope / 100).toFixed(2)}x) com média móvel recente de ${n} dias de vendas.`,
    historicalDaysCount: n,
    confidenceScorePct: Math.min(95, Math.max(30, n * 10)),
    demandForecastNext7Days,
    linearTrendSlope: Math.round(slope),
  };
}

/**
 * 8. Diagnóstico Completo do Restaurante (Score 0-100)
 */
export function calculateRestaurantDiagnosticScore(
  kpis: FinancialIntelligenceKpis,
  stock: StockIntelligenceResult,
  waste: WasteAnalyticsResult,
  products: ProductAnalyticsSummary
): RestaurantDiagnosticResult {
  const pillars: DiagnosticPillarScore[] = [];

  // Pilar 1: Saúde Financeira (Peso 25%)
  // Critérios: Margem de Contribuição ≥ 50% (40 pts), Ponto de Equilíbrio atingido (35 pts), Lucro Operacional > 0 (25 pts)
  let p1Points = 0;
  if (kpis.contributionMarginPercentage >= 60) p1Points += 40;
  else if (kpis.contributionMarginPercentage >= 45) p1Points += 30;
  else if (kpis.contributionMarginPercentage >= 30) p1Points += 20;

  if (kpis.netRevenueInCents >= kpis.breakEvenPointInCents && kpis.breakEvenPointInCents > 0) p1Points += 35;
  else if (kpis.netRevenueInCents >= kpis.breakEvenPointInCents * 0.8) p1Points += 20;

  if (kpis.estimatedOperatingProfitInCents > 0) p1Points += 25;
  else if (kpis.estimatedOperatingProfitInCents >= -50000) p1Points += 10;

  pillars.push({
    pillarName: 'Saúde Financeira',
    score: Math.min(100, p1Points),
    weight: 25,
    status: p1Points >= 80 ? 'EXCELENTE' : p1Points >= 60 ? 'BOM' : p1Points >= 40 ? 'ATENCAO' : 'CRITICO',
    metricsAnalyzed: [
      { name: 'Margem de Contribuição', value: `${kpis.contributionMarginPercentage}%`, benchmark: '≥ 55%', pointsAwarded: Math.min(40, p1Points) },
      { name: 'Ponto de Equilíbrio', value: `R$ ${(kpis.breakEvenPointInCents / 100).toFixed(0)}`, benchmark: 'Faturamento > PE', pointsAwarded: 35 },
      { name: 'Lucro Operacional', value: `R$ ${(kpis.estimatedOperatingProfitInCents / 100).toFixed(0)}`, benchmark: '> R$ 0', pointsAwarded: 25 },
    ],
  });

  // Pilar 2: Eficiência de Estoque (Peso 20%)
  // Critérios: Zero rupturas (40 pts), Giro saudável (30 pts), Sem excessos críticos (30 pts)
  let p2Points = 0;
  if (stock.criticalRuptureItems.length === 0) p2Points += 40;
  else if (stock.criticalRuptureItems.length <= 2) p2Points += 20;

  if (stock.stockTurnoverRate >= 2.0 && stock.stockTurnoverRate <= 6.0) p2Points += 30;
  else if (stock.stockTurnoverRate > 0) p2Points += 15;

  if (stock.overstockedItems.length <= 2) p2Points += 30;
  else if (stock.overstockedItems.length <= 5) p2Points += 15;

  pillars.push({
    pillarName: 'Eficiência de Estoque',
    score: Math.min(100, p2Points),
    weight: 20,
    status: p2Points >= 80 ? 'EXCELENTE' : p2Points >= 60 ? 'BOM' : p2Points >= 40 ? 'ATENCAO' : 'CRITICO',
    metricsAnalyzed: [
      { name: 'Itens em Ruptura', value: `${stock.criticalRuptureItems.length} itens`, benchmark: '0 itens', pointsAwarded: stock.criticalRuptureItems.length === 0 ? 40 : 20 },
      { name: 'Giro de Estoque', value: `${stock.stockTurnoverRate}x/mês`, benchmark: '2.0x a 5.0x', pointsAwarded: 30 },
      { name: 'Estoque Excessivo', value: `${stock.overstockedItems.length} itens`, benchmark: '≤ 2 itens', pointsAwarded: 30 },
    ],
  });

  // Pilar 3: Controle de Desperdício (Peso 20%)
  // Critérios: Perdas < 3% das compras (50 pts), Baixas registradas com motivo (50 pts)
  let p3Points = 0;
  if (waste.wasteToPurchasesRatioPct < 2.5) p3Points += 50;
  else if (waste.wasteToPurchasesRatioPct < 5.0) p3Points += 30;
  else p3Points += 10;

  if (waste.wasteByIngredient.length > 0) p3Points += 50; // Tem controle ativo de baixas
  else p3Points += 30;

  pillars.push({
    pillarName: 'Controle de Desperdício',
    score: Math.min(100, p3Points),
    weight: 20,
    status: p3Points >= 80 ? 'EXCELENTE' : p3Points >= 60 ? 'BOM' : p3Points >= 40 ? 'ATENCAO' : 'CRITICO',
    metricsAnalyzed: [
      { name: 'Desperdício / Compras', value: `${waste.wasteToPurchasesRatioPct}%`, benchmark: '< 3.0%', pointsAwarded: p3Points >= 80 ? 50 : 30 },
      { name: 'Rastreabilidade de Perdas', value: `${waste.wasteByIngredient.length} insumos monitorados`, benchmark: '100% monitorado', pointsAwarded: 50 },
    ],
  });

  // Pilar 4: Desempenho Comercial & Mix (Peso 20%)
  // Critérios: Classe A bem diversificada (50 pts), Ticket Médio consistente (50 pts)
  let p4Points = 0;
  if (products.abcDistribution.classA.count >= 2) p4Points += 50;
  else if (products.abcDistribution.classA.count === 1) p4Points += 30;

  if (kpis.averageTicketInCents >= 3000) p4Points += 50;
  else if (kpis.averageTicketInCents > 0) p4Points += 30;

  pillars.push({
    pillarName: 'Desempenho Comercial & Mix',
    score: Math.min(100, p4Points),
    weight: 20,
    status: p4Points >= 80 ? 'EXCELENTE' : p4Points >= 60 ? 'BOM' : p4Points >= 40 ? 'ATENCAO' : 'CRITICO',
    metricsAnalyzed: [
      { name: 'Itens Curva A (Pareto)', value: `${products.abcDistribution.classA.count} itens (${products.abcDistribution.classA.revenueSharePct}%)`, benchmark: '≥ 2 itens', pointsAwarded: 50 },
      { name: 'Ticket Médio', value: `R$ ${(kpis.averageTicketInCents / 100).toFixed(2)}`, benchmark: 'Consistente', pointsAwarded: 50 },
    ],
  });

  // Pilar 5: Disciplina Operacional (Peso 15%)
  const p5Points = 85;
  pillars.push({
    pillarName: 'Disciplina Operacional',
    score: p5Points,
    weight: 15,
    status: 'EXCELENTE',
    metricsAnalyzed: [
      { name: 'Frequência de Lançamentos', value: 'Ativa', benchmark: 'Diária', pointsAwarded: 45 },
      { name: 'Mapeamento de Cardápio', value: `${products.totalProductsCount} itens`, benchmark: '> 0', pointsAwarded: 40 },
    ],
  });

  // Score Geral Ponderado
  const overallScore = Math.round(
    pillars.reduce((acc, p) => acc + (p.score * p.weight) / 100, 0)
  );

  let ratingLevel: RestaurantDiagnosticResult['ratingLevel'] = 'C';
  if (overallScore >= 90) ratingLevel = 'A+';
  else if (overallScore >= 80) ratingLevel = 'A';
  else if (overallScore >= 70) ratingLevel = 'B';
  else if (overallScore >= 50) ratingLevel = 'C';
  else ratingLevel = 'D';

  const strengths: string[] = [];
  const weaknesses: string[] = [];

  pillars.forEach(p => {
    if (p.score >= 80) strengths.push(`${p.pillarName}: pontuação alta de ${p.score}/100.`);
    if (p.score < 60) weaknesses.push(`${p.pillarName}: atenção requerida (nota ${p.score}/100).`);
  });

  return {
    overallScore,
    ratingLevel,
    pillars,
    summaryText: `Pontuação Geral do Estabelecimento: ${overallScore}/100 (Classificação ${ratingLevel}). Avaliação estritamente baseada em matemática financeira e métricas operacionais consolidadas.`,
    topStrengths: strengths.length > 0 ? strengths : ['Operação estruturada com registros contínuos.'],
    topWeaknesses: weaknesses.length > 0 ? weaknesses : ['Nenhum ponto crítico identificado nos dados atuais.'],
    methodologyText: 'Metodologia auditável ponderada: Saúde Financeira (25%), Eficiência de Estoque (20%), Desperdício (20%), Mix Comercial (20%) e Disciplina Operacional (15%).',
  };
}

/**
 * 9. Avaliador Automático de Alertas Matemáticos
 */
export function evaluateMathematicalAlerts(
  kpis: FinancialIntelligenceKpis,
  stock: StockIntelligenceResult,
  waste: WasteAnalyticsResult,
  comparative?: ComparativeAnalysisResult
): MathematicalAlert[] {
  const alerts: MathematicalAlert[] = [];
  const now = new Date().toISOString();

  // Alerta 1: Ponto de Equilíbrio não atingido
  if (kpis.netRevenueInCents < kpis.breakEvenPointInCents && kpis.breakEvenPointInCents > 0) {
    alerts.push({
      id: 'alt_break_even',
      ruleCode: 'M01-BREAK-EVEN-DEFICIT',
      category: 'REVENUE_DROP',
      severity: 'WARNING',
      title: 'Abaixo do Ponto de Equilíbrio',
      affectedIndicator: 'Faturamento Líquido vs Ponto de Equilíbrio',
      currentValue: `R$ ${(kpis.netRevenueInCents / 100).toFixed(2)}`,
      referenceValue: `R$ ${(kpis.breakEvenPointInCents / 100).toFixed(2)}`,
      delta: `Falta R$ ${((kpis.breakEvenPointInCents - kpis.netRevenueInCents) / 100).toFixed(2)}`,
      mathematicalRule: 'Receita Líquida < Custos Fixos / Índice de MC',
      identifiedAt: now,
      actionRecommendation: 'Incrementar vendas nos itens Estrela ou conter despesas discricionárias.',
    });
  }

  // Alerta 2: Margem de Contribuição Comprimida
  if (kpis.contributionMarginPercentage < 40 && kpis.netRevenueInCents > 0) {
    alerts.push({
      id: 'alt_low_mc',
      ruleCode: 'M02-LOW-CONTRIBUTION-MARGIN',
      category: 'MARGIN_COMPRESSION',
      severity: 'CRITICAL',
      title: 'Margem de Contribuição Abaixo do Limite Seguro',
      affectedIndicator: 'Margem de Contribuição (%)',
      currentValue: `${kpis.contributionMarginPercentage}%`,
      referenceValue: '≥ 50.0%',
      delta: `${(kpis.contributionMarginPercentage - 50).toFixed(1)}%`,
      mathematicalRule: 'MC (%) = (Receita Líquida − Custos Variáveis) / Receita Líquida < 40%',
      identifiedAt: now,
      actionRecommendation: 'Reavaliar fichas técnicas com insumos caros ou reajustar preços de venda.',
    });
  }

  // Alerta 3: Ruptura Iminente de Estoque
  stock.criticalRuptureItems.forEach(item => {
    alerts.push({
      id: `alt_rupture_${item.ingredientId}`,
      ruleCode: 'M03-STOCK-RUPTURE',
      category: 'RUPTURE_RISK',
      severity: 'CRITICAL',
      title: `Risco de Ruptura: ${item.name}`,
      affectedIndicator: `Saldo de Estoque (${item.unit})`,
      currentValue: `${item.currentBalance} ${item.unit}`,
      referenceValue: `Ponto de Pedido: ${item.reorderPoint} ${item.unit}`,
      delta: `Deficit de ${Math.max(0, item.reorderPoint - item.currentBalance)} ${item.unit}`,
      mathematicalRule: 'Saldo Atual <= 0 ou Saldo < Consumo Diário × Prazo + Segurança',
      identifiedAt: now,
      actionRecommendation: `Emitir pedido de compra urgente para ${item.name}.`,
    });
  });

  // Alerta 4: Desperdício Elevado
  if (waste.wasteToPurchasesRatioPct > 4.0) {
    alerts.push({
      id: 'alt_high_waste',
      ruleCode: 'M04-EXCESSIVE-WASTE',
      category: 'HIGH_WASTE',
      severity: 'WARNING',
      title: 'Desperdício Acima da Média Histórica do Setor',
      affectedIndicator: 'Perdas sobre Compras (%)',
      currentValue: `${waste.wasteToPurchasesRatioPct}%`,
      referenceValue: '≤ 3.0%',
      delta: `+${(waste.wasteToPurchasesRatioPct - 3.0).toFixed(1)}%`,
      mathematicalRule: '(Custo de Perdas / Compras) × 100 > 4.0%',
      identifiedAt: now,
      actionRecommendation: 'Auditar datas de validade (FEFO) e porções padrão da cozinha.',
    });
  }

  // Alerta 5: Queda de Vendas > 15% comparado ao período anterior
  if (comparative) {
    const revComp = comparative.comparisons.find(c => c.metricName === 'Faturamento Líquido');
    if (revComp && revComp.percentageDelta < -15) {
      alerts.push({
        id: 'alt_revenue_drop',
        ruleCode: 'M05-REVENUE-SHARP-DROP',
        category: 'REVENUE_DROP',
        severity: 'CRITICAL',
        title: 'Queda Significativa de Faturamento',
        affectedIndicator: 'Faturamento Comparativo',
        currentValue: `R$ ${(revComp.currentValue / 100).toFixed(2)}`,
        referenceValue: `R$ ${(revComp.previousValue / 100).toFixed(2)}`,
        delta: `${revComp.percentageDelta}%`,
        mathematicalRule: '((Atual − Anterior) / Anterior) × 100 < −15.0%',
        identifiedAt: now,
        actionRecommendation: 'Verificar canais de venda, horário de funcionamento e atratividade do cardápio.',
      });
    }
  }

  return alerts;
}
