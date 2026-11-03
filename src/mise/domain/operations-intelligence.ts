/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Mise — F38, F39, F40, F41: Inteligência de Produção, Rendimento, Otimização e Mão de Obra
 */

import { Recipe, Ingredient } from './types';
import { RecipeCycleError } from './recipe';
import {
  DomainExplanation,
  ProductionPlanningResult,
  ProductionOrderRequirement,
  ExplodedIngredientNeed,
  BatchYieldAnalysisResult,
  BatchYieldOutlierItem,
  OptimalMixResult,
  OptimalMixItem,
  LaborStaffingResult,
  DayLaborStaffing,
} from './insights-types';
import { formatCentsToCurrency } from './units';

/**
 * F38: Planejamento de Produção e Explosão de Sub-receitas
 * Calcula necessidade líquida, programa lotes em múltiplos e explode BOM até insumos básicos.
 */
export function planProductionOrders(
  recipes: Recipe[],
  ingredients: Ingredient[],
  forecastDemandByRecipeId: Record<string, number>,
  currentStockPortionsByRecipeId: Record<string, number>,
  openProductionPortionsByRecipeId: Record<string, number> = {},
  batchSizeByRecipeId: Record<string, number> = {},
  ingredientStockMap: Record<string, number> = {}
): ProductionPlanningResult {
  const recMap = new Map<string, Recipe>(recipes.map((r) => [r.id, r]));
  const ingMap = new Map<string, Ingredient>(ingredients.map((i) => [i.id, i]));

  const orders: ProductionOrderRequirement[] = [];
  const totalProductionByRecipe = new Map<string, number>();

  // 1. Programar ordens de pratos finais e intermediários
  for (const recipe of recipes) {
    const demand = forecastDemandByRecipeId[recipe.id] || 0;
    const currentStock = currentStockPortionsByRecipeId[recipe.id] || 0;
    const openProd = openProductionPortionsByRecipeId[recipe.id] || 0;
    const batchSize = batchSizeByRecipeId[recipe.id] || recipe.yieldPortions || 1;

    const netNeed = Math.max(0, demand - currentStock - openProd);
    if (netNeed > 0) {
      const batches = Math.ceil(netNeed / batchSize);
      const totalToProduce = batches * batchSize;

      orders.push({
        recipeId: recipe.id,
        recipeName: recipe.name,
        isSubRecipe: recipe.isSubRecipe,
        batchSize,
        batchesToProduce: batches,
        totalPortionsToProduce: totalToProduce,
        currentStockPortions: currentStock,
        forecastDemandPortions: demand,
        netNeedPortions: netNeed,
      });

      totalProductionByRecipe.set(recipe.id, totalToProduce);
    }
  }

  // 2. Explosão recursiva da árvore de receitas (BOM) até insumos primários
  const totalIngredientNeeded = new Map<string, number>();

  function explodeRecipe(
    rec: Recipe,
    portionsMultiplier: number,
    visited = new Set<string>()
  ) {
    if (visited.has(rec.id)) {
      throw new RecipeCycleError([rec.name]);
    }
    visited.add(rec.id);

    const yieldPortions = rec.yieldPortions > 0 ? rec.yieldPortions : 1;
    const portionFactor = portionsMultiplier / yieldPortions;

    for (const line of rec.lines) {
      if (line.ingredientId) {
        const rawQty = line.quantityInBaseUnit * line.correctionFactor * portionFactor;
        const current = totalIngredientNeeded.get(line.ingredientId) || 0;
        totalIngredientNeeded.set(line.ingredientId, current + rawQty);
      } else if (line.subRecipeId) {
        const sub = recMap.get(line.subRecipeId);
        if (sub) {
          const subQty = line.quantityInBaseUnit * line.correctionFactor * portionFactor;
          explodeRecipe(sub, subQty, new Set(visited));
        }
      }
    }
  }

  for (const [recipeId, portions] of totalProductionByRecipe.entries()) {
    const rec = recMap.get(recipeId);
    if (rec) {
      explodeRecipe(rec, portions);
    }
  }

  // 3. Montar confronto de insumos explodidos com estoque
  const explodedIngredients: ExplodedIngredientNeed[] = [];
  let totalProductionCostInCents = 0;
  let totalShortageCostInCents = 0;

  for (const [ingId, neededQty] of totalIngredientNeeded.entries()) {
    const ing = ingMap.get(ingId);
    if (!ing) continue;

    const currentStock = ingredientStockMap[ingId] || 0;
    const shortage = Math.max(0, neededQty - currentStock);
    const unitCostMicrocents = ing.currentUnitCostMicrocents;
    const shortageCost = Math.round((shortage * unitCostMicrocents) / 10000);
    const totalCost = Math.round((neededQty * unitCostMicrocents) / 10000);

    totalProductionCostInCents += totalCost;
    totalShortageCostInCents += shortageCost;

    explodedIngredients.push({
      ingredientId: ing.id,
      ingredientName: ing.name,
      baseUnit: ing.baseUnit,
      totalNeededInBaseUnit: Number(neededQty.toFixed(2)),
      currentStockInBaseUnit: currentStock,
      shortageInBaseUnit: Number(shortage.toFixed(2)),
      unitCostMicrocents,
      shortageCostInCents: shortageCost,
    });
  }

  // Ordenar por valor em falta
  explodedIngredients.sort((a, b) => b.shortageCostInCents - a.shortageCostInCents);

  // Minutos de planejamento economizados (estimativa de 15 min por ordem explodida manualmente)
  const minutesSaved = orders.length * 15;

  const explanation: DomainExplanation<number> = {
    valor: totalShortageCostInCents,
    unidade: 'centavos',
    formula: 'Lote = ⌈(Demanda - Estoque) / Batelada⌉; Explosão_BOM recursiva; Ruptura = max(0, Necessidade - Estoque)',
    entradas: {
      ordensProgramadas: orders.length,
      insumosExplodidos: explodedIngredients.length,
      custoTotalInsumosCentavos: totalProductionCostInCents,
      custoRupturaInsumosCentavos: totalShortageCostInCents,
    },
    passos: [
      `1. Programadas ${orders.length} ordens de produção em bateladas para suprir a demanda.`,
      `2. Explosão de sub-receitas identificou necessidade de ${explodedIngredients.length} insumos primários (${formatCentsToCurrency(totalProductionCostInCents)}).`,
      `3. Insumos em falta no estoque somam ${formatCentsToCurrency(totalShortageCostInCents)} de compra urgente.`,
      `4. Economia de ${minutesSaved} minutos em cálculos manuais de explosão de fichas.`,
    ],
    suficienciaDeDados: {
      suficiente: true,
      percentualConfiabilidade: 100,
    },
    confianca: 'ALTA',
  };

  return {
    productionOrders: orders,
    explodedIngredients,
    totalProductionCostInCents,
    totalShortageCostInCents,
    minutesSaved,
    explanation,
  };
}

/**
 * F39: Rendimento Real e Custo por Lote
 * Compara rendimento real vs teórico e gera alerta estatístico de controle (média ± 3σ).
 */
export function analyzeBatchYieldAndOutliers(
  batches: {
    orderId: string;
    recipeId: string;
    recipeName: string;
    theoreticalYield: number;
    actualYield: number;
    batchCostInCents: number;
  }[],
  historicalYieldPercentagesByRecipeId: Record<string, number[]> = {}
): BatchYieldAnalysisResult {
  const resultBatches: BatchYieldOutlierItem[] = [];
  let totalLossInCents = 0;

  for (const b of batches) {
    const yieldPerc = b.theoreticalYield > 0
      ? Number(((b.actualYield / b.theoreticalYield) * 100).toFixed(2))
      : 100;

    const theorCostPortion = b.theoreticalYield > 0
      ? Math.ceil(b.batchCostInCents / b.theoreticalYield)
      : b.batchCostInCents;
    const actualCostPortion = b.actualYield > 0
      ? Math.ceil(b.batchCostInCents / b.actualYield)
      : b.batchCostInCents;

    // Perda decorrente de rendimento menor que o teórico
    const loss = b.actualYield < b.theoreticalYield
      ? Math.max(0, (actualCostPortion - theorCostPortion) * b.actualYield)
      : 0;

    totalLossInCents += loss;

    // Histórico para cálculo de média e desvio padrão
    const hist = historicalYieldPercentagesByRecipeId[b.recipeId] || [yieldPerc];
    const n = hist.length;
    const mean = hist.reduce((acc, val) => acc + val, 0) / (n > 0 ? n : 1);

    const variance = n > 1
      ? hist.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / (n - 1)
      : 0;
    const stdDev = Math.sqrt(variance);

    // Alerta ±3σ (apenas se houver ao menos 3 históricos para ter sentido estatístico)
    let isOutlier = false;
    let alertType: BatchYieldOutlierItem['alertType'] = 'NORMAL';

    if (n >= 3 && stdDev > 0) {
      if (yieldPerc < mean - 3 * stdDev) {
        isOutlier = true;
        alertType = 'RENDIMENTO_CRITICO_BAIXO';
      } else if (yieldPerc > mean + 3 * stdDev) {
        isOutlier = true;
        alertType = 'RENDIMENTO_ANOMALO_ALTO';
      }
    } else if (yieldPerc < 85) {
      // Regra de salvaguarda quando há pouco histórico: rendimento < 85% do teórico
      isOutlier = true;
      alertType = 'RENDIMENTO_CRITICO_BAIXO';
    }

    resultBatches.push({
      orderId: b.orderId,
      recipeId: b.recipeId,
      recipeName: b.recipeName,
      theoreticalYield: b.theoreticalYield,
      actualYield: b.actualYield,
      yieldPercentage: yieldPerc,
      batchCostInCents: b.batchCostInCents,
      theoreticalCostPerPortionInCents: theorCostPortion,
      actualCostPerPortionInCents: actualCostPortion,
      financialLossInCents: loss,
      meanYieldPercentage: Number(mean.toFixed(2)),
      stdDevYieldPercentage: Number(stdDev.toFixed(2)),
      isOutlier,
      alertType,
    });
  }

  const explanation: DomainExplanation<number> = {
    valor: totalLossInCents,
    unidade: 'centavos',
    formula: 'η = Y_real / Y_teorico; Perda = (Custo_real/porção - Custo_teórico/porção) × Y_real; Alerta = |η - μ| > 3σ',
    entradas: {
      lotesAnalisados: batches.length,
      lotesComAlerta: resultBatches.filter((b) => b.isOutlier).length,
    },
    passos: [
      `1. Analisados ${batches.length} lotes de produção com rendimento e custo unitário apurado.`,
      `2. ${resultBatches.filter((b) => b.isOutlier).length} lotes apresentaram dispersão estatística de rendimento fora do padrão.`,
      `3. Custo total do desperdício por quebra de rendimento apurado: ${formatCentsToCurrency(totalLossInCents)}.`,
    ],
    suficienciaDeDados: {
      suficiente: batches.length > 0,
      faltam: batches.length === 0 ? 'Nenhum lote de produção finalizado para análise.' : undefined,
      percentualConfiabilidade: batches.length > 0 ? 100 : 0,
    },
    confianca: batches.length > 0 ? 'ALTA' : 'INSUFICIENTE',
  };

  return {
    batches: resultBatches,
    totalLossInCents,
    explanation,
  };
}

/**
 * F40: Mix Ótimo com Recurso Escasso (Mochila Fracionária)
 * Ordena por Margem de Contribuição por unidade de recurso (ex: minutos de forno)
 * e aloca capacidade respeitando o teto de demanda.
 */
export function optimizeProductMixKnapsack(
  items: {
    recipeId: string;
    recipeName: string;
    salePriceInCents: number;
    variableCostInCents: number;
    scarceResourceConsumption: number; // ex: 5 min de forno por pizza
    forecastDemand: number;
  }[],
  resourceName: string,
  resourceCapacity: number
): OptimalMixResult {
  if (resourceCapacity <= 0) {
    throw new Error('A capacidade total do recurso escasso deve ser maior que zero.');
  }

  // 1. Calcular eficiência marginal por produto (MC / recurso)
  const evaluatedItems: OptimalMixItem[] = items.map((it) => {
    const mc = it.salePriceInCents - it.variableCostInCents;
    const ratio = it.scarceResourceConsumption > 0
      ? Number((mc / it.scarceResourceConsumption).toFixed(4))
      : mc;

    return {
      recipeId: it.recipeId,
      recipeName: it.recipeName,
      salePriceInCents: it.salePriceInCents,
      variableCostInCents: it.variableCostInCents,
      contributionMarginInCents: mc,
      scarceResourceConsumption: it.scarceResourceConsumption,
      efficiencyRatio: ratio,
      forecastDemand: it.forecastDemand,
      allocatedQuantity: 0,
      totalProfitInCents: 0,
    };
  });

  // 2. Ordenar decrescente pela eficiência marginal (MC por recurso)
  evaluatedItems.sort((a, b) => b.efficiencyRatio - a.efficiencyRatio);

  // 3. Alocação gulosa ótima
  let remainingCapacity = resourceCapacity;
  let optimalTotalProfit = 0;

  for (const item of evaluatedItems) {
    if (remainingCapacity <= 0) break;

    const maxByCapacity = item.scarceResourceConsumption > 0
      ? Math.floor(remainingCapacity / item.scarceResourceConsumption)
      : item.forecastDemand;

    const allocated = Math.min(item.forecastDemand, maxByCapacity);
    item.allocatedQuantity = allocated;
    item.totalProfitInCents = allocated * item.contributionMarginInCents;

    optimalTotalProfit += item.totalProfitInCents;
    remainingCapacity -= allocated * item.scarceResourceConsumption;
  }

  const resourceUsed = resourceCapacity - remainingCapacity;

  // 4. Comparar com mix ingênuo (alocação proporcional à demanda)
  const totalDemandResource = items.reduce(
    (acc, it) => acc + it.forecastDemand * it.scarceResourceConsumption,
    0
  );
  let naiveTotalProfit = 0;

  if (totalDemandResource > 0) {
    const naiveFactor = Math.min(1, resourceCapacity / totalDemandResource);
    naiveTotalProfit = Math.round(
      items.reduce(
        (acc, it) =>
          acc +
          Math.floor(it.forecastDemand * naiveFactor) *
            (it.salePriceInCents - it.variableCostInCents),
        0
      )
    );
  }

  const incrementalGain = Math.max(0, optimalTotalProfit - naiveTotalProfit);

  const explanation: DomainExplanation<number> = {
    valor: incrementalGain,
    unidade: 'centavos',
    formula: 'r_i = MC_i / a_i; Alocação gulosa ordenada por r_i decrescente até esgotar capacidade',
    entradas: {
      recurso: resourceName,
      capacidadeTotal: resourceCapacity,
      capacidadeUtilizada: resourceUsed,
      itensAvaliados: items.length,
      lucroOtimoCentavos: optimalTotalProfit,
      lucroIngenuoCentavos: naiveTotalProfit,
    },
    passos: [
      `1. Recurso escasso: "${resourceName}" com capacidade de ${resourceCapacity} unidades de capacidade.`,
      `2. Ordenados os ${items.length} pratos por margem de contribuição gerada por minuto de recurso.`,
      `3. Mix ótimo planejado gera ${formatCentsToCurrency(optimalTotalProfit)} de margem total utilizando ${resourceUsed}/${resourceCapacity} do recurso.`,
      `4. Ganho incremental de ${formatCentsToCurrency(incrementalGain)} frente ao mix sem priorização ótima.`,
    ],
    suficienciaDeDados: {
      suficiente: items.length > 0,
      percentualConfiabilidade: 100,
    },
    confianca: 'ALTA',
  };

  return {
    resourceName,
    resourceCapacity,
    resourceUsed,
    items: evaluatedItems,
    optimalTotalProfitInCents: optimalTotalProfit,
    naiveTotalProfitInCents: naiveTotalProfit,
    incrementalGainInCents: incrementalGain,
    explanation,
  };
}

/**
 * F41: Mão de Obra: Produtividade, CMO% e Dimensionamento de Escala
 * CMO% = Custo_mo / Receita. Horas necessárias = Demanda / Produtividade-alvo.
 */
export function calculateLaborProductivityAndNeeds(
  totalWorkedHours: number,
  totalLaborCostInCents: number,
  totalRevenueInCents: number,
  targetProductivityCentsPerHour: number,
  dailyProjectedRevenueByDayOfWeek: Record<number, number>, // 0=Dom, 1=Seg...
  dailyScheduledHoursByDayOfWeek: Record<number, number>,
  salaryAverageInCents: number,
  payrollTaxesRate = 0.35,
  overtimeMultiplier = 1.5
): LaborStaffingResult {
  const dayNames = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

  const cmoPerc = totalRevenueInCents > 0
    ? Number(((totalLaborCostInCents / totalRevenueInCents) * 100).toFixed(1))
    : 0;

  const actualProductivity = totalWorkedHours > 0
    ? Math.round(totalRevenueInCents / totalWorkedHours)
    : 0;

  // Custo por hora normal e hora extra
  const hourlyNormal = salaryAverageInCents > 0
    ? Math.round((salaryAverageInCents * (1 + payrollTaxesRate)) / 220)
    : 0;
  const hourlyOvertime = Math.round(hourlyNormal * overtimeMultiplier);

  const daysStaffing: DayLaborStaffing[] = [];
  let totalExcess = 0;
  let totalDeficit = 0;

  for (let dow = 0; dow <= 6; dow++) {
    const projRevenue = dailyProjectedRevenueByDayOfWeek[dow] || 0;
    const scheduledHours = dailyScheduledHoursByDayOfWeek[dow] || 0;

    const idealHours = targetProductivityCentsPerHour > 0
      ? Number((projRevenue / targetProductivityCentsPerHour).toFixed(1))
      : scheduledHours;

    const balance = Number((scheduledHours - idealHours).toFixed(1));
    let status: DayLaborStaffing['status'] = 'EQUILIBRADO';

    if (balance > 1.5) {
      status = 'EXCESSO';
      totalExcess += balance;
    } else if (balance < -1.5) {
      status = 'DEFICIT';
      totalDeficit += Math.abs(balance);
    }

    daysStaffing.push({
      dayOfWeek: dow,
      dayName: dayNames[dow],
      projectedRevenueInCents: projRevenue,
      targetProductivityCentsPerHour,
      idealHoursNeeded: idealHours,
      scheduledHours,
      hoursBalance: balance,
      status,
    });
  }

  const explanation: DomainExplanation<number> = {
    valor: cmoPerc,
    unidade: '%',
    formula: 'CMO% = Custo_mão_de_obra / Receita; Horas_ideais = Demanda_projetada / Produtividade_alvo',
    entradas: {
      faturamentoCentavos: totalRevenueInCents,
      custoMaoDeObraCentavos: totalLaborCostInCents,
      horasTrabalhadas: totalWorkedHours,
      produtividadeAlvoCentavosPorHora: targetProductivityCentsPerHour,
      horasExcessoTotal: Number(totalExcess.toFixed(1)),
      horasDeficitTotal: Number(totalDeficit.toFixed(1)),
    },
    passos: [
      `1. O CMO% atual é de ${cmoPerc}% com produtividade de ${formatCentsToCurrency(actualProductivity)}/hora de equipe.`,
      `2. Produtividade-alvo definida: ${formatCentsToCurrency(targetProductivityCentsPerHour)}/hora.`,
      `3. Foram identificadas ${totalExcess.toFixed(1)} horas de excesso/ociosidade em dias de menor movimento e ${totalDeficit.toFixed(1)} horas de déficit em picos de demanda.`,
      `4. Custo da hora extra parametrizado: ${formatCentsToCurrency(hourlyOvertime)}/h vs ${formatCentsToCurrency(hourlyNormal)}/h normal.`,
    ],
    suficienciaDeDados: {
      suficiente: totalRevenueInCents > 0 && targetProductivityCentsPerHour > 0,
      faltam: targetProductivityCentsPerHour <= 0 ? 'Defina a meta de produtividade horária nas configurações.' : undefined,
      percentualConfiabilidade: totalRevenueInCents > 0 ? 100 : 0,
    },
    confianca: totalRevenueInCents > 0 ? 'ALTA' : 'INSUFICIENTE',
  };

  return {
    laborCostInCents: totalLaborCostInCents,
    totalRevenueInCents: totalRevenueInCents,
    cmoPercentage: cmoPerc,
    totalWorkedHours,
    actualProductivityCentsPerHour: actualProductivity,
    hourlyCostNormalInCents: hourlyNormal,
    hourlyCostOvertimeInCents: hourlyOvertime,
    daysStaffing,
    totalExcessHours: Number(totalExcess.toFixed(1)),
    totalDeficitHours: Number(totalDeficit.toFixed(1)),
    explanation,
  };
}
