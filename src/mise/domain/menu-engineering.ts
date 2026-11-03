/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Mise — Engenharia de Cardápio (Matriz Kasavana & Smith)
 * Classifica produtos em: Estrelas, Burros de Carga, Enigmas e Cães.
 */

import { MenuEngineeringItem, Recipe, SalesImport } from './types';
import { RecipeCostBreakdown } from './recipe';

/**
 * Calcula a Matriz de Engenharia de Cardápio cruzando popularidade (volume) e rentabilidade (margem unitária).
 */
export function calculateMenuEngineering(
  recipes: Recipe[],
  costsMap: Map<string, RecipeCostBreakdown>,
  salesImports: SalesImport[],
  storeId: string = 'CONSOLIDATED'
): MenuEngineeringItem[] {
  const isMatchStore = (sId: string) => storeId === 'CONSOLIDATED' || sId === storeId;

  // 1. Contabilizar volume de vendas de cada receita a partir dos relatórios importados
  const volumeMap = new Map<string, number>();
  for (const sale of salesImports.filter(s => isMatchStore(s.storeId))) {
    for (const line of sale.lines) {
      if (line.mappedRecipeId) {
        const cur = volumeMap.get(line.mappedRecipeId) || 0;
        volumeMap.set(line.mappedRecipeId, cur + line.quantity);
      }
    }
  }

  // Filtrar apenas produtos que têm ficha técnica e preço de venda (não sub-receitas)
  const sellableRecipes = recipes.filter(r => !r.isSubRecipe && r.salePriceInCents > 0);
  if (sellableRecipes.length === 0) return [];

  // 2. Coletar dados brutos
  let totalVolume = 0;
  let totalContributionMarginInCents = 0;

  const rawItems = sellableRecipes.map(recipe => {
    const costData = costsMap.get(recipe.id);
    const unitCmvInCents = costData ? costData.portionCostInCents : 0;
    const salePriceInCents = recipe.salePriceInCents;
    const unitMarginInCents = Math.max(0, salePriceInCents - unitCmvInCents);
    const volume = volumeMap.get(recipe.id) || 0;

    totalVolume += volume;
    totalContributionMarginInCents += (unitMarginInCents * volume);

    const marginPercentage = salePriceInCents > 0 
      ? Math.round((unitMarginInCents / salePriceInCents) * 1000) / 10 
      : 0;

    return {
      recipe,
      volume,
      salePriceInCents,
      unitCmvInCents,
      unitMarginInCents,
      marginPercentage,
    };
  });

  // 3. Definir limites (benchmarks) da matriz
  // Popularidade média: (1 / n) * 70% da média esperada de vendas
  const averageVolume = rawItems.length > 0 ? (totalVolume / rawItems.length) * 0.70 : 0;
  // Margem média ponderada por item
  const averageMarginInCents = totalVolume > 0 
    ? Math.round(totalContributionMarginInCents / totalVolume) 
    : (rawItems.length > 0 ? Math.round(rawItems.reduce((acc, i) => acc + i.unitMarginInCents, 0) / rawItems.length) : 0);

  // 4. Classificar cada item no quadrante correspondente
  return rawItems.map(item => {
    const isHighVolume = item.volume >= averageVolume && item.volume > 0;
    const isHighMargin = item.unitMarginInCents >= averageMarginInCents;

    let quadrant: MenuEngineeringItem['quadrant'] = 'DOG';
    let recommendation = '';

    if (isHighVolume && isHighMargin) {
      quadrant = 'STAR';
      recommendation = 'Estrela: Alta venda e alta margem! Mantenha a qualidade da ficha técnica intacta e dê visibilidade no cardápio.';
    } else if (isHighVolume && !isHighMargin) {
      quadrant = 'PLOWHORSE';
      recommendation = 'Burro de Carga: Muito vendido mas margem baixa! Aumente levemente o preço (R$ 1 a R$ 3) ou renegocie insumos principais.';
    } else if (!isHighVolume && isHighMargin) {
      quadrant = 'PUZZLE';
      recommendation = 'Enigma: Margem excelente mas vende pouco! Destaque na foto, faça combos ou treine garçons para sugestão ativa.';
    } else {
      quadrant = 'DOG';
      recommendation = 'Cão: Pouco vendido e pouca margem! Considere retirar do cardápio para desocupar insumos e simplificar a operação.';
    }

    return {
      recipeId: item.recipe.id,
      name: item.recipe.name,
      category: item.recipe.category || 'Geral',
      salesVolume: item.volume,
      salePriceInCents: item.salePriceInCents,
      unitCmvInCents: item.unitCmvInCents,
      unitContributionMarginInCents: item.unitMarginInCents,
      marginPercentage: item.marginPercentage,
      quadrant,
      recommendation,
    };
  });
}
