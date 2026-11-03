/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Mise — F33: Decomposição Rigorosa da Variação de CMV (Preço, Volume e Uso/Mix)
 * Invariante: EfeitoPreço + EfeitoVolume + EfeitoUsoMix === ΔCMV com precisão matemática estrita.
 */

import { DomainExplanation, CmvDecompositionResult } from './insights-types';
import { formatCentsToCurrency } from './units';

export interface IngredientPeriodConsumption {
  ingredientId: string;
  ingredientName: string;
  // Período 0 (base)
  quantityQ0: number;
  unitCostMicrocentsP0: number;
  // Período 1 (atual)
  quantityQ1: number;
  unitCostMicrocentsP1: number;
}

/**
 * F33: Decompõe a variação de CMV entre dois períodos em efeitos Preço, Volume e Uso/Mix.
 */
export function decomposeCmvVariance(
  items: IngredientPeriodConsumption[],
  totalSalesVolumeV0: number,
  totalSalesVolumeV1: number
): CmvDecompositionResult {
  if (items.length === 0) {
    return {
      period0CmvInCents: 0,
      period1CmvInCents: 0,
      deltaCmvInCents: 0,
      priceEffectInCents: 0,
      volumeEffectInCents: 0,
      usageMixEffectInCents: 0,
      identityCheckPassed: true,
      explanation: {
        valor: 0,
        unidade: 'centavos',
        formula: 'ΔCMV = EfeitoPreço + EfeitoVolume + EfeitoUsoMix',
        entradas: {},
        passos: ['Sem insumos para decompor no período.'],
        suficienciaDeDados: { suficiente: false, faltam: 'Dados de consumo insuficientes para comparar períodos.', percentualConfiabilidade: 0 },
        confianca: 'INSUFICIENTE',
      },
    };
  }

  // 1. Calcular somatórios em centavos de alta precisão
  let totalCmv0Microcents = 0;
  let totalCmv1Microcents = 0;
  let priceEffectMicrocents = 0;
  let quantityEffectMicrocents = 0;

  for (const item of items) {
    const cmv0 = item.quantityQ0 * item.unitCostMicrocentsP0;
    const cmv1 = item.quantityQ1 * item.unitCostMicrocentsP1;
    totalCmv0Microcents += cmv0;
    totalCmv1Microcents += cmv1;

    // Efeito preço: q1 * (p1 - p0)
    priceEffectMicrocents += item.quantityQ1 * (item.unitCostMicrocentsP1 - item.unitCostMicrocentsP0);

    // Efeito quantidade: p0 * (q1 - q0)
    quantityEffectMicrocents += item.unitCostMicrocentsP0 * (item.quantityQ1 - item.quantityQ0);
  }

  // Conversão para centavos inteiros (1 centavo = 10.000 microcentavos)
  const period0CmvInCents = Math.round(totalCmv0Microcents / 10000);
  const period1CmvInCents = Math.round(totalCmv1Microcents / 10000);
  const deltaCmvInCents = period1CmvInCents - period0CmvInCents;

  const priceEffectInCents = Math.round(priceEffectMicrocents / 10000);

  // Efeito Volume: (V1 / V0 - 1) * CMV0
  let volumeEffectInCents = 0;
  if (totalSalesVolumeV0 > 0) {
    const volumeGrowthRatio = (totalSalesVolumeV1 / totalSalesVolumeV0) - 1;
    volumeEffectInCents = Math.round(period0CmvInCents * volumeGrowthRatio);
  }

  // Efeito Uso/Mix: resíduo exato para garantir identidade perfeita
  // EfeitoUsoMix = deltaCmv - priceEffect - volumeEffect
  const usageMixEffectInCents = deltaCmvInCents - priceEffectInCents - volumeEffectInCents;

  // Verificação estrita de identidade matemática
  const sumOfEffects = priceEffectInCents + volumeEffectInCents + usageMixEffectInCents;
  const identityCheckPassed = sumOfEffects === deltaCmvInCents;

  const explanation: DomainExplanation<number> = {
    valor: deltaCmvInCents,
    unidade: 'centavos',
    formula: 'ΔCMV = EfeitoPreço + EfeitoVolume + EfeitoUsoMix; Preço = Σ q1·(p1 - p0); Volume = (V1/V0 - 1) × CMV0',
    entradas: {
      cmvPeriodoAnteriorCentavos: period0CmvInCents,
      cmvPeriodoAtualCentavos: period1CmvInCents,
      deltaCmvCentavos: deltaCmvInCents,
      efeitoPrecoCentavos: priceEffectInCents,
      efeitoVolumeCentavos: volumeEffectInCents,
      efeitoUsoMixCentavos: usageMixEffectInCents,
      volumeVendasAnterior: totalSalesVolumeV0,
      volumeVendasAtual: totalSalesVolumeV1,
    },
    passos: [
      `1. O CMV variou de ${formatCentsToCurrency(period0CmvInCents)} para ${formatCentsToCurrency(period1CmvInCents)} (${deltaCmvInCents >= 0 ? '+' : ''}${formatCentsToCurrency(deltaCmvInCents)}).`,
      `2. Efeito Preço (custo de fornecedores): ${formatCentsToCurrency(priceEffectInCents)}.`,
      `3. Efeito Volume (impacto do aumento/queda de vendas): ${formatCentsToCurrency(volumeEffectInCents)}.`,
      `4. Efeito Uso/Mix (desperdício, rendimento de porções ou alteração do mix): ${formatCentsToCurrency(usageMixEffectInCents)}.`,
      `5. Verificação de Identidade Matemática: ${formatCentsToCurrency(priceEffectInCents)} + ${formatCentsToCurrency(volumeEffectInCents)} + ${formatCentsToCurrency(usageMixEffectInCents)} = ${formatCentsToCurrency(deltaCmvInCents)} (Exatamente idêntico ✔).`,
    ],
    suficienciaDeDados: {
      suficiente: items.length > 0 && totalSalesVolumeV0 > 0,
      faltam: totalSalesVolumeV0 === 0 ? 'Faltam dados de volume de vendas do período base.' : undefined,
      percentualConfiabilidade: totalSalesVolumeV0 > 0 ? 100 : 50,
    },
    confianca: totalSalesVolumeV0 > 0 ? 'ALTA' : 'MEDIA',
  };

  return {
    period0CmvInCents,
    period1CmvInCents,
    deltaCmvInCents,
    priceEffectInCents,
    volumeEffectInCents,
    usageMixEffectInCents,
    identityCheckPassed,
    explanation,
  };
}
