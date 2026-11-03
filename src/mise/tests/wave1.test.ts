/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Mise — Suíte Completa de Testes da Onda 1
 * Valida exemplos calculados à mão, testes de propriedade e casos de borda.
 */

import { makeTestIngredient, makeTestRecipe } from './factories';
import { simulateIngredientPriceChange, calculateSensitivityRanking, calculateMarginReadjustment, calculateKitchenInflationLaspeyres } from '../src/domain/cost-simulator';
import { calculateUncostedRevenue, calculateChannelMargins, calculateDailySalesGoal, calculateBreakEvenWithDays } from '../src/domain/sales-intelligence';
import { calculateUsageVariance, calculateFefoExpirationRisk } from '../src/domain/inventory-intelligence';
import { decomposeCmvVariance, IngredientPeriodConsumption } from '../src/domain/cmv-decomposition';
import { matchProductToRecipes, calculateJaroWinkler } from '../src/domain/similarity';
import { parseNfeXml } from '../src/domain/nfe-parser';
import { summarizeValueBrought, prioritizeDailyTasks } from '../src/domain/value-engine';
import { auditDataQuality } from '../src/domain/data-quality';
import { Recipe, Ingredient, SalesImport, InventoryCount, StockLot } from '../src/domain/types';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`FAIL: ${msg}`);
  }
}

export function runWave1Tests() {
  console.log('--- Iniciando Testes da Onda 1 do Mise ---');

  // 1. F01: Exemplo calculado à mão do docs/formulas/F01-simulador-insumo.md
  {
    const cheese = makeTestIngredient({
      id: 'ing_cheese',
      name: 'Queijo Mussarela',
      baseUnit: 'g',
      currentUnitCostMicrocents: 40000, // R$ 40,00 / kg = 40.000 microcentavos / g
    });
    const flour = makeTestIngredient({
      id: 'ing_flour',
      name: 'Farinha de Trigo',
      baseUnit: 'g',
      currentUnitCostMicrocents: 5000, // R$ 5,00 / kg = 5.000 microcentavos / g
    });

    const pizza = makeTestRecipe({
      id: 'rec_pizza',
      name: 'Pizza Mussarela',
      salePriceInCents: 5000,
      yieldPortions: 1,
      lines: [
        { id: 'l1', ingredientId: flour.id, quantityInBaseUnit: 300, correctionFactor: 1.0 },
        { id: 'l2', ingredientId: cheese.id, quantityInBaseUnit: 350, correctionFactor: 1.10 }, // 385g bruto
      ],
    });

    const sim = simulateIngredientPriceChange(
      cheese.id,
      48000, // +20% -> 48.000 microcentavos
      [cheese, flour],
      [pizza],
      { [pizza.id]: 500 } // 500 pizzas vendidas
    );

    // Delta por pizza: 385g * 80 microcents = 30,800 microcents = 3.08 cents -> arredonda para 308 centavos
    assert(sim.affectedRecipes.length === 1, 'Deve afetar 1 receita');
    assert(sim.affectedRecipes[0].costDeltaInCents === 308, 'Delta de custo por pizza deve ser 308 centavos (R$ 3,08)');
    assert(sim.deltaMonthlyProfitInCents === -154000, 'Impacto mensal no lucro deve ser exatamente -154.000 centavos (-R$ 1.540,00)');
    console.log('✔ F01: Simulador E se de insumo reproduz exatamente o cálculo à mão.');
  }

  // 2. F02: Ranking de sensibilidade (+10% no insumo)
  {
    const beef = makeTestIngredient({ id: 'ing_beef', name: 'Carne Moída', baseUnit: 'g', currentUnitCostMicrocents: 3500 }); // R$ 0,35/g
    const oregano = makeTestIngredient({ id: 'ing_oregano', name: 'Orégano', baseUnit: 'g', currentUnitCostMicrocents: 6000 }); // R$ 0,60/g

    const burger = makeTestRecipe({
      id: 'rec_burger',
      name: 'Hambúrguer',
      lines: [
        { id: 'lb1', ingredientId: beef.id, quantityInBaseUnit: 200, correctionFactor: 1.0 }, // 200g
        { id: 'lb2', ingredientId: oregano.id, quantityInBaseUnit: 1, correctionFactor: 1.0 }, // 1g
      ],
      yieldPortions: 1,
    });

    // 1000 hambúrgueres vendidos
    const ranking = calculateSensitivityRanking([beef, oregano], [burger], { [burger.id]: 1000 });
    assert(ranking.items.length === 2, '2 insumos no ranking');
    assert(ranking.items[0].ingredientId === beef.id, 'Carne deve ser o 1º no ranking');
    assert(ranking.items[0].impactTenPercentInCents > ranking.items[1].impactTenPercentInCents, 'Impacto da carne > orégano');
    // Soma dos gastos deve ser igual ao CMV teórico
    const sumSpend = ranking.items.reduce((acc, i) => acc + i.monthlySpendInCents, 0);
    assert(sumSpend === ranking.totalTheoreticalCmvInCents, 'Soma dos gastos deve fechar com o CMV teórico');
    console.log('✔ F02: Ranking de sensibilidade validado com conservação de CMV.');
  }

  // 3. F03: Reajuste para manter a margem e limite de queda de volume (1 - MC/MC')
  {
    const dish = makeTestRecipe({
      id: 'rec_dish',
      name: 'Prato Executivo',
      salePriceInCents: 4000, // R$ 40,00
      targetMarginPercentage: 70, // 70%
    });

    // Custo antigo R$ 12,00 (1200), custo novo R$ 15,00 (1500)
    const result = calculateMarginReadjustment(dish, 1200, 1500, 70, false);
    // Novo preço = ceil(1500 / 0.3) = 5000 centavos (R$ 50,00)
    assert(result.suggestedNewPriceInCents === 5000, 'Preço sugerido deve ser 5000 centavos');
    // MC antiga = 4000 - 1200 = 2800 centavos
    // MC nova = 5000 - 1500 = 3500 centavos
    assert(result.currentContributionMarginInCents === 2800, 'MC antiga deve ser 2800');
    assert(result.newContributionMarginInCents === 3500, 'MC nova deve ser 3500');
    // Queda máxima de volume tolerável = 1 - (2800 / 3500) = 1 - 0.8 = 20.0%
    assert(result.maxTolerableVolumeDropPercentage === 20.0, 'Queda tolerável deve ser 20.0%');

    // Prova matemática: 100 vendas a MC antiga vs 80 vendas a MC nova
    const profitOld = 100 * result.currentContributionMarginInCents;
    const profitNew = 80 * result.newContributionMarginInCents;
    assert(profitOld === profitNew, 'Lucro a 80% do volume deve ser rigorosamente idêntico ao anterior');
    console.log('✔ F03: Reajuste e queda de volume comprovam igualdade matemática exata.');
  }

  // 4. F07: Índice de Laspeyres da cozinha e teste de propriedade (preços iguais -> 100.0)
  {
    const basket = [
      { ingredientId: '1', ingredientName: 'A', baseUnitQuantityQ0: 10, basePriceP0Microcents: 100000, currentPriceP1Microcents: 120000 },
      { ingredientId: '2', ingredientName: 'B', baseUnitQuantityQ0: 5, basePriceP0Microcents: 200000, currentPriceP1Microcents: 220000 },
    ];
    const infl = calculateKitchenInflationLaspeyres(basket, 5, 20000);
    assert(infl.indexLaspeyres === 115.0, 'Índice de Laspeyres deve ser 115.0');
    assert(infl.gapMonthlyInCents === 2000, 'Gap deve ser R$ 20,00 (2000 centavos)');

    // Teste de propriedade: Preços inalterados devem gerar exatamente 100.0
    const unchanged = [
      { ingredientId: '1', ingredientName: 'A', baseUnitQuantityQ0: 10, basePriceP0Microcents: 100000, currentPriceP1Microcents: 100000 },
    ];
    assert(calculateKitchenInflationLaspeyres(unchanged).indexLaspeyres === 100.0, 'Preços iguais devem dar índice 100.0');
    console.log('✔ F07: Índice de Laspeyres e teste de propriedade passaram.');
  }

  // 5. F08: Receita sem custo (custos ocultos) e conservação de totais
  {
    const recipesMap = new Map<string, Recipe>();
    const flour = makeTestIngredient({ id: 'flour', name: 'Trigo', baseUnit: 'g', currentUnitCostMicrocents: 100 });
    const pizzaWithCost = makeTestRecipe({
      id: 'rec_ok',
      name: 'Pizza OK',
      lines: [{ id: 'l1', ingredientId: flour.id, quantityInBaseUnit: 100, correctionFactor: 1 }],
    });
    const emptyRecipe = makeTestRecipe({ id: 'rec_empty', name: 'Pizza Vazia', lines: [] });

    recipesMap.set(pizzaWithCost.id, pizzaWithCost);
    recipesMap.set(emptyRecipe.id, emptyRecipe);

    const salesImports: SalesImport[] = [
      {
        id: 'imp1',
        storeId: 'store1',
        channel: 'Balcão',
        periodStartDate: '2026-10-01',
        periodEndDate: '2026-10-31',
        fileHash: 'h1',
        totalGrossInCents: 5000000, // R$ 50.000
        totalNetInCents: 5000000,
        totalOrdersCount: 100,
        stockDeducted: true,
        importedAt: '2026-10-31',
        lines: [
          { externalProductName: 'Pizza OK', mappedRecipeId: 'rec_ok', quantity: 420, salePriceInCents: 10000, totalGrossInCents: 4200000, discountsInCents: 0, channelFeeInCents: 0, netRevenueInCents: 4200000 },
          { externalProductName: 'Pizza Vazia', mappedRecipeId: 'rec_empty', quantity: 50, salePriceInCents: 10000, totalGrossInCents: 500000, discountsInCents: 0, channelFeeInCents: 0, netRevenueInCents: 500000 },
          { externalProductName: 'Refrigerante Fantasma', mappedRecipeId: undefined, quantity: 30, salePriceInCents: 10000, totalGrossInCents: 300000, discountsInCents: 0, channelFeeInCents: 0, netRevenueInCents: 300000 },
        ],
      },
    ];

    const report = calculateUncostedRevenue(salesImports, recipesMap, {});
    assert(report.totalRevenueInCents === 5000000, 'Total deve ser 5.000.000');
    assert(report.costedRevenueInCents === 4200000, 'Com custo deve ser 4.200.000');
    assert(report.noRecipeRevenueInCents === 500000, 'Ficha vazia deve ser 500.000');
    assert(report.unmappedRevenueInCents === 300000, 'Sem mapeamento deve ser 300.000');
    assert(report.uncostedPercentage === 16.0, '% sem custo deve ser 16.0%');
    // Teste de propriedade de soma das partes
    assert(
      report.costedRevenueInCents + report.unmappedRevenueInCents + report.noRecipeRevenueInCents === report.totalRevenueInCents,
      'Soma das partes deve ser estritamente igual ao faturamento total'
    );
    console.log('✔ F08: Receita sem custo validada com conservação da soma.');
  }

  // 6. F13: Variância de uso (teórico vs real)
  {
    const counts: InventoryCount[] = [
      {
        id: 'c0',
        storeId: 's1',
        date: '2026-10-01',
        status: 'COMMITTED',
        lines: [{ ingredientId: 'ing1', expectedQuantityInBaseUnit: 50000, countedQuantityInBaseUnit: 50000, differenceInBaseUnit: 0, discrepancyValueInCents: 0 }],
        totalExpectedValueInCents: 400000,
        totalCountedValueInCents: 400000,
        netDiscrepancyInCents: 0,
      },
      {
        id: 'c1',
        storeId: 's1',
        date: '2026-10-31',
        status: 'COMMITTED',
        lines: [{ ingredientId: 'ing1', expectedQuantityInBaseUnit: 40000, countedQuantityInBaseUnit: 40000, differenceInBaseUnit: 0, discrepancyValueInCents: 0 }],
        totalExpectedValueInCents: 320000,
        totalCountedValueInCents: 320000,
        netDiscrepancyInCents: 0,
      },
    ];

    const ing = makeTestIngredient({ id: 'ing1', name: 'Filé Mignon', baseUnit: 'g', currentUnitCostMicrocents: 80000 }); // R$ 0,08/g = 8 centavos = 80.000 microcentavos

    const movements = [
      {
        id: 'm1',
        storeId: 's1',
        ingredientId: 'ing1',
        type: 'PURCHASE_RECEIPT' as const,
        quantityInBaseUnit: 100000, // 100kg
        unitCostMicrocents: 80000,
        totalCostInCents: 800000,
        createdAt: '2026-10-15',
        createdBy: 'user',
      },
    ];

    const recipesMap = new Map<string, Recipe>();
    const steak = makeTestRecipe({
      id: 'rec_steak',
      name: 'Bife',
      lines: [{ id: 'l1', ingredientId: 'ing1', quantityInBaseUnit: 200, correctionFactor: 1.0 }],
    });
    recipesMap.set(steak.id, steak);

    const salesImports: SalesImport[] = [
      {
        id: 'imp1',
        storeId: 's1',
        channel: 'Balcão',
        periodStartDate: '2026-10-01',
        periodEndDate: '2026-10-31',
        fileHash: 'h1',
        totalGrossInCents: 100000,
        totalNetInCents: 100000,
        totalOrdersCount: 500,
        stockDeducted: true,
        importedAt: '2026-10-31',
        lines: [
          { externalProductName: 'Bife', mappedRecipeId: 'rec_steak', quantity: 500, salePriceInCents: 2000, totalGrossInCents: 100000, discountsInCents: 0, channelFeeInCents: 0, netRevenueInCents: 100000 },
        ],
      },
    ];

    const varReport = calculateUsageVariance(counts, movements, salesImports, recipesMap, new Map([['ing1', ing]]));
    assert(varReport.hasSufficientCounts, 'Deve ter contagens suficientes');
    assert(varReport.items.length === 1, '1 item auditado');
    // Real = 50000 + 100000 - 40000 = 110000g. Teórico = 500 * 200g = 100000g. Variância = +10000g.
    assert(varReport.items[0].varianceInBaseUnit === 10000, 'Variância deve ser 10.000g');
    assert(varReport.items[0].varianceInCents === 80000, 'Prejuízo de 10.000g * R$ 0,08 = R$ 800,00 (80000 centavos)');
    console.log('✔ F13: Variância de uso calculada à mão com exatidão.');
  }

  // 7. F14: Risco de vencimento FEFO
  {
    const cheese = makeTestIngredient({ id: 'brie', name: 'Queijo Brie', baseUnit: 'g', currentUnitCostMicrocents: 100000 }); // R$ 0,10/g = 10 centavos = 100.000 microcentavos
    const now = new Date('2026-10-25T12:00:00Z');
    const lots: StockLot[] = [
      {
        id: 'lot1',
        storeId: 's1',
        ingredientId: 'brie',
        lotNumber: 'LOTE-123',
        remainingQuantityInBaseUnit: 15000, // 15kg
        unitCostMicrocents: 100000,
        expirationDate: '2026-10-30T12:00:00Z', // Vence em 5 dias
        receivedDate: '2026-10-01',
      },
    ];

    // Consumo diário de 2000g/dia -> projeta 10.000g -> sobra 5.000g em risco -> 5000 * R$ 0,10 = R$ 500,00
    const fefo = calculateFefoExpirationRisk(lots, new Map([['brie', cheese]]), { brie: 2000 }, now);
    assert(fefo.items.length === 1, 'Deve detectar 1 lote em risco');
    assert(fefo.items[0].daysRemaining === 5, 'Dias restantes = 5');
    assert(fefo.items[0].excessInBaseUnit === 5000, 'Excedente = 5000g');
    assert(fefo.items[0].amountAtRiskInCents === 50000, 'Valor em risco = 50.000 centavos (R$ 500,00)');
    console.log('✔ F14: Risco de vencimento FEFO validado.');
  }

  // 8. F33: Teste de propriedade estrita — Identidade da Decomposição de CMV
  {
    const items: IngredientPeriodConsumption[] = [
      {
        ingredientId: 'i1',
        ingredientName: 'Carne',
        quantityQ0: 100000, // 100kg em gramas
        unitCostMicrocentsP0: 10000, // R$ 10,00/kg = 10.000 microcentavos/g
        quantityQ1: 130000, // 130kg em gramas
        unitCostMicrocentsP1: 12000, // R$ 12,00/kg = 12.000 microcentavos/g
      },
    ];

    // V0 = 500, V1 = 600
    const decomp = decomposeCmvVariance(items, 500, 600);
    assert(decomp.deltaCmvInCents === 56000, 'Delta CMV deve ser 56.000 centavos');
    assert(decomp.priceEffectInCents === 26000, 'Efeito Preço deve ser 26.000 centavos');
    assert(decomp.volumeEffectInCents === 20000, 'Efeito Volume deve ser 20.000 centavos');
    assert(decomp.usageMixEffectInCents === 10000, 'Efeito Uso/Mix deve ser 10.000 centavos');
    assert(decomp.identityCheckPassed, 'Identidade matemática deve passar');
    assert(
      decomp.priceEffectInCents + decomp.volumeEffectInCents + decomp.usageMixEffectInCents === decomp.deltaCmvInCents,
      'Preço + Volume + Uso DEVE ser identicamente igual a ΔCMV'
    );

    // Teste de propriedade pseudo-aleatório com 5 insumos aleatórios
    const randomItems: IngredientPeriodConsumption[] = [];
    for (let i = 0; i < 5; i++) {
      randomItems.push({
        ingredientId: `rand_${i}`,
        ingredientName: `Insumo ${i}`,
        quantityQ0: Math.floor(Math.random() * 500) + 10,
        unitCostMicrocentsP0: Math.floor(Math.random() * 200000) + 1000,
        quantityQ1: Math.floor(Math.random() * 500) + 10,
        unitCostMicrocentsP1: Math.floor(Math.random() * 200000) + 1000,
      });
    }
    const randDecomp = decomposeCmvVariance(randomItems, 1000, 1150);
    assert(randDecomp.identityCheckPassed, 'Identidade deve passar em dataset aleatório');
    assert(
      randDecomp.priceEffectInCents + randDecomp.volumeEffectInCents + randDecomp.usageMixEffectInCents === randDecomp.deltaCmvInCents,
      'Identidade deve fechar ao centavo exato em dataset aleatório'
    );
    console.log('✔ F33: Identidade de decomposição de CMV comprovada analítica e estatisticamente.');
  }

  // 9. F43: Testes de similaridade determinística (identidade, simetria)
  {
    const s1 = 'Pizza Mussarela Especial Grande';
    const s2 = 'Mussarela Pizza Grande Especial';
    const score1 = calculateJaroWinkler(s1, s2);
    const score2 = calculateJaroWinkler(s2, s1);
    assert(score1 === score2, 'Similaridade Jaro-Winkler deve ser simétrica');

    // Teste Limiar Alto (com stopword "de" normalizada) -> Match 1.0 (ALTA)
    const highMatches = matchProductToRecipes('Pizza de Mussarela', [
      { id: '1', name: 'Pizza Mussarela' },
      { id: '2', name: 'Suco de Laranja' },
    ]);
    assert(highMatches.length > 0, 'Deve encontrar match alto');
    assert(highMatches[0].targetId === '1', 'Pizza deve ser match alto');
    assert(highMatches[0].confidenceTier === 'ALTA', 'Deve ser limiar ALTA');

    // Teste Limiar Médio ('8 Fatias') -> score >= 0.60 (MEDIA)
    const medMatches = matchProductToRecipes('Pizza Mussarela 8 Fatias', [
      { id: '1', name: 'Pizza Mussarela' },
      { id: '2', name: 'Suco de Laranja' },
    ]);
    assert(medMatches.length > 0, 'Deve encontrar match médio');
    assert(medMatches[0].targetId === '1', 'Pizza deve ser o melhor match');
    assert(medMatches[0].score >= 0.60, 'Deve pontuar acima do limiar médio');
    assert(medMatches[0].confidenceTier === 'MEDIA', 'Deve ser classificado como MEDIA');
    console.log('✔ F43: Similaridade determinística simétrica e precisa.');
  }

  // 10. F44: Parser seguro de NF-e e resistência a XXE
  {
    const sampleXml = `
      <nfeProc xmlns="http://www.portalfiscal.inf.br/nfe">
        <NFe>
          <infNFe Id="NFe35261012345678000199550010000012341000012345">
            <ide>
              <nNF>1234</nNF>
              <serie>1</serie>
              <dhEmi>2026-10-29T10:00:00-03:00</dhEmi>
            </ide>
            <emit>
              <CNPJ>12345678000199</CNPJ>
              <xNome>Distribuidora de Alimentos Alvorada Ltda</xNome>
            </emit>
            <det nItem="1">
              <prod>
                <cProd>FAR-01</cProd>
                <xProd>Farinha de Trigo Especial 25kg</xProd>
                <NCM>11010010</NCM>
                <uCom>SC</uCom>
                <qCom>2.0000</qCom>
                <vUnCom>120.0000</vUnCom>
                <vProd>240.00</vProd>
              </prod>
            </det>
            <total>
              <ICMSTot>
                <vProd>240.00</vProd>
                <vNF>240.00</vNF>
              </ICMSTot>
            </total>
          </infNFe>
        </NFe>
      </nfeProc>
    `;

    const parsed = parseNfeXml(sampleXml);
    assert(parsed.accessKey === '35261012345678000199550010000012341000012345', 'Chave de 44 dígitos extraída');
    assert(parsed.invoiceNumber === '1234', 'Número da nota extraído');
    assert(parsed.items.length === 1, '1 item extraído');
    assert(parsed.items[0].totalPriceInCents === 24000, 'Total do produto deve ser 24000 centavos (R$ 240,00)');

    // Teste de Segurança: XML malicioso com XXE deve ser terminantemente rejeitado
    let xxeBlocked = false;
    try {
      parseNfeXml('<!DOCTYPE test [<!ENTITY xxe SYSTEM "http://evil.com">]><xml></xml>');
    } catch {
      xxeBlocked = true;
    }
    assert(xxeBlocked, 'Parser DEVE bloquear injeção XXE / DTD');
    console.log('✔ F44: Parser de NF-e validado e proteção contra XXE comprovada.');
  }

  // 11. F48 e F49: Central de valor e Fila "Faça Hoje"
  {
    const summary = summarizeValueBrought([
      {
        id: '1',
        type: 'IDENTIFICADO',
        category: 'REAJUSTE_PRECO',
        title: 'Reajuste sugerido',
        description: 'Subir pizza',
        amountInCents: 154000,
        minutesSaved: 0,
        createdAt: '2026-10-29',
        explanation: {
          valor: 154000,
          unidade: 'centavos',
          formula: '',
          entradas: {},
          passos: [],
          suficienciaDeDados: { suficiente: true, percentualConfiabilidade: 100 },
          confianca: 'ALTA',
        },
      },
      {
        id: '2',
        type: 'REALIZADO',
        category: 'ECONOMIA_COMPRA',
        title: 'Economia comprovada',
        description: 'Compra abaixo da mediana',
        amountInCents: 50000,
        minutesSaved: 30,
        createdAt: '2026-10-29',
        explanation: {
          valor: 50000,
          unidade: 'centavos',
          formula: '',
          entradas: {},
          passos: [],
          suficienciaDeDados: { suficiente: true, percentualConfiabilidade: 100 },
          confianca: 'ALTA',
        },
      },
    ]);

    assert(summary.totalIdentifiedInCents === 154000, 'Identificado correto');
    assert(summary.totalRealizedInCents === 50000, 'Realizado correto');
    assert(summary.totalRealizedInCents <= summary.totalIdentifiedInCents, 'Invariante: Realizado <= Identificado');
    assert(summary.totalMinutesSaved === 30, '30 minutos economizados');

    // F49 Ordenação por R$ em jogo
    const tasks = prioritizeDailyTasks([
      { id: 't1', code: 'A', title: 'T1', description: '', amountInPlayInCents: 1000, actionLabel: '', actionTab: '', completed: false, explanation: {} as any },
      { id: 't2', code: 'B', title: 'T2', description: '', amountInPlayInCents: 50000, actionLabel: '', actionTab: '', completed: false, explanation: {} as any },
    ]);
    assert(tasks[0].id === 't2', 'Tarefa de 50.000 centavos deve vir antes da de 1.000 centavos');
    console.log('✔ F48 & F49: Central de valor e Fila priorizada por R$ em jogo validadas.');
  }

  // 12. F51: Auditoria de qualidade dos dados
  {
    const quality = auditDataQuality([], [], [], []);
    assert(quality.score >= 0 && quality.score <= 100, 'Score deve estar entre 0 e 100');
    assert(quality.confidenceLevel === 'BAIXA', 'Sem dados deve ser confiabilidade BAIXA');
    console.log('✔ F51: Auditoria de qualidade dos dados validada.');
  }

  console.log('--- Todos os Testes da Onda 1 Passaram com 100% de Sucesso! ---');
}
