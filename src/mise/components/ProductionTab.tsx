/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Mise — Produção, Lotes e Rastreabilidade de Validade
 * Invariante: Consome matérias-primas e dá entrada no produto intermediário no estoque.
 */

import React, { useState } from 'react';
import { Factory, Plus, CheckCircle2, Clock, Calendar, Tag, Printer } from 'lucide-react';
import { ProductionOrder, Recipe, Ingredient } from '../domain/types';
import { formatBaseQuantity, formatCentsToCurrency } from '../domain/units';
import { MiseDatabaseState, appendAuditLog } from '../lib/storage';
import { Modal } from './Modal';
import { EmptyState } from './EmptyState';

interface ProductionTabProps {
  database: MiseDatabaseState;
  onUpdateDatabase: (newState: MiseDatabaseState) => void;
  onNavigateToRecipes: () => void;
}

export const ProductionTab: React.FC<ProductionTabProps> = ({
  database,
  onUpdateDatabase,
  onNavigateToRecipes,
}) => {
  const { activeStoreId, stores, productionOrders, recipes, ingredients, stockMovements } = database;
  const targetStoreId = activeStoreId === 'CONSOLIDATED' ? (stores[0]?.id || 'store_1') : activeStoreId;

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSubRecipeId, setSelectedSubRecipeId] = useState('');
  const [plannedQty, setPlannedQty] = useState('5000'); // 5kg
  const [notes, setNotes] = useState('');

  // Sub-receitas cadastradas
  const subRecipes = recipes.filter(r => r.isSubRecipe || r.category.toLowerCase().includes('base') || r.category.toLowerCase().includes('molho'));

  const handleCreateProduction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSubRecipeId) return;

    const sub = recipes.find(r => r.id === selectedSubRecipeId);
    if (!sub) return;

    const qty = parseFloat(plannedQty) || 1000;
    const now = new Date().toISOString();

    const newOrder: ProductionOrder = {
      id: `prod_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      storeId: targetStoreId,
      subRecipeId: sub.id,
      subRecipeName: sub.name,
      plannedQuantity: qty,
      actualYieldQuantity: qty,
      unit: sub.yieldBaseUnit || 'g',
      status: 'COMPLETED',
      date: now.split('T')[0],
      notes: notes.trim() || undefined,
    };

    // Baixar insumos proporcionais
    const newMovements = [...stockMovements];
    const multiplier = qty / (sub.yieldInBaseUnit || 1000);

    for (const line of sub.lines) {
      if (line.ingredientId) {
        const ing = ingredients.find(i => i.id === line.ingredientId);
        const grossQty = line.quantityInBaseUnit * (line.correctionFactor || 1) * multiplier;
        const costInCents = ing ? Math.round((grossQty * ing.currentUnitCostMicrocents) / 10000) : 0;

        newMovements.unshift({
          id: `mov_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          storeId: targetStoreId,
          ingredientId: line.ingredientId,
          type: 'PRODUCTION_INPUT',
          quantityInBaseUnit: -grossQty,
          unitCostMicrocents: ing?.currentUnitCostMicrocents || 0,
          totalCostInCents: costInCents,
          reason: `Consumo para lote de ${sub.name}`,
          createdAt: now,
          createdBy: 'Dono Gestor',
        });
      }
    }

    const stateWithProd = {
      ...database,
      productionOrders: [newOrder, ...database.productionOrders],
      stockMovements: newMovements,
    };

    const newState = appendAuditLog(
      stateWithProd,
      'CREATE_PRODUCTION_BATCH',
      'ProductionOrder',
      newOrder.id,
      `Ordem de produção de ${formatBaseQuantity(qty, sub.yieldBaseUnit || 'g')} de '${sub.name}' concluída com baixa automática de matérias-primas.`
    );

    onUpdateDatabase(newState);
    setIsModalOpen(false);
    setSelectedSubRecipeId('');
    setNotes('');
  };

  const filteredOrders = productionOrders.filter(
    p => activeStoreId === 'CONSOLIDATED' || p.storeId === activeStoreId
  );

  return (
    <div className="py-6 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-stone-900 tracking-tight">
            Produção, Lotes & Pré-Preparo
          </h2>
          <p className="text-xs text-stone-500 mt-0.5">
            Lançamento de produção de bases, molhos artesanais e massas com consumo automático de insumos.
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-stone-900 hover:bg-stone-800 rounded-lg transition-colors cursor-pointer shadow-xs"
        >
          <Plus className="w-4 h-4" />
          <span>Registrar Batelada / Produção</span>
        </button>
      </div>

      {productionOrders.length === 0 ? (
        <EmptyState
          icon={Factory}
          title="Nenhuma ordem de produção registrada"
          description="Se você prepara insumos intermediários na casa (ex: 20kg de molho de tomate ou 15kg de massa de esfiha), lance aqui a produção para consumir os insumos crus e registrar a validade do lote."
          actionLabel={recipes.length === 0 ? 'Criar Ficha de Sub-receita' : 'Registrar Primeira Produção'}
          onAction={recipes.length === 0 ? onNavigateToRecipes : () => setIsModalOpen(true)}
        />
      ) : (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-stone-200/80 overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-stone-200 bg-stone-50/60 text-stone-500 font-semibold">
                    <th className="py-3 px-4">Lote / Data</th>
                    <th className="py-3 px-4">Sub-receita Produzida</th>
                    <th className="py-3 px-4 text-right">Rendimento Real</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4">Observações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {filteredOrders.map((prod) => (
                    <tr key={prod.id} className="hover:bg-stone-50/60 transition-colors">
                      <td className="py-3 px-4 font-mono">
                        <span className="font-bold text-stone-900">#{prod.id.slice(-6)}</span>
                        <div className="text-[11px] text-stone-500">{prod.date}</div>
                      </td>
                      <td className="py-3 px-4 font-semibold text-stone-900">
                        {prod.subRecipeName}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-stone-900">
                        {formatBaseQuantity(prod.actualYieldQuantity, prod.unit)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="text-[11px] font-bold text-emerald-700 flex items-center justify-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Concluída</span>
                        </span>
                      </td>
                      <td className="py-3 px-4 text-stone-600 max-w-xs truncate">
                        {prod.notes || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal Registrar Produção */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Registrar Lote de Produção"
        subtitle="O sistema dará baixa nos insumos que compõem a receita proporcionalmente ao rendimento."
      >
        <form onSubmit={handleCreateProduction} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Selecionar Receita / Base *
            </label>
            <select
              required
              value={selectedSubRecipeId}
              onChange={(e) => setSelectedSubRecipeId(e.target.value)}
              className="w-full text-xs px-3 py-2 rounded-lg border border-stone-300 bg-white focus:outline-none focus:ring-1 focus:ring-stone-900"
            >
              <option value="">Selecione...</option>
              {recipes.map(r => (
                <option key={r.id} value={r.id}>
                  {r.name} {r.isSubRecipe ? '(Sub-receita)' : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Quantidade Produzida (em gramas ou ml) *
            </label>
            <input
              type="number"
              required
              value={plannedQty}
              onChange={(e) => setPlannedQty(e.target.value)}
              placeholder="Ex: 10000 (10 kg de molho)"
              className="w-full text-xs px-3 py-2 rounded-lg border border-stone-300 focus:outline-none focus:ring-1 focus:ring-stone-900 font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Observações / Identificação do Lote
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: Lote da manhã, validade 5 dias em câmara fria"
              className="w-full text-xs px-3 py-2 rounded-lg border border-stone-300 focus:outline-none focus:ring-1 focus:ring-stone-900"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-100">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-3 py-2 text-xs font-medium text-stone-700 hover:bg-stone-100 rounded-lg transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold text-white bg-stone-900 hover:bg-stone-800 rounded-lg transition-colors cursor-pointer shadow-xs"
            >
              Concluir & Baixar Insumos
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
