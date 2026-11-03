/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Mise — Camada de Persistência, Auditoria Append-Only e Estado
 * Invariante: Banco inicia 100% VAZIO. Zero dados fictícios ou seeds demo.
 */

import {
  Alert,
  AuditLog,
  Company,
  Ingredient,
  InventoryCount,
  PayableEntry,
  ProductionOrder,
  PurchaseOrder,
  ReceivableEntry,
  Recipe,
  SalesImport,
  StockMovement,
  Store,
  Supplier,
  User,
  StockLot,
} from '../domain/types';

export interface MiseDatabaseState {
  company: Company | null;
  stores: Store[];
  users: User[];
  activeUserId: string | null;
  activeStoreId: string; // 'CONSOLIDATED' ou storeId
  ingredients: Ingredient[];
  recipes: Recipe[];
  stockMovements: StockMovement[];
  suppliers: Supplier[];
  purchaseOrders: PurchaseOrder[];
  salesImports: SalesImport[];
  payables: PayableEntry[];
  receivables: ReceivableEntry[];
  productionOrders: ProductionOrder[];
  inventoryCounts: InventoryCount[];
  auditLogs: AuditLog[];
  alerts: Alert[];
  productNameToRecipeIdMap: Record<string, string>;
  stockLots?: StockLot[];
  valueEvents?: any[];
  dailyTasks?: any[];
  lockedPeriods?: string[]; // YYYY-MM travados em F46
}

const STORAGE_KEY = 'mise_database_state_v1';

/**
 * Cria o estado inicial do banco: 100% vazio, sem registros fictícios.
 */
function createEmptyDatabase(): MiseDatabaseState {
  return {
    company: null,
    stores: [],
    users: [],
    activeUserId: null,
    activeStoreId: 'CONSOLIDATED',
    ingredients: [],
    recipes: [],
    stockMovements: [],
    suppliers: [],
    purchaseOrders: [],
    salesImports: [],
    payables: [],
    receivables: [],
    productionOrders: [],
    inventoryCounts: [],
    auditLogs: [],
    alerts: [],
    productNameToRecipeIdMap: {},
    stockLots: [],
    valueEvents: [],
    dailyTasks: [],
  };
}

/**
 * Remove qualquer resquício de dados de exemplo, demonstração ou seeds anteriores.
 */
export function stripSampleData(state: MiseDatabaseState): MiseDatabaseState {
  if (!state) return createEmptyDatabase();

  const isDemoCompany =
    state.company?.name === 'Bistrô & Burger Artesanal' ||
    state.company?.id?.startsWith('comp_demo');

  if (isDemoCompany) {
    return createEmptyDatabase();
  }

  const sampleIngredientIds = new Set([
    'ing_pao',
    'ing_blend',
    'ing_cheddar',
    'ing_bacon',
    'ing_molho',
    'ing_batata',
    'ing_embalagem',
  ]);
  const sampleRecipeIds = new Set(['rec_burger_smash', 'rec_batata_rustica']);
  const sampleSupplierIds = new Set(['sup_1', 'sup_2', 'sup_3']);
  const sampleLotIds = new Set(['lot_cheddar_1', 'lot_blend_1', 'lot_pao_1']);
  const sampleMovementIds = new Set(['mov_pao_in', 'mov_blend_in']);
  const sampleValueIds = new Set(['val_1', 'val_2', 'val_3']);
  const sampleTaskIds = new Set(['task_1', 'task_2', 'task_3']);
  const sampleAlertIds = new Set(['alt_1']);

  const ingredients = (state.ingredients || []).filter(
    (i) => !sampleIngredientIds.has(i.id)
  );
  const recipes = (state.recipes || []).filter(
    (r) => !sampleRecipeIds.has(r.id)
  );
  const suppliers = (state.suppliers || []).filter(
    (s) => !sampleSupplierIds.has(s.id)
  );
  const stockLots = (state.stockLots || []).filter(
    (l) => !sampleLotIds.has(l.id)
  );
  const stockMovements = (state.stockMovements || []).filter(
    (m) => !sampleMovementIds.has(m.id)
  );
  const valueEvents = (state.valueEvents || []).filter(
    (v) => !sampleValueIds.has(v.id)
  );
  const dailyTasks = (state.dailyTasks || []).filter(
    (t) => !sampleTaskIds.has(t.id)
  );
  const alerts = (state.alerts || []).filter(
    (a) => !sampleAlertIds.has(a.id)
  );

  return {
    ...state,
    ingredients,
    recipes,
    suppliers,
    stockLots,
    stockMovements,
    valueEvents,
    dailyTasks,
    alerts,
  };
}

/**
 * Carrega o estado do banco do storage local.
 */
export function loadDatabase(): MiseDatabaseState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createEmptyDatabase();
    const parsed = JSON.parse(raw);
    const state = {
      ...createEmptyDatabase(),
      ...parsed,
    };
    return stripSampleData(state);
  } catch (e) {
    console.error('Falha ao ler dados locais do Mise:', e);
    return createEmptyDatabase();
  }
}

/**
 * Salva o estado do banco.
 */
export function saveDatabase(state: MiseDatabaseState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('Falha ao persistir dados do Mise:', e);
  }
}

/**
 * Grava entrada no AuditLog (append-only, sem deleção).
 */
export function appendAuditLog(
  state: MiseDatabaseState,
  action: string,
  entityType: string,
  entityId: string,
  details: string
): MiseDatabaseState {
  const activeUser = state.users.find(u => u.id === state.activeUserId);
  const log: AuditLog = {
    id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    action,
    entityType,
    entityId,
    userId: activeUser ? activeUser.id : 'SYSTEM',
    userName: activeUser ? activeUser.name : 'Dono / Sistema',
    storeId: state.activeStoreId === 'CONSOLIDATED' ? undefined : state.activeStoreId,
    details,
    timestamp: new Date().toISOString(),
  };

  const updatedState = {
    ...state,
    auditLogs: [log, ...state.auditLogs],
  };
  saveDatabase(updatedState);
  return updatedState;
}

/**
 * Bootstrap do Dono (Primeiro Acesso).
 * Só executa se o banco não possuir proprietário cadastrado.
 */
export function bootstrapOwner(
  companyName: string,
  storeName: string,
  ownerName: string,
  ownerEmail: string
): MiseDatabaseState {
  const currentState = loadDatabase();
  if (currentState.company !== null) {
    throw new Error('A instalação já possui um dono e empresa configurados.');
  }

  const now = new Date().toISOString();
  const companyId = `comp_${Date.now()}`;
  const storeId = `store_${Date.now()}`;
  const userId = `user_${Date.now()}`;

  const company: Company = {
    id: companyId,
    name: companyName.trim(),
    createdAt: now,
    updatedAt: now,
  };

  const store: Store = {
    id: storeId,
    name: storeName.trim(),
    code: 'MATRIZ',
    isMainStore: true,
    createdAt: now,
  };

  const user: User = {
    id: userId,
    name: ownerName.trim(),
    email: ownerEmail.trim().toLowerCase(),
    role: 'DONO',
    storeIds: [storeId],
    twoFactorEnabled: false,
    createdAt: now,
  };

  const state: MiseDatabaseState = {
    ...createEmptyDatabase(),
    company,
    stores: [store],
    users: [user],
    activeUserId: userId,
    activeStoreId: storeId,
  };

  return appendAuditLog(
    state,
    'BOOTSTRAP_OWNER',
    'Company',
    companyId,
    `Empresa '${company.name}', loja '${store.name}' e dono '${user.name}' criados no primeiro acesso.`
  );
}

/**
 * Purge total da empresa (LGPD Direito de Eliminação com confirmação).
 */
export function purgeCompanyData(): void {
  localStorage.removeItem(STORAGE_KEY);
}
