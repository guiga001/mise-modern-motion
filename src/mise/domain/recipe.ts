/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Mise — Ficha Técnica & Cálculo de CMV Real
 * Suporta: Rendimento, Fator de Correção (perdas limpas), Fator de Cocção,
 * Sub-receitas aninhadas com detecção estrita de ciclos e simulador de preço sugerido.
 */

import { Ingredient, Recipe, RecipeLine } from './types';

export class RecipeCycleError extends Error {
  constructor(cyclePath: string[]) {
    super(`Ciclo detectado na composição da ficha técnica: ${cyclePath.join(' -> ')}`);
    this.name = 'RecipeCycleError';
  }
}

export interface RecipeCostBreakdown {
  recipeId: string;
  totalCostInCents: number;
  portionCostInCents: number;
  cmvPercentage: number;
  grossMarginInCents: number;
  grossMarginPercentage: number;
  suggestedSalePriceInCents: number;
  lineCosts: {
    lineId: string;
    itemName: string;
    quantityInBaseUnit: number;
    correctionFactor: number;
    grossQuantity: number;
    costInCents: number;
    percentageOfCost: number;
  }[];
}

/**
 * Calcula o custo total e detalhado de uma Ficha Técnica com proteção contra ciclos recursivos.
 */
export function calculateRecipeCost(
  recipe: Recipe,
  ingredientsMap: Map<string, Ingredient>,
  recipesMap: Map<string, Recipe>,
  visitedPath: string[] = []
): RecipeCostBreakdown {
  if (visitedPath.includes(recipe.id)) {
    throw new RecipeCycleError([...visitedPath, recipe.id]);
  }

  const currentPath = [...visitedPath, recipe.id];
  let totalCostMicrocents = 0;
  const lineDetails: RecipeCostBreakdown['lineCosts'] = [];

  for (const line of recipe.lines) {
    let lineCostMicrocents = 0;
    let itemName = 'Item desconhecido';
    const grossQuantity = line.quantityInBaseUnit * (line.correctionFactor || 1);

    if (line.ingredientId) {
      const ingredient = ingredientsMap.get(line.ingredientId);
      if (ingredient) {
        itemName = ingredient.name;
        lineCostMicrocents = grossQuantity * ingredient.currentUnitCostMicrocents;
      }
    } else if (line.subRecipeId) {
      const subRecipe = recipesMap.get(line.subRecipeId);
      if (subRecipe) {
        itemName = `${subRecipe.name} (Sub-receita)`;
        // Calcular custo recursivo da sub-receita
        const subBreakdown = calculateRecipeCost(subRecipe, ingredientsMap, recipesMap, currentPath);
        
        // Se a sub-receita rende em quantidade base (ex: 2000g de molho):
        if (subRecipe.yieldInBaseUnit && subRecipe.yieldInBaseUnit > 0) {
          const costPerUnitMicrocents = (subBreakdown.totalCostInCents * 10000) / subRecipe.yieldInBaseUnit;
          lineCostMicrocents = grossQuantity * costPerUnitMicrocents;
        } else {
          // Rendimento em porções
          const costPerPortionMicrocents = (subBreakdown.portionCostInCents * 10000);
          lineCostMicrocents = grossQuantity * costPerPortionMicrocents;
        }
      }
    }

    totalCostMicrocents += lineCostMicrocents;
    const lineCostInCents = Math.round(lineCostMicrocents / 10000);

    lineDetails.push({
      lineId: line.id,
      itemName,
      quantityInBaseUnit: line.quantityInBaseUnit,
      correctionFactor: line.correctionFactor,
      grossQuantity,
      costInCents: lineCostInCents,
      percentageOfCost: 0, // calculado a seguir
    });
  }

  const totalCostInCents = Math.round(totalCostMicrocents / 10000);
  const yieldCount = Math.max(1, recipe.yieldPortions || 1);
  const portionCostInCents = Math.round(totalCostInCents / yieldCount);

  // Percentual de participação de cada insumo no custo
  for (const item of lineDetails) {
    item.percentageOfCost = totalCostInCents > 0
      ? Math.round((item.costInCents / totalCostInCents) * 100)
      : 0;
  }

  // Preço de venda e margens
  const salePrice = recipe.salePriceInCents || 0;
  const cmvPercentage = salePrice > 0 ? Math.round((portionCostInCents / salePrice) * 1000) / 10 : 0;
  const grossMarginInCents = Math.max(0, salePrice - portionCostInCents);
  const grossMarginPercentage = salePrice > 0 ? Math.round((grossMarginInCents / salePrice) * 1000) / 10 : 0;

  // Preço sugerido com base na margem-alvo
  // Exemplo: se margem desejada for 70%, o CMV alvo é 30% -> Preço = Custo / 0.30
  const targetMargin = Math.min(95, Math.max(5, recipe.targetMarginPercentage || 65));
  const targetCmvFactor = (100 - targetMargin) / 100;
  const rawSuggestedPrice = targetCmvFactor > 0 ? Math.round(portionCostInCents / targetCmvFactor) : portionCostInCents * 3;
  
  // Arredondamento comercial inteligente (terminado em .90 ou .00)
  const suggestedSalePriceInCents = roundToCommercialCents(rawSuggestedPrice);

  return {
    recipeId: recipe.id,
    totalCostInCents,
    portionCostInCents,
    cmvPercentage,
    grossMarginInCents,
    grossMarginPercentage,
    suggestedSalePriceInCents,
    lineCosts: lineDetails,
  };
}

/**
 * Arredondamento comercial para preços de cardápio (ex: R$ 24,83 -> R$ 24,90).
 */
export function roundToCommercialCents(cents: number): number {
  if (cents <= 0) return 0;
  const remainder = cents % 100;
  if (remainder <= 20) {
    return Math.floor(cents / 100) * 100; // Arredonda para .00
  }
  if (remainder <= 60) {
    return Math.floor(cents / 100) * 100 + 50; // Arredonda para .50
  }
  return Math.floor(cents / 100) * 100 + 90; // Arredonda para .90
}
