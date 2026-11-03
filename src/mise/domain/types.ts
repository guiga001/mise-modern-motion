/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Mise — Core Domain Types
 * Invariante: Dinheiro SEMPRE em centavos inteiros (BigInt/integer cents).
 * Invariante: Quantidades na unidade base canônica (g, ml, un).
 */

export type BaseUnit = 'g' | 'ml' | 'un';

export type UserRole = 'DONO';

export interface Company {
  id: string;
  name: string;
  legalDocument?: string; // CNPJ
  createdAt: string;
  updatedAt: string;
}

export interface Store {
  id: string;
  name: string;
  code?: string;
  address?: string;
  isMainStore: boolean;
  createdAt: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  passwordHash?: string;
  role: UserRole;
  storeIds: string[]; // Stores they manage
  twoFactorEnabled: boolean;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  userId: string;
  userName: string;
  storeId?: string;
  details: string;
  timestamp: string;
}

export interface UnitConversion {
  id: string;
  fromUnit: string;
  toBaseUnit: BaseUnit;
  factor: number; // e.g. 1 kg -> 1000 g: factor is 1000
  description: string;
}

export interface IngredientPackaging {
  id: string;
  packagingName: string; // e.g., "Saco de 25kg", "Caixa c/ 12x 1L", "Bandeja 30 ovos"
  quantityInBaseUnit: number; // e.g., 25000 (g), 12000 (ml), 30 (un)
  costInCents: number; // Cost of the whole packaging
}

export interface Ingredient {
  id: string;
  name: string;
  category: string;
  baseUnit: BaseUnit; // 'g', 'ml', 'un'
  currentUnitCostMicrocents: number; // Cost per 1 base unit in microcents (1 cent = 10,000 microcents)
  minimumStockInBaseUnit: number;
  packagings: IngredientPackaging[];
  preferredSupplierId?: string;
  updatedAt: string;
}

export interface RecipeLine {
  id: string;
  ingredientId?: string; // If raw ingredient
  subRecipeId?: string; // If nested sub-recipe
  quantityInBaseUnit: number;
  correctionFactor: number; // Fator de Correção (>= 1.0, e.g. 1.25 para perdas ao descascar)
  cookingFactor?: number; // Fator de Cocção (rendimento térmico, ex: 0.8 ou 1.2)
  notes?: string;
}

export interface Recipe {
  id: string;
  name: string;
  category: string;
  isSubRecipe: boolean; // Se for insumo preparado / base (ex: Molho de Tomate)
  yieldPortions: number; // Rendimento em porções vendáveis ou unidades
  yieldInBaseUnit?: number; // Para sub-receita: peso final gerado
  yieldBaseUnit?: BaseUnit; // Unidade do rendimento se for sub-receita
  lines: RecipeLine[];
  salePriceInCents: number; // Preço de venda planejado
  targetMarginPercentage: number; // Meta de margem (ex: 70 = 70%)
  preparationTimeMinutes?: number;
  createdAt: string;
  updatedAt: string;
}

export type StockMovementType = 
  | 'PURCHASE_RECEIPT' 
  | 'SALES_CONSUMPTION' 
  | 'PRODUCTION_INPUT' 
  | 'PRODUCTION_OUTPUT' 
  | 'INVENTORY_ADJUSTMENT' 
  | 'WASTE' 
  | 'STORE_TRANSFER';

export interface StockMovement {
  id: string;
  storeId: string;
  ingredientId: string;
  type: StockMovementType;
  quantityInBaseUnit: number; // Positive for entry, negative for exit
  unitCostMicrocents: number;
  totalCostInCents: number;
  reason?: string;
  referenceId?: string; // PurchaseOrder ID, SalesDay ID, or InventoryCount ID
  lotNumber?: string;
  expirationDate?: string;
  createdAt: string;
  createdBy: string;
}

export interface StockLot {
  id: string;
  storeId: string;
  ingredientId: string;
  lotNumber: string;
  remainingQuantityInBaseUnit: number;
  unitCostMicrocents: number;
  expirationDate: string;
  receivedDate: string;
}

export interface InventoryCountLine {
  ingredientId: string;
  expectedQuantityInBaseUnit: number;
  countedQuantityInBaseUnit: number;
  differenceInBaseUnit: number;
  discrepancyValueInCents: number;
  justification?: string;
}

export interface InventoryCount {
  id: string;
  storeId: string;
  date: string;
  status: 'DRAFT' | 'COMMITTED';
  lines: InventoryCountLine[];
  totalExpectedValueInCents: number;
  totalCountedValueInCents: number;
  netDiscrepancyInCents: number;
  committedAt?: string;
  committedBy?: string;
}

export interface Supplier {
  id: string;
  name: string;
  cnpj?: string;
  cnpjOrCpf?: string;
  contactName?: string;
  phone?: string;
  email?: string;
  leadTimeDays?: number;
  deliveryDaysOfWeek?: number[];
  paymentTerms?: string;
  paymentTermsDays?: number;
  minimumOrderInCents?: number;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface PurchaseOrderLine {
  id: string;
  ingredientId: string;
  packagingName: string;
  quantityOrdered: number; // Quantidade de embalagens
  baseUnitQuantity: number; // Total convertido para base
  unitPriceInCents: number; // Preço unitário da embalagem
  totalPriceInCents: number;
}

export interface PurchaseOrder {
  id: string;
  storeId: string;
  supplierId: string;
  status: 'PENDING' | 'RECEIVED' | 'CANCELLED';
  orderedDate: string;
  expectedDeliveryDate?: string;
  receivedDate?: string;
  lines: PurchaseOrderLine[];
  totalAmountInCents: number;
  notes?: string;
  invoiceNumber?: string;
}

export interface SalesImportLine {
  externalProductName: string;
  mappedRecipeId?: string;
  quantity: number;
  salePriceInCents: number;
  totalGrossInCents: number;
  discountsInCents: number;
  channelFeeInCents: number;
  netRevenueInCents: number;
}

export interface SalesImport {
  id: string;
  storeId: string;
  channel: string; // e.g. "iFood", "PDV Linx", "Saipos", "Anota AI", "Planilha CSV"
  periodStartDate: string;
  periodEndDate: string;
  fileHash: string; // Anti-duplicate protection
  totalGrossInCents: number;
  totalNetInCents: number;
  totalOrdersCount: number;
  lines: SalesImportLine[];
  stockDeducted: boolean;
  importedAt: string;
}

export interface PayableEntry {
  id: string;
  storeId: string;
  description: string;
  category: 'FORNECEDOR' | 'ALUGUEL' | 'ENERGIA_AGUA' | 'FOLHA_MÃO_DE_OBRA' | 'MANUTENÇÃO' | 'IMPOSTOS' | 'MARKETING' | 'OUTROS';
  supplierId?: string;
  supplierName?: string;
  amountInCents: number;
  dueDate: string;
  paidDate?: string;
  status: 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELLED';
  isRecurring?: boolean;
  notes?: string;
}

export { RecipeCycleError } from './recipe';

export interface ReceivableEntry {
  id: string;
  storeId: string;
  description: string;
  channel: string; // e.g. "Cartão Crédito", "iFood Repasse", "Dinheiro", "PIX"
  amountInCents: number;
  dueDate: string;
  receivedDate?: string;
  status: 'PENDING' | 'RECEIVED' | 'CANCELLED';
}

export interface CashFlowDay {
  date: string;
  inflowsInCents: number;
  outflowsInCents: number;
  netInCents: number;
  projectedBalanceInCents: number;
}

export interface DREReport {
  periodLabel: string;
  storeId: string; // Or 'CONSOLIDATED'
  grossRevenueInCents: number; // Receita Bruta
  taxesAndDeductionsInCents: number; // Impostos, taxas de cartão e delivery
  netRevenueInCents: number; // Receita Líquida
  cmvInCents: number; // Custo das Mercadorias Vendidas (Real)
  cmvPercentage: number; // % sobre receita líquida
  grossProfitInCents: number; // Margem de Contribuição / Lucro Bruto
  grossMarginPercentage: number;
  operatingExpensesInCents: number; // Custos Fixos + Despesas
  laborCostInCents: number; // Mão de obra
  rentAndUtilitiesInCents: number; // Aluguel e concessionárias
  otherExpensesInCents: number;
  netOperatingResultInCents: number; // Resultado Líquido / Lucro Operacional
  netMarginPercentage: number;
}

export type MenuQuadrant = 'STAR' | 'PLOWHORSE' | 'PUZZLE' | 'DOG';

export interface MenuEngineeringItem {
  recipeId: string;
  name: string;
  category: string;
  salesVolume: number;
  salePriceInCents: number;
  unitCmvInCents: number;
  unitContributionMarginInCents: number;
  marginPercentage: number;
  quadrant: MenuQuadrant;
  recommendation: string;
}

export interface Alert {
  id: string;
  type: 'COST_SPIKE' | 'LOW_MARGIN' | 'RUPTURE_RISK' | 'EXPIRATION_IMMINENT' | 'HIGH_WASTE' | 'PAYABLE_DUE';
  title: string;
  description: string;
  severity: 'WARNING' | 'CRITICAL' | 'INFO';
  actionLabel?: string;
  targetTab?: string;
  createdAt: string;
  read: boolean;
}

export interface ProductionOrder {
  id: string;
  storeId: string;
  subRecipeId: string;
  subRecipeName: string;
  plannedQuantity: number;
  actualYieldQuantity: number;
  unit: BaseUnit;
  status: 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED';
  date: string;
  notes?: string;
}
