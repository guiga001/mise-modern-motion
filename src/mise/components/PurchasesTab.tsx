/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Mise — Compras Manuais de Insumos & Matérias-Primas
 * 100% Manual, simples e direto: registre compras de atacado ou mercado com 1 clique.
 */

import React, { useState, useMemo } from 'react';
import {
  ShoppingCart,
  Plus,
  Truck,
  CheckCircle2,
  Calendar,
  AlertCircle,
  Clock,
  DollarSign,
  Trash2,
  Building2,
  Sparkles,
  TrendingDown,
  Scale,
  Target,
  Calculator,
  AlertTriangle,
} from 'lucide-react';
import { PurchaseOrder, Supplier, Ingredient, StockMovement, PayableEntry, BaseUnit } from '../domain/types';
import { calculateMovingAverageCost, calculateStockBalances } from '../domain/inventory';
import {
  generateOptimizedProcurementPlan,
  calculateTradeCreditEffectiveCost,
  detectOutlierPurchasePrices,
  calculateProcurementBudget,
} from '../domain/procurement-intelligence';
import { formatBaseQuantity, formatCentsToCurrency, parseCurrencyToCents } from '../domain/units';
import { MiseDatabaseState, appendAuditLog } from '../lib/storage';
import { Modal } from './Modal';
import { EmptyState } from './EmptyState';
import { ExplanationModal, HowWeCalculatedButton } from './ExplanationModal';

interface PurchasesTabProps {
  database: MiseDatabaseState;
  onUpdateDatabase: (newState: MiseDatabaseState) => void;
  onNavigateToIngredients: () => void;
}

export const PurchasesTab: React.FC<PurchasesTabProps> = ({
  database,
  onUpdateDatabase,
  onNavigateToIngredients,
}) => {
  const { activeStoreId, stores, suppliers, ingredients, purchaseOrders, stockMovements } = database;
  const targetStoreId = activeStoreId === 'CONSOLIDATED' ? (stores[0]?.id || 'store_1') : activeStoreId;

  const [viewMode, setViewMode] = useState<'ORDERS' | 'INTELLIGENCE'>('ORDERS');
  const [selectedExplanation, setSelectedExplanation] = useState<{ title: string; explanation: any } | null>(null);

  // F18: Simulador de Prazo
  const [simInvoiceStr, setSimInvoiceStr] = useState('1000,00');
  const [simDiscountStr, setSimDiscountStr] = useState('3');
  const [simDaysStr, setSimDaysStr] = useState('28');

  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);

  // Form Compra Manual Direta
  const [supplierName, setSupplierName] = useState('Atacadão / Distribuidor');
  const [selectedIngredientId, setSelectedIngredientId] = useState('');
  const [isCreatingNewIngredient, setIsCreatingNewIngredient] = useState(false);
  const [newIngredientName, setNewIngredientName] = useState('');
  const [newIngredientBaseUnit, setNewIngredientBaseUnit] = useState<BaseUnit>('g');

  const [quantityPurchased, setQuantityPurchased] = useState('1000');
  const [totalCostStr, setTotalCostStr] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentType, setPaymentType] = useState<'PAID_NOW' | 'PAY_LATER'>('PAID_NOW');
  const [dueDate, setDueDate] = useState('');

  const selectedIng = ingredients.find(i => i.id === selectedIngredientId);

  const handleOpenPurchaseModal = () => {
    if (ingredients.length === 0) {
      setIsCreatingNewIngredient(true);
      setSelectedIngredientId('NEW');
    } else {
      setIsCreatingNewIngredient(false);
      setSelectedIngredientId(ingredients[0]?.id || '');
    }
    setSupplierName('Atacadão / Distribuidor');
    setQuantityPurchased('1000');
    setTotalCostStr('');
    setPaymentType('PAID_NOW');
    setIsPurchaseModalOpen(true);
  };

  const handleSaveDirectPurchase = (e: React.FormEvent) => {
    e.preventDefault();
    const qty = parseFloat(quantityPurchased);
    if (isNaN(qty) || qty <= 0) return;

    const totalCents = parseCurrencyToCents(totalCostStr);
    if (totalCents <= 0) return;

    const now = new Date().toISOString();
    let targetIngredient: Ingredient | undefined;
    let updatedIngredients = [...ingredients];

    // Se estiver criando insumo na hora
    if (isCreatingNewIngredient || selectedIngredientId === 'NEW') {
      if (!newIngredientName.trim()) return;
      const unitCostMicro = Math.round((totalCents * 10000) / qty);

      targetIngredient = {
        id: `ing_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        name: newIngredientName.trim(),
        category: 'Geral',
        baseUnit: newIngredientBaseUnit,
        minimumStockInBaseUnit: 1000,
        currentUnitCostMicrocents: unitCostMicro,
        packagings: [
          {
            id: `pack_${Date.now()}`,
            packagingName: 'Embalagem de Compra',
            quantityInBaseUnit: qty,
            costInCents: totalCents,
          },
        ],
        updatedAt: now,
      };
      updatedIngredients = [...updatedIngredients, targetIngredient];
    } else {
      targetIngredient = ingredients.find(i => i.id === selectedIngredientId);
    }

    if (!targetIngredient) return;

    const balances = calculateStockBalances(targetStoreId, ingredients, stockMovements);
    const currentBalance = balances.get(targetIngredient.id)?.currentBalanceInBaseUnit || 0;

    // Custo por microcentavos da entrada
    const entryUnitCostMicro = Math.round((totalCents * 10000) / qty);

    // Recalcular Custo Médio Ponderado
    const newAverageCostMicro = calculateMovingAverageCost(
      currentBalance,
      targetIngredient.currentUnitCostMicrocents,
      qty,
      entryUnitCostMicro
    );

    // 1. Movimento de estoque (Entrada)
    const newMovement: StockMovement = {
      id: `mov_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      storeId: targetStoreId,
      ingredientId: targetIngredient.id,
      type: 'PURCHASE_RECEIPT',
      quantityInBaseUnit: qty,
      unitCostMicrocents: entryUnitCostMicro,
      totalCostInCents: totalCents,
      reason: `Compra manual: ${supplierName}`,
      createdAt: now,
      createdBy: 'Dono Gestor',
    };

    // 2. Atualizar o custo médio no cadastro do insumo
    updatedIngredients = updatedIngredients.map(i => {
      if (i.id === targetIngredient!.id) {
        return {
          ...i,
          currentUnitCostMicrocents: newAverageCostMicro,
          updatedAt: now,
        };
      }
      return i;
    });

    // 3. Registrar a Compra no histórico
    const orderId = `po_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newOrder: PurchaseOrder = {
      id: orderId,
      storeId: targetStoreId,
      supplierId: supplierName,
      status: 'RECEIVED',
      orderedDate: purchaseDate,
      receivedDate: purchaseDate,
      lines: [
        {
          id: `line_${Date.now()}`,
          ingredientId: targetIngredient.id,
          packagingName: `${formatBaseQuantity(qty, targetIngredient.baseUnit)} de ${targetIngredient.name}`,
          quantityOrdered: 1,
          baseUnitQuantity: qty,
          unitPriceInCents: totalCents,
          totalPriceInCents: totalCents,
        },
      ],
      totalAmountInCents: totalCents,
      notes: paymentType === 'PAID_NOW' ? 'Pago à vista' : `A pagar (Vencimento: ${dueDate || '15 dias'})`,
    };

    // 4. Se for a pagar a prazo, entra no Contas a Pagar
    let updatedPayables = [...database.payables];
    if (paymentType === 'PAY_LATER') {
      const billDueDate = dueDate || new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0];
      const newPayable: PayableEntry = {
        id: `pay_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        storeId: targetStoreId,
        description: `Compra: ${targetIngredient.name} (${supplierName})`,
        category: 'FORNECEDOR',
        amountInCents: totalCents,
        dueDate: billDueDate,
        status: 'PENDING',
      };
      updatedPayables = [newPayable, ...updatedPayables];
    }

    const stateWithPurchase = {
      ...database,
      purchaseOrders: [newOrder, ...database.purchaseOrders],
      stockMovements: [newMovement, ...database.stockMovements],
      ingredients: updatedIngredients,
      payables: updatedPayables,
    };

    const newState = appendAuditLog(
      stateWithPurchase,
      'MANUAL_PURCHASE',
      'PurchaseOrder',
      orderId,
      `Compra manual de ${formatBaseQuantity(qty, targetIngredient.baseUnit)} de '${targetIngredient.name}' no valor de ${formatCentsToCurrency(totalCents)} de '${supplierName}'.`
    );

    onUpdateDatabase(newState);
    setIsPurchaseModalOpen(false);
    setNewIngredientName('');
  };

  const handleDeletePurchase = (orderId: string) => {
    const updated = purchaseOrders.filter(p => p.id !== orderId);
    const newState = appendAuditLog(
      { ...database, purchaseOrders: updated },
      'DELETE_PURCHASE',
      'PurchaseOrder',
      orderId,
      'Registro de compra manual removido.'
    );
    onUpdateDatabase(newState);
  };

  const filteredOrders = purchaseOrders.filter(
    p => activeStoreId === 'CONSOLIDATED' || p.storeId === activeStoreId
  );

  const totalSpentInCents = filteredOrders.reduce((sum, o) => sum + o.totalAmountInCents, 0);

  // F17: Lista de Compras Otimizada
  const procurementPlan = useMemo(() => {
    const dummySupplier: Supplier = suppliers[0] || {
      id: 'sup_main',
      name: 'Distribuidor Geral',
      cnpjOrCpf: '',
      contactName: '',
      phone: '',
      email: '',
      leadTimeDays: 3,
      notes: '',
    };

    const stockMap = calculateStockBalances(targetStoreId, ingredients, stockMovements);

    const items = ingredients.map(ing => {
      const bal = stockMap.get(ing.id)?.currentBalanceInBaseUnit || 0;
      const minStock = ing.minimumStockInBaseUnit || 1000;
      const packSize = ing.packagings[0]?.quantityInBaseUnit || (ing.baseUnit === 'un' ? 1 : 1000);
      const unitPriceCents = Math.round((ing.currentUnitCostMicrocents * packSize) / 10000);

      return {
        ingredientId: ing.id,
        ingredientName: ing.name,
        baseUnit: ing.baseUnit,
        supplierId: dummySupplier.id,
        supplierName: dummySupplier.name,
        meanDailyDemand: Math.max(1, Math.round(minStock / 7)),
        safetyStock: Math.round(minStock * 0.5),
        currentBalance: bal,
        openOrdersQuantity: 0,
        packageSizeInBaseUnit: packSize,
        unitPriceInCents: unitPriceCents,
        leadTimeDays: 3,
        reviewCycleDays: 7,
      };
    });

    return generateOptimizedProcurementPlan(dummySupplier, items, 15000);
  }, [suppliers, ingredients, targetStoreId, stockMovements]);

  // F18: Simulador de Custo Efetivo de Prazo
  const creditCostResult = useMemo(() => {
    const invoiceCents = parseCurrencyToCents(simInvoiceStr);
    const discount = (parseFloat(simDiscountStr) || 0) / 100;
    const days = parseInt(simDaysStr) || 28;
    try {
      return calculateTradeCreditEffectiveCost(invoiceCents, discount, days, 0.01);
    } catch {
      return null;
    }
  }, [simInvoiceStr, simDiscountStr, simDaysStr]);

  // F19: Detector de Preços Fora da Curva (Outliers)
  const outliersList = useMemo(() => {
    const list: any[] = [];
    ingredients.forEach(ing => {
      const history = filteredOrders
        .filter(o => o.lines.some(l => l.ingredientId === ing.id))
        .map(o => {
          const l = o.lines.find(l => l.ingredientId === ing.id)!;
          return {
            id: o.id,
            date: o.orderedDate,
            quantity: l.quantityOrdered,
            unitPriceInCents: l.unitPriceInCents,
            supplierName: o.supplierId,
          };
        });

      if (history.length >= 2) {
        const latest = history[history.length - 1];
        const prev = history.slice(0, -1);
        const res = detectOutlierPurchasePrices(ing, prev, latest);
        if (res.isOutlier) {
          list.push(res);
        }
      }
    });
    return list;
  }, [ingredients, filteredOrders]);

  // F20: Orçamento de Compras por Categoria
  const budgetResult = useMemo(() => {
    const catBudgets = {
      'Hortifrúti': 200000,
      'Carnes': 400000,
      'Laticínios': 250000,
      'Embalagens': 150000,
      'Geral': 300000,
    };
    const catSpends: Record<string, number> = {};
    for (const po of purchaseOrders) {
      catSpends['Geral'] = (catSpends['Geral'] || 0) + po.totalAmountInCents;
    }
    const day = new Date().getDate();
    return calculateProcurementBudget(catBudgets, catSpends, day, 30);
  }, [purchaseOrders]);

  return (
    <div className="py-6 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-6">
      {/* Header bar com ação rápida e simples */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-stone-900 tracking-tight">
            Compras de Insumos & Abastecimento
          </h2>
          <p className="text-xs text-stone-500 mt-0.5">
            Ao lançar uma compra, o sistema coloca a mercadoria no estoque e atualiza o custo médio do prato.
          </p>
        </div>
        <button
          onClick={handleOpenPurchaseModal}
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-bold text-white bg-stone-900 hover:bg-stone-800 rounded-lg transition-colors cursor-pointer shadow-xs"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>+ Lançar Nova Compra</span>
        </button>
      </div>

      {/* Resumo de Gastos com Compras */}
      <div className="bg-white p-5 rounded-xl border border-stone-200/80 shadow-2xs flex items-center justify-between">
        <div>
          <span className="text-xs font-medium text-stone-500">Total Gasto em Compras de Insumos</span>
          <div className="text-2xl font-bold font-mono text-stone-900 mt-1">
            {formatCentsToCurrency(totalSpentInCents)}
          </div>
        </div>
        <div className="text-right text-xs text-stone-500">
          <span>{filteredOrders.length} compra(s) registrada(s)</span>
        </div>
      </div>

      {/* Switch de Visualização: Histórico vs Inteligência */}
      <div className="flex items-center gap-1 bg-stone-100 p-1 rounded-xl w-fit">
        <button
          onClick={() => setViewMode('ORDERS')}
          className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
            viewMode === 'ORDERS' ? 'bg-white text-stone-900 shadow-2xs' : 'text-stone-600 hover:text-stone-900'
          }`}
        >
          Histórico de Compras ({filteredOrders.length})
        </button>
        <button
          onClick={() => setViewMode('INTELLIGENCE')}
          className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
            viewMode === 'INTELLIGENCE' ? 'bg-white text-stone-900 shadow-2xs' : 'text-stone-600 hover:text-stone-900'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          <span>Inteligência & Otimização (F17–F20)</span>
          {outliersList.length > 0 && (
            <span className="w-2 h-2 rounded-full bg-rose-500" />
          )}
        </button>
      </div>

      {viewMode === 'ORDERS' && (
        purchaseOrders.length === 0 ? (
          <EmptyState
            icon={ShoppingCart}
            title="Nenhuma compra de insumos lançada"
            description="Comprou ingredientes no mercado, distribuidor ou açougue? Lance a compra aqui para abastecer o estoque e deixar seus custos 100% atualizados."
            actionLabel="+ Lançar Minha Primeira Compra"
            onAction={handleOpenPurchaseModal}
          />
        ) : (
          <div className="bg-white rounded-xl border border-stone-200/80 overflow-hidden shadow-2xs">
            <div className="p-4 border-b border-stone-100 flex items-center justify-between">
              <h3 className="text-xs font-bold text-stone-900 uppercase tracking-wider">
                Histórico de Compras Realizadas
              </h3>
              <span className="text-xs text-stone-500">{filteredOrders.length} lançamento(s)</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-stone-200 bg-stone-50/60 text-stone-500 font-semibold">
                    <th className="py-3 px-4">Data</th>
                    <th className="py-3 px-4">Fornecedor / Local</th>
                    <th className="py-3 px-4">Insumo Comprado</th>
                    <th className="py-3 px-4 text-right">Valor Pago</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {filteredOrders.map((order) => {
                    const firstLine = order.lines[0];
                    return (
                      <tr key={order.id} className="hover:bg-stone-50/60 transition-colors">
                        <td className="py-3 px-4 font-mono text-stone-600">
                          {order.orderedDate.split('-').reverse().join('/')}
                        </td>
                        <td className="py-3 px-4 font-semibold text-stone-900">
                          {order.supplierId}
                        </td>
                        <td className="py-3 px-4 text-stone-800">
                          {firstLine ? firstLine.packagingName : 'Mercadorias'}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-stone-900">
                          {formatCentsToCurrency(order.totalAmountInCents)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="text-[11px] font-bold text-emerald-700 flex items-center justify-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>No Estoque</span>
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => handleDeletePurchase(order.id)}
                            className="p-1 text-stone-400 hover:text-rose-600 rounded cursor-pointer transition-colors"
                            title="Remover compra"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

      {/* VIEW: INTELIGÊNCIA & OTIMIZAÇÃO (F17–F20) */}
      {viewMode === 'INTELLIGENCE' && (
        <div className="space-y-6">
          {/* F17: Lista de Compras Otimizada */}
          <div className="bg-white rounded-2xl border border-stone-200/80 p-6 shadow-2xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-stone-800" />
                <div>
                  <h3 className="text-sm font-bold text-stone-900">
                    F17 · Lista de Compras Otimizada (Pedido Mínimo & Fardos)
                  </h3>
                  <p className="text-xs text-stone-500 mt-0.5">
                    Sugestão de compra baseada em estoque atual, lote mínimo da embalagem e meta de cobertura.
                  </p>
                </div>
              </div>
              <HowWeCalculatedButton
                onClick={() =>
                  setSelectedExplanation({
                    title: 'F17 · Lista de Compras Otimizada',
                    explanation: procurementPlan.explanation,
                  })
                }
              />
            </div>

            <div className="flex items-center justify-between p-3.5 bg-stone-50 rounded-xl text-xs">
              <div>
                <span className="text-stone-500">Fornecedor:</span>{' '}
                <strong className="text-stone-900">{procurementPlan.supplierName}</strong>
              </div>
              <div>
                <span className="text-stone-500">Pedido Mínimo:</span>{' '}
                <strong className="font-mono text-stone-900">{formatCentsToCurrency(procurementPlan.minimumOrderInCents)}</strong>
              </div>
              <div>
                <span className="text-stone-500">Custo Total Sugerido:</span>{' '}
                <strong className="font-mono text-emerald-800 text-sm">{formatCentsToCurrency(procurementPlan.finalTotalCostInCents)}</strong>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-stone-200 bg-stone-50/60 text-stone-500 font-semibold">
                    <th className="py-2.5 px-3">Insumo</th>
                    <th className="py-2.5 px-3 text-right">Fardos/Embalagens</th>
                    <th className="py-2.5 px-3 text-right">Quantidade Total</th>
                    <th className="py-2.5 px-3 text-right">Custo Estimado</th>
                    <th className="py-2.5 px-3 text-right">Cobertura (Dias)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {procurementPlan.items.slice(0, 6).map((item, idx) => (
                    <tr key={idx} className="hover:bg-stone-50/60">
                      <td className="py-2.5 px-3 font-semibold text-stone-900">{item.ingredientName}</td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-stone-800">{item.packagesCount}x</td>
                      <td className="py-2.5 px-3 text-right font-mono text-stone-700">
                        {formatBaseQuantity(item.suggestedQuantity, item.baseUnit as any)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-stone-900">
                        {formatCentsToCurrency(item.totalCostInCents)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-stone-600">
                        ~{item.coverageInDays} dias
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* F18: Simulador de Prazo vs Desconto à Vista */}
          <div className="bg-white rounded-2xl border border-stone-200/80 p-6 shadow-2xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <div className="flex items-center gap-2">
                <Calculator className="w-4 h-4 text-stone-800" />
                <div>
                  <h3 className="text-sm font-bold text-stone-900">
                    F18 · Simulador de Desconto à Vista vs Boleto a Prazo
                  </h3>
                  <p className="text-xs text-stone-500 mt-0.5">
                    Compare se compensa pagar à vista ou aproveitar o prazo do fornecedor confrontando com a taxa de caixa.
                  </p>
                </div>
              </div>
              {creditCostResult && (
                <HowWeCalculatedButton
                  onClick={() =>
                    setSelectedExplanation({
                      title: 'F18 · Custo Efetivo de Prazo',
                      explanation: creditCostResult.explanation,
                    })
                  }
                />
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-stone-600 mb-1">Valor da Compra (R$)</label>
                <input
                  type="text"
                  value={simInvoiceStr}
                  onChange={(e) => setSimInvoiceStr(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-stone-300 font-mono"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-stone-600 mb-1">Desconto à Vista (%)</label>
                <input
                  type="text"
                  value={simDiscountStr}
                  onChange={(e) => setSimDiscountStr(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-stone-300 font-mono"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-stone-600 mb-1">Prazo no Boleto (Dias)</label>
                <input
                  type="text"
                  value={simDaysStr}
                  onChange={(e) => setSimDaysStr(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-stone-300 font-mono"
                />
              </div>
            </div>

            {creditCostResult && (
              <div className={`p-4 rounded-xl border flex items-center justify-between ${
                creditCostResult.isCashPaymentRecommended
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-amber-50 border-amber-200 text-amber-900'
              }`}>
                <div>
                  <div className="font-bold text-xs">
                    {creditCostResult.isCashPaymentRecommended
                      ? 'Recomendação: PAGAR À VISTA'
                      : 'Recomendação: PAGAR A PRAZO NO BOLETO'}
                  </div>
                  <p className="text-[11px] mt-0.5 opacity-90">
                    Taxa mensal embutida no prazo: <strong>{creditCostResult.implicitMonthlyInterestRatePercentage}% a.m.</strong>
                    {' '}(Economia à vista: {formatCentsToCurrency(creditCostResult.savedMonthlyAmountInCents)})
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* F19 & F20: Preços Fora da Curva e Orçamento de Compras */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* F19: Outliers */}
            <div className="bg-white rounded-2xl border border-stone-200/80 p-5 shadow-2xs space-y-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <h4 className="text-xs font-bold text-stone-900 uppercase tracking-wider">
                  F19 · Preços Fora da Curva (Detector MAD)
                </h4>
              </div>
              {outliersList.length === 0 ? (
                <div className="p-4 bg-stone-50 rounded-lg text-center text-xs text-stone-500">
                  Nenhum preço anormal detectado nas últimas compras. Seus fornecedores estão dentro da média histórica.
                </div>
              ) : (
                <div className="space-y-2">
                  {outliersList.map((out, idx) => (
                    <div key={idx} className="p-3 rounded-lg border border-rose-200 bg-rose-50/60 text-xs flex items-center justify-between">
                      <div>
                        <div className="font-bold text-rose-950">{out.ingredientName}</div>
                        <div className="text-[10px] text-rose-800">
                          Preço pago: {formatCentsToCurrency(out.paidPriceInCents)} (Mediana: {formatCentsToCurrency(out.historicalMedianPriceInCents)})
                        </div>
                      </div>
                      <div className="font-mono font-bold text-rose-700">
                        +{formatCentsToCurrency(out.excessPaidInCents)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* F20: Orçamento */}
            <div className="bg-white rounded-2xl border border-stone-200/80 p-5 shadow-2xs space-y-3">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-stone-800" />
                <h4 className="text-xs font-bold text-stone-900 uppercase tracking-wider">
                  F20 · Orçamento de Compras do Mês
                </h4>
              </div>
              <div className="space-y-2 text-xs">
                {budgetResult.categories.map((cat, idx) => (
                  <div key={idx} className="p-2.5 bg-stone-50 rounded-lg flex items-center justify-between">
                    <div>
                      <span className="font-medium text-stone-800">{cat.category}</span>
                      <div className="w-24 bg-stone-200 h-1 rounded-full mt-1 overflow-hidden">
                        <div
                          className={`h-full ${cat.isOverspendProjected ? 'bg-rose-600' : 'bg-emerald-600'}`}
                          style={{ width: `${Math.min(100, cat.burnRatePercentage)}%` }}
                        />
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono font-bold text-stone-900">{formatCentsToCurrency(cat.spentSoFarInCents)}</div>
                      <div className="text-[10px] text-stone-400">Meta: {formatCentsToCurrency(cat.monthlyBudgetInCents)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Lançar Nova Compra (Simples e Direto) */}
      <Modal
        isOpen={isPurchaseModalOpen}
        onClose={() => setIsPurchaseModalOpen(false)}
        title="Lançar Compra de Insumos"
        subtitle="Informe o que comprou, quanto pagou e o estoque será abastecido na hora."
      >
        <form onSubmit={handleSaveDirectPurchase} className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-stone-700">
                O Que Foi Comprado? (Insumo) *
              </label>
              <button
                type="button"
                onClick={() => setIsCreatingNewIngredient(!isCreatingNewIngredient)}
                className="text-[11px] text-stone-600 hover:text-stone-900 underline cursor-pointer"
              >
                {isCreatingNewIngredient ? 'Escolher da lista existente' : '+ Cadastrar novo insumo aqui'}
              </button>
            </div>

            {isCreatingNewIngredient || ingredients.length === 0 ? (
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <input
                    type="text"
                    required
                    placeholder="Nome do Insumo (ex: Queijo Mussarela, Filé Mignon)..."
                    value={newIngredientName}
                    onChange={(e) => setNewIngredientName(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-lg border border-stone-300 focus:outline-none focus:ring-1 focus:ring-stone-900"
                  />
                </div>
                <div>
                  <select
                    value={newIngredientBaseUnit}
                    onChange={(e) => setNewIngredientBaseUnit(e.target.value as BaseUnit)}
                    className="w-full text-xs px-2 py-2 rounded-lg border border-stone-300 bg-white"
                  >
                    <option value="g">Gramas (g)</option>
                    <option value="ml">Litros/ml</option>
                    <option value="un">Unidade (un)</option>
                  </select>
                </div>
              </div>
            ) : (
              <select
                required
                value={selectedIngredientId}
                onChange={(e) => setSelectedIngredientId(e.target.value)}
                className="w-full text-xs px-3 py-2.5 rounded-lg border border-stone-300 bg-white focus:outline-none focus:ring-1 focus:ring-stone-900"
              >
                <option value="">Selecione o insumo...</option>
                {ingredients.map(ing => (
                  <option key={ing.id} value={ing.id}>
                    {ing.name} ({ing.baseUnit})
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Quantidade Comprada ({isCreatingNewIngredient ? newIngredientBaseUnit : (selectedIng?.baseUnit || 'g/ml/un')}) *
              </label>
              <input
                type="number"
                required
                value={quantityPurchased}
                onChange={(e) => setQuantityPurchased(e.target.value)}
                placeholder="Ex: 5000 (para 5kg ou 5L)"
                className="w-full text-xs px-3 py-2 rounded-lg border border-stone-300 focus:outline-none focus:ring-1 focus:ring-stone-900 font-mono"
              />
              <span className="text-[10px] text-stone-400 mt-0.5 block">
                {(isCreatingNewIngredient ? newIngredientBaseUnit : selectedIng?.baseUnit) === 'g'
                  ? 'Dica: 1 kg = 1.000 g'
                  : (isCreatingNewIngredient ? newIngredientBaseUnit : selectedIng?.baseUnit) === 'ml'
                  ? 'Dica: 1 L = 1.000 ml'
                  : 'Unidades'}
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Valor Total Pago (R$) *
              </label>
              <input
                type="text"
                required
                value={totalCostStr}
                onChange={(e) => setTotalCostStr(e.target.value)}
                placeholder="Ex: 85,00"
                className="w-full text-xs px-3 py-2 rounded-lg border border-stone-300 focus:outline-none focus:ring-1 focus:ring-stone-900 font-mono font-bold text-stone-900"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Onde Comprou / Fornecedor *
              </label>
              <input
                type="text"
                required
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                placeholder="Ex: Assaí Atacadista, Ceasa, Açougue..."
                className="w-full text-xs px-3 py-2 rounded-lg border border-stone-300 focus:outline-none focus:ring-1 focus:ring-stone-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Data da Compra *
              </label>
              <input
                type="date"
                required
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-lg border border-stone-300 focus:outline-none focus:ring-1 focus:ring-stone-900 font-mono"
              />
            </div>
          </div>

          <div className="p-3 bg-stone-50 rounded-lg border border-stone-200/80 space-y-2">
            <span className="text-xs font-bold text-stone-900 block">Condição de Pagamento</span>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-xs text-stone-700 cursor-pointer">
                <input
                  type="radio"
                  name="paymentType"
                  checked={paymentType === 'PAID_NOW'}
                  onChange={() => setPaymentType('PAID_NOW')}
                  className="accent-stone-900"
                />
                <span>Já Pago (Dinheiro / PIX / Débito)</span>
              </label>
              <label className="flex items-center gap-2 text-xs text-stone-700 cursor-pointer">
                <input
                  type="radio"
                  name="paymentType"
                  checked={paymentType === 'PAY_LATER'}
                  onChange={() => setPaymentType('PAY_LATER')}
                  className="accent-stone-900"
                />
                <span>A Pagar (Boleto / Prazo)</span>
              </label>
            </div>

            {paymentType === 'PAY_LATER' && (
              <div className="pt-2">
                <label className="block text-[11px] font-medium text-stone-600 mb-1">
                  Vencimento da Fatura
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-stone-300 bg-white"
                />
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-100">
            <button
              type="button"
              onClick={() => setIsPurchaseModalOpen(false)}
              className="px-3 py-2 text-xs font-medium text-stone-700 hover:bg-stone-100 rounded-lg transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-bold text-white bg-stone-900 hover:bg-stone-800 rounded-lg transition-colors cursor-pointer shadow-xs"
            >
              Salvar Compra & Abastecer Estoque
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Como Calculamos */}
      {selectedExplanation && (
        <ExplanationModal
          isOpen={true}
          onClose={() => setSelectedExplanation(null)}
          title={selectedExplanation.title}
          explanation={selectedExplanation.explanation}
        />
      )}
    </div>
  );
};
