/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Mise — F21: Calendário de Compras por Fornecedor e Lead Time
 */

import { Supplier, Ingredient } from './types';
import { DomainExplanation, ProcurementCalendarResult, ProcurementDeadlineItem } from './insights-types';

/**
 * F21: Calendário de Compras por Fornecedor
 * Ajusta a data limite do pedido a partir do lead time e dos dias de corte do fornecedor.
 */
export function calculateProcurementDeadlines(
  items: {
    ingredient: Ingredient;
    supplier: Supplier;
    stockOutProjectedDate: string; // ISO YYYY-MM-DD
  }[],
  now = new Date()
): ProcurementCalendarResult {
  const deadlines: ProcurementDeadlineItem[] = [];
  let urgentCount = 0;

  for (const item of items) {
    const { ingredient, supplier, stockOutProjectedDate } = item;
    const leadTime = supplier.leadTimeDays || 1;
    // Dias de corte aceitos pelo fornecedor (default: dias úteis 1 a 5 se não configurado)
    const cutoffDays = supplier.deliveryDaysOfWeek && supplier.deliveryDaysOfWeek.length > 0
      ? supplier.deliveryDaysOfWeek
      : [1, 2, 3, 4, 5];

    // Data de necessidade física
    const stockOutDate = new Date(`${stockOutProjectedDate}T12:00:00Z`);

    // Data ideal de disparo = necessidade - lead time
    const idealOrderDate = new Date(stockOutDate.getTime());
    idealOrderDate.setUTCDate(idealOrderDate.getUTCDate() - leadTime);

    // Ajustar para o último dia de corte anterior ou igual à data ideal
    const latestOrderDate = new Date(idealOrderDate.getTime());
    let safetyCounter = 0;
    while (!cutoffDays.includes(latestOrderDate.getUTCDay()) && safetyCounter < 14) {
      latestOrderDate.setUTCDate(latestOrderDate.getUTCDate() - 1);
      safetyCounter++;
    }

    const todayMidday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 12, 0, 0));
    const isLate = latestOrderDate.getTime() < todayMidday.getTime();
    const daysUntilLatest = Math.round((latestOrderDate.getTime() - todayMidday.getTime()) / (1000 * 60 * 60 * 24));
    const isUrgent = daysUntilLatest <= 1;

    if (isUrgent || isLate) {
      urgentCount++;
    }

    deadlines.push({
      ingredientId: ingredient.id,
      ingredientName: ingredient.name,
      supplierId: supplier.id,
      supplierName: supplier.name,
      leadTimeDays: leadTime,
      cutoffDaysOfWeek: cutoffDays,
      stockOutProjectedDate,
      idealOrderDate: idealOrderDate.toISOString().split('T')[0],
      latestOrderDate: latestOrderDate.toISOString().split('T')[0],
      isUrgent,
      isLate,
    });
  }

  // Ordenar os mais urgentes primeiro
  deadlines.sort((a, b) => a.latestOrderDate.localeCompare(b.latestOrderDate));

  const explanation: DomainExplanation<number> = {
    valor: urgentCount,
    unidade: 'pedidos',
    formula: 'T_disparo = T_necessidade - LeadTime; Ajuste para max {d ∈ DiasCorte | d ≤ T_disparo}',
    entradas: {
      totalItensAvaliados: items.length,
      pedidosUrgentes: urgentCount,
    },
    passos: [
      `1. Cruzada a data de ruptura projetada com o lead time e os dias de corte de cada fornecedor.`,
      `2. ${urgentCount} pedidos requerem emissão imediata hoje ou estão em estado de atenção.`,
      `3. O insumo mais urgente para pedido é "${deadlines[0]?.ingredientName || 'Nenhum'}" (Data limite: ${deadlines[0]?.latestOrderDate || '-'}).`,
    ],
    suficienciaDeDados: {
      suficiente: items.length > 0,
      faltam: items.length === 0 ? 'Nenhum insumo com data projetada de ruptura.' : undefined,
      percentualConfiabilidade: items.length > 0 ? 100 : 0,
    },
    confianca: items.length > 0 ? 'ALTA' : 'INSUFICIENTE',
  };

  return {
    deadlines,
    urgentCount,
    explanation,
  };
}
