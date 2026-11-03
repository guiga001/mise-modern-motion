/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Mise — Motor de Estoque, Custo Médio Ponderado e Curva ABC
 * Invariante: Saldo de estoque é SEMPRE derivado dos movimentos históricos.
 */

import { Ingredient, StockMovement } from './types';

export interface StockBalanceItem {
  ingredientId: string;
  storeId: string;
  currentBalanceInBaseUnit: number;
  currentUnitCostMicrocents: number;
  totalValueInCents: number;
  isBelowMinimum: boolean;
  minimumStock: number;
}

/**
 * Calcula os saldos atuais de todos os insumos de uma loja a partir da fonte da verdade: movimentos de estoque.
 */
export function calculateStockBalances(
  storeId: string,
  ingredients: Ingredient[],
  movements: StockMovement[]
): Map<string, StockBalanceItem> {
  const balanceMap = new Map<string, StockBalanceItem>();

  // Inicializar saldo para todos os insumos cadastrados
  for (const ing of ingredients) {
    balanceMap.set(ing.id, {
      ingredientId: ing.id,
      storeId,
      currentBalanceInBaseUnit: 0,
      currentUnitCostMicrocents: ing.currentUnitCostMicrocents,
      totalValueInCents: 0,
      isBelowMinimum: false,
      minimumStock: ing.minimumStockInBaseUnit,
    });
  }

  // Processar movimentos em ordem cronológica
  const storeMovements = movements.filter(m => m.storeId === storeId);
  for (const mov of storeMovements) {
    let item = balanceMap.get(mov.ingredientId);
    if (!item) {
      item = {
        ingredientId: mov.ingredientId,
        storeId,
        currentBalanceInBaseUnit: 0,
        currentUnitCostMicrocents: mov.unitCostMicrocents || 0,
        totalValueInCents: 0,
        isBelowMinimum: false,
        minimumStock: 0,
      };
      balanceMap.set(mov.ingredientId, item);
    }

    item.currentBalanceInBaseUnit += mov.quantityInBaseUnit;
    if (mov.unitCostMicrocents > 0) {
      item.currentUnitCostMicrocents = mov.unitCostMicrocents;
    }
  }

  // Atualizar valores totais e alertas de estoque mínimo
  for (const [_, item] of balanceMap) {
    const totalMicrocents = Math.max(0, item.currentBalanceInBaseUnit) * item.currentUnitCostMicrocents;
    item.totalValueInCents = Math.round(totalMicrocents / 10000);
    item.isBelowMinimum = item.currentBalanceInBaseUnit < item.minimumStock;
  }

  return balanceMap;
}

/**
 * Recalcula o Custo Médio Ponderado (CMP) na entrada de um novo lote de compra.
 */
export function calculateMovingAverageCost(
  currentBalanceInBaseUnit: number,
  currentCostMicrocents: number,
  entryQuantityInBaseUnit: number,
  entryCostMicrocents: number
): number {
  if (entryQuantityInBaseUnit <= 0) return currentCostMicrocents;
  
  // Se o saldo anterior for nulo ou negativo, o novo custo médio é o custo da entrada
  if (currentBalanceInBaseUnit <= 0) {
    return entryCostMicrocents;
  }

  const previousTotalMicrocents = currentBalanceInBaseUnit * currentCostMicrocents;
  const entryTotalMicrocents = entryQuantityInBaseUnit * entryCostMicrocents;
  const newTotalQuantity = currentBalanceInBaseUnit + entryQuantityInBaseUnit;

  if (newTotalQuantity <= 0) return entryCostMicrocents;

  return Math.round((previousTotalMicrocents + entryTotalMicrocents) / newTotalQuantity);
}

export interface AbcCurveItem {
  ingredientId: string;
  name: string;
  totalConsumedValueInCents: number;
  cumulativePercentage: number;
  classification: 'A' | 'B' | 'C';
}

/**
 * Calcula a Curva ABC de Insumos com base no valor financeiro movimentado/consumido.
 * Classe A: até 80% do valor acumulado (itens críticos para controle de custo e cotações)
 * Classe B: próximos 15% (80% a 95%)
 * Classe C: últimos 5% (95% a 100%)
 */
export function calculateAbcCurve(
  ingredients: Ingredient[],
  movements: StockMovement[]
): AbcCurveItem[] {
  const consumptionMap = new Map<string, number>();

  for (const mov of movements) {
    if (mov.quantityInBaseUnit < 0) {
      // Saída (consumo ou perda)
      const value = Math.abs(mov.totalCostInCents);
      const current = consumptionMap.get(mov.ingredientId) || 0;
      consumptionMap.set(mov.ingredientId, current + value);
    }
  }

  const items = ingredients.map(ing => ({
    ingredientId: ing.id,
    name: ing.name,
    totalConsumedValueInCents: consumptionMap.get(ing.id) || 0,
    cumulativePercentage: 0,
    classification: 'C' as 'A' | 'B' | 'C',
  }));

  // Ordenar decrescente por valor consumido
  items.sort((a, b) => b.totalConsumedValueInCents - a.totalConsumedValueInCents);

  const grandTotal = items.reduce((acc, curr) => acc + curr.totalConsumedValueInCents, 0);

  if (grandTotal === 0) {
    return items;
  }

  let accumulated = 0;
  for (const item of items) {
    accumulated += item.totalConsumedValueInCents;
    const percentage = (accumulated / grandTotal) * 100;
    item.cumulativePercentage = Math.round(percentage * 10) / 10;

    if (percentage <= 80) {
      item.classification = 'A';
    } else if (percentage <= 95) {
      item.classification = 'B';
    } else {
      item.classification = 'C';
    }
  }

  return items;
}
