/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Mise — Importação de Vendas, Normalização e Baixa Automática de Estoque
 * Invariante: Importação idempotente via hash de conteúdo;
 * Invariante: Vendas sem ficha técnica geram aviso explícito, nunca erro silencioso.
 */

import { Ingredient, Recipe, StockMovement } from './types';

export interface ParsedSalesRow {
  externalProductName: string;
  quantity: number;
  salePriceInCents: number;
  totalGrossInCents: number;
  discountInCents: number;
  feeInCents: number;
  channel: string;
}

export interface SalesProcessingResult {
  fileHash: string;
  totalOrders: number;
  totalGrossInCents: number;
  totalNetInCents: number;
  parsedLines: ParsedSalesRow[];
  unmappedProductNames: string[];
  stockMovements: Omit<StockMovement, 'id' | 'createdAt'>[];
}

/**
 * Calcula hash determinístico simples de conteúdo para prevenção de duplicidade de importação.
 */
export function computeContentHash(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Converte para inteiro 32bit
  }
  return `hash_${Math.abs(hash).toString(16)}_${content.length}`;
}

/**
 * Parser resiliente para arquivos CSV de vendas (iFood, PDVs, Saipos, Anota AI, etc.).
 * Suporta separadores ',' e ';' e cabeçalhos em português com ou sem acentos.
 */
export function parseSalesCsvText(csvText: string): ParsedSalesRow[] {
  const lines = csvText.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  if (lines.length < 2) return [];

  // Detectar delimitador (vírgula ou ponto-e-vírgula)
  const headerLine = lines[0];
  const delimiter = headerLine.includes(';') ? ';' : ',';
  const headers = headerLine.split(delimiter).map(h => h.trim().toLowerCase().replace(/["']/g, ''));

  // Localizar índices das colunas essenciais
  const findCol = (candidates: string[]): number => {
    return headers.findIndex(h => candidates.some(c => h.includes(c)));
  };

  const productCol = findCol(['produto', 'item', 'item_name', 'descricao', 'nome']);
  const qtyCol = findCol(['quantidade', 'qtd', 'qtde', 'qty', 'volume']);
  const priceCol = findCol(['preco', 'valor_unitario', 'valor unitario', 'unit_price', 'preco_unitario']);
  const totalCol = findCol(['total', 'valor_total', 'subtotal', 'gross', 'faturamento']);
  const discountCol = findCol(['desconto', 'discount']);
  const feeCol = findCol(['taxa', 'comissao', 'fee']);
  const channelCol = findCol(['canal', 'channel', 'origem', 'tipo']);

  const parsed: ParsedSalesRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const row = lines[i].split(delimiter).map(val => val.trim().replace(/^["']|["']$/g, ''));
    if (row.length < 2) continue;

    const rawName = productCol >= 0 ? row[productCol] : row[0];
    if (!rawName) continue;

    const rawQty = qtyCol >= 0 ? parseFloat(row[qtyCol].replace(',', '.')) : 1;
    const qty = isNaN(rawQty) ? 1 : Math.max(0, rawQty);

    let priceInCents = 0;
    if (priceCol >= 0 && row[priceCol]) {
      const p = parseFloat(row[priceCol].replace(/[^\d,-]/g, '').replace(',', '.'));
      if (!isNaN(p)) priceInCents = Math.round(p * 100);
    }

    let totalInCents = 0;
    if (totalCol >= 0 && row[totalCol]) {
      const t = parseFloat(row[totalCol].replace(/[^\d,-]/g, '').replace(',', '.'));
      if (!isNaN(t)) totalInCents = Math.round(t * 100);
    } else {
      totalInCents = priceInCents * qty;
    }

    let discountInCents = 0;
    if (discountCol >= 0 && row[discountCol]) {
      const d = parseFloat(row[discountCol].replace(/[^\d,-]/g, '').replace(',', '.'));
      if (!isNaN(d)) discountInCents = Math.round(d * 100);
    }

    let feeInCents = 0;
    if (feeCol >= 0 && row[feeCol]) {
      const f = parseFloat(row[feeCol].replace(/[^\d,-]/g, '').replace(',', '.'));
      if (!isNaN(f)) feeInCents = Math.round(f * 100);
    }

    const channel = channelCol >= 0 && row[channelCol] ? row[channelCol] : 'PDV / Balcão';

    parsed.push({
      externalProductName: rawName,
      quantity: qty,
      salePriceInCents: priceInCents,
      totalGrossInCents: totalInCents,
      discountInCents,
      feeInCents,
      channel,
    });
  }

  return parsed;
}

/**
 * Processa linhas de vendas, cruza com o catálogo de Fichas Técnicas e gera baixas de estoque proporcionais.
 */
export function processSalesAndDeductStock(
  storeId: string,
  salesRows: ParsedSalesRow[],
  recipes: Recipe[],
  ingredientsMap: Map<string, Ingredient>,
  recipesMap: Map<string, Recipe>,
  productNameToRecipeIdMap: Map<string, string>,
  operatorName: string
): SalesProcessingResult {
  const fileHash = computeContentHash(JSON.stringify(salesRows));
  let totalGrossInCents = 0;
  let totalDiscountsAndFeesInCents = 0;
  const unmappedSet = new Set<string>();
  const movements: Omit<StockMovement, 'id' | 'createdAt'>[] = [];

  // Mapeador auxiliar de nome normalizado de receita
  const recipeByName = new Map<string, Recipe>();
  for (const r of recipes) {
    recipeByName.set(r.name.trim().toLowerCase(), r);
  }

  for (const row of salesRows) {
    totalGrossInCents += row.totalGrossInCents;
    totalDiscountsAndFeesInCents += (row.discountInCents + row.feeInCents);

    const normName = row.externalProductName.trim().toLowerCase();
    const mappedRecipeId = productNameToRecipeIdMap.get(normName) || productNameToRecipeIdMap.get(row.externalProductName);
    
    let recipe: Recipe | undefined;
    if (mappedRecipeId) {
      recipe = recipesMap.get(mappedRecipeId);
    } else {
      recipe = recipeByName.get(normName);
    }

    if (!recipe) {
      unmappedSet.add(row.externalProductName);
      continue;
    }

    // Explodir ficha técnica para baixar cada ingrediente proporcional à quantidade vendida
    explodeRecipeLines(storeId, recipe, row.quantity, ingredientsMap, recipesMap, row.externalProductName, operatorName, movements);
  }

  const totalNetInCents = Math.max(0, totalGrossInCents - totalDiscountsAndFeesInCents);

  return {
    fileHash,
    totalOrders: salesRows.length,
    totalGrossInCents,
    totalNetInCents,
    parsedLines: salesRows,
    unmappedProductNames: Array.from(unmappedSet),
    stockMovements: movements,
  };
}

/**
 * Função recursiva para descer em sub-receitas e registrar baixas no estoque.
 */
function explodeRecipeLines(
  storeId: string,
  recipe: Recipe,
  multiplier: number,
  ingredientsMap: Map<string, Ingredient>,
  recipesMap: Map<string, Recipe>,
  referenceProductName: string,
  operatorName: string,
  outMovements: Omit<StockMovement, 'id' | 'createdAt'>[]
) {
  const portions = Math.max(1, recipe.yieldPortions || 1);
  const factorPerPortion = multiplier / portions;

  for (const line of recipe.lines) {
    const grossQty = line.quantityInBaseUnit * (line.correctionFactor || 1) * factorPerPortion;

    if (line.ingredientId) {
      const ing = ingredientsMap.get(line.ingredientId);
      const unitCostMicrocents = ing ? ing.currentUnitCostMicrocents : 0;
      const totalCostInCents = Math.round((grossQty * unitCostMicrocents) / 10000);

      outMovements.push({
        storeId,
        ingredientId: line.ingredientId,
        type: 'SALES_CONSUMPTION',
        quantityInBaseUnit: -grossQty, // Saída negativa
        unitCostMicrocents,
        totalCostInCents,
        reason: `Venda de ${multiplier}x ${referenceProductName}`,
        createdBy: operatorName,
      });
    } else if (line.subRecipeId) {
      const sub = recipesMap.get(line.subRecipeId);
      if (sub) {
        explodeRecipeLines(storeId, sub, factorPerPortion, ingredientsMap, recipesMap, referenceProductName, operatorName, outMovements);
      }
    }
  }
}
