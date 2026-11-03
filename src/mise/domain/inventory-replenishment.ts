/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Mise — F09 Cobertura & Giro, F10 Reposição Inteligente, F11 Curva ABC x XYZ,
 * F12 Capital Parado, F15 Preço Mínimo de Liquidação
 * Invariante: Zero IA/ML. Estatística pura, inverso da normal estrito, minimização de custo total.
 */

import { DomainExplanation } from './insights-types';
import { Ingredient, Recipe, StockMovement } from './types';
import { removeOutliersUsingMad } from './demand-forecasting';

/**
 * Função Inversa da Distribuição Normal Acumulada padrão Φ⁻¹(p)
 * Implementação do algoritmo de aproximação racional de Peter J. Acklam (precisão relativa < 1.15e-9).
 */
export function inverseNormalCdf(p: number): number {
  if (p <= 0 || p >= 1) {
    throw new Error(`Probabilidade p deve estar estritamente entre 0 e 1. Recebido: ${p}`);
  }

  // Coeficientes de Acklam
  const a = [
    -3.969683028665376e1,
    2.209460984245205e2,
    -2.759285104469687e2,
    1.383577518672690e2,
    -3.066479806614716e1,
    2.506628277459239e0,
  ];

  const b = [
    -5.447609879822406e1,
    1.615858368580409e2,
    -1.556989798598866e2,
    6.680131188771972e1,
    -1.328068155288572e1,
  ];

  const c = [
    -7.784894002430293e-3,
    -3.223964580411365e-1,
    -2.400758277161838e0,
    -2.549732539343734e0,
    4.374664141464968e0,
    2.938163982698783e0,
  ];

  const d = [
    7.784695709041462e-3,
    3.224671290700398e-1,
    2.445134137142996e0,
    3.754408661907416e0,
  ];

  const pLow = 0.02425;
  const pHigh = 1 - pLow;

  let q: number;
  let r: number;

  if (p < pLow) {
    // Região inferior
    q = Math.sqrt(-2 * Math.log(p));
    return (
      (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
    );
  } else if (p <= pHigh) {
    // Região central
    q = p - 0.5;
    r = q * q;
    return (
      (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
      (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
    );
  } else {
    // Região superior
    q = Math.sqrt(-2 * Math.log(1 - p));
    return (
      -(
        (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
        ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
      )
    );
  }
}

// -------------------------------------------------------------
// F09: Cobertura e Giro de Estoque
// -------------------------------------------------------------

export interface CoverageAndTurnoverItem {
  ingredientId: string;
  ingredientName: string;
  currentStock: number;
  baseUnit: string;
  cleanedDailyConsumption: number;
  coverageInDays: number;
  isOutOfStock: boolean;
  isExcessStock: boolean; // cobertura > 30 dias
}

export interface InventoryTurnoverResult {
  periodDays: number;
  cmvInCents: number;
  averageInventoryInCents: number;
  turnoverRatio: number;
  inventoryDays: number;
  items: CoverageAndTurnoverItem[];
  explanation: DomainExplanation;
}

export function calculateCoverageAndTurnover(
  ingredients: Ingredient[],
  dailyConsumptionsByIngredientId: Record<string, number[]>,
  currentBalances: Map<string, number>,
  cmvInCents: number,
  averageInventoryInCents: number,
  periodDays: number = 30
): InventoryTurnoverResult {
  const items: CoverageAndTurnoverItem[] = [];

  for (const ing of ingredients) {
    const history = dailyConsumptionsByIngredientId[ing.id] || [];
    const { cleaned } = removeOutliersUsingMad(history);
    const avgDaily = cleaned.length > 0 ? cleaned.reduce((a, b) => a + b, 0) / cleaned.length : 0;
    const balance = currentBalances.get(ing.id) || 0;

    const coverage = avgDaily > 0 ? balance / avgDaily : balance > 0 ? 9999 : 0;

    items.push({
      ingredientId: ing.id,
      ingredientName: ing.name,
      currentStock: balance,
      baseUnit: ing.baseUnit,
      cleanedDailyConsumption: Math.round(avgDaily * 100) / 100,
      coverageInDays: Math.round(coverage * 10) / 10,
      isOutOfStock: balance <= 0,
      isExcessStock: coverage > 30 && balance > 0,
    });
  }

  const turnover = averageInventoryInCents > 0 ? cmvInCents / averageInventoryInCents : 0;
  const invDays = turnover > 0 ? periodDays / turnover : 0;

  return {
    periodDays,
    cmvInCents,
    averageInventoryInCents,
    turnoverRatio: Math.round(turnover * 100) / 100,
    inventoryDays: Math.round(invDays * 10) / 10,
    items,
    explanation: {
      valor: `${Math.round(turnover * 10) / 10}x (${Math.round(invDays)} dias de estoque)`,
      unidade: 'giros',
      formula: 'Giro = CMV / Estoque Médio; Dias = Dias do Período / Giro; Cobertura = Saldo / Consumo Diário Limpo (MAD)',
      entradas: {
        cmvCentavos: cmvInCents,
        estoqueMedioCentavos: averageInventoryInCents,
        diasPeriodo: periodDays,
      },
      passos: [
        `1. Remoção de picos de consumo atípicos via MAD em cada insumo.`,
        `2. Cálculo do consumo médio diário ponderado e dias de cobertura pelo saldo físico.`,
        `3. Giro global de ${Math.round(turnover * 10) / 10} voltas no mês (insumos renovados a cada ${Math.round(invDays)} dias).`,
      ],
      suficienciaDeDados: { suficiente: averageInventoryInCents > 0, percentualConfiabilidade: 100 },
      confianca: 'ALTA',
    },
  };
}

// -------------------------------------------------------------
// F10: Reposição Inteligente (SS, ROP, EOQ)
// -------------------------------------------------------------

export interface SmartReplenishmentParameters {
  serviceLevel: number; // ex: 0.95
  orderFixedCostInCents: number; // S (ex: 2500 cents = R$ 25,00)
  annualCarryingRate: number; // H taxa anual (ex: 0.20 = 20%)
  leadTimeDays: number; // L (ex: 4 dias)
  shelfLifeDays?: number; // validade máxima em dias
}

export interface SmartReplenishmentItem {
  ingredientId: string;
  ingredientName: string;
  baseUnit: string;
  meanDailyDemand: number;
  stdDevDailyDemand: number;
  safetyStock: number; // SS
  reorderPoint: number; // ROP
  economicOrderQuantity: number; // EOQ
  effectiveOrderQuantity: number; // limitado por validade
  isRestrictedByShelfLife: boolean;
  zValue: number;
  totalAnnualCostAtEoqInCents: number;
}

export function calculateSmartReplenishment(
  ingredient: Ingredient,
  dailyDemands: number[],
  params: SmartReplenishmentParameters
): SmartReplenishmentItem {
  const { serviceLevel, orderFixedCostInCents, annualCarryingRate, leadTimeDays, shelfLifeDays } = params;

  if (serviceLevel <= 0 || serviceLevel >= 1) {
    throw new Error(`Nível de serviço deve ser entre 0 e 1 (ex: 0.95). Recebido: ${serviceLevel}`);
  }
  if (leadTimeDays <= 0) {
    throw new Error(`Lead time deve ser positivo. Recebido: ${leadTimeDays}`);
  }

  // 1. Inverso da Normal z
  const z = inverseNormalCdf(serviceLevel);

  // 2. Média e desvio padrão
  const n = dailyDemands.length || 1;
  const mean = dailyDemands.reduce((a, b) => a + b, 0) / n;
  const variance = dailyDemands.reduce((sum, d) => sum + Math.pow(d - mean, 2), 0) / (n > 1 ? n - 1 : 1);
  const stdDev = Math.sqrt(variance);

  // 3. Estoque de Segurança (SS) = z * sigma_d * sqrt(L)
  const ss = z * stdDev * Math.sqrt(leadTimeDays);

  // 4. Ponto de Reposição (ROP) = d_bar * L + SS
  const rop = mean * leadTimeDays + ss;

  // 5. Demanda Anual D = d_bar * 365
  const annualDemand = mean * 365;

  // 6. Custo de posse H anual por unidade-base em centavos
  // ingredient.currentUnitCostMicrocents / 10000 = centavos por unidade base
  const unitCostInCents = ingredient.currentUnitCostMicrocents / 10000;
  const hAnnualInCents = Math.max(0.0001, unitCostInCents * annualCarryingRate);

  // EOQ = sqrt(2 * D * S / H)
  const eoq = Math.sqrt((2 * annualDemand * orderFixedCostInCents) / hAnnualInCents);

  // Restrição de Validade
  let effectiveEoq = eoq;
  let isRestricted = false;
  if (shelfLifeDays && shelfLifeDays > 0) {
    const maxConsumable = mean * shelfLifeDays;
    if (maxConsumable > 0 && eoq > maxConsumable) {
      effectiveEoq = maxConsumable;
      isRestricted = true;
    }
  }

  // Custo anual total = (D/Q)*S + (Q/2)*H
  const totalAnnualCostInCents = Math.round(
    (annualDemand / Math.max(effectiveEoq, 1)) * orderFixedCostInCents +
    (effectiveEoq / 2) * hAnnualInCents
  );

  return {
    ingredientId: ingredient.id,
    ingredientName: ingredient.name,
    baseUnit: ingredient.baseUnit,
    meanDailyDemand: Math.round(mean * 100) / 100,
    stdDevDailyDemand: Math.round(stdDev * 100) / 100,
    safetyStock: Math.round(ss * 100) / 100,
    reorderPoint: Math.round(rop * 100) / 100,
    economicOrderQuantity: Math.round(eoq * 100) / 100,
    effectiveOrderQuantity: Math.round(effectiveEoq * 100) / 100,
    isRestrictedByShelfLife: isRestricted,
    zValue: Math.round(z * 1000) / 1000,
    totalAnnualCostAtEoqInCents: totalAnnualCostInCents,
  };
}

// -------------------------------------------------------------
// F11: Curva ABC x XYZ
// -------------------------------------------------------------

export type AbcClass = 'A' | 'B' | 'C';
export type XyzClass = 'X' | 'Y' | 'Z';
export type AbcXyzMatrixQuadrant = 'AX' | 'AY' | 'AZ' | 'BX' | 'BY' | 'BZ' | 'CX' | 'CY' | 'CZ';

export interface AbcXyzItem {
  ingredientId: string;
  ingredientName: string;
  spentInCents: number;
  cumulativePercentage: number;
  abc: AbcClass;
  meanDailyDemand: number;
  stdDevDailyDemand: number;
  coefficientOfVariation: number;
  xyz: XyzClass;
  quadrant: AbcXyzMatrixQuadrant;
  recommendation: string;
}

export function calculateAbcXyzMatrix(
  ingredients: Ingredient[],
  periodConsumptionsByIngId: Record<string, { totalSpentInCents: number; dailyDemands: number[] }>
): { items: AbcXyzItem[]; quadrantCounts: Record<AbcXyzMatrixQuadrant, number>; explanation: DomainExplanation } {
  // 1. ABC
  const rawList = ingredients.map(ing => {
    const data = periodConsumptionsByIngId[ing.id] || { totalSpentInCents: 0, dailyDemands: [] };
    return {
      ingredient: ing,
      spentInCents: data.totalSpentInCents,
      dailyDemands: data.dailyDemands,
    };
  });

  rawList.sort((a, b) => b.spentInCents - a.spentInCents);
  const totalSpent = rawList.reduce((sum, item) => sum + item.spentInCents, 0);

  let cumulativeSpent = 0;
  const quadrantCounts: Record<AbcXyzMatrixQuadrant, number> = {
    AX: 0, AY: 0, AZ: 0,
    BX: 0, BY: 0, BZ: 0,
    CX: 0, CY: 0, CZ: 0,
  };

  const items: AbcXyzItem[] = rawList.map(item => {
    cumulativeSpent += item.spentInCents;
    const cumPct = totalSpent > 0 ? (cumulativeSpent / totalSpent) * 100 : 100;

    let abc: AbcClass = 'C';
    if (cumPct <= 80 || item.spentInCents >= 0.8 * totalSpent) abc = 'A';
    else if (cumPct <= 95) abc = 'B';
    else abc = 'C';

    // XYZ
    const demands = item.dailyDemands;
    const n = demands.length || 1;
    const mean = demands.reduce((a, b) => a + b, 0) / n;
    const variance = demands.reduce((sum, d) => sum + Math.pow(d - mean, 2), 0) / (n > 1 ? n - 1 : 1);
    const stdDev = Math.sqrt(variance);
    const cv = mean > 0 ? stdDev / mean : 0;

    let xyz: XyzClass = 'X';
    if (cv < 0.5) xyz = 'X';
    else if (cv <= 1.0) xyz = 'Y';
    else xyz = 'Z';

    const quadrant = `${abc}${xyz}` as AbcXyzMatrixQuadrant;
    quadrantCounts[quadrant]++;

    let recommendation = '';
    switch (quadrant) {
      case 'AX':
        recommendation = 'Alta prioridade financeira e demanda estável. Negociar contratos de longo prazo e manter estoque enxuto (JIT).';
        break;
      case 'AY':
        recommendation = 'Alta prioridade e demanda moderada. Monitoramento semanal e estoque de segurança bem calibrado.';
        break;
      case 'AZ':
        recommendation = 'Crítico: alto impacto financeiro e demanda imprevisível. Risco alto de ruptura ou sobra. Acompanhar diariamente e comprar sob encomenda.';
        break;
      case 'BX':
      case 'BY':
      case 'BZ':
        recommendation = 'Controle intermediário. Revisão quinzenal e pedidos por ponto de reposição padrão.';
        break;
      case 'CX':
      case 'CY':
        recommendation = 'Baixo impacto financeiro. Reposição visual simples (kanban) e compras em lotes maiores.';
        break;
      case 'CZ':
        recommendation = 'Baixo impacto e esporádico. Evitar manter em estoque fixo; comprar apenas quando houver encomenda.';
        break;
    }

    return {
      ingredientId: item.ingredient.id,
      ingredientName: item.ingredient.name,
      spentInCents: item.spentInCents,
      cumulativePercentage: Math.round(cumPct * 10) / 10,
      abc,
      meanDailyDemand: Math.round(mean * 100) / 100,
      stdDevDailyDemand: Math.round(stdDev * 100) / 100,
      coefficientOfVariation: Math.round(cv * 100) / 100,
      xyz,
      quadrant,
      recommendation,
    };
  });

  return {
    items,
    quadrantCounts,
    explanation: {
      valor: `${items.length} insumos classificados`,
      unidade: 'itens',
      formula: 'ABC (Gasto Acumulado: 80% A, 15% B, 5% C) × XYZ (CV = σ/μ: <0.5 X, 0.5..1.0 Y, >1.0 Z)',
      entradas: { totalGastoCentavos: totalSpent, totalInsumos: items.length },
      passos: [
        `1. Ordenação dos itens por valor consumido no período e cálculo percentual acumulado (ABC).`,
        `2. Cálculo do Coeficiente de Variação da demanda diária (CV = σ / μ) para classificar previsibilidade (XYZ).`,
        `3. Enquadramento determinístico na matriz 3x3 com recomendação operacional específica.`,
      ],
      suficienciaDeDados: { suficiente: items.length > 0, percentualConfiabilidade: 100 },
      confianca: 'ALTA',
    },
  };
}

// -------------------------------------------------------------
// F12: Capital Parado e Custo de Oportunidade
// -------------------------------------------------------------

export interface IdleCapitalItem {
  ingredientId: string;
  ingredientName: string;
  baseUnit: string;
  balance: number;
  unitCostInCents: number;
  totalIdleValueInCents: number;
  daysWithoutOutflow: number;
}

export interface IdleCapitalResult {
  daysThreshold: number;
  totalIdleCapitalInCents: number;
  monthlyOpportunityRatePercentage: number;
  monthlyOpportunityCostInCents: number;
  idleItems: IdleCapitalItem[];
  explanation: DomainExplanation;
}

export function calculateIdleCapital(
  ingredients: Ingredient[],
  stockMovements: StockMovement[],
  currentBalances: Map<string, number>,
  daysThreshold: number = 30,
  monthlyOpportunityRate: number = 0.01, // 1% a.m.
  now: Date = new Date()
): IdleCapitalResult {
  const idleItems: IdleCapitalItem[] = [];
  const nowMs = now.getTime();

  for (const ing of ingredients) {
    const balance = currentBalances.get(ing.id) || 0;
    if (balance <= 0) continue;

    // Achar última movimentação de saída
    const outMovements = stockMovements.filter(
      m => m.ingredientId === ing.id && (m.type === 'SALES_CONSUMPTION' || m.type === 'PRODUCTION_INPUT' || m.type === 'WASTE')
    );

    let lastOutflowMs = 0;
    for (const m of outMovements) {
      const ms = new Date(m.createdAt).getTime();
      if (ms > lastOutflowMs) lastOutflowMs = ms;
    }

    const daysWithoutOutflow = lastOutflowMs > 0
      ? Math.floor((nowMs - lastOutflowMs) / (1000 * 60 * 60 * 24))
      : 999; // sem saídas registradas

    if (daysWithoutOutflow >= daysThreshold) {
      const unitCostInCents = ing.currentUnitCostMicrocents / 10000;
      const totalValue = Math.round(balance * unitCostInCents);

      idleItems.push({
        ingredientId: ing.id,
        ingredientName: ing.name,
        baseUnit: ing.baseUnit,
        balance,
        unitCostInCents: Math.round(unitCostInCents * 100) / 100,
        totalIdleValueInCents: totalValue,
        daysWithoutOutflow,
      });
    }
  }

  idleItems.sort((a, b) => b.totalIdleValueInCents - a.totalIdleValueInCents);
  const totalIdleCapitalInCents = idleItems.reduce((sum, item) => sum + item.totalIdleValueInCents, 0);
  const monthlyCostInCents = Math.round(totalIdleCapitalInCents * monthlyOpportunityRate);

  return {
    daysThreshold,
    totalIdleCapitalInCents,
    monthlyOpportunityRatePercentage: Math.round(monthlyOpportunityRate * 1000) / 10,
    monthlyOpportunityCostInCents: monthlyCostInCents,
    idleItems,
    explanation: {
      valor: `R$ ${(totalIdleCapitalInCents / 100).toFixed(2)}`,
      unidade: 'BRL',
      formula: 'Capital Parado = Σ (Saldo × Custo Médio) para itens sem saída há ≥ N dias; Custo Oportunidade = Capital × Taxa',
      entradas: {
        diasSemSaidaLimite: daysThreshold,
        taxaMensal: `${(monthlyOpportunityRate * 100).toFixed(1)}%`,
        itensParados: idleItems.length,
      },
      passos: [
        `Varredura de itens com saldo positivo e nenhuma saída registrada nos últimos ${daysThreshold} dias.`,
        `Identificação de ${idleItems.length} insumos retendo R$ ${(totalIdleCapitalInCents / 100).toFixed(2)} em prateleira.`,
        `Custo de oportunidade do capital parado: R$ ${(monthlyCostInCents / 100).toFixed(2)}/mês à taxa de ${(monthlyOpportunityRate * 100).toFixed(1)}% a.m.`,
      ],
      suficienciaDeDados: { suficiente: true, percentualConfiabilidade: 100 },
      confianca: 'ALTA',
    },
  };
}

// -------------------------------------------------------------
// F15: Preço Mínimo de Liquidação
// -------------------------------------------------------------

export interface ClearanceFloorPriceResult {
  recipeId: string;
  recipeName: string;
  sunkIngredientId: string;
  sunkIngredientName: string;
  portionRecoveryFloorInCents: number; // Piso de caixa marginal (excluindo insumo que venceria)
  portionFullNonLossFloorInCents: number; // Piso contábil cobrindo todos os insumos
  totalRecipeCostInCents: number;
  sunkPortionCostInCents: number;
  additionalVariableCostInCents: number;
  variableDeductionsPercentage: number;
  explanation: DomainExplanation;
}

export function calculateClearanceFloorPrice(
  recipe: Recipe,
  sunkIngredientId: string,
  ingredients: Ingredient[],
  variableDeductionsPercentage: number = 0.10 // 10% padrão de imposto + cartão
): ClearanceFloorPriceResult {
  if (variableDeductionsPercentage >= 1.0) {
    throw new Error('Deduções variáveis não podem ser 100% ou mais.');
  }

  const ingMap = new Map<string, Ingredient>(ingredients.map(i => [i.id, i]));
  let sunkPortionCost = 0;
  let additionalCost = 0;

  for (const line of recipe.lines) {
    if (line.ingredientId) {
      const ing = ingMap.get(line.ingredientId);
      if (ing) {
        const grossQty = line.quantityInBaseUnit * line.correctionFactor;
        const lineCost = Math.round((grossQty * ing.currentUnitCostMicrocents) / 10000);
        if (line.ingredientId === sunkIngredientId) {
          sunkPortionCost += lineCost;
        } else {
          additionalCost += lineCost;
        }
      }
    }
  }

  const denominator = 1 - variableDeductionsPercentage;
  const portions = Math.max(recipe.yieldPortions, 1);

  const addCostPerPortion = additionalCost / portions;
  const sunkCostPerPortion = sunkPortionCost / portions;
  const totalCostPerPortion = (additionalCost + sunkPortionCost) / portions;

  // Piso 1: Recuperação de caixa = custos adicionais / (1 - deduções)
  const recoveryFloor = Math.round(addCostPerPortion / denominator);

  // Piso 2: Não prejuízo integral = custos totais / (1 - deduções)
  const fullFloor = Math.round(totalCostPerPortion / denominator);

  const sunkIng = ingMap.get(sunkIngredientId);

  return {
    recipeId: recipe.id,
    recipeName: recipe.name,
    sunkIngredientId,
    sunkIngredientName: sunkIng?.name || 'Insumo em Risco',
    portionRecoveryFloorInCents: recoveryFloor,
    portionFullNonLossFloorInCents: fullFloor,
    totalRecipeCostInCents: Math.round(totalCostPerPortion),
    sunkPortionCostInCents: Math.round(sunkCostPerPortion),
    additionalVariableCostInCents: Math.round(addCostPerPortion),
    variableDeductionsPercentage: Math.round(variableDeductionsPercentage * 100),
    explanation: {
      valor: `Piso Caixa: R$ ${(recoveryFloor / 100).toFixed(2)} | Piso Contábil: R$ ${(fullFloor / 100).toFixed(2)}`,
      unidade: 'BRL',
      formula: 'Piso Recuperação = Custos Adicionais / (1 - Deduções); Piso Integral = Custo Total / (1 - Deduções)',
      entradas: {
        custoInsumoAfundadoCentavos: Math.round(sunkCostPerPortion),
        custosAdicionaisCentavos: Math.round(addCostPerPortion),
        deducoesPercentual: `${(variableDeductionsPercentage * 100).toFixed(1)}%`,
      },
      passos: [
        `Como o insumo ${sunkIng?.name || ''} está em risco iminente de perda (custo afundado), qualquer receita acima de R$ ${(recoveryFloor / 100).toFixed(2)} reduz o prejuízo que seria 100% no descarte.`,
        `Para não ter prejuízo contábil nenhum, o preço mínimo de liquidação é R$ ${(fullFloor / 100).toFixed(2)}.`,
      ],
      suficienciaDeDados: { suficiente: true, percentualConfiabilidade: 100 },
      confianca: 'ALTA',
    },
  };
}
