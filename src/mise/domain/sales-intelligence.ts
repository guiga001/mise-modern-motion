/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Mise — F08, F25, F26, F28: Inteligência Pura de Vendas, Margens por Canal e Metas
 */

import { Recipe, SalesImport, Ingredient } from './types';
import {
  DomainExplanation,
  UncostedRevenueReport,
  ChannelMarginReport,
  ChannelMarginItem,
} from './insights-types';
import { formatCentsToCurrency } from './units';
import { calculateRecipeCost } from './recipe';

/**
 * F08: Receita Sem Custo (Custos Ocultos)
 * Audita o faturamento de itens vendidos sem vínculo com ficha técnica ou com ficha vazia.
 */
export function calculateUncostedRevenue(
  salesImports: SalesImport[],
  recipesMap: Map<string, Recipe>,
  productNameToRecipeIdMap: Record<string, string>
): UncostedRevenueReport {
  let totalRevenue = 0;
  let costedRevenue = 0;
  let unmappedRevenue = 0;
  let noRecipeRevenue = 0;

  const problematicMap = new Map<string, { externalProductName: string; quantity: number; revenueInCents: number; reason: 'SEM_MAPEAMENTO' | 'RECEITA_SEM_LINHAS' }>();

  for (const imp of salesImports) {
    for (const line of imp.lines) {
      const lineRevenue = line.totalGrossInCents;
      totalRevenue += lineRevenue;

      const recipeId = line.mappedRecipeId || productNameToRecipeIdMap[line.externalProductName];

      if (!recipeId) {
        unmappedRevenue += lineRevenue;
        const existing = problematicMap.get(line.externalProductName) || {
          externalProductName: line.externalProductName,
          quantity: 0,
          revenueInCents: 0,
          reason: 'SEM_MAPEAMENTO',
        };
        existing.quantity += line.quantity;
        existing.revenueInCents += lineRevenue;
        problematicMap.set(line.externalProductName, existing);
      } else {
        const recipe = recipesMap.get(recipeId);
        if (!recipe || recipe.lines.length === 0) {
          noRecipeRevenue += lineRevenue;
          const existing = problematicMap.get(line.externalProductName) || {
            externalProductName: line.externalProductName,
            quantity: 0,
            revenueInCents: 0,
            reason: 'RECEITA_SEM_LINHAS',
          };
          existing.quantity += line.quantity;
          existing.revenueInCents += lineRevenue;
          problematicMap.set(line.externalProductName, existing);
        } else {
          costedRevenue += lineRevenue;
        }
      }
    }
  }

  const totalUncosted = unmappedRevenue + noRecipeRevenue;
  const uncostedPercentage = totalRevenue > 0
    ? Number(((totalUncosted / totalRevenue) * 100).toFixed(1))
    : 0;

  const problematicItems = Array.from(problematicMap.values())
    .sort((a, b) => b.revenueInCents - a.revenueInCents);

  const explanation: DomainExplanation<number> = {
    valor: totalUncosted,
    unidade: 'centavos',
    formula: '%SemCusto = (ReceitaSemFicha + ReceitaSemMapeamento) / ReceitaTotal × 100',
    entradas: {
      receitaTotalCentavos: totalRevenue,
      receitaComCustoCentavos: costedRevenue,
      receitaSemMapeamentoCentavos: unmappedRevenue,
      receitaSemFichaCentavos: noRecipeRevenue,
      itensProblemativosCount: problematicItems.length,
    },
    passos: [
      `1. Da receita total de ${formatCentsToCurrency(totalRevenue)}, ${formatCentsToCurrency(costedRevenue)} (${(100 - uncostedPercentage).toFixed(1)}%) possui custo conhecido.`,
      `2. ${formatCentsToCurrency(unmappedRevenue)} veio de produtos não mapeados.`,
      `3. ${formatCentsToCurrency(noRecipeRevenue)} veio de fichas sem ingredientes cadastrados.`,
      `4. Total às cegas: ${formatCentsToCurrency(totalUncosted)} (${uncostedPercentage}% do faturamento).`,
    ],
    suficienciaDeDados: {
      suficiente: totalRevenue > 0,
      faltam: totalRevenue === 0 ? 'Nenhuma venda importada no período.' : undefined,
      percentualConfiabilidade: totalRevenue > 0 ? 100 : 0,
    },
    confianca: totalRevenue > 0 ? 'ALTA' : 'INSUFICIENTE',
  };

  return {
    totalRevenueInCents: totalRevenue,
    costedRevenueInCents: costedRevenue,
    unmappedRevenueInCents: unmappedRevenue,
    noRecipeRevenueInCents: noRecipeRevenue,
    totalUncostedRevenueInCents: totalUncosted,
    uncostedPercentage,
    problematicItems,
    explanation,
  };
}

/**
 * F25: Margem Líquida Real por Canal
 * Receita - CMV - Taxas Canal - Taxas Pagamento - Embalagens - Impostos por canal.
 */
export function calculateChannelMargins(
  salesImports: SalesImport[],
  recipesMap: Map<string, Recipe>,
  ingredientsMap: Map<string, Ingredient>,
  channelTaxRatePercentage = 6 // Imposto simples padrão editável
): ChannelMarginReport {
  const channelDataMap = new Map<string, {
    grossRevenue: number;
    cmv: number;
    platformFees: number;
    discounts: number;
    paymentFees: number;
    packaging: number;
  }>();

  for (const imp of salesImports) {
    const channelName = imp.channel || 'Balcão / Geral';
    const current = channelDataMap.get(channelName) || {
      grossRevenue: 0,
      cmv: 0,
      platformFees: 0,
      discounts: 0,
      paymentFees: 0,
      packaging: 0,
    };

    for (const line of imp.lines) {
      current.grossRevenue += line.totalGrossInCents;
      current.platformFees += line.channelFeeInCents || 0;
      current.discounts += line.discountsInCents || 0;

      // Calcular CMV da linha se mapeado
      if (line.mappedRecipeId) {
        const recipe = recipesMap.get(line.mappedRecipeId);
        if (recipe) {
          const cost = calculateRecipeCost(recipe, ingredientsMap, recipesMap);
          current.cmv += cost.portionCostInCents * line.quantity;
        }
      }
    }

    channelDataMap.set(channelName, current);
  }

  let totalGross = 0;
  let totalNet = 0;
  const channels: ChannelMarginItem[] = [];

  for (const [channel, data] of channelDataMap.entries()) {
    const taxes = Math.round((data.grossRevenue * channelTaxRatePercentage) / 100);
    // Estimativa de taxa de pagamento (se marketplace já cobrou platformFee, deduz 0 extra, senão ~2%)
    const paymentFees = data.platformFees > 0 ? 0 : Math.round(data.grossRevenue * 0.02);
    // Embalagem delivery estimada caso seja canal delivery
    const isDelivery = /delivery|ifood|rappi|anota/i.test(channel);
    const packaging = isDelivery ? Math.round(data.grossRevenue * 0.04) : 0;

    const netMargin = data.grossRevenue - data.cmv - data.platformFees - paymentFees - packaging - taxes;
    const netPercentage = data.grossRevenue > 0
      ? Number(((netMargin / data.grossRevenue) * 100).toFixed(1))
      : 0;

    totalGross += data.grossRevenue;
    totalNet += netMargin;

    channels.push({
      channel,
      grossRevenueInCents: data.grossRevenue,
      cmvInCents: data.cmv,
      platformFeesInCents: data.platformFees,
      paymentFeesInCents: paymentFees,
      packagingInCents: packaging,
      taxesInCents: taxes,
      netMarginInCents: netMargin,
      netMarginPercentage: netPercentage,
    });
  }

  channels.sort((a, b) => b.grossRevenueInCents - a.grossRevenueInCents);
  const consolidatedPercentage = totalGross > 0 ? Number(((totalNet / totalGross) * 100).toFixed(1)) : 0;

  const explanation: DomainExplanation<number> = {
    valor: totalNet,
    unidade: 'centavos',
    formula: 'MargemLíquida = Receita - CMV - TaxasCanal - TaxasCartão - Embalagens - Impostos',
    entradas: {
      canaisCount: channels.length,
      receitaBrutaConsolidadaCentavos: totalGross,
      margemLiquidaConsolidadaCentavos: totalNet,
    },
    passos: [
      `1. Analisados ${channels.length} canais de venda.`,
      `2. Margem líquida consolidada de ${consolidatedPercentage}%.`,
      `3. O canal com maior retorno percentual é "${channels[0]?.channel || 'N/A'}" com margem de ${channels[0]?.netMarginPercentage || 0}%.`,
    ],
    suficienciaDeDados: {
      suficiente: channels.length > 0,
      faltam: channels.length === 0 ? 'Sem vendas registradas por canal.' : undefined,
      percentualConfiabilidade: channels.length > 0 ? 100 : 0,
    },
    confianca: channels.length > 0 ? 'ALTA' : 'INSUFICIENTE',
  };

  return {
    channels,
    totalGrossRevenueInCents: totalGross,
    totalNetMarginInCents: totalNet,
    consolidatedNetMarginPercentage: consolidatedPercentage,
    explanation,
  };
}

/**
 * F26: Meta do Dia
 * Distribui a receita necessária restante no mês pelos dias operacionais restantes ponderados pela semana.
 */
export function calculateDailySalesGoal(
  fixedCostsInCents: number,
  targetProfitInCents: number,
  mcPercentage: number,
  accumulatedRevenueInCents: number,
  remainingDaysCount: number,
  todayWeekdayWeight: number,
  sumRemainingDaysWeights: number
) {
  if (mcPercentage <= 0) {
    throw new Error('A Margem de Contribuição % deve ser maior que zero.');
  }

  const mcFactor = mcPercentage / 100;
  const targetMonthlyRevenueInCents = Math.round((fixedCostsInCents + targetProfitInCents) / mcFactor);
  const remainingToTargetInCents = Math.max(0, targetMonthlyRevenueInCents - accumulatedRevenueInCents);

  let todayGoalInCents = 0;
  if (remainingToTargetInCents > 0 && sumRemainingDaysWeights > 0) {
    todayGoalInCents = Math.round(remainingToTargetInCents * (todayWeekdayWeight / sumRemainingDaysWeights));
  }

  const explanation: DomainExplanation<number> = {
    valor: todayGoalInCents,
    unidade: 'centavos',
    formula: 'MetaHoje = (ReceitaNecessária - Acumulado) × (PesoHoje / ΣPesosRestantes)',
    entradas: {
      custosFixosCentavos: fixedCostsInCents,
      lucroAlvoCentavos: targetProfitInCents,
      mcPercentual: mcPercentage,
      receitaNecessariaCentavos: targetMonthlyRevenueInCents,
      receitaAcumuladaCentavos: accumulatedRevenueInCents,
      faltamCentavos: remainingToTargetInCents,
      diasRestantes: remainingDaysCount,
    },
    passos: [
      `1. Custos fixos de ${formatCentsToCurrency(fixedCostsInCents)} e lucro-alvo de ${formatCentsToCurrency(targetProfitInCents)} exigem faturar ${formatCentsToCurrency(targetMonthlyRevenueInCents)} no mês.`,
      `2. Faturamento já acumulado: ${formatCentsToCurrency(accumulatedRevenueInCents)}.`,
      `3. Restante a faturar no mês: ${formatCentsToCurrency(remainingToTargetInCents)} em ${remainingDaysCount} dias operacionais.`,
      `4. Meta ponderada para hoje: ${formatCentsToCurrency(todayGoalInCents)}.`,
    ],
    suficienciaDeDados: {
      suficiente: mcPercentage > 0,
      percentualConfiabilidade: 100,
    },
    confianca: 'ALTA',
  };

  return {
    targetMonthlyRevenueInCents,
    remainingToTargetInCents,
    todayGoalInCents,
    explanation,
  };
}

/**
 * F28: Ponto de Equilíbrio (Mês e Dia) com Validação Estrita de MC% <= 0
 */
export function calculateBreakEvenWithDays(
  fixedCostsInCents: number,
  mcPercentage: number,
  dailyAverageRevenueInCents: number,
  currentRevenueInCents: number
) {
  if (mcPercentage <= 0) {
    throw new Error('Erro de Domínio: Sua Margem de Contribuição é negativa ou nula (MC% <= 0). Os preços praticados não cobrem os custos variáveis!');
  }

  const mcFactor = mcPercentage / 100;
  const breakEvenRevenueInCents = Math.round(fixedCostsInCents / mcFactor);

  const marginOfSafetyPercentage = currentRevenueInCents > 0
    ? Number((((currentRevenueInCents - breakEvenRevenueInCents) / currentRevenueInCents) * 100).toFixed(1))
    : 0;

  const estimatedDayOfBreakEven = dailyAverageRevenueInCents > 0
    ? Math.ceil(breakEvenRevenueInCents / dailyAverageRevenueInCents)
    : 0;

  const explanation: DomainExplanation<number> = {
    valor: breakEvenRevenueInCents,
    unidade: 'centavos',
    formula: 'PE = CustosFixos / MC%; MargemSegurança = (Receita - PE) / Receita; Dia = PE / MédiaDiária',
    entradas: {
      custosFixosCentavos: fixedCostsInCents,
      mcPercentual: mcPercentage,
      receitaAtualCentavos: currentRevenueInCents,
      mediaDiariaCentavos: dailyAverageRevenueInCents,
    },
    passos: [
      `1. Custos fixos mensais de ${formatCentsToCurrency(fixedCostsInCents)} com MC média de ${mcPercentage}%.`,
      `2. Ponto de Equilíbrio mensal: ${formatCentsToCurrency(breakEvenRevenueInCents)}.`,
      `3. Com a média de faturamento de ${formatCentsToCurrency(dailyAverageRevenueInCents)}/dia, o ponto de equilíbrio é atingido no dia ${estimatedDayOfBreakEven} do mês.`,
      `4. Margem de segurança atual: ${marginOfSafetyPercentage}%.`,
    ],
    suficienciaDeDados: {
      suficiente: dailyAverageRevenueInCents > 0,
      faltam: dailyAverageRevenueInCents === 0 ? 'Faltam dados de faturamento médio diário.' : undefined,
      percentualConfiabilidade: dailyAverageRevenueInCents > 0 ? 100 : 50,
    },
    confianca: dailyAverageRevenueInCents > 0 ? 'ALTA' : 'MEDIA',
  };

  return {
    breakEvenRevenueInCents,
    marginOfSafetyPercentage,
    estimatedDayOfBreakEven,
    isProfitableNow: currentRevenueInCents >= breakEvenRevenueInCents,
    explanation,
  };
}
