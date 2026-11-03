/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Mise — Unit Conversion & Currency Math Engine
 */

import { BaseUnit } from './types';

export class IncompatibleUnitError extends Error {
  constructor(fromUnit: string, toUnit: string) {
    super(`Conversão incompatível entre grandezas: de '${fromUnit}' para '${toUnit}'. Requer densidade ou fator explícito.`);
    this.name = 'IncompatibleUnitError';
  }
}

/**
 * Tabela de conversões de unidades universais para Unidade-Base.
 */
const STANDARD_CONVERSIONS: Record<string, { baseUnit: BaseUnit; factor: number }> = {
  // Massa -> gramas (g)
  g: { baseUnit: 'g', factor: 1 },
  gr: { baseUnit: 'g', factor: 1 },
  kg: { baseUnit: 'g', factor: 1000 },
  kilo: { baseUnit: 'g', factor: 1000 },
  quilo: { baseUnit: 'g', factor: 1000 },
  mg: { baseUnit: 'g', factor: 0.001 },

  // Volume -> mililitros (ml)
  ml: { baseUnit: 'ml', factor: 1 },
  l: { baseUnit: 'ml', factor: 1000 },
  lt: { baseUnit: 'ml', factor: 1000 },
  litro: { baseUnit: 'ml', factor: 1000 },
  litros: { baseUnit: 'ml', factor: 1000 },

  // Discreto -> unidades (un)
  un: { baseUnit: 'un', factor: 1 },
  und: { baseUnit: 'un', factor: 1 },
  unidade: { baseUnit: 'un', factor: 1 },
  unidades: { baseUnit: 'un', factor: 1 },
  dz: { baseUnit: 'un', factor: 12 },
  duzia: { baseUnit: 'un', factor: 12 },
  dúzia: { baseUnit: 'un', factor: 12 },
  cento: { baseUnit: 'un', factor: 100 },
};

/**
 * Converte qualquer valor em unidade comercial para a unidade base canônica.
 */
export function convertToBaseUnit(
  quantity: number,
  fromUnitStr: string,
  targetBaseUnit: BaseUnit
): number {
  const normalized = fromUnitStr.trim().toLowerCase();
  const rule = STANDARD_CONVERSIONS[normalized];

  if (!rule) {
    // Se a unidade de origem coincide exatamente com a base esperada
    if (normalized === targetBaseUnit) return quantity;
    throw new IncompatibleUnitError(fromUnitStr, targetBaseUnit);
  }

  if (rule.baseUnit !== targetBaseUnit) {
    throw new IncompatibleUnitError(fromUnitStr, targetBaseUnit);
  }

  return quantity * rule.factor;
}

/**
 * Formata quantidades da unidade-base de forma humanizada e legível (ex: 1500g -> "1,5 kg").
 */
export function formatBaseQuantity(quantity: number, baseUnit: BaseUnit): string {
  if (baseUnit === 'g') {
    if (Math.abs(quantity) >= 1000) {
      const kg = quantity / 1000;
      return `${kg.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 3 })} kg`;
    }
    return `${quantity.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 1 })} g`;
  }

  if (baseUnit === 'ml') {
    if (Math.abs(quantity) >= 1000) {
      const liters = quantity / 1000;
      return `${liters.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} L`;
    }
    return `${quantity.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} ml`;
  }

  return `${quantity.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} un`;
}

/**
 * Converte centavos inteiros (BigInt/integer) para string monetária pt-BR (R$ 1.250,00).
 */
export function formatCentsToCurrency(cents: number): string {
  const reais = cents / 100;
  return reais.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Converte valor em reais (string digitada pelo usuário, ex: "15,50") para centavos inteiros.
 */
export function parseCurrencyToCents(value: string | number): number {
  if (typeof value === 'number') {
    return Math.round(value * 100);
  }
  const cleaned = value.replace(/[^\d,-]/g, '').replace(',', '.');
  const parsed = parseFloat(cleaned);
  if (isNaN(parsed)) return 0;
  return Math.round(parsed * 100);
}
