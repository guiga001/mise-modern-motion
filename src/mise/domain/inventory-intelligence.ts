/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Mise — F13, F14: Inteligência Pura de Estoque (Variância de Uso e Risco FEFO)
 */

import { Ingredient, InventoryCount, StockLot, StockMovement, Recipe, SalesImport } from './types';
import {
  DomainExplanation,
  UsageVarianceReport,
  UsageVarianceItem,
  FefoRiskReport,
  FefoRiskItem,
} from './insights-types';
import { formatCentsToCurrency } from './units';

/**
 * F13: Variância de Uso (Teórico × Real)
 * Compara consumo teórico das vendas com consumo real apurado entre 2 contagens físicas de estoque.
 */
export function calculateUsageVariance(
  inventoryCounts: InventoryCount[],
  stockMovements: StockMovement[],
  salesImports: SalesImport[],
  recipesMap: Map<string, Recipe>,
  ingredientsMap: Map<string, Ingredient>,
  storeId?: string
): UsageVarianceReport {
  // Filtrar contagens confirmadas (COMMITTED)
  const committedCounts = inventoryCounts
    .filter((c) => c.status === 'COMMITTED' && (!storeId || storeId === 'CONSOLIDATED' || c.storeId === storeId))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  if (committedCounts.length < 2) {
    const explanation: DomainExplanation<number> = {
      valor: 0,
      unidade: 'centavos',
      formula: 'Variância = Real - Teórico; Real = EstoqueInicial + Entradas - EstoqueFinal',
      entradas: { contagensEncontradas: committedCounts.length },
      passos: ['Dados insuficientes: são necessárias no mínimo duas contagens físicas confirmadas para apurar a variância real.'],
      suficienciaDeDados: {
        suficiente: false,
        faltam: `Faltam contagens de estoque no período (encontradas ${committedCounts.length}, necessárias 2). Lance ou finalize o inventário físico.`,
        percentualConfiabilidade: committedCounts.length === 1 ? 50 : 0,
      },
      confianca: 'INSUFICIENTE',
    };

    return {
      hasSufficientCounts: false,
      items: [],
      totalDiscrepancyInCents: 0,
      explanation,
    };
  }

  // Pegar as duas contagens mais recentes
  const count0 = committedCounts[committedCounts.length - 2];
  const count1 = committedCounts[committedCounts.length - 1];

  const t0 = new Date(count0.date).getTime();
  const t1 = new Date(count1.date).getTime();

  // Entradas de compras no intervalo [t0, t1]
  const entriesMap = new Map<string, number>();
  for (const mov of stockMovements) {
    if (mov.type === 'PURCHASE_RECEIPT') {
      const mt = new Date(mov.createdAt).getTime();
      if (mt >= t0 && mt <= t1) {
        entriesMap.set(mov.ingredientId, (entriesMap.get(mov.ingredientId) || 0) + mov.quantityInBaseUnit);
      }
    }
  }

  // Consumo teórico das vendas no intervalo [t0, t1]
  const theoreticalConsumptionMap = new Map<string, number>();
  for (const imp of salesImports) {
    const it = new Date(imp.periodEndDate).getTime();
    if (it >= t0 && it <= t1) {
      for (const line of imp.lines) {
        if (line.mappedRecipeId) {
          const rec = recipesMap.get(line.mappedRecipeId);
          if (rec) {
            for (const rLine of rec.lines) {
              if (rLine.ingredientId) {
                const qty = rLine.quantityInBaseUnit * rLine.correctionFactor * line.quantity;
                theoreticalConsumptionMap.set(
                  rLine.ingredientId,
                  (theoreticalConsumptionMap.get(rLine.ingredientId) || 0) + qty
                );
              }
            }
          }
        }
      }
    }
  }

  // Mapa de quantidades da contagem 0 e contagem 1
  const mapCount0 = new Map<string, number>(count0.lines.map((l) => [l.ingredientId, l.countedQuantityInBaseUnit]));
  const mapCount1 = new Map<string, number>(count1.lines.map((l) => [l.ingredientId, l.countedQuantityInBaseUnit]));

  const items: UsageVarianceItem[] = [];
  let totalDiscrepancyCents = 0;

  for (const [ingId, counted1] of mapCount1.entries()) {
    const counted0 = mapCount0.get(ingId);
    if (counted0 !== undefined) {
      const ing = ingredientsMap.get(ingId);
      if (!ing) continue;

      const entradas = entriesMap.get(ingId) || 0;
      const consumoReal = counted0 + entradas - counted1;
      const consumoTeorico = theoreticalConsumptionMap.get(ingId) || 0;
      const varianciaQtd = consumoReal - consumoTeorico;

      const variancePerc = consumoTeorico > 0
        ? Number(((varianciaQtd / consumoTeorico) * 100).toFixed(1))
        : (varianciaQtd > 0 ? 100 : 0);

      const varianceCents = Math.round((varianciaQtd * ing.currentUnitCostMicrocents) / 10000);
      if (varianceCents > 0) {
        totalDiscrepancyCents += varianceCents;
      }

      items.push({
        ingredientId: ingId,
        ingredientName: ing.name,
        baseUnit: ing.baseUnit,
        theoreticalConsumptionInBaseUnit: Number(consumoTeorico.toFixed(2)),
        realConsumptionInBaseUnit: Number(consumoReal.toFixed(2)),
        varianceInBaseUnit: Number(varianciaQtd.toFixed(2)),
        variancePercentage: variancePerc,
        unitCostMicrocents: ing.currentUnitCostMicrocents,
        varianceInCents: varianceCents,
      });
    }
  }

  // Ordenar decrescente pelo prejuízo financeiro
  items.sort((a, b) => b.varianceInCents - a.varianceInCents);

  const explanation: DomainExplanation<number> = {
    valor: totalDiscrepancyCents,
    unidade: 'centavos',
    formula: 'ConsumoReal = Estoque0 + Entradas - Estoque1; Variância = Real - Teórico; R$ = Variância × CustoUnitário',
    entradas: {
      dataContagemInicial: count0.date,
      dataContagemFinal: count1.date,
      itensAuditadosCount: items.length,
      prejuizoTotalCentavos: totalDiscrepancyCents,
    },
    passos: [
      `1. Intervalo comparado: de ${new Date(count0.date).toLocaleDateString('pt-BR')} até ${new Date(count1.date).toLocaleDateString('pt-BR')}.`,
      `2. ${items.length} insumos tiveram o consumo real confrontado com as vendas e fichas técnicas.`,
      `3. Desvio total apurado: ${formatCentsToCurrency(totalDiscrepancyCents)} em desperdício, erro de porção ou desvios não registrados.`,
      `4. Maior ofensor: ${items[0]?.ingredientName || 'Nenhum'} com desvio de ${items[0]?.variancePercentage || 0}% (${formatCentsToCurrency(items[0]?.varianceInCents || 0)}).`,
    ],
    suficienciaDeDados: {
      suficiente: true,
      percentualConfiabilidade: 100,
    },
    confianca: 'ALTA',
  };

  return {
    hasSufficientCounts: true,
    startDate: count0.date,
    endDate: count1.date,
    items,
    totalDiscrepancyInCents: totalDiscrepancyCents,
    explanation,
  };
}

/**
 * F14: Risco de Vencimento (FEFO - First Expired, First Out)
 * Projeta se a demanda consumirá o lote antes da data de validade.
 */
export function calculateFefoExpirationRisk(
  lots: StockLot[],
  ingredientsMap: Map<string, Ingredient>,
  dailyConsumptionMap: Record<string, number>,
  now = new Date()
): FefoRiskReport {
  const items: FefoRiskItem[] = [];
  let totalAtRisk = 0;

  for (const lot of lots) {
    if (lot.remainingQuantityInBaseUnit <= 0) continue;

    const ing = ingredientsMap.get(lot.ingredientId);
    if (!ing) continue;

    const expTime = new Date(lot.expirationDate).getTime();
    const diffMs = expTime - now.getTime();
    const daysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));

    const dailyCons = dailyConsumptionMap[lot.ingredientId] || 0;
    const projectedCons = dailyCons * daysRemaining;
    const excess = Math.max(0, lot.remainingQuantityInBaseUnit - projectedCons);
    const amountAtRisk = Math.round((excess * lot.unitCostMicrocents) / 10000);

    let urgency: FefoRiskItem['urgency'] = 'SEGURO';
    if (daysRemaining === 0) urgency = 'VENCIDO';
    else if (daysRemaining <= 3) urgency = 'CRITICO';
    else if (daysRemaining <= 7) urgency = 'ATENCAO';

    if (amountAtRisk > 0 || urgency === 'VENCIDO' || urgency === 'CRITICO') {
      totalAtRisk += amountAtRisk;
      items.push({
        lotId: lot.id,
        lotNumber: lot.lotNumber,
        ingredientId: lot.ingredientId,
        ingredientName: ing.name,
        baseUnit: ing.baseUnit,
        currentStockInBaseUnit: lot.remainingQuantityInBaseUnit,
        unitCostMicrocents: lot.unitCostMicrocents,
        expirationDate: lot.expirationDate,
        daysRemaining,
        dailyConsumptionInBaseUnit: dailyCons,
        projectedConsumptionInBaseUnit: projectedCons,
        excessInBaseUnit: excess,
        amountAtRiskInCents: amountAtRisk,
        urgency,
      });
    }
  }

  // Ordenar por dias restantes crescente e valor em risco decrescente
  items.sort((a, b) => a.daysRemaining - b.daysRemaining || b.amountAtRiskInCents - a.amountAtRiskInCents);

  const explanation: DomainExplanation<number> = {
    valor: totalAtRisk,
    unidade: 'centavos',
    formula: 'ConsumoProjetado = ConsumoDiário × DiasRestantes; Excedente = max(0, Saldo - Projetado); Risco = Excedente × Custo',
    entradas: {
      lotesAnalisadosCount: lots.length,
      lotesEmRiscoCount: items.length,
      valorTotalEmRiscoCentavos: totalAtRisk,
    },
    passos: [
      `1. Analisados ${lots.length} lotes com rastreio de validade.`,
      `2. ${items.length} lotes possuem risco de vencimento antes do consumo total pela demanda histórica.`,
      `3. Montante financeiro em risco iminente de descarte: ${formatCentsToCurrency(totalAtRisk)}.`,
    ],
    suficienciaDeDados: {
      suficiente: lots.length > 0,
      faltam: lots.length === 0 ? 'Nenhum lote com data de validade registrado no estoque.' : undefined,
      percentualConfiabilidade: lots.length > 0 ? 100 : 0,
    },
    confianca: lots.length > 0 ? 'ALTA' : 'INSUFICIENTE',
  };

  return {
    items,
    totalAmountAtRiskInCents: totalAtRisk,
    explanation,
  };
}
