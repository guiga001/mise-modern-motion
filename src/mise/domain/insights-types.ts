/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Mise — Tipos e Contratos Universais do Motor de Inteligência e Insights
 */

export interface DataSufficiency {
  suficiente: boolean;
  faltam?: string;
  percentualConfiabilidade: number; // 0 a 100
}

export interface DomainExplanation<T = number | string> {
  valor: T;
  unidade: string; // 'centavos', '%', 'dias', 'unidades', 'horas', 'R$/mês', 'índice'
  formula: string;
  entradas: Record<string, any>;
  passos: string[];
  suficienciaDeDados: DataSufficiency;
  confianca: 'ALTA' | 'MEDIA' | 'BAIXA' | 'INSUFICIENTE';
}

export interface InsightSnapshot {
  id: string;
  functionName: string;
  formulaVersion: string;
  inputHash: string;
  output: any;
  calculatedAt: string;
}

export interface ValueEvent {
  id: string;
  type: 'IDENTIFICADO' | 'REALIZADO';
  category: 'REAJUSTE_PRECO' | 'ECONOMIA_COMPRA' | 'PERDA_EVITADA' | 'TEMPO_ECONOMIZADO';
  title: string;
  description: string;
  amountInCents: number; // Valor monetário (em centavos)
  minutesSaved: number;
  evidenceDetails?: string;
  createdAt: string;
  explanation: DomainExplanation<number>;
}

export interface DailyTask {
  id: string;
  code: string; // ex: 'F03-PRICE-ADJUST', 'F14-FEFO-RISK'
  title: string;
  description: string;
  amountInPlayInCents: number; // R$ em jogo para ordenação estrita
  urgencyDays?: number;
  actionLabel: string;
  actionTab: string; // Tab para onde navegar
  actionPayload?: Record<string, any>;
  explanation: DomainExplanation<number>;
  completed: boolean;
}

export interface IngredientSimulationResult {
  ingredientId: string;
  ingredientName: string;
  originalUnitCostMicrocents: number;
  simulatedUnitCostMicrocents: number;
  priceDeltaPercentage: number;
  deltaMonthlyProfitInCents: number; // Negativo se for aumento de custo
  affectedRecipes: {
    recipeId: string;
    recipeName: string;
    portionCostBeforeInCents: number;
    portionCostAfterInCents: number;
    costDeltaInCents: number;
    monthlySalesVolume: number;
    monthlyImpactInCents: number;
  }[];
  explanation: DomainExplanation<number>;
}

export interface SensitivityItem {
  ingredientId: string;
  ingredientName: string;
  baseUnit: string;
  monthlyTheoreticalConsumption: number;
  currentUnitCostMicrocents: number;
  monthlySpendInCents: number;
  impactTenPercentInCents: number; // 10% do gasto
  percentOfTotalCmv: number;
}

export interface SensitivityRankingResult {
  items: SensitivityItem[];
  totalTheoreticalCmvInCents: number;
  top10RiskInCents: number;
  explanation: DomainExplanation<number>;
}

export interface MarginReadjustmentResult {
  recipeId: string;
  recipeName: string;
  currentPriceInCents: number;
  currentCostInCents: number;
  newCostInCents: number;
  targetMarginPercentage: number;
  suggestedNewPriceInCents: number;
  readjustmentPercentage: number;
  currentContributionMarginInCents: number;
  newContributionMarginInCents: number;
  maxTolerableVolumeDropPercentage: number; // 1 - MC/MC'
  explanation: DomainExplanation<number>;
}

export interface KitchenInflationResult {
  indexLaspeyres: number; // Base 100
  menuAveragePriceChangePercentage: number;
  gapMonthlyInCents: number;
  basePeriodCmvInCents: number;
  explanation: DomainExplanation<number>;
}

export interface UncostedRevenueReport {
  totalRevenueInCents: number;
  costedRevenueInCents: number;
  unmappedRevenueInCents: number;
  noRecipeRevenueInCents: number;
  totalUncostedRevenueInCents: number;
  uncostedPercentage: number;
  problematicItems: {
    externalProductName: string;
    quantity: number;
    revenueInCents: number;
    reason: 'SEM_MAPEAMENTO' | 'RECEITA_SEM_LINHAS';
  }[];
  explanation: DomainExplanation<number>;
}

export interface ChannelMarginItem {
  channel: string;
  grossRevenueInCents: number;
  cmvInCents: number;
  platformFeesInCents: number;
  paymentFeesInCents: number;
  packagingInCents: number;
  taxesInCents: number;
  netMarginInCents: number;
  netMarginPercentage: number;
}

export interface ChannelMarginReport {
  channels: ChannelMarginItem[];
  totalGrossRevenueInCents: number;
  totalNetMarginInCents: number;
  consolidatedNetMarginPercentage: number;
  explanation: DomainExplanation<number>;
}

export interface UsageVarianceItem {
  ingredientId: string;
  ingredientName: string;
  baseUnit: string;
  theoreticalConsumptionInBaseUnit: number;
  realConsumptionInBaseUnit: number;
  varianceInBaseUnit: number; // real - teórico
  variancePercentage: number;
  unitCostMicrocents: number;
  varianceInCents: number; // valor monetário do desvio/perda
}

export interface UsageVarianceReport {
  hasSufficientCounts: boolean;
  startDate?: string;
  endDate?: string;
  items: UsageVarianceItem[];
  totalDiscrepancyInCents: number;
  explanation: DomainExplanation<number>;
}

export interface FefoRiskItem {
  lotId: string;
  lotNumber: string;
  ingredientId: string;
  ingredientName: string;
  baseUnit: string;
  currentStockInBaseUnit: number;
  unitCostMicrocents: number;
  expirationDate: string;
  daysRemaining: number;
  dailyConsumptionInBaseUnit: number;
  projectedConsumptionInBaseUnit: number;
  excessInBaseUnit: number;
  amountAtRiskInCents: number;
  urgency: 'VENCIDO' | 'CRITICO' | 'ATENCAO' | 'SEGURO';
}

export interface FefoRiskReport {
  items: FefoRiskItem[];
  totalAmountAtRiskInCents: number;
  explanation: DomainExplanation<number>;
}

export interface CmvDecompositionResult {
  period0CmvInCents: number;
  period1CmvInCents: number;
  deltaCmvInCents: number;
  priceEffectInCents: number;
  volumeEffectInCents: number;
  usageMixEffectInCents: number;
  identityCheckPassed: boolean; // Preço + Volume + Uso == deltaCmv
  explanation: DomainExplanation<number>;
}

export interface DataQualityReport {
  score: number; // 0 a 100
  recipesCoveragePercentage: number;
  ingredientPricesFreshnessPercentage: number;
  salesRegularityPercentage: number;
  stockCountsFreshnessPercentage: number;
  confidenceLevel: 'ALTA' | 'MEDIA' | 'BAIXA';
  recommendations: string[];
  explanation: DomainExplanation<number>;
}

// =========================================================================
// ONDA 3: TIPOS E CONTRATOS UNIVERSAIS
// =========================================================================

export interface ElasticitySimulationPoint {
  deltaPercentage: number;
  simulatedPriceInCents: number;
  simulatedVolume: number;
  contributionMarginInCents: number;
  grossProfitInCents: number;
}

export interface ElasticitySimulationResult {
  recipeId: string;
  recipeName: string;
  basePriceInCents: number;
  variableCostInCents: number;
  baseVolume: number;
  elasticity?: number;
  optimalPoint?: ElasticitySimulationPoint;
  points: ElasticitySimulationPoint[];
  explanation: DomainExplanation<number>;
}

export interface ChannelMinimumPriceResult {
  channelName: string;
  portionCostInCents: number;
  packagingCostInCents: number;
  directCostInCents: number;
  targetMarginPercentage: number;
  platformCommissionPercentage: number;
  paymentFeePercentage: number;
  variableTaxPercentage: number;
  isImpossible: boolean;
  minimumPriceInCents: number;
  channelMarginInCents: number;
  netMarginPercentage: number;
  explanation: DomainExplanation<number>;
}

export interface ComboPricingResult {
  comboName: string;
  items: {
    recipeId: string;
    recipeName: string;
    costInCents: number;
    regularPriceInCents: number;
  }[];
  totalCostInCents: number;
  totalRegularPriceInCents: number;
  minimumTargetMarginPercentage: number;
  minimumComboPriceInCents: number;
  maxSafeDiscountPercentage: number;
  simulatedDiscountPercentage: number;
  simulatedComboPriceInCents: number;
  simulatedMarginPercentage: number;
  isSafe: boolean;
  explanation: DomainExplanation<number>;
}

export interface StoreTransferItem {
  ingredientId: string;
  ingredientName: string;
  baseUnit: string;
  originStoreId: string;
  originStoreName: string;
  originStock: number;
  originDaysCoverage: number;
  destinationStoreId: string;
  destinationStoreName: string;
  destinationStock: number;
  destinationDaysCoverage: number;
  transferQuantity: number;
  packagingMultiple: number;
  unitCostMicrocents: number;
  valueTransferredInCents: number;
  freightCostInCents: number;
  netBenefitInCents: number;
  isFeasible: boolean;
}

export interface StoreBalancingResult {
  transfers: StoreTransferItem[];
  totalValueTransferredInCents: number;
  totalFreightCostInCents: number;
  netSavingsInCents: number;
  explanation: DomainExplanation<number>;
}

export interface ProcurementDeadlineItem {
  ingredientId: string;
  ingredientName: string;
  supplierId: string;
  supplierName: string;
  leadTimeDays: number;
  cutoffDaysOfWeek: number[]; // 0=Domingo, 1=Segunda... 6=Sábado
  stockOutProjectedDate: string; // ISO YYYY-MM-DD
  idealOrderDate: string;
  latestOrderDate: string;
  isUrgent: boolean;
  isLate: boolean;
}

export interface ProcurementCalendarResult {
  deadlines: ProcurementDeadlineItem[];
  urgentCount: number;
  explanation: DomainExplanation<number>;
}

export interface BasketAffinityRule {
  itemAId: string;
  itemAName: string;
  itemBId: string;
  itemBName: string;
  supportABPercentage: number;
  supportAPercentage: number;
  supportBPercentage: number;
  confidencePercentage: number;
  lift: number;
  suggestedComboMargin?: number;
}

export interface MarketBasketAffinityResult {
  totalOrdersAnalyzed: number;
  rules: BasketAffinityRule[];
  explanation: DomainExplanation<number>;
}

export interface AnomalousSalesDropItem {
  date: string;
  dayOfWeekName: string;
  actualRevenueInCents: number;
  historicalMedianRevenueInCents: number;
  madInCents: number;
  modifiedZScore: number;
  revenueDropInCents: number;
  isAnomalous: boolean;
  isClosedDay: boolean;
}

export interface AnomalousSalesDropResult {
  alerts: AnomalousSalesDropItem[];
  totalLossInCents: number;
  explanation: DomainExplanation<number>;
}

export interface LoanInstallment {
  month: number;
  paymentInCents: number;
  interestInCents: number;
  amortizationInCents: number;
  balanceInCents: number;
}

export interface LoanFinancingSimulationResult {
  system: 'PRICE' | 'SAC';
  financedAmountInCents: number;
  nominalMonthlyRatePercentage: number;
  totalMonths: number;
  upfrontFeesInCents: number;
  installments: LoanInstallment[];
  totalPaidInCents: number;
  totalInterestInCents: number;
  effectiveMonthlyRateCetPercentage: number; // TIR mensal
  effectiveAnnualRateCetPercentage: number;
  explanation: DomainExplanation<number>;
}

export interface RescheduledPayableItem {
  payableId: string;
  supplierName: string;
  amountInCents: number;
  originalDueDate: string;
  suggestedDueDate: string;
  minAllowedDate: string;
  maxAllowedDate: string;
  status: 'REAGENDADO' | 'MANTIDO' | 'INFLEXIVEL';
}

export interface FlexiblePayablesRescheduleResult {
  items: RescheduledPayableItem[];
  daysWithNegativeBalanceBefore: number;
  daysWithNegativeBalanceAfter: number;
  lowestBalanceBeforeInCents: number;
  lowestBalanceAfterInCents: number;
  cashDeficitAvoidedInCents: number;
  explanation: DomainExplanation<number>;
}

export interface ProductionOrderRequirement {
  recipeId: string;
  recipeName: string;
  isSubRecipe: boolean;
  batchSize: number;
  batchesToProduce: number;
  totalPortionsToProduce: number;
  currentStockPortions: number;
  forecastDemandPortions: number;
  netNeedPortions: number;
}

export interface ExplodedIngredientNeed {
  ingredientId: string;
  ingredientName: string;
  baseUnit: string;
  totalNeededInBaseUnit: number;
  currentStockInBaseUnit: number;
  shortageInBaseUnit: number;
  unitCostMicrocents: number;
  shortageCostInCents: number;
}

export interface ProductionPlanningResult {
  productionOrders: ProductionOrderRequirement[];
  explodedIngredients: ExplodedIngredientNeed[];
  totalProductionCostInCents: number;
  totalShortageCostInCents: number;
  minutesSaved: number;
  explanation: DomainExplanation<number>;
}

export interface BatchYieldOutlierItem {
  orderId: string;
  recipeId: string;
  recipeName: string;
  theoreticalYield: number;
  actualYield: number;
  yieldPercentage: number;
  batchCostInCents: number;
  theoreticalCostPerPortionInCents: number;
  actualCostPerPortionInCents: number;
  financialLossInCents: number;
  meanYieldPercentage: number;
  stdDevYieldPercentage: number;
  isOutlier: boolean;
  alertType?: 'RENDIMENTO_CRITICO_BAIXO' | 'RENDIMENTO_ANOMALO_ALTO' | 'NORMAL';
}

export interface BatchYieldAnalysisResult {
  batches: BatchYieldOutlierItem[];
  totalLossInCents: number;
  explanation: DomainExplanation<number>;
}

export interface OptimalMixItem {
  recipeId: string;
  recipeName: string;
  salePriceInCents: number;
  variableCostInCents: number;
  contributionMarginInCents: number;
  scarceResourceConsumption: number; // ex: minutos de forno
  efficiencyRatio: number; // MC / recurso
  forecastDemand: number;
  allocatedQuantity: number;
  totalProfitInCents: number;
}

export interface OptimalMixResult {
  resourceName: string;
  resourceCapacity: number;
  resourceUsed: number;
  items: OptimalMixItem[];
  optimalTotalProfitInCents: number;
  naiveTotalProfitInCents: number;
  incrementalGainInCents: number;
  explanation: DomainExplanation<number>;
}

export interface DayLaborStaffing {
  dayOfWeek: number;
  dayName: string;
  projectedRevenueInCents: number;
  targetProductivityCentsPerHour: number;
  idealHoursNeeded: number;
  scheduledHours: number;
  hoursBalance: number; // agendadas - ideal
  status: 'EXCESSO' | 'DEFICIT' | 'EQUILIBRADO';
}

export interface LaborStaffingResult {
  laborCostInCents: number;
  totalRevenueInCents: number;
  cmoPercentage: number;
  totalWorkedHours: number;
  actualProductivityCentsPerHour: number;
  hourlyCostNormalInCents: number;
  hourlyCostOvertimeInCents: number;
  daysStaffing: DayLaborStaffing[];
  totalExcessHours: number;
  totalDeficitHours: number;
  explanation: DomainExplanation<number>;
}

export interface StoreBenchmarkKpi {
  kpiCode: 'CMV_PERC' | 'CMO_PERC' | 'TICKET_MEDIO' | 'MARGEM_PERC' | 'PERDAS_PERC';
  kpiName: string;
  unit: string;
  higherIsBetter: boolean;
  bestStoreId: string;
  bestStoreName: string;
  bestValue: number;
  medianValue: number;
  madValue: number;
  storeValues: {
    storeId: string;
    storeName: string;
    value: number;
    gapToBest: number;
    monthlyFinancialGapInCents: number;
  }[];
  totalPotentialGapInCents: number;
}

export interface StoreBenchmarkResult {
  hasSufficientStores: boolean;
  storesCount: number;
  kpis: StoreBenchmarkKpi[];
  consolidatedOpportunityInCents: number;
  explanation: DomainExplanation<number>;
}

export interface BatchEditItemPreview {
  id: string;
  name: string;
  currentValueInCents: number;
  simulatedValueInCents: number;
  deltaInCents: number;
  deltaPercentage: number;
  currentMarginPercentage?: number;
  simulatedMarginPercentage?: number;
}

export interface BatchEditPreviewResult {
  targetType: 'RECIPE_PRICE' | 'INGREDIENT_COST';
  items: BatchEditItemPreview[];
  totalEstimatedRevenueImpactInCents: number;
  explanation: DomainExplanation<number>;
}

export interface RecurringScheduleEntry {
  sourceId: string;
  description: string;
  originalDueDay: number;
  competenceYear: number;
  competenceMonth: number;
  effectiveDueDate: string; // YYYY-MM-DD ajustada
  adjustedAmountInCents: number;
  isShortMonthAdjusted: boolean;
}

export interface RecurringScheduleResult {
  entries: RecurringScheduleEntry[];
  totalAmountInCents: number;
  explanation: DomainExplanation<number>;
}

