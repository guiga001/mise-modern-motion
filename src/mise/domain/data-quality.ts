/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Mise — F51: Auditoria Contínua de Qualidade dos Dados e Níveis de Confiabilidade
 */

import { Ingredient, Recipe, SalesImport, InventoryCount } from './types';
import { DomainExplanation, DataQualityReport } from './insights-types';

/**
 * F51: Calcula os índices de completude, frescor e confiabilidade cadastral.
 */
export function auditDataQuality(
  ingredients: Ingredient[],
  recipes: Recipe[],
  salesImports: SalesImport[],
  inventoryCounts: InventoryCount[],
  now = new Date()
): DataQualityReport {
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
  const nowMs = now.getTime();

  // 1. % Receitas com Ficha Completa
  let totalSalesLines = 0;
  let coveredSalesLines = 0;
  const recipesMap = new Map<string, Recipe>(recipes.map((r) => [r.id, r]));

  for (const imp of salesImports) {
    for (const line of imp.lines) {
      totalSalesLines++;
      if (line.mappedRecipeId) {
        const rec = recipesMap.get(line.mappedRecipeId);
        if (rec && rec.lines.length > 0) {
          coveredSalesLines++;
        }
      }
    }
  }

  const recipesCoveragePercentage = totalSalesLines > 0
    ? Number(((coveredSalesLines / totalSalesLines) * 100).toFixed(1))
    : (recipes.length > 0 ? 100 : 0);

  // 2. % Insumos com Custo Atualizado (últimos 30 dias)
  let updatedIngredients = 0;
  for (const ing of ingredients) {
    const updatedTime = new Date(ing.updatedAt).getTime();
    if (nowMs - updatedTime <= thirtyDaysMs) {
      updatedIngredients++;
    }
  }

  const ingredientPricesFreshnessPercentage = ingredients.length > 0
    ? Number(((updatedIngredients / ingredients.length) * 100).toFixed(1))
    : 0;

  // 3. % Dias com Vendas Importadas (últimos 30 dias)
  const salesDatesSet = new Set<string>();
  for (const imp of salesImports) {
    const impTime = new Date(imp.periodEndDate).getTime();
    if (nowMs - impTime <= thirtyDaysMs) {
      salesDatesSet.add(imp.periodEndDate.split('T')[0]);
    }
  }
  // Considera 26 dias operacionais no mês típico
  const salesRegularityPercentage = Math.min(100, Number(((salesDatesSet.size / 26) * 100).toFixed(1)));

  // 4. % Insumos com Contagem Recente (últimos 30 dias)
  const countedIngIds = new Set<string>();
  for (const count of inventoryCounts) {
    const countTime = new Date(count.date).getTime();
    if (count.status === 'COMMITTED' && nowMs - countTime <= thirtyDaysMs) {
      for (const line of count.lines) {
        countedIngIds.add(line.ingredientId);
      }
    }
  }

  const stockCountsFreshnessPercentage = ingredients.length > 0
    ? Number(((countedIngIds.size / ingredients.length) * 100).toFixed(1))
    : 0;

  // Score global ponderado
  const score = Math.round(
    0.35 * recipesCoveragePercentage +
    0.25 * ingredientPricesFreshnessPercentage +
    0.25 * salesRegularityPercentage +
    0.15 * stockCountsFreshnessPercentage
  );

  let confidenceLevel: 'ALTA' | 'MEDIA' | 'BAIXA' = 'BAIXA';
  if (score >= 80) confidenceLevel = 'ALTA';
  else if (score >= 50) confidenceLevel = 'MEDIA';

  const recommendations: string[] = [];
  if (recipesCoveragePercentage < 80) {
    recommendations.push('Mapear itens de vendas sem ficha técnica cadastrada para habilitar o cálculo real de CMV.');
  }
  if (ingredientPricesFreshnessPercentage < 70) {
    recommendations.push('Atualizar notas fiscais de compra (XML) para refrescar os custos unitários dos insumos.');
  }
  if (salesRegularityPercentage < 70) {
    recommendations.push('Importar os relatórios de vendas dos últimos dias.');
  }
  if (stockCountsFreshnessPercentage < 60) {
    recommendations.push('Realizar inventário físico de estoque para apurar perdas e divergências reais.');
  }

  const explanation: DomainExplanation<number> = {
    valor: score,
    unidade: '%',
    formula: 'Score = 0,35·Fichas + 0,25·Preços + 0,25·Vendas + 0,15·Contagens',
    entradas: {
      coberturaFichas: recipesCoveragePercentage,
      atualizacaoPrecos: ingredientPricesFreshnessPercentage,
      regularidadeVendas: salesRegularityPercentage,
      contagensEstoque: stockCountsFreshnessPercentage,
    },
    passos: [
      `1. Cobertura de Fichas Técnicas: ${recipesCoveragePercentage}% dos itens vendidos possuem ficha e custos conhecidos.`,
      `2. Atualização de Preços: ${ingredientPricesFreshnessPercentage}% dos insumos tiveram cotação ou compra nos últimos 30 dias.`,
      `3. Regularidade de Vendas: ${salesDatesSet.size} dias com movimento importado nos últimos 30 dias (${salesRegularityPercentage}%).`,
      `4. Contagens Físicas: ${stockCountsFreshnessPercentage}% dos insumos foram auditados em inventário recente.`,
      `5. Score Final de Qualidade: ${score}/100 (Confiabilidade ${confidenceLevel}).`,
    ],
    suficienciaDeDados: {
      suficiente: true,
      percentualConfiabilidade: score,
    },
    confianca: confidenceLevel,
  };

  return {
    score,
    recipesCoveragePercentage,
    ingredientPricesFreshnessPercentage,
    salesRegularityPercentage,
    stockCountsFreshnessPercentage,
    confidenceLevel,
    recommendations,
    explanation,
  };
}
