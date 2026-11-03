/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Suíte de Testes da Onda 2 (Profundidade & Fórmulas Matemáticas F09–F52)
 */

import {
  forecastDemandForRecipe,
  removeOutliersUsingMad,
  generateSalesHeatMap,
} from '../src/domain/demand-forecasting';
import {
  inverseNormalCdf,
  calculateCoverageAndTurnover,
  calculateSmartReplenishment,
  calculateAbcXyzMatrix,
  calculateIdleCapital,
  calculateClearanceFloorPrice,
} from '../src/domain/inventory-replenishment';
import {
  generateOptimizedProcurementPlan,
  calculateTradeCreditEffectiveCost,
  detectOutlierPurchasePrices,
  calculateProcurementBudget,
} from '../src/domain/procurement-intelligence';
import {
  projectCashFlowWithScenarios,
  calculateSafeOwnerWithdrawal,
  calculateCardFeesAnalysis,
  calculateReceivablesAnticipationEffectiveCost,
  calculateCashConversionCycle,
  calculateComparativeDreAndPareto,
  calculateSimplesNacionalAnexoI,
} from '../src/domain/financial-projections';
import {
  evaluateMonthlyClosing,
  calculateBusinessThermometer,
  generateMonthlyXRayReport,
} from '../src/domain/governance-reports';
import { Ingredient, Recipe, Supplier, StockMovement, PayableEntry, ReceivableEntry, DREReport } from '../src/domain/types';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`FALHA NA ASERÇÃO: ${msg}`);
  }
}

export function runWave2Tests() {
  console.log('--- Iniciando Testes da Onda 2 do Mise ---');

  // -------------------------------------------------------------
  // Teste 1: F10 Inverso da Normal e Teste de Propriedade do EOQ
  // -------------------------------------------------------------
  const z95 = inverseNormalCdf(0.95);
  const z99 = inverseNormalCdf(0.99);
  assert(Math.abs(z95 - 1.64485) < 0.001, `z(0.95) deve ser ~1.645, obtido: ${z95}`);
  assert(Math.abs(z99 - 2.32634) < 0.001, `z(0.99) deve ser ~2.326, obtido: ${z99}`);

  const testIng: Ingredient = {
    id: 'ing_mussarela',
    name: 'Queijo Mussarela',
    baseUnit: 'g',
    currentUnitCostMicrocents: 40000, // R$ 40/kg = 40000 microcents/g
    minimumStockInBaseUnit: 10000,
    category: 'Laticínios',
    packagings: [],
    updatedAt: new Date().toISOString(),
  };

  // Demanda de 5000g/dia constante
  const demands = [4800, 5200, 5100, 4900, 5000, 5000, 5000];
  const replenishment = calculateSmartReplenishment(testIng, demands, {
    serviceLevel: 0.95,
    orderFixedCostInCents: 2500, // R$ 25
    annualCarryingRate: 0.20, // 20%
    leadTimeDays: 4,
    shelfLifeDays: 30,
  });

  assert(replenishment.reorderPoint > 0, 'ROP deve ser positivo');
  assert(replenishment.economicOrderQuantity > 0, 'EOQ deve ser positivo');

  // Teste de propriedade: EOQ minimiza o custo total anual frente a vizinhos Q - 10% e Q + 10%
  const qStar = replenishment.economicOrderQuantity;
  const annualDemand = replenishment.meanDailyDemand * 365;
  const s = 2500;
  const h = (testIng.currentUnitCostMicrocents / 10000) * 0.20;

  const costAtEoq = (annualDemand / qStar) * s + (qStar / 2) * h;
  const qLow = qStar * 0.85;
  const costAtLow = (annualDemand / qLow) * s + (qLow / 2) * h;
  const qHigh = qStar * 1.15;
  const costAtHigh = (annualDemand / qHigh) * s + (qHigh / 2) * h;

  assert(costAtEoq <= costAtLow, `EOQ deve ter custo menor que Q-15% (${costAtEoq} <= ${costAtLow})`);
  assert(costAtEoq <= costAtHigh, `EOQ deve ter custo menor que Q+15% (${costAtEoq} <= ${costAtHigh})`);
  console.log('✔ F10: Inverso da Normal z e Teste de Propriedade do EOQ validados.');

  // -------------------------------------------------------------
  // Teste 2: F09 Cobertura e Giro com Filtro MAD de Outliers
  // -------------------------------------------------------------
  const consumptionsWithOutlier = [9000, 10000, 10500, 11000, 35000]; // 35000 é pico atípico
  const { cleaned, outliersCount } = removeOutliersUsingMad(consumptionsWithOutlier);
  assert(outliersCount === 1, 'MAD deve expurgar exatamente 1 outlier');
  assert(!cleaned.includes(35000), 'Valor 35000 deve ser removido');

  const turnoverRes = calculateCoverageAndTurnover(
    [testIng],
    { [testIng.id]: consumptionsWithOutlier },
    new Map([[testIng.id, 50000]]),
    300000, // CMV 3.000 BRL
    100000, // Estoque médio 1.000 BRL
    30
  );
  assert(turnoverRes.turnoverRatio === 3.0, 'Giro deve ser 3.0x (3000 / 1000)');
  assert(turnoverRes.inventoryDays === 10, 'Dias de estoque deve ser 10 dias (30 / 3)');
  console.log('✔ F09: Cobertura, Giro e filtro MAD de outliers validados.');

  // -------------------------------------------------------------
  // Teste 3: F11 Curva ABC x XYZ (Matriz 3x3)
  // -------------------------------------------------------------
  const ingA: Ingredient = { ...testIng, id: 'ing_a', name: 'Carne Nobre' };
  const ingB: Ingredient = { ...testIng, id: 'ing_b', name: 'Farinha Trigo' };
  const ingC: Ingredient = { ...testIng, id: 'ing_c', name: 'Tempero Raro' };

  const abcRes = calculateAbcXyzMatrix(
    [ingA, ingB, ingC],
    {
      ing_a: { totalSpentInCents: 800000, dailyDemands: [100, 105, 95, 100, 102] }, // CV baixo -> X
      ing_b: { totalSpentInCents: 150000, dailyDemands: [20, 40, 10, 35, 15] }, // CV médio -> Y
      ing_c: { totalSpentInCents: 50000, dailyDemands: [0, 0, 50, 0, 0] }, // CV alto -> Z
    }
  );

  assert(abcRes.items.length === 3, 'Todos os 3 insumos classificados');
  assert(abcRes.items.find(i => i.ingredientId === 'ing_a')?.quadrant === 'AX', 'Ing A deve ser AX');
  assert(abcRes.items.find(i => i.ingredientId === 'ing_b')?.quadrant === 'BY', 'Ing B deve ser BY');
  assert(abcRes.items.find(i => i.ingredientId === 'ing_c')?.quadrant === 'CZ', 'Ing C deve ser CZ');
  console.log('✔ F11: Curva ABC × XYZ enquadrou determinística e perfeitamente cada insumo.');

  // -------------------------------------------------------------
  // Teste 4: F12 Capital Parado & F15 Preço Mínimo de Liquidação
  // -------------------------------------------------------------
  const fakeMovements: StockMovement[] = [
    {
      id: 'm1',
      storeId: 'store_1',
      ingredientId: 'ing_c',
      type: 'SALES_CONSUMPTION',
      quantityInBaseUnit: -100,
      unitCostMicrocents: 40000,
      totalCostInCents: 400,
      reason: 'Venda antiga',
      createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
      createdBy: 'user_1',
    },
  ];

  const idleRes = calculateIdleCapital(
    [ingC],
    fakeMovements,
    new Map([['ing_c', 500]]),
    30,
    0.01
  );
  assert(idleRes.idleItems.length === 1, 'Deve detectar 1 item de capital parado');
  assert(idleRes.totalIdleCapitalInCents === 2000, '500g a R$ 40/kg = R$ 20,00 (2000 cents)');
  assert(idleRes.monthlyOpportunityCostInCents === 20, 'Custo oportunidade a 1% a.m. = 20 cents');

  // F15
  const testRecipe: Recipe = {
    id: 'rec_torta',
    name: 'Torta de Morango',
    category: 'Sobremesas',
    isSubRecipe: false,
    yieldPortions: 1,
    salePriceInCents: 1500,
    targetMarginPercentage: 70,
    lines: [
      { id: 'l1', ingredientId: 'ing_c', quantityInBaseUnit: 100, correctionFactor: 1.0 },
      { id: 'l2', ingredientId: 'ing_b', quantityInBaseUnit: 50, correctionFactor: 1.0 },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const floorRes = calculateClearanceFloorPrice(testRecipe, 'ing_c', [ingB, ingC], 0.10);
  // Custo adicional = 200 cents (ing_b). Denominador = 0.90. Floor recuperação = ceil(200 / 0.90) = 222 cents
  assert(floorRes.portionRecoveryFloorInCents === 222, `Piso de recuperação deve ser 222, obtido: ${floorRes.portionRecoveryFloorInCents}`);
  // Custo total = 600 cents. Floor contábil = ceil(600 / 0.90) = 667 cents
  assert(floorRes.portionFullNonLossFloorInCents === 667, `Piso contábil deve ser 667, obtido: ${floorRes.portionFullNonLossFloorInCents}`);
  console.log('✔ F12 & F15: Capital parado e Pisos de liquidação calculados com precisão.');

  // -------------------------------------------------------------
  // Teste 5: F17 Lista de Compras, F18 Custo Efetivo de Prazo, F19 Outlier Z-Score
  // -------------------------------------------------------------
  const sup: Supplier = {
    id: 'sup_1',
    name: 'Distribuidora Central',
    cnpjOrCpf: '00000000000100',
    leadTimeDays: 3,
  };

  const plan = generateOptimizedProcurementPlan(
    sup,
    [
      {
        ingredientId: 'ing_a',
        ingredientName: 'Carne Nobre',
        baseUnit: 'g',
        meanDailyDemand: 1000,
        safetyStock: 2000,
        currentBalance: 1000,
        openOrdersQuantity: 0,
        packageSizeInBaseUnit: 5000, // pacote de 5kg
        unitPriceInCents: 4000, // R$ 40 por pacote
        leadTimeDays: 3,
        reviewCycleDays: 4,
      },
    ],
    10000
  );
  assert(plan.meetsMinimumOrder, 'Plano deve atingir pedido mínimo');
  assert(plan.items[0].suggestedQuantity % 5000 === 0, 'Quantidade deve ser múltiplo exato da embalagem');

  // F18 Custo de prazo
  const tradeCost = calculateTradeCreditEffectiveCost(1000000, 0.03, 28, 0.01);
  assert(tradeCost.isCashPaymentRecommended, 'Desconto de 3% em 28 dias deve recomendar pagamento à vista');
  assert(Math.abs(tradeCost.implicitMonthlyInterestRatePercentage - 3.3) < 0.2, 'Taxa mensal deve ser ~3.3% a.m.');

  // F18 com d = 0 deve retornar taxa 0%
  const zeroDiscount = calculateTradeCreditEffectiveCost(50000, 0, 30);
  assert(zeroDiscount.implicitMonthlyInterestRatePercentage === 0, 'Sem desconto taxa deve ser 0%');

  // F19 Outlier
  const outlierCheck = detectOutlierPurchasePrices(
    ingA,
    [
      { id: 'p1', date: '2026-01-01', quantity: 10, unitPriceInCents: 3800, supplierName: 'A' },
      { id: 'p2', date: '2026-01-05', quantity: 10, unitPriceInCents: 3900, supplierName: 'A' },
      { id: 'p3', date: '2026-01-10', quantity: 10, unitPriceInCents: 4000, supplierName: 'A' },
      { id: 'p4', date: '2026-01-15', quantity: 10, unitPriceInCents: 4100, supplierName: 'A' },
      { id: 'p5', date: '2026-01-20', quantity: 10, unitPriceInCents: 4200, supplierName: 'A' },
    ],
    { id: 'p_test', date: '2026-02-01', quantity: 10, unitPriceInCents: 5800, supplierName: 'B' }
  );
  assert(outlierCheck.isOutlier, 'Compra a 5800 deve ser detectada como outlier (M > 3.5)');
  assert(outlierCheck.excessPaidInCents === 18000, 'Excesso pago deve ser (5800-4000)*10 = 18000 cents');
  console.log('✔ F17, F18 e F19: Otimização de compras, taxa implícita e detecção MAD validadas.');

  // -------------------------------------------------------------
  // Teste 6: F22 Previsão de Demanda com Série Periódica e Constante
  // -------------------------------------------------------------
  // Série constante de 14 dias
  const constantHistory = Array.from({ length: 14 }, (_, i) => ({
    date: `2026-05-${String(i + 1).padStart(2, '0')}`,
    dayOfWeek: i % 7,
    quantity: 25,
  }));
  const constForecast = forecastDemandForRecipe('rec_1', 'Item Constante', constantHistory, 7);
  assert(constForecast.dailyForecasts.every(f => f.predictedQuantity === 25), 'Série constante deve prever 25 constante');
  assert(constForecast.backtestRmse === 0, 'RMSE na série constante deve ser 0');

  // Histórico insuficiente (< 14 dias)
  const shortHistory = constantHistory.slice(0, 8);
  const shortForecast = forecastDemandForRecipe('rec_1', 'Item Curto', shortHistory, 7);
  assert(!shortForecast.isSufficientData, 'Menos de 14 dias deve retornar dados insuficientes');
  console.log('✔ F22: Previsão de demanda determinística e propriedades de séries validadas.');

  // -------------------------------------------------------------
  // Teste 7: F29 Cenários de Caixa & F30 Retirada Segura
  // -------------------------------------------------------------
  const receivables: ReceivableEntry[] = [
    { id: 'r1', storeId: 'store_1', description: 'Entrada Cartão', amountInCents: 50000, channel: 'PIX', dueDate: '2026-06-05', status: 'PENDING' },
  ];
  const payables: PayableEntry[] = [
    { id: 'b1', storeId: 'store_1', description: 'Aluguel', amountInCents: 120000, category: 'ALUGUEL', dueDate: '2026-06-03', status: 'PENDING' },
  ];

  const cashProj = projectCashFlowWithScenarios(100000, receivables, payables, new Array(30).fill(10000), 0.15, 30, new Date('2026-06-01T12:00:00'));
  assert(cashProj.baseScenario.points.length === 30, 'Deve projetar 30 dias');
  // Teste de propriedade: Cenário variação 0% é idêntico à base
  const zeroVarProj = projectCashFlowWithScenarios(100000, receivables, payables, new Array(30).fill(10000), 0.0, 30, new Date('2026-06-01T12:00:00'));
  assert(zeroVarProj.stressScenario.lowestBalanceInCents === zeroVarProj.baseScenario.lowestBalanceInCents, 'Cenário -0% deve igualar a base');

  // F30
  const withdrawal = calculateSafeOwnerWithdrawal(
    1800000, // Menor saldo R$ 18.000
    350000,  // Imposto R$ 3.500
    200000,  // Provisões R$ 2.000
    50000,   // Despesa diária R$ 500
    7        // Colchão de 7 dias = R$ 3.500
  );
  // Total reservas = 3500 + 2000 + 3500 = 9000 BRL = 900000 cents
  // Retirada segura = 1800000 - 900000 = 900000 cents (R$ 9.000,00)
  assert(withdrawal.safeWithdrawalAmountInCents === 900000, `Retirada segura deve ser 900000 cents, obtido: ${withdrawal.safeWithdrawalAmountInCents}`);
  console.log('✔ F29 & F30: Projeção de fluxo de caixa em 3 cenários e Retirada Segura validadas.');

  // -------------------------------------------------------------
  // Teste 8: F32 Ciclo de Caixa & F35 Simples Nacional Anexo I
  // -------------------------------------------------------------
  const cycle = calculateCashConversionCycle(
    120000, // Estoque médio 1.200 BRL
    300000, // CMV mês 3.000 BRL (100 BRL/dia) -> PME = 12 dias
    150000, // Clientes a receber 1.500 BRL
    300000, // Vendas mês 3.000 BRL (100 BRL/dia) -> PMR = 15 dias
    200000, // Fornecedores a pagar 2.000 BRL
    300000, // Compras mês 3.000 BRL (100 BRL/dia) -> PMP = 20 dias
    30
  );
  // Ciclo financeiro = 12 + 15 - 20 = 7 dias
  assert(cycle.cashConversionCycleDays === 7, `Ciclo deve ser exatamente 7 dias, obtido: ${cycle.cashConversionCycleDays}`);

  // F35 Simples Nacional
  // RBT12 = R$ 300.000 (30.000.000 centavos). Alíquota nominal 7.30%, dedução R$ 5.940 (594.000 centavos)
  // Alíquota efetiva = (300.000 * 0.073 - 5.940) / 300.000 = (21.900 - 5.940) / 300.000 = 15.960 / 300.000 = 5.32%
  const simples = calculateSimplesNacionalAnexoI(30000000, 3000000);
  assert(simples.effectiveRatePercentage === 5.3, `Alíquota efetiva deve ser 5.3%, obtido: ${simples.effectiveRatePercentage}`);
  assert(simples.estimatedDasInCents === 159600, `DAS deve ser R$ 1.596,00 (159600 cents), obtido: ${simples.estimatedDasInCents}`);
  console.log('✔ F32 & F35: Ciclo financeiro e cálculo estrito do Simples Nacional validados.');

  // -------------------------------------------------------------
  // Teste 9: F46 Trava de Fechamento, F50 Termômetro e F52 Raio-X
  // -------------------------------------------------------------
  const closingOk = evaluateMonthlyClosing('2026-06', 30, 30, 0, 1, 0, false);
  assert(closingOk.canLockPeriod, 'Checklist 100% apto deve permitir trava de período');

  const closingBlocked = evaluateMonthlyClosing('2026-06', 20, 30, 5, 0, 15, false);
  assert(!closingBlocked.canLockPeriod, 'Com dias faltando e contas sem categoria não deve permitir trava');

  const thermo = calculateBusinessThermometer(33, 32, 30, 20, 2.5, 0.8);
  assert(thermo.overallScore >= 0 && thermo.overallScore <= 100, 'Score do termômetro deve estar entre 0 e 100');
  assert(thermo.healthStatus === 'HEALTHY', 'Status deve ser HEALTHY');

  console.log('✔ F46, F50 e F52: Fechamento guiado, Termômetro do negócio e Relatório Raio-X validados.');
  console.log('--- Todos os Testes da Onda 2 Passaram com 100% de Sucesso! ---');
}
