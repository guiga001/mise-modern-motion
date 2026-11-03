/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Suíte de Testes da Onda 3 (Completude Matemática & Funcionalidades F04–F47)
 */

import { makeTestIngredient, makeTestRecipe } from './factories';
import {
  simulatePriceElasticity,
  calculateMinimumPriceByChannel,
  calculateComboPricing,
} from '../src/domain/cost-simulator';
import {
  balanceInventoryBetweenStores,
  calculateStoreBenchmarkAndGaps,
} from '../src/domain/multi-store';
import {
  planProductionOrders,
  analyzeBatchYieldAndOutliers,
  optimizeProductMixKnapsack,
  calculateLaborProductivityAndNeeds,
} from '../src/domain/operations-intelligence';
import { calculateProcurementDeadlines } from '../src/domain/procurement-deadlines';
import {
  calculateMarketBasketAffinity,
  detectAnomalousSalesDrop,
} from '../src/domain/sales-affinity';
import {
  simulateLoanFinancing,
  rescheduleFlexiblePayables,
  generateRecurringScheduleWithIndex,
} from '../src/domain/financial-extensions';
import { previewBatchEdit, createBatchEditUndoSnapshot } from '../src/domain/batch-management';
import { Store, Supplier, PayableEntry, RecipeCycleError } from '../src/domain/types';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`FALHA NA ASSERÇÃO ONDA 3: ${msg}`);
  }
}

export function runWave3Tests() {
  console.log('--- Iniciando Testes da Onda 3 do Mise ---');

  // =========================================================================
  // 1. F04: Simulador de Preço com Elasticidade Informada
  // =========================================================================
  {
    const pizza = makeTestRecipe({
      id: 'rec_pizza_marg',
      name: 'Pizza Margherita',
      salePriceInCents: 3000, // R$ 30,00
      yieldPortions: 1,
    });

    // Sem elasticidade -> deve recusar com dados insuficientes
    const noElasticitySim = simulatePriceElasticity(pizza, 1200, 500, undefined);
    assert(!noElasticitySim.explanation.suficienciaDeDados.suficiente, 'Sem elasticidade deve reportar dados insuficientes');
    assert(noElasticitySim.explanation.confianca === 'INSUFICIENTE', 'Confiança deve ser INSUFICIENTE');

    // Com elasticidade 0 -> lucro cresce linearmente com preço
    const inelastSim = simulatePriceElasticity(pizza, 1200, 500, 0, 0, 0, 20, 10);
    const p0 = inelastSim.points[0];
    const p10 = inelastSim.points[1];
    const p20 = inelastSim.points[2];
    assert(p0.simulatedVolume === 500 && p10.simulatedVolume === 500 && p20.simulatedVolume === 500, 'Volume deve ser constante com ε = 0');
    assert(p20.grossProfitInCents > p10.grossProfitInCents && p10.grossProfitInCents > p0.grossProfitInCents, 'Lucro deve crescer monotonicamente com ε = 0');

    // Com elasticidade normal ε = -1.5 (exemplo calculado à mão do docs/formulas/F04)
    const elastSim = simulatePriceElasticity(pizza, 1200, 500, -1.5, 0, 10, 10, 1);
    const pt10 = elastSim.points[0];
    assert(pt10.simulatedPriceInCents === 3300, `Preço deve ser 3300, obtido: ${pt10.simulatedPriceInCents}`);
    assert(pt10.simulatedVolume === 425, `Volume deve ser 425, obtido: ${pt10.simulatedVolume}`);
    assert(pt10.grossProfitInCents === 892500, `Lucro deve ser 892.500 centavos, obtido: ${pt10.grossProfitInCents}`);
    console.log('✔ F04: Simulador de elasticidade validado com ε nulo, ε=0 e exemplo numérico.');
  }

  // =========================================================================
  // 2. F05: Preço Mínimo por Canal de Venda
  // =========================================================================
  {
    const burger = makeTestRecipe({
      id: 'rec_burger',
      name: 'Burger Gourmet',
      salePriceInCents: 2000,
    });

    // Exemplo do docs/formulas/F05: Custo = 1000, Emb = 200, Margem = 20%, Com = 23%, Pag = 3%, Imp = 4%
    const channelRes = calculateMinimumPriceByChannel(burger, 1000, 200, 20, 23, 3, 4, 'iFood');
    assert(!channelRes.isImpossible, 'Canal com margem viável não deve ser impossível');
    assert(channelRes.minimumPriceInCents === 2400, `Preço mínimo deve ser 2400 centavos (R$ 24,00), obtido: ${channelRes.minimumPriceInCents}`);
    assert(Math.abs(channelRes.netMarginPercentage - 20) <= 0.1, `Margem obtida deve ser ~20%, obtido: ${channelRes.netMarginPercentage}`);

    // Caso impossível: deduções somam >= 100%
    const impossibleRes = calculateMinimumPriceByChannel(burger, 1000, 200, 50, 30, 15, 10, 'Canal Invulgar');
    assert(impossibleRes.isImpossible, 'Deduções >= 100% deve ser sinalizado como impossível');
    console.log('✔ F05: Preço mínimo por canal com validação de margem e caso impossível aprovado.');
  }

  // =========================================================================
  // 3. F06: Preço de Combo e Desconto Máximo
  // =========================================================================
  {
    // Exemplo docs/formulas/F06:
    // Hambúrguer: Custo 800, Preço 2500
    // Batata: Custo 200, Preço 1000
    // Refrigerante: Custo 250, Preço 800
    const comboRes = calculateComboPricing(
      'Combo Clássico',
      [
        { recipeId: 'r1', recipeName: 'Hambúrguer', costInCents: 800, regularPriceInCents: 2500 },
        { recipeId: 'r2', recipeName: 'Batata', costInCents: 200, regularPriceInCents: 1000 },
        { recipeId: 'r3', recipeName: 'Refri', costInCents: 250, regularPriceInCents: 800 },
      ],
      50, // margem mínima 50%
      30  // desconto simulado 30%
    );

    assert(comboRes.totalCostInCents === 1250, `Custo total do combo deve ser 1250, obtido: ${comboRes.totalCostInCents}`);
    assert(comboRes.totalRegularPriceInCents === 4300, `Soma dos avulsos deve ser 4300, obtido: ${comboRes.totalRegularPriceInCents}`);
    assert(comboRes.minimumComboPriceInCents === 2500, `Preço mínimo do combo deve ser 2500, obtido: ${comboRes.minimumComboPriceInCents}`);
    assert(Math.abs(comboRes.maxSafeDiscountPercentage - 41.86) < 0.1, `Desconto máximo seguro deve ser ~41.86%, obtido: ${comboRes.maxSafeDiscountPercentage}`);
    assert(comboRes.isSafe, 'Desconto de 30% deve ser seguro');

    // Desconto de 45% (acima de 41.86%) deve acusar inseguro
    const unsafeRes = calculateComboPricing(
      'Combo Clássico',
      [
        { recipeId: 'r1', recipeName: 'Hambúrguer', costInCents: 800, regularPriceInCents: 2500 },
        { recipeId: 'r2', recipeName: 'Batata', costInCents: 200, regularPriceInCents: 1000 },
        { recipeId: 'r3', recipeName: 'Refri', costInCents: 250, regularPriceInCents: 800 },
      ],
      50,
      45
    );
    assert(!unsafeRes.isSafe, 'Desconto de 45% deve ser considerado inseguro');
    console.log('✔ F06: Preço de combo e margem mínima com desconto seguro validados.');
  }

  // =========================================================================
  // 4. F16: Balanceamento de Estoque Entre Lojas
  // =========================================================================
  {
    const stores: Store[] = [
      { id: 'store_matriz', name: 'Matriz', isMainStore: true, createdAt: '' },
      { id: 'store_filial', name: 'Filial', isMainStore: false, createdAt: '' },
    ];
    const beef = makeTestIngredient({
      id: 'ing_beef',
      name: 'Filé Mignon',
      baseUnit: 'g',
      currentUnitCostMicrocents: 80000, // R$ 0,08/g
    });

    const stockMap = {
      store_matriz: { [beef.id]: 50000 }, // 50 dias de consumo (1000g/dia)
      store_filial: { [beef.id]: 2000 },  // 2.5 dias de consumo (800g/dia)
    };
    const dailyMap = {
      store_matriz: { [beef.id]: 1000 },
      store_filial: { [beef.id]: 800 },
    };

    const balancing = balanceInventoryBetweenStores(stores, [beef], stockMap, dailyMap, {
      ceilingDays: 20,
      floorDays: 15, // na origem piso seguro = 15.000g
      targetDays: 10, // no destino meta = 8.000g (necessidade = 6.000g)
      defaultFreightCostInCents: 3000,
      packagingMultipleByIng: { [beef.id]: 2000 },
    });

    assert(balancing.transfers.length === 1, 'Deve haver exatamente 1 transferência');
    const t = balancing.transfers[0];
    assert(t.transferQuantity === 6000, `Quantidade transferida deve ser 6.000g, obtido: ${t.transferQuantity}`);
    assert(t.valueTransferredInCents === 48000, `Valor transferido deve ser 48.000 centavos, obtido: ${t.valueTransferredInCents}`);
    assert(t.netBenefitInCents === 45000, `Ganho líquido deve ser 45.000 centavos, obtido: ${t.netBenefitInCents}`);
    console.log('✔ F16: Balanceamento entre lojas respeitando pisos e custo de frete validado.');
  }

  // =========================================================================
  // 5. F21: Calendário de Compras por Fornecedor
  // =========================================================================
  {
    const supplier: Supplier = {
      id: 'sup_lat',
      name: 'Laticínios Serra',
      cnpj: '12.345.678/0001-90',
      leadTimeDays: 2,
      deliveryDaysOfWeek: [2, 4], // Terça (2) e Quinta (4)
      paymentTermsDays: 14,
      minimumOrderInCents: 10000,
      updatedAt: '',
    };
    const ing = makeTestIngredient({ id: 'ing_cheese', name: 'Queijo' });

    // Stock out projetado para uma Sexta-feira dia 2026-03-20
    const res = calculateProcurementDeadlines(
      [{ ingredient: ing, supplier, stockOutProjectedDate: '2026-03-20' }],
      new Date('2026-03-10T12:00:00Z')
    );

    assert(res.deadlines.length === 1, 'Deve gerar 1 prazo');
    // Sexta (20) - 2 dias lead time = Quarta (18). Quarta não é dia de corte -> recua para Terça (17/03/2026)
    assert(res.deadlines[0].latestOrderDate === '2026-03-17', `Data limite deve ser 2026-03-17, obtido: ${res.deadlines[0].latestOrderDate}`);
    console.log('✔ F21: Calendário de compras com dia de corte e lead time aprovado.');
  }

  // =========================================================================
  // 6. F24: Afinidade de Cesta de Compras (Market Basket)
  // =========================================================================
  {
    // Criar dataset sintético com 100 pedidos
    // 40 pedidos com Burger e Batata (alta afinidade)
    // 10 pedidos só Burger
    // 10 pedidos só Batata
    // 40 pedidos com Refrigerante
    const orders: { orderId: string; items: { productId: string; productName: string }[] }[] = [];
    for (let i = 1; i <= 40; i++) {
      orders.push({
        orderId: `ord_${i}`,
        items: [
          { productId: 'burger', productName: 'Hambúrguer' },
          { productId: 'fries', productName: 'Batata Frita' },
        ],
      });
    }
    for (let i = 41; i <= 50; i++) {
      orders.push({ orderId: `ord_${i}`, items: [{ productId: 'burger', productName: 'Hambúrguer' }] });
    }
    for (let i = 51; i <= 60; i++) {
      orders.push({ orderId: `ord_${i}`, items: [{ productId: 'fries', productName: 'Batata Frita' }] });
    }
    for (let i = 61; i <= 100; i++) {
      orders.push({ orderId: `ord_${i}`, items: [{ productId: 'soda', productName: 'Refrigerante' }] });
    }

    const affinity = calculateMarketBasketAffinity(orders, 5, 20, 1.2);
    assert(affinity.rules.length > 0, 'Deve encontrar regras de afinidade');
    const burgerFries = affinity.rules.find((r) => r.itemAId === 'burger' && r.itemBId === 'fries');
    assert(!!burgerFries, 'Regra Burger -> Fries deve existir');
    // Suporte(B, F) = 40/100 = 40%. Confiança = 40/50 = 80%. Suporte(F) = 50/100 = 50%. Lift = 80/50 = 1.6
    assert(burgerFries!.lift === 1.6, `Lift deve ser 1.6, obtido: ${burgerFries!.lift}`);
    console.log('✔ F24: Afinidade de cesta com Suporte, Confiança e Lift validada.');
  }

  // =========================================================================
  // 7. F27: Queda Anômala de Vendas com z Robusto
  // =========================================================================
  {
    // 5 sextas-feiras normais de ~5000 reais e uma sexta anômala de 3200 reais
    const sales = [
      { date: '2026-01-02', revenueInCents: 480000 },
      { date: '2026-01-09', revenueInCents: 500000 },
      { date: '2026-01-16', revenueInCents: 520000 },
      { date: '2026-01-23', revenueInCents: 510000 },
      { date: '2026-01-30', revenueInCents: 490000 },
      { date: '2026-02-06', revenueInCents: 320000 }, // Queda anômala
    ];

    const anomalyRes = detectAnomalousSalesDrop(sales, -2.5, 4);
    const anomItem = anomalyRes.alerts.find((a) => a.date === '2026-02-06');
    assert(!!anomItem && anomItem.isAnomalous, 'A sexta-feira de 3200 deve ser classificada como anômala');
    assert(anomItem!.revenueDropInCents === 180000, `Perda estimada deve ser 180.000 centavos, obtido: ${anomItem!.revenueDropInCents}`);
    console.log('✔ F27: Detecção de queda anômala com z robusto (mediana/MAD) aprovada.');
  }

  // =========================================================================
  // 8. F36: Simulador de Financiamento Price / SAC / TIR
  // =========================================================================
  {
    // PV = 10.000, n = 5 meses, i = 2% a.m. (Exemplo docs/formulas/F36)
    const priceRes = simulateLoanFinancing(1000000, 2.0, 5, 'PRICE');
    assert(priceRes.installments.length === 5, 'Deve ter 5 parcelas');
    assert(priceRes.installments[0].paymentInCents === 212158, `PMT deve ser 212.158 centavos, obtido: ${priceRes.installments[0].paymentInCents}`);
    assert(priceRes.installments[4].balanceInCents === 0, 'Saldo devedor final deve ser zero');
    // Teste de propriedade: a TIR reproduz a taxa nominal de 2%
    assert(Math.abs(priceRes.effectiveMonthlyRateCetPercentage - 2.0) < 0.01, `TIR deve ser ~2.00%, obtido: ${priceRes.effectiveMonthlyRateCetPercentage}`);

    // SAC
    const sacRes = simulateLoanFinancing(1000000, 2.0, 5, 'SAC');
    assert(sacRes.installments[0].amortizationInCents === 200000, 'Amortização SAC deve ser 200.000 centavos');
    console.log('✔ F36: Simulador de financiamento Price, SAC e TIR por bisseção validado.');
  }

  // =========================================================================
  // 9. F37: Reagendador de Pagamentos Flexíveis
  // =========================================================================
  {
    const payables: (PayableEntry & { isFlexible?: boolean; minAllowedDate?: string; maxAllowedDate?: string })[] = [
      {
        id: 'pay_1',
        description: 'Fornecedor Parceiro',
        category: 'FORNECEDOR',
        supplierName: 'Fornecedor A',
        amountInCents: 250000, // R$ 2500
        dueDate: '2026-03-10',
        status: 'PENDING',
        isFlexible: true,
        minAllowedDate: '2026-03-10',
        maxAllowedDate: '2026-03-15',
        storeId: 'store_1',
      },
    ];

    const inflows = {
      '2026-03-10': 50000,
      '2026-03-14': 800000, // entrada expressiva no dia 14
    };

    const resched = rescheduleFlexiblePayables(100000, inflows, payables, 10, new Date('2026-03-09T12:00:00Z'));
    assert(resched.items.length === 1, 'Deve avaliar 1 conta');
    assert(resched.items[0].status === 'REAGENDADO', 'Conta deve ser reagendada para evitar saldo negativo');
    assert(resched.items[0].suggestedDueDate > '2026-03-10', 'Data deve ter sido movida');
    console.log('✔ F37: Reagendador guloso de pagamentos flexíveis validado.');
  }

  // =========================================================================
  // 10. F38: Planejamento de Produção e Explosão Recursiva de BOM
  // =========================================================================
  {
    const beef = makeTestIngredient({ id: 'ing_beef', name: 'Carne Moída', currentUnitCostMicrocents: 30000 });
    const tomato = makeTestIngredient({ id: 'ing_tom', name: 'Tomate', currentUnitCostMicrocents: 6000 });

    const sauce = makeTestRecipe({
      id: 'rec_sauce',
      name: 'Molho Bolonhesa',
      isSubRecipe: true,
      yieldPortions: 1, // 1 porção = 1kg
      lines: [
        { id: 'l1', ingredientId: beef.id, quantityInBaseUnit: 700, correctionFactor: 1.0 },
        { id: 'l2', ingredientId: tomato.id, quantityInBaseUnit: 500, correctionFactor: 1.2 },
      ],
    });

    const lasagna = makeTestRecipe({
      id: 'rec_lasagna',
      name: 'Lasanha Família',
      isSubRecipe: false,
      yieldPortions: 1,
      lines: [
        { id: 'l3', subRecipeId: sauce.id, quantityInBaseUnit: 1, correctionFactor: 1.0 },
      ],
    });

    const plan = planProductionOrders(
      [lasagna, sauce],
      [beef, tomato],
      { [lasagna.id]: 10 }, // Demanda de 10 lasanhas
      { [lasagna.id]: 2 },  // Estoque atual 2 lasanhas -> precisa produzir 8
      {},
      { [lasagna.id]: 4 },  // Batelada de 4 -> 2 lotes = 8 lasanhas
      { [beef.id]: 3000 }   // 3kg de carne em estoque
    );

    assert(plan.productionOrders.length === 1, 'Deve haver 1 ordem de prato final');
    assert(plan.productionOrders[0].totalPortionsToProduce === 8, 'Deve produzir 8 lasanhas');
    // Cada lasanha consome 1 molho. 8 lasanhas = 8 molhos. Cada molho = 700g de carne -> 5600g de carne necessária.
    // Estoque tem 3000g -> Shortage de 2600g.
    const beefShortage = plan.explodedIngredients.find((i) => i.ingredientId === beef.id);
    assert(!!beefShortage, 'Carne moída deve constar nos insumos explodidos');
    assert(beefShortage!.shortageInBaseUnit === 2600, `Falta de carne deve ser 2600g, obtido: ${beefShortage!.shortageInBaseUnit}`);
    console.log('✔ F38: Planejamento de produção e explosão recursiva de sub-receitas validado.');
  }

  // =========================================================================
  // 11. F39: Rendimento por Lote e Alerta ± 3σ
  // =========================================================================
  {
    const batchYield = analyzeBatchYieldAndOutliers(
      [
        {
          orderId: 'ord_1',
          recipeId: 'rec_sauce',
          recipeName: 'Molho Pesto',
          theoreticalYield: 20,
          actualYield: 16, // 80% de rendimento
          batchCostInCents: 20000, // R$ 200
        },
      ],
      { rec_sauce: [98, 97, 99, 98, 96] } // média 97.6%, desvio ~1.14% -> 80% é muito fora de 3σ
    );

    assert(batchYield.batches.length === 1, 'Deve avaliar 1 lote');
    assert(batchYield.batches[0].isOutlier, 'Lote com 80% deve ser marcado como outlier');
    assert(batchYield.batches[0].financialLossInCents === 4000, `Perda deve ser 4000 centavos, obtido: ${batchYield.batches[0].financialLossInCents}`);
    console.log('✔ F39: Rendimento por lote e alerta estatístico de controle aprovado.');
  }

  // =========================================================================
  // 12. F40: Mix Ótimo com Recurso Escasso (Mochila Fracionária)
  // =========================================================================
  {
    // Exemplo docs/formulas/F40: Forno com 300 minutos
    // Pizza A: MC = 3500, tempo = 5 min -> ratio = 700. Demanda = 40.
    // Pão B: MC = 2400, tempo = 4 min -> ratio = 600. Demanda = 50.
    const optimal = optimizeProductMixKnapsack(
      [
        {
          recipeId: 'rec_pizza_a',
          recipeName: 'Pizza A',
          salePriceInCents: 5000,
          variableCostInCents: 1500,
          scarceResourceConsumption: 5,
          forecastDemand: 40,
        },
        {
          recipeId: 'rec_pao_b',
          recipeName: 'Pão B',
          salePriceInCents: 3000,
          variableCostInCents: 600,
          scarceResourceConsumption: 4,
          forecastDemand: 50,
        },
      ],
      'Minutos de Forno',
      300
    );

    const itemA = optimal.items.find((i) => i.recipeId === 'rec_pizza_a');
    const itemB = optimal.items.find((i) => i.recipeId === 'rec_pao_b');
    assert(itemA!.allocatedQuantity === 40, `Item A deve alocar 40 unidades, obtido: ${itemA!.allocatedQuantity}`);
    assert(itemB!.allocatedQuantity === 25, `Item B deve alocar 25 unidades, obtido: ${itemB!.allocatedQuantity}`);
    assert(optimal.optimalTotalProfitInCents === 200000, `Lucro ótimo deve ser 200.000 centavos, obtido: ${optimal.optimalTotalProfitInCents}`);
    console.log('✔ F40: Mix ótimo com recurso escasso e eficiência marginal aprovado.');
  }

  // =========================================================================
  // 13. F41: Mão de Obra e Dimensionamento de Escala
  // =========================================================================
  {
    // Faturamento = 100.000, Folha = 22.000 -> CMO% = 22%
    // Meta produtividade = 120/h
    // Terça (dow 2): Faturamento 2400 -> Horas ideais = 20h. Escala cadastrada = 34h -> +14h sobra.
    // Sábado (dow 6): Faturamento 8400 -> Horas ideais = 70h. Escala cadastrada = 61h -> -9h falta.
    const labor = calculateLaborProductivityAndNeeds(
      800,
      2200000,
      10000000,
      12000, // R$ 120/h
      { 2: 240000, 6: 840000 },
      { 2: 34, 6: 61 },
      200000, // salário 2000
      0.35,
      1.5
    );

    assert(labor.cmoPercentage === 22.0, `CMO deve ser 22.0%, obtido: ${labor.cmoPercentage}`);
    const tuesday = labor.daysStaffing.find((d) => d.dayOfWeek === 2);
    const saturday = labor.daysStaffing.find((d) => d.dayOfWeek === 6);
    assert(tuesday!.status === 'EXCESSO', 'Terça deve estar com excesso');
    assert(tuesday!.hoursBalance === 14.0, `Balanço terça deve ser +14h, obtido: ${tuesday!.hoursBalance}`);
    assert(saturday!.status === 'DEFICIT', 'Sábado deve estar com déficit');
    assert(saturday!.hoursBalance === -9.0, `Balanço sábado deve ser -9h, obtido: ${saturday!.hoursBalance}`);
    console.log('✔ F41: Mão de obra, produtividade horária e balanço de escala validado.');
  }

  // =========================================================================
  // 14. F42: Benchmark Entre Lojas
  // =========================================================================
  {
    const stores: Store[] = [
      { id: 's1', name: 'Matriz', isMainStore: true, createdAt: '' },
      { id: 's2', name: 'Filial Shopping', isMainStore: false, createdAt: '' },
      { id: 's3', name: 'Filial Bairro', isMainStore: false, createdAt: '' },
    ];

    const benchmark = calculateStoreBenchmarkAndGaps(stores, [
      { storeId: 's1', monthlyRevenueInCents: 10000000, cmvPercentage: 30.0, cmoPercentage: 20, averageTicketInCents: 4500, netMarginPercentage: 22, wastePercentage: 1.5 },
      { storeId: 's2', monthlyRevenueInCents: 8000000, cmvPercentage: 34.5, cmoPercentage: 22, averageTicketInCents: 4200, netMarginPercentage: 18, wastePercentage: 2.8 },
      { storeId: 's3', monthlyRevenueInCents: 6000000, cmvPercentage: 36.0, cmoPercentage: 24, averageTicketInCents: 3900, netMarginPercentage: 15, wastePercentage: 3.2 },
    ]);

    assert(benchmark.hasSufficientStores, 'Deve ter lojas suficientes');
    const cmvKpi = benchmark.kpis.find((k) => k.kpiCode === 'CMV_PERC');
    assert(cmvKpi!.bestValue === 30.0, 'Melhor CMV deve ser 30%');
    // Loja 2 gap: 4.5% de 80.000 = 3.600 reais. Loja 3 gap: 6.0% de 60.000 = 3.600 reais. Total = 7.200 reais = 720.000 centavos.
    assert(benchmark.consolidatedOpportunityInCents === 720000, `Oportunidade consolidada deve ser 720.000 centavos, obtido: ${benchmark.consolidatedOpportunityInCents}`);
    console.log('✔ F42: Benchmark entre lojas e gap financeiro em R$ aprovado.');
  }

  // =========================================================================
  // 15. F45: Edição em Lote e Desfazer Atômico
  // =========================================================================
  {
    const p1 = makeTestRecipe({ id: 'rec_1', name: 'Pizza Calabresa', salePriceInCents: 4200 });
    const p2 = makeTestRecipe({ id: 'rec_2', name: 'Pizza 4 Queijos', salePriceInCents: 4800 });

    const preview = previewBatchEdit([p1, p2], 'RECIPE_PRICE', {
      percentageChange: 10,
      forceCommercialNinetyEnding: true,
      monthlyVolumeByRecipeId: { [p1.id]: 100, [p2.id]: 80 },
    });

    assert(preview.items[0].simulatedValueInCents === 4690, `Item 1 deve ser 4690 centavos, obtido: ${preview.items[0].simulatedValueInCents}`);
    assert(preview.items[1].simulatedValueInCents === 5290, `Item 2 deve ser 5290 centavos, obtido: ${preview.items[1].simulatedValueInCents}`);
    assert(preview.totalEstimatedRevenueImpactInCents === 88200, `Impacto na receita deve ser 88.200 centavos, obtido: ${preview.totalEstimatedRevenueImpactInCents}`);

    const undoState = createBatchEditUndoSnapshot([p1, p2], 'RECIPE_PRICE');
    assert(undoState.previousValues[p1.id] === 4200, 'Snapshot de undo deve guardar valor anterior fiel');
    console.log('✔ F45: Edição em lote com final ,90 e snapshot de desfazer validado.');
  }

  // =========================================================================
  // 16. F47: Contas Recorrentes com Tratamento de Mês Curto
  // =========================================================================
  {
    // Aluguel no dia 31 de 4500 reais com reajuste de 4.2% ao ano
    const recurring = generateRecurringScheduleWithIndex([
      {
        id: 'rec_rent',
        description: 'Aluguel do Ponto',
        baseAmountInCents: 450000,
        dueDayOfMonth: 31,
        contractAdjustmentPercentage: 4.2,
        startYear: 2026,
        startMonth: 1, // Jan 2026
        totalMonths: 4, // Jan, Fev, Mar, Abr
      },
    ]);

    assert(recurring.entries.length === 4, 'Deve gerar 4 parcelas');
    assert(recurring.entries[0].adjustedAmountInCents === 468900, `Valor reajustado deve ser 468.900 centavos, obtido: ${recurring.entries[0].adjustedAmountInCents}`);
    // Jan = 31/01
    assert(recurring.entries[0].effectiveDueDate === '2026-01-31', 'Janeiro deve vencer dia 31');
    // Fev 2026 não bissexto -> 28/02
    assert(recurring.entries[1].effectiveDueDate === '2026-02-28', 'Fevereiro deve vencer dia 28');
    assert(recurring.entries[1].isShortMonthAdjusted, 'Fevereiro deve ser marcado como ajustado');
    // Mar = 31/03
    assert(recurring.entries[2].effectiveDueDate === '2026-03-31', 'Março deve vencer dia 31');
    // Abr = 30/04
    assert(recurring.entries[3].effectiveDueDate === '2026-04-30', 'Abril deve vencer dia 30');
    console.log('✔ F47: Contas recorrentes e regras do calendário gregoriano aprovadas.');
  }

  console.log('=== TODOS OS TESTES DA ONDA 3 PASSARAM COM 100% DE SUCESSO ===');
}
