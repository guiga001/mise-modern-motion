/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Mise — Fichas Técnicas, CMV Real e Simulador de Margem
 * Invariante: Cálculo em tempo real de CMV com fator de correção e rendimento de porções.
 */

import React, { useState, useMemo } from 'react';
import {
  UtensilsCrossed,
  Plus,
  Search,
  ArrowRight,
  TrendingUp,
  Percent,
  Sparkles,
  Trash2,
  Edit3,
  Layers,
  Info,
} from 'lucide-react';
import { Recipe, RecipeLine, Ingredient, BaseUnit } from '../domain/types';
import { calculateRecipeCost, roundToCommercialCents } from '../domain/recipe';
import { formatBaseQuantity, formatCentsToCurrency, parseCurrencyToCents } from '../domain/units';
import { MiseDatabaseState, appendAuditLog } from '../lib/storage';
import { Modal } from './Modal';
import { EmptyState } from './EmptyState';

interface RecipesTabProps {
  database: MiseDatabaseState;
  onUpdateDatabase: (newState: MiseDatabaseState) => void;
  onNavigateToIngredients: () => void;
}

export const RecipesTab: React.FC<RecipesTabProps> = ({
  database,
  onUpdateDatabase,
  onNavigateToIngredients,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Pratos Principais');
  const [isSubRecipe, setIsSubRecipe] = useState(false);
  const [yieldPortions, setYieldPortions] = useState('1');
  const [yieldInBaseUnit, setYieldInBaseUnit] = useState('1000');
  const [yieldBaseUnit, setYieldBaseUnit] = useState<BaseUnit>('g');
  const [salePriceStr, setSalePriceStr] = useState('45,00');
  const [targetMargin, setTargetMargin] = useState('70');
  const [lines, setLines] = useState<RecipeLine[]>([]);

  // Linha em adição
  const [selectedIngredientId, setSelectedIngredientId] = useState('');
  const [lineQty, setLineQty] = useState('');
  const [lineCorrectionFactor, setLineCorrectionFactor] = useState('1.0');

  const ingredientsMap = useMemo(() => new Map(database.ingredients.map(i => [i.id, i])), [database.ingredients]);
  const recipesMap = useMemo(() => new Map(database.recipes.map(r => [r.id, r])), [database.recipes]);

  const costsMap = useMemo(() => {
    const map = new Map();
    database.recipes.forEach(r => {
      try {
        map.set(r.id, calculateRecipeCost(r, ingredientsMap, recipesMap));
      } catch (e) {
        // Ignora
      }
    });
    return map;
  }, [database.recipes, ingredientsMap, recipesMap]);

  const openCreateModal = () => {
    setEditingRecipe(null);
    setName('');
    setCategory('Pratos Principais');
    setIsSubRecipe(false);
    setYieldPortions('1');
    setYieldInBaseUnit('1000');
    setYieldBaseUnit('g');
    setSalePriceStr('45,00');
    setTargetMargin('70');
    setLines([]);
    setIsModalOpen(true);
  };

  const openEditModal = (rec: Recipe) => {
    setEditingRecipe(rec);
    setName(rec.name);
    setCategory(rec.category);
    setIsSubRecipe(rec.isSubRecipe);
    setYieldPortions(rec.yieldPortions.toString());
    setYieldInBaseUnit((rec.yieldInBaseUnit || 1000).toString());
    setYieldBaseUnit(rec.yieldBaseUnit || 'g');
    setSalePriceStr((rec.salePriceInCents / 100).toFixed(2).replace('.', ','));
    setTargetMargin(rec.targetMarginPercentage.toString());
    setLines([...rec.lines]);
    setIsModalOpen(true);
  };

  const handleAddLine = () => {
    if (!selectedIngredientId || !lineQty) return;
    const qty = parseFloat(lineQty);
    if (isNaN(qty) || qty <= 0) return;

    const cf = parseFloat(lineCorrectionFactor) || 1.0;

    const newLine: RecipeLine = {
      id: `line_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
      ingredientId: selectedIngredientId,
      quantityInBaseUnit: qty,
      correctionFactor: cf,
    };

    setLines([...lines, newLine]);
    setSelectedIngredientId('');
    setLineQty('');
    setLineCorrectionFactor('1.0');
  };

  const handleRemoveLine = (lineId: string) => {
    setLines(lines.filter(l => l.id !== lineId));
  };

  const handleSaveRecipe = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const salePriceInCents = parseCurrencyToCents(salePriceStr);
    const targetMarginPercentage = parseFloat(targetMargin) || 70;
    const yieldCount = Math.max(1, parseInt(yieldPortions) || 1);

    const now = new Date().toISOString();

    let updatedRecipes: Recipe[];
    let action = '';

    if (editingRecipe) {
      action = 'EDIT_RECIPE';
      updatedRecipes = database.recipes.map(r => {
        if (r.id === editingRecipe.id) {
          return {
            ...r,
            name: name.trim(),
            category: category.trim(),
            isSubRecipe,
            yieldPortions: yieldCount,
            yieldInBaseUnit: isSubRecipe ? parseFloat(yieldInBaseUnit) || 1000 : undefined,
            yieldBaseUnit: isSubRecipe ? yieldBaseUnit : undefined,
            salePriceInCents,
            targetMarginPercentage,
            lines,
            updatedAt: now,
          };
        }
        return r;
      });
    } else {
      action = 'CREATE_RECIPE';
      const newRecipe: Recipe = {
        id: `rec_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        name: name.trim(),
        category: category.trim(),
        isSubRecipe,
        yieldPortions: yieldCount,
        yieldInBaseUnit: isSubRecipe ? parseFloat(yieldInBaseUnit) || 1000 : undefined,
        yieldBaseUnit: isSubRecipe ? yieldBaseUnit : undefined,
        salePriceInCents,
        targetMarginPercentage,
        lines,
        createdAt: now,
        updatedAt: now,
      };
      updatedRecipes = [...database.recipes, newRecipe];
    }

    const stateWithRecipes = {
      ...database,
      recipes: updatedRecipes,
    };

    const newState = appendAuditLog(
      stateWithRecipes,
      action,
      'Recipe',
      editingRecipe ? editingRecipe.id : 'NEW',
      `Ficha técnica '${name}' salva com ${lines.length} itens e preço de venda ${formatCentsToCurrency(salePriceInCents)}.`
    );

    onUpdateDatabase(newState);
    setIsModalOpen(false);
  };

  const filteredRecipes = database.recipes.filter(r => {
    const matchesSearch = r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.category.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCat = filterCategory === 'ALL' || r.category === filterCategory;
    return matchesSearch && matchesCat;
  });

  // Cálculo prévio temporário para o modal
  const previewCost = useMemo(() => {
    const tempRecipe: Recipe = {
      id: 'temp',
      name: name || 'Prévia',
      category,
      isSubRecipe,
      yieldPortions: parseInt(yieldPortions) || 1,
      salePriceInCents: parseCurrencyToCents(salePriceStr),
      targetMarginPercentage: parseFloat(targetMargin) || 70,
      lines,
      createdAt: '',
      updatedAt: '',
    };
    try {
      return calculateRecipeCost(tempRecipe, ingredientsMap, recipesMap);
    } catch {
      return null;
    }
  }, [name, category, isSubRecipe, yieldPortions, salePriceStr, targetMargin, lines, ingredientsMap, recipesMap]);

  return (
    <div className="py-6 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-stone-900 tracking-tight">
            Fichas Técnicas & Engenharia de Cardápio
          </h2>
          <p className="text-xs text-stone-500 mt-0.5">
            Custo real por porção, fator de correção e sugestão de preço baseada na margem alvo.
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-stone-900 hover:bg-stone-800 rounded-lg transition-colors cursor-pointer shadow-xs"
        >
          <Plus className="w-4 h-4" />
          <span>Nova Ficha Técnica</span>
        </button>
      </div>

      {database.recipes.length === 0 ? (
        <EmptyState
          icon={UtensilsCrossed}
          title="Nenhuma ficha técnica cadastrada"
          description="A ficha técnica é o coração do Mise. Ela define os ingredientes de cada prato, permitindo calcular o CMV real, a margem de lucro e dar baixa automática no estoque a cada venda importada."
          actionLabel={database.ingredients.length === 0 ? 'Cadastrar Insumos Primeiro' : 'Criar Primeira Ficha Técnica'}
          onAction={database.ingredients.length === 0 ? onNavigateToIngredients : openCreateModal}
        />
      ) : (
        <div className="space-y-4">
          {/* Search bar */}
          <div className="relative">
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-2.5 pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar ficha técnica por nome ou categoria..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3.5 py-2 text-xs rounded-lg border border-stone-200 bg-white focus:outline-none focus:ring-1 focus:ring-stone-900"
            />
          </div>

          {/* Grid of recipe cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredRecipes.map((recipe) => {
              const breakdown = costsMap.get(recipe.id);
              const portionCost = breakdown ? breakdown.portionCostInCents : 0;
              const cmvPct = breakdown ? breakdown.cmvPercentage : 0;
              const marginPct = breakdown ? breakdown.grossMarginPercentage : 0;
              const suggested = breakdown ? breakdown.suggestedSalePriceInCents : 0;

              return (
                <div
                  key={recipe.id}
                  className="bg-white rounded-xl border border-stone-200/80 p-5 flex flex-col justify-between hover:border-stone-300 transition-colors shadow-2xs"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-[11px] font-medium text-stone-500">
                          {recipe.category} {recipe.isSubRecipe ? '· Sub-receita' : ''}
                        </span>
                        <h3 className="text-sm font-bold text-stone-900 mt-0.5">{recipe.name}</h3>
                      </div>
                      <button
                        onClick={() => openEditModal(recipe)}
                        className="p-1.5 text-stone-400 hover:text-stone-900 hover:bg-stone-100 rounded-md transition-colors cursor-pointer"
                        title="Editar ficha técnica"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Preço de venda e CMV */}
                    <div className="mt-4 pt-3 border-t border-stone-100 grid grid-cols-2 gap-3">
                      <div>
                        <span className="text-[10px] text-stone-500">Preço de Venda</span>
                        <div className="text-sm font-bold text-stone-900 font-mono">
                          {formatCentsToCurrency(recipe.salePriceInCents)}
                        </div>
                      </div>
                      <div>
                        <span className="text-[10px] text-stone-500">Custo da Porção (CMV)</span>
                        <div className="text-sm font-bold text-stone-800 font-mono">
                          {formatCentsToCurrency(portionCost)}
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-between text-xs py-1.5 px-2.5 rounded-lg bg-stone-50 border border-stone-100">
                      <span className="text-stone-600">CMV Teórico:</span>
                      <span className={`font-mono font-bold ${cmvPct <= 32 ? 'text-emerald-700' : 'text-rose-700'}`}>
                        {cmvPct.toFixed(1)}%
                      </span>
                    </div>

                    {/* Preço Sugerido */}
                    <div className="mt-2 text-[11px] text-stone-500 flex items-center justify-between">
                      <span>Preço Sugerido ({recipe.targetMarginPercentage}% margem):</span>
                      <span className="font-mono font-semibold text-stone-900">
                        {formatCentsToCurrency(suggested)}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-stone-100 text-[11px] text-stone-500 flex items-center justify-between">
                    <span>{recipe.lines.length} ingrediente(s)</span>
                    <span>Rende {recipe.yieldPortions} {recipe.yieldPortions === 1 ? 'porção' : 'porções'}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modal Ficha Técnica */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingRecipe ? 'Editar Ficha Técnica' : 'Nova Ficha Técnica'}
        subtitle="Adicione matérias-primas e acompanhe o custo da porção em tempo real."
        maxWidth="2xl"
      >
        <form onSubmit={handleSaveRecipe} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Nome do Prato / Receita *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Pizza Margherita 35cm"
                className="w-full text-xs px-3 py-2 rounded-lg border border-stone-300 focus:outline-none focus:ring-1 focus:ring-stone-900"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Categoria no Cardápio
              </label>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Ex: Pizzas, Massas, Sobremesas"
                className="w-full text-xs px-3 py-2 rounded-lg border border-stone-300 focus:outline-none focus:ring-1 focus:ring-stone-900"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Rendimento (Porções)
              </label>
              <input
                type="number"
                min="1"
                value={yieldPortions}
                onChange={(e) => setYieldPortions(e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-lg border border-stone-300 focus:outline-none focus:ring-1 focus:ring-stone-900"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Preço de Venda (R$)
              </label>
              <input
                type="text"
                value={salePriceStr}
                onChange={(e) => setSalePriceStr(e.target.value)}
                placeholder="Ex: 48,00"
                className="w-full text-xs px-3 py-2 rounded-lg border border-stone-300 focus:outline-none focus:ring-1 focus:ring-stone-900 font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Margem Alvo (%)
              </label>
              <input
                type="number"
                min="1"
                max="95"
                value={targetMargin}
                onChange={(e) => setTargetMargin(e.target.value)}
                placeholder="70"
                className="w-full text-xs px-3 py-2 rounded-lg border border-stone-300 focus:outline-none focus:ring-1 focus:ring-stone-900"
              />
            </div>
          </div>

          {/* Adicionar Ingrediente na Ficha */}
          <div className="p-3 bg-stone-50 rounded-xl border border-stone-200/80 space-y-3">
            <span className="text-xs font-bold text-stone-900">Adicionar Insumo à Receita</span>

            {database.ingredients.length === 0 ? (
              <p className="text-xs text-amber-800">
                Você ainda não tem insumos cadastrados. Cadastre insumos primeiro na aba "Insumos".
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-end">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-medium text-stone-600 mb-1">
                    Selecionar Matéria-Prima
                  </label>
                  <select
                    value={selectedIngredientId}
                    onChange={(e) => setSelectedIngredientId(e.target.value)}
                    className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-stone-300 bg-white focus:outline-none focus:ring-1 focus:ring-stone-900"
                  >
                    <option value="">Selecione um insumo...</option>
                    {database.ingredients.map((ing) => (
                      <option key={ing.id} value={ing.id}>
                        {ing.name} ({ing.baseUnit})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-stone-600 mb-1">
                    Qtd Líquida
                  </label>
                  <input
                    type="number"
                    value={lineQty}
                    onChange={(e) => setLineQty(e.target.value)}
                    placeholder="Ex: 350"
                    className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-stone-300 bg-white focus:outline-none focus:ring-1 focus:ring-stone-900"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-stone-600 mb-1" title="Fator de Correção (>= 1.0 para perdas de descasque/limpeza)">
                    Fator Correção
                  </label>
                  <div className="flex gap-1">
                    <input
                      type="number"
                      step="0.05"
                      min="1.0"
                      value={lineCorrectionFactor}
                      onChange={(e) => setLineCorrectionFactor(e.target.value)}
                      placeholder="1.0"
                      className="w-full text-xs px-2 py-1.5 rounded-lg border border-stone-300 bg-white focus:outline-none focus:ring-1 focus:ring-stone-900"
                    />
                    <button
                      type="button"
                      onClick={handleAddLine}
                      disabled={!selectedIngredientId || !lineQty}
                      className="px-3 py-1.5 text-xs font-semibold text-white bg-stone-900 hover:bg-stone-800 disabled:opacity-50 rounded-lg cursor-pointer"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Tabela de Linhas da Ficha */}
          <div className="border border-stone-200 rounded-lg overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-stone-200 bg-stone-50 text-stone-500 font-semibold">
                  <th className="py-2 px-3">Ingrediente</th>
                  <th className="py-2 px-3 text-right">Qtd Líquida</th>
                  <th className="py-2 px-3 text-right">Fator Corr.</th>
                  <th className="py-2 px-3 text-right">Custo Estimado</th>
                  <th className="py-2 px-3 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {lines.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-4 text-center text-stone-400">
                      Nenhum ingrediente adicionado à receita ainda.
                    </td>
                  </tr>
                ) : (
                  lines.map((l) => {
                    const ing = ingredientsMap.get(l.ingredientId || '');
                    const gross = l.quantityInBaseUnit * (l.correctionFactor || 1);
                    const cost = ing ? Math.round((gross * ing.currentUnitCostMicrocents) / 10000) : 0;

                    return (
                      <tr key={l.id} className="hover:bg-stone-50/50">
                        <td className="py-2 px-3 font-medium text-stone-800">
                          {ing ? ing.name : 'Insumo'}
                        </td>
                        <td className="py-2 px-3 text-right font-mono">
                          {formatBaseQuantity(l.quantityInBaseUnit, ing ? ing.baseUnit : 'g')}
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-stone-600">
                          {l.correctionFactor > 1 ? `${l.correctionFactor}x` : '1.0'}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-semibold text-stone-900">
                          {formatCentsToCurrency(cost)}
                        </td>
                        <td className="py-2 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveLine(l.id)}
                            className="text-stone-400 hover:text-rose-600 p-1 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Resumo da Porção e Margem em Tempo Real */}
          {previewCost && (
            <div className="p-3.5 bg-stone-900 text-stone-100 rounded-xl space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-stone-300">Custo Total da Receita:</span>
                <span className="font-mono font-bold">{formatCentsToCurrency(previewCost.totalCostInCents)}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-stone-300">Custo por Porção:</span>
                <span className="font-mono font-bold text-amber-400">{formatCentsToCurrency(previewCost.portionCostInCents)}</span>
              </div>
              <div className="flex items-center justify-between text-xs border-t border-stone-800 pt-2">
                <span className="text-stone-300">CMV Teórico (%):</span>
                <span className={`font-mono font-bold ${previewCost.cmvPercentage <= 32 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {previewCost.cmvPercentage}%
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-stone-300">Preço Sugerido ({targetMargin}% Margem):</span>
                <span className="font-mono font-bold text-emerald-400">{formatCentsToCurrency(previewCost.suggestedSalePriceInCents)}</span>
              </div>
            </div>
          )}

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
              Salvar Ficha Técnica
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
