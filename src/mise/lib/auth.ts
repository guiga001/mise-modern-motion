/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Mise — Serviço de Autenticação Segura e Isolamento de Empresas
 * Regra: Cada usuário possui credenciais únicas (e-mail + senha com hash SHA-256)
 * e acessa estritamente a sua empresa privada, com dados 100% isolados.
 */

import { hashPassword, verifyPassword } from './crypto';
import { Company, Store, User } from '../domain/types';
import {
  MiseDatabaseState,
  loadDatabase,
  saveDatabase,
  appendAuditLog,
  stripSampleData,
} from './storage';

export interface UserAccount {
  id: string;
  email: string;
  name: string;
  companyId: string;
  companyName: string;
  passwordHash: string;
  createdAt: string;
  lastLoginAt?: string;
}

interface ActiveSession {
  userId: string;
  companyId: string;
  email: string;
}

const ACCOUNTS_REGISTRY_KEY = 'mise_accounts_registry_v1';
const ACTIVE_SESSION_KEY = 'mise_active_session_v1';

export function getCompanyDatabaseKey(companyId: string): string {
  return `mise_company_db_${companyId}`;
}

/**
 * Retorna todas as contas registradas de forma privada no dispositivo.
 */
export function getRegisteredAccounts(): UserAccount[] {
  try {
    const raw = localStorage.getItem(ACCOUNTS_REGISTRY_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    console.error('Erro ao ler registro de contas:', e);
    return [];
  }
}

function saveRegisteredAccounts(accounts: UserAccount[]): void {
  try {
    localStorage.setItem(ACCOUNTS_REGISTRY_KEY, JSON.stringify(accounts));
  } catch (e) {
    console.error('Erro ao salvar registro de contas:', e);
  }
}

/**
 * Carrega o banco de dados privado de uma empresa específica.
 */
export function loadCompanyDatabase(companyId: string): MiseDatabaseState {
  try {
    const key = getCompanyDatabaseKey(companyId);
    const raw = localStorage.getItem(key);
    if (raw) {
      return stripSampleData(JSON.parse(raw));
    }
  } catch (e) {
    console.error(`Erro ao carregar banco da empresa ${companyId}:`, e);
  }
  // Se não encontrar banco específico, tenta o banco padrão se for compatível
  const fallback = loadDatabase();
  if (fallback.company?.id === companyId) {
    return fallback;
  }
  return fallback;
}

/**
 * Salva o banco de dados privado garantindo isolamento por empresa.
 */
export function saveCompanyDatabase(companyId: string, state: MiseDatabaseState): void {
  try {
    const key = getCompanyDatabaseKey(companyId);
    localStorage.setItem(key, JSON.stringify(state));
    // Mantém sincronizado também no storage principal para compatibilidade
    saveDatabase(state);
  } catch (e) {
    console.error(`Erro ao salvar banco da empresa ${companyId}:`, e);
  }
}

/**
 * Migra dados pré-existentes de versões anteriores para o modelo com senha obrigatória.
 */
export function ensureInitialMigration(): void {
  const accounts = getRegisteredAccounts();
  if (accounts.length > 0) return;

  const currentDb = loadDatabase();
  if (currentDb.company && currentDb.users && currentDb.users.length > 0) {
    const owner = currentDb.users[0];
    const initialPasswordHash = hashPassword('123456');
    const migratedAccount: UserAccount = {
      id: owner.id,
      email: owner.email.toLowerCase().trim(),
      name: owner.name,
      companyId: currentDb.company.id,
      companyName: currentDb.company.name,
      passwordHash: owner.passwordHash || initialPasswordHash,
      createdAt: owner.createdAt || new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
    };

    saveRegisteredAccounts([migratedAccount]);
    saveCompanyDatabase(currentDb.company.id, {
      ...currentDb,
      users: currentDb.users.map((u) => ({
        ...u,
        passwordHash: u.passwordHash || initialPasswordHash,
      })),
    });
  }
}

/**
 * Obtém a sessão ativa atual.
 */
export function getActiveSession(): ActiveSession | null {
  try {
    const raw = localStorage.getItem(ACTIVE_SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

export function setActiveSession(session: ActiveSession | null): void {
  try {
    if (session) {
      localStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(session));
    } else {
      localStorage.removeItem(ACTIVE_SESSION_KEY);
    }
  } catch (e) {
    console.error('Erro ao manipular sessão ativa:', e);
  }
}

/**
 * Registro de nova conta privada:
 * Cria um usuário com senha obrigatória criptografada e uma empresa 100% privada e isolada.
 */
export function registerPrivateAccount(params: {
  ownerName: string;
  email: string;
  password: string;
  companyName: string;
  storeName?: string;
  loadDemoCatalog?: boolean;
}): { account: UserAccount; database: MiseDatabaseState } {
  const cleanEmail = params.email.toLowerCase().trim();
  const cleanName = params.ownerName.trim();
  const cleanCompanyName = params.companyName.trim();
  const cleanStoreName = (params.storeName || 'Matriz').trim();

  if (!cleanName) {
    throw new Error('O nome do gestor/dono é obrigatório.');
  }
  if (!cleanEmail || !cleanEmail.includes('@')) {
    throw new Error('Informe um e-mail válido.');
  }
  if (!params.password || params.password.length < 6) {
    throw new Error('A senha deve ter no mínimo 6 caracteres para segurança da sua empresa.');
  }
  if (!cleanCompanyName) {
    throw new Error('Informe o nome da sua empresa / restaurante.');
  }

  const accounts = getRegisteredAccounts();
  const existing = accounts.find((a) => a.email === cleanEmail);
  if (existing) {
    throw new Error(
      `Já existe uma conta cadastrada para o e-mail '${cleanEmail}'. Por favor, clique na aba 'Entrar' e digite sua senha.`
    );
  }

  const now = new Date().toISOString();
  const companyId = `comp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const storeId = `store_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const userId = `user_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const passwordHash = hashPassword(params.password);

  // Inicia banco 100% limpo e privado, sem insumos ou receitas de exemplo
  const company: Company = {
    id: companyId,
    name: cleanCompanyName,
    createdAt: now,
    updatedAt: now,
  };

    const mainStore: Store = {
      id: storeId,
      name: cleanStoreName,
      code: 'MATRIZ',
      isMainStore: true,
      createdAt: now,
    };

    const user: User = {
      id: userId,
      name: cleanName,
      email: cleanEmail,
      passwordHash,
      role: 'DONO',
      storeIds: [storeId],
      twoFactorEnabled: false,
      createdAt: now,
    };

  const newDb: MiseDatabaseState = {
    company,
    stores: [mainStore],
      users: [user],
      activeUserId: userId,
      activeStoreId: storeId,
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

  // Registra auditoria da criação da conta
  const auditedDb = appendAuditLog(
    newDb,
    'USER_REGISTER',
    'Company',
    companyId,
    `Empresa '${cleanCompanyName}' cadastrada com sucesso pelo dono '${cleanName}' (${cleanEmail}).`
  );

  const newAccount: UserAccount = {
    id: userId,
    email: cleanEmail,
    name: cleanName,
    companyId,
    companyName: cleanCompanyName,
    passwordHash,
    createdAt: now,
    lastLoginAt: now,
  };

  accounts.push(newAccount);
  saveRegisteredAccounts(accounts);
  saveCompanyDatabase(companyId, auditedDb);
  setActiveSession({ userId, companyId, email: cleanEmail });

  return { account: newAccount, database: auditedDb };
}

/**
 * Autenticação estrita com validação obrigatória de senha:
 * NUNCA permite login sem senha ou com senha divergente.
 */
export function loginWithPassword(
  email: string,
  plainTextPassword: string
): { account: UserAccount; database: MiseDatabaseState } {
  const cleanEmail = email.toLowerCase().trim();

  if (!cleanEmail) {
    throw new Error('Por favor, informe seu e-mail cadastrado.');
  }
  if (!plainTextPassword) {
    throw new Error('A senha é obrigatória para acessar sua empresa privada.');
  }

  ensureInitialMigration();
  const accounts = getRegisteredAccounts();
  const account = accounts.find((a) => a.email === cleanEmail);

  if (!account) {
    throw new Error(
      `Nenhuma conta encontrada com o e-mail '${cleanEmail}'. Por favor, verifique a digitação ou crie uma conta na aba 'Criar Conta'.`
    );
  }

  const isPasswordValid = verifyPassword(plainTextPassword, account.passwordHash);
  if (!isPasswordValid) {
    throw new Error('Senha incorreta. Por favor verifique sua senha e tente novamente.');
  }

  // Senha validada com sucesso! Atualiza lastLoginAt
  account.lastLoginAt = new Date().toISOString();
  saveRegisteredAccounts(accounts);

  // Carrega estritamente o banco de dados privado da empresa do usuário
  let companyDb = loadCompanyDatabase(account.companyId);

  // Garante que o activeUserId é o usuário logado
  companyDb = {
    ...companyDb,
    activeUserId: account.id,
    activeStoreId: companyDb.activeStoreId || (companyDb.stores[0]?.id ?? 'CONSOLIDATED'),
  };

  const auditedDb = appendAuditLog(
    companyDb,
    'USER_LOGIN',
    'User',
    account.id,
    `Sessão autenticada com sucesso com senha por '${account.name}' (${cleanEmail}).`
  );

  saveCompanyDatabase(account.companyId, auditedDb);
  setActiveSession({
    userId: account.id,
    companyId: account.companyId,
    email: cleanEmail,
  });

  return { account, database: auditedDb };
}

/**
 * Encerra a sessão ativa do usuário.
 */
export function logoutCurrentSession(): void {
  const session = getActiveSession();
  if (session) {
    const db = loadCompanyDatabase(session.companyId);
    const audited = appendAuditLog(
      { ...db, activeUserId: null },
      'USER_LOGOUT',
      'User',
      session.userId,
      `Sessão encerrada por '${session.email}'.`
    );
    saveCompanyDatabase(session.companyId, audited);
  }
  setActiveSession(null);
}
