/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Mise — Gerador de Dados de Demonstração Determinísticos
 * Permite que donos e avaliadores testem instantaneamente a inteligência
 * financeira e operacional com insumos, fichas técnicas e CMV reais.
 */

import { MiseDatabaseState } from './storage';
import {
  Company,
  Store,
  User,
  Ingredient,
  Recipe,
  Supplier,
  StockMovement,
  StockLot,
  Alert,
} from '../domain/types';

export function createDemoSeedDatabase(
  companyName: string = 'Bistrô & Burger Artesanal',
  ownerName: string = 'Chef Rodrigo Silva',
  ownerEmail: string = 'rodrigo@misebistro.com'
): MiseDatabaseState {
  const now = new Date().toISOString();
  const companyId = `comp_demo_${Date.now()}`;
  const storeId = `store_demo_${Date.now()}`;
  const userId = `user_demo_${Date.now()}`;

  const company: Company = {
    id: companyId,
    name: companyName,
    legalDocument: '28.491.802/0001-44',
    createdAt: now,
    updatedAt: now,
  };

  const store: Store = {
    id: storeId,
    name: 'Unidade Jardins - Matriz',
    code: 'MATRIZ',
    isMainStore: true,
    address: 'Rua Augusta, 1420 - São Paulo, SP',
    createdAt: now,
  };

  const user: User = {
    id: userId,
    name: ownerName,
    email: ownerEmail.toLowerCase(),
    role: 'DONO',
    storeIds: [storeId],
    twoFactorEnabled: false,
    createdAt: now,
  };

  const suppliers: Supplier[] = [
    {
      id: 'sup_1',
      name: 'Frigorífico Boi Nobre Carnes',
      cnpjOrCpf: '14.223.111/0001-09',
      contactName: 'Carlos Silveira',
      phone: '(11) 98765-4321',
      email: 'pedidos@boinobre.com.br',
      leadTimeDays: 2,
    },
    {
      id: 'sup_2',
      name: 'Padaria & Confeitaria Mestre Pão',
      cnpjOrCpf: '22.334.445/0001-78',
      contactName: 'Mariana Duarte',
      phone: '(11) 97654-3210',
      email: 'comercial@mestepao.com.br',
      leadTimeDays: 1,
    },
    {
      id: 'sup_3',
      name: 'Distribuidora Laticínios Serra Bella',
      cnpjOrCpf: '33.445.556/0001-12',
      contactName: 'Fernando Costa',
      phone: '(11) 99123-4567',
      email: 'vendas@serrabella.com.br',
      leadTimeDays: 3,
    },
  ];

  // Insumos com custos em microcentavos (1 real = 100 centavos = 10.000 microcentavos)
  const ingredients: Ingredient[] = [
    {
      id: 'ing_pao',
      name: 'Pão Brioche Selado Artesanal',
      category: 'Panificação',
      baseUnit: 'un',
      currentUnitCostMicrocents: 18000, // R$ 1,80 / unidade
      minimumStockInBaseUnit: 120,
      preferredSupplierId: 'sup_2',
      packagings: [
        {
          id: 'pkg_pao_fd',
          packagingName: 'Fardo com 30 unidades',
          quantityInBaseUnit: 30,
          costInCents: 5400, // R$ 54,00
        },
      ],
      updatedAt: now,
    },
    {
      id: 'ing_blend',
      name: 'Blend Bovino Angus Resfriado 180g',
      category: 'Proteínas / Carnes',
      baseUnit: 'g',
      currentUnitCostMicrocents: 48, // R$ 0,0048 / g (R$ 48,00 / kg)
      minimumStockInBaseUnit: 15000, // 15 kg
      preferredSupplierId: 'sup_1',
      packagings: [
        {
          id: 'pkg_blend_cx',
          packagingName: 'Caixa Vácuo 10kg',
          quantityInBaseUnit: 10000,
          costInCents: 48000, // R$ 480,00
        },
      ],
      updatedAt: now,
    },
    {
      id: 'ing_cheddar',
      name: 'Queijo Cheddar Inglês Fatiado',
      category: 'Laticínios',
      baseUnit: 'g',
      currentUnitCostMicrocents: 65, // R$ 0,0065 / g (R$ 65,00 / kg)
      minimumStockInBaseUnit: 4000, // 4 kg
      preferredSupplierId: 'sup_3',
      packagings: [
        {
          id: 'pkg_cheddar_pct',
          packagingName: 'Pacote 1kg fatiado',
          quantityInBaseUnit: 1000,
          costInCents: 6500, // R$ 65,00
        },
      ],
      updatedAt: now,
    },
    {
      id: 'ing_bacon',
      name: 'Bacon em Fatias Defumado',
      category: 'Proteínas / Carnes',
      baseUnit: 'g',
      currentUnitCostMicrocents: 55, // R$ 0,0055 / g (R$ 55,00 / kg)
      minimumStockInBaseUnit: 3000,
      preferredSupplierId: 'sup_1',
      packagings: [
        {
          id: 'pkg_bacon_pct',
          packagingName: 'Pacote 1kg fatiado',
          quantityInBaseUnit: 1000,
          costInCents: 5500,
        },
      ],
      updatedAt: now,
    },
    {
      id: 'ing_molho',
      name: 'Molho Especial de Páprica Defumada',
      category: 'Molhos & Condimentos',
      baseUnit: 'ml',
      currentUnitCostMicrocents: 30, // R$ 0,0030 / ml (R$ 30,00 / litro)
      minimumStockInBaseUnit: 3000,
      packagings: [
        {
          id: 'pkg_molho_bombona',
          packagingName: 'Galão 5L',
          quantityInBaseUnit: 5000,
          costInCents: 15000,
        },
      ],
      updatedAt: now,
    },
    {
      id: 'ing_batata',
      name: 'Batata Palito Belga Congelada',
      category: 'Guarnições',
      baseUnit: 'g',
      currentUnitCostMicrocents: 18, // R$ 0,0018 / g (R$ 18,00 / kg)
      minimumStockInBaseUnit: 25000,
      packagings: [
        {
          id: 'pkg_batata_sc',
          packagingName: 'Saco 2,5kg congelado',
          quantityInBaseUnit: 2500,
          costInCents: 4500,
        },
      ],
      updatedAt: now,
    },
    {
      id: 'ing_embalagem',
      name: 'Caixa Kraft Térmica para Burger',
      category: 'Embalagens & Descartáveis',
      baseUnit: 'un',
      currentUnitCostMicrocents: 9500, // R$ 0,95 / un
      minimumStockInBaseUnit: 300,
      packagings: [
        {
          id: 'pkg_emb_fd',
          packagingName: 'Fardo 100 unidades',
          quantityInBaseUnit: 100,
          costInCents: 9500,
        },
      ],
      updatedAt: now,
    },
  ];

  // Fichas Técnicas determinísticas
  const recipes: Recipe[] = [
    {
      id: 'rec_burger_smash',
      name: 'Burger Angus Bacon Cheddar',
      category: 'Burgers Principais',
      isSubRecipe: false,
      yieldPortions: 1,
      salePriceInCents: 3800, // R$ 38,00
      targetMarginPercentage: 65, // 65% de margem alvo
      lines: [
        {
          id: 'line_1',
          ingredientId: 'ing_pao',
          quantityInBaseUnit: 1,
          correctionFactor: 1.0,
        },
        {
          id: 'line_2',
          ingredientId: 'ing_blend',
          quantityInBaseUnit: 180,
          correctionFactor: 1.0,
        },
        {
          id: 'line_3',
          ingredientId: 'ing_cheddar',
          quantityInBaseUnit: 40,
          correctionFactor: 1.0,
        },
        {
          id: 'line_4',
          ingredientId: 'ing_bacon',
          quantityInBaseUnit: 30,
          correctionFactor: 1.0,
        },
        {
          id: 'line_5',
          ingredientId: 'ing_molho',
          quantityInBaseUnit: 30,
          correctionFactor: 1.0,
        },
        {
          id: 'line_6',
          ingredientId: 'ing_embalagem',
          quantityInBaseUnit: 1,
          correctionFactor: 1.0,
        },
      ],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'rec_batata_rustica',
      name: 'Porção Batata Rústica Artesanal',
      category: 'Acompanhamentos',
      isSubRecipe: false,
      yieldPortions: 1,
      salePriceInCents: 1800, // R$ 18,00
      targetMarginPercentage: 70,
      lines: [
        {
          id: 'line_b1',
          ingredientId: 'ing_batata',
          quantityInBaseUnit: 250,
          correctionFactor: 1.0,
        },
        {
          id: 'line_b2',
          ingredientId: 'ing_molho',
          quantityInBaseUnit: 40,
          correctionFactor: 1.0,
        },
      ],
      createdAt: now,
      updatedAt: now,
    },
  ];

  // Lotes em estoque com validade (FEFO F14)
  const stockLots: StockLot[] = [
    {
      id: 'lot_cheddar_1',
      storeId,
      ingredientId: 'ing_cheddar',
      lotNumber: 'LOTE-CHE-2026-A',
      remainingQuantityInBaseUnit: 3500, // 3,5 kg
      unitCostMicrocents: 65,
      expirationDate: new Date(Date.now() + 8 * 86400000).toISOString().split('T')[0], // vence em 8 dias
      receivedDate: now,
    },
    {
      id: 'lot_blend_1',
      storeId,
      ingredientId: 'ing_blend',
      lotNumber: 'LOTE-BOI-099',
      remainingQuantityInBaseUnit: 18500, // 18,5 kg
      unitCostMicrocents: 48,
      expirationDate: new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0], // vence em 5 dias
      receivedDate: now,
    },
    {
      id: 'lot_pao_1',
      storeId,
      ingredientId: 'ing_pao',
      lotNumber: 'LOTE-PAO-342',
      remainingQuantityInBaseUnit: 140, // 140 pães
      unitCostMicrocents: 18000,
      expirationDate: new Date(Date.now() + 4 * 86400000).toISOString().split('T')[0], // vence em 4 dias
      receivedDate: now,
    },
  ];

  // Movimentações de estoque iniciais
  const stockMovements: StockMovement[] = [
    {
      id: 'mov_pao_in',
      ingredientId: 'ing_pao',
      storeId,
      type: 'PURCHASE_RECEIPT',
      quantityInBaseUnit: 180,
      unitCostMicrocents: 18000,
      totalCostInCents: 32400,
      createdAt: now,
      createdBy: userId,
      reason: 'Entrada via NF-e 4920 - Mestre Pão',
    },
    {
      id: 'mov_blend_in',
      ingredientId: 'ing_blend',
      storeId,
      type: 'PURCHASE_RECEIPT',
      quantityInBaseUnit: 25000,
      unitCostMicrocents: 48,
      totalCostInCents: 120000,
      createdAt: now,
      createdBy: userId,
      reason: 'Entrada via NF-e 8812 - Frigorífico Boi Nobre',
    },
  ];

  // Mapeamento de produtos de venda para receita (F43 / F08)
  const productNameToRecipeIdMap: Record<string, string> = {
    'Burger Angus Bacon Cheddar': 'rec_burger_smash',
    'Angus Bacon Cheddar Salão': 'rec_burger_smash',
    'Combo Smash Burger + Batata': 'rec_burger_smash',
    'Porção Batata Rústica': 'rec_batata_rustica',
  };

  // Eventos de valor inicial para F48 (Central de Valor)
  const valueEvents = [
    {
      id: 'val_1',
      formulaId: 'F01',
      title: 'Simulação e Renegociação de Insumo (Blend Bovino)',
      identifiedValueCents: 240000, // R$ 2.400,00 identificado
      realizedValueCents: 180000, // R$ 1.800,00 realizado
      minutesSaved: 120,
      status: 'REALIZED',
      date: now,
      explanation: 'Redução de R$ 3,00/kg no lote de Blend Angus após auditoria de cotações da NF-e.',
    },
    {
      id: 'val_2',
      formulaId: 'F14',
      title: 'Prevenção de Perda FEFO (Queijo Cheddar)',
      identifiedValueCents: 85000, // R$ 850,00
      realizedValueCents: 85000,
      minutesSaved: 45,
      status: 'REALIZED',
      date: now,
      explanation: 'Aviso de vencimento com 8 dias permitiu inclusão prioritária no especial de fim de semana.',
    },
    {
      id: 'val_3',
      formulaId: 'F03',
      title: 'Reajuste Inteligente de Margem (Burger Smash)',
      identifiedValueCents: 145000, // R$ 1.450,00
      realizedValueCents: 92000, // R$ 920,00
      minutesSaved: 60,
      status: 'PARTIAL',
      date: now,
      explanation: 'Correção de R$ 36,00 para R$ 38,00 recuperou a margem de contribuição com retenção de 96% do volume.',
    },
  ];

  // Fila Faça Hoje (F49)
  const dailyTasks = [
    {
      id: 'task_1',
      title: 'Auditar lote de Queijo Cheddar com validade próxima',
      actionUrl: 'inventory',
      amountAtStakeCents: 85000,
      urgency: 'HIGH',
      formulaId: 'F14',
      completed: false,
    },
    {
      id: 'task_2',
      title: 'Confirmar reajuste sugerido de R$ 2,00 no Burger Angus',
      actionUrl: 'recipes',
      amountAtStakeCents: 145000,
      urgency: 'CRITICAL',
      formulaId: 'F03',
      completed: false,
    },
    {
      id: 'task_3',
      title: 'Importar XML da NF-e de reposição da carne',
      actionUrl: 'purchases',
      amountAtStakeCents: 240000,
      urgency: 'MEDIUM',
      formulaId: 'F44',
      completed: false,
    },
  ];

  const alerts: Alert[] = [
    {
      id: 'alt_1',
      type: 'EXPIRATION_IMMINENT',
      title: 'Lote de Queijo Cheddar com Vencimento Próximo',
      description: 'Lote de Queijo Cheddar vence em 8 dias (R$ 227,50 em risco). Ação prioritária recomendada.',
      severity: 'WARNING',
      targetTab: 'inventory',
      actionLabel: 'Ver Lotes FEFO',
      createdAt: now,
      read: false,
    },
  ];

  const state: MiseDatabaseState = {
    company,
    stores: [store],
    users: [user],
    activeUserId: userId,
    activeStoreId: storeId,
    ingredients,
    recipes,
    stockMovements,
    suppliers,
    purchaseOrders: [],
    salesImports: [],
    payables: [],
    receivables: [],
    productionOrders: [],
    inventoryCounts: [],
    auditLogs: [
      {
        id: `audit_demo_init`,
        action: 'BOOTSTRAP_DEMO',
        entityType: 'Company',
        entityId: companyId,
        userId,
        userName: ownerName,
        details: 'Ambiente de demonstração Bistrô & Burger Artesanal carregado com sucesso.',
        timestamp: now,
      },
    ],
    alerts,
    productNameToRecipeIdMap,
    stockLots,
    valueEvents,
    dailyTasks,
  };

  return state;
}
