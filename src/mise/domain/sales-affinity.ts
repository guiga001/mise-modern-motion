/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Mise — F24, F27: Afinidade de Cesta de Vendas e Detecção de Queda Anômala
 */

import {
  DomainExplanation,
  MarketBasketAffinityResult,
  BasketAffinityRule,
  AnomalousSalesDropResult,
  AnomalousSalesDropItem,
} from './insights-types';
import { formatCentsToCurrency } from './units';

/**
 * F24: Cesta de Compra (Análise de Afinidade de Pedidos)
 * Calcula Suporte, Confiança e Lift para sugerir combos com forte correlação de compra.
 * Requer orders com lista de itens.
 */
export function calculateMarketBasketAffinity(
  orders: {
    orderId: string;
    items: { productId: string; productName: string }[];
  }[],
  minSupportPercentage = 2.0, // 2%
  minConfidencePercentage = 20.0, // 20%
  minLift = 1.15
): MarketBasketAffinityResult {
  const totalOrders = orders.length;

  if (totalOrders < 10) {
    const explanation: DomainExplanation<number> = {
      valor: 0,
      unidade: 'regras',
      formula: 'Lift(A→B) = Confiança(A→B) / Suporte(B) = (N(A∩B) × N) / (N(A) × N(B))',
      entradas: { pedidosAnalisados: totalOrders },
      passos: ['Histórico de pedidos insuficiente para gerar regras de afinidade estatística confiáveis (mínimo de 10 pedidos identificados).'],
      suficienciaDeDados: {
        suficiente: false,
        faltam: 'Importe vendas contendo ID do pedido ou comanda para identificar produtos comprados juntos.',
        percentualConfiabilidade: 0,
      },
      confianca: 'INSUFICIENTE',
    };

    return {
      totalOrdersAnalyzed: totalOrders,
      rules: [],
      explanation,
    };
  }

  // 1. Contar frequências individuais e pares
  const itemCounts = new Map<string, { count: number; name: string }>();
  const pairCounts = new Map<string, { count: number; itemAId: string; itemBId: string; nameA: string; nameB: string }>();

  for (const order of orders) {
    // Remover duplicatas no mesmo pedido
    const distinctItemMap = new Map<string, string>();
    for (const it of order.items) {
      distinctItemMap.set(it.productId, it.productName);
    }

    const distinctIds = Array.from(distinctItemMap.keys());

    // Contagem individual
    for (const id of distinctIds) {
      const cur = itemCounts.get(id) || { count: 0, name: distinctItemMap.get(id)! };
      cur.count++;
      itemCounts.set(id, cur);
    }

    // Contagem de pares (combinações 2 a 2)
    for (let i = 0; i < distinctIds.length; i++) {
      for (let j = i + 1; j < distinctIds.length; j++) {
        const idA = distinctIds[i];
        const idB = distinctIds[j];
        // Chave ordenada
        const pairKey = idA < idB ? `${idA}:::${idB}` : `${idB}:::${idA}`;
        const nameA = distinctItemMap.get(idA)!;
        const nameB = distinctItemMap.get(idB)!;

        const cur = pairCounts.get(pairKey) || {
          count: 0,
          itemAId: idA < idB ? idA : idB,
          itemBId: idA < idB ? idB : idA,
          nameA: idA < idB ? nameA : nameB,
          nameB: idA < idB ? nameB : nameA,
        };
        cur.count++;
        pairCounts.set(pairKey, cur);
      }
    }
  }

  // 2. Extrair regras direcionais A -> B
  const rules: BasketAffinityRule[] = [];

  for (const pair of pairCounts.values()) {
    const nAB = pair.count;
    const supportAB = (nAB / totalOrders) * 100;
    if (supportAB < minSupportPercentage) continue;

    const nA = itemCounts.get(pair.itemAId)?.count || 0;
    const nB = itemCounts.get(pair.itemBId)?.count || 0;

    if (nA === 0 || nB === 0) continue;

    const supportA = (nA / totalOrders) * 100;
    const supportB = (nB / totalOrders) * 100;

    // Regra 1: A -> B
    const confAtoB = (nAB / nA) * 100;
    const liftAtoB = (nAB * totalOrders) / (nA * nB);

    if (confAtoB >= minConfidencePercentage && liftAtoB >= minLift) {
      rules.push({
        itemAId: pair.itemAId,
        itemAName: pair.nameA,
        itemBId: pair.itemBId,
        itemBName: pair.nameB,
        supportABPercentage: Number(supportAB.toFixed(2)),
        supportAPercentage: Number(supportA.toFixed(2)),
        supportBPercentage: Number(supportB.toFixed(2)),
        confidencePercentage: Number(confAtoB.toFixed(1)),
        lift: Number(liftAtoB.toFixed(2)),
      });
    }

    // Regra 2: B -> A
    const confBtoA = (nAB / nB) * 100;
    const liftBtoA = liftAtoB; // Simétrico

    if (confBtoA >= minConfidencePercentage && liftBtoA >= minLift) {
      rules.push({
        itemAId: pair.itemBId,
        itemAName: pair.nameB,
        itemBId: pair.itemAId,
        itemBName: pair.nameA,
        supportABPercentage: Number(supportAB.toFixed(2)),
        supportAPercentage: Number(supportB.toFixed(2)),
        supportBPercentage: Number(supportA.toFixed(2)),
        confidencePercentage: Number(confBtoA.toFixed(1)),
        lift: Number(liftBtoA.toFixed(2)),
      });
    }
  }

  // Ordenar pelo maior Lift
  rules.sort((a, b) => b.lift - a.lift);

  const explanation: DomainExplanation<number> = {
    valor: rules.length,
    unidade: 'regras',
    formula: 'Lift(A→B) = Confiança / Suporte(B) = (N(A∩B) × N) / (N(A) × N(B))',
    entradas: {
      pedidosAnalisados: totalOrders,
      itensDistintos: itemCounts.size,
      regrasEncontradas: rules.length,
      suporteMinimo: `${minSupportPercentage}%`,
      liftMinimo: minLift,
    },
    passos: [
      `1. Mapeadas associações de itens em ${totalOrders} pedidos únicos.`,
      `2. ${rules.length} oportunidades de combos identificadas com Lift > ${minLift}.`,
      rules[0]
        ? `3. Destaque: clientes que compram "${rules[0].itemAName}" têm ${rules[0].lift}x mais probabilidade de levar também "${rules[0].itemBName}" (confiança de ${rules[0].confidencePercentage}%).`
        : '3. Nenhuma regra atendeu aos critérios mínimos.',
    ],
    suficienciaDeDados: {
      suficiente: true,
      percentualConfiabilidade: 100,
    },
    confianca: 'ALTA',
  };

  return {
    totalOrdersAnalyzed: totalOrders,
    rules,
    explanation,
  };
}

/**
 * F27: Queda Anômala de Vendas
 * Compara o faturamento de cada dia com a série histórica do mesmo dia da semana
 * utilizando estatística robusta (mediana/MAD) e z-score modificado.
 */
export function detectAnomalousSalesDrop(
  dailySales: {
    date: string; // YYYY-MM-DD
    revenueInCents: number;
    isClosed?: boolean;
  }[],
  zScoreThreshold = -2.5,
  minOccurrencesPerDay = 4
): AnomalousSalesDropResult {
  const dayNames = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

  // Agrupar histórico por dia da semana
  const salesByDow = new Map<number, { date: string; revenue: number }[]>();
  for (let dow = 0; dow <= 6; dow++) salesByDow.set(dow, []);

  for (const day of dailySales) {
    if (day.isClosed) continue;
    const d = new Date(`${day.date}T12:00:00Z`);
    const dow = d.getUTCDay();
    salesByDow.get(dow)?.push({ date: day.date, revenue: day.revenueInCents });
  }

  const alerts: AnomalousSalesDropItem[] = [];
  let totalLossInCents = 0;

  for (const day of dailySales) {
    const d = new Date(`${day.date}T12:00:00Z`);
    const dow = d.getUTCDay();
    const dowSeries = salesByDow.get(dow)?.filter((x) => x.date !== day.date).map((x) => x.revenue) || [];

    if (day.isClosed) {
      alerts.push({
        date: day.date,
        dayOfWeekName: dayNames[dow],
        actualRevenueInCents: day.revenueInCents,
        historicalMedianRevenueInCents: 0,
        madInCents: 0,
        modifiedZScore: 0,
        revenueDropInCents: 0,
        isAnomalous: false,
        isClosedDay: true,
      });
      continue;
    }

    if (dowSeries.length < minOccurrencesPerDay) {
      // Histórico insuficiente para este dia da semana
      continue;
    }

    // Calcular mediana da série histórica
    const sorted = [...dowSeries].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const median = sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;

    // Calcular MAD
    const diffs = sorted.map((v) => Math.abs(v - median)).sort((a, b) => a - b);
    const mad = diffs.length % 2 !== 0 ? diffs[mid] : (diffs[mid - 1] + diffs[mid]) / 2;

    // Z-score modificado: 0.6745 * (x - mediana) / MAD
    const effectiveMad = mad > 0 ? mad : 1;
    const modZ = Number(((0.6745 * (day.revenueInCents - median)) / effectiveMad).toFixed(2));

    const isAnomalous = modZ < zScoreThreshold;
    const drop = isAnomalous ? Math.max(0, median - day.revenueInCents) : 0;

    if (isAnomalous) {
      totalLossInCents += drop;
    }

    alerts.push({
      date: day.date,
      dayOfWeekName: dayNames[dow],
      actualRevenueInCents: day.revenueInCents,
      historicalMedianRevenueInCents: median,
      madInCents: mad,
      modifiedZScore: modZ,
      revenueDropInCents: drop,
      isAnomalous,
      isClosedDay: false,
    });
  }

  const anomalousCount = alerts.filter((a) => a.isAnomalous).length;

  const explanation: DomainExplanation<number> = {
    valor: totalLossInCents,
    unidade: 'centavos',
    formula: 'M = 0,6745 × (x_t - Mediana_dow) / MAD; Alerta se M < Limiar',
    entradas: {
      diasAnalisados: alerts.length,
      diasComQuedaAnomala: anomalousCount,
      limiarZScore: zScoreThreshold,
    },
    passos: [
      `1. Faturamento de cada dia comparado estritamente com a série do mesmo dia da semana.`,
      `2. ${anomalousCount} quedas anômalas severas detectadas com z-score abaixo de ${zScoreThreshold}.`,
      `3. Perda de faturamento estimada frente à mediana histórica: ${formatCentsToCurrency(totalLossInCents)}.`,
    ],
    suficienciaDeDados: {
      suficiente: alerts.length > 0,
      faltam: alerts.length === 0 ? 'Faltam ao menos 4 semanas de vendas por dia da semana para detecção robusta.' : undefined,
      percentualConfiabilidade: alerts.length > 0 ? 100 : 0,
    },
    confianca: alerts.length > 0 ? 'ALTA' : 'INSUFICIENTE',
  };

  return {
    alerts,
    totalLossInCents,
    explanation,
  };
}
