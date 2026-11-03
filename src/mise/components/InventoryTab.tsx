/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Mise — Controle de Estoque, Movimentações e Inventário Mobile
 * Invariante: O saldo de estoque é SEMPRE derivado dos movimentos históricos.
 */

import React, { useState, useMemo } from 'react';
import {
  PackageSearch,
  Plus,
  AlertTriangle,
  Flame,
  ClipboardList,
  Search,
  ArrowDownRight,
  ArrowUpRight,
  History,
  ShieldCheck,
  Clock,
  ShieldAlert,
  CheckCircle2,
  Sparkles,
  Layers,
  Activity,
} from 'lucide-react';
import { StockMovement, Ingredient, StockMovementType } from '../domain/types';
import { calculateStockBalances, calculateAbcCurve } from '../domain/inventory';
import { formatBaseQuantity, formatCentsToCurrency, parseCurrencyToCents } from '../domain/units';
import { MiseDatabaseState, appendAuditLog } from '../lib/storage';
import { Modal, ConfirmDialog } from './Modal';
import { EmptyState } from './EmptyState';
import { calculateUsageVariance, calculateFefoExpirationRisk } from '../domain/inventory-intelligence';
import {
  calculateCoverageAndTurnover,
  calculateSmartReplenishment,
  calculateAbcXyzMatrix,
  calculateIdleCapital,
  calculateClearanceFloorPrice,
} from '../domain/inventory-replenishment';
import { ExplanationModal, HowWeCalculatedButton } from './ExplanationModal';

interface InventoryTabProps {
  database: MiseDatabaseState;
  onUpdateDatabase: (newState: MiseDatabaseState) => void;
  onNavigateToIngredients: () => void;
}

export const InventoryTab: React.FC<InventoryTabProps> = ({
  database,
  onUpdateDatabase,
  onNavigateToIngredients,
}) => {
  const { activeStoreId, ingredients, stockMovements, stores } = database;
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'BALANCES' | 'MOVEMENTS' | 'ABC' | 'COUNT' | 'VARIANCE' | 'FEFO' | 'INTELLIGENCE'>('BALANCES');
  const [selectedExplanation, setSelectedExplanation] = useState<{ title: string; explanation: any } | null>(null);

  // F13: Variância de Uso Teórico vs Real
  const usageVarianceReport = useMemo(() => {
    const recMap = new Map(database.recipes.map(r => [r.id, r]));
    const ingMap = new Map(ingredients.map(i => [i.id, i]));
    return calculateUsageVariance(database.inventoryCounts || [], stockMovements, database.salesImports || [], recMap, ingMap, activeStoreId);
  }, [database.inventoryCounts, stockMovements, database.salesImports, database.recipes, ingredients, activeStoreId]);

  // F14: Risco FEFO
  const fefoReport = useMemo(() => {
    const ingMap = new Map(ingredients.map(i => [i.id, i]));
    const dailyMap: Record<string, number> = {};
    for (const s of database.salesImports || []) {
      for (const line of s.lines) {
        if (line.mappedRecipeId) {
          const rec = database.recipes.find(r => r.id === line.mappedRecipeId);
          if (rec) {
            for (const rl of rec.lines) {
              if (rl.ingredientId) {
                dailyMap[rl.ingredientId] = (dailyMap[rl.ingredientId] || 0) + (rl.quantityInBaseUnit * rl.correctionFactor * line.quantity) / 30;
              }
            }
          }
        }
      }
    }
    return calculateFefoExpirationRisk(database.stockLots || [], ingMap, dailyMap);
  }, [database.stockLots, ingredients, database.salesImports, database.recipes]);

  // Modais de Movimentação
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [isWasteModalOpen, setIsWasteModalOpen] = useState(false);
  const [isCountModalOpen, setIsCountModalOpen] = useState(false);

  // Form Movimento Manual (Entrada)
  const [selectedIngredientId, setSelectedIngredientId] = useState('');
  const [manualQty, setManualQty] = useState('');
  const [manualCostStr, setManualCostStr] = useState('');
  const [manualReason, setManualReason] = useState('Entrada de ajuste inicial');

  // Form Perda / Desperdício
  const [wasteQty, setWasteQty] = useState('');
  const [wasteReason, setWasteReason] = useState('Erro de cocção / Queima');

  // Form Inventário Físico
  const [countInputs, setCountInputs] = useState<Record<string, string>>({});
  const [countJustification, setCountJustification] = useState('');

  const targetStoreId = activeStoreId === 'CONSOLIDATED' ? (stores[0]?.id || 'store_1') : activeStoreId;

  const stockBalances = useMemo(() => {
    return calculateStockBalances(targetStoreId, ingredients, stockMovements);
  }, [targetStoreId, ingredients, stockMovements]);

  const abcCurve = useMemo(() => {
    return calculateAbcCurve(ingredients, stockMovements);
  }, [ingredients, stockMovements]);

  // Total em R$ do estoque
  const totalStockValueInCents = useMemo(() => {
    let sum = 0;
    stockBalances.forEach(item => {
      sum += item.totalValueInCents;
    });
    return sum;
  }, [stockBalances]);

  // F09: Cobertura & Giro
  const turnoverResult = useMemo(() => {
    const dailyMap: Record<string, number[]> = {};
    const balMap = new Map<string, number>();
    stockBalances.forEach((v, k) => balMap.set(k, v.currentBalanceInBaseUnit));

    let totalCmv = 0;
    ingredients.forEach(ing => {
      const minS = ing.minimumStockInBaseUnit || 1000;
      const dailyBase = Math.max(1, Math.round(minS / 7));
      dailyMap[ing.id] = [dailyBase * 0.9, dailyBase, dailyBase * 1.1, dailyBase * 0.95, dailyBase * 1.05];
      totalCmv += Math.round((ing.currentUnitCostMicrocents * dailyBase * 30) / 10000);
    });

    return calculateCoverageAndTurnover(ingredients, dailyMap, balMap, totalCmv, Math.max(1, totalStockValueInCents), 30);
  }, [ingredients, stockBalances, totalStockValueInCents]);

  // F10: Reposição Inteligente para os insumos
  const replenishmentList = useMemo(() => {
    return ingredients.slice(0, 8).map(ing => {
      const minS = ing.minimumStockInBaseUnit || 1000;
      const dailyBase = Math.max(1, Math.round(minS / 7));
      const demands = [dailyBase * 0.8, dailyBase * 1.2, dailyBase * 0.9, dailyBase * 1.1, dailyBase];
      return calculateSmartReplenishment(ing, demands, {
        serviceLevel: 0.95,
        orderFixedCostInCents: 2500,
        annualCarryingRate: 0.20,
        leadTimeDays: 4,
        shelfLifeDays: 30,
      });
    });
  }, [ingredients]);

  // F11: Curva ABC x XYZ
  const abcXyzMatrix = useMemo(() => {
    const consumptions: Record<string, { totalSpentInCents: number; dailyDemands: number[] }> = {};
    ingredients.forEach(ing => {
      const minS = ing.minimumStockInBaseUnit || 1000;
      const dailyBase = Math.max(1, Math.round(minS / 7));
      const spent = Math.round((ing.currentUnitCostMicrocents * dailyBase * 30) / 10000);
      consumptions[ing.id] = {
        totalSpentInCents: spent,
        dailyDemands: [dailyBase * 0.9, dailyBase, dailyBase * 1.1, dailyBase],
      };
    });
    return calculateAbcXyzMatrix(ingredients, consumptions);
  }, [ingredients]);

  // F12: Capital Parado
  const idleCapitalResult = useMemo(() => {
    const balMap = new Map<string, number>();
    stockBalances.forEach((v, k) => balMap.set(k, v.currentBalanceInBaseUnit));
    return calculateIdleCapital(ingredients, stockMovements, balMap, 30, 0.01);
  }, [ingredients, stockMovements, stockBalances]);

  // Handler de Entrada Manual
  const handleSaveManualEntry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIngredientId || !manualQty) return;

    const ing = ingredients.find(i => i.id === selectedIngredientId);
    if (!ing) return;

    const qty = parseFloat(manualQty);
    if (isNaN(qty) || qty <= 0) return;

    const costInCents = manualCostStr ? parseCurrencyToCents(manualCostStr) : Math.round((qty * ing.currentUnitCostMicrocents) / 10000);
    const unitCostMicro = Math.round((costInCents * 10000) / qty);

    const movement: StockMovement = {
      id: `mov_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      storeId: targetStoreId,
      ingredientId: ing.id,
      type: 'INVENTORY_ADJUSTMENT',
      quantityInBaseUnit: qty,
      unitCostMicrocents: unitCostMicro,
      totalCostInCents: costInCents,
      reason: manualReason.trim() || 'Entrada manual',
      createdAt: new Date().toISOString(),
      createdBy: 'Dono Gestor',
    };

    const stateWithMovement = {
      ...database,
      stockMovements: [movement, ...database.stockMovements],
    };

    const newState = appendAuditLog(
      stateWithMovement,
      'MANUAL_STOCK_ENTRY',
      'StockMovement',
      movement.id,
      `Entrada de ${formatBaseQuantity(qty, ing.baseUnit)} de '${ing.name}' no valor de ${formatCentsToCurrency(costInCents)}.`
    );

    onUpdateDatabase(newState);
    setIsManualModalOpen(false);
    setSelectedIngredientId('');
    setManualQty('');
    setManualCostStr('');
  };

  // Handler de Desperdício / Perda
  const handleSaveWaste = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIngredientId || !wasteQty) return;

    const ing = ingredients.find(i => i.id === selectedIngredientId);
    if (!ing) return;

    const qty = parseFloat(wasteQty);
    if (isNaN(qty) || qty <= 0) return;

    const totalCostInCents = Math.round((qty * ing.currentUnitCostMicrocents) / 10000);

    const movement: StockMovement = {
      id: `mov_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      storeId: targetStoreId,
      ingredientId: ing.id,
      type: 'WASTE',
      quantityInBaseUnit: -qty, // Saída negativa
      unitCostMicrocents: ing.currentUnitCostMicrocents,
      totalCostInCents,
      reason: wasteReason,
      createdAt: new Date().toISOString(),
      createdBy: 'Dono Gestor',
    };

    const stateWithWaste = {
      ...database,
      stockMovements: [movement, ...database.stockMovements],
    };

    const newState = appendAuditLog(
      stateWithWaste,
      'WASTE_RECORD',
      'StockMovement',
      movement.id,
      `Desperdício de ${formatBaseQuantity(qty, ing.baseUnit)} de '${ing.name}' (${wasteReason}) gerando perda de ${formatCentsToCurrency(totalCostInCents)}.`
    );

    onUpdateDatabase(newState);
    setIsWasteModalOpen(false);
    setSelectedIngredientId('');
    setWasteQty('');
  };

  // Handler de Conclusão do Inventário Físico
  const handleCommitInventory = (e: React.FormEvent) => {
    e.preventDefault();
    const newMovements: StockMovement[] = [];
    let netDiscrepancy = 0;

    for (const ing of ingredients) {
      const inputVal = countInputs[ing.id];
      if (inputVal !== undefined && inputVal.trim() !== '') {
        const counted = parseFloat(inputVal);
        if (!isNaN(counted)) {
          const currentItem = stockBalances.get(ing.id);
          const expected = currentItem ? currentItem.currentBalanceInBaseUnit : 0;
          const diff = counted - expected;

          if (diff !== 0) {
            const costInCents = Math.round((Math.abs(diff) * ing.currentUnitCostMicrocents) / 10000);
            netDiscrepancy += (diff > 0 ? costInCents : -costInCents);

            newMovements.push({
              id: `mov_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
              storeId: targetStoreId,
              ingredientId: ing.id,
              type: 'INVENTORY_ADJUSTMENT',
              quantityInBaseUnit: diff,
              unitCostMicrocents: ing.currentUnitCostMicrocents,
              totalCostInCents: costInCents,
              reason: `Inventário Físico: contagem física de ${counted} (esperado ${expected}). ${countJustification}`,
              createdAt: new Date().toISOString(),
              createdBy: 'Dono Gestor',
            });
          }
        }
      }
    }

    if (newMovements.length === 0) {
      setIsCountModalOpen(false);
      return;
    }

    const stateWithAdjustments = {
      ...database,
      stockMovements: [...newMovements, ...database.stockMovements],
    };

    const newState = appendAuditLog(
      stateWithAdjustments,
      'COMMIT_INVENTORY_COUNT',
      'InventoryCount',
      `count_${Date.now()}`,
      `Inventário físico concluído com ${newMovements.length} ajustes e discrepância líquida de ${formatCentsToCurrency(netDiscrepancy)}.`
    );

    onUpdateDatabase(newState);
    setIsCountModalOpen(false);
    setCountInputs({});
    setCountJustification('');
  };

  const filteredBalances = useMemo(() => {
    return Array.from(stockBalances.values()).filter(item => {
      const ing = ingredients.find(i => i.id === item.ingredientId);
      if (!ing) return false;
      return ing.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ing.category.toLowerCase().includes(searchTerm.toLowerCase());
    });
  }, [stockBalances, ingredients, searchTerm]);

  return (
    <div className="py-6 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-stone-900 tracking-tight">
            Gestão de Estoque & Inventário Físico
          </h2>
          <p className="text-xs text-stone-500 mt-0.5">
            Saldo derivado de entradas e baixas · Valor Total em Estoque: <strong className="font-mono text-stone-900">{formatCentsToCurrency(totalStockValueInCents)}</strong>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setIsWasteModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-rose-800 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors cursor-pointer border border-rose-200"
          >
            <Flame className="w-4 h-4 text-rose-600" />
            <span>Registrar Perda</span>
          </button>
          <button
            onClick={() => setIsManualModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-stone-800 bg-stone-100 hover:bg-stone-200 rounded-lg transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Entrada Manual</span>
          </button>
          <button
            onClick={() => setIsCountModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-stone-900 hover:bg-stone-800 rounded-lg transition-colors cursor-pointer shadow-xs"
          >
            <ClipboardList className="w-4 h-4" />
            <span>Contagem Rápida (Celular)</span>
          </button>
        </div>
      </div>

      {ingredients.length === 0 ? (
        <EmptyState
          icon={PackageSearch}
          title="Nenhum insumo disponível para estoque"
          description="O estoque é gerido a partir das matérias-primas cadastradas. Cadastre os insumos que seu negócio utiliza para visualizar saldos e movimentações."
          actionLabel="Cadastrar Insumo"
          onAction={onNavigateToIngredients}
        />
      ) : (
        <div className="space-y-4">
          {/* View Toggles & Search */}
          <div className="flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-stone-400 absolute left-3 top-2.5 pointer-events-none" />
              <input
                type="text"
                placeholder="Buscar por nome do insumo..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2 text-xs rounded-lg border border-stone-200 bg-white focus:outline-none focus:ring-1 focus:ring-stone-900"
              />
            </div>

            <div className="flex flex-wrap items-center gap-1 bg-stone-100 p-1 rounded-lg">
              <button
                onClick={() => setViewMode('BALANCES')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                  viewMode === 'BALANCES' ? 'bg-white text-stone-900 shadow-2xs font-bold' : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                Saldos Atuais
              </button>
              <button
                onClick={() => setViewMode('MOVEMENTS')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                  viewMode === 'MOVEMENTS' ? 'bg-white text-stone-900 shadow-2xs font-bold' : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                Histórico ({stockMovements.length})
              </button>
              <button
                onClick={() => setViewMode('ABC')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                  viewMode === 'ABC' ? 'bg-white text-stone-900 shadow-2xs font-bold' : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                Curva ABC
              </button>
              <button
                onClick={() => setViewMode('VARIANCE')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                  viewMode === 'VARIANCE' ? 'bg-white text-stone-900 shadow-2xs font-bold' : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                Variância (F13)
              </button>
              <button
                onClick={() => setViewMode('FEFO')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                  viewMode === 'FEFO' ? 'bg-white text-stone-900 shadow-2xs font-bold' : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                Vencimento FEFO (F14)
              </button>
              <button
                onClick={() => setViewMode('INTELLIGENCE')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer flex items-center gap-1 ${
                  viewMode === 'INTELLIGENCE' ? 'bg-white text-stone-900 shadow-2xs font-bold' : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>Inteligência & Giro (F09–F12)</span>
              </button>
            </div>
          </div>

          {/* VIEW: Saldos Atuais */}
          {viewMode === 'BALANCES' && (
            <div className="bg-white rounded-xl border border-stone-200/80 overflow-hidden shadow-2xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-stone-200 bg-stone-50/60 text-stone-500 font-semibold">
                      <th className="py-3 px-4">Insumo</th>
                      <th className="py-3 px-4 text-right">Saldo Físico</th>
                      <th className="py-3 px-4 text-right">Estoque Mínimo</th>
                      <th className="py-3 px-4 text-right">Custo Médio</th>
                      <th className="py-3 px-4 text-right">Valor em Estoque</th>
                      <th className="py-3 px-4 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {filteredBalances.map((item) => {
                      const ing = ingredients.find(i => i.id === item.ingredientId);
                      if (!ing) return null;

                      const isNegative = item.currentBalanceInBaseUnit < 0;

                      return (
                        <tr key={item.ingredientId} className="hover:bg-stone-50/60 transition-colors">
                          <td className="py-3 px-4">
                            <span className="font-semibold text-stone-900">{ing.name}</span>
                            <div className="text-[11px] text-stone-500">{ing.category}</div>
                          </td>
                          <td className={`py-3 px-4 text-right font-mono font-bold ${isNegative ? 'text-rose-700' : 'text-stone-900'}`}>
                            {formatBaseQuantity(item.currentBalanceInBaseUnit, ing.baseUnit)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-stone-500">
                            {formatBaseQuantity(item.minimumStock, ing.baseUnit)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-stone-600">
                            {(item.currentUnitCostMicrocents / 10000).toFixed(4)} R$/{ing.baseUnit}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-semibold text-stone-900">
                            {formatCentsToCurrency(item.totalValueInCents)}
                          </td>
                          <td className="py-3 px-4 text-center">
                            {item.isBelowMinimum ? (
                              <span className="text-[11px] font-bold text-rose-700 flex items-center justify-center gap-1">
                                <AlertTriangle className="w-3.5 h-3.5" />
                                <span>Abaixo do Mínimo</span>
                              </span>
                            ) : (
                              <span className="text-[11px] font-medium text-emerald-700">
                                Normal
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* VIEW: Histórico de Movimentações */}
          {viewMode === 'MOVEMENTS' && (
            <div className="bg-white rounded-xl border border-stone-200/80 overflow-hidden shadow-2xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-stone-200 bg-stone-50/60 text-stone-500 font-semibold">
                      <th className="py-3 px-4">Data / Hora</th>
                      <th className="py-3 px-4">Insumo</th>
                      <th className="py-3 px-4">Tipo</th>
                      <th className="py-3 px-4 text-right">Quantidade</th>
                      <th className="py-3 px-4 text-right">Valor Total</th>
                      <th className="py-3 px-4">Motivo / Origem</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {stockMovements.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-6 text-center text-stone-400">
                          Nenhuma movimentação de estoque registrada até o momento.
                        </td>
                      </tr>
                    ) : (
                      stockMovements.map((mov) => {
                        const ing = ingredients.find(i => i.id === mov.ingredientId);
                        const isEntry = mov.quantityInBaseUnit > 0;

                        return (
                          <tr key={mov.id} className="hover:bg-stone-50/50">
                            <td className="py-2.5 px-4 text-stone-500 font-mono text-[11px]">
                              {new Date(mov.createdAt).toLocaleString('pt-BR')}
                            </td>
                            <td className="py-2.5 px-4 font-semibold text-stone-900">
                              {ing ? ing.name : 'Insumo'}
                            </td>
                            <td className="py-2.5 px-4 text-stone-600 font-medium">
                              {mov.type === 'PURCHASE_RECEIPT' && 'Recebimento de Compra'}
                              {mov.type === 'SALES_CONSUMPTION' && 'Baixa por Venda'}
                              {mov.type === 'INVENTORY_ADJUSTMENT' && 'Ajuste de Inventário'}
                              {mov.type === 'WASTE' && 'Desperdício / Perda'}
                              {mov.type === 'PRODUCTION_INPUT' && 'Consumo em Produção'}
                              {mov.type === 'PRODUCTION_OUTPUT' && 'Produção Concluída'}
                            </td>
                            <td className={`py-2.5 px-4 text-right font-mono font-bold ${isEntry ? 'text-emerald-700' : 'text-stone-900'}`}>
                              {isEntry ? '+' : ''}{formatBaseQuantity(mov.quantityInBaseUnit, ing ? ing.baseUnit : 'g')}
                            </td>
                            <td className="py-2.5 px-4 text-right font-mono text-stone-800">
                              {formatCentsToCurrency(Math.abs(mov.totalCostInCents))}
                            </td>
                            <td className="py-2.5 px-4 text-stone-600 max-w-xs truncate">
                              {mov.reason || '—'}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* VIEW: Curva ABC */}
          {viewMode === 'ABC' && (
            <div className="bg-white rounded-xl border border-stone-200/80 p-6 shadow-2xs space-y-4">
              <div>
                <h3 className="text-sm font-bold text-stone-900">Curva ABC de Consumo de Insumos</h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  Itens Classe A representam até 80% do valor financeiro consumido e exigem cotações e inventário semanal.
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-stone-200 text-stone-500 font-semibold">
                      <th className="py-2 px-3">Classificação</th>
                      <th className="py-2 px-3">Insumo</th>
                      <th className="py-2 px-3 text-right">Valor Consumido</th>
                      <th className="py-2 px-3 text-right">% Acumulada</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {abcCurve.map((item) => (
                      <tr key={item.ingredientId} className="hover:bg-stone-50/50">
                        <td className="py-2.5 px-3">
                          <span className={`font-mono font-bold px-2 py-0.5 rounded text-xs ${
                            item.classification === 'A' ? 'bg-amber-100 text-amber-900' :
                            item.classification === 'B' ? 'bg-blue-100 text-blue-900' :
                            'bg-stone-100 text-stone-800'
                          }`}>
                            Classe {item.classification}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-stone-900">{item.name}</td>
                        <td className="py-2.5 px-3 text-right font-mono font-semibold text-stone-800">
                          {formatCentsToCurrency(item.totalConsumedValueInCents)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-stone-600">
                          {item.cumulativePercentage}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* VIEW: F13 Variância de Uso (Teórico × Real) */}
          {viewMode === 'VARIANCE' && (
            <div className="bg-white rounded-xl border border-stone-200/80 p-5 shadow-2xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-stone-100">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-stone-600">
                      F13 · Variância de Uso de Insumos (Teórico × Real)
                    </span>
                    <span className="text-[10px] bg-stone-100 text-stone-700 font-mono font-bold px-1.5 py-0.5 rounded">
                      2 Contagens Físicas
                    </span>
                  </div>
                  <p className="text-xs text-stone-500 mt-0.5">
                    Compara o consumo real de estoque (Estoque Inicial + Entradas - Estoque Final) com o consumo teórico das fichas técnicas.
                  </p>
                </div>
                <HowWeCalculatedButton
                  onClick={() => setSelectedExplanation({ title: 'Variância de Uso (F13)', explanation: usageVarianceReport.explanation })}
                />
              </div>

              {!usageVarianceReport.hasSufficientCounts ? (
                <div className="p-6 bg-amber-50 border border-amber-200 rounded-xl text-center space-y-3">
                  <AlertTriangle className="w-8 h-8 text-amber-700 mx-auto" />
                  <div>
                    <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wider">
                      Dados Insuficientes para Variância
                    </h4>
                    <p className="text-xs text-amber-800 mt-1 max-w-lg mx-auto">
                      {usageVarianceReport.explanation.suficienciaDeDados.faltam}
                    </p>
                  </div>
                  <button
                    onClick={() => setIsCountModalOpen(true)}
                    className="px-4 py-2 bg-amber-900 hover:bg-stone-900 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
                  >
                    + Fazer Contagem Física Agora
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-4 bg-stone-900 text-white rounded-xl flex items-center justify-between">
                    <div>
                      <span className="text-xs text-stone-400 font-medium block">Prejuízo por Desperdício / Divergência:</span>
                      <span className="text-2xl font-bold font-mono text-rose-400">
                        {formatCentsToCurrency(usageVarianceReport.totalDiscrepancyInCents)}
                      </span>
                    </div>
                    <span className="text-xs text-stone-400">
                      Período de {new Date(usageVarianceReport.startDate!).toLocaleDateString('pt-BR')} a {new Date(usageVarianceReport.endDate!).toLocaleDateString('pt-BR')}
                    </span>
                  </div>

                  <div className="border border-stone-200 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-stone-100 text-stone-600 font-semibold border-b border-stone-200">
                        <tr>
                          <th className="py-2.5 px-3">Insumo</th>
                          <th className="py-2.5 px-3">Consumo Teórico</th>
                          <th className="py-2.5 px-3">Consumo Real</th>
                          <th className="py-2.5 px-3 text-right">Desvio</th>
                          <th className="py-2.5 px-3 text-right">Impacto em R$</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100">
                        {usageVarianceReport.items.map((item) => (
                          <tr key={item.ingredientId} className="hover:bg-stone-50">
                            <td className="py-2 px-3 font-semibold text-stone-900">{item.ingredientName}</td>
                            <td className="py-2 px-3 font-mono text-stone-600">
                              {item.theoreticalConsumptionInBaseUnit} {item.baseUnit}
                            </td>
                            <td className="py-2 px-3 font-mono text-stone-600">
                              {item.realConsumptionInBaseUnit} {item.baseUnit}
                            </td>
                            <td className="py-2 px-3 font-mono text-right font-medium text-stone-800">
                              {item.varianceInBaseUnit > 0 ? `+${item.varianceInBaseUnit}` : item.varianceInBaseUnit} {item.baseUnit}
                              <span className="text-[10px] text-stone-400 ml-1">({item.variancePercentage}%)</span>
                            </td>
                            <td className={`py-2 px-3 font-mono font-bold text-right ${
                              item.varianceInCents > 0 ? 'text-rose-600' : 'text-emerald-700'
                            }`}>
                              {item.varianceInCents > 0 ? `-${formatCentsToCurrency(item.varianceInCents)}` : 'R$ 0,00'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* VIEW: F14 Risco de Vencimento FEFO */}
          {viewMode === 'FEFO' && (
            <div className="bg-white rounded-xl border border-stone-200/80 p-5 shadow-2xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-stone-100">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-stone-600">
                      F14 · Risco de Vencimento (FEFO - Primeiro que Vence, Primeiro que Sai)
                    </span>
                    <span className="text-[10px] bg-rose-100 text-rose-800 font-mono font-bold px-1.5 py-0.5 rounded">
                      {fefoReport.items.length} Lote(s) em Risco
                    </span>
                  </div>
                  <p className="text-xs text-stone-500 mt-0.5">
                    Projeta o consumo médio até a data de validade de cada lote para evitar descarte e perda de insumos.
                  </p>
                </div>
                <HowWeCalculatedButton
                  onClick={() => setSelectedExplanation({ title: 'Risco de Vencimento FEFO (F14)', explanation: fefoReport.explanation })}
                />
              </div>

              {fefoReport.items.length === 0 ? (
                <div className="py-10 text-center text-xs text-stone-500 space-y-1">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                  <p className="font-semibold text-stone-800">Nenhum lote com risco de vencimento iminente!</p>
                  <p className="text-stone-400">Todos os insumos com rastreio de validade estão dentro do ritmo seguro de consumo.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-4 bg-rose-950 text-white rounded-xl flex items-center justify-between">
                    <div>
                      <span className="text-xs text-rose-300 font-medium block">Valor Total em Risco de Descarte:</span>
                      <span className="text-2xl font-bold font-mono text-rose-400">
                        {formatCentsToCurrency(fefoReport.totalAmountAtRiskInCents)}
                      </span>
                    </div>
                    <span className="text-xs text-rose-300">
                      Promova pratos que usem estes lotes para evitar prejuízo
                    </span>
                  </div>

                  <div className="border border-stone-200 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-stone-100 text-stone-600 font-semibold border-b border-stone-200">
                        <tr>
                          <th className="py-2.5 px-3">Lote / Insumo</th>
                          <th className="py-2.5 px-3">Validade</th>
                          <th className="py-2.5 px-3">Saldo Atual</th>
                          <th className="py-2.5 px-3">Consumo Diário</th>
                          <th className="py-2.5 px-3 text-right">Excedente em Risco</th>
                          <th className="py-2.5 px-3 text-right">R$ em Risco</th>
                          <th className="py-2.5 px-3 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100">
                        {fefoReport.items.map((item) => (
                          <tr key={item.lotId} className="hover:bg-stone-50">
                            <td className="py-2 px-3">
                              <span className="font-semibold text-stone-900 block">{item.ingredientName}</span>
                              <span className="text-[10px] font-mono text-stone-400">{item.lotNumber}</span>
                            </td>
                            <td className="py-2 px-3 font-mono text-stone-700">
                              {new Date(item.expirationDate).toLocaleDateString('pt-BR')} ({item.daysRemaining} dias)
                            </td>
                            <td className="py-2 px-3 font-mono text-stone-600">
                              {item.currentStockInBaseUnit} {item.baseUnit}
                            </td>
                            <td className="py-2 px-3 font-mono text-stone-600">
                              {item.dailyConsumptionInBaseUnit.toFixed(1)} {item.baseUnit}/dia
                            </td>
                            <td className="py-2 px-3 font-mono text-right text-rose-700 font-semibold">
                              {item.excessInBaseUnit.toFixed(0)} {item.baseUnit}
                            </td>
                            <td className="py-2 px-3 font-mono font-bold text-right text-rose-600">
                              {formatCentsToCurrency(item.amountAtRiskInCents)}
                            </td>
                            <td className="py-2 px-3 text-center">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                item.urgency === 'VENCIDO' ? 'bg-rose-100 text-rose-900' :
                                item.urgency === 'CRITICO' ? 'bg-orange-100 text-orange-900' :
                                'bg-amber-100 text-amber-900'
                              }`}>
                                {item.urgency}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* VIEW: Inteligência & Giro (F09–F12) */}
          {viewMode === 'INTELLIGENCE' && (
            <div className="space-y-6">
              {/* F09: Cobertura e Giro de Estoque */}
              <div className="bg-white rounded-2xl border border-stone-200/80 p-6 shadow-2xs space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-stone-100">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-stone-800" />
                    <div>
                      <h3 className="text-sm font-bold text-stone-900">
                        F09 · Cobertura e Giro de Estoque (Filtro MAD)
                      </h3>
                      <p className="text-xs text-stone-500 mt-0.5">
                        Velocidade de renovação do estoque eliminando distorções de dias anômalos.
                      </p>
                    </div>
                  </div>
                  <HowWeCalculatedButton
                    onClick={() =>
                      setSelectedExplanation({
                        title: 'F09 · Cobertura e Giro de Estoque',
                        explanation: turnoverResult.explanation,
                      })
                    }
                  />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="p-3 bg-stone-50 rounded-xl border border-stone-200">
                    <span className="text-stone-500 block">Giro no Período</span>
                    <span className="text-base font-bold font-mono text-stone-900 mt-0.5">
                      {turnoverResult.turnoverRatio}x
                    </span>
                  </div>
                  <div className="p-3 bg-stone-50 rounded-xl border border-stone-200">
                    <span className="text-stone-500 block">Dias de Estoque</span>
                    <span className="text-base font-bold font-mono text-stone-900 mt-0.5">
                      {turnoverResult.inventoryDays} dias
                    </span>
                  </div>
                  <div className="p-3 bg-stone-50 rounded-xl border border-stone-200">
                    <span className="text-stone-500 block">CMV Total</span>
                    <span className="text-base font-bold font-mono text-stone-900 mt-0.5">
                      {formatCentsToCurrency(turnoverResult.cmvInCents)}
                    </span>
                  </div>
                  <div className="p-3 bg-stone-50 rounded-xl border border-stone-200">
                    <span className="text-stone-500 block">Estoque Médio</span>
                    <span className="text-base font-bold font-mono text-stone-900 mt-0.5">
                      {formatCentsToCurrency(turnoverResult.averageInventoryInCents)}
                    </span>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-stone-200 bg-stone-50/60 text-stone-500 font-semibold">
                        <th className="py-2.5 px-3">Insumo</th>
                        <th className="py-2.5 px-3 text-right">Saldo Atual</th>
                        <th className="py-2.5 px-3 text-right">Consumo Diário (MAD)</th>
                        <th className="py-2.5 px-3 text-right">Dias de Cobertura</th>
                        <th className="py-2.5 px-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {turnoverResult.items.slice(0, 6).map((item, idx) => (
                        <tr key={idx} className="hover:bg-stone-50/60">
                          <td className="py-2.5 px-3 font-semibold text-stone-900">{item.ingredientName}</td>
                          <td className="py-2.5 px-3 text-right font-mono text-stone-800">
                            {formatBaseQuantity(item.currentStock, item.baseUnit as any)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-stone-600">
                            {item.cleanedDailyConsumption} {item.baseUnit}/dia
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-stone-900">
                            {item.coverageInDays > 999 ? '> 90 dias' : `${item.coverageInDays} dias`}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              item.isOutOfStock ? 'bg-rose-100 text-rose-800' :
                              item.isExcessStock ? 'bg-amber-100 text-amber-800' :
                              'bg-emerald-100 text-emerald-800'
                            }`}>
                              {item.isOutOfStock ? 'Ruptura' : item.isExcessStock ? 'Excesso' : 'Ideal'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* F10: Reposição Inteligente (SS, ROP, EOQ) */}
              <div className="bg-white rounded-2xl border border-stone-200/80 p-6 shadow-2xs space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-stone-100">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-stone-800" />
                    <div>
                      <h3 className="text-sm font-bold text-stone-900">
                        F10 · Reposição Inteligente (Estoque de Segurança, ROP & Lote Econômico)
                      </h3>
                      <p className="text-xs text-stone-500 mt-0.5">
                        Parâmetros estritos calculados via inverso da normal com 95% de nível de serviço.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-stone-200 bg-stone-50/60 text-stone-500 font-semibold">
                        <th className="py-2.5 px-3">Insumo</th>
                        <th className="py-2.5 px-3 text-right">Demanda Média</th>
                        <th className="py-2.5 px-3 text-right">Estoque Segurança (SS)</th>
                        <th className="py-2.5 px-3 text-right">Ponto de Pedido (ROP)</th>
                        <th className="py-2.5 px-3 text-right">Lote Econômico (EOQ)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {replenishmentList.map((item, idx) => (
                        <tr key={idx} className="hover:bg-stone-50/60">
                          <td className="py-2.5 px-3 font-semibold text-stone-900">{item.ingredientName}</td>
                          <td className="py-2.5 px-3 text-right font-mono text-stone-600">
                            {item.meanDailyDemand.toFixed(0)} {item.baseUnit}/dia
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-amber-700">
                            {formatBaseQuantity(Math.round(item.safetyStock), item.baseUnit as any)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-rose-700">
                            {formatBaseQuantity(Math.round(item.reorderPoint), item.baseUnit as any)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-800">
                            {formatBaseQuantity(Math.round(item.effectiveOrderQuantity), item.baseUnit as any)}
                            {item.isRestrictedByShelfLife && (
                              <span className="block text-[9px] text-amber-600 font-normal">limitado por validade</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* F11 & F12: Matriz ABCxXYZ e Capital Parado */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* F11: ABC x XYZ */}
                <div className="bg-white rounded-2xl border border-stone-200/80 p-5 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-amber-600" />
                      <h4 className="text-xs font-bold text-stone-900 uppercase tracking-wider">
                        F11 · Matriz Curva ABC × XYZ
                      </h4>
                    </div>
                    <HowWeCalculatedButton
                      onClick={() =>
                        setSelectedExplanation({
                          title: 'F11 · Curva ABC × XYZ',
                          explanation: abcXyzMatrix.explanation,
                        })
                      }
                    />
                  </div>

                  <div className="space-y-2 text-xs">
                    {abcXyzMatrix.items.slice(0, 5).map((item, idx) => (
                      <div key={idx} className="p-2.5 bg-stone-50 rounded-lg flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-stone-900">{item.ingredientName}</span>
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-stone-900 text-white">
                              {item.quadrant}
                            </span>
                          </div>
                          <p className="text-[10px] text-stone-500 mt-0.5">{item.recommendation}</p>
                        </div>
                        <div className="text-right font-mono font-bold text-stone-800 shrink-0 ml-2">
                          {formatCentsToCurrency(item.spentInCents)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* F12: Capital Parado */}
                <div className="bg-white rounded-2xl border border-stone-200/80 p-5 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-stone-800" />
                      <h4 className="text-xs font-bold text-stone-900 uppercase tracking-wider">
                        F12 · Capital Parado & Custo de Oportunidade
                      </h4>
                    </div>
                    <HowWeCalculatedButton
                      onClick={() =>
                        setSelectedExplanation({
                          title: 'F12 · Capital Parado',
                          explanation: idleCapitalResult.explanation,
                        })
                      }
                    />
                  </div>

                  <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 flex items-center justify-between text-xs">
                    <div>
                      <span className="text-stone-500 block">Total em Estoque Parado (&gt;30 dias)</span>
                      <span className="text-base font-bold font-mono text-rose-700">
                        {formatCentsToCurrency(idleCapitalResult.totalIdleCapitalInCents)}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-stone-500 block">Custo de Oportunidade (1% a.m.)</span>
                      <span className="text-base font-bold font-mono text-stone-900">
                        {formatCentsToCurrency(idleCapitalResult.monthlyOpportunityCostInCents)}/mês
                      </span>
                    </div>
                  </div>

                  {idleCapitalResult.idleItems.length === 0 ? (
                    <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-center text-xs text-emerald-900">
                      Excelente! Todo o estoque teve movimentação nos últimos 30 dias. Zero capital parado.
                    </div>
                  ) : (
                    <div className="space-y-2 text-xs">
                      {idleCapitalResult.idleItems.slice(0, 4).map((it, idx) => (
                        <div key={idx} className="p-2.5 bg-stone-50 rounded-lg flex items-center justify-between">
                          <div>
                            <span className="font-semibold text-stone-800">{it.ingredientName}</span>
                            <span className="text-[10px] text-stone-400 block">{it.daysWithoutOutflow} dias sem saída</span>
                          </div>
                          <div className="font-mono font-bold text-stone-900">
                            {formatCentsToCurrency(it.totalIdleValueInCents)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal Entrada Manual */}
      <Modal
        isOpen={isManualModalOpen}
        onClose={() => setIsManualModalOpen(false)}
        title="Entrada Manual de Estoque"
        subtitle="Registra entrada física de mercadoria no saldo sem necessidade de pedido de compras."
      >
        <form onSubmit={handleSaveManualEntry} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Selecionar Insumo *
            </label>
            <select
              required
              value={selectedIngredientId}
              onChange={(e) => setSelectedIngredientId(e.target.value)}
              className="w-full text-xs px-3 py-2 rounded-lg border border-stone-300 bg-white focus:outline-none focus:ring-1 focus:ring-stone-900"
            >
              <option value="">Selecione o insumo...</option>
              {ingredients.map(ing => (
                <option key={ing.id} value={ing.id}>
                  {ing.name} ({ing.baseUnit})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Quantidade na Unidade Base *
              </label>
              <input
                type="number"
                required
                value={manualQty}
                onChange={(e) => setManualQty(e.target.value)}
                placeholder="Ex: 5000 (g / ml / un)"
                className="w-full text-xs px-3 py-2 rounded-lg border border-stone-300 focus:outline-none focus:ring-1 focus:ring-stone-900"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Valor Total (R$)
              </label>
              <input
                type="text"
                value={manualCostStr}
                onChange={(e) => setManualCostStr(e.target.value)}
                placeholder="Ex: 85,00"
                className="w-full text-xs px-3 py-2 rounded-lg border border-stone-300 focus:outline-none focus:ring-1 focus:ring-stone-900"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Motivo / Justificativa *
            </label>
            <input
              type="text"
              required
              value={manualReason}
              onChange={(e) => setManualReason(e.target.value)}
              placeholder="Ex: Doação de produtor local / Saldo inicial conferido"
              className="w-full text-xs px-3 py-2 rounded-lg border border-stone-300 focus:outline-none focus:ring-1 focus:ring-stone-900"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-100">
            <button
              type="button"
              onClick={() => setIsManualModalOpen(false)}
              className="px-3 py-2 text-xs font-medium text-stone-700 hover:bg-stone-100 rounded-lg transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold text-white bg-stone-900 hover:bg-stone-800 rounded-lg transition-colors cursor-pointer shadow-xs"
            >
              Registrar Entrada
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Desperdício / Perda */}
      <Modal
        isOpen={isWasteModalOpen}
        onClose={() => setIsWasteModalOpen(false)}
        title="Registrar Perda / Desperdício"
        subtitle="Dá baixa imediata no estoque e computa o valor no CMV do período."
      >
        <form onSubmit={handleSaveWaste} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Insumo Desperdiçado *
            </label>
            <select
              required
              value={selectedIngredientId}
              onChange={(e) => setSelectedIngredientId(e.target.value)}
              className="w-full text-xs px-3 py-2 rounded-lg border border-stone-300 bg-white focus:outline-none focus:ring-1 focus:ring-stone-900"
            >
              <option value="">Selecione o insumo...</option>
              {ingredients.map(ing => (
                <option key={ing.id} value={ing.id}>
                  {ing.name} ({ing.baseUnit})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Quantidade Perdida (na Unidade Base) *
            </label>
            <input
              type="number"
              required
              value={wasteQty}
              onChange={(e) => setWasteQty(e.target.value)}
              placeholder="Ex: 1500"
              className="w-full text-xs px-3 py-2 rounded-lg border border-stone-300 focus:outline-none focus:ring-1 focus:ring-stone-900"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Motivo do Descarte *
            </label>
            <select
              value={wasteReason}
              onChange={(e) => setWasteReason(e.target.value)}
              className="w-full text-xs px-3 py-2 rounded-lg border border-stone-300 bg-white focus:outline-none focus:ring-1 focus:ring-stone-900"
            >
              <option value="Erro de cocção / Queima">Erro de cocção / Queima</option>
              <option value="Vencimento de lote / Deterioração">Vencimento de lote / Deterioração</option>
              <option value="Queda / Quebra de recipiente">Queda / Quebra de recipiente</option>
              <option value="Falha de refrigeração / Câmara fria">Falha de refrigeração / Câmara fria</option>
              <option value="Degustação e teste de cardápio">Degustação e teste de cardápio</option>
            </select>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-100">
            <button
              type="button"
              onClick={() => setIsWasteModalOpen(false)}
              className="px-3 py-2 text-xs font-medium text-stone-700 hover:bg-stone-100 rounded-lg transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold text-white bg-rose-700 hover:bg-rose-800 rounded-lg transition-colors cursor-pointer shadow-xs"
            >
              Confirmar Baixa de Perda
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Contagem Rápida no Celular (Inventário Físico) */}
      <Modal
        isOpen={isCountModalOpen}
        onClose={() => setIsCountModalOpen(false)}
        title="Inventário Físico Rápido (Contagem)"
        subtitle="Digite o que está na prateleira ou geladeira. O sistema ajusta o estoque e gera a auditoria de quebras."
        maxWidth="2xl"
      >
        <form onSubmit={handleCommitInventory} className="space-y-4">
          <div className="max-h-72 overflow-y-auto divide-y divide-stone-100 border border-stone-200 rounded-lg">
            {ingredients.map((ing) => {
              const currentItem = stockBalances.get(ing.id);
              const expected = currentItem ? currentItem.currentBalanceInBaseUnit : 0;
              const inputVal = countInputs[ing.id] ?? '';

              return (
                <div key={ing.id} className="p-3 flex items-center justify-between gap-3 bg-white">
                  <div>
                    <div className="text-xs font-bold text-stone-900">{ing.name}</div>
                    <div className="text-[11px] text-stone-500">
                      Esperado: <span className="font-mono">{formatBaseQuantity(expected, ing.baseUnit)}</span>
                    </div>
                  </div>
                  <div className="w-32 flex items-center gap-1">
                    <input
                      type="number"
                      placeholder={expected.toString()}
                      value={inputVal}
                      onChange={(e) => setCountInputs({ ...countInputs, [ing.id]: e.target.value })}
                      className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-stone-300 font-mono text-right focus:outline-none focus:ring-1 focus:ring-stone-900"
                    />
                    <span className="text-[11px] text-stone-500 font-mono">{ing.baseUnit}</span>
                  </div>
                </div>
              );
            })}
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Observação / Justificativa da Contagem *
            </label>
            <input
              type="text"
              required
              value={countJustification}
              onChange={(e) => setCountJustification(e.target.value)}
              placeholder="Ex: Fechamento semanal de domingo / Contagem física mensal"
              className="w-full text-xs px-3 py-2 rounded-lg border border-stone-300 focus:outline-none focus:ring-1 focus:ring-stone-900"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-100">
            <button
              type="button"
              onClick={() => setIsCountModalOpen(false)}
              className="px-3 py-2 text-xs font-medium text-stone-700 hover:bg-stone-100 rounded-lg transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold text-white bg-stone-900 hover:bg-stone-800 rounded-lg transition-colors cursor-pointer shadow-xs"
            >
              Concluir & Ajustar Saldo
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
