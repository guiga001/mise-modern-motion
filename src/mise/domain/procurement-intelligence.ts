/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Mise — F17 Lista de Compras Otimizada, F18 Custo Efetivo de Prazo,
 * F19 Preço Fora da Curva, F20 Orçamento de Compras
 * Invariante: Zero IA/ML. Matemática determinística, algoritmos gulosos estáveis e estatística robusta.
 */

import { DomainExplanation } from './insights-types';
import { Ingredient, Supplier } from './types';

// -------------------------------------------------------------
// F17: Lista de Compras Otimizada
// -------------------------------------------------------------

export interface ProcurementItemRequest {
  ingredientId: string;
  ingredientName: string;
  baseUnit: string;
  supplierId?: string;
  supplierName?: string;
  meanDailyDemand: number;
  safetyStock: number;
  currentBalance: number;
  openOrdersQuantity: number;
  packageSizeInBaseUnit: number;
  unitPriceInCents: number;
  leadTimeDays: number;
  reviewCycleDays: number;
}

export interface SuggestedPurchaseItem {
  ingredientId: string;
  ingredientName: string;
  baseUnit: string;
  supplierId: string;
  supplierName: string;
  rawNetNeed: number;
  packagesCount: number;
  suggestedQuantity: number;
  totalCostInCents: number;
  coverageInDays: number;
}

export interface OptimizedProcurementPlan {
  supplierId: string;
  supplierName: string;
  minimumOrderInCents: number;
  initialTotalCostInCents: number;
  finalTotalCostInCents: number;
  meetsMinimumOrder: boolean;
  wasGreedyFilled: boolean;
  items: SuggestedPurchaseItem[];
  explanation: DomainExplanation;
}

export function generateOptimizedProcurementPlan(
  supplier: Supplier,
  items: ProcurementItemRequest[],
  minimumOrderInCents: number = 0
): OptimizedProcurementPlan {
  const suggestedItems: SuggestedPurchaseItem[] = [];

  for (const item of items) {
    const horizon = item.leadTimeDays + item.reviewCycleDays;
    const projectedDemand = item.meanDailyDemand * horizon;
    const rawNetNeed = Math.max(0, projectedDemand + item.safetyStock - item.currentBalance - item.openOrdersQuantity);

    const packSize = Math.max(1, item.packageSizeInBaseUnit);
    const packagesCount = rawNetNeed > 0 ? Math.ceil(rawNetNeed / packSize) : 0;
    const suggestedQty = packagesCount * packSize;
    const totalCost = Math.round((suggestedQty * item.unitPriceInCents) / packSize);

    const coverage = item.meanDailyDemand > 0 ? (item.currentBalance + suggestedQty) / item.meanDailyDemand : 999;

    suggestedItems.push({
      ingredientId: item.ingredientId,
      ingredientName: item.ingredientName,
      baseUnit: item.baseUnit,
      supplierId: supplier.id,
      supplierName: supplier.name,
      rawNetNeed: Math.round(rawNetNeed * 100) / 100,
      packagesCount,
      suggestedQuantity: suggestedQty,
      totalCostInCents: totalCost,
      coverageInDays: Math.round(coverage * 10) / 10,
    });
  }

  // Ordenação estável independente da ordem de entrada
  suggestedItems.sort((a, b) => a.ingredientName.localeCompare(b.ingredientName));

  const initialTotalCost = suggestedItems.reduce((sum, i) => sum + i.totalCostInCents, 0);
  let finalTotalCost = initialTotalCost;
  let wasGreedyFilled = false;

  // Se o total é menor que o pedido mínimo do fornecedor, complementa de forma gulosa
  // priorizando os insumos de menor cobertura
  if (finalTotalCost > 0 && finalTotalCost < minimumOrderInCents) {
    const sortedByCoverage = [...suggestedItems].sort((a, b) => a.coverageInDays - b.coverageInDays);

    let idx = 0;
    while (finalTotalCost < minimumOrderInCents && idx < sortedByCoverage.length * 5) {
      const candidate = sortedByCoverage[idx % sortedByCoverage.length];
      const origItem = items.find(i => i.ingredientId === candidate.ingredientId);
      if (origItem) {
        const packSize = Math.max(1, origItem.packageSizeInBaseUnit);
        const packCost = origItem.unitPriceInCents;

        candidate.packagesCount += 1;
        candidate.suggestedQuantity += packSize;
        candidate.totalCostInCents += packCost;
        finalTotalCost += packCost;
        candidate.coverageInDays = origItem.meanDailyDemand > 0
          ? Math.round(((origItem.currentBalance + candidate.suggestedQuantity) / origItem.meanDailyDemand) * 10) / 10
          : 999;
        wasGreedyFilled = true;
      }
      idx++;
    }
  }

  return {
    supplierId: supplier.id,
    supplierName: supplier.name,
    minimumOrderInCents,
    initialTotalCostInCents: initialTotalCost,
    finalTotalCostInCents: finalTotalCost,
    meetsMinimumOrder: finalTotalCost >= minimumOrderInCents,
    wasGreedyFilled,
    items: suggestedItems,
    explanation: {
      valor: `R$ ${(finalTotalCost / 100).toFixed(2)}`,
      unidade: 'BRL',
      formula: 'Necessidade = max(0, Demanda(L+C) + SS - Saldo - EmAberto); Arredonda p/ Embalagem; Complemento Guloso p/ Pedido Mínimo',
      entradas: {
        fornecedor: supplier.name,
        pedidoMinimoCentavos: minimumOrderInCents,
        custoInicialCentavos: initialTotalCost,
        custoFinalCentavos: finalTotalCost,
      },
      passos: [
        `Cálculo da demanda projetada no horizonte de lead time + ciclo de compra para ${suggestedItems.length} insumos.`,
        `Arredondamento determinístico para múltiplos inteiros de fardos/embalagens comerciais.`,
        wasGreedyFilled
          ? `Pedido mínimo de R$ ${(minimumOrderInCents / 100).toFixed(2)} não atingido inicialmente; complemento guloso adicionado nos itens de menor cobertura.`
          : `Pedido já atende aos requisitos de pedido mínimo sem necessidade de complemento extra.`,
      ],
      suficienciaDeDados: { suficiente: true, percentualConfiabilidade: 100 },
      confianca: 'ALTA',
    },
  };
}

// -------------------------------------------------------------
// F18: Custo Efetivo de Prazo
// -------------------------------------------------------------

export interface TradeCreditCostResult {
  discountPercentage: number;
  paymentTermInDays: number;
  cashOpportunityMonthlyRatePercentage: number;
  implicitMonthlyInterestRatePercentage: number;
  isCashPaymentRecommended: boolean;
  savedMonthlyAmountInCents: number;
  invoiceAmountInCents: number;
  explanation: DomainExplanation;
}

export function calculateTradeCreditEffectiveCost(
  invoiceAmountInCents: number,
  discountPercentage: number, // ex: 0.03 para 3%
  paymentTermInDays: number, // n dias
  cashOpportunityMonthlyRate: number = 0.01 // 1% a.m. CDI padrão
): TradeCreditCostResult {
  if (paymentTermInDays <= 0) {
    throw new Error('Prazo de pagamento deve ser estritamente maior que zero dias.');
  }
  if (discountPercentage < 0 || discountPercentage >= 1) {
    throw new Error('Desconto deve estar entre 0 e menor que 100%.');
  }

  if (discountPercentage === 0) {
    return {
      discountPercentage: 0,
      paymentTermInDays,
      cashOpportunityMonthlyRatePercentage: Math.round(cashOpportunityMonthlyRate * 1000) / 10,
      implicitMonthlyInterestRatePercentage: 0,
      isCashPaymentRecommended: false,
      savedMonthlyAmountInCents: 0,
      invoiceAmountInCents,
      explanation: {
        valor: 'Taxa 0%',
        unidade: '%',
        formula: 'Sem desconto à vista oferecido',
        entradas: { desconto: 0, prazoDias: paymentTermInDays },
        passos: ['Como não há desconto para pagamento à vista, o prazo deve ser sempre aproveitado para manter o caixa.'],
        suficienciaDeDados: { suficiente: true, percentualConfiabilidade: 100 },
        confianca: 'ALTA',
      },
    };
  }

  // Taxa mensal implícita = (1 / (1 - d))^(30 / n) - 1
  const ratio = 1 / (1 - discountPercentage);
  const exponent = 30 / paymentTermInDays;
  const implicitMonthlyRate = Math.pow(ratio, exponent) - 1;

  const isRecommended = implicitMonthlyRate > cashOpportunityMonthlyRate;
  const savedCents = Math.round(invoiceAmountInCents * discountPercentage);

  return {
    discountPercentage: Math.round(discountPercentage * 1000) / 10,
    paymentTermInDays,
    cashOpportunityMonthlyRatePercentage: Math.round(cashOpportunityMonthlyRate * 1000) / 10,
    implicitMonthlyInterestRatePercentage: Math.round(implicitMonthlyRate * 1000) / 10,
    isCashPaymentRecommended: isRecommended,
    savedMonthlyAmountInCents: savedCents,
    invoiceAmountInCents,
    explanation: {
      valor: `${(implicitMonthlyRate * 100).toFixed(2)}% a.m.`,
      unidade: '% a.m.',
      formula: 'i_mensal = (1 / (1 - d))^(30 / n) - 1',
      entradas: {
        faturaCentavos: invoiceAmountInCents,
        descontoVista: `${(discountPercentage * 100).toFixed(1)}%`,
        prazoDias: paymentTermInDays,
        taxaOportunidadeCaixa: `${(cashOpportunityMonthlyRate * 100).toFixed(1)}% a.m.`,
      },
      passos: [
        `Ao abrir mão de ${(discountPercentage * 100).toFixed(1)}% de desconto para pagar em ${paymentTermInDays} dias, o restaurante paga uma taxa implícita de ${(implicitMonthlyRate * 100).toFixed(2)}% ao mês.`,
        isRecommended
          ? `Essa taxa é MAIOR que a rentabilidade do caixa (${(cashOpportunityMonthlyRate * 100).toFixed(1)}% a.m.). Compensa pagar à vista e capturar R$ ${(savedCents / 100).toFixed(2)} de economia imediata.`
          : `Essa taxa é menor que o custo de oportunidade do caixa. Compensa pagar a prazo para preservar liquidez.`,
      ],
      suficienciaDeDados: { suficiente: true, percentualConfiabilidade: 100 },
      confianca: 'ALTA',
    },
  };
}

// -------------------------------------------------------------
// F19: Preço Fora da Curva (Modified Z-Score com Mediana e MAD)
// -------------------------------------------------------------

export interface OutlierPurchasePriceItem {
  purchaseId: string;
  ingredientId: string;
  ingredientName: string;
  purchaseDate: string;
  quantityBought: number;
  paidPriceInCents: number;
  historicalMedianPriceInCents: number;
  cheapestKnownSupplierPriceInCents: number;
  cheapestKnownSupplierName: string;
  mad: number;
  modifiedZScore: number;
  isOutlier: boolean;
  excessPaidInCents: number;
}

export function detectOutlierPurchasePrices(
  ingredient: Ingredient,
  purchasesHistory: { id: string; date: string; quantity: number; unitPriceInCents: number; supplierName: string }[],
  latestPurchase: { id: string; date: string; quantity: number; unitPriceInCents: number; supplierName: string },
  threshold: number = 3.5
): OutlierPurchasePriceItem {
  const prices = purchasesHistory.map(p => p.unitPriceInCents);
  if (prices.length === 0) {
    return {
      purchaseId: latestPurchase.id,
      ingredientId: ingredient.id,
      ingredientName: ingredient.name,
      purchaseDate: latestPurchase.date,
      quantityBought: latestPurchase.quantity,
      paidPriceInCents: latestPurchase.unitPriceInCents,
      historicalMedianPriceInCents: latestPurchase.unitPriceInCents,
      cheapestKnownSupplierPriceInCents: latestPurchase.unitPriceInCents,
      cheapestKnownSupplierName: latestPurchase.supplierName,
      mad: 0,
      modifiedZScore: 0,
      isOutlier: false,
      excessPaidInCents: 0,
    };
  }

  const sorted = [...prices].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;

  const deviations = prices.map(p => Math.abs(p - median)).sort((a, b) => a - b);
  const mad = deviations.length % 2 !== 0 ? deviations[mid] : (deviations[mid - 1] + deviations[mid]) / 2;

  // Menor fornecedor conhecido
  const sortedPurchases = [...purchasesHistory].sort((a, b) => a.unitPriceInCents - b.unitPriceInCents);
  const cheapest = sortedPurchases[0];

  let modZ = 0;
  let isOutlier = false;

  if (mad > 0) {
    modZ = (0.6745 * (latestPurchase.unitPriceInCents - median)) / mad;
    isOutlier = Math.abs(modZ) > threshold;
  } else {
    // Se MAD = 0 (preços históricos todos iguais)
    const pctDiff = median > 0 ? (latestPurchase.unitPriceInCents - median) / median : 0;
    if (pctDiff > 0.15) {
      isOutlier = true;
      modZ = pctDiff * 10;
    }
  }

  const excess = Math.max(0, latestPurchase.unitPriceInCents - median) * latestPurchase.quantity;

  return {
    purchaseId: latestPurchase.id,
    ingredientId: ingredient.id,
    ingredientName: ingredient.name,
    purchaseDate: latestPurchase.date,
    quantityBought: latestPurchase.quantity,
    paidPriceInCents: latestPurchase.unitPriceInCents,
    historicalMedianPriceInCents: Math.round(median),
    cheapestKnownSupplierPriceInCents: cheapest.unitPriceInCents,
    cheapestKnownSupplierName: cheapest.supplierName,
    mad: Math.round(mad * 100) / 100,
    modifiedZScore: Math.round(modZ * 100) / 100,
    isOutlier,
    excessPaidInCents: Math.round(excess),
  };
}

// -------------------------------------------------------------
// F20: Orçamento de Compras por Categoria
// -------------------------------------------------------------

export interface CategoryBudgetAnalysis {
  category: string;
  monthlyBudgetInCents: number;
  spentSoFarInCents: number;
  projectedMonthEndInCents: number;
  overspendProjectedInCents: number;
  isOverspendProjected: boolean;
  burnRatePercentage: number;
}

export interface ProcurementBudgetResult {
  periodMonthYear: string;
  daysElapsed: number;
  daysInMonth: number;
  totalBudgetInCents: number;
  totalSpentInCents: number;
  totalProjectedInCents: number;
  categories: CategoryBudgetAnalysis[];
  explanation: DomainExplanation;
}

export function calculateProcurementBudget(
  categoryBudgets: Record<string, number>, // Categoria -> centavos
  categorySpends: Record<string, number>, // Categoria -> centavos
  daysElapsed: number,
  daysInMonth: number = 30
): ProcurementBudgetResult {
  const safeDaysElapsed = Math.max(1, daysElapsed);
  const categories: CategoryBudgetAnalysis[] = [];

  let totalBudget = 0;
  let totalSpent = 0;
  let totalProjected = 0;

  for (const [cat, budget] of Object.entries(categoryBudgets)) {
    const spent = categorySpends[cat] || 0;
    const projected = Math.round((spent / safeDaysElapsed) * daysInMonth);
    const overspend = Math.max(0, projected - budget);
    const burnRate = budget > 0 ? (spent / budget) * 100 : 0;

    totalBudget += budget;
    totalSpent += spent;
    totalProjected += projected;

    categories.push({
      category: cat,
      monthlyBudgetInCents: budget,
      spentSoFarInCents: spent,
      projectedMonthEndInCents: projected,
      overspendProjectedInCents: overspend,
      isOverspendProjected: overspend > 0,
      burnRatePercentage: Math.round(burnRate * 10) / 10,
    });
  }

  // Ordena por maior estouro projetado
  categories.sort((a, b) => b.overspendProjectedInCents - a.overspendProjectedInCents);

  return {
    periodMonthYear: `${new Date().getMonth() + 1}/${new Date().getFullYear()}`,
    daysElapsed: safeDaysElapsed,
    daysInMonth,
    totalBudgetInCents: totalBudget,
    totalSpentInCents: totalSpent,
    totalProjectedInCents: totalProjected,
    categories,
    explanation: {
      valor: `R$ ${(totalSpent / 100).toFixed(2)} gastos / R$ ${(totalBudget / 100).toFixed(2)} orçados`,
      unidade: 'BRL',
      formula: 'Projeção = (Gasto Realizado / Dias Decorridos) × Dias do Mês; Estouro = Projeção - Orçamento',
      entradas: {
        diasDecorridos: safeDaysElapsed,
        diasNoMes: daysInMonth,
        totalOrcadoCentavos: totalBudget,
        totalGastoCentavos: totalSpent,
      },
      passos: [
        `Gasto realizado apurado nos primeiros ${safeDaysElapsed} dias do mês.`,
        `Extrapolação linear determinística para os ${daysInMonth} dias totais do mês.`,
        `Identificação de estouros orçamentários por categoria de compra com desvio em R$.`,
      ],
      suficienciaDeDados: { suficiente: totalBudget > 0, percentualConfiabilidade: 100 },
      confianca: 'ALTA',
    },
  };
}
