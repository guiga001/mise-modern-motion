/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * MISE Intelligence — Testes Automatizados do Motor de Inteligência Matemática
 * Invariante: 100% Determinístico, sem IA, validado com cálculos manuais exatos.
 */

import {
  calculateFinancialIntelligence,
  calculateComparativeAnalysis,
  calculateProductIntelligenceAndAbc,
  calculateMenuMatrix,
  calculateStockIntelligence,
  calculateWasteIntelligence,
  calculateMathematicalProjections,
  calculateRestaurantDiagnosticScore,
  evaluateMathematicalAlerts,
} from '../src/domain/intelligence-engine';
import {
  SalesImport,
  StockMovement,
  PayableEntry,
  ReceivableEntry,
  Recipe,
  Ingredient,
} from '../src/domain/types';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`[FALHA NO TESTE MISE INTELLIGENCE]: ${msg}`);
  }
}

export function runIntelligenceEngineTests() {
  console.log('--- Iniciando Testes do MISE Intelligence (Motor Matemático) ---');

  // TESTE 1: Inteligência Financeira (Margem de Contribuição, Ponto de Equilíbrio, Lucro Operacional)
  {
    const mockSales: SalesImport[] = [
      {
        id: 's1',
        storeId: 'store_1',
        channel: 'iFood',
        periodStartDate: '2026-11-01',
        periodEndDate: '2026-11-01',
        fileHash: 'h1',
        totalGrossInCents: 1000000, // R$ 10.000,00
        totalNetInCents: 850000, // R$ 8.500,00 (taxas de R$ 1.500,00)
        totalOrdersCount: 100,
        lines: [],
        stockDeducted: true,
        importedAt: '2026-11-01T12:00:00Z',
      },
    ];

    const mockMovements: StockMovement[] = [
      {
        id: 'm1',
        storeId: 'store_1',
        ingredientId: 'ing1',
        type: 'SALES_CONSUMPTION',
        quantityInBaseUnit: 1000,
        totalCostInCents: 255000, // CMV = R$ 2.550,00 (30% sobre líquida)
        unitCostMicrocents: 2550000,
        createdAt: '2026-11-01T12:00:00Z',
        createdBy: 'user_1',
      },
    ];

    const mockPayables: PayableEntry[] = [
      {
        id: 'p1',
        storeId: 'store_1',
        description: 'Aluguel do Ponto',
        category: 'ALUGUEL',
        amountInCents: 300000, // R$ 3.000,00 (Custo Fixo)
        dueDate: '2026-11-01',
        status: 'PAID',
      },
      {
        id: 'p2',
        storeId: 'store_1',
        description: 'Taxa de Sistema',
        category: 'OUTROS',
        amountInCents: 50000, // R$ 500,00 (Despesa Operacional)
        dueDate: '2026-11-01',
        status: 'PAID',
      },
    ];

    const kpis = calculateFinancialIntelligence('store_1', mockSales, mockMovements, mockPayables, [], 30);

    // Margem de Contribuição = Receita Líquida (850000) - Custos Variáveis (255000) = 595000 (R$ 5.950,00)
    assert(kpis.contributionMarginInCents === 595000, 'MC deve ser exatamente 595000 centavos');
    // MC % = (595000 / 850000) * 100 = 70.0%
    assert(kpis.contributionMarginPercentage === 70.0, 'MC % deve ser 70.0%');

    // Lucro Operacional = MC (595000) - Fixos (300000) - Despesas (50000) = 245000 (R$ 2.450,00)
    assert(kpis.estimatedOperatingProfitInCents === 245000, 'Lucro Operacional deve ser 245000 centavos');

    // Ticket Médio = 850000 / 100 = 8500 centavos (R$ 85,00)
    assert(kpis.averageTicketInCents === 8500, 'Ticket Médio deve ser 8500 centavos');

    // Ponto de Equilíbrio = Total Despesas Fixas (350000) / Índice de MC (0.7) = 500000 (R$ 5.000,00)
    assert(kpis.breakEvenPointInCents === 500000, 'Ponto de equilíbrio deve ser exatamente 500000 centavos');
    console.log('✔ Teste 1: Fórmulas de Inteligência Financeira e Ponto de Equilíbrio validadas.');
  }

  // TESTE 2: Análise Comparativa (Hoje vs Ontem / Crescimento %)
  {
    const curr = {
      label: 'Hoje',
      grossRevenueInCents: 120000, // R$ 1.200,00
      netRevenueInCents: 100000, // R$ 1.000,00
      contributionMarginInCents: 60000,
      ordersCount: 20,
      averageTicketInCents: 5000,
      operatingProfitInCents: 20000,
    };

    const prev = {
      label: 'Ontem',
      grossRevenueInCents: 96000, // R$ 960,00
      netRevenueInCents: 80000, // R$ 800,00
      contributionMarginInCents: 48000,
      ordersCount: 20,
      averageTicketInCents: 4000,
      operatingProfitInCents: 10000,
    };

    const comp = calculateComparativeAnalysis(curr, prev);
    const revComp = comp.comparisons.find(c => c.metricName === 'Faturamento Líquido');
    assert(!!revComp, 'Comparação de faturamento líquido deve existir');
    // Delta absoluto = 100000 - 80000 = +20000 centavos
    assert(revComp!.absoluteDelta === 20000, 'Delta absoluto deve ser +20000 centavos');
    // Delta % = ((100000 - 80000) / 80000) * 100 = +25.0%
    assert(revComp!.percentageDelta === 25.0, 'Delta % deve ser exatamente +25.0%');
    console.log('✔ Teste 2: Análise Comparativa e Cálculo Percentual validados.');
  }

  // TESTE 3: Curva ABC de Pareto de Produtos
  {
    const mockRecipes: Recipe[] = [
      {
        id: 'r1',
        name: 'Prato A (Campeão de Faturamento)',
        category: 'Principais',
        isSubRecipe: false,
        yieldPortions: 1,
        lines: [],
        salePriceInCents: 5000,
        targetMarginPercentage: 70,
        createdAt: '',
        updatedAt: '',
      },
      {
        id: 'r2',
        name: 'Prato B (Médio)',
        category: 'Principais',
        isSubRecipe: false,
        yieldPortions: 1,
        lines: [],
        salePriceInCents: 3000,
        targetMarginPercentage: 70,
        createdAt: '',
        updatedAt: '',
      },
      {
        id: 'r3',
        name: 'Prato C (Cauda)',
        category: 'Sobremesas',
        isSubRecipe: false,
        yieldPortions: 1,
        lines: [],
        salePriceInCents: 1500,
        targetMarginPercentage: 70,
        createdAt: '',
        updatedAt: '',
      },
    ];

    const mockSales: SalesImport[] = [
      {
        id: 's1',
        storeId: 'store_1',
        channel: 'PDV',
        periodStartDate: '2026-11-01',
        periodEndDate: '2026-11-01',
        fileHash: 'h_abc',
        totalGrossInCents: 100000,
        totalNetInCents: 100000,
        totalOrdersCount: 25,
        lines: [
          {
            externalProductName: 'Prato A',
            mappedRecipeId: 'r1',
            quantity: 16, // 16 * 50 = 800 (80%)
            salePriceInCents: 5000,
            totalGrossInCents: 80000,
            discountsInCents: 0,
            channelFeeInCents: 0,
            netRevenueInCents: 80000,
          },
          {
            externalProductName: 'Prato B',
            mappedRecipeId: 'r2',
            quantity: 5, // 5 * 30 = 150 (15%)
            salePriceInCents: 3000,
            totalGrossInCents: 15000,
            discountsInCents: 0,
            channelFeeInCents: 0,
            netRevenueInCents: 15000,
          },
          {
            externalProductName: 'Prato C',
            mappedRecipeId: 'r3',
            quantity: 3, // 3 * 15 = 45 (5%)
            salePriceInCents: 1500,
            totalGrossInCents: 5000,
            discountsInCents: 0,
            channelFeeInCents: 0,
            netRevenueInCents: 5000,
          },
        ],
        stockDeducted: true,
        importedAt: '',
      },
    ];

    const costs = new Map([
      ['r1', { totalCostInCents: 1500 }],
      ['r2', { totalCostInCents: 1000 }],
      ['r3', { totalCostInCents: 500 }],
    ]);

    const abc = calculateProductIntelligenceAndAbc(mockRecipes, costs, mockSales, 'store_1');
    assert(abc.abcDistribution.classA.items.length >= 1, 'Deve possuir ao menos 1 item Classe A');
    assert(abc.abcDistribution.classA.items[0].recipeId === 'r1', 'Prato A deve ser classificado como Classe A');
    console.log('✔ Teste 3: Curva ABC de Produtos (Pareto 80/15/5%) validada.');
  }

  // TESTE 4: Engenharia de Cardápio (Kasavana & Smith)
  {
    const recipes: Recipe[] = [
      {
        id: 'r_star',
        name: 'Burger Estrela',
        category: 'Burgers',
        isSubRecipe: false,
        yieldPortions: 1,
        lines: [],
        salePriceInCents: 4000,
        targetMarginPercentage: 75,
        createdAt: '',
        updatedAt: '',
      },
      {
        id: 'r_dog',
        name: 'Sobremesa Abacaxi',
        category: 'Doces',
        isSubRecipe: false,
        yieldPortions: 1,
        lines: [],
        salePriceInCents: 1000,
        targetMarginPercentage: 40,
        createdAt: '',
        updatedAt: '',
      },
    ];

    const sales: SalesImport[] = [
      {
        id: 's1',
        storeId: 'store_1',
        channel: 'PDV',
        periodStartDate: '',
        periodEndDate: '',
        fileHash: '',
        totalGrossInCents: 0,
        totalNetInCents: 0,
        totalOrdersCount: 0,
        lines: [
          {
            externalProductName: 'Burger Estrela',
            mappedRecipeId: 'r_star',
            quantity: 80, // Volume alto
            salePriceInCents: 4000,
            totalGrossInCents: 320000,
            discountsInCents: 0,
            channelFeeInCents: 0,
            netRevenueInCents: 320000,
          },
          {
            externalProductName: 'Sobremesa Abacaxi',
            mappedRecipeId: 'r_dog',
            quantity: 5, // Volume baixo
            salePriceInCents: 1000,
            totalGrossInCents: 5000,
            discountsInCents: 0,
            channelFeeInCents: 0,
            netRevenueInCents: 5000,
          },
        ],
        stockDeducted: true,
        importedAt: '',
      },
    ];

    const costs = new Map([
      ['r_star', { totalCostInCents: 1000 }], // Margem R$ 30,00 (alta)
      ['r_dog', { totalCostInCents: 800 }], // Margem R$ 2,00 (baixa)
    ]);

    const matrix = calculateMenuMatrix(recipes, costs, sales, 'store_1');
    assert(matrix.stars.some(s => s.recipeId === 'r_star'), 'Burger Estrela deve ser classificado como STAR');
    assert(matrix.dogs.some(d => d.recipeId === 'r_dog'), 'Sobremesa deve ser classificada como DOG (Abacaxi)');
    console.log('✔ Teste 4: Matriz de Engenharia de Cardápio (Kasavana & Smith) validada.');
  }

  // TESTE 5: Ponto de Reposição (ROP) e Ruptura de Estoque
  {
    const mockIngredients: Ingredient[] = [
      {
        id: 'ing_meat',
        name: 'Carne Bovina Moída',
        category: 'Carnes',
        baseUnit: 'g',
        currentUnitCostMicrocents: 40000, // R$ 0,04 / grama
        minimumStockInBaseUnit: 2000,
        packagings: [],
        updatedAt: '',
      },
    ];

    // 10.000g consumidos em 10 dias = 1.000g/dia
    // ROP = 1000 * 3 + 1500 = 4.500g
    // Saldo = 1.000g (< 4.500g) -> Deve acusar Ponto de Pedido (BELOW_ROP)
    const mockMovements: StockMovement[] = [
      {
        id: 'm1',
        storeId: 'store_1',
        ingredientId: 'ing_meat',
        type: 'SALES_CONSUMPTION',
        quantityInBaseUnit: -10000,
        totalCostInCents: 40000,
        unitCostMicrocents: 40000,
        createdAt: '2026-11-01',
        createdBy: 'user_1',
      },
      {
        id: 'm2',
        storeId: 'store_1',
        ingredientId: 'ing_meat',
        type: 'PURCHASE_RECEIPT',
        quantityInBaseUnit: 11000,
        totalCostInCents: 44000,
        unitCostMicrocents: 40000,
        createdAt: '2026-11-01',
        createdBy: 'user_1',
      },
    ];

    const stock = calculateStockIntelligence(mockIngredients, mockMovements, 'store_1', 10);
    assert(stock.allItems.length === 1, 'Deve calcular item');
    assert(stock.allItems[0].currentBalance === 1000, 'Saldo deve ser 1000g');
    assert(stock.allItems[0].reorderPoint === 4500, 'ROP deve ser 4500g');
    assert(stock.allItems[0].status === 'BELOW_ROP', 'Status deve ser BELOW_ROP');
    console.log('✔ Teste 5: Cálculo do Ponto de Reposição (ROP = d × L + SS) validado.');
  }

  // TESTE 6: Projeção Estatística e Tendência Linear
  {
    const sales: SalesImport[] = [
      {
        id: 's1',
        storeId: 'store_1',
        channel: 'PDV',
        periodStartDate: '2026-11-01',
        periodEndDate: '2026-11-01',
        fileHash: 'h1',
        totalGrossInCents: 100000,
        totalNetInCents: 100000,
        totalOrdersCount: 20,
        lines: [],
        stockDeducted: true,
        importedAt: '',
      },
      {
        id: 's2',
        storeId: 'store_1',
        channel: 'PDV',
        periodStartDate: '2026-11-02',
        periodEndDate: '2026-11-02',
        fileHash: 'h2',
        totalGrossInCents: 200000,
        totalNetInCents: 200000,
        totalOrdersCount: 40,
        lines: [],
        stockDeducted: true,
        importedAt: '',
      },
    ];

    const proj = calculateMathematicalProjections(sales, 'store_1', 30);
    assert(proj.historicalDaysCount === 2, 'Deve ter 2 dias históricos');
    assert(proj.projectedMonthEndRevenueInCents > 0, 'Projeção de fechamento deve ser positiva');
    assert(proj.demandForecastNext7Days.length === 7, 'Deve gerar previsão determinística de 7 dias');
    console.log('✔ Teste 6: Projeções Matemáticas e Séries Temporais validadas.');
  }

  console.log('=== TODOS OS TESTES DO MISE INTELLIGENCE PASSARAM COM 100% DE SUCESSO ===');
}
