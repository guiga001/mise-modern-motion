/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Mise — F45: Edição em Lote com Pré-visualização de Margem e Desfazer Atômico
 */

import { Recipe, Ingredient } from './types';
import { DomainExplanation, BatchEditPreviewResult, BatchEditItemPreview } from './insights-types';
import { formatCentsToCurrency } from './units';

export interface BatchEditOptions {
  percentageChange?: number; // ex: +10%
  fixedCentsChange?: number; // ex: +200 centavos
  forceCommercialNinetyEnding?: boolean; // terminar em ,90
  monthlyVolumeByRecipeId?: Record<string, number>;
  recipeCostByRecipeId?: Record<string, number>;
}

export interface BatchEditUndoState {
  id: string;
  timestamp: string;
  targetType: 'RECIPE_PRICE' | 'INGREDIENT_COST';
  previousValues: Record<string, number>; // id -> valor original
}

/**
 * F45: Pré-visualização de Edição em Lote
 * Simula novos preços de receitas ou custos de insumos antes de gravar.
 */
export function previewBatchEdit(
  items: (Recipe | Ingredient)[],
  targetType: 'RECIPE_PRICE' | 'INGREDIENT_COST',
  options: BatchEditOptions
): BatchEditPreviewResult {
  const percentage = options.percentageChange || 0;
  const fixedChange = options.fixedCentsChange || 0;
  const forceNinety = options.forceCommercialNinetyEnding ?? false;

  const previewItems: BatchEditItemPreview[] = [];
  let totalRevenueImpact = 0;

  for (const it of items) {
    let currentVal = 0;
    let cost = 0;

    if (targetType === 'RECIPE_PRICE') {
      const rec = it as Recipe;
      currentVal = rec.salePriceInCents;
      cost = options.recipeCostByRecipeId?.[rec.id] || 0;
    } else {
      const ing = it as Ingredient;
      currentVal = Math.round(ing.currentUnitCostMicrocents / 10000); // centavos
    }

    // 1. Aplicação de percentual e acréscimo fixo
    let newVal = Math.floor(currentVal * (1 + percentage / 100)) + fixedChange;

    // 2. Terminação comercial ,90
    if (forceNinety && targetType === 'RECIPE_PRICE') {
      const reais = Math.floor(newVal / 100);
      const ninety = reais * 100 + 90;
      newVal = ninety >= newVal ? ninety : ninety + 100;
    }

    // Não permitir valor negativo
    if (newVal < 0) newVal = 0;

    const delta = newVal - currentVal;
    const deltaPerc = currentVal > 0 ? Number(((delta / currentVal) * 100).toFixed(1)) : 0;

    let curMargin: number | undefined = undefined;
    let simMargin: number | undefined = undefined;

    if (targetType === 'RECIPE_PRICE') {
      const vol = options.monthlyVolumeByRecipeId?.[it.id] || 0;
      totalRevenueImpact += delta * vol;

      if (currentVal > 0) curMargin = Number((((currentVal - cost) / currentVal) * 100).toFixed(1));
      if (newVal > 0) simMargin = Number((((newVal - cost) / newVal) * 100).toFixed(1));
    }

    previewItems.push({
      id: it.id,
      name: it.name,
      currentValueInCents: currentVal,
      simulatedValueInCents: newVal,
      deltaInCents: delta,
      deltaPercentage: deltaPerc,
      currentMarginPercentage: curMargin,
      simulatedMarginPercentage: simMargin,
    });
  }

  const explanation: DomainExplanation<number> = {
    valor: totalRevenueImpact,
    unidade: 'centavos',
    formula: 'V_novo = ⌊V_atual × (1 + Δ%)⌋ + Δfixo; Ajuste ,90; ΔReceita = Σ ΔPreço × Volume',
    entradas: {
      tipoEdicao: targetType,
      itensAfetados: items.length,
      variacaoPercentual: `${percentage}%`,
      acrescimoFixoCentavos: fixedChange,
      terminacaoComercial90: forceNinety,
    },
    passos: [
      `1. Pré-visualizados ${items.length} itens com ajuste de ${percentage > 0 ? '+' : ''}${percentage}%.`,
      forceNinety ? '2. Aplicada regra comercial de terminação em ,90 para venda ao consumidor.' : '2. Arredondamento contábil padrão.',
      `3. Impacto mensal projetado no faturamento: ${formatCentsToCurrency(totalRevenueImpact)}.`,
    ],
    suficienciaDeDados: {
      suficiente: items.length > 0,
      percentualConfiabilidade: 100,
    },
    confianca: 'ALTA',
  };

  return {
    targetType,
    items: previewItems,
    totalEstimatedRevenueImpactInCents: totalRevenueImpact,
    explanation,
  };
}

/**
 * Cria snapshot atômico para possibilitar desfazimento (Undo) completo
 */
export function createBatchEditUndoSnapshot(
  items: (Recipe | Ingredient)[],
  targetType: 'RECIPE_PRICE' | 'INGREDIENT_COST'
): BatchEditUndoState {
  const previousValues: Record<string, number> = {};

  for (const it of items) {
    if (targetType === 'RECIPE_PRICE') {
      previousValues[it.id] = (it as Recipe).salePriceInCents;
    } else {
      previousValues[it.id] = (it as Ingredient).currentUnitCostMicrocents;
    }
  }

  return {
    id: `undo_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toISOString(),
    targetType,
    previousValues,
  };
}
