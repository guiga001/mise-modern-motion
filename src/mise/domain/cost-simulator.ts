/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Mise — F01, F02, F03, F07: Motores Puros de Custos, Preços e Inflação da Cozinha
 */

import { Ingredient, Recipe } from './types';
import { calculateRecipeCost, RecipeCycleError } from './recipe';
import {
  DomainExplanation,
  IngredientSimulationResult,
  SensitivityRankingResult,
  MarginReadjustmentResult,
  KitchenInflationResult,
  ElasticitySimulationResult,
  ElasticitySimulationPoint,
  ChannelMinimumPriceResult,
  ComboPricingResult,
} from './insights-types';
import { formatCentsToCurrency } from './units';

/**
 * F01: Simulador "E se?" de Insumo
 * Propaga variação de custo em sub-receitas e pratos finais, calculando impacto no lucro.
 */
export function simulateIngredientPriceChange(
  targetIngredientId: string,
  newUnitCostMicrocents: number,
  ingredients: Ingredient[],
  recipes: Recipe[],
  monthlySalesVolumeByRecipeId: Record<string, number>
): IngredientSimulationResult {
  const targetIng = ingredients.find((i) => i.id === targetIngredientId);
  if (!targetIng) {
    throw new Error(`Insumo ID "${targetIngredientId}" não encontrado.`);
  }

  if (newUnitCostMicrocents < 0) {
    throw new Error('O custo unitário simulado não pode ser negativo.');
  }

  const originalMicrocents = targetIng.currentUnitCostMicrocents;
  const deltaPercent = originalMicrocents > 0
    ? Number((((newUnitCostMicrocents - originalMicrocents) / originalMicrocents) * 100).toFixed(2))
    : 100;

  // Mapa base de insumos
  const baseIngMap = new Map<string, Ingredient>(ingredients.map((i) => [i.id, i]));
  const recipesMap = new Map<string, Recipe>(recipes.map((r) => [r.id, r]));

  // Mapa simulado com o novo preço
  const simulatedIngMap = new Map<string, Ingredient>(
    ingredients.map((i) => [
      i.id,
      i.id === targetIngredientId
        ? { ...i, currentUnitCostMicrocents: newUnitCostMicrocents }
        : i,
    ])
  );

  const affectedRecipes: IngredientSimulationResult['affectedRecipes'] = [];
  let totalDeltaProfitCents = 0;

  for (const recipe of recipes) {
    // Apenas pratos finais vendáveis
    if (recipe.isSubRecipe) continue;

    const costBefore = calculateRecipeCost(recipe, baseIngMap, recipesMap);
    const costAfter = calculateRecipeCost(recipe, simulatedIngMap, recipesMap);

    const costDelta = costAfter.portionCostInCents - costBefore.portionCostInCents;
    if (costDelta !== 0) {
      const volume = monthlySalesVolumeByRecipeId[recipe.id] || 0;
      const monthlyImpact = costDelta * volume;
      totalDeltaProfitCents -= monthlyImpact;

      affectedRecipes.push({
        recipeId: recipe.id,
        recipeName: recipe.name,
        portionCostBeforeInCents: costBefore.portionCostInCents,
        portionCostAfterInCents: costAfter.portionCostInCents,
        costDeltaInCents: costDelta,
        monthlySalesVolume: volume,
        monthlyImpactInCents: monthlyImpact,
      });
    }
  }

  // Ordenar pratos mais impactados primeiro
  affectedRecipes.sort((a, b) => Math.abs(b.monthlyImpactInCents) - Math.abs(a.monthlyImpactInCents));

  const explanation: DomainExplanation<number> = {
    valor: totalDeltaProfitCents,
    unidade: 'centavos',
    formula: 'ΔLucro_mês = -Σ (ΔCusto_prato × Unidades_vendidas_mês)',
    entradas: {
      insumo: targetIng.name,
      custoOriginalMicrocentavos: originalMicrocents,
      custoSimuladoMicrocentavos: newUnitCostMicrocents,
      variacaoPercentual: deltaPercent,
      pratosAfetadosCount: affectedRecipes.length,
    },
    passos: [
      `1. Recalculadas todas as fichas com o novo preço de ${targetIng.name} (${deltaPercent > 0 ? '+' : ''}${deltaPercent}%).`,
      `2. ${affectedRecipes.length} receitas dependem direta ou indiretamente deste insumo.`,
      `3. Impacto total ponderado pelo volume de vendas do período: ${formatCentsToCurrency(Math.abs(totalDeltaProfitCents))} ${totalDeltaProfitCents <= 0 ? 'a menos no lucro' : 'de economia'}.`,
    ],
    suficienciaDeDados: {
      suficiente: true,
      percentualConfiabilidade: 100,
    },
    confianca: 'ALTA',
  };

  return {
    ingredientId: targetIngredientId,
    ingredientName: targetIng.name,
    originalUnitCostMicrocents: originalMicrocents,
    simulatedUnitCostMicrocents: newUnitCostMicrocents,
    priceDeltaPercentage: deltaPercent,
    deltaMonthlyProfitInCents: totalDeltaProfitCents,
    affectedRecipes,
    explanation,
  };
}

/**
 * F02: Quem Manda no seu Lucro (Ranking de Sensibilidade)
 * Mede o impacto de +10% no custo unitário de cada insumo sobre o CMV teórico.
 */
export function calculateSensitivityRanking(
  ingredients: Ingredient[],
  recipes: Recipe[],
  monthlySalesVolumeByRecipeId: Record<string, number>
): SensitivityRankingResult {
  const ingMap = new Map<string, Ingredient>(ingredients.map((i) => [i.id, i]));
  const recMap = new Map<string, Recipe>(recipes.map((r) => [r.id, r]));

  // Função auxiliar recursiva para calcular consumo bruto de insumo por porção de receita
  function getIngredientConsumptionPerPortion(
    recipe: Recipe,
    targetIngId: string,
    visited = new Set<string>()
  ): number {
    if (visited.has(recipe.id)) throw new RecipeCycleError([recipe.name]);
    visited.add(recipe.id);

    let total = 0;
    for (const line of recipe.lines) {
      if (line.ingredientId === targetIngId) {
        total += line.quantityInBaseUnit * line.correctionFactor;
      } else if (line.subRecipeId) {
        const sub = recMap.get(line.subRecipeId);
        if (sub) {
          const subConsumption = getIngredientConsumptionPerPortion(sub, targetIngId, new Set(visited));
          const subYield = sub.yieldPortions > 0 ? sub.yieldPortions : 1;
          total += (subConsumption / subYield) * line.quantityInBaseUnit * line.correctionFactor;
        }
      }
    }
    return total / (recipe.yieldPortions > 0 ? recipe.yieldPortions : 1);
  }

  const items: SensitivityRankingResult['items'] = [];
  let totalTheoreticalCmv = 0;

  for (const ing of ingredients) {
    let monthlyConsumption = 0;
    for (const rec of recipes) {
      if (rec.isSubRecipe) continue;
      const sales = monthlySalesVolumeByRecipeId[rec.id] || 0;
      if (sales > 0) {
        const perPortion = getIngredientConsumptionPerPortion(rec, ing.id);
        monthlyConsumption += perPortion * sales;
      }
    }

    if (monthlyConsumption > 0) {
      // Gasto mensal em centavos: (consumo * microcentavos) / 10000
      const spendInCents = Math.round((monthlyConsumption * ing.currentUnitCostMicrocents) / 10000);
      const impactTenPercent = Math.round(spendInCents * 0.10);

      totalTheoreticalCmv += spendInCents;

      items.push({
        ingredientId: ing.id,
        ingredientName: ing.name,
        baseUnit: ing.baseUnit,
        monthlyTheoreticalConsumption: Number(monthlyConsumption.toFixed(2)),
        currentUnitCostMicrocents: ing.currentUnitCostMicrocents,
        monthlySpendInCents: spendInCents,
        impactTenPercentInCents: impactTenPercent,
        percentOfTotalCmv: 0, // calculado abaixo
      });
    }
  }

  // Preencher percentuais de CMV
  for (const item of items) {
    item.percentOfTotalCmv = totalTheoreticalCmv > 0
      ? Number(((item.monthlySpendInCents / totalTheoreticalCmv) * 100).toFixed(1))
      : 0;
  }

  // Ordenar decrescente pelo impacto financeiro
  items.sort((a, b) => b.impactTenPercentInCents - a.impactTenPercentInCents);

  const top10Risk = items.slice(0, 10).reduce((acc, curr) => acc + curr.impactTenPercentInCents, 0);

  const explanation: DomainExplanation<number> = {
    valor: top10Risk,
    unidade: 'centavos',
    formula: 'Impacto_10% = 0,10 × GastoMensal(insumo) = 0,10 × Σ(consumo × vendas × custo_unitário)',
    entradas: {
      totalInsumosUtilizados: items.length,
      cmvTeoricoTotalEmCentavos: totalTheoreticalCmv,
      top10InsumosRiscoCentavos: top10Risk,
    },
    passos: [
      `1. O CMV teórico total mensal calculado a partir das fichas é de ${formatCentsToCurrency(totalTheoreticalCmv)}.`,
      `2. Os 10 insumos mais críticos concentram ${formatCentsToCurrency(top10Risk)} de impacto a cada 10% de reajuste.`,
      `3. O insumo número 1 em impacto é "${items[0]?.ingredientName || 'Nenhum'}" representando ${items[0]?.percentOfTotalCmv || 0}% de todo o CMV.`,
    ],
    suficienciaDeDados: {
      suficiente: items.length > 0,
      faltam: items.length === 0 ? 'Faltam fichas técnicas associadas aos produtos vendidos.' : undefined,
      percentualConfiabilidade: items.length > 0 ? 100 : 0,
    },
    confianca: items.length > 0 ? 'ALTA' : 'INSUFICIENTE',
  };

  return {
    items,
    totalTheoreticalCmvInCents: totalTheoreticalCmv,
    top10RiskInCents: top10Risk,
    explanation,
  };
}

/**
 * F03: Reajuste para Manter a Margem
 * Preço_novo = Custo_novo / (1 - Margem_alvo). Queda máxima de volume tolerável = 1 - MC/MC'.
 */
export function calculateMarginReadjustment(
  recipe: Recipe,
  currentCostInCents: number,
  newCostInCents: number,
  targetMarginPercentage = recipe.targetMarginPercentage,
  applyCommercialEnding = true
): MarginReadjustmentResult {
  if (targetMarginPercentage >= 100 || targetMarginPercentage <= 0) {
    throw new Error('A margem-alvo deve ser estritamente maior que 0% e menor que 100%.');
  }

  const marginFactor = 1 - targetMarginPercentage / 100;
  let rawNewPrice = Math.ceil(newCostInCents / marginFactor);

  if (applyCommercialEnding) {
    // Terminar em ,90 comercial (ex: 4500 vira 4490 ou 4590)
    const reais = Math.floor(rawNewPrice / 100);
    rawNewPrice = reais * 100 + 90;
    if (rawNewPrice < Math.ceil(newCostInCents / marginFactor)) {
      rawNewPrice += 100;
    }
  }

  const currentPrice = recipe.salePriceInCents;
  const currentMc = currentPrice - currentCostInCents;
  const newMc = rawNewPrice - newCostInCents;

  if (newMc <= 0) {
    throw new Error('Erro de Domínio: O novo preço calculado não cobre os custos variáveis da porção.');
  }

  // Queda máxima tolerável de volume: 1 - (MC_antiga / MC_nova)
  const maxVolumeDrop = currentMc > 0
    ? Math.max(0, Number(((1 - (currentMc / newMc)) * 100).toFixed(1)))
    : 0;

  const readjustmentPercent = currentPrice > 0
    ? Number((((rawNewPrice - currentPrice) / currentPrice) * 100).toFixed(1))
    : 0;

  const explanation: DomainExplanation<number> = {
    valor: rawNewPrice,
    unidade: 'centavos',
    formula: 'Preço_novo = Custo_novo / (1 - Margem_alvo); Queda_max_volume = 1 - MC_antiga / MC_nova',
    entradas: {
      prato: recipe.name,
      custoOriginalCentavos: currentCostInCents,
      custoNovoCentavos: newCostInCents,
      margemAlvo: targetMarginPercentage,
      mcAntigaCentavos: currentMc,
      mcNovaCentavos: newMc,
    },
    passos: [
      `1. O custo da porção subiu de ${formatCentsToCurrency(currentCostInCents)} para ${formatCentsToCurrency(newCostInCents)}.`,
      `2. Para preservar a margem-alvo de ${targetMarginPercentage}%, o preço sugerido é de ${formatCentsToCurrency(rawNewPrice)} (reajuste de ${readjustmentPercent}%).`,
      `3. A nova margem de contribuição unitária é de ${formatCentsToCurrency(newMc)}.`,
      `4. Você pode perder até ${maxVolumeDrop}% das vendas desse prato e o seu lucro em reais continuará idêntico ao anterior.`,
    ],
    suficienciaDeDados: {
      suficiente: true,
      percentualConfiabilidade: 100,
    },
    confianca: 'ALTA',
  };

  return {
    recipeId: recipe.id,
    recipeName: recipe.name,
    currentPriceInCents: currentPrice,
    currentCostInCents: currentCostInCents,
    newCostInCents: newCostInCents,
    targetMarginPercentage,
    suggestedNewPriceInCents: rawNewPrice,
    readjustmentPercentage: readjustmentPercent,
    currentContributionMarginInCents: currentMc,
    newContributionMarginInCents: newMc,
    maxTolerableVolumeDropPercentage: maxVolumeDrop,
    explanation,
  };
}

/**
 * F07: Índice de Inflação da Cozinha (Laspeyres)
 * I = 100 * Σ(p1 * q0) / Σ(p0 * q0)
 */
export function calculateKitchenInflationLaspeyres(
  basketItems: {
    ingredientId: string;
    ingredientName: string;
    baseUnitQuantityQ0: number;
    basePriceP0Microcents: number;
    currentPriceP1Microcents: number;
  }[],
  menuAveragePriceChangePercentage = 0,
  basePeriodCmvInCents = 0
): KitchenInflationResult {
  if (basketItems.length === 0) {
    return {
      indexLaspeyres: 100,
      menuAveragePriceChangePercentage: 0,
      gapMonthlyInCents: 0,
      basePeriodCmvInCents: 0,
      explanation: {
        valor: 100,
        unidade: 'índice',
        formula: 'I = 100 × Σ(p1·q0) / Σ(p0·q0)',
        entradas: {},
        passos: ['Sem dados de consumo na cesta base.'],
        suficienciaDeDados: { suficiente: false, faltam: 'Cesta base de insumos vazia.', percentualConfiabilidade: 0 },
        confianca: 'INSUFICIENTE',
      },
    };
  }

  let numerator = 0;
  let denominator = 0;

  for (const item of basketItems) {
    numerator += item.baseUnitQuantityQ0 * item.currentPriceP1Microcents;
    denominator += item.baseUnitQuantityQ0 * item.basePriceP0Microcents;
  }

  const indexLaspeyres = denominator > 0
    ? Number(((numerator / denominator) * 100).toFixed(2))
    : 100.0;

  const costInflationPerc = (indexLaspeyres - 100) / 100;
  const priceChangePerc = menuAveragePriceChangePercentage / 100;
  const gapPercentage = costInflationPerc - priceChangePerc;
  const gapMonthlyInCents = Math.round(gapPercentage * basePeriodCmvInCents);

  const explanation: DomainExplanation<number> = {
    valor: indexLaspeyres,
    unidade: 'índice',
    formula: 'I = 100 × Σ(p1·q0) / Σ(p0·q0); Gap = (InflaçãoCusto% - ReajustePreço%) × CMV_base',
    entradas: {
      totalItensCesta: basketItems.length,
      indiceLaspeyres: indexLaspeyres,
      reajusteCardapioPerc: menuAveragePriceChangePercentage,
      cmvBaseCentavos: basePeriodCmvInCents,
    },
    passos: [
      `1. O custo da cesta base de insumos variou de ${formatCentsToCurrency(Math.round(denominator / 10000))} para ${formatCentsToCurrency(Math.round(numerator / 10000))}.`,
      `2. Índice de inflação da cozinha: ${indexLaspeyres} (${indexLaspeyres >= 100 ? '+' : ''}${(indexLaspeyres - 100).toFixed(2)}%).`,
      `3. O cardápio foi reajustado em ${menuAveragePriceChangePercentage.toFixed(2)}%.`,
      `4. Gap financeiro apurado: ${gapMonthlyInCents > 0 ? `faltam ${formatCentsToCurrency(gapMonthlyInCents)}/mês para recompor a margem` : 'margem preservada'}.`,
    ],
    suficienciaDeDados: {
      suficiente: true,
      percentualConfiabilidade: 100,
    },
    confianca: 'ALTA',
  };

  return {
    indexLaspeyres,
    menuAveragePriceChangePercentage,
    gapMonthlyInCents,
    basePeriodCmvInCents,
    explanation,
  };
}

/**
 * F04: Simulador de Preço com Elasticidade Informada
 * Varredura discreta de preços para encontrar o ponto de máximo lucro.
 * Se elasticidade não informada, recusa com dados insuficientes.
 */
export function simulatePriceElasticity(
  recipe: Recipe,
  variableCostInCents: number,
  baseMonthlyVolume: number,
  elasticity?: number,
  fixedCostsInCents = 0,
  minDeltaPercent = -30,
  maxDeltaPercent = 50,
  stepPercent = 1
): ElasticitySimulationResult {
  const basePrice = recipe.salePriceInCents;

  if (elasticity === undefined || elasticity === null) {
    const explanation: DomainExplanation<number> = {
      valor: 0,
      unidade: 'centavos',
      formula: "V' = max(0, V0 × (1 + ε × Δp%)); Lucro' = (P' - CV) × V' - CF",
      entradas: {
        prato: recipe.name,
        precoBaseCentavos: basePrice,
        custoVariavelCentavos: variableCostInCents,
        volumeBase: baseMonthlyVolume,
      },
      passos: [
        'A elasticidade-preço da demanda não foi informada pelo dono.',
        'O cálculo exige a elasticidade (ex: -1.2 para bens elásticos ou -0.5 para inelásticos) para não inventar dados fictícios.',
      ],
      suficienciaDeDados: {
        suficiente: false,
        faltam: 'Informe o coeficiente de elasticidade-preço nas configurações ou na simulação.',
        percentualConfiabilidade: 0,
      },
      confianca: 'INSUFICIENTE',
    };

    return {
      recipeId: recipe.id,
      recipeName: recipe.name,
      basePriceInCents: basePrice,
      variableCostInCents,
      baseVolume: baseMonthlyVolume,
      points: [],
      explanation,
    };
  }

  const points: ElasticitySimulationPoint[] = [];
  let optimalPoint: ElasticitySimulationPoint | undefined = undefined;
  let maxProfit = -Infinity;

  for (let delta = minDeltaPercent; delta <= maxDeltaPercent; delta += stepPercent) {
    const deltaRatio = delta / 100;
    const simPrice = Math.round(basePrice * (1 + deltaRatio));
    // volume' = volume * (1 + ε * deltaP%)
    const volumeFactor = 1 + elasticity * deltaRatio;
    const simVolume = Math.max(0, Math.round(baseMonthlyVolume * volumeFactor));
    const mc = simPrice - variableCostInCents;
    const grossProfit = mc * simVolume - fixedCostsInCents;

    const pt: ElasticitySimulationPoint = {
      deltaPercentage: delta,
      simulatedPriceInCents: simPrice,
      simulatedVolume: simVolume,
      contributionMarginInCents: mc,
      grossProfitInCents: grossProfit,
    };

    points.push(pt);

    if (grossProfit > maxProfit) {
      maxProfit = grossProfit;
      optimalPoint = pt;
    }
  }

  const explanation: DomainExplanation<number> = {
    valor: optimalPoint ? optimalPoint.simulatedPriceInCents : basePrice,
    unidade: 'centavos',
    formula: "V' = max(0, V0 × (1 + ε × Δp%)); P* = argmax (MC' × V' - CF)",
    entradas: {
      prato: recipe.name,
      precoBaseCentavos: basePrice,
      custoVariavelCentavos: variableCostInCents,
      volumeBase: baseMonthlyVolume,
      elasticidade: elasticity,
      intervaloTestado: `${minDeltaPercent}% a ${maxDeltaPercent}%`,
    },
    passos: [
      `1. Preço base atual: ${formatCentsToCurrency(basePrice)} com volume mensal de ${baseMonthlyVolume} unidades.`,
      `2. Coeficiente de elasticidade aplicado: ${elasticity}.`,
      optimalPoint
        ? `3. Preço ótimo encontrado: ${formatCentsToCurrency(optimalPoint.simulatedPriceInCents)} (${optimalPoint.deltaPercentage > 0 ? '+' : ''}${optimalPoint.deltaPercentage}%), gerando lucro de ${formatCentsToCurrency(optimalPoint.grossProfitInCents)} com volume estimado de ${optimalPoint.simulatedVolume} unidades.`
        : '3. Nenhum ponto ótimo viável.',
    ],
    suficienciaDeDados: {
      suficiente: true,
      percentualConfiabilidade: 100,
    },
    confianca: 'ALTA',
  };

  return {
    recipeId: recipe.id,
    recipeName: recipe.name,
    basePriceInCents: basePrice,
    variableCostInCents,
    baseVolume: baseMonthlyVolume,
    elasticity,
    optimalPoint,
    points,
    explanation,
  };
}

/**
 * F05: Preço Mínimo por Canal de Venda
 * Preço_mín = (Custo_prato + Embalagem) / (1 - Margem_alvo - Comissao - Taxa_pagamento - Imposto)
 */
export function calculateMinimumPriceByChannel(
  recipe: Recipe,
  portionCostInCents: number,
  packagingCostInCents: number,
  targetMarginPercentage: number,
  platformCommissionPercentage: number,
  paymentFeePercentage: number,
  variableTaxPercentage: number,
  channelName = 'Canal'
): ChannelMinimumPriceResult {
  const directCost = portionCostInCents + packagingCostInCents;
  
  // Cálculo em base de alta precisão (basis points / 10000) para evitar artefatos de float
  const deductionBps = Math.round(
    (targetMarginPercentage +
      platformCommissionPercentage +
      paymentFeePercentage +
      variableTaxPercentage) *
      100
  );

  const denominatorBps = 10000 - deductionBps;

  if (denominatorBps <= 0) {
    const explanation: DomainExplanation<number> = {
      valor: 0,
      unidade: 'centavos',
      formula: 'P_mín = (C_prato + C_emb) / (1 - Margem - Comissão - Taxa - Imposto)',
      entradas: {
        prato: recipe.name,
        canal: channelName,
        custoDiretoCentavos: directCost,
        somaDeducoesPercentual: Number((deductionBps / 100).toFixed(2)),
      },
      passos: [
        `As deduções variáveis somam ${(deductionBps / 100).toFixed(1)}%, excedendo 100% da receita.`,
        `É matematicamente impossível manter a margem líquida de ${targetMarginPercentage}% com as taxas deste canal.`,
      ],
      suficienciaDeDados: {
        suficiente: true,
        percentualConfiabilidade: 100,
      },
      confianca: 'ALTA',
    };

    return {
      channelName,
      portionCostInCents,
      packagingCostInCents,
      directCostInCents: directCost,
      targetMarginPercentage,
      platformCommissionPercentage,
      paymentFeePercentage,
      variableTaxPercentage,
      isImpossible: true,
      minimumPriceInCents: 0,
      channelMarginInCents: 0,
      netMarginPercentage: 0,
      explanation,
    };
  }

  const minPriceInCents = Math.ceil((directCost * 10000) / denominatorBps);
  const platformFee = Math.round((minPriceInCents * Math.round(platformCommissionPercentage * 100)) / 10000);
  const payFee = Math.round((minPriceInCents * Math.round(paymentFeePercentage * 100)) / 10000);
  const taxFee = Math.round((minPriceInCents * Math.round(variableTaxPercentage * 100)) / 10000);
  const channelMarginInCents = minPriceInCents - platformFee - payFee - taxFee - directCost;
  const netMarginPercentage = minPriceInCents > 0
    ? Number(((channelMarginInCents / minPriceInCents) * 100).toFixed(2))
    : 0;

  const explanation: DomainExplanation<number> = {
    valor: minPriceInCents,
    unidade: 'centavos',
    formula: 'P_mín = ⌈(C_prato + C_emb) / (1 - m_alvo - t_com - t_pag - t_imp)⌉',
    entradas: {
      prato: recipe.name,
      canal: channelName,
      custoPratoCentavos: portionCostInCents,
      custoEmbalagemCentavos: packagingCostInCents,
      custoDiretoCentavos: directCost,
      margemAlvo: targetMarginPercentage,
      comissao: platformCommissionPercentage,
      taxaPagamento: paymentFeePercentage,
      imposto: variableTaxPercentage,
    },
    passos: [
      `1. Custo direto total (insumos + embalagem): ${formatCentsToCurrency(directCost)}.`,
      `2. Taxas totais do canal: comissão (${platformCommissionPercentage}%) + pagamento (${paymentFeePercentage}%) + impostos (${variableTaxPercentage}%) + margem (${targetMarginPercentage}%) = ${(deductionBps / 100).toFixed(1)}%.`,
      `3. Preço mínimo viável: ${formatCentsToCurrency(minPriceInCents)}.`,
      `4. No canal ${channelName}, cada prato deixa ${formatCentsToCurrency(channelMarginInCents)} limpos (${netMarginPercentage}% de margem líquida).`,
    ],
    suficienciaDeDados: {
      suficiente: true,
      percentualConfiabilidade: 100,
    },
    confianca: 'ALTA',
  };

  return {
    channelName,
    portionCostInCents,
    packagingCostInCents,
    directCostInCents: directCost,
    targetMarginPercentage,
    platformCommissionPercentage,
    paymentFeePercentage,
    variableTaxPercentage,
    isImpossible: false,
    minimumPriceInCents: minPriceInCents,
    channelMarginInCents,
    netMarginPercentage,
    explanation,
  };
}

/**
 * F06: Preço de Combo e Desconto Máximo Seguro
 * Custo_combo = Σ custos. Preço_mín = Custo / (1 - Margem_mín). Desconto_máx = 1 - Preço_mín / Σ avulsos.
 */
export function calculateComboPricing(
  comboName: string,
  items: {
    recipeId: string;
    recipeName: string;
    costInCents: number;
    regularPriceInCents: number;
  }[],
  minimumTargetMarginPercentage: number,
  simulatedDiscountPercentage = 15
): ComboPricingResult {
  const totalCost = items.reduce((acc, curr) => acc + curr.costInCents, 0);
  const totalRegularPrice = items.reduce((acc, curr) => acc + curr.regularPriceInCents, 0);

  if (minimumTargetMarginPercentage >= 100 || minimumTargetMarginPercentage <= 0) {
    throw new Error('A margem mínima deve estar estritamente entre 0% e 100%.');
  }

  const marginFactor = 1 - minimumTargetMarginPercentage / 100;
  const minComboPrice = Math.ceil(totalCost / marginFactor);

  const maxSafeDiscount = totalRegularPrice > 0
    ? Math.max(0, Number(((1 - (minComboPrice / totalRegularPrice)) * 100).toFixed(2)))
    : 0;

  const simDiscountFactor = 1 - simulatedDiscountPercentage / 100;
  const simulatedComboPrice = Math.floor(totalRegularPrice * simDiscountFactor);
  const simulatedMargin = simulatedComboPrice > 0
    ? Number((((simulatedComboPrice - totalCost) / simulatedComboPrice) * 100).toFixed(2))
    : 0;

  const isSafe = simulatedMargin >= minimumTargetMarginPercentage;

  const explanation: DomainExplanation<number> = {
    valor: maxSafeDiscount,
    unidade: '%',
    formula: 'd_máx = 1 - (Custo_combo / (1 - m_mín)) / Σ P_avulsos',
    entradas: {
      combo: comboName,
      totalItens: items.length,
      custoTotalCentavos: totalCost,
      somaPrecosAvulsosCentavos: totalRegularPrice,
      margemMinima: minimumTargetMarginPercentage,
      descontoSimulado: simulatedDiscountPercentage,
    },
    passos: [
      `1. O combo reúne ${items.length} itens com custo total de ${formatCentsToCurrency(totalCost)} e soma de preços avulsos de ${formatCentsToCurrency(totalRegularPrice)}.`,
      `2. Para garantir ao menos ${minimumTargetMarginPercentage}% de margem, o preço mínimo do combo é ${formatCentsToCurrency(minComboPrice)}.`,
      `3. O desconto máximo seguro que você pode oferecer é de ${maxSafeDiscount}%.`,
      `4. Ao desconto simulado de ${simulatedDiscountPercentage}%, o combo custa ${formatCentsToCurrency(simulatedComboPrice)} e entrega ${simulatedMargin}% de margem (${isSafe ? 'SEGURO' : 'ABAIXO DA MARGEM MÍNIMA'}).`,
    ],
    suficienciaDeDados: {
      suficiente: items.length > 0,
      faltam: items.length === 0 ? 'Nenhum item selecionado para o combo.' : undefined,
      percentualConfiabilidade: items.length > 0 ? 100 : 0,
    },
    confianca: items.length > 0 ? 'ALTA' : 'INSUFICIENTE',
  };

  return {
    comboName,
    items,
    totalCostInCents: totalCost,
    totalRegularPriceInCents: totalRegularPrice,
    minimumTargetMarginPercentage,
    minimumComboPriceInCents: minComboPrice,
    maxSafeDiscountPercentage: maxSafeDiscount,
    simulatedDiscountPercentage,
    simulatedComboPriceInCents: simulatedComboPrice,
    simulatedMarginPercentage: simulatedMargin,
    isSafe,
    explanation,
  };
}

