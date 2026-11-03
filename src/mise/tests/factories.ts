/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Mise — Test Data Factories
 * Isoladas exclusivamente para execução de testes automatizados.
 */

import { Ingredient, Recipe, StockMovement, Supplier, Store, Company, User } from '../src/domain/types';

export function makeTestCompany(override?: Partial<Company>): Company {
  return {
    id: 'test_company_1',
    name: 'Restaurante Teste Bistrô',
    legalDocument: '12.345.678/0001-90',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...override,
  };
}

export function makeTestStore(override?: Partial<Store>): Store {
  return {
    id: 'test_store_1',
    name: 'Unidade Centro',
    code: 'CENTRO',
    isMainStore: true,
    createdAt: new Date().toISOString(),
    ...override,
  };
}

export function makeTestUser(override?: Partial<User>): User {
  return {
    id: 'test_user_1',
    name: 'Dono Gestor',
    email: 'dono@teste.com',
    role: 'DONO',
    storeIds: ['test_store_1'],
    twoFactorEnabled: false,
    createdAt: new Date().toISOString(),
    ...override,
  };
}

export function makeTestIngredient(override?: Partial<Ingredient>): Ingredient {
  return {
    id: `ing_${Math.random().toString(36).substring(2, 7)}`,
    name: 'Farinha de Trigo Especial',
    category: 'Secos',
    baseUnit: 'g',
    currentUnitCostMicrocents: 50, // R$ 0,005 por grama (R$ 5,00 por kg)
    minimumStockInBaseUnit: 10000, // 10 kg
    packagings: [
      {
        id: 'pack_1',
        packagingName: 'Saco 25kg',
        quantityInBaseUnit: 25000,
        costInCents: 12500, // R$ 125,00
      },
    ],
    updatedAt: new Date().toISOString(),
    ...override,
  };
}

export function makeTestRecipe(override?: Partial<Recipe>): Recipe {
  return {
    id: `rec_${Math.random().toString(36).substring(2, 7)}`,
    name: 'Pizza Margherita 35cm',
    category: 'Pizzas',
    isSubRecipe: false,
    yieldPortions: 1,
    lines: [],
    salePriceInCents: 4500, // R$ 45,00
    targetMarginPercentage: 70, // 70%
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...override,
  };
}
