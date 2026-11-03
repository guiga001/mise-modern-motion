/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Mise — F46 Fechamento Mensal Guiado & Trava de Período,
 * F50 Termômetro do Negócio (0-100), F52 Relatório Raio-X do Mês
 * Invariante: Zero IA/LLM. Modelos condicionais estritos e frases determinísticas.
 */

import { DomainExplanation, ValueEvent, DailyTask, CmvDecompositionResult } from './insights-types';
import { DREReport, Ingredient, Recipe, SalesImport, PayableEntry, StockMovement } from './types';

// -------------------------------------------------------------
// F46: Fechamento Mensal Guiado e Trava de Período
// -------------------------------------------------------------

export interface MonthlyClosingChecklistItem {
  id: string;
  title: string;
  description: string;
  isReady: boolean;
  severity: 'BLOCKER' | 'WARNING';
}

export interface MonthlyClosingResult {
  monthYear: string; // YYYY-MM
  isPeriodLocked: boolean;
  canLockPeriod: boolean;
  checklist: MonthlyClosingChecklistItem[];
  explanation: DomainExplanation;
}

export function evaluateMonthlyClosing(
  monthYear: string,
  salesDaysWithImport: number,
  expectedDaysInMonth: number,
  unclassifiedPayablesCount: number,
  inventoryCountsDone: number,
  uncostedRevenuePercentage: number,
  isAlreadyLocked: boolean = false
): MonthlyClosingResult {
  const checklist: MonthlyClosingChecklistItem[] = [
    {
      id: 'SALES_DAYS',
      title: 'Importação Integral de Vendas',
      description: `${salesDaysWithImport} de ${expectedDaysInMonth} dias com vendas registradas.`,
      isReady: salesDaysWithImport >= expectedDaysInMonth - 2, // permite até 2 folgas/fechados
      severity: 'BLOCKER',
    },
    {
      id: 'PAYABLES_CATEGORIZED',
      title: 'Classificação de Despesas do Caixa',
      description: unclassifiedPayablesCount === 0
        ? 'Todas as contas e despesas estão devidamente categorizadas.'
        : `${unclassifiedPayablesCount} lançamento(s) sem categoria definida.`,
      isReady: unclassifiedPayablesCount === 0,
      severity: 'BLOCKER',
    },
    {
      id: 'STOCK_COUNT',
      title: 'Contagem Física de Estoque (Inventário)',
      description: inventoryCountsDone > 0
        ? `${inventoryCountsDone} contagem(ns) de estoque realizada(s) no mês.`
        : 'Nenhuma contagem de estoque realizada para apurar perdas e CMV real.',
      isReady: inventoryCountsDone > 0,
      severity: 'WARNING',
    },
    {
      id: 'RECIPES_MAPPED',
      title: 'Vendas com Ficha Técnica Ativa',
      description: uncostedRevenuePercentage <= 5
        ? `${(100 - uncostedRevenuePercentage).toFixed(1)}% do faturamento com custo conhecido.`
        : `${uncostedRevenuePercentage.toFixed(1)}% do faturamento sem ficha técnica cadastrada.`,
      isReady: uncostedRevenuePercentage <= 5,
      severity: 'WARNING',
    },
  ];

  const blockersPassed = checklist.filter(c => c.severity === 'BLOCKER').every(c => c.isReady);

  return {
    monthYear,
    isPeriodLocked: isAlreadyLocked,
    canLockPeriod: blockersPassed && !isAlreadyLocked,
    checklist,
    explanation: {
      valor: isAlreadyLocked ? 'PERÍODO TRAVADO' : blockersPassed ? 'APTO PARA TRAVA' : 'PENDÊNCIAS BLOQUEANTES',
      unidade: 'status',
      formula: 'Checklist Determinístico: 100% de dias com vendas + 0 contas sem categoria + contagens realizadas',
      entradas: { mesAno: monthYear, vendasDias: salesDaysWithImport, contasPendentes: unclassifiedPayablesCount },
      passos: [
        `Verificação dos 4 pilares operacionais do mês de fechamento.`,
        isAlreadyLocked
          ? `Período ${monthYear} está travado. Edições retroativas exigem justificativa e geram AuditLog.`
          : blockersPassed
          ? `Operação pronta para travar o mês e gerar o pacote do contador.`
          : `Existem pendências bloqueantes a serem resolvidas antes de travar o período.`,
      ],
      suficienciaDeDados: { suficiente: true, percentualConfiabilidade: 100 },
      confianca: 'ALTA',
    },
  };
}

// -------------------------------------------------------------
// F50: Termômetro do Negócio (0 a 100)
// -------------------------------------------------------------

export interface BusinessThermometerPillar {
  key: string;
  name: string;
  weight: number;
  score: number; // 0..100
  hasData: boolean;
  currentValueFormatted: string;
  benchmarkFormatted: string;
}

export interface BusinessThermometerResult {
  overallScore: number; // 0..100
  healthStatus: 'CRITICAL' | 'ATTENTION' | 'HEALTHY' | 'EXCELLENT';
  pillars: BusinessThermometerPillar[];
  explanation: DomainExplanation;
}

export function calculateBusinessThermometer(
  actualCmvPct: number,
  targetCmvPct: number = 32,
  marginOfSafetyPct: number = 25,
  cashRunwayDays: number = 20,
  inventoryTurnoverRatio: number = 2.5,
  wastePercentage: number = 0.8
): BusinessThermometerResult {
  // 1. CMV vs Meta (Peso 30)
  const cmvScore = actualCmvPct <= targetCmvPct
    ? 100
    : Math.max(0, Math.round(100 - (actualCmvPct - targetCmvPct) * 5));

  // 2. Margem de Segurança (Peso 25) - 40% = 100
  const mosScore = Math.min(100, Math.max(0, Math.round(marginOfSafetyPct * 2.5)));

  // 3. Runway de Caixa (Peso 20) - 30 dias = 100
  const cashScore = Math.min(100, Math.max(0, Math.round(cashRunwayDays * 3.33)));

  // 4. Giro de Estoque (Peso 15) - 3 giros = 100
  const turnoverScore = Math.min(100, Math.max(0, Math.round(inventoryTurnoverRatio * 33.3)));

  // 5. Perdas (Peso 10) - 1% = 100, a cada 1% adicional perde 20 pontos
  const wasteScore = wastePercentage <= 1.0
    ? 100
    : Math.max(0, Math.round(100 - (wastePercentage - 1.0) * 20));

  const pillars: BusinessThermometerPillar[] = [
    {
      key: 'cmv',
      name: 'Controle de CMV (Meta vs Real)',
      weight: 30,
      score: cmvScore,
      hasData: actualCmvPct > 0,
      currentValueFormatted: `${actualCmvPct.toFixed(1)}%`,
      benchmarkFormatted: `Meta: ${targetCmvPct.toFixed(1)}%`,
    },
    {
      key: 'mos',
      name: 'Margem de Segurança (P.E.)',
      weight: 25,
      score: mosScore,
      hasData: true,
      currentValueFormatted: `${marginOfSafetyPct.toFixed(1)}%`,
      benchmarkFormatted: 'Meta: > 30%',
    },
    {
      key: 'cash',
      name: 'Runway de Caixa Disponível',
      weight: 20,
      score: cashScore,
      hasData: true,
      currentValueFormatted: `${cashRunwayDays} dias`,
      benchmarkFormatted: 'Meta: ≥ 30 dias',
    },
    {
      key: 'turnover',
      name: 'Giro de Estoque',
      weight: 15,
      score: turnoverScore,
      hasData: inventoryTurnoverRatio > 0,
      currentValueFormatted: `${inventoryTurnoverRatio.toFixed(1)}x`,
      benchmarkFormatted: 'Meta: 2 a 4 giros/mês',
    },
    {
      key: 'waste',
      name: 'Índice de Perdas e Desperdício',
      weight: 10,
      score: wasteScore,
      hasData: true,
      currentValueFormatted: `${wastePercentage.toFixed(1)}%`,
      benchmarkFormatted: 'Meta: ≤ 1.0%',
    },
  ];

  let weightedSum = 0;
  let totalWeights = 0;

  for (const p of pillars) {
    if (p.hasData) {
      weightedSum += p.score * p.weight;
      totalWeights += p.weight;
    }
  }

  const overall = totalWeights > 0 ? Math.round(weightedSum / totalWeights) : 50;

  let healthStatus: 'CRITICAL' | 'ATTENTION' | 'HEALTHY' | 'EXCELLENT' = 'HEALTHY';
  if (overall < 50) healthStatus = 'CRITICAL';
  else if (overall < 70) healthStatus = 'ATTENTION';
  else if (overall < 88) healthStatus = 'HEALTHY';
  else healthStatus = 'EXCELLENT';

  return {
    overallScore: overall,
    healthStatus,
    pillars,
    explanation: {
      valor: `${overall}/100`,
      unidade: 'score',
      formula: 'Termômetro = Σ (Peso_i × Score_i) / Σ Peso_i com 5 pilares transparentes',
      entradas: { scoreGeral: overall, pilaresAvaliados: pillars.filter(p => p.hasData).length },
      passos: [
        `Pilar CMV (${cmvScore}/100, peso 30): CMV em ${actualCmvPct.toFixed(1)}% frente à meta de ${targetCmvPct.toFixed(1)}%.`,
        `Pilar Segurança (${mosScore}/100, peso 25): Margem de segurança de ${marginOfSafetyPct.toFixed(1)}% acima do Ponto de Equilíbrio.`,
        `Pilar Caixa (${cashScore}/100, peso 20): ${cashRunwayDays} dias de despesas operacionais cobertas.`,
        `Pilar Estoque (${turnoverScore}/100, peso 15): Giro de ${inventoryTurnoverRatio.toFixed(1)} voltas no período.`,
        `Pilar Desperdício (${wasteScore}/100, peso 10): Índice de perda em ${wastePercentage.toFixed(1)}%.`,
      ],
      suficienciaDeDados: { suficiente: true, percentualConfiabilidade: 100 },
      confianca: 'ALTA',
    },
  };
}

// -------------------------------------------------------------
// F52: Relatório Mensal Raio-X do Mês (Sem IA / Regras Condicionais)
// -------------------------------------------------------------

export interface MonthlyXRayReport {
  periodLabel: string;
  generatedAt: string;
  executiveSummary: {
    grossRevenueInCents: number;
    netOperatingResultInCents: number;
    netMarginPercentage: number;
    cmvPercentage: number;
    thermometerScore: number;
  };
  topGains: { title: string; description: string; impactInCents: number }[];
  topLosses: { title: string; description: string; impactInCents: number }[];
  actionPlan: { order: number; actionText: string; expectedSavingsInCents: number }[];
  cmvDecompositionSummary: {
    deltaCmvInCents: number;
    priceEffectInCents: number;
    volumeEffectInCents: number;
    usageMixEffectInCents: number;
  };
  miseValueDelivered: {
    identifiedInCents: number;
    realizedInCents: number;
    hoursSaved: number;
  };
}

export function generateMonthlyXRayReport(
  periodLabel: string,
  dre: DREReport,
  cmvDecomp: CmvDecompositionResult,
  thermometerScore: number,
  dailyTasks: DailyTask[],
  valueEvents: ValueEvent[],
  now: Date = new Date()
): MonthlyXRayReport {
  // Top 3 ganhos
  const topGains = [
    {
      title: 'Margem Operacional Líquida Positiva',
      description: `Lucro gerencial acumulado de R$ ${(dre.netOperatingResultInCents / 100).toFixed(2)} (${dre.netMarginPercentage}% sobre faturamento).`,
      impactInCents: dre.netOperatingResultInCents,
    },
    {
      title: 'Economia Realizada Validada pela Mise',
      description: 'Ganhos comprovados através de renegociação de preços de compra e prevenção de desperdícios.',
      impactInCents: valueEvents.filter(e => e.type === 'REALIZADO').reduce((sum, e) => sum + e.amountInCents, 0),
    },
    {
      title: 'Vendas com Margem Bruta Saudável',
      description: `Margem bruta de R$ ${(dre.grossProfitInCents / 100).toFixed(2)} após cobrir o CMV.`,
      impactInCents: dre.grossProfitInCents,
    },
  ];

  // Top 3 perdas / pontos de atenção
  const topLosses = [
    {
      title: 'Pressão de Custo dos Fornecedores (Efeito Preço)',
      description: cmvDecomp.priceEffectInCents > 0
        ? `Alta nas cotações dos fornecedores encareceu as compras em R$ ${(cmvDecomp.priceEffectInCents / 100).toFixed(2)}.`
        : 'Cotações de fornecedores permaneceram estáveis ou em deflação.',
      impactInCents: Math.max(0, cmvDecomp.priceEffectInCents),
    },
    {
      title: 'Desperdício e Variância de Uso de Insumos',
      description: cmvDecomp.usageMixEffectInCents > 0
        ? `Consumo além da ficha técnica e perdas somaram R$ ${(cmvDecomp.usageMixEffectInCents / 100).toFixed(2)}.`
        : 'Uso de insumos rigorosamente alinhado com as fichas técnicas.',
      impactInCents: Math.max(0, cmvDecomp.usageMixEffectInCents),
    },
    {
      title: 'Despesas Operacionais Fixas',
      description: `Total de aluguel, equipe, energia e manutenção no período: R$ ${(dre.operatingExpensesInCents / 100).toFixed(2)}.`,
      impactInCents: dre.operatingExpensesInCents,
    },
  ];

  // Plano de ação: Top 3 tarefas da fila por R$ em jogo
  const sortedTasks = [...dailyTasks].sort((a, b) => b.amountInPlayInCents - a.amountInPlayInCents);
  const actionPlan = sortedTasks.slice(0, 3).map((t, idx) => ({
    order: idx + 1,
    actionText: `${t.title}: ${t.description}`,
    expectedSavingsInCents: t.amountInPlayInCents,
  }));

  const identifiedTotal = valueEvents.reduce((sum, e) => sum + e.amountInCents, 0);
  const realizedTotal = valueEvents.filter(e => e.type === 'REALIZADO').reduce((sum, e) => sum + e.amountInCents, 0);
  const hoursSavedTotal = Math.round((valueEvents.length * 15) / 60);

  return {
    periodLabel,
    generatedAt: now.toISOString(),
    executiveSummary: {
      grossRevenueInCents: dre.grossRevenueInCents,
      netOperatingResultInCents: dre.netOperatingResultInCents,
      netMarginPercentage: dre.netMarginPercentage,
      cmvPercentage: dre.cmvPercentage,
      thermometerScore,
    },
    topGains,
    topLosses,
    actionPlan,
    cmvDecompositionSummary: {
      deltaCmvInCents: cmvDecomp.deltaCmvInCents,
      priceEffectInCents: cmvDecomp.priceEffectInCents,
      volumeEffectInCents: cmvDecomp.volumeEffectInCents,
      usageMixEffectInCents: cmvDecomp.usageMixEffectInCents,
    },
    miseValueDelivered: {
      identifiedInCents: identifiedTotal,
      realizedInCents: realizedTotal,
      hoursSaved: hoursSavedTotal,
    },
  };
}
