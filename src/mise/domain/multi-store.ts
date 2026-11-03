/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Mise — F16, F42: Inteligência Multi-loja e Benchmark de Redes
 */

import { Ingredient, Store } from './types';
import {
  DomainExplanation,
  StoreBalancingResult,
  StoreTransferItem,
  StoreBenchmarkResult,
  StoreBenchmarkKpi,
} from './insights-types';
import { formatCentsToCurrency } from './units';

/**
 * F16: Balanceamento de Estoque Entre Lojas
 * Identifica insumo com cobertura > teto em uma loja para abastecer loja com cobertura < piso.
 * Nunca deixa a origem abaixo do piso. Respeita embalagens e custo de frete.
 */
export function balanceInventoryBetweenStores(
  stores: Store[],
  ingredients: Ingredient[],
  stockBalancesByStoreAndIng: Record<string, Record<string, number>>, // storeId -> ingId -> balance
  dailyConsumptionByStoreAndIng: Record<string, Record<string, number>>, // storeId -> ingId -> dailyRate
  options: {
    ceilingDays?: number; // teto na origem
    floorDays?: number; // piso no destino
    targetDays?: number; // cobertura alvo
    defaultFreightCostInCents?: number;
    packagingMultipleByIng?: Record<string, number>;
  } = {}
): StoreBalancingResult {
  const ceilingDays = options.ceilingDays ?? 25;
  const floorDays = options.floorDays ?? 7;
  const targetDays = options.targetDays ?? 14;
  const defaultFreight = options.defaultFreightCostInCents ?? 3000; // R$ 30

  if (stores.length < 2) {
    const explanation: DomainExplanation<number> = {
      valor: 0,
      unidade: 'centavos',
      formula: 'Q_transf = min(Excedente_origem, Necessidade_destino)',
      entradas: { lojasCadastradas: stores.length },
      passos: ['O balanceamento de estoque entre lojas exige ao menos 2 lojas cadastradas.'],
      suficienciaDeDados: {
        suficiente: false,
        faltam: 'Cadastre ao menos duas lojas para ativar a transferência de estoques.',
        percentualConfiabilidade: 0,
      },
      confianca: 'INSUFICIENTE',
    };

    return {
      transfers: [],
      totalValueTransferredInCents: 0,
      totalFreightCostInCents: 0,
      netSavingsInCents: 0,
      explanation,
    };
  }

  const transfers: StoreTransferItem[] = [];
  let totalValueTransferred = 0;
  let totalFreightCost = 0;

  for (const ing of ingredients) {
    const packagingMultiple = options.packagingMultipleByIng?.[ing.id] || 1;

    // Calcular cobertura em cada loja
    const storeCoverages: {
      store: Store;
      stock: number;
      dailyRate: number;
      coverageDays: number;
    }[] = [];

    for (const store of stores) {
      const stock = stockBalancesByStoreAndIng[store.id]?.[ing.id] ?? 0;
      const dailyRate = dailyConsumptionByStoreAndIng[store.id]?.[ing.id] ?? 0;
      const coverageDays = dailyRate > 0 ? stock / dailyRate : (stock > 0 ? 999 : 0);

      storeCoverages.push({ store, stock, dailyRate, coverageDays });
    }

    // Identificar excedentes (cobertura > ceilingDays) e necessitados (cobertura < floorDays)
    const donors = storeCoverages.filter(
      (c) => c.coverageDays > ceilingDays && c.dailyRate > 0 && c.stock > 0
    );
    const recipients = storeCoverages.filter(
      (c) => c.coverageDays < floorDays && c.dailyRate > 0
    );

    for (const donor of donors) {
      for (const recipient of recipients) {
        // Excedente da origem que pode sair sem deixar a origem abaixo de ceilingDays/floorDays
        const minSafeStockOrigin = donor.dailyRate * floorDays;
        const availableExcess = Math.max(0, donor.stock - minSafeStockOrigin);

        // Necessidade do destino para atingir targetDays
        const neededStock = recipient.dailyRate * targetDays;
        const deficit = Math.max(0, neededStock - recipient.stock);

        if (availableExcess <= 0 || deficit <= 0) continue;

        let rawQty = Math.min(availableExcess, deficit);
        if (packagingMultiple > 1) {
          rawQty = Math.floor(rawQty / packagingMultiple) * packagingMultiple;
        }

        if (rawQty <= 0) continue;

        // Valor financeiro da transferência
        const unitCostCents = ing.currentUnitCostMicrocents / 10000;
        const valCents = Math.round(rawQty * unitCostCents);
        const freight = defaultFreight;
        const netBenefit = valCents - freight;

        const isFeasible = netBenefit > 0;

        transfers.push({
          ingredientId: ing.id,
          ingredientName: ing.name,
          baseUnit: ing.baseUnit,
          originStoreId: donor.store.id,
          originStoreName: donor.store.name,
          originStock: donor.stock,
          originDaysCoverage: Number(donor.coverageDays.toFixed(1)),
          destinationStoreId: recipient.store.id,
          destinationStoreName: recipient.store.name,
          destinationStock: recipient.stock,
          destinationDaysCoverage: Number(recipient.coverageDays.toFixed(1)),
          transferQuantity: rawQty,
          packagingMultiple,
          unitCostMicrocents: ing.currentUnitCostMicrocents,
          valueTransferredInCents: valCents,
          freightCostInCents: freight,
          netBenefitInCents: netBenefit,
          isFeasible,
        });

        if (isFeasible) {
          totalValueTransferred += valCents;
          totalFreightCost += freight;
        }
      }
    }
  }

  const netSavings = Math.max(0, totalValueTransferred - totalFreightCost);

  const explanation: DomainExplanation<number> = {
    valor: netSavings,
    unidade: 'centavos',
    formula: 'Q_transf = ⌊min(Excedente_origem, Necessidade_destino) / Embalagem⌋ × Embalagem; Ganho = Valor - Frete',
    entradas: {
      totalLojas: stores.length,
      totalInsumosAnalisados: ingredients.length,
      transferenciasSugeridas: transfers.length,
      tetoOrigemDias: ceilingDays,
      pisoDestinoDias: floorDays,
    },
    passos: [
      `1. Analisadas ${stores.length} lojas e ${ingredients.length} insumos de estoque.`,
      `2. ${transfers.length} oportunidades de balanceamento encontradas respeitando teto de ${ceilingDays} dias e piso de ${floorDays} dias.`,
      `3. Valor total de insumos transferíveis: ${formatCentsToCurrency(totalValueTransferred)} com frete logístico de ${formatCentsToCurrency(totalFreightCost)}.`,
      `4. Capital protegido contra rupturas e desperdício: ${formatCentsToCurrency(netSavings)}.`,
    ],
    suficienciaDeDados: {
      suficiente: true,
      percentualConfiabilidade: 100,
    },
    confianca: 'ALTA',
  };

  return {
    transfers,
    totalValueTransferredInCents: totalValueTransferred,
    totalFreightCostInCents: totalFreightCost,
    netSavingsInCents: netSavings,
    explanation,
  };
}

/**
 * F42: Benchmark Entre Lojas
 * Compara KPIs por loja (CMV%, CMO%, Ticket Médio, Margem, Perdas)
 * Mediana, MAD e cálculo do ganho financeiro se igualasse a melhor loja.
 */
export function calculateStoreBenchmarkAndGaps(
  stores: Store[],
  storeKpiData: {
    storeId: string;
    monthlyRevenueInCents: number;
    cmvPercentage: number;
    cmoPercentage: number;
    averageTicketInCents: number;
    netMarginPercentage: number;
    wastePercentage: number;
  }[]
): StoreBenchmarkResult {
  if (stores.length < 2 || storeKpiData.length < 2) {
    const explanation: DomainExplanation<number> = {
      valor: 0,
      unidade: 'centavos',
      formula: 'Gap_R$ = Receita_loja × |Indicador_loja - Melhor_loja|',
      entradas: { lojas: stores.length },
      passos: ['O benchmark comparativo requer ao menos duas lojas cadastradas com movimentação.'],
      suficienciaDeDados: {
        suficiente: false,
        faltam: 'Cadastre e movimente ao menos 2 lojas para habilitar a comparação de KPIs.',
        percentualConfiabilidade: 0,
      },
      confianca: 'INSUFICIENTE',
    };

    return {
      hasSufficientStores: false,
      storesCount: stores.length,
      kpis: [],
      consolidatedOpportunityInCents: 0,
      explanation,
    };
  }

  const storeMap = new Map<string, Store>(stores.map((s) => [s.id, s]));

  // Função auxiliar de mediana e MAD
  function getMedianAndMad(values: number[]): { median: number; mad: number } {
    if (values.length === 0) return { median: 0, mad: 0 };
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const median = sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;

    const diffs = sorted.map((v) => Math.abs(v - median)).sort((a, b) => a - b);
    const mad = diffs.length % 2 !== 0 ? diffs[mid] : (diffs[mid - 1] + diffs[mid]) / 2;
    return { median: Number(median.toFixed(2)), mad: Number(mad.toFixed(2)) };
  }

  const kpis: StoreBenchmarkKpi[] = [];
  let consolidatedOpportunity = 0;

  // Lista de KPIs analisados
  const kpiConfigs: {
    code: StoreBenchmarkKpi['kpiCode'];
    name: string;
    unit: string;
    higherIsBetter: boolean;
    extractor: (d: (typeof storeKpiData)[0]) => number;
  }[] = [
    {
      code: 'CMV_PERC',
      name: 'CMV Real',
      unit: '%',
      higherIsBetter: false,
      extractor: (d) => d.cmvPercentage,
    },
    {
      code: 'CMO_PERC',
      name: 'Custo de Mão de Obra (CMO)',
      unit: '%',
      higherIsBetter: false,
      extractor: (d) => d.cmoPercentage,
    },
    {
      code: 'MARGEM_PERC',
      name: 'Margem Líquida',
      unit: '%',
      higherIsBetter: true,
      extractor: (d) => d.netMarginPercentage,
    },
    {
      code: 'PERDAS_PERC',
      name: 'Perdas e Desperdício de Estoque',
      unit: '%',
      higherIsBetter: false,
      extractor: (d) => d.wastePercentage,
    },
  ];

  for (const cfg of kpiConfigs) {
    const rawValues = storeKpiData.map((d) => cfg.extractor(d));
    const { median, mad } = getMedianAndMad(rawValues);

    // Encontrar melhor loja
    let bestValue = cfg.higherIsBetter ? -Infinity : Infinity;
    let bestStoreId = '';

    for (const d of storeKpiData) {
      const v = cfg.extractor(d);
      if (cfg.higherIsBetter ? v > bestValue : v < bestValue) {
        bestValue = v;
        bestStoreId = d.storeId;
      }
    }

    const bestStore = storeMap.get(bestStoreId);
    let totalKpiGap = 0;

    const storeValues = storeKpiData.map((d) => {
      const val = cfg.extractor(d);
      const gap = Math.abs(val - bestValue);
      // Ganho em reais se atingisse a melhor loja
      const financialGap = Math.round(d.monthlyRevenueInCents * (gap / 100));
      totalKpiGap += financialGap;

      return {
        storeId: d.storeId,
        storeName: storeMap.get(d.storeId)?.name || 'Loja',
        value: val,
        gapToBest: Number(gap.toFixed(2)),
        monthlyFinancialGapInCents: financialGap,
      };
    });

    kpis.push({
      kpiCode: cfg.code,
      kpiName: cfg.name,
      unit: cfg.unit,
      higherIsBetter: cfg.higherIsBetter,
      bestStoreId,
      bestStoreName: bestStore?.name || 'Melhor Loja',
      bestValue: Number(bestValue.toFixed(2)),
      medianValue: median,
      madValue: mad,
      storeValues,
      totalPotentialGapInCents: totalKpiGap,
    });

    // Se for CMV ou Margem, alimenta oportunidade consolidada
    if (cfg.code === 'CMV_PERC') {
      consolidatedOpportunity += totalKpiGap;
    }
  }

  const explanation: DomainExplanation<number> = {
    valor: consolidatedOpportunity,
    unidade: 'centavos',
    formula: 'Gap_R$ = Receita_loja × (|Indicador - Melhor| / 100)',
    entradas: {
      lojasAnalisadas: storeKpiData.length,
      kpisAvaliados: kpis.length,
    },
    passos: [
      `1. Comparadas ${storeKpiData.length} lojas com cálculo de Mediana e MAD robusto.`,
      `2. O CMV da melhor loja é ${kpis.find((k) => k.kpiCode === 'CMV_PERC')?.bestValue}% (${kpis.find((k) => k.kpiCode === 'CMV_PERC')?.bestStoreName}).`,
      `3. Oportunidade total mensal se as demais lojas igualassem o CMV da loja modelo: ${formatCentsToCurrency(consolidatedOpportunity)}/mês.`,
    ],
    suficienciaDeDados: {
      suficiente: true,
      percentualConfiabilidade: 100,
    },
    confianca: 'ALTA',
  };

  return {
    hasSufficientStores: true,
    storesCount: stores.length,
    kpis,
    consolidatedOpportunityInCents: consolidatedOpportunity,
    explanation,
  };
}
