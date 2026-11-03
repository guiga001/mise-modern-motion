/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Mise — Testes Automatizados de Domínio Puro
 * Executa todas as asserções de integridade contábil, unidades e fichas técnicas.
 */

import { convertToBaseUnit, formatBaseQuantity, formatCentsToCurrency, parseCurrencyToCents } from '../src/domain/units';
import { calculateRecipeCost, RecipeCycleError } from '../src/domain/recipe';
import { calculateMovingAverageCost, calculateStockBalances, calculateAbcCurve } from '../src/domain/inventory';
import { computeContentHash, processSalesAndDeductStock, ParsedSalesRow } from '../src/domain/sales';
import { calculateDRE, calculateBreakEven } from '../src/domain/financial';
import { calculateMenuEngineering } from '../src/domain/menu-engineering';
import { makeTestIngredient, makeTestRecipe } from './factories';
import { Ingredient, Recipe, StockMovement } from '../src/domain/types';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`FAIL: ${message}`);
  }
}

export function runAllDomainTests() {
  console.log('--- Iniciando Testes de Domínio do Mise ---');

  // Teste 1: Conversão de Unidades e Moeda
  {
    assert(convertToBaseUnit(2.5, 'kg', 'g') === 2500, '2.5 kg deve ser 2500 g');
    assert(convertToBaseUnit(1.5, 'L', 'ml') === 1500, '1.5 L deve ser 1500 ml');
    assert(convertToBaseUnit(2, 'dz', 'un') === 24, '2 dúzias devem ser 24 unidades');
    assert(parseCurrencyToCents('R$ 15,50') === 1550, 'R$ 15,50 deve ser 1550 centavos');
    assert(formatCentsToCurrency(1550).includes('15,50'), '1550 centavos deve formatar para R$ 15,50');
    console.log('✔ Teste 1: Conversão de unidades e moeda em centavos passou.');
  }

  // Teste 2: Ficha Técnica, Fator de Correção e CMV
  {
    const flour = makeTestIngredient({
      id: 'ing_flour',
      name: 'Farinha de Trigo',
      baseUnit: 'g',
      currentUnitCostMicrocents: 50, // R$ 0,005 / g
    });
    const cheese = makeTestIngredient({
      id: 'ing_cheese',
      name: 'Queijo Mussarela',
      baseUnit: 'g',
      currentUnitCostMicrocents: 400, // R$ 0,04 / g
    });

    const ingredientsMap = new Map<string, Ingredient>([
      [flour.id, flour],
      [cheese.id, cheese],
    ]);
    const recipesMap = new Map<string, Recipe>();

    const pizza = makeTestRecipe({
      id: 'rec_pizza',
      name: 'Pizza Mussarela',
      salePriceInCents: 5000, // R$ 50,00
      yieldPortions: 1,
      targetMarginPercentage: 70,
      lines: [
        {
          id: 'l1',
          ingredientId: flour.id,
          quantityInBaseUnit: 300, // 300g
          correctionFactor: 1.0,
        },
        {
          id: 'l2',
          ingredientId: cheese.id,
          quantityInBaseUnit: 350, // 350g com 10% de perda
          correctionFactor: 1.10, // 385g bruto
        },
      ],
    });

    recipesMap.set(pizza.id, pizza);

    const breakdown = calculateRecipeCost(pizza, ingredientsMap, recipesMap);
    // Custo farinha: 300 * 50 = 15,000 microcents = 1.5 cents = R$ 0,02 (aprox) -> 1.50
    // Custo queijo: (350 * 1.10) = 385g * 400 = 154,000 microcents = 15.4 cents = 1540 cents (R$ 15,40)
    assert(breakdown.portionCostInCents > 0, 'Custo da porção deve ser maior que zero');
    assert(breakdown.grossMarginInCents === (5000 - breakdown.portionCostInCents), 'Margem bruta deve ser preço - CMV');
    assert(breakdown.suggestedSalePriceInCents > 0, 'Preço sugerido deve ser calculado');
    console.log(`✔ Teste 2: Ficha técnica calculou CMV de R$ ${(breakdown.portionCostInCents / 100).toFixed(2)} com margem de ${breakdown.grossMarginPercentage}%.`);
  }

  // Teste 3: Detecção de Ciclo em Sub-receitas
  {
    const subA = makeTestRecipe({ id: 'rec_A', name: 'Base A', lines: [{ id: 'lA', subRecipeId: 'rec_B', quantityInBaseUnit: 1, correctionFactor: 1 }] });
    const subB = makeTestRecipe({ id: 'rec_B', name: 'Base B', lines: [{ id: 'lB', subRecipeId: 'rec_A', quantityInBaseUnit: 1, correctionFactor: 1 }] });

    const recMap = new Map<string, Recipe>([
      [subA.id, subA],
      [subB.id, subB],
    ]);

    let detectedCycle = false;
    try {
      calculateRecipeCost(subA, new Map(), recMap);
    } catch (e) {
      if (e instanceof RecipeCycleError) {
        detectedCycle = true;
      }
    }
    assert(detectedCycle, 'Ciclo de sub-receita deve ser detectado e lançar RecipeCycleError');
    console.log('✔ Teste 3: Proteção contra ciclos em fichas técnicas passou.');
  }

  // Teste 4: Custo Médio Ponderado (CMP)
  {
    // Saldo anterior: 10.000g a R$ 0,004/g (40 microcents)
    // Entrada: 10.000g a R$ 0,006/g (60 microcents)
    // Novo custo médio deve ser 50 microcents
    const newCost = calculateMovingAverageCost(10000, 40, 10000, 60);
    assert(newCost === 50, `Custo médio ponderado deve ser 50 microcents, obtido ${newCost}`);
    console.log('✔ Teste 4: Custo Médio Ponderado validado com sucesso.');
  }

  // Teste 5: Idempotência de Importação e Deduplicação por Hash
  {
    const content = 'produto;quantidade;total\nPizza Margherita;10;500.00';
    const hash1 = computeContentHash(content);
    const hash2 = computeContentHash(content);
    assert(hash1 === hash2, 'Hash do mesmo arquivo deve ser estritamente idêntico');
    console.log('✔ Teste 5: Hash de idempotência validado.');
  }

  // Teste 6: DRE Gerencial
  {
    const dre = calculateDRE(
      'Mês Atual',
      'store_1',
      [
        {
          id: 's1',
          storeId: 'store_1',
          channel: 'PDV',
          periodStartDate: '2026-10-01',
          periodEndDate: '2026-10-31',
          fileHash: 'abc',
          totalGrossInCents: 1000000, // R$ 10.000,00
          totalNetInCents: 900000, // R$ 9.000,00 (10% taxas)
          totalOrdersCount: 150,
          lines: [],
          stockDeducted: true,
          importedAt: new Date().toISOString(),
        },
      ],
      [
        {
          id: 'm1',
          storeId: 'store_1',
          ingredientId: 'ing_1',
          type: 'SALES_CONSUMPTION',
          quantityInBaseUnit: -100,
          unitCostMicrocents: 100,
          totalCostInCents: 300000, // R$ 3.000,00 CMV
          createdAt: new Date().toISOString(),
          createdBy: 'Test',
        },
      ],
      [
        {
          id: 'p1',
          storeId: 'store_1',
          description: 'Aluguel do Ponto',
          category: 'ALUGUEL',
          amountInCents: 200000, // R$ 2.000,00
          dueDate: '2026-10-10',
          status: 'PAID',
        },
      ],
      150000 // R$ 1.500,00 Mão de obra
    );

    // Receita Líquida: 9.000,00
    // CMV: 3.000,00
    // Lucro Bruto: 6.000,00
    // Despesas: 2.000 (aluguel) + 1.500 (mão de obra) = 3.500,00
    // Resultado Líquido: 2.500,00
    assert(dre.netRevenueInCents === 900000, 'Receita líquida deve ser R$ 9.000,00');
    assert(dre.grossProfitInCents === 600000, 'Lucro bruto deve ser R$ 6.000,00');
    assert(dre.netOperatingResultInCents === 250000, 'Resultado operacional deve ser R$ 2.500,00');
    console.log('✔ Teste 6: DRE Gerencial confere centavo por centavo.');
  }

  console.log('--- Todos os Testes de Domínio Passaram com 100% de Sucesso! ---');
}
